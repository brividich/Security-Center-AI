# Patch 15B: Guided Source Setup Wizard

**Status:** âœ… Implemented
**Date:** 2026-04-27
**Version:** 0.5.0

## Overview

Patch 15B implements a guided source setup wizard that allows operators to create and update SecurityMailboxSource records through the React Configuration Studio in a safe, structured way.

## Implementation Summary

### Backend API Endpoints

All endpoints implemented in `security/api_configuration.py`:

#### 1. GET /security/api/configuration/source-presets/

Returns wizard presets for common report types.

**Response:** Array of preset objects with:
- `preset_code`: Unique preset identifier
- `title`: Display name
- `description`: Preset description
- `module`: Module category (watchguard, defender, backup, custom)
- `recommended_origin`: Suggested origin type
- `default_name`: Default source name
- `code_prefix`: Code prefix for auto-generation
- `source_type`: Default source type
- Filter defaults (sender_allowlist_text, subject_include_text, etc.)
- Processing flags (process_attachments, process_email_body, etc.)
- `parser_hints`: Expected parser names
- `warning_messages`: Configuration warnings

**Available Presets:**
- `watchguard_epdr`: WatchGuard EPDR Executive Report
- `watchguard_threatsync`: WatchGuard ThreatSync Summary
- `watchguard_dimension`: WatchGuard Dimension / Firebox Report
- `defender_vulnerability`: Microsoft Defender Vulnerability Notification
- `synology_backup`: NAS / Synology Active Backup
- `custom`: Custom report source

#### 2. POST /security/api/configuration/sources/create/

Creates a new SecurityMailboxSource.

**Request Body:**
```json
{
  "preset_code": "watchguard_epdr",
  "name": "WatchGuard EPDR Executive Report",
  "code": "watchguard-epdr-1234567890",
  "enabled": true,
  "source_type": "mock",
  "mailbox_address": "reports@example.local",
  "description": "Weekly executive report",
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
- `name` required
- `code` required, must be slug-like (lowercase, alphanumeric, hyphens)
- `code` must be unique
- `source_type` must be one of: manual, mock, graph, imap
- `max_messages_per_run` must be 1-500
- `attachment_extensions` normalized to lowercase
- Rejects suspicious secret-like fields (password, secret, token, api_key, client_secret, private_key, bearer)

**Response:** Created source DTO (201 Created)

#### 3. PATCH /security/api/configuration/sources/<code>/

Updates safe editable fields only.

**Allowed Fields:**
- name, enabled, source_type, mailbox_address, description
- sender_allowlist_text, subject_include_text, subject_exclude_text, body_include_text
- attachment_extensions, max_messages_per_run
- mark_as_read_after_import, process_attachments, process_email_body

**Not Allowed:**
- id, code (immutable after creation)
- Internal timestamps, run counters

**Response:** Updated source DTO (200 OK)

#### 4. POST /security/api/configuration/sources/<code>/toggle/

Toggles source enabled/disabled state.

**Response:**
```json
{
  "enabled": true
}
```

### Frontend Components

#### SourceSetupWizard Component

**Location:** `frontend/src/components/configuration/SourceSetupWizard.tsx`

**Features:**
- 5-step wizard flow
- Preset selection with cards
- Form validation
- Live test configuration
- Edit mode support
- Tailwind CSS styling

**Wizard Steps:**

1. **Tipo report** (Preset Selection)
   - Grid of preset cards
   - Module badges
   - Auto-fills defaults on selection

2. **Origine** (Origin Configuration)
   - Source name and code
   - Source type selection (manual, mock, graph-future, imap-future)
   - Mailbox address (optional)
   - Description

3. **Riconoscimento** (Email/Report Recognition)
   - Sender allowlist (one per line)
   - Subject include/exclude filters
   - Body include filters
   - Attachment extensions
   - Processing flags (attachments, email body)

4. **Test** (Configuration Test)
   - Paste sample text
   - Live parser detection
   - Confidence score
   - Alert/evidence/ticket preview
   - Warnings display

5. **Riepilogo** (Review)
   - Summary of all settings
   - Save button

#### SourceCard Updates

**Location:** `frontend/src/components/configuration/SourceCard.tsx`

**Changes:**
- Added `onEdit` prop
- Enabled "Configura" button
- Calls edit handler on click

#### ConfigurationTabs Updates

**Location:** `frontend/src/components/configuration/ConfigurationTabs.tsx`

**Changes:**
- Added `editingSource` state
- Added `handleEditSource` handler
- Passes `onEdit` to SourceCard
- Passes `editingSource` to wizard

### API Client Updates

**Location:** `frontend/src/services/configurationApi.ts`

**New Functions:**
- `fetchSourcePresets()`: Fetches preset list
- `createSource(request)`: Creates new source
- `updateSource(code, request)`: Updates existing source
- `toggleSource(code)`: Toggles source enabled state

### Type Definitions

**Location:** `frontend/src/types/configuration.ts`

**New Types:**
- `SourcePreset`: Preset configuration
- `CreateSourceRequest`: Source creation payload
- `UpdateSourceRequest`: Source update payload

## Security Features

### Secret Detection

Backend rejects payloads containing suspicious keys:
- password
- secret
- token
- api_key
- client_secret
- private_key
- bearer

### No External Connections

- No Microsoft Graph connection
- No IMAP connection
- No real mailbox credential storage
- Test endpoint remains non-persistent

### Validation

- Code format validation (slug-like)
- Unique code enforcement
- Source type whitelist
- Max messages bounds (1-500)
- Extension normalization

## Testing

### Backend Tests

**Location:** `security/tests/test_api_configuration_wizard.py`

**Coverage:**
- âœ… Presets endpoint requires auth
- âœ… Presets endpoint returns expected presets
- âœ… Create source works with valid payload
- âœ… Create source rejects duplicate code
- âœ… Create source rejects invalid source_type
- âœ… Create source rejects suspicious secret fields
- âœ… Create source requires name
- âœ… Create source requires code
- âœ… Create source validates code format
- âœ… Update source updates safe fields
- âœ… Update source does not expose secrets
- âœ… Update source rejects suspicious fields
- âœ… Toggle source enables/disables
- âœ… Source appears in list after creation
- âœ… Test endpoint remains non-persistent

**Test Results:** All 15 tests passing

### Frontend Build

**Status:** âœ… Passing
**Bundle Size:** 589.80 kB (165.96 kB gzipped)

## Quality Gates

```bash
# Backend checks
python manage.py check                                    # âœ… No issues
python manage.py test security.tests.test_api_configuration_wizard  # âœ… 15/15 passing
python manage.py makemigrations --check --dry-run        # âœ… No pending migrations

