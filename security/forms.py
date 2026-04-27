from django import forms
from django.core.exceptions import ValidationError

from .models import (
    BackupExpectedJobConfig,
    SecurityAlertRuleConfig,
    SecurityAlertSuppressionRule,
    SecurityCenterSetting,
    SecurityNotificationChannel,
    SecurityParserConfig,
    SecuritySourceConfig,
    SecurityTicketConfig,
)


JSON_TEXTAREA = forms.Textarea(attrs={"rows": 3})


class SecurityCenterSettingForm(forms.ModelForm):
    class Meta:
        model = SecurityCenterSetting
        fields = ["value", "description", "is_secret"]
        widgets = {"value": JSON_TEXTAREA}


class SecuritySourceConfigForm(forms.ModelForm):
    class Meta:
        model = SecuritySourceConfig
        fields = [
            "name",
            "source_type",
            "vendor",
            "enabled",
            "description",
            "expected_frequency",
            "expected_time_window_start",
            "expected_time_window_end",
            "mailbox_sender_patterns",
            "mailbox_subject_patterns",
            "parser_name",
            "severity_mapping_json",
            "metadata_json",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "mailbox_sender_patterns": JSON_TEXTAREA,
            "mailbox_subject_patterns": JSON_TEXTAREA,
            "severity_mapping_json": JSON_TEXTAREA,
            "metadata_json": JSON_TEXTAREA,
            "expected_time_window_start": forms.TimeInput(attrs={"type": "time"}),
            "expected_time_window_end": forms.TimeInput(attrs={"type": "time"}),
        }


class SecurityParserConfigForm(forms.ModelForm):
    class Meta:
        model = SecurityParserConfig
        fields = ["parser_name", "enabled", "priority", "source_type", "input_type", "description", "config_json"]
        widgets = {"description": forms.Textarea(attrs={"rows": 3}), "config_json": JSON_TEXTAREA}


class SecurityAlertRuleConfigForm(forms.ModelForm):
    class Meta:
        model = SecurityAlertRuleConfig
        fields = [
            "code",
            "name",
            "enabled",
            "source_type",
            "metric_name",
            "condition_operator",
            "threshold_value",
            "threshold_json",
            "severity",
            "cooldown_minutes",
            "dedup_window_minutes",
            "auto_create_ticket",
            "auto_create_evidence_container",
            "description",
        ]
        widgets = {"threshold_json": JSON_TEXTAREA, "description": forms.Textarea(attrs={"rows": 3})}


class SecurityAlertSuppressionRuleForm(forms.ModelForm):
    class Meta:
        model = SecurityAlertSuppressionRule
        fields = [
            "name",
            "is_active",
            "scope_type",
            "source",
            "event_type",
            "severity",
            "match_payload",
            "conditions_json",
            "starts_at",
            "expires_at",
            "reason",
            "owner",
        ]
        widgets = {
            "match_payload": JSON_TEXTAREA,
            "conditions_json": JSON_TEXTAREA,
            "starts_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "expires_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "reason": forms.Textarea(attrs={"rows": 3}),
        }

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("reason"):
            raise ValidationError("Suppression rules require a reason.")
        if not cleaned.get("owner"):
            raise ValidationError("Suppression rules require an owner.")
        if cleaned.get("starts_at") and cleaned.get("expires_at") and cleaned["expires_at"] <= cleaned["starts_at"]:
            raise ValidationError("Expiration must be after the start time.")
        return cleaned


class BackupExpectedJobConfigForm(forms.ModelForm):
    class Meta:
        model = BackupExpectedJobConfig
        fields = [
            "job_name",
            "device_name",
            "nas_name",
            "enabled",
            "critical_asset",
            "expected_days_of_week",
            "expected_start_time_from",
            "expected_start_time_to",
            "max_duration_minutes",
            "min_transferred_gb",
            "max_transferred_gb",
            "missing_after_hours",
            "alert_on_missing",
            "alert_on_failure",
            "alert_on_duration_anomaly",
            "alert_on_size_anomaly",
        ]
        widgets = {
            "expected_days_of_week": JSON_TEXTAREA,
            "expected_start_time_from": forms.TimeInput(attrs={"type": "time"}),
            "expected_start_time_to": forms.TimeInput(attrs={"type": "time"}),
        }


class SecurityNotificationChannelForm(forms.ModelForm):
    replace_webhook_secret = forms.CharField(required=False, widget=forms.PasswordInput(render_value=False))

    class Meta:
        model = SecurityNotificationChannel
        fields = [
            "name",
            "channel_type",
            "enabled",
            "severity_min",
            "recipients",
            "notify_on_new_alert",
            "notify_on_ticket_created",
            "notify_on_sla_breach",
            "cooldown_minutes",
        ]
        widgets = {"recipients": forms.Textarea(attrs={"rows": 3})}


class SecurityTicketConfigForm(forms.ModelForm):
    class Meta:
        model = SecurityTicketConfig
        fields = [
            "aggregation_strategy",
            "default_assignee",
            "default_group",
            "statuses",
            "auto_close_enabled",
            "reopen_on_recurrence",
            "sla_by_severity",
        ]
        widgets = {"statuses": JSON_TEXTAREA, "sla_by_severity": JSON_TEXTAREA}
