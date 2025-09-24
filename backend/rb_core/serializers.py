from rest_framework import serializers
from .models import Content, UserProfile, User
from django.utils.crypto import salted_hmac
import hashlib

class ContentSerializer(serializers.ModelSerializer):
    """Serializer for Content model (FR4/FR5 in REQUIREMENTS.md).
    
    - Exposes metadata only; full content via IPFS (decentralized, no server storage per ARCHITECTURE.md).
    - Validation: Ensure teaser_link is valid URL; add custom validators for moderation (GUIDELINES.md).
    """
    class Meta:
        model = Content
        fields = ['id', 'title', 'teaser_link', 'created_at', 'creator', 'content_type', 'genre']
        read_only_fields = ['creator']
    
    def validate_teaser_link(self, value):
        if not value.startswith('http'):
            raise serializers.ValidationError("Teaser link must be a valid URL.")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'display_name', 'wallet_address', 'avatar_url', 'banner_url', 'location', 'roles', 'genres']
        read_only_fields = ['username']


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
        fields = ['display_name', 'avatar_url', 'banner_url', 'location', 'roles', 'genres']
