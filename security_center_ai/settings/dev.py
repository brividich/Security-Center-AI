import os

from .base import BASE_DIR
from .base import *  # noqa: F403


DEBUG = True

if os.getenv("USE_SQLSERVER", "False").lower() == "true":
    DATABASES = {
        "default": {
            "ENGINE": "mssql",
            "NAME": os.getenv("SQLSERVER_DATABASE", "SecurityCenterAI"),
            "USER": os.getenv("SQLSERVER_USER", ""),
            "PASSWORD": os.getenv("SQLSERVER_PASSWORD", ""),
            "HOST": os.getenv("SQLSERVER_HOST", "localhost"),
            "PORT": os.getenv("SQLSERVER_PORT", "1433"),
            "OPTIONS": {
                "driver": os.getenv("SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server"),
                "extra_params": os.getenv("SQLSERVER_EXTRA_PARAMS", "TrustServerCertificate=yes"),
            },
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
