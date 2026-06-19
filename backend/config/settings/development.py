import os

from .base import *  # noqa: F403

DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
