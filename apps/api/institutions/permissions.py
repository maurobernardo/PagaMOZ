from django.http import Http404
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Institution, Membership

Role = Membership.Role


def resolve_membership(request, slug) -> Membership:
    """Membership do utilizador na instituição do URL. Não-membro -> 404 (não revela que existe)."""
    cached = getattr(request, "_membership", None)
    if cached and cached.institution.slug == slug:
        return cached
    if not request.user.is_authenticated:
        raise Http404
    m = (
        Membership.objects.select_related("institution")
        .filter(user=request.user, institution__slug=slug)
        .exclude(institution__status=Institution.Status.SUSPENDED)
        .first()
    )
    if m is None:
        raise Http404
    request._membership = m
    return m


class InstitutionRole(BasePermission):
    """Leitura: qualquer membro. Escrita: papéis em `view.write_roles` (por omissão só admin)."""

    def has_permission(self, request, view):
        m = resolve_membership(request, view.kwargs["institution_slug"])
        if request.method in SAFE_METHODS:
            return True
        return m.role in getattr(view, "write_roles", {Role.ADMIN})
