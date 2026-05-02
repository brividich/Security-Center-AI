# Developer Guide

Security Center AI parser and addon work should preserve deterministic, testable behavior.

## Parser Purity

Parsers should be pure functions over provided content and metadata. They must not call the ORM, perform network calls, mutate global state, or depend on current database contents.

## Output Structure

Parser output should include report identity, report type, period or report date, metrics, findings, alert candidates, source metadata, and `parse_warnings`. Use structured dictionaries and stable names.

## Metrics, Findings, and Alert Candidates

Metrics are numeric facts for rules and dashboards. Findings are domain facts such as CVEs, backup job records, or security incidents. Alert candidates are parser-provided hints that the rule engine may evaluate or enrich.

## Parse Warnings

Use `parse_warnings` when input is incomplete, malformed, ambiguous, or parsed with reduced confidence. Warnings should be concise and safe to show in the UI.

## Prohibited Parser Behavior

Do not use ORM calls in parsers. Do not make network calls in parsers. Do not log full raw report or email bodies. Do not expose secrets. Do not silently treat malformed critical fields as healthy.

## Tests

Add fixtures for representative inputs and tests for parser selection, successful parsing, warning behavior, malformed input, metrics, findings, alert candidates, rule triggering, suppression behavior, Evidence Container creation, and ticket deduplication.

## Seed Config

Add seed configuration for new sources, parsers, rules, notification placeholders, ticketing defaults, and backup expectations when the addon needs them. Seed commands must be idempotent.

## Alert Rules

Rules should be named, scoped, thresholded, deduplicated, and tested. Prefer clear metric names and decision traces that explain why an alert was or was not created.

## Dashboard Visibility

Expose important addon metrics through existing dashboards, KPI snapshots, or source-specific panels. Do not add noisy panels without operational action.

## React/Vite Integration

The separate React/Vite frontend should call compact read-only Django endpoints under `/security/api/` using `VITE_API_BASE_URL`, which defaults to `http://127.0.0.1:8000`. API clients must tolerate the backend being offline and fall back to local mock data without crashing the UI.

Keep payloads explicit and small. Do not serialize full model objects, raw diagnostic input, mailbox bodies, file contents, credentials, secrets, or evidence payload internals.

## Module Workspaces

Patch 15A adds React module navigation for `/modules`, `/modules/watchguard`, `/modules/microsoft-defender`, `/modules/backup-nas`, and `/modules/custom`.

Module workspaces are frontend aggregation views over existing configuration APIs. They group sources and rules by safe keyword matching, infer an operational status, and keep Configuration Studio as the source editing surface.

Each workspace uses these tabs: Overview, Sorgenti, Report, KPI, Alert, Regole, Diagnostica. Until dedicated module alert/report/KPI APIs exist, detail tabs must clearly label placeholder content as `Dati demo` or `Placeholder`.

Do not add Microsoft Graph, IMAP, external calls, secrets, tenant IDs, real hostnames, or real report data when extending module workspaces. Future integrations should add small read-only APIs with sanitized summaries rather than exposing raw evidence or mailbox payloads.

## Security Inbox and Mailbox Ingestion

### Security Inbox Workbench

The SSR workbench at `/security/inbox/` lets authorized Security Center users paste a report body or upload a sample report for manual ingestion before mailbox automation is enabled. Supported upload extensions are `.pdf`, `.csv`, `.txt`, `.eml`, and `.log`, with a conservative 10 MB limit.

### Shared Pipeline Service

The module `security/services/security_inbox_pipeline.py` provides unified processing for both manual Inbox Workbench submissions and automated Mailbox Ingestion imports.

**Key functions:**

- `process_mailbox_message(message, *, source=None, run=None, dry_run=False)` - Process imported email body
- `process_source_file(source_file, *, message=None, source=None, run=None, dry_run=False)` - Process imported attachment
- `process_text_payload(text, *, subject, sender, source, dry_run)` - Process raw text (creates transient SecurityMailboxMessage)
- `process_security_input(item, *, source, run, dry_run)` - Unified dispatcher by item type

**Pipeline flow:**

1. Check if item already processed (skip if `parse_status != pending`)
2. Match enabled parser
3. Run parser on item
4. Evaluate security rules
5. Generate KPI snapshots
6. Create alerts/evidence/tickets
7. Update item `parse_status`
8. Return result counters

### Mailbox Ingestion

Automated import from configured mailbox sources via `python manage.py ingest_security_mailbox`; for local polling use `python manage.py ingest_security_mailbox --loop --interval 120`.

**Processing behavior:**

- Email body processed if `process_email_body=True`
- Attachments processed if `process_attachments=True`
- Each imported item goes through shared pipeline
- Deduplication prevents duplicate imports
- Reprocessing safety prevents duplicate pipeline execution
- `--force-reprocess` flag overrides safety for testing

**Reprocessing rules:**

- Items with `parse_status=parsed` are skipped automatically
- Items with `parse_status=pending` are processed
- Items with `parse_status=failed` can be retried
- Dry-run never modifies `parse_status`

See `docs/security-center/MAILBOX_INGESTION.md` for complete documentation.

## Mailbox Ingestion

Patch 12 introduces scheduled mailbox ingestion via `SecurityMailboxSource` and `SecurityMailboxIngestionRun`. The system supports provider abstraction (Mock, Graph, IMAP) with deduplication, filtering, and transparent integration with the existing parser/rule pipeline. See [MAILBOX_INGESTION.md](MAILBOX_INGESTION.md) for configuration, scheduling, and troubleshooting details.

Inbox submissions reuse existing `SecurityMailboxMessage` and `SecuritySourceFile` storage plus the normal parser and rule pipeline. Results appear in the Last result panel and recent report/message tables. The UI must show only short sanitized snippets and must not echo full raw bodies, file contents, diagnostic input, secrets, tokens, mailbox payloads, or evidence payload internals.

## Configuration Studio Source Wizard

Patch 15B adds a guided source setup wizard to the React Configuration Studio. Operators can create and update `SecurityMailboxSource` instances through a 5-step workflow:

1. **Tipo report** - Select from presets (WatchGuard, Defender, Synology, custom)
2. **Origine** - Configure name, code, source type, mailbox address
3. **Riconoscimento** - Set sender allowlist, subject filters, attachment extensions
4. **Test** - Paste sample text to verify parser detection (optional)
5. **Riepilogo** - Review and save

**Backend API:**
- `GET /security/api/configuration/source-presets/` - Available presets
- `POST /security/api/configuration/sources/create/` - Create source
- `PATCH /security/api/configuration/sources/<code>/` - Update source
- `POST /security/api/configuration/sources/<code>/toggle/` - Enable/disable

**Security:**
- All endpoints require `CanViewSecurityCenter` permission
- Code must be unique, slug-like (lowercase, alphanumeric, hyphens)
- Rejects suspicious secret-like fields (password, secret, token, api_key)
- No external connections attempted during creation
- Mailbox addresses masked in responses

**Features:**
- ✅ Create new sources from presets
- ✅ Edit existing sources (skips preset step)
- ✅ Toggle source enabled/disabled
- ✅ Live parser detection test
- ✅ Form validation
- ✅ Tailwind CSS styling

**Current limitations:**
- Microsoft Graph ingestion is implemented for backend-configured mailbox sources; IMAP remains disabled/future
- No connection testing in wizard
- Graph credentials must stay in server environment variables and never in frontend payloads

See [PATCH_15B_SOURCE_WIZARD.md](patch-history/PATCH_15B_SOURCE_WIZARD.md) in patch history for complete implementation notes.
