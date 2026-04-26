from rest_framework import serializers

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


class SecuritySourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecuritySource
        fields = "__all__"


class SecurityReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityReport
        fields = "__all__"


class SecurityEventRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEventRecord
        fields = "__all__"


class SecurityAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityAlert
        fields = "__all__"


class SecurityEvidenceContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvidenceContainer
        fields = "__all__"


class SecurityAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityAsset
        fields = "__all__"


class SecurityVulnerabilityFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityVulnerabilityFinding
        fields = "__all__"


class BackupJobRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupJobRecord
        fields = "__all__"


class SecurityKpiSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityKpiSnapshot
        fields = "__all__"
