# Patch 15: Guided Source Setup Wizard

**Status:** Implemented
**Date:** 2026-04-27
**Version:** 0.5.0

## Overview

Patch 15 adds a guided source setup wizard to the React Configuration Studio, allowing operators to create and configure SecurityMailboxSource instances through a structured, safe workflow.

## Implementation Summary

### Backend API Endpoints

#### 1. GET /security/api/configuration/source-presets/
Returns available wizard presets for common report types.

**Response:**
```json
[
  {
    "preset_code": "watchguard_epdr",
    "title": "WatchGuard EPDR Executive Report",
    "description": "Report esecutivo settimanale...",
    "module": "watchguard",
    "recommended_origin": "mailbox",
    "default_name": "WatchGuard EPDR Executive Report",
    "code_prefix": "watchguard-epdr",
    "source_type": "mock",
    "sender_allowlist_text": "noreply@watchguard.com",
    "subject_include_text": "EPDR Executive Report",
    "attachment_extensions": "pdf",
    "max_messages_per_run": 50,
    "parser_hints": ["watchguard_epdr_parser"],
    "warning_messages": []
  }
]
```

**Available Presets:**
- WatchGuard EPDR Executive Report
- WatchGuard ThreatSync Summary
- WatchGuard Dimension / Firebox Report
- Microsoft Defender Vulnerability Notification
- NAS / Synology Active Backup
- Sorgente custom

#### 2. POST /security/api/configuration/sources/create/
Creates a new SecurityMailboxSource.

**Request:**
```json
{
  "name": "WatchGuard EPDR Report",
  "code": "watchguard-epdr-1234",
  "enabled": true,
  "source_type": "mock",
  "mailbox_address": "security@example.local",
  "description": "Weekly EPDR executive report",
  "sender_allowlist_text": "noreply@watchguard.com",
  "subject_include_text": "EPDR Executive Report",
  "subject_exclude_text": "",
  "body_include_text": "",
  "attachment_extensions": "pdf",
  "max_messages_per_run": 50,
  "mark_as_read_after_import": false,
  "process_attachments": true,
  "process_email_body": false
}
```

**Validation:**
- `name` required, unique
- `code` required, unique, slug-like (lowercase, alphanumeric, hyphens only)
- `source_type` must be one of: manual, mock, graph, imap
- `max_messages_per_run` must be between 1 and 500
- Rejects suspicious secret-like fields (password, secret, token, api_key, etc.)
- No external connections attempted

**Response:** 201 Created with source DTO

#### 3. PATCH /security/api/configuration/sources/<code>/
Updates safe editable fields for an existing source.

**Allowed Fields:**
- name, enabled, source_type, mailbox_address, description
- sender_allowlist_text, subject_include_text, subject_exclude_text, body_include_text
- attachment_extensions, max_messages_per_run
- mark_as_read_after_import, process_attachments, process_email_body

**Security:**
- Does not expose secrets in response
- Rejects suspicious secret-like fields
- Does not allow changing internal IDs

#### 4. POST /security/api/configuration/sources/<code>/toggle/
Enables or disables a source.

**Response:**
```json
{
  "enabled": true
}
```

### Frontend Components

#### SourceSetupWizard.tsx
Main wizard component with 5 steps:

**Step 1 â€” Tipo report**
- Displays preset cards for common report types
- User selects preset or custom source
- Preset selection auto-fills form with defaults

**Step 2 â€” Origine**
- Configure source name, code, type
- Mailbox address (optional)
- Description

**Step 3 â€” Riconoscimento email/report**
- Sender allowlist (one per line)
- Subject include/exclude filters
- Body include filters
- Attachment extensions
- Processing flags (attachments, email body)

**Step 4 â€” Test configurazione**
- Paste sample report text
- Reuses existing POST /security/api/configuration/test/ endpoint
- Shows parser detection, confidence, preview
- Non-blocking (can save without test)

**Step 5 â€” Review and save**
- Summary of all configuration
- Save button creates source via API
- On success, refreshes sources list and closes wizard

#### Integration
- Added "Aggiungi report da seguire" button in ConfigurationTabs sources tab
- Wizard opens as modal overlay
- On save success, calls `onRefresh()` to reload data
- Error handling with user-friendly messages

### Security

**Backend:**
- All endpoints require `CanViewSecurityCenter` permission
- CSRF protection via Django REST framework
- No secrets in responses (mailbox addresses masked)
- Validates and normalizes all user input
- Rejects suspicious secret-like fields
- No external connections attempted during creation/update

