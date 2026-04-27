from pathlib import Path

from django.test import TestCase
from django.utils import timezone
from django.template.loader import get_template
from rest_framework.test import APIClient

from security.models import (
    BackupJobRecord,
    SecurityAlert,
    SecurityAlertActionLog,
    SecurityAlertSuppressionRule,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityRemediationTicket,
    SecuritySource,
    Severity,
    SourceType,
    Status,
)
from security.parsers.microsoft_defender_vulnerability_notification_email_parser import (
    MicrosoftDefenderVulnerabilityNotificationEmailParser,
    microsoft_defender_vulnerability_notification_email_parser,
)
from security.parsers.synology_active_backup_email_parser import SynologyActiveBackupEmailParser
from security.parsers.synology_active_backup_email_parser import parse_synology_active_backup_email
from security.services.alert_lifecycle import acknowledge_alert, close_alert, mark_false_positive, reopen_alert, snooze_alert
from security.services.dedup import make_hash
from security.services.evidence_builder import build_evidence_container
from security.services.ingestion import ingest_mailbox_message
from security.services.kpi_service import build_daily_kpi_snapshots
from security.services.parser_engine import run_pending_parsers
from security.services.rule_engine import evaluate_security_rules


SYNOLOGY_SUBJECT_COMPLETED = "NAS-BCK Active Backup for Business - attività di backup BCK-PCFSANTUCCI su BACKUPNAS completata"
SYNOLOGY_BODY_COMPLETED = """attività backup BCK-PCFSANTUCCI su BACKUPNAS completata
ora inizio 26/04/2026 00:02
ora fine 26/04/2026 00:18
dimensioni trasferite 14.4 GB
dispositivo PCFSANTUCCI"""


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

    def test_defender_one_critical_cve_creates_alert_candidate(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "New vulnerabilities notification from Microsoft Defender for Endpoint",
            "Organization: Contoso\nCVE-2025-9999\nSeverity: Critical\nCVSS score: 9.8\nExposed devices: 58\nAffected product: Microsoft Edge",
            sender="defender-noreply@microsoft.com",
        )

        self.assertEqual(parsed["findings"][0]["cvss"], 9.8)
        self.assertEqual(parsed["findings"][0]["exposed_devices"], 58)
        self.assertEqual(len(parsed["alert_candidates"]), 1)
        self.assertEqual(parsed["alert_candidates"][0]["severity"], Severity.CRITICAL)

    def test_defender_cvss_comma_decimal_parses(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "Defender",
            "CVE-2025-1001\nSeverity: High\nCVSS score: 9,8\nExposed devices: 4\nAffected product: Windows Server",
        )

        self.assertEqual(parsed["findings"][0]["cvss"], 9.8)

    def test_defender_multiple_cves_in_one_email(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "Defender",
            "CVE-2025-1001\nSeverity: Critical\nCVSS: 9.8\nExposed devices: 4\nAffected product: Edge\n"
            "CVE-2025-1002\nSeverity: High\nCVSS: 8.1\nExposed devices: 3\nAffected product: Defender",
        )

        self.assertEqual([finding["cve"] for finding in parsed["findings"]], ["CVE-2025-1001", "CVE-2025-1002"])
        self.assertEqual(parsed["metrics"]["defender_vulnerability_total_count"], 2)

    def test_defender_exposed_devices_zero_does_not_create_alert_candidate(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "Defender",
            "CVE-2025-1003\nSeverity: Critical\nCVSS: 9.8\nExposed devices: 0\nAffected product: Edge",
        )

        self.assertEqual(parsed["alert_candidates"], [])

    def test_defender_high_cvss_below_nine_does_not_create_critical_alert(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "Defender",
            "CVE-2025-1004\nSeverity: High\nCVSS: 8.8\nExposed devices: 4\nAffected product: Edge",
        )

        self.assertEqual(parsed["alert_candidates"], [])

    def test_defender_critical_without_cvss_creates_alert_candidate_when_exposed(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser(
            "Defender",
            "CVE-2025-1005\nSeverity: Critical\nExposed devices: 4\nAffected product: Edge",
        )

        self.assertIsNone(parsed["findings"][0]["cvss"])
        self.assertEqual(len(parsed["alert_candidates"]), 1)

    def test_defender_malformed_email_returns_warning_no_crash(self):
        parsed = microsoft_defender_vulnerability_notification_email_parser("Defender", "<p>not a useful vulnerability table</p>")

        self.assertTrue(parsed["parse_warnings"])
        self.assertEqual(parsed["findings"], [])

    def test_defender_parser_is_pure_without_db_access(self):
        with self.assertNumQueries(0):
            parsed = microsoft_defender_vulnerability_notification_email_parser(
                "Defender",
                "CVE-2025-1006\nSeverity: Critical\nCVSS: 9.1\nExposed devices: 1\nAffected product: Edge",
            )

        self.assertEqual(parsed["findings"][0]["cve"], "CVE-2025-1006")

    def test_parser_synology_backup_email(self):
        msg = ingest_mailbox_message(
            self.source,
            SYNOLOGY_SUBJECT_COMPLETED,
            SYNOLOGY_BODY_COMPLETED,
        )
        parsed = SynologyActiveBackupEmailParser().parse(msg)
        self.assertEqual(parsed.records[0].payload["job_name"], "BCK-PCFSANTUCCI")
        self.assertEqual(parsed.records[0].payload["status"], "completed")
        self.assertEqual(parsed.records[0].payload["nas_name"], "BACKUPNAS")
        self.assertEqual(parsed.records[0].payload["device_name"], "PCFSANTUCCI")
        self.assertEqual(parsed.records[0].payload["duration_seconds"], 960)
        self.assertEqual(parsed.records[0].payload["transferred_size_gb"], 14.4)

    def test_parse_synology_active_backup_completed_italian_email(self):
        parsed = parse_synology_active_backup_email(
            SYNOLOGY_SUBJECT_COMPLETED,
            SYNOLOGY_BODY_COMPLETED,
            sender="nas@example.test",
        )

        self.assertEqual(parsed["vendor"], "synology")
        self.assertEqual(parsed["job_name"], "BCK-PCFSANTUCCI")
        self.assertEqual(parsed["nas_name"], "BACKUPNAS")
        self.assertEqual(parsed["device_name"], "PCFSANTUCCI")
        self.assertEqual(parsed["status"], "completed")
        self.assertEqual(parsed["duration_seconds"], 960)
        self.assertEqual(parsed["transferred_size_gb"], 14.4)
        self.assertEqual(parsed["sender"], "nas@example.test")
        self.assertIn("dedup_hash", parsed)
        self.assertIn("raw_body_hash", parsed)

    def test_parse_synology_active_backup_failed_and_warning_statuses(self):
        failed = parse_synology_active_backup_email(
            "Active Backup for Business - attività di backup BCK-PC su NAS non riuscita",
            "attività backup BCK-PC su NAS non riuscita\nora inizio 26/04/2026 01:00\nora fine 26/04/2026 01:05\ndispositivo PC",
        )
        warning = parse_synology_active_backup_email(
            "Active Backup for Business warning",
            "attività backup BCK-PC su NAS avviso\nora inizio 26/04/2026 01:00\nora fine 26/04/2026 01:05\ndispositivo PC",
        )

        self.assertEqual(failed["status"], "failed")
        self.assertEqual(warning["status"], "warning")

    def test_synology_dedup_hash_is_stable(self):
        first = parse_synology_active_backup_email(SYNOLOGY_SUBJECT_COMPLETED, SYNOLOGY_BODY_COMPLETED)
        second = parse_synology_active_backup_email(SYNOLOGY_SUBJECT_COMPLETED, SYNOLOGY_BODY_COMPLETED)

        self.assertEqual(first["dedup_hash"], second["dedup_hash"])
        self.assertEqual(first["raw_body_hash"], second["raw_body_hash"])


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
        self.assertEqual(SecurityAlert.objects.count(), 1)
        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 2)
        self.assertFalse(SecurityEventRecord.objects.filter(decision_trace={}).exists())

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
            SYNOLOGY_SUBJECT_COMPLETED,
            SYNOLOGY_BODY_COMPLETED,
        )
        run_pending_parsers()
        evaluate_security_rules()
        self.assertEqual(SecurityAlert.objects.count(), 0)
        self.assertEqual(BackupJobRecord.objects.count(), 1)
        self.assertEqual(SecurityEventRecord.objects.get(event_type="backup_job").decision_trace["decision"], "kpi_only")

    def test_pipeline_backup_failed_creates_alert_and_evidence(self):
        ingest_mailbox_message(
            self.source,
            "NAS-BCK Active Backup for Business - attività di backup BCK-PCFSANTUCCI su BACKUPNAS non riuscita",
            SYNOLOGY_BODY_COMPLETED.replace("completata", "non riuscita"),
        )

        run_pending_parsers()
        evaluate_security_rules()

        self.assertEqual(BackupJobRecord.objects.filter(status="failed").count(), 1)
        self.assertEqual(SecurityAlert.objects.count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 1)

    def test_defender_duplicate_same_cve_product_updates_existing_ticket(self):
        body = (
            "Organization: Contoso\n"
            "CVE-2025-2001\nSeverity: Critical\nCVSS: 9.8\nExposed devices: 2\nAffected product: Microsoft Edge"
        )
        ingest_mailbox_message(self.source, "New vulnerabilities notification from Microsoft Defender for Endpoint", body, sender="defender-noreply@microsoft.com", external_id="one")
        ingest_mailbox_message(self.source, "New vulnerabilities notification from Microsoft Defender for Endpoint", body.replace("Exposed devices: 2", "Exposed devices: 5"), sender="defender-noreply@microsoft.com", external_id="two")

        run_pending_parsers()
        evaluate_security_rules()

        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)
        ticket = SecurityRemediationTicket.objects.get()
        self.assertEqual(ticket.cve_ids, ["CVE-2025-2001"])
        self.assertEqual(ticket.occurrence_count, 2)
        self.assertEqual(ticket.max_exposed_devices, 5)
        self.assertEqual(ticket.evidence.count(), 2)

    def test_defender_repeated_email_import_increments_occurrence_without_duplicate_ticket(self):
        body = (
            "Organization: Contoso\n"
            "CVE-2025-2002\nSeverity: Critical\nCVSS: 9.5\nExposed devices: 7\nAffected product: Windows Server"
        )
        ingest_mailbox_message(self.source, "New vulnerabilities notification from Microsoft Defender for Endpoint", body, sender="defender-noreply@microsoft.com", external_id="one")
        ingest_mailbox_message(self.source, "New vulnerabilities notification from Microsoft Defender for Endpoint", body, sender="defender-noreply@microsoft.com", external_id="two")

        run_pending_parsers()
        evaluate_security_rules()

        ticket = SecurityRemediationTicket.objects.get()
        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)
        self.assertEqual(ticket.occurrence_count, 2)
        self.assertEqual(ticket.max_exposed_devices, 7)

    def test_defender_multiple_critical_cves_same_product_aggregate_ticket(self):
        body = (
            "Organization: Contoso\n"
            "CVE-2025-2003\nSeverity: Critical\nCVSS: 9.8\nExposed devices: 4\nAffected product: Microsoft Edge\n"
            "CVE-2025-2004\nSeverity: Critical\nCVSS: 9.1\nExposed devices: 2\nAffected product: Microsoft Edge"
        )
        ingest_mailbox_message(self.source, "New vulnerabilities notification from Microsoft Defender for Endpoint", body, sender="defender-noreply@microsoft.com")

        run_pending_parsers()
        evaluate_security_rules()

        self.assertEqual(SecurityAlert.objects.filter(severity=Severity.CRITICAL).count(), 2)
        self.assertEqual(SecurityRemediationTicket.objects.count(), 1)
        ticket = SecurityRemediationTicket.objects.get()
        self.assertEqual(ticket.cve_ids, ["CVE-2025-2003", "CVE-2025-2004"])
        self.assertEqual(ticket.max_cvss, 9.8)
        self.assertEqual(ticket.max_exposed_devices, 4)

    def test_pipeline_synology_backup_deduplicates_records_and_events(self):
        ingest_mailbox_message(self.source, SYNOLOGY_SUBJECT_COMPLETED, SYNOLOGY_BODY_COMPLETED, external_id="one")
        ingest_mailbox_message(self.source, SYNOLOGY_SUBJECT_COMPLETED, SYNOLOGY_BODY_COMPLETED, external_id="two")

        run_pending_parsers()

        self.assertEqual(BackupJobRecord.objects.count(), 1)
        self.assertEqual(SecurityEventRecord.objects.filter(event_type="backup_job").count(), 1)

    def test_backup_daily_kpis_are_built_from_synology_record(self):
        ingest_mailbox_message(self.source, SYNOLOGY_SUBJECT_COMPLETED, SYNOLOGY_BODY_COMPLETED)
        run_pending_parsers()

        created = build_daily_kpi_snapshots(snapshot_date=timezone.datetime(2026, 4, 26).date())

        self.assertGreaterEqual(created, 7)
        snapshots = {snapshot.name: snapshot.value for snapshot in SecurityKpiSnapshot.objects.filter(source=self.source)}
        self.assertEqual(snapshots["backup_completed_count"], 1)
        self.assertEqual(snapshots["backup_failed_count"], 0)
        self.assertEqual(snapshots["backup_warning_count"], 0)
        self.assertEqual(snapshots["backup_transferred_total_gb"], 14.4)
        self.assertEqual(snapshots["backup_duration_avg_seconds"], 960)
        self.assertEqual(snapshots["backup_duration_max_seconds"], 960)
        self.assertEqual(snapshots["backup_devices_backed_up"], 1)

    def test_dedup_reuses_acknowledged_and_snoozed_alerts(self):
        for status in [Status.ACKNOWLEDGED, Status.SNOOZED]:
            with self.subTest(status=status):
                payload = {
                    "cve": f"CVE-2026-{status == Status.SNOOZED and '1002' or '1001'}",
                    "affected_product": "Gateway",
                    "cvss": 9.6,
                    "exposed_devices": 1,
                    "severity": "critical",
                }
                self._event("vulnerability_finding", Severity.CRITICAL, payload)
                evaluate_security_rules()
                alert = SecurityAlert.objects.get(dedup_hash=make_hash(self.source.pk, "vulnerability_finding", payload["cve"], payload["affected_product"], None))
                alert.status = status
                if status == Status.SNOOZED:
                    alert.snoozed_until = timezone.now() + timezone.timedelta(hours=2)
                alert.save()
                self._event("vulnerability_finding", Severity.CRITICAL, payload)
                evaluate_security_rules()
                self.assertEqual(SecurityAlert.objects.filter(dedup_hash=alert.dedup_hash).count(), 1)

    def test_dedup_does_not_reuse_terminal_alerts(self):
        terminal_statuses = [Status.CLOSED, Status.FALSE_POSITIVE, Status.RESOLVED]
        for index, status in enumerate(terminal_statuses, start=1):
            with self.subTest(status=status):
                payload = {
                    "cve": f"CVE-2026-20{index}",
                    "affected_product": "Gateway",
                    "cvss": 9.6,
                    "exposed_devices": 1,
                    "severity": "critical",
                }
                self._event("vulnerability_finding", Severity.CRITICAL, payload)
                evaluate_security_rules()
                dedup_hash = make_hash(self.source.pk, "vulnerability_finding", payload["cve"], payload["affected_product"], None)
                alert = SecurityAlert.objects.get(dedup_hash=dedup_hash)
                alert.status = status
                alert.save(update_fields=["status", "updated_at"])
                self._event("vulnerability_finding", Severity.CRITICAL, payload)
                evaluate_security_rules()
                self.assertEqual(SecurityAlert.objects.filter(dedup_hash=dedup_hash).count(), 2)

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


