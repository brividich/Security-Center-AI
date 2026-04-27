import hashlib
import uuid

from django.db import models
from django.utils import timezone


class Severity(models.TextChoices):
    INFO = "info", "Info"
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    WARNING = "warning", "Warning"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class Status(models.TextChoices):
    NEW = "new", "New"
    OPEN = "open", "Open"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    IN_PROGRESS = "in_progress", "In progress"
    SNOOZED = "snoozed", "Snoozed"
    MUTED = "muted", "Muted"
    CLOSED = "closed", "Closed"
    FALSE_POSITIVE = "false_positive", "False positive"
    RESOLVED = "resolved", "Resolved"
    SUPPRESSED = "suppressed", "Suppressed"


class ParseStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PARSED = "parsed", "Parsed"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"


class SourceType(models.TextChoices):
    EMAIL = "email", "Email"
    PDF = "pdf", "PDF"
    CSV = "csv", "CSV"
    API = "api", "API"
    MANUAL = "manual", "Manual"


class SecuritySource(models.Model):
    name = models.CharField(max_length=160, unique=True)
    vendor = models.CharField(max_length=120, blank=True)
    source_type = models.CharField(max_length=32, choices=SourceType.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["source_type", "is_active"]),
        ]

    def __str__(self):
        return self.name


class SecurityMailboxMessage(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE, related_name="mailbox_messages")
    external_id = models.CharField(max_length=255, blank=True, db_index=True)
    sender = models.EmailField(blank=True)
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)
    parse_status = models.CharField(max_length=24, choices=ParseStatus.choices, default=ParseStatus.PENDING, db_index=True)
    fingerprint = models.CharField(max_length=64, blank=True, db_index=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "received_at"]),
            models.Index(fields=["source", "fingerprint"]),
        ]

    def save(self, *args, **kwargs):
        if not self.fingerprint:
            seed = f"{self.source_id}:{self.external_id}:{self.subject}:{self.received_at.isoformat()}"
            self.fingerprint = hashlib.sha256(seed.encode()).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.subject


class SecuritySourceFile(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE, related_name="files")
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=32, choices=SourceType.choices)
    content = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    parse_status = models.CharField(max_length=24, choices=ParseStatus.choices, default=ParseStatus.PENDING, db_index=True)
    fingerprint = models.CharField(max_length=64, blank=True, db_index=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "uploaded_at"]),
            models.Index(fields=["source", "fingerprint"]),
        ]

    def save(self, *args, **kwargs):
        if not self.fingerprint:
            seed = f"{self.source_id}:{self.original_name}:{self.content[:500]}"
            self.fingerprint = hashlib.sha256(seed.encode()).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.original_name


class SecurityReport(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE, related_name="reports")
    mailbox_message = models.ForeignKey(SecurityMailboxMessage, on_delete=models.SET_NULL, null=True, blank=True)
    source_file = models.ForeignKey(SecuritySourceFile, on_delete=models.SET_NULL, null=True, blank=True)
    report_type = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=255)
    report_date = models.DateField(default=timezone.localdate, db_index=True)
    parser_name = models.CharField(max_length=160)
    parse_status = models.CharField(max_length=24, choices=ParseStatus.choices, default=ParseStatus.PARSED, db_index=True)
    parsed_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "report_date"]),
            models.Index(fields=["report_type", "parse_status"]),
        ]

    def __str__(self):
        return self.title


class SecurityReportMetric(models.Model):
    report = models.ForeignKey(SecurityReport, on_delete=models.CASCADE, related_name="metrics")
    name = models.CharField(max_length=120, db_index=True)
    value = models.FloatField()
    unit = models.CharField(max_length=40, blank=True)
    labels = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["name", "created_at"]),
        ]


class SecurityAsset(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.SET_NULL, null=True, blank=True)
    hostname = models.CharField(max_length=255, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    asset_type = models.CharField(max_length=80, blank=True)
    owner = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("source", "hostname")]
        indexes = [
            models.Index(fields=["hostname", "asset_type"]),
        ]

    def __str__(self):
        return self.hostname


class SecurityEventRecord(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE, related_name="events")
    report = models.ForeignKey(SecurityReport, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    asset = models.ForeignKey(SecurityAsset, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=120, db_index=True)
    severity = models.CharField(max_length=24, choices=Severity.choices, default=Severity.INFO, db_index=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    fingerprint = models.CharField(max_length=64, db_index=True)
    dedup_hash = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    suppressed = models.BooleanField(default=False, db_index=True)
    decision_trace = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "occurred_at"]),
            models.Index(fields=["severity", "occurred_at"]),
            models.Index(fields=["asset", "occurred_at"]),
            models.Index(fields=["dedup_hash", "event_type"]),
        ]

    def __str__(self):
        return f"{self.event_type} {self.severity}"


