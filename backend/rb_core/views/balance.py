"""
Balance API views for the dual payment system.

Provides endpoints for:
- Getting user's renaissBlock Balance (cached USDC)
- Force syncing balance from blockchain
"""

import logging
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import UserRateThrottle

from rb_core.models import UserBalance
from rb_core.services import get_solana_service

logger = logging.getLogger(__name__)


class BalanceSyncThrottle(UserRateThrottle):
    """Rate limit balance sync to prevent abuse."""
    rate = '10/minute'


class UserBalanceView(APIView):
    """
    Get user's current renaissBlock Balance (cached USDC).

    GET /api/balance/

    Response:
    {
        "balance": "12.50",
        "display_balance": "$12.50",
        "last_synced": "2024-01-15T10:30:00Z",
        "sync_status": "synced",
        "is_stale": false
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Check if user has a wallet
        wallet_address = user.wallet_address
        if not wallet_address:
            return Response({
                'balance': '0.00',
                'display_balance': '$0.00',
                'last_synced': None,
                'sync_status': 'no_wallet',
                'is_stale': True,
                'message': 'No wallet connected. Please connect a wallet to view your balance.'
            })

        # Get or create user balance record
        try:
            user_balance = UserBalance.objects.get(user=user)
        except UserBalance.DoesNotExist:
            # Create and sync balance
            solana_service = get_solana_service()
            try:
                balance = solana_service.sync_user_balance(user)
                user_balance = UserBalance.objects.get(user=user)
            except Exception as e:
                logger.error(f"Failed to sync balance for user {user.id}: {e}")
                return Response({
                    'balance': '0.00',
                    'display_balance': '$0.00',
                    'last_synced': None,
                    'sync_status': 'error',
                    'is_stale': True,
                    'error': 'Failed to fetch balance from blockchain'
                })

        # If balance is stale, trigger async sync (but return cached value)
        sync_triggered = False
        if user_balance.is_stale:
            # Import here to avoid circular imports
            from rb_core.tasks import sync_user_balance_task
            try:
                sync_user_balance_task.delay(user.id)
                sync_triggered = True
                logger.info(f"Triggered async balance sync for user {user.id}")
            except Exception as e:
                logger.warning(f"Failed to queue balance sync for user {user.id}: {e}")

        # Return 'syncing' status if we just triggered an async sync
        # This tells the frontend to poll for updates
        current_status = 'syncing' if sync_triggered else user_balance.sync_status

        return Response({
            'balance': str(user_balance.usdc_balance),
            'display_balance': user_balance.display_balance,
            'last_synced': user_balance.last_synced_at.isoformat() if user_balance.last_synced_at else None,
            'sync_status': current_status,
            'is_stale': user_balance.is_stale,
        })


class SyncBalanceView(APIView):
    """
    Force sync balance from Solana blockchain.

    POST /api/balance/sync/

    Rate limited to prevent abuse.

    Response:
    {
        "balance": "12.50",
        "display_balance": "$12.50",
        "last_synced": "2024-01-15T10:30:00Z",
        "sync_status": "synced"
    }
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [BalanceSyncThrottle]

    def post(self, request):
        user = request.user

        # Check if user has a wallet
        wallet_address = user.wallet_address
        if not wallet_address:
            return Response({
                'error': 'No wallet connected',
                'message': 'Please connect a wallet to sync your balance.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Sync balance from blockchain
        solana_service = get_solana_service()
        try:
            balance = solana_service.sync_user_balance(user)
            user_balance = UserBalance.objects.get(user=user)

            return Response({
                'balance': str(user_balance.usdc_balance),
                'display_balance': user_balance.display_balance,
                'last_synced': user_balance.last_synced_at.isoformat() if user_balance.last_synced_at else None,
                'sync_status': user_balance.sync_status,
            })

        except Exception as e:
            logger.error(f"Failed to sync balance for user {user.id}: {e}")
            return Response({
                'error': 'Sync failed',
                'message': 'Failed to fetch balance from blockchain. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckBalanceSufficiencyView(APIView):
    """
    Check if user's balance is sufficient for a purchase amount.

    POST /api/balance/check/
    Body: { "amount": "5.00" }

    Response:
    {
        "balance": "12.50",
        "amount": "5.00",
        "sufficient": true,
        "remaining_after": "7.50",
        "shortfall": "0.00"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        amount_str = request.data.get('amount')

        if not amount_str:
            return Response({
                'error': 'Amount required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except (ValueError, TypeError) as e:
            return Response({
                'error': 'Invalid amount',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get cached balance (sync if stale)
        solana_service = get_solana_service()
        try:
            balance = solana_service.get_cached_balance(user)
        except Exception as e:
            logger.error(f"Failed to get balance for user {user.id}: {e}")
            balance = Decimal('0')

        sufficient = balance >= amount
        remaining = balance - amount if sufficient else Decimal('0')
        shortfall = amount - balance if not sufficient else Decimal('0')

        return Response({
            'balance': str(balance),
            'display_balance': f"${balance:.2f}",
            'amount': str(amount),
            'sufficient': sufficient,
            'remaining_after': str(remaining),
            'shortfall': str(shortfall),
        })