class AlertLifecycleTests(TestCase):
    def setUp(self):
        self.source = SecuritySource.objects.create(name="Lifecycle Source", vendor="Test", source_type=SourceType.EMAIL)
        self.event = SecurityEventRecord.objects.create(
            source=self.source,
            event_type="vulnerability_finding",
            severity=Severity.CRITICAL,
            fingerprint=make_hash("lifecycle", "fingerprint"),
            dedup_hash=make_hash("lifecycle", "dedup"),
            payload={"cve": "CVE-2026-3001", "affected_product": "Gateway", "cvss": 9.7, "exposed_devices": 1},
            decision_trace={"decision": "alert"},
        )
        self.alert = SecurityAlert.objects.create(
            source=self.source,
            event=self.event,
            title="Lifecycle alert",
            severity=Severity.CRITICAL,
            dedup_hash=self.event.dedup_hash,
            decision_trace={"decision": "alert"},
        )

    def test_acknowledge_changes_status_and_logs(self):
        acknowledge_alert(self.alert, actor="tester", reason="triaged")
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.ACKNOWLEDGED)
        self.assertIsNotNone(self.alert.acknowledged_at)
        self.assert_action_logged("acknowledge", Status.NEW, Status.ACKNOWLEDGED)

    def test_close_changes_status_and_logs(self):
        close_alert(self.alert, actor="tester", reason="fixed")
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.CLOSED)
        self.assertIsNotNone(self.alert.closed_at)
        self.assert_action_logged("close", Status.NEW, Status.CLOSED)

    def test_false_positive_changes_status_and_logs(self):
        mark_false_positive(self.alert, actor="tester", reason="benign")
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.FALSE_POSITIVE)
        self.assertIsNotNone(self.alert.closed_at)
        self.assert_action_logged("false_positive", Status.NEW, Status.FALSE_POSITIVE)

    def test_snooze_sets_until_and_logs(self):
        until = timezone.now() + timezone.timedelta(hours=4)
        snooze_alert(self.alert, until, actor="tester", reason="maintenance")
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.SNOOZED)
        self.assertIsNotNone(self.alert.snoozed_until)
        self.assert_action_logged("snooze", Status.NEW, Status.SNOOZED)

    def test_reopen_sets_open_and_logs(self):
        close_alert(self.alert, actor="tester", reason="done")
        reopen_alert(self.alert, actor="tester", reason="regressed")
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.OPEN)
        self.assertIsNone(self.alert.closed_at)
        self.assert_action_logged("reopen", Status.CLOSED, Status.OPEN)

    def assert_action_logged(self, action, old_status, new_status):
        log = SecurityAlertActionLog.objects.filter(alert=self.alert, action=action).latest("created_at")
        self.assertEqual(log.actor, "tester")
        self.assertEqual(log.details["old_status"], old_status)
        self.assertEqual(log.details["new_status"], new_status)
        self.assertIn("reason", log.details)


class ApiPipelineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.source = SecuritySource.objects.create(name="API Source", vendor="Test", source_type=SourceType.EMAIL)

    def test_api_ingestion_pipeline_creates_alert(self):
        ingest_response = self.client.post(
            f"/api/sources/{self.source.pk}/ingest-mailbox-message/",
            {
                "subject": "Microsoft Defender vulnerability notification",
                "body": "CVE-2025-7777\nAffected product: Edge\nCVSS: 9.8\nExposed devices: 2",
                "sender": "defender@example.test",
            },
            format="json",
        )
        self.assertEqual(ingest_response.status_code, 201)

        parser_response = self.client.post("/api/pipeline/run-parsers/")
        rules_response = self.client.post("/api/pipeline/evaluate-rules/")

        self.assertEqual(parser_response.status_code, 200)
        self.assertEqual(rules_response.status_code, 200)
        self.assertEqual(SecurityAlert.objects.filter(severity=Severity.CRITICAL).count(), 1)
        self.assertEqual(SecurityEvidenceContainer.objects.count(), 1)


class UiSmokeTests(TestCase):
    def setUp(self):
        self.source = SecuritySource.objects.create(name="UI Source", vendor="Test", source_type=SourceType.EMAIL)
        self.event = SecurityEventRecord.objects.create(
            source=self.source,
            event_type="vulnerability_finding",
            severity=Severity.CRITICAL,
            fingerprint=make_hash("ui", "fingerprint"),
            dedup_hash=make_hash("ui", "cve"),
            payload={"cve": "CVE-2026-0001", "affected_product": "Portal", "cvss": 9.7, "exposed_devices": 1},
            decision_trace={"decision": "alert"},
        )
        self.alert = SecurityAlert.objects.create(
            source=self.source,
            event=self.event,
            title="Critical exposed vulnerability CVE-2026-0001",
            severity=Severity.CRITICAL,
            dedup_hash=self.event.dedup_hash,
            decision_trace={"decision": "alert"},
        )
        evidence = build_evidence_container(self.source, "UI evidence", alert=self.alert, event=self.event)
        SecurityRemediationTicket.objects.create(
            source=self.source,
            alert=self.alert,
            cve="CVE-2026-0001",
            affected_product="Portal",
            title="Remediate CVE-2026-0001 on Portal",
            dedup_hash=self.event.dedup_hash,
        ).evidence.add(evidence)

    def test_dashboard_http_200(self):
        self.assertEqual(self.client.get("/security/").status_code, 200)

    def test_alerts_list_http_200(self):
        self.assertEqual(self.client.get("/security/alerts/").status_code, 200)

    def test_alert_detail_http_200(self):
        self.assertEqual(self.client.get(f"/security/alerts/{self.alert.pk}/").status_code, 200)

    def test_tickets_list_http_200(self):
        self.assertEqual(self.client.get("/security/tickets/").status_code, 200)

    def test_kpis_http_200(self):
        self.assertEqual(self.client.get("/security/kpis/").status_code, 200)

    def test_pipeline_page_http_200(self):
        self.assertEqual(self.client.get("/security/pipeline/").status_code, 200)

    def test_alert_action_endpoint_redirects_and_logs(self):
        response = self.client.post(f"/security/alerts/{self.alert.pk}/actions/acknowledge/", {"reason": "ui triage"})
        self.assertEqual(response.status_code, 302)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.ACKNOWLEDGED)
        self.assertEqual(SecurityAlertActionLog.objects.filter(alert=self.alert, action="acknowledge").count(), 1)

    def test_alert_snooze_endpoint_accepts_default_until(self):
        response = self.client.post(f"/security/alerts/{self.alert.pk}/actions/snooze/", {"reason": "wait"})
        self.assertEqual(response.status_code, 302)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, Status.SNOOZED)
        self.assertIsNotNone(self.alert.snoozed_until)

    def test_alert_action_hx_returns_lifecycle_panel_partial(self):
        response = self.client.post(
            f"/security/alerts/{self.alert.pk}/actions/acknowledge/",
            {"reason": "ui triage"},
            HTTP_HX_REQUEST="true",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "security/partials/alert_lifecycle_panel.html")
        self.assertContains(response, "Acknowledged")
        self.assertContains(response, 'id="alert-lifecycle-panel"')
        self.assertContains(response, "Alert action recorded: acknowledge.")
        self.assertNotContains(response, "<html")

    def test_alert_close_hx_updates_lifecycle_panel_to_reopen_only(self):
        response = self.client.post(
            f"/security/alerts/{self.alert.pk}/actions/close/",
            {"reason": "done"},
            HTTP_HX_REQUEST="true",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "security/partials/alert_lifecycle_panel.html")
        self.assertContains(response, "Closed")
        self.assertContains(response, ">Reopen</button>")
        self.assertNotContains(response, ">Acknowledge</button>")
        self.assertNotContains(response, ">Snooze</button>")
        self.assertNotContains(response, ">Close</button>")
        self.assertNotContains(response, ">False positive</button>")
        self.assertNotContains(response, ">False positive</button>")

    def test_alert_false_positive_hx_updates_lifecycle_panel_to_reopen_only(self):
        response = self.client.post(
            f"/security/alerts/{self.alert.pk}/actions/false_positive/",
            HTTP_HX_REQUEST="true",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "security/partials/alert_lifecycle_panel.html")
        self.assertContains(response, "False positive")
        self.assertContains(response, ">Reopen</button>")
        self.assertNotContains(response, ">Acknowledge</button>")
        self.assertNotContains(response, ">Snooze</button>")
        self.assertNotContains(response, ">Close</button>")

    def test_resolved_alert_detail_shows_reopen_without_active_actions(self):
        self.alert.status = Status.RESOLVED
        self.alert.save(update_fields=["status", "updated_at"])
        response = self.client.get(f"/security/alerts/{self.alert.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Resolved")
        self.assertContains(response, ">Reopen</button>")
        self.assertNotContains(response, ">Acknowledge</button>")
        self.assertNotContains(response, ">Snooze</button>")
        self.assertNotContains(response, ">Close</button>")
        self.assertNotContains(response, ">False positive</button>")

    def test_pipeline_run_hx_returns_result_partial(self):
        response = self.client.post(
            "/security/pipeline/run/build-kpis/",
            HTTP_HX_REQUEST="true",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "security/partials/pipeline_result.html")
        self.assertContains(response, "Stato pipeline")
        self.assertContains(response, "build-kpis")
        self.assertNotContains(response, "<html")

    def test_alert_detail_hx_forms_have_csrf_and_valid_target(self):
        response = self.client.get(f"/security/alerts/{self.alert.pk}/")

        self.assertContains(response, 'id="alert-status"')
        self.assertContains(response, 'id="alert-lifecycle-panel"')
        self.assertContains(response, 'method="post"', count=4)
        self.assertContains(response, 'csrfmiddlewaretoken', count=4)
        self.assertContains(response, 'hx-post=', count=4)
        self.assertContains(response, 'hx-target="#alert-lifecycle-panel"', count=4)
        self.assertContains(response, 'hx-swap="outerHTML"', count=4)

    def test_alert_detail_reopen_hx_form_has_csrf_and_valid_target(self):
        close_alert(self.alert, actor="tester", reason="done")
        response = self.client.get(f"/security/alerts/{self.alert.pk}/")

        self.assertContains(response, 'id="alert-status"')
        self.assertContains(response, 'id="alert-lifecycle-panel"')
        self.assertContains(response, 'method="post"', count=1)
        self.assertContains(response, 'csrfmiddlewaretoken', count=1)
        self.assertContains(response, 'hx-post=')
        self.assertContains(response, 'hx-target="#alert-lifecycle-panel"')
        self.assertContains(response, 'hx-swap="outerHTML"')

    def test_pipeline_hx_forms_have_csrf_and_valid_target(self):
        response = self.client.get("/security/pipeline/")

        self.assertContains(response, 'id="pipeline-result"')
        self.assertContains(response, 'method="post"', count=4)
        self.assertContains(response, 'csrfmiddlewaretoken', count=4)
        self.assertContains(response, 'hx-post=', count=4)
        self.assertContains(response, 'hx-target="#pipeline-result"', count=4)

    def test_app_dashboard_template_is_not_self_recursive(self):
        template = get_template("security/dashboard.html")
        self.assertNotIn('{% include "security/dashboard.html" %}', template.template.source)
        app_template_source = Path("security/templates/security/dashboard.html").read_text(encoding="utf-8")
        self.assertNotIn('{% include "security/dashboard.html" %}', app_template_source)
