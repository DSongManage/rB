from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import Purchase, BatchPurchase
from ..serializers import PurchaseSerializer


# Status display labels for user-facing messages
STATUS_DISPLAY = {
    'payment_pending': 'Processing Payment',
    'payment_completed': 'Payment Received',
    'bridge_pending': 'Preparing Conversion',
    'bridge_converting': 'Converting to USDC',
    'usdc_received': 'USDC Received',
    'minting': 'Minting NFT',
    'processing': 'Processing Mints',
    'completed': 'Complete',
    'partial': 'Partially Complete',
    'failed': 'Failed',
    'refunded': 'Refunded',
}


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


class PurchaseStatusView(APIView):
    """Get status of a specific purchase (for status polling)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, purchase_id):
        """Get current status of a purchase."""
        try:
            purchase = Purchase.objects.select_related('content').get(
                id=purchase_id,
                user=request.user
            )
        except Purchase.DoesNotExist:
            return Response(
                {'error': 'Purchase not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get Bridge on-ramp info if available
        bridge_transfer_id = None
        try:
            if hasattr(purchase, 'bridge_onramp') and purchase.bridge_onramp:
                bridge_transfer_id = purchase.bridge_onramp.bridge_transfer_id
        except Exception:
            pass

        return Response({
            'id': purchase.id,
            'status': purchase.status,
            'status_display': STATUS_DISPLAY.get(purchase.status, purchase.status),
            'content_title': purchase.content.title if purchase.content else None,
            'nft_mint_address': purchase.nft_mint_address,
            'transaction_signature': purchase.transaction_signature,
            'bridge_transfer_id': bridge_transfer_id,
            'created_at': purchase.purchased_at.isoformat() if purchase.purchased_at else None,
        })


class BatchPurchaseStatusView(APIView):
    """Get status of a batch/cart purchase (for status polling)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        """Get current status of a batch purchase."""
        try:
            batch = BatchPurchase.objects.prefetch_related('items').get(
                id=batch_id,
                user=request.user
            )
        except BatchPurchase.DoesNotExist:
            return Response(
                {'error': 'Batch purchase not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get Bridge on-ramp info if available
        bridge_transfer_id = None
        try:
            if hasattr(batch, 'bridge_onramp') and batch.bridge_onramp:
                bridge_transfer_id = batch.bridge_onramp.bridge_transfer_id
        except Exception:
            pass

        # Get item statuses
        items = []
        for item in batch.items.all():
            items.append({
                'id': item.id,
                'chapter_id': item.chapter_id,
                'status': item.status,
                'status_display': STATUS_DISPLAY.get(item.status, item.status),
                'nft_mint_address': item.nft_mint_address,
                'transaction_signature': item.transaction_signature,
            })

        return Response({
            'id': batch.id,
            'status': batch.status,
            'status_display': STATUS_DISPLAY.get(batch.status, batch.status),
            'total_items': batch.total_items,
            'completed_items': batch.completed_items,
            'failed_items': batch.failed_items,
            'bridge_transfer_id': bridge_transfer_id,
            'created_at': batch.created_at.isoformat() if batch.created_at else None,
            'items': items,
        })
