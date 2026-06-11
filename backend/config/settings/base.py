import os
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-development-key")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend").split(",")
    if host.strip()
]

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "django_filters",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.identity",
    "apps.customers",
    "apps.catalog",
    "apps.inventory",
    "apps.commerce",
    "apps.employees",
    "apps.human_resources",
    "apps.finance",
    "apps.analytics",
    "apps.audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.audit.infrastructure.middleware.AuditContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "juhniosdb"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", "mysecretpassword"),
        "HOST": os.getenv("DB_HOST", "db"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

AUTH_USER_MODEL = "identity.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5174").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@juhniosrold.com")

PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "mock").lower()
if PAYMENT_PROVIDER not in {"mock", "wompi"}:
    raise ValueError("PAYMENT_PROVIDER debe ser 'mock' o 'wompi'.")

WOMPI_ENVIRONMENT = os.getenv("WOMPI_ENVIRONMENT", "sandbox").lower()
if WOMPI_ENVIRONMENT not in {"sandbox", "production"}:
    raise ValueError("WOMPI_ENVIRONMENT debe ser 'sandbox' o 'production'.")

WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY", "")
WOMPI_PRIVATE_KEY = os.getenv("WOMPI_PRIVATE_KEY", "")
WOMPI_EVENTS_SECRET = os.getenv("WOMPI_EVENTS_SECRET", "")
WOMPI_INTEGRITY_SECRET = os.getenv("WOMPI_INTEGRITY_SECRET", "")
WOMPI_SANDBOX_URL = os.getenv("WOMPI_SANDBOX_URL", "https://sandbox.wompi.co/v1")
WOMPI_PRODUCTION_URL = os.getenv(
    "WOMPI_PRODUCTION_URL",
    "https://production.wompi.co/v1",
)
WOMPI_BASE_URL = (
    WOMPI_SANDBOX_URL
    if WOMPI_ENVIRONMENT == "sandbox"
    else WOMPI_PRODUCTION_URL
)
WOMPI_HTTP_TIMEOUT = int(os.getenv("WOMPI_HTTP_TIMEOUT", "10"))
WOMPI_CHECKOUT_EXPIRATION_MINUTES = int(
    os.getenv("WOMPI_CHECKOUT_EXPIRATION_MINUTES", "30")
)

ECOMMERCE_WAREHOUSE_CODE = os.getenv("ECOMMERCE_WAREHOUSE_CODE", "PRINCIPAL")
ECOMMERCE_LOCATION_CODE = os.getenv("ECOMMERCE_LOCATION_CODE", "CATALOGO")
ECOMMERCE_FREE_SHIPPING_THRESHOLD = Decimal(
    os.getenv("ECOMMERCE_FREE_SHIPPING_THRESHOLD", "80000")
)
ECOMMERCE_SHIPPING_COST = Decimal(os.getenv("ECOMMERCE_SHIPPING_COST", "10000"))

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "shared.interfaces.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "shared.interfaces.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Juhnios Rold ERP API",
    "DESCRIPTION": "API del ERP empresarial integral de Juhnios Rold.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_BEAT_SCHEDULE = {
    "release-expired-wompi-reservations": {
        "task": "apps.commerce.infrastructure.tasks.release_expired_wompi_reservations",
        "schedule": 300.0,
    },
}
