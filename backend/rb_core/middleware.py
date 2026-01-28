from django.conf import settings
from django.http import JsonResponse
from typing import Callable
import json
import logging
import requests

logger = logging.getLogger(__name__)


class SimpleCSPMiddleware:
    """Very small CSP header for MVP; tighten for production.

    Reads directive values from settings: CSP_DEFAULT_SRC, CSP_IMG_SRC, CSP_SCRIPT_SRC, CSP_STYLE_SRC.
    """

    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        parts = []
        default_src = getattr(settings, 'CSP_DEFAULT_SRC', None)
        if default_src:
            parts.append(f"default-src {default_src}")
        img_src = getattr(settings, 'CSP_IMG_SRC', None)
        if img_src:
            parts.append(f"img-src {img_src}")
        script_src = getattr(settings, 'CSP_SCRIPT_SRC', None)
        if script_src:
            parts.append(f"script-src {script_src}")
        style_src = getattr(settings, 'CSP_STYLE_SRC', None)
        if style_src:
            parts.append(f"style-src {style_src}")
        if parts:
            response['Content-Security-Policy'] = '; '.join(parts)
        return response


class MaintenanceModeMiddleware:
    """
    Middleware to show a maintenance page when MAINTENANCE_MODE is enabled.

    Allows bypass for specific IP addresses defined in MAINTENANCE_BYPASS_IPS.
    Admin URLs are always accessible for emergency access.
    """

    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, 'MAINTENANCE_MODE', False):
            return self.get_response(request)

        # Always allow admin access
        if request.path.startswith('/admin/'):
            return self.get_response(request)

        # Always allow health check
        if request.path == '/health/':
            return self.get_response(request)

        # Check bypass IPs
        client_ip = self._get_client_ip(request)
        bypass_ips = getattr(settings, 'MAINTENANCE_BYPASS_IPS', [])
        if client_ip in bypass_ips:
            return self.get_response(request)

        # Return maintenance response
        message = getattr(settings, 'MAINTENANCE_MESSAGE',
                         'We are currently performing scheduled maintenance.')
        return JsonResponse({
            'error': 'maintenance',
            'message': message,
            'retry_after': 300  # Suggest retry after 5 minutes
        }, status=503)

    def _get_client_ip(self, request):
        """Get client IP, handling proxies."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')


class GeoRestrictionMiddleware:
    """
    Middleware to restrict access based on geographic location.

    Uses MaxMind GeoIP2 database for IP geolocation.
    Requires: pip install geoip2, and download GeoLite2-Country.mmdb
    """

    def __init__(self, get_response: Callable):
        self.get_response = get_response
        self.reader = None
        self._init_geoip()

    def _init_geoip(self):
        """Initialize GeoIP reader if enabled and database exists."""
        if not getattr(settings, 'GEO_RESTRICTION_ENABLED', False):
            return

        geoip_path = getattr(settings, 'GEOIP_PATH', '')
        if not geoip_path:
            logger.warning("GEO_RESTRICTION_ENABLED but GEOIP_PATH not set")
            return

        try:
            import geoip2.database
            import os
            db_path = os.path.join(geoip_path, 'GeoLite2-Country.mmdb')
            if os.path.exists(db_path):
                self.reader = geoip2.database.Reader(db_path)
                logger.info(f"GeoIP database loaded from {db_path}")
            else:
                logger.warning(f"GeoIP database not found at {db_path}")
        except ImportError:
            logger.warning("geoip2 package not installed")
        except Exception as e:
            logger.error(f"Failed to initialize GeoIP: {e}")

    def __call__(self, request):
        if not getattr(settings, 'GEO_RESTRICTION_ENABLED', False):
            return self.get_response(request)

        if not self.reader:
            # GeoIP not available, allow access (fail-open for MVP)
            return self.get_response(request)

        # Always allow health check, webhooks, and static files
        exempt_paths = ['/health/', '/api/webhooks/', '/static/', '/admin/']
        if any(request.path.startswith(p) for p in exempt_paths):
            return self.get_response(request)

        # Get client country
        client_ip = self._get_client_ip(request)
        country_code = self._get_country(client_ip)

        # Check if country is allowed
        allowed_countries = getattr(settings, 'GEO_ALLOWED_COUNTRIES', ['US'])
        if country_code and country_code not in allowed_countries:
            logger.warning(f"Blocked request from {country_code} (IP: {client_ip})")
            return JsonResponse({
                'error': 'geo_restricted',
                'message': 'This service is not available in your region.',
                'country': country_code
            }, status=403)

        return self.get_response(request)

    def _get_client_ip(self, request):
        """Get client IP, handling proxies."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

    def _get_country(self, ip):
        """Get country code for IP address."""
        if not self.reader or not ip:
            return None

        # Skip private/local IPs
        if ip.startswith(('127.', '10.', '192.168.', '172.16.', '172.17.', '172.18.',
                          '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
                          '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
                          '172.29.', '172.30.', '172.31.')):
            return 'US'  # Assume local development is US

        try:
            response = self.reader.country(ip)
            return response.country.iso_code
        except Exception as e:
            logger.debug(f"GeoIP lookup failed for {ip}: {e}")
            return None


def send_slack_alert(message: str, level: str = 'warning'):
    """
    Send an alert to Slack webhook.

    Args:
        message: The alert message to send
        level: Alert level ('info', 'warning', 'error', 'critical')
    """
    webhook_url = getattr(settings, 'SLACK_WEBHOOK_URL', '')
    if not webhook_url:
        return

    # Color coding for different levels
    colors = {
        'info': '#36a64f',      # Green
        'warning': '#ffcc00',   # Yellow
        'error': '#ff6600',     # Orange
        'critical': '#ff0000',  # Red
    }

    emoji_map = {
        'info': ':information_source:',
        'warning': ':warning:',
        'error': ':x:',
        'critical': ':rotating_light:',
    }

    try:
        payload = {
            'attachments': [{
                'color': colors.get(level, '#808080'),
                'title': f'{emoji_map.get(level, "")} {level.upper()}: renaissBlock Alert',
                'text': message,
                'footer': f'Environment: {getattr(settings, "ENVIRONMENT", "unknown")}',
            }]
        }
        requests.post(webhook_url, json=payload, timeout=5)
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")



