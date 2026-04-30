# Configuration Studio API

**Version:** 0.7.1
**Status:** Live React Control Center + Source Wizard + Graph settings + report operations
**Last updated:** 2026-04-30

## Overview

The Configuration Studio API provides endpoints for the React Configuration Studio frontend to consume real backend data and manage source configurations.

- **Patch 14:** Read-only endpoints for overview, sources, rules, notifications, suppressions, and test
- **Patch 15B:** Source wizard endpoints for creating, updating, and toggling SecurityMailboxSource instances
- **Patch 21:** React navigation exposes Configuration Studio as a first-level Control Center section.
- **Patch 22:** Microsoft Graph settings can be saved from the React UI while tenant, client ID, and client secret remain server-side.
- **Patch 23:** React is the single operator-facing UI for configuration, KPI distribution, incoming data monitoring, and report management. Demo/mock frontend fallback data has been removed.

## Base URL

```
/security/api/configuration/
```

## Authentication

All endpoints require authentication and use the existing `CanViewSecurityCenter` permission class.

- Unauthenticated requests return `401 Unauthorized`
- Unauthorized requests return `403 Forbidden`

## Endpoints

### 1. GET /overview/

Returns summary counts for the Configuration Studio dashboard.

**Response:**

```json
{
  "monitored_sources_count": 5,
  "active_sources_count": 5,
  "sources_with_warnings_count": 1,
  "alert_rules_count": 8,
  "active_alert_rules_count": 6,
  "notification_channels_count": 4,
  "active_notification_channels_count": 3,
  "active_suppressions_count": 3,
  "latest_ingestion_status": "success",
  "latest_ingestion_at": "2026-04-27T09:15:00Z",
  "open_alerts_count": 12,
  "critical_open_alerts_count": 2
}
```

### 2. GET /sources/

Returns source cards for Configuration Studio.

**Response:** Array of source DTOs

```json
[
  {
    "id": 1,
    "code": "watchguard-epdr",
    "name": "WatchGuard EPDR",
    "source_type": "manual",
    "category": "watchguard",
    "status": "active",
    "origin": "mailbox",
    "parser_names": ["watchguard_report_parser"],
    "mailbox_address": "sec***@example.local",
    "last_import_at": "2026-04-27T08:30:00Z",
    "last_success_at": "2026-04-27T08:30:00Z",
    "last_error_at": null,
    "last_error_message": "",
    "latest_run": {
      "status": "success",
      "started_at": "2026-04-27T08:30:00Z",
      "finished_at": "2026-04-27T08:31:00Z",
      "imported": 12,
      "skipped": 2,
      "duplicates": 1,
      "files": 5,
      "processed": 15,
      "alerts": 3,
      "error_message": ""
    },
    "warning_messages": [],
    "links": {
      "configuration_url": "/configuration?tab=sources&source=watchguard-epdr",
      "inbox_url": "/inbox",
      "reports_url": "/reports",
      "diagnostics_url": "/configuration?tab=test"
    }
  }
]
```

**Field descriptions:**

- `category`: Detected addon category (`watchguard`, `microsoft_defender`, `backup_nas`, `custom`, `unknown`)
- `status`: Source status (`active`, `disabled`, `warning`, `error`, `not_configured`)
- `origin`: Origin type (`mailbox`, `upload`, `manual`, `graph`, `imap_future`)
- `mailbox_address`: Email address masked for security (e.g., `sec***@example.local`)
- `latest_run`: Status, timestamps, counters, generated alert count, and a short safe error message from the most recent ingestion run

### 3. GET /rules/

Returns alert rule overview.

**Response:** Array of rule DTOs

```json
[
  {
    "code": "defender_critical_cve_cvss_gte_9",
    "title": "CVE Critiche con dispositivi esposti",
    "group": "microsoft_defender",
    "enabled": true,
    "severity": "critical",
    "when_summary": "cvss_score gte 9.0",
    "then_summary": "Alert critical + Evidence + Ticket",
    "dedup_summary": "1440 min",
    "aggregation_summary": "cvss_score",
    "last_match_at": "2026-04-27T07:05:00Z",
    "matches_count": 42,
    "generated_alerts_count": null,
    "status": "active",
    "warning_messages": []
  }
]
```

**Field descriptions:**

- `group`: Rule group/module (e.g., `watchguard`, `microsoft_defender`, `backup_nas`, `general`)
- `status`: Rule status (`active`, `disabled`, `warning`, `error`)
- `when_summary`: Human-readable condition summary
- `then_summary`: Human-readable action summary
- `dedup_summary`: Deduplication window in minutes
- `aggregation_summary`: Aggregation field or "N/A"

**Conceptual/planned rules:**

Rules that are planned but not yet implemented are included with `status: "warning"` and a warning message.

### 4. GET /notifications/

Returns notification channel configuration overview.

**Response:** Array of channel DTOs

