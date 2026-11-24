from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from accounts.api import (
    LogoutView,
    MyPayments,
    MyRequests,
    ObligationViewSet,
    OtpRequestView,
    OtpVerifyView,
)
from catalog.api import CategoryList, Me, PortalServiceViewSet, PublicServiceViewSet
from connectors.api import ServicePrice, ServiceQuote
from core.views import health
from payments.api import (
    PaymentCreate,
    PaymentDetail,
    PortalBalances,
    PortalSettlements,
    Scenarios,
    Webhook,
)
from receipts.api import ReceiptPdf, VerifyByCode, VerifyByFile
from servicerequests.api import (
    PortalAttachmentDownload,
    PortalRequestDetail,
    PortalRequestList,
    PortalRequestStatus,
    RequestCreate,
    RequestDetail,
)

public = SimpleRouter(trailing_slash=False)
public.register("catalog/services", PublicServiceViewSet, basename="public-service")
public.register("me/obligations", ObligationViewSet, basename="obligation")
portal = SimpleRouter(trailing_slash=False)
portal.register("services", PortalServiceViewSet, basename="portal-service")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/me", Me.as_view(), name="me"),
    path("api/me/payments", MyPayments.as_view(), name="my-payments"),
    path("api/me/requests", MyRequests.as_view(), name="my-requests"),
    path("api/auth/otp/request", OtpRequestView.as_view(), name="otp-request"),
    path("api/auth/otp/verify", OtpVerifyView.as_view(), name="otp-verify"),
    path("api/auth/logout", LogoutView.as_view(), name="logout"),
    path("api/catalog/categories", CategoryList.as_view(), name="categories"),
    path("api/payments", PaymentCreate.as_view(), name="payment-create"),
    path("api/payments/scenarios", Scenarios.as_view(), name="payment-scenarios"),
    path("api/payments/<str:reference>", PaymentDetail.as_view(), name="payment-detail"),
    path("api/payments/<str:reference>/receipt.pdf", ReceiptPdf.as_view(), name="receipt-pdf"),
    path("api/receipts/verify", VerifyByFile.as_view(), name="receipt-verify-file"),
    path("api/receipts/<str:code>", VerifyByCode.as_view(), name="receipt-verify"),
    path("api/webhooks/<str:method>", Webhook.as_view(), name="webhook"),
    path("api/portal/<slug:institution_slug>/settlements", PortalSettlements.as_view()),
    path("api/portal/<slug:institution_slug>/balances", PortalBalances.as_view()),
    path("api/catalog/services/<int:pk>/quote", ServiceQuote.as_view(), name="service-quote"),
    path("api/catalog/services/<int:pk>/price", ServicePrice.as_view(), name="service-price"),
    path("api/requests", RequestCreate.as_view(), name="request-create"),
    path("api/requests/<str:code>", RequestDetail.as_view(), name="request-detail"),
    path("api/portal/<slug:institution_slug>/requests", PortalRequestList.as_view()),
    path("api/portal/<slug:institution_slug>/requests/<str:code>", PortalRequestDetail.as_view()),
    path("api/portal/<slug:institution_slug>/requests/<str:code>/status", PortalRequestStatus.as_view()),
    path(
        "api/portal/<slug:institution_slug>/requests/<str:code>/attachments/<int:att_id>",
        PortalAttachmentDownload.as_view(),
    ),
    path("api/", include(public.urls)),
    path("api/portal/<slug:institution_slug>/", include(portal.urls)),
]
