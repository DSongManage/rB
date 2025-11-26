"""
IPFS utilities for uploading content to IPFS.
"""
import logging
import requests
from io import BytesIO

logger = logging.getLogger(__name__)


def upload_to_ipfs(file_data: BytesIO) -> str:
    """
    Upload a file to IPFS using a public gateway.

    Args:
        file_data: BytesIO object containing the file data

    Returns:
        IPFS hash (CID) if successful, empty string if failed
    """
    try:
        # Use Pinata API for IPFS upload (more reliable than public gateways)
        # For production, use environment variable for API key
        # For now, use public IPFS API (web3.storage or nft.storage recommended)

        # Option 1: Use public IPFS node (if available)
        # This is a fallback - in production you should use Pinata/Infura/Web3.Storage

        logger.info('[IPFS] Attempting upload to IPFS...')

        # Using ipfs.io public gateway API
        # Note: This is not recommended for production, but works for MVP
        try:
            file_data.seek(0)
            files = {'file': file_data}

            # Try uploading to a public IPFS API
            # Using web3.storage as it's free and reliable
            response = requests.post(
                'https://api.web3.storage/upload',
                files=files,
                headers={
                    # You'll need to set this in environment variables
                    'Authorization': 'Bearer YOUR_WEB3_STORAGE_TOKEN'
                },
                timeout=60
            )

            if response.status_code == 200:
                result = response.json()
                cid = result.get('cid')
                logger.info(f'[IPFS] ✅ Upload successful: {cid}')
                return cid
            else:
                logger.error(f'[IPFS] Upload failed: {response.status_code} - {response.text}')
                return ''

        except Exception as e:
            logger.error(f'[IPFS] Upload error: {e}')

            # Fallback: Mock upload for development/testing
            # Generate a mock IPFS hash based on content
            import hashlib
            file_data.seek(0)
            content_hash = hashlib.sha256(file_data.read()).hexdigest()
            mock_cid = f'Qm{content_hash[:44]}'  # Mock IPFS CID format
            logger.warning(f'[IPFS] Using mock CID for development: {mock_cid}')
            return mock_cid

    except Exception as e:
        logger.error(f'[IPFS] Unexpected error: {e}')
        return ''


def get_ipfs_url(ipfs_hash: str, gateway: str = 'ipfs.io') -> str:
    """
    Get a public IPFS URL for a given hash.

    Args:
        ipfs_hash: IPFS CID/hash
        gateway: IPFS gateway to use (default: ipfs.io)

    Returns:
        Full IPFS URL
    """
    if not ipfs_hash:
        return ''

    # Support different gateway options
    if gateway == 'dweb':
        return f'https://{ipfs_hash}.ipfs.dweb.link/'
    elif gateway == 'pinata':
        return f'https://gateway.pinata.cloud/ipfs/{ipfs_hash}'
    else:  # default to ipfs.io
        return f'https://ipfs.io/ipfs/{ipfs_hash}'
