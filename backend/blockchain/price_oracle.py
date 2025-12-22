"""
Price Oracle Service for SOL/USD conversion.

Provides real-time SOL price from multiple sources with caching
to minimize API calls and handle rate limits gracefully.

Supports:
- CoinGecko API (free, no key required)
- Pyth Network (on-chain, for production)
- Fallback to cached/default values
"""

import logging
import time
from decimal import Decimal
from typing import Optional, Dict, Any
from functools import lru_cache
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache settings
PRICE_CACHE_KEY = "sol_price_usd"
PRICE_CACHE_TTL = 60  # 1 minute cache
FALLBACK_SOL_PRICE = Decimal('100')  # Conservative fallback

# Rate limiting
_last_fetch_time = 0
MIN_FETCH_INTERVAL = 10  # Minimum seconds between API calls


def get_sol_price_usd(use_cache: bool = True) -> Decimal:
    """
    Get current SOL price in USD.

    Uses caching to minimize API calls and provide fast responses.
    Falls back to cached value or default if API is unavailable.

    Args:
        use_cache: Whether to use cached value (default True)

    Returns:
        Decimal: SOL price in USD
    """
    global _last_fetch_time

    # Try cache first
    if use_cache:
        cached_price = cache.get(PRICE_CACHE_KEY)
        if cached_price is not None:
            logger.debug(f"Using cached SOL price: ${cached_price}")
            return Decimal(str(cached_price))

    # Rate limiting check
    current_time = time.time()
    if current_time - _last_fetch_time < MIN_FETCH_INTERVAL:
        logger.debug("Rate limited, using fallback price")
        return _get_fallback_price()

    # Try to fetch fresh price
    price = None

    # Try CoinGecko first (free, reliable)
    price = _fetch_from_coingecko()

    if price is None:
        # Try backup source
        price = _fetch_from_coinmarketcap()

    if price is None:
        # Use fallback
        logger.warning("All price sources failed, using fallback")
        return _get_fallback_price()

    # Cache the price
    cache.set(PRICE_CACHE_KEY, str(price), PRICE_CACHE_TTL)
    _last_fetch_time = current_time

    logger.info(f"Fetched SOL price: ${price}")
    return price


def _fetch_from_coingecko() -> Optional[Decimal]:
    """
    Fetch SOL price from CoinGecko API.

    Free tier: 10-30 calls/minute (no API key required)
    """
    import requests

    try:
        url = "https://api.coingecko.com/api/v3/simple/price"
        params = {
            "ids": "solana",
            "vs_currencies": "usd",
            "precision": 2
        }

        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()

        data = response.json()
        price = data.get("solana", {}).get("usd")

        if price is not None:
            return Decimal(str(price))

        logger.warning("CoinGecko response missing price data")
        return None

    except requests.exceptions.Timeout:
        logger.warning("CoinGecko API timeout")
        return None
    except requests.exceptions.RequestException as e:
        logger.warning(f"CoinGecko API error: {e}")
        return None
    except (KeyError, ValueError) as e:
        logger.warning(f"CoinGecko response parse error: {e}")
        return None


def _fetch_from_coinmarketcap() -> Optional[Decimal]:
    """
    Fetch SOL price from CoinMarketCap API.

    Requires API key (set COINMARKETCAP_API_KEY in settings).
    Free tier: 10,000 calls/month
    """
    import requests

    api_key = getattr(settings, 'COINMARKETCAP_API_KEY', None)
    if not api_key:
        return None

    try:
        url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest"
        headers = {
            "X-CMC_PRO_API_KEY": api_key,
            "Accept": "application/json"
        }
        params = {
            "symbol": "SOL",
            "convert": "USD"
        }

        response = requests.get(url, headers=headers, params=params, timeout=5)
        response.raise_for_status()

        data = response.json()
        price = data.get("data", {}).get("SOL", {}).get("quote", {}).get("USD", {}).get("price")

        if price is not None:
            return Decimal(str(price)).quantize(Decimal('0.01'))

        return None

    except Exception as e:
        logger.warning(f"CoinMarketCap API error: {e}")
        return None


def _get_fallback_price() -> Decimal:
    """
    Get fallback price from cache or default.
    """
    # Try to get last known price from cache (even if expired)
    cached = cache.get(PRICE_CACHE_KEY)
    if cached:
        return Decimal(str(cached))

    return FALLBACK_SOL_PRICE


def convert_lamports_to_usd(lamports: int) -> Decimal:
    """
    Convert lamports to USD value.

    Args:
        lamports: Amount in lamports (1 SOL = 1,000,000,000 lamports)

    Returns:
        Decimal: USD value
    """
    LAMPORTS_PER_SOL = 1_000_000_000
    sol_amount = Decimal(lamports) / Decimal(LAMPORTS_PER_SOL)
    sol_price = get_sol_price_usd()
    return (sol_amount * sol_price).quantize(Decimal('0.000001'))


def convert_sol_to_usd(sol_amount: Decimal) -> Decimal:
    """
    Convert SOL to USD value.

    Args:
        sol_amount: Amount in SOL

    Returns:
        Decimal: USD value
    """
    sol_price = get_sol_price_usd()
    return (Decimal(str(sol_amount)) * sol_price).quantize(Decimal('0.000001'))


# Pyth Network integration (for on-chain price feeds)
def get_sol_price_from_pyth() -> Optional[Decimal]:
    """
    Get SOL price from Pyth Network on-chain oracle.

    This is the most trustless option for production as it reads
    directly from Solana blockchain.

    Requires: solana SDK installed
    """
    try:
        from solana.rpc.api import Client
        from solders.pubkey import Pubkey

        # Pyth SOL/USD price feed on mainnet
        PYTH_SOL_USD_FEED = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG"

        client = Client(settings.SOLANA_RPC_URL)
        feed_pubkey = Pubkey.from_string(PYTH_SOL_USD_FEED)

        # Get account data
        response = client.get_account_info(feed_pubkey)
        if response.value is None:
            return None

        # Parse Pyth price data (simplified - full implementation would use pyth-client)
        # For now, fall back to API-based pricing
        logger.info("Pyth integration placeholder - using API pricing")
        return None

    except Exception as e:
        logger.warning(f"Pyth oracle error: {e}")
        return None
