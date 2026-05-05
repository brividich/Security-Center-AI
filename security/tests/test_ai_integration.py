import json
import os
from unittest.mock import Mock, patch

from django.contrib.auth.models import Permission, User
from django.test import TestCase, override_settings
from django.utils import timezone
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
    AIProviderStatusApiView,
    AIOperationsSummaryApiView,
    sanitize_chat_history,
)
from security.ai.providers.base import (
    AIProviderConfigurationError,
    AIProviderResponseError,
    AIProviderUnavailableError,
    AiResponse,
)
from security.models import (
    SecurityAiInteractionLog,
    SecurityAlert,
    SecurityAsset,
    SecurityEventRecord,
    SecurityEvidenceContainer,
    SecurityRemediationTicket,
    SecurityReport,
    SecuritySource,
    SecurityVulnerabilityFinding,
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
    def test_provider_error_logged_without_exposing_detail(self, mock_chat):
        """Provider failures should be logged generically as provider_error"""
        mock_chat.side_effect = AIProviderUnavailableError("provider detail should stay internal")
        response = self._make_authenticated_request({
            "message": "hello",
            "history": [],
            "context": {"page": "alert", "object_type": "alert", "object_id": 42},
        })

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service temporarily unavailable")

        log = SecurityAiInteractionLog.objects.get()
        self.assertEqual(log.status, "provider_error")
        self.assertEqual(log.page, "alert")
        self.assertEqual(log.object_type, "alert")
        self.assertEqual(log.object_id, "42")
        self.assertEqual(log.error_message, "AIProviderUnavailableError")
        self.assertNotIn("provider detail", log.error_message)

    @patch("security.api_ai.chat_completion")
    def test_provider_response_error_logged_as_provider_error(self, mock_chat):
        """Malformed provider responses should use the provider_error status"""
        mock_chat.side_effect = AIProviderResponseError("invalid provider payload detail")
        response = self._make_authenticated_request({"message": "hello", "history": []})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service temporarily unavailable")
        self.assertEqual(SecurityAiInteractionLog.objects.get().status, "provider_error")

    @patch("security.api_ai.chat_completion")
    def test_non_dict_context_is_ignored_without_500(self, mock_chat):
        """String/list context payloads should not break chat or log metadata"""
        mock_chat.return_value = AiResponse(
            content="AI response",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        for context in ["not a dict", ["alert", 1], None]:
            with self.subTest(context=context):
                SecurityAiInteractionLog.objects.all().delete()
                response = self._make_authenticated_request({"message": "hello", "history": [], "context": context})
                self.assertEqual(response.status_code, 200)
                log = SecurityAiInteractionLog.objects.get()
                self.assertEqual(log.page, "")
                self.assertEqual(log.object_type, "")
                self.assertEqual(log.object_id, "")

    @patch("security.api_ai.chat_completion")
    def test_invalid_context_metadata_is_not_logged(self, mock_chat):
        """Only whitelisted context metadata should be saved in audit logs"""
        mock_chat.return_value = AiResponse(
            content="AI response",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        response = self._make_authenticated_request({
            "message": "hello",
            "history": [],
            "context": {
                "page": "admin-secret-page",
                "object_type": "not_allowed",
                "object_id": "secret-token-value",
                "api_key": "sk-redacted-placeholder",
            },
        })

        self.assertEqual(response.status_code, 200)
        log = SecurityAiInteractionLog.objects.get()
        self.assertEqual(log.page, "")
        self.assertEqual(log.object_type, "")
        self.assertEqual(log.object_id, "")

    @patch("security.api_ai.chat_completion")
    def test_requested_context_pages_are_whitelisted(self, mock_chat):
        """Only the approved short page labels should be saved from client context"""
        mock_chat.return_value = AiResponse(
            content="AI response",
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        for page in ["dashboard", "alert", "report", "ticket", "evidence", "alerts", "reports", "ai", "overview"]:
            with self.subTest(page=page):
                SecurityAiInteractionLog.objects.all().delete()
                response = self._make_authenticated_request({
                    "message": "hello",
                    "history": [],
                    "context": {"page": page, "extra_secret": "sk-redacted-placeholder"},
                })

                self.assertEqual(response.status_code, 200)
                log = SecurityAiInteractionLog.objects.get()
                self.assertEqual(log.page, page)
                self.assertEqual(log.object_type, "")
                self.assertEqual(log.object_id, "")

    @patch("security.api_ai.chat_completion")
    def test_unexpected_error_log_is_redacted(self, mock_chat):
        """Unexpected error messages should be redacted before audit storage"""
        mock_chat.side_effect = Exception(
            "failure Bearer ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890 Password=ExampleSecret123"
        )

        response = self._make_authenticated_request({"message": "hello", "history": []})

        self.assertEqual(response.status_code, 503)
        log = SecurityAiInteractionLog.objects.get()
        self.assertEqual(log.status, "error")
        self.assertIn("[REDACTED]", log.error_message)
        self.assertNotIn("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890", log.error_message)
        self.assertNotIn("ExampleSecret123", log.error_message)

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

    def test_non_string_or_too_large_content_returns_400(self):
        """Report analysis accepts only bounded string content"""
        for content in [{"nested": "value"}, ["report"], None, "a" * 20001]:
            with self.subTest(content_type=type(content).__name__):
                response = self._make_authenticated_request({"content": content})
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

    @patch("security.api_ai.chat_completion")
    def test_report_content_is_redacted_before_gateway(self, mock_chat):
        """Report analysis must not send raw tokens, webhooks, or connection strings"""
        mock_chat.return_value = AiResponse(
            content='{"summary": "Test summary", "vulnerabilities": [], "recommendations": [], "risks": [], "suggested_actions": []}',
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        response = self._make_authenticated_request({
            "content": (
                "Token Bearer ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890 "
                "Webhook https://example.com/webhook/services/secret-token "
                "Connection Server=example.local;Password=ExampleSecret123;"
            )
        })

        self.assertEqual(response.status_code, 200)
        messages = mock_chat.call_args[1]["messages"]
        user_content = messages[-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertNotIn("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890", user_content)
        self.assertNotIn("secret-token", user_content)
        self.assertNotIn("ExampleSecret123", user_content)


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

    def test_non_string_or_too_large_context_returns_400(self):
        """Rule suggestion accepts only bounded string context"""
        for context in [{"nested": "value"}, ["context"], None, "a" * 20001]:
            with self.subTest(context_type=type(context).__name__):
                response = self._make_authenticated_request({"context": context})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"context": "context"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")

    @patch("security.api_ai.chat_completion")
    def test_context_is_redacted_before_gateway(self, mock_chat):
        """Rule suggestions must redact raw context before sending it to the provider"""
        mock_chat.return_value = AiResponse(
            content='{"rule_name": "Example", "condition": "severity == high", "severity": "high", "description": "desc", "recommended_actions": [], "rationale": "why"}',
            provider="nvidia_nim",
            model="meta/llama-3.1-8b-instruct",
        )

        response = self._make_authenticated_request({
            "context": "Slack token xoxb-abcdefghijklmnopqrstuvwxyz123456 and webhook https://example.com/webhook/hook-secret"
        })

        self.assertEqual(response.status_code, 200)
        user_content = mock_chat.call_args[1]["messages"][-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertNotIn("xoxb-abcdefghijklmnopqrstuvwxyz123456", user_content)
        self.assertNotIn("hook-secret", user_content)


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

    def test_invalid_or_too_large_events_returns_400(self):
        """Event analysis accepts only bounded dict/list payloads"""
        for events in ["raw events", 123, None, {"payload": "a" * 20001}]:
            with self.subTest(events_type=type(events).__name__):
                response = self._make_authenticated_request({"events": events})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"events": [{"id": 1}]})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")

    @patch("security.api_ai.chat_completion")
    def test_events_are_redacted_before_gateway(self, mock_chat):
        """Event payloads should be recursively redacted before provider calls"""
        mock_chat.return_value = AiResponse(
            content='{"patterns": [], "anomalies": [], "correlations": [], "potential_threats": [], "recommendations": []}',
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        response = self._make_authenticated_request({
            "events": [
                {
                    "id": "evt-1",
                    "severity": "high",
                    "payload": {"authorization": "Bearer ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"},
                }
            ]
        })

        self.assertEqual(response.status_code, 200)
        user_content = mock_chat.call_args[1]["messages"][-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertIn('"severity": "high"', user_content)
        self.assertNotIn("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890", user_content)

    @patch("security.api_ai.chat_completion")
    def test_event_dict_is_redacted_before_gateway(self, mock_chat):
        """Event analysis should also accept and redact dict payloads"""
        mock_chat.return_value = AiResponse(
            content='{"patterns": [], "anomalies": [], "correlations": [], "potential_threats": [], "recommendations": []}',
            provider="nvidia_nim",
            model="meta/llama-3.1-70b-instruct",
        )

        response = self._make_authenticated_request({
            "events": {
                "severity": "critical",
                "graph_client_secret": "ExampleSecret123",
            }
        })

        self.assertEqual(response.status_code, 200)
        user_content = mock_chat.call_args[1]["messages"][-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertIn('"severity": "critical"', user_content)
        self.assertNotIn("ExampleSecret123", user_content)


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

    def test_invalid_or_too_large_data_returns_400(self):
        """Summary generation accepts only bounded dict/list payloads"""
        for data in ["raw data", 123, None, {"payload": "a" * 20001}]:
            with self.subTest(data_type=type(data).__name__):
                response = self._make_authenticated_request({"data": data})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["error"], "Invalid AI request")

    @patch("security.api_ai.chat_completion")
    def test_provider_not_configured_returns_503(self, mock_chat):
        """Provider not configured should return 503"""
        mock_chat.side_effect = AIProviderConfigurationError("NVIDIA_NIM_API_KEY not configured")
        response = self._make_authenticated_request({"data": {"key": "value"}})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "AI service not configured")

    @patch("security.api_ai.chat_completion")
    def test_dict_and_list_data_is_redacted_before_gateway(self, mock_chat):
        """Summary payloads should be recursively redacted before provider calls"""
        mock_chat.return_value = AiResponse(
            content="Sintesi sicura",
            provider="nvidia_nim",
            model="meta/llama-3.1-8b-instruct",
        )

        response = self._make_authenticated_request({
            "data": {
                "items": [
                    {
                        "severity": "high",
                        "connection_string": "Server=example.local;Password=ExampleSecret123;",
                    }
                ],
                "nested_token": "ghp_abcdefghijklmnopqrstuvwxyz123456",
            }
        })

        self.assertEqual(response.status_code, 200)
        user_content = mock_chat.call_args[1]["messages"][-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertIn('"severity": "high"', user_content)
        self.assertNotIn("ExampleSecret123", user_content)
        self.assertNotIn("ghp_abcdefghijklmnopqrstuvwxyz123456", user_content)

    @patch("security.api_ai.chat_completion")
    def test_list_data_is_redacted_before_gateway(self, mock_chat):
        """Summary generation should accept and redact list payloads"""
        mock_chat.return_value = AiResponse(
            content="Sintesi sicura",
            provider="nvidia_nim",
            model="meta/llama-3.1-8b-instruct",
        )

        response = self._make_authenticated_request({
            "data": [
                {
                    "status": "open",
                    "teams_webhook_url": "https://example.com/webhook/secret-path",
                }
            ]
        })

        self.assertEqual(response.status_code, 200)
        user_content = mock_chat.call_args[1]["messages"][-1]["content"]
        self.assertIn("[REDACTED]", user_content)
        self.assertIn('"status": "open"', user_content)
        self.assertNotIn("secret-path", user_content)


class TestAIStatusEndpoints(TestCase):
    """Test AI operational status endpoints avoid secret exposure"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)

    def _get_authenticated_response(self, view_class):
        request = self.factory.get("/api/security/ai/status/")
        force_authenticate(request, user=self.user)
        return view_class.as_view()(request)

    @override_settings(
        NVIDIA_NIM_API_KEY="placeholder",
        NVIDIA_NIM_BASE_URL="https://ai-provider.example.local/v1",
    )
    def test_provider_status_does_not_expose_base_url_or_secret_error(self):
        SecurityAiInteractionLog.objects.create(
            user=self.user,
            action="chat",
            status="provider_error",
            error_message="Webhook https://example.com/webhook/secret-path Password=ExampleSecret123",
        )

        response = self._get_authenticated_response(AIProviderStatusApiView)

        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertNotIn("base_url", data)
        self.assertEqual(data["base_url_label"], "custom")
        serialized = json.dumps(data)
        self.assertNotIn("ai-provider.example.local", serialized)
        self.assertNotIn("secret-path", serialized)
        self.assertNotIn("ExampleSecret123", serialized)
        self.assertIn("[REDACTED]", data["last_error_message"])

    @override_settings(
        NVIDIA_NIM_API_KEY="placeholder",
        NVIDIA_NIM_BASE_URL="https://ai-provider.example.local/v1",
    )
    def test_operations_summary_does_not_expose_base_url_or_secret_error(self):
        SecurityAiInteractionLog.objects.create(
            user=self.user,
            action="chat",
            status="provider_error",
            error_message="Connection Server=example.local;Password=ExampleSecret123;",
        )

        response = self._get_authenticated_response(AIOperationsSummaryApiView)

        self.assertEqual(response.status_code, 200)
        provider_status = response.data["provider_status"]
        self.assertNotIn("base_url", provider_status)
        self.assertEqual(provider_status["base_url_label"], "custom")
        serialized = json.dumps(response.data)
        self.assertNotIn("ai-provider.example.local", serialized)
        self.assertNotIn("ExampleSecret123", serialized)
        self.assertIn("[REDACTED]", provider_status["last_error_message"])

    @override_settings(
        NVIDIA_NIM_API_KEY=None,
        NVIDIA_API_KEY=None,
        NVIDIA_NIM_BASE_URL=None,
    )
    def test_provider_status_labels_missing_base_url(self):
        response = self._get_authenticated_response(AIProviderStatusApiView)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["base_url_label"], "missing")
        self.assertNotIn("base_url", response.data)


class TestAIRedactionService(TestCase):
    """Test AI redaction helpers for secret-like values"""

    def test_redact_text_masks_jwt_webhook_connection_string_and_credentials_url(self):
        from security.ai.services.redaction import redact_text

        raw_text = (
            "jwt aaaaaaaaaa.bbbbbbbbbb.cccccccccc "
            "webhook https://hooks.slack.com/services/T00000000/B00000000/abcdefghijklmnopqrstuvwxyz "
            "url https://user1:ExampleSecret123@example.com/redacted "
            "conn Server=example.local;Password=ExampleSecret123;AccountKey=abcdefghijklmnopqrstuvwxyz123456;Secret=HiddenSecret12345;"
        )

        redacted = redact_text(raw_text)

        self.assertIn("[REDACTED]", redacted)
        self.assertNotIn("aaaaaaaaaa.bbbbbbbbbb.cccccccccc", redacted)
        self.assertNotIn("hooks.slack.com/services", redacted)
        self.assertNotIn("user1:ExampleSecret123", redacted)
        self.assertNotIn("ExampleSecret123", redacted)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz123456", redacted)
        self.assertNotIn("HiddenSecret12345", redacted)

    def test_redact_dict_masks_compound_sensitive_keys(self):
        from security.ai.services.redaction import redact_dict

        payload = {
            "graph_client_secret": "ExampleSecret123",
            "teams_webhook_url": "https://example.com/webhook/secret-path",
            "db_connection_string": "Server=example.local;Password=ExampleSecret123;",
            "nested": {"custom_api_token_value": "token-redacted-placeholder"},
            "cve": "CVE-2099-0001",
            "cvss": 9.8,
            "severity": "critical",
            "status": "open",
            "affected_product": "Example Product",
            "exposed_devices": 2,
            "parser_name": "example_parser",
            "source_type": "email",
        }

        redacted = redact_dict(payload)

        self.assertEqual(redacted["graph_client_secret"], "[REDACTED]")
        self.assertEqual(redacted["teams_webhook_url"], "[REDACTED]")
        self.assertEqual(redacted["db_connection_string"], "[REDACTED]")
        self.assertEqual(redacted["nested"]["custom_api_token_value"], "[REDACTED]")
        self.assertEqual(redacted["cve"], "CVE-2099-0001")
        self.assertEqual(redacted["cvss"], 9.8)
        self.assertEqual(redacted["severity"], "critical")
        self.assertEqual(redacted["status"], "open")
        self.assertEqual(redacted["affected_product"], "Example Product")
        self.assertEqual(redacted["exposed_devices"], 2)
        self.assertEqual(redacted["parser_name"], "example_parser")
        self.assertEqual(redacted["source_type"], "email")


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

    def test_cache_key_includes_temperature_and_max_tokens(self):
        """Provider cache key should vary with generation parameters"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        provider = NvidiaNimProvider()
        messages = [{"role": "user", "content": "test"}]

        base_key = provider._get_cache_key(messages, "model", 0.3, 2048)
        temperature_key = provider._get_cache_key(messages, "model", 0.7, 2048)
        max_tokens_key = provider._get_cache_key(messages, "model", 0.3, 1024)

        self.assertNotEqual(base_key, temperature_key)
        self.assertNotEqual(base_key, max_tokens_key)

    def test_cache_key_sorts_message_json_keys(self):
        """Provider cache key should be stable for equivalent message JSON"""
        from security.ai.providers.nvidia_nim import NvidiaNimProvider

        provider = NvidiaNimProvider()
        key1 = provider._get_cache_key([{"role": "user", "content": "test"}], "model", 0.3, 2048)
        key2 = provider._get_cache_key([{"content": "test", "role": "user"}], "model", 0.3, 2048)

        self.assertEqual(key1, key2)


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

    def test_alert_context_includes_event_occurred_at_and_payload(self):
        """Alert context should use real event timestamp fields"""
        from security.ai.services.context_builder import get_alert_context

        source = SecuritySource.objects.create(
            name="Example Source",
            vendor="Example Vendor",
            source_type="email",
        )
        occurred_at = timezone.now()
        event = SecurityEventRecord.objects.create(
            source=source,
            event_type="example.alert",
            severity="high",
            occurred_at=occurred_at,
            fingerprint="example-alert-fingerprint",
            dedup_hash="example-alert-dedup",
            payload={"host": "EXAMPLE-HOST", "ip": "192.0.2.10"},
        )
        alert = SecurityAlert.objects.create(
            source=source,
            event=event,
            title="Example alert",
            severity="high",
            dedup_hash="example-alert-hash",
        )

        context = get_alert_context(alert.id)

        self.assertNotIn("error", context)
        self.assertEqual(context["event"]["payload"], {"host": "EXAMPLE-HOST", "ip": "192.0.2.10"})
        self.assertEqual(context["event"]["occurred_at"], occurred_at.isoformat())
        self.assertIn("created_at", context["event"])
        self.assertNotIn("parsed_at", context["event"])

    def test_report_context_includes_vulnerability_findings(self):
        """Report context should query vulnerability findings with real model fields"""
        from security.ai.services.context_builder import get_report_context

        source = SecuritySource.objects.create(
            name="Example Defender Source",
            vendor="Example Vendor",
            source_type="email",
        )
        report = SecurityReport.objects.create(
            source=source,
            report_type="defender_vulnerability",
            title="Example Defender report",
            parser_name="example_parser",
        )
        asset = SecurityAsset.objects.create(
            source=source,
            hostname="EXAMPLE-HOST",
            ip_address="192.0.2.10",
            asset_type="workstation",
        )
        SecurityVulnerabilityFinding.objects.create(
            source=source,
            report=report,
            asset=asset,
            cve="CVE-2099-0001",
            affected_product="Example Product",
            cvss=9.8,
            exposed_devices=3,
            severity="critical",
            status="open",
            dedup_hash="example-vuln-dedup",
            payload={"recommendation": "Use the synthetic remediation plan"},
        )

        context = get_report_context(report.id)

        self.assertNotIn("error", context)
        self.assertEqual(len(context["vulnerabilities"]), 1)
        vulnerability = context["vulnerabilities"][0]
        self.assertEqual(vulnerability["cve"], "CVE-2099-0001")
        self.assertEqual(vulnerability["severity"], "critical")
        self.assertEqual(vulnerability["status"], "open")
        self.assertEqual(vulnerability["cvss"], 9.8)
        self.assertEqual(vulnerability["asset"], "EXAMPLE-HOST")
        self.assertEqual(vulnerability["affected_product"], "Example Product")
        self.assertEqual(vulnerability["exposed_devices"], 3)
        self.assertEqual(vulnerability["payload"], {"recommendation": "Use the synthetic remediation plan"})
        self.assertNotIn("cvss_score", vulnerability)
        self.assertNotIn("affected_asset", vulnerability)
        self.assertNotIn("description", vulnerability)

    def test_build_ai_messages_with_invalid_object_type(self):
        """AI messages should handle invalid object_type gracefully"""
        from security.ai.services.context_builder import build_ai_messages

        runtime_context = {
            "object_type": "invalid_type",
            "object_id": "123",
        }

        with patch("security.ai.services.context_builder.get_alert_context") as mock_get_alert_context:
            messages = build_ai_messages(
                user=self.user,
                user_message="test message",
                runtime_context=runtime_context,
            )

        # Should not crash and should still have messages
        self.assertGreater(len(messages), 0)
        mock_get_alert_context.assert_not_called()
        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        self.assertEqual(len(context_messages), 1)
        self.assertIn("not found or unavailable", context_messages[0]["content"])

    def test_build_ai_messages_with_invalid_object_id_returns_safe_context(self):
        """Invalid object IDs should not leak lookup or parsing details"""
        from security.ai.services.context_builder import build_ai_messages

        messages = build_ai_messages(
            user=self.user,
            user_message="test message",
            runtime_context={"object_type": "alert", "object_id": "not-a-number"},
        )

        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        self.assertEqual(len(context_messages), 1)
        self.assertIn("not found or unavailable", context_messages[0]["content"])

    def test_user_without_permission_does_not_receive_sensitive_context(self):
        """Users without minimum context permissions should only receive a safe unavailable context"""
        from security.ai.services.context_builder import build_ai_messages

        user = User.objects.create_user(username="limiteduser", password="testpass", is_staff=False)

        with patch("security.ai.services.context_builder.get_ticket_context") as mock_get_ticket_context:
            messages = build_ai_messages(
                user=user,
                user_message="test message",
                runtime_context={"object_type": "ticket", "object_id": "1"},
            )

        mock_get_ticket_context.assert_not_called()
        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        self.assertEqual(len(context_messages), 1)
        self.assertIn("not found or unavailable", context_messages[0]["content"])

    def test_user_without_specific_permissions_gets_generic_context_for_all_objects(self):
        """Unauthorized object contexts should not reveal whether an object exists"""
        from security.ai.services.context_builder import build_ai_messages

        limited_user = User.objects.create_user(username="limited-context-user", password="testpass", is_staff=False)
        source = SecuritySource.objects.create(
            name="Example Permission Source",
            vendor="Example Vendor",
            source_type="email",
        )
        event = SecurityEventRecord.objects.create(
            source=source,
            event_type="example.permission",
            severity="high",
            fingerprint="permission-fingerprint",
            dedup_hash="permission-event-dedup",
            payload={"host": "EXAMPLE-HOST"},
        )
        alert = SecurityAlert.objects.create(
            source=source,
            event=event,
            title="Hidden Example Alert",
            severity="high",
            dedup_hash="permission-alert-dedup",
        )
        report = SecurityReport.objects.create(
            source=source,
            report_type="example_report",
            title="Hidden Example Report",
            parser_name="example_parser",
        )
        evidence = SecurityEvidenceContainer.objects.create(
            source=source,
            alert=alert,
            title="Hidden Example Evidence",
        )
        ticket = SecurityRemediationTicket.objects.create(
            source=source,
            alert=alert,
            title="Hidden Example Ticket",
            severity="high",
            dedup_hash="permission-ticket-dedup",
        )

        contexts = [
            {"object_type": "alert", "object_id": str(alert.id), "hidden": "Hidden Example Alert"},
            {"object_type": "report", "object_id": str(report.id), "hidden": "Hidden Example Report"},
            {"object_type": "ticket", "object_id": str(ticket.id), "hidden": "Hidden Example Ticket"},
            {"object_type": "evidence", "object_id": str(evidence.id), "hidden": "Hidden Example Evidence"},
        ]

        for runtime_context in contexts:
            with self.subTest(object_type=runtime_context["object_type"]):
                messages = build_ai_messages(
                    user=limited_user,
                    user_message="test message",
                    runtime_context={
                        "object_type": runtime_context["object_type"],
                        "object_id": runtime_context["object_id"],
                    },
                )
                context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
                self.assertEqual(len(context_messages), 1)
                self.assertIn("not found or unavailable", context_messages[0]["content"])
                self.assertNotIn(runtime_context["hidden"], context_messages[0]["content"])

    def test_user_with_specific_alert_permission_can_receive_alert_context(self):
        """Object context access should allow explicit view permission or staff"""
        from security.ai.services.context_builder import build_ai_messages

        user = User.objects.create_user(username="alert-view-user", password="testpass", is_staff=False)
        user.user_permissions.add(Permission.objects.get(codename="view_securityalert"))
        source = SecuritySource.objects.create(
            name="Example Alert Permission Source",
            vendor="Example Vendor",
            source_type="email",
        )
        alert = SecurityAlert.objects.create(
            source=source,
            title="Visible Example Alert",
            severity="high",
            dedup_hash="visible-alert-dedup",
        )

        messages = build_ai_messages(
            user=user,
            user_message="test message",
            runtime_context={"object_type": "alert", "object_id": str(alert.id)},
        )

        context_messages = [msg for msg in messages if "Context:" in msg.get("content", "")]
        self.assertEqual(len(context_messages), 1)
        self.assertIn("Visible Example Alert", context_messages[0]["content"])

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
