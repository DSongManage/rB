"""
Direct Crypto Payment API views for the dual payment system.

Provides endpoints for:
- Initiating direct crypto payments with memo
- Checking payment status
"""

import logging
import secrets
import string
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rb_core.models import DirectCryptoTransaction, PurchaseIntent

logger = logging.getLogger(__name__)

# Constants
PAYMENT_EXPIRY_MINUTES = 30


def generate_payment_memo() -> str:
    """Generate a unique payment memo like RB-ABC123."""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(6))
    return f"RB-{random_part}"


class InitiateDirectCryptoPaymentView(APIView):
    """
    Create direct crypto payment request with QR code data.

    POST /api/direct-crypto/initiate/<intent_id>/

    Response:
    {
        "payment_id": "dc_xxx",
        "payment_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "expected_amount": "2.99",
        "payment_memo": "RB-ABC123",
        "qr_code_data": "solana:7xKXtg...?amount=2.99&spl-token=EPjFWdd5...&memo=RB-ABC123",
        "expires_at": "2024-01-15T11:00:00Z",
        "instructions": "Send exactly 2.99 USDC to the address above within 30 minutes"
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

        if intent.payment_method != 'direct_crypto':
            return Response({
                'error': 'Payment method not set to direct_crypto'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if there's already an active direct crypto transaction
        existing = DirectCryptoTransaction.objects.filter(
            purchase_intent=intent,
            status='awaiting_payment'
        ).first()

        if existing and not existing.is_expired:
            # Return existing transaction details
            return Response(self._build_response(existing, intent))

        # Get platform payment address
        platform_address = getattr(settings, 'PLATFORM_USDC_ADDRESS', None)
        if not platform_address:
            logger.error("PLATFORM_USDC_ADDRESS not configured")
            return Response({
                'error': 'Platform configuration error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Generate unique memo
        memo = generate_payment_memo()
        # Ensure uniqueness
        while DirectCryptoTransaction.objects.filter(payment_memo=memo).exists():
            memo = generate_payment_memo()

        # Create transaction record
        expires_at = timezone.now() + timedelta(minutes=PAYMENT_EXPIRY_MINUTES)

        with transaction.atomic():
            dc_transaction = DirectCryptoTransaction.objects.create(
                user=user,
                expected_amount=intent.total_amount,
                payment_memo=memo,
                to_wallet=platform_address,
                purchase_intent=intent,
                expires_at=expires_at,
                status='awaiting_payment',
            )

            # Update intent status
            intent.status = 'awaiting_payment'
            intent.save()

        return Response(self._build_response(dc_transaction, intent), status=status.HTTP_201_CREATED)

    def _build_response(self, dc_transaction, intent):
        """Build response with payment details."""
        # Build Solana Pay QR code data
        # Format: solana:<address>?amount=<amount>&spl-token=<mint>&memo=<memo>
        network = getattr(settings, 'SOLANA_NETWORK', 'devnet')
        usdc_mint = (
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
            if network == 'mainnet-beta'
            else '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
        )

        qr_data = (
            f"solana:{dc_transaction.to_wallet}"
            f"?amount={dc_transaction.expected_amount}"
            f"&spl-token={usdc_mint}"
            f"&memo={dc_transaction.payment_memo}"
        )

        return {
            'payment_id': dc_transaction.id,
            'payment_address': dc_transaction.to_wallet,
            'expected_amount': str(dc_transaction.expected_amount),
            'display_amount': f"${dc_transaction.expected_amount:.2f}",
            'payment_memo': dc_transaction.payment_memo,
            'qr_code_data': qr_data,
            'expires_at': dc_transaction.expires_at.isoformat(),
            'expires_in_seconds': int((dc_transaction.expires_at - timezone.now()).total_seconds()),
            'instructions': (
                f"Send exactly ${dc_transaction.expected_amount:.2f} USDC "
                f"to the address below.\n\n"
                f"IMPORTANT: Include the memo '{dc_transaction.payment_memo}' "
                f"in your transaction to identify your payment.\n\n"
                f"Payment must be received within {PAYMENT_EXPIRY_MINUTES} minutes."
            ),
            'intent_id': intent.id,
            'item': intent.get_item_display(),
        }


class DirectCryptoPaymentStatusView(APIView):
    """
    Check status of direct crypto payment.

    GET /api/direct-crypto/status/<payment_id>/

    Frontend polls this until payment is detected/confirmed.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        user = request.user

        try:
            dc_transaction = DirectCryptoTransaction.objects.get(
                id=payment_id,
                user=user
            )
        except DirectCryptoTransaction.DoesNotExist:
            return Response({
                'error': 'Payment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        response_data = {
            'payment_id': dc_transaction.id,
            'status': dc_transaction.status,
            'expected_amount': str(dc_transaction.expected_amount),
            'payment_memo': dc_transaction.payment_memo,
            'payment_address': dc_transaction.to_wallet,
            'created_at': dc_transaction.created_at.isoformat(),
            'expires_at': dc_transaction.expires_at.isoformat(),
            'is_expired': dc_transaction.is_expired,
        }

        # Add timing info
        if dc_transaction.status == 'awaiting_payment':
            remaining = (dc_transaction.expires_at - timezone.now()).total_seconds()
            response_data['expires_in_seconds'] = max(0, int(remaining))

        # Add detection info
        if dc_transaction.detected_at:
            response_data['detected_at'] = dc_transaction.detected_at.isoformat()
            response_data['from_wallet'] = dc_transaction.from_wallet

        # Add confirmation info
        if dc_transaction.confirmed_at:
            response_data['confirmed_at'] = dc_transaction.confirmed_at.isoformat()
            response_data['received_amount'] = str(dc_transaction.received_amount)
            response_data['solana_tx_signature'] = dc_transaction.solana_tx_signature

        # Add failure info
        if dc_transaction.status == 'failed':
            response_data['failure_reason'] = dc_transaction.failure_reason

        # Include linked intent status
        intent = dc_transaction.purchase_intent
        response_data['intent_id'] = intent.id
        response_data['intent_status'] = intent.status

        # Include purchase info if completed
        if intent.status == 'completed' and intent.purchase:
            response_data['purchase_id'] = intent.purchase.id

        return Response(response_data)


class CancelDirectCryptoPaymentView(APIView):
    """
    Cancel a pending direct crypto payment.

    POST /api/direct-crypto/cancel/<payment_id>/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        user = request.user

        try:
            dc_transaction = DirectCryptoTransaction.objects.get(
                id=payment_id,
                user=user
            )
        except DirectCryptoTransaction.DoesNotExist:
            return Response({
                'error': 'Payment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Only allow canceling if awaiting payment
        if dc_transaction.status != 'awaiting_payment':
            return Response({
                'error': 'Cannot cancel payment in current status',
                'status': dc_transaction.status
            }, status=status.HTTP_400_BAD_REQUEST)

        # Mark as expired/canceled
        dc_transaction.status = 'expired'
        dc_transaction.save()

        # Update intent
        intent = dc_transaction.purchase_intent
        intent.status = 'canceled'
        intent.save()

        return Response({
            'payment_id': dc_transaction.id,
            'status': 'canceled',
            'message': 'Payment canceled successfully'
        })
