from decimal import Decimal
from pathlib import Path

from django.test import TestCase

from security.models import SecurityAlert, SecurityEventRecord, SecurityReport, SecurityReportMetric, SecuritySource, SourceType
from security.parsers.base import ParsedReport
from security.parsers.registry import parser_registry
from security.parsers.watchguard import (
    parse_watchguard_dimension_executive_summary,
    parse_watchguard_epdr_executive_report,
    parse_watchguard_firebox_authentication_allowed_csv,
    parse_watchguard_firebox_authentication_denied_csv,
    parse_watchguard_interface_summary,
    parse_watchguard_threatsync_incident_list,
    parse_watchguard_threatsync_summary,
    parse_watchguard_zero_day_apt_summary,
)
from security.services.ingestion import ingest_source_file
from security.services.kpi_service import build_daily_kpi_snapshots
from security.services.parser_engine import run_pending_parsers
from security.services.rule_engine import evaluate_security_rules


FIXTURES = Path(__file__).parent / "fixtures" / "watchguard"
ALLOWED_CSV = "NovicromFW_Authentication_Allowed_2026-04-25T00_00_to_2026-04-25T23_59.csv"
DENIED_CSV = "NovicromFW_Authentication_Denied_2026-04-25T00_00_to_2026-04-25T23_59.csv"


