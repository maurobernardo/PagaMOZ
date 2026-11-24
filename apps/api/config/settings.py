from pathlib import Path

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me" if DEBUG else environ.Env.NOTSET)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
# Desligado por omissão fora de DEBUG: em demo os códigos OTP/MFA aparecem na resposta.
DEMO_MODE = env.bool("DEMO_MODE", default=DEBUG)
# O /admin do Django não passa pelo MFA do portal: só ligado em dev ou explicitamente.
ADMIN_ENABLED = env.bool("ADMIN_ENABLED", default=DEBUG)
WEBHOOK_SECRET = env("WEBHOOK_SECRET", default="dev-webhook-secret" if DEBUG else environ.Env.NOTSET)
PAYMENT_EXPIRY_MINUTES = env.int("PAYMENT_EXPIRY_MINUTES", default=15)
RECEIPT_SIGNING_KEY = env("RECEIPT_SIGNING_KEY", default="dev-receipt-key" if DEBUG else environ.Env.NOTSET)
PORTAL_REQUIRE_MFA = env.bool("PORTAL_REQUIRE_MFA", default=True)
PUBLIC_WEB_URL = env("PUBLIC_WEB_URL", default="http://localhost:3000")  # vai no QR do comprovativo

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "core",
    "accounts",
    "institutions",
    "catalog",
    "audit",
    "ledger",
    "payments",
    "settlement",
    "connectors",
    "servicerequests",
    "receipts",
    "portal",
    "reconciliation",
    "backoffice",
]

MIDDLEWARE = [
    "core.observability.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# ponytail: SQLite por omissão para dev sem Docker; Postgres via DATABASE_URL (CI/produção).
DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
if DATABASES["default"]["ENGINE"].endswith("sqlite3"):
    # Concorrência em dev/demo: WAL (leitores não bloqueiam), esperar em vez de "database is locked",
    # e IMMEDIATE para evitar o impasse de duas transacções a tentar escrever ao mesmo tempo.
    DATABASES["default"].setdefault("OPTIONS", {}).update(
        {
            "timeout": 20,
            "transaction_mode": "IMMEDIATE",
            "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
        }
    )
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Sem REDIS_URL, as tarefas Celery correm em linha (eager) — suficiente para dev local.
REDIS_URL = env("REDIS_URL", default="")
CELERY_BROKER_URL = REDIS_URL or "memory://"
CELERY_RESULT_BACKEND = REDIS_URL or None
CELERY_TASK_ALWAYS_EAGER = not REDIS_URL
CELERY_TIMEZONE = "Africa/Maputo"
CELERY_BEAT_SCHEDULE = {
    "ping": {"task": "core.tasks.ping", "schedule": 300.0},
    "expirar-pagamentos": {"task": "payments.tasks.expire_stale_payments", "schedule": 60.0},
    "reconciliacao-diaria": {
        "task": "reconciliation.services.run_daily_reconciliation",
        "schedule": crontab(hour=23, minute=30),
    },
    "liquidacao-diaria": {
        "task": "settlement.services.run_daily_settlement",
        "schedule": crontab(hour=18, minute=0),
    },
}

LANGUAGE_CODE = "pt-pt"
TIME_ZONE = "Africa/Maputo"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Anexos são privados: guardados fora de qualquer pasta servida; só saem pelo portal com RBAC.
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media_private"))
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
# A web chama a API pelo mesmo domínio (proxy /api do Next) -> cookies de sessão first-party.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000", "http://127.0.0.1:3000"])
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_COOKIE_SAMESITE = CSRF_COOKIE_SAMESITE = "Lax"

THROTTLE_RATES = {"anon": "120/min", "user": "600/min", "otp": "10/min", "lookup": "30/min", "verify": "60/min"}
if env.bool("LOAD_TEST", default=False):  # só para medir capacidade; nunca em produção
    if not DEBUG:
        raise RuntimeError("LOAD_TEST só com DEBUG=true.")
    THROTTLE_RATES = dict.fromkeys(THROTTLE_RATES, "1000000/min")

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": THROTTLE_RATES,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "PagaMOZ API",
    "DESCRIPTION": "Plataforma de pagamentos de serviços — protótipo de demonstração.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "PaymentStatusEnum": "payments.models.Status",
        "RequestStatusEnum": "servicerequests.models.RequestStatus",
    },
}

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    # Começa curto; subir para 1 ano (31536000) só depois de confirmar HTTPS em todos os subdomínios.
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=3600)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False)
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
# Chave para cifrar campos sensíveis em repouso (Fernet). Gerar: python -c "from cryptography.fernet import Fernet;
# print(Fernet.generate_key().decode())". Várias chaves separadas por vírgula = rotação (a primeira cifra).
FIELD_ENCRYPTION_KEYS = env.list(
    "FIELD_ENCRYPTION_KEYS", default=[] if not DEBUG else ["MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="]
)
if not FIELD_ENCRYPTION_KEYS:
    raise RuntimeError("Defina FIELD_ENCRYPTION_KEYS em produção.")

# ---------- Observabilidade ----------
METRICS_TOKEN = env("METRICS_TOKEN", default="")  # vazio = /metrics desligado
LOG_JSON = env.bool("LOG_JSON", default=not DEBUG)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "core.observability.RequestIdFilter"}},
    "formatters": {
        "json": {"()": "core.observability.JsonFormatter"},
        "text": {"format": "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if LOG_JSON else "text",
            "filters": ["request_id"],
        }
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {
        "django.server": {"level": "WARNING"},  # já temos o access log próprio
        "pagamoz.access": {"level": "INFO"},
        "celery.app.trace": {"level": "WARNING"},  # uma linha por tarefa é ruído; falhas vão para pagamoz.tasks
    },
}