```json
[
  {
    "code": "dashboard",
    "name": "Dashboard Security Center",
    "enabled": true,
    "configured": true,
    "status": "active",
    "destination_summary": "Inbox interno",
    "last_delivery_at": null,
    "last_error_at": null,
    "last_error_message": null,
    "warning_messages": []
  },
  {
    "code": "email",
    "name": "Email operativa",
    "enabled": true,
    "configured": true,
    "status": "active",
    "destination_summary": "sec***@example.local",
    "last_delivery_at": null,
    "last_error_at": null,
    "last_error_message": null,
    "warning_messages": []
  }
]
```

**Security note:**

- SMTP passwords, webhook URLs, tokens, and secrets are **never exposed**
- Email addresses are masked (e.g., `sec***@example.local`)
- Destination summaries are safe/generic

### 5. GET /suppressions/

Returns active suppression/snooze/mute overview.

**Response:** Array of suppression DTOs

```json
[
  {
    "id": 1,
    "code": "supp-1",
    "type": "snooze",
    "title": "Finestra manutenzione programmata",
    "active": true,
    "reason": "Manutenzione server EXAMPLE-HOST-1",
    "owner": "admin@example.local",
    "scope_summary": "asset=EXAMPLE-HOST-1",
    "expires_at": "2026-04-28T06:00:00Z",
    "matches_suppressed_count": 12,
    "created_at": "2026-04-27T00:00:00Z",
    "updated_at": "2026-04-27T00:00:00Z",
    "status": "active"
  }
]
```

**Field descriptions:**

- `type`: Suppression type (`snooze`, `suppression_rule`, `false_positive`, `muted_class`)
- `status`: Current status (`active`, `expired`, `disabled`)
- `scope_summary`: Human-readable scope description
- `owner`: User email or username (safe display)

### 6. POST /test/

Safe simulated configuration test endpoint.

**Request:**

```json
{
  "source_type": "email",
  "parser_code": "watchguard_report_parser",
  "sample_text": "WatchGuard EPDR Executive Report...",
  "filename": "report.txt"
}
```

**Response:**

```json
{
  "parser_detected": "watchguard_report_parser",
  "parser_name": "watchguard_report_parser",
  "confidence": 0.8,
  "metrics_preview": [
    {"name": "events_count", "value": 42},
    {"name": "severity_high", "value": 3}
  ],
  "findings_preview": [
    {"type": "vulnerability", "count": 2}
  ],
  "would_generate_alert": true,
  "would_create_evidence_container": true,
  "would_create_ticket": false,
  "warnings": [],
  "errors": []
}
```

**Important:**

- This endpoint **does not persist** any data
- No `SecurityMailboxMessage`, `SecuritySourceFile`, `SecurityReport`, `Alert`, `Ticket`, or `Evidence Container` records are created
- Results are simulated based on parser detection and keyword analysis

## Source Wizard Endpoints (Patch 15)

### 7. GET /source-presets/

Returns available wizard presets for common report types.

**Response:** Array of preset DTOs

```json
[
  {
    "preset_code": "watchguard_epdr",
    "title": "WatchGuard EPDR Executive Report",
    "description": "Report esecutivo settimanale WatchGuard EPDR...",
    "module": "watchguard",
    "recommended_origin": "mailbox",
    "default_name": "WatchGuard EPDR Executive Report",
    "code_prefix": "watchguard-epdr",
    "source_type": "manual",
    "sender_allowlist_text": "noreply@watchguard.com",
    "subject_include_text": "EPDR Executive Report",
    "subject_exclude_text": "",
    "body_include_text": "",
    "attachment_extensions": "pdf",
    "max_messages_per_run": 50,
    "mark_as_read_after_import": false,
    "process_attachments": true,
    "process_email_body": false,
    "parser_hints": ["watchguard_epdr_parser"],
    "warning_messages": []
  }
]
```

### 8. POST /sources/create/

Creates a new SecurityMailboxSource.

**Request:**

