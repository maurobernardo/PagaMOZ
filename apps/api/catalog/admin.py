from django.contrib import admin

from audit.models import AuditLog
from institutions.models import Institution, Membership

from .models import Category, Service


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "order"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "institution", "category", "integration_level", "pricing", "is_active"]
    list_filter = ["category", "integration_level", "is_active"]
    search_fields = ["name", "institution__name"]


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ["name", "status", "is_demo"]
    prepopulated_fields = {"slug": ["name"]}
    inlines = [MembershipInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "actor", "institution", "target_type", "target_id"]
    list_filter = ["action"]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False
