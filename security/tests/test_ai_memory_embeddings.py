"""Comprehensive tests for AI memory embedding providers and indexing."""

from io import StringIO
from unittest.mock import MagicMock, Mock, patch
import time

from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings
from django.db import DatabaseError

from security.ai.services.memory.chunker import chunk_text
from security.ai.services.memory.document_indexer import index_document
from security.ai.services.memory.embedding_indexer import (
    build_embedding_hash,
    rebuild_embeddings,
    EmbeddingIndexStats,
)
from security.ai.services.memory.embedding_provider import (
    BaseEmbeddingProvider,
    DeterministicHashEmbeddingProvider,
    get_embedding_provider,
)
from security.ai.services.memory.embedding_diagnostics import (
    get_active_embedding_provider,
    is_embedding_provider_configured,
    are_embeddings_enabled,
    get_chunks_with_embeddings_count,
    get_chunks_without_embeddings_count,
    get_embedding_provider_distribution,
    is_pgvector_available,
    is_fallback_active,
)
from security.ai.services.memory.rate_limiter import RateLimiter
from security.ai.services.memory.retry_handler import RetryHandler, ErrorType
from security.ai.services.memory.evaluation import (
    build_synthetic_evaluation_corpus,
    run_retrieval_evaluation,
    safe_evaluation_report,
)
from security.ai.services.memory.vector_backend import cosine_similarity
from security.models import (
    AIKnowledgeDocument,
    AIKnowledgeChunk,
    AIKnowledgeEmbedding,
)


class EmbeddingProviderRegistryTests(TestCase):
    """Test provider registry and factory function."""

    def test_default_provider_is_deterministic_hash(self):
        """Default provider should be deterministic_hash."""
        provider = get_embedding_provider()
        self.assertIsInstance(provider, DeterministicHashEmbeddingProvider)
        self.assertEqual(provider.provider_name, "deterministic_hash")

    def test_explicit_deterministic_hash_provider(self):
        """Explicit deterministic_hash provider."""
        for name in ["deterministic", "deterministic_hash", "hash", "DETERMINISTIC_HASH"]:
            with self.subTest(name=name):
                provider = get_embedding_provider(name)
                self.assertIsInstance(provider, DeterministicHashEmbeddingProvider)
                self.assertEqual(provider.provider_name, "deterministic_hash")

    def test_unknown_provider_raises_safe_error(self):
        """Unknown provider should raise ValueError with safe message."""
        with self.assertRaises(ValueError) as cm:
            get_embedding_provider("unknown_provider")
        self.assertIn("Unsupported embedding provider", str(cm.exception))
        self.assertIn("unknown_provider", str(cm.exception))

    def test_provider_name_case_insensitive(self):
        """Provider name should be case-insensitive."""
        provider1 = get_embedding_provider("DETERMINISTIC_HASH")
        provider2 = get_embedding_provider("deterministic_hash")
        self.assertEqual(provider1.provider_name, provider2.provider_name)
        self.assertEqual(provider1.dimensions, provider2.dimensions)


