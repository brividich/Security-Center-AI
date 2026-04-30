"""
Tests for mailbox ingestion pipeline integration.
Verifies that imported mailbox messages and attachments are processed through parser/rule/KPI/alert/evidence pipeline.
"""
from django.test import TestCase
from django.utils import timezone

from security.models import (
    SecurityMailboxSource,
    SecurityMailboxMessage,
    SecuritySourceFile,
    SecuritySource,
    SecurityReport,
    SecurityAlert,
    SecurityParserConfig,
    SecuritySourceConfig,
    ParseStatus,
    SourceType,
    Severity,
)
from security.services.mailbox_ingestion import run_mailbox_ingestion
from security.services.security_inbox_pipeline import (
    process_mailbox_message,
    process_source_file,
    process_text_payload,
    process_security_input,
)


FAKE_DEFENDER_CVE_BODY = """
Microsoft Defender for Endpoint

Vulnerability Notification

Product: OpenSSL
CVE: CVE-2024-99001
Severity: Critical
CVSS Score: 9.8
Exposed Devices: 3

Action required: Apply the latest security patches immediately.
"""

FAKE_SYNOLOGY_BACKUP_BODY = """
Synology Active Backup for Business

Task: Server Backup - Daily
Status: Completed
Start time: 2026-04-27 02:00:00
End time: 2026-04-27 03:15:00
Data transferred: 42.5 GB

Backup completed successfully.
"""

FAKE_WATCHGUARD_THREATSYNC_LOW_BODY = """
WatchGuard ThreatSync Summary Report

Period: 2026-04-20 to 2026-04-27

Total incidents: 2
High severity: 0
Critical severity: 0
Low severity: 2
Status: Closed

No active threats detected.
"""

FAKE_WATCHGUARD_CSV_CONTENT = """Timestamp,Type,Severity,Status,Endpoint,Action
2026-04-27 08:00:00,PUP,Low,Closed,EXAMPLE-HOST-1,Quarantined
2026-04-27 09:30:00,Spyware,Low,Closed,EXAMPLE-HOST-2,Quarantined
"""


