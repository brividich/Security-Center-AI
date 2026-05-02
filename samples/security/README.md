# Security Samples

This directory contains sanitized security report samples for development and testing.

## Directory Structure

- `samples/security/` - Manual sanitized samples
- `samples/security/auto/` - Auto-generated sanitized samples (gitignored)
- `security_raw_inbox/` - Local quarantine for raw reports (gitignored, never commit)

## DEV SAFE Workflow

### Quick Start (VS Code)

1. Drop raw reports into `security_raw_inbox/`
2. Press `Ctrl+Shift+P`
3. Select `Tasks: Run Task`
4. Select `Claude Safe`

This will:
- Sanitize all raw reports
- Generate safe samples in `samples/security/auto/`
- Start Claude Code with safe environment

### Manual Command

```powershell
.\scripts\claude_safe.ps1
```

Or sanitize only:

```powershell
python scripts\devsafe_sync.py
```

### Custom Replacements

```powershell
python scripts\devsafe_sync.py --replace "ACME Corp=Example Company" --replace "10.0.1.5=192.0.2.10"
```

## Rules for AI Agents

AI coding agents working on this repository:

- ✅ **MAY** use `samples/security/` and `tests/fixtures/` for report examples
- ✅ **MAY** use `samples/security/auto/` for auto-generated sanitized samples
- ❌ **MUST NOT** read `security_raw_inbox/`
- ❌ **MUST NOT** read `reports/`, `uploads/`, `attachments/`, `inbox/`, `mailbox/`, `logs/`, `media/`
- ❌ **MUST NOT** read `.env`, `config.ini`, `credentials`, `tokens`, or real customer/security data
- ❌ **MUST NOT** add real report data to tests, docs, or fixtures

## Sanitization Rules

The sanitization workflow applies these redactions:

- Email addresses → `userN@example.local`
- IPv4 addresses → RFC 5737 addresses (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`)
- UUIDs → `00000000-0000-0000-0000-000000000000`
- API keys/tokens → `token-redacted` or `sk-redacted`
- URLs → `https://example.com/redacted`
- Internal domains → `example.local`
- Hostnames → `EXAMPLE-HOST-N`

## Supported File Types

- `.txt` - Text files
- `.csv` - CSV reports
- `.log` - Log files
- `.eml` - Email messages
- `.json` - JSON data

PDFs and binary files are not supported.

## If Generated Samples Still Contain Real Data

If a generated sample appears to contain real identifiers:

1. Stop using the file
2. Report the file path to the development team
3. Do not repeat the sensitive value
4. Add custom `--replace` rules if needed

## Development Notes

Real reports must be sanitized before use with AI coding agents.

The `security_raw_inbox/` folder is for local development only and must never be committed to version control.
