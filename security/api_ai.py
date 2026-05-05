import json
import logging
import re
import time

from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDay
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai.services.ai_gateway import chat_completion
from .ai.services.context_builder import build_ai_messages
from .ai.services.redaction import redact_ai_context, redact_list, redact_text
from .ai.providers.base import (
    AIProviderConfigurationError,
    AIProviderResponseError,
    AIProviderUnavailableError,
)
from .models import SecurityAiInteractionLog
from .permissions import CanViewSecurityCenter

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 8000
MAX_HISTORY_MESSAGES = 10
MAX_CONTENT_LENGTH = 4000
MAX_SECONDARY_INPUT_CHARS = 20000
MAX_LOG_ERROR_CHARS = 500
MAX_STATUS_ERROR_CHARS = 200
ALLOWED_CONTEXT_OBJECT_TYPES = {"dashboard", "alert", "report", "ticket", "evidence"}
ALLOWED_CONTEXT_PAGES = {"dashboard", "alert", "report", "ticket", "evidence", "alerts", "reports", "ai", "overview"}


def _truncate_text(value, max_length):
    text = str(value or "")
    return text[:max_length]


def _sanitize_context_metadata(raw_context):
    if not isinstance(raw_context, dict):
        return {}

    sanitized = {}
    page = raw_context.get("page")
    if isinstance(page, str):
        page = page.strip().lower()[:80]
        if page in ALLOWED_CONTEXT_PAGES:
            sanitized["page"] = page

    object_type = raw_context.get("object_type")
    if isinstance(object_type, str):
        object_type = object_type.strip().lower()[:80]
        if object_type in ALLOWED_CONTEXT_OBJECT_TYPES:
            sanitized["object_type"] = object_type

    object_type = sanitized.get("object_type")
    object_id = raw_context.get("object_id")
    if object_type and object_type != "dashboard" and object_id is not None:
        object_id = str(object_id).strip()[:80]
        if object_type in {"alert", "report", "ticket"} and object_id.isdigit():
            sanitized["object_id"] = object_id
        elif object_type == "evidence" and re.match(r"^[0-9a-fA-F-]{1,80}$", object_id):
            sanitized["object_id"] = object_id

    return sanitized


def _redacted_error_message(error):
    return _truncate_text(redact_text(str(error)), MAX_LOG_ERROR_CHARS)


def _redacted_payload_for_prompt(payload):
    if isinstance(payload, str):
        return _truncate_text(redact_text(payload), MAX_SECONDARY_INPUT_CHARS)
    if isinstance(payload, dict):
        redacted = redact_ai_context(payload)
    elif isinstance(payload, list):
        redacted = redact_list(payload)
    else:
        redacted = redact_text(str(payload))

    if isinstance(redacted, str):
        return _truncate_text(redacted, MAX_SECONDARY_INPUT_CHARS)
    return _truncate_text(json.dumps(redacted, indent=2, ensure_ascii=False, default=str), MAX_SECONDARY_INPUT_CHARS)


def _payload_too_large(payload) -> bool:
    if isinstance(payload, str):
        return len(payload) > MAX_SECONDARY_INPUT_CHARS
    try:
        serialized = json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        serialized = str(payload)
    return len(serialized) > MAX_SECONDARY_INPUT_CHARS


def _provider_base_url_label(base_url):
    default_url = "https://integrate.api.nvidia.com/v1"
    if not base_url:
        return "missing"
    return "default" if str(base_url).rstrip("/") == default_url else "custom"


def sanitize_chat_history(history):
    """Sanitize chat history from client input"""
    if not isinstance(history, list):
        return []

    sanitized = []
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(msg, dict):
            continue

        role = msg.get("role", "")
        content = msg.get("content", "")

        # Only accept user and assistant roles
        if role not in ("user", "assistant"):
            continue

        # Ensure content is a string and not empty
        if not isinstance(content, str) or not content.strip():
            continue

        # Truncate content
        content = content[:MAX_CONTENT_LENGTH]
        sanitized.append({"role": role, "content": content})

    return sanitized


class AIChatApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        message = request.data.get("message", "")
        history = request.data.get("history", [])
        context = _sanitize_context_metadata(request.data.get("context"))

        # Validate message
        if not isinstance(message, str):
            return Response({"error": "Invalid AI request"}, status=400)

        message = message.strip()

        if not message:
            return Response({"error": "Invalid AI request"}, status=400)

        if len(message) > MAX_MESSAGE_LENGTH:
            return Response({"error": "Invalid AI request"}, status=400)

        start_time = time.time()
        request_chars = len(message)
        log_entry = None

        try:
            messages = build_ai_messages(
                user=request.user,
                user_message=message,
                history=history,
                runtime_context=context,
            )

            response = chat_completion(
                messages=messages,
                model="meta/llama-3.1-70b-instruct",
                temperature=0.7,
                max_tokens=2048,
            )

            latency_ms = int((time.time() - start_time) * 1000)
            response_chars = len(response.content)

            # Log successful interaction
            log_entry = SecurityAiInteractionLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action="chat",
                provider=response.provider,
                model=response.model,
                status="success",
                page=context.get("page", ""),
                object_type=context.get("object_type", ""),
                object_id=context.get("object_id", ""),
                request_chars=request_chars,
                response_chars=response_chars,
                latency_ms=latency_ms,
            )

            return Response({
                "message": response.content,
                "model": response.model,
                "provider": response.provider,
            })
        except (AIProviderUnavailableError, AIProviderResponseError) as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.warning("AI provider error during chat", extra={"error_class": e.__class__.__name__})

            SecurityAiInteractionLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action="chat",
                status="provider_error",
                page=context.get("page", ""),
                object_type=context.get("object_type", ""),
                object_id=context.get("object_id", ""),
                request_chars=request_chars,
                latency_ms=latency_ms,
                error_message=_redacted_error_message(e.__class__.__name__),
            )

            return Response({"error": "AI service temporarily unavailable"}, status=503)
        except AIProviderConfigurationError:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.warning("AI provider not configured")

            # Log config error
            SecurityAiInteractionLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action="chat",
                status="config_error",
                page=context.get("page", ""),
                object_type=context.get("object_type", ""),
                object_id=context.get("object_id", ""),
                request_chars=request_chars,
                latency_ms=latency_ms,
                error_message=_redacted_error_message("AI provider not configured"),
            )

            return Response({"error": "AI service not configured"}, status=503)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            error_msg = _redacted_error_message(e)
            logger.error("Unexpected error in AI chat", extra={"error_class": e.__class__.__name__})

            # Log error
            SecurityAiInteractionLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action="chat",
                status="error",
                page=context.get("page", ""),
                object_type=context.get("object_type", ""),
                object_id=context.get("object_id", ""),
                request_chars=request_chars,
                latency_ms=latency_ms,
                error_message=error_msg,
            )

            return Response({"error": "AI service temporarily unavailable"}, status=503)


class AIAnalyzeReportApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        report_id = request.data.get("report_id")
        report_content = request.data.get("content", "")

        if not isinstance(report_content, str) or not report_content.strip() or _payload_too_large(report_content):
            return Response({"error": "Invalid AI request"}, status=400)

        try:
            redacted_report_content = _redacted_payload_for_prompt(report_content)
            system_prompt = """Sei un esperto di sicurezza informatica. Analizza il seguente report di sicurezza e fornisci:
1. Riassunto esecutivo (max 200 parole)
2. Vulnerabilità rilevate (CVE, severità, asset)
3. Raccomandazioni prioritarie
4. Rischi identificati
5. Azioni suggerite

Rispondi in formato JSON con le seguenti chiavi:
{
  "summary": "riassunto esecutivo",
  "vulnerabilities": [{"cve": "CVE-XXXX-XXXX", "severity": "high/medium/low", "asset": "hostname/IP", "description": "descrizione"}],
  "recommendations": ["raccomandazione 1", "raccomandazione 2"],
  "risks": ["rischio 1", "rischio 2"],
  "suggested_actions": ["azione 1", "azione 2"]
}"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analizza questo report:\n\n{redacted_report_content}"},
            ]

            response = chat_completion(
                messages=messages,
                model="meta/llama-3.1-70b-instruct",
                temperature=0.3,
                max_tokens=4096,
            )

            content = response.content

            # Estrai JSON dal contenuto
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)

            # Pulisci caratteri di controllo non validi
            content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)

            analysis = json.loads(content)

            return Response({
                "report_id": report_id,
                "analysis": analysis,
            })
        except AIProviderConfigurationError:
            logger.warning("AI provider not configured")
            return Response({"error": "AI service not configured"}, status=503)
        except (AIProviderUnavailableError, AIProviderResponseError) as e:
            logger.warning("AI provider error during report analysis", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)
        except Exception as e:
            logger.error("Unexpected error in AI report analysis", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)


class AISuggestAlertRuleApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        context = request.data.get("context", "")

        if not isinstance(context, str) or not context.strip() or _payload_too_large(context):
            return Response({"error": "Invalid AI request"}, status=400)

        try:
            redacted_context = _redacted_payload_for_prompt(context)
            system_prompt = """Sei un esperto di sicurezza informatica. Basandoti sul contesto fornito, suggerisci una regola di alert appropriata.

Rispondi in formato JSON con le seguenti chiavi:
{
  "rule_name": "nome della regola",
  "condition": "condizione che deve attivare l'alert",
  "severity": "critical/high/medium/low",
  "description": "descrizione della regola",
  "recommended_actions": ["azione 1", "azione 2"],
  "rationale": "spiegazione del perché questa regola è appropriata"
}"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Contesto:\n\n{redacted_context}"},
            ]

            response = chat_completion(
                messages=messages,
                model="meta/llama-3.1-8b-instruct",
                temperature=0.5,
                max_tokens=1024,
            )

            content = response.content

            # Estrai JSON dal contenuto (potrebbe essere racchiuso in blocchi di codice markdown)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)

            # Pulisci caratteri di controllo non validi
            content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)

            suggestion = json.loads(content)

            return Response({
                "suggestion": suggestion,
            })
        except AIProviderConfigurationError:
            logger.warning("AI provider not configured")
            return Response({"error": "AI service not configured"}, status=503)
        except (AIProviderUnavailableError, AIProviderResponseError) as e:
            logger.warning("AI provider error during alert rule suggestion", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)
        except Exception as e:
            logger.error("Unexpected error in AI alert rule suggestion", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)


class AIAnalyzeEventsApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        events = request.data.get("events", [])

        if not isinstance(events, (dict, list)) or not events or _payload_too_large(events):
            return Response({"error": "Invalid AI request"}, status=400)

        try:
            redacted_events_json = _redacted_payload_for_prompt(events)
            system_prompt = """Sei un esperto di sicurezza informatica. Analizza la seguente serie di eventi e fornisci:
1. Pattern rilevati
2. Eventi anomali
3. Correlazioni tra eventi
4. Minacce potenziali
5. Raccomandazioni

Rispondi in formato JSON con le seguenti chiavi:
{
  "patterns": ["pattern 1", "pattern 2"],
  "anomalies": [{"event_id": "ID", "description": "descrizione"}],
  "correlations": ["correlazione 1", "correlazione 2"],
  "potential_threats": ["minaccia 1", "minaccia 2"],
  "recommendations": ["raccomandazione 1", "raccomandazione 2"]
}"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Eventi:\n\n{redacted_events_json}"},
            ]

            response = chat_completion(
                messages=messages,
                model="meta/llama-3.1-70b-instruct",
                temperature=0.4,
                max_tokens=4096,
            )

            content = response.content

            # Estrai JSON dal contenuto
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)

            # Pulisci caratteri di controllo non validi
            content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)

            analysis = json.loads(content)

            return Response({
                "analysis": analysis,
            })
        except AIProviderConfigurationError:
            logger.warning("AI provider not configured")
            return Response({"error": "AI service not configured"}, status=503)
        except (AIProviderUnavailableError, AIProviderResponseError) as e:
            logger.warning("AI provider error during events analysis", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)
        except Exception as e:
            logger.error("Unexpected error in AI events analysis", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)


class AIGenerateSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        data = request.data.get("data", {})

        if not isinstance(data, (dict, list)) or not data or _payload_too_large(data):
            return Response({"error": "Invalid AI request"}, status=400)

        try:
            redacted_data_json = _redacted_payload_for_prompt(data)
            system_prompt = """Sei un esperto di sicurezza informatica. Genera un riassunto conciso e informativo dei dati forniti.
