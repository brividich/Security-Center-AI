from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from security.models import (
    BackupExpectedJobConfig,
    ParseStatus,
    SecurityAlert,
    SecurityAlertRuleConfig,
    SecurityAlertSuppressionRule,
    SecurityCenterSetting,
    SecurityConfigurationAuditLog,
    SecurityEventRecord,
    SecurityNotificationChannel,
    SecurityParserConfig,
    SecuritySource,
    Severity,
    SourceType,
)
from security.services.backup_monitoring import missing_backup_candidates
from security.services.configuration import get_bool_setting, get_float_setting, get_int_setting, get_json_setting, get_setting, set_setting, source_matches_sample
from security.services.dedup import make_hash
from security.services.ingestion import ingest_mailbox_message
from security.services.parser_engine import run_pending_parsers
from security.services.rule_engine import evaluate_security_rules


class AdminConfigurationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("admin", password="pw", is_staff=True)
        self.source = SecuritySource.objects.create(name="Config Source", vendor="Test", source_type=SourceType.EMAIL)

    def test_admin_config_page_requires_staff(self):
        response = self.client.get("/security/admin/config/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])
        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/security/admin/config/").status_code, 200)

    def test_settings_helpers_handle_types(self):
        set_setting("bool_key", True, value_type="bool")
        set_setting("int_key", 7, value_type="int")
        set_setting("float_key", 1.5, value_type="float")
        set_setting("json_key", {"a": 1}, value_type="json")
        set_setting("string_key", "hello", value_type="string")

        self.assertTrue(get_bool_setting("bool_key"))
        self.assertEqual(get_int_setting("int_key"), 7)
        self.assertEqual(get_float_setting("float_key"), 1.5)
        self.assertEqual(get_json_setting("json_key"), {"a": 1})
        self.assertEqual(get_setting("string_key"), "hello")

    def test_secret_setting_masked_and_audit_redacted(self):
        setting = set_setting("secret_key", "first", actor=self.user, value_type="string", is_secret=True)
        set_setting("secret_key", "second", actor=self.user, value_type="string", is_secret=True)
        self.client.force_login(self.user)
        response = self.client.get("/security/admin/config/general/")

        self.assertContains(response, "********")
        self.assertNotContains(response, "second")
        log = SecurityConfigurationAuditLog.objects.filter(model_name="SecurityCenterSetting", object_id=str(setting.pk)).latest("created_at")
        self.assertEqual(log.old_value, "[redacted]")
        self.assertEqual(log.new_value, "[redacted]")

    def test_source_config_test_matching(self):
        from security.models import SecuritySourceConfig

        config = SecuritySourceConfig.objects.create(
            name="Defender",
            source_type="microsoft_defender",
            mailbox_sender_patterns=["defender-noreply@microsoft.com"],
            mailbox_subject_patterns=["*vulnerabilities*"],
        )
        self.assertTrue(source_matches_sample(config, "defender-noreply@microsoft.com", "New vulnerabilities notification", ""))
        self.assertFalse(source_matches_sample(config, "other@example.test", "Daily report", ""))

    def test_disabled_parser_is_not_used_automatically(self):
        SecurityParserConfig.objects.create(parser_name="microsoft_defender_vulnerability_notification_email_parser", enabled=False)
        message = ingest_mailbox_message(
            self.source,
            "Microsoft Defender vulnerability notification",
            "CVE-2025-0001\nAffected product: Edge\nCVSS: 9.8\nExposed devices: 1",
            sender="defender-noreply@microsoft.com",
        )

        run_pending_parsers()

        message.refresh_from_db()
        self.assertEqual(message.parse_status, ParseStatus.SKIPPED)

    def test_disabled_alert_rule_does_not_trigger(self):
        SecurityAlertRuleConfig.objects.create(
            code="defender_critical_cve_cvss_gte_9",
            name="Disabled critical",
            enabled=False,
            metric_name="cvss",
            condition_operator="gte",
            threshold_value="9",
            severity=Severity.CRITICAL,
        )
        event = SecurityEventRecord.objects.create(
            source=self.source,
            event_type="vulnerability_finding",
            severity=Severity.CRITICAL,
            fingerprint=make_hash("disabled", "fingerprint"),
            dedup_hash=make_hash("disabled", "dedup"),
            payload={"cve": "CVE-2026-9999", "affected_product": "Gateway", "cvss": 9.8, "exposed_devices": 1, "severity": "critical"},
        )

        evaluate_security_rules()

        event.refresh_from_db()
        self.assertEqual(SecurityAlert.objects.count(), 0)
        self.assertEqual(event.decision_trace["decision"], "kpi_only")

    def test_expired_suppression_no_longer_suppresses(self):
        SecurityAlertSuppressionRule.objects.create(
            name="Expired",
            event_type="backup_job",
            severity=Severity.WARNING,
            reason="maintenance",
            owner="ops",
            expires_at=timezone.now() - timezone.timedelta(minutes=1),
        )
        event = SecurityEventRecord.objects.create(
            source=self.source,
            event_type="backup_job",
            severity=Severity.WARNING,
            fingerprint=make_hash("backup", "fingerprint"),
            dedup_hash=make_hash("backup", "dedup"),
            payload={"job_name": "Daily", "status": "failed"},
        )

        evaluate_security_rules()

        event.refresh_from_db()
        self.assertFalse(event.suppressed)
        self.assertEqual(SecurityAlert.objects.count(), 1)

    def test_backup_expected_job_missing_generates_candidate(self):
        BackupExpectedJobConfig.objects.create(job_name="Daily ERP", missing_after_hours=24, enabled=True, alert_on_missing=True)

        candidates = missing_backup_candidates(now=timezone.now())

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["job_name"], "Daily ERP")

    def test_notification_channel_never_exposes_secret(self):
        channel = SecurityNotificationChannel.objects.create(name="Teams", channel_type="teams_webhook", webhook_url_secret_ref="https://secret.example")

        self.assertEqual(channel.masked_secret, "********")
        self.client.force_login(self.user)
        response = self.client.get("/security/admin/config/notifications/")
        self.assertNotContains(response, "https://secret.example")

    def test_seed_command_is_idempotent(self):
        call_command("seed_security_center_config")
        counts = (
            SecurityCenterSetting.objects.count(),
            SecurityParserConfig.objects.count(),
            SecurityAlertRuleConfig.objects.count(),
            SecurityNotificationChannel.objects.count(),
        )
        call_command("seed_security_center_config")
        self.assertEqual(
            counts,
            (
                SecurityCenterSetting.objects.count(),
                SecurityParserConfig.objects.count(),
                SecurityAlertRuleConfig.objects.count(),
                SecurityNotificationChannel.objects.count(),
            ),
        )
