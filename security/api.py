from rest_framework import routers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    BackupJobRecord,
    SecurityAlert,
    SecurityAsset,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityReport,
    SecuritySource,
    SourceType,
    SecurityVulnerabilityFinding,
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
from .services.addon_registry import get_addon_detail, get_addon_registry


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
