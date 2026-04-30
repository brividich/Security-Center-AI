from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from security.models import (
    SecurityAlert,
    SecurityAlertRuleConfig,
    SecurityAlertSuppressionRule,
    SecurityMailboxIngestionRun,
    SecurityMailboxSource,
    SecuritySource,
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
