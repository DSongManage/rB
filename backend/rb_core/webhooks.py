"""
Circle webhook handler with ECDSA signature verification.

Circle uses ECDSA SHA-256 with public key cryptography for webhook signatures.
Each webhook includes:
- X-Circle-Signature: Base64-encoded ECDSA signature
- X-Circle-Key-Id: ID of the public key to fetch from Circle API

This implementation:
1. Fetches public keys from Circle API and caches them
2. Verifies signatures using ECDSA SHA-256
3. Only processes webhooks with valid signatures
"""

import json
import logging
import traceback
import base64
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

# Cryptography imports for ECDSA signature verification
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger(__name__)

# Cache for Circle public keys (key_id -> public_key_pem)
# Avoids repeated API calls for the same key
PUBLIC_KEY_CACHE = {}

# Circle API endpoints
# NOTE: Use api-sandbox.circle.com for testing
# TODO: Switch to api.circle.com for production
CIRCLE_API_BASE = "https://api-sandbox.circle.com"
# CIRCLE_API_BASE = "https://api.circle.com"  # Production


def get_circle_public_key(key_id: str) -> str:
    """
    Fetch Circle public key from API and cache it.

    Args:
        key_id: The key ID from X-Circle-Key-Id header

    Returns:
        Base64-encoded public key string

    Raises:
        Exception: If API call fails or key not found
    """
    # Check cache first
    if key_id in PUBLIC_KEY_CACHE:
        logger.info(f'[Circle] Using cached public key for key_id={key_id}')
        return PUBLIC_KEY_CACHE[key_id]

    # Fetch from Circle API
    url = f"{CIRCLE_API_BASE}/v2/notifications/publicKey/{key_id}"
    headers = {
        'Authorization': f'Bearer {settings.CIRCLE_API_KEY}',
        'Accept': 'application/json'
    }

    logger.info(f'[Circle] Fetching public key from {url}')

    try:
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(
                f'[Circle] Failed to fetch public key: {response.status_code} - {response.text}'
            )
            raise Exception(f'Failed to fetch public key: {response.status_code}')

        data = response.json()
        public_key = data.get('data', {}).get('publicKey')

        if not public_key:
            logger.error(f'[Circle] No public key in response: {data}')
            raise Exception('No public key in API response')

        # Cache the key
        PUBLIC_KEY_CACHE[key_id] = public_key
        logger.info(f'[Circle] ✅ Successfully fetched and cached public key for key_id={key_id}')

        return public_key

    except requests.RequestException as e:
        logger.error(f'[Circle] Network error fetching public key: {e}')
        logger.error(traceback.format_exc())
        raise Exception(f'Network error fetching public key: {e}')
    except Exception as e:
        logger.error(f'[Circle] Error fetching public key: {e}')
        logger.error(traceback.format_exc())
        raise


def verify_circle_signature(signature: str, public_key_base64: str, payload_bytes: bytes) -> bool:
    """
    Verify Circle webhook signature using ECDSA SHA-256.

    Args:
        signature: Base64-encoded signature from X-Circle-Signature header
        public_key_base64: Base64-encoded public key from Circle API
        payload_bytes: Raw request body as bytes

    Returns:
        True if signature is valid, False otherwise
    """
    try:
        # Decode signature from base64
        signature_bytes = base64.b64decode(signature)
        logger.info(f'[Circle] Decoded signature: {len(signature_bytes)} bytes')

        # Decode public key from base64
        public_key_bytes = base64.b64decode(public_key_base64)
        logger.info(f'[Circle] Decoded public key: {len(public_key_bytes)} bytes')

        # Load public key as DER format
        public_key = serialization.load_der_public_key(public_key_bytes)
        logger.info('[Circle] Loaded public key from DER format')

        # Verify signature using ECDSA with SHA-256
        public_key.verify(
            signature_bytes,
            payload_bytes,
            ec.ECDSA(hashes.SHA256())
        )

        logger.info('[Circle] ✅ Signature verified successfully')
        return True

    except InvalidSignature:
        logger.error('[Circle] ❌ Invalid signature - signature verification failed')
        return False
    except Exception as e:
        logger.error(f'[Circle] Error verifying signature: {e}')
        logger.error(traceback.format_exc())
        return False


