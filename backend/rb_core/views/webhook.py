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
    elif event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        handle_payment_intent_succeeded(payment_intent)

    return HttpResponse(status=200)


def handle_payment_intent_succeeded(payment_intent):
    """
    Handle successful payment - get ACTUAL fees from Stripe.
    This is called AFTER payment succeeds and we have real fee data.

    NOTE: payment_intent.succeeded can arrive BEFORE checkout.session.completed
    due to Stripe's async webhook delivery. We retry to handle this race condition.
    """
    import time

    logger.info(f'Processing payment_intent: {payment_intent["id"]}')

    payment_intent_id = payment_intent['id']

    # Retry logic: payment_intent.succeeded can arrive before checkout.session.completed
    purchase = None
    max_retries = 5
    retry_delay = 1  # seconds

    for attempt in range(max_retries):
        try:
            purchase = Purchase.objects.get(stripe_payment_intent_id=payment_intent_id)
            logger.info(f'Found purchase on attempt {attempt + 1}')
            break
        except Purchase.DoesNotExist:
            if attempt < max_retries - 1:
                logger.info(f'Purchase not found yet (attempt {attempt + 1}/{max_retries}), waiting {retry_delay}s...')
                time.sleep(retry_delay)
            else:
                logger.error(f'Purchase not found after {max_retries} attempts for payment_intent {payment_intent_id}')
                return

    if not purchase:
        return

    try:

        # Get the charge - use latest_charge if charges not expanded
        charge_id = None
        balance_txn_id = None

        # Try to get from expanded charges first
        charges = payment_intent.get('charges', {}).get('data', [])
        if charges:
            charge = charges[0]
            charge_id = charge['id']
            balance_txn_id = charge.get('balance_transaction')
        else:
            # Charges not expanded - retrieve using latest_charge
            latest_charge_id = payment_intent.get('latest_charge')
            if latest_charge_id:
                logger.info(f'Retrieving charge {latest_charge_id} from Stripe API')
                charge = stripe.Charge.retrieve(latest_charge_id)
                charge_id = charge['id']
                balance_txn_id = charge.get('balance_transaction')
            else:
                logger.error(f'No charge information for payment_intent {payment_intent_id}')
                return

        if not balance_txn_id:
            logger.error(f'No balance_transaction for charge {charge_id}')
            return

        # Retrieve balance transaction - contains ACTUAL fees
        balance_txn = stripe.BalanceTransaction.retrieve(balance_txn_id)

        # Update purchase with ACTUAL Stripe data
        purchase.stripe_charge_id = charge_id
        purchase.stripe_balance_txn_id = balance_txn_id
        purchase.gross_amount = Decimal(str(balance_txn.amount)) / 100
        purchase.stripe_fee = Decimal(str(balance_txn.fee)) / 100  # ACTUAL fee
        purchase.net_after_stripe = Decimal(str(balance_txn.net)) / 100
        purchase.status = 'payment_completed'
        purchase.save()

        logger.info(
            f'Updated purchase {purchase.id} with ACTUAL fees: '
            f'gross=${purchase.gross_amount}, '
            f'stripe_fee=${purchase.stripe_fee}, '
            f'net=${purchase.net_after_stripe}'
        )

        # Trigger NFT minting + distribution (async if Celery available)
        try:
            from ..tasks import mint_and_distribute
            mint_and_distribute.delay(purchase.id)
            logger.info(f'Queued minting task for purchase {purchase.id}')
        except ImportError:
            # Celery not available, do synchronous
            logger.warning('Celery not available, minting synchronously')
            from .payment_utils import mint_and_distribute_sync
            mint_and_distribute_sync(purchase.id)
    except Exception as e:
        logger.error(f'Error processing payment_intent {payment_intent_id}: {e}')
        raise


def handle_checkout_session_completed(session):
    """
    Create initial purchase record when checkout completes.
    Actual fees will be populated later by payment_intent.succeeded.
    """
    logger.info(f'[Webhook] Processing checkout session: {session["id"]}')

    # Extract metadata - Stripe returns all metadata as strings
    content_id_str = session['metadata'].get('content_id')
    user_id_str = session['metadata'].get('user_id')

    payment_intent_id = session.get('payment_intent')
    session_id = session['id']
    amount_total = Decimal(str(session['amount_total'])) / 100  # Convert cents to dollars

    logger.info(
        f'[Webhook] Session data: content_id={content_id_str}, user_id={user_id_str}, '
        f'payment_intent={payment_intent_id}, amount=${amount_total}'
    )

    if not content_id_str or not user_id_str or not payment_intent_id:
        logger.error(f'[Webhook] Missing required metadata in session {session_id}')
        return

    # Convert string IDs to integers
    try:
        content_id = int(content_id_str)
        user_id = int(user_id_str)
    except (ValueError, TypeError) as e:
        logger.error(f'[Webhook] Invalid ID format in metadata: {e}')
        return

    try:
        with transaction.atomic():
            # Check for duplicate (idempotency)
            if Purchase.objects.filter(stripe_payment_intent_id=payment_intent_id).exists():
                logger.info(f'[Webhook] Purchase already exists for payment_intent {payment_intent_id}')
                return

            # Get content and user
            content = Content.objects.select_for_update().get(id=content_id)
            user = User.objects.get(id=user_id)

            logger.info(
                f'[Webhook] Content: {content.title}, editions before: {content.editions}, '
                f'user: {user.username}'
            )

            # Verify editions available
            if content.editions <= 0:
                logger.error(f'[Webhook] Content {content_id} sold out during checkout')
                # TODO: Handle refund here
                return

            # Create Purchase record (actual fees will be filled by payment_intent.succeeded)
            purchase = Purchase.objects.create(
                user=user,
                content=content,
                purchase_price_usd=amount_total,
                gross_amount=amount_total,  # Initial value, will be updated with actual
                stripe_payment_intent_id=payment_intent_id,
                stripe_checkout_session_id=session_id,
                status='payment_pending',
                # Legacy fields for backward compatibility
                stripe_fee_usd=Decimal('0'),
                platform_fee_usd=Decimal('0'),
                creator_earnings_usd=Decimal('0'),
            )

            # Decrement editions
            content.editions -= 1
            content.save()

            logger.info(
                f'[Webhook] ✅ Purchase {purchase.id} created successfully! '
                f'Content {content_id} now has {content.editions} editions left. '
                f'Waiting for payment_intent.succeeded for actual fees.'
            )

    except Content.DoesNotExist:
        logger.error(f'[Webhook] ❌ Content {content_id} not found')
    except User.DoesNotExist:
        logger.error(f'[Webhook] ❌ User {user_id} not found')
    except Exception as e:
        logger.error(f'[Webhook] ❌ Error processing checkout session {session_id}: {e}', exc_info=True)
        raise
