"""
Celery configuration for renaissBlock project.

This file provides async task processing for:
- NFT minting after payment
- Creator payouts via Stripe Connect
- Email notifications
"""

import os
from celery import Celery

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')

# Create Celery app
app = Celery('renaissBlock')

# Load config from Django settings with 'CELERY_' prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working."""
    print(f'Request: {self.request!r}')
