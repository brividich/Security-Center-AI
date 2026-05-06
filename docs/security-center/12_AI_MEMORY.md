# AI Memory and Knowledge Base

Security Center AI Memory is an internal RAG layer for SOC/IT assistance. It is not fine-tuning. It stores approved operational facts and indexed internal knowledge in the Django database, retrieves relevant chunks at request time, and gives the provider a bounded context package with citations.

## Scope

The memory layer supports:

- Persistent knowledge documents and deterministic chunks
- Approved operational memory facts
- Conversation and message persistence models
- Hybrid keyword retrieval with explainable score components
- Optional deterministic embeddings and vector retrieval fallback
- Internal citations for documents, alerts, tickets, reports, and Evidence Containers
- Insufficiency flags when internal evidence is missing

## Patch History

- AI-MEMORY-01 - base internal memory and RAG layer with approved facts, indexed knowledge, citations, and no-evidence/no-invention behavior.
- AI-MEMORY-02 - semantic retrieval upgrade with hybrid keyword scoring, deterministic local embeddings, optional pgvector, JSON cosine fallback, and retrieval diagnostics.
- AI-MEMORY-03 - retrieval evaluation and quality benchmarks for the synthetic Security Center corpus.
- AI-MEMORY-02C - post-review retrieval cleanup, including consistent `context_affinity_boost` score component naming.
- AI-MEMORY-SEC-01 - Memory API, explain response, source redaction, insufficiency flag, and permission hardening.
- AI-MEMORY-04 - planned real embedding provider integration after benchmark baselines are reviewed.

AI-03A is separate from AI-MEMORY-03. AI-03A covered Rich Report Runtime Context work, while AI-MEMORY-03 covers retrieval benchmarks and evaluation.

## No Evidence, No Invention

For factual claims about Security Center data, the assistant must use only the context supplied by the backend. If the backend cannot provide enough internal evidence, the assistant must say:

`Non ho abbastanza evidenza interna nel Security Center per confermarlo.`

It must not invent alert IDs, ticket state, CVEs, assets, users, IP addresses, reports, or remediation status.

## Seed

Create default approved operational memory facts:

```powershell
python manage.py seed_ai_memory
```

The seed uses synthetic policy facts only and does not ingest real report data.

## Retrieval Modes

`AI_MEMORY_RETRIEVAL_MODE` supports:

- `hybrid_keyword`: default for dev/test; exact phrase, token overlap, title, metadata, source type, context-object affinity, and recency scoring.
- `pgvector`: vector retrieval when PostgreSQL pgvector is configured; falls back to keyword when unavailable.
- `hybrid_pgvector`: fuses keyword and vector scores with `AI_MEMORY_KEYWORD_WEIGHT` and `AI_MEMORY_VECTOR_WEIGHT`.

Related settings:

```env
AI_MEMORY_EMBEDDINGS_ENABLED=false
AI_MEMORY_EMBEDDING_DIMENSIONS=384
AI_MEMORY_MIN_SCORE=0.18
AI_MEMORY_VECTOR_TOP_K=10
AI_MEMORY_KEYWORD_TOP_K=10
AI_MEMORY_VECTOR_WEIGHT=0.60
AI_MEMORY_KEYWORD_WEIGHT=0.40
```

## Rebuild Index

```powershell
python manage.py rebuild_ai_memory_index --mode all --provider deterministic_hash
```

Useful options:

- `--dry-run`
- `--source-type`
- `--document-id`
- `--reset-embeddings`
- `--reset-chunks`
- `--batch-size`
- `--mode chunks|embeddings|all`

The deterministic provider is local and stable for development and tests. No external embedding provider is called by tests.

## Retrieval Evaluation

AI-MEMORY-03 adds a synthetic benchmark for retrieval quality. It is intentionally separate from answer quality: the benchmark checks whether the retriever finds the expected internal chunks, not whether a language model writes a good final answer.

