from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import Purchase
from ..serializers import PurchaseSerializer


class UserPurchasesView(APIView):
    """List all purchases for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's purchase history."""
        purchases = Purchase.objects.filter(
            user=request.user,
            refunded=False
        ).select_related('content', 'content__creator').order_by('-purchased_at')

        serializer = PurchaseSerializer(purchases, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
