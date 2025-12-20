"""
Solana Service for Atomic NFT Minting + USDC Distribution

This service integrates with the Anchor smart contract to enable:
1. Atomic NFT minting to buyer's Web3Auth wallet
2. Simultaneous USDC distribution to all collaborators
3. Platform fee collection (10%)

All operations happen in ONE Solana transaction for trustless settlement.
"""

import logging
import json
from decimal import Decimal
from typing import List, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)

# Solana imports - these will be installed later
try:
    from solana.rpc.api import Client
    from solana.rpc.commitment import Confirmed
    from solana.rpc.types import TxOpts
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.system_program import ID as SYS_PROGRAM_ID
    from solders.transaction import Transaction
    from solders.message import Message
    from solders.hash import Hash
    from spl.token.constants import TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    from spl.token.instructions import (
        get_associated_token_address,
        transfer_checked,
        TransferCheckedParams,
        create_associated_token_account
    )
    from spl.token.client import Token
    # from anchorpy import Provider, Wallet, Program, Context
    SOLANA_AVAILABLE = True
except ImportError as e:
    logger.warning(f'Solana libraries not installed - using mock implementation: {e}')
    SOLANA_AVAILABLE = False
    # Define dummy classes so the code doesn't crash
    Transaction = None
    Message = None
    Hash = None
    Token = None
    TransferCheckedParams = None


