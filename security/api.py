from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from rest_framework import routers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    BackupJobRecord,
    ParseStatus,
    SecurityAlert,
    SecurityAsset,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityMailboxMessage,
    SecurityReport,
    SecurityRemediationTicket,
    SecuritySource,
    SecuritySourceFile,
    SourceType,
    SecurityVulnerabilityFinding,
    Severity,
)
from .serializers import (
    BackupJobRecordSerializer,
    IngestMailboxMessageSerializer,
    IngestSourceFileSerializer,
    SecurityAlertSerializer,
    SecurityAssetSerializer,
    SecurityEventRecordSerializer,
    SecurityEvidenceContainerSerializer,
    SecurityKpiSnapshotSerializer,
    SecurityReportSerializer,
    SecuritySourceSerializer,
    SecurityVulnerabilityFindingSerializer,
)
from .services.ingestion import ingest_mailbox_message, ingest_source_file
from .services.kpi_service import build_daily_kpi_snapshots
from .services.parser_engine import run_pending_parsers
from .services.rule_engine import evaluate_security_rules
from .permissions import CanViewSecurityCenter
from .services.addon_registry import ACTIVE_ALERT_STATUSES, ACTIVE_TICKET_STATUSES, get_addon_detail, get_addon_registry


class SecurityHealthApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        return Response({"status": "ok"})


class SecurityAddonsApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        return Response({"addons": get_addon_registry()})


class SecurityAddonDetailApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request, code):
        addon = get_addon_detail(code)
        if addon is None:
            raise NotFound("Unknown addon.")
        return Response(addon)


class DashboardSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        return Response(
            {
                "generated_at": _iso(timezone.now()),
                "open_alerts_count": SecurityAlert.objects.filter(status__in=ACTIVE_ALERT_STATUSES).count(),
                "critical_alerts_count": SecurityAlert.objects.filter(
                    status__in=ACTIVE_ALERT_STATUSES,
                    severity=Severity.CRITICAL,
                ).count(),
                "open_tickets_count": SecurityRemediationTicket.objects.filter(status__in=ACTIVE_TICKET_STATUSES).count(),
                "evidence_containers_count": SecurityEvidenceContainer.objects.count(),
                "recent_alerts": _recent_alerts(limit=5),
                "recent_tickets": _recent_tickets(limit=5),
                "kpi_summary": _kpi_summary_payload(),
                "ingestion_status": _ingestion_status_payload(),
            }
        )


class RecentAlertsApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        limit = _bounded_limit(request.query_params.get("limit"), default=20, maximum=100)
        return Response(
            {
                "generated_at": _iso(timezone.now()),
                "alerts": _recent_alerts(limit=limit),
            }
        )


class KpiSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        return Response(_kpi_summary_payload())


class AddonsSummaryApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        return Response(
            {
                "generated_at": _iso(timezone.now()),
                "modules": [_addon_summary_dto(addon) for addon in get_addon_registry()],
            }
        )


class InboxRecentApiView(APIView):
    permission_classes = [CanViewSecurityCenter]

    def get(self, request):
        limit = _bounded_limit(request.query_params.get("limit"), default=10, maximum=50)
        return Response(
            {
                "generated_at": _iso(timezone.now()),
                "recent_reports": [
                    {
                        "id": report.id,
                        "title": report.title,
                        "source_name": report.source.name,
                        "parser_name": report.parser_name,
                        "parse_status": report.parse_status,
                        "created_at": _iso(report.created_at),
                    }
                    for report in SecurityReport.objects.select_related("source").order_by("-created_at")[:limit]
                ],
                "recent_mailbox_messages": [
                    {
                        "id": message.id,
                        "subject": message.subject,
                        "sender": message.sender,
                        "source_name": message.source.name,
                        "parse_status": message.parse_status,
                        "received_at": _iso(message.received_at),
                    }
                    for message in SecurityMailboxMessage.objects.select_related("source").order_by("-received_at")[:limit]
                ],
                "recent_source_files": [
                    {
                        "id": source_file.id,
                        "original_name": source_file.original_name,
                        "source_name": source_file.source.name,
                        "file_type": source_file.file_type,
                        "parse_status": source_file.parse_status,
                        "uploaded_at": _iso(source_file.uploaded_at),
                    }
                    for source_file in SecuritySourceFile.objects.select_related("source").order_by("-uploaded_at")[:limit]
                ],
                "latest_pipeline_status": _ingestion_status_payload(),
            }
        )