```json
{
  "name": "WatchGuard EPDR Weekly",
  "code": "watchguard-epdr-weekly",
  "enabled": true,
  "source_type": "manual",
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
- `source_type` must be one of: `manual`, `graph`, `imap`
- `max_messages_per_run` must be between 1 and 500
- Rejects suspicious secret-like fields (`password`, `secret`, `token`, `api_key`, `client_secret`, `private_key`)
- Source creation does not attempt external connections

**Response:** 201 Created with source DTO (same format as GET /sources/)

**Error responses:**

- `400 Bad Request` - Validation error (duplicate code, invalid format, suspicious fields)
- `403 Forbidden` - Insufficient permissions

### 9. PATCH /sources/<code>/

Updates safe editable fields for an existing source.

**Request:** (all fields optional)

```json
{
  "name": "Updated Name",
  "enabled": false,
  "description": "Updated description",
  "sender_allowlist_text": "noreply@watchguard.com\nsupport@watchguard.com",
  "max_messages_per_run": 100
}
```

**Allowed fields:**

- `name`, `enabled`, `source_type`, `mailbox_address`, `description`
- `sender_allowlist_text`, `subject_include_text`, `subject_exclude_text`, `body_include_text`
- `attachment_extensions`, `max_messages_per_run`
- `mark_as_read_after_import`, `process_attachments`, `process_email_body`

**Security:**

- Does not expose secrets in response
- Rejects suspicious secret-like fields
- Does not allow changing internal IDs or timestamps

**Response:** 200 OK with updated source DTO

**Error responses:**

- `400 Bad Request` - Validation error
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Source not found

### 10. POST /sources/<code>/toggle/

Enables or disables a source.

**Response:**

```json
{
  "enabled": true
}
```

**Error responses:**

- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Source not found

### 11. GET/POST /graph/settings/

Returns Microsoft Graph credential status and saves Graph mailbox settings.

`GET` is available to users who can view Security Center. It sets the CSRF cookie used by React and returns status only, never saved credential values.

**GET response:** 200 OK

```json
{
  "tenant_configured": true,
  "client_configured": true,
  "secret_configured": true,
  "mail_folder": "SECURITY",
  "can_save": true,
  "configured": true,
  "updated_at": "2026-04-30T10:15:00Z"
}
```

`POST` requires the manage-configuration permission. Blank `tenant_id`, `client_id`, or `client_secret` keep existing saved values; `client_secret` is write-only and is never returned.

**POST request:**

```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000000",
  "client_id": "00000000-0000-0000-0000-000000000000",
  "client_secret": "token-redacted",
  "mail_folder": "SECURITY"
}
```

**Error responses:**

- `400 Bad Request` - Missing required first-time credential field
- `403 Forbidden` - Manage-configuration permission required

**Security notes:**

- The response exposes only configured/missing booleans and the non-secret folder name.
- Saved tenant ID, client ID, and client secret are stored as server-side secret settings.
- Real Graph credentials must not be stored in React code, fixtures, screenshots, or documentation.

### 12. POST /sources/<code>/ingest/

Runs ingestion for an enabled configured mailbox source. For `source_type=graph`, the backend reads Microsoft Graph credentials from UI-saved server settings first, then server environment fallback values, and imports messages through the normal parser/rule pipeline.

**Request:**

```json
{
  "limit": 50,
  "process_pipeline": true,
  "force_reprocess": false
}
```

**Response:** 200 OK

```json
{
  "id": 12,
  "source_code": "microsoft-graph-mailbox",
  "status": "success",
  "imported_messages_count": 1,
  "skipped_messages_count": 0,
  "duplicate_messages_count": 0,
  "imported_files_count": 0,
  "processed_items_count": 1,
  "generated_alerts_count": 0,
  "error_message": ""
}
```

**Security notes:**

- The request never accepts tenant IDs, client secrets, access tokens, passwords, or API keys.
- Graph credentials must stay in server-side settings or server environment values.
- Response payloads contain counters and short errors only, not raw mailbox bodies or credentials.

## Security & Masking Rules

### Email Masking

Email addresses are masked to prevent exposure:

- `security@example.local` → `sec***@example.local`
- `admin@example.local` → `adm***@example.local`

### Error Message Truncation

Error messages are truncated to 200 characters maximum to prevent log leakage.

### Secrets

The following are **never exposed** in API responses:

- SMTP passwords
- Webhook URLs
- API tokens
- OAuth client secrets
- Database connection strings

## Frontend Integration

### API Client

Location: `frontend/src/services/configurationApi.ts`

Functions:

- `fetchConfigurationOverview()`
- `fetchConfigurationSources()`
- `fetchConfigurationRules()`
- `fetchConfigurationNotifications()`
- `fetchConfigurationSuppressions()`
- `testConfiguration(request)`
- `fetchSourcePresets()` (Patch 15)
- `createSource(request)` (Patch 15)
- `updateSource(code, request)` (Patch 15)
- `toggleSource(code)` (Patch 15)
- `runSourceIngestion(code, limit?)`
- `fetchGraphSettings()`
- `saveGraphSettings(request)`

### Empty and Error States

The React Control Center fetches live backend data only. If an API is unavailable, unauthenticated, or empty:

1. The affected panel shows an explicit loading, empty, or error state.
2. No synthetic report, KPI, source, rule, or inbox rows are injected.
3. Operational actions remain visible only when the backend exposes the required capability.

This keeps configuration and report triage tied to real backend state.

## Current Limitations

This API includes read endpoints plus source creation, source updates, source toggles, configuration testing, and explicit source ingestion. The following are **not yet implemented**:

- Enabling/disabling rules
- Creating/editing suppressions
- Configuring notification channels
- IMAP integration

Full CRUD operations will be added in future patches.

## Testing

Backend tests: `security/tests/test_api_configuration.py`

Run tests:

```bash
python manage.py test security.tests.test_api_configuration
```

## Related Documentation

- [Patch 14 Implementation Notes](patch-history/PATCH_14_CONFIGURATION_API.md)
- [Configuration Studio UI (Patch 13.5)](patch-history/PATCH_13.5_CONFIGURATION_STUDIO.md)
- [Developer Guide](10_DEVELOPER_GUIDE.md)
