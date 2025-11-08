"""
Solana blockchain integration for NFT minting.

Handles both single-creator and multi-creator collaborative NFT minting
with automatic revenue splitting on the Solana blockchain.
"""

import json
import logging
from decimal import Decimal
from typing import List, Dict, Optional, Any

from django.conf import settings

logger = logging.getLogger(__name__)


class SolanaIntegrationError(Exception):
    """Base exception for Solana integration errors."""
    pass


class InvalidCreatorSplitsError(SolanaIntegrationError):
    """Exception raised when creator splits are invalid."""
    pass


class MissingWalletAddressError(SolanaIntegrationError):
    """Exception raised when required wallet addresses are missing."""
    pass


def validate_creator_splits(creator_splits: List[Dict]) -> None:
    """
    Validate that creator splits are properly formatted and total 100%.

    Args:
        creator_splits: List of dicts with 'user_id', 'wallet_address', 'percentage'

    Raises:
        InvalidCreatorSplitsError: If splits are invalid
        MissingWalletAddressError: If wallet addresses are missing
    """
    if not creator_splits:
        raise InvalidCreatorSplitsError("At least one creator is required")

    if len(creator_splits) > 10:
        raise InvalidCreatorSplitsError("Maximum 10 creators allowed per NFT")

    # Validate each split
    for split in creator_splits:
        if not split.get('wallet_address'):
            raise MissingWalletAddressError(
                f"User {split.get('user_id')} is missing a wallet address"
            )

        percentage = split.get('percentage', 0)
        if not isinstance(percentage, (int, float, Decimal)):
            raise InvalidCreatorSplitsError(
                f"Invalid percentage type for user {split.get('user_id')}"
            )

        if percentage <= 0 or percentage >= 100:
            raise InvalidCreatorSplitsError(
                f"Creator percentage must be between 1 and 99, got {percentage}"
            )

    # Validate total percentage
    total_percentage = sum(
        float(split['percentage']) for split in creator_splits
    )

    if abs(total_percentage - 100.0) > 0.01:  # Allow small floating point errors
        raise InvalidCreatorSplitsError(
            f"Creator splits must total 100%, got {total_percentage}%"
        )


def get_platform_fee_account() -> str:
    """
    Return the platform's fee collection wallet address.

    This should be a secure platform wallet configured in settings.
    """
    platform_wallet = getattr(
        settings,
        'SOLANA_PLATFORM_WALLET',
        None
    )

    if not platform_wallet:
        logger.warning("SOLANA_PLATFORM_WALLET not configured in settings")
        # Return configured platform wallet for development
        return "C2WmvJjJgEWR84876nHCchUvAdC3Co3RMY42a7nAq3Rk"

    return platform_wallet


def convert_usd_to_lamports(usd_amount: Decimal) -> int:
    """
    Convert USD amount to Solana lamports.

    Args:
        usd_amount: Price in USD

    Returns:
        Amount in lamports (1 SOL = 1,000,000,000 lamports)

    Note:
        In production, this should fetch real-time SOL/USD price from an oracle.
        Currently uses a fixed rate for testing.
    """
    # TODO: Integrate with price oracle (Pyth, Chainlink, etc.)
    sol_price_usd = Decimal(getattr(settings, 'SOL_PRICE_USD', '100.00'))

    sol_amount = usd_amount / sol_price_usd
    lamports = int(sol_amount * Decimal('1000000000'))

    logger.info(
        f"Converted ${usd_amount} USD to {lamports} lamports "
        f"(${sol_price_usd}/SOL)"
    )

    return lamports


