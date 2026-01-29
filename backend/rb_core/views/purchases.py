from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import Purchase, BatchPurchase, ComicIssue, Content
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


class OwnedIssuesView(APIView):
    """Return IDs of comic issues owned by the authenticated user for a given content."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        content_id = request.query_params.get('content_id')
        if not content_id:
            return Response({'owned_issue_ids': []})

        # Find all comic issues linked to this content's project
        try:
            content = Content.objects.get(id=content_id)
        except Content.DoesNotExist:
            return Response({'owned_issue_ids': []})

        # Get issues from the source project
        project = content.source_collaborative_project.first()
        if not project:
            return Response({'owned_issue_ids': []})

        issue_ids = list(
            ComicIssue.objects.filter(project=project).values_list('id', flat=True)
        )

        owned_ids = list(
            Purchase.objects.filter(
                user=request.user,
                comic_issue_id__in=issue_ids,
                status__in=['completed', 'payment_completed', 'minting']
            ).values_list('comic_issue_id', flat=True)
        )

        return Response({'owned_issue_ids': owned_ids})
