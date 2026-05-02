from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import TestCase, override_settings


REPO_ROOT = Path(__file__).resolve().parents[2]


def react_temp_dir():
    temp_root = REPO_ROOT / ".tmp-tests"
    temp_root.mkdir(exist_ok=True)
    return TemporaryDirectory(dir=temp_root, ignore_cleanup_errors=True)


class ReactDjangoServingTests(TestCase):
    def test_frontend_routes_return_missing_build_page_without_crashing(self):
        with react_temp_dir() as temp_dir:
            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir), SERVE_REACT_APP=True):
                for route in ["/", "/app/", "/configuration", "/integrations/microsoft-graph", "/modules/watchguard"]:
                    with self.subTest(route=route):
                        response = self.client.get(route)

                        self.assertEqual(response.status_code, 200)
                        body = response.content.decode()
                        self.assertIn("Build frontend di produzione mancante", body)
                        self.assertIn("npm --prefix frontend run build", body)

    def test_backend_security_admin_route_is_not_hijacked_by_react_fallback(self):
        with react_temp_dir() as temp_dir:
            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir), SERVE_REACT_APP=True):
                response = self.client.get("/security/admin/mailbox-sources/")

        self.assertEqual(response.status_code, 404)
        body = response.content.decode()
        self.assertNotIn("Build frontend di produzione mancante", body)
        self.assertNotIn('<div id="root">', body)

    def test_react_index_is_served_when_build_exists(self):
        with react_temp_dir() as temp_dir:
            dist_dir = Path(temp_dir)
            (dist_dir / "assets").mkdir()
            (dist_dir / "index.html").write_text(
                '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>',
                encoding="utf-8",
            )

            with override_settings(FRONTEND_DIST_DIR=dist_dir, SERVE_REACT_APP=True):
                response = self.client.get("/modules/watchguard")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        body = response.content.decode()
        self.assertIn('<div id="root"></div>', body)
        self.assertIn('/assets/index.js', body)
        self.assertNotIn("Build frontend di produzione mancante", body)

    def test_react_routes_do_not_expose_secret_like_values(self):
        with react_temp_dir() as temp_dir:
            with override_settings(
                FRONTEND_DIST_DIR=Path(temp_dir),
                SERVE_REACT_APP=True,
                SECRET_KEY="unit-test-secret-key",
            ):
                response = self.client.get("/reports")

        body = response.content.decode()
        self.assertNotIn("unit-test-secret-key", body)
        self.assertNotIn("DJANGO_SECRET_KEY", body)
        self.assertNotIn("DB_PASSWORD", body)
        self.assertNotIn("sk-", body)

    def test_react_app_sets_csrf_cookie_for_api_posts(self):
        with react_temp_dir() as temp_dir:
            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir), SERVE_REACT_APP=True):
                response = self.client.get("/configuration")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
