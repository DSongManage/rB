"""
Coinbase Onramp API views for the dual payment system.

Provides endpoints for:
- Initiating Coinbase Onramp sessions
- Checking transaction status
- Handling Coinbase webhooks
"""

import json
import logging
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rb_core.models import CoinbaseTransaction, PurchaseIntent
from rb_core.services.coinbase_onramp_service import get_coinbase_service

logger = logging.getLogger(__name__)


class InitiateCoinbaseOnrampView(APIView):
    """
    Initialize Coinbase Onramp session for a purchase intent.

    POST /api/coinbase/onramp/<intent_id>/

    Response:
    {
        "widget_config": {
            "appId": "...",
            "destinationWallets": [...],
            "presetCryptoAmount": 5.00,
            ...
        },
        "transaction_id": "cb_xxx",
        "minimum_amount": "5.00"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, intent_id):
        user = request.user

        # Get purchase intent
        try:
            intent = PurchaseIntent.objects.get(id=intent_id, user=user)
        except PurchaseIntent.DoesNotExist:
            return Response({
                'error': 'Purchase intent not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Validate intent state
        if intent.is_expired:
            return Response({
                'error': 'Purchase intent has expired'
            }, status=status.HTTP_400_BAD_REQUEST)

        if intent.status in ['completed', 'processing']:
            return Response({
                'error': 'Purchase is already being processed'
            }, status=status.HTTP_400_BAD_REQUEST)

        if intent.payment_method != 'coinbase':
            return Response({
                'error': 'Payment method not set to coinbase'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get user's wallet address
        wallet_address = user.wallet_address
        if not wallet_address:
            return Response({
                'error': 'No wallet connected'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate amount to add (respects $5 minimum)
        amount_to_add = intent.coinbase_minimum_add or Decimal('5.00')

        # Get Coinbase widget configuration
        coinbase_service = get_coinbase_service()
        try:
            config = coinbase_service.get_widget_config(
                user=user,
                amount_usd=amount_to_add,
                destination_wallet=wallet_address,
                purchase_intent_id=intent.id,
            )
        except Exception as e:
            logger.error(f"Failed to get Coinbase widget config: {e}")
            return Response({
                'error': 'Failed to initialize Coinbase session'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Create transaction record
        charge_id = f"cb_{config['session_id']}"
        with transaction.atomic():
            cb_transaction = CoinbaseTransaction.objects.create(
                user=user,
                coinbase_charge_id=charge_id,
                fiat_amount=amount_to_add,
                destination_wallet=wallet_address,
                purchase_intent=intent,
                status='pending',
            )

            # Update intent status
            intent.status = 'awaiting_payment'
            intent.save()

        return Response({
            'widget_config': config['widget_config'],
            'transaction_id': cb_transaction.id,
            'charge_id': charge_id,
            'minimum_amount': config['minimum_amount'],
            'amount_to_add': str(amount_to_add),
            'explanation': (
                f"Add ${amount_to_add:.2f} to your renaissBlock Balance. "
                f"This will be used for your ${intent.total_amount:.2f} purchase."
            ),
        })


class CoinbaseTransactionStatusView(APIView):
    """
    Check status of Coinbase transaction.

    GET /api/coinbase/status/<transaction_id>/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, transaction_id):
        user = request.user

        try:
            cb_transaction = CoinbaseTransaction.objects.get(
                id=transaction_id,
                user=user
            )
        except CoinbaseTransaction.DoesNotExist:
            return Response({
                'error': 'Transaction not found'
            }, status=status.HTTP_404_NOT_FOUND)

        response_data = {
            'transaction_id': cb_transaction.id,
            'charge_id': cb_transaction.coinbase_charge_id,
            'status': cb_transaction.status,
            'fiat_amount': str(cb_transaction.fiat_amount),
            'usdc_amount': str(cb_transaction.usdc_amount) if cb_transaction.usdc_amount else None,
            'created_at': cb_transaction.created_at.isoformat(),
        }

        if cb_transaction.status == 'completed':
            response_data['completed_at'] = cb_transaction.completed_at.isoformat()
            response_data['solana_tx_signature'] = cb_transaction.solana_tx_signature

        if cb_transaction.status == 'failed':
            response_data['failure_reason'] = cb_transaction.failure_reason

        # Include linked intent status
        if cb_transaction.purchase_intent:
            response_data['intent_id'] = cb_transaction.purchase_intent.id
            response_data['intent_status'] = cb_transaction.purchase_intent.status

        return Response(response_data)


class CoinbaseWebhookView(APIView):
    """
    Handle Coinbase webhooks.

    POST /api/webhooks/coinbase/

    Handles:
    - charge:confirmed - USDC delivered
    - charge:failed - Payment failed
    - charge:expired - Session expired
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # No auth for webhooks

    def post(self, request):
        # Get signature header
        signature = request.headers.get('X-CC-Webhook-Signature', '')

        # Verify signature
        coinbase_service = get_coinbase_service()
        if not coinbase_service.verify_webhook_signature(request.body, signature):
            logger.warning("Invalid Coinbase webhook signature")
            return HttpResponse(status=401)

        # Parse event
        try:
            event = json.loads(request.body)
        except json.JSONDecodeError:
            logger.error("Invalid JSON in Coinbase webhook")
            return HttpResponse(status=400)

        event_type = event.get('type')
        event_data = event.get('data', {})

        logger.info(f"Received Coinbase webhook: {event_type}")

        # Handle event
        try:
            result = coinbase_service.handle_webhook_event(event_type, event_data)
            logger.info(f"Coinbase webhook result: {result}")
            return HttpResponse(status=200)
        except Exception as e:
            logger.error(f"Error handling Coinbase webhook: {e}")
            return HttpResponse(status=500)


class CoinbaseOnrampCompleteView(APIView):
    """
    Frontend callback when Coinbase Onramp completes.

    POST /api/coinbase/complete/<transaction_id>/

    Called by frontend after Coinbase widget closes successfully.
    Triggers balance sync and purchase processing if applicable.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, transaction_id):
        user = request.user

        try:
            cb_transaction = CoinbaseTransaction.objects.get(
                id=transaction_id,
                user=user
            )
        except CoinbaseTransaction.DoesNotExist:
            return Response({
                'error': 'Transaction not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Trigger balance sync to detect new funds
        from rb_core.tasks import sync_user_balance_task, check_coinbase_and_complete_purchase_task

        try:
            # Queue balance sync
            sync_user_balance_task.delay(user.id)

            # Queue check for completion and purchase processing
            check_coinbase_and_complete_purchase_task.delay(cb_transaction.id)
        except Exception as e:
            logger.error(f"Failed to queue Coinbase completion tasks: {e}")

        return Response({
            'transaction_id': cb_transaction.id,
            'status': 'processing',
            'message': 'Checking for funds arrival. Your purchase will be processed automatically.',
        })
