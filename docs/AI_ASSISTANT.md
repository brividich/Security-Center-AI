# AI Assistant

Security Center AI Assistant provides intelligent security analysis and guidance powered by NVIDIA NIM (Llama 3.1 models).

## Architecture

### Provider Abstraction Layer

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

### Current Provider

- **NVIDIA NIM** (Llama 3.1 models)
  - `meta/llama-3.1-70b-instruct` - Complex analysis, reasoning, and chat
  - `meta/llama-3.1-8b-instruct` - Quick suggestions, summaries, and responses

### Planned Providers (Not Yet Implemented)

- OpenAI API
- Azure OpenAI
- Local LLM providers
- Fallback provider support

## Endpoints

### Chat Endpoint

`POST /api/security/ai/chat/`

Chat with the AI assistant.

**Request:**
```json
{
  "message": "Explain this alert",
  "history": [
    {"role": "user", "content": "What is the severity?"},
    {"role": "assistant", "content": "The severity is high."}
  ],
  "context": {
    "page": "alert",
    "object_type": "alert",
    "object_id": "123"
  }
}
```

**Response:**
```json
{
  "message": "This alert indicates...",
  "model": "meta/llama-3.1-70b-instruct",
  "provider": "nvidia_nim",
  "uses_internal_memory": true,
  "source_references": ["SecurityAlert #123 - Example alert"],
  "insufficiency_flags": []
}
```

### Internal AI Memory and RAG

Security Center AI uses retrieval augmented generation plus approved operational memory. It does not fine-tune a model on local data. The memory layer stores:

- `AIKnowledgeDocument` for indexed internal text
- `AIKnowledgeChunk` for deterministic document chunks
- `AIMemoryFact` for approved or draft operational facts
- `AIConversation` and `AIConversationMessage` for persisted chat history metadata/content

The context builder combines approved memory facts, retrieved chunks, optional object context, citations, and insufficiency flags into a stable prompt package. Unapproved memory facts are visible only according to permissions and are not used as authoritative facts.

Core rule: if the context does not contain enough internal evidence for a factual Security Center claim, the assistant must answer `Non ho abbastanza evidenza interna nel Security Center per confermarlo.` The assistant must not invent alert IDs, tickets, CVEs, assets, users, IP addresses, or reports.

AI-MEMORY-02 adds explainable semantic retrieval:

- `hybrid_keyword` is the default and works without embeddings or pgvector.
- `pgvector` uses vector retrieval when PostgreSQL pgvector storage is available and falls back safely.
- `hybrid_pgvector` fuses keyword and vector scores with configurable weights.
- Retrieved documents are untrusted content; instructions inside reports, emails, evidence, or indexed documents are data, not commands.
- `explain=true` on contextual AI endpoints returns safe score components; compact responses omit them.

### AI Patch Documentation

AI-03A - Rich Report Runtime Context is a historical / pre-0.11.0 AI patch line. It added structured report context in `build_ai_messages`, context preview API/UI behavior, redaction and truncation safeguards, and report section references.

AI-03A is not AI-MEMORY-03. AI-MEMORY-03 is the retrieval evaluation and quality benchmark patch introduced in version 0.11.1.

The official AI patch tracker is `docs/security-center/15_AI_PATCH_TRACKER.md`.

### Secondary AI Endpoints

All secondary endpoints redact secrets (tokens, webhooks, connection strings) before sending to the provider.

**Alert Rule Suggestion:**
`POST /api/security/ai/suggest-alert-rule/`

**Report Analysis:**
`POST /api/security/ai/analyze-report/`

**Events Analysis:**
`POST /api/security/ai/analyze-events/`

**Summary Generation:**
`POST /api/security/ai/generate-summary/`

**Memory Indexing:**
`POST /api/security/ai/memory/index/`

Indexes a text document into the internal knowledge base. Requires Security Center view plus manage/admin permissions.

**Memory Rebuild Command:**
`python manage.py rebuild_ai_memory_index --mode all --provider deterministic_hash`

Rebuilds chunks and deterministic local embeddings. It supports `--dry-run`, `--source-type`, `--document-id`, `--reset-embeddings`, `--reset-chunks`, `--batch-size`, and `--mode chunks|embeddings|all`.

**Memory Retrieval Evaluation Command:**
`python manage.py evaluate_ai_memory_retrieval --format text`

Runs the AI-MEMORY-03 synthetic retrieval benchmark. The command creates or refreshes a safe synthetic evaluation corpus when needed, evaluates `hybrid_keyword`, `vector_json_fallback`, or `hybrid_pgvector`, and emits a safe report without raw prompts, snippets, or secret-like placeholders. Use it before and after pgvector or future real embedding-provider work to compare retrieval quality separately from answer quality.

