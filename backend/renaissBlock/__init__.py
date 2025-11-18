"""
renaissBlock Django application initialization.
"""

# Try to import Celery app, but don't fail if Celery isn't installed
# This allows the app to run without Celery - tasks will run synchronously
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:
    # Celery not installed - tasks will use synchronous fallback
    __all__ = ()
    pass
