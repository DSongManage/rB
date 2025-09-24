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



