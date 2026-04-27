from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase

from security.models import (
    SecurityAlertRuleConfig,
    SecurityCenterSetting,
    SecurityParserConfig,
    SecuritySourceConfig,
    SettingValueType,
)
from security.services.addon_registry import get_addon_registry


class AddonRegistryApiTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user("staff", password="pw", is_staff=True)
        self.user = get_user_model().objects.create_user("user", password="pw")
        self._seed_required_addons()

    def test_health_returns_ok_for_authorized_user(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_addons_requires_authentication(self):
        response = self.client.get("/api/security/addons/")

        self.assertEqual(response.status_code, 403)

    def test_unauthorized_users_cannot_access(self):
        self.client.force_login(self.user)
        response = self.client.get("/api/security/addons/")

        self.assertEqual(response.status_code, 403)

    def test_manage_configuration_permission_can_access(self):
        permission = Permission.objects.get(codename="manage_security_configuration")
        self.user.user_permissions.add(permission)
        self.client.force_login(self.user)

        response = self.client.get("/api/security/addons/microsoft_defender/")

        self.assertEqual(response.status_code, 200)

    def test_registry_returns_required_addons(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/")

        self.assertEqual(response.status_code, 200)
        codes = {addon["code"] for addon in response.json()["addons"]}
        self.assertIn("watchguard", codes)
        self.assertIn("microsoft_defender", codes)
        self.assertIn("backup_nas", codes)

    def test_registry_service_returns_required_addons(self):
        codes = {addon["code"] for addon in get_addon_registry()}

        self.assertIn("watchguard", codes)
        self.assertIn("microsoft_defender", codes)
        self.assertIn("backup_nas", codes)

    def test_addon_cards_include_parser_source_and_rule_counts(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/")
        watchguard = self._addon(response.json(), "watchguard")

        self.assertEqual(watchguard["total_source_count"], 1)
        self.assertEqual(watchguard["enabled_source_count"], 1)
        self.assertEqual(watchguard["total_parser_count"], 1)
        self.assertEqual(watchguard["enabled_parser_count"], 1)
        self.assertEqual(watchguard["total_rule_count"], 1)
        self.assertEqual(watchguard["enabled_rule_count"], 1)

    def test_disabled_parser_affects_addon_status(self):
        SecurityParserConfig.objects.filter(parser_name="watchguard_report_parser").update(enabled=False)
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/")
        watchguard = self._addon(response.json(), "watchguard")

        self.assertIn(watchguard["status"], {"warning", "misconfigured"})
        self.assertGreaterEqual(watchguard["warning_count"], 1)

    def test_missing_source_causes_warning_or_misconfigured_status(self):
        SecuritySourceConfig.objects.filter(source_type="synology_backup").delete()
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/")
        backup = self._addon(response.json(), "backup_nas")

        self.assertIn(backup["status"], {"warning", "misconfigured"})

    def test_watchguard_detail_endpoint_loads(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/watchguard/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "watchguard")

    def test_microsoft_defender_detail_endpoint_loads(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/microsoft_defender/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "microsoft_defender")

    def test_backup_nas_detail_endpoint_loads(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/backup_nas/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "backup_nas")

    def test_unknown_addon_code_returns_404(self):
        self.client.force_login(self.staff)
        response = self.client.get("/api/security/addons/nope/")

        self.assertEqual(response.status_code, 404)

    def test_no_secrets_are_exposed(self):
        SecurityCenterSetting.objects.create(
            key="teams_webhook",
            value="super-secret-webhook",
            value_type=SettingValueType.STRING,
            category="notifications",
            is_secret=True,
        )
        self.client.force_login(self.staff)

        list_response = self.client.get("/api/security/addons/")
        detail_response = self.client.get("/api/security/addons/microsoft_defender/")

        self.assertNotIn("super-secret-webhook", list_response.content.decode())
        self.assertNotIn("super-secret-webhook", detail_response.content.decode())

    def test_admin_addons_requires_staff_or_manage_permission(self):
        response = self.client.get("/security/admin/addons/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/security/admin/addons/").status_code, 403)

        permission = Permission.objects.get(codename="manage_security_configuration")
        self.user.user_permissions.add(permission)
        self.assertEqual(self.client.get("/security/admin/addons/").status_code, 200)

        self.client.force_login(self.staff)
        self.assertEqual(self.client.get("/security/admin/addons/").status_code, 200)

    def test_admin_addon_registry_uses_italian_labels(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/addons/")

        self.assertEqual(response.status_code, 200)
        for label in [
            "Registro moduli",
            "Sorgenti",
            "Parser",
            "Regole alert",
            "Alert aperti",
            "Ticket aperti",
            "Ultimo report",
        ]:
            self.assertContains(response, label)

    def test_admin_addon_cards_show_parser_source_and_rule_counts(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/addons/")

        self.assertContains(response, "Parser")
        self.assertContains(response, "Sorgenti")
        self.assertContains(response, "Regole alert")
        self.assertContains(response, "1 / 1")

    def test_admin_detail_pages_load(self):
        self.client.force_login(self.staff)

        self.assertEqual(self.client.get("/security/admin/addons/watchguard/").status_code, 200)
        self.assertEqual(self.client.get("/security/admin/addons/microsoft_defender/").status_code, 200)
        self.assertEqual(self.client.get("/security/admin/addons/backup_nas/").status_code, 200)

    def test_admin_unknown_addon_code_returns_404(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/addons/nope/")

        self.assertEqual(response.status_code, 404)

    def test_admin_addons_do_not_expose_secrets(self):
        SecurityCenterSetting.objects.create(
            key="teams_webhook",
            value="super-secret-webhook",
            value_type=SettingValueType.STRING,
            category="notifications",
            is_secret=True,
        )
        self.client.force_login(self.staff)

        list_response = self.client.get("/security/admin/addons/")
        detail_response = self.client.get("/security/admin/addons/microsoft_defender/")

        self.assertNotIn("super-secret-webhook", list_response.content.decode())
        self.assertNotIn("super-secret-webhook", detail_response.content.decode())

    def _seed_required_addons(self):
        SecuritySourceConfig.objects.create(
            name="WatchGuard Dimension / Firebox",
            source_type="watchguard_dimension_firebox",
            vendor="WatchGuard",
            enabled=True,
            parser_name="watchguard_report_parser",
        )
        SecuritySourceConfig.objects.create(
            name="Microsoft Defender",
            source_type="microsoft_defender",
            vendor="Microsoft",
            enabled=True,
            parser_name="microsoft_defender_vulnerability_notification_email_parser",
        )
        SecuritySourceConfig.objects.create(
            name="Synology/NAS Backup",
            source_type="synology_backup",
            vendor="Synology",
            enabled=True,
            parser_name="synology_active_backup_email_parser",
        )
        for parser_name, source_type in [
            ("watchguard_report_parser", "watchguard"),
            ("microsoft_defender_vulnerability_notification_email_parser", "microsoft_defender"),
            ("synology_active_backup_email_parser", "synology_backup"),
        ]:
            SecurityParserConfig.objects.create(parser_name=parser_name, enabled=True, source_type=source_type)
        for code, source_type in [
            ("watchguard_vpn_denied_gt_0", "watchguard"),
            ("defender_critical_cve_cvss_gte_9", "microsoft_defender"),
            ("defender_critical_cve_exposed_devices_gt_0", "microsoft_defender"),
            ("backup_failed_gt_0", "synology_backup"),
            ("backup_missing_expected_job", "synology_backup"),
        ]:
            SecurityAlertRuleConfig.objects.create(code=code, name=code, enabled=True, source_type=source_type)

    def _addon(self, payload, code):
        return next(addon for addon in payload["addons"] if addon["code"] == code)
