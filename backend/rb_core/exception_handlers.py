"""
Custom exception handlers for API security.

Implements generic error messages in production to prevent information leakage.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns generic error messages in production.

    In DEBUG mode: Returns detailed error messages for development.
    In production: Returns generic messages, logs details server-side.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Log the full error details server-side
        logger.error(
            f'API error in {context.get("view").__class__.__name__ if context.get("view") else "unknown"}: '
            f'{exc.__class__.__name__}: {str(exc)}',
            exc_info=True
        )

        # In production, replace with generic messages
        if not settings.DEBUG:
            status_code = response.status_code

            # Map specific errors to generic messages
            if status_code == status.HTTP_400_BAD_REQUEST:
                response.data = {
                    'error': 'Invalid request. Please check your input and try again.'
                }
            elif status_code == status.HTTP_401_UNAUTHORIZED:
                response.data = {
                    'error': 'Authentication required. Please log in.'
                }
            elif status_code == status.HTTP_403_FORBIDDEN:
                response.data = {
                    'error': 'You do not have permission to perform this action.'
                }
            elif status_code == status.HTTP_404_NOT_FOUND:
                response.data = {
                    'error': 'The requested resource was not found.'
                }
            elif status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                response.data = {
                    'error': 'Too many requests. Please try again later.'
                }
            elif status_code >= 500:
                response.data = {
                    'error': 'An internal server error occurred. Please try again later.'
                }
            else:
                response.data = {
                    'error': 'An error occurred while processing your request.'
                }

    return response
