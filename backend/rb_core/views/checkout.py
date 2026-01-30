import logging
from decimal import Decimal
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import Purchase
from ..payment_utils import calculate_payment_breakdown

logger = logging.getLogger(__name__)


class FeeBreakdownView(APIView):
    """
    Calculate and return fee breakdown for a given chapter price.

    Used by frontend to show transparent pricing before purchase.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get fee breakdown for a chapter price."""
        try:
            chapter_price = request.query_params.get('chapter_price')

            if not chapter_price:
                return Response(
                    {'error': 'chapter_price query parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convert to Decimal
            chapter_price = Decimal(str(chapter_price))

            # Calculate breakdown
            breakdown = calculate_payment_breakdown(chapter_price)

            return Response({
                'breakdown_display': breakdown['breakdown_display'],
                'raw_breakdown': {
                    'chapter_price': str(breakdown['chapter_price']),
                    'buyer_total': str(breakdown['buyer_total']),
                    'creator_share': str(breakdown['creator_share']),
                    'platform_share': str(breakdown['platform_share']),
                    'platform_fee_percent': str(breakdown['platform_fee_rate']),
                    'gas_fee': str(breakdown['gas_fee']),
                }
            }, status=status.HTTP_200_OK)

        except (ValueError, TypeError) as e:
            return Response(
                {'error': f'Invalid chapter_price: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'[FeeBreakdown] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DevProcessPurchaseView(APIView):
    """
    DEVELOPMENT ONLY: Process a pending purchase synchronously.

    This bypasses the Stripe webhook + Celery workflow for local testing.
    DO NOT USE IN PRODUCTION.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Process a purchase immediately (dev mode only)."""
        # Only allow in DEBUG mode
        if not settings.DEBUG:
            return Response(
                {'error': 'This endpoint is only available in DEBUG mode'},
                status=status.HTTP_403_FORBIDDEN
            )

        purchase_id = request.data.get('purchase_id')

        if not purchase_id:
            return Response(
                {'error': 'purchase_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            purchase = Purchase.objects.get(id=purchase_id)

            # Verify this is the user's purchase
            if purchase.user != request.user:
                return Response(
                    {'error': 'Not your purchase'},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.info(f'[DEV] Processing purchase {purchase_id} synchronously')

            # Simulate payment: Mark as payment_completed
            purchase.status = 'payment_completed'
            purchase.gross_amount = purchase.purchase_price_usd
            purchase.save()

            logger.info(f'[DEV] Updated purchase {purchase_id} to payment_completed')

            # Run atomic purchase processing synchronously (instead of Celery)
            from ..tasks import process_atomic_purchase

            # Call the task function directly (not .delay())
            try:
                # Import the actual function, not the Celery task
                from ..tasks import process_atomic_purchase as task_func

                # If it's a Celery task, get the underlying function
                if hasattr(task_func, 'run'):
                    result = task_func.run(purchase_id)
                else:
                    # Call directly if not a Celery task
                    result = task_func(purchase_id)

                logger.info(f'[DEV] ✅ Purchase {purchase_id} processed successfully')

                # Refresh purchase to get updated data
                purchase.refresh_from_db()

                return Response({
                    'success': True,
                    'purchase_id': purchase.id,
                    'status': purchase.status,
                    'message': 'Purchase processed successfully (dev mode)'
                }, status=status.HTTP_200_OK)

            except Exception as e:
                logger.error(f'[DEV] ❌ Error processing purchase: {e}', exc_info=True)
                return Response(
                    {'error': f'Processing failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Purchase.DoesNotExist:
            return Response(
                {'error': 'Purchase not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'[DEV] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
