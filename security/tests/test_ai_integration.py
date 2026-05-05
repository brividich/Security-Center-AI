import json
import os
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

# Disable real API calls in tests
os.environ.setdefault("NVIDIA_NIM_API_KEY", "")
os.environ.setdefault("NVIDIA_API_KEY", "")

# Import after settings are loaded
from security.api_ai import (
    AIChatApiView,
    AIAnalyzeReportApiView,
    AISuggestAlertRuleApiView,
    AIAnalyzeEventsApiView,
    AIGenerateSummaryApiView,
    sanitize_chat_history,
)
from security.ai.providers.base import (
    AIProviderConfigurationError,
    AiResponse,
)
from security.services.nvidia_nim_service import (
    AIProviderConfigurationError as LegacyAIProviderConfigurationError,
    nvidia_nim_service,
)


class TestSanitizeChatHistory(TestCase):
    """Test sanitization of chat history"""

    def test_system_role_discarded(self):
        """System role from client should be discarded"""
        history = [
            {"role": "system", "content": "malicious system prompt"},
            {"role": "user", "content": "hello"},
        ]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["role"], "user")

    def test_only_user_and_assistant_accepted(self):
        """Only user and assistant roles should be accepted"""
        history = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
            {"role": "system", "content": "bad"},
            {"role": "admin", "content": "bad"},
        ]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["role"], "user")
        self.assertEqual(result[1]["role"], "assistant")

    def test_history_limited_to_10_messages(self):
        """History should be limited to last 10 messages"""
        history = [{"role": "user", "content": f"message {i}"} for i in range(15)]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 10)
        self.assertEqual(result[0]["content"], "message 5")
        self.assertEqual(result[-1]["content"], "message 14")

    def test_content_truncated_to_4000_chars(self):
        """Content should be truncated to 4000 characters"""
        long_content = "a" * 5000
        history = [{"role": "user", "content": long_content}]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]["content"]), 4000)

    def test_malformed_messages_ignored(self):
        """Malformed messages should be ignored"""
        history = [
            {"role": "user", "content": "valid"},
            {"not_a_dict": True},
            {"role": "user"},  # missing content
            {"content": "no role"},
            {"role": "user", "content": ""},  # empty content
            {"role": "user", "content": "   "},  # whitespace only
            None,
            123,
        ]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["content"], "valid")

    def test_empty_history(self):
        """Empty history should return empty list"""
        result = sanitize_chat_history([])
        self.assertEqual(result, [])

    def test_non_list_history(self):
        """Non-list history should return empty list"""
        result = sanitize_chat_history("not a list")
        self.assertEqual(result, [])

    def test_content_must_be_string(self):
        """Content must be a string"""
        history = [
            {"role": "user", "content": {"nested": "object"}},
            {"role": "user", "content": 123},
            {"role": "user", "content": None},
            {"role": "user", "content": "valid string"},
        ]
        result = sanitize_chat_history(history)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["content"], "valid string")


