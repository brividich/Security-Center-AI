import os

from django.core.wsgi import get_wsgi_application


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "security_center_ai.settings.dev")

application = get_wsgi_application()
