# AGENTS.md

Repository instructions for AI coding agents working on Security Center AI.

These rules are intended for Codex, Claude Code, and similar coding assistants.
Treat this repository as potentially connected to real operational security workflows.

## Prime directive

- Work only on the task explicitly requested.
- Prefer small, reviewable patches over broad rewrites.
- Never introduce real secrets, real credentials, real tenant data, real hostnames, real IPs, real employee data, or real customer data.
- Use placeholders and fake fixtures only.
- If a task appears to require sensitive data, stop and request a sanitized example instead.

## Security boundary

Do not read, print, summarize, modify, commit, or use these files or directories:

- `.env`
- `.env.*`
- `config.ini`
- `secrets.json`
- `credentials.json`
- `token.json`
- `*.key`
- `*.pem`
- `*.pfx`
- `*.p12`
- `*.cer`
- `*.crt`
- `*.sqlite3`
- `*.db`
- `*.bak`
- `*.dump`
- `*.log`
- `logs/`
- `media/`
- `uploads/`
- `attachments/`
- `reports/`
- `mailbox/`
- `inbox/`
- `.venv/`
- `node_modules/`
- `dist/`
- `build/`

If one of these files is needed for context, ask for a redacted excerpt instead.

## DEV SAFE automatic sanitization workflow

Security Center AI includes an automatic sanitization workflow to prevent accidental exposure of real security data to AI agents.

### Rules for AI agents

- Do not read `security_raw_inbox/` (local quarantine, contains raw unsanitized data)
- Do not read raw reports, uploads, mailbox exports, attachments, logs, or operational data
- Use only `samples/security/`, `samples/security/auto/`, and `tests/fixtures/` for report examples
- If a report example is needed, ask the user to run `scripts/claude_safe.ps1` or `scripts/devsafe_sync.py`
- Never add real report data to tests, docs, or fixtures
- If a generated sample still appears to contain real identifiers, stop and report the file path without repeating the sensitive value

### Workflow for developers

Instead of launching `claude` directly:

```powershell
.\scripts\claude_safe.ps1
```

This automatically:
1. Sanitizes raw reports from `security_raw_inbox/`
2. Generates safe samples in `samples/security/auto/`
3. Starts Claude Code with safety reminders

### What gets sanitized

- Email addresses → `userN@example.local`
- IPv4 addresses → RFC 5737 addresses
- UUIDs → `00000000-0000-0000-0000-000000000000`
- API keys/tokens → `sk-redacted`, `token-redacted`
- URLs → `https://example.com/redacted`
- Internal domains → `example.local`
- Hostnames → `EXAMPLE-HOST-N`

See `samples/security/README.md` for complete workflow documentation.

## Data handling rules

Always use fake values in code, tests, docs, examples, and fixtures.

Use patterns like:

- Company: `Example Company`
- Domain: `example.local` or `example.com`
- Email: `user1@example.local`
- Hostname: `EXAMPLE-HOST`
- Firewall: `ExampleFW`
- Tenant ID: `00000000-0000-0000-0000-000000000000`
- API key: `sk-redacted`
- IP address: `192.0.2.10`, `198.51.100.10`, or `203.0.113.10`

Never add real:

- API keys
- passwords
- connection strings
- SMTP credentials
- OAuth client secrets
- Microsoft tenant IDs
- internal domain names
- public IPs
- private IPs from the real network
- employee names
- mailbox addresses
- security report contents
- firewall/VPN logs
- Defender/WatchGuard/NAS reports

## Project context

Security Center AI is a Django-based security report intelligence platform.

Primary goal:

- Ingest security reports and alert emails.
- Parse vendor-specific reports.
- Store KPI snapshots and evidence.
- Generate deduplicated operational alerts.
- Support remediation workflows and tickets.
- Reduce noise through aggregation, baseline comparison, and suppression rules.

Initial domains:

- WatchGuard EPDR / ThreatSync / Dimension / Firebox
- Microsoft Defender vulnerability notifications
- NAS / Synology Active Backup monitoring
- Future Microsoft 365 / Graph integrations

Frontend direction:

- Django remains the operational backend and source of truth.
- React/Vite frontend should become a clear Configuration Studio / Control Center.
- UI must answer:
  - what is monitored
  - which rules generate alerts
  - where notifications go
  - what is muted/suppressed
  - what is broken or misconfigured

## Expected architecture style

- Keep parser logic isolated by vendor/source.
- Keep rule evaluation separate from parsing.
- Keep alert lifecycle logic separate from UI views.
- Keep ticket/remediation logic deduplicated and idempotent.
- Keep diagnostics explicit and admin-readable.
- Preserve evidence even when alerts are suppressed.
- Prefer service functions with tests over logic embedded in views.

## Django conventions

- Do not bypass Django authentication or permission checks.
- Protected pages must require login/admin access where appropriate.
- POST actions must be CSRF-protected.
- Avoid raw SQL unless already established and justified.
- If raw SQL is required, use parameterized values and whitelisted identifiers.
- Avoid query-in-loop patterns; use `select_related`, `prefetch_related`, or bulk operations where useful.
- Do not create migrations unless model changes require them.
- If migrations are added, they must be deterministic and reviewable.
- Templates live under `security/templates/security/`.
- Shared partials live under `security/templates/security/partials/`.
- Static assets live under `security/static/security/`.
- Security UI should extend `security/base.html` unless there is a strong reason not to.
- Use existing CSS classes before adding new ones.
- Admin/security pages should remain staff/permission protected according to existing views/decorators.
- Keep Italian visible UI labels unless a task explicitly asks otherwise.
- When translating labels, preserve canonical English compatibility text where existing tests expect it.
- Prefer defensive templates that tolerate missing context variables.

