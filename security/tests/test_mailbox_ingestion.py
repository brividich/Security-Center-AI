"""
Tests for mailbox ingestion functionality.
"""
import json
from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from security.models import (
    SecurityCenterSetting,
    SecurityMailboxSource,
    SecurityMailboxIngestionRun,
    SecurityMailboxMessage,
    SecuritySourceFile,
    SecuritySource,
)
from security.services.mailbox_ingestion import (
    run_mailbox_ingestion,
    should_accept_message,
    build_message_dedup_key,
    ingest_mailbox_message,
)
from security.services.mailbox_providers import (
    GraphMailboxProvider,
    MailboxMessage,
    MailboxAttachment,
    MailboxProviderConfigurationError,
    get_provider,
)

User = get_user_model()


class MailboxIngestionTestCase(TestCase):
    def setUp(self):
        self.source = SecurityMailboxSource.objects.create(
            name="Test Mailbox",
            code="test-mailbox",
            enabled=True,
            source_type="mock",
            mailbox_address="test@example.com",
            sender_allowlist_text="allowed@example.com",
            subject_include_text="Security Report",
            subject_exclude_text="SPAM",
            max_messages_per_run=10,
        )

    def test_disabled_source_skips_ingestion(self):
        self.source.enabled = False
        self.source.save()

        run = run_mailbox_ingestion(self.source)
        self.assertIsNone(run)

    def test_should_accept_message_allowed_sender(self):
        msg = MailboxMessage(
            provider_message_id="123",
            internet_message_id="<msg@example.com>",
            sender="allowed@example.com",
            recipients=["test@example.com"],
            subject="Security Report Daily",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )
        self.assertTrue(should_accept_message(self.source, msg))

    def test_should_reject_message_disallowed_sender(self):
        msg = MailboxMessage(
            provider_message_id="123",
            internet_message_id="<msg@example.com>",
            sender="spam@example.com",
            recipients=["test@example.com"],
            subject="Security Report Daily",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )
        self.assertFalse(should_accept_message(self.source, msg))

    def test_should_reject_message_excluded_subject(self):
        msg = MailboxMessage(
            provider_message_id="123",
            internet_message_id="<msg@example.com>",
            sender="allowed@example.com",
            recipients=["test@example.com"],
            subject="SPAM Security Report",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )
        self.assertFalse(should_accept_message(self.source, msg))

    def test_should_reject_message_missing_include_pattern(self):
        msg = MailboxMessage(
            provider_message_id="123",
            internet_message_id="<msg@example.com>",
            sender="allowed@example.com",
            recipients=["test@example.com"],
            subject="Daily Update",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )
        self.assertFalse(should_accept_message(self.source, msg))

    def test_build_message_dedup_key_with_provider_id(self):
        msg = MailboxMessage(
            provider_message_id="unique-123",
            internet_message_id="<msg@example.com>",
            sender="test@example.com",
            recipients=["dest@example.com"],
            subject="Test",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Body",
            body_html="<p>Body</p>",
            attachments=[],
        )
        key1 = build_message_dedup_key(self.source, msg)
        key2 = build_message_dedup_key(self.source, msg)
        self.assertEqual(key1, key2)
        self.assertEqual(len(key1), 64)

    def test_duplicate_message_not_imported_twice(self):
        msg = MailboxMessage(
            provider_message_id="dup-123",
            internet_message_id="<dup@example.com>",
            sender="allowed@example.com",
            recipients=["test@example.com"],
            subject="Security Report Daily",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )

        result1 = ingest_mailbox_message(self.source, msg, dry_run=False)
        self.assertEqual(result1["status"], "imported")

        result2 = ingest_mailbox_message(self.source, msg, dry_run=False)
        self.assertEqual(result2["status"], "duplicate")

    def test_dry_run_creates_no_records(self):
        msg = MailboxMessage(
            provider_message_id="dry-123",
            internet_message_id="<dry@example.com>",
            sender="allowed@example.com",
            recipients=["test@example.com"],
            subject="Security Report Daily",
            received_at=datetime.now(dt_timezone.utc),
            body_text="Test body",
            body_html="<p>Test body</p>",
            attachments=[],
        )

        initial_count = SecurityMailboxMessage.objects.count()
        result = ingest_mailbox_message(self.source, msg, dry_run=True)
        final_count = SecurityMailboxMessage.objects.count()

        self.assertEqual(result["status"], "imported")
        self.assertEqual(initial_count, final_count)

    def test_mock_provider_returns_empty_list(self):
        with patch("security.services.mailbox_ingestion.get_provider") as mock_get_provider:
            from security.services.mailbox_providers import MockMailboxProvider
            mock_get_provider.return_value = MockMailboxProvider()

            run = run_mailbox_ingestion(self.source)

            self.assertIsNotNone(run)
            self.assertEqual(run.status, "success")
            self.assertEqual(run.imported_messages_count, 0)

    def test_ingestion_run_status_success(self):
        with patch("security.services.mailbox_ingestion.get_provider") as mock_get_provider:
            from security.services.mailbox_providers import MockMailboxProvider
            mock_get_provider.return_value = MockMailboxProvider()

            run = run_mailbox_ingestion(self.source)

            self.assertEqual(run.status, "success")
            self.assertIsNotNone(run.finished_at)

    def test_ingestion_run_updates_source_timestamps(self):
        with patch("security.services.mailbox_ingestion.get_provider") as mock_get_provider:
            from security.services.mailbox_providers import MockMailboxProvider
            mock_get_provider.return_value = MockMailboxProvider()

            self.assertIsNone(self.source.last_run_at)
            self.assertIsNone(self.source.last_success_at)

            run_mailbox_ingestion(self.source)
            self.source.refresh_from_db()

            self.assertIsNotNone(self.source.last_run_at)
            self.assertIsNotNone(self.source.last_success_at)

    def test_get_provider_returns_graph_provider(self):
        self.source.source_type = "graph"
        self.assertIsInstance(get_provider(self.source), GraphMailboxProvider)

    def test_graph_provider_requires_server_credentials(self):
        self.source.source_type = "graph"
        self.source.mailbox_address = "security@example.local"
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(MailboxProviderConfigurationError):
                GraphMailboxProvider().list_messages(self.source, limit=1)

    def test_graph_provider_fetches_messages(self):
        self.source.source_type = "graph"
        self.source.mailbox_address = "security@example.local"
        self.source.process_attachments = False

        responses = [
            _FakeUrlopenResponse({"access_token": "token-redacted"}),
            _FakeUrlopenResponse(
                {
                    "value": [
                        {
                            "id": "graph-message-1",
                            "internetMessageId": "<message-1@example.local>",
                            "subject": "Microsoft Defender - Vulnerability Notification",
                            "from": {"emailAddress": {"address": "no-reply@microsoft.com"}},
                            "toRecipients": [{"emailAddress": {"address": "security@example.local"}}],
                            "receivedDateTime": "2026-04-30T08:15:00Z",
                            "body": {"contentType": "text", "content": "CVE-2026-0001\nSeverity: Critical"},
                            "hasAttachments": False,
                        }
                    ]
                }
            ),
        ]

        with patch.dict(
            "os.environ",
            {
                "GRAPH_TENANT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_SECRET": "token-redacted",
            },
            clear=True,
        ), patch("security.services.mailbox_providers.urllib.request.urlopen", side_effect=responses) as mock_urlopen:
            messages = GraphMailboxProvider().list_messages(self.source, limit=1)

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].provider_message_id, "graph-message-1")
        self.assertEqual(messages[0].sender, "no-reply@microsoft.com")
        self.assertEqual(messages[0].recipients, ["security@example.local"])
        self.assertIn("CVE-2026-0001", messages[0].body_text)
        self.assertEqual(mock_urlopen.call_count, 2)

    def test_graph_provider_fetches_file_attachments(self):
        self.source.source_type = "graph"
        self.source.mailbox_address = "security@example.local"
        self.source.process_attachments = True

        responses = [
            _FakeUrlopenResponse({"access_token": "token-redacted"}),
            _FakeUrlopenResponse(
                {
                    "value": [
                        {
                            "id": "graph-message-with-attachment",
                            "internetMessageId": "<message-2@example.local>",
                            "subject": "Security Report Daily",
                            "from": {"emailAddress": {"address": "allowed@example.com"}},
                            "toRecipients": [{"emailAddress": {"address": "security@example.local"}}],
                            "receivedDateTime": "2026-04-30T08:15:00Z",
                            "body": {"contentType": "text", "content": "Report attached"},
                            "hasAttachments": True,
                        }
                    ]
                }
            ),
            _FakeUrlopenResponse(
                {
                    "value": [
                        {
                            "@odata.type": "#microsoft.graph.fileAttachment",
                            "name": "report.txt",
                            "contentType": "text/plain",
                            "contentBytes": "UmVwb3J0IGRlbW8=",
                            "size": 11,
                        },
                        {
                            "@odata.type": "#microsoft.graph.itemAttachment",
                            "name": "ignored",
                        },
                    ]
                }
            ),
        ]

        with patch.dict(
            "os.environ",
            {
                "GRAPH_TENANT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_SECRET": "token-redacted",
            },
            clear=True,
        ), patch("security.services.mailbox_providers.urllib.request.urlopen", side_effect=responses):
            messages = GraphMailboxProvider().list_messages(self.source, limit=1)

        self.assertEqual(len(messages[0].attachments), 1)
        self.assertEqual(messages[0].attachments[0].filename, "report.txt")
        self.assertEqual(messages[0].attachments[0].content_bytes, b"Report demo")

    def test_graph_provider_resolves_custom_folder_name(self):
        self.source.source_type = "graph"
        self.source.mailbox_address = "security@example.local"
        self.source.process_attachments = False

        responses = [
            _FakeUrlopenResponse({"access_token": "token-redacted"}),
            _FakeUrlopenResponse({"value": [{"id": "folder-id-001", "displayName": "SECURITY"}]}),
            _FakeUrlopenResponse(
                {
                    "value": [
                        {
                            "id": "graph-message-custom-folder",
                            "internetMessageId": "<message-3@example.local>",
                            "subject": "Security Report Daily",
                            "from": {"emailAddress": {"address": "allowed@example.com"}},
                            "toRecipients": [{"emailAddress": {"address": "security@example.local"}}],
                            "receivedDateTime": "2026-04-30T08:15:00Z",
                            "body": {"contentType": "text", "content": "Report in custom folder"},
                            "hasAttachments": False,
                        }
                    ]
                }
            ),
        ]

        with patch.dict(
            "os.environ",
            {
                "GRAPH_TENANT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_ID": "00000000-0000-0000-0000-000000000000",
                "GRAPH_CLIENT_SECRET": "token-redacted",
                "GRAPH_MAIL_FOLDER": "SECURITY",
            },
            clear=True,
        ), patch("security.services.mailbox_providers.urllib.request.urlopen", side_effect=responses) as mock_urlopen:
            messages = GraphMailboxProvider().list_messages(self.source, limit=1)

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].provider_message_id, "graph-message-custom-folder")
        self.assertEqual(mock_urlopen.call_count, 3)

    def test_graph_provider_prefers_saved_ui_settings_over_environment(self):
        self.source.source_type = "graph"
        self.source.mailbox_address = "security@example.local"
        self.source.process_attachments = False
        SecurityCenterSetting.objects.create(key="GRAPH_TENANT_ID", value="00000000-0000-0000-0000-000000000000", value_type="string", category="integrations.graph", is_secret=True)
        SecurityCenterSetting.objects.create(key="GRAPH_CLIENT_ID", value="00000000-0000-0000-0000-000000000000", value_type="string", category="integrations.graph", is_secret=True)
        SecurityCenterSetting.objects.create(key="GRAPH_CLIENT_SECRET", value="token-redacted", value_type="string", category="integrations.graph", is_secret=True)
        SecurityCenterSetting.objects.create(key="GRAPH_MAIL_FOLDER", value="SECURITY", value_type="string", category="integrations.graph")

        responses = [
            _FakeUrlopenResponse({"access_token": "token-redacted"}),
            _FakeUrlopenResponse({"value": [{"id": "folder-id-001", "displayName": "SECURITY"}]}),
            _FakeUrlopenResponse({"value": []}),
        ]

        with patch.dict(
            "os.environ",
            {
                "GRAPH_TENANT_ID": "env-placeholder",
                "GRAPH_CLIENT_ID": "env-placeholder",
                "GRAPH_CLIENT_SECRET": "env-placeholder",
                "GRAPH_MAIL_FOLDER": "Inbox",
            },
            clear=True,
        ), patch("security.services.mailbox_providers.urllib.request.urlopen", side_effect=responses) as mock_urlopen:
            GraphMailboxProvider().list_messages(self.source, limit=1)

        token_request = mock_urlopen.call_args_list[0].args[0]
        self.assertIn(b"token-redacted", token_request.data)
        self.assertNotIn(b"env-placeholder", token_request.data)
        folder_lookup_url = mock_urlopen.call_args_list[1].args[0].full_url
        self.assertIn("SECURITY", folder_lookup_url)


class LegacyMailboxSourceAdminRoutesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.source = SecurityMailboxSource.objects.create(
            name="Test Source",
            code="test-source",
            enabled=True,
            source_type="mock",
        )

    def test_mailbox_sources_list_route_is_not_exposed(self):
        response = self.client.get("/security/admin/mailbox-sources/")
        self.assertEqual(response.status_code, 404)

    def test_mailbox_source_detail_route_is_not_exposed(self):
        response = self.client.get(f"/security/admin/mailbox-sources/{self.source.code}/")
        self.assertEqual(response.status_code, 404)

    def test_superuser_does_not_get_second_mailbox_admin_ui(self):
        self.user.is_superuser = True
        self.user.save()
        self.client.login(username="testuser", password="testpass")

        list_response = self.client.get("/security/admin/mailbox-sources/")
        detail_response = self.client.get(f"/security/admin/mailbox-sources/{self.source.code}/")
        self.assertEqual(list_response.status_code, 404)
        self.assertEqual(detail_response.status_code, 404)


class _FakeUrlopenResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")