**Frontend:**
- No secrets stored in component state
- Sample test text not persisted
- Clear error messages without exposing internals
- Graceful degradation if backend unavailable

### Tests

**Backend Tests (15 tests, all passing):**
- `test_presets_endpoint_requires_auth`
- `test_presets_endpoint_returns_expected_presets`
- `test_create_source_works_with_valid_payload`
- `test_create_source_rejects_duplicate_code`
- `test_create_source_rejects_invalid_source_type`
- `test_create_source_rejects_suspicious_secret_fields`
- `test_create_source_requires_name`
- `test_create_source_requires_code`
- `test_create_source_validates_code_format`
- `test_update_source_updates_safe_fields`
- `test_update_source_does_not_expose_secrets`
- `test_update_source_rejects_suspicious_fields`
- `test_toggle_source_enables_disabled_source`
- `test_source_appears_in_list_after_creation`
- `test_test_endpoint_remains_non_persistent`

**Quality Gates:**
```bash
python manage.py check                          # âœ“ No issues
python manage.py makemigrations --check         # âœ“ No pending migrations
python manage.py test security.tests.test_api_configuration_wizard  # âœ“ 15 tests passed
cd frontend && npm run build                    # âœ“ Build successful
```

## Current Limitations

1. **No real Microsoft Graph integration** â€” Graph option shown as disabled/future
2. **No real IMAP integration** â€” IMAP option shown as disabled/future
3. **No connection testing** â€” Wizard does not attempt to connect to mailbox
4. **Manual/mock sources only** â€” Real mailbox ingestion requires future work
5. **No edit mode** â€” Wizard only supports create, not edit existing sources
6. **No bulk import** â€” One source at a time

## Future Work

1. **Connection providers:**
   - Implement Microsoft Graph mailbox connector
   - Implement IMAP mailbox connector
   - Add connection test in wizard step 4

2. **Edit mode:**
   - Open wizard in edit mode for existing sources
   - Pre-fill form with current values
   - Update instead of create

3. **Advanced features:**
   - Bulk import from CSV/JSON
   - Clone existing source
   - Import/export source configurations
   - Source templates library

4. **Validation enhancements:**
   - Real-time code uniqueness check
   - Parser detection from sample in step 1
   - Mailbox address validation
   - Regex pattern validation for filters

## Files Modified

**Backend:**
- `security/api_configuration.py` â€” Added 4 new API views
- `security/urls.py` â€” Added 4 new URL patterns
- `security/tests/test_api_configuration_wizard.py` â€” New test file (15 tests)

**Frontend:**
- `frontend/src/types/configuration.ts` â€” Added SourcePreset, CreateSourceRequest, UpdateSourceRequest
- `frontend/src/services/configurationApi.ts` â€” Added fetchSourcePresets, createSource, updateSource, toggleSource
- `frontend/src/components/configuration/SourceSetupWizard.tsx` â€” New wizard component
- `frontend/src/components/configuration/ConfigurationTabs.tsx` â€” Added wizard integration
- `frontend/src/pages/ConfigurationStudioPage.tsx` â€” Added onRefresh callback

## Usage

1. Navigate to Configuration Studio
2. Click "Sorgenti report" tab
3. Click "Aggiungi report da seguire" button
4. Select preset or custom source
5. Configure origin details
6. Set recognition filters
7. Optionally test with sample text
8. Review and save

## API Examples

**Create WatchGuard EPDR source:**
```bash
curl -X POST http://127.0.0.1:8000/security/api/configuration/sources/create/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WatchGuard EPDR Weekly",
    "code": "watchguard-epdr-weekly",
    "source_type": "mock",
    "sender_allowlist_text": "noreply@watchguard.com",
    "subject_include_text": "EPDR Executive Report",
    "attachment_extensions": "pdf",
    "process_attachments": true
  }'
```

**Update source:**
```bash
curl -X PATCH http://127.0.0.1:8000/security/api/configuration/sources/watchguard-epdr-weekly/ \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "description": "Temporarily disabled for maintenance"
  }'
```

**Toggle source:**
```bash
curl -X POST http://127.0.0.1:8000/security/api/configuration/sources/watchguard-epdr-weekly/toggle/
```

## Notes

- Wizard state is not persisted â€” closing wizard loses progress
- Test results are not saved with source configuration
- Parser hints from presets are informational only
- Source code must be unique and slug-like
- Maximum 500 messages per run enforced
- Attachment extensions normalized to lowercase, comma-separated
