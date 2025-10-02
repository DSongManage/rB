from django.conf import settings
from typing import Callable


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



