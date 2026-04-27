import os

from celery import Celery


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "security_center_ai.settings.dev")

app = Celery("security_center_ai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
