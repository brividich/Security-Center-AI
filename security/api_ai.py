from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.nvidia_nim_service import nvidia_nim_service
from .permissions import CanViewSecurityCenter


class AIChatApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        message = request.data.get("message", "").strip()
        history = request.data.get("history", [])

        if not message:
            return Response({"error": "message required"}, status=400)

        try:
            messages = [
                {"role": "system", "content": "Sei un assistente AI per il Security Center AI. Aiuta gli utenti a analizzare report di sicurezza, generare alert, e comprendere eventi di sicurezza. Rispondi in italiano."},
            ]
            messages.extend(history)
            messages.append({"role": "user", "content": message})

            response = nvidia_nim_service.chat_completion(
                messages=messages,
                model="meta/llama-3.1-70b-instruct",
                temperature=0.7,
                max_tokens=2048,
            )

            ai_message = response["choices"][0]["message"]["content"]
            return Response({
                "message": ai_message,
                "model": "meta/llama-3.1-70b-instruct",
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AIAnalyzeReportApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        report_id = request.data.get("report_id")
        report_content = request.data.get("content", "")

        if not report_content:
            return Response({"error": "content required"}, status=400)

        try:
            analysis = nvidia_nim_service.analyze_security_report(report_content)
            return Response({
                "report_id": report_id,
                "analysis": analysis,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AISuggestAlertRuleApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        context = request.data.get("context", "")

        if not context:
            return Response({"error": "context required"}, status=400)

        try:
            suggestion = nvidia_nim_service.suggest_alert_rule(context)
            return Response({
                "suggestion": suggestion,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AIAnalyzeEventsApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        events = request.data.get("events", [])

        if not events:
            return Response({"error": "events required"}, status=400)

        try:
            analysis = nvidia_nim_service.analyze_events(events)
            return Response({
                "analysis": analysis,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AIGenerateSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def post(self, request):
        data = request.data.get("data", {})

        if not data:
            return Response({"error": "data required"}, status=400)

        try:
            summary = nvidia_nim_service.generate_summary(data)
            return Response({
                "summary": summary,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)
