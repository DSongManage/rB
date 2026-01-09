"""
Sponsored Transaction Service for Platform-Paid Fees.

Handles building Solana transactions where the platform pays SOL fees
and users only sign as token authority for USDC transfers.

Flow:
1. Backend builds transaction with platform as fee payer
2. User signs as token authority (authorizes USDC transfer)
3. Backend adds platform signature and submits
"""

import base64
import logging
from decimal import Decimal
from typing import Dict, Any, Optional

from django.conf import settings

from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.hash import Hash
from solders.message import MessageV0
from solders.transaction import VersionedTransaction
from solders.instruction import Instruction, AccountMeta
from solders.signature import Signature
from spl.token.constants import TOKEN_PROGRAM_ID

logger = logging.getLogger(__name__)

# USDC Mint addresses
USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
USDC_DECIMALS = 6

# Associated Token Program ID
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')


class SponsoredTransactionService:
    """
    Service for building and submitting sponsored transactions.
    Platform pays SOL fees, users sign only for token authority.
    """

    def __init__(self):
        self.rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        self.network = getattr(settings, 'SOLANA_NETWORK', 'devnet')
        self.client = Client(self.rpc_url)
        self.usdc_mint = USDC_MINT_MAINNET if self.network == 'mainnet-beta' else USDC_MINT_DEVNET
        self._platform_keypair: Optional[Keypair] = None

    @property
    def platform_keypair(self) -> Keypair:
        """Load platform keypair from settings (lazy loaded).

        Supports two methods (in priority order):
        1. PLATFORM_WALLET_KEYPAIR_PATH - Path to Solana CLI keypair JSON file
        2. PLATFORM_WALLET_PRIVATE_KEY - Base58 encoded private key
        """
        if self._platform_keypair is None:
            # Method 1: Load from keypair file (preferred)
            keypair_path = getattr(settings, 'PLATFORM_WALLET_KEYPAIR_PATH', None)
            if keypair_path:
                try:
                    import json
                    with open(keypair_path, 'r') as f:
                        key_data = json.load(f)
                    # Solana CLI keypair is a JSON array of bytes
                    key_bytes = bytes(key_data)
                    self._platform_keypair = Keypair.from_bytes(key_bytes)
                    logger.info(f"Loaded platform keypair from {keypair_path}")
                    return self._platform_keypair
                except FileNotFoundError:
                    logger.warning(f"Keypair file not found: {keypair_path}")
                except Exception as e:
                    logger.error(f"Failed to load keypair from file: {e}")
                    raise ValueError(f"Invalid keypair file at {keypair_path}: {e}")

            # Method 2: Load from base58 encoded private key
            private_key = getattr(settings, 'PLATFORM_WALLET_PRIVATE_KEY', None)
            if private_key:
                try:
                    import base58
                    key_bytes = base58.b58decode(private_key)
                    self._platform_keypair = Keypair.from_bytes(key_bytes)
                    return self._platform_keypair
                except Exception as e:
                    logger.error(f"Failed to load platform keypair from env: {e}")
                    raise ValueError(f"Invalid PLATFORM_WALLET_PRIVATE_KEY format: {e}")

            raise ValueError(
                "Platform wallet not configured. Set either "
                "PLATFORM_WALLET_KEYPAIR_PATH or PLATFORM_WALLET_PRIVATE_KEY"
            )

        return self._platform_keypair

    @property
    def platform_pubkey(self) -> Pubkey:
        """Get platform wallet public key."""
        return self.platform_keypair.pubkey()

    def _get_associated_token_address(self, owner: Pubkey, mint: Pubkey) -> Pubkey:
        """Derive the associated token address for an owner and mint."""
        seeds = [
            bytes(owner),
            bytes(TOKEN_PROGRAM_ID),
            bytes(mint),
        ]
        ata, _ = Pubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
        return ata

    def _create_transfer_instruction(
        self,
        source_ata: Pubkey,
        destination_ata: Pubkey,
        owner: Pubkey,
        amount: int,
    ) -> Instruction:
        """Create SPL Token transfer instruction."""
        # Token transfer instruction data: [3 (transfer), amount as u64]
        data = bytes([3]) + amount.to_bytes(8, 'little')

        return Instruction(
            program_id=TOKEN_PROGRAM_ID,
            accounts=[
                AccountMeta(source_ata, False, True),       # source (writable)
                AccountMeta(destination_ata, False, True),  # destination (writable)
                AccountMeta(owner, True, False),            # owner (signer)
            ],
            data=data,
        )

    def _create_ata_instruction(
        self,
        payer: Pubkey,
        ata: Pubkey,
        owner: Pubkey,
        mint: Pubkey,
    ) -> Instruction:
        """Create Associated Token Account instruction."""
        return Instruction(
            program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
            accounts=[
                AccountMeta(payer, True, True),             # payer (signer, writable)
                AccountMeta(ata, False, True),              # associated token account (writable)
                AccountMeta(owner, False, False),           # wallet address
                AccountMeta(mint, False, False),            # token mint
                AccountMeta(Pubkey.from_string('11111111111111111111111111111111'), False, False),  # system program
                AccountMeta(TOKEN_PROGRAM_ID, False, False),  # token program
            ],
            data=bytes([]),
        )

    def build_sponsored_usdc_transfer(
        self,
        user_wallet: str,
        recipient_wallet: str,
        amount: Decimal,
    ) -> Dict[str, Any]:
        """
        Build a VersionedTransaction where platform pays fees.

        Args:
            user_wallet: User's wallet address (token authority)
            recipient_wallet: Recipient's wallet address (platform for purchases)
            amount: USDC amount to transfer

        Returns:
            Dict containing:
            - serialized_transaction: Base64 encoded transaction (unsigned)
            - blockhash: Recent blockhash used
            - user_pubkey: User's pubkey (for verification)
            - platform_pubkey: Platform's pubkey (fee payer)
        """
        try:
            user_pubkey = Pubkey.from_string(user_wallet)
            recipient_pubkey = Pubkey.from_string(recipient_wallet)
            usdc_mint_pubkey = Pubkey.from_string(self.usdc_mint)

            # Get ATAs
            user_ata = self._get_associated_token_address(user_pubkey, usdc_mint_pubkey)
            recipient_ata = self._get_associated_token_address(recipient_pubkey, usdc_mint_pubkey)

            # Build instructions
            instructions = []

            # Check if recipient ATA exists
            recipient_ata_info = self.client.get_account_info(recipient_ata, commitment=Confirmed)
            if recipient_ata_info.value is None:
                # Create ATA for recipient (platform pays)
                instructions.append(
                    self._create_ata_instruction(
                        payer=self.platform_pubkey,
                        ata=recipient_ata,
                        owner=recipient_pubkey,
                        mint=usdc_mint_pubkey,
                    )
                )

            # Convert amount to token units
            amount_units = int(amount * Decimal(10 ** USDC_DECIMALS))

            # Add transfer instruction
            instructions.append(
                self._create_transfer_instruction(
                    source_ata=user_ata,
                    destination_ata=recipient_ata,
                    owner=user_pubkey,  # User is the authority
                    amount=amount_units,
                )
            )

            # Get recent blockhash
            blockhash_response = self.client.get_latest_blockhash(commitment=Confirmed)
            blockhash = blockhash_response.value.blockhash

            # Build MessageV0 with platform as fee payer
            message = MessageV0.try_compile(
                payer=self.platform_pubkey,  # Platform pays fees
                instructions=instructions,
                address_lookup_table_accounts=[],
                recent_blockhash=blockhash,
            )

            # Create a VersionedTransaction with placeholder signatures
            # The transaction needs 2 signatures: platform (fee payer) and user (token authority)
            # We use zero bytes as placeholders - frontend will sign and fill in user's signature
            placeholder_sig = Signature.default()  # 64 zero bytes
            placeholder_signatures = [placeholder_sig, placeholder_sig]  # [platform, user]

            unsigned_tx = VersionedTransaction.populate(message, placeholder_signatures)
            tx_bytes = bytes(unsigned_tx)

            return {
                'serialized_transaction': base64.b64encode(tx_bytes).decode('utf-8'),
                'serialized_message': base64.b64encode(bytes(message)).decode('utf-8'),
                'blockhash': str(blockhash),
                'user_pubkey': user_wallet,
                'platform_pubkey': str(self.platform_pubkey),
                'amount': str(amount),
                'recipient': recipient_wallet,
            }

        except Exception as e:
            logger.error(f"Error building sponsored transaction: {e}")
            raise

    def submit_with_platform_signature(
        self,
        serialized_message: str,
        user_signature: str,
    ) -> str:
        """
        Add platform signature and submit the transaction.

        Args:
            serialized_message: Base64 encoded message from build step
            user_signature: Base64 encoded user signature

        Returns:
            Transaction signature string
        """
        try:
            # Decode the message
            message_bytes = base64.b64decode(serialized_message)
            message = MessageV0.from_bytes(message_bytes)

            # Decode user signature
            user_sig_bytes = base64.b64decode(user_signature)
            user_sig = Signature.from_bytes(user_sig_bytes)

            # Platform signs the message
            platform_sig = self.platform_keypair.sign_message(message_bytes)

            # Create transaction with pre-computed signatures using populate()
            # Order matters: fee payer signature first, then other signers
            signatures = [platform_sig, user_sig]

            signed_tx = VersionedTransaction.populate(message, signatures)

            # Submit transaction
            response = self.client.send_transaction(
                signed_tx,
                opts=TxOpts(skip_preflight=False, preflight_commitment=Confirmed)
            )

            if response.value is None:
                raise Exception("Transaction submission failed - no response")

            signature = str(response.value)
            logger.info(f"Submitted sponsored transaction: {signature}")

            return signature

        except Exception as e:
            logger.error(f"Error submitting sponsored transaction: {e}")
            raise

    def submit_user_signed_transaction(
        self,
        signed_transaction: str,
        user_signature_index: int,
    ) -> str:
        """
        Add platform signature to a user-signed transaction and submit.

        Args:
            signed_transaction: Base64 encoded transaction with user's signature
            user_signature_index: Index of the user's signature in the signatures array

        Returns:
            Transaction signature string
        """
        try:
            # Decode the user-signed transaction
            tx_bytes = base64.b64decode(signed_transaction)
            user_signed_tx = VersionedTransaction.from_bytes(tx_bytes)

            # Extract the message and user's signature
            message = user_signed_tx.message
            user_sig = user_signed_tx.signatures[user_signature_index]

            # Extract message bytes directly from transaction bytes
            # VersionedTransaction format: [num_sigs (1 byte)][signatures (N*64 bytes)][message bytes]
            num_signatures = tx_bytes[0]
            signature_section_size = 1 + (num_signatures * 64)  # 1 byte for count + signatures
            message_bytes = tx_bytes[signature_section_size:]

            # Platform signs the exact same message bytes that the user signed
            platform_sig = self.platform_keypair.sign_message(message_bytes)

            # Build new signatures array with platform signature at index 0
            # and user signature at the user's index
            num_sigs = len(user_signed_tx.signatures)
            signatures = [Signature.default()] * num_sigs  # Start with placeholders
            signatures[0] = platform_sig  # Platform is always fee payer (index 0)
            signatures[user_signature_index] = user_sig  # User's signature

            # Create the fully signed transaction
            fully_signed_tx = VersionedTransaction.populate(message, signatures)

            # Submit transaction
            response = self.client.send_transaction(
                fully_signed_tx,
                opts=TxOpts(skip_preflight=False, preflight_commitment=Confirmed)
            )

            if response.value is None:
                raise Exception("Transaction submission failed - no response")

            signature = str(response.value)
            logger.info(f"Submitted sponsored transaction: {signature}")

            return signature

        except Exception as e:
            logger.error(f"Error submitting user-signed transaction: {e}")
            raise

    def confirm_transaction(self, signature: str, max_wait_seconds: int = 30) -> bool:
        """
        Wait for transaction confirmation.

        Args:
            signature: Transaction signature to confirm
            max_wait_seconds: Maximum time to wait

        Returns:
            True if confirmed, False otherwise
        """
        import time

        try:
            sig = Signature.from_string(signature)
            start_time = time.time()

            while time.time() - start_time < max_wait_seconds:
                response = self.client.get_signature_statuses([sig])

                if response.value and response.value[0]:
                    status = response.value[0]
                    if status.confirmation_status in ['confirmed', 'finalized']:
                        return True
                    if status.err:
                        logger.error(f"Transaction {signature} failed: {status.err}")
                        return False

                time.sleep(1)

            logger.warning(f"Transaction {signature} not confirmed within {max_wait_seconds}s")
            return False

        except Exception as e:
            logger.error(f"Error confirming transaction {signature}: {e}")
            return False

    def get_platform_sol_balance(self) -> Decimal:
        """Get platform wallet SOL balance."""
        try:
            response = self.client.get_balance(self.platform_pubkey, commitment=Confirmed)
            lamports = response.value
            return Decimal(lamports) / Decimal(10 ** 9)  # Convert lamports to SOL
        except Exception as e:
            logger.error(f"Error getting platform SOL balance: {e}")
            raise


# Singleton instance
_sponsored_service: Optional[SponsoredTransactionService] = None


def get_sponsored_transaction_service() -> SponsoredTransactionService:
    """Get or create the sponsored transaction service singleton."""
    global _sponsored_service
    if _sponsored_service is None:
        _sponsored_service = SponsoredTransactionService()
    return _sponsored_service