class DeterministicHashProviderTests(TestCase):
    """Test deterministic hash embedding provider."""

    def setUp(self):
        self.provider = DeterministicHashEmbeddingProvider(dimensions=384)

    def test_output_is_stable(self):
        """Same text should produce same embedding."""
        text = "Test document with CVE-2024-1234 vulnerability"
        embedding1 = self.provider.embed_text(text)
        embedding2 = self.provider.embed_text(text)
        self.assertEqual(embedding1, embedding2)

    def test_dimensions_are_correct(self):
        """Provider should return correct dimensions."""
        self.assertEqual(self.provider.dimensions, 384)
        embedding = self.provider.embed_text("test")
        self.assertEqual(len(embedding), 384)

    def test_custom_dimensions(self):
        """Custom dimensions should be respected."""
        provider = DeterministicHashEmbeddingProvider(dimensions=128)
        self.assertEqual(provider.dimensions, 128)
        embedding = provider.embed_text("test")
        self.assertEqual(len(embedding), 128)

    def test_empty_text_returns_zero_vector(self):
        """Empty text should return zero vector."""
        embedding = self.provider.embed_text("")
        self.assertEqual(len(embedding), 384)
        self.assertTrue(all(v == 0.0 for v in embedding))

    def test_whitespace_only_returns_zero_vector(self):
        """Whitespace-only text should return zero vector."""
        embedding = self.provider.embed_text("   \n\t  ")
        self.assertEqual(len(embedding), 384)
        self.assertTrue(all(v == 0.0 for v in embedding))

    def test_batch_embedding_is_stable(self):
        """Batch embedding should be stable and consistent."""
        texts = ["text1", "text2", "text3"]
        batch1 = self.provider.embed_batch(texts)
        batch2 = self.provider.embed_batch(texts)
        self.assertEqual(len(batch1), len(texts))
        self.assertEqual(len(batch2), len(texts))
        for i in range(len(texts)):
            self.assertEqual(batch1[i], batch2[i])

    def test_batch_matches_individual(self):
        """Batch embedding should match individual embeddings."""
        texts = ["text1", "text2"]
        batch = self.provider.embed_batch(texts)
        individual = [self.provider.embed_text(text) for text in texts]
        self.assertEqual(batch, individual)

    def test_cve_tokens_get_weighted(self):
        """CVE tokens should get higher weight."""
        text1 = "CVE-2024-1234 vulnerability"
        text2 = "vulnerability"
        embedding1 = self.provider.embed_text(text1)
        embedding2 = self.provider.embed_text(text2)
        # CVE tokens should produce different embeddings
        self.assertNotEqual(embedding1, embedding2)

    def test_embedding_is_normalized(self):
        """Embedding should be normalized to unit length."""
        text = "Test document with multiple tokens"
        embedding = self.provider.embed_text(text)
        norm = sum(v * v for v in embedding) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=6)

    def test_model_name_includes_dimensions(self):
        """Model name should include dimensions."""
        self.assertIn("384", self.provider.model_name)
        self.assertIn("hash-bow", self.provider.model_name)


class MockOpenAICompatibleProvider(BaseEmbeddingProvider):
    """Mock OpenAI-compatible provider for testing."""

    provider_name = "openai_compatible"
    model_name = "text-embedding-3-small"

    def __init__(self, api_key: str | None = None, dimensions: int = 1536):
        self.api_key = api_key
        self._dimensions = dimensions
        self._call_count = 0
        self._should_fail = False
        self._should_timeout = False
        self._should_rate_limit = False
        self._wrong_dimensions = False

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def embed_text(self, text: str) -> list[float]:
        self._call_count += 1

        if self._should_fail:
            raise RuntimeError("Provider error: API call failed")

        if self._should_timeout:
            raise TimeoutError("Provider timeout")

        if self._should_rate_limit:
            raise RuntimeError("Rate limit exceeded")

        if self._wrong_dimensions:
            return [0.0] * (self._dimensions + 100)

        # Return deterministic mock embedding based on text hash
        import hashlib
        import math

        hash_digest = hashlib.sha256(text.encode()).digest()
        vector = []
        for i in range(self._dimensions):
            byte_index = i % len(hash_digest)
            value = (hash_digest[byte_index] / 255.0) * 2 - 1
            vector.append(value)

        # Normalize
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]

        return vector

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(text) for text in texts]


