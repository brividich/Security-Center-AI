# Patch 13 Summary: Mailbox Ingestion Pipeline Wiring

**Date:** 2026-04-27
**Status:** âœ… Complete
**Tests:** 169/169 passing

---

## Overview

Patch 13 wires imported mailbox messages and attachments into the existing Security Inbox parser/rule/KPI/alert/evidence pipeline, completing the mailbox ingestion feature started in Patch 12.

---

## Changes Implemented

### 1. Shared Pipeline Service

**New file:** `security/services/security_inbox_pipeline.py`

Extracted shared processing logic from Inbox Workbench views into reusable service functions:

- `process_mailbox_message(message, *, source=None, run=None, dry_run=False)` - Process email body
- `process_source_file(source_file, *, message=None, source=None, run=None, dry_run=False)` - Process attachment
- `_process_inbox_item(item)` - Core pipeline logic
- `_pipeline_counts()` - Entity counters
- `_reports_for_item(item)` - Report lookup

**Pipeline flow:**
1. Check if already processed (skip if `parse_status != pending`)
2. Match enabled parser
3. Run parser
4. Evaluate security rules
5. Generate KPI/evidence/tickets
6. Update `parse_status`
7. Return result counters

### 2. Mailbox Ingestion Integration

**Modified:** `security/services/mailbox_ingestion.py`

- Added `process_pipeline` and `force_reprocess` parameters to `run_mailbox_ingestion()`
- Added `process_pipeline` and `force_reprocess` parameters to `ingest_mailbox_message()`
- Integrated pipeline processing for email body when `process_email_body=True`
- Integrated pipeline processing for attachments when `process_attachments=True`
- Added metadata tracking: `mailbox_source_code`, `mailbox_message_id` in `raw_payload`
- Implemented force reprocessing logic for testing/recovery

### 3. Inbox Workbench Refactor

**Modified:** `security/views.py`

- Refactored `_handle_inbox_post()` to use shared pipeline service
- Removed duplicate `_inbox_counts()` helper (now in pipeline service)
- Simplified view logic by delegating to pipeline service
- Maintained backward compatibility with existing UI

### 4. Management Command Enhancement

**Modified:** `security/management/commands/ingest_security_mailbox.py`

Added new command flags:
- `--process` (default: True) - Process through pipeline
- `--no-process` - Import only, skip pipeline
- `--force-reprocess` - Reprocess already processed messages

### 5. Reprocessing Safety

**Behavior:**
- Messages with `parse_status=parsed` are skipped automatically
- Messages with `parse_status=pending` are processed
- Messages with `parse_status=failed` can be retried
- Duplicate messages are detected via fingerprint and skipped
- `--force-reprocess` resets `parse_status=pending` for duplicates
- Dry-run never modifies `parse_status` or creates side effects

### 6. Tests

**New file:** `security/tests/test_mailbox_ingestion_pipeline.py`

15 new tests covering:
- âœ… Process pending message/file
- âœ… Skip already processed items
- âœ… Dry-run no side effects
- âœ… Full ingestion with processing
- âœ… Ingestion without processing
- âœ… Duplicate detection
- âœ… Force reprocessing
- âœ… Pipeline result counters
- âœ… Attachment processing
- âœ… Parser matching
- âœ… Error handling

### 7. Documentation

**Updated:**
- `docs/security-center/MAILBOX_INGESTION.md` - Added pipeline integration, reprocessing rules, command flags
- `docs/security-center/10_DEVELOPER_GUIDE.md` - Added shared pipeline service documentation

---

## Quality Gates

```bash
âœ… python manage.py check
   System check identified no issues (0 silenced).

âœ… python manage.py makemigrations --check --dry-run
   No changes detected

âœ… python manage.py test security.tests.test_mailbox_ingestion_pipeline
   Ran 15 tests in 0.021s - OK

âœ… python manage.py test security
   Ran 169 tests in 61.497s - OK
```

---

## Files Changed

### New Files (2)
- `security/services/security_inbox_pipeline.py` (145 lines)
- `security/tests/test_mailbox_ingestion_pipeline.py` (260 lines)

### Modified Files (5)
- `security/services/mailbox_ingestion.py` - Added pipeline integration
- `security/views.py` - Refactored to use shared pipeline
- `security/management/commands/ingest_security_mailbox.py` - Added command flags
- `docs/security-center/MAILBOX_INGESTION.md` - Updated documentation
- `docs/security-center/10_DEVELOPER_GUIDE.md` - Added pipeline documentation

---

## Next Steps

1. âœ… Patch 13 complete - pipeline wiring functional
2. ðŸ”œ Patch 14 - Microsoft Graph provider implementation
3. ðŸ”œ Patch 15 - IMAP provider implementation
4. ðŸ”œ Patch 16 - Scheduled ingestion automation
