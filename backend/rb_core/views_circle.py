"""
Circle User-Controlled Wallet API Views

Endpoints for frontend Circle Web SDK integration:
- Get user token for wallet creation
- Save wallet address after creation
- Get wallet status
"""

import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from blockchain.circle_user_controlled_service import (
    get_circle_user_controlled_service,
    CircleUserControlledError
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_circle_user_token(request):
    """
    Get Circle user token for frontend SDK wallet creation.

    The frontend needs this token to initialize the Circle SDK
    and prompt the user to set their PIN and create their wallet.

    Returns:
        {
            "user_token": "eyJhbGciOiJ...",
            "encryption_key": {...},
            "circle_user_id": "uuid..."
        }
    """
    try:
        user = request.user
        profile = user.profile

        # Check if Circle user account exists
        if not profile.circle_user_id:
            return Response({
                'error': 'Circle user account not created yet',
                'detail': 'Please wait a moment and try again. Your wallet is being set up.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get user token from Circle
        circle_service = get_circle_user_controlled_service()
        token_data = circle_service.get_user_token(profile.circle_user_id)

        # Add circle_user_id to response
        token_data['circle_user_id'] = profile.circle_user_id

        logger.info(f'[Circle API] User token retrieved for user {user.id} ({user.username})')

        return Response(token_data)

    except CircleUserControlledError as e:
        logger.error(f'[Circle API] Error getting user token: {e}')
        return Response({
            'error': 'Failed to get wallet creation token',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f'[Circle API] Unexpected error: {e}', exc_info=True)
        return Response({
            'error': 'An unexpected error occurred',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_wallet_address(request):
    """
    Save wallet address after frontend creates wallet.

    After the user sets their PIN and creates their wallet via
    the Circle SDK, the frontend sends the wallet address here.

    Request body:
        {
            "wallet_address": "solana_address",
            "wallet_id": "circle_wallet_id" (optional)
        }

    Returns:
        {
            "success": true,
            "wallet_address": "solana_address"
        }
    """
    try:
        user = request.user
        profile = user.profile

        wallet_address = request.data.get('wallet_address')
        wallet_id = request.data.get('wallet_id')

        if not wallet_address:
            return Response({
                'error': 'Wallet address is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate Solana address format (basic check)
        if len(wallet_address) < 32 or len(wallet_address) > 44:
            return Response({
                'error': 'Invalid wallet address format'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save wallet information
        profile.circle_wallet_address = wallet_address
        profile.wallet_address = wallet_address  # Backward compatibility

        if wallet_id:
            profile.circle_wallet_id = wallet_id

        # Ensure wallet provider is set
        if not profile.wallet_provider or profile.wallet_provider == '':
            profile.wallet_provider = 'circle_user_controlled'

        profile.save(update_fields=[
            'circle_wallet_address',
            'circle_wallet_id',
            'wallet_address',
            'wallet_provider'
        ])

        logger.info(
            f'[Circle API] Wallet address saved for user {user.id} ({user.username}): '
            f'{wallet_address[:8]}...{wallet_address[-4:]}'
        )

        return Response({
            'success': True,
            'wallet_address': wallet_address,
            'message': 'Wallet successfully linked to your account!'
        })

    except Exception as e:
        logger.error(f'[Circle API] Error saving wallet address: {e}', exc_info=True)
        return Response({
            'error': 'Failed to save wallet address',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet_status(request):
    """
    Get current wallet status for the user.

    Returns:
        {
            "has_circle_account": true/false,
            "has_wallet": true/false,
            "circle_user_id": "uuid..." or null,
            "wallet_address": "address" or null,
            "wallet_provider": "circle_user_controlled" or null
        }
    """
    try:
        user = request.user
        profile = user.profile

        return Response({
            'has_circle_account': bool(profile.circle_user_id),
            'has_wallet': bool(profile.circle_wallet_address or profile.wallet_address),
            'circle_user_id': profile.circle_user_id,
            'wallet_address': profile.circle_wallet_address or profile.wallet_address,
            'wallet_provider': profile.wallet_provider
        })

    except Exception as e:
        logger.error(f'[Circle API] Error getting wallet status: {e}', exc_info=True)
        return Response({
            'error': 'Failed to get wallet status',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