class SecurityAlert(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE, related_name="alerts")
    event = models.ForeignKey(SecurityEventRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts")
    title = models.CharField(max_length=255)
    severity = models.CharField(max_length=24, choices=Severity.choices, db_index=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.NEW, db_index=True)
    dedup_hash = models.CharField(max_length=64, db_index=True)
    decision_trace = models.JSONField(default=dict)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    status_reason = models.TextField(blank=True)
    owner = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "severity", "status"]),
            models.Index(fields=["dedup_hash", "status"]),
        ]

    def __str__(self):
        return self.title


class SecurityEvidenceContainer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE)
    alert = models.ForeignKey(SecurityAlert, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence_containers")
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN, db_index=True)
    decision_trace = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "status", "created_at"]),
        ]

    def __str__(self):
        return self.title


class SecurityEvidenceItem(models.Model):
    container = models.ForeignKey(SecurityEvidenceContainer, on_delete=models.CASCADE, related_name="items")
    event = models.ForeignKey(SecurityEventRecord, on_delete=models.SET_NULL, null=True, blank=True)
    report = models.ForeignKey(SecurityReport, on_delete=models.SET_NULL, null=True, blank=True)
    item_type = models.CharField(max_length=80)
    content = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class SecurityVulnerabilityFinding(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE)
    report = models.ForeignKey(SecurityReport, on_delete=models.SET_NULL, null=True, blank=True)
    asset = models.ForeignKey(SecurityAsset, on_delete=models.SET_NULL, null=True, blank=True)
    cve = models.CharField(max_length=32, db_index=True)
    affected_product = models.CharField(max_length=255, db_index=True)
    cvss = models.FloatField(db_index=True)
    exposed_devices = models.PositiveIntegerField(default=0)
    severity = models.CharField(max_length=24, choices=Severity.choices, db_index=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN, db_index=True)
    dedup_hash = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    first_seen_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_seen_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "cve", "affected_product"]),
            models.Index(fields=["severity", "status"]),
        ]

    def __str__(self):
        return f"{self.cve} {self.affected_product}"


class BackupJobRecord(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE)
    report = models.ForeignKey(SecurityReport, on_delete=models.SET_NULL, null=True, blank=True)
    job_name = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=40, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    protected_items = models.PositiveIntegerField(default=0)
    payload = models.JSONField(default=dict, blank=True)
    dedup_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class SecurityKpiSnapshot(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.SET_NULL, null=True, blank=True)
    snapshot_date = models.DateField(db_index=True)
    name = models.CharField(max_length=120, db_index=True)
    value = models.FloatField()
    labels = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = [("source", "snapshot_date", "name")]
        indexes = [
            models.Index(fields=["snapshot_date", "name"]),
        ]


class SecurityAlertSuppressionRule(models.Model):
    name = models.CharField(max_length=160)
    source = models.ForeignKey(SecuritySource, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=120, blank=True, db_index=True)
    severity = models.CharField(max_length=24, choices=Severity.choices, blank=True, db_index=True)
    match_payload = models.JSONField(default=dict, blank=True)
    reason = models.TextField()
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def matches(self, event):
        if self.source_id and self.source_id != event.source_id:
            return False
        if self.event_type and self.event_type != event.event_type:
            return False
        if self.severity and self.severity != event.severity:
            return False
        return all(event.payload.get(key) == value for key, value in self.match_payload.items())

    def __str__(self):
        return self.name


class SecurityRemediationTicket(models.Model):
    source = models.ForeignKey(SecuritySource, on_delete=models.CASCADE)
    alert = models.ForeignKey(SecurityAlert, on_delete=models.SET_NULL, null=True, blank=True, related_name="tickets")
    cve = models.CharField(max_length=32, blank=True, db_index=True)
    affected_product = models.CharField(max_length=255, blank=True, db_index=True)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN, db_index=True)
    dedup_hash = models.CharField(max_length=64, db_index=True)
    evidence = models.ManyToManyField(SecurityEvidenceContainer, blank=True, related_name="tickets")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["source", "cve", "affected_product", "status"]),
            models.Index(fields=["dedup_hash", "status"]),
        ]

    def __str__(self):
        return self.title


class SecurityAlertActionLog(models.Model):
    alert = models.ForeignKey(SecurityAlert, on_delete=models.SET_NULL, null=True, blank=True, related_name="action_logs")
    ticket = models.ForeignKey(SecurityRemediationTicket, on_delete=models.SET_NULL, null=True, blank=True, related_name="action_logs")
    action = models.CharField(max_length=120, db_index=True)
    actor = models.CharField(max_length=120, default="system")
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["action", "created_at"]),
        ]
