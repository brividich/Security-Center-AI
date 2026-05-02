# Changelog

## [0.7.2] - 2026-05-02

### Added
- Added safe report retry/reprocess operations for mailbox inputs, source files, and reports with linked inputs.
- Added bulk retry from the React report workbench for up to 25 visible failed, pending, or skipped items.
- Added safe report management DTOs with parser timeline, dedup status, metric previews, event summaries, alert summaries, and linked alert, ticket, and evidence previews.

### Changed
- Updated the React report management page into an operational workbench with grouping, filtering, selected report detail, retry feedback, and source/parser/rule tuning links.
- Updated current project and frontend package metadata to version `0.7.2`.

### Fixed
- Stabilized `security.tests` on Windows by using repo-local temporary directories for React serving tests and process-local Git `safe.directory` for Windows package static checks.
- Realigned Windows installer/service documentation strings expected by the static deployment tests.

### Security
- Retry and bulk retry responses expose only safe counters and status fields; raw report bodies, file content, parsed payload details, and parser exception text are not returned.
- No real tenant IDs, credentials, mailbox contents, hostnames, IPs, or operational reports were added.

### Validation
- `python manage.py check` - OK
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `python manage.py test security.tests.test_inbox_workbench security.tests.test_react_backend_api` - OK, 18 tests
- `python manage.py test security.tests` - OK, 279 tests
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `git diff --check` for changed files - OK, with CRLF warnings only
- Secret pattern scan of changed files - no actionable findings; test passwords and CSRF token lookup are expected placeholders
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.7.1] - 2026-04-30

### Changed
- Reworked the React frontend into one operator-facing Control Center for KPI distribution, source configuration, incoming data monitoring, and report management.
- Reimagined report management around live report queues, parser/source/status filters, selected report details, pipeline state, and internal action tracking.
- Removed visible React links and shortcuts that pushed operators into the older Django/admin UI paths.
- Updated source wizard presets and validation so new configurable sources use live `manual`, `graph`, or `imap` origins instead of `mock`.
- Updated current project and frontend package metadata to version `0.7.1`.

### Fixed
- Removed frontend demo/mock fallback datasets and replaced them with explicit empty and error states backed by real API responses.
- Added latest ingestion run status, timestamps, and safe error text to source DTOs so Graph and mailbox sync status can be monitored from the React UI.

### Security
- No real tenant IDs, credentials, mailbox contents, hostnames, IPs, or operational reports were added.
- Graph secrets remain write-only in the UI and server-side in backend settings.

### Validation
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `python manage.py check` - OK
- `python manage.py test security.tests.test_react_backend_api security.tests.test_api_configuration security.tests.test_api_configuration_wizard` - OK
- `git diff --check` for staged files - OK
- `gitleaks detect --source . --no-git --verbose` - not run because a broad local scan would inspect files/directories excluded by the repository data-handling rules

## [0.6.2] - 2026-04-30

### Added
- Added Microsoft Graph credential management directly in the React UI with server-side secret storage.
- Added backend Graph settings API status fields for saved/missing credentials, mail folder, save permission, and last update time.
- Added support for resolving custom Microsoft Graph mailbox folders by display name, including folders such as `SECURITY`.

### Changed
- Graph mailbox ingestion now prefers UI-saved server settings over `.env` placeholders.
- The Microsoft Graph page now confirms saved settings with a backend refresh and shows explicit permission diagnostics when the current user cannot save configuration.
- Updated current project and frontend package metadata to version `0.6.2`.

### Fixed
- Fixed Graph credential save failures caused by missing CSRF cookies when using the React app.
- Fixed opaque API errors by including safe backend error details in the React configuration API client.

### Security
- Client secrets remain write-only in the UI and are stored as secret Django settings.
- Graph setting responses expose only configured/missing status, never tenant values, client IDs, or client secrets.
- Tests use placeholder tenant IDs and `token-redacted`; no real tenant, mailbox contents, credentials, hostnames, IPs, or operational data were added.

