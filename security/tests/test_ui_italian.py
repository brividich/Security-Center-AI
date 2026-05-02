from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase


FORBIDDEN_ENGLISH_LABELS = [
    "Enabled",
    "Disabled",
    "Sources",
    "Alert Rules",
    "Suppressions",
    "Warnings",
    "Documentation",
    "Diagnostics",
    "Configuration",
    "Last report",
    "Open tickets",
    "View details",
    "No data available",
]


class ItalianUiConsistencyTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user("staff-ui", password="pw", is_staff=True)
        self.manager = User.objects.create_user("manager-ui", password="pw")
        self.manager.user_permissions.add(Permission.objects.get(codename="manage_security_configuration"))

    def test_main_security_pages_contain_italian_labels(self):
        self.client.force_login(self.staff)
        expectations = {
            "/security/": ["Dashboard", "Alert aperti", "Ticket aperti", "Report analizzati"],
            "/security/alerts/": ["Coda alert", "Filtri rapidi", "Sorgente", "Dettagli"],
            "/security/tickets/": ["Ticket remediation", "Severita", "Aggiornato"],
            "/security/pipeline/": ["Operazioni pipeline", "Esegui parser", "Valuta regole"],
        }
        for url, labels in expectations.items():
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            for label in labels:
                self.assertContains(response, label)

    def test_admin_config_page_contains_italian_labels(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/config/")

        self.assertEqual(response.status_code, 200)
        for label in ["Configurazione", "Sorgenti", "Regole alert", "Soppressioni", "Registro audit", "Ultimo aggiornamento"]:
            self.assertContains(response, label)

    def test_diagnostics_page_contains_italian_labels(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/diagnostics/")

        self.assertEqual(response.status_code, 200)
        for label in ["Diagnostica", "Controllo salute", "Stato", "Messaggio", "Azione suggerita"]:
            self.assertContains(response, label)

    def test_help_and_docs_pages_contain_italian_labels(self):
        self.client.force_login(self.staff)
        expectations = {
            "/security/help/": ["Guida", "Panoramica", "Checklist primo setup", "Risoluzione problemi"],
            "/security/admin/docs/": ["Documentazione", "Indice documentazione", "Argomento", "Quando usarlo"],
        }
        for url, labels in expectations.items():
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            for label in labels:
                self.assertContains(response, label)

    def test_addon_registry_page_contains_italian_labels(self):
        self.client.force_login(self.staff)
        response = self.client.get("/security/admin/addons/")

        self.assertEqual(response.status_code, 200)
        for label in ["Registro moduli", "Sorgenti", "Parser", "Regole alert", "Alert aperti", "Ticket aperti", "Ultimo report"]:
            self.assertContains(response, label)

    def test_common_english_ui_terms_do_not_appear_on_key_pages(self):
        self.client.force_login(self.staff)
        for url in [
            "/security/",
            "/security/alerts/",
            "/security/tickets/",
            "/security/pipeline/",
            "/security/help/",
            "/security/admin/config/",
            "/security/admin/diagnostics/",
            "/security/admin/docs/",
            "/security/admin/addons/",
        ]:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            body = response.content.decode()
            for term in FORBIDDEN_ENGLISH_LABELS:
                self.assertNotIn(term, body, f"{term!r} found in {url}")
