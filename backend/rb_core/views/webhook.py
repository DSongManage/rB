import stripe
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from decimal import Decimal

from ..models import Purchase, Content, User, BatchPurchase

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


def _trigger_purchase_processing(purchase_id):
    """
    Trigger purchase processing - tries Celery first, falls back to synchronous.
    This ensures purchases always complete even if Celery/Redis isn't available.
    """
    try:
        from ..tasks import process_atomic_purchase
        # Try async first (preferred - doesn't block webhook response)
        result = process_atomic_purchase.delay(purchase_id)
        logger.info(f'[Stripe Webhook] ✅ Queued atomic purchase processing for purchase {purchase_id} (task_id={result.id})')
    except Exception as celery_error:
        # Celery/Redis not available - fall back to synchronous processing
        logger.warning(f'[Stripe Webhook] ⚠️ Celery unavailable ({celery_error}), processing synchronously')
        try:
            from ..tasks import process_atomic_purchase
            # Call the task function directly (synchronous)
            result = process_atomic_purchase(purchase_id)
            logger.info(f'[Stripe Webhook] ✅ Completed synchronous purchase processing for {purchase_id}: {result}')
        except Exception as sync_error:
            logger.error(f'[Stripe Webhook] ❌ Synchronous processing failed for {purchase_id}: {sync_error}')
            raise


def _process_payment_intent_locked(purchase, payment_intent):
    """
    Process payment intent while holding database lock.
    This should only be called from within a transaction with select_for_update().
    """
    import time

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

        # Retry logic for balance_transaction - it may not be immediately available
        if not balance_txn_id and charge_id:
            logger.info(f'balance_transaction not in webhook payload, retrying charge retrieval...')
            max_balance_retries = 5
            for attempt in range(max_balance_retries):
                time.sleep(1)  # Wait 1 second between retries
                charge = stripe.Charge.retrieve(charge_id)
                balance_txn_id = charge.get('balance_transaction')
                if balance_txn_id:
                    logger.info(f'Got balance_transaction on retry attempt {attempt + 1}')
                    break
                logger.info(f'balance_transaction still not available (attempt {attempt + 1}/{max_balance_retries})')

        if not balance_txn_id:
            # Fall back to using estimated fees and proceed anyway
            logger.warning(f'No balance_transaction for charge {charge_id} after retries - using estimated fees')
            _process_with_estimated_fees(purchase, charge_id)
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
        _trigger_purchase_processing(purchase.id)
    except Exception as e:
        logger.error(f'Error processing payment_intent {payment_intent_id}: {e}')
        raise


def _process_with_estimated_fees(purchase, charge_id):
    """
    Fallback: Process purchase using estimated fees when balance_transaction is unavailable.
    This ensures the purchase is still fulfilled even if Stripe hasn't settled the transaction yet.
    The fees are calculated from the purchase's chapter_price using the same formula as checkout.
    """
    from .payment_utils import calculate_payment_breakdown

    logger.warning(f'[Webhook] Processing purchase {purchase.id} with ESTIMATED fees (balance_txn unavailable)')

    # Use the item price stored in the purchase to calculate estimated fees
    if purchase.chapter_price is not None:
        breakdown = calculate_payment_breakdown(purchase.chapter_price)
        purchase.stripe_charge_id = charge_id
        purchase.gross_amount = breakdown['buyer_total']
        purchase.stripe_fee = breakdown['stripe_fee']  # Estimated
        purchase.net_after_stripe = breakdown['platform_receives']
        purchase.status = 'payment_completed'
        purchase.save()

        logger.info(
            f'Updated purchase {purchase.id} with ESTIMATED fees: '
            f'gross=${purchase.gross_amount}, '
            f'stripe_fee=${purchase.stripe_fee} (estimated), '
            f'net=${purchase.net_after_stripe}'
        )
    else:
        # Legacy purchases without chapter_price - use standard estimation
        gross = purchase.purchase_price_usd
        estimated_fee = (Decimal('0.029') * gross + Decimal('0.30'))
        purchase.stripe_charge_id = charge_id
        purchase.gross_amount = gross
        purchase.stripe_fee = estimated_fee
        purchase.net_after_stripe = gross - estimated_fee
        purchase.status = 'payment_completed'
        purchase.save()

        logger.info(
            f'Updated purchase {purchase.id} with LEGACY estimated fees: '
            f'gross=${purchase.gross_amount}, stripe_fee=${purchase.stripe_fee}'
        )

    # Still trigger atomic purchase processing - this is critical!
    _trigger_purchase_processing(purchase.id)


def handle_checkout_session_completed(session):
    """
    Update purchase record when checkout completes.
    Handles both single-item and batch (cart) purchases.
    """
    logger.info(f'[Webhook] Processing checkout session: {session["id"]}')

    payment_intent_id = session.get('payment_intent')
    session_id = session['id']
    metadata = session.get('metadata', {})

    if not payment_intent_id:
        logger.error(f'[Webhook] No payment_intent in session {session_id}')
        return

    # Check if this is a batch purchase (cart checkout)
    batch_purchase_id = metadata.get('batch_purchase_id')

    if batch_purchase_id:
        # Batch purchase flow
        _handle_batch_checkout_completed(session, batch_purchase_id, payment_intent_id)
    else:
        # Single-item purchase flow
        _handle_single_checkout_completed(session_id, payment_intent_id)


def _handle_single_checkout_completed(session_id, payment_intent_id):
    """Handle single-item checkout completion (original flow)."""
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


def _handle_batch_checkout_completed(session, batch_purchase_id, payment_intent_id):
    """
    Handle batch/cart checkout completion.
    Triggers process_batch_purchase task to mint all items.
    """
    session_id = session['id']

    try:
        batch = BatchPurchase.objects.get(id=batch_purchase_id)

        # Update with payment intent ID
        batch.stripe_payment_intent_id = payment_intent_id
        batch.status = 'payment_completed'
        batch.save(update_fields=['stripe_payment_intent_id', 'status'])

        logger.info(
            f'[Webhook] ✅ Batch purchase {batch_purchase_id} payment completed. '
            f'Payment intent: {payment_intent_id}. Triggering batch processing.'
        )

        # Trigger batch processing
        _trigger_batch_purchase_processing(batch_purchase_id)

    except BatchPurchase.DoesNotExist:
        logger.error(f'[Webhook] ❌ BatchPurchase {batch_purchase_id} not found for session {session_id}')
    except Exception as e:
        logger.error(f'[Webhook] ❌ Error processing batch checkout {session_id}: {e}', exc_info=True)
        raise


def _trigger_batch_purchase_processing(batch_purchase_id):
    """
    Trigger batch purchase processing - tries Celery first, falls back to synchronous.
    """
    try:
        from ..tasks import process_batch_purchase
        # Try async first (preferred - doesn't block webhook response)
        result = process_batch_purchase.delay(batch_purchase_id)
        logger.info(f'[Webhook] ✅ Queued batch purchase processing for {batch_purchase_id} (task_id={result.id})')
    except Exception as celery_error:
        # Celery/Redis not available - fall back to synchronous processing
        logger.warning(f'[Webhook] ⚠️ Celery unavailable ({celery_error}), processing batch synchronously')
        try:
            from ..tasks import process_batch_purchase
            # Call the task function directly (synchronous)
            result = process_batch_purchase(batch_purchase_id)
            logger.info(f'[Webhook] ✅ Completed synchronous batch processing for {batch_purchase_id}: {result}')
        except Exception as sync_error:
            logger.error(f'[Webhook] ❌ Synchronous batch processing failed for {batch_purchase_id}: {sync_error}')
            raise
