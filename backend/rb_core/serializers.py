from rest_framework import serializers
from .models import (
    Content, UserProfile, User, BookProject, Chapter, Purchase, ReadingProgress,
    CollaborativeProject, CollaboratorRole, ProjectSection, ProjectComment, Notification,
    BetaInvite
)
from django.utils.crypto import salted_hmac
from django.utils import timezone
import hashlib

class ContentSerializer(serializers.ModelSerializer):
    """Serializer for Content model (FR4/FR5 in REQUIREMENTS.md).

    - Exposes metadata only; full content via IPFS (decentralized, no server storage per ARCHITECTURE.md).
    - Validation: Ensure teaser_link is valid URL; add custom validators for moderation (GUIDELINES.md).
    """
    creator_username = serializers.SerializerMethodField()
    owned = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'title', 'teaser_link', 'teaser_html', 'created_at', 'creator', 'creator_username', 'content_type', 'genre',
            'price_usd', 'editions', 'teaser_percent', 'watermark_preview', 'inventory_status', 'nft_contract', 'owned'
        ]
        read_only_fields = ['creator', 'creator_username', 'teaser_link', 'teaser_html', 'created_at', 'owned']

    def get_creator_username(self, obj):
        return obj.creator.username if obj.creator else 'Unknown'

    def get_owned(self, obj):
        """Check if the requesting user owns this content."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.is_owned_by(request.user)
        return False
    
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
            'location', 'roles', 'genres', 'is_private', 'status',
            'content_count', 'total_sales_usd', 'tier', 'fee_bps'
        ]
        read_only_fields = ['username', 'avatar', 'banner', 'content_count', 'total_sales_usd', 'tier', 'fee_bps']

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

        # Mark beta invite as used
        if beta_invite:
            beta_invite.status = 'used'
            beta_invite.used_at = timezone.now()
            beta_invite.save()

        return profile


class ProfileEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['display_name', 'avatar_url', 'banner_url', 'location', 'roles', 'genres', 'is_private', 'status']

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


class CollaboratorRoleSerializer(serializers.ModelSerializer):
    """Serializer for collaborator roles with permissions and revenue splits."""
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = CollaboratorRole
        fields = [
            'id', 'user', 'username', 'display_name', 'role', 'revenue_percentage',
            'status', 'invited_at', 'accepted_at', 'can_edit_text', 'can_edit_images',
            'can_edit_audio', 'can_edit_video', 'can_edit', 'approved_current_version',
            'approved_revenue_split'
        ]
        read_only_fields = ['id', 'invited_at', 'username', 'display_name', 'can_edit']

    def get_display_name(self, obj):
        """Get user's display name from profile."""
        try:
            return obj.user.profile.display_name or obj.user.username
        except Exception:
            return obj.user.username

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


class ProjectSectionSerializer(serializers.ModelSerializer):
    """Serializer for project sections (content blocks)."""
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = ProjectSection
        fields = [
            'id', 'section_type', 'title', 'content_html', 'media_file',
            'owner', 'owner_username', 'order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'owner_username']


class ProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer for project comments with threading support."""
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = [
            'id', 'author', 'author_username', 'author_avatar', 'content',
            'parent_comment', 'resolved', 'created_at', 'replies_count'
        ]
        read_only_fields = ['id', 'created_at', 'author_username', 'author_avatar', 'replies_count']

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

    class Meta:
        model = CollaborativeProject
        fields = [
            'id', 'title', 'content_type', 'description', 'status', 'milestones',
            'created_by', 'created_by_username', 'created_at', 'updated_at',
            'collaborators', 'sections', 'recent_comments', 'is_fully_approved',
            'total_collaborators', 'progress_percentage'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by_username',
            'is_fully_approved', 'total_collaborators'
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


class CollaborativeProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for project list views (performance optimized)."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    total_collaborators = serializers.SerializerMethodField()

    class Meta:
        model = CollaborativeProject
        fields = [
            'id', 'title', 'content_type', 'status', 'created_by_username',
            'total_collaborators', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'created_by_username', 'total_collaborators']

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
