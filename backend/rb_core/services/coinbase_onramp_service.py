"""
Coinbase Onramp Service for fiat -> USDC conversion.

Integrates with Coinbase Onramp SDK to allow users to purchase USDC
using Apple Pay, debit cards, and other payment methods.
"""

import hashlib
import hmac
import json
import logging
import uuid
from decimal import Decimal
from typing import Dict, Any, Optional

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class CoinbaseOnrampError(Exception):
    """Exception raised for Coinbase Onramp errors."""
    pass


class CoinbaseOnrampService:
    """
    Service for Coinbase Onramp integration.

    The Coinbase Onramp SDK allows users to purchase crypto directly
    using Apple Pay, Google Pay, and debit cards. USDC is sent
    directly to the user's wallet.
    """

    def __init__(self):
        self.app_id = getattr(settings, 'COINBASE_ONRAMP_APP_ID', '')
        self.webhook_secret = getattr(settings, 'COINBASE_WEBHOOK_SECRET', '')
        self.api_base = 'https://api.coinbase.com'

    def get_widget_config(
        self,
        user,
        amount_usd: Decimal,
        destination_wallet: str,
        purchase_intent_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate Coinbase Onramp widget configuration.

        The widget is rendered on the frontend using the Coinbase SDK.
        When the user completes payment, USDC is sent to their wallet.

        Args:
            user: Django User object
            amount_usd: Amount in USD to convert
            destination_wallet: User's Solana wallet address
            purchase_intent_id: Optional linked purchase intent

        Returns:
            Dict with widget configuration for frontend
        """
        if not self.app_id:
            raise CoinbaseOnrampError("COINBASE_ONRAMP_APP_ID not configured")

        # Generate unique session ID for tracking
        session_id = f"rb_{user.id}_{uuid.uuid4().hex[:12]}"

        # Build widget configuration
        # See: https://docs.cdp.coinbase.com/onramp/docs/api-initializing
        config = {
            'appId': self.app_id,
            'destinationWallets': [
                {
                    'address': destination_wallet,
                    'blockchains': ['solana'],
                    'assets': ['USDC'],
                }
            ],
            'defaultAsset': 'USDC',
            'defaultNetwork': 'solana',
            'presetCryptoAmount': float(amount_usd),
            'defaultExperience': 'buy',
            'handlingRequestedUrls': True,
            # Partner metadata for tracking
            'partnerUserId': str(user.id),
            'sessionId': session_id,
        }

        # Add intent tracking if provided
        if purchase_intent_id:
            config['metadata'] = {
                'purchase_intent_id': str(purchase_intent_id),
            }

        return {
            'widget_config': config,
            'session_id': session_id,
            'minimum_amount': '5.00',
        }

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Coinbase webhook signature.

        Args:
            payload: Raw request body bytes
            signature: X-CC-Webhook-Signature header value

        Returns:
            bool: True if signature is valid
        """
        if not self.webhook_secret:
            logger.warning("COINBASE_WEBHOOK_SECRET not configured")
            return False

        try:
            expected = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected, signature)
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False

    def handle_webhook_event(self, event_type: str, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle Coinbase webhook event.

        Events:
        - charge:pending - Payment detected, awaiting confirmation
        - charge:confirmed - Payment confirmed, USDC delivered
        - charge:resolved - Previously unresolved charge is now resolved
        - charge:delayed - Payment delayed (blockchain congestion)
        - charge:failed - Payment failed

        Args:
            event_type: Type of webhook event
            event_data: Event payload data

        Returns:
            Dict with processing result
        """
        from rb_core.models import CoinbaseTransaction, PurchaseIntent

        charge_id = event_data.get('id')
        if not charge_id:
            return {'error': 'Missing charge ID'}

        try:
            transaction = CoinbaseTransaction.objects.get(coinbase_charge_id=charge_id)
        except CoinbaseTransaction.DoesNotExist:
            logger.warning(f"Unknown Coinbase charge: {charge_id}")
            return {'error': 'Unknown charge', 'charge_id': charge_id}

        if event_type == 'charge:confirmed':
            return self._handle_charge_confirmed(transaction, event_data)
        elif event_type == 'charge:resolved':
            return self._handle_charge_confirmed(transaction, event_data)
        elif event_type == 'charge:pending':
            return self._handle_charge_pending(transaction, event_data)
        elif event_type == 'charge:delayed':
            return self._handle_charge_delayed(transaction, event_data)
        elif event_type == 'charge:failed':
            return self._handle_charge_failed(transaction, event_data)
        else:
            logger.info(f"Unhandled Coinbase event type: {event_type}")
            return {'status': 'ignored', 'event_type': event_type}

    def _handle_charge_confirmed(
        self,
        transaction: 'CoinbaseTransaction',
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle confirmed charge - USDC has been delivered."""
        from rb_core.tasks import process_coinbase_completion_task

        # Extract payment details
        payments = event_data.get('payments', [])
        if payments:
            payment = payments[0]
            transaction.usdc_amount = Decimal(str(payment.get('value', {}).get('local', {}).get('amount', 0)))
            transaction.solana_tx_signature = payment.get('transaction_id', '')

        transaction.status = 'completed'
        transaction.completed_at = timezone.now()
        transaction.save()

        # Trigger async processing
        try:
            process_coinbase_completion_task.delay(transaction.id)
        except Exception as e:
            logger.error(f"Failed to queue Coinbase completion task: {e}")

        return {
            'status': 'completed',
            'transaction_id': transaction.id,
            'usdc_amount': str(transaction.usdc_amount),
        }

    def _handle_charge_failed(
        self,
        transaction: 'CoinbaseTransaction',
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle failed charge."""
        transaction.status = 'failed'
        transaction.failure_reason = event_data.get('failure_reason', 'Payment failed')
        transaction.save()

        # Update linked intent if exists
        if transaction.purchase_intent:
            transaction.purchase_intent.status = 'failed'
            transaction.purchase_intent.failure_reason = f"Coinbase payment failed: {transaction.failure_reason}"
            transaction.purchase_intent.save()

        return {
            'status': 'failed',
            'transaction_id': transaction.id,
            'reason': transaction.failure_reason,
        }

    def _handle_charge_pending(
        self,
        transaction: 'CoinbaseTransaction',
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle pending charge - payment detected, awaiting confirmation."""
        if transaction.status not in ('completed',):
            transaction.status = 'pending'
            transaction.save()

        return {
            'status': 'pending',
            'transaction_id': transaction.id,
        }

    def _handle_charge_delayed(
        self,
        transaction: 'CoinbaseTransaction',
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle delayed charge - payment delayed due to blockchain congestion."""
        if transaction.status not in ('completed',):
            transaction.status = 'delayed'
            transaction.save()
            logger.warning(f"Coinbase charge delayed: {transaction.coinbase_charge_id}")

        return {
            'status': 'delayed',
            'transaction_id': transaction.id,
        }


# Singleton instance
_coinbase_service: Optional[CoinbaseOnrampService] = None


def get_coinbase_service() -> CoinbaseOnrampService:
    """Get or create the Coinbase Onramp service singleton."""
    global _coinbase_service
    if _coinbase_service is None:
        _coinbase_service = CoinbaseOnrampService()
    return _coinbase_service
