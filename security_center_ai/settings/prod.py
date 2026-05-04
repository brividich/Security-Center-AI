import os

from .base import *  # noqa: F403


DEBUG = False
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

# Production security settings (override base defaults)
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": os.environ["SQLSERVER_DATABASE"],
        "USER": os.environ["SQLSERVER_USER"],
        "PASSWORD": os.environ["SQLSERVER_PASSWORD"],
        "HOST": os.environ["SQLSERVER_HOST"],
        "PORT": os.getenv("SQLSERVER_PORT", "1433"),
        "OPTIONS": {
            "driver": os.getenv("SQLSERVER_DRIVER", "ODBC Driver 18 for SQL Server"),
            "extra_params": os.getenv("SQLSERVER_EXTRA_PARAMS", "TrustServerCertificate=no;Encrypt=yes"),
        },
    }
}