### Validation
- `python manage.py test security.tests.test_api_configuration_wizard security.tests.test_mailbox_ingestion security.tests.test_react_django_serving` - OK, 50 tests
- `npm run build` from `frontend/` - OK, with existing Vite chunk-size warning
- `python manage.py check` - OK
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `git diff --check` for changed files - OK, with CRLF warnings only
- Secret pattern scan of changed-file diff - no actionable findings; false positives were inspected in Graph code/tests
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.6.1] - 2026-04-30

### Added
- Implemented Microsoft Graph mailbox ingestion for `SecurityMailboxSource` records with `source_type=graph`.
- Added client credentials token acquisition and Graph mailbox message retrieval with optional file attachment import.
- Added `POST /security/api/configuration/sources/<code>/ingest/` to trigger configured source ingestion from the configuration API.
- Added a React Microsoft Graph page action to run ingestion for configured Graph sources.

### Changed
- Configuration API source origins now report Microsoft Graph sources as `graph` instead of `graph_future`.
- Updated current project and frontend package metadata to version `0.6.1`.

### Security
- Kept Graph credentials server-side through environment variables only.
- Added no real tenant IDs, credentials, mailbox contents, hostnames, IPs, or operational report data.
- Graph provider tests use mocked HTTP responses and placeholder values only.

### Validation
- `python manage.py test security.tests.test_mailbox_ingestion security.tests.test_api_configuration_wizard` - OK
- `python manage.py test security.tests` - OK, 258 tests
- `python manage.py check` - OK
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `npm run build` from `frontend/` - OK, with existing Vite chunk-size warning
- `git diff --check` for changed files - OK, with CRLF warnings only
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.5.17] - 2026-04-30

### Changed
- Reworked the React frontend navigation into grouped Control Center, Operativita, and Analisi sections so Configuration Studio is a first-level operational entry point.
- Added React header shortcuts to Configuration Studio, Django inbox, and Django admin configuration.
- Routed the React Regole page to the live Configuration Studio rules tab instead of the placeholder rule builder.
- Linked Configuration Studio source cards to backend toggle actions and Django inbox/documentation pages.
- Added timeouts and visible fallback/error states for Configuration Studio and Module workspace API loading so pages do not remain indefinitely on loading messages when Django is unavailable.
- Added a React backend status control with retry and local Vite development restart support for `restart_server.bat`.
- Added Vite development proxies for Django `/api`, `/security`, `/admin`, and `/static` paths so the React dev UI can be used from one origin on `127.0.0.1:5173`.
- Refined the React shell and Configuration Studio UI to keep navigation compact, explicit, and operator-focused while preserving visible management entry points.
- Updated current project and frontend package metadata to version `0.5.17`.

### Security
- Kept source examples and UI copy synthetic; no secrets, credentials, tenant data, hostnames, IPs, or operational reports were added.

### Validation
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `python manage.py check` - OK
- `python manage.py test security.tests.test_windows_test_package` - OK, rerun with process-local `safe.directory` because Git rejected this checkout ownership
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `git diff --check` for changed files - OK, with CRLF warnings only
- Secret pattern scan of changed-file diff - no actionable findings; CSRF cookie lookup false positive only

## [0.5.16] - 2026-04-29

### Changed
- Reworked the Windows installer flow into a classic Inno Setup wizard for guided TEST installation.
- Removed the operator-facing PowerShell first-run wizard and replaced it with a hidden installer bootstrap that logs to `runtime\installer-setup.log`.
- Expanded installer setup logging with script output, step traces, stack traces, and a Notepad prompt when final setup fails.
- Fixed installer bootstrap argument splatting so values with spaces, such as `ODBC Driver 18 for SQL Server`, are passed correctly.
- Added local SQL Server instance discovery via Windows services and registry when the configured local SQL host is unreachable.
- Fixed Windows setup command execution so native command stderr warnings, such as pip cache warnings, are logged without failing the setup when the exit code is zero.
- Added targeted cleanup for old generated Windows installer packages and EXE outputs while preserving the selected current version.
- Updated current project and frontend package metadata to version `0.5.16`.

