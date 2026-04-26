from django.urls import include, path

from .api import router
from . import views


app_name = "security"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("api/", include(router.urls)),
]
