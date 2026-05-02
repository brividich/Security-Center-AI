import os

from .base import BASE_DIR
from .base import *  # noqa: F403


DEBUG = True

if os.getenv("USE_SQLSERVER", "False").lower() == "true":
    DATABASES = {
        "default": {
            "ENGINE": "mssql",
            "NAME": os.getenv("DB_NAME", os.getenv("SQLSERVER_DATABASE", "SecurityCenterAI_TEST")),
            "USER": os.getenv("DB_USER", os.getenv("SQLSERVER_USER", "")),
            "PASSWORD": os.getenv("DB_PASSWORD", os.getenv("SQLSERVER_PASSWORD", "")),
            "HOST": os.getenv("DB_HOST", os.getenv("SQLSERVER_HOST", "localhost\\SQLEXPRESS")),
            "PORT": os.getenv("DB_PORT", os.getenv("SQLSERVER_PORT", "")),
            "OPTIONS": {
                "driver": os.getenv("DB_DRIVER", os.getenv("SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server")),
                "extra_params": os.getenv("SQLSERVER_EXTRA_PARAMS", "TrustServerCertificate=yes"),
            },
        }
    }
elif (
    os.getenv("DB_ENGINE", os.getenv("DATABASE_ENGINE", "sqlite")).strip().lower()
    not in {"mssql", "sqlserver", "sql_server"}
):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