class WatchGuardParserTests(TestCase):
    def test_firebox_authentication_allowed_csv_extracts_vpn_kpis(self):
        parsed = parse_watchguard_firebox_authentication_allowed_csv((FIXTURES / ALLOWED_CSV).read_text(), source_name=ALLOWED_CSV)

        self.assertEqual(parsed["vendor"], "watchguard")
        self.assertEqual(parsed["firebox_name"], "NovicromFW")
        self.assertEqual(len(parsed["records"]), 166)
        self.assertEqual(parsed["records"][0]["user"], "f.gentile@cnovicrom.local")
        self.assertEqual(parsed["records"][0]["source_ip"], "91.80.95.240")
        self.assertEqual(parsed["records"][0]["duration_seconds"], 1887)
        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_allowed_count"], 166)
        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_unique_users"], 2)
        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_unique_source_ips"], 2)
        self.assertGreaterEqual(parsed["metrics"]["watchguard_sslvpn_short_reconnect_count"], 20)
        self.assertTrue(any(candidate["type"] == "watchguard_vpn_many_short_reconnects" for candidate in parsed["alerts_candidates"]))

    def test_firebox_authentication_allowed_normal_fixture_does_not_alert_below_threshold(self):
        csv_text = "user,ip,login,logout,duration,quota,method\nu@example.test,203.0.113.10,2026-04-25 10:00:00,2026-04-25 10:10:00,10:00,,SSL VPN\n"
        parsed = parse_watchguard_firebox_authentication_allowed_csv(csv_text, source_name="FW_Authentication_Allowed.csv")

        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_allowed_count"], 1)
        self.assertEqual(parsed["alerts_candidates"], [])

    def test_firebox_authentication_allowed_missing_columns_does_not_crash(self):
        csv_text = "user,duration,unexpected\nu@example.test,00:10:00,ignored\n"
        parsed = parse_watchguard_firebox_authentication_allowed_csv(csv_text, source_name="FW_Authentication_Allowed.csv")

        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_allowed_count"], 1)
        self.assertEqual(parsed["records"][0]["duration_seconds"], 600)
        self.assertTrue(any("source_ip" in warning for warning in parsed["parse_warnings"]))

    def test_firebox_authentication_duration_hh_mm_ss(self):
        csv_text = "user,ip,login,duration\nu@example.test,203.0.113.10,25/04/2026 10:00:00,01:02:03\n"
        parsed = parse_watchguard_firebox_authentication_allowed_csv(csv_text, source_name="FW_Authentication_Allowed.csv")

        self.assertEqual(parsed["records"][0]["duration_seconds"], 3723)
        self.assertEqual(parsed["report_date"], "2026-04-25")

    def test_firebox_authentication_denied_csv_no_data_and_repeated_denied_alert(self):
        no_data = parse_watchguard_firebox_authentication_denied_csv((FIXTURES / DENIED_CSV).read_text(), source_name=DENIED_CSV)
        self.assertEqual(no_data["metrics"]["watchguard_sslvpn_denied_count"], 0)
        self.assertEqual(no_data["alerts_candidates"], [])

        rows = ["user,ip,login,logout,duration,quota,method"]
        rows.extend(f"u@example.test,198.51.100.8,2026-04-25 10:{i:02d}:00,,0:00,,SSL VPN" for i in range(10))
        parsed = parse_watchguard_firebox_authentication_denied_csv("\n".join(rows), source_name="FW_Authentication_Denied.csv")

        self.assertEqual(parsed["metrics"]["watchguard_sslvpn_denied_count"], 10)
        self.assertTrue(any(candidate["type"] == "watchguard_vpn_repeated_denied" for candidate in parsed["alerts_candidates"]))

    def test_dimension_executive_summary_extracts_kpis_and_botnet_warning(self):
        text = """
        WatchGuard Dimension Executive Summary
        Firebox: NovicromFW
        Period: 2026-04-25 00:00 - 2026-04-25 23:59
        Malware Attacks 7.67K scanned 0 blocked 0 detected
        Network Attacks 16.5M scanned
        IPS 6.78M scanned 0 detected 0 prevented
        Botnet Detection 3.85M scanned 2.4K detected 2.4K blocked
        """
        parsed = parse_watchguard_dimension_executive_summary(text)

        self.assertEqual(parsed["firebox_name"], "NovicromFW")
        self.assertEqual(parsed["report_date"], "2026-04-25")
        self.assertEqual(parsed["metrics"]["watchguard_malware_scanned_count"], 7670)
        self.assertEqual(parsed["metrics"]["watchguard_malware_detected_count"], 0)
        self.assertEqual(parsed["metrics"]["watchguard_network_attacks_scanned_count"], 16_500_000)
        self.assertEqual(parsed["metrics"]["watchguard_ips_scanned_count"], 6_780_000)
        self.assertEqual(parsed["metrics"]["watchguard_ips_detected_count"], 0)
        self.assertEqual(parsed["metrics"]["watchguard_ips_prevented_count"], 0)
        self.assertEqual(parsed["metrics"]["watchguard_botnet_detected_count"], 2400)
        self.assertTrue(any(candidate["type"] == "watchguard_botnet_blocked_aggregate" for candidate in parsed["alerts_candidates"]))

    def test_dimension_executive_summary_decimal_comma_and_empty_warning(self):
        parsed = parse_watchguard_dimension_executive_summary("Malware Attacks 7,67K scanned\nNetwork Attacks 16,5M scanned\nBotnet Detection 2,4K detected")
        empty = parse_watchguard_dimension_executive_summary("")

        self.assertEqual(parsed["metrics"]["watchguard_malware_scanned_count"], 7670)
        self.assertEqual(parsed["metrics"]["watchguard_network_attacks_scanned_count"], 16_500_000)
        self.assertEqual(parsed["metrics"]["watchguard_botnet_detected_count"], 2400)
        self.assertTrue(empty["parse_warnings"])

    def test_zero_day_apt_hit_rules(self):
        clean = parse_watchguard_zero_day_apt_summary("Zero-Day APT Summary\nNo content detected")
        hit = parse_watchguard_zero_day_apt_summary("Zero-Day APT Summary\nCritical hits: 2")

        self.assertEqual(clean["metrics"]["watchguard_zero_day_apt_hits"], 0)
        self.assertEqual(clean["alerts_candidates"], [])
        self.assertEqual(hit["metrics"]["watchguard_zero_day_apt_hits"], 2)
        self.assertEqual(hit["alerts_candidates"][0]["severity"], "critical")

    def test_interface_summary_extracts_network_health_alerts(self):
        text = "wan1: packet loss 5.5%, latency 140 ms, jitter 35 ms, dropped packets 12"
        parsed = parse_watchguard_interface_summary(text, source_name="FW_Interface_Summary.txt")

        self.assertEqual(parsed["metrics"]["watchguard_sdwan_loss_avg"], 5.5)
        self.assertEqual(parsed["metrics"]["watchguard_sdwan_latency_avg_ms"], 140)
        self.assertEqual(parsed["metrics"]["watchguard_sdwan_jitter_avg_ms"], 35)
        self.assertEqual(parsed["metrics"]["watchguard_dropped_packets_total"], 12)
        self.assertGreaterEqual(len(parsed["alerts_candidates"]), 4)

    def test_threatsync_low_closed_is_kpi_only_but_high_open_alerts(self):
        low_closed = parse_watchguard_threatsync_summary("ThreatSync Summary\nLow: 200\nClosed: 200\nHigh open: 0\nCritical pending: 0")
        high_open = parse_watchguard_threatsync_summary("ThreatSync Summary\nLow: 200\nClosed: 200\nHigh open: 1\nCritical pending: 1")

        self.assertEqual(low_closed["alerts_candidates"], [])
        self.assertEqual(high_open["metrics"]["watchguard_threatsync_open_high_count"], 1)
        self.assertEqual(high_open["metrics"]["watchguard_threatsync_open_critical_count"], 1)
        self.assertEqual(len(high_open["alerts_candidates"]), 2)

    def test_threatsync_incident_list_aggregates_open_severe_candidates(self):
        rows = ["incident_id,severity,status,asset,threat,timestamp"]
        rows.extend(f"{i},High,Open,host-{i},malware,2026-04-25 10:00:00" for i in range(3))
        parsed = parse_watchguard_threatsync_incident_list("\n".join(rows), source_name="ThreatSync Incidents.csv")

        severe = [candidate for candidate in parsed["alerts_candidates"] if candidate["type"] == "watchguard_threatsync_open_severe"]
        self.assertEqual(len(severe), 1)
        self.assertEqual(severe[0]["count"], 3)

    def test_epdr_unprotected_alert_and_ok_kpi_only(self):
        ok = parse_watchguard_epdr_executive_report("EPDR Executive Report\nProtected endpoints: 15\nUnprotected endpoints: 0\nPending actions: 0")
        risky = parse_watchguard_epdr_executive_report("EPDR Executive Report\nProtected endpoints: 15\nUnprotected endpoints: 2\nPending actions: 0")

        self.assertEqual(ok["alerts_candidates"], [])
        self.assertEqual(risky["metrics"]["watchguard_epdr_unprotected_endpoints"], 2)
        self.assertEqual(risky["alerts_candidates"][0]["type"], "watchguard_epdr_unprotected_endpoints")

    def test_watchguard_dedup_hash_is_stable(self):
        text = (FIXTURES / ALLOWED_CSV).read_text()
        first = parse_watchguard_firebox_authentication_allowed_csv(text, source_name=ALLOWED_CSV)
        second = parse_watchguard_firebox_authentication_allowed_csv(text, source_name=ALLOWED_CSV)

        self.assertEqual(first["normalized_hash"], second["normalized_hash"])
        self.assertEqual(first["dedup_key"], second["dedup_key"])

    def test_watchguard_dedup_hash_tolerates_whitespace_and_case(self):
        first = parse_watchguard_dimension_executive_summary("Dimension Dashboard\nBotnet Detection 2.4K detected")
        second = parse_watchguard_dimension_executive_summary(" dimension dashboard \n BOTNET   detection   2.4K   detected ")

        self.assertEqual(first["normalized_hash"], second["normalized_hash"])


