# Security Center AI

Security Report Intelligence MVP built with Django, SQL Server support, Celery, Redis, Django admin, DRF read APIs, modular parsers, rule evaluation, deduplication, KPI snapshots, evidence containers, and remediation tickets.

Current version: 0.11.2

## AI Integration

Security Center AI includes NVIDIA NIM-powered AI capabilities with provider abstraction for intelligent security analysis and automation:

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
├── services/
│   ├── ai_gateway.py    # Provider selection and unified API
│   ├── context_builder.py  # Context building for alerts, reports, tickets, evidence
│   └── redaction.py     # Secret redaction before provider calls
└── context/
    ├── safety_policy.md      # AI safety and security guidelines
    ├── domain_knowledge.md  # Security Center domain knowledge
    ├── response_formats.md  # Expected response formats
    └── assistant_profile.md # AI assistant persona and behavior
```

**Current Provider**: NVIDIA NIM (Llama 3.1 models)

**Planned Providers** (not yet implemented):
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
AI_SPEED_MODEL=meta/llama-3.2-1b-instruct
AI_COMPLEX_MODEL=meta/llama-3.1-70b-instruct
AI_MODEL_ROUTE_MODE=speed
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=2048

# Timeout and Retry
AI_REQUEST_TIMEOUT_SECONDS=20
AI_REQUEST_RETRIES=0
AI_RETRY_BACKOFF_SECONDS=1

# Fallback
AI_ENABLE_FAST_FALLBACK=true
AI_COPILOT_USE_FAST_MODEL=true

# NVIDIA NIM
NVIDIA_NIM_API_KEY=your_nvidia_api_key_here
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

# Legacy fallback (NVIDIA_NIM_API_KEY takes precedence)
NVIDIA_API_KEY=your_nvidia_api_key_here
```

Get your API key from: https://build.nvidia.com/

### Model Routing

The system automatically selects the appropriate model based on task type and routing mode:

**Routing Modes:**
- `speed`: Always uses AI_SPEED_MODEL for all tasks (default, fastest)
- `balanced`: Uses fast model for copilot/config, speed model for chat/report
- `quality`: Uses default model with fallback to fast model

**Task-Specific Routing:**
- `chat`: Uses speed model in speed/balanced mode, default in quality mode
- `configuration_copilot`: Always uses fast model
- `report_summary`: Uses fast model in balanced mode, speed in speed mode
- `alert_explanation`: Uses speed model
- `rule_generation`: Uses fast model
- `rule_simulation_explanation`: Uses speed model

**Fallback Behavior:**
- Automatic fallback to speed model on timeout/unavailable errors
- No fallback on configuration errors (401, 403, missing API key)
- No fallback when fast model is already in use
- Configurable via `AI_ENABLE_FAST_FALLBACK`

### AI Features

**AI Assistant Page** (`/ai`):
- Chat interface with conversation history
- Suggested questions for quick interaction
- AI responses (non-streaming)
- Operations Center with provider status, usage metrics, and interaction history
- Context-aware interactions for alerts, reports, tickets, and evidence

**Service Configuration Assistant**:
- Located in Services page and Configuration → Rules tab
- Describe the service you want to monitor
- AI generates appropriate alert rules automatically
- Includes rule name, condition, severity, description, and recommended actions

**AI API Endpoints**:
- `POST /api/security/ai/chat/` - Chat with AI assistant (returns `message`, `model`, `provider`, internal memory metadata, and source references)
- `POST /api/security/ai/suggest-alert-rule/` - Generate alert rule suggestions
- `POST /api/security/ai/analyze-report/` - Analyze security reports
- `POST /api/security/ai/analyze-events/` - Analyze security events
- `POST /api/security/ai/generate-summary/` - Generate data summaries
- `POST /api/security/ai/memory/index/` - Index an internal text document into the AI knowledge base
- `GET /api/security/ai/memory/facts/` - List operational AI memory facts visible to the current user
- `POST /api/security/ai/memory/facts/` - Create an AI memory fact; new facts are unapproved by default for non-admin users
- `POST /api/security/ai/explain-alert/` - Explain an alert using internal context only
- `POST /api/security/ai/summarize-evidence/` - Summarize an Evidence Container using available evidence only
- `POST /api/security/ai/remediation-plan/` - Generate a remediation plan only when internal evidence is sufficient
- `GET /api/security/ai/operations-summary/` - Operations Center data (provider status, usage, interactions)
- `GET /api/security/ai/provider-status/` - Provider configuration and health status

### AI Memory and RAG

Security Center AI uses retrieval augmented generation, not fine-tuning, for internal knowledge. The persistent AI memory layer stores approved operational facts, indexed knowledge documents, stable chunks, conversations, and message history in the database. At response time the context builder retrieves approved memory facts, relevant chunks, object context for alerts/reports/tickets/evidence, and internal citations.

The assistant must use only the provided Security Center context for factual internal claims. When evidence is missing it must say: `Non ho abbastanza evidenza interna nel Security Center per confermarlo.` It must not invent alert IDs, tickets, CVEs, assets, users, IPs, reports, or remediation state.

