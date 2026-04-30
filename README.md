# Security Center AI

Security Report Intelligence MVP built with Django, SQL Server support, Celery, Redis, Django admin, DRF read APIs, modular parsers, rule evaluation, deduplication, KPI snapshots, evidence containers, and remediation tickets.

Current version: 0.7.1

## React Control Center

The React app is the single operator-facing UI for configuration, source health, incoming data monitoring, and report management. It renders live backend data only: when APIs are empty or unavailable, the UI shows explicit empty/error states instead of synthetic demo rows.

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

## Run

```powershell
python manage.py runserver
```

Open:

- React app: http://127.0.0.1:8000/
- API root: http://127.0.0.1:8000/api/

## Operator UI

The React Control Center is the primary operational workflow:

- `/` dashboard with KPI distribution, source coverage, incoming data, recent alerts, and report activity.
- `/configuration` source, rule, notification, suppression, and test configuration.
- `/inbox` incoming mailbox/upload monitoring and parsing status.
- `/reports` imported report review, filters, detail, pipeline state, and internal action tracking.
- `/integrations/microsoft-graph` Graph credential status, mailbox folder, and sync actions.

Alert quick actions write `SecurityAlertActionLog` entries. Pipeline actions call the same services used by management commands and APIs.

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
  -d "{\"original_name\":\"vpn-denied.csv\",\"file_type\":\"csv\",\"content\":\"timestamp,user,src_ip,result\n2026-04-27T10:00:00Z,user1,192.0.2.10,denied\"}"
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
