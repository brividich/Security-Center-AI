import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from security.models import (
    ParseStatus,
    SecurityAlert,
    SecurityEvidenceContainer,
    SecurityEvidenceItem,
    SecurityEventRecord,
    SecurityMailboxMessage,
    SecurityParserConfig,
    SecurityReport,
    SecurityReportMetric,
    SecurityRemediationTicket,
    SecuritySource,
    SecuritySourceConfig,
    SecuritySourceFile,
    Severity,
    SourceType,
    Status,
)


class SecurityInboxWorkbenchTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="inbox-admin",
            password="password",
            is_staff=True,
        )
        self.client.force_login(self.user)
        SecuritySourceConfig.objects.create(
            name="Microsoft Defender",
            source_type="microsoft_defender",
            vendor="Microsoft",
            parser_name="microsoft_defender_vulnerability_notification_email_parser",
            mailbox_sender_patterns=["*microsoft*", "defender-noreply@microsoft.com"],
            mailbox_subject_patterns=["*Defender*", "*vulnerabilities*"],
        )
        SecurityParserConfig.objects.create(
            parser_name="microsoft_defender_vulnerability_notification_email_parser",
            enabled=True,
            priority=10,
        )

    def test_inbox_get_returns_page_for_authorized_user(self):
        response = self.client.get("/security/inbox/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Security Inbox")
        self.assertTemplateUsed(response, "security/inbox.html")

    def test_paste_post_does_not_render_full_raw_body(self):
        sensitive_tail = "SENSITIVE_TOKEN_SHOULD_NOT_RENDER"
        body = (
            "Organization: Contoso\n"
            "CVE-2026-1111\nSeverity: Low\nCVSS: 4.2\nExposed devices: 0\nAffected product: Edge\n"
            + ("safe filler " * 80)
            + sensitive_tail
        )

        response = self.client.post(
            "/security/inbox/",
            {
                "sender": "defender-noreply@microsoft.com",
                "subject": "Microsoft Defender vulnerabilities notification",
                "body": body,
                "content_type": "text/plain",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Last result")
        self.assertContains(response, "Microsoft Defender")
        self.assertNotContains(response, sensitive_tail)

    def test_unsupported_file_extension_returns_validation_error(self):
        upload = SimpleUploadedFile("sample.exe", b"not executable here", content_type="application/octet-stream")

        response = self.client.post("/security/inbox/", {"report_file": upload})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Unsupported file extension")
        self.assertContains(response, ".exe")

    def test_oversized_upload_returns_validation_error(self):
        upload = SimpleUploadedFile("large.txt", b"x" * (10 * 1024 * 1024 + 1), content_type="text/plain")

        response = self.client.post("/security/inbox/", {"report_file": upload})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Uploaded file is too large")

    def test_recent_inbox_api_returns_json(self):
        response = self.client.get("/security/api/inbox/recent/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("recent_reports", response.json())
        self.assertIn("recent_mailbox_messages", response.json())

    def test_recent_inbox_api_returns_safe_report_management_counts(self):
        source = SecuritySource.objects.create(
            name="Example Report Source",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        report = SecurityReport.objects.create(
            source=source,
            report_type="defender_vulnerability",
            title="Example Defender digest",
            parser_name="microsoft_defender_vulnerability_notification_email_parser",
            parse_status=ParseStatus.PARSED,
            parsed_payload={"parse_warnings": ["Synthetic optional field missing"]},
        )
        SecurityReportMetric.objects.create(report=report, name="critical_cves", value=2, unit="count")
        event = SecurityEventRecord.objects.create(
            source=source,
            report=report,
            event_type="vulnerability_finding",
            severity=Severity.CRITICAL,
            fingerprint="f" * 64,
            dedup_hash="d" * 64,
            payload={"cve": "CVE-2026-0001", "note": "raw payload should stay out of recent API"},
        )
        alert = SecurityAlert.objects.create(
            source=source,
            event=event,
            title="Example critical CVE",
            severity=Severity.CRITICAL,
            status=Status.OPEN,
            dedup_hash="d" * 64,
            decision_trace={},
        )
        evidence = SecurityEvidenceContainer.objects.create(
            source=source,
            alert=alert,
            title="Example evidence bundle",
            status=Status.OPEN,
            decision_trace={"safe": "summary"},
        )
        SecurityEvidenceItem.objects.create(
            container=evidence,
            event=event,
            report=report,
            item_type="finding",
            content={"raw": "raw evidence should stay out"},
        )
        SecurityRemediationTicket.objects.create(
            source=source,
            alert=alert,
            title="Example remediation ticket",
            status=Status.IN_PROGRESS,
            severity=Severity.CRITICAL,
            dedup_hash="ticket-dedup",
            occurrence_count=2,
        )

        response = self.client.get("/security/api/inbox/recent/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        recent_report = payload["recent_reports"][0]
        self.assertEqual(recent_report["metrics_count"], 1)
        self.assertEqual(recent_report["events_count"], 1)
        self.assertEqual(recent_report["alerts_count"], 1)
        self.assertEqual(recent_report["warnings_count"], 1)
        self.assertEqual(recent_report["input_kind"], "manual")
        self.assertEqual(recent_report["metric_preview"][0]["name"], "critical_cves")
        self.assertEqual(recent_report["alert_preview"][0]["title"], "Example critical CVE")
        self.assertEqual(recent_report["ticket_preview"][0]["title"], "Example remediation ticket")
        self.assertEqual(recent_report["ticket_preview"][0]["occurrence_count"], 2)
        self.assertEqual(recent_report["evidence_preview"][0]["title"], "Example evidence bundle")
        self.assertEqual(recent_report["evidence_preview"][0]["items_count"], 1)
        response_text = json.dumps(payload, sort_keys=True)
        self.assertNotIn("raw payload should stay out", response_text)
        self.assertNotIn("raw evidence should stay out", response_text)
        self.assertNotIn("CVE-2026-0001", response_text)

    def test_retry_inbox_item_reprocesses_failed_mailbox_message(self):
        source = SecuritySource.objects.create(
            name="Example Retry Source",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        message = SecurityMailboxMessage.objects.create(
            source=source,
            sender="user1@example.local",
            subject="Example failed report",
            body="Synthetic report body",
            parse_status=ParseStatus.FAILED,
        )

        def fake_process(item, dry_run=False):
            item.parse_status = ParseStatus.PARSED
            item.pipeline_result = {"status": "success"}
            item.save(update_fields=["parse_status", "pipeline_result"])
            return {
                "status": "success",
                "processed": True,
                "parser_matched": True,
                "parser_name": "example_parser",
                "reports_parsed": 1,
                "metrics_created": 2,
                "events_created": 3,
                "alerts_created": 1,
                "evidence_created": 1,
                "tickets_changed": 0,
                "warnings": [],
                "errors": [],
            }

        with patch("security.api.process_mailbox_message", side_effect=fake_process) as mock_process:
            response = self.client.post(
                f"/security/api/inbox/mailbox/{message.id}/retry/",
                data=json.dumps({}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["previous_status"], ParseStatus.FAILED)
        self.assertEqual(payload["parse_status"], ParseStatus.PARSED)
        self.assertEqual(payload["reports_parsed"], 1)
        self.assertEqual(payload["events_count"], 3)
        self.assertEqual(payload["alerts_count"], 1)
        mock_process.assert_called_once()

    def test_retry_inbox_item_response_does_not_expose_raw_error_text(self):
        source = SecuritySource.objects.create(
            name="Example File Source",
            vendor="Example Company",
            source_type=SourceType.CSV,
        )
        source_file = SecuritySourceFile.objects.create(
            source=source,
            original_name="example.csv",
            file_type=SourceType.CSV,
            content="raw-source-file-secret-content",
            parse_status=ParseStatus.FAILED,
        )

        def fake_process(item, dry_run=False):
            item.parse_status = ParseStatus.FAILED
            item.save(update_fields=["parse_status"])
            return {
                "status": "error",
                "processed": True,
                "parser_matched": True,
                "parser_name": "example_parser",
                "reports_parsed": 0,
                "metrics_created": 0,
                "events_created": 0,
                "alerts_created": 0,
                "evidence_created": 0,
                "tickets_changed": 0,
                "warnings": [],
                "errors": ["raw-source-file-secret-content"],
            }

        with patch("security.api.process_source_file", side_effect=fake_process):
            response = self.client.post(
                f"/security/api/inbox/file/{source_file.id}/retry/",
                data=json.dumps({}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["errors_count"], 1)
        self.assertNotIn("raw-source-file-secret-content", response.content.decode())

    def test_bulk_retry_processes_visible_failed_and_pending_items(self):
        source = SecuritySource.objects.create(
            name="Example Bulk Source",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        message = SecurityMailboxMessage.objects.create(
            source=source,
            sender="user1@example.local",
            subject="Example pending message",
            body="Synthetic report body",
            parse_status=ParseStatus.PENDING,
        )
        source_file = SecuritySourceFile.objects.create(
            source=source,
            original_name="example.csv",
            file_type=SourceType.CSV,
            content="synthetic,csv",
            parse_status=ParseStatus.FAILED,
        )

        def fake_message_process(item, dry_run=False):
            item.parse_status = ParseStatus.PARSED
            item.pipeline_result = {"status": "success"}
            item.save(update_fields=["parse_status", "pipeline_result"])
            return {
                "status": "success",
                "processed": True,
                "parser_matched": True,
                "parser_name": "example_mail_parser",
                "reports_parsed": 1,
                "metrics_created": 1,
                "events_created": 2,
                "alerts_created": 1,
                "evidence_created": 0,
                "tickets_changed": 0,
                "warnings": [],
                "errors": [],
            }

        def fake_file_process(item, dry_run=False):
            item.parse_status = ParseStatus.PARSED
            item.save(update_fields=["parse_status"])
            return {
                "status": "success",
                "processed": True,
                "parser_matched": True,
                "parser_name": "example_file_parser",
                "reports_parsed": 1,
                "metrics_created": 0,
                "events_created": 1,
                "alerts_created": 0,
                "evidence_created": 0,
                "tickets_changed": 0,
                "warnings": [],
                "errors": [],
            }

        with patch("security.api.process_mailbox_message", side_effect=fake_message_process), patch(
            "security.api.process_source_file",
            side_effect=fake_file_process,
        ):
            response = self.client.post(
                "/security/api/inbox/bulk-retry/",
                data=json.dumps(
                    {
                        "items": [
                            {"kind": "mailbox", "id": message.id},
                            {"kind": "file", "id": source_file.id},
                        ]
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["total"], 2)
        self.assertEqual(payload["summary"]["processed"], 2)
        self.assertEqual(payload["summary"]["reports_parsed"], 2)
        self.assertEqual(payload["summary"]["events"], 3)
        self.assertEqual(payload["summary"]["alerts"], 1)
        self.assertEqual(len(payload["results"]), 2)

    def test_bulk_retry_limits_request_size(self):
        items = [{"kind": "mailbox", "id": index + 1} for index in range(26)]

        response = self.client.post(
            "/security/api/inbox/bulk-retry/",
            data=json.dumps({"items": items}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("limit", response.json()["error"])

    def test_retry_report_without_linked_input_is_rejected(self):
        source = SecuritySource.objects.create(
            name="Example Manual Source",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        report = SecurityReport.objects.create(
            source=source,
            report_type="manual",
            title="Manual report",
            parser_name="manual_parser",
            parse_status=ParseStatus.PARSED,
        )

        response = self.client.post(
            f"/security/api/inbox/report/{report.id}/retry/",
            data=json.dumps({}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("linked input", response.json()["error"])

    def test_retry_inbox_item_requires_manage_permission(self):
        regular_user = get_user_model().objects.create_user(
            username="report-viewer",
            password="password",
            is_staff=False,
        )
        self.client.force_login(regular_user)
        source = SecuritySource.objects.create(
            name="Example Permission Source",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        message = SecurityMailboxMessage.objects.create(
            source=source,
            sender="user1@example.local",
            subject="Example pending report",
            body="Synthetic report body",
            parse_status=ParseStatus.PENDING,
        )

        response = self.client.post(
            f"/security/api/inbox/mailbox/{message.id}/retry/",
            data=json.dumps({}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