### Security
- Kept `.env`, runtime setup JSON, databases, logs, raw inbox data, generated EXE/ZIP files, and local service wrapper binaries excluded from packages and version control.
- Avoided putting SQL passwords on the installer command line.
- Masked SQL password and common secret fields before writing installer setup logs.

### Validation
- `python manage.py test security.tests.test_windows_test_package` - OK
- `python manage.py check` - OK
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- PowerShell parser checks for changed Windows cleanup and installer bootstrap scripts - OK
- `git diff --check` - OK, with CRLF warnings only
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean_generated_artifacts.ps1 -OldInstallerVersionsOnly -KeepVersion 0.5.16` - OK, old installer artifacts removed except locked `SecurityCenterAI-Setup-0.5.14.exe`
- Secret pattern scan of changed files - no actionable findings; package-lock registry URL false positive only
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed
- Inno Setup build - not run, `ISCC.exe` not found in PATH

## [0.5.15] - 2026-04-29

### Changed
- Added Patch 20A repository hygiene and deployment artifact cleanup policy.
- Consolidated patch-specific historical documentation under `docs/security-center/patch-history/`.
- Updated ignore rules for local build outputs, installer outputs, runtime files, generated frontend artifacts, local service wrapper binaries, and local database/log artifacts.
- Added `scripts/windows/clean_generated_artifacts.ps1` for conservative local cleanup with dry-run support and explicit opt-in flags for sensitive or expensive removals.
- Updated current project and frontend package metadata to version `0.5.15`.

### Security
- Removed generated `dist/` package and installer outputs from Git tracking while preserving local files.
- Kept `.env`, databases, logs, raw inbox data, generated EXE/ZIP files, WinSW/NSSM binaries, and generated WinSW XML excluded from version control.
- Documented how to use local WinSW/NSSM binaries without committing them.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - OK, 253 tests
- `python manage.py test` - OK, 253 tests
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version 0.5.15 -Force` - OK, created `dist\SecurityCenterAI-Test-0.5.15`, with existing Vite chunk-size warning

## [0.5.14] - 2026-04-29

### Changed
- Updated the Inno Setup Desktop shortcut task so the Desktop shortcut is selected by default.
- Clarified WinSW filename handling for package and installer builds: verified WinSW binaries must be provided as `tools/windows/winsw.exe`.
- Added a first-run TEST wizard launched from the installer post-install step and Start Menu.
- Added native Inno Setup wizard pages for SQL Server configuration, authentication, and TEST setup options.
- Added an installer setup runner that applies the Inno wizard choices without putting the SQL password on the PowerShell command line.
- Updated installer setup shortcuts to use the frontend already bundled in the package instead of requiring Node/npm on the test PC.
- Added automatic elevation for the first-run and setup scripts when running from `Program Files`.
- Updated current project and frontend package metadata to version `0.5.14`.

### Fixed
- Fixed installer behavior where the Desktop shortcut was not created unless the optional task was manually selected.
- Added a clear package warning when `tools/windows/WinSW-x64.exe` exists but the expected `tools/windows/winsw.exe` filename is missing.
- Fixed the Windows TEST setup flow so `-SkipFrontendBuild` does not require Node/npm when `frontend/dist` is already included.
- Fixed first-run setup failures when `.env` had to be created under `C:\Program Files\Security Center AI`.
- Fixed the installer guided setup runner so successful PowerShell scripts are not treated as failed because of a stale or empty `$LASTEXITCODE`.
- Moved the primary operator choices into the installer wizard instead of requiring operators to start with a separate script.

