from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from security.models import (
    ParseStatus,
    SecurityAlert,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityMailboxMessage,
    SecurityRemediationTicket,
    SecuritySource,
    SecuritySourceFile,
    Severity,
    SourceType,
    Status,
)


class ReactBackendApiTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user("staff", password="pw", is_staff=True)
        self.user = get_user_model().objects.create_user("user", password="pw")
        self.source = SecuritySource.objects.create(name="WatchGuard", vendor="WatchGuard", source_type=SourceType.EMAIL)
        event = SecurityEventRecord.objects.create(
            source=self.source,
            event_type="critical_test",
            severity=Severity.CRITICAL,
            fingerprint="event-fingerprint",
            dedup_hash="event-dedup",
            payload={"safe": "value"},
        )
        self.alert = SecurityAlert.objects.create(
            source=self.source,
            event=event,
            title="Critical test alert",
            severity=Severity.CRITICAL,
            status=Status.OPEN,
            dedup_hash="alert-dedup",
        )
        SecurityRemediationTicket.objects.create(
            source=self.source,
            alert=self.alert,
            title="Critical test ticket",
            status=Status.OPEN,
            severity=Severity.CRITICAL,
            dedup_hash="ticket-dedup",
        )
        SecurityKpiSnapshot.objects.create(
            source=self.source,
            snapshot_date=timezone.localdate(),
            name="critical_alerts",
            value=1,
        )
        SecurityMailboxMessage.objects.create(
            source=self.source,
            subject="Diagnostic input",
            body="raw-diagnostic-secret-body",
            parse_status=ParseStatus.PENDING,
        )
        SecuritySourceFile.objects.create(
            source=self.source,
            original_name="diagnostic.txt",
            file_type=SourceType.CSV,
            content="raw-source-file-secret-content",
            parse_status=ParseStatus.FAILED,
        )

    def test_dashboard_summary_returns_json_for_authorized_user(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/api/dashboard-summary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("generated_at", payload)
        self.assertIn("open_alerts_count", payload)
        self.assertIn("recent_alerts", payload)
        self.assertIn("recent_tickets", payload)
        self.assertIn("kpi_summary", payload)
        self.assertIn("ingestion_status", payload)

    def test_recent_alerts_returns_compact_alert_list(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/api/alerts/recent/")

        self.assertEqual(response.status_code, 200)
        alert = response.json()["alerts"][0]
        self.assertEqual(alert["title"], "Critical test alert")
        self.assertEqual(alert["source_name"], "WatchGuard")
        self.assertIn("detail_url", alert)

    def test_kpi_summary_returns_json(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/api/kpis/summary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["empty_state"])
        self.assertIn("critical_alerts", payload["counters"])

    def test_addons_summary_returns_json_modules(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/api/addons/summary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("generated_at", payload)
        self.assertIsInstance(payload["modules"], list)
        self.assertIn("code", payload["modules"][0])

    def test_api_requires_existing_security_permissions(self):
        self.assertEqual(self.client.get("/security/api/dashboard-summary/").status_code, 403)

        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/security/api/dashboard-summary/").status_code, 403)

    def test_compact_api_payloads_do_not_expose_raw_diagnostic_content(self):
        self.client.force_login(self.staff)

        responses = [
            self.client.get("/security/api/dashboard-summary/"),
            self.client.get("/security/api/alerts/recent/"),
            self.client.get("/security/api/kpis/summary/"),
            self.client.get("/security/api/addons/summary/"),
        ]

        for response in responses:
            body = response.content.decode()
            self.assertNotIn("raw-diagnostic-secret-body", body)
            self.assertNotIn("raw-source-file-secret-content", body)
