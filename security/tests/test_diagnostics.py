import io
import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from security.models import (
    ParseStatus,
    SecurityAlertRuleConfig,
    SecurityAlertSuppressionRule,
    SecurityCenterSetting,
    SecurityMailboxMessage,
    SecurityNotificationChannel,
    SecurityParserConfig,
    SecuritySource,
    SecuritySourceConfig,
    Severity,
    SourceType,
)
from security.services.diagnostics import match_source_sample, run_security_center_diagnostics


class SecurityDiagnosticsTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user("staff", password="pw", is_staff=True)
        self.user = get_user_model().objects.create_user("manager", password="pw")
        self.permission = Permission.objects.get(codename="manage_security_configuration")

    def test_diagnostics_page_requires_staff_or_permission(self):
        response = self.client.get("/security/admin/diagnostics/")
        self.assertEqual(response.status_code, 302)

        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/security/admin/diagnostics/").status_code, 403)

        self.user.user_permissions.add(self.permission)
        self.assertEqual(self.client.get("/security/admin/diagnostics/").status_code, 200)

        self.client.force_login(self.staff)
        self.assertEqual(self.client.get("/security/admin/diagnostics/").status_code, 200)

    def test_diagnostics_service_returns_structured_checks(self):
        result = run_security_center_diagnostics()

        self.assertIn(result["status"], {"ok", "warning", "error"})
        self.assertIsInstance(result["checks"], list)
        self.assertTrue({"code", "label", "status", "message", "details", "suggested_action"}.issubset(result["checks"][0]))

    def test_no_enabled_source_produces_warning(self):
        result = run_security_center_diagnostics()
        check = self._check(result, "enabled_sources")

        self.assertEqual(check["status"], "warning")

    def test_no_enabled_parser_produces_warning(self):
        result = run_security_center_diagnostics()
        check = self._check(result, "enabled_parsers")

        self.assertEqual(check["status"], "warning")

    def test_invalid_setting_type_produces_warning(self):
        SecurityCenterSetting.objects.create(key="bad_int", value="not an int", value_type="int", category="general")

        result = run_security_center_diagnostics()
        check = self._check(result, "setting_value_types")

        self.assertEqual(check["status"], "warning")
        self.assertIn("bad_int", json.dumps(check))

    def test_parser_config_referencing_missing_parser_produces_warning(self):
        SecuritySourceConfig.objects.create(name="Broken source", source_type="email", parser_name="missing_parser", enabled=True)

        result = run_security_center_diagnostics()
        check = self._check(result, "parser_configs_reference_existing_names")

        self.assertEqual(check["status"], "warning")
        self.assertIn("missing_parser", json.dumps(check))

    def test_missing_parser_config_for_registry_parser_warns_not_crashes(self):
        result = run_security_center_diagnostics()
        check = self._check(result, "registry_parsers_have_config")

        self.assertEqual(check["status"], "warning")

    def test_defender_critical_alert_rule_without_auto_ticket_warns(self):
        SecurityAlertRuleConfig.objects.create(
            code="defender_critical_cve_no_ticket",
            name="Defender critical CVE no ticket",
            enabled=True,
            source_type="microsoft_defender",
            metric_name="cvss",
            condition_operator="gte",
            threshold_value="9",
            severity=Severity.CRITICAL,
            auto_create_ticket=False,
        )

        result = run_security_center_diagnostics()
        check = self._check(result, "defender_critical_auto_ticket")

        self.assertEqual(check["status"], "warning")

    def test_enabled_teams_notification_without_secret_warns(self):
        SecurityNotificationChannel.objects.create(name="Teams", channel_type="teams_webhook", enabled=True)

        result = run_security_center_diagnostics()
        check = self._check(result, "notification_required_configuration")

        self.assertEqual(check["status"], "warning")

    def test_broad_critical_suppression_warns(self):
        SecurityAlertSuppressionRule.objects.create(
            name="Broad critical",
            severity=Severity.CRITICAL,
            reason="maintenance",
            owner="secops",
            is_active=True,
        )

        result = run_security_center_diagnostics()
        check = self._check(result, "broad_critical_suppression")

        self.assertEqual(check["status"], "warning")

    def test_command_outputs_json(self):
        stdout = io.StringIO()
        call_command("security_center_diagnostics", "--json", stdout=stdout)

        payload = json.loads(stdout.getvalue())
        self.assertIn("status", payload)
        self.assertIn("checks", payload)

    def test_command_exit_codes_work(self):
        with self.assertRaises(SystemExit) as warning_exit:
            call_command("security_center_diagnostics", "--fail-on-warning", stdout=io.StringIO())
        self.assertEqual(warning_exit.exception.code, 1)

        source = SecuritySource.objects.create(name="Mail", source_type=SourceType.EMAIL)
        for index in range(5):
            SecurityMailboxMessage.objects.create(
                source=source,
                subject=f"Failed {index}",
                sender="sender@example.test",
                body="omitted",
                parse_status=ParseStatus.FAILED,
                received_at=timezone.now(),
            )
        with self.assertRaises(SystemExit) as error_exit:
            call_command("security_center_diagnostics", "--fail-on-error", stdout=io.StringIO())
        self.assertEqual(error_exit.exception.code, 2)

    def test_diagnostics_never_exposes_secret_values(self):
        SecurityCenterSetting.objects.create(key="api_secret", value="super-secret-value", value_type="string", category="general", is_secret=True)
        SecurityNotificationChannel.objects.create(name="Teams", channel_type="teams_webhook", enabled=True, webhook_url_secret_ref="https://secret.example/webhook")

        result = run_security_center_diagnostics()
        rendered = json.dumps(result, default=str)

        self.assertNotIn("super-secret-value", rendered)
        self.assertNotIn("https://secret.example/webhook", rendered)

    def test_source_matching_diagnostic_does_not_persist_input(self):
        SecuritySourceConfig.objects.create(
            name="Defender",
            source_type="microsoft_defender",
            parser_name="microsoft_defender_vulnerability_notification_email_parser",
            mailbox_sender_patterns=["defender-noreply@microsoft.com"],
            mailbox_subject_patterns=["*vulnerabilities*"],
        )
        SecurityParserConfig.objects.create(parser_name="microsoft_defender_vulnerability_notification_email_parser", enabled=True)
        before_messages = SecurityMailboxMessage.objects.count()

        result = match_source_sample(
            sender="defender-noreply@microsoft.com",
            subject="New vulnerabilities notification",
            body="CVE body should not be stored",
        )

        self.assertEqual(SecurityMailboxMessage.objects.count(), before_messages)
        self.assertEqual(result["selected_parser"], "microsoft_defender_vulnerability_notification_email_parser")

        self.client.force_login(self.staff)
        self.client.post(
            "/security/admin/diagnostics/",
            {"sender": "defender-noreply@microsoft.com", "subject": "New vulnerabilities notification", "body": "CVE body should not be stored"},
        )
        self.assertEqual(SecurityMailboxMessage.objects.count(), before_messages)

    def _check(self, result, code):
        return next(check for check in result["checks"] if check["code"] == code)
