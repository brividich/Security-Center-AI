# Security Center AI - Start Here

Security Center AI is a report intelligence portal for small and mid-sized IT operations. It ingests recurring security, vulnerability, firewall, and backup reports, extracts structured metrics and findings, evaluates configurable rules, creates alerts and Evidence Containers, and opens remediation tickets when configured.

## Report Intelligence vs SIEM

Security Center AI is not a SIEM. A SIEM collects high-volume logs and events in near real time, correlates them across many sources, and supports deep search over raw telemetry. Security Center AI focuses on operational reports, notification emails, CSV exports, and PDF summaries that IT teams already receive. It turns those periodic inputs into a dashboard, alert workflow, and remediation queue.

## MVP Scope

The current MVP includes WatchGuard report parsers, a Microsoft Defender vulnerability notification parser, Synology Active Backup email parsing, DB-backed source/parser/rule configuration, Evidence Containers, remediation ticketing, alert lifecycle actions, suppression and muting, backup monitoring expectations, an admin configuration panel at `/security/admin/config/`, and diagnostics at `/security/admin/diagnostics/`.

## Not Included Yet

The portal does not yet provide full SIEM ingestion, raw log search, endpoint response actions, multi-tenant isolation, external ticket system synchronization, advanced notification delivery, custom report designers, or automatic remediation. Network/API collection should be treated as future addon work unless already implemented by a source-specific parser.

## First Setup Checklist

1. Sign in with a staff user or a user with the `manage_security_configuration` permission.
2. Run `python manage.py seed_security_center_config` to create default sources, parsers, rules, and notification placeholders.
3. Open `/security/admin/config/` and review Sources, Parsers, Alert Rules, Suppressions, Backup Monitoring, Notifications, Ticketing, and Audit Log.
4. Confirm only trusted sources and parsers are enabled.
5. Configure backup expected jobs for protected devices and NAS workloads.
6. Configure notification channels using secret references, not raw webhook or password values in docs or logs.
7. Open `/security/admin/diagnostics/` and resolve warnings before relying on automated alerting.
8. Upload or ingest one known-good WatchGuard, Defender, and backup sample.
9. Run the parser, rule, and KPI pipeline from `/security/pipeline/`.
10. Review alerts, Evidence Containers, and tickets.

## First 30 Minutes

Start with the dashboard and critical alerts. Confirm that recently ingested reports show a parser name and parse status. Open any critical Defender CVE ticket and verify the CVE, CVSS score, affected product, exposed device count, evidence, and recurrence count. Review WatchGuard metrics for authentication denials, blocked threats, SD-WAN health, Zero-Day APT, EPDR, and ThreatSync incidents. Check Backup Health for failed, missing, long-running, or abnormal-size jobs. Finish by opening diagnostics and the audit log to confirm configuration is healthy and changes are traceable.

## Core Workflow

Report/email/upload -> Ingestion -> Parser Engine -> Metrics/Findings -> Rule Engine -> Alert/Suppression -> Evidence Container -> Ticket -> Dashboard/Admin.