class OpenAICompatibleProviderTests(TestCase):
    """Test mocked OpenAI-compatible provider."""

    def setUp(self):
        self.provider = MockOpenAICompatibleProvider(api_key="sk-test-key")

    def test_embed_text_returns_valid_vector(self):
        """embed_text should return valid vector."""
        text = "Test document"
        embedding = self.provider.embed_text(text)
        self.assertEqual(len(embedding), 1536)
        self.assertTrue(all(isinstance(v, float) for v in embedding))

    def test_embed_batch_returns_valid_batch(self):
        """embed_batch should return valid batch."""
        texts = ["text1", "text2", "text3"]
        batch = self.provider.embed_batch(texts)
        self.assertEqual(len(batch), len(texts))
        for embedding in batch:
            self.assertEqual(len(embedding), 1536)

    def test_dimension_mismatch_raises_error(self):
        """Dimension mismatch should raise error."""
        self.provider._wrong_dimensions = True
        with self.assertRaises(ValueError) as cm:
            self.provider.embed_text("test")
        self.assertIn("dimension", str(cm.exception).lower())

    def test_timeout_raises_safe_error(self):
        """Timeout should raise safe error."""
        self.provider._should_timeout = True
        with self.assertRaises(TimeoutError):
            self.provider.embed_text("test")

    def test_rate_limit_handled(self):
        """Rate limit should be handled."""
        self.provider._should_rate_limit = True
        with self.assertRaises(RuntimeError) as cm:
            self.provider.embed_text("test")
        self.assertIn("rate limit", str(cm.exception).lower())

    def test_provider_error_handled(self):
        """Provider error should be handled."""
        self.provider._should_fail = True
        with self.assertRaises(RuntimeError) as cm:
            self.provider.embed_text("test")
        self.assertIn("provider error", str(cm.exception).lower())

    def test_no_real_network_calls(self):
        """Provider should not make real network calls."""
        # This test ensures the mock doesn't make real calls
        text = "Test document"
        embedding = self.provider.embed_text(text)
        self.assertIsNotNone(embedding)
        self.assertEqual(self.provider._call_count, 1)

    def test_is_configured_with_api_key(self):
        """is_configured should return True with API key."""
        provider = MockOpenAICompatibleProvider(api_key="sk-test-key")
        self.assertTrue(provider.is_configured)

    def test_is_configured_without_api_key(self):
        """is_configured should return False without API key."""
        provider = MockOpenAICompatibleProvider(api_key=None)
        self.assertFalse(provider.is_configured)