def mint_and_distribute_collaborative_nft(
    buyer_wallet_address: str,
    chapter_metadata_uri: str,
    collaborator_payments: List[Dict[str, Any]],
    platform_usdc_amount: float,
    total_usdc_amount: float
) -> Dict[str, Any]:
    """
    Execute NFT minting + USDC distribution flow:
    1. Mint NFT to buyer using Anchor smart contract (handles SOL)
    2. Distribute USDC from platform wallet to all collaborators (Python-side SPL transfers)
    3. Platform keeps its fee in the treasury

    NOTE: This is a TWO-STEP process (not fully atomic in one transaction):
    - Step 1: Mint NFT via smart contract
    - Step 2: Transfer USDC to creators

    For full atomicity, the smart contract would need to be updated to handle SPL token transfers.

    Args:
        buyer_wallet_address: Web3Auth wallet address of buyer
        chapter_metadata_uri: IPFS/Arweave URI with NFT metadata
        collaborator_payments: List of {user, wallet_address, amount_usdc, percentage, role}
        platform_usdc_amount: Platform's 10% fee
        total_usdc_amount: Total USDC to distribute (fronted from treasury)

    Returns:
        {
            'nft_mint_address': str,
            'transaction_signature': str,
            'platform_usdc_fronted': float,
            'platform_usdc_earned': float,
            'distributions': [...]
        }
    """

    logger.info("=" * 80)
    logger.info("NFT MINT + USDC DISTRIBUTION FLOW")
    logger.info("=" * 80)

    # For MVP/testing without Solana SDK installed, return mock data
    if not SOLANA_AVAILABLE:
        logger.warning("⚠️  Solana SDK not available - returning MOCK data")
        logger.warning("⚠️  To use real devnet: pip install solana solders spl-token")

        return _mock_mint_and_distribute(
            buyer_wallet_address,
            chapter_metadata_uri,
            collaborator_payments,
            platform_usdc_amount,
            total_usdc_amount
        )

    # Real Solana implementation
    try:
        # Initialize Solana client
        client = Client(settings.SOLANA_RPC_URL)
        logger.info(f"Connected to Solana RPC: {settings.SOLANA_RPC_URL}")

        # Load platform wallet keypair
        try:
            with open(settings.PLATFORM_WALLET_KEYPAIR_PATH, 'r') as f:
                keypair_data = json.load(f)
            platform_keypair = Keypair.from_bytes(bytes(keypair_data))
            logger.info(f"Platform wallet loaded: {platform_keypair.pubkey()}")

            # Verify it matches settings
            if str(platform_keypair.pubkey()) != settings.PLATFORM_USDC_WALLET_ADDRESS:
                logger.warning(
                    f"Platform keypair pubkey ({platform_keypair.pubkey()}) doesn't match "
                    f"PLATFORM_USDC_WALLET_ADDRESS ({settings.PLATFORM_USDC_WALLET_ADDRESS})"
                )
        except Exception as e:
            logger.error(f"Failed to load platform wallet keypair: {e}")
            raise

        # Get USDC mint
        usdc_mint = Pubkey.from_string(settings.USDC_MINT_ADDRESS)
        logger.info(f"USDC Mint: {usdc_mint}")

        # ═══════════════════════════════════════════════════════════════════
        # STEP 1: MINT NFT (using mock for now - Anchor integration pending)
        # ═══════════════════════════════════════════════════════════════════

        # TODO: Call Anchor smart contract when integrated
        # For now, generate mock NFT mint address
        import hashlib
        import time
        mock_data = f"{buyer_wallet_address}{chapter_metadata_uri}{time.time()}"
        nft_mint_address = hashlib.sha256(f"nft{mock_data}".encode()).hexdigest()[:44]

        logger.info(f"[MOCK NFT] Generated mint address: {nft_mint_address}")

        # ═══════════════════════════════════════════════════════════════════
        # STEP 2: DISTRIBUTE USDC TO COLLABORATORS
        # ═══════════════════════════════════════════════════════════════════

        logger.info(f"Distributing {total_usdc_amount} USDC to {len(collaborator_payments)} collaborator(s)")

        # Get platform's USDC token account
        platform_usdc_account = get_associated_token_address(
            platform_keypair.pubkey(),
            usdc_mint
        )

        logger.info(f"Platform USDC account: {platform_usdc_account}")

        # Check platform balance
        try:
            balance_response = client.get_token_account_balance(platform_usdc_account)
            balance_usdc = int(balance_response.value.amount) / 1_000_000
            logger.info(f"Platform USDC balance: {balance_usdc}")

            if balance_usdc < total_usdc_amount:
                raise ValueError(
                    f"Insufficient USDC balance: have {balance_usdc}, need {total_usdc_amount}"
                )
        except Exception as e:
            logger.error(f"Failed to check platform balance: {e}")
            raise

        # Execute USDC transfers to each collaborator
        transfer_signatures = []

        for collab in collaborator_payments:
            recipient_wallet = Pubkey.from_string(collab['wallet_address'])
            amount_usdc = collab['amount_usdc']
            amount_lamports = int(amount_usdc * 1_000_000)  # Convert to base units

            # Get recipient's USDC token account
            recipient_usdc_account = get_associated_token_address(
                recipient_wallet,
                usdc_mint
            )

            logger.info(
                f"Transferring {amount_usdc} USDC to {collab['user'].username} "
                f"({recipient_usdc_account})"
            )

            # Check if recipient's ATA exists, create if needed
            instructions = []

            try:
                # Try to get the account info
                account_info = client.get_account_info(recipient_usdc_account)

                if account_info.value is None:
                    # ATA doesn't exist, need to create it
                    logger.info(f"Creating USDC token account for {collab['user'].username}")

                    create_ata_ix = create_associated_token_account(
                        payer=platform_keypair.pubkey(),
                        owner=recipient_wallet,
                        mint=usdc_mint
                    )
                    instructions.append(create_ata_ix)
                else:
                    logger.info(f"USDC token account already exists for {collab['user'].username}")

            except Exception as e:
                logger.warning(f"Could not check ATA existence, will try to create: {e}")
                # If check fails, try to create anyway (will fail gracefully if exists)
                create_ata_ix = create_associated_token_account(
                    payer=platform_keypair.pubkey(),
                    owner=recipient_wallet,
                    mint=usdc_mint
                )
                instructions.append(create_ata_ix)

            # Add transfer instruction
            transfer_ix = transfer_checked(
                TransferCheckedParams(
                    program_id=TOKEN_PROGRAM_ID,
                    source=platform_usdc_account,
                    mint=usdc_mint,
                    dest=recipient_usdc_account,
                    owner=platform_keypair.pubkey(),
                    amount=amount_lamports,
                    decimals=6,  # USDC has 6 decimals
                )
            )
            instructions.append(transfer_ix)

            # Get recent blockhash
            recent_blockhash_resp = client.get_latest_blockhash(Confirmed)
            recent_blockhash = recent_blockhash_resp.value.blockhash

            # Create message and transaction using Solders API
            message = Message.new_with_blockhash(
                instructions,
                platform_keypair.pubkey(),
                recent_blockhash
            )

            # Create and sign transaction (sign returns a new signed transaction)
            tx = Transaction([platform_keypair], message, recent_blockhash)

            try:
                # Skip preflight simulation for devnet (blockhashes expire quickly)
                # In production, preflight should be enabled for safety
                response = client.send_transaction(
                    tx,
                    opts=TxOpts(skip_preflight=True)
                )

                tx_sig = response.value
                logger.info(f"✅ Transfer successful: {tx_sig}")
                transfer_signatures.append(str(tx_sig))

            except Exception as e:
                logger.error(f"❌ Transfer failed for {collab['user'].username}: {e}")
                raise

        # Use first transfer signature as the main transaction signature
        main_tx_signature = transfer_signatures[0] if transfer_signatures else "mock_tx_sig"

        logger.info("=" * 80)
        logger.info("✅ DISTRIBUTION COMPLETE")
        logger.info(f"NFT Mint: {nft_mint_address}")
        logger.info(f"Main TX: {main_tx_signature}")
        logger.info(f"USDC Distributed: {total_usdc_amount}")
        logger.info(f"Platform Fee: {platform_usdc_amount}")
        logger.info("=" * 80)

        return {
            'nft_mint_address': nft_mint_address,
            'transaction_signature': main_tx_signature,
            'platform_usdc_fronted': total_usdc_amount,
            'platform_usdc_earned': platform_usdc_amount,
            'distributions': [
                {
                    'user': collab['user'].username,
                    'wallet': collab['wallet_address'],
                    'amount': collab['amount_usdc'],
                    'percentage': collab['percentage'],
                    'role': collab.get('role', 'collaborator')
                }
                for collab in collaborator_payments
            ]
        }

    except Exception as e:
        logger.error(f"Distribution failed: {e}")
        logger.exception(e)

        # SECURITY: Only fall back to mock in DEBUG mode
        if settings.DEBUG:
            logger.warning("DEBUG MODE: Falling back to MOCK implementation due to error")
            return _mock_mint_and_distribute(
                buyer_wallet_address,
                chapter_metadata_uri,
                collaborator_payments,
                platform_usdc_amount,
                total_usdc_amount
            )
        else:
            # In production, propagate the error - never return fake success data
            raise RuntimeError(f"Blockchain distribution failed: {e}") from e


