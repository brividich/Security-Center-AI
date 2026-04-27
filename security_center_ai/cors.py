from django.conf import settings
from django.http import HttpResponse


class LocalViteCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        if request.method == "OPTIONS" and self._is_allowed(origin):
            response = HttpResponse()
        else:
            response = self.get_response(request)
        if self._is_allowed(origin):
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Headers"] = "accept, authorization, content-type, x-csrftoken"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    def _is_allowed(self, origin):
        return bool(origin and origin in getattr(settings, "CORS_ALLOWED_ORIGINS", ()))
