import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_bool(env, name, default=False):
    value = env.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"true", "1", "yes", "on"}


def env_bool(name, default=False):
    return _env_bool(os.environ, name, default)


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def _database_engine_name(value):
    engine = (value or "sqlite").strip().lower()
    if engine in {"mssql", "sqlserver", "sql_server"}:
        return "mssql"
    if engine in {"sqlite", "sqlite3", "django.db.backends.sqlite3"}:
        return "django.db.backends.sqlite3"
    return value


def _first_env(env, *names, default=""):
    for name in names:
        value = env.get(name)
        if value not in (None, ""):
            return value
    return default


def build_database_config(env=None, base_dir=None):
    if env is None:
        env = os.environ
    base_dir = Path(base_dir or BASE_DIR)
    requested_engine = _first_env(env, "DB_ENGINE", "DATABASE_ENGINE", default="sqlite")
    engine = _database_engine_name(requested_engine)

    if engine == "mssql":
        extra_params = []
        if _env_bool(env, "DB_TRUSTED_CONNECTION", False):
            extra_params.append("Trusted_Connection=yes")
        if _env_bool(env, "DB_TRUST_SERVER_CERTIFICATE", False):
            extra_params.append("TrustServerCertificate=yes")

        legacy_extra_params = env.get("SQLSERVER_EXTRA_PARAMS", "").strip()
        if legacy_extra_params:
            extra_params.append(legacy_extra_params)

        return {
            "ENGINE": "mssql",
            "NAME": _first_env(
                env,
                "DB_NAME",
                "SQLSERVER_DATABASE",
                "DATABASE_NAME",
                default="SecurityCenterAI_TEST",
            ),
            "USER": _first_env(env, "DB_USER", "SQLSERVER_USER"),
            "PASSWORD": _first_env(env, "DB_PASSWORD", "SQLSERVER_PASSWORD"),
            "HOST": _first_env(env, "DB_HOST", "SQLSERVER_HOST", default="localhost\\SQLEXPRESS"),
            "PORT": _first_env(env, "DB_PORT", "SQLSERVER_PORT"),
            "OPTIONS": {
                "driver": _first_env(
                    env,
                    "DB_DRIVER",
                    "SQLSERVER_DRIVER",
                    default="ODBC Driver 18 for SQL Server",
                ),
                "extra_params": ";".join(extra_params),
            },
        }

    database_name = _first_env(env, "DATABASE_NAME", default="db.sqlite3")
    database_path = Path(database_name)
    if not database_path.is_absolute():
        database_name = base_dir / database_path

    return {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": database_name,
    }


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY or SECRET_KEY environment variable must be set")
DEBUG = env_bool("DJANGO_DEBUG", False)
if DEBUG and not env_bool("SECURITY_CENTER_DEV_MODE", False):
    import warnings
    warnings.warn("DEBUG mode is enabled. This should only be used in development.", RuntimeWarning)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "")
if not ALLOWED_HOSTS and DEBUG:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
elif not ALLOWED_HOSTS:
    raise ValueError("DJANGO_ALLOWED_HOSTS environment variable must be set in production")
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    os.getenv("CSRF_TRUSTED_ORIGINS", ""),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "security",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "security_center_ai.cors.LocalViteCorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "security_center_ai.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "security_center_ai.wsgi.application"
ASGI_APPLICATION = "security_center_ai.asgi.application"

DATABASES = {
    "default": build_database_config()
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Europe/Rome")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_DIST_DIR = Path(os.getenv("FRONTEND_DIST_DIR", str(BASE_DIR / "frontend" / "dist")))
SERVE_REACT_APP = env_bool("SERVE_REACT_APP", True)
REACT_APP_BASE_PATH = os.getenv("REACT_APP_BASE_PATH", "/")

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

# AI Provider Configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "nvidia_nim")
AI_DEFAULT_MODEL = os.getenv("AI_DEFAULT_MODEL", "meta/llama-3.1-70b-instruct")
AI_FAST_MODEL = os.getenv("AI_FAST_MODEL", "meta/llama-3.1-8b-instruct")
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.3"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "2048"))

# NVIDIA NIM Configuration
NVIDIA_NIM_API_KEY = os.getenv("NVIDIA_NIM_API_KEY") or os.getenv("NVIDIA_API_KEY")
NVIDIA_NIM_BASE_URL = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_CHAT_COMPLETIONS_PATH = os.getenv("NVIDIA_NIM_CHAT_COMPLETIONS_PATH", "/chat/completions")

# Security headers
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", False)
SESSION_COOKIE_SECURE = env_bool("DJANGO_SESSION_COOKIE_SECURE", False)
CSRF_COOKIE_SECURE = env_bool("DJANGO_CSRF_COOKIE_SECURE", False)
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