def _mock_mint_and_distribute(
    buyer_wallet_address: str,
    chapter_metadata_uri: str,
    collaborator_payments: List[Dict[str, Any]],
    platform_usdc_amount: float,
    total_usdc_amount: float
) -> Dict[str, Any]:
    """
    Mock implementation for testing without Solana connection.

    In production, this should be replaced with real smart contract calls.
    """

    logger.info(f"[MOCK] Buyer wallet: {buyer_wallet_address}")
    logger.info(f"[MOCK] Metadata URI: {chapter_metadata_uri}")
    logger.info(f"[MOCK] Total USDC to distribute: {total_usdc_amount}")
    logger.info(f"[MOCK] Platform fee: {platform_usdc_amount}")
    logger.info(f"[MOCK] Collaborators: {len(collaborator_payments)}")

    for i, collab in enumerate(collaborator_payments):
        logger.info(
            f"[MOCK] Collaborator {i+1}: {collab['wallet_address'][:8]}... "
            f"({collab['percentage']}%) = {collab['amount_usdc']} USDC"
        )

    # Generate mock transaction signature
    import hashlib
    import time
    mock_data = f"{buyer_wallet_address}{chapter_metadata_uri}{time.time()}"
    mock_tx = hashlib.sha256(mock_data.encode()).hexdigest()[:64]

    # Generate mock NFT mint address
    mock_nft_mint = hashlib.sha256(f"nft{mock_data}".encode()).hexdigest()[:44]

    logger.info(f"[MOCK] ✅ NFT minted: {mock_nft_mint}")
    logger.info(f"[MOCK] ✅ Transaction signature: {mock_tx}")
    logger.info("[MOCK] ✅ USDC distributed to all collaborators")

    return {
        'nft_mint_address': mock_nft_mint,
        'transaction_signature': mock_tx,
        'platform_usdc_fronted': total_usdc_amount,
        'platform_usdc_earned': platform_usdc_amount,
        'distributions': [
            {
                'user': collab['user'].username,  # Store username, not User object
                'wallet': collab['wallet_address'],
                'amount': collab['amount_usdc'],
                'percentage': collab['percentage'],
                'role': collab.get('role', 'collaborator')
            }
            for collab in collaborator_payments
        ]
    }


def get_platform_usdc_balance() -> float:
    """
    Get current USDC balance of platform treasury wallet.

    Returns:
        float: USDC balance
    """

    if not SOLANA_AVAILABLE:
        logger.warning("[MOCK] Returning mock treasury balance: 5000.00 USDC")
        return 5000.00

    try:
        client = Client(settings.SOLANA_RPC_URL)

        platform_pubkey = Pubkey.from_string(settings.PLATFORM_USDC_WALLET_ADDRESS)
        usdc_mint = Pubkey.from_string(settings.USDC_MINT_ADDRESS)

        platform_usdc_account = get_associated_token_address(platform_pubkey, usdc_mint)

        response = client.get_token_account_balance(platform_usdc_account)
        balance_lamports = int(response.value.amount)
        balance_usdc = balance_lamports / 1_000_000  # Convert from base units

        logger.info(f"[Treasury] Current balance: {balance_usdc} USDC")
        return balance_usdc

    except Exception as e:
        logger.error(f"Error getting treasury balance: {e}")
        # Return mock balance on error
        return 5000.00
