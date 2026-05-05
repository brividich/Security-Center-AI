import hashlib
import logging
from typing import Any

import requests
from django.core.cache import cache
from requests.exceptions import HTTPError, RequestException, Timeout

from .base import (
    AiProvider,
    AiResponse,
    AIProviderConfigurationError,
    AIProviderResponseError,
    AIProviderUnavailableError,
)

logger = logging.getLogger(__name__)


class NvidiaNimProvider(AiProvider):
    """NVIDIA NIM AI provider implementation"""

    provider_name = "nvidia_nim"

    def __init__(self):
        self.timeout = 30

    def _get_settings(self):
        """Get settings at runtime"""
        from django.conf import settings

        api_key = getattr(settings, "NVIDIA_NIM_API_KEY", None)
        if not api_key:
            api_key = getattr(settings, "NVIDIA_API_KEY", None)

        return {
            "api_key": api_key,
            "base_url": getattr(settings, "NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            "completions_path": getattr(settings, "NVIDIA_NIM_CHAT_COMPLETIONS_PATH", "/chat/completions"),
            "default_model": getattr(settings, "AI_DEFAULT_MODEL", "meta/llama-3.1-70b-instruct"),
            "default_temperature": getattr(settings, "AI_TEMPERATURE", 0.3),
            "default_max_tokens": getattr(settings, "AI_MAX_TOKENS", 2048),
        }

    def _validate_configuration(self, settings_dict):
        """Validate provider configuration"""
        api_key = settings_dict["api_key"]

        if not api_key:
            raise AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")

        if api_key in ("your_nvidia_api_key_here", "placeholder", "test"):
            raise AIProviderConfigurationError("NVIDIA_NIM_API_KEY is a placeholder value")

    def _get_cache_key(self, messages: list[dict[str, str]], model: str) -> str:
        """Generate stable cache key for request"""
        key_data = f"{self.provider_name}:{model}:{str(messages)}"
        return f"ai_response:{hashlib.sha256(key_data.encode()).hexdigest()}"

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AiResponse:
        """Generate chat completion using NVIDIA NIM API"""
        settings_dict = self._get_settings()
        self._validate_configuration(settings_dict)

        model = model or settings_dict["default_model"]
        temperature = temperature if temperature is not None else settings_dict["default_temperature"]
        max_tokens = max_tokens if max_tokens is not None else settings_dict["default_max_tokens"]

        cache_key = self._get_cache_key(messages, model)
        cached_response = cache.get(cache_key)

        if cached_response:
            logger.debug(f"AI cache hit for {model}")
            return cached_response

        url = f"{settings_dict['base_url']}{settings_dict['completions_path']}"
        headers = {
            "Authorization": f"Bearer {settings_dict['api_key']}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            logger.info(f"Calling NVIDIA NIM API: {model}")
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            response.raise_for_status()

            data = response.json()

            if "choices" not in data or not data["choices"]:
                raise AIProviderResponseError("Invalid response: no choices in response")

            content = data["choices"][0]["message"]["content"]

            ai_response = AiResponse(
                content=content,
                provider=self.provider_name,
                model=model,
                raw=data,
                usage=data.get("usage"),
            )

            cache.set(cache_key, ai_response, timeout=3600)
            logger.info(f"NVIDIA NIM API success: {model}, tokens={data.get('usage', {}).get('total_tokens', 'N/A')}")

            return ai_response

        except Timeout:
            logger.error("NVIDIA NIM API timeout")
            raise AIProviderUnavailableError("AI provider timeout")
        except HTTPError as e:
            logger.error(f"NVIDIA NIM API HTTP error: {e.response.status_code}")
            raise AIProviderUnavailableError(f"AI provider HTTP error: {e.response.status_code}")
        except RequestException as e:
            logger.error(f"NVIDIA NIM API request error: {e}")
            raise AIProviderUnavailableError("AI provider request failed")
        except (KeyError, ValueError) as e:
            logger.error(f"NVIDIA NIM API response parsing error: {e}")
            raise AIProviderResponseError("Invalid response format")
