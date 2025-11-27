"""
Circle User-Controlled Wallets Service

This service handles backend operations for Circle's user-controlled wallets:
- Creating Circle user accounts during signup
- Getting user tokens for frontend wallet creation
- Querying wallet information

Frontend SDK (JavaScript/React) handles:
- User PIN setup
- Wallet creation with user's PIN
- Wallet transactions requiring user approval

Circle Documentation: https://developers.circle.com/w3s
"""

import logging
import uuid
from typing import Dict, Any, Optional
from django.conf import settings

from circle.web3.user_controlled_wallets import (
    Configuration,
    ApiClient,
    PINAuthenticationApi,
    CreateUserRequest,
    UserTokenRequest
)

logger = logging.getLogger(__name__)


class CircleUserControlledError(Exception):
    """Base exception for Circle user-controlled wallet errors."""
    pass


class CircleUserControlledService:
    """
    Service for Circle user-controlled wallets (backend operations).

    User-controlled wallets are non-custodial - users control their wallets
    with PIN codes. Backend creates user accounts, frontend creates wallets.
    """

    def __init__(self):
        """Initialize Circle user-controlled wallet service."""
        self.api_key = getattr(settings, 'CIRCLE_W3S_API_KEY', '')
        self.app_id = getattr(settings, 'CIRCLE_W3S_APP_ID', '')

        if not self.api_key:
            logger.warning('[Circle User-Controlled] API key not configured')

        logger.info(f'[Circle User-Controlled] Service initialized')
        logger.info(f'[Circle User-Controlled] App ID: {self.app_id}')

    def _get_api_client(self) -> ApiClient:
        """Get configured Circle API client."""
        configuration = Configuration(
            host="https://api.circle.com",
            access_token=self.api_key
        )
        return ApiClient(configuration)

    def create_user_account(self, internal_user_id: int, email: str) -> Dict[str, Any]:
        """
        Create a Circle user account (backend step).

        This creates the user account on Circle's side. The actual wallet
        will be created by the user via frontend SDK when they set their PIN.

        Args:
            internal_user_id: Your app's internal user ID
            email: User's email address

        Returns:
            {
                'circle_user_id': 'uuid...',
                'status': 'ENABLED',
                'create_date': '2025-11-27T...'
            }

        Raises:
            CircleUserControlledError: If user creation fails
        """
        try:
            # Generate deterministic Circle user ID from internal user ID
            circle_user_id = str(uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f'renaissblock-user-{internal_user_id}'
            ))

            logger.info(f'[Circle User-Controlled] Creating user account for internal user {internal_user_id}')
            logger.info(f'[Circle User-Controlled] Circle user ID: {circle_user_id}')

            with self._get_api_client() as api_client:
                pin_api = PINAuthenticationApi(api_client)

                # Create user account
                create_request = CreateUserRequest(user_id=circle_user_id)
                response = pin_api.create_user(create_user_request=create_request)

                result = {
                    'circle_user_id': response.data.id,
                    'status': str(response.data.status),
                    'create_date': str(response.data.create_date),
                    'email': email  # Store for reference
                }

                logger.info(f'[Circle User-Controlled] ✅ User account created: {circle_user_id}')
                return result

        except Exception as e:
            logger.error(f'[Circle User-Controlled] Failed to create user: {e}')
            raise CircleUserControlledError(f'User account creation failed: {e}')

    def get_user_token(self, circle_user_id: str) -> Dict[str, Any]:
        """
        Get user token for frontend SDK wallet creation.

        The frontend SDK needs this token to initialize wallet creation
        with the user's PIN.

        Args:
            circle_user_id: Circle's user ID (UUID)

        Returns:
            {
                'user_token': 'eyJhbGciOiJ...',
                'encryption_key': {...}
            }

        Raises:
            CircleUserControlledError: If token retrieval fails
        """
        try:
            logger.info(f'[Circle User-Controlled] Getting user token for {circle_user_id}')

            with self._get_api_client() as api_client:
                pin_api = PINAuthenticationApi(api_client)

                token_request = UserTokenRequest(user_id=circle_user_id)
                response = pin_api.get_user_token(user_token_request=token_request)

                result = {
                    'user_token': response.data.user_token,
                    'encryption_key': response.data.encryption_key.__dict__ if hasattr(response.data, 'encryption_key') else None
                }

                logger.info(f'[Circle User-Controlled] ✅ User token retrieved')
                return result

        except Exception as e:
            logger.error(f'[Circle User-Controlled] Failed to get user token: {e}')
            raise CircleUserControlledError(f'User token retrieval failed: {e}')

    def get_user_info(self, circle_user_id: str) -> Dict[str, Any]:
        """
        Get user information from Circle.

        Args:
            circle_user_id: Circle's user ID (UUID)

        Returns:
            User information including status, wallets, etc.
        """
        try:
            from circle.web3.user_controlled_wallets import UsersApi

            with self._get_api_client() as api_client:
                users_api = UsersApi(api_client)
                response = users_api.get_user(id=circle_user_id)

                return {
                    'id': response.data.id,
                    'status': str(response.data.status),
                    'create_date': str(response.data.create_date),
                    'pin_status': str(response.data.pin_status) if hasattr(response.data, 'pin_status') else None
                }

        except Exception as e:
            logger.error(f'[Circle User-Controlled] Failed to get user info: {e}')
            raise CircleUserControlledError(f'Get user info failed: {e}')


# Singleton instance
_circle_user_controlled_service = None


def get_circle_user_controlled_service() -> CircleUserControlledService:
    """Get singleton instance of Circle user-controlled wallet service."""
    global _circle_user_controlled_service
    if _circle_user_controlled_service is None:
        _circle_user_controlled_service = CircleUserControlledService()
    return _circle_user_controlled_service
