# Security Center AI

Security Report Intelligence MVP built with Django, SQL Server support, Celery, Redis, Django admin, DRF read APIs, modular parsers, rule evaluation, deduplication, KPI snapshots, evidence containers, and remediation tickets.

Current version: 0.7.4

## AI Integration

Security Center AI now includes NVIDIA NIM-powered AI capabilities with provider abstraction for intelligent security analysis and automation:

- **AI Chat**: Conversational AI assistant for security analysis and guidance
- **Alert Rule Suggestions**: AI-powered generation of alert rules based on service descriptions
- **Report Analysis**: Automatic vulnerability detection and recommendations from security reports
- **Event Analysis**: Pattern detection and anomaly identification in security events
- **Summary Generation**: AI-powered data aggregation and reporting

### AI Provider Architecture

The AI integration uses a provider abstraction layer that supports multiple AI backends:

```
security/ai/
├── providers/
│   ├── base.py          # Base provider interface and response format
│   └── nvidia_nim.py    # NVIDIA NIM provider implementation
└── services/
    └── ai_gateway.py    # Provider selection and unified API
```

**Current Provider**: NVIDIA NIM (Llama 3.1 models)

**Future Providers** (planned):
- OpenAI API
- Azure OpenAI
- Local LLM providers
- Fallback provider support

### AI Configuration

Configure AI provider in `.env`:

```env
# AI Provider
AI_PROVIDER=nvidia_nim
AI_DEFAULT_MODEL=meta/llama-3.1-70b-instruct
AI_FAST_MODEL=meta/llama-3.1-8b-instruct
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=2048

# NVIDIA NIM
NVIDIA_NIM_API_KEY=your_nvidia_api_key_here
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

# Legacy fallback (NVIDIA_NIM_API_KEY takes precedence)
NVIDIA_API_KEY=your_nvidia_api_key_here
```

Get your API key from: https://build.nvidia.com/

### AI Features

**AI Assistant Page** (`/ai`):
- Chat interface with conversation history
- Suggested questions for quick interaction
- Real-time AI responses with streaming support
- Messages panel with severity filtering
- Analysis history and statistics

**Service Configuration Assistant**:
- Located in Services page and Configuration → Rules tab
- Describe the service you want to monitor
- AI generates appropriate alert rules automatically
- Includes rule name, condition, severity, description, and recommended actions

**AI API Endpoints**:
- `POST /api/security/ai/chat/` - Chat with AI assistant (returns `message`, `model`, `provider`)
- `POST /api/security/ai/suggest-alert-rule/` - Generate alert rule suggestions
- `POST /api/security/ai/analyze-report/` - Analyze security reports
- `POST /api/security/ai/analyze-events/` - Analyze security events
- `POST /api/security/ai/generate-summary/` - Generate data summaries

### AI Models

- **Llama 3.1 70B Instruct**: Complex analysis, reasoning, and chat
- **Llama 3.1 8B Instruct**: Quick suggestions, summaries, and real-time responses

### AI Security

- API keys stored in environment variables only, never exposed in frontend
- Provider abstraction prevents direct API key exposure in responses
- Configuration errors return 503 status without internal details
- Chat history sanitized and limited to 10 messages with 4000 character content limit
- Message content limited to 8000 characters
- All AI endpoints require Security Center view permission

## React Control Center

The React app is the single operator-facing UI for configuration, source health, incoming data monitoring, and report management. It renders live backend data only: when APIs are empty or unavailable, the UI shows explicit empty/error states instead of synthetic demo rows.

## Microsoft Graph mailbox ingestion

Microsoft 365 mailbox sources with `source_type=graph` can be imported through the backend ingestion pipeline. Configure Graph credentials from the React Microsoft Graph page or, for server-only deployments, through Django/server environment values:

```env
GRAPH_TENANT_ID=00000000-0000-0000-0000-000000000000
GRAPH_CLIENT_ID=00000000-0000-0000-0000-000000000000
GRAPH_CLIENT_SECRET=token-redacted
GRAPH_MAIL_FOLDER=Inbox
```

Use an Entra app registration with application mailbox permissions approved by an administrator. Client secrets saved from the UI are stored as server-side secret settings and are never returned to the browser. Do not put real Graph credentials in React code, docs, tests, screenshots, or fixtures.

## Windows TEST SQL Server Setup

For Windows LAN test deployments, use the guided SQL Server setup instead of manually editing `.env`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure_sqlserver_env.ps1 -TestConnection
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService
```

The wizard preserves manual `.env` support, masks SQL passwords in output, and creates the test database only after an explicit operator request. Standard uninstall removes application files and attempts service cleanup, but intentionally keeps the SQL Server database.

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

## React build served by Django

For a local Windows test deployment with one Django endpoint:

```powershell
.\scripts\windows\build_frontend_for_django.ps1
python manage.py runserver 0.0.0.0:8000
```

Open `http://127.0.0.1:8000/` or `http://<PC-IP>:8000/` from the LAN. The backend serves the React production build from `frontend/dist/`; protected backend/admin routes remain support surfaces, not the primary operator UI.

## Operator UI

The React Control Center is the primary operational workflow:

- `/` dashboard with KPI distribution, source coverage, incoming data, recent alerts, and report activity.
- `/ai` AI assistant with chat, messages, and analysis history.
- `/configuration` source, rule, notification, suppression, and test configuration.
- `/inbox` incoming mailbox/upload monitoring and parsing status.
- `/reports` imported report review, filters, detail, pipeline state, and safe retry/reprocess actions.
- `/integrations/microsoft-graph` Graph credential status, mailbox folder, and sync actions.
- `/services` service status, polling Graph/mailbox, and AI-powered configuration assistant.

Alert quick actions write `SecurityAlertActionLog` entries. Pipeline actions call the same services used by management commands and APIs.

Alert lifecycle states are:

- Active/deduplicated: `new`, `open`, `acknowledged`, `in_progress`, `snoozed`, `muted`
- Terminal/not deduplicated: `closed`, `false_positive`, `resolved`, `suppressed`

The alert detail page supports acknowledge, close, false positive, snooze, and reopen actions. Each action records old/new status, actor, reason, and snooze expiry when present.

## API MVP

Create or list sources at:

- `GET /api/sources/`
- `POST /api/sources/`

AI endpoints:

- `POST /api/security/ai/chat/` - Chat with AI assistant
- `POST /api/security/ai/suggest-alert-rule/` - Generate alert rule suggestions
- `POST /api/security/ai/analyze-report/` - Analyze security reports
- `POST /api/security/ai/analyze-events/` - Analyze security events
- `POST /api/security/ai/generate-summary/` - Generate data summaries

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