class SecuritySourceViewSet(viewsets.ModelViewSet):
    queryset = SecuritySource.objects.order_by("name")
    serializer_class = SecuritySourceSerializer

    @action(detail=True, methods=["post"], url_path="ingest-mailbox-message")
    def ingest_mailbox(self, request, pk=None):
        source = self.get_object()
        serializer = IngestMailboxMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ingest_mailbox_message(source=source, **serializer.validated_data)
        return Response({"id": message.id, "parse_status": message.parse_status}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="ingest-source-file")
    def ingest_file(self, request, pk=None):
        source = self.get_object()
        serializer = IngestSourceFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_obj = ingest_source_file(
            source=source,
            original_name=serializer.validated_data["original_name"],
            content=serializer.validated_data["content"],
            file_type=serializer.validated_data.get("file_type", SourceType.CSV),
        )
        return Response({"id": file_obj.id, "parse_status": file_obj.parse_status}, status=status.HTTP_201_CREATED)


class SecurityReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityReport.objects.order_by("-created_at")
    serializer_class = SecurityReportSerializer


class SecurityEventRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityEventRecord.objects.order_by("-occurred_at")
    serializer_class = SecurityEventRecordSerializer


class SecurityAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityAlert.objects.order_by("-created_at")
    serializer_class = SecurityAlertSerializer


class SecurityEvidenceContainerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityEvidenceContainer.objects.order_by("-created_at")
    serializer_class = SecurityEvidenceContainerSerializer


class SecurityAssetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityAsset.objects.order_by("hostname")
    serializer_class = SecurityAssetSerializer


class SecurityVulnerabilityFindingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityVulnerabilityFinding.objects.order_by("-last_seen_at")
    serializer_class = SecurityVulnerabilityFindingSerializer


class BackupJobRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BackupJobRecord.objects.order_by("-created_at")
    serializer_class = BackupJobRecordSerializer


class SecurityKpiSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecurityKpiSnapshot.objects.order_by("-snapshot_date")
    serializer_class = SecurityKpiSnapshotSerializer


class SecurityPipelineViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["post"], url_path="run-parsers")
    def run_parsers(self, request):
        return Response({"parsed_items": run_pending_parsers()})

    @action(detail=False, methods=["post"], url_path="evaluate-rules")
    def evaluate_rules(self, request):
        return Response({"evaluated_events": evaluate_security_rules()})

    @action(detail=False, methods=["post"], url_path="build-kpis")
    def build_kpis(self, request):
        return Response({"snapshots": build_daily_kpi_snapshots()})


router = routers.DefaultRouter()
router.register("sources", SecuritySourceViewSet)
router.register("reports", SecurityReportViewSet)
router.register("events", SecurityEventRecordViewSet)
router.register("alerts", SecurityAlertViewSet)
router.register("evidence", SecurityEvidenceContainerViewSet)
router.register("assets", SecurityAssetViewSet)
router.register("vulnerabilities", SecurityVulnerabilityFindingViewSet)
router.register("backup-jobs", BackupJobRecordViewSet)
router.register("kpis", SecurityKpiSnapshotViewSet)
router.register("pipeline", SecurityPipelineViewSet, basename="pipeline")


