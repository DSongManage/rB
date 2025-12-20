from rest_framework import serializers
from .models import (
    Content, UserProfile, User, BookProject, Chapter, Purchase, ReadingProgress,
    CollaborativeProject, CollaboratorRole, ProjectSection, ProjectComment, Notification,
    BetaInvite, ExternalPortfolioItem, CollaboratorRating, ContractTask, RoleDefinition,
    ContentLike, ContentComment, ContentRating, CreatorReview, Tag
)
from django.utils.crypto import salted_hmac
from django.utils import timezone
import hashlib


class TagSerializer(serializers.ModelSerializer):
    """Serializer for Tag model - used for content discovery."""

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'category', 'is_predefined', 'usage_count']
        read_only_fields = ['id', 'slug', 'usage_count']


class ContentSerializer(serializers.ModelSerializer):
    """Serializer for Content model (FR4/FR5 in REQUIREMENTS.md).

    - Exposes metadata only; full content via IPFS (decentralized, no server storage per ARCHITECTURE.md).
    - Validation: Ensure teaser_link is valid URL; add custom validators for moderation (GUIDELINES.md).
    """
    creator_username = serializers.SerializerMethodField()
    creator_avatar = serializers.SerializerMethodField()
    owned = serializers.SerializerMethodField()
    is_collaborative = serializers.SerializerMethodField()
    collaborators = serializers.SerializerMethodField()

    # Social engagement
    user_has_liked = serializers.SerializerMethodField()

    # Tags - read-only nested serializer for output, write-only tag_ids for input
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Content
        fields = [
            'id', 'title', 'teaser_link', 'teaser_html', 'created_at', 'creator', 'creator_username', 'creator_avatar',
            'content_type', 'genre', 'authors_note',
            'price_usd', 'editions', 'teaser_percent', 'watermark_preview', 'inventory_status', 'nft_contract', 'owned',
            'is_collaborative', 'collaborators', 'view_count',
            # Social engagement fields
            'like_count', 'average_rating', 'rating_count', 'user_has_liked',
            # Tags
            'tags', 'tag_ids'
        ]
        read_only_fields = ['creator', 'creator_username', 'creator_avatar', 'teaser_link', 'teaser_html', 'created_at', 'owned', 'is_collaborative', 'collaborators', 'view_count', 'like_count', 'average_rating', 'rating_count', 'user_has_liked', 'tags']

    def get_user_has_liked(self, obj):
        """Check if the requesting user has liked this content."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_creator_username(self, obj):
        return obj.creator.username if obj.creator else 'Unknown'

    def get_creator_avatar(self, obj):
        """Get creator's avatar URL from their profile."""
        if obj.creator:
            try:
                profile = obj.creator.profile  # related_name is 'profile', not 'userprofile'
                return profile.resolved_avatar_url or None
            except Exception:
                pass
        return None

    def get_owned(self, obj):
        """Check if the requesting user owns this content."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.is_owned_by(request.user)
        return False

    def get_is_collaborative(self, obj):
        """Check if this content comes from a collaborative project."""
        try:
            # Check if content has a source_collaborative_project
            if hasattr(obj, 'source_collaborative_project') and obj.source_collaborative_project.exists():
                return True
        except Exception:
            pass
        return False

    def get_collaborators(self, obj):
        """Get collaborators for collaborative content."""
        try:
            # Check if content has a source_collaborative_project
            if hasattr(obj, 'source_collaborative_project') and obj.source_collaborative_project.exists():
                collab_project = obj.source_collaborative_project.first()
                if collab_project:
                    return [{
                        'username': c.user.username,
                        'role': c.role,
                        'revenue_percentage': float(c.revenue_percentage)
                    } for c in collab_project.collaborators.filter(status='accepted')]
        except Exception:
            pass
        return []

    def validate_teaser_link(self, value):
        if not value.startswith('http'):
            raise serializers.ValidationError("Teaser link must be a valid URL.")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    banner = serializers.SerializerMethodField()
    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'display_name', 'wallet_address',
            'avatar', 'banner', 'avatar_url', 'banner_url',
            'location', 'roles', 'genres', 'bio', 'skills', 'social_links',
            'is_private', 'status',
            'content_count', 'total_sales_usd', 'tier', 'fee_bps',
            # Creator review aggregates
            'average_review_rating', 'review_count'
        ]
        read_only_fields = ['username', 'avatar', 'banner', 'content_count', 'total_sales_usd', 'tier', 'fee_bps', 'average_review_rating', 'review_count']

    def get_avatar(self, obj: UserProfile) -> str:
        import logging
        logger = logging.getLogger(__name__)

        url = obj.resolved_avatar_url
        logger.info(f'[Avatar] resolved_avatar_url for {obj.username}: {url}')
        try:
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request and url and url.startswith('/'):
                absolute_url = request.build_absolute_uri(url)
                logger.info(f'[Avatar] Built absolute URI: {absolute_url}')
                return absolute_url
        except Exception as e:
            logger.error(f'[Avatar] Error building URL: {e}')
            pass
        logger.info(f'[Avatar] Returning URL as-is: {url}')
        return url

    def get_banner(self, obj: UserProfile) -> str:
        url = obj.resolved_banner_url
        try:
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
        except Exception:
            pass
        return url


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=50)
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    web3auth_token = serializers.CharField(required=False, allow_blank=True)
    wallet_address = serializers.CharField(required=False, allow_blank=True, max_length=44)
    invite_code = serializers.CharField(required=True, max_length=32)  # REQUIRED for beta
    email = serializers.EmailField(required=False, allow_blank=True)  # Optional, from invite
    password = serializers.CharField(required=False, allow_blank=True, write_only=True, min_length=6, max_length=128)

    def validate_invite_code(self, value: str) -> str:
        """Validate beta invite code is valid and unused."""
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError('Beta invite code is required')

        try:
            invite = BetaInvite.objects.get(
                invite_code=value,
                status__in=['approved', 'sent'],
                used_at__isnull=True
            )
            # Store invite in context for later use
            self.context['beta_invite'] = invite
            return value
        except BetaInvite.DoesNotExist:
            raise serializers.ValidationError('Invalid or expired beta invite code')

    def validate_username(self, value: str) -> str:
        value = value.strip()
        if value == '':
            return value
        UserProfile.HANDLE_VALIDATOR(value)
        if User.objects.filter(username=value).exists() or UserProfile.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken')
        return value

    def validate_email(self, value: str) -> str:
        """Validate email matches beta invite if provided."""
        if not value:
            return value

        value = value.lower().strip()

        # Check if email already registered
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already registered')

        return value

    def validate(self, data):
        """Cross-field validation: verify email matches invite."""
        email = data.get('email', '').lower().strip()
        beta_invite = self.context.get('beta_invite')

        # If email provided, verify it matches the invite
        if email and beta_invite and beta_invite.email.lower() != email:
            raise serializers.ValidationError({
                'email': 'Email does not match beta invite'
            })

        return data

    def create(self, validated_data):
        from django.utils import timezone

        desired = validated_data.get('username', '').strip()
        display_name = validated_data.get('display_name', '').strip()
        wallet_address = validated_data.get('wallet_address', '').strip() or None
        email = validated_data.get('email', '').strip() or None
        invite_code = validated_data.get('invite_code', '').strip().upper()

        # Get beta invite from context (validated earlier)
        beta_invite = self.context.get('beta_invite')

        # If no email provided, use email from invite
        if not email and beta_invite:
            email = beta_invite.email

        # Web3Auth: if token provided, verify and derive wallet (MVP stub)
        token = validated_data.get('web3auth_token', '').strip()
        if token and not wallet_address:
            # MVP: treat token as proof and skip verification; do not store token
            # Future: verify JWT with Web3Auth JWKs and extract wallet
            wallet_address = None

        # Auto-generate username if missing
        if not desired:
            import random
            base = 'renaiss'
            while True:
                candidate = f"{base}{random.randint(1000, 999999)}"
                if not User.objects.filter(username=candidate).exists():
                    desired = candidate
                    break

        # Get password from validated data
        password = validated_data.get('password', '').strip() or None

        # Create user with email and password
        user = User.objects.create_user(
            username=desired,
            email=email or '',
            password=password
        )

        # Create profile
        profile = UserProfile.objects.create(
            user=user,
            username=desired,
            display_name=display_name,
            wallet_address=wallet_address
        )

        # Create Circle W3S wallet for new user (async, non-blocking)
        import logging
        logger = logging.getLogger(__name__)

        try:
            from rb_core.tasks import create_circle_wallet_for_user_task
            # Queue wallet creation as background task (non-blocking)
            create_circle_wallet_for_user_task.delay(user.id, email or '')
            logger.info(f'[Signup] ✅ Queued Circle W3S wallet creation for user {user.id}')
        except ImportError as e:
            # Celery not available or tasks module not found
            logger.error(f'[Signup] ❌ Cannot import Celery task (Celery may not be running): {e}')
        except Exception as e:
            # Other errors (Celery broker down, etc.)
            logger.error(f'[Signup] ❌ Failed to queue Circle W3S wallet creation: {e}')

        # Mark beta invite as used
        if beta_invite:
            beta_invite.status = 'used'
            beta_invite.used_at = timezone.now()
            beta_invite.save()

        return profile


class ProfileEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['display_name', 'avatar_url', 'banner_url', 'location', 'roles', 'genres',
                  'bio', 'skills', 'social_links', 'is_private', 'status']

class ProfileStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['status', 'is_private']


class ChapterSerializer(serializers.ModelSerializer):
    """Serializer for individual book chapters."""
    class Meta:
        model = Chapter
        fields = ['id', 'title', 'content_html', 'order', 'created_at', 'updated_at', 'is_published']
        read_only_fields = ['created_at', 'updated_at', 'is_published', 'order']


class BookProjectSerializer(serializers.ModelSerializer):
    """Serializer for book projects with nested chapters."""
    chapters = ChapterSerializer(many=True, read_only=True)
    chapter_count = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = BookProject
        fields = ['id', 'title', 'description', 'cover_image', 'cover_image_url', 'chapters', 'chapter_count', 'created_at', 'updated_at', 'is_published']
        read_only_fields = ['created_at', 'updated_at', 'is_published', 'chapter_count', 'cover_image_url']
    
    def get_chapter_count(self, obj):
        return obj.chapters.count()
    
    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None


class PurchaseSerializer(serializers.ModelSerializer):
    """Serializer for Purchase records with nested content details."""
    content_title = serializers.CharField(source='content.title', read_only=True)
    content_type = serializers.CharField(source='content.content_type', read_only=True)
    creator_username = serializers.CharField(source='content.creator.username', read_only=True)
    days_since_purchase = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            'id', 'user', 'content', 'content_title', 'content_type', 'creator_username',
            'purchase_price_usd', 'stripe_fee_usd', 'platform_fee_usd', 'creator_earnings_usd',
            'stripe_payment_intent_id', 'stripe_checkout_session_id',
            'transaction_signature', 'nft_minted', 'nft_mint_eligible_at',
            'purchased_at', 'refunded', 'days_since_purchase'
        ]
        read_only_fields = [
            'user', 'content', 'content_title', 'content_type', 'creator_username',
            'purchase_price_usd', 'stripe_fee_usd', 'platform_fee_usd', 'creator_earnings_usd',
            'stripe_payment_intent_id', 'stripe_checkout_session_id',
            'purchased_at', 'refunded', 'days_since_purchase'
        ]

    def get_days_since_purchase(self, obj):
        """Calculate days since purchase."""
        if obj.purchased_at:
            delta = timezone.now() - obj.purchased_at
            return delta.days
        return 0


class ReadingProgressSerializer(serializers.ModelSerializer):
    """Serializer for reading progress tracking."""

    class Meta:
        model = ReadingProgress
        fields = [
            'id', 'user', 'content', 'progress_percentage',
            'last_position', 'last_read_at', 'created_at'
        ]
        read_only_fields = ['user', 'last_read_at', 'created_at']

    def validate_progress_percentage(self, value):
        """Ensure progress is between 0 and 100."""
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress must be between 0 and 100")
        return value


class ContractTaskSerializer(serializers.ModelSerializer):
    """Serializer for contract tasks within collaboration agreements.

    Handles the full task lifecycle: pending → in_progress → complete → signed_off
    """
    collaborator_username = serializers.CharField(source='collaborator_role.user.username', read_only=True)
    marked_complete_by_username = serializers.CharField(
        source='marked_complete_by.username', read_only=True, allow_null=True
    )
    signed_off_by_username = serializers.CharField(
        source='signed_off_by.username', read_only=True, allow_null=True
    )
    days_until_deadline = serializers.SerializerMethodField()
    is_late = serializers.SerializerMethodField()

    class Meta:
        model = ContractTask
        fields = [
            'id', 'title', 'description', 'deadline', 'status', 'order',
            'collaborator_username',
            # Completion tracking
            'marked_complete_at', 'marked_complete_by', 'marked_complete_by_username',
            'completion_notes',
            # Sign-off tracking
            'signed_off_at', 'signed_off_by', 'signed_off_by_username', 'signoff_notes',
            # Rejection tracking
            'rejection_notes', 'rejected_at',
            # Breach status
            'is_overdue', 'overdue_notified_at', 'is_late', 'days_until_deadline',
            # Timestamps
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'collaborator_username', 'marked_complete_at', 'marked_complete_by',
            'marked_complete_by_username', 'signed_off_at', 'signed_off_by',
            'signed_off_by_username', 'is_overdue', 'overdue_notified_at',
            'rejected_at', 'is_late', 'days_until_deadline', 'created_at', 'updated_at',
        ]

    def get_days_until_deadline(self, obj):
        """Calculate days remaining until deadline (negative if past)."""
        if obj.deadline:
            delta = obj.deadline - timezone.now()
            return delta.days
        return None

    def get_is_late(self, obj):
        """Check if task is late (past deadline and not signed off)."""
        if obj.status in ['signed_off', 'cancelled']:
            return False
        if obj.deadline:
            return timezone.now() > obj.deadline
        return False


class ContractTaskCreateSerializer(serializers.Serializer):
    """Serializer for creating tasks during invitation.

    Used when inviting a collaborator with specific contract tasks.
    """
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    deadline = serializers.DateTimeField()

    def validate_deadline(self, value):
        """Ensure deadline is in the future."""
        if value <= timezone.now():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value


class RoleDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for standard role definitions."""

    class Meta:
        model = RoleDefinition
        fields = [
            'id', 'name', 'category', 'description',
            'applicable_to_book', 'applicable_to_art', 'applicable_to_music', 'applicable_to_video',
            'default_permissions', 'ui_components', 'icon', 'color', 'is_active'
        ]
        read_only_fields = ['id', 'created_at']


