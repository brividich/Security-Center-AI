from django.contrib import admin
from django.urls import include, path

from .react_app import react_app_view, react_asset_view


urlpatterns = [
    path("admin/", admin.site.urls),
    path("assets/<path:path>", react_asset_view, name="react_app_assets"),
    path("", react_app_view, name="react_app"),
    path("app/", react_app_view, name="react_app_app"),
    path("configuration", react_app_view, name="react_app_configuration"),
    path("configuration/", react_app_view, name="react_app_configuration_slash"),
    path("modules", react_app_view, name="react_app_modules"),
    path("modules/", react_app_view, name="react_app_modules_slash"),
    path("modules/<path:subpath>", react_app_view, name="react_app_module_route"),
    path("addons", react_app_view, name="react_app_addons"),
    path("addons/", react_app_view, name="react_app_addons_slash"),
    path("integrations/microsoft-graph", react_app_view, name="react_app_microsoft_graph"),
    path("integrations/microsoft-graph/", react_app_view, name="react_app_microsoft_graph_slash"),
    path("reports", react_app_view, name="react_app_reports"),
    path("reports/", react_app_view, name="react_app_reports_slash"),
    path("", include("security.urls")),
]
