"""AI Gateway service for provider abstraction"""

import logging

from django.conf import settings

from ..providers.base import (
    AIProviderConfigurationError,
    AiProvider,
    AiResponse,
)
from ..providers.nvidia_nim import NvidiaNimProvider

logger = logging.getLogger(__name__)


def get_ai_provider() -> AiProvider:
    """Get configured AI provider instance

    Returns:
        AiProvider instance based on AI_PROVIDER setting

    Raises:
        AIProviderConfigurationError: If provider is not supported
    """
    provider_name = getattr(settings, "AI_PROVIDER", "nvidia_nim")

    if provider_name == "nvidia_nim":
        return NvidiaNimProvider()

    raise AIProviderConfigurationError(f"Unsupported AI provider: {provider_name}")


def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AiResponse:
    """Generate chat completion using configured AI provider

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name to use (uses AI_DEFAULT_MODEL if None)
        temperature: Sampling temperature (uses AI_TEMPERATURE if None)
        max_tokens: Maximum tokens to generate (uses AI_MAX_TOKENS if None)

    Returns:
        AiResponse with content, provider, model, and optional raw/usage data

    Raises:
        AIProviderConfigurationError: Provider not configured
        AIProviderUnavailableError: Provider temporarily unavailable
        AIProviderResponseError: Invalid response from provider
    """
    provider = get_ai_provider()

    if model is None:
        model = getattr(settings, "AI_DEFAULT_MODEL", "meta/llama-3.1-70b-instruct")

    if temperature is None:
        temperature = getattr(settings, "AI_TEMPERATURE", 0.3)

    if max_tokens is None:
        max_tokens = getattr(settings, "AI_MAX_TOKENS", 2048)

    return provider.chat_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