Il riassunto deve essere in italiano, massimo 300 parole, e includere:
- Punti chiave
- Metriche importanti
- Raccomandazioni principali"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Dati:\n\n{redacted_data_json}"},
            ]

            response = chat_completion(
                messages=messages,
                model="meta/llama-3.1-8b-instruct",
                temperature=0.5,
                max_tokens=512,
            )

            summary = response.content

            return Response({
                "summary": summary,
            })
        except AIProviderConfigurationError:
            logger.warning("AI provider not configured")
            return Response({"error": "AI service not configured"}, status=503)
        except (AIProviderUnavailableError, AIProviderResponseError) as e:
            logger.warning("AI provider error during summary generation", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)
        except Exception as e:
            logger.error("Unexpected error in AI summary generation", extra={"error_class": e.__class__.__name__})
            return Response({"error": "AI service temporarily unavailable"}, status=503)


class AIUsageSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        try:
            # Get all interaction logs
            logs = SecurityAiInteractionLog.objects.all()

            # Calculate metrics
            total_queries = logs.count()
            successful_queries = logs.filter(status="success").count()
            failed_queries = logs.filter(status__in=["error", "config_error", "provider_error"]).count()

            # Calculate average response time (only for successful queries)
            avg_response_time_result = logs.filter(status="success").aggregate(
                avg_latency=Avg("latency_ms")
            )
            avg_response_time = (
                round(avg_response_time_result["avg_latency"] / 1000, 2)
                if avg_response_time_result["avg_latency"]
                else 0
            )

            # Count analyses completed (successful chat interactions)
            analyses_completed = logs.filter(action="chat", status="success").count()

            # Get recent analyses (last 10 successful interactions)
            recent_analyses = []
            recent_logs = logs.filter(status="success").order_by("-created_at")[:10]
            for log in recent_logs:
                recent_analyses.append({
                    "id": log.id,
                    "title": f"{log.action.replace('_', ' ').title()} - {log.model or 'AI'}",
                    "description": f"{log.provider or 'AI'} interaction",
                    "created_at": log.created_at.isoformat(),
                    "status": "completed",
                })

            return Response({
                "total_queries": total_queries,
                "successful_queries": successful_queries,
                "failed_queries": failed_queries,
                "avg_response_time": avg_response_time,
                "analyses_completed": analyses_completed,
                "recent_analyses": recent_analyses,
            })
        except Exception as e:
            logger.exception("Unexpected error in AI usage summary")
            return Response({"error": "Failed to retrieve usage summary"}, status=500)


class AIProviderStatusApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        try:
            from django.conf import settings

            # Get provider settings without exposing secrets
            api_key = getattr(settings, "NVIDIA_NIM_API_KEY", None)
            if not api_key:
                api_key = getattr(settings, "NVIDIA_API_KEY", None)

            base_url = getattr(settings, "NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
            base_url_label = _provider_base_url_label(base_url)
            default_model = getattr(settings, "AI_DEFAULT_MODEL", "meta/llama-3.1-70b-instruct")
            fast_model = getattr(settings, "AI_FAST_MODEL", "meta/llama-3.1-8b-instruct")

            # Determine API key status without exposing the key
            api_key_present = bool(api_key)
            api_key_label = "configured"
            configured = True
            provider_status = "ok"

            if not api_key:
                api_key_label = "missing"
                configured = False
                provider_status = "not_configured"
            elif api_key in ("your_nvidia_api_key_here", "placeholder", "test", ""):
                api_key_label = "placeholder"
                configured = False
                provider_status = "not_configured"

            # Get metrics from SecurityAiInteractionLog
            logs = SecurityAiInteractionLog.objects.all()

            # Last success and error
            last_success = logs.filter(status="success").order_by("-created_at").first()
            last_error = logs.filter(status__in=["error", "config_error", "provider_error"]).order_by("-created_at").first()

            # Recent counts (last 24 hours)
            twenty_four_hours_ago = timezone.now() - timezone.timedelta(hours=24)
            recent_logs = logs.filter(created_at__gte=twenty_four_hours_ago)
            recent_success_count = recent_logs.filter(status="success").count()
            recent_error_count = recent_logs.filter(status__in=["error", "config_error", "provider_error"]).count()

            # Average latency
            avg_latency_result = logs.filter(status="success").aggregate(avg_latency=Avg("latency_ms"))
            avg_latency_ms = int(avg_latency_result["avg_latency"] or 0)

            # Update status based on recent errors
            if configured and recent_error_count > 0:
                if recent_error_count > recent_success_count:
                    provider_status = "error"
                else:
                    provider_status = "warning"

            # Redact/truncate error message
            last_error_message = ""
            if last_error and last_error.error_message:
                last_error_message = _truncate_text(redact_text(last_error.error_message), MAX_STATUS_ERROR_CHARS)

            return Response({
                "provider": "nvidia_nim",
                "configured": configured,
                "model": default_model,
                "fast_model": fast_model,
                "base_url_label": base_url_label,
                "api_key_present": api_key_present,
                "api_key_label": api_key_label,
                "status": provider_status,
                "last_success_at": last_success.created_at.isoformat() if last_success else None,
                "last_error_at": last_error.created_at.isoformat() if last_error else None,
                "last_error_message": last_error_message,
                "recent_success_count": recent_success_count,
                "recent_error_count": recent_error_count,
                "avg_latency_ms": avg_latency_ms,
            })
        except Exception as e:
            logger.exception("Unexpected error in AI provider status")
            return Response({"error": "Failed to retrieve provider status"}, status=500)


class AIOperationsSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        try:
            from django.conf import settings

            # Get provider status
            api_key = getattr(settings, "NVIDIA_NIM_API_KEY", None)
            if not api_key:
                api_key = getattr(settings, "NVIDIA_API_KEY", None)

            base_url = getattr(settings, "NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
            base_url_label = _provider_base_url_label(base_url)
            default_model = getattr(settings, "AI_DEFAULT_MODEL", "meta/llama-3.1-70b-instruct")
            fast_model = getattr(settings, "AI_FAST_MODEL", "meta/llama-3.1-8b-instruct")

            api_key_present = bool(api_key)
            api_key_label = "configured"
            configured = True
            provider_status = "ok"

            if not api_key:
                api_key_label = "missing"
                configured = False
                provider_status = "not_configured"
            elif api_key in ("your_nvidia_api_key_here", "placeholder", "test", ""):
                api_key_label = "placeholder"
                configured = False
                provider_status = "not_configured"

            # Get metrics from SecurityAiInteractionLog
            logs = SecurityAiInteractionLog.objects.all()

            # Usage summary
            total_queries = logs.count()
            successful_queries = logs.filter(status="success").count()
            failed_queries = logs.filter(status__in=["error", "config_error", "provider_error"]).count()

            avg_latency_result = logs.filter(status="success").aggregate(avg_latency=Avg("latency_ms"))
            avg_response_time = round((avg_latency_result["avg_latency"] or 0) / 1000, 2)
            analyses_completed = logs.filter(action="chat", status="success").count()

            # Last success and error
            last_success = logs.filter(status="success").order_by("-created_at").first()
            last_error = logs.filter(status__in=["error", "config_error", "provider_error"]).order_by("-created_at").first()

            # Recent counts
            twenty_four_hours_ago = timezone.now() - timezone.timedelta(hours=24)
            recent_logs = logs.filter(created_at__gte=twenty_four_hours_ago)
            recent_success_count = recent_logs.filter(status="success").count()
            recent_error_count = recent_logs.filter(status__in=["error", "config_error", "provider_error"]).count()

            avg_latency_ms = int(avg_latency_result["avg_latency"] or 0)

            if configured and recent_error_count > 0:
                if recent_error_count > recent_success_count:
                    provider_status = "error"
                else:
                    provider_status = "warning"

            last_error_message = ""
            if last_error and last_error.error_message:
                last_error_message = _truncate_text(redact_text(last_error.error_message), MAX_STATUS_ERROR_CHARS)

            provider_status_data = {
                "provider": "nvidia_nim",
                "configured": configured,
                "model": default_model,
                "fast_model": fast_model,
                "base_url_label": base_url_label,
                "api_key_present": api_key_present,
                "api_key_label": api_key_label,
                "status": provider_status,
                "last_success_at": last_success.created_at.isoformat() if last_success else None,
                "last_error_at": last_error.created_at.isoformat() if last_error else None,
                "last_error_message": last_error_message,
                "recent_success_count": recent_success_count,
                "recent_error_count": recent_error_count,
                "avg_latency_ms": avg_latency_ms,
            }

            usage_summary = {
                "total_queries": total_queries,
                "successful_queries": successful_queries,
                "failed_queries": failed_queries,
                "avg_response_time": avg_response_time,
                "analyses_completed": analyses_completed,
            }

            # Recent interactions (without full prompts/responses)
            recent_interactions = []
            for log in logs.order_by("-created_at")[:20]:
                recent_interactions.append({
                    "id": log.id,
                    "action": log.action,
                    "provider": log.provider or "nvidia_nim",
                    "model": log.model or default_model,
                    "status": log.status,
                    "page": log.page,
                    "object_type": log.object_type,
                    "object_id": log.object_id,
                    "request_chars": log.request_chars,
                    "response_chars": log.response_chars,
                    "latency_ms": log.latency_ms,
                    "created_at": log.created_at.isoformat(),
                })

            # Supported contexts
            supported_contexts = [
                {"type": "dashboard", "label": "Dashboard", "enabled": True},
                {"type": "alert", "label": "Alert", "enabled": True},
                {"type": "report", "label": "Report", "enabled": True},
                {"type": "ticket", "label": "Ticket", "enabled": True},
                {"type": "evidence", "label": "Evidence Container", "enabled": True},
            ]

            # Quick actions
            quick_actions = [
                {"key": "explain_alert", "label": "Spiega alert", "context_type": "alert"},
                {"key": "remediation_plan", "label": "Piano remediation", "context_type": "ticket"},
                {"key": "summarize_report", "label": "Riassumi report", "context_type": "report"},
                {"key": "summarize_evidence", "label": "Riassumi evidenze", "context_type": "evidence"},
                {"key": "daily_summary", "label": "Sintesi giornaliera", "context_type": "dashboard"},
            ]

            # Safety settings
            safety = {
                "redaction_enabled": True,
                "context_builder_enabled": True,
                "audit_log_enabled": True,
                "stores_full_prompts": False,
                "stores_full_responses": False,
            }

            return Response({
                "provider_status": provider_status_data,
                "usage_summary": usage_summary,
                "recent_interactions": recent_interactions,
                "supported_contexts": supported_contexts,
                "quick_actions": quick_actions,
                "safety": safety,
            })
        except Exception as e:
            logger.exception("Unexpected error in AI operations summary")
            return Response({"error": "Failed to retrieve operations summary"}, status=500)
