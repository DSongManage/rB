from rest_framework import serializers
from .models import Content, UserProfile, User, BookProject, Chapter
from django.utils.crypto import salted_hmac
import hashlib

class ContentSerializer(serializers.ModelSerializer):
    """Serializer for Content model (FR4/FR5 in REQUIREMENTS.md).
    
    - Exposes metadata only; full content via IPFS (decentralized, no server storage per ARCHITECTURE.md).
    - Validation: Ensure teaser_link is valid URL; add custom validators for moderation (GUIDELINES.md).
    """
    creator_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Content
        fields = [
            'id', 'title', 'teaser_link', 'teaser_html', 'created_at', 'creator', 'creator_username', 'content_type', 'genre',
            'price_usd', 'editions', 'teaser_percent', 'watermark_preview', 'inventory_status', 'nft_contract'
        ]
        read_only_fields = ['creator', 'creator_username', 'teaser_link', 'teaser_html', 'created_at']
    
    def get_creator_username(self, obj):
        return obj.creator.username if obj.creator else 'Unknown'
    
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
        url = obj.resolved_avatar_url
        try:
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request and url and url.startswith('/'):
                return request.build_absolute_uri(url)
        except Exception:
            pass
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

    def validate_username(self, value: str) -> str:
        value = value.strip()
        if value == '':
            return value
        UserProfile.HANDLE_VALIDATOR(value)
        if User.objects.filter(username=value).exists() or UserProfile.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken')
        return value

    def create(self, validated_data):
        desired = validated_data.get('username', '').strip()
        display_name = validated_data.get('display_name', '').strip()
        wallet_address = validated_data.get('wallet_address', '').strip() or None
        # Web3Auth: if token provided, verify and derive wallet (MVP stub)
        token = validated_data.get('web3auth_token', '').strip()
        if token and not wallet_address:
            # MVP: treat token as proof and skip verification; do not store token
            # Future: verify JWT with Web3Auth JWKs and extract wallet
            wallet_address = None
        # Auto-generate if missing
        if not desired:
            import random
            base = 'renaiss'
            while True:
                candidate = f"{base}{random.randint(1000, 999999)}"
                if not User.objects.filter(username=candidate).exists():
                    desired = candidate
                    break
        user = User.objects.create_user(username=desired, password=None)
        # Email hash skipped (no email in MVP); keep field empty
        profile = UserProfile.objects.create(user=user, username=desired, display_name=display_name, wallet_address=wallet_address)
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
