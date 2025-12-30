import stripe
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from decimal import Decimal

from ..models import Purchase, Content, User, BatchPurchase, BridgeCustomer, BridgeDrain, BridgeOnRampTransfer

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

    DEPRECATED: Use _trigger_bridge_onramp instead for new Bridge flow.
    Kept for backwards compatibility with any direct calls.
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


def _trigger_bridge_onramp(purchase_id):
    """
    Trigger Bridge on-ramp to convert USD → USDC.

    This replaces the old treasury fronting approach. After Stripe payment succeeds:
    1. Call Bridge API to create USD → USDC transfer
    2. Bridge sends USDC to platform wallet
    3. Bridge webhook triggers NFT minting when USDC arrives

    Args:
        purchase_id: Purchase ID to process
    """
    try:
        from ..tasks import initiate_bridge_onramp
        # Try async first (preferred - doesn't block webhook response)
        result = initiate_bridge_onramp.delay(purchase_id=purchase_id)
        logger.info(f'[Stripe Webhook] ✅ Queued Bridge on-ramp for purchase {purchase_id} (task_id={result.id})')
    except Exception as celery_error:
        # Celery/Redis not available - fall back to synchronous processing
        logger.warning(f'[Stripe Webhook] ⚠️ Celery unavailable ({celery_error}), processing Bridge on-ramp synchronously')
        try:
            from ..tasks import initiate_bridge_onramp
            # Call the task function directly (synchronous)
            result = initiate_bridge_onramp(purchase_id=purchase_id)
            logger.info(f'[Stripe Webhook] ✅ Completed synchronous Bridge on-ramp for {purchase_id}: {result}')
        except Exception as sync_error:
            logger.error(f'[Stripe Webhook] ❌ Synchronous Bridge on-ramp failed for {purchase_id}: {sync_error}')
            raise


def _trigger_batch_bridge_onramp(batch_purchase_id):
    """
    Trigger Bridge on-ramp for batch/cart purchases.

    Args:
        batch_purchase_id: BatchPurchase ID to process
    """
    try:
        from ..tasks import initiate_bridge_onramp
        # Try async first
        result = initiate_bridge_onramp.delay(batch_purchase_id=batch_purchase_id)
        logger.info(f'[Stripe Webhook] ✅ Queued Bridge on-ramp for batch {batch_purchase_id} (task_id={result.id})')
    except Exception as celery_error:
        # Fallback to synchronous
        logger.warning(f'[Stripe Webhook] ⚠️ Celery unavailable ({celery_error}), processing batch Bridge on-ramp synchronously')
        try:
            from ..tasks import initiate_bridge_onramp
            result = initiate_bridge_onramp(batch_purchase_id=batch_purchase_id)
            logger.info(f'[Stripe Webhook] ✅ Completed synchronous batch Bridge on-ramp for {batch_purchase_id}: {result}')
        except Exception as sync_error:
            logger.error(f'[Stripe Webhook] ❌ Synchronous batch Bridge on-ramp failed for {batch_purchase_id}: {sync_error}')
            raise


