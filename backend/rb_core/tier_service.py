"""
Creator Tier Service — all tier logic in one module.

Tiers (highest to lowest priority):
  founding  → 1% fee  (first 50 creators on a project crossing $100 cumulative sales)
  level_5   → 5% fee  ($10,000 lifetime project sales)
  level_4   → 6% fee  ($5,000)
  level_3   → 7% fee  ($2,500)
  level_2   → 8% fee  ($1,000)
  level_1   → 9% fee  ($500)
  standard  → 10% fee (default)

Tier progression is monotonic — creators never downgrade.
"""

import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Tier priority order (highest first). Used to prevent downgrades.
TIER_PRIORITY = ['founding', 'level_5', 'level_4', 'level_3', 'level_2', 'level_1', 'standard']


def _tier_rank(tier_name):
    """Lower index = higher tier."""
    try:
        return TIER_PRIORITY.index(tier_name)
    except ValueError:
        return len(TIER_PRIORITY)


def _get_config():
    from .models import TierConfiguration
    return TierConfiguration.load()


# ─── Public API ───────────────────────────────────────────────────────────────

def get_creator_fee_rate(user):
    """Return the Decimal fee rate for a user based on their tier."""
    from .models import UserProfile
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return Decimal('0.10')

    config = _get_config()
    rate_str = config.fee_rates.get(profile.tier, '0.10')
    return Decimal(rate_str)


def get_project_fee_rate(item):
    """Return the best (lowest) fee rate among all collaborators on the item.

    `item` can be a Chapter, Content, or ComicIssue — anything with
    `get_collaborators_with_wallets()` or a `.creator` attribute.
    """
    from .models import UserProfile

    collaborator_users = []
    if hasattr(item, 'get_collaborators_with_wallets'):
        try:
            collabs = item.get_collaborators_with_wallets()
            collaborator_users = [c['user'] for c in collabs]
        except Exception:
            pass

    if not collaborator_users and hasattr(item, 'creator'):
        collaborator_users = [item.creator]

    if not collaborator_users:
        return Decimal('0.10')

    config = _get_config()
    best_rate = Decimal('0.10')

    user_ids = [u.id for u in collaborator_users]
    profiles = {p.user_id: p for p in UserProfile.objects.filter(user_id__in=user_ids)}

    for u in collaborator_users:
        p = profiles.get(u.id)
        if p:
            rate_str = config.fee_rates.get(p.tier, '0.10')
            rate = Decimal(rate_str)
            if rate < best_rate:
                best_rate = rate

    return best_rate


def process_sale_for_tiers(purchase, item, sale_amount):
    """Called after a purchase completes. Updates tier-related data.

    1. Credits lifetime_project_sales for ALL collaborators (full sale amount).
    2. Updates project total_sales.
    3. Checks founding threshold (atomic).
    4. Checks level progression for all collaborators.
    """
    from .models import UserProfile, CollaborativeProject, FoundingCreatorSlot, TierConfiguration

    sale_amount = Decimal(str(sale_amount))
    if sale_amount <= 0:
        return

    # Determine collaborators
    collaborator_users = []
    if hasattr(item, 'get_collaborators_with_wallets'):
        try:
            collabs = item.get_collaborators_with_wallets()
            collaborator_users = [c['user'] for c in collabs]
        except Exception:
            pass
    if not collaborator_users and hasattr(item, 'creator'):
        collaborator_users = [item.creator]

    if not collaborator_users:
        logger.warning(f'[Tiers] No collaborators found for item {item}')
        return

    # Find the project (if collaborative)
    project = _get_project_for_item(item)

    # Credit lifetime_project_sales to ALL collaborators
    user_ids = [u.id for u in collaborator_users]
    profiles = list(UserProfile.objects.filter(user_id__in=user_ids))
    for profile in profiles:
        profile.lifetime_project_sales = (profile.lifetime_project_sales or Decimal('0')) + sale_amount
        profile.save(update_fields=['lifetime_project_sales'])
        logger.info(f'[Tiers] Credited ${sale_amount} to {profile.username} lifetime_project_sales (now ${profile.lifetime_project_sales})')

    # Update project total_sales and check founding
    if project:
        with transaction.atomic():
            proj = CollaborativeProject.objects.select_for_update().get(pk=project.pk)
            proj.total_sales = (proj.total_sales or Decimal('0')) + sale_amount
            proj.save(update_fields=['total_sales'])

            config = TierConfiguration.objects.select_for_update().get(pk=1)

            # Check founding threshold
            if (not proj.founding_qualification_triggered
                    and proj.total_sales >= config.founding_threshold
                    and config.founding_slots_claimed < config.founding_slots_total):

                proj.founding_qualification_triggered = True
                proj.save(update_fields=['founding_qualification_triggered'])

                # Claim founding slots for eligible collaborators
                slots_available = config.founding_slots_total - config.founding_slots_claimed
                new_founders = 0
                for u in collaborator_users:
                    if new_founders >= slots_available:
                        break
                    # Don't double-award founding to the same user
                    already_founding = FoundingCreatorSlot.objects.filter(user=u).exists()
                    if already_founding:
                        continue
                    FoundingCreatorSlot.objects.create(
                        user=u,
                        project=proj,
                        qualifying_sale_amount=proj.total_sales,
                    )
                    # Upgrade tier
                    try:
                        profile = u.profile
                        if _tier_rank('founding') < _tier_rank(profile.tier):
                            profile.tier = 'founding'
                            profile.tier_qualified_at = timezone.now()
                            profile.save(update_fields=['tier', 'tier_qualified_at'])
                            logger.info(f'[Tiers] {profile.username} upgraded to FOUNDING')
                    except UserProfile.DoesNotExist:
                        pass
                    new_founders += 1

                config.founding_slots_claimed += new_founders
                config.save(update_fields=['founding_slots_claimed'])
                logger.info(f'[Tiers] {new_founders} new founding creators claimed on project {proj.title}')

    # Check level progression for all collaborators
    _check_level_progression(profiles)


