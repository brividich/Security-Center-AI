# Patch 15A - Module Workspace Navigation

Patch 15A adds frontend module workspaces to the React Configuration Studio experience.

## Purpose

Operators can now navigate by operational security domain instead of only by configuration category:

- WatchGuard
- Microsoft Defender
- Backup / NAS
- Sorgenti custom

The existing Configuration Studio remains intact and is still the place to add or edit sources, rules, notifications and suppressions.

## Routes and Page Keys

The React app supports these module routes:

- `/modules`
- `/modules/watchguard`
- `/modules/microsoft-defender`
- `/modules/backup-nas`
- `/modules/custom`

Equivalent page keys:

- `modules`
- `module-watchguard`
- `module-microsoft-defender`
- `module-backup-nas`
- `module-custom`

## Workspace Tabs

Every module workspace uses the same tab layout:

- Overview
- Sorgenti
- Report
- KPI
- Alert
- Regole
- Diagnostica

The overview is tailored per module. WatchGuard shows coverage for EPDR, ThreatSync and Dimension / Firebox. Defender highlights CVSS, exposed devices and ticket deduplication rules. Backup / NAS includes a simple backup health placeholder. Custom sources show guidance for sanitized parser testing.

## Data Source Behavior

Patch 15A is frontend-first. It reuses existing configuration APIs:

- `GET /security/api/configuration/sources/`
- `GET /security/api/configuration/rules/`
- `GET /security/api/configuration/notifications/`
- `GET /security/api/configuration/suppressions/`

Frontend aggregation groups sources and rules by module keywords and infers module status from configured sources, latest source result, warnings and placeholder alert state.

Alert, report and detailed KPI APIs filtered by module do not exist yet. Those areas use safe local placeholders marked as `Dati demo` or `Placeholder`. No Microsoft Graph, IMAP or external calls are introduced.

## Current Limitations

- Open alert counts in module cards are placeholder/demo until a module-filtered alert API exists.
- Report history tabs combine source last-import data with demo report placeholders.
- Backup health calendar is a placeholder.
- Defender device exposure and CVE rollups are placeholders and do not call Microsoft Graph.
- Custom parser validation still belongs in Configuration Studio test flows using sanitized examples only.

## Future API Needs

Useful future read-only endpoints:

- Module-filtered alerts with status and severity.
- Module-filtered reports/runs with parser status.
- Module KPI rollups by vendor/source type.
- Backup expected-run health data.
- Defender vulnerability rollups from sanitized stored reports, not direct Graph calls unless explicitly implemented in a later patch.
