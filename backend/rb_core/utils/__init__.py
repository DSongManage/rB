"""
Utility modules for rb_core.

- web3auth: Web3Auth JWT verification and wallet extraction
- solana_integration: Solana blockchain integration for NFT minting
"""

# Import Web3Auth utilities
from .web3auth import (
    verify_web3auth_jwt,
    extract_wallet_from_claims,
    calculate_fees,
    Web3AuthVerificationError,
    WEB3AUTH_JWKS_URL,
)

# Import Solana integration functions
from .solana_integration import (
    mint_collaborative_nft,
    mint_single_creator_nft,
    get_platform_fee_account,
    validate_creator_splits,
)

__all__ = [
    # Web3Auth utilities
    'verify_web3auth_jwt',
    'extract_wallet_from_claims',
    'calculate_fees',
    'Web3AuthVerificationError',
    'WEB3AUTH_JWKS_URL',
    # Solana integration
    'mint_collaborative_nft',
    'mint_single_creator_nft',
    'get_platform_fee_account',
    'validate_creator_splits',
]
