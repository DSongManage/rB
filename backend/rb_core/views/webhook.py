import stripe
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from decimal import Decimal

from ..models import Purchase, Content, User

logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """Handle Stripe webhook events."""

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

    # SECURITY: Always require webhook secret - no bypass allowed
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if not webhook_secret:
        logger.error('STRIPE_WEBHOOK_SECRET not configured - rejecting webhook')
        return HttpResponse('Webhook secret not configured', status=500)

    # Always verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        logger.info(f'Verified webhook: {event["type"]}')
    except ValueError as e:
        logger.error(f'Invalid payload: {e}')
        return HttpResponse('Invalid payload', status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error(f'Invalid signature: {e}')
        return HttpResponse('Invalid signature', status=400)

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_session_completed(session)

    return HttpResponse(status=200)


def handle_checkout_session_completed(session):
    """Process completed checkout session."""

    logger.info(f'Processing checkout session: {session["id"]}')

    # Extract metadata
    content_id = session['metadata'].get('content_id')
    user_id = session['metadata'].get('user_id')
    stripe_fee = Decimal(session['metadata'].get('stripe_fee', '0'))
    platform_fee = Decimal(session['metadata'].get('platform_fee', '0'))
    creator_earnings = Decimal(session['metadata'].get('creator_earnings', '0'))

    payment_intent_id = session.get('payment_intent')
    session_id = session['id']
    amount_total = Decimal(str(session['amount_total'])) / 100  # Convert cents to dollars

    if not content_id or not user_id or not payment_intent_id:
        logger.error(f'Missing required metadata in session {session_id}')
        return

    try:
        with transaction.atomic():
            # Check for duplicate (idempotency)
            if Purchase.objects.filter(stripe_payment_intent_id=payment_intent_id).exists():
                logger.info(f'Purchase already exists for payment_intent {payment_intent_id}')
                return

            # Get content and user
            content = Content.objects.select_for_update().get(id=content_id)
            user = User.objects.get(id=user_id)

            # Verify editions available (shouldn't happen, but extra safety)
            if content.editions <= 0:
                logger.error(f'Content {content_id} sold out during checkout')
                # TODO: Handle refund here
                return

            # Create Purchase record
            purchase = Purchase.objects.create(
                user=user,
                content=content,
                purchase_price_usd=amount_total,
                stripe_fee_usd=stripe_fee,
                platform_fee_usd=platform_fee,
                creator_earnings_usd=creator_earnings,
                stripe_payment_intent_id=payment_intent_id,
                stripe_checkout_session_id=session_id,
            )

            # Decrement editions
            content.editions -= 1
            content.save()

            logger.info(f'Purchase {purchase.id} created successfully. Content {content_id} now has {content.editions} editions left.')

            # TODO: Send confirmation email (Phase 4)
            # TODO: Trigger NFT minting job if eligible (Phase 3)

    except Content.DoesNotExist:
        logger.error(f'Content {content_id} not found')
    except User.DoesNotExist:
        logger.error(f'User {user_id} not found')
    except Exception as e:
        logger.error(f'Error processing checkout session {session_id}: {e}')
        raise