def _recent_alerts(limit):
    alerts = SecurityAlert.objects.select_related("source").order_by("-updated_at", "-created_at")[:limit]
    return [
        {
            "id": alert.id,
            "title": alert.title,
            "severity": alert.severity,
            "status": alert.status,
            "source_name": alert.source.name,
            "source": alert.source.name,
            "created_at": _iso(alert.created_at),
            "updated_at": _iso(alert.updated_at),
            "detail_url": reverse("security:alert_detail", kwargs={"pk": alert.pk}),
        }
        for alert in alerts
    ]


def _recent_tickets(limit):
    tickets = SecurityRemediationTicket.objects.select_related("source", "alert").order_by("-updated_at", "-created_at")[:limit]
    return [
        {
            "id": ticket.id,
            "title": ticket.title,
            "severity": ticket.severity,
            "status": ticket.status,
            "source_name": ticket.source.name,
            "source": ticket.source.name,
            "created_at": _iso(ticket.created_at),
            "updated_at": _iso(ticket.updated_at),
            "detail_url": reverse("security:tickets_list"),
        }
        for ticket in tickets
    ]


def _kpi_summary_payload():
    latest_date = SecurityKpiSnapshot.objects.order_by("-snapshot_date").values_list("snapshot_date", flat=True).first()
    if not latest_date:
        return {
            "generated_at": _iso(timezone.now()),
            "counters": {},
            "trends": [],
            "period_label": "",
            "empty_state": True,
        }

    snapshots = SecurityKpiSnapshot.objects.filter(snapshot_date=latest_date).order_by("name")
    counters = {}
    for snapshot in snapshots:
        counters[snapshot.name] = counters.get(snapshot.name, 0) + snapshot.value

    trend_rows = (
        SecurityKpiSnapshot.objects.filter(snapshot_date__gte=latest_date - timezone.timedelta(days=6))
        .values("snapshot_date")
        .annotate(total=Sum("value"))
        .order_by("snapshot_date")
    )
    trends = [{"date": row["snapshot_date"].isoformat(), "total": row["total"] or 0} for row in trend_rows]
    return {
        "generated_at": _iso(timezone.now()),
        "counters": counters,
        "trends": trends,
        "period_label": latest_date.isoformat(),
        "empty_state": False,
    }


def _ingestion_status_payload():
    return {
        "reports_total": SecurityReport.objects.count(),
        "events_total": SecurityEventRecord.objects.count(),
        "mailbox_messages": {
            "pending": SecurityMailboxMessage.objects.filter(parse_status=ParseStatus.PENDING).count(),
            "parsed": SecurityMailboxMessage.objects.filter(parse_status=ParseStatus.PARSED).count(),
            "failed": SecurityMailboxMessage.objects.filter(parse_status=ParseStatus.FAILED).count(),
        },
        "source_files": {
            "pending": SecuritySourceFile.objects.filter(parse_status=ParseStatus.PENDING).count(),
            "parsed": SecuritySourceFile.objects.filter(parse_status=ParseStatus.PARSED).count(),
            "failed": SecuritySourceFile.objects.filter(parse_status=ParseStatus.FAILED).count(),
        },
    }


def _addon_summary_dto(addon):
    return {
        "code": addon["code"],
        "name": addon["name"],
        "status": addon["status"],
        "enabled": addon.get("enabled_source_count", 0) > 0 or addon.get("enabled_parser_count", 0) > 0,
        "configured": addon.get("total_source_count", 0) > 0 or addon.get("total_parser_count", 0) > 0,
        "parser_count": addon.get("total_parser_count", 0),
        "source_count": addon.get("total_source_count", 0),
        "alert_rule_count": addon.get("total_rule_count", 0),
        "warning_count": addon.get("warning_count", 0),
        "detail_url": addon.get("links", {}).get("detail") or reverse("security:admin_addon_detail", kwargs={"code": addon["code"]}),
    }


def _bounded_limit(value, default, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(parsed, maximum))


def _iso(value):
    return value.isoformat() if value else None