def _process_payment_intent_locked(purchase, payment_intent):
    """
    Process payment intent while holding database lock.
    This should only be called from within a transaction with select_for_update().

    NEW FLOW (Bridge On-Ramp):
    1. Update purchase with Stripe fee data
    2. Trigger Bridge on-ramp (USD → USDC conversion)
    3. Bridge webhook will trigger NFT minting when USDC arrives
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

        # NEW: Trigger Bridge on-ramp (USD → USDC conversion)
        # Bridge webhook will trigger NFT minting when USDC arrives
        _trigger_bridge_onramp(purchase.id)
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

    # Trigger Bridge on-ramp - USDC arrives later, then NFT minting happens
    _trigger_bridge_onramp(purchase.id)


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

    NEW FLOW (Bridge On-Ramp):
    1. Update batch with payment intent ID
    2. Trigger Bridge on-ramp (USD → USDC conversion)
    3. Bridge webhook will trigger batch processing when USDC arrives
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
            f'Payment intent: {payment_intent_id}. Triggering Bridge on-ramp.'
        )

        # NEW: Trigger Bridge on-ramp (USD → USDC conversion)
        # Bridge webhook will trigger batch processing when USDC arrives
        _trigger_batch_bridge_onramp(batch_purchase_id)

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


# =============================================================================
# Bridge.xyz Webhook Handler
# =============================================================================

@csrf_exempt
@require_POST
def bridge_webhook(request):
    """Handle Bridge.xyz webhook events.

    Bridge sends webhooks for:
    - customer.kyc_status_changed: KYC status updates
    - liquidation_address.drain.completed: Off-ramp transaction completed
    - liquidation_address.drain.failed: Off-ramp transaction failed
    - external_account.verification_status_changed: Bank account verification
    """
    from django.utils import timezone
    from ..services import BridgeService

    payload = request.body
    sig_header = request.META.get('HTTP_X_BRIDGE_SIGNATURE', '')

    # Verify webhook signature
    bridge_service = BridgeService()
    if not bridge_service.verify_webhook_signature(payload, sig_header):
        logger.error('[Bridge Webhook] Invalid signature')
        return HttpResponse('Invalid signature', status=401)

    try:
        event = json.loads(payload)
        event_type = event.get('type', '')
        data = event.get('data', {})

        logger.info(f'[Bridge Webhook] Received event: {event_type}')

        # On-Ramp Transfer Events (USD → USDC for purchases)
        if event_type == 'transfer.awaiting_funds':
            _handle_bridge_transfer_awaiting_funds(data)
        elif event_type == 'transfer.funds_received':
            _handle_bridge_transfer_funds_received(data)
        elif event_type == 'transfer.in_review':
            _handle_bridge_transfer_in_review(data)
        elif event_type == 'transfer.completed':
            _handle_bridge_transfer_completed(data)
        elif event_type == 'transfer.failed':
            _handle_bridge_transfer_failed(data)
        elif event_type == 'transfer.returned':
            _handle_bridge_transfer_returned(data)
        # Off-Ramp / Customer Events
        elif event_type == 'customer.kyc_status_changed':
            _handle_bridge_kyc_status_changed(data)
        elif event_type == 'liquidation_address.drain.completed':
            _handle_bridge_drain_completed(data)
        elif event_type == 'liquidation_address.drain.failed':
            _handle_bridge_drain_failed(data)
        elif event_type == 'external_account.verification_status_changed':
            _handle_bridge_account_verification_changed(data)
        else:
            logger.info(f'[Bridge Webhook] Unhandled event type: {event_type}')

        return HttpResponse(status=200)

    except json.JSONDecodeError as e:
        logger.error(f'[Bridge Webhook] Invalid JSON: {e}')
        return HttpResponse('Invalid JSON', status=400)
    except Exception as e:
        logger.error(f'[Bridge Webhook] Error processing webhook: {e}', exc_info=True)
        return HttpResponse('Internal error', status=500)


def _handle_bridge_kyc_status_changed(data):
    """Handle KYC status change webhook."""
    from django.utils import timezone

    customer_id = data.get('customer_id')
    new_status = data.get('kyc_status')

    if not customer_id or not new_status:
        logger.warning('[Bridge Webhook] Missing customer_id or kyc_status in KYC event')
        return

    try:
        bridge_customer = BridgeCustomer.objects.get(bridge_customer_id=customer_id)
        old_status = bridge_customer.kyc_status
        bridge_customer.kyc_status = new_status

        if new_status == 'approved' and old_status != 'approved':
            bridge_customer.kyc_completed_at = timezone.now()

        bridge_customer.save()
        logger.info(f'[Bridge Webhook] Updated KYC status for customer {customer_id}: {old_status} -> {new_status}')

    except BridgeCustomer.DoesNotExist:
        logger.warning(f'[Bridge Webhook] BridgeCustomer not found for customer_id: {customer_id}')


def _handle_bridge_drain_completed(data):
    """Handle drain (off-ramp) completion webhook."""
    from django.utils import timezone
    from ..models import BridgeLiquidationAddress

    drain_id = data.get('drain_id')
    address_id = data.get('liquidation_address_id')
    usdc_amount = data.get('usdc_amount')
    usd_amount = data.get('usd_amount')
    fee_amount = data.get('fee_amount', 0)
    source_tx = data.get('source_transaction_signature', '')

    if not drain_id or not address_id:
        logger.warning('[Bridge Webhook] Missing drain_id or address_id in drain event')
        return

    try:
        liquidation_address = BridgeLiquidationAddress.objects.get(
            bridge_liquidation_address_id=address_id
        )

        # Create or update drain record
        drain, created = BridgeDrain.objects.update_or_create(
            bridge_drain_id=drain_id,
            defaults={
                'liquidation_address': liquidation_address,
                'usdc_amount': Decimal(str(usdc_amount)) if usdc_amount else Decimal('0'),
                'usd_amount': Decimal(str(usd_amount)) if usd_amount else Decimal('0'),
                'fee_amount': Decimal(str(fee_amount)) if fee_amount else Decimal('0'),
                'source_tx_signature': source_tx,
                'status': 'completed',
                'completed_at': timezone.now(),
                'initiated_at': data.get('initiated_at', timezone.now()),
            }
        )

        action = 'Created' if created else 'Updated'
        logger.info(
            f'[Bridge Webhook] {action} drain {drain_id}: '
            f'{usdc_amount} USDC -> ${usd_amount} USD (fee: ${fee_amount})'
        )

    except BridgeLiquidationAddress.DoesNotExist:
        logger.warning(f'[Bridge Webhook] Liquidation address not found: {address_id}')


def _handle_bridge_drain_failed(data):
    """Handle drain (off-ramp) failure webhook."""
    from django.utils import timezone
    from ..models import BridgeLiquidationAddress

    drain_id = data.get('drain_id')
    address_id = data.get('liquidation_address_id')
    error_message = data.get('error_message', 'Unknown error')

    if not drain_id or not address_id:
        logger.warning('[Bridge Webhook] Missing drain_id or address_id in drain failed event')
        return

    try:
        liquidation_address = BridgeLiquidationAddress.objects.get(
            bridge_liquidation_address_id=address_id
        )

        # Create or update drain record
        drain, created = BridgeDrain.objects.update_or_create(
            bridge_drain_id=drain_id,
            defaults={
                'liquidation_address': liquidation_address,
                'status': 'failed',
                'initiated_at': data.get('initiated_at', timezone.now()),
            }
        )

        logger.error(f'[Bridge Webhook] Drain {drain_id} FAILED: {error_message}')

    except BridgeLiquidationAddress.DoesNotExist:
        logger.warning(f'[Bridge Webhook] Liquidation address not found: {address_id}')


def _handle_bridge_account_verification_changed(data):
    """Handle bank account verification status change."""
    from ..models import BridgeExternalAccount

    account_id = data.get('external_account_id')
    new_status = data.get('verification_status')

    if not account_id:
        logger.warning('[Bridge Webhook] Missing external_account_id in verification event')
        return

    try:
        external_account = BridgeExternalAccount.objects.get(
            bridge_external_account_id=account_id
        )

        # Handle verification status (e.g., micro-deposit verification)
        if new_status == 'verified':
            external_account.is_active = True
        elif new_status == 'failed':
            external_account.is_active = False

        external_account.save()
        logger.info(f'[Bridge Webhook] Updated account {account_id} verification: {new_status}')

    except BridgeExternalAccount.DoesNotExist:
        logger.warning(f'[Bridge Webhook] External account not found: {account_id}')


# =============================================================================
# Bridge On-Ramp Transfer Handlers (USD → USDC for purchases)
# =============================================================================

def _handle_bridge_transfer_awaiting_funds(data):
    """Handle transfer.awaiting_funds webhook - Bridge is waiting for USD."""
    transfer_id = data.get('id') or data.get('transfer_id')

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in awaiting_funds event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.get(bridge_transfer_id=transfer_id)
        onramp.status = 'awaiting_funds'
        onramp.save(update_fields=['status'])
        logger.info(f'[Bridge Webhook] Transfer {transfer_id} awaiting funds')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.warning(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_funds_received(data):
    """Handle transfer.funds_received webhook - Bridge received USD."""
    from django.utils import timezone

    transfer_id = data.get('id') or data.get('transfer_id')

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in funds_received event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.get(bridge_transfer_id=transfer_id)
        onramp.status = 'funds_received'
        onramp.funds_received_at = timezone.now()
        onramp.save(update_fields=['status', 'funds_received_at'])

        logger.info(f'[Bridge Webhook] Transfer {transfer_id} funds received, converting USD → USDC')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.warning(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_in_review(data):
    """Handle transfer.in_review webhook - Transfer is being reviewed."""
    transfer_id = data.get('id') or data.get('transfer_id')

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in in_review event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.get(bridge_transfer_id=transfer_id)
        onramp.status = 'converting'
        onramp.save(update_fields=['status'])

        logger.info(f'[Bridge Webhook] Transfer {transfer_id} in review/converting')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.warning(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_completed(data):
    """
    CRITICAL: Handle transfer.completed webhook - USDC has arrived!

    This is the key trigger that starts NFT minting. When Bridge completes
    the USD → USDC conversion:
    1. Update BridgeOnRampTransfer record
    2. Update Purchase/BatchPurchase status to 'usdc_received'
    3. Trigger process_atomic_purchase or process_batch_purchase task

    Args:
        data: Webhook event data containing transfer details
    """
    from django.utils import timezone
    from ..tasks import process_atomic_purchase, process_batch_purchase

    transfer_id = data.get('id') or data.get('transfer_id')

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in completed event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.select_related(
            'purchase', 'batch_purchase'
        ).get(bridge_transfer_id=transfer_id)

        # Check if already processed (idempotency)
        if onramp.status == 'completed':
            logger.info(f'[Bridge Webhook] Transfer {transfer_id} already processed, skipping')
            return

        # Update onramp record
        onramp.status = 'completed'
        onramp.conversion_completed_at = timezone.now()

        # Extract amounts from data
        if data.get('destination_amount'):
            onramp.usdc_amount = Decimal(str(data['destination_amount']))
        if data.get('fee'):
            onramp.bridge_fee = Decimal(str(data['fee']))

        # Get Solana transaction signature if available
        receipt = data.get('receipt', {})
        if receipt.get('destination_tx_hash'):
            onramp.solana_tx_signature = receipt['destination_tx_hash']
        elif receipt.get('tx_hash'):
            onramp.solana_tx_signature = receipt['tx_hash']

        onramp.save()

        logger.info(
            f'[Bridge Webhook] ✅ Transfer {transfer_id} COMPLETED: '
            f'${onramp.usd_amount} USD → {onramp.usdc_amount} USDC '
            f'(fee: ${onramp.bridge_fee})'
        )

        # Update purchase status and trigger minting
        if onramp.purchase:
            purchase = onramp.purchase
            purchase.status = 'usdc_received'
            purchase.save(update_fields=['status'])

            logger.info(f'[Bridge Webhook] Triggering NFT mint for purchase {purchase.id}')

            # Trigger atomic purchase processing
            try:
                result = process_atomic_purchase.delay(purchase.id)
                logger.info(f'[Bridge Webhook] ✅ Queued atomic purchase {purchase.id} (task_id={result.id})')
            except Exception as celery_error:
                # Fallback to synchronous if Celery unavailable
                logger.warning(f'[Bridge Webhook] Celery unavailable, processing synchronously: {celery_error}')
                process_atomic_purchase(purchase.id)

        elif onramp.batch_purchase:
            batch = onramp.batch_purchase
            batch.status = 'usdc_received'
            batch.save(update_fields=['status'])

            logger.info(f'[Bridge Webhook] Triggering NFT mints for batch {batch.id}')

            # Trigger batch purchase processing
            try:
                result = process_batch_purchase.delay(batch.id)
                logger.info(f'[Bridge Webhook] ✅ Queued batch purchase {batch.id} (task_id={result.id})')
            except Exception as celery_error:
                # Fallback to synchronous if Celery unavailable
                logger.warning(f'[Bridge Webhook] Celery unavailable, processing synchronously: {celery_error}')
                process_batch_purchase(batch.id)

    except BridgeOnRampTransfer.DoesNotExist:
        logger.error(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_failed(data):
    """
    Handle transfer.failed webhook - Conversion failed, issue refund.

    Args:
        data: Webhook event data
    """
    from ..tasks import _initiate_stripe_refund

    transfer_id = data.get('id') or data.get('transfer_id')
    failure_reason = data.get('failure_reason') or data.get('error_message') or 'Bridge transfer failed'

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in failed event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.select_related(
            'purchase', 'batch_purchase'
        ).get(bridge_transfer_id=transfer_id)

        # Check if already processed
        if onramp.status in ['failed', 'refunded']:
            logger.info(f'[Bridge Webhook] Transfer {transfer_id} already marked as {onramp.status}, skipping')
            return

        # Update onramp record
        onramp.status = 'failed'
        onramp.failure_reason = failure_reason
        onramp.save(update_fields=['status', 'failure_reason'])

        logger.error(f'[Bridge Webhook] ❌ Transfer {transfer_id} FAILED: {failure_reason}')

        # Update purchase/batch status
        purchase_id = None
        batch_purchase_id = None

        if onramp.purchase:
            onramp.purchase.status = 'failed'
            onramp.purchase.save(update_fields=['status'])
            purchase_id = onramp.purchase.id

        if onramp.batch_purchase:
            onramp.batch_purchase.status = 'failed'
            onramp.batch_purchase.save(update_fields=['status'])
            batch_purchase_id = onramp.batch_purchase.id

        # Initiate Stripe refund
        logger.info(f'[Bridge Webhook] Initiating Stripe refund for failed transfer {transfer_id}')
        _initiate_stripe_refund(purchase_id, batch_purchase_id, f'Bridge conversion failed: {failure_reason}')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.error(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_returned(data):
    """
    Handle transfer.returned webhook - Funds returned to sender.

    This happens when the transfer couldn't be completed and funds were
    returned to the original source. Issue a refund.

    Args:
        data: Webhook event data
    """
    from ..tasks import _initiate_stripe_refund

    transfer_id = data.get('id') or data.get('transfer_id')
    return_reason = data.get('return_reason') or 'Funds returned'

    if not transfer_id:
        logger.warning('[Bridge Webhook] Missing transfer_id in returned event')
        return

    try:
        onramp = BridgeOnRampTransfer.objects.select_related(
            'purchase', 'batch_purchase'
        ).get(bridge_transfer_id=transfer_id)

        # Check if already processed
        if onramp.status in ['failed', 'refunded']:
            logger.info(f'[Bridge Webhook] Transfer {transfer_id} already marked as {onramp.status}, skipping')
            return

        # Update onramp record
        onramp.status = 'refunded'
        onramp.failure_reason = return_reason
        onramp.save(update_fields=['status', 'failure_reason'])

        logger.warning(f'[Bridge Webhook] ⚠️ Transfer {transfer_id} RETURNED: {return_reason}')

        # Update purchase/batch status
        purchase_id = None
        batch_purchase_id = None

        if onramp.purchase:
            onramp.purchase.status = 'refunded'
            onramp.purchase.save(update_fields=['status'])
            purchase_id = onramp.purchase.id

        if onramp.batch_purchase:
            onramp.batch_purchase.status = 'refunded'
            onramp.batch_purchase.save(update_fields=['status'])
            batch_purchase_id = onramp.batch_purchase.id

        # Initiate Stripe refund
        logger.info(f'[Bridge Webhook] Initiating Stripe refund for returned transfer {transfer_id}')
        _initiate_stripe_refund(purchase_id, batch_purchase_id, f'Bridge transfer returned: {return_reason}')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.error(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')
