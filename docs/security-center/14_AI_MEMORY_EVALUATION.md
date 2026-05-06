# AI Memory Retrieval Evaluation

AI-MEMORY-03 adds an internal benchmark for Security Center AI Memory retrieval. It exists to catch RAG regressions before adding real embedding providers or changing pgvector configuration.

This documentation belongs to AI-MEMORY-03. The baseline benchmark was introduced in version 0.11.1 and should be treated as a recommended prerequisite before AI-MEMORY-04 real embedding provider integration.

## Scope

The benchmark measures retrieval quality, not answer quality. It asks synthetic Security Center questions, checks whether the expected synthetic documents/chunks are retrieved, and verifies no-evidence and prompt-injection safety behavior. It does not call external AI or embedding providers.

The versioned synthetic corpus covers:

- Microsoft Defender critical CVEs with exposed devices
- OpenSSL CVSS 9.8 risk
- WatchGuard ThreatSync Low/Closed aggregation
- WatchGuard Firebox SSL VPN anomalies
- NAS/Synology backup failures
- Evidence Container retention
- remediation ticket deduplication
- a report with a specific metric
- malicious prompt-injection document content
- a query with no internal evidence

## Run

```powershell
python manage.py evaluate_ai_memory_retrieval --format text
python manage.py evaluate_ai_memory_retrieval --format json
python manage.py evaluate_ai_memory_retrieval --mode vector_json_fallback --format text
python manage.py evaluate_ai_memory_retrieval --mode hybrid_pgvector --fail-under-hit-at-3 0.70 --fail-under-mrr 0.50
```

Useful options:

- `--mode hybrid_keyword|vector_json_fallback|hybrid_pgvector`
- `--top-k 5`
- `--min-score 0.18`
- `--format text|json`
- `--fail-under-hit-at-3 0.70`
- `--fail-under-mrr 0.50`
- `--include-safety`
- `--rebuild-synthetic-corpus`
- `--dry-run`
- `--output path`

The command creates the synthetic corpus if it is missing. `--rebuild-synthetic-corpus` refreshes only documents with `source_type=ai_memory_evaluation`.

## Metrics

- `hit@k`: whether any expected document appears in the top k retrieved references.
- `MRR`: mean reciprocal rank. A hit at rank 1 scores 1.0, rank 2 scores 0.5, and missing hits score 0.
- `precision@k`: how many top-k retrieved references are expected references, divided by k.
- `recall@k`: how many expected references appear in the top k.
- `insufficient_evidence_accuracy`: whether unsupported cases are correctly treated as insufficient and supported cases are not.
- `prompt_injection_safety_pass_rate`: safety cases must be blocked as malicious input and must not retrieve the malicious document as an instruction.
- `average_latency_ms`: local retrieval timing for the benchmark run.

Conservative regression thresholds:

- `hit@3 >= 0.70`
- `insufficient_evidence_accuracy >= 0.90`
- `prompt_injection_safety_pass_rate = 1.00`

## Safety

The benchmark corpus is synthetic. Reports from the management command omit raw prompts, document snippets, and secret-like placeholders. Malicious document text is marked untrusted and is treated as data for retrieval-safety testing only.

## Interpreting Results

Use `hybrid_keyword` as the SQLite/dev/test baseline. Use `vector_json_fallback` to test deterministic local embeddings without pgvector. Use `hybrid_pgvector` after PostgreSQL pgvector setup to compare production vector retrieval with the baseline.

If answer quality changes but retrieval metrics stay stable, investigate prompt assembly or provider behavior. If retrieval metrics drop, inspect indexing, query normalization, scoring weights, embeddings, pgvector availability, and `AI_MEMORY_MIN_SCORE` first.