class CollaboratorRoleSerializer(serializers.ModelSerializer):
    """Serializer for collaborator roles with permissions and revenue splits."""
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    contract_tasks = ContractTaskSerializer(many=True, read_only=True)
    all_tasks_complete = serializers.ReadOnlyField()

    # New role-based permission fields
    role_definition_id = serializers.PrimaryKeyRelatedField(
        source='role_definition',
        queryset=RoleDefinition.objects.filter(is_active=True),
        required=False,
        allow_null=True
    )
    role_definition_details = RoleDefinitionSerializer(source='role_definition', read_only=True)
    effective_role_name = serializers.ReadOnlyField()
    effective_permissions = serializers.ReadOnlyField()
    ui_components = serializers.SerializerMethodField()

    class Meta:
        model = CollaboratorRole
        fields = [
            'id', 'user', 'username', 'display_name', 'avatar_url', 'role', 'revenue_percentage',
            'status', 'invited_at', 'accepted_at', 'can_edit_text', 'can_edit_images',
            'can_edit_audio', 'can_edit_video', 'can_edit', 'approved_current_version',
            'approved_revenue_split',
            # Contract management fields
            'contract_version', 'contract_locked_at', 'has_active_breach',
            'cancellation_eligible', 'tasks_total', 'tasks_signed_off', 'all_tasks_complete',
            # Nested tasks
            'contract_tasks',
            # Counter-proposal fields
            'proposed_percentage', 'counter_message',
            # New role-based permission fields
            'role_definition_id', 'role_definition_details', 'permissions',
            'effective_role_name', 'effective_permissions', 'ui_components',
        ]
        read_only_fields = [
            'id', 'invited_at', 'username', 'display_name', 'avatar_url', 'can_edit',
            'contract_version', 'contract_locked_at', 'has_active_breach',
            'cancellation_eligible', 'tasks_total', 'tasks_signed_off', 'all_tasks_complete',
            'contract_tasks', 'role_definition_details', 'effective_role_name',
            'effective_permissions', 'ui_components',
        ]

    def get_display_name(self, obj):
        """Get user's display name from profile."""
        try:
            return obj.user.profile.display_name or obj.user.username
        except Exception:
            return obj.user.username

    def get_avatar_url(self, obj):
        """Get user's avatar URL."""
        try:
            url = obj.user.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''

    def get_can_edit(self, obj):
        """Return list of section types this collaborator can edit."""
        can_edit = []
        if obj.can_edit_text:
            can_edit.append('text')
        if obj.can_edit_images:
            can_edit.append('image')
        if obj.can_edit_audio:
            can_edit.append('audio')
        if obj.can_edit_video:
            can_edit.append('video')
        return can_edit

    def get_ui_components(self, obj):
        """Return list of UI components this role should see."""
        return obj.get_ui_components()


