from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, UserProfile, Content, Collaboration, TestFeeLog, BookProject, Chapter


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "is_active", "is_staff", "is_superuser")
    search_fields = ("username",)
    ordering = ("username",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("username", "display_name", "tier", "wallet_address", "content_count")
    search_fields = ("username", "display_name", "wallet_address")


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "creator", "content_type", "genre", "inventory_status", "created_at")
    list_filter = ("content_type", "genre", "inventory_status")
    search_fields = ("title", "creator__username")


@admin.register(Collaboration)
class CollaborationAdmin(admin.ModelAdmin):
    list_display = ("id", "content", "status")
    list_filter = ("status",)


@admin.register(TestFeeLog)
class TestFeeLogAdmin(admin.ModelAdmin):
    list_display = ("id", "amount", "timestamp")
    ordering = ("-timestamp",)


@admin.register(BookProject)
class BookProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "creator", "is_published", "created_at", "updated_at")
    list_filter = ("is_published",)
    search_fields = ("title", "creator__username")
    ordering = ("-updated_at",)


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "book_project", "order", "is_published", "created_at")
    list_filter = ("is_published",)
    search_fields = ("title", "book_project__title")
    ordering = ("book_project", "order")
