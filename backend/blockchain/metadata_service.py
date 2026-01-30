"""
NFT Metadata Service for IPFS upload and management.

Handles:
- Creating NFT metadata JSON following Metaplex standard
- Uploading to IPFS via Pinata
- Caching metadata URIs to avoid duplicate uploads
- Fallback to Arweave-compatible format

Metaplex NFT Standard: https://docs.metaplex.com/programs/token-metadata/token-standard
"""

import logging
import json
import hashlib
import time
from typing import Dict, Any, Optional, List
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache settings
METADATA_CACHE_PREFIX = "nft_metadata_"
METADATA_CACHE_TTL = 86400 * 30  # 30 days (IPFS content is immutable)


def create_chapter_nft_metadata(
    chapter_title: str,
    chapter_description: str,
    content_title: str,
    creator_name: str,
    creator_wallet: str,
    chapter_number: int = 1,
    cover_image_url: Optional[str] = None,
    collaborators: Optional[List[Dict[str, Any]]] = None,
    edition_number: Optional[int] = None,
    total_editions: Optional[int] = None,
    purchase_price_usd: Optional[Decimal] = None,
    attributes: Optional[List[Dict[str, Any]]] = None,
    platform_wallet: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create NFT metadata following Metaplex standard.

    Args:
        chapter_title: Title of the chapter
        chapter_description: Description/summary of the chapter
        content_title: Title of the parent content (book/series)
        creator_name: Primary creator's display name
        creator_wallet: Primary creator's wallet address
        chapter_number: Chapter number in series
        cover_image_url: URL to cover image (should be on IPFS)
        collaborators: List of collaborators with shares
        edition_number: This edition's number (e.g., 42 of 1000)
        total_editions: Total editions available
        purchase_price_usd: Purchase price for provenance
        attributes: Additional attributes for the NFT
        platform_wallet: Platform wallet for secondary sale royalties

    Returns:
        Dict: Metaplex-compatible metadata JSON
    """
    # Secondary sale royalty split: 7% total (5% creators + 2% platform)
    # Platform gets 2/7 (~28.57%) of royalties, creators get 5/7 (~71.43%)
    PLATFORM_ROYALTY_SHARE = 29  # ~2/7 rounded
    CREATOR_ROYALTY_SHARE = 71   # ~5/7 rounded

    # Build creators array (Metaplex format)
    creators = []

    # Add platform wallet first for secondary sale royalties
    if platform_wallet:
        creators.append({
            "address": platform_wallet,
            "share": PLATFORM_ROYALTY_SHARE,
            "verified": False
        })

    # Calculate remaining share for creators
    remaining_share = 100 - PLATFORM_ROYALTY_SHARE if platform_wallet else 100

    if collaborators:
        total_pct = sum(c.get('percentage', 0) for c in collaborators)
        for collab in collaborators:
            if total_pct > 0:
                share = int((collab.get('percentage', 0) / total_pct) * remaining_share)
            else:
                share = remaining_share // len(collaborators)
            creators.append({
                "address": collab.get('wallet') or collab.get('wallet_address'),
                "share": share,
                "verified": False
            })
    else:
        creators.append({
            "address": creator_wallet,
            "share": remaining_share,
            "verified": False
        })

    # Ensure shares sum to 100 (adjust last creator for rounding)
    total_shares = sum(c['share'] for c in creators)
    if total_shares != 100 and creators:
        creators[-1]['share'] += (100 - total_shares)

    # Build attributes array
    nft_attributes = [
        {"trait_type": "Content", "value": content_title},
        {"trait_type": "Chapter", "value": str(chapter_number)},
        {"trait_type": "Creator", "value": creator_name},
        {"trait_type": "Platform", "value": "RenaissBlock"},
    ]

    if edition_number and total_editions:
        nft_attributes.append({
            "trait_type": "Edition",
            "value": f"{edition_number} of {total_editions}"
        })

    if purchase_price_usd:
        nft_attributes.append({
            "trait_type": "Purchase Price",
            "value": f"${purchase_price_usd}"
        })

    # Add custom attributes
    if attributes:
        nft_attributes.extend(attributes)

    # Build metadata following Metaplex standard
    metadata = {
        "name": f"{content_title} - {chapter_title}",
        "symbol": "RBNFT",
        "description": chapter_description or f"Chapter {chapter_number} of {content_title} by {creator_name}",
        "image": cover_image_url or "https://renaissblock.com/default-nft-cover.png",
        "animation_url": None,  # Could link to audio/video content
        "external_url": f"https://renaissblock.com/content/{content_title.lower().replace(' ', '-')}",
        "attributes": nft_attributes,
        "properties": {
            "files": [
                {
                    "uri": cover_image_url or "https://renaissblock.com/default-nft-cover.png",
                    "type": "image/png"
                }
            ],
            "category": "image",
            "creators": creators
        },
        "seller_fee_basis_points": 700,  # 7% royalty on secondary sales (5% creator + 2% platform)
        "collection": {
            "name": content_title,
            "family": "RenaissBlock"
        }
    }

    return metadata


def upload_metadata_to_ipfs(metadata: Dict[str, Any]) -> str:
    """
    Upload metadata JSON to IPFS via Pinata.

    Args:
        metadata: NFT metadata dictionary

    Returns:
        str: IPFS URI (ipfs://Qm... or https://gateway.pinata.cloud/ipfs/Qm...)
    """
    # Generate cache key from metadata hash
    metadata_json = json.dumps(metadata, sort_keys=True)
    metadata_hash = hashlib.sha256(metadata_json.encode()).hexdigest()[:16]
    cache_key = f"{METADATA_CACHE_PREFIX}{metadata_hash}"

    # Check cache first
    cached_uri = cache.get(cache_key)
    if cached_uri:
        logger.info(f"Using cached metadata URI: {cached_uri}")
        return cached_uri

    # Get Pinata credentials
    pinata_jwt = getattr(settings, 'PINATA_JWT', None)
    pinata_api_key = getattr(settings, 'PINATA_API_KEY', None)
    pinata_secret = getattr(settings, 'PINATA_API_SECRET', None)

    if not (pinata_jwt or (pinata_api_key and pinata_secret)):
        if not settings.DEBUG:
            raise RuntimeError("Pinata credentials not configured — cannot upload metadata in production")
        logger.warning("Pinata credentials not configured - using mock URI (development only)")
        return _generate_mock_uri(metadata)

    try:
        import requests

        url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

        # Use JWT if available, otherwise API key
        if pinata_jwt:
            headers = {
                "Authorization": f"Bearer {pinata_jwt}",
                "Content-Type": "application/json"
            }
        else:
            headers = {
                "pinata_api_key": pinata_api_key,
                "pinata_secret_api_key": pinata_secret,
                "Content-Type": "application/json"
            }

        payload = {
            "pinataContent": metadata,
            "pinataMetadata": {
                "name": metadata.get("name", "RenaissBlock NFT"),
                "keyvalues": {
                    "platform": "RenaissBlock",
                    "type": "chapter_nft"
                }
            },
            "pinataOptions": {
                "cidVersion": 1
            }
        }

        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        ipfs_hash = result.get("IpfsHash")

        if not ipfs_hash:
            raise ValueError("No IPFS hash in response")

        # Create URI (use gateway URL for compatibility)
        ipfs_uri = f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"

        # Cache the URI
        cache.set(cache_key, ipfs_uri, METADATA_CACHE_TTL)

        logger.info(f"Uploaded metadata to IPFS: {ipfs_uri}")
        return ipfs_uri

    except Exception as e:
        logger.error(f"Failed to upload to Pinata: {e}")
        if not settings.DEBUG:
            raise
        return _generate_mock_uri(metadata)


def upload_image_to_ipfs(image_url: str) -> str:
    """
    Upload an image to IPFS via Pinata.

    Args:
        image_url: URL of image to upload (will be fetched and re-uploaded)

    Returns:
        str: IPFS URI for the image
    """
    pinata_jwt = getattr(settings, 'PINATA_JWT', None)

    if not pinata_jwt:
        logger.warning("Pinata JWT not configured, returning original URL")
        return image_url

    try:
        import requests

        # Fetch the image
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()

        # Upload to Pinata
        url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
        headers = {
            "Authorization": f"Bearer {pinata_jwt}"
        }

        # Determine content type
        content_type = img_response.headers.get('Content-Type', 'image/png')
        extension = content_type.split('/')[-1]

        files = {
            'file': (f'nft_image.{extension}', img_response.content, content_type)
        }

        response = requests.post(url, headers=headers, files=files, timeout=60)
        response.raise_for_status()

        result = response.json()
        ipfs_hash = result.get("IpfsHash")

        if ipfs_hash:
            return f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"

        return image_url

    except Exception as e:
        logger.error(f"Failed to upload image to IPFS: {e}")
        return image_url


def _generate_mock_uri(metadata: Dict[str, Any]) -> str:
    """
    Generate a mock URI for testing when IPFS is not available.
    """
    metadata_json = json.dumps(metadata, sort_keys=True)
    mock_hash = hashlib.sha256(metadata_json.encode()).hexdigest()[:46]
    return f"https://arweave.net/{mock_hash}"


def create_and_upload_chapter_metadata(
    chapter,  # Chapter model instance
    purchase,  # Purchase model instance
    collaborators: List[Dict[str, Any]],
) -> str:
    """
    Convenience function to create and upload metadata for a chapter purchase.

    Args:
        chapter: Chapter model instance
        purchase: Purchase model instance
        collaborators: List of collaborator payment info

    Returns:
        str: IPFS URI for the metadata
    """
    from rb_core.audit_utils import audit_ipfs_upload

    # Get cover image URL
    cover_url = None
    if hasattr(chapter, 'cover_image') and chapter.cover_image:
        cover_url = chapter.cover_image.url
    elif hasattr(chapter, 'content') and chapter.content:
        if hasattr(chapter.content, 'cover_image') and chapter.content.cover_image:
            cover_url = chapter.content.cover_image.url

    # Get creator info
    creator = chapter.content.creator if hasattr(chapter, 'content') else None
    creator_name = creator.username if creator else "Unknown"
    creator_wallet = ""
    if creator and hasattr(creator, 'profile') and creator.profile:
        creator_wallet = creator.profile.wallet_address or ""

    # Get platform wallet for secondary sale royalties
    platform_royalty_wallet = getattr(settings, 'PLATFORM_ROYALTY_WALLET_ADDRESS', None)

    # Create metadata
    metadata = create_chapter_nft_metadata(
        chapter_title=chapter.title,
        chapter_description=getattr(chapter, 'description', ''),
        content_title=chapter.content.title if hasattr(chapter, 'content') else "RenaissBlock Content",
        creator_name=creator_name,
        creator_wallet=creator_wallet,
        chapter_number=getattr(chapter, 'chapter_number', 1),
        cover_image_url=cover_url,
        collaborators=collaborators,
        edition_number=getattr(purchase, 'edition_number', None),
        total_editions=getattr(chapter.content, 'editions', None) if hasattr(chapter, 'content') else None,
        purchase_price_usd=getattr(purchase, 'chapter_price', None),
        platform_wallet=platform_royalty_wallet,
    )

    # Upload to IPFS with audit logging
    start_time = time.time()
    try:
        ipfs_uri = upload_metadata_to_ipfs(metadata)
        duration_ms = int((time.time() - start_time) * 1000)

        # Log successful IPFS upload
        audit_ipfs_upload(
            status='completed',
            ipfs_uri=ipfs_uri,
            user=purchase.user if purchase else None,
            purchase=purchase,
            duration_ms=duration_ms,
            metadata={
                'content_type': 'chapter',
                'chapter_id': chapter.id,
                'chapter_title': chapter.title,
                'metadata_name': metadata.get('name', ''),
            }
        )

        return ipfs_uri

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)

        # Log failed IPFS upload
        audit_ipfs_upload(
            status='failed',
            user=purchase.user if purchase else None,
            purchase=purchase,
            error_message=str(e),
            duration_ms=duration_ms,
            metadata={
                'content_type': 'chapter',
                'chapter_id': chapter.id,
                'chapter_title': chapter.title,
                'error_type': type(e).__name__,
            }
        )

        raise


def create_and_upload_content_metadata(
    content,  # Content model instance
    purchase,  # Purchase model instance
    collaborators: List[Dict[str, Any]],
) -> str:
    """
    Convenience function to create and upload metadata for a full content purchase.

    Args:
        content: Content model instance
        purchase: Purchase model instance
        collaborators: List of collaborator payment info

    Returns:
        str: IPFS URI for the metadata
    """
    from rb_core.audit_utils import audit_ipfs_upload

    # Get cover image URL
    cover_url = None
    if hasattr(content, 'cover_image') and content.cover_image:
        cover_url = content.cover_image.url

    # Get creator info
    creator = content.creator if hasattr(content, 'creator') else None
    creator_name = creator.username if creator else "Unknown"
    creator_wallet = ""
    if creator and hasattr(creator, 'profile') and creator.profile:
        creator_wallet = creator.profile.wallet_address or ""

    # Get platform wallet for secondary sale royalties
    platform_royalty_wallet = getattr(settings, 'PLATFORM_ROYALTY_WALLET_ADDRESS', None)

    # Create metadata (using chapter format but for full content)
    metadata = create_chapter_nft_metadata(
        chapter_title="Complete Edition",
        chapter_description=getattr(content, 'description', ''),
        content_title=content.title,
        creator_name=creator_name,
        creator_wallet=creator_wallet,
        chapter_number=0,  # 0 indicates full content
        cover_image_url=cover_url,
        collaborators=collaborators,
        edition_number=getattr(purchase, 'edition_number', None),
        total_editions=getattr(content, 'editions', None),
        purchase_price_usd=getattr(purchase, 'purchase_price_usd', None),
        attributes=[
            {"trait_type": "Type", "value": "Complete Edition"},
            {"trait_type": "Content Type", "value": getattr(content, 'content_type', 'Unknown')}
        ],
        platform_wallet=platform_royalty_wallet,
    )

    # Upload to IPFS with audit logging
    start_time = time.time()
    try:
        ipfs_uri = upload_metadata_to_ipfs(metadata)
        duration_ms = int((time.time() - start_time) * 1000)

        # Log successful IPFS upload
        audit_ipfs_upload(
            status='completed',
            ipfs_uri=ipfs_uri,
            user=purchase.user if purchase else None,
            purchase=purchase,
            duration_ms=duration_ms,
            metadata={
                'content_type': 'content',
                'content_id': content.id,
                'content_title': content.title,
                'metadata_name': metadata.get('name', ''),
            }
        )

        return ipfs_uri

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)

        # Log failed IPFS upload
        audit_ipfs_upload(
            status='failed',
            user=purchase.user if purchase else None,
            purchase=purchase,
            error_message=str(e),
            duration_ms=duration_ms,
            metadata={
                'content_type': 'content',
                'content_id': content.id,
                'content_title': content.title,
                'error_type': type(e).__name__,
            }
        )

        raise
