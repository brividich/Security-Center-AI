from rest_framework import routers, viewsets

from .models import (
    BackupJobRecord,
    SecurityAlert,
    SecurityAsset,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityReport,
    SecuritySource,
    SecurityVulnerabilityFinding,
)
from .serializers import (
    BackupJobRecordSerializer,
    SecurityAlertSerializer,
    SecurityAssetSerializer,
    SecurityEventRecordSerializer,
    SecurityEvidenceContainerSerializer,
    SecurityKpiSnapshotSerializer,
    SecurityReportSerializer,
    SecuritySourceSerializer,
    SecurityVulnerabilityFindingSerializer,
)


class SecuritySourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SecuritySource.objects.order_by("name")
    serializer_class = SecuritySourceSerializer


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