class WatchGuardPipelineTests(TestCase):
    def setUp(self):
        self.source = SecuritySource.objects.create(name="WatchGuard Source", vendor="WatchGuard", source_type=SourceType.CSV)

    def test_pipeline_detects_authentication_csv_and_deduplicates_reimport(self):
        content = (FIXTURES / ALLOWED_CSV).read_text()
        ingest_source_file(self.source, ALLOWED_CSV, content, file_type=SourceType.CSV)
        ingest_source_file(self.source, ALLOWED_CSV, content, file_type=SourceType.CSV)

        self.assertEqual(run_pending_parsers(), 2)
        evaluate_security_rules()

        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_firebox_authentication_allowed").count(), 1)
        self.assertEqual(SecurityEventRecord.objects.filter(event_type="watchguard_alert_candidate").count(), 1)
        self.assertEqual(SecurityAlert.objects.count(), 1)

    def test_pipeline_detects_threatsync_epdr_dimension_from_names_and_builds_kpis(self):
        ingest_source_file(self.source, "ThreatSync Summary.txt", "ThreatSync Summary\nHigh open: 1\nCritical pending: 0", file_type=SourceType.MANUAL)
        ingest_source_file(self.source, "EPDR Executive Report.txt", "EPDR Executive Report\nUnprotected endpoints: 1\nPending actions: 0", file_type=SourceType.MANUAL)
        ingest_source_file(self.source, "Dimension Dashboard.txt", "Dimension Dashboard\nBotnet Detection 3.85M scanned 2.4K detected 2.4K blocked", file_type=SourceType.MANUAL)

        self.assertEqual(run_pending_parsers(), 3)
        evaluate_security_rules()
        created = build_daily_kpi_snapshots()

        self.assertGreater(created, 0)
        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_threatsync_summary").count(), 1)
        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_epdr_executive_report").count(), 1)
        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_dimension_executive_summary").count(), 1)
        self.assertGreaterEqual(SecurityAlert.objects.count(), 3)

    def test_pipeline_unknown_watchguard_format_records_parse_warning(self):
        ingest_source_file(self.source, "WatchGuard Unknown.txt", "WatchGuard report with an unknown layout", file_type=SourceType.MANUAL)

        run_pending_parsers()
        evaluate_security_rules()

        report = SecurityReport.objects.get()
        self.assertTrue(report.parsed_payload["parse_warnings"])
        self.assertEqual(SecurityAlert.objects.count(), 0)

    def test_pipeline_dedup_does_not_collide_between_allowed_and_denied_same_day(self):
        allowed = "user,ip,login,duration\nu@example.test,203.0.113.10,2026-04-25 10:00:00,00:10:00\n"
        denied = "user,ip,login,duration\nu@example.test,203.0.113.10,2026-04-25 10:00:00,00:00:00\n"
        ingest_source_file(self.source, "FW_Authentication_Allowed_2026-04-25.csv", allowed, file_type=SourceType.CSV)
        ingest_source_file(self.source, "FW_Authentication_Denied_2026-04-25.csv", denied, file_type=SourceType.CSV)

        run_pending_parsers()

        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_firebox_authentication_allowed").count(), 1)
        self.assertEqual(SecurityReport.objects.filter(report_type="watchguard_firebox_authentication_denied").count(), 1)

    def test_pipeline_persists_float_metrics_and_builds_snapshot(self):
        ingest_source_file(self.source, "FW_Interface_Summary_2026-04-25.txt", "wan1: packet loss 5.5%, latency 10 ms", file_type=SourceType.MANUAL)

        run_pending_parsers()
        report = SecurityReport.objects.get()
        metric = SecurityReportMetric.objects.get(report=report, name="watchguard_sdwan_loss_avg")
        build_daily_kpi_snapshots(report.report_date)

        self.assertEqual(metric.value, 5.5)

    def test_pipeline_persists_decimal_metrics_from_parser_registry(self):
        class DecimalMetricParser:
            name = "test_decimal_metric_parser"

            def can_parse(self, item):
                return getattr(item, "original_name", "") == "decimal.metric"

            def parse(self, item):
                return ParsedReport("test_decimal_metric", item.original_name, self.name, [], {"test_decimal_metric": Decimal("1.25")}, {"report_date": "2026-04-25"})

        parser_registry.register(DecimalMetricParser())
        source = SecuritySource.objects.create(name="Decimal Source", vendor="Decimal", source_type=SourceType.MANUAL)
        ingest_source_file(source, "decimal.metric", "decimal", file_type=SourceType.MANUAL)

        run_pending_parsers()

        self.assertEqual(SecurityReportMetric.objects.get(name="test_decimal_metric").value, 1.25)