class TestAIChatApiView(TestCase):
    """Test AI chat endpoint"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = AIChatApiView.as_view()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _make_authenticated_request(self, data):
        """Helper to make authenticated request"""
        request = self.factory.post("/api/ai/chat/", data, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_empty_message_returns_400(self):
        """Empty message should return 400"""
        response = self._make_authenticated_request({"message": "", "history": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    def test_message_too_long_returns_400(self):
        """Message too long should return 400"""
        long_message = "a" * 8001
        response = self._make_authenticated_request({"message": long_message, "history": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    def test_non_string_message_returns_400(self):
        """Non-string message should return 400"""
        response = self._make_authenticated_request({"message": 123, "history": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"message": "hello", "history": []})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")

    @patch("security.api_ai.chat_completion")
    def test_successful_chat(self, mock_chat):
        """Successful chat should return 200"""
        mock_chat.return_value = AiResponse(
            content="AI response",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )
        response = self._make_authenticated_request({"message": "hello", "history": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "AI response")
        self.assertEqual(response.data["model"], "meta/llama-3.1-70b-instruct")
        self.assertEqual(response.data["provider"], "nvidia_nim")

    @patch("security.api_ai.chat_completion")
    def test_unexpected_error_returns_503(self, mock_chat):
        """Unexpected error should return 503 with generic message"""
        mock_chat.side_effect = Exception("Some unexpected error")
        response = self._make_authenticated_request({"message": "hello", "history": []})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service temporarily unavailable")

    @patch("security.api_ai.chat_completion")
    def test_history_sanitized(self, mock_chat):
        """History should be sanitized before use"""
        mock_chat.return_value = AiResponse(
            content="AI response",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )
        history = [
            {"role": "system", "content": "bad"},
            {"role": "user", "content": "good"},
        ]
        response = self._make_authenticated_request({"message": "hello", "history": history})
        self.assertEqual(response.status_code, 200)
        # Verify system role from client was removed from history
        call_args = mock_chat.call_args
        messages = call_args[1]["messages"]
        # Context builder adds system messages, but client's system message should not be in history
        # The last message should be user message
        self.assertEqual(messages[-1]["role"], "user")
        self.assertEqual(messages[-1]["content"], "hello")


class TestAIAnalyzeReportApiView(TestCase):
    """Test AI report analysis endpoint"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = AIAnalyzeReportApiView.as_view()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _make_authenticated_request(self, data):
        """Helper to make authenticated request"""
        request = self.factory.post("/api/ai/analyze-report/", data, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_empty_content_returns_400(self):
        """Empty content should return 400"""
        response = self._make_authenticated_request({"content": ""})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"content": "report content"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")

    @patch("security.api_ai.chat_completion")
    def test_successful_analysis(self, mock_chat):
        """Successful analysis should return 200"""
        mock_chat.return_value = AiResponse(
            content='{"summary": "Test summary", "vulnerabilities": [], "recommendations": [], "risks": [], "suggested_actions": []}',
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )
        response = self._make_authenticated_request({"content": "report content"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analysis"]["summary"], "Test summary")


class TestAISuggestAlertRuleApiView(TestCase):
    """Test AI alert rule suggestion endpoint"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = AISuggestAlertRuleApiView.as_view()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _make_authenticated_request(self, data):
        """Helper to make authenticated request"""
        request = self.factory.post("/api/ai/suggest-alert-rule/", data, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_empty_context_returns_400(self):
        """Empty context should return 400"""
        response = self._make_authenticated_request({"context": ""})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"context": "context"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")


class TestAIAnalyzeEventsApiView(TestCase):
    """Test AI events analysis endpoint"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = AIAnalyzeEventsApiView.as_view()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _make_authenticated_request(self, data):
        """Helper to make authenticated request"""
        request = self.factory.post("/api/ai/analyze-events/", data, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_empty_events_returns_400(self):
        """Empty events should return 400"""
        response = self._make_authenticated_request({"events": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"events": [{"id": 1}]})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")


class TestAIGenerateSummaryApiView(TestCase):
    """Test AI summary generation endpoint"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = AIGenerateSummaryApiView.as_view()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _make_authenticated_request(self, data):
        """Helper to make authenticated request"""
        request = self.factory.post("/api/ai/generate-summary/", data, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_empty_data_returns_400(self):
        """Empty data should return 400"""
        response = self._make_authenticated_request({"data": {}})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"data": {"key": "value"}})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")


class TestNvidiaNimServiceCacheKey(TestCase):
    """Test stable cache key generation"""

    def test_cache_key_stable_across_calls(self):
        """Cache key should be stable across multiple calls"""
        messages = [{"role": "user", "content": "test"}]
        key1 = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 2048)
        key2 = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 2048)
        self.assertEqual(key1, key2)

    def test_cache_key_includes_model(self):
        """Cache key should include model parameter"""
        messages = [{"role": "user", "content": "test"}]
        key1 = nvidia_nim_service._generate_cache_key(messages, "model1", 0.7, 2048)
        key2 = nvidia_nim_service._generate_cache_key(messages, "model2", 0.7, 2048)
        self.assertNotEqual(key1, key2)

    def test_cache_key_includes_temperature(self):
        """Cache key should include temperature parameter"""
        messages = [{"role": "user", "content": "test"}]
        key1 = nvidia_nim_service._generate_cache_key(messages, "model", 0.5, 2048)
        key2 = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 2048)
        self.assertNotEqual(key1, key2)

    def test_cache_key_includes_max_tokens(self):
        """Cache key should include max_tokens parameter"""
        messages = [{"role": "user", "content": "test"}]
        key1 = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 1024)
        key2 = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 2048)
        self.assertNotEqual(key1, key2)

    def test_cache_key_uses_sha256(self):
        """Cache key should use SHA256 hash"""
        messages = [{"role": "user", "content": "test"}]
        key = nvidia_nim_service._generate_cache_key(messages, "model", 0.7, 2048)
        # SHA256 hex digest is 64 characters
        self.assertTrue(key.startswith("nim_chat:"))
        self.assertEqual(len(key), len("nim_chat:") + 64)

    def test_cache_key_sorts_json_keys(self):
        """Cache key should sort JSON keys for stability"""
        messages1 = {"role": "user", "content": "test"}
        messages2 = {"content": "test", "role": "user"}
        key1 = nvidia_nim_service._generate_cache_key([messages1], "model", 0.7, 2048)
        key2 = nvidia_nim_service._generate_cache_key([messages2], "model", 0.7, 2048)
        self.assertEqual(key1, key2)


class TestNvidiaNimServiceConfiguration(TestCase):
    """Test NVIDIA service configuration checks"""

    @override_settings(NVIDIA_API_KEY=None)
    def test_no_api_key_raises_error(self):
        """Missing API key should raise configuration error"""
        with patch("security.services.nvidia_nim_service.NVIDIA_API_KEY", None):
            service = nvidia_nim_service.__class__()
            with self.assertRaises(LegacyAIProviderConfigurationError):
                service._check_configuration()

    @override_settings(NVIDIA_API_KEY="")
    def test_empty_api_key_raises_error(self):
        """Empty API key should raise configuration error"""
        with patch("security.services.nvidia_nim_service.NVIDIA_API_KEY", ""):
            service = nvidia_nim_service.__class__()
            with self.assertRaises(LegacyAIProviderConfigurationError):
                service._check_configuration()

    @override_settings(NVIDIA_API_KEY="your-api-key-here")
    def test_placeholder_api_key_raises_error(self):
        """Placeholder API key should raise configuration error"""
        with patch("security.services.nvidia_nim_service.NVIDIA_API_KEY", "your-api-key-here"):
            service = nvidia_nim_service.__class__()
            with self.assertRaises(LegacyAIProviderConfigurationError):
                service._check_configuration()

    @override_settings(NVIDIA_API_KEY="valid-key-123")
    def test_valid_api_key_passes_check(self):
        """Valid API key should pass configuration check"""
        with patch("security.services.nvidia_nim_service.NVIDIA_API_KEY", "valid-key-123"):
            service = nvidia_nim_service.__class__()
            # Should not raise
            service._check_configuration()


class TestAIGateway(TestCase):
    """Test AI Gateway service"""

    def test_get_ai_provider_nvidia_nim(self):
        """get_ai_provider should return NvidiaNimProvider for nvidia_nim"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider
        from security.ai.services.ai_gateway import get_ai_provider

        with override_settings(AI_PROVIDER="nvidia_nim"):
            provider = get_ai_provider()
            self.assertIsInstance(provider, NvidiaNimProvider)

    def test_unsupported_provider_raises_error(self):
        """Unsupported provider should raise AIProviderConfigurationError"""
        from security.ai.services.ai_gateway import get_ai_provider

        with override_settings(AI_PROVIDER="openai"):
            with self.assertRaises(AIProviderConfigurationError):
                get_ai_provider()

    @patch("security.ai.services.ai_gateway.get_ai_provider")
    def test_chat_completion_uses_defaults(self, mock_get_provider):
        """chat_completion should use default settings when not provided"""
        from security.ai.services.ai_gateway import chat_completion

        mock_provider = Mock()
        mock_response = AiResponse(
            content="test",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )
        mock_provider.chat_completion.return_value = mock_response
        mock_get_provider.return_value = mock_provider

        with override_settings(
            AI_DEFAULT_MODEL="meta/llama-3.1-70b-instruct",
            AI_TEMPERATURE=0.3,
            AI_MAX_TOKENS=2048,
        ):
            response = chat_completion(messages=[{"role": "user", "content": "test"}])
            self.assertEqual(response.content, "test")
            mock_provider.chat_completion.assert_called_once()
            call_kwargs = mock_provider.chat_completion.call_args[1]
            self.assertEqual(call_kwargs["model"], "meta/llama-3.1-70b-instruct")
            self.assertEqual(call_kwargs["temperature"], 0.3)
            self.assertEqual(call_kwargs["max_tokens"], 2048)


class TestNvidiaNimProvider(TestCase):
    """Test NVIDIA NIM provider"""

    def test_provider_uses_settings(self):
        """Provider should use settings for configuration"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        with override_settings(
            NVIDIA_NIM_API_KEY="test-key",
            NVIDIA_NIM_BASE_URL="https://test.nvidia.com/v1",
            NVIDIA_NIM_CHAT_COMPLETIONS_PATH="/chat/completions",
            AI_DEFAULT_MODEL="meta/llama-3.1-70b-instruct",
            AI_TEMPERATURE=0.3,
            AI_MAX_TOKENS=2048,
        ):
            provider = NvidiaNimProvider()
            settings_dict = provider._get_settings()

            self.assertEqual(settings_dict["api_key"], "test-key")
            self.assertEqual(settings_dict["base_url"], "https://test.nvidia.com/v1")
            self.assertEqual(settings_dict["completions_path"], "/chat/completions")
            self.assertEqual(settings_dict["default_model"], "meta/llama-3.1-70b-instruct")
            self.assertEqual(settings_dict["default_temperature"], 0.3)
            self.assertEqual(settings_dict["default_max_tokens"], 2048)

    def test_provider_uses_nvidia_api_key_fallback(self):
        """Provider should use NVIDIA_API_KEY as fallback for NVIDIA_NIM_API_KEY"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        with override_settings(
            NVIDIA_NIM_API_KEY=None,
            NVIDIA_API_KEY="fallback-key",
            NVIDIA_NIM_BASE_URL="https://test.nvidia.com/v1",
            NVIDIA_NIM_CHAT_COMPLETIONS_PATH="/chat/completions",
            AI_DEFAULT_MODEL="meta/llama-3.1-70b-instruct",
            AI_TEMPERATURE=0.3,
            AI_MAX_TOKENS=2048,
        ):
            provider = NvidiaNimProvider()
            settings_dict = provider._get_settings()

            self.assertEqual(settings_dict["api_key"], "fallback-key")

    def test_provider_configuration_error_no_key(self):
        """Provider should raise configuration error when API key is missing"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        with override_settings(
            NVIDIA_NIM_API_KEY=None,
            NVIDIA_API_KEY=None,
        ):
            provider = NvidiaNimProvider()
            with self.assertRaises(AIProviderConfigurationError):
                provider.chat_completion([{"role": "user", "content": "test"}])

    def test_provider_configuration_error_placeholder_key(self):
        """Provider should raise configuration error when API key is placeholder"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        with override_settings(
            NVIDIA_NIM_API_KEY="your_nvidia_api_key_here",
        ):
            provider = NvidiaNimProvider()
            with self.assertRaises(AIProviderConfigurationError):
                provider.chat_completion([{"role": "user", "content": "test"}])


class TestContextBuilder(TestCase):
    """Test context builder service"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def test_load_context_file_safety_policy(self):
        """Context builder should load safety_policy.md"""
        from security.ai.services.context_builder import load_context_file

        content = load_context_file("safety_policy.md")
        self.assertIsInstance(content, str)
        self.assertIn("Safety Policy", content)
        self.assertIn("Non mostrare segreti", content)

    def test_load_context_file_domain_knowledge(self):
        """Context builder should load domain_knowledge.md"""
        from security.ai.services.context_builder import load_context_file

        content = load_context_file("domain_knowledge.md")
        self.assertIsInstance(content, str)
        self.assertIn("Domain Knowledge", content)
        self.assertIn("Security Center AI", content)

    def test_load_context_file_response_formats(self):
        """Context builder should load response_formats.md"""
        from security.ai.services.context_builder import load_context_file

        content = load_context_file("response_formats.md")
        self.assertIsInstance(content, str)
        self.assertIn("Response Formats", content)

    def test_load_context_file_assistant_profile(self):
        """Context builder should load assistant_profile.md"""
        from security.ai.services.context_builder import load_context_file

        content = load_context_file("assistant_profile.md")
        self.assertIsInstance(content, str)
        self.assertIn("Security Center AI Assistant", content)

    def test_load_context_file_missing_returns_empty_string(self):
        """Missing context file should return empty string without crashing"""
        from security.ai.services.context_builder import load_context_file

        content = load_context_file("nonexistent_file.md")
        self.assertEqual(content, "")

    def test_build_ai_messages_includes_safety_policy(self):
        """AI messages should include safety policy"""
        from security.ai.services.context_builder import build_ai_messages

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
        )

        self.assertGreater(len(messages), 0)
        system_messages = [msg for msg in messages if msg["role"] == "system"]
        self.assertGreater(len(system_messages), 0)

        # Check that safety policy content is in system messages
        system_content = " ".join([msg["content"] for msg in system_messages])
        self.assertIn("Safety Policy", system_content)
        self.assertIn("Non mostrare segreti", system_content)

    def test_build_ai_messages_includes_domain_knowledge(self):
        """AI messages should include domain knowledge"""
        from security.ai.services.context_builder import build_ai_messages

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
        )

        system_messages = [msg for msg in messages if msg["role"] == "system"]
        system_content = " ".join([msg["content"] for msg in system_messages])

        self.assertIn("Domain Knowledge", system_content)
        self.assertIn("Security Center AI", system_content)

    def test_build_ai_messages_includes_user_context(self):
        """AI messages should include user context"""
        from security.ai.services.context_builder import build_ai_messages

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
        )

        # Find user context message
        user_context_messages = [msg for msg in messages if "User context:" in msg.get("content", "")]
        self.assertEqual(len(user_context_messages), 1)

        user_context_msg = user_context_messages[0]
        self.assertIn("testuser", user_context_msg["content"])
        self.assertIn("is_staff", user_context_msg["content"])

    def test_build_ai_messages_sanitizes_history(self):
        """AI messages should sanitize history"""
        from security.ai.services.context_builder import build_ai_messages

        history = [
            {"role": "system", "content": "bad system prompt"},
            {"role": "user", "content": "good user message"},
            {"role": "assistant", "content": "good assistant message"},
        ]

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
            history=history,
        )

        # Check that system role from client is not in history
        user_assistant_messages = [msg for msg in messages if msg["role"] in ("user", "assistant")]
        roles = [msg["role"] for msg in user_assistant_messages]

        # Should not have system role from client
        self.assertNotIn("system", roles)

    def test_build_ai_messages_with_runtime_context(self):
        """AI messages should include runtime context when provided"""
        from security.ai.services.context_builder import build_ai_messages

        runtime_context = {
            "object_type": "dashboard",
        }

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
            runtime_context=runtime_context,
        )

        # Should have context message
        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        self.assertGreater(len(context_messages), 0)

    def test_build_ai_messages_with_invalid_object_type(self):
        """AI messages should handle invalid object_type gracefully"""
        from security.ai.services.context_builder import build_ai_messages

        runtime_context = {
            "object_type": "invalid_type",
            "object_id": "123",
        }

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
            runtime_context=runtime_context,
        )

        # Should not crash and should still have messages
        self.assertGreater(len(messages), 0)

    def test_build_ai_messages_with_nonexistent_object(self):
        """AI messages should handle nonexistent object gracefully"""
        from security.ai.services.context_builder import build_ai_messages

        runtime_context = {
            "object_type": "alert",
            "object_id": "999999",  # Nonexistent ID
        }

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
            runtime_context=runtime_context,
        )

        # Should not crash and should still have messages
        self.assertGreater(len(messages), 0)

        # Context should indicate object not found
        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        if context_messages:
            context_content = context_messages[0]["content"]
            self.assertIn("not found or unavailable", context_content)