@csrf_exempt
def circle_webhook(request):
    """
    Handle Circle payment webhook events with signature verification.

    Security:
    - Only accepts POST requests
    - Requires X-Circle-Signature and X-Circle-Key-Id headers
    - Verifies signature using ECDSA SHA-256 before processing
    - Returns 401 for invalid/missing signatures

    Events handled:
    - payment.confirmed: Payment succeeded, USDC received
    - payment.failed: Payment failed
    - payment.canceled: Payment canceled
    - webhooks.test: Circle test webhook
    """

    logger.info('=' * 80)
    logger.info('[Circle Webhook] Incoming request')
    logger.info(f'[Circle Webhook] Method: {request.method}')
    logger.info(f'[Circle Webhook] Path: {request.path}')
    logger.info(f'[Circle Webhook] Content-Type: {request.META.get("CONTENT_TYPE", "not set")}')

    # Log headers for debugging
    logger.info('[Circle Webhook] Headers:')
    for key, value in request.META.items():
        if key.startswith('HTTP_'):
            header_name = key[5:].replace('_', '-')
            # Don't log full signature, just first few chars
            if header_name == 'X-CIRCLE-SIGNATURE':
                logger.info(f'  {header_name}: {value[:20]}...')
            else:
                logger.info(f'  {header_name}: {value}')

    # Only accept POST requests
    if request.method != 'POST':
        logger.warning(f'[Circle Webhook] Invalid method: {request.method}')
        return JsonResponse({
            'status': 'error',
            'message': f'Method {request.method} not allowed'
        }, status=405)

    # Extract signature headers
    signature = request.headers.get('X-Circle-Signature')
    key_id = request.headers.get('X-Circle-Key-Id')

    logger.info(f'[Circle Webhook] X-Circle-Key-Id: {key_id}')
    logger.info(f'[Circle Webhook] X-Circle-Signature present: {bool(signature)}')

    # Require signature headers
    if not signature or not key_id:
        logger.error('[Circle Webhook] Missing signature headers')
        return JsonResponse({
            'status': 'error',
            'message': 'Missing X-Circle-Signature or X-Circle-Key-Id header'
        }, status=401)

    # Get raw request body for signature verification (as bytes)
    payload_bytes = request.body
    logger.info(f'[Circle Webhook] Payload size: {len(payload_bytes)} bytes')

    # Verify signature
    try:
        # Fetch public key from Circle API
        logger.info('[Circle Webhook] Fetching public key...')
        public_key = get_circle_public_key(key_id)

        # Verify signature
        logger.info('[Circle Webhook] Verifying signature...')
        is_valid = verify_circle_signature(signature, public_key, payload_bytes)

        if not is_valid:
            logger.error('[Circle Webhook] ❌ Signature verification failed')
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid signature'
            }, status=401)

        logger.info('[Circle Webhook] ✅ Signature verified successfully')

    except Exception as e:
        logger.error(f'[Circle Webhook] Error during signature verification: {e}')
        logger.error(traceback.format_exc())

        # IMPORTANT: For testing/debugging, you may want to allow webhooks without verification
        # Remove this in production!
        if not settings.DEBUG:
            return JsonResponse({
                'status': 'error',
                'message': 'Signature verification error'
            }, status=401)
        else:
            logger.warning('[Circle Webhook] ⚠️  DEBUG MODE: Proceeding without signature verification')

    # Parse JSON payload (only after signature verification!)
    try:
        payload = json.loads(payload_bytes)
        logger.info(f'[Circle Webhook] Parsed payload: {json.dumps(payload, indent=2)}')
    except json.JSONDecodeError as e:
        logger.error(f'[Circle Webhook] JSON decode error: {e}')
        logger.error(traceback.format_exc())
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON payload',
            'error': str(e)
        }, status=400)

    # Extract event type (Circle uses 'notificationType' or 'type')
    try:
        event_type = payload.get('notificationType') or payload.get('type', 'unknown')
        event_id = payload.get('id', 'unknown')

        logger.info(f'[Circle Webhook] Event type: {event_type}')
        logger.info(f'[Circle Webhook] Event ID: {event_id}')

    except Exception as e:
        logger.error(f'[Circle Webhook] Error extracting event data: {e}')
        logger.error(traceback.format_exc())
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid event format'
        }, status=400)

    # Handle different event types
    try:
        if event_type == 'payment.confirmed' or event_type == 'payments.confirmed':
            logger.info('[Circle Webhook] ✅ Payment confirmed event')
            handle_payment_confirmed(payload)

        elif event_type == 'payment.failed' or event_type == 'payments.failed':
            logger.info('[Circle Webhook] ❌ Payment failed event')
            # TODO: Handle payment failure

        elif event_type == 'payment.canceled' or event_type == 'payments.canceled':
            logger.info('[Circle Webhook] 🚫 Payment canceled event')
            # TODO: Handle payment cancellation

        elif event_type == 'webhooks.test':
            logger.info('[Circle Webhook] 🧪 Test webhook event')
            # Circle sends test webhooks - just acknowledge

        else:
            logger.info(f'[Circle Webhook] ℹ️  Unhandled event type: {event_type}')

    except Exception as e:
        logger.error(f'[Circle Webhook] Error handling event: {e}')
        logger.error(traceback.format_exc())
        # Still return 200 - we received and verified it
        return JsonResponse({
            'status': 'received',
            'event_type': event_type,
            'message': 'Webhook verified but processing failed',
            'error': str(e)
        }, status=200)

    # Success response
    logger.info('[Circle Webhook] ✅ Webhook processed successfully')
    logger.info('=' * 80)

    return JsonResponse({
        'status': 'success',
        'event_type': event_type,
        'event_id': event_id,
        'message': 'Webhook verified and processed successfully'
    }, status=200)


def handle_payment_confirmed(event: dict):
    """
    Handle confirmed Circle payment.

    This is called when payment succeeds and USDC is received on Solana.
    Will trigger NFT minting and USDC distribution to creators.

    Args:
        event: Full webhook event payload
    """
    logger.info('[Circle] Processing payment confirmation')
    logger.info(f'[Circle] Event data: {json.dumps(event, indent=2)}')

    # TODO: Implement payment confirmation logic
    # This should:
    # 1. Extract payment ID and metadata
    # 2. Find corresponding Purchase record
    # 3. Update purchase status and fees
    # 4. Decrement content editions
    # 5. Trigger NFT minting (Celery task)
    # 6. Distribute USDC to creators

    logger.warning('[Circle] ⚠️  Payment confirmation handler not yet implemented')
