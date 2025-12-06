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


# Celery Beat Schedule
# Schedule periodic tasks to run at specific times
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Weekly treasury reconciliation - every Monday at 9am
    'weekly-treasury-reconciliation': {
        'task': 'rb_core.tasks.weekly_treasury_reconciliation',
        'schedule': crontab(day_of_week='monday', hour=9, minute=0),
    },
    # Add more scheduled tasks here as needed
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working."""
    print(f'Request: {self.request!r}')
