"""
OFAC (Office of Foreign Assets Control) Sanctions Screening Service

This service checks users against the OFAC SDN (Specially Designated Nationals) list
to ensure compliance with US sanctions regulations.

For production use, integrate with a professional OFAC screening API:
- ofac-api.com
- Chainalysis
- ComplyAdvantage
- Dow Jones Risk & Compliance

Usage:
    from rb_core.services.ofac_service import OFACScreeningService

    # Screen a user at signup
    result = OFACScreeningService.screen_user(
        full_name="John Doe",
        email="john@example.com",
        address="123 Main St",
        country="US"
    )

    if result['blocked']:
        # Reject the user
        pass
"""

import logging
import requests
import hashlib
from typing import Optional
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class OFACScreeningService:
    """
    Service for OFAC sanctions screening.

    Can operate in multiple modes:
    1. API Mode: Uses external OFAC API provider
    2. Basic Mode: Uses a local SDN list (less comprehensive)
    3. Disabled Mode: Returns allow-all (for development)
    """

    # Cache timeout for screening results (24 hours)
    CACHE_TIMEOUT = 86400

    @classmethod
    def is_enabled(cls) -> bool:
        """Check if OFAC screening is enabled."""
        return getattr(settings, 'OFAC_SCREENING_ENABLED', False)

    @classmethod
    def screen_user(
        cls,
        full_name: str,
        email: Optional[str] = None,
        address: Optional[str] = None,
        country: Optional[str] = None,
        wallet_address: Optional[str] = None,
    ) -> dict:
        """
        Screen a user against OFAC sanctions list.

        Args:
            full_name: User's full name
            email: User's email address (optional)
            address: User's physical address (optional)
            country: User's country code (optional)
            wallet_address: User's crypto wallet address (optional)

        Returns:
            dict with:
                - blocked: bool - True if user is on sanctions list
                - match_type: str - Type of match ('exact', 'fuzzy', 'wallet', None)
                - confidence: float - Match confidence (0.0-1.0)
                - details: str - Human-readable details
                - cached: bool - Whether result was from cache
        """
        if not cls.is_enabled():
            return {
                'blocked': False,
                'match_type': None,
                'confidence': 0.0,
                'details': 'OFAC screening disabled',
                'cached': False,
            }

        # Generate cache key
        cache_key = cls._get_cache_key(full_name, email, wallet_address)

        # Check cache first
        cached_result = cache.get(cache_key)
        if cached_result:
            cached_result['cached'] = True
            return cached_result

        # Perform screening
        api_url = getattr(settings, 'OFAC_API_URL', '')
        api_key = getattr(settings, 'OFAC_API_KEY', '')

        if api_url and api_key:
            result = cls._screen_via_api(
                full_name, email, address, country, wallet_address,
                api_url, api_key
            )
        else:
            # Fallback to basic screening (wallet addresses only)
            result = cls._screen_basic(full_name, wallet_address)

        # Cache result
        result['cached'] = False
        cache.set(cache_key, result, cls.CACHE_TIMEOUT)

        # Log screening (without PII in production)
        if result['blocked']:
            logger.warning(
                f"OFAC screening blocked user: match_type={result['match_type']}, "
                f"confidence={result['confidence']}"
            )

        return result

    @classmethod
    def screen_wallet(cls, wallet_address: str) -> dict:
        """
        Screen a wallet address against OFAC sanctions list.

        This is useful for checking crypto wallets specifically.

        Args:
            wallet_address: The crypto wallet address to screen

        Returns:
            dict with screening result
        """
        if not cls.is_enabled():
            return {
                'blocked': False,
                'match_type': None,
                'confidence': 0.0,
                'details': 'OFAC screening disabled',
                'cached': False,
            }

        cache_key = f"ofac:wallet:{wallet_address}"
        cached_result = cache.get(cache_key)
        if cached_result:
            cached_result['cached'] = True
            return cached_result

        # Check against known sanctioned wallets
        result = cls._check_sanctioned_wallets(wallet_address)

        result['cached'] = False
        cache.set(cache_key, result, cls.CACHE_TIMEOUT)

        return result

    @classmethod
    def _screen_via_api(
        cls,
        full_name: str,
        email: Optional[str],
        address: Optional[str],
        country: Optional[str],
        wallet_address: Optional[str],
        api_url: str,
        api_key: str,
    ) -> dict:
        """Screen via external OFAC API provider."""
        try:
            payload = {
                'name': full_name,
            }
            if email:
                payload['email'] = email
            if address:
                payload['address'] = address
            if country:
                payload['country'] = country
            if wallet_address:
                payload['crypto_address'] = wallet_address

            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            }

            response = requests.post(
                f"{api_url}/screen",
                json=payload,
                headers=headers,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    'blocked': data.get('match', False),
                    'match_type': data.get('match_type'),
                    'confidence': data.get('confidence', 0.0),
                    'details': data.get('details', ''),
                }
            else:
                logger.error(f"OFAC API error: {response.status_code}")
                # Fail-open: allow access but log error
                return {
                    'blocked': False,
                    'match_type': None,
                    'confidence': 0.0,
                    'details': f'API error: {response.status_code}',
                }

        except requests.exceptions.Timeout:
            logger.error("OFAC API timeout")
            return {
                'blocked': False,
                'match_type': None,
                'confidence': 0.0,
                'details': 'API timeout',
            }
        except Exception as e:
            logger.error(f"OFAC API exception: {e}")
            return {
                'blocked': False,
                'match_type': None,
                'confidence': 0.0,
                'details': f'API error: {str(e)}',
            }

    @classmethod
    def _screen_basic(cls, full_name: str, wallet_address: Optional[str]) -> dict:
        """
        Basic screening without external API.

        This only checks wallet addresses against a known list of sanctioned wallets.
        For production, use a proper OFAC API.
        """
        if wallet_address:
            wallet_result = cls._check_sanctioned_wallets(wallet_address)
            if wallet_result['blocked']:
                return wallet_result

        return {
            'blocked': False,
            'match_type': None,
            'confidence': 0.0,
            'details': 'Basic screening passed (API not configured)',
        }

    @classmethod
    def _check_sanctioned_wallets(cls, wallet_address: str) -> dict:
        """
        Check wallet against known OFAC-sanctioned crypto addresses.

        This is a subset of addresses from the OFAC SDN list.
        For production, use a professional screening service that maintains
        an up-to-date list.

        Source: https://www.treasury.gov/ofac/downloads/sdnlist.txt
        """
        # Known OFAC-sanctioned Solana/Ethereum addresses (sample)
        # These should be updated regularly from official OFAC sources
        SANCTIONED_WALLETS = {
            # Tornado Cash related (Ethereum)
            '0x8589427373d6d84e98730d7795d8f6f8731fda16',
            '0x722122df12d4e14e13ac3b6895a86e84145b6967',
            '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',
            '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
            '0xd96f2b1c14db8458374d9aca76e26c3d18364307',
            # Add more as needed from OFAC updates
        }

        # Normalize address for comparison
        normalized = wallet_address.lower().strip()

        if normalized in SANCTIONED_WALLETS:
            return {
                'blocked': True,
                'match_type': 'wallet',
                'confidence': 1.0,
                'details': 'Wallet address matches OFAC sanctions list',
            }

        return {
            'blocked': False,
            'match_type': None,
            'confidence': 0.0,
            'details': 'Wallet not on sanctions list',
        }

    @classmethod
    def _get_cache_key(
        cls,
        full_name: str,
        email: Optional[str],
        wallet_address: Optional[str]
    ) -> str:
        """Generate a cache key for screening results."""
        data = f"{full_name}:{email or ''}:{wallet_address or ''}"
        hash_val = hashlib.sha256(data.encode()).hexdigest()[:16]
        return f"ofac:screen:{hash_val}"


def check_user_sanctions(user) -> dict:
    """
    Convenience function to screen a Django user model.

    Args:
        user: Django User instance with profile

    Returns:
        OFAC screening result dict
    """
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    email = user.email

    wallet_address = None
    try:
        if hasattr(user, 'profile') and user.profile.wallet_address:
            wallet_address = user.profile.wallet_address
    except Exception:
        pass

    return OFACScreeningService.screen_user(
        full_name=full_name,
        email=email,
        wallet_address=wallet_address,
    )
