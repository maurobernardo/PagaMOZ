from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from accounts import google
from accounts.api import (
    CsrfView,
    LogoutView,
    MfaSetupView,
    MfaVerifyView,
    MyPayments,
    MyRequests,
    ObligationViewSet,
    OtpRequestView,
    OtpVerifyView,
    PortalLoginView,
    PortalPendingView,
)
from backoffice import api as bo
from catalog.api import CategoryList, Me, PortalServiceViewSet, PublicServiceViewSet
from connectors.api import ServicePrice, ServiceQuote
from core.observability import metrics
from core.views import health
from payments.api import (
    DemoSettle,
    PaymentCreate,
    PaymentDetail,
    PaymentQR,
    PortalBalances,
    PortalSettlements,
    Scenarios,
    ThreeDSVerify,
    Webhook,
)
from portal.api import (
    Dashboard,
    PortalMember,
    PortalMembers,
    PortalReconciliation,
    PortalResolveDiscrepancy,
    PortalReverse,
    PortalTransactions,
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
    path("api/health", health, name="health"),
    path("metrics", metrics, name="metrics"),
    path("api/backoffice/overview", bo.Overview.as_view()),
    path("api/backoffice/institutions", bo.InstitutionList.as_view()),
    path("api/backoffice/institutions/<slug:slug>", bo.InstitutionDetail.as_view()),
    path("api/backoffice/transactions", bo.Transactions.as_view()),
    path("api/backoffice/discrepancies", bo.Discrepancies.as_view()),
    path("api/backoffice/reconciliation/run", bo.RunReconciliation.as_view()),
    path("api/backoffice/dead-letters", bo.DeadLetters.as_view()),
    path("api/backoffice/dead-letters/<int:pk>", bo.DeadLetterAction.as_view()),
    path("api/backoffice/audit", bo.Audit.as_view()),
    path("api/backoffice/providers", bo.Providers.as_view()),
    path("api/backoffice/parameters", bo.Parameters.as_view()),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/me", Me.as_view(), name="me"),
    path("api/me/payments", MyPayments.as_view(), name="my-payments"),
    path("api/me/requests", MyRequests.as_view(), name="my-requests"),
    path("api/auth/otp/request", OtpRequestView.as_view(), name="otp-request"),
    path("api/auth/otp/verify", OtpVerifyView.as_view(), name="otp-verify"),
    path("api/auth/logout", LogoutView.as_view(), name="logout"),
    path("api/auth/csrf", CsrfView.as_view(), name="csrf"),
    path("api/auth/portal/login", PortalLoginView.as_view(), name="portal-login"),
    path("api/auth/portal/pending", PortalPendingView.as_view(), name="portal-pending"),
    path("api/auth/google/status", google.status, name="google-status"),
    path("api/auth/google/start", google.start, name="google-start"),
    path("api/auth/google/callback", google.callback, name="google-callback"),
    path("api/auth/portal/mfa/setup", MfaSetupView.as_view(), name="mfa-setup"),
    path("api/auth/portal/mfa/verify", MfaVerifyView.as_view(), name="mfa-verify"),
    path("api/catalog/categories", CategoryList.as_view(), name="categories"),
    path("api/payments", PaymentCreate.as_view(), name="payment-create"),
    path("api/payments/scenarios", Scenarios.as_view(), name="payment-scenarios"),
    path("api/payments/<str:reference>", PaymentDetail.as_view(), name="payment-detail"),
    path("api/payments/<str:reference>/receipt.pdf", ReceiptPdf.as_view(), name="receipt-pdf"),
    path("api/payments/<str:reference>/3ds", ThreeDSVerify.as_view(), name="payment-3ds"),
    path("api/payments/<str:reference>/qr.svg", PaymentQR.as_view(), name="payment-qr"),
    path("api/payments/<str:reference>/simular", DemoSettle.as_view(), name="payment-demo-settle"),
    path("api/receipts/verify", VerifyByFile.as_view(), name="receipt-verify-file"),
    path("api/receipts/<str:code>", VerifyByCode.as_view(), name="receipt-verify"),
    path("api/webhooks/<str:method>", Webhook.as_view(), name="webhook"),
    path("api/portal/<slug:institution_slug>/settlements", PortalSettlements.as_view()),
    path("api/portal/<slug:institution_slug>/balances", PortalBalances.as_view()),
    path("api/portal/<slug:institution_slug>/dashboard", Dashboard.as_view()),
    path("api/portal/<slug:institution_slug>/transactions", PortalTransactions.as_view()),
    path("api/portal/<slug:institution_slug>/transactions/<str:reference>/reverse", PortalReverse.as_view()),
    path("api/portal/<slug:institution_slug>/reconciliation", PortalReconciliation.as_view()),
    path("api/portal/<slug:institution_slug>/reconciliation/<int:pk>/resolve", PortalResolveDiscrepancy.as_view()),
    path("api/portal/<slug:institution_slug>/members", PortalMembers.as_view()),
    path("api/portal/<slug:institution_slug>/members/<int:pk>", PortalMember.as_view()),
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

if settings.ADMIN_ENABLED:
    urlpatterns.append(path("admin/", admin.site.urls))
