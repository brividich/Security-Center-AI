# Security Center AI

Security Report Intelligence MVP built with Django, SQL Server support, Celery, Redis, Django admin, DRF read APIs, modular parsers, rule evaluation, deduplication, KPI snapshots, evidence containers, and remediation tickets.

## Install

```powershell
python -m pip install -r requirements.txt
copy .env.example .env
```

## SQL Server

For SQL Server, edit `.env`:

```env
USE_SQLSERVER=True
SQLSERVER_DATABASE=SecurityCenterAI
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=your-password
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server
SQLSERVER_EXTRA_PARAMS=TrustServerCertificate=yes
```

Make sure the Microsoft ODBC Driver for SQL Server is installed on Windows.

## Database

```powershell
python manage.py migrate
python manage.py createsuperuser
```

## Demo Data

```powershell
python manage.py ingest_sample_security_data
python manage.py run_security_parsers
python manage.py evaluate_security_rules
python manage.py build_daily_kpi_snapshots
```

## Run

```powershell
python manage.py runserver
```

Open:

- Dashboard: http://127.0.0.1:8000/
- Security UI: http://127.0.0.1:8000/security/
- Admin: http://127.0.0.1:8000/admin/
- API root: http://127.0.0.1:8000/api/

## UI MVP

The server-side Django UI provides the first operational workflow:

- `/security/` dashboard with open alerts, critical alerts, open tickets, daily reports, daily evidence, latest critical CVEs, latest alerts, and last pipeline run for the browser session.
- `/security/alerts/` alert list with filters for severity, status, source, and date.
- `/security/alerts/<id>/` alert detail with linked ticket, evidence, occurrences, audit log, source report, CVE fields, and quick actions.
- `/security/tickets/` remediation ticket list.
- `/security/kpis/` daily KPI snapshots with previous/next day navigation.
- `/security/pipeline/` operational buttons for parsers, rule evaluation, KPI build, and full pipeline.

Alert quick actions write `SecurityAlertActionLog` entries. Pipeline buttons call the same services used by management commands and APIs.

Alert lifecycle states are:

- Active/deduplicated: `new`, `open`, `acknowledged`, `in_progress`, `snoozed`, `muted`
- Terminal/not deduplicated: `closed`, `false_positive`, `resolved`, `suppressed`

The alert detail page supports acknowledge, close, false positive, snooze, and reopen actions. Each action records old/new status, actor, reason, and snooze expiry when present.

## API MVP

Create or list sources at:

- `GET /api/sources/`
- `POST /api/sources/`

Manual ingestion stubs:

```powershell
curl -X POST http://127.0.0.1:8000/api/sources/1/ingest-mailbox-message/ `
  -H "Content-Type: application/json" `
  -d "{\"subject\":\"Microsoft Defender vulnerability notification\",\"body\":\"CVE-2025-7777\nAffected product: Edge\nCVSS: 9.8\nExposed devices: 2\"}"

curl -X POST http://127.0.0.1:8000/api/sources/1/ingest-source-file/ `
  -H "Content-Type: application/json" `
  -d "{\"original_name\":\"vpn-denied.csv\",\"file_type\":\"csv\",\"content\":\"timestamp,user,src_ip,result\n2026-04-27T10:00:00Z,mario,10.0.0.5,denied\"}"
```

Pipeline actions:

- `POST /api/pipeline/run-parsers/`
- `POST /api/pipeline/evaluate-rules/`
- `POST /api/pipeline/build-kpis/`

Rule decisions are stored in `decision_trace`; suppressed events remain visible as events and KPI input.

## Tests

```powershell
python manage.py test
```