def mint_collaborative_nft(
    project_id: int,
    sale_amount_usd: Decimal,
    creator_splits: List[Dict],
    metadata_uri: str,
    title: str,
    buyer_wallet: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Mint collaborative NFT with automatic revenue splitting among multiple creators.

    Args:
        project_id: ID of the collaborative project
        sale_amount_usd: Sale price in USD
        creator_splits: List of creator split data:
            [
                {
                    'user_id': 1,
                    'wallet_address': 'SolanaPublicKey...',
                    'percentage': 70
                },
                ...
            ]
        metadata_uri: URI to NFT metadata (Arweave, IPFS, etc.)
        title: NFT title
        buyer_wallet: Optional buyer wallet address

    Returns:
        Dict with transaction details:
        {
            'success': True,
            'transaction_signature': 'abc123...',
            'sale_amount_lamports': 1000000000,
            'platform_fee_lamports': 100000000,
            'creator_splits': [...],
            'mint_address': 'MintPublicKey...',
        }

    Raises:
        InvalidCreatorSplitsError: If creator splits are invalid
        MissingWalletAddressError: If wallet addresses are missing
        SolanaIntegrationError: For other integration errors
    """
    try:
        # Validate creator splits
        validate_creator_splits(creator_splits)

        # Convert USD to lamports
        lamports = convert_usd_to_lamports(sale_amount_usd)

        # Calculate platform fee (10%)
        platform_fee_lamports = lamports // 10
        remaining_lamports = lamports - platform_fee_lamports

        # Prepare creator splits for smart contract
        contract_splits = []
        for split in creator_splits:
            # Convert percentage to integer (smart contract expects u8)
            percentage_int = int(round(float(split['percentage'])))

            contract_splits.append({
                'creator_pubkey': split['wallet_address'],
                'percentage': percentage_int,
            })

        logger.info(
            f"Minting collaborative NFT for project {project_id}: "
            f"{len(creator_splits)} creators, {lamports} lamports"
        )

        # TODO: Integrate with Solana program
        # This is a placeholder that logs the transaction details
        # In production, this should call the actual Solana program using
        # anchorpy or solana-py

        # Simulated response for development
        transaction_signature = f"mock_tx_{project_id}_collaborative"
        mint_address = f"mock_mint_{project_id}"

        logger.info(
            f"✅ Collaborative NFT minted successfully: "
            f"tx={transaction_signature}, mint={mint_address}"
        )

        return {
            'success': True,
            'transaction_signature': transaction_signature,
            'mint_address': mint_address,
            'sale_amount_lamports': lamports,
            'platform_fee_lamports': platform_fee_lamports,
            'remaining_lamports': remaining_lamports,
            'creator_splits': contract_splits,
            'num_creators': len(creator_splits),
            'metadata_uri': metadata_uri,
            'title': title,
        }

    except (InvalidCreatorSplitsError, MissingWalletAddressError) as e:
        logger.error(f"Creator split validation failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'creator_splits': creator_splits,
        }

    except Exception as e:
        logger.exception(f"Unexpected error minting collaborative NFT: {e}")
        return {
            'success': False,
            'error': str(e),
            'error_type': 'UnexpectedError',
            'creator_splits': creator_splits,
        }


def mint_single_creator_nft(
    content_id: int,
    sale_amount_usd: Decimal,
    creator_wallet: str,
    metadata_uri: str,
    title: str,
    buyer_wallet: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Mint NFT for a single creator.

    Args:
        content_id: ID of the content
        sale_amount_usd: Sale price in USD
        creator_wallet: Creator's Solana wallet address
        metadata_uri: URI to NFT metadata
        title: NFT title
        buyer_wallet: Optional buyer wallet address

    Returns:
        Dict with transaction details (same format as mint_collaborative_nft)

    Raises:
        MissingWalletAddressError: If wallet address is missing
        SolanaIntegrationError: For other integration errors
    """
    if not creator_wallet:
        raise MissingWalletAddressError("Creator wallet address is required")

    # Use collaborative minting with a single creator at 100%
    creator_splits = [{
        'user_id': content_id,  # Use content_id as placeholder
        'wallet_address': creator_wallet,
        'percentage': 100,
    }]

    return mint_collaborative_nft(
        project_id=content_id,
        sale_amount_usd=sale_amount_usd,
        creator_splits=creator_splits,
        metadata_uri=metadata_uri,
        title=title,
        buyer_wallet=buyer_wallet,
    )


def get_nft_metadata_uri(project_id: int, content_type: str) -> str:
    """
    Generate or retrieve metadata URI for NFT.

    In production, this should upload metadata to Arweave or IPFS.

    Args:
        project_id: Project ID
        content_type: Type of content (book, music, video, art)

    Returns:
        URI to metadata JSON
    """
    # TODO: Implement actual metadata upload to Arweave/IPFS
    # For now, return a placeholder
    return f"https://arweave.net/mock_{project_id}_{content_type}"


def check_transaction_status(transaction_signature: str) -> Dict[str, Any]:
    """
    Check the status of a Solana transaction.

    Args:
        transaction_signature: Transaction signature to check

    Returns:
        Dict with transaction status information
    """
    # TODO: Implement actual transaction status checking
    # using solana-py or web3.py

    return {
        'confirmed': True,
        'signature': transaction_signature,
        'slot': 123456,  # Mock slot number
        'confirmations': 32,  # Mock confirmation count
    }