### Security
- Continued to exclude arbitrary local `.exe` files from packages while allowing only explicit wrapper filenames.
- No secrets, credentials, tokens, API keys, webhook URLs, or generated `.env` values were added.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - OK, 248 tests
- `python manage.py test` - OK, 248 tests
- `python manage.py makemigrations --check --dry-run` - OK, no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- PowerShell parse checks for changed Windows deployment scripts - OK
- `python manage.py test security.tests.test_windows_test_package` - OK, 21 tests
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version 0.5.14 -Force` - OK, created `dist\SecurityCenterAI-Test-0.5.14`, included `scripts\windows\first_run_wizard.ps1`, `scripts\windows\run_inno_guided_setup.ps1`, and `tools\windows\winsw.exe`, with existing Vite chunk-size warning
- Inno Setup build - OK, created `dist\installer-guided\SecurityCenterAI-Setup-0.5.14.exe` with native SQL/setup wizard pages

## [0.5.13] - 2026-04-29

### Added
- Added WinSW as the preferred Windows service wrapper for LAN TEST deployments.
- Added dynamic WinSW XML generation for the `SecurityCenterAI` Waitress service.
- Added WinSW-aware package and installer validation while keeping NSSM as fallback.

### Changed
- Updated Windows service install flow to search for WinSW before NSSM.
- Updated Windows service uninstall flow to support WinSW, NSSM, and `sc.exe delete` fallback.
- Updated package filtering so only approved wrapper filenames are copied and arbitrary local `.exe` files under `tools/windows` are excluded.
- Updated Windows deployment documentation to describe WinSW preference, NSSM fallback, wrapper placement, no automatic downloads, and service logs.
- Updated current project and frontend package metadata to version `0.5.13`.

### Security
- Kept WinSW and NSSM binaries out of git unless explicitly provided by the operator.
- Kept generated `tools/windows/SecurityCenterAI.xml` ignored and excluded from packages.
- Avoided embedding `.env`, `DB_PASSWORD`, `SECRET_KEY`, tokens, API keys, or webhook URLs in service wrapper configuration.

### Validation
- `PowerShell Parser::ParseFile` for `install_service.ps1`, `uninstall_service.ps1`, `setup_test_deployment.ps1`, `package_test_deployment.ps1`, and `build_installer.ps1` - OK
- `python manage.py test security.tests.test_windows_test_package` - 17 passed
- `python manage.py check` - OK
- `python manage.py test security` - 244 passed
- `python manage.py test` - 244 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version latest -Force` - OK, created `dist\SecurityCenterAI-Test-0.5.13`, with existing Vite chunk-size warning and missing-wrapper warnings
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_installer.ps1 -Version latest` - OK, created `dist\installer\SecurityCenterAI-Setup-0.5.13.exe`, with missing-wrapper warning
- `git diff --check` - OK, with CRLF normalization warnings from Git
- Changed-file secret pattern scan - no matches
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.5.12] - 2026-04-29

### Added
- Added guided SQL Server `.env` configuration for Windows TEST deployments.
- Added SQL Server instance connectivity and database existence checks, with optional explicit database creation.
- Added a guarded `drop_test_database.ps1` cleanup script for test/UAT database removal.
- Added Start Menu shortcuts for SQL Server configuration, full TEST setup, and full TEST setup with service installation.

### Changed
- Integrated guided SQL Server configuration into `setup_test_deployment.ps1`.
- Updated Windows installer uninstall behavior to attempt `SecurityCenterAI` service cleanup.
- Updated Windows deployment documentation with the Italian operator flow, explicit database creation behavior, uninstall retention, and database cleanup procedure.
- Updated current project and frontend package metadata to version `0.5.12`.

### Fixed
- Made missing SQL Server database handling explicit so setup stops before migrations when the database is unavailable and creation was not approved.

### Security
- Preserved manual `.env` support while masking SQL password and Django secret output.
- Documented that standard uninstall intentionally keeps SQL Server databases to avoid data loss.
- Kept database deletion as a separate typed-confirmation script and blocked non-TEST/UAT database names by default.

### Validation
- `PowerShell Parser::ParseFile` for `configure_sqlserver_env.ps1`, `setup_test_deployment.ps1`, `drop_test_database.ps1`, `install_service.ps1`, `uninstall_service.ps1`, `package_test_deployment.ps1`, and `build_installer.ps1` - OK
- `python manage.py test security.tests.test_windows_test_package` - 17 passed
- `python manage.py check` - OK
- `python manage.py test security` - 244 passed
- `python manage.py test` - 244 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `git diff --check` - OK, with CRLF normalization warnings from Git
- Changed-file secret pattern scan - no matches
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version latest -Force` - OK, created `dist\SecurityCenterAI-Test-0.5.12`, with existing Vite chunk-size warning and missing-NSSM warning
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_installer.ps1 -Version latest` - OK, created `dist\installer\SecurityCenterAI-Setup-0.5.12.exe`, with missing-NSSM warning

## [0.5.11] - 2026-04-28

### Added
- Added optional bundled NSSM support for Windows TEST packages via `tools\windows\nssm.exe`.
- Added operator documentation for NSSM source, verification, licensing responsibility, and the no automatic download policy.
- Added static validation coverage for NSSM package inclusion, missing-NSSM warnings, service installer lookup order, setup preflight checks, and documentation requirements.

### Changed
- Updated the package builder to include local `tools\windows\nssm.exe` when present and continue with a clear warning when missing.
- Updated the installer build flow and Inno Setup source to make bundled NSSM behavior explicit when the package contains it.
- Updated current project and frontend package metadata to version `0.5.11`.

### Fixed
- Tightened missing-NSSM service setup errors so operators are directed to copy `nssm.exe` into `tools\windows\nssm.exe` or install it in the `PATH`.

### Security
- Kept `tools/windows/nssm.exe` as an optional local file ignored by git and avoided adding third-party binaries to the repository.

### Validation
- `python manage.py test security.tests.test_windows_test_package` - 14 passed
- `python manage.py check` - OK
- `python manage.py test security` - 241 passed
- `python manage.py test` - 241 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `PowerShell Parser::ParseFile scripts/windows/package_test_deployment.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/build_installer.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/install_service.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/setup_test_deployment.ps1` - OK
- `npm run build` from `frontend` - OK, with existing Vite chunk-size warning
- `git diff --check` - OK, with CRLF normalization warnings from Git
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.5.10] - 2026-04-28

### Added
- Added Patch 19E Windows service deployment support using Waitress for LAN test installations.
- Added NSSM-based Windows service scripts for install, uninstall, start, stop, restart, status, and TCP 8000 firewall opening.
- Added Italian operator documentation for the Windows service deployment workflow, Waitress runtime, logs, and troubleshooting.
- Added static validation coverage for service scripts, service installer shortcuts, Waitress documentation, admin requirements, SQL Server prerequisites, and secret-safe script output.

### Changed
- Updated `setup_test_deployment.ps1` with optional `-InstallService` support to install and start the Windows service after environment preparation.
- Updated Windows installer Start Menu shortcuts to expose service operations and kept the Desktop shortcut limited to opening the web app.
- Updated current project and frontend package metadata to version `0.5.10`.

### Security
- Kept `.env`, `.venv`, `node_modules`, local databases, logs, raw inbox data, and secret-like files excluded from the packaged installer workflow while documenting the separate NSSM prerequisite.

### Validation
- `PowerShell Parser::ParseFile scripts/windows/setup_test_deployment.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/package_test_deployment.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/install_service.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/uninstall_service.ps1` - OK
- `PowerShell Parser::ParseFile scripts/windows/open_firewall_8000.ps1` - OK
- `python manage.py test security.tests.test_windows_test_package` - 11 passed
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\package_test_deployment.ps1 -Version 0.5.10 -Force` - OK
- `powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_installer.ps1 -Version 0.5.10` - OK
- `python manage.py check` - OK
- `python manage.py test security` - 238 passed
- `python manage.py test` - 238 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.5.9] - 2026-04-28