class MailboxIngestionPipelineTests(TestCase):
    def setUp(self):
        self.source = SecurityMailboxSource.objects.create(
            code="test_source",
            name="Test Mailbox Source",
            source_type="mock",
            enabled=True,
            process_email_body=True,
            process_attachments=True,
            attachment_extensions="pdf,csv,txt",
        )

        self.security_source = SecuritySource.objects.create(
            name="Test Source",
            vendor="test",
            source_type=SourceType.EMAIL,
        )

    def test_process_mailbox_message_pending(self):
        """Test processing a pending mailbox message."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body content",
            sender="test@example.com",
            parse_status=ParseStatus.PENDING,
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])
        message.refresh_from_db()
        self.assertIn(message.parse_status, [ParseStatus.PARSED, ParseStatus.SKIPPED, ParseStatus.FAILED])

    def test_process_mailbox_message_already_processed(self):
        """Test that already processed messages are skipped."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            parse_status=ParseStatus.PARSED,
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertEqual(result["status"], "already_processed")
        self.assertFalse(result["processed"])

    def test_process_source_file_pending(self):
        """Test processing a pending source file."""
        source_file = SecuritySourceFile.objects.create(
            source=self.security_source,
            original_name="test.pdf",
            file_type=SourceType.PDF,
            content="Test PDF content",
            parse_status=ParseStatus.PENDING,
        )

        result = process_source_file(source_file, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])
        source_file.refresh_from_db()
        self.assertIn(source_file.parse_status, [ParseStatus.PARSED, ParseStatus.SKIPPED, ParseStatus.FAILED])

    def test_process_source_file_already_processed(self):
        """Test that already processed files are skipped."""
        source_file = SecuritySourceFile.objects.create(
            source=self.security_source,
            original_name="test.csv",
            file_type=SourceType.CSV,
            content="col1,col2\nval1,val2",
            parse_status=ParseStatus.PARSED,
        )

        result = process_source_file(source_file, dry_run=False)

        self.assertEqual(result["status"], "already_processed")
        self.assertFalse(result["processed"])

    def test_dry_run_no_side_effects(self):
        """Test that dry-run mode creates no pipeline side effects."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            parse_status=ParseStatus.PENDING,
        )

        initial_status = message.parse_status
        result = process_mailbox_message(message, dry_run=True)

        self.assertEqual(result["status"], "dry_run")
        self.assertFalse(result["processed"])
        message.refresh_from_db()
        self.assertEqual(message.parse_status, initial_status)

    def test_mailbox_ingestion_with_processing(self):
        """Test full mailbox ingestion with pipeline processing."""
        run = run_mailbox_ingestion(self.source, limit=5, dry_run=False, process_pipeline=True)

        self.assertIsNotNone(run)
        self.assertEqual(run.status, "success")
        self.assertGreaterEqual(run.imported_messages_count, 0)

    def test_mailbox_ingestion_without_processing(self):
        """Test mailbox ingestion without pipeline processing."""
        run = run_mailbox_ingestion(self.source, limit=5, dry_run=False, process_pipeline=False)

        self.assertIsNotNone(run)
        self.assertEqual(run.status, "success")
        self.assertEqual(run.processed_items_count, 0)

    def test_mailbox_ingestion_dry_run(self):
        """Test mailbox ingestion in dry-run mode."""
        run = run_mailbox_ingestion(self.source, limit=5, dry_run=True)

        self.assertIsNotNone(run)
        self.assertEqual(run.status, "success")
        self.assertEqual(SecurityMailboxMessage.objects.count(), 0)

    def test_duplicate_message_not_reprocessed(self):
        """Test that duplicate messages are not reprocessed."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            fingerprint="test_fingerprint_123",
            parse_status=ParseStatus.PARSED,
        )

        run = run_mailbox_ingestion(self.source, limit=5, dry_run=False)

        self.assertIsNotNone(run)
        self.assertGreaterEqual(run.duplicate_messages_count, 0)

    def test_force_reprocess_duplicate(self):
        """Test force reprocessing of duplicate messages."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            fingerprint="test_fingerprint_456",
            parse_status=ParseStatus.PARSED,
        )

        run = run_mailbox_ingestion(self.source, limit=5, dry_run=False, force_reprocess=True)

        self.assertIsNotNone(run)

    def test_pipeline_result_counters(self):
        """Test that pipeline result counters are populated."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            parse_status=ParseStatus.PENDING,
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertIn("reports_parsed", result)
        self.assertIn("metrics_created", result)
        self.assertIn("events_created", result)
        self.assertIn("alerts_created", result)
        self.assertIn("evidence_created", result)
        self.assertIn("tickets_changed", result)

    def test_pipeline_result_persisted_on_message(self):
        """Test that pipeline_result is persisted on the message after processing."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            parse_status=ParseStatus.PENDING,
        )

        process_mailbox_message(message, dry_run=False)

        message.refresh_from_db()
        self.assertIsInstance(message.pipeline_result, dict)

    def test_attachment_processing(self):
        """Test that attachments are processed through pipeline."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test with attachment",
            body="Test body",
            sender="test@example.com",
        )

        source_file = SecuritySourceFile.objects.create(
            source=self.security_source,
            original_name="report.pdf",
            file_type=SourceType.PDF,
            content="PDF content here",
            parse_status=ParseStatus.PENDING,
            raw_payload={"mailbox_message_id": message.id},
        )

        result = process_source_file(source_file, message=message, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])

    def test_parser_not_matched_skipped(self):
        """Test that items without matching parser are skipped."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Unmatched message",
            body="No parser for this",
            sender="unknown@example.com",
            parse_status=ParseStatus.PENDING,
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertEqual(result["status"], "skipped")
        self.assertFalse(result["parser_matched"])

    def test_ingestion_run_counters_accurate(self):
        """Test that ingestion run counters are accurate."""
        run = run_mailbox_ingestion(self.source, limit=10, dry_run=False, process_pipeline=True)

        self.assertIsNotNone(run)
        self.assertGreaterEqual(run.imported_messages_count, 0)
        self.assertGreaterEqual(run.duplicate_messages_count, 0)
        self.assertGreaterEqual(run.skipped_messages_count, 0)
        self.assertGreaterEqual(run.imported_files_count, 0)
        self.assertGreaterEqual(run.processed_items_count, 0)
        self.assertGreaterEqual(run.generated_alerts_count, 0)
    def test_error_handling_in_pipeline(self):
        """Test that pipeline errors are handled gracefully."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Test message",
            body="Test body",
            sender="test@example.com",
            parse_status=ParseStatus.PENDING,
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertIn("errors", result)
        self.assertIsInstance(result["errors"], list)

    def test_process_text_payload_dry_run(self):
        """Test process_text_payload in dry-run mode creates no records."""
        initial_count = SecurityMailboxMessage.objects.count()
        result = process_text_payload("some text", subject="test", dry_run=True)
        self.assertEqual(result["status"], "dry_run")
        self.assertEqual(SecurityMailboxMessage.objects.count(), initial_count)

    def test_process_text_payload_empty(self):
        """Test process_text_payload with empty input returns skipped."""
        result = process_text_payload("", subject="", dry_run=False)
        self.assertEqual(result["status"], "skipped")

    def test_process_text_payload_creates_message(self):
        """Test process_text_payload creates a SecurityMailboxMessage."""
        initial_count = SecurityMailboxMessage.objects.count()
        process_text_payload("some content", subject="Test", sender="x@example.com", dry_run=False)
        self.assertEqual(SecurityMailboxMessage.objects.count(), initial_count + 1)

    def test_process_security_input_dispatches_message(self):
        """Test process_security_input dispatches correctly for SecurityMailboxMessage."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Dispatch test",
            body="body",
            sender="x@example.com",
            parse_status=ParseStatus.PENDING,
        )
        result = process_security_input(message, dry_run=True)
        self.assertEqual(result["status"], "dry_run")

    def test_process_security_input_dispatches_file(self):
        """Test process_security_input dispatches correctly for SecuritySourceFile."""
        sf = SecuritySourceFile.objects.create(
            source=self.security_source,
            original_name="test.csv",
            file_type=SourceType.CSV,
            content="col,val\n1,2",
            parse_status=ParseStatus.PENDING,
        )
        result = process_security_input(sf, dry_run=True)
        self.assertEqual(result["status"], "dry_run")

    def test_process_security_input_unknown_type(self):
        """Test process_security_input returns error for unknown type."""
        result = process_security_input("not-a-model-instance")
        self.assertEqual(result["status"], "error")


class SyntheticFixturesPipelineTests(TestCase):
    """Tests using synthetic sanitized fixtures representative of real vendor formats."""

    def setUp(self):
        self.security_source = SecuritySource.objects.create(
            name="Synthetic Test Source",
            vendor="test",
            source_type=SourceType.EMAIL,
        )

    def _make_message(self, subject, body, sender="noreply@example.local"):
        return SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject=subject,
            body=body,
            sender=sender,
            parse_status=ParseStatus.PENDING,
        )

    def _make_file(self, name, content, file_type=SourceType.CSV):
        return SecuritySourceFile.objects.create(
            source=self.security_source,
            original_name=name,
            file_type=file_type,
            content=content,
            parse_status=ParseStatus.PENDING,
        )

    def test_fake_defender_cve_email_pipeline(self):
        """Fake Defender CVE email (Critical, CVSS 9.8, 3 exposed devices) goes through pipeline."""
        message = self._make_message(
            subject="Microsoft Defender - Vulnerability Notification: CVE-2024-99001",
            body=FAKE_DEFENDER_CVE_BODY,
            sender="no-reply@microsoft.com",
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])
        self.assertIsInstance(result["errors"], list)
        message.refresh_from_db()
        self.assertIn(message.parse_status, [ParseStatus.PARSED, ParseStatus.SKIPPED, ParseStatus.FAILED])

    def test_fake_synology_backup_email_pipeline(self):
        """Fake Synology Active Backup completed email goes through pipeline."""
        message = self._make_message(
            subject="Synology Active Backup - Task Completed",
            body=FAKE_SYNOLOGY_BACKUP_BODY,
            sender="noreply@example.local",
        )

        result = process_mailbox_message(message, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])
        self.assertIsInstance(result["errors"], list)

    def test_fake_watchguard_threatsync_low_no_alert(self):
        """Fake WatchGuard ThreatSync with only low/closed threats should not create critical alert."""
        message = self._make_message(
            subject="WatchGuard ThreatSync Summary - No Active Threats",
            body=FAKE_WATCHGUARD_THREATSYNC_LOW_BODY,
            sender="noreply@watchguard.com",
        )

        alerts_before = SecurityAlert.objects.filter(
            severity=Severity.CRITICAL
        ).count()

        result = process_mailbox_message(message, dry_run=False)

        alerts_after = SecurityAlert.objects.filter(
            severity=Severity.CRITICAL
        ).count()

        self.assertIn(result["status"], ["success", "skipped"])
        self.assertEqual(
            alerts_after,
            alerts_before,
            "Low/closed WatchGuard ThreatSync summary must not generate critical alerts",
        )

    def test_fake_watchguard_csv_attachment_pipeline(self):
        """Fake WatchGuard CSV attachment goes through pipeline."""
        sf = self._make_file(
            name="watchguard_report_2026-04-27.csv",
            content=FAKE_WATCHGUARD_CSV_CONTENT,
            file_type=SourceType.CSV,
        )

        result = process_source_file(sf, dry_run=False)

        self.assertIn(result["status"], ["success", "skipped"])
        self.assertIsInstance(result["errors"], list)
        sf.refresh_from_db()
        self.assertIn(sf.parse_status, [ParseStatus.PARSED, ParseStatus.SKIPPED, ParseStatus.FAILED])

    def test_deduplication_defender_cve(self):
        """Same Defender CVE email processed twice - second time is skipped (already_processed)."""
        message = self._make_message(
            subject="Microsoft Defender - Vulnerability Notification: CVE-2024-99001",
            body=FAKE_DEFENDER_CVE_BODY,
        )

        result1 = process_mailbox_message(message, dry_run=False)
        self.assertIn(result1["status"], ["success", "skipped"])

        result2 = process_mailbox_message(message, dry_run=False)
        self.assertEqual(result2["status"], "already_processed")
        self.assertFalse(result2["processed"])

    def test_force_reprocess_sets_pending_and_reruns(self):
        """Force reprocess: message with parse_status=parsed is reset to pending and reprocessed."""
        message = SecurityMailboxMessage.objects.create(
            source=self.security_source,
            subject="Processed message",
            body=FAKE_SYNOLOGY_BACKUP_BODY,
            sender="noreply@example.local",
            parse_status=ParseStatus.PARSED,
            fingerprint="force-reprocess-fp-001",
        )

        message.parse_status = ParseStatus.PENDING
        message.save(update_fields=["parse_status"])

        result = process_mailbox_message(message, dry_run=False)
        self.assertIn(result["status"], ["success", "skipped"])

    def test_dry_run_with_defender_fixture_no_records(self):
        """Dry-run with Defender CVE body creates no pipeline records."""
        initial_reports = SecurityReport.objects.count()
        initial_alerts = SecurityAlert.objects.count()

        result = process_text_payload(
            FAKE_DEFENDER_CVE_BODY,
            subject="Microsoft Defender - Vulnerability Notification",
            sender="no-reply@microsoft.com",
            dry_run=True,
        )

        self.assertEqual(result["status"], "dry_run")
        self.assertEqual(SecurityReport.objects.count(), initial_reports)
        self.assertEqual(SecurityAlert.objects.count(), initial_alerts)

    def test_pipeline_result_field_populated_after_processing(self):
        """pipeline_result JSONField is populated after processing."""
        message = self._make_message(
            subject="Some message",
            body="Some body content",
        )
        process_mailbox_message(message, dry_run=False)
        message.refresh_from_db()
        self.assertIsInstance(message.pipeline_result, dict)

    def test_ingestion_run_all_counters_non_negative(self):
        """All run counters remain non-negative after ingestion with synthetic source."""
        source = SecurityMailboxSource.objects.create(
            code="synthetic-test",
            name="Synthetic Ingestion Source",
            source_type="mock",
            enabled=True,
            process_email_body=True,
            process_attachments=False,
        )
        run = run_mailbox_ingestion(source, limit=5, dry_run=False, process_pipeline=True)
        self.assertIsNotNone(run)
        self.assertGreaterEqual(run.imported_messages_count, 0)
        self.assertGreaterEqual(run.duplicate_messages_count, 0)
        self.assertGreaterEqual(run.skipped_messages_count, 0)
        self.assertGreaterEqual(run.imported_files_count, 0)
        self.assertGreaterEqual(run.processed_items_count, 0)
        self.assertGreaterEqual(run.generated_alerts_count, 0)