## React / Vite conventions

- Keep the frontend separate from Django unless the task explicitly asks for integration.
- Prefer typed TypeScript interfaces.
- Avoid hardcoded real company data.
- Mock data must be fake and clearly synthetic.
- Configuration UI should be simple, guided, and operationally clear.
- Do not expose secrets in frontend code, mock data, local storage, screenshots, or docs.
- The frontend, if present, lives under `frontend/`.
- Do not couple the React/Vite app tightly to Django internals unless requested.
- Backend URL defaults to `http://127.0.0.1:8000/security/`.
- Vite URL defaults to `http://127.0.0.1:5173/`.
- Startup scripts must handle missing Node/npm gracefully.

## Parser / Security Intelligence Rules

- Parser outputs should be structured, deterministic, and deduplicatable.
- Avoid noisy alert creation.
- Alerts should focus on high/critical findings, anomalous volume, asset concentration, pending/in-progress incidents, missing backups, failed backups, critical CVEs, and CVSS >= 9.0 with exposed devices.
- Low-volume/low-severity events should usually become KPI/report data, not individual alerts.
- Evidence containers must preserve enough context for auditability.
- Remediation tickets must deduplicate recurring Defender/CVE findings when an open/in-progress ticket already exists.

## UI Compatibility Rules

- Existing smoke tests are part of the public contract.
- Do not rename or remove templates used by views.
- If visible labels are localized, preserve hidden canonical English labels using `title`, `aria-label`, or visually hidden text.
- HTMX partials must keep stable wrapper IDs where tests expect them.
- Pipeline result partial must be safe when no previous run exists.
- Diagnostics pages must not re-render submitted diagnostic body content.

## Startup Scripts Rules

- Scripts must work from the repository root.
- Scripts must support paths containing spaces.
- Scripts must not require administrator privileges.
- Developer startup must prefer `127.0.0.1` over `0.0.0.0`.
- `.env.example` may contain safe local development defaults only.
- Never overwrite an existing `.env` without explicit user instruction.

## Tests and quality gates

Before calling a patch complete, recommend or run the relevant checks:

```powershell
python manage.py check
python manage.py test security.tests
python manage.py test
python manage.py makemigrations --check --dry-run
```

For frontend changes:

```powershell
cd frontend
npm run build
```

If Node/npm are unavailable, state that clearly and still perform static review.

## Secret scanning

Before committing or finalizing a patch, inspect the diff for secrets:

```powershell
git diff
```

If available, also run:

```powershell
gitleaks detect --source . --no-git --verbose
```

If a potential secret is found:

- stop
- do not repeat the secret
- replace it with a placeholder
- tell the user which file and line class needs review

## Patch behavior

When implementing a change:

- Identify the smallest set of files needed.
- Avoid touching unrelated formatting.
- Avoid broad refactors unless explicitly requested.
- Preserve existing behavior unless the task says otherwise.
- Add or update tests for changed behavior.
- Update docs only when the behavior or workflow changes.
- Report files changed and commands executed.

## Forbidden actions

Do not:

- exfiltrate or print secrets
- inspect ignored sensitive files
- commit generated artifacts unless requested
- add real operational data to tests
- weaken authentication or authorization
- disable CSRF protection
- silence errors without logging
- remove tests to make a patch pass
- change production settings to make local development easier
- hardcode local paths from one machine into app code

## Versioning and Changelog Rules

- Every meaningful patch must consider whether a version bump is needed.
- Codex/agents must not bump the version automatically unless the user explicitly confirms the bump level.
- Agents must propose `patch`, `minor`, or `major` according to change size.
- Patch bump example: `0.1.1` -> `0.1.2`.
- Minor bump example: `0.1.13` -> `0.2.1`.
- For pre-`1.0` releases, minor bumps reset patch to `1`, not `0`.
- Major bumps and any move to `1.0.0` require explicit user approval.
- Every confirmed versioned update must update `CHANGELOG.md`, `README.md`, version metadata if present, and relevant docs under `docs/security-center/` if behavior changed.
- Do not include speculative claims in version notes or changelog entries.

When a meaningful patch is ready and a version bump may apply, agents must ask exactly:

```text
Version bump confirmation required.
Proposed bump: <patch|minor|major>
Current version: <current-version-or-unknown>
Proposed version: <proposed-version-or-needs-user-input>
Reason: <short factual reason>

Please confirm the bump level to apply: patch, minor, major, or none.
```

`CHANGELOG.md` requirements for confirmed versioned updates:

- Keep entries practical, factual, and grouped by version.
- Include the release date when known.
- Use these sections when applicable: `Added`, `Changed`, `Fixed`, `Security`, and `Validation`.
- `Validation` must list the validation commands run and their results.
- Do not invent changes, dates, compatibility guarantees, or validation results.

`README.md` requirements for confirmed versioned updates:

- Keep the current version/status visible and accurate.
- Update operational notes when behavior, setup, startup, validation, or user-facing workflows change.

## Expected Agent Response Format

When an agent finishes, it should summarize:

- Files changed
- Behavior changed
- Validation commands run and result
- Migrations status
- Any commands not run and why

Do not include speculative claims.

## If uncertain

Prefer safety and ask for a sanitized sample.

For implementation choices, prefer:

- explicit over implicit
- fake fixtures over real data
- idempotent services over one-off scripts
- small patches over large rewrites
- readable diagnostics over silent failures
