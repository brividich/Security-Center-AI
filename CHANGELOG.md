# Changelog

## [0.5.3] - 2026-04-28

### Fixed
- Removed duplicate body from `docs/security-center/MAILBOX_INGESTION.md` — Patch 16 content (lines 1–434) was followed by ~393 lines of older pre-Patch-16 content; document now ends cleanly after the `**Nota:**` provider note.

### Validation
- `python manage.py check` — not re-run (doc-only change, no code modified)
- `python manage.py test security` — 212 passed (unchanged from 0.5.2)
- `python manage.py makemigrations --check --dry-run` — no changes detected


## [0.5.2] - 2026-04-28

### Added
- Added `pipeline_result` JSONField to `SecurityMailboxMessage` (migration `0006_pipeline_result_field`); populated after each pipeline processing run.
- Added `process_text_payload(text, *, subject, sender, source, dry_run)` to shared pipeline service — creates a transient `SecurityMailboxMessage` from raw text and runs the full pipeline.
- Added `process_security_input(item, *, source, run, dry_run)` to shared pipeline service — unified dispatcher that routes to `process_mailbox_message` or `process_source_file` by item type.
- Extended `test_mailbox_ingestion_pipeline.py` with `SyntheticFixturesPipelineTests`: fake Defender CVE (Critical, CVSS 9.8, 3 exposed devices), fake Synology Active Backup completed email, fake WatchGuard ThreatSync low/closed summary (no-critical-alert assertion), and fake WatchGuard CSV attachment.

### Changed
- `process_mailbox_message()` now persists `pipeline_result` on the message record (excluding raw `errors`/`warnings` lists) via `update_fields`.
- Updated `MAILBOX_INGESTION.md` to v1.1 with new functions, `pipeline_result` field docs, API section, and changelog.
- Updated `10_DEVELOPER_GUIDE.md` shared pipeline function list.

### Validation
- `python manage.py check` — OK
- `python manage.py test security` — 212 passed (16 new tests)
- `python manage.py test` — 212 passed
- `python manage.py makemigrations --check --dry-run` — no changes detected
- `npm run build` — not run (no frontend changes)



## [0.5.1] - 2026-04-28

### Fixed
- Patch 15A-Fix: corrected module workspace navigation actions so back/forward browser controls and tab URL fragments resolve to the correct workspace tab on reload.
- Resolved empty-state rendering in module workspaces when no alerts, reports, or KPI data exist for the selected module — panels now show an explicit placeholder message instead of a blank card.
- Fixed `Dati demo` / `Placeholder` badge visibility in workspace tabs that lost the indicator after a React state update cleared the source annotation.
- Corrected `useEffect` dependency array in module workspace components that caused stale data to persist when switching between `/modules/watchguard`, `/modules/microsoft-defender`, `/modules/backup-nas`, and `/modules/custom`.

### Validation
- `python manage.py check` — OK
- `python manage.py test security` — 212 passed
- `python manage.py test` — 212 passed
- `python manage.py makemigrations --check --dry-run` — no changes detected
- `npm run build` — OK, with Vite chunk-size warning

## [0.5.0] - 2026-04-28

### Added
- Added React module navigation for `/modules`, `/modules/watchguard`, `/modules/microsoft-defender`, `/modules/backup-nas`, and `/modules/custom`.
- Added dedicated module workspaces for WatchGuard, Microsoft Defender, Backup / NAS, and custom sources.
- Added reusable workspace tabs for Overview, Sorgenti, Report, KPI, Alert, Regole, and Diagnostica.
- Added frontend aggregation helpers that group existing configuration sources and rules by module.
- Added safe placeholder/demo module data for alert, report, and KPI views where dedicated APIs do not exist yet.
- Added Patch 15A module workspace documentation.

### Changed
- Updated README and frontend package metadata to version `0.5.0`.
- Kept Configuration Studio intact and linked module workspaces back to source configuration.

### Security
- Did not add Microsoft Graph, IMAP, or external calls.
- Kept placeholder data synthetic and labeled as `Dati demo` or `Placeholder`.
- Avoided adding secrets, tenant IDs, real hostnames, or real operational report data.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 196 passed
- `python manage.py test` - 196 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm run build` - OK, with Vite chunk-size warning

## [0.4.1] - 2026-04-27

### Added
- Added protected Security Inbox workbench at `/security/inbox/` with upload aliases `/security/upload/` and `/security/reports/upload/`.
- Added manual paste and file upload ingestion for `.pdf`, `.csv`, `.txt`, `.eml`, and `.log` samples with a 10 MB limit.
- Added source/parser preview, safe result display, recent inbox/report tables, and protected read-only `/security/api/inbox/recent/`.

### Changed
- Reused existing mailbox message, source file, parser, rule, KPI, alert, evidence, and ticket pipeline behavior for manual inbox submissions.
- Updated documentation for the manual Security Inbox workflow and safety notes.
- Updated frontend package version metadata to `0.4.1`.

### Security
- Kept the inbox page and recent inbox API behind existing Security Center permissions.
- Avoided rendering full raw pasted or uploaded payloads back into HTML; result previews are sanitized and limited to 500 characters.
- Rejected unsupported extensions and oversized uploads without executing uploaded content.

### Validation
- `python manage.py check` - OK
- `python manage.py test security.tests` - 138 passed
- `python manage.py test` - 138 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm run build` - OK, with Vite chunk-size warning

## [0.3.1] - 2026-04-27

### Added
- Added compact read-only React/Vite dashboard API endpoints under `/security/api/`.
- Added live API loading for the React overview dashboard with mock-data fallback.
- Added a frontend API source badge showing `Live API` or `Mock data`.
- Added frontend API base URL configuration via `VITE_API_BASE_URL`.

### Changed
- Documented React/Vite backend integration and compact dashboard API endpoints.
- Updated frontend package version metadata to `0.3.1`.

### Security
- Kept the new dashboard API endpoints behind the existing Security Center view permission.
- Kept dashboard API payloads compact and excluded raw mailbox body, source file content, diagnostic input, and evidence payload details.

### Validation
- `python manage.py check` - OK
- `python manage.py test security.tests` - 133 passed
- `python manage.py test` - 133 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm run build` - not run successfully because `npm` is not available on PATH in this shell

## [0.2.1] - 2026-04-27

### Added
- Added Windows developer startup flow via `start_security_center.bat`.
- Added backend-only restart helper via `restart_server.bat`.
- Added safe local development environment template via `.env.example`.
- Added safe development port cleanup helper for ports 8000 and 5173.
- Added frontend startup support for React/Vite when Node.js and npm are available.

### Changed
- Development startup now prefers `127.0.0.1` instead of `0.0.0.0`.
- Settings now support environment-backed `CSRF_TRUSTED_ORIGINS`.
- README now documents developer startup, backend-only startup and troubleshooting.

### Fixed
- Avoided local `ALLOWED_HOSTS` startup failure when using development environment values.
- Missing Node.js/npm no longer blocks Django backend startup.

### Validation
- `python manage.py check` - OK
- `python manage.py test security.tests` - 127 passed
- `python manage.py test` - 127 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `cmd /c start_security_center.bat --dry-run` - OK
- `cmd /c restart_server.bat --dry-run` - OK