### Added
- Added Patch 19D Inno Setup installer script for Windows LAN TEST deployment packages.
- Added `scripts/windows/build_installer.ps1` to locate `ISCC.exe`, verify or create the filtered test package, and write the installer under `dist/installer/`.
- Added Italian operator documentation for building, installing, configuring, starting, accessing, and uninstalling the Windows installer EXE.
- Added static validation tests for installer files, shortcuts, safety exclusions, SQL Server TEST documentation, and LAN-only warnings.

### Changed
- Updated current project and frontend package metadata to version `0.5.9`.
- Updated Windows TEST package documentation to point to the installer EXE workflow.

### Security
- Documented and validated that installer packaging remains based on the filtered test package and excludes `.env`, `.venv`, `node_modules`, local databases, logs, uploads, raw inbox data, generated runtime data, and secret-like file extensions.

### Validation
- `PowerShell Parser::ParseFile scripts/windows/build_installer.ps1` - OK
- `python manage.py check` - OK
- `python manage.py test security` - 235 passed
- `python manage.py test` - 235 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `gitleaks detect --source . --no-git --verbose` - not run, `gitleaks` not installed

## [0.5.8] - 2026-04-28

### Added
- Added Patch 19C Windows LAN test deployment packaging scripts for setup, start, stop, restart, browser open, and distributable package creation.
- Added Italian operator documentation for SQL Server TEST deployment, LAN access, firewall setup, demo seed, smoke checks, and troubleshooting.
- Added static validation tests for Windows package scripts, packaging exclusions, and deployment documentation safety topics.

