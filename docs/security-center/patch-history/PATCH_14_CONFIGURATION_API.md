# Patch 14: Configuration Studio Backend API

**Date:** 2026-04-27
**Type:** Feature - Read-only API
**Status:** Completed

## Summary

Implemented read-only backend API endpoints for the React Configuration Studio, enabling the frontend to consume real backend data instead of only mock data.

## Changes

### Backend API (`security/api_configuration.py`)

Added 6 new API endpoints under `/security/api/configuration/`:

1. **GET /overview/** - Summary counts for dashboard
2. **GET /sources/** - Source cards with latest run counters
3. **GET /rules/** - Alert rule overview (DB rules + conceptual/planned rules)
4. **GET /notifications/** - Notification channel configuration
5. **GET /suppressions/** - Active suppression rules
6. **POST /test/** - Safe simulated configuration test (non-persistent)

### Security & Masking

- Email addresses masked: `security@example.local` â†’ `sec***@example.local`
- Error messages truncated to 200 characters
- Secrets never exposed (SMTP passwords, webhook URLs, tokens)
- All endpoints protected with `CanViewSecurityCenter` permission

### Frontend Integration (`frontend/src/services/configurationApi.ts`)

- New API client with typed functions
- Automatic fallback to mock data when backend unavailable
- Visible "Dati demo" badge when using mock data
- Loading states and error handling

### Updated Components

- `ConfigurationStudioPage.tsx` - Now fetches real data with fallback
- Overview cards use real counts from backend
- All tabs receive real data when available

### Tests (`security/tests/test_api_configuration.py`)

Added comprehensive test coverage:

- Authentication/authorization checks
- Real data retrieval from `SecurityMailboxSource`
- Latest run counters included
- Email masking verification
- Secrets not exposed
- Test endpoint does not persist data
- Simulated parser detection

### Documentation

- `docs/security-center/CONFIGURATION_STUDIO_API.md` - Complete API reference
- `docs/security-center/PATCH_14_CONFIGURATION_API.md` - This file

## Technical Details

### Data Sources

- **Sources:** `SecurityMailboxSource` + `SecurityMailboxIngestionRun`
- **Rules:** `SecurityAlertRuleConfig` + conceptual rules registry
- **Notifications:** Hardcoded channel definitions (future: DB-backed)
- **Suppressions:** `SecurityAlertSuppressionRule`
- **Addon enrichment:** Uses existing `addon_registry` service

### Category Detection

Sources are automatically categorized by matching name/code against addon tokens:

- `watchguard` - WatchGuard EPDR, Dimension, Firebox, ThreatSync
- `microsoft_defender` - Microsoft Defender vulnerabilities
- `backup_nas` - Synology Active Backup, NAS monitoring
- `custom` - User-defined sources
- `unknown` - Unrecognized sources

### Parser Detection

The test endpoint uses simple keyword detection:

- `watchguard` / `epdr` â†’ `watchguard_report_parser`
- `defender` / `microsoft` â†’ `microsoft_defender_vulnerability_notification_email_parser`
- `synology` / `backup` â†’ `synology_active_backup_email_parser`

Future: Use real parser registry with confidence scoring.

### Status Mapping

Source status derived from:

- `disabled` - `enabled=False`
- `error` - `last_error_at` is set
- `not_configured` - No successful imports
- `warning` - Latest run status is `failed` or `partial`
- `active` - Enabled and working

## Limitations

This patch implements **read-only API only**. Not implemented:

- Creating/editing sources
- Enabling/disabling rules
- Creating/editing suppressions
- Configuring notification channels
- Microsoft Graph integration
- IMAP integration
- Real parser execution in test endpoint

Full CRUD operations planned for future patches.

## Frontend Behavior

### When Backend Available

1. Fetches real data from all 5 endpoints
2. Uses real counts in overview cards
3. Displays real sources, rules, channels, suppressions
4. No "Dati demo" badge

### When Backend Unavailable

1. Catches fetch errors gracefully
2. Falls back to mock data
3. Displays "Dati demo" badge
4. UI remains fully functional

### Empty Backend Data

If backend returns empty arrays (no sources/rules configured):

- Falls back to mock data for that section
- Shows "Dati demo" badge
- Allows users to explore UI before configuration

## Quality Gates

### Backend Tests

```bash
python manage.py test security.tests.test_api_configuration
```

**Result:** All tests pass

### Frontend Build

```bash
cd frontend
npm run build
```

**Result:** Build successful

### Django Checks

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
```

**Result:** No issues, no pending migrations

## Files Changed

### Added

- `security/api_configuration.py` - API views
- `security/tests/test_api_configuration.py` - Tests
- `frontend/src/services/configurationApi.ts` - API client
- `docs/security-center/CONFIGURATION_STUDIO_API.md` - API reference
- `docs/security-center/PATCH_14_CONFIGURATION_API.md` - This file

### Modified

- `security/urls.py` - Added 6 new routes
- `frontend/src/pages/ConfigurationStudioPage.tsx` - Real data integration

## Migration Path

### For Existing Deployments

1. Deploy backend changes (no migrations required)
2. Deploy frontend build
3. Existing mock data remains as fallback
4. No breaking changes to existing SSR pages

### For New Deployments

1. Configuration Studio works immediately with mock data
2. As sources/rules are configured, real data appears
3. "Dati demo" badge disappears when real data loads

## Future Work

### Patch 15 (Planned): Configuration Studio CRUD

- Create/edit mailbox sources
- Enable/disable alert rules
- Create/edit suppression rules
- Configure notification channels
- Real-time validation

### Patch 16 (Planned): Microsoft Graph Integration

- OAuth flow for mailbox sources
- Real-time mailbox polling
- Attachment processing

### Patch 17 (Planned): Advanced Rule Engine

- Visual rule builder
- Custom metric definitions
- Baseline deviation detection
- Multi-condition rules

## Validation Commands

```bash
# Backend tests
python manage.py test security.tests.test_api_configuration

# All security tests
python manage.py test security

# Django checks
python manage.py check

# No pending migrations
python manage.py makemigrations --check --dry-run

# Frontend build
cd frontend
npm run build
```

## API Usage Example

```javascript
import {
  fetchConfigurationOverview,
  fetchConfigurationSources,
} from "../services/configurationApi";

async function loadConfiguration() {
  try {
    const overview = await fetchConfigurationOverview();
    const sources = await fetchConfigurationSources();

    console.log(`Active sources: ${overview.active_sources_count}`);
    console.log(`Sources:`, sources);
  } catch (error) {
    console.warn("Backend unavailable, using mock data");
  }
}
```

## Notes

- All endpoints require authentication (`CanViewSecurityCenter`)
- Email addresses are always masked in responses
- Error messages are truncated to prevent log leakage
- Test endpoint is safe and non-persistent
- Frontend gracefully degrades to mock data
- No breaking changes to existing functionality
- SSR pages remain unchanged

## Related Patches

- **Patch 13:** Configuration Studio UI (React frontend)
- **Patch 14:** Configuration Studio Backend API (this patch)
- **Patch 15:** Configuration Studio CRUD (planned)