def get_tier_progress(user):
    """Return a dict for dashboard display."""
    from .models import UserProfile, FoundingCreatorSlot

    try:
        profile = user.profile
    except Exception:
        return {'tier': 'standard', 'fee_rate': '0.10', 'lifetime_project_sales': '0.00'}

    config = _get_config()
    fee_rate = config.fee_rates.get(profile.tier, '0.10')

    # Determine next level
    sorted_levels = sorted(
        config.level_thresholds.items(),
        key=lambda x: x[1]
    )
    next_level = None
    next_threshold = None
    sales = float(profile.lifetime_project_sales or 0)

    for level_name, threshold in sorted_levels:
        if float(threshold) > sales:
            # Only show next level if it would be an upgrade
            if _tier_rank(level_name) < _tier_rank(profile.tier):
                next_level = level_name
                next_threshold = threshold
                break

    is_founding = profile.tier == 'founding'
    founding_slot = None
    if is_founding:
        slot = FoundingCreatorSlot.objects.filter(user=user).first()
        if slot:
            founding_slot = {
                'project': slot.project.title,
                'claimed_at': slot.claimed_at.isoformat(),
                'qualifying_amount': str(slot.qualifying_sale_amount),
            }

    return {
        'tier': profile.tier,
        'fee_rate': fee_rate,
        'fee_percent': f'{Decimal(fee_rate) * 100:.0f}%',
        'lifetime_project_sales': str(profile.lifetime_project_sales or 0),
        'next_level': next_level,
        'next_threshold': str(next_threshold) if next_threshold else None,
        'progress_to_next': str(round(sales / float(next_threshold) * 100, 1)) if next_threshold else None,
        'is_founding': is_founding,
        'founding_slot': founding_slot,
    }


def get_founding_status():
    """Return global founding race info."""
    config = _get_config()
    return {
        'slots_total': config.founding_slots_total,
        'slots_claimed': config.founding_slots_claimed,
        'slots_remaining': config.founding_slots_total - config.founding_slots_claimed,
        'threshold': str(config.founding_threshold),
        'is_open': config.founding_slots_claimed < config.founding_slots_total,
    }


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _get_project_for_item(item):
    """Try to find the CollaborativeProject associated with an item."""
    from .models import CollaborativeProject

    # Chapter → book_project → collaborative project?
    if hasattr(item, 'book_project') and item.book_project:
        bp = item.book_project
        if hasattr(bp, 'published_content') and bp.published_content:
            try:
                return bp.published_content.source_collaborative_project.first()
            except Exception:
                pass

    # Content → source_collaborative_project
    if hasattr(item, 'source_collaborative_project'):
        try:
            proj = item.source_collaborative_project.first()
            if proj:
                return proj
        except Exception:
            pass

    # ComicIssue → project
    if hasattr(item, 'project') and item.project:
        return item.project

    return None


def _check_level_progression(profiles):
    """Check and upgrade tier levels for a list of profiles. Never downgrades."""
    config = _get_config()
    # Sort thresholds descending so we check highest level first
    sorted_levels = sorted(
        config.level_thresholds.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    for profile in profiles:
        if profile.tier == 'founding':
            continue  # Founding is highest, skip

        sales = float(profile.lifetime_project_sales or 0)
        for level_name, threshold in sorted_levels:
            if sales >= float(threshold) and _tier_rank(level_name) < _tier_rank(profile.tier):
                profile.tier = level_name
                profile.tier_qualified_at = timezone.now()
                profile.save(update_fields=['tier', 'tier_qualified_at'])
                logger.info(f'[Tiers] {profile.username} upgraded to {level_name} (${sales} lifetime sales)')
                break
