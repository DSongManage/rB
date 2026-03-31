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
    # Check for stale Bridge on-ramp transfers - every 15 minutes
    'check-stale-bridge-onramp-transfers': {
        'task': 'rb_core.tasks.check_stale_onramp_transfers',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    # Auto-approve escrow tasks past review window - every 15 minutes
    'check-auto-approve-deadlines': {
        'task': 'rb_core.tasks.check_auto_approve_deadlines',
        'schedule': crontab(minute='*/15'),
    },
    # Warn writers about upcoming auto-approvals - every hour
    'send-auto-approve-warnings': {
        'task': 'rb_core.tasks.send_auto_approve_warnings',
        'schedule': crontab(minute=0),  # Top of every hour
    },
    # Campaign: check for failed campaigns past deadline - every 15 minutes
    'check-campaign-deadlines': {
        'task': 'rb_core.tasks.check_campaign_deadlines',
        'schedule': crontab(minute='*/15'),
    },
    # Campaign: check 60-day escrow creation window - daily at midnight
    'check-campaign-escrow-creation': {
        'task': 'rb_core.tasks.check_campaign_escrow_creation',
        'schedule': crontab(hour=0, minute=0),
    },
    # Campaign: check solo chapter releases for fund release - every 15 minutes
    'check-solo-chapter-releases': {
        'task': 'rb_core.tasks.check_solo_chapter_releases',
        'schedule': crontab(minute='*/15'),
    },
    # Campaign: check escrow dormancy (90-day backstop) - daily at 1am
    'check-escrow-dormancy': {
        'task': 'rb_core.tasks.check_escrow_dormancy',
        'schedule': crontab(hour=1, minute=0),
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working."""
    print(f'Request: {self.request!r}')
