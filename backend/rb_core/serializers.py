from rest_framework import serializers
from .models import Content

class ContentSerializer(serializers.ModelSerializer):
    """Serializer for Content model (FR4/FR5 in REQUIREMENTS.md).
    
    - Exposes metadata only; full content via IPFS (decentralized, no server storage per ARCHITECTURE.md).
    - Validation: Ensure teaser_link is valid URL; add custom validators for moderation (GUIDELINES.md).
    """
    class Meta:
        model = Content
        fields = ['id', 'title', 'teaser_link', 'created_at', 'creator']  # Minimal fields; expand for collaboration (FR8)
        
    def validate_teaser_link(self, value):
        # Basic validation example (expand for injection prevention per GUIDELINES.md)
        if not value.startswith('http'):
            raise serializers.ValidationError("Teaser link must be a valid URL.")
        return value
