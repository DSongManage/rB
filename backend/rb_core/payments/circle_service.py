"""
Circle Payment Service for renaissBlock.

Handles credit card payments that settle in USDC on Solana blockchain.
"""

import logging
import hmac
import hashlib
import requests
from decimal import Decimal
from typing import Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class CirclePaymentError(Exception):
    """Raised when Circle API returns an error."""
    pass


class CirclePaymentService:
    """
    Service for processing payments via Circle API.

    Circle converts credit card payments to USDC and settles on Solana.
    This eliminates the need for users to have crypto or manage gas fees.
    """

    # BASE_URL = "https://api.circle.com"  # Production
    BASE_URL = "https://api-sandbox.circle.com"  # Sandbox/Testing

    def __init__(self):
        self.api_key = settings.CIRCLE_API_KEY
        self.webhook_secret = settings.CIRCLE_WEBHOOK_SECRET
        self.platform_wallet = settings.PLATFORM_USDC_WALLET_ADDRESS

        # Debug logging for API key
        if self.api_key:
            logger.info(f'[Circle] API key present: {self.api_key[:20]}... (length: {len(self.api_key)})')
        else:
            logger.error('[Circle] CIRCLE_API_KEY not configured!')

        if not self.api_key:
            raise CirclePaymentError("CIRCLE_API_KEY not configured")
        if not self.platform_wallet:
            raise CirclePaymentError("PLATFORM_USDC_WALLET_ADDRESS not configured")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Circle API requests."""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

    def create_payment_intent(
        self,
        amount_usd: Decimal,
        content_id: int,
        buyer_wallet: str,
        creator_wallet: str,
        idempotency_key: str,
    ) -> Dict:
        """
        Create a Circle payment intent for content purchase.

        Args:
            amount_usd: Purchase amount in USD
            content_id: ID of content being purchased
            buyer_wallet: Buyer's Solana wallet address (from Web3Auth)
            creator_wallet: Creator's Solana wallet address
            idempotency_key: Unique key for idempotent requests (e.g., purchase_id)

        Returns:
            Dict containing:
                - payment_id: Circle payment ID
                - status: Payment status
                - checkout_url: URL for buyer to complete payment

        Raises:
            CirclePaymentError: If API call fails
        """
        url = f"{self.BASE_URL}/v1/payments"

        # Convert USD to cents for Circle API
        amount_cents = int(amount_usd * 100)

        payload = {
            "idempotencyKey": idempotency_key,
            "amount": {
                "amount": str(amount_cents),
                "currency": "USD"
            },
            "settlementCurrency": "USDC",  # Settle in USDC
            "chain": "SOL",  # Solana blockchain
            "destination": {
                "type": "blockchain",
                "address": self.platform_wallet,  # Platform wallet receives USDC
                "chain": "SOL"
            },
            "metadata": {
                "content_id": str(content_id),
                "buyer_wallet": buyer_wallet,
                "creator_wallet": creator_wallet,
                "platform": "renaissBlock"
            },
            "returnUrl": f"{settings.FRONTEND_URL}/purchase/success",
            "cancelUrl": f"{settings.FRONTEND_URL}/content/{content_id}"
        }

        try:
            logger.info(
                f'[Circle] Creating payment intent: amount=${amount_usd}, '
                f'content_id={content_id}, idempotency_key={idempotency_key}'
            )
            logger.info(f'[Circle] API URL: {url}')
            logger.info(f'[Circle] Using API base: {self.BASE_URL}')

            response = requests.post(
                url,
                json=payload,
                headers=self._get_headers(),
                timeout=30
            )

            logger.info(f'[Circle] Response status: {response.status_code}')

            if response.status_code not in (200, 201):
                error_msg = response.json().get('message', response.text) if response.text else 'No error message'
                logger.error(
                    f'[Circle] Payment intent creation failed: {response.status_code} - {error_msg}'
                )
                logger.error(f'[Circle] Full response: {response.text}')
                raise CirclePaymentError(f"Circle API error: {error_msg}")

            data = response.json().get('data', {})

            logger.info(
                f'[Circle] ✅ Payment intent created: payment_id={data.get("id")}, '
                f'status={data.get("status")}'
            )

            return {
                'payment_id': data.get('id'),
                'status': data.get('status'),
                'checkout_url': data.get('checkoutUrl'),
                'tracking_ref': data.get('trackingRef'),
            }

        except requests.RequestException as e:
            logger.error(f'[Circle] Network error creating payment intent: {e}')
            raise CirclePaymentError(f"Network error: {str(e)}")

    def get_payment_status(self, payment_id: str) -> Dict:
        """
        Get current status of a Circle payment.

        Args:
            payment_id: Circle payment ID

        Returns:
            Dict containing payment details and status

        Raises:
            CirclePaymentError: If API call fails
        """
        url = f"{self.BASE_URL}/v1/payments/{payment_id}"

        try:
            response = requests.get(
                url,
                headers=self._get_headers(),
                timeout=30
            )

            if response.status_code != 200:
                error_msg = response.json().get('message', response.text)
                raise CirclePaymentError(f"Circle API error: {error_msg}")

            return response.json().get('data', {})

        except requests.RequestException as e:
            logger.error(f'[Circle] Error fetching payment status: {e}')
            raise CirclePaymentError(f"Network error: {str(e)}")

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Circle webhook signature for security.

        Args:
            payload: Raw webhook payload bytes
            signature: Signature from X-Circle-Signature header

        Returns:
            True if signature is valid, False otherwise
        """
        if not self.webhook_secret:
            logger.warning('[Circle] CIRCLE_WEBHOOK_SECRET not configured - skipping verification')
            return True  # In development, allow unsigned webhooks

        try:
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()

            is_valid = hmac.compare_digest(expected_signature, signature)

            if not is_valid:
                logger.error('[Circle] Webhook signature verification failed')

            return is_valid

        except Exception as e:
            logger.error(f'[Circle] Error verifying webhook signature: {e}')
            return False

    def calculate_usdc_settlement(
        self,
        amount_usd: Decimal,
        circle_fee: Decimal
    ) -> Dict[str, Decimal]:
        """
        Calculate USDC settlement amounts after Circle fees.

        Circle typically charges 1-2% + fixed fee for card payments.

        Args:
            amount_usd: Original purchase amount in USD
            circle_fee: Circle's processing fee in USD

        Returns:
            Dict with breakdown:
                - gross_amount: Original amount
                - circle_fee: Circle processing fee
                - net_after_circle: Amount after Circle fee
                - usdc_received: USDC amount received (1:1 with USD net)
        """
        net_after_circle = amount_usd - circle_fee

        # USDC is pegged 1:1 with USD
        usdc_received = net_after_circle

        return {
            'gross_amount': amount_usd,
            'circle_fee': circle_fee,
            'net_after_circle': net_after_circle,
            'usdc_received': usdc_received,
        }