AI Memory retrieval defaults to `hybrid_keyword`, which uses explainable keyword scoring and works on SQLite. Optional semantic retrieval can be enabled with deterministic embeddings and PostgreSQL pgvector:

```env
AI_MEMORY_RETRIEVAL_MODE=hybrid_pgvector
AI_MEMORY_EMBEDDINGS_ENABLED=true
AI_MEMORY_EMBEDDING_DIMENSIONS=384
AI_MEMORY_MIN_SCORE=0.18
AI_MEMORY_VECTOR_TOP_K=10
AI_MEMORY_KEYWORD_TOP_K=10
AI_MEMORY_VECTOR_WEIGHT=0.60
AI_MEMORY_KEYWORD_WEIGHT=0.40
```

Supported modes:
- `hybrid_keyword`: keyword/metadata/title/context scoring only, recommended for dev/test.
- `pgvector`: vector retrieval when configured, with keyword fallback if unavailable.
- `hybrid_pgvector`: keyword plus vector fusion, recommended for PostgreSQL production with pgvector.

Seed default approved operational memory facts with:

```powershell
python manage.py seed_ai_memory
```

Build or refresh chunks and embeddings with:

```powershell
python manage.py rebuild_ai_memory_index --mode all --provider deterministic_hash
```

Run the internal retrieval quality benchmark with:

```powershell
python manage.py evaluate_ai_memory_retrieval --format text
python manage.py evaluate_ai_memory_retrieval --mode vector_json_fallback --format json
```

The benchmark uses only synthetic Security Center cases and local deterministic embeddings. It reports hit@k, mean reciprocal rank, precision@5, insufficient-evidence accuracy, prompt-injection safety pass rate, and conservative regression thresholds before any real embedding provider is introduced.

SQLite/dev/test continue to work without pgvector. PostgreSQL deployments can enable pgvector with `CREATE EXTENSION vector;` and the optional `vector_embedding` column documented in `docs/security-center/13_AI_RETRIEVAL_PGVECTOR.md`. Tests use deterministic local embeddings and no external embedding calls.

### AI Models

- **Llama 3.2 1B Instruct** (Speed Model): Fast responses for operational tasks, diagnostics, copilot, and brief summaries (~0.75s response time)
- **Llama 3.1 8B Instruct** (Fast Model): Quick suggestions, summaries, and responses
- **Llama 3.1 70B Instruct** (Default/Complex Model): Complex analysis, reasoning, and chat

**Recommended Configuration:**
- Development: Use `AI_SPEED_MODEL=meta/llama-3.2-1b-instruct` with `AI_MODEL_ROUTE_MODE=speed` for fast iteration
- Production: Use `AI_SPEED_MODEL=meta/llama-3.1-8b-instruct` with `AI_MODEL_ROUTE_MODE=balanced` for better quality
- High-Quality: Use `AI_DEFAULT_MODEL=meta/llama-3.1-70b-instruct` with `AI_MODEL_ROUTE_MODE=quality` for complex analysis

### AI Security

- API keys stored in environment variables only, never exposed in frontend
- Provider abstraction prevents direct API key exposure in responses
- Configuration errors return 503 status without internal details
- Provider status endpoints expose only safe metadata (no API keys, base URLs, or full prompts)
- All prompts and responses are redacted before logging
- Context building respects user permissions and authorization
- AI Memory exposes citations and insufficiency flags, and does not treat unapproved memory facts as authoritative
- Error codes provide actionable feedback without exposing internal details

**Error Codes:**
- `provider_not_configured`: API key missing or placeholder (not retryable)
- `provider_unavailable`: Provider temporarily unavailable (retryable)
- `provider_timeout`: Request timeout (retryable)
- `provider_response_error`: Invalid response format (retryable)
- `model_not_available`: Model not found (404) (retryable)
- `ai_internal_error`: Internal error (retryable)
- Chat history sanitized and limited to 10 messages with 4000 character content limit
- Message content limited to 8000 characters
- All AI endpoints require Security Center view permission
- **Redaction**: Secondary AI endpoints redact secrets (tokens, webhooks, connection strings) before sending to provider
- **Context Builder**: Builds safe context for alerts, reports, tickets, and evidence with permission checks
- **Safety Policy**: AI assistant follows safety guidelines to avoid showing secrets
- **Audit Log**: All interactions logged in `SecurityAiInteractionLog` (no full prompts or responses stored)
- **Full prompts and responses are NOT saved** - only metadata (action, status, page, object_type, object_id, request_chars, response_chars, latency_ms, error_message)

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

## Restart dev environment

For local Windows development, restart the Django backend, rebuild the React frontend, and optionally start Vite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\restart_security_center_dev.ps1 -OpenBrowser
powershell -ExecutionPolicy Bypass -File .\scripts\windows\restart_security_center_dev.ps1 -CleanDist -NpmInstall -StartVite -OpenBrowser
```

The script stops listeners on the configured backend/frontend ports, runs frontend build and backend checks, then launches Django in a separate PowerShell window. Use `-StartVite` when working against the Vite dev server.

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
