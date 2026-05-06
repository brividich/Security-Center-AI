# AI Retrieval and Optional pgvector

AI-MEMORY-02 keeps SQLite/dev/test usable while allowing PostgreSQL production deployments to add pgvector.

This documentation belongs to AI-MEMORY-02. The AI-MEMORY-02C cleanup later aligned retrieval explainability naming by standardizing the context-object score component as `context_affinity_boost`.

pgvector remains optional. JSON cosine search and SQLite-compatible fallback retrieval remain supported quality gates for development and tests.

## Modes

- `hybrid_keyword`: default. Uses keyword, title, metadata, source type, context affinity, and recency scoring.
- `pgvector`: uses vector search when available, with keyword fallback.
- `hybrid_pgvector`: fuses keyword and vector scores. Recommended for PostgreSQL production.

## Safe Defaults

```env
AI_MEMORY_RETRIEVAL_MODE=hybrid_keyword
AI_MEMORY_EMBEDDINGS_ENABLED=false
AI_MEMORY_EMBEDDING_DIMENSIONS=384
AI_MEMORY_MIN_SCORE=0.18
AI_MEMORY_VECTOR_TOP_K=10
AI_MEMORY_KEYWORD_TOP_K=10
AI_MEMORY_VECTOR_WEIGHT=0.60
AI_MEMORY_KEYWORD_WEIGHT=0.40
```

## Build Embeddings

```powershell
python manage.py rebuild_ai_memory_index --mode all --provider deterministic_hash
```

The deterministic provider is local, stable, and used by tests. It makes no network calls.

## PostgreSQL pgvector Enablement

Install the PostgreSQL `vector` extension on the database host and enable it in the target database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Security Center stores embeddings in portable JSON by default. To enable raw pgvector retrieval, add an optional column that matches `AI_MEMORY_EMBEDDING_DIMENSIONS`:

```sql
ALTER TABLE security_aiknowledgeembedding
ADD COLUMN IF NOT EXISTS vector_embedding vector(384);
```

Optional approximate index:

```sql
CREATE INDEX IF NOT EXISTS security_ai_embedding_hnsw
ON security_aiknowledgeembedding
USING hnsw (vector_embedding vector_cosine_ops);
```

Then set:

```env
AI_MEMORY_RETRIEVAL_MODE=hybrid_pgvector
AI_MEMORY_EMBEDDINGS_ENABLED=true
```

Run the rebuild command after enabling the column so existing JSON embeddings are synced to pgvector storage.

## Benchmark Before and After pgvector

Use the AI-MEMORY-03 retrieval benchmark before enabling pgvector, after enabling pgvector, and again after any future real embedding-provider change:

```powershell
python manage.py evaluate_ai_memory_retrieval --mode hybrid_keyword --format text
python manage.py evaluate_ai_memory_retrieval --mode vector_json_fallback --format text
python manage.py evaluate_ai_memory_retrieval --mode hybrid_pgvector --format text
```

`vector_json_fallback` measures deterministic local vector retrieval through portable JSON cosine search. `hybrid_pgvector` uses pgvector when available and falls back safely when it is not. Compare hit@3, MRR, precision@5, insufficient-evidence accuracy, and prompt-injection safety pass rate. The benchmark does not call external providers and does not require pgvector, so SQLite/dev/test remain valid quality gates.

## Fallback Behavior

If the Python `pgvector` package, PostgreSQL extension, database column, or embeddings are missing, the application does not fail at model import or startup. Retrieval reports safe flags such as `pgvector_unavailable` or `missing_embeddings` and continues with keyword or JSON cosine fallback.

## Prompt Injection Boundary

Retrieved documents are untrusted content. Instructions inside reports, emails, evidence, or indexed knowledge are treated as data only. System and application policy always win, and the no-evidence/no-invention rule remains in force.