### Changed
- Updated current project and frontend package metadata to version `0.5.8`.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 231 passed
- `python manage.py test` - 231 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning

## [0.5.7] - 2026-04-28

### Added
- Added Patch 19A support for serving the React production build from Django at `/`, `/app/`, and selected SPA routes.
- Added explicit Django asset serving for Vite files under `frontend/dist/assets`.
- Added a friendly Italian missing-build fallback with the `npm --prefix frontend run build` command.
- Added `scripts/windows/build_frontend_for_django.ps1` for Windows test deployment builds.
- Added Italian local test deployment documentation and backend tests for React route serving, missing-build behavior, route non-hijacking, and secret exposure checks.

### Changed
- Updated React production API default to same-origin while preserving the Vite dev default backend URL.
- Updated current project and frontend package metadata to version `0.5.7`.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 227 passed
- `python manage.py test` - 227 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning
- `scripts/windows/build_frontend_for_django.ps1` - OK, with existing Vite chunk-size warning

## [0.5.6] - 2026-04-28

### Added
- Added Patch 19B SQL Server test deployment profile with safe environment example, database diagnostics command, Windows helper script, operator documentation, and non-SQL-Server-dependent tests.

### Changed
- Updated current project and frontend package metadata to version `0.5.6`.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 223 passed
- `python manage.py test` - 223 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning

## [0.5.5] - 2026-04-28

### Changed
- Updated current project and frontend package metadata to version `0.5.5`.
- Recorded Patch 18 frontend Italian localization sweep as a patch release.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 220 passed
- `python manage.py test` - 220 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning

## [0.5.4] - 2026-04-28

### Added
- Added Patch 17 synthetic UAT/demo pack with resettable mailbox sources, synthetic mailbox messages, ingestion runs, and compact pipeline summaries.
- Added `seed_security_uat_demo` and `security_uat_smoke_check` management commands for operator validation without external calls.
- Added Italian UAT operator checklist and local testing quickstart documentation.
- Added UAT demo pack tests for idempotency, reset safety, smoke checks, synthetic markings, secret scanning, and API summary safety.

### Changed
- Updated project and frontend package metadata to version `0.5.4`.

### Validation
- `python manage.py check` - OK
- `python manage.py test security` - 220 passed
- `python manage.py test` - 220 passed
- `python manage.py makemigrations --check --dry-run` - no changes detected
- `npm --prefix frontend run build` - OK, with existing Vite chunk-size warning

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
