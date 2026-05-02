import io
import os
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from security_center_ai.settings.base import build_database_config


class SqlServerDatabaseSettingsTests(SimpleTestCase):
    def test_mssql_environment_profile_uses_driver_18_and_trusted_connection(self):
        config = build_database_config(
            env={
                "DB_ENGINE": "mssql",
                "DB_NAME": "SecurityCenterAI_TEST",
                "DB_HOST": "localhost\\SQLEXPRESS",
                "DB_TRUSTED_CONNECTION": "True",
                "DB_DRIVER": "ODBC Driver 18 for SQL Server",
                "DB_TRUST_SERVER_CERTIFICATE": "True",
                "DB_PASSWORD": "change-me",
            },
            base_dir=Path("C:/example/security-center"),
        )

        self.assertEqual(config["ENGINE"], "mssql")
        self.assertEqual(config["NAME"], "SecurityCenterAI_TEST")
        self.assertEqual(config["HOST"], "localhost\\SQLEXPRESS")
        self.assertEqual(config["OPTIONS"]["driver"], "ODBC Driver 18 for SQL Server")
        self.assertIn("Trusted_Connection=yes", config["OPTIONS"]["extra_params"])
        self.assertIn("TrustServerCertificate=yes", config["OPTIONS"]["extra_params"])
        self.assertEqual(config["PASSWORD"], "change-me")

    def test_sqlite_fallback_remains_default_when_db_engine_is_unset(self):
        config = build_database_config(env={}, base_dir=Path("C:/example/security-center"))

        self.assertEqual(config["ENGINE"], "django.db.backends.sqlite3")
        self.assertTrue(str(config["NAME"]).endswith("db.sqlite3"))


class SecurityDbCheckCommandTests(TestCase):
    def test_command_verifies_sqlite_test_database_without_printing_password(self):
        stdout = io.StringIO()
        stderr = io.StringIO()
        secret_value = "do-not-print-this-password"

        with patch.dict(os.environ, {"DB_PASSWORD": secret_value}, clear=False):
            call_command("security_db_check", stdout=stdout, stderr=stderr)

        output = stdout.getvalue() + stderr.getvalue()
        self.assertIn("Database engine:", output)
        self.assertIn("Database vendor: sqlite", output)
        self.assertIn("SELECT 1: ok", output)
        self.assertNotIn(secret_value, output)