```powershell
python manage.py evaluate_ai_memory_retrieval --format text
python manage.py evaluate_ai_memory_retrieval --mode vector_json_fallback --format json
python manage.py evaluate_ai_memory_retrieval --mode hybrid_pgvector --fail-under-hit-at-3 0.70 --fail-under-mrr 0.50
```

The corpus is synthetic and covers Defender critical CVEs, WatchGuard ThreatSync, Firebox SSL VPN, Synology backup failures, Evidence Containers, remediation tickets, a specific report metric, prompt-injection content, and unsupported queries. Reports include hit@1/3/5, mean reciprocal rank, precision@5, recall, insufficient-evidence accuracy, prompt-injection safety pass rate, and latency. Conservative defaults require hit@3 >= 0.70, insufficient-evidence accuracy >= 0.90, and prompt-injection safety pass rate = 1.00.

## Planned Features

AI-MEMORY-04 is planned for real embedding provider integration. It should be implemented only after AI-MEMORY-03 benchmark baselines have been run and reviewed so provider behavior can be compared against `hybrid_keyword`, `vector_json_fallback`, and `hybrid_pgvector` results.

AI-MEMORY-04 must keep pgvector optional, preserve JSON/SQLite fallback behavior, and avoid storing or documenting real provider secrets or operational report data.

## API

- `POST /api/security/ai/memory/index/`
- `GET /api/security/ai/memory/facts/`
- `POST /api/security/ai/memory/facts/`
- `POST /api/security/ai/explain-alert/`
- `POST /api/security/ai/summarize-evidence/`
- `POST /api/security/ai/remediation-plan/`

The same memory endpoints are also exposed under `/security/api/ai/...` for compatibility with Security Center URL conventions.

## Limits

- SQLite/dev/test use keyword retrieval and JSON cosine fallback.
- pgvector is optional and detected at runtime.
- If pgvector is missing, `pgvector_unavailable` or `missing_embeddings` flags are reported and fallback retrieval remains available.
- Tests use local data and mock provider responses.
- The UI shows memory usage, retrieval mode, source references, and insufficient-evidence warnings, but it is intentionally minimal.

## Security Hardening (AI-MEMORY-SEC-01)

The memory API includes several security hardening measures to protect sensitive data and prevent abuse:

### Rate Limiting

The `POST /api/security/ai/memory/index/` endpoint is rate-limited per authenticated user to prevent abuse:

```env
SECURITY_AI_MEMORY_INDEX_RATE=10/m
```

Default: 10 requests per minute per user. When the limit is exceeded, the API returns HTTP 429 with a safe error message that does not expose request content.

### Insufficiency Flags Whitelist

Only whitelisted `insufficiency_flags` are exposed in API responses:

- `requested_object_context_unavailable`
- `missing_context_object`
- `insufficient_internal_evidence`
- `no_approved_memory_facts`
- `no_results`
- `below_min_score`
- `ambiguous_results`
- `unsupported_claim_request`

Arbitrary or malformed flags are filtered out before being sent to the frontend.

### Source Redaction

The `source` field in `AIMemoryFact` is automatically redacted when created via the API. Sensitive patterns are replaced with `[REDACTED]`:

- Email addresses
- IP addresses
- API keys and tokens
- URLs with embedded credentials
- JWT tokens
- Webhook URLs

### Source References Sanitization

For users without `manage_security_configuration` permission, source references are sanitized to hide sensitive metadata:

- Document IDs
- Chunk IDs
- Full document titles
- Source paths
- Original filenames
- Email subjects

Non-manager users see generic labels like `Internal source #1` instead of detailed references.

### Redaction Patterns

The redaction service includes patterns for:

- Bearer and Basic auth tokens
- JWT tokens
- API keys (OpenAI, Stripe, Google, etc.)
- Email addresses
- IP addresses
- URLs with credentials
- Webhook URLs
- Password/secret fields

## Validation

Relevant checks:

```powershell
python manage.py check
python manage.py test security.tests.test_ai_memory
python manage.py test security.tests
python manage.py test
python manage.py makemigrations --check --dry-run
cd frontend
npm run build
```
