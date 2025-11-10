from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import (
    User, UserProfile, Content, Collaboration, TestFeeLog, BookProject, Chapter,
    CollaborativeProject, CollaboratorRole, ProjectSection, ProjectComment, BetaInvite
)
from .views.beta import send_beta_invite_email


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


@admin.register(CollaborativeProject)
class CollaborativeProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "content_type", "status", "created_by", "created_at", "updated_at")
    list_filter = ("content_type", "status")
    search_fields = ("title", "created_by__username", "description")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(CollaboratorRole)
class CollaboratorRoleAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "project", "role", "revenue_percentage", "status", "invited_at", "accepted_at")
    list_filter = ("status", "role")
    search_fields = ("user__username", "project__title", "role")
    ordering = ("project", "-revenue_percentage")
    readonly_fields = ("invited_at", "accepted_at")


@admin.register(ProjectSection)
class ProjectSectionAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "section_type", "title", "owner", "order", "created_at", "updated_at")
    list_filter = ("section_type",)
    search_fields = ("project__title", "title", "owner__username")
    ordering = ("project", "order")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "section", "author", "resolved", "created_at")
    list_filter = ("resolved",)
    search_fields = ("project__title", "author__username", "content")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)


@admin.register(BetaInvite)
class BetaInviteAdmin(admin.ModelAdmin):
    """Admin interface for beta invite management."""
    list_display = ("email", "status", "invite_code", "invited_by", "created_at", "used_at")
    list_filter = ("status", "created_at", "used_at")
    search_fields = ("email", "invite_code", "message")
    readonly_fields = ("invite_code", "invited_by", "used_at", "created_at")
    ordering = ("-created_at",)
    actions = ["approve_selected", "decline_selected"]

    def approve_selected(self, request, queryset):
        """Approve and send beta invites to selected requests."""
        count = 0
        for invite in queryset.filter(status='requested'):
            try:
                invite.generate_invite_code()
                invite.status = 'approved'
                invite.invited_by = request.user
                invite.save()
                send_beta_invite_email(invite)
                count += 1
            except Exception as e:
                self.message_user(
                    request,
                    f'Failed to send invite to {invite.email}: {str(e)}',
                    level='error'
                )

        if count > 0:
            self.message_user(
                request,
                f'Successfully approved and sent {count} beta invite(s)',
                level='success'
            )

    approve_selected.short_description = 'Approve and send invites to selected requests'

    def decline_selected(self, request, queryset):
        """Decline selected beta requests."""
        count = queryset.filter(status='requested').update(status='declined')
        self.message_user(
            request,
            f'Declined {count} beta request(s)',
            level='success'
        )
