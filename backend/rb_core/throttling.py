"""
Custom throttling classes for rate limiting.

Implements stricter rate limits for authentication endpoints to prevent brute force attacks.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.conf import settings


class AuthAnonRateThrottle(AnonRateThrottle):
    """
    Strict rate limiting for anonymous authentication attempts.

    Prevents brute force attacks on login/signup endpoints.
    """
    # In DEBUG mode: 10 attempts per minute (for testing)
    # In production: 5 attempts per minute
    rate = '10/min' if settings.DEBUG else '5/min'
    scope = 'auth_anon'


class AuthUserRateThrottle(UserRateThrottle):
    """
    Rate limiting for authenticated users on auth operations.
    """
    # Authenticated users get slightly higher limits
    rate = '20/min' if settings.DEBUG else '10/min'
    scope = 'auth_user'


class SignupRateThrottle(AnonRateThrottle):
    """
    Very strict rate limiting for signup attempts.

    Prevents mass account creation and spam.
    """
    # In DEBUG mode: 10 signups per hour (for testing)
    # In production: 5 signups per hour
    rate = '10/hour' if settings.DEBUG else '5/hour'
    scope = 'signup'


class PasswordResetRateThrottle(AnonRateThrottle):
    """
    Rate limiting for password reset requests.

    Prevents email flooding and abuse.
    """
    rate = '5/hour' if settings.DEBUG else '3/hour'
    scope = 'password_reset'