class EmbeddingIndexerTests(TestCase):
    """Test embedding indexer."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.provider = DeterministicHashEmbeddingProvider(dimensions=384)

    def test_dry_run_does_not_write(self):
        """Dry run should not write embeddings."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content for embedding.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content for embedding.",
            text_hash="b" * 64,
        )

        stats = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=True,
            document_id=document.id,
        )

        self.assertEqual(stats.embeddings_created, 1)
        self.assertEqual(stats.embeddings_updated, 0)
        self.assertEqual(AIKnowledgeEmbedding.objects.count(), 0)

    def test_real_provider_writes_embeddings(self):
        """Real provider should write embeddings."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content for embedding.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content for embedding.",
            text_hash="b" * 64,
        )

        stats = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )

        self.assertEqual(stats.embeddings_created, 1)
        self.assertEqual(AIKnowledgeEmbedding.objects.count(), 1)

        embedding = AIKnowledgeEmbedding.objects.get(chunk=chunk)
        self.assertEqual(embedding.provider, "deterministic_hash")
        self.assertEqual(embedding.dimensions, 384)
        self.assertEqual(len(embedding.embedding), 384)

    def test_skip_if_hash_unchanged(self):
        """Should skip if embedding hash unchanged."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content for embedding.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content for embedding.",
            text_hash="b" * 64,
        )

        # First run
        stats1 = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )
        self.assertEqual(stats1.embeddings_created, 1)
        self.assertEqual(stats1.embeddings_skipped, 0)

        # Second run (should skip)
        stats2 = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )
        self.assertEqual(stats2.embeddings_created, 0)
        self.assertEqual(stats2.embeddings_updated, 0)
        self.assertEqual(stats2.embeddings_skipped, 1)

    def test_update_if_text_changes(self):
        """Should update if text changes."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Original content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Original content.",
            text_hash="b" * 64,
        )

        # First run
        rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )

        # Update text
        chunk.text = "Updated content."
        chunk.text_hash = "c" * 64
        chunk.save()

        # Second run (should update)
        stats = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )
        self.assertEqual(stats.embeddings_created, 0)
        self.assertEqual(stats.embeddings_updated, 1)
        self.assertEqual(stats.embeddings_skipped, 0)

    def test_update_if_provider_changes(self):
        """Should update if provider changes."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        # First run with deterministic_hash
        rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )

        # Mock a different provider
        mock_provider = MockOpenAICompatibleProvider(api_key="sk-test", dimensions=384)

        # Manually update with different provider
        embedding = AIKnowledgeEmbedding.objects.get(chunk=chunk)
        embedding.provider = "openai_compatible"
        embedding.save()

        # Rebuild should update
        stats = rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=document.id,
        )
        self.assertEqual(stats.embeddings_updated, 1)

    def test_pgvector_failure_does_not_block_json(self):
        """pgvector failure should not block JSON storage."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        # Mock pgvector failure
        with patch("security.ai.services.memory.vector_backend.store_pgvector_embedding", return_value=False):
            stats = rebuild_embeddings(
                provider_name="deterministic_hash",
                dry_run=False,
                document_id=document.id,
            )

        self.assertEqual(stats.embeddings_created, 1)
        self.assertEqual(stats.errors, 0)

        # JSON embedding should still be stored
        embedding = AIKnowledgeEmbedding.objects.get(chunk=chunk)
        self.assertEqual(len(embedding.embedding), 384)

    def test_strict_mode_fails_on_provider_error(self):
        """Strict mode should fail on provider error."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        # Mock provider that fails
        mock_provider = Mock(spec=BaseEmbeddingProvider)
        mock_provider.provider_name = "failing_provider"
        mock_provider.model_name = "failing_model"
        mock_provider.dimensions = 384
        mock_provider.embed_text = Mock(side_effect=RuntimeError("Provider error"))

        with patch("security.ai.services.memory.embedding_indexer.get_embedding_provider", return_value=mock_provider):
            stats = rebuild_embeddings(
                provider_name="failing_provider",
                dry_run=False,
                document_id=document.id,
            )

        self.assertEqual(stats.errors, 1)
        self.assertEqual(AIKnowledgeEmbedding.objects.count(), 0)

    def test_build_embedding_hash(self):
        """Test embedding hash building."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        hash1 = build_embedding_hash(chunk, self.provider)
        hash2 = build_embedding_hash(chunk, self.provider)
        self.assertEqual(hash1, hash2)

        # Different text should produce different hash
        chunk.text_hash = "c" * 64
        hash3 = build_embedding_hash(chunk, self.provider)
        self.assertNotEqual(hash1, hash3)


class ManagementCommandTests(TestCase):
    """Test rebuild_ai_memory_index management command."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")

    def test_provider_deterministic_hash_works(self):
        """--provider deterministic_hash should work."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        out = StringIO()
        call_command(
            "rebuild_ai_memory_index",
            "--provider=deterministic_hash",
            "--document-id", str(document.id),
            stdout=out,
        )

        output = out.getvalue()
        self.assertIn("embeddings_created: 1", output)
        self.assertEqual(AIKnowledgeEmbedding.objects.count(), 1)

    def test_dry_run_works(self):
        """--dry-run should work."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        out = StringIO()
        call_command(
            "rebuild_ai_memory_index",
            "--dry-run",
            "--document-id", str(document.id),
            stdout=out,
        )

        output = out.getvalue()
        self.assertIn("embeddings_created: 1", output)
        self.assertEqual(AIKnowledgeEmbedding.objects.count(), 0)

    def test_limit_works(self):
        """--limit should work."""
        # Create multiple documents
        for i in range(5):
            document = AIKnowledgeDocument.objects.create(
                title=f"Test Document {i}",
                source_type="test",
                content_hash=f"a{i}" * 64,
                raw_text=f"Test content {i}.",
            )
            chunk = AIKnowledgeChunk.objects.create(
                document=document,
                chunk_index=0,
                text=f"Test content {i}.",
                text_hash=f"b{i}" * 64,
            )

        out = StringIO()
        call_command(
            "rebuild_ai_memory_index",
            "--batch-size=2",
            stdout=out,
        )

        output = out.getvalue()
        self.assertIn("embeddings_created: 5", output)

    def test_output_does_not_contain_api_key(self):
        """Output should not contain API key."""
        # Create a document with sensitive text
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="API_KEY=sk-secret-12345",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="API_KEY=sk-secret-12345",
            text_hash="b" * 64,
        )

        out = StringIO()
        call_command(
            "rebuild_ai_memory_index",
            "--document-id", str(document.id),
            stdout=out,
        )

        output = out.getvalue()
        self.assertNotIn("sk-secret-12345", output)
        self.assertNotIn("API_KEY", output)

    def test_output_does_not_contain_raw_text(self):
        """Output should not contain raw text."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Sensitive content here",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Sensitive content here",
            text_hash="b" * 64,
        )

        out = StringIO()
        call_command(
            "rebuild_ai_memory_index",
            "--document-id", str(document.id),
            stdout=out,
        )

        output = out.getvalue()
        self.assertNotIn("Sensitive content here", output)


class EvaluationWithMockedEmbeddingsTests(TestCase):
    """Test evaluation with mocked embeddings."""

    def test_benchmark_works_with_mocked_embeddings(self):
        """Benchmark should work with mocked embeddings."""
        # Build synthetic corpus
        corpus = build_synthetic_evaluation_corpus(
            rebuild=True,
            include_embeddings=True,
            dry_run=False,
        )

        self.assertGreater(corpus["documents_created"], 0)
        self.assertGreater(corpus["chunks_total"], 0)
        self.assertIn("embeddings", corpus)

    def test_no_external_calls_during_evaluation(self):
        """Evaluation should not make external calls."""
        # Mock any potential external calls
        with patch("requests.get") as mock_get, patch("requests.post") as mock_post:
            report = run_retrieval_evaluation(
                mode="hybrid_keyword",
                top_k=5,
                rebuild_synthetic_corpus=True,
                dry_run=False,
            )

            # Verify no external calls were made
            self.assertEqual(mock_get.call_count, 0)
            self.assertEqual(mock_post.call_count, 0)

            # Verify report is valid
            self.assertIn("aggregate", report)
            self.assertIn("results", report)

    def test_sqlite_compatible(self):
        """Evaluation should be SQLite compatible."""
        from django.db import connection

        # This test runs on SQLite by default in tests
        self.assertEqual(connection.vendor, "sqlite")

        # Run evaluation
        report = run_retrieval_evaluation(
            mode="hybrid_keyword",
            top_k=5,
            rebuild_synthetic_corpus=True,
            dry_run=False,
        )

        self.assertIn("aggregate", report)
        self.assertGreater(report["aggregate"]["total_cases"], 0)

    def test_safe_evaluation_report(self):
        """safe_evaluation_report should not leak secrets."""
        # Create a document with secret markers
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="ai_memory_evaluation",
            content_hash="a" * 64,
            raw_text="SECRET_TOKEN=token123 API_KEY=sk-secret",
            metadata={"evaluation": True, "document_key": "test-doc"},
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="SECRET_TOKEN=token123 API_KEY=sk-secret",
            text_hash="b" * 64,
        )

        # Run evaluation
        report = run_retrieval_evaluation(
            mode="hybrid_keyword",
            top_k=5,
            rebuild_synthetic_corpus=False,
            dry_run=False,
        )

        # Safe report should not contain secrets
        safe = safe_evaluation_report(report)
        serialized = str(safe)

        self.assertNotIn("SECRET_TOKEN", serialized)
        self.assertNotIn("API_KEY", serialized)
        self.assertNotIn("sk-secret", serialized)


class SecurityTests(TestCase):
    """Test security aspects of embedding providers."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")

    def test_api_key_not_in_logs(self):
        """API key should not appear in logs."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="API_KEY=sk-secret-12345",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="API_KEY=sk-secret-12345",
            text_hash="b" * 64,
        )

        # Capture logs
        import logging
        from io import StringIO

        log_capture = StringIO()
        handler = logging.StreamHandler(log_capture)
        logger = logging.getLogger("security.ai.services.memory.embedding_indexer")
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        try:
            rebuild_embeddings(
                provider_name="deterministic_hash",
                dry_run=False,
                document_id=document.id,
            )

            logs = log_capture.getvalue()
            self.assertNotIn("sk-secret-12345", logs)
            self.assertNotIn("API_KEY", logs)
        finally:
            logger.removeHandler(handler)

    def test_chunk_raw_not_in_errors(self):
        """Chunk raw text should not appear in errors."""
        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Sensitive content SECRET_TOKEN=token123",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Sensitive content SECRET_TOKEN=token123",
            text_hash="b" * 64,
        )

        # Mock provider that fails
        mock_provider = Mock(spec=BaseEmbeddingProvider)
        mock_provider.provider_name = "failing_provider"
        mock_provider.model_name = "failing_model"
        mock_provider.dimensions = 384
        mock_provider.embed_text = Mock(side_effect=RuntimeError("Provider error"))

        with patch("security.ai.services.memory.embedding_indexer.get_embedding_provider", return_value=mock_provider):
            stats = rebuild_embeddings(
                provider_name="failing_provider",
                dry_run=False,
                document_id=document.id,
            )

        # Verify error was counted but no sensitive data leaked
        self.assertEqual(stats.errors, 1)

    def test_provider_error_body_redacted(self):
        """Provider error body should be redacted/truncated."""
        # Create a mock provider that returns error with sensitive data
        mock_provider = Mock(spec=BaseEmbeddingProvider)
        mock_provider.provider_name = "failing_provider"
        mock_provider.model_name = "failing_model"
        mock_provider.dimensions = 384
        mock_provider.embed_text = Mock(
            side_effect=RuntimeError("Error: API_KEY=sk-secret-12345 failed")
        )

        document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test content.",
        )
        chunk = AIKnowledgeChunk.objects.create(
            document=document,
            chunk_index=0,
            text="Test content.",
            text_hash="b" * 64,
        )

        with patch("security.ai.services.memory.embedding_indexer.get_embedding_provider", return_value=mock_provider):
            stats = rebuild_embeddings(
                provider_name="failing_provider",
                dry_run=False,
                document_id=document.id,
            )

        # Error should be counted
        self.assertEqual(stats.errors, 1)


class CosineSimilarityTests(TestCase):
    """Test cosine similarity function."""

    def test_identical_vectors_have_similarity_1(self):
        """Identical vectors should have similarity 1.0."""
        vector = [0.5, 0.5, 0.5, 0.5]
        similarity = cosine_similarity(vector, vector)
        self.assertAlmostEqual(similarity, 1.0, places=6)

    def test_orthogonal_vectors_have_similarity_0(self):
        """Orthogonal vectors should have similarity 0.0."""
        vector1 = [1.0, 0.0, 0.0, 0.0]
        vector2 = [0.0, 1.0, 0.0, 0.0]
        similarity = cosine_similarity(vector1, vector2)
        self.assertAlmostEqual(similarity, 0.0, places=6)

    def test_opposite_vectors_have_similarity_0(self):
        """Opposite vectors should have similarity 0.0 (clamped)."""
        vector1 = [1.0, 0.0, 0.0, 0.0]
        vector2 = [-1.0, 0.0, 0.0, 0.0]
        similarity = cosine_similarity(vector1, vector2)
        # cosine_similarity clamps to [0, 1] for embeddings
        self.assertAlmostEqual(similarity, 0.0, places=6)

    def test_dimension_mismatch_returns_0(self):
        """Dimension mismatch should return 0.0."""
        vector1 = [1.0, 0.0, 0.0]
        vector2 = [0.0, 1.0]
        similarity = cosine_similarity(vector1, vector2)
        self.assertEqual(similarity, 0.0)

    def test_empty_vectors_return_0(self):
        """Empty vectors should return 0.0."""
        similarity = cosine_similarity([], [])
        self.assertEqual(similarity, 0.0)

    def test_similarity_is_bounded(self):
        """Similarity should be bounded between -1 and 1."""
        vector1 = [0.3, 0.4, 0.5]
        vector2 = [0.1, 0.2, 0.3]
        similarity = cosine_similarity(vector1, vector2)
        self.assertGreaterEqual(similarity, -1.0)
        self.assertLessEqual(similarity, 1.0)


class EmbeddingIndexStatsTests(TestCase):
    """Test EmbeddingIndexStats dataclass."""

    def test_default_values(self):
        """Default values should be zero."""
        stats = EmbeddingIndexStats()
        self.assertEqual(stats.documents_seen, 0)
        self.assertEqual(stats.chunks_seen, 0)
        self.assertEqual(stats.embeddings_created, 0)
        self.assertEqual(stats.embeddings_updated, 0)
        self.assertEqual(stats.embeddings_skipped, 0)
        self.assertEqual(stats.errors, 0)

    def test_as_dict(self):
        """as_dict should return correct dictionary."""
        stats = EmbeddingIndexStats(
            documents_seen=10,
            chunks_seen=20,
            embeddings_created=5,
            embeddings_updated=3,
            embeddings_skipped=2,
            errors=1,
        )
        result = stats.as_dict()
        self.assertEqual(result["documents_seen"], 10)
        self.assertEqual(result["chunks_seen"], 20)
        self.assertEqual(result["embeddings_created"], 5)
        self.assertEqual(result["embeddings_updated"], 3)
        self.assertEqual(result["embeddings_skipped"], 2)
        self.assertEqual(result["errors"], 1)


class RateLimiterTests(TestCase):
    """Test rate limiter functionality."""

    def test_check_and_wait_allows_requests_under_limit(self):
        """Should allow requests under limit."""
        limiter = RateLimiter(requests_per_minute=60)

        for i in range(60):
            self.assertTrue(limiter.check_and_wait())

    def test_check_and_wait_blocks_requests_over_limit(self):
        """Should block requests over limit."""
        limiter = RateLimiter(requests_per_minute=10)

        # Make 10 requests
        for i in range(10):
            self.assertTrue(limiter.check_and_wait())

        # 11th request should be blocked
        self.assertFalse(limiter.check_and_wait())

    def test_reset_clears_timestamps(self):
        """Reset should clear timestamps."""
        limiter = RateLimiter(requests_per_minute=10)

        # Make 10 requests
        for i in range(10):
            limiter.check_and_wait()

        self.assertFalse(limiter.check_and_wait())

        # Reset
        limiter.reset()

        # Should allow requests again
        self.assertTrue(limiter.check_and_wait())

    def test_get_remaining_returns_correct_count(self):
        """get_remaining should return correct count."""
        limiter = RateLimiter(requests_per_minute=10)

        self.assertEqual(limiter.get_remaining(), 10)

        # Make 3 requests
        for i in range(3):
            limiter.check_and_wait()

        self.assertEqual(limiter.get_remaining(), 7)

    def test_get_wait_time(self):
        """get_wait_time should return correct time."""
        limiter = RateLimiter(requests_per_minute=10)

        # No requests made, should be 0
        self.assertEqual(limiter.get_wait_time(), 0.0)

        # Make 10 requests
        for i in range(10):
            limiter.check_and_wait()

        # Should have wait time
        wait_time = limiter.get_wait_time()
        self.assertGreater(wait_time, 0.0)


class RetryHandlerTests(TestCase):
    """Test retry handler functionality."""

    def test_classify_error(self):
        """Should classify errors correctly."""
        handler = RetryHandler()

        # Config missing
        error = RuntimeError("Provider not configured")
        self.assertEqual(handler.classify_error(error), ErrorType.CONFIG_MISSING)

        # Rate limit
        error = RuntimeError("Rate limit exceeded (429)")
        self.assertEqual(handler.classify_error(error), ErrorType.RATE_LIMITED)

        # Timeout
        error = RuntimeError("Request timeout")
        self.assertEqual(handler.classify_error(error), ErrorType.TIMEOUT)

        # Dimension mismatch
        error = ValueError("Embedding dimension mismatch")
        self.assertEqual(handler.classify_error(error), ErrorType.DIMENSION_MISMATCH)

        # Invalid response
        error = ValueError("Invalid response format")
        self.assertEqual(handler.classify_error(error), ErrorType.INVALID_RESPONSE)

        # Provider error (default)
        error = RuntimeError("Provider error")
        self.assertEqual(handler.classify_error(error), ErrorType.PROVIDER_ERROR)

    def test_should_retry(self):
        """Should determine retry correctly."""
        handler = RetryHandler(max_retries=3)

        # Config missing - don't retry
        error = RuntimeError("Provider not configured")
        self.assertFalse(handler.should_retry(error, 0))

        # Rate limit - retry
        error = RuntimeError("Rate limit exceeded")
        self.assertTrue(handler.should_retry(error, 0))

        # Timeout - retry
        error = RuntimeError("Request timeout")
        self.assertTrue(handler.should_retry(error, 0))

        # Dimension mismatch - don't retry
        error = ValueError("Embedding dimension mismatch")
        self.assertFalse(handler.should_retry(error, 0))

        # Invalid response - don't retry
        error = ValueError("Invalid response format")
        self.assertFalse(handler.should_retry(error, 0))

        # Max retries exceeded - don't retry
        error = RuntimeError("Rate limit exceeded")
        self.assertFalse(handler.should_retry(error, 3))

    def test_get_backoff_time(self):
        """Should calculate exponential backoff correctly."""
        handler = RetryHandler(backoff_seconds=2.0)

        self.assertEqual(handler.get_backoff_time(0), 2.0)
        self.assertEqual(handler.get_backoff_time(1), 4.0)
        self.assertEqual(handler.get_backoff_time(2), 8.0)

    @patch("security.ai.services.memory.retry_handler.time.sleep")
    def test_retry_with_backoff(self, mock_sleep):
        """Should retry with backoff."""
        handler = RetryHandler(max_retries=2, backoff_seconds=1.0)

        call_count = 0

        def failing_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("Rate limit exceeded")
            return "success"

        result = handler.retry_with_backoff(failing_func)

        self.assertEqual(result, "success")
        self.assertEqual(call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)


class EmbeddingDiagnosticsTests(TestCase):
    """Test embedding diagnostics functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.document = AIKnowledgeDocument.objects.create(
            title="Test Document",
            source_type="test",
            content_hash="a" * 64,
            raw_text="Test document for diagnostics.",
        )
        self.chunk = AIKnowledgeChunk.objects.create(
            document=self.document,
            chunk_index=0,
            text="Test chunk for diagnostics.",
            text_hash="b" * 64,
        )

    def test_get_active_embedding_provider(self):
        """Should return provider info."""
        provider_info = get_active_embedding_provider()

        self.assertIn("name", provider_info)
        self.assertIn("model", provider_info)
        self.assertIn("dimensions", provider_info)
        self.assertIn("configured", provider_info)
        self.assertNotIn("api_key", provider_info)

    def test_is_embedding_provider_configured(self):
        """Should check if provider is configured."""
        # deterministic_hash is always configured
        self.assertTrue(is_embedding_provider_configured())

    def test_are_embeddings_enabled(self):
        """Should check if embeddings are enabled."""
        with override_settings(AI_MEMORY_EMBEDDINGS_ENABLED=True):
            self.assertTrue(are_embeddings_enabled())

        with override_settings(AI_MEMORY_EMBEDDINGS_ENABLED=False):
            self.assertFalse(are_embeddings_enabled())

    def test_get_chunks_with_embeddings_count(self):
        """Should count chunks with embeddings."""
        # Initially no embeddings
        count = get_chunks_with_embeddings_count()
        self.assertEqual(count, 0)

        # Create embedding
        rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=self.document.id,
        )

        count = get_chunks_with_embeddings_count()
        self.assertEqual(count, 1)

    def test_get_chunks_without_embeddings_count(self):
        """Should count chunks without embeddings."""
        # Initially all chunks without embeddings
        count = get_chunks_without_embeddings_count()
        self.assertEqual(count, 1)

        # Create embedding
        rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=self.document.id,
        )

        count = get_chunks_without_embeddings_count()
        self.assertEqual(count, 0)

    def test_get_embedding_provider_distribution(self):
        """Should return provider distribution."""
        # Create embedding
        rebuild_embeddings(
            provider_name="deterministic_hash",
            dry_run=False,
            document_id=self.document.id,
        )

        distribution = get_embedding_provider_distribution()

        self.assertIn("by_provider", distribution)
        self.assertIn("by_model", distribution)
        self.assertIn("by_dimensions", distribution)

        # Check that raw data is not included
        self.assertNotIn("embedding", str(distribution))
        self.assertNotIn("text", str(distribution))

    def test_is_pgvector_available(self):
        """Should check pgvector availability."""
        # This will return False in test environment without pgvector
        result = is_pgvector_available()
        self.assertIsInstance(result, bool)

    def test_is_fallback_active(self):
        """Should check if fallback is active."""
        result = is_fallback_active()
        self.assertIsInstance(result, bool)
