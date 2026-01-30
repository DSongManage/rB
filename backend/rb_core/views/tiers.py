"""Views for the creator tier system."""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from .. import tier_service

User = get_user_model()


class MyTierProgressView(APIView):
    """GET /api/tiers/my-progress/ — authenticated user's tier info."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = tier_service.get_tier_progress(request.user)
        return Response(data)


class FoundingStatusView(APIView):
    """GET /api/tiers/founding-status/ — public founding race info."""
    permission_classes = [AllowAny]

    def get(self, request):
        data = tier_service.get_founding_status()
        return Response(data)


class CreatorTierView(APIView):
    """GET /api/tiers/creator/<username>/ — public tier info for a creator."""
    permission_classes = [AllowAny]

    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        data = tier_service.get_tier_progress(user)
        # Only expose public-safe fields
        return Response({
            'username': username,
            'tier': data['tier'],
            'fee_percent': data['fee_percent'],
            'is_founding': data['is_founding'],
        })
