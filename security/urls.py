from django.urls import include, path

from .api import router
from . import views


app_name = "security"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("security/", views.dashboard, name="security_dashboard"),
    path("security/alerts/", views.alerts_list, name="alerts_list"),
    path("security/alerts/<int:pk>/", views.alert_detail, name="alert_detail"),
    path("security/alerts/<int:pk>/actions/<slug:action>/", views.alert_action, name="alert_action"),
    path("security/tickets/", views.tickets_list, name="tickets_list"),
    path("security/kpis/", views.kpis_page, name="kpis"),
    path("security/pipeline/", views.pipeline_page, name="pipeline"),
    path("security/pipeline/run/<slug:action>/", views.pipeline_run, name="pipeline_run"),
    path("api/", include(router.urls)),
]
