"""
Admin Treasury Dashboard

Monitors platform USDC treasury health and runway.
"""

import logging
from decimal import Decimal
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum, Count
from django.utils import timezone
from django.http import JsonResponse
from datetime import timedelta

from ..models import Purchase, TreasuryReconciliation
from blockchain.solana_service import get_platform_usdc_balance

logger = logging.getLogger(__name__)


@staff_member_required
def treasury_dashboard(request):
    """
    Admin dashboard for monitoring treasury health.

    Displays:
    - Current USDC balance
    - Weekly spending stats
    - Runway estimate
    - Health status
    - Recent reconciliations
    """

    # Current treasury balance
    try:
        current_balance = get_platform_usdc_balance()
    except Exception as e:
        logger.error(f"Error getting treasury balance: {e}")
        current_balance = 0

    # This week's stats
    week_start = timezone.now() - timedelta(days=7)

    weekly_stats = Purchase.objects.filter(
        purchased_at__gte=week_start,
        usdc_distribution_status='completed'
    ).aggregate(
        count=Count('id'),
        fronted=Sum('platform_usdc_fronted'),
        earned=Sum('platform_usdc_earned')
    )

    purchases_this_week = weekly_stats['count'] or 0
    usdc_fronted_this_week = weekly_stats['fronted'] or Decimal('0')
    usdc_earned_this_week = weekly_stats['earned'] or Decimal('0')
    net_fronted = usdc_fronted_this_week - usdc_earned_this_week

    # Calculate runway
    if purchases_this_week > 0:
        avg_per_purchase = usdc_fronted_this_week / purchases_this_week
        daily_rate = purchases_this_week / 7
        daily_spend = avg_per_purchase * daily_rate
        runway_days = current_balance / float(daily_spend) if daily_spend > 0 else 999
    else:
        runway_days = 999
        daily_spend = 0

    # Health status
    if current_balance < 1000:
        health = 'CRITICAL'
        health_color = 'red'
        health_message = 'Replenish treasury immediately!'
    elif runway_days < 7:
        health = 'WARNING'
        health_color = 'orange'
        health_message = 'Replenish treasury soon'
    else:
        health = 'HEALTHY'
        health_color = 'green'
        health_message = 'Treasury is healthy'

    # Recent reconciliations
    reconciliations = TreasuryReconciliation.objects.order_by('-created_at')[:10]

    # All-time stats
    all_time_stats = Purchase.objects.filter(
        usdc_distribution_status='completed'
    ).aggregate(
        total_purchases=Count('id'),
        total_fronted=Sum('platform_usdc_fronted'),
        total_earned=Sum('platform_usdc_earned')
    )

    context = {
        # Current status
        'current_balance': current_balance,
        'recommended_balance': 5000,
        'runway_days': runway_days,
        'health': health,
        'health_color': health_color,
        'health_message': health_message,

        # This week
        'purchases_this_week': purchases_this_week,
        'usdc_fronted_this_week': usdc_fronted_this_week,
        'usdc_earned_this_week': usdc_earned_this_week,
        'net_fronted': net_fronted,
        'daily_spend': daily_spend,

        # All-time
        'total_purchases': all_time_stats['total_purchases'] or 0,
        'total_fronted': all_time_stats['total_fronted'] or Decimal('0'),
        'total_earned': all_time_stats['total_earned'] or Decimal('0'),

        # History
        'reconciliations': reconciliations,
    }

    return render(request, 'admin/treasury_dashboard.html', context)


@staff_member_required
def treasury_api(request):
    """
    JSON API endpoint for treasury data (for charts/monitoring).
    """

    try:
        current_balance = get_platform_usdc_balance()
    except Exception as e:
        current_balance = 0

    week_start = timezone.now() - timedelta(days=7)

    weekly_stats = Purchase.objects.filter(
        purchased_at__gte=week_start,
        usdc_distribution_status='completed'
    ).aggregate(
        count=Count('id'),
        fronted=Sum('platform_usdc_fronted'),
        earned=Sum('platform_usdc_earned')
    )

    purchases_this_week = weekly_stats['count'] or 0
    usdc_fronted_this_week = float(weekly_stats['fronted'] or 0)
    usdc_earned_this_week = float(weekly_stats['earned'] or 0)

    if purchases_this_week > 0:
        avg_per_purchase = usdc_fronted_this_week / purchases_this_week
        daily_rate = purchases_this_week / 7
        daily_spend = avg_per_purchase * daily_rate
        runway_days = current_balance / daily_spend if daily_spend > 0 else 999
    else:
        runway_days = 999
        daily_spend = 0

    if current_balance < 1000:
        health = 'CRITICAL'
    elif runway_days < 7:
        health = 'WARNING'
    else:
        health = 'HEALTHY'

    return JsonResponse({
        'current_balance': current_balance,
        'runway_days': runway_days,
        'health': health,
        'purchases_this_week': purchases_this_week,
        'usdc_fronted_this_week': usdc_fronted_this_week,
        'usdc_earned_this_week': usdc_earned_this_week,
        'daily_spend': daily_spend,
    })
