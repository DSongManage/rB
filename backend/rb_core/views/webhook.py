import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from decimal import Decimal

from ..models import Purchase, Content, User, BatchPurchase, BridgeCustomer, BridgeDrain, BridgeOnRampTransfer

logger = logging.getLogger(__name__)


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
    sig_header = request.META.get('HTTP_X_WEBHOOK_SIGNATURE', '')

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
    from .bridge import _map_bridge_status

    customer_id = data.get('customer_id')
    # Bridge may send 'kyc_status' or 'status' in webhook events
    raw_status = data.get('kyc_status') or data.get('status')

    if not customer_id or not raw_status:
        logger.warning(f'[Bridge Webhook] Missing customer_id or status in KYC event. Data keys: {list(data.keys())}')
        return

    new_status = _map_bridge_status(raw_status)

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
    Handle transfer.failed webhook - Off-ramp conversion failed.

    Args:
        data: Webhook event data
    """
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
        if onramp.purchase:
            onramp.purchase.status = 'failed'
            onramp.purchase.save(update_fields=['status'])

        if onramp.batch_purchase:
            onramp.batch_purchase.status = 'failed'
            onramp.batch_purchase.save(update_fields=['status'])

        # TODO: Implement refund flow for Coinbase/direct-USDC purchases
        logger.warning(f'[Bridge Webhook] Manual refund needed for failed transfer {transfer_id}')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.error(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')


def _handle_bridge_transfer_returned(data):
    """
    Handle transfer.returned webhook - Funds returned to sender.

    Args:
        data: Webhook event data
    """
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
        if onramp.purchase:
            onramp.purchase.status = 'refunded'
            onramp.purchase.save(update_fields=['status'])

        if onramp.batch_purchase:
            onramp.batch_purchase.status = 'refunded'
            onramp.batch_purchase.save(update_fields=['status'])

        # TODO: Implement refund flow for Coinbase/direct-USDC purchases
        logger.warning(f'[Bridge Webhook] Manual refund needed for returned transfer {transfer_id}')

    except BridgeOnRampTransfer.DoesNotExist:
        logger.error(f'[Bridge Webhook] BridgeOnRampTransfer not found for transfer_id: {transfer_id}')
