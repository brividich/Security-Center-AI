from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from rest_framework.test import APIClient

from security.models import SecurityCenterSetting, SecurityMailboxSource

User = get_user_model()


class ConfigurationSourceWizardApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass", is_staff=True)
        self.client.force_authenticate(user=self.user)

    def test_presets_endpoint_requires_auth(self):
        self.client.logout()
        response = self.client.get("/security/api/configuration/source-presets/")
        self.assertEqual(response.status_code, 403)

    def test_presets_endpoint_returns_expected_presets(self):
        response = self.client.get("/security/api/configuration/source-presets/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

        preset_codes = [p["preset_code"] for p in data]
        self.assertIn("watchguard_epdr", preset_codes)
        self.assertIn("defender_vulnerability", preset_codes)
        self.assertIn("synology_backup", preset_codes)
        self.assertIn("custom", preset_codes)

        for preset in data:
            self.assertIn("preset_code", preset)
            self.assertIn("title", preset)
            self.assertIn("description", preset)
            self.assertIn("module", preset)
            self.assertIn("recommended_origin", preset)
            self.assertIn("default_name", preset)
            self.assertIn("code_prefix", preset)
            self.assertIn("source_type", preset)

    def test_create_source_works_with_valid_payload(self):
        payload = {
            "name": "Test WatchGuard Source",
            "code": "test-watchguard",
            "enabled": True,
            "source_type": "manual",
            "mailbox_address": "test@example.local",
            "description": "Test source",
            "sender_allowlist_text": "noreply@watchguard.com",
            "subject_include_text": "EPDR",
            "subject_exclude_text": "",
            "body_include_text": "",
            "attachment_extensions": "pdf",
            "max_messages_per_run": 50,
            "mark_as_read_after_import": False,
            "process_attachments": True,
            "process_email_body": False,
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["code"], "test-watchguard")
        self.assertEqual(data["name"], "Test WatchGuard Source")

        source = SecurityMailboxSource.objects.get(code="test-watchguard")
        self.assertEqual(source.name, "Test WatchGuard Source")
        self.assertEqual(source.source_type, "manual")

    def test_create_source_rejects_duplicate_code(self):
        SecurityMailboxSource.objects.create(
            name="Existing Source",
            code="existing-code",
            source_type="manual",
        )

        payload = {
            "name": "New Source",
            "code": "existing-code",
            "source_type": "manual",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("code already exists", response.json()["error"])

    def test_create_source_rejects_invalid_source_type(self):
        payload = {
            "name": "Test Source",
            "code": "test-invalid",
            "source_type": "invalid_type",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("source_type must be one of", response.json()["error"])

    def test_create_source_rejects_suspicious_secret_fields(self):
        payload = {
            "name": "Test Source",
            "code": "test-secret",
            "source_type": "manual",
            "api_key": "sk-secret-key-12345",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("suspicious secret-like field", response.json()["error"])

    def test_create_source_requires_name(self):
        payload = {
            "code": "test-no-name",
            "source_type": "manual",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name required", response.json()["error"])

    def test_create_source_requires_code(self):
        payload = {
            "name": "Test Source",
            "source_type": "manual",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("code required", response.json()["error"])

    def test_create_source_validates_code_format(self):
        payload = {
            "name": "Test Source",
            "code": "Invalid Code With Spaces",
            "source_type": "manual",
        }

        response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("slug-like", response.json()["error"])

    def test_update_source_updates_safe_fields(self):
        source = SecurityMailboxSource.objects.create(
            name="Original Name",
            code="test-update",
            source_type="manual",
        )

        payload = {
            "name": "Updated Name",
            "description": "Updated description",
            "enabled": False,
        }

        response = self.client.patch(f"/security/api/configuration/sources/{source.code}/", payload, format="json")
        self.assertEqual(response.status_code, 200)

        source.refresh_from_db()
        self.assertEqual(source.name, "Updated Name")
        self.assertEqual(source.description, "Updated description")
        self.assertFalse(source.enabled)

    def test_update_source_does_not_expose_secrets(self):
        source = SecurityMailboxSource.objects.create(
            name="Test Source",
            code="test-update-safe",
            source_type="manual",
        )

        response = self.client.patch(f"/security/api/configuration/sources/{source.code}/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Check that actual secret fields are not exposed
        self.assertNotIn("password", data)
        self.assertNotIn("api_key", data)
        self.assertNotIn("client_secret", data)

    def test_update_source_rejects_suspicious_fields(self):
        source = SecurityMailboxSource.objects.create(
            name="Test Source",
            code="test-update-secret",
            source_type="manual",
        )

        payload = {
            "client_secret": "secret-value",
        }

        response = self.client.patch(f"/security/api/configuration/sources/{source.code}/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("suspicious secret-like field", response.json()["error"])

    def test_toggle_source_enables_disabled_source(self):
        source = SecurityMailboxSource.objects.create(
            name="Test Source",
            code="test-toggle",
            source_type="manual",
            enabled=False,
        )

        response = self.client.post(f"/security/api/configuration/sources/{source.code}/toggle/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["enabled"])

        source.refresh_from_db()
        self.assertTrue(source.enabled)

    def test_source_ingest_endpoint_runs_mailbox_ingestion(self):
        source = SecurityMailboxSource.objects.create(
            name="Graph Test Source",
            code="graph-test-source",
            enabled=True,
            source_type="graph",
            mailbox_address="security@example.local",
        )

        with patch("security.api_configuration.run_mailbox_ingestion") as mock_run:
            mock_run.return_value = source.ingestion_runs.create(
                status="success",
                imported_messages_count=1,
                duplicate_messages_count=0,
                generated_alerts_count=0,
            )
            response = self.client.post(f"/security/api/configuration/sources/{source.code}/ingest/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["imported_messages_count"], 1)
        mock_run.assert_called_once()

    def test_source_ingest_endpoint_rejects_disabled_source(self):
        source = SecurityMailboxSource.objects.create(
            name="Disabled Graph Source",
            code="disabled-graph-source",
            enabled=False,
            source_type="graph",
            mailbox_address="security@example.local",
        )

        response = self.client.post(f"/security/api/configuration/sources/{source.code}/ingest/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("source disabled", response.json()["error"])

    def test_graph_settings_endpoint_saves_secret_server_side(self):
        payload = {
            "tenant_id": "00000000-0000-0000-0000-000000000000",
            "client_id": "00000000-0000-0000-0000-000000000000",
            "client_secret": "token-redacted",
            "mail_folder": "Inbox",
        }

        response = self.client.post("/security/api/configuration/graph/settings/", payload, format="json")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["configured"])
        self.assertTrue(data["secret_configured"])
        self.assertNotIn("token-redacted", str(data))
        secret = SecurityCenterSetting.objects.get(key="GRAPH_CLIENT_SECRET")
        self.assertTrue(secret.is_secret)
        self.assertEqual(secret.value, "token-redacted")

    def test_graph_settings_get_sets_csrf_cookie(self):
        response = self.client.get("/security/api/configuration/graph/settings/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
        self.assertTrue(response.json()["can_save"])

    def test_graph_settings_get_allowed_for_view_permission(self):
        viewer = User.objects.create_user(username="viewer", password="testpass")
        viewer.user_permissions.add(Permission.objects.get(codename="view_securitysource"))
        self.client.force_authenticate(user=viewer)

        response = self.client.get("/security/api/configuration/graph/settings/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["can_save"])

    def test_graph_settings_post_requires_manage_permission(self):
        viewer = User.objects.create_user(username="viewer", password="testpass")
        viewer.user_permissions.add(Permission.objects.get(codename="view_securitysource"))
        self.client.force_authenticate(user=viewer)

        response = self.client.post(
            "/security/api/configuration/graph/settings/",
            {
                "tenant_id": "00000000-0000-0000-0000-000000000000",
                "client_id": "00000000-0000-0000-0000-000000000000",
                "client_secret": "token-redacted",
                "mail_folder": "SECURITY",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("Permesso gestione", response.json()["error"])

    def test_graph_settings_endpoint_preserves_existing_secret_when_blank(self):
        SecurityCenterSetting.objects.create(key="GRAPH_CLIENT_SECRET", value="token-redacted", value_type="string", category="integrations.graph", is_secret=True)

        payload = {
            "tenant_id": "00000000-0000-0000-0000-000000000000",
            "client_id": "00000000-0000-0000-0000-000000000000",
            "client_secret": "",
            "mail_folder": "Inbox",
        }

        response = self.client.post("/security/api/configuration/graph/settings/", payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(SecurityCenterSetting.objects.get(key="GRAPH_CLIENT_SECRET").value, "token-redacted")

    def test_graph_settings_post_works_with_csrf_enforced_client(self):
        csrf_client = APIClient(enforce_csrf_checks=True)
        csrf_client.force_login(self.user)
        csrf_client.get("/security/api/configuration/graph/settings/")
        csrf_token = csrf_client.cookies["csrftoken"].value

        payload = {
            "tenant_id": "00000000-0000-0000-0000-000000000000",
            "client_id": "00000000-0000-0000-0000-000000000000",
            "client_secret": "token-redacted",
            "mail_folder": "SECURITY",
        }

        response = csrf_client.post(
            "/security/api/configuration/graph/settings/",
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["configured"])
        self.assertEqual(SecurityCenterSetting.objects.get(key="GRAPH_MAIL_FOLDER").value, "SECURITY")

    def test_source_appears_in_list_after_creation(self):
        payload = {
            "name": "New List Source",
            "code": "new-list-source",
            "source_type": "manual",
        }

        create_response = self.client.post("/security/api/configuration/sources/create/", payload, format="json")
        self.assertEqual(create_response.status_code, 201)

        list_response = self.client.get("/security/api/configuration/sources/")
        self.assertEqual(list_response.status_code, 200)
        sources = list_response.json()
        codes = [s["code"] for s in sources]
        self.assertIn("new-list-source", codes)

    def test_test_endpoint_remains_non_persistent(self):
        initial_count = SecurityMailboxSource.objects.count()

        payload = {
            "sample_text": "Test WatchGuard EPDR report with critical vulnerability CVE-2024-1234",
            "filename": "test.pdf",
        }

        response = self.client.post("/security/api/configuration/test/", payload, format="json")
        self.assertEqual(response.status_code, 200)

        final_count = SecurityMailboxSource.objects.count()
        self.assertEqual(initial_count, final_count)