**Memory Facts:**
`GET /api/security/ai/memory/facts/`
`POST /api/security/ai/memory/facts/`

Lists or creates operational memory facts. New facts default to unapproved unless the caller can manage AI memory.

**Explain Alert:**
`POST /api/security/ai/explain-alert/`

Explains an alert from internal context. Missing or unavailable evidence returns the insufficient-evidence message without calling the provider.

**Summarize Evidence:**
`POST /api/security/ai/summarize-evidence/`

Summarizes an Evidence Container using only available internal sources.

**Remediation Plan:**
`POST /api/security/ai/remediation-plan/`

Generates a remediation plan only when internal context is sufficient.

### Operations Endpoints

**Operations Summary:**
`GET /api/security/ai/operations-summary/`

Returns provider status, usage metrics, recent interactions, supported contexts, quick actions, and safety settings.

**Provider Status:**
`GET /api/security/ai/provider-status/`

Returns provider configuration and health status.

## Security

### Redaction

Secondary AI endpoints automatically redact secrets before sending to the provider:
- JWT tokens
- Webhook URLs
- Connection strings
- API keys
- Credentials

### Context Builder

The context builder builds safe context for alerts, reports, tickets, and evidence with permission checks:
- Only users with appropriate permissions receive object context
- Invalid or unauthorized objects return "not found or unavailable" message
- Context is sanitized and limited to prevent information leakage
- Internal AI Memory adds approved facts, retrieved knowledge chunks, citations, and insufficiency flags

### Safety Policy

The AI assistant follows safety guidelines defined in `security/ai/context/safety_policy.md`:
- Does not show secrets
- Does not reveal internal system details
- Provides safe, actionable guidance

### Audit Log

All interactions are logged in `SecurityAiInteractionLog`:
- Action (chat, analyze-report, suggest-alert-rule, etc.)
- Status (success, error, config_error, provider_error)
- Page, object_type, object_id
- Request/response character counts
- Latency
- Error message (redacted)

**Important:** Full prompts and responses are NOT saved - only metadata.

### Permissions

All AI endpoints require `CanViewSecurityCenter` permission.

## Configuration

### Environment Variables

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

### Getting API Key

Get your NVIDIA NIM API key from: https://build.nvidia.com/

## Troubleshooting

### Provider Not Configured

**Symptom:** AI Assistant shows "Provider AI non configurato" or returns 503 with "AI service not configured"

**Solution:**
1. Check that `NVIDIA_NIM_API_KEY` is set in `.env`
2. Ensure the API key is not a placeholder (e.g., "your_nvidia_api_key_here")
3. Restart the Django server after changing `.env`

### AI Service Temporarily Unavailable

**Symptom:** Returns 503 with "AI service temporarily unavailable"

**Possible Causes:**
- Network connectivity issues
- NVIDIA NIM API is down
- Invalid API key
- Rate limiting

**Solution:**
1. Check network connectivity
2. Verify API key is valid
3. Check NVIDIA NIM status at https://build.nvidia.com/
4. Check recent interactions in Operations Center for error details

### Context Not Found

**Symptom:** AI Assistant shows "Contesto attivo: alert #999999" but context is unavailable

**Possible Causes:**
- Object does not exist
- User lacks permission to view the object
- Invalid object_type or object_id

**Solution:**
1. Verify the object exists
2. Check user has appropriate permissions
3. Ensure object_type is one of: alert, report, ticket, evidence

## What is Logged vs Not Logged

### Logged (in SecurityAiInteractionLog)

- Action type (chat, analyze-report, suggest-alert-rule, etc.)
- Status (success, error, config_error, provider_error)
- Provider and model used
- Page, object_type, object_id
- Request/response character counts
- Latency in milliseconds
- Error message (redacted)
- Timestamp
- User (if authenticated)

### NOT Logged

- Full prompts
- Full responses
- API keys
- Secrets
- Raw error details

## Limitations

### Current Limitations

- No OpenAI/Azure provider support (only NVIDIA NIM)
- AI Memory retrieval is keyword/ORM based; vector embeddings and pgvector/Qdrant/Chroma are deferred
- No advanced multi-tenant/object-level ACL beyond current model-level controls
- No automatic remediation
- No token-by-token streaming (responses are returned as complete messages)
- gitleaks is optional/not required if not installed

### Security Boundaries

- AI cannot modify data (read-only analysis)
- AI cannot execute actions
- AI cannot access secrets
- AI cannot bypass permission checks
- AI responses are not automatically applied

## Legacy Code

`security/services/nvidia_nim_service.py` is a legacy compatibility wrapper retained for test compatibility only. All new code should use the AI Gateway abstraction layer (`security/ai/services/ai_gateway.py`).
