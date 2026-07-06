import os

from .base import *  # noqa: F403

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "3600"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

_WEAK_DEFAULTS = {
    "unsafe-development-key",
    "change-me",
    "mysecretpassword",
    "development-only-change-me",
}
if SECRET_KEY in _WEAK_DEFAULTS:  # noqa: F405
    raise RuntimeError(
        "DJANGO_SECRET_KEY debe definirse con un valor seguro en producción."
    )
if DATABASES["default"]["PASSWORD"] in _WEAK_DEFAULTS:  # noqa: F405
    raise RuntimeError("DB_PASSWORD debe definirse con un valor seguro en producción.")
