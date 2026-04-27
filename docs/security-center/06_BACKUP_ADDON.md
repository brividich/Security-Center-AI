# Backup/NAS Addon

The Backup/NAS addon monitors backup notification emails and expected backup jobs. The current source is Synology Active Backup email.

## Synology Active Backup Email Source

Configure a source for trusted Synology Active Backup senders and subjects. The parser extracts job name, status, start and completion times, protected items, duration, transferred size when available, and source metadata.

## Expected Jobs

Expected jobs are configured in `/security/admin/config/backups/`. Define job name, device name, NAS name, enabled state, critical asset flag, expected days, expected start window, maximum duration, minimum or maximum transferred size, missing-after hours, and alert toggles.

## Missing Backup Logic

Missing backup detection compares expected jobs with the last seen successful or reported run. If an enabled expected job has not appeared within `missing_after_hours`, the system creates a missing backup candidate and can alert when `alert_on_missing` is enabled.

## Failure, Duration, and Size Rules

Rules can alert on failed jobs, missing jobs, duration anomalies, and transferred-size anomalies. Critical assets should use stricter thresholds and faster review.

## Backup Health Interpretation

Backup Health is healthy when expected jobs arrive on time, complete successfully, run within duration thresholds, and transfer plausible data volumes. A healthy dashboard does not replace restore testing; it confirms report intelligence and job freshness.

