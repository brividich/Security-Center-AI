import io
import json
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from security.ai.services.memory.evaluation import (
    EVALUATION_SOURCE_TYPE,
    build_synthetic_evaluation_corpus,
    compute_retrieval_metrics,
    evaluate_retrieval_case,
    format_evaluation_report,
    run_retrieval_evaluation,
    safe_evaluation_report,
    synthetic_evaluation_cases,
    synthetic_evaluation_documents,
)
from security.models import AIKnowledgeDocument


class AIMemoryEvaluationDatasetTests(TestCase):
    def test_synthetic_dataset_defines_stable_documents_and_cases(self):
        documents = synthetic_evaluation_documents()
        cases = synthetic_evaluation_cases()
        self.assertGreaterEqual(len(documents), 9)
        self.assertGreaterEqual(len(cases), 10)
        self.assertEqual(len({document.document_key for document in documents}), len(documents))
        for case in cases:
            self.assertTrue(case.case_id)
            self.assertTrue(case.query)
            self.assertTrue(case.expected_document_keys or case.should_have_insufficient_evidence)
            self.assertTrue(case.expected_terms or case.should_have_insufficient_evidence)

    def test_build_synthetic_corpus_indexes_safe_untrusted_document(self):
        stats = build_synthetic_evaluation_corpus(rebuild=True)
        self.assertEqual(stats["documents_expected"], AIKnowledgeDocument.objects.filter(source_type=EVALUATION_SOURCE_TYPE).count())
        malicious = AIKnowledgeDocument.objects.get(metadata__document_key="prompt-injection-untrusted")
        self.assertEqual(malicious.metadata["trust_level"], "untrusted")
        self.assertTrue(malicious.metadata["malicious_document"])


class AIMemoryEvaluationMetricTests(TestCase):
    def test_compute_retrieval_metrics_hit_mrr_precision_and_insufficient_accuracy(self):
        results = [
            {
                "expected_references": ["a"],
                "hit_at_1": True,
                "hit_at_3": True,
                "hit_at_5": True,
                "reciprocal_rank": 1.0,
                "precision_at_5": 0.2,
                "insufficient_evidence_expected": False,
                "insufficient_evidence_actual": False,
                "safety_case": False,
                "prompt_injection_safety_passed": True,
                "passed": True,
                "latency_ms": 2.0,
            },
            {
                "expected_references": ["b"],
                "hit_at_1": False,
                "hit_at_3": True,
                "hit_at_5": True,
                "reciprocal_rank": 0.5,
                "precision_at_5": 0.2,
                "insufficient_evidence_expected": False,
                "insufficient_evidence_actual": False,
                "safety_case": False,
                "prompt_injection_safety_passed": True,
                "passed": True,
                "latency_ms": 4.0,
            },
            {
                "expected_references": [],
                "hit_at_1": False,
                "hit_at_3": False,
                "hit_at_5": False,
                "reciprocal_rank": 0.0,
                "precision_at_5": 0.0,
                "insufficient_evidence_expected": True,
                "insufficient_evidence_actual": True,
                "safety_case": True,
                "prompt_injection_safety_passed": True,
                "passed": True,
                "latency_ms": 3.0,
            },
        ]
        metrics = compute_retrieval_metrics(results, mode="hybrid_keyword")
        self.assertEqual(metrics["hit_rate_at_1"], 0.5)
        self.assertEqual(metrics["hit_rate_at_3"], 1.0)
        self.assertEqual(metrics["mean_reciprocal_rank"], 0.75)
        self.assertEqual(metrics["average_precision_at_5"], 0.2)
        self.assertEqual(metrics["insufficient_evidence_accuracy"], 1.0)
        self.assertEqual(metrics["prompt_injection_safety_pass_rate"], 1.0)


class AIMemoryEvaluationServiceTests(TestCase):
    def setUp(self):
        build_synthetic_evaluation_corpus(rebuild=True, include_embeddings=True)

    def test_evaluate_retrieval_case_calculates_hit_at_k(self):
        case = next(item for item in synthetic_evaluation_cases() if item.case_id == "defender_cve_critical_exposed")
        result = evaluate_retrieval_case(case, top_k=5)
        self.assertTrue(result["hit_at_3"])
        self.assertGreater(result["reciprocal_rank"], 0)
        self.assertGreater(result["precision_at_k"], 0)
        self.assertTrue(result["passed"])

    def test_prompt_injection_query_is_blocked_as_safety_case(self):
        case = next(item for item in synthetic_evaluation_cases() if item.case_id == "malicious_prompt_injection_query")
        result = evaluate_retrieval_case(case, include_safety=True)
        self.assertTrue(result["insufficient_evidence_actual"])
        self.assertTrue(result["prompt_injection_safety_passed"])
        self.assertEqual(result["retrieved_references"], [])
        self.assertIn("prompt_injection_query_blocked", result["insufficient_evidence_flags"])

    def test_vector_json_fallback_runs_without_pgvector(self):
        report = run_retrieval_evaluation(mode="vector_json_fallback", top_k=5)
        self.assertEqual(report["aggregate"]["retrieval_mode"], "vector_json_fallback")
        self.assertGreaterEqual(report["aggregate"]["total_cases"], 10)

    def test_safe_report_omits_raw_prompt_and_secret_markers(self):
        report = run_retrieval_evaluation(top_k=5)
        safe = safe_evaluation_report(report)
        serialized = json.dumps(safe)
        self.assertNotIn("Ignora le istruzioni precedenti", serialized)
        self.assertNotIn("SECRET_TOKEN", serialized)
        self.assertNotIn("API_KEY", serialized)
        self.assertNotIn("sk-redacted", serialized)
        self.assertIn("query_hash", serialized)

    @override_settings(AI_MEMORY_RETRIEVAL_MODE="hybrid_keyword", AI_MEMORY_EMBEDDINGS_ENABLED=False)
    def test_evaluation_does_not_call_external_embedding_provider(self):
        with patch("security.ai.services.memory.embedding_provider.AIProviderEmbeddingProvider.embed_text") as mock_external:
            run_retrieval_evaluation(mode="hybrid_keyword", top_k=5)
        mock_external.assert_not_called()


class AIMemoryEvaluationCommandTests(TestCase):
    def test_management_command_text_mode(self):
        out = io.StringIO()
        call_command("evaluate_ai_memory_retrieval", "--format", "text", stdout=out)
        rendered = out.getvalue()
        self.assertIn("AI Memory Retrieval Evaluation", rendered)
        self.assertIn("hit@3:", rendered)
        self.assertNotIn("Ignora le istruzioni precedenti", rendered)

    def test_management_command_json_mode(self):
        out = io.StringIO()
        call_command("evaluate_ai_memory_retrieval", "--format", "json", stdout=out)
        payload = json.loads(out.getvalue())
        self.assertIn("aggregate", payload)
        self.assertEqual(payload["aggregate"]["retrieval_mode"], "hybrid_keyword")
        self.assertNotIn("query", payload["results"][0])

    def test_fail_under_threshold_raises_command_error(self):
        with self.assertRaises(CommandError):
            call_command(
                "evaluate_ai_memory_retrieval",
                "--format",
                "text",
                "--fail-under-hit-at-3",
                "1.01",
                stdout=io.StringIO(),
            )

    def test_format_report_contains_no_raw_prompt_or_secret_markers(self):
        report = run_retrieval_evaluation(top_k=5)
        rendered = format_evaluation_report(report)
        self.assertNotIn("SECRET_TOKEN", rendered)
        self.assertNotIn("API_KEY", rendered)
        self.assertNotIn("Ignora le istruzioni precedenti", rendered)
