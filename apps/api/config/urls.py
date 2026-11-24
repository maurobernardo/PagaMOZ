from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from catalog.api import CategoryList, Me, PortalServiceViewSet, PublicServiceViewSet
from core.views import health
from payments.api import (
    PaymentCreate,
    PaymentDetail,
    PortalBalances,
    PortalSettlements,
    Scenarios,
    Webhook,
)

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
    path("api/payments", PaymentCreate.as_view(), name="payment-create"),
    path("api/payments/scenarios", Scenarios.as_view(), name="payment-scenarios"),
    path("api/payments/<str:reference>", PaymentDetail.as_view(), name="payment-detail"),
    path("api/webhooks/<str:method>", Webhook.as_view(), name="webhook"),
    path("api/portal/<slug:institution_slug>/settlements", PortalSettlements.as_view()),
    path("api/portal/<slug:institution_slug>/balances", PortalBalances.as_view()),
    path("api/", include(public.urls)),
    path("api/portal/<slug:institution_slug>/", include(portal.urls)),
]
