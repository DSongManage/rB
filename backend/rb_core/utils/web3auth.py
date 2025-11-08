from __future__ import annotations

import json
from typing import Any, Dict, Optional

import requests
from django.conf import settings

try:
    import jwt
    from jwt import PyJWKClient
except Exception:  # pragma: no cover - handled at runtime if missing
    jwt = None
    PyJWKClient = None


WEB3AUTH_JWKS_URL = getattr(settings, 'WEB3AUTH_JWKS_URL', 'https://api.openlogin.com/jwks')


class Web3AuthVerificationError(Exception):
    pass


def verify_web3auth_jwt(id_token: str) -> Dict[str, Any]:
    """Verify Web3Auth/OpenLogin JWT and return claims.

    - Uses JWKS from Web3Auth to validate signature
    - Enforces `aud` matching WEB3AUTH_CLIENT_ID when present
    - Raises Web3AuthVerificationError on failure
    """
    if not jwt or not PyJWKClient:
        raise Web3AuthVerificationError('pyjwt not available on server')

    jwk_client = PyJWKClient(WEB3AUTH_JWKS_URL)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=getattr(settings, 'WEB3AUTH_CLIENT_ID', None),
            options={"verify_aud": bool(getattr(settings, 'WEB3AUTH_CLIENT_ID', None))},
        )
    except Exception as exc:  # broad by design to surface message to client
        raise Web3AuthVerificationError(str(exc))

    return claims


def extract_wallet_from_claims(claims: Dict[str, Any]) -> Optional[str]:
    """Best-effort extraction of Solana wallet address from Web3Auth claims.

    Expected shape (may vary):
    {
      ...,
      "wallets": [{"type": "solana", "public_address": "..."}, ...]
    }
    """
    wallets = claims.get('wallets') or []
    if isinstance(wallets, list):
        for w in wallets:
            try:
                # Preferred direct address field
                if w.get('public_address'):
                    return str(w['public_address'])[:44]
                # Derive from ed25519 public_key hex (Solana)
                pk_hex = (w.get('public_key') or '').strip()
                curve = (w.get('curve') or '').lower()
                if curve == 'ed25519' and len(pk_hex) >= 64:
                    try:
                        import base58  # type: ignore
                        pk_bytes = bytes.fromhex(pk_hex[:64])
                        return base58.b58encode(pk_bytes).decode('utf-8')[:44]
                    except Exception:
                        pass
            except Exception:
                continue
    # Some providers place the address at `wallet` or `public_address`
    addr = claims.get('public_address') or claims.get('wallet')
    return (addr or '')[:44] if addr else None


def calculate_fees(price: float) -> Dict[str, float]:
    """Calculate Stripe and platform fees for a given price.

    Stripe Micropayments pricing: 5% + $0.05
    Platform fees (tiered):
    - Under $10: 15%
    - $10-$50: 12%
    - Over $50: 10%

    Returns dict with:
    - stripe_fee: Stripe processing fee
    - platform_fee: Platform fee
    - creator_gets: Net amount to creator
    """
    from decimal import Decimal, ROUND_HALF_UP

    price_decimal = Decimal(str(price))

    # Stripe Micropayments: 5% + $0.05
    stripe_fee = (price_decimal * Decimal('0.05') + Decimal('0.05')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Tiered platform fees
    if price < 10:
        platform_fee_rate = Decimal('0.15')  # 15%
    elif price < 50:
        platform_fee_rate = Decimal('0.12')  # 12%
    else:
        platform_fee_rate = Decimal('0.10')  # 10%

    platform_fee = (price_decimal * platform_fee_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Creator gets the rest
    creator_gets = (price_decimal - stripe_fee - platform_fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return {
        'stripe_fee': float(stripe_fee),
        'platform_fee': float(platform_fee),
        'creator_gets': float(creator_gets),
    }