# Frontend build
cd frontend && npm run build                              # âœ… Build successful
```

## Current Limitations

### Not Implemented (Future Work)

1. **Microsoft Graph Connection**
   - No OAuth flow
   - No mailbox credential storage
   - No real mailbox polling

2. **IMAP Connection**
   - No IMAP authentication
   - No IMAP mailbox polling

3. **Full CRUD**
   - No generic full CRUD for all models
   - Only controlled create/update/toggle for SecurityMailboxSource

4. **Advanced Features**
   - No bulk operations
   - No source cloning
   - No import/export

### Known Issues

None identified.

## Usage Example

### Creating a New Source

1. Open Configuration Studio
2. Navigate to "Sorgenti report" tab
3. Click "+ Aggiungi report da seguire"
4. Select preset (e.g., "WatchGuard EPDR Executive Report")
5. Configure origin (name, code, mailbox)
6. Set recognition filters (sender, subject, attachments)
7. Test with sample text (optional)
8. Review and save

### Editing an Existing Source

1. Open Configuration Studio
2. Navigate to "Sorgenti report" tab
3. Find source card
4. Click "Configura" button
5. Wizard opens in edit mode (skips preset step)
6. Modify fields as needed
7. Review and save

## API Examples

### Fetch Presets

```bash
curl -X GET http://127.0.0.1:8000/security/api/configuration/source-presets/ \
  -H "Cookie: sessionid=..." \
  -H "Content-Type: application/json"
```

### Create Source

```bash
curl -X POST http://127.0.0.1:8000/security/api/configuration/sources/create/ \
  -H "Cookie: sessionid=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Source",
    "code": "test-source-123",
    "source_type": "mock",
    "enabled": true
  }'
```

### Update Source

```bash
curl -X PATCH http://127.0.0.1:8000/security/api/configuration/sources/test-source-123/ \
  -H "Cookie: sessionid=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Source",
    "enabled": false
  }'
```

### Toggle Source

```bash
curl -X POST http://127.0.0.1:8000/security/api/configuration/sources/test-source-123/toggle/ \
  -H "Cookie: sessionid=..." \
  -H "Content-Type: application/json"
```

## Files Modified

### Backend
- `security/api_configuration.py` (already implemented)
- `security/urls.py` (already configured)
- `security/tests/test_api_configuration_wizard.py` (already implemented)

### Frontend
- `frontend/src/components/configuration/SourceSetupWizard.tsx` (updated styling, edit mode)
- `frontend/src/components/configuration/SourceCard.tsx` (enabled edit button)
- `frontend/src/components/configuration/ConfigurationTabs.tsx` (edit handler)
- `frontend/src/services/configurationApi.ts` (already implemented)
- `frontend/src/types/configuration.ts` (already implemented)

### Documentation
- `docs/security-center/PATCH_15B_SOURCE_WIZARD.md` (this file)

## Next Steps

### Immediate
- âœ… Backend API implemented
- âœ… Frontend wizard implemented
- âœ… Tests passing
- âœ… Documentation complete

### Future Enhancements
- Microsoft Graph integration
- IMAP integration
- Source cloning
- Bulk operations
- Import/export configuration
- Advanced validation rules
- Parser auto-detection improvements

## References

- [CONFIGURATION_STUDIO_API.md](./CONFIGURATION_STUDIO_API.md)
- [PATCH_13.5_CONFIGURATION_STUDIO.md](./PATCH_13.5_CONFIGURATION_STUDIO.md)
- [PATCH_14_CONFIGURATION_API.md](./PATCH_14_CONFIGURATION_API.md)
- [10_DEVELOPER_GUIDE.md](./10_DEVELOPER_GUIDE.md)
