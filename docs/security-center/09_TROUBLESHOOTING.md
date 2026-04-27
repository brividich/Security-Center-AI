# Troubleshooting

## Report Uploaded but No Parser Matched

Check source configuration, parser name, parser enabled state, file type, sender/subject patterns, and diagnostics. Confirm the parser exists in the registry.

## Parser Disabled

Open `/security/admin/config/parsers/`, enable the parser, confirm priority and source type, then rerun the parser pipeline.

## Source Disabled

Open `/security/admin/config/sources/`, enable the source, confirm matching rules, then retry ingestion.

## Alert Not Created

Check rule enabled state, metric name, threshold, severity, cooldown, dedup window, event decision trace, and whether the event is KPI-only.

## Alert Suppressed

Review suppression rules, event payload conditions, expiration, owner, and hit count. Remove or narrow broad suppressions.

## Ticket Not Created

Check alert rule `auto_create_ticket`, ticketing configuration, severity logic, deduplication, and whether an existing ticket was updated instead.

## Duplicate Ticket Created

Review dedup hash, affected product normalization, CVE list aggregation, open ticket statuses, and recurrence handling.

## Defender CVE Not Parsed

Confirm the email body contains a recognizable CVE, CVSS or severity, affected product, and exposed device count. Check parser warnings and source matching.

## WatchGuard CSV Malformed

Confirm the CSV export retains expected WatchGuard headers, delimiter, encoding, and date columns. Re-export from Firebox/Dimension when in doubt.

## Backup Missing Not Detected

Check expected job name, device/NAS fields, enabled state, expected days, `missing_after_hours`, `alert_on_missing`, last seen backup status, and system time zone.

## Notification Not Sent

Check channel enabled state, severity minimum, event type toggles, cooldown, recipient fields, and secret references. Diagnostics should not print raw secrets.

## Seed Config Missing

Run `python manage.py seed_security_center_config`, then open diagnostics. If defaults still do not appear, check migrations and command output.

## Permission Denied on Admin Pages

Use a staff account or grant `manage_security_configuration`. Unauthenticated users are redirected to the admin login.

