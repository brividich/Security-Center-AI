from django.contrib import admin

from . import models


@admin.register(models.SecuritySource)
class SecuritySourceAdmin(admin.ModelAdmin):
    list_display = ("name", "vendor", "source_type", "is_active", "created_at")
    list_filter = ("source_type", "is_active", "vendor")
    search_fields = ("name", "vendor")


@admin.register(models.SecurityMailboxMessage)
class SecurityMailboxMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "source", "sender", "received_at", "parse_status")
    list_filter = ("parse_status", "source")
    search_fields = ("subject", "sender", "fingerprint")


@admin.register(models.SecuritySourceFile)
class SecuritySourceFileAdmin(admin.ModelAdmin):
    list_display = ("original_name", "source", "file_type", "uploaded_at", "parse_status")
    list_filter = ("file_type", "parse_status", "source")
    search_fields = ("original_name", "fingerprint")


@admin.register(models.SecurityReport)
class SecurityReportAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "report_type", "report_date", "parser_name", "parse_status")
    list_filter = ("report_type", "parse_status", "source")
    search_fields = ("title", "parser_name")


@admin.register(models.SecurityReportMetric)
class SecurityReportMetricAdmin(admin.ModelAdmin):
    list_display = ("name", "value", "unit", "report", "created_at")
    list_filter = ("name",)


@admin.register(models.SecurityEventRecord)
class SecurityEventRecordAdmin(admin.ModelAdmin):
    list_display = ("event_type", "source", "severity", "occurred_at", "suppressed")
    list_filter = ("event_type", "severity", "suppressed", "source")
    search_fields = ("fingerprint", "dedup_hash")


@admin.register(models.SecurityAlert)
class SecurityAlertAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "severity", "status", "created_at")
    list_filter = ("severity", "status", "source")
    search_fields = ("title", "dedup_hash")


@admin.register(models.SecurityEvidenceContainer)
class SecurityEvidenceContainerAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "alert", "status", "created_at")
    list_filter = ("status", "source")
    search_fields = ("title",)


@admin.register(models.SecurityEvidenceItem)
class SecurityEvidenceItemAdmin(admin.ModelAdmin):
    list_display = ("container", "item_type", "created_at")
    list_filter = ("item_type",)


@admin.register(models.SecurityAsset)
class SecurityAssetAdmin(admin.ModelAdmin):
    list_display = ("hostname", "ip_address", "asset_type", "source", "updated_at")
    list_filter = ("asset_type", "source")
    search_fields = ("hostname", "ip_address")


@admin.register(models.SecurityVulnerabilityFinding)
class SecurityVulnerabilityFindingAdmin(admin.ModelAdmin):
    list_display = ("cve", "affected_product", "source", "cvss", "exposed_devices", "severity", "status")
    list_filter = ("severity", "status", "source")
    search_fields = ("cve", "affected_product", "dedup_hash")


@admin.register(models.BackupJobRecord)
class BackupJobRecordAdmin(admin.ModelAdmin):
    list_display = ("job_name", "source", "status", "completed_at", "protected_items")
    list_filter = ("status", "source")
    search_fields = ("job_name", "dedup_hash")


@admin.register(models.SecurityKpiSnapshot)
class SecurityKpiSnapshotAdmin(admin.ModelAdmin):
    list_display = ("snapshot_date", "name", "source", "value")
    list_filter = ("name", "source", "snapshot_date")


@admin.register(models.SecurityAlertSuppressionRule)
class SecurityAlertSuppressionRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "source", "event_type", "severity", "is_active")
    list_filter = ("is_active", "event_type", "severity", "source")


@admin.register(models.SecurityAlertActionLog)
class SecurityAlertActionLogAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "alert", "ticket", "created_at")
    list_filter = ("action", "actor")


@admin.register(models.SecurityRemediationTicket)
class SecurityRemediationTicketAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "cve", "affected_product", "status", "updated_at")
    list_filter = ("status", "source")
    search_fields = ("title", "cve", "affected_product", "dedup_hash")
