from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch

from security.models import (
    SecurityAlert,
    SecurityAlertRuleConfig,
    SecurityAlertSuppressionRule,
    SecurityMailboxIngestionRun,
    SecurityMailboxSource,
    SecurityConfigurationAuditLog,
    SecuritySource,
    SecuritySourceConfig,
    Severity,
    Status,
)

User = get_user_model()


class ConfigurationApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)
        self.client.force_authenticate(user=self.user)

        self.source = SecuritySource.objects.create(name="Test Source", source_type="email")
        self.mailbox_source = SecurityMailboxSource.objects.create(
            name="Test Mailbox",
            code="test-mailbox",
            enabled=True,
            source_type="manual",
            mailbox_address="test@example.local",
        )

    def test_overview_requires_auth(self):
        self.client.logout()
        response = self.client.get(reverse("security:api_configuration_overview"))
        self.assertIn(response.status_code, [401, 403])

    def test_overview_returns_summary(self):
        response = self.client.get(reverse("security:api_configuration_overview"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("monitored_sources_count", data)
        self.assertIn("active_sources_count", data)
        self.assertIn("alert_rules_count", data)
        self.assertIn("active_suppressions_count", data)
        self.assertIn("open_alerts_count", data)
        self.assertIn("critical_open_alerts_count", data)

    def test_sources_returns_real_mailbox_sources(self):
        response = self.client.get(reverse("security:api_configuration_sources"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

        source_dto = data[0]
        self.assertIn("id", source_dto)
        self.assertIn("code", source_dto)
        self.assertIn("name", source_dto)
        self.assertIn("status", source_dto)
        self.assertIn("category", source_dto)
        self.assertIn("origin", source_dto)
        self.assertIn("parser_names", source_dto)
        self.assertIn("links", source_dto)

    def test_sources_includes_latest_run_counters(self):
        run = SecurityMailboxIngestionRun.objects.create(
            source=self.mailbox_source,
            status="success",
            imported_messages_count=10,
            skipped_messages_count=2,
            duplicate_messages_count=1,
            imported_files_count=5,
            processed_items_count=15,
            generated_alerts_count=3,
        )

        response = self.client.get(reverse("security:api_configuration_sources"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        source_dto = next((s for s in data if s["code"] == "test-mailbox"), None)
        self.assertIsNotNone(source_dto)
        self.assertIsNotNone(source_dto["latest_run"])
        self.assertEqual(source_dto["latest_run"]["status"], "success")
        self.assertIn("started_at", source_dto["latest_run"])
        self.assertIn("finished_at", source_dto["latest_run"])
        self.assertEqual(source_dto["latest_run"]["imported"], 10)
        self.assertEqual(source_dto["latest_run"]["alerts"], 3)
        self.assertIn("error_message", source_dto["latest_run"])

    def test_sources_masks_email_address(self):
        response = self.client.get(reverse("security:api_configuration_sources"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        source_dto = next((s for s in data if s["code"] == "test-mailbox"), None)
        self.assertIsNotNone(source_dto)

        mailbox = source_dto.get("mailbox_address")
        if mailbox:
            self.assertIn("***", mailbox)
            self.assertNotEqual(mailbox, "test@example.local")

    def test_mailbox_ingestion_service_status_returns_safe_summary(self):
        SecurityMailboxIngestionRun.objects.create(
            source=self.mailbox_source,
            status="success",
            imported_messages_count=2,
            processed_items_count=2,
        )

        response = self.client.get(reverse("security:api_mailbox_ingestion_service_status"))

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Mailbox / Graph ingestion")
        self.assertIn(data["status"], ["active", "warning", "error", "running", "not_configured"])
        self.assertEqual(data["expected_interval_seconds"], 120)
        self.assertIn("--loop --interval 120", data["polling_command"])
        self.assertGreaterEqual(data["totals"]["sources"], 1)
        source_dto = next((item for item in data["sources"] if item["code"] == "test-mailbox"), None)
        self.assertIsNotNone(source_dto)
        self.assertIn("***", source_dto["mailbox_address"])
        self.assertNotIn("test@example.local", str(data))

    def test_mailbox_ingestion_service_run_endpoint_runs_enabled_sources(self):
        with patch("security.api_configuration.run_mailbox_ingestion") as mock_run:
            mock_run.return_value = self.mailbox_source.ingestion_runs.create(
                status="success",
                imported_messages_count=1,
                processed_items_count=1,
            )
            response = self.client.post(reverse("security:api_mailbox_ingestion_service_run"), {}, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["runs"]), 1)
        self.assertEqual(data["runs"][0]["source_code"], "test-mailbox")
        mock_run.assert_called_once()

    def test_mailbox_ingestion_service_run_rejects_invalid_limit(self):
        response = self.client.post(
            reverse("security:api_mailbox_ingestion_service_run"),
            {"limit": 0},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_rules_returns_expected_structure(self):
        rule = SecurityAlertRuleConfig.objects.create(
            code="test_rule",
            name="Test Rule",
            enabled=True,
            severity=Severity.HIGH,
            metric_name="test_metric",
            condition_operator="gte",
            threshold_value="10",
        )

        response = self.client.get(reverse("security:api_configuration_rules"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)
        rule_dto = next((r for r in data if r["code"] == "test_rule"), None)
        self.assertIsNotNone(rule_dto)
        self.assertEqual(rule_dto["title"], "Test Rule")
        self.assertEqual(rule_dto["enabled"], True)
        self.assertEqual(rule_dto["severity"], "high")
        self.assertIn("when_summary", rule_dto)
        self.assertIn("then_summary", rule_dto)

    def test_notifications_does_not_expose_secrets(self):
        response = self.client.get(reverse("security:api_configuration_notifications"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)
        for channel in data:
            dest = channel.get("destination_summary", "")
            self.assertNotIn("password", dest.lower())
            self.assertNotIn("token", dest.lower())
            self.assertNotIn("secret", dest.lower())

    def test_suppressions_handles_empty_data(self):
        response = self.client.get(reverse("security:api_configuration_suppressions"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)

    def test_suppressions_returns_active_rules(self):
        supp = SecurityAlertSuppressionRule.objects.create(
            name="Test Suppression",
            is_active=True,
            reason="Testing",
            created_by=self.user,
        )

        response = self.client.get(reverse("security:api_configuration_suppressions"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        supp_dto = next((s for s in data if s["title"] == "Test Suppression"), None)
        self.assertIsNotNone(supp_dto)
        self.assertEqual(supp_dto["active"], True)
        self.assertEqual(supp_dto["reason"], "Testing")

    def test_create_suppression_accepts_valid_ai_payload(self):
        response = self.client.post(
            reverse("security:api_configuration_suppressions"),
            data={
                "name": "Temporary false positive",
                "source_id": self.source.id,
                "event_type": "defender_vulnerability",
                "severity": "medium",
                "match_payload": {"cve": "CVE-2026-0001"},
                "scope_type": "alert_type",
                "conditions_json": {"asset": "EXAMPLE-HOST"},
                "reason": "Reviewed false positive in test fixture",
                "owner": "Security Team",
                "is_active": True,
                "starts_at": "2026-05-01T08:00:00",
                "expires_at": "2026-05-08T08:00:00",
                "extra_field": "ignored",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        suppression = SecurityAlertSuppressionRule.objects.get(name="Temporary false positive")
        self.assertEqual(suppression.reason, "Reviewed false positive in test fixture")
        self.assertEqual(suppression.source, self.source)
        self.assertNotIn("extra_field", response.json())
        self.assertTrue(SecurityConfigurationAuditLog.objects.filter(action="ai_copilot_create_suppression").exists())

    def test_create_suppression_rejects_missing_reason(self):
        response = self.client.post(
            reverse("security:api_configuration_suppressions"),
            data={
                "name": "No reason",
                "scope_type": "alert_type",
                "owner": "Security Team",
                "conditions_json": {"asset": "EXAMPLE-HOST"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.json()["error"])

    def test_create_suppression_rejects_too_broad_scope(self):
        response = self.client.post(
            reverse("security:api_configuration_suppressions"),
            data={
                "name": "Too broad",
                "scope_type": "alert_type",
                "reason": "Too broad test",
                "owner": "Security Team",
                "match_payload": {},
                "conditions_json": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("too broad", response.json()["error"])

    def test_ai_config_audit_does_not_store_secret_payload_values(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "code": "audit-safe-rule",
                "name": "Audit safe rule",
                "condition_operator": "contains",
                "threshold_value": "safe synthetic condition",
                "threshold_json": {"field": "value"},
                "severity": "medium",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        audit = SecurityConfigurationAuditLog.objects.get(action="ai_copilot_create_rule")
        self.assertNotIn("safe synthetic condition", audit.new_value)
        self.assertNotIn("threshold_json", audit.old_value)

    def test_test_endpoint_does_not_persist_sample_data(self):
        initial_message_count = SecurityMailboxSource.objects.count()

        response = self.client.post(
            reverse("security:api_configuration_test"),
            data={
                "source_type": "email",
                "sample_text": "Test critical vulnerability CVSS 9.8",
                "filename": "test.txt",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("parser_detected", data)
        self.assertIn("would_generate_alert", data)
        self.assertIn("warnings", data)

        final_message_count = SecurityMailboxSource.objects.count()
        self.assertEqual(initial_message_count, final_message_count)

    def test_test_endpoint_returns_simulated_result(self):
        response = self.client.post(
            reverse("security:api_configuration_test"),
            data={
                "sample_text": "WatchGuard EPDR report critical malware detected",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("parser_detected", data)
        self.assertIn("confidence", data)
        self.assertIn("metrics_preview", data)
        self.assertIn("findings_preview", data)
        self.assertIn("would_generate_alert", data)
        self.assertIn("would_create_evidence_container", data)
        self.assertIn("would_create_ticket", data)

    def test_test_endpoint_requires_sample_text(self):
        response = self.client.post(
            reverse("security:api_configuration_test"),
            data={},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_create_rule_with_valid_payload_creates_security_alert_rule_config(self):
        initial_count = SecurityAlertRuleConfig.objects.count()

        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "rule_name": "Test AI Rule",
                "condition": "severity == critical",
                "severity": "high",
                "description": "Test rule for AI generation",
                "recommended_actions": ["Investigate", "Patch"],
                "rationale": "Test rationale",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("rule", data)
        self.assertEqual(data["rule"]["title"], "Test AI Rule")
        self.assertEqual(data["rule"]["enabled"], True)
        self.assertEqual(data["rule"]["severity"], "high")

        final_count = SecurityAlertRuleConfig.objects.count()
        self.assertEqual(final_count, initial_count + 1)

        rule = SecurityAlertRuleConfig.objects.get(code=data["rule"]["code"])
        self.assertEqual(rule.name, "Test AI Rule")
        self.assertEqual(rule.source_type, "ai_generated")
        self.assertEqual(rule.metric_name, "ai_condition")
        self.assertEqual(rule.condition_operator, "contains")
        self.assertEqual(rule.threshold_value, "severity == critical")

    def test_create_source_config_accepts_ai_normalized_payload(self):
        response = self.client.post(
            reverse("security:api_configuration_source_create"),
            data={
                "name": "Example WatchGuard EPDR",
                "source_type": "watchguard_epdr",
                "vendor": "WatchGuard",
                "enabled": True,
                "description": "Synthetic source from reviewed AI draft",
                "expected_frequency": "daily",
                "expected_time_window_start": "08:00",
                "expected_time_window_end": "18:00",
                "mailbox_sender_patterns": ["*@example.local"],
                "mailbox_subject_patterns": ["*EPDR*"],
                "parser_name": "watchguard_report_parser",
                "severity_mapping_json": {"critical": "critical"},
                "metadata_json": {"match_tokens": ["watchguard"]},
                "unexpected_ai_field": "ignored",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        config = SecuritySourceConfig.objects.get(name="Example WatchGuard EPDR")
        self.assertEqual(config.source_type, "watchguard_epdr")
        self.assertEqual(config.expected_frequency, "daily")
        self.assertEqual(config.mailbox_subject_patterns, ["*EPDR*"])
        self.assertNotIn("unexpected_ai_field", response.json())
        self.assertTrue(SecurityConfigurationAuditLog.objects.filter(action="ai_copilot_create_source").exists())

    def test_create_source_config_rejects_missing_required_fields(self):
        response = self.client.post(
            reverse("security:api_configuration_source_create"),
            data={"expected_frequency": "daily", "name": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.json()["error"])

    def test_create_source_config_rejects_invalid_source_type(self):
        response = self.client.post(
            reverse("security:api_configuration_source_create"),
            data={
                "name": "Invalid Source Type",
                "source_type": "Invalid Source",
                "expected_frequency": "daily",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("source_type", response.json()["error"])

    def test_create_structured_rule_accepts_valid_ai_payload(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "code": "defender-critical-cvss",
                "name": "Defender critical CVSS exposed devices",
                "enabled": True,
                "source_type": "microsoft_defender",
                "metric_name": "max_cvss",
                "condition_operator": "gte",
                "threshold_value": "cvss >= 9 and exposed_devices > 0",
                "threshold_json": {"cvss": 9, "exposed_devices": {"gt": 0}},
                "severity": "critical",
                "cooldown_minutes": 60,
                "dedup_window_minutes": 60,
                "auto_create_ticket": False,
                "auto_create_evidence_container": False,
                "description": "Synthetic AI reviewed rule",
                "extra_field": "ignored",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        rule = SecurityAlertRuleConfig.objects.get(code="defender-critical-cvss")
        self.assertEqual(rule.severity, Severity.CRITICAL)
        self.assertEqual(rule.condition_operator, "gte")
        self.assertEqual(rule.cooldown_minutes, 1440)
        self.assertEqual(rule.dedup_window_minutes, 1440)
        self.assertTrue(rule.auto_create_ticket)
        self.assertTrue(rule.auto_create_evidence_container)
        self.assertTrue(SecurityConfigurationAuditLog.objects.filter(action="ai_copilot_create_rule").exists())

    def test_create_structured_rule_rejects_unsafe_code(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "code": "Bad Code!",
                "name": "Bad code",
                "condition_operator": "gte",
                "severity": "high",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("code", response.json()["error"])

    def test_create_structured_rule_rejects_invalid_operator(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "code": "bad-operator",
                "name": "Bad operator",
                "condition_operator": "between",
                "severity": "high",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("condition_operator", response.json()["error"])

    def test_create_structured_rule_rejects_invalid_json(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "code": "bad-json",
                "name": "Bad JSON",
                "condition_operator": "gte",
                "severity": "high",
                "threshold_json": "[1, 2]",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("threshold_json", response.json()["error"])

    def test_create_rule_requires_rule_name_and_condition(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={"severity": "high"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)

    def test_create_rule_rejects_invalid_severity(self):
        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "rule_name": "Test Rule",
                "condition": "test",
                "severity": "invalid",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)
        self.assertIn("severity", data["error"].lower())

    def test_create_rule_handles_duplicate_code_gracefully(self):
        SecurityAlertRuleConfig.objects.create(
            code="ai-test-ai-rule",
            name="Existing Rule",
            enabled=True,
            severity=Severity.HIGH,
        )

        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "rule_name": "Test AI Rule",
                "condition": "test",
                "severity": "high",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("rule", data)
        self.assertNotEqual(data["rule"]["code"], "ai-test-ai-rule")
        self.assertEqual(data["rule"]["code"], "ai-test-ai-rule-1")

    def test_create_rule_requires_manage_permission(self):
        from django.contrib.auth.models import Permission

        view_user = User.objects.create_user(username="viewuser", password="testpass", is_staff=False)
        view_perm = Permission.objects.filter(codename="view_securitycenter").first()
        if view_perm:
            view_user.user_permissions.add(view_perm)

        self.client.force_authenticate(user=view_user)

        response = self.client.post(
            reverse("security:api_configuration_rules"),
            data={
                "rule_name": "Test Rule",
                "condition": "test",
                "severity": "high",
            },
            format="json",
        )

        self.assertIn(response.status_code, [401, 403])

    def test_create_rule_validates_all_severity_levels(self):
        valid_severities = ["critical", "high", "medium", "low", "info"]

        for severity in valid_severities:
            response = self.client.post(
                reverse("security:api_configuration_rules"),
                data={
                    "rule_name": f"Test Rule {severity}",
                    "condition": f"test {severity}",
                    "severity": severity,
                },
                format="json",
            )

            self.assertEqual(response.status_code, 201, f"Failed for severity: {severity}")
            data = response.json()
            self.assertTrue(data["success"])

    def test_get_rules_still_works_after_post_endpoint_added(self):
        SecurityAlertRuleConfig.objects.create(
            code="test-get-rule",
            name="Test Get Rule",
            enabled=True,
            severity=Severity.HIGH,
        )

        response = self.client.get(reverse("security:api_configuration_rules"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)
        rule_dto = next((r for r in data if r["code"] == "test-get-rule"), None)
        self.assertIsNotNone(rule_dto)
        self.assertEqual(rule_dto["title"], "Test Get Rule")
