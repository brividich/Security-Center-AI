from django.test import TestCase

from security.models import (
    SecurityAlert,
    SecurityAlertSuppressionRule,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityRemediationTicket,
    SecuritySource,
    Severity,
    SourceType,
)
from security.parsers.microsoft_defender_vulnerability_notification_email_parser import (
    MicrosoftDefenderVulnerabilityNotificationEmailParser,
)
from security.parsers.synology_active_backup_email_parser import SynologyActiveBackupEmailParser
from security.services.dedup import make_hash
from security.services.evidence_builder import build_evidence_container
from security.services.ingestion import ingest_mailbox_message
from security.services.parser_engine import run_pending_parsers
from security.services.rule_engine import evaluate_security_rules


class ParserTests(TestCase):
    def setUp(self):
        self.source = SecuritySource.objects.create(name="Source", vendor="Test", source_type=SourceType.EMAIL)

    def test_parser_defender_vulnerability_email(self):
        msg = ingest_mailbox_message(
            self.source,
            "Microsoft Defender vulnerability notification",
            "CVE-2025-9999\nAffected product: Edge\nCVSS: 9.8\nExposed devices: 2",
        )
        parsed = MicrosoftDefenderVulnerabilityNotificationEmailParser().parse(msg)
        self.assertEqual(parsed.records[0].payload["cve"], "CVE-2025-9999")
        self.assertEqual(parsed.records[0].payload["severity"], "critical")

    def test_parser_synology_backup_email(self):
        msg = ingest_mailbox_message(
            self.source,
            "Synology Active Backup completed",
            "Task: Daily Backup\nStatus: Completed\nProtected items: 4",
        )
        parsed = SynologyActiveBackupEmailParser().parse(msg)
        self.assertEqual(parsed.records[0].payload["job_name"], "Daily Backup")
        self.assertEqual(parsed.records[0].payload["status"], "completed")


class RuleEngineTests(TestCase):
    def setUp(self):
        self.source = SecuritySource.objects.create(name="Source", vendor="Test", source_type=SourceType.EMAIL)

    def test_rule_engine_cve_critical(self):
        event = self._event(
            "vulnerability_finding",
            Severity.CRITICAL,
            {"cve": "CVE-2025-0001", "affected_product": "VPN", "cvss": 9.8, "exposed_devices": 1, "severity": "critical"},
        )
        evaluate_security_rules()
        self.assertEqual(SecurityAlert.objects.filter(event=event, severity=Severity.CRITICAL).count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 1)
        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)

    def test_dedup_ticket_cve(self):
        payload = {"cve": "CVE-2025-0002", "affected_product": "Gateway", "cvss": 9.5, "exposed_devices": 2, "severity": "critical"}
        self._event("vulnerability_finding", Severity.CRITICAL, payload)
        self._event("vulnerability_finding", Severity.CRITICAL, payload)
        evaluate_security_rules()
        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 2)

    def test_evidence_container_creation(self):
        event = self._event("backup_job", Severity.WARNING, {"job_name": "ERP", "status": "failed"})
        evidence = build_evidence_container(self.source, "Backup evidence", event=event)
        self.assertEqual(evidence.items.count(), 1)

    def test_backup_completed_no_alert(self):
        self._event("backup_job", Severity.INFO, {"job_name": "Daily", "status": "completed"})
        evaluate_security_rules()
        self.assertEqual(SecurityAlert.objects.count(), 0)
        self.assertEqual(SecurityEventRecord.objects.first().decision_trace["decision"], "kpi_only")

    def test_backup_failed_alert(self):
        self._event("backup_job", Severity.WARNING, {"job_name": "Daily", "status": "failed"})
        evaluate_security_rules()
        self.assertEqual(SecurityAlert.objects.count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 1)

    def test_suppression_rule_kpi_only(self):
        SecurityAlertSuppressionRule.objects.create(
            name="Suppress low closed ThreatSync",
            event_type="threatsync_low_closed",
            severity=Severity.LOW,
            reason="Closed low-severity ThreatSync events are KPI only.",
        )
        self._event("threatsync_low_closed", Severity.LOW, {"status": "closed"})
        evaluate_security_rules()
        event = SecurityEventRecord.objects.first()
        self.assertTrue(event.suppressed)
        self.assertEqual(event.decision_trace["decision"], "suppressed_kpi_only")
        self.assertEqual(SecurityAlert.objects.count(), 0)

    def test_pipeline_backup_completed_no_alert(self):
        ingest_mailbox_message(
            self.source,
            "Synology Active Backup completed",
            "Task: Daily Backup\nStatus: Completed\nProtected items: 4",
        )
        run_pending_parsers()
        evaluate_security_rules()
        self.assertEqual(SecurityAlert.objects.count(), 0)

    def _event(self, event_type, severity, payload):
        dedup_hash = make_hash(self.source.pk, event_type, payload.get("cve"), payload.get("affected_product"), payload.get("job_name"))
        return SecurityEventRecord.objects.create(
            source=self.source,
            event_type=event_type,
            severity=severity,
            fingerprint=make_hash(dedup_hash, "fingerprint", SecurityEventRecord.objects.count()),
            dedup_hash=dedup_hash,
            payload=payload,
        )
