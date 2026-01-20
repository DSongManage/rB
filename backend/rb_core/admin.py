from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import (
    User, UserProfile, Content, Collaboration, TestFeeLog, BookProject, Chapter,
    CollaborativeProject, CollaboratorRole, ProjectSection, ProjectComment, BetaInvite,
    DelistApproval, CollaboratorApproval, Purchase, CollaboratorPayment, BlockchainAuditLog
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
    list_display = ("id", "title", "book_project", "order", "is_published", "is_listed", "delisted_by", "created_at")
    list_filter = ("is_published", "is_listed")
    search_fields = ("title", "book_project__title")
    ordering = ("book_project", "order")
    readonly_fields = ("delisted_at",)


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

    decline_selected.short_description = 'Decline selected beta requests'


@admin.register(DelistApproval)
class DelistApprovalAdmin(admin.ModelAdmin):
    """Admin interface for delist approval workflow."""
    list_display = ("id", "chapter", "requested_by", "status", "created_at", "resolved_at")
    list_filter = ("status", "created_at")
    search_fields = ("chapter__title", "requested_by__username", "reason")
    readonly_fields = ("created_at", "resolved_at")
    ordering = ("-created_at",)

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('chapter', 'chapter__book_project', 'requested_by')


@admin.register(CollaboratorApproval)
class CollaboratorApprovalAdmin(admin.ModelAdmin):
    """Admin interface for individual collaborator responses."""
    list_display = ("id", "delist_request", "collaborator", "approved", "responded_at")
    list_filter = ("approved", "responded_at")
    search_fields = ("delist_request__chapter__title", "collaborator__username")
    readonly_fields = ("responded_at",)
    ordering = ("-responded_at",)

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('delist_request', 'delist_request__chapter', 'collaborator')


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    """Admin interface for purchases with CC fee pass-through breakdown."""
    list_display = [
        'id',
        'item_display',
        'buyer_username',
        'chapter_price_display',
        'credit_card_fee_display',
        'buyer_total_display',
        'creator_receives_display',
        'status',
        'usdc_distribution_status',
        'purchased_at'
    ]
    list_filter = ['status', 'usdc_distribution_status', 'payment_provider', 'purchased_at']
    search_fields = ['user__username', 'chapter__title', 'content__title']
    readonly_fields = [
        'stripe_payment_intent_id',
        'stripe_checkout_session_id',
        'nft_mint_address',
        'transaction_signature',
        'usdc_distribution_transaction',
        'purchased_at',
        'usdc_distributed_at'
    ]
    ordering = ['-purchased_at']

    def item_display(self, obj):
        """Display chapter or content title."""
        if obj.chapter:
            return f"{obj.chapter.book_project.title} - Ch. {obj.chapter.order}"
        elif obj.content:
            return obj.content.title
        return 'N/A'
    item_display.short_description = 'Item'

    def buyer_username(self, obj):
        """Display buyer username."""
        return obj.user.username
    buyer_username.short_description = 'Buyer'

    def chapter_price_display(self, obj):
        """Display chapter price (new fee structure)."""
        if obj.chapter_price:
            return f'${obj.chapter_price:.2f}'
        return f'${obj.purchase_price_usd:.2f} (legacy)'
    chapter_price_display.short_description = 'Chapter Price'

    def credit_card_fee_display(self, obj):
        """Display credit card fee passed to buyer."""
        if obj.credit_card_fee:
            return f'${obj.credit_card_fee:.2f}'
        return 'N/A (legacy)'
    credit_card_fee_display.short_description = 'CC Fee'

    def buyer_total_display(self, obj):
        """Display total amount buyer paid."""
        if obj.buyer_total:
            return f'${obj.buyer_total:.2f}'
        return f'${obj.purchase_price_usd:.2f} (legacy)'
    buyer_total_display.short_description = 'Buyer Paid'

    def creator_receives_display(self, obj):
        """Display what creator receives (90% of chapter price)."""
        if obj.chapter_price:
            creator_share = obj.chapter_price * 0.90
            return f'${creator_share:.2f} (90%)'
        elif obj.purchase_price_usd:
            # Legacy: Calculate from old structure
            net = obj.purchase_price_usd - (obj.purchase_price_usd * 0.029 + 0.30)
            creator_share = net * 0.90
            return f'${creator_share:.2f} (legacy)'
        return 'N/A'
    creator_receives_display.short_description = 'Creator Gets'

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('user', 'chapter', 'chapter__book_project', 'content')


@admin.register(CollaboratorPayment)
class CollaboratorPaymentAdmin(admin.ModelAdmin):
    """Admin interface for collaborator payment records."""
    list_display = [
        'id',
        'purchase',
        'collaborator_username',
        'amount_display',
        'percentage',
        'role',
        'transaction_sig_short'
    ]
    list_filter = ['role']
    search_fields = ['collaborator__username', 'collaborator_wallet', 'transaction_signature']
    readonly_fields = ['transaction_signature']
    ordering = ['-purchase__purchased_at']

    def collaborator_username(self, obj):
        """Display collaborator username."""
        return obj.collaborator.username
    collaborator_username.short_description = 'Collaborator'

    def amount_display(self, obj):
        """Display USDC amount."""
        return f'{obj.amount_usdc:.6f} USDC'
    amount_display.short_description = 'Amount'

    def transaction_sig_short(self, obj):
        """Display shortened transaction signature."""
        if obj.transaction_signature:
            return f'{obj.transaction_signature[:20]}...'
        return 'N/A'
    transaction_sig_short.short_description = 'TX Signature'

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('purchase', 'collaborator')


@admin.register(BlockchainAuditLog)
class BlockchainAuditLogAdmin(admin.ModelAdmin):
    """
    Admin interface for blockchain audit logs.

    Read-only view - no add/edit/delete permissions for audit trail integrity.
    """
    list_display = [
        'id',
        'action',
        'status',
        'user_display',
        'purchase_display',
        'amount_display',
        'tx_signature_short',
        'duration_display',
        'created_at'
    ]
    list_filter = ['action', 'status', 'created_at']
    search_fields = [
        'transaction_signature',
        'nft_mint_address',
        'user__username',
        'error_message',
        'from_wallet',
        'to_wallet'
    ]
    readonly_fields = [
        'action',
        'status',
        'user',
        'purchase',
        'batch_purchase',
        'transaction_signature',
        'nft_mint_address',
        'from_wallet',
        'to_wallet',
        'amount_usdc',
        'gas_fee_usd',
        'platform_fee_usdc',
        'metadata',
        'error_message',
        'error_code',
        'celery_task_id',
        'created_at',
        'completed_at',
        'duration_ms'
    ]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Operation', {
            'fields': ('action', 'status', 'celery_task_id')
        }),
        ('Related Records', {
            'fields': ('user', 'purchase', 'batch_purchase')
        }),
        ('Blockchain Details', {
            'fields': ('transaction_signature', 'nft_mint_address', 'from_wallet', 'to_wallet')
        }),
        ('Financial', {
            'fields': ('amount_usdc', 'gas_fee_usd', 'platform_fee_usdc')
        }),
        ('Timing', {
            'fields': ('created_at', 'completed_at', 'duration_ms')
        }),
        ('Error Details', {
            'fields': ('error_message', 'error_code'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )

    def user_display(self, obj):
        """Display username or 'system'."""
        return obj.user.username if obj.user else 'system'
    user_display.short_description = 'User'
    user_display.admin_order_field = 'user__username'

    def purchase_display(self, obj):
        """Display purchase ID or batch purchase ID."""
        if obj.purchase:
            return f'P#{obj.purchase.id}'
        if obj.batch_purchase:
            return f'B#{obj.batch_purchase.id}'
        return '-'
    purchase_display.short_description = 'Purchase'

    def amount_display(self, obj):
        """Display USDC amount."""
        if obj.amount_usdc:
            return f'${obj.amount_usdc:.2f}'
        return '-'
    amount_display.short_description = 'Amount'
    amount_display.admin_order_field = 'amount_usdc'

    def tx_signature_short(self, obj):
        """Display shortened transaction signature."""
        if obj.transaction_signature:
            return f'{obj.transaction_signature[:16]}...'
        return '-'
    tx_signature_short.short_description = 'TX Sig'

    def duration_display(self, obj):
        """Display duration in human-readable format."""
        if obj.duration_ms:
            if obj.duration_ms >= 1000:
                return f'{obj.duration_ms / 1000:.1f}s'
            return f'{obj.duration_ms}ms'
        return '-'
    duration_display.short_description = 'Duration'
    duration_display.admin_order_field = 'duration_ms'

    def get_queryset(self, request):
        """Optimize queries with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('user', 'purchase', 'batch_purchase')

    def has_add_permission(self, request):
        """Disable adding audit logs through admin."""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing audit logs - they are immutable."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Disable deleting audit logs for audit trail integrity."""
        return False
