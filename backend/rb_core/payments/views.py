"""
Circle Payment Views for renaissBlock.

Handles Circle checkout and webhook endpoints.
"""

import json
import logging
from decimal import Decimal
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import Content, Purchase, User
from .circle_service import CirclePaymentService, CirclePaymentError

logger = logging.getLogger(__name__)


class CircleCheckoutView(APIView):
    """Create Circle payment intent for content purchase."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Create a Circle payment intent.

        Request body:
            - content_id: ID of content to purchase
            - payment_method: "card" (for Circle credit card processing)

        Returns:
            - payment_id: Circle payment ID
            - checkout_url: URL to redirect user for payment
        """
        content_id = request.data.get('content_id')
        payment_method = request.data.get('payment_method', 'card')

        if not content_id:
            return Response(
                {'error': 'content_id is required', 'code': 'MISSING_CONTENT_ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment_method != 'card':
            return Response(
                {'error': 'Only card payment method supported for Circle', 'code': 'INVALID_PAYMENT_METHOD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Lock content row to prevent race conditions
            with transaction.atomic():
                content = Content.objects.select_for_update().get(id=content_id)

                # Validate purchase eligibility
                if content.inventory_status != 'minted':
                    return Response(
                        {'error': 'Content not available for purchase', 'code': 'NOT_MINTED'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if content.editions <= 0:
                    return Response(
                        {'error': 'Content is sold out', 'code': 'SOLD_OUT'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if content.is_owned_by(request.user):
                    return Response(
                        {'error': 'You already own this content', 'code': 'ALREADY_OWNED'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get user wallet addresses
                buyer_wallet = getattr(request.user, 'wallet_address', None)
                creator_wallet = getattr(content.creator, 'wallet_address', None)

                if not buyer_wallet:
                    return Response(
                        {'error': 'Buyer wallet not configured', 'code': 'NO_BUYER_WALLET'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not creator_wallet:
                    return Response(
                        {'error': 'Creator wallet not configured', 'code': 'NO_CREATOR_WALLET'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Create Purchase record (pending)
                purchase = Purchase.objects.create(
                    user=request.user,
                    content=content,
                    purchase_price_usd=content.price_usd,
                    gross_amount=content.price_usd,
                    status='payment_pending',
                    payment_provider='circle',
                    # Legacy fields
                    stripe_payment_intent_id=f'circle_{content_id}_{request.user.id}_{Purchase.objects.count()}',
                    stripe_fee_usd=Decimal('0'),
                    platform_fee_usd=Decimal('0'),
                    creator_earnings_usd=Decimal('0'),
                )

                # Create Circle payment intent
                try:
                    circle_service = CirclePaymentService()
                    payment_data = circle_service.create_payment_intent(
                        amount_usd=content.price_usd,
                        content_id=content.id,
                        buyer_wallet=buyer_wallet,
                        creator_wallet=creator_wallet,
                        idempotency_key=f'purchase_{purchase.id}',
                    )

                    # Update purchase with Circle payment ID
                    purchase.circle_payment_id = payment_data['payment_id']
                    purchase.circle_tracking_ref = payment_data.get('tracking_ref', '')
                    purchase.save()

                    logger.info(
                        f'[Circle] Created payment intent for purchase {purchase.id}: '
                        f'circle_payment_id={payment_data["payment_id"]}'
                    )

                    return Response({
                        'purchase_id': purchase.id,
                        'payment_id': payment_data['payment_id'],
                        'checkout_url': payment_data['checkout_url'],
                        'status': payment_data['status'],
                    }, status=status.HTTP_200_OK)

                except CirclePaymentError as e:
                    # Clean up the purchase if Circle payment creation fails
                    purchase.status = 'failed'
                    purchase.save()

                    logger.error(f'[Circle] Payment intent creation failed: {e}')
                    return Response(
                        {'error': str(e), 'code': 'CIRCLE_ERROR'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found', 'code': 'CONTENT_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'[Circle] Unexpected error in checkout: {e}', exc_info=True)
            return Response(
                {'error': str(e), 'code': 'INTERNAL_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@csrf_exempt
def circle_webhook(request):
    """
    Handle Circle webhook events.

    Circle sends webhooks for payment status changes:
    - GET/HEAD: Webhook verification (Circle checks endpoint exists)
    - POST: Actual webhook events
      - payment.confirmed: Payment succeeded, USDC received
      - payment.failed: Payment failed
      - payment.canceled: Payment canceled by user
    """
    # Handle GET/HEAD requests for webhook verification
    if request.method in ['GET', 'HEAD']:
        logger.info('[Circle] Webhook verification request received')
        return HttpResponse('Circle webhook endpoint ready', status=200)

    # Only accept POST for actual webhooks
    if request.method != 'POST':
        return HttpResponse('Method not allowed', status=405)

    # Get webhook signature for verification
    signature = request.META.get('HTTP_X_CIRCLE_SIGNATURE', '')

    # Verify webhook signature
    circle_service = CirclePaymentService()
    if not circle_service.verify_webhook_signature(request.body, signature):
        logger.error('[Circle] Webhook signature verification failed')
        return HttpResponse('Invalid signature', status=400)

    try:
        event = json.loads(request.body)
        event_type = event.get('type')
        data = event.get('data', {})

        logger.info(f'[Circle] Received webhook: type={event_type}, payment_id={data.get("id")}')

        # Handle payment.confirmed event
        if event_type == 'payment.confirmed':
            handle_payment_confirmed(data)
        elif event_type == 'payment.failed':
            handle_payment_failed(data)
        elif event_type == 'payment.canceled':
            handle_payment_canceled(data)
        else:
            logger.info(f'[Circle] Unhandled webhook type: {event_type}')

        return HttpResponse(status=200)

    except json.JSONDecodeError:
        logger.error('[Circle] Invalid JSON in webhook payload')
        return HttpResponse('Invalid JSON', status=400)
    except Exception as e:
        logger.error(f'[Circle] Error processing webhook: {e}', exc_info=True)
        return HttpResponse('Internal error', status=500)


def handle_payment_confirmed(payment_data: dict):
    """
    Handle confirmed Circle payment.

    This is called when payment succeeds and USDC is received on Solana.

    Args:
        payment_data: Payment data from Circle webhook
    """
    payment_id = payment_data.get('id')
    metadata = payment_data.get('metadata', {})
    amount = payment_data.get('amount', {})

    logger.info(f'[Circle] Processing payment confirmation: {payment_id}')

    try:
        # Find purchase by Circle payment ID
        purchase = Purchase.objects.select_for_update().get(circle_payment_id=payment_id)

        # Update purchase with payment details
        gross_usd = Decimal(amount.get('amount', '0')) / 100  # Convert cents to dollars
        fees_usd = Decimal(payment_data.get('fees', {}).get('amount', '0')) / 100

        purchase.gross_amount = gross_usd
        purchase.circle_fee = fees_usd
        purchase.net_after_circle = gross_usd - fees_usd
        purchase.status = 'payment_completed'
        purchase.save()

        # Decrement editions
        content = purchase.content
        if content.editions > 0:
            content.editions -= 1
            content.save(update_fields=['editions'])
            logger.info(f'[Circle] Decremented editions for content {content.id}: {content.editions} remaining')

        logger.info(
            f'[Circle] ✅ Payment confirmed for purchase {purchase.id}: '
            f'gross=${gross_usd}, fees=${fees_usd}, net=${purchase.net_after_circle}'
        )

        # Trigger Circle-specific NFT minting and USDC distribution
        try:
            from ..tasks import mint_and_distribute_circle
            mint_and_distribute_circle.delay(purchase.id)
            logger.info(f'[Circle] Queued Circle minting task for purchase {purchase.id}')
        except ImportError:
            # Celery not available, do synchronous
            logger.warning('[Circle] Celery not available, minting synchronously')
            from ..views.payment_utils import mint_and_distribute_circle
            mint_and_distribute_circle(purchase.id)

    except Purchase.DoesNotExist:
        logger.error(f'[Circle] Purchase not found for payment_id {payment_id}')
    except Exception as e:
        logger.error(f'[Circle] Error handling payment confirmation: {e}', exc_info=True)
        raise


def handle_payment_failed(payment_data: dict):
    """Handle failed Circle payment."""
    payment_id = payment_data.get('id')

    logger.info(f'[Circle] Processing payment failure: {payment_id}')

    try:
        purchase = Purchase.objects.get(circle_payment_id=payment_id)
        purchase.status = 'failed'
        purchase.save()

        logger.info(f'[Circle] Payment failed for purchase {purchase.id}')

    except Purchase.DoesNotExist:
        logger.error(f'[Circle] Purchase not found for payment_id {payment_id}')


def handle_payment_canceled(payment_data: dict):
    """Handle canceled Circle payment."""
    payment_id = payment_data.get('id')

    logger.info(f'[Circle] Processing payment cancellation: {payment_id}')

    try:
        purchase = Purchase.objects.get(circle_payment_id=payment_id)
        purchase.status = 'failed'  # Treat cancellation as failure
        purchase.save()

        logger.info(f'[Circle] Payment canceled for purchase {purchase.id}')

    except Purchase.DoesNotExist:
        logger.error(f'[Circle] Purchase not found for payment_id {payment_id}')
