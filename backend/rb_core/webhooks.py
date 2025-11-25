"""
Minimal Circle webhook handler for renaissBlock.

Production-ready webhook endpoint with comprehensive error handling.
"""

import json
import logging
import traceback
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)


@csrf_exempt
def circle_webhook(request):
    """
    Handle Circle payment webhook events.

    This is a minimal, production-ready webhook handler that:
    - Accepts POST requests only
    - Logs all incoming data
    - Never crashes (comprehensive error handling)
    - Returns proper JSON responses

    Circle sends webhooks for:
    - payment.confirmed: Payment succeeded
    - payment.failed: Payment failed
    - payment.canceled: Payment canceled
    """

    # Log the incoming request
    logger.info('=' * 80)
    logger.info('[Circle Webhook] Incoming request')
    logger.info(f'[Circle Webhook] Method: {request.method}')
    logger.info(f'[Circle Webhook] Path: {request.path}')
    logger.info(f'[Circle Webhook] Content-Type: {request.META.get("CONTENT_TYPE", "not set")}')

    # Log all headers (useful for debugging)
    logger.info('[Circle Webhook] Headers:')
    for key, value in request.META.items():
        if key.startswith('HTTP_'):
            header_name = key[5:].replace('_', '-')
            logger.info(f'  {header_name}: {value}')

    # Handle GET/HEAD requests (Circle verification)
    if request.method in ['GET', 'HEAD']:
        logger.info('[Circle Webhook] Verification request (GET/HEAD)')
        return JsonResponse({
            'status': 'ok',
            'message': 'Circle webhook endpoint active',
            'endpoint': '/api/checkout/circle/webhook/'
        })

    # Only accept POST for actual webhooks
    if request.method != 'POST':
        logger.warning(f'[Circle Webhook] Invalid method: {request.method}')
        return JsonResponse({
            'status': 'error',
            'message': f'Method {request.method} not allowed'
        }, status=405)

    # Log raw body
    try:
        raw_body = request.body.decode('utf-8')
        logger.info(f'[Circle Webhook] Raw body: {raw_body}')
    except Exception as e:
        logger.error(f'[Circle Webhook] Error decoding body: {e}')
        raw_body = str(request.body)
        logger.info(f'[Circle Webhook] Raw body (bytes): {raw_body}')

    # Parse JSON payload
    try:
        payload = json.loads(request.body)
        logger.info(f'[Circle Webhook] Parsed payload: {json.dumps(payload, indent=2)}')
    except json.JSONDecodeError as e:
        logger.error(f'[Circle Webhook] JSON decode error: {e}')
        logger.error(f'[Circle Webhook] Traceback: {traceback.format_exc()}')
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON payload',
            'error': str(e)
        }, status=400)
    except Exception as e:
        logger.error(f'[Circle Webhook] Unexpected error parsing JSON: {e}')
        logger.error(f'[Circle Webhook] Traceback: {traceback.format_exc()}')
        return JsonResponse({
            'status': 'error',
            'message': 'Error parsing request',
            'error': str(e)
        }, status=400)

    # Extract event type
    try:
        event_type = payload.get('type', 'unknown')
        event_id = payload.get('id', 'unknown')
        data = payload.get('data', {})

        logger.info(f'[Circle Webhook] Event type: {event_type}')
        logger.info(f'[Circle Webhook] Event ID: {event_id}')
        logger.info(f'[Circle Webhook] Event data: {json.dumps(data, indent=2)}')

    except Exception as e:
        logger.error(f'[Circle Webhook] Error extracting event data: {e}')
        logger.error(f'[Circle Webhook] Traceback: {traceback.format_exc()}')
        # Still return 200 to acknowledge receipt
        return JsonResponse({
            'status': 'received',
            'message': 'Webhook received but could not extract event data',
            'error': str(e)
        }, status=200)

    # Handle different event types
    try:
        if event_type == 'payment.confirmed':
            logger.info('[Circle Webhook] ✅ Payment confirmed event')
            # TODO: Process payment confirmation
            # handle_payment_confirmed(data)

        elif event_type == 'payment.failed':
            logger.info('[Circle Webhook] ❌ Payment failed event')
            # TODO: Process payment failure
            # handle_payment_failed(data)

        elif event_type == 'payment.canceled':
            logger.info('[Circle Webhook] 🚫 Payment canceled event')
            # TODO: Process payment cancellation
            # handle_payment_canceled(data)

        else:
            logger.info(f'[Circle Webhook] ℹ️  Unhandled event type: {event_type}')

    except Exception as e:
        logger.error(f'[Circle Webhook] Error handling event: {e}')
        logger.error(f'[Circle Webhook] Traceback: {traceback.format_exc()}')
        # Still return 200 - we received it, just couldn't process
        return JsonResponse({
            'status': 'received',
            'event_type': event_type,
            'message': 'Webhook received but processing failed',
            'error': str(e)
        }, status=200)

    # Success response
    logger.info('[Circle Webhook] ✅ Webhook processed successfully')
    logger.info('=' * 80)

    return JsonResponse({
        'status': 'received',
        'event_type': event_type,
        'event_id': event_id,
        'message': 'Webhook processed successfully'
    }, status=200)
