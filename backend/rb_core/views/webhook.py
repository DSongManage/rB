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

    SECURITY: Uses select_for_update() to prevent race conditions and double-processing.
    """
    import time
    from django.db import DatabaseError

    logger.info(f'Processing payment_intent: {payment_intent["id"]}')

    payment_intent_id = payment_intent['id']

    # Retry logic: payment_intent.succeeded can arrive before checkout.session.completed
    max_retries = 5
    retry_delay = 1  # seconds

    for attempt in range(max_retries):
        try:
            # Use select_for_update to prevent race conditions with concurrent webhooks
            with transaction.atomic():
                try:
                    purchase = Purchase.objects.select_for_update(nowait=True).get(
                        stripe_payment_intent_id=payment_intent_id
                    )
                except DatabaseError as db_err:
                    # Another worker already has the lock - let them handle it
                    if 'could not obtain lock' in str(db_err).lower() or 'lock' in str(db_err).lower():
                        logger.info(f'Purchase {payment_intent_id} locked by another worker, skipping')
                        return
                    raise

                logger.info(f'Found and locked purchase on attempt {attempt + 1}')

                # Check if already processed (idempotency)
                if purchase.status in ['payment_completed', 'completed', 'minting']:
                    logger.info(f'Purchase {purchase.id} already processed (status={purchase.status}), skipping')
                    return

                # Process the payment within the lock
                _process_payment_intent_locked(purchase, payment_intent)
                return

        except Purchase.DoesNotExist:
            if attempt < max_retries - 1:
                logger.info(f'Purchase not found yet (attempt {attempt + 1}/{max_retries}), waiting {retry_delay}s...')
                time.sleep(retry_delay)
            else:
                logger.error(f'Purchase not found after {max_retries} attempts for payment_intent {payment_intent_id}')
                return


def _process_payment_intent_locked(purchase, payment_intent):
    """
    Process payment intent while holding database lock.
    This should only be called from within a transaction with select_for_update().
    """
    payment_intent_id = payment_intent['id']

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

        # Trigger ATOMIC PURCHASE PROCESSING (NFT mint + USDC distribution)
        # This is the CRITICAL piece - platform fronts USDC immediately
        try:
            from ..tasks import process_atomic_purchase
            process_atomic_purchase.delay(purchase.id)
            logger.info(f'[Stripe Webhook] ✅ Queued atomic purchase processing for purchase {purchase.id}')
        except ImportError:
            logger.error('[Stripe Webhook] ⚠️ Celery not available - atomic processing requires Celery')
        except Exception as e:
            logger.error(f'[Stripe Webhook] ❌ Failed to queue atomic processing: {e}')
    except Exception as e:
        logger.error(f'Error processing payment_intent {payment_intent_id}: {e}')
        raise


def handle_checkout_session_completed(session):
    """
    Update purchase record when checkout completes.
    Purchase record was already created in the checkout endpoint.
    This just updates it with the payment_intent_id for later processing.
    """
    logger.info(f'[Webhook] Processing checkout session: {session["id"]}')

    payment_intent_id = session.get('payment_intent')
    session_id = session['id']

    if not payment_intent_id:
        logger.error(f'[Webhook] No payment_intent in session {session_id}')
        return

    try:
        # Find purchase by checkout session ID
        purchase = Purchase.objects.get(stripe_checkout_session_id=session_id)

        # Update with payment intent ID
        purchase.stripe_payment_intent_id = payment_intent_id
        purchase.save(update_fields=['stripe_payment_intent_id'])

        logger.info(
            f'[Webhook] ✅ Updated purchase {purchase.id} with payment_intent {payment_intent_id}. '
            f'Waiting for payment_intent.succeeded for actual fees and atomic processing.'
        )

    except Purchase.DoesNotExist:
        logger.error(f'[Webhook] ❌ Purchase not found for session {session_id}')
    except Exception as e:
        logger.error(f'[Webhook] ❌ Error processing checkout session {session_id}: {e}', exc_info=True)
        raise
