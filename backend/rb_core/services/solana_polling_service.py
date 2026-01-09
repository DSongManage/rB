"""
Solana Polling Service for balance sync and payment detection.

Handles:
- USDC balance querying from Solana blockchain
- User balance syncing to database cache
- Direct crypto payment detection via memo matching
"""

import logging
from decimal import Decimal
from typing import Optional, Dict, Any, List
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solders.pubkey import Pubkey
from spl.token.constants import TOKEN_PROGRAM_ID

logger = logging.getLogger(__name__)

# USDC Mint addresses
USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
USDC_DECIMALS = 6


class SolanaPollingService:
    """
    Service for polling Solana blockchain for balances and transactions.
    """

    def __init__(self):
        self.rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        self.network = getattr(settings, 'SOLANA_NETWORK', 'devnet')
        self.client = Client(self.rpc_url)
        self.usdc_mint = USDC_MINT_MAINNET if self.network == 'mainnet-beta' else USDC_MINT_DEVNET

    def get_usdc_balance(self, wallet_address: str) -> Decimal:
        """
        Get USDC balance for a wallet address.

        Args:
            wallet_address: Solana wallet address (base58 encoded)

        Returns:
            Decimal: USDC balance in human-readable format (e.g., 10.50 for $10.50)
        """
        try:
            owner_pubkey = Pubkey.from_string(wallet_address)
            usdc_mint_pubkey = Pubkey.from_string(self.usdc_mint)

            # Get associated token account address
            # Formula: PDA([owner, TOKEN_PROGRAM_ID, mint], ASSOCIATED_TOKEN_PROGRAM_ID)
            ata = self._get_associated_token_address(owner_pubkey, usdc_mint_pubkey)

            # Get token account balance
            response = self.client.get_token_account_balance(ata, commitment=Confirmed)

            if response.value is None:
                # Token account doesn't exist, balance is 0
                return Decimal('0')

            # Parse the UI amount (already converted to human-readable)
            ui_amount = response.value.ui_amount
            if ui_amount is None:
                return Decimal('0')

            return Decimal(str(ui_amount))

        except Exception as e:
            error_msg = str(e)
            # If account doesn't exist, balance is 0
            if 'could not find account' in error_msg.lower() or 'account not found' in error_msg.lower():
                return Decimal('0')
            logger.error(f"Error getting USDC balance for {wallet_address}: {e}")
            raise

    def _get_associated_token_address(self, owner: Pubkey, mint: Pubkey) -> Pubkey:
        """
        Derive the associated token address for an owner and mint.

        This matches the SPL Token associated token account derivation.
        """
        from solders.pubkey import Pubkey as SoldersPubkey

        ASSOCIATED_TOKEN_PROGRAM_ID = SoldersPubkey.from_string(
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        )

        # Derive PDA
        seeds = [
            bytes(owner),
            bytes(TOKEN_PROGRAM_ID),
            bytes(mint),
        ]

        # Find program address
        ata, _ = SoldersPubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
        return ata

    def sync_user_balance(self, user) -> Decimal:
        """
        Sync a user's USDC balance from blockchain to database.

        Args:
            user: Django User object (must have wallet_address via profile)

        Returns:
            Decimal: Updated balance
        """
        from rb_core.models import UserBalance

        wallet_address = user.wallet_address
        if not wallet_address:
            logger.warning(f"User {user.id} has no wallet address, cannot sync balance")
            return Decimal('0')

        try:
            # Get balance from blockchain
            balance = self.get_usdc_balance(wallet_address)

            # Update or create UserBalance record
            user_balance, created = UserBalance.objects.get_or_create(user=user)
            user_balance.usdc_balance = balance
            user_balance.last_synced_at = timezone.now()
            user_balance.sync_status = 'synced'
            user_balance.last_error = ''
            user_balance.save()

            logger.info(f"Synced balance for user {user.id}: ${balance}")
            return balance

        except Exception as e:
            logger.error(f"Failed to sync balance for user {user.id}: {e}")
            # Update error status
            user_balance, created = UserBalance.objects.get_or_create(user=user)
            user_balance.sync_status = 'error'
            user_balance.last_error = str(e)
            user_balance.save()
            raise

    def get_cached_balance(self, user, force_sync: bool = False) -> Decimal:
        """
        Get user's balance, using cache if available and fresh.

        Args:
            user: Django User object
            force_sync: If True, always sync from blockchain

        Returns:
            Decimal: User's USDC balance
        """
        from rb_core.models import UserBalance

        try:
            user_balance = UserBalance.objects.get(user=user)

            if force_sync or user_balance.is_stale:
                return self.sync_user_balance(user)

            return user_balance.usdc_balance

        except UserBalance.DoesNotExist:
            return self.sync_user_balance(user)

    def find_incoming_usdc_transfer(
        self,
        to_address: str,
        expected_amount: Decimal,
        memo: str,
        since_signature: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Find an incoming USDC transfer matching the criteria.

        Used for direct crypto payment detection. Checks for transfers
        to the platform address with matching memo and amount.

        Args:
            to_address: Platform's USDC receiving address
            expected_amount: Expected USDC amount
            memo: Unique memo to match (e.g., "RB-ABC123")
            since_signature: Only check transactions after this signature

        Returns:
            Dict with transaction details if found, None otherwise
        """
        try:
            to_pubkey = Pubkey.from_string(to_address)
            usdc_mint_pubkey = Pubkey.from_string(self.usdc_mint)

            # Get the token account for the platform address
            token_account = self._get_associated_token_address(to_pubkey, usdc_mint_pubkey)

            # Get recent transactions for the token account
            response = self.client.get_signatures_for_address(
                token_account,
                limit=50,
                commitment=Confirmed
            )

            if not response.value:
                return None

            for sig_info in response.value:
                signature = str(sig_info.signature)

                # Skip if we've already checked this signature
                if since_signature and signature == since_signature:
                    break

                # Get full transaction details
                tx_response = self.client.get_transaction(
                    sig_info.signature,
                    encoding='jsonParsed',
                    max_supported_transaction_version=0
                )

                if not tx_response.value:
                    continue

                tx_data = tx_response.value

                # Check for memo in the transaction
                if not self._transaction_has_memo(tx_data, memo):
                    continue

                # Check for USDC transfer with matching amount
                transfer_info = self._extract_usdc_transfer(tx_data, to_address, expected_amount)
                if transfer_info:
                    return {
                        'signature': signature,
                        'from_wallet': transfer_info['from_wallet'],
                        'amount': transfer_info['amount'],
                        'slot': sig_info.slot,
                        'block_time': sig_info.block_time,
                    }

            return None

        except Exception as e:
            logger.error(f"Error finding incoming USDC transfer: {e}")
            return None

    def _transaction_has_memo(self, tx_data: Any, expected_memo: str) -> bool:
        """Check if transaction contains the expected memo."""
        try:
            # Look through instructions for memo program
            MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

            transaction = tx_data.transaction
            if hasattr(transaction, 'message'):
                message = transaction.message
                if hasattr(message, 'instructions'):
                    for ix in message.instructions:
                        if hasattr(ix, 'program_id') and str(ix.program_id) == MEMO_PROGRAM_ID:
                            # Check if data contains our memo
                            if hasattr(ix, 'data') and expected_memo in str(ix.data):
                                return True

            return False
        except Exception as e:
            logger.debug(f"Error checking memo: {e}")
            return False

    def _extract_usdc_transfer(
        self,
        tx_data: Any,
        to_address: str,
        expected_amount: Decimal
    ) -> Optional[Dict[str, Any]]:
        """Extract USDC transfer details from transaction if it matches criteria."""
        try:
            # Allow 1% tolerance for amount matching
            min_amount = expected_amount * Decimal('0.99')
            max_amount = expected_amount * Decimal('1.01')

            transaction = tx_data.transaction
            if hasattr(transaction, 'message'):
                message = transaction.message
                if hasattr(message, 'instructions'):
                    for ix in message.instructions:
                        # Look for SPL Token transfer instructions
                        if hasattr(ix, 'parsed') and isinstance(ix.parsed, dict):
                            parsed = ix.parsed
                            if parsed.get('type') == 'transfer' or parsed.get('type') == 'transferChecked':
                                info = parsed.get('info', {})
                                destination = info.get('destination', '')
                                amount_str = info.get('amount', '0')

                                # For transferChecked, amount is in tokenAmount
                                if 'tokenAmount' in info:
                                    amount = Decimal(str(info['tokenAmount'].get('uiAmount', 0)))
                                else:
                                    # Raw amount, need to convert
                                    amount = Decimal(amount_str) / Decimal(10 ** USDC_DECIMALS)

                                # Check if this is to our address and amount matches
                                if min_amount <= amount <= max_amount:
                                    return {
                                        'from_wallet': info.get('source', info.get('authority', '')),
                                        'amount': amount,
                                    }

            return None
        except Exception as e:
            logger.debug(f"Error extracting USDC transfer: {e}")
            return None

    def get_current_slot(self) -> int:
        """Get the current slot number from the blockchain."""
        try:
            response = self.client.get_slot(commitment=Confirmed)
            return response.value
        except Exception as e:
            logger.error(f"Error getting current slot: {e}")
            raise

    def confirm_transaction(self, signature: str, max_retries: int = 3) -> bool:
        """
        Confirm a transaction has finalized.

        Args:
            signature: Transaction signature to confirm
            max_retries: Number of confirmation checks

        Returns:
            bool: True if transaction is confirmed
        """
        try:
            from solders.signature import Signature

            sig = Signature.from_string(signature)
            response = self.client.get_signature_statuses([sig])

            if response.value and response.value[0]:
                status = response.value[0]
                # Check if confirmed or finalized
                if status.confirmation_status in ['confirmed', 'finalized']:
                    return True

            return False
        except Exception as e:
            logger.error(f"Error confirming transaction {signature}: {e}")
            return False


# Singleton instance
_solana_service: Optional[SolanaPollingService] = None


def get_solana_service() -> SolanaPollingService:
    """Get or create the Solana polling service singleton."""
    global _solana_service
    if _solana_service is None:
        _solana_service = SolanaPollingService()
    return _solana_service
