"""
Circle Web3 Services (W3S) Integration for Wallet Management and NFT Minting.

This service handles:
- User-controlled wallet creation (PIN-based authentication)
- Developer-controlled treasury wallet operations
- USDC transfers between wallets
- NFT minting on Solana blockchain
- Wallet balance queries

Circle W3S API Documentation: https://developers.circle.com/w3s/docs
"""

import logging
import requests
import uuid
from typing import Optional, Dict, Any
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


class CircleW3SError(Exception):
    """Base exception for Circle W3S API errors."""
    pass


class CircleW3SService:
    """
    Service for interacting with Circle Web3 Services API.

    Supports both sandbox and production environments.
    """

    # API endpoints
    SANDBOX_BASE_URL = "https://api-sandbox.circle.com/v1/w3s"
    PRODUCTION_BASE_URL = "https://api.circle.com/v1/w3s"

    def __init__(self):
        """Initialize Circle W3S service with API credentials."""
        self.api_key = getattr(settings, 'CIRCLE_W3S_API_KEY', '')
        self.app_id = getattr(settings, 'CIRCLE_W3S_APP_ID', '')
        self.entity_id = getattr(settings, 'CIRCLE_W3S_ENTITY_ID', '')
        self.platform_wallet_id = getattr(settings, 'CIRCLE_W3S_PLATFORM_WALLET_ID', '')

        # Use sandbox for development, production in prod
        self.is_production = getattr(settings, 'CIRCLE_W3S_PRODUCTION', False)
        self.base_url = self.PRODUCTION_BASE_URL if self.is_production else self.SANDBOX_BASE_URL

        # Log configuration (redact sensitive data)
        if self.api_key:
            logger.info(f'[Circle W3S] Initialized with API key: {self.api_key[:30]}...')
            logger.info(f'[Circle W3S] App ID: {self.app_id}')
            logger.info(f'[Circle W3S] Entity ID: {self.entity_id}')
            logger.info(f'[Circle W3S] Environment: {"Production" if self.is_production else "Sandbox"}')
        else:
            logger.warning('[Circle W3S] API key not configured')

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication."""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Circle W3S API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path (without base URL)
            data: Request body data
            params: Query parameters

        Returns:
            API response as dictionary

        Raises:
            CircleW3SError: If API request fails
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        try:
            logger.info(f'[Circle W3S] {method} {endpoint}')

            response = requests.request(
                method=method,
                url=url,
                headers=self._get_headers(),
                json=data,
                params=params,
                timeout=30
            )

            # Log response status
            logger.info(f'[Circle W3S] Response: {response.status_code}')

            # Handle errors
            if response.status_code >= 400:
                error_detail = response.text
                logger.error(f'[Circle W3S] API Error: {response.status_code} - {error_detail}')
                raise CircleW3SError(f'Circle W3S API error: {response.status_code} - {error_detail}')

            result = response.json()
            return result

        except requests.RequestException as e:
            logger.error(f'[Circle W3S] Request failed: {e}')
            raise CircleW3SError(f'Circle W3S request failed: {e}')

    def create_user_wallet(self, user_id: int, email: str, user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a user-controlled Circle W3S wallet.

        This follows the Circle W3S API flow:
        1. Create user with POST /users
        2. Get user token with POST /users/token
        3. Create wallet with POST /wallets

        Args:
            user_id: Internal user ID for reference
            email: User's email address
            user_token: Optional user session token for wallet encryption

        Returns:
            {
                'wallet_id': 'abc123...',
                'address': 'solana_address_here',
                'blockchain': 'SOL-DEVNET' or 'SOL',
                'state': 'LIVE'
            }
        """
        try:
            # Step 1: Create Circle user (idempotent with userId)
            circle_user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f'renaissblock-user-{user_id}'))

            logger.info(f'[Circle W3S] Step 1: Creating Circle user for user {user_id}')
            user_data = {
                'userId': circle_user_id
            }
            user_result = self._make_request('POST', '/users', data=user_data)
            logger.info(f'[Circle W3S] ✅ Circle user created: {circle_user_id}')

            # Step 2: Get user token (60-minute session token)
            logger.info(f'[Circle W3S] Step 2: Getting user token')
            token_data = {
                'userId': circle_user_id
            }
            token_result = self._make_request('POST', '/users/token', data=token_data)
            user_session_token = token_result.get('data', {}).get('userToken')
            encryption_key = token_result.get('data', {}).get('encryptionKey')

            if not user_session_token:
                raise CircleW3SError('Failed to get user token from Circle')

            logger.info(f'[Circle W3S] ✅ User token obtained')

            # Step 3: Create wallet using user token
            logger.info(f'[Circle W3S] Step 3: Creating wallet')
            idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_DNS, f'wallet-{user_id}'))

            wallet_data_request = {
                'idempotencyKey': idempotency_key,
                'userId': circle_user_id,
                'userToken': user_session_token,
                'blockchains': ['SOL-DEVNET'] if not self.is_production else ['SOL'],
                'accountType': 'SCA',  # Smart Contract Account
            }

            wallet_result = self._make_request('POST', '/wallets', data=wallet_data_request)

            # Extract wallet info
            wallet_data = wallet_result.get('data', {})
            wallet_id = wallet_data.get('walletId') or wallet_data.get('wallet', {}).get('id')

            # Get wallet address
            address = None
            if wallet_id:
                try:
                    address_info = self.get_wallet_address(wallet_id)
                    address = address_info.get('address')
                except Exception as e:
                    logger.warning(f'[Circle W3S] Could not fetch address immediately: {e}')

            result = {
                'wallet_id': wallet_id,
                'address': address,
                'blockchain': 'SOL-DEVNET' if not self.is_production else 'SOL',
                'state': wallet_data.get('state', 'PENDING'),
                'circle_user_id': circle_user_id
            }

            logger.info(f'[Circle W3S] ✅ Wallet created for user {user_id}: {wallet_id}')
            return result

        except Exception as e:
            logger.error(f'[Circle W3S] Failed to create wallet for user {user_id}: {e}')
            raise CircleW3SError(f'Wallet creation failed: {e}')

    def get_wallet_address(self, wallet_id: str) -> Dict[str, Any]:
        """
        Get wallet address for a given wallet ID.

        Args:
            wallet_id: Circle W3S wallet ID

        Returns:
            {
                'address': 'solana_address',
                'blockchain': 'SOL-DEVNET' or 'SOL'
            }
        """
        try:
            result = self._make_request('GET', f'/wallets/{wallet_id}')
            wallet_data = result.get('data', {})

            # Extract Solana address
            accounts = wallet_data.get('accounts', [])
            for account in accounts:
                if account.get('blockchain', '').startswith('SOL'):
                    return {
                        'address': account.get('address'),
                        'blockchain': account.get('blockchain')
                    }

            return {'address': '', 'blockchain': ''}

        except Exception as e:
            logger.error(f'[Circle W3S] Failed to get wallet address: {e}')
            raise CircleW3SError(f'Get wallet address failed: {e}')

    def get_wallet_balance(self, wallet_id: str) -> Decimal:
        """
        Get USDC balance for a wallet.

        Args:
            wallet_id: Circle W3S wallet ID

        Returns:
            USDC balance as Decimal (e.g., Decimal('10.50'))
        """
        try:
            result = self._make_request('GET', f'/wallets/{wallet_id}/balances')

            balances = result.get('data', {}).get('tokenBalances', [])

            # Find USDC balance
            for balance in balances:
                token = balance.get('token', {})
                if token.get('symbol') == 'USDC':
                    amount = balance.get('amount', '0')
                    return Decimal(amount)

            return Decimal('0')

        except Exception as e:
            logger.error(f'[Circle W3S] Failed to get wallet balance: {e}')
            return Decimal('0')

    def transfer_usdc(
        self,
        from_wallet_id: str,
        to_address: str,
        amount_usdc: Decimal,
        reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer USDC from one wallet to another.

        Args:
            from_wallet_id: Source wallet ID (developer-controlled or user-controlled)
            to_address: Destination Solana address
            amount_usdc: Amount in USDC (e.g., Decimal('2.50'))
            reference_id: Optional reference ID for tracking (e.g., purchase ID)

        Returns:
            {
                'id': 'transaction_id',
                'state': 'INITIATED' or 'CONFIRMED',
                'transaction_hash': 'solana_tx_hash'
            }
        """
        try:
            # Generate idempotency key
            idempotency_key = reference_id or str(uuid.uuid4())

            # Convert USDC to base units (6 decimals)
            # Example: 2.5 USDC = 2500000 base units
            amount_base_units = str(int(amount_usdc * Decimal('1000000')))

            data = {
                'idempotencyKey': idempotency_key,
                'walletId': from_wallet_id,
                'blockchain': 'SOL-DEVNET' if not self.is_production else 'SOL',
                'tokenId': self._get_usdc_token_id(),
                'destinationAddress': to_address,
                'amounts': [amount_base_units],
                'fee': {
                    'type': 'level',
                    'config': {
                        'feeLevel': 'MEDIUM'  # Gas fee level
                    }
                }
            }

            result = self._make_request('POST', '/transactions/transfer', data=data)

            transaction_data = result.get('data', {})
            tx_id = transaction_data.get('id')

            logger.info(f'[Circle W3S] ✅ USDC transfer initiated: {amount_usdc} USDC to {to_address[:8]}... (tx: {tx_id})')

            return transaction_data

        except Exception as e:
            logger.error(f'[Circle W3S] USDC transfer failed: {e}')
            raise CircleW3SError(f'USDC transfer failed: {e}')

    def mint_nft_to_wallet(
        self,
        wallet_address: str,
        metadata_uri: str,
        nft_collection_id: Optional[str] = None,
        reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mint an NFT to a user's wallet on Solana.

        This uses Circle W3S NFT minting capabilities with lazy minting support.

        Args:
            wallet_address: Destination Solana wallet address
            metadata_uri: IPFS URI with NFT metadata (e.g., 'ipfs://Qm...')
            nft_collection_id: Optional Circle W3S collection ID
            reference_id: Optional reference ID (e.g., content ID)

        Returns:
            {
                'nft_id': 'circle_nft_id',
                'mint_address': 'solana_nft_mint_address',
                'transaction_hash': 'solana_tx_hash',
                'state': 'CONFIRMED'
            }
        """
        try:
            # Generate idempotency key
            idempotency_key = reference_id or str(uuid.uuid4())

            data = {
                'idempotencyKey': idempotency_key,
                'walletId': self.platform_wallet_id,  # Platform wallet mints NFT
                'blockchain': 'SOL-DEVNET' if not self.is_production else 'SOL',
                'recipientAddress': wallet_address,
                'metadataUri': metadata_uri,
            }

            if nft_collection_id:
                data['collectionId'] = nft_collection_id

            result = self._make_request('POST', '/nfts/mint', data=data)

            nft_data = result.get('data', {})
            nft_id = nft_data.get('id')

            logger.info(f'[Circle W3S] ✅ NFT minted to {wallet_address[:8]}... (NFT ID: {nft_id})')

            return nft_data

        except Exception as e:
            logger.error(f'[Circle W3S] NFT minting failed: {e}')
            raise CircleW3SError(f'NFT minting failed: {e}')

    def get_transaction_status(self, transaction_id: str) -> Dict[str, Any]:
        """
        Get status of a transaction (transfer or mint).

        Args:
            transaction_id: Circle W3S transaction ID

        Returns:
            {
                'id': 'transaction_id',
                'state': 'INITIATED' | 'PENDING' | 'CONFIRMED' | 'FAILED',
                'transaction_hash': 'solana_tx_hash'
            }
        """
        try:
            result = self._make_request('GET', f'/transactions/{transaction_id}')
            return result.get('data', {})

        except Exception as e:
            logger.error(f'[Circle W3S] Failed to get transaction status: {e}')
            raise CircleW3SError(f'Get transaction status failed: {e}')

    def _get_usdc_token_id(self) -> str:
        """
        Get Circle W3S token ID for USDC on Solana.

        Returns:
            Token ID for USDC
        """
        # This is the Circle-managed USDC token ID
        # Update based on Circle W3S documentation for your environment
        if self.is_production:
            return 'usdc-sol-mainnet-token-id'  # Replace with actual production token ID
        else:
            return 'usdc-sol-devnet-token-id'  # Replace with actual devnet token ID


# Singleton instance
_circle_w3s_service = None


def get_circle_w3s_service() -> CircleW3SService:
    """Get singleton instance of Circle W3S service."""
    global _circle_w3s_service
    if _circle_w3s_service is None:
        _circle_w3s_service = CircleW3SService()
    return _circle_w3s_service
