from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase

from security.models import SecurityCenterSetting, SecurityNotificationChannel


DOC_ROOT = Path(__file__).resolve().parents[2] / "docs" / "security-center"
EXPECTED_DOCS = [
    "00_START_HERE.md",
    "01_ARCHITECTURE.md",
    "02_ADMIN_GUIDE.md",
    "03_ADDONS.md",
    "04_WATCHGUARD_ADDON.md",
    "05_DEFENDER_ADDON.md",
    "06_BACKUP_ADDON.md",
    "07_ALERT_LIFECYCLE.md",
    "08_CONFIGURATION_GUIDE.md",
    "09_TROUBLESHOOTING.md",
    "10_DEVELOPER_GUIDE.md",
    "11_OPERATIONS_RUNBOOK.md",
]


class SecurityDocumentationTests(TestCase):
    def test_documentation_files_exist_and_are_non_empty(self):
        for name in EXPECTED_DOCS:
            path = DOC_ROOT / name
            self.assertTrue(path.exists(), name)
            self.assertGreater(len(path.read_text(encoding="utf-8").strip()), 100, name)

    def test_documentation_mentions_required_operating_topics(self):
        combined = "\n".join((DOC_ROOT / name).read_text(encoding="utf-8") for name in EXPECTED_DOCS)

        for term in [
            "WatchGuard",
            "Defender",
            "Backup",
            "alert lifecycle",
            "admin config",
            "diagnostics",
            "addons",
        ]:
            self.assertIn(term.lower(), combined.lower())

    def test_documentation_does_not_expose_common_secret_placeholders(self):
        combined = "\n".join((DOC_ROOT / name).read_text(encoding="utf-8") for name in EXPECTED_DOCS)

        for forbidden in ["SECRET_KEY=", "super-secret-value", "https://secret.example", "password="]:
            self.assertNotIn(forbidden, combined)


class SecurityHelpPageTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user("operator", password="pw")
        self.staff = User.objects.create_user("staff", password="pw", is_staff=True)
        self.manager = User.objects.create_user("manager", password="pw")
        self.manager.user_permissions.add(Permission.objects.get(codename="manage_security_configuration"))

    def test_help_page_requires_authentication_and_allows_authorized_users(self):
        response = self.client.get("/security/help/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

        self.client.force_login(self.user)
        response = self.client.get("/security/help/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Security Center AI")
        self.assertContains(response, "WatchGuard")
        self.assertContains(response, "Defender")
        self.assertContains(response, "Backup")

    def test_admin_docs_follows_admin_config_access(self):
        response = self.client.get("/security/admin/docs/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/security/admin/docs/").status_code, 403)

        self.client.force_login(self.manager)
        self.assertEqual(self.client.get("/security/admin/docs/").status_code, 200)

        self.client.force_login(self.staff)
        self.assertEqual(self.client.get("/security/admin/docs/").status_code, 200)

    def test_documentation_pages_do_not_expose_secrets(self):
        SecurityCenterSetting.objects.create(
            key="api_secret",
            value="super-secret-value",
            value_type="string",
            category="general",
            is_secret=True,
        )
        SecurityNotificationChannel.objects.create(
            name="Teams",
            channel_type="teams_webhook",
            webhook_url_secret_ref="https://secret.example/webhook",
        )

        self.client.force_login(self.staff)
        for url in ["/security/help/", "/security/admin/docs/"]:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertNotContains(response, "super-secret-value")
            self.assertNotContains(response, "https://secret.example/webhook")

