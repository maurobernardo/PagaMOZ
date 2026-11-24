from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from catalog.api import CategoryList, Me, PortalServiceViewSet, PublicServiceViewSet
from core.views import health

public = SimpleRouter(trailing_slash=False)
public.register("catalog/services", PublicServiceViewSet, basename="public-service")
portal = SimpleRouter(trailing_slash=False)
portal.register("services", PortalServiceViewSet, basename="portal-service")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/me", Me.as_view(), name="me"),
    path("api/catalog/categories", CategoryList.as_view(), name="categories"),
    path("api/", include(public.urls)),
    path("api/portal/<slug:institution_slug>/", include(portal.urls)),
]
