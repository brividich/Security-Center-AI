# Admin Guide

Use `/security/admin/config/` to control the operational behavior of Security Center AI. Access requires staff status or the `manage_security_configuration` permission.

## Sources

Sources describe where reports come from and how they should be matched. Email sources use sender and subject patterns. File and manual sources identify uploaded PDFs or CSVs. Disable a source to stop it from participating in automatic ingestion and parser selection.

## Parsers

Parser configuration controls whether a parser is available, its priority, input type, source type, and parser-specific JSON settings. If a parser is disabled, matching input is skipped rather than parsed.

## Alert Rules

Alert rules convert metrics and findings into operational alerts. Rules include source type, metric name, operator, threshold, severity, cooldown, deduplication window, Evidence Container behavior, and ticket behavior.

## Suppressions

Suppression rules prevent known noisy or accepted events from creating active alerts. Keep suppressions scoped by source, event type, severity, payload condition, owner, reason, and expiration. Review them weekly.

## Backup Expectations

Backup expected jobs define which jobs should appear, when they are expected, whether missing backups should alert, and duration or transferred-size limits. These settings power Backup Health and missing backup detection.

## Notifications

Notification channels describe how new alerts, tickets, and SLA concerns should be announced. Store secrets as secret references or masked fields. Do not paste raw webhook URLs or credentials into documentation, parser logs, or diagnostics.

## Ticketing

Ticketing controls aggregation strategy, default assignment, status mapping, auto-close behavior, recurrence behavior, and severity SLAs. Defender remediation tickets are deduplicated and aggregated by product/CVE logic where configured.

## Audit Log

The audit log records configuration creates and updates, actor, model, field, old value, new value, request IP, and user agent. Secret values must remain redacted.

## Diagnostics

Use `/security/admin/diagnostics/` after seed, configuration changes, parser changes, notification changes, and before relying on a new addon. Diagnostics should be part of every operational handoff.