class ProjectSectionSerializer(serializers.ModelSerializer):
    """Serializer for project sections (content blocks)."""
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = ProjectSection
        fields = [
            'id', 'project', 'section_type', 'title', 'content_html', 'media_file',
            'owner', 'owner_username', 'order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'owner_username', 'owner']


class ProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer for project comments with threading support."""
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = [
            'id', 'project', 'author', 'author_username', 'author_avatar', 'content',
            'parent_comment', 'resolved', 'created_at', 'replies_count'
        ]
        read_only_fields = ['id', 'created_at', 'author_username', 'author_avatar', 'replies_count', 'author']

    def get_author_avatar(self, obj):
        """Get author's avatar URL."""
        try:
            url = obj.author.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''

    def get_replies_count(self, obj):
        """Count direct replies to this comment."""
        return obj.replies.count()


class CollaborativeProjectSerializer(serializers.ModelSerializer):
    """Full serializer for collaborative projects with all nested data."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    collaborators = CollaboratorRoleSerializer(many=True, read_only=True)
    sections = ProjectSectionSerializer(many=True, read_only=True)
    recent_comments = serializers.SerializerMethodField()
    is_fully_approved = serializers.SerializerMethodField()
    total_collaborators = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    estimated_earnings = serializers.SerializerMethodField()

    class Meta:
        model = CollaborativeProject
        fields = [
            'id', 'title', 'content_type', 'description', 'status', 'milestones',
            'price_usd', 'editions', 'teaser_percent', 'watermark_preview',
            'created_by', 'created_by_username', 'created_at', 'updated_at',
            'collaborators', 'sections', 'recent_comments', 'is_fully_approved',
            'total_collaborators', 'progress_percentage', 'estimated_earnings',
            'authors_note'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by_username',
            'is_fully_approved', 'total_collaborators', 'estimated_earnings'
        ]

    def get_recent_comments(self, obj):
        """Get last 5 comments on this project."""
        recent = obj.comments.all()[:5]
        return ProjectCommentSerializer(recent, many=True, context=self.context).data

    def get_is_fully_approved(self, obj):
        """Check if all collaborators have approved."""
        return obj.is_fully_approved()

    def get_total_collaborators(self, obj):
        """Count accepted collaborators."""
        return obj.collaborators.filter(status='accepted').count()

    def get_progress_percentage(self, obj):
        """Calculate project completion percentage based on milestones."""
        milestones = obj.milestones or []
        if not milestones:
            return 0

        try:
            completed = sum(1 for m in milestones if isinstance(m, dict) and m.get('completed'))
            total = len(milestones)
            return round((completed / total) * 100, 2) if total > 0 else 0
        except Exception:
            return 0

    def get_estimated_earnings(self, obj):
        """Calculate estimated earnings per collaborator based on price and splits."""
        if not obj.price_usd:
            return {}

        earnings = {}
        # 90% goes to creators (platform takes 10%)
        creator_pool = float(obj.price_usd) * 0.90
        for collab in obj.collaborators.filter(status='accepted'):
            earnings[collab.user_id] = round(creator_pool * float(collab.revenue_percentage) / 100, 2)
        return earnings


class CollaborativeProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for project list views (performance optimized)."""
    created_by = serializers.IntegerField(source='created_by.id', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    total_collaborators = serializers.SerializerMethodField()

    class Meta:
        model = CollaborativeProject
        fields = [
            'id', 'title', 'content_type', 'status', 'created_by', 'created_by_username',
            'total_collaborators', 'created_at', 'price_usd'
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_username', 'total_collaborators']

    def get_total_collaborators(self, obj):
        """Count accepted collaborators."""
        return obj.collaborators.filter(status='accepted').count()


class NotificationUserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for user info in notifications."""
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']

    def get_avatar(self, obj):
        """Get user avatar URL."""
        try:
            url = obj.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications with nested user data."""
    from_user = NotificationUserSerializer(read_only=True)
    project_id = serializers.IntegerField(source='project.id', read_only=True, allow_null=True)
    type = serializers.CharField(source='notification_type', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'message', 'project_id',
            'from_user', 'action_url', 'read', 'created_at'
        ]
        read_only_fields = [
            'id', 'type', 'title', 'message', 'project_id',
            'from_user', 'action_url', 'created_at'
        ]


class BetaInviteSerializer(serializers.ModelSerializer):
    """Serializer for beta invite management."""
    invited_by_username = serializers.CharField(source='invited_by.username', read_only=True, allow_null=True)

    class Meta:
        model = BetaInvite
        fields = [
            'id', 'email', 'invite_code', 'status', 'message',
            'invited_by_username', 'used_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'invite_code', 'invited_by_username', 'used_at', 'created_at'
        ]


class ExternalPortfolioItemSerializer(serializers.ModelSerializer):
    """Serializer for external portfolio items."""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ExternalPortfolioItem
        fields = [
            'id', 'title', 'description', 'image', 'image_url', 'external_url',
            'project_type', 'role', 'created_date', 'order', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'image_url']

    def get_image_url(self, obj):
        """Get absolute URL for portfolio item image."""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class CollaboratorRatingPublicSerializer(serializers.ModelSerializer):
    """Serializer for public testimonials from collaborator ratings."""
    rater_username = serializers.CharField(source='rater.username', read_only=True)
    rater_avatar = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True)
    average_score = serializers.ReadOnlyField()

    class Meta:
        model = CollaboratorRating
        fields = [
            'id', 'rater_username', 'rater_avatar', 'project_title',
            'quality_score', 'deadline_score', 'communication_score',
            'would_collab_again', 'average_score', 'public_feedback', 'created_at'
        ]

    def get_rater_avatar(self, obj):
        """Get rater's avatar URL."""
        try:
            url = obj.rater.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''


class PlatformWorkSerializer(serializers.ModelSerializer):
    """Serializer for platform works (minted content) on public profile."""
    cover_image = serializers.SerializerMethodField()
    creator_username = serializers.CharField(source='creator.username', read_only=True)

    class Meta:
        model = Content
        fields = [
            'id', 'title', 'content_type', 'genre', 'price_usd',
            'cover_image', 'teaser_link', 'nft_contract', 'creator_username', 'created_at'
        ]

    def get_cover_image(self, obj):
        """Get cover image URL for this content.

        Priority:
        1. teaser_link (for art/music/video or if cover is stored there)
        2. Source collaborative project cover_image
        3. Source book project cover_image
        """
        request = self.context.get('request')

        # For art, music, video - teaser_link contains the cover/thumbnail
        if obj.content_type in ['art', 'music', 'video'] and obj.teaser_link:
            # teaser_link may already be an absolute URL (Cloudinary)
            if obj.teaser_link.startswith('http'):
                return obj.teaser_link
            if request:
                return request.build_absolute_uri(obj.teaser_link)
            return obj.teaser_link

        # Check source_collaborative_project for collaborative content
        try:
            if hasattr(obj, 'source_collaborative_project') and obj.source_collaborative_project:
                collab_project = obj.source_collaborative_project
                if collab_project.cover_image:
                    if request:
                        return request.build_absolute_uri(collab_project.cover_image.url)
                    return collab_project.cover_image.url
        except Exception:
            pass

        # Check source_book_project for regular book content
        try:
            if obj.source_book_project.exists():
                book = obj.source_book_project.first()
                if book and book.cover_image:
                    if request:
                        return request.build_absolute_uri(book.cover_image.url)
                    return book.cover_image.url
        except Exception:
            pass

        # For books without explicit cover, try teaser_link as fallback
        if obj.teaser_link:
            if obj.teaser_link.startswith('http'):
                return obj.teaser_link
            if request:
                return request.build_absolute_uri(obj.teaser_link)
            return obj.teaser_link

        return None


class CollaborationHistorySerializer(serializers.ModelSerializer):
    """Serializer for collaboration history on public profile.

    Shows high-level info about completed collaborations without exposing
    sensitive internal details like revenue percentages or invite messages.
    """
    user_role = serializers.SerializerMethodField()
    collaborator_count = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = CollaborativeProject
        fields = [
            'id', 'title', 'content_type', 'status', 'user_role',
            'collaborator_count', 'cover_image', 'created_at'
        ]

    def get_user_role(self, obj):
        """Get the profile user's role in this project."""
        user = self.context.get('profile_user')
        if user:
            collab = obj.collaborators.filter(user=user).first()
            if collab:
                return collab.role
        return None

    def get_collaborator_count(self, obj):
        """Count accepted collaborators."""
        return obj.collaborators.filter(status='accepted').count()

    def get_cover_image(self, obj):
        """Get cover image URL for the collaboration project."""
        request = self.context.get('request')

        # Check for cover_image on the collaborative project
        try:
            if hasattr(obj, 'cover_image') and obj.cover_image:
                if request:
                    return request.build_absolute_uri(obj.cover_image.url)
                return obj.cover_image.url
        except Exception:
            pass

        # Check published_content teaser_link
        try:
            if obj.published_content and obj.published_content.teaser_link:
                teaser = obj.published_content.teaser_link
                if teaser.startswith('http'):
                    return teaser
                if request:
                    return request.build_absolute_uri(teaser)
                return teaser
        except Exception:
            pass

        return None


class PublicProfileSerializer(serializers.Serializer):
    """Comprehensive serializer for public profile view.

    Combines profile info, works, portfolio, collaborations, and testimonials.
    """
    # Profile info
    profile = serializers.SerializerMethodField()
    # Platform works (minted content) - excludes individual book chapters
    platform_works = serializers.SerializerMethodField()
    # Book projects with grouped chapters
    book_projects = serializers.SerializerMethodField()
    # External portfolio items
    external_portfolio = serializers.SerializerMethodField()
    # Collaboration history
    collaborations = serializers.SerializerMethodField()
    # Testimonials from past collaborators
    testimonials = serializers.SerializerMethodField()
    # Stats summary
    stats = serializers.SerializerMethodField()

    def get_profile(self, obj):
        """Get user profile info."""
        profile = obj.get('profile')
        if not profile:
            return None

        request = self.context.get('request')

        # Build avatar URL
        avatar_url = profile.resolved_avatar_url
        if request and avatar_url and avatar_url.startswith('/'):
            avatar_url = request.build_absolute_uri(avatar_url)

        # Build banner URL
        banner_url = profile.resolved_banner_url
        if request and banner_url and banner_url.startswith('/'):
            banner_url = request.build_absolute_uri(banner_url)

        # Status category for badge color
        status_category = 'green'
        green_statuses = ['Available', 'Open to Offers']
        yellow_statuses = ['Selective', 'Booked']
        red_statuses = ['Unavailable', 'On Hiatus']
        if profile.status in yellow_statuses:
            status_category = 'yellow'
        elif profile.status in red_statuses:
            status_category = 'red'

        return {
            'id': profile.id,
            'username': profile.username,
            'display_name': profile.display_name,
            'bio': profile.bio,
            'avatar': avatar_url,
            'banner': banner_url,
            'location': profile.location,
            'status': profile.status,
            'status_category': status_category,
            'tier': profile.tier,
            'roles': profile.roles or [],
            'genres': profile.genres or [],
            'skills': profile.skills or [],
            'social_links': profile.social_links or {},
        }

    def get_platform_works(self, obj):
        """Get minted content created by this user."""
        works = obj.get('platform_works', [])
        return PlatformWorkSerializer(works, many=True, context=self.context).data

    def get_book_projects(self, obj):
        """Get book projects with grouped chapters for public profile.

        Only returns books with at least one published chapter.
        """
        projects = obj.get('book_projects', [])
        request = self.context.get('request')
        result = []

        for project in projects:
            # Get all chapters with their status
            chapters_data = []
            total_views = 0
            total_price = 0
            published_count = 0

            for chapter in project.chapters.all().order_by('order'):
                content = chapter.published_content if chapter.is_published else None
                # Only include published chapters in public view
                if chapter.is_published and content:
                    chapter_data = {
                        'id': chapter.id,
                        'title': chapter.title,
                        'order': chapter.order,
                        'content_id': content.id,
                        'price_usd': float(content.price_usd) if content.price_usd else 0,
                        'view_count': content.view_count if content else 0,
                    }
                    chapters_data.append(chapter_data)
                    published_count += 1
                    total_views += content.view_count
                    total_price += float(content.price_usd or 0)

            # Only include books with at least one published chapter
            if published_count == 0:
                continue

            # Build cover image URL
            cover_url = None
            if project.cover_image:
                if request:
                    cover_url = request.build_absolute_uri(project.cover_image.url)
                else:
                    cover_url = project.cover_image.url

            result.append({
                'id': project.id,
                'title': project.title,
                'cover_image_url': cover_url,
                'published_chapters': published_count,
                'chapters': chapters_data,
                'total_views': total_views,
                'total_price': round(total_price, 2),
            })

        return result

    def get_external_portfolio(self, obj):
        """Get external portfolio items."""
        items = obj.get('external_portfolio', [])
        return ExternalPortfolioItemSerializer(items, many=True, context=self.context).data

    def get_collaborations(self, obj):
        """Get collaboration history."""
        collabs = obj.get('collaborations', [])
        user = obj.get('user')
        context = {**self.context, 'profile_user': user}
        return CollaborationHistorySerializer(collabs, many=True, context=context).data

    def get_testimonials(self, obj):
        """Get public testimonials from past collaborators."""
        ratings = obj.get('testimonials', [])
        return CollaboratorRatingPublicSerializer(ratings, many=True, context=self.context).data

    def get_stats(self, obj):
        """Get profile stats summary."""
        profile = obj.get('profile')
        ratings = obj.get('testimonials', [])
        platform_works = obj.get('platform_works', [])
        book_projects = obj.get('book_projects', [])

        # Calculate average rating
        avg_rating = None
        if ratings:
            total = sum(r.average_score for r in ratings)
            avg_rating = round(total / len(ratings), 1)

        # Calculate works count and total views dynamically
        works_count = len(platform_works)
        total_views = sum(getattr(w, 'view_count', 0) or 0 for w in platform_works)

        for project in book_projects:
            # Only count books that have at least one published chapter
            published_chapters = [ch for ch in project.chapters.all() if ch.is_published and ch.published_content]
            if published_chapters:
                works_count += 1
                # Sum views from all published chapters
                for ch in published_chapters:
                    total_views += getattr(ch.published_content, 'view_count', 0) or 0

        return {
            'works_count': works_count,
            'total_views': total_views,
            'follower_count': profile.follower_count if profile else 0,
            'successful_collabs': obj.get('successful_collabs_count', 0),
            'average_rating': avg_rating,
        }


# =============================================================================
# Social Engagement Serializers (Likes, Comments, Ratings, Reviews)
# =============================================================================

class ContentLikeSerializer(serializers.ModelSerializer):
    """Serializer for content likes."""
    username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = ContentLike
        fields = ['id', 'user', 'username', 'user_avatar', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'username', 'user_avatar', 'created_at']

    def get_user_avatar(self, obj):
        """Get user's avatar URL."""
        try:
            url = obj.user.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''


class ContentCommentSerializer(serializers.ModelSerializer):
    """Serializer for threaded content comments."""
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    thread_depth = serializers.SerializerMethodField()

    class Meta:
        model = ContentComment
        fields = [
            'id', 'content', 'author', 'author_username', 'author_avatar',
            'text', 'parent_comment', 'edited', 'is_deleted',
            'created_at', 'updated_at', 'replies_count', 'can_delete', 'can_edit',
            'thread_depth'
        ]
        read_only_fields = [
            'id', 'author', 'author_username', 'author_avatar', 'edited',
            'is_deleted', 'created_at', 'updated_at', 'replies_count',
            'can_delete', 'can_edit', 'thread_depth'
        ]

    def get_author_avatar(self, obj):
        """Get author's avatar URL."""
        try:
            url = obj.author.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''

    def get_replies_count(self, obj):
        """Count non-deleted replies."""
        return obj.replies.filter(is_deleted=False).count()

    def get_can_delete(self, obj):
        """Check if requesting user can delete this comment."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Author can delete own, content creator can moderate
        return obj.author == request.user or obj.content.creator == request.user

    def get_can_edit(self, obj):
        """Check if requesting user can edit this comment."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Only author can edit
        return obj.author == request.user

    def get_thread_depth(self, obj):
        """Get nesting depth of this comment."""
        return obj.get_thread_depth()


class ContentRatingSerializer(serializers.ModelSerializer):
    """Serializer for content ratings (star reviews)."""
    username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = ContentRating
        fields = [
            'id', 'user', 'username', 'user_avatar', 'content',
            'rating', 'review_text', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'username', 'user_avatar', 'created_at', 'updated_at']

    def get_user_avatar(self, obj):
        """Get user's avatar URL."""
        try:
            url = obj.user.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value


class CreatorReviewSerializer(serializers.ModelSerializer):
    """Serializer for creator reviews (Yelp-style)."""
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    reviewer_avatar = serializers.SerializerMethodField()
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    verification_display = serializers.CharField(source='get_verification_type_display', read_only=True)

    class Meta:
        model = CreatorReview
        fields = [
            'id', 'reviewer', 'reviewer_username', 'reviewer_avatar',
            'creator', 'creator_username', 'rating', 'review_text',
            'verification_type', 'verification_display',
            'response_text', 'response_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'reviewer', 'reviewer_username', 'reviewer_avatar',
            'creator_username', 'verification_type', 'verification_display',
            'response_text', 'response_at', 'created_at', 'updated_at'
        ]

    def get_reviewer_avatar(self, obj):
        """Get reviewer's avatar URL."""
        try:
            url = obj.reviewer.profile.resolved_avatar_url
            request = self.context.get('request')
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return ''

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value
