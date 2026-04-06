"""
Notification Utility Functions
Helper functions to create notifications for collaboration events
"""

import logging
from decimal import Decimal
from typing import List, Optional
from rb_core.models import (
    Notification, NotificationPreference, User,
    CollaborativeProject, CollaboratorRole, NOTIFICATION_DEFAULTS,
)

logger = logging.getLogger(__name__)


def get_notification_preference(user: User, notification_type: str) -> dict:
    """Return effective preference for a user + notification type.

    Checks the DB for an explicit override; falls back to NOTIFICATION_DEFAULTS.
    """
    try:
        pref = NotificationPreference.objects.get(
            user=user, notification_type=notification_type
        )
        return {'in_app': pref.in_app, 'email': pref.email}
    except NotificationPreference.DoesNotExist:
        return NOTIFICATION_DEFAULTS.get(
            notification_type, {'in_app': True, 'email': False}
        )


def create_notification(
    recipient: User,
    from_user: User,
    notification_type: str,
    title: str,
    message: str,
    project: Optional[CollaborativeProject] = None,
    action_url: Optional[str] = None,
    contract_task=None,
    campaign=None,
    action_required: bool = False,
    action_options: Optional[list] = None,
    expires_at=None,
) -> Optional[Notification]:
    """
    Create a new notification, respecting user preferences.

    Returns None if the user has opted out of in-app for this type.
    Queues an email via Celery if the user has email enabled.

    Supports actionable notifications with action_required, action_options,
    contract_task, campaign, and expires_at for escrow/campaign lifecycle events.
    """
    pref = get_notification_preference(recipient, notification_type)
    resolved_action_url = action_url or (f'/studio/{project.id}' if project else '')

    notification = None
    if pref['in_app']:
        notification = Notification.objects.create(
            recipient=recipient,
            from_user=from_user,
            notification_type=notification_type,
            title=title,
            message=message,
            project=project,
            contract_task=contract_task,
            campaign=campaign,
            action_url=resolved_action_url,
            action_required=action_required,
            action_options=action_options or [],
            expires_at=expires_at,
        )

    if pref['email'] and getattr(recipient, 'email', None):
        try:
            from rb_core.tasks import send_notification_email
            send_notification_email.delay(
                recipient_id=recipient.id,
                title=title,
                message=message,
                notification_type=notification_type,
                action_url=resolved_action_url,
            )
        except Exception:
            logger.exception('Failed to queue notification email for user %s', recipient.id)

    return notification


def notify_collaboration_invitation(
    inviter: User,
    invitee: User,
    project: CollaborativeProject,
    role: str
) -> Notification:
    """
    Notify user of a collaboration invitation.

    Args:
        inviter: User who sent the invitation
        invitee: User who received the invitation
        project: Collaborative project they're invited to
        role: Role they're invited as

    Returns:
        Created Notification instance
    """
    return create_notification(
        recipient=invitee,
        from_user=inviter,
        notification_type='invitation',
        title=f'Collaboration Invitation: {project.title}',
        message=f'{inviter.username} invited you to join "{project.title}" as {role}',
        project=project,
        action_url=f'/studio/{project.id}'
    )


def notify_invitation_response(
    collaborator_role: CollaboratorRole,
    accepted: bool
) -> List[Notification]:
    """
    Notify project creator and collaborators of invitation response.

    Args:
        collaborator_role: CollaboratorRole that was accepted/declined
        accepted: Whether invitation was accepted

    Returns:
        List of created Notification instances
    """
    project = collaborator_role.project
    responder = collaborator_role.user
    status_text = 'accepted' if accepted else 'declined'

    notifications = []

    # Notify project creator
    if project.created_by != responder:
        notification = create_notification(
            recipient=project.created_by,
            from_user=responder,
            notification_type='invitation_response',
            title=f'Invitation {status_text.capitalize()}',
            message=f'{responder.username} {status_text} your invitation to "{project.title}"',
            project=project
        )
        if notification:
            notifications.append(notification)

    # Notify other accepted collaborators (if accepted)
    if accepted:
        other_collaborators = project.collaborators.filter(
            status='accepted'
        ).exclude(
            user=responder
        ).exclude(
            user=project.created_by
        )

        for collab in other_collaborators:
            notification = create_notification(
                recipient=collab.user,
                from_user=responder,
                notification_type='invitation_response',
                title=f'New Collaborator Joined',
                message=f'{responder.username} joined "{project.title}" as {collaborator_role.role}',
                project=project
            )
            if notification:
                notifications.append(notification)

    return notifications


def notify_section_update(
    updater: User,
    project: CollaborativeProject,
    section_title: str
) -> List[Notification]:
    """
    Notify collaborators when a project section is updated.

    Args:
        updater: User who updated the section
        project: Collaborative project
        section_title: Title of the updated section

    Returns:
        List of created Notification instances
    """
    notifications = []

    # Get all active collaborators except the updater
    collaborators = project.collaborators.filter(
        status='accepted'
    ).exclude(user=updater)

    # Also notify project creator if they're not the updater
    recipients = set([collab.user for collab in collaborators])
    if project.created_by != updater:
        recipients.add(project.created_by)

    for recipient in recipients:
        notification = create_notification(
            recipient=recipient,
            from_user=updater,
            notification_type='section_update',
            title=f'Section Updated: {section_title}',
            message=f'{updater.username} updated "{section_title}" in "{project.title}"',
            project=project
        )
        if notification:
            notifications.append(notification)

    return notifications


def notify_comment_added(
    commenter: User,
    project: CollaborativeProject,
    comment_preview: str
) -> List[Notification]:
    """
    Notify collaborators when a comment is added to a project.

    Args:
        commenter: User who added the comment
        project: Collaborative project
        comment_preview: Preview of the comment text (first 100 chars)

    Returns:
        List of created Notification instances
    """
    notifications = []

    # Get all active collaborators except the commenter
    collaborators = project.collaborators.filter(
        status='accepted'
    ).exclude(user=commenter)

    # Also notify project creator if they're not the commenter
    recipients = set([collab.user for collab in collaborators])
    if project.created_by != commenter:
        recipients.add(project.created_by)

    for recipient in recipients:
        notification = create_notification(
            recipient=recipient,
            from_user=commenter,
            notification_type='comment',
            title=f'New Comment on {project.title}',
            message=f'{commenter.username}: {comment_preview[:100]}...',
            project=project
        )
        if notification:
            notifications.append(notification)

    return notifications


def notify_approval_status_change(
    collaborator_role: CollaboratorRole,
    approval_type: str
) -> List[Notification]:
    """
    Notify when a collaborator approves the current version or revenue split.

    Args:
        collaborator_role: CollaboratorRole with approval change
        approval_type: Either 'version' or 'revenue'

    Returns:
        List of created Notification instances
    """
    project = collaborator_role.project
    approver = collaborator_role.user
    notifications = []

    approval_text = 'current version' if approval_type == 'version' else 'revenue split'

    # Notify project creator
    if project.created_by != approver:
        notification = create_notification(
            recipient=project.created_by,
            from_user=approver,
            notification_type='approval',
            title=f'Approval: {approval_text.capitalize()}',
            message=f'{approver.username} approved the {approval_text} for "{project.title}"',
            project=project
        )
        if notification:
            notifications.append(notification)

    # Check if project is now fully approved
    if project.is_fully_approved():
        # Notify all collaborators that project is ready
        all_collaborators = project.collaborators.filter(status='accepted')
        recipients = set([collab.user for collab in all_collaborators])
        if project.created_by not in recipients:
            recipients.add(project.created_by)

        for recipient in recipients:
            notification = create_notification(
                recipient=recipient,
                from_user=approver,  # Last approver gets credit
                notification_type='mint_ready',
                title=f'Comic Ready for Minting!',
                message=f'"{project.title}" has been fully approved and is ready to mint',
                project=project
            )
            if notification:
                notifications.append(notification)

    return notifications


def notify_revenue_proposal(
    proposer: User,
    project: CollaborativeProject,
    changes_summary: str
) -> List[Notification]:
    """
    Notify collaborators of a new revenue split proposal.

    Args:
        proposer: User who proposed the change
        project: Collaborative project
        changes_summary: Summary of the proposed changes

    Returns:
        List of created Notification instances
    """
    notifications = []

    # Get all active collaborators except the proposer
    collaborators = project.collaborators.filter(
        status='accepted'
    ).exclude(user=proposer)

    # Also notify project creator if they're not the proposer
    recipients = set([collab.user for collab in collaborators])
    if project.created_by != proposer:
        recipients.add(project.created_by)

    for recipient in recipients:
        notification = create_notification(
            recipient=recipient,
            from_user=proposer,
            notification_type='revenue_proposal',
            title=f'Revenue Split Proposal',
            message=f'{proposer.username} proposed changes to revenue split: {changes_summary}',
            project=project
        )
        if notification:
            notifications.append(notification)

    return notifications


def notify_counter_proposal(
    proposer: User,
    project: CollaborativeProject,
    proposed_percentage: float,
    message: str
) -> Notification:
    """
    Notify project creator of a counter-proposal from an invited collaborator.

    Args:
        proposer: User who is counter-proposing
        project: Collaborative project
        proposed_percentage: The counter-proposed revenue percentage
        message: Message explaining the counter-proposal

    Returns:
        Created Notification instance
    """
    message_preview = message[:100] + '...' if len(message) > 100 else message

    return create_notification(
        recipient=project.created_by,
        from_user=proposer,
        notification_type='counter_proposal',
        title=f'Counter Proposal: {project.title}',
        message=f'{proposer.username} proposed {proposed_percentage}% revenue: "{message_preview}"',
        project=project,
        action_url=f'/studio/{project.id}'
    )


def notify_content_purchase(
    recipient: User,
    buyer: User,
    content_title: str,
    amount_usdc: Decimal,
    role: str = None
) -> Notification:
    """
    Notify creator when their content is purchased.

    Args:
        recipient: Creator receiving the payment
        buyer: User who purchased the content
        content_title: Title of the purchased content
        amount_usdc: Amount earned in USDC
        role: Optional role description (e.g., 'author', 'editor')

    Returns:
        Created Notification instance
    """
    formatted_amount = f"${amount_usdc:.2f}"

    if role:
        message = f'Someone purchased "{content_title}" - you earned {formatted_amount} USDC as {role}'
    else:
        message = f'Someone purchased "{content_title}" - you earned {formatted_amount} USDC'

    return create_notification(
        recipient=recipient,
        from_user=buyer,
        notification_type='content_purchase',
        title=f'New Sale: {content_title}',
        message=message,
        action_url='/profile'
    )


# ========== ESCROW NOTIFICATIONS ==========


def notify_escrow_funded(
    funder: User,
    collaborator: CollaboratorRole,
) -> Optional[Notification]:
    """Notify collaborator that escrow has been funded for their contract."""
    project = collaborator.project
    amount = f"${collaborator.total_contract_amount:.2f}"
    return create_notification(
        recipient=collaborator.user,
        from_user=funder,
        notification_type='approval',
        title=f'Escrow Funded: {project.title}',
        message=f'{funder.username} funded {amount} escrow for your {collaborator.effective_role_name} work on "{project.title}"',
        project=project,
    )


def notify_milestone_payment(
    collaborator: CollaboratorRole,
    task_title: str,
    amount: Decimal,
) -> Optional[Notification]:
    """Notify collaborator they received a milestone payment."""
    project = collaborator.project
    return create_notification(
        recipient=collaborator.user,
        from_user=project.created_by,
        notification_type='content_purchase',
        title=f'Milestone Payment: ${amount:.2f}',
        message=f'You received ${amount:.2f} for completing "{task_title}" on "{project.title}"',
        project=project,
    )


def notify_auto_approve_warning(
    writer: User,
    collaborator: CollaboratorRole,
    task_title: str,
    hours_remaining: int,
) -> Optional[Notification]:
    """Warn writer that a task will auto-approve soon."""
    project = collaborator.project
    return create_notification(
        recipient=writer,
        from_user=collaborator.user,
        notification_type='approval',
        title=f'Review Deadline: {task_title}',
        message=f'"{task_title}" on "{project.title}" will auto-approve in {hours_remaining} hours if not reviewed',
        project=project,
    )


def notify_auto_approved(
    writer: User,
    collaborator: CollaboratorRole,
    task_title: str,
    amount: Decimal,
) -> List[Optional[Notification]]:
    """Notify both writer and collaborator that a task was auto-approved."""
    project = collaborator.project
    notifications = []

    notifications.append(create_notification(
        recipient=writer,
        from_user=collaborator.user,
        notification_type='approval',
        title=f'Auto-Approved: {task_title}',
        message=f'"{task_title}" on "{project.title}" was auto-approved (review window expired). ${amount:.2f} released.',
        project=project,
    ))

    notifications.append(create_notification(
        recipient=collaborator.user,
        from_user=writer,
        notification_type='content_purchase',
        title=f'Payment Released: ${amount:.2f}',
        message=f'"{task_title}" on "{project.title}" was auto-approved. ${amount:.2f} released to you.',
        project=project,
    ))

    return notifications


def notify_revision_limit_reached(
    writer: User,
    collaborator: CollaboratorRole,
    task_title: str,
) -> Optional[Notification]:
    """Notify writer that revision limit has been reached on a task."""
    project = collaborator.project
    return create_notification(
        recipient=writer,
        from_user=collaborator.user,
        notification_type='approval',
        title=f'Revision Limit Reached: {task_title}',
        message=f'Revision limit reached on "{task_title}" in "{project.title}". A contract amendment is needed for additional revisions.',
        project=project,
    )


def notify_trust_phase_complete(
    collaborator: CollaboratorRole,
) -> List[Optional[Notification]]:
    """Notify both parties that trust phase is complete."""
    project = collaborator.project
    writer = project.created_by
    notifications = []

    notifications.append(create_notification(
        recipient=writer,
        from_user=collaborator.user,
        notification_type='approval',
        title=f'Trust Phase Complete: {project.title}',
        message=f'{collaborator.user.username} completed the trust-building phase on "{project.title}". Production milestones are now active.',
        project=project,
    ))

    notifications.append(create_notification(
        recipient=collaborator.user,
        from_user=writer,
        notification_type='approval',
        title=f'Trust Phase Complete: {project.title}',
        message=f'You completed the trust-building phase on "{project.title}". Moving to production milestones.',
        project=project,
    ))

    return notifications


def bulk_mark_as_read(user: User, notification_ids: List[int]) -> int:
    """
    Mark multiple notifications as read.

    Args:
        user: User whose notifications to mark
        notification_ids: List of notification IDs

    Returns:
        Number of notifications marked as read
    """
    from django.utils import timezone

    count = Notification.objects.filter(
        recipient=user,
        id__in=notification_ids,
        read=False
    ).update(
        read=True,
        read_at=timezone.now()
    )

    return count


# ============================================================
# Escrow Lifecycle Notification Helpers
# ============================================================

def notify_deadline_passed(task) -> Optional[Notification]:
    """Notify writer that a milestone deadline has passed — actionable with 48hr window."""
    from datetime import timedelta
    from django.utils import timezone

    role = task.collaborator_role
    project = role.project
    writer = project.created_by

    return create_notification(
        recipient=writer,
        from_user=role.user,
        notification_type='deadline_passed',
        title=f'Deadline Passed: {task.title}',
        message=(
            f'The deadline for "{task.title}" on "{project.title}" has passed. '
            f'You have 48 hours to extend the deadline, reassign the milestone, or request a refund. '
            f'If no action is taken, the escrow will be automatically refunded.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'extend', 'label': 'Extend Deadline', 'style': 'primary'},
            {'key': 'reassign', 'label': 'Reassign', 'style': 'secondary'},
            {'key': 'refund', 'label': 'Refund', 'style': 'danger'},
        ],
        expires_at=task.grace_deadline,
    )


def notify_milestone_submitted(task) -> Optional[Notification]:
    """Notify writer that artist submitted a milestone for review."""
    role = task.collaborator_role
    project = role.project

    return create_notification(
        recipient=project.created_by,
        from_user=role.user,
        notification_type='milestone_submitted',
        title=f'Milestone Submitted: {task.title}',
        message=f'{role.user.username} submitted "{task.title}" on "{project.title}" for your review.',
        project=project,
        contract_task=task,
    )


def notify_final_rejection(task) -> List[Optional[Notification]]:
    """Notify both parties that revision limit is exhausted."""
    role = task.collaborator_role
    project = role.project
    writer = project.created_by
    notifications = []

    # Notify writer with action options
    notifications.append(create_notification(
        recipient=writer,
        from_user=role.user,
        notification_type='final_rejection',
        title=f'Revision Limit Reached: {task.title}',
        message=(
            f'The revision limit ({task.revision_limit}) has been reached for "{task.title}". '
            f'You can accept the work as-is, cancel and refund, or reassign to a new artist.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'accept_as_is', 'label': 'Accept & Release', 'style': 'primary'},
            {'key': 'reassign', 'label': 'Reassign', 'style': 'secondary'},
            {'key': 'cancel', 'label': 'Cancel & Refund', 'style': 'danger'},
        ],
    ))

    # Notify artist
    notifications.append(create_notification(
        recipient=role.user,
        from_user=writer,
        notification_type='final_rejection',
        title=f'Revision Limit Reached: {task.title}',
        message=(
            f'The revision limit for "{task.title}" has been reached. '
            f'The project owner will decide the next step.'
        ),
        project=project,
        contract_task=task,
    ))

    return notifications


def notify_rating_requested(task, user) -> Optional[Notification]:
    """Remind a user to rate a completed milestone."""
    role = task.collaborator_role
    project = role.project

    return create_notification(
        recipient=user,
        from_user=project.created_by if user == role.user else role.user,
        notification_type='rating_requested',
        title=f'Rate Milestone: {task.title}',
        message=(
            f'Please rate the work on "{task.title}" in "{project.title}". '
            f'Both parties must rate before the next milestone can begin.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'rate', 'label': 'Rate Now', 'style': 'primary'},
        ],
    )


def notify_artist_stalled(task) -> Optional[Notification]:
    """Notify writer that an artist appears stalled (7+ days past deadline)."""
    role = task.collaborator_role
    project = role.project

    return create_notification(
        recipient=project.created_by,
        from_user=role.user,
        notification_type='inactivity_warning',
        title=f'Artist Stalled: {task.title}',
        message=(
            f'{role.user.username} has not submitted work for "{task.title}" — '
            f'7+ days past deadline. You can extend, reassign, or request a refund.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'extend', 'label': 'Extend Deadline', 'style': 'primary'},
            {'key': 'reassign', 'label': 'Reassign', 'style': 'secondary'},
            {'key': 'refund', 'label': 'Refund', 'style': 'danger'},
        ],
    )


def notify_scope_change(task, scope_change) -> Optional[Notification]:
    """Notify writer that artist flagged a scope change."""
    role = task.collaborator_role
    project = role.project

    return create_notification(
        recipient=project.created_by,
        from_user=role.user,
        notification_type='scope_change',
        title=f'Scope Change: {task.title}',
        message=(
            f'{role.user.username} flagged extra scope on "{task.title}": '
            f'{scope_change.description[:100]}. Deadline timer is paused. '
            f'You have 48 hours to respond before the timer auto-resumes.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'withdraw', 'label': 'Remove Extra Scope', 'style': 'secondary'},
            {'key': 'increase_amount', 'label': 'Increase Amount', 'style': 'primary'},
            {'key': 'add_milestone', 'label': 'Add New Milestone', 'style': 'primary'},
        ],
        expires_at=scope_change.auto_resume_at,
    )


def notify_reassignment_offer(reassignment) -> Optional[Notification]:
    """Notify new artist about a reassignment offer."""
    task = reassignment.original_task
    project = task.collaborator_role.project

    return create_notification(
        recipient=reassignment.new_artist,
        from_user=project.created_by,
        notification_type='reassignment_offer',
        title=f'Milestone Offer: {task.title}',
        message=(
            f'{project.created_by.username} wants to reassign "{task.title}" on "{project.title}" to you. '
            f'Payment: ${task.payment_amount}.'
        ),
        project=project,
        contract_task=task,
        action_required=True,
        action_options=[
            {'key': 'accept', 'label': 'Accept', 'style': 'primary'},
            {'key': 'decline', 'label': 'Decline', 'style': 'secondary'},
        ],
    )


def notify_project_cancelled(project, cancelled_by) -> List[Optional[Notification]]:
    """Notify all collaborators about project cancellation."""
    notifications = []
    for role in project.collaborators.filter(status='accepted'):
        if role.user == cancelled_by:
            continue
        notifications.append(create_notification(
            recipient=role.user,
            from_user=cancelled_by,
            notification_type='project_cancelled',
            title=f'Project Cancelled: {project.title}',
            message=(
                f'"{project.title}" has been cancelled by {cancelled_by.username}. '
                f'Remaining escrow funds will be refunded.'
            ),
            project=project,
        ))
    return notifications




def delete_project_notifications(project: CollaborativeProject) -> int:
    """
    Delete all notifications related to a project (e.g., when project is deleted).

    Args:
        project: Collaborative project

    Returns:
        Number of notifications deleted
    """
    count, _ = Notification.objects.filter(project=project).delete()
    return count


def get_unread_count(user: User) -> int:
    """
    Get count of unread notifications for a user.

    Args:
        user: User to check

    Returns:
        Count of unread notifications
    """
    return Notification.objects.filter(
        recipient=user,
        read=False
    ).count()


# ============================================================
# Campaign Notification Helpers
# ============================================================

def _notify_all_backers(campaign, notification_type: str, title: str, message: str):
    """Bulk-create notifications for all confirmed, non-withdrawn backers."""
    contributions = campaign.contributions.filter(
        status__in=['confirmed', 'transferred'], withdrawn=False
    ).select_related('backer')
    notifications = [
        Notification(
            recipient=c.backer,
            from_user=campaign.creator,
            notification_type=notification_type,
            title=title,
            message=message,
            campaign=campaign,
            action_url=f'/campaigns/{campaign.id}',
        )
        for c in contributions
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)


def notify_campaign_backed(backer_user: User, campaign) -> Optional[Notification]:
    """Confirm backing to the backer."""
    return create_notification(
        recipient=backer_user,
        from_user=campaign.creator,
        notification_type='campaign_backed',
        title=f'Backed: {campaign.title}',
        message=f'You backed "{campaign.title}". Thank you for your support!',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_new_backer(backer_user: User, campaign) -> Optional[Notification]:
    """Alert creator about a new backer."""
    return create_notification(
        recipient=campaign.creator,
        from_user=backer_user,
        notification_type='campaign_new_backer',
        title=f'New Backer: {campaign.title}',
        message=f'{backer_user.username} backed "{campaign.title}".',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_goal_reached(campaign) -> Optional[Notification]:
    """Notify creator that campaign reached its funding goal."""
    return create_notification(
        recipient=campaign.creator,
        from_user=campaign.creator,
        notification_type='campaign_goal_reached',
        title=f'Goal Reached: {campaign.title}',
        message=f'"{campaign.title}" has reached its funding goal of ${campaign.funding_goal}!',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_funded(campaign):
    """Bulk notify all backers that campaign is funded."""
    _notify_all_backers(
        campaign,
        'campaign_funded',
        f'Campaign Funded: {campaign.title}',
        f'"{campaign.title}" has reached its funding goal of ${campaign.funding_goal}!',
    )


def notify_campaign_failed(campaign):
    """Bulk notify all backers that campaign failed."""
    _notify_all_backers(
        campaign,
        'campaign_failed',
        f'Campaign Not Funded: {campaign.title}',
        f'"{campaign.title}" did not reach its funding goal. Your contribution will be refunded.',
    )


def notify_campaign_launched(campaign) -> Optional[Notification]:
    """Confirm campaign launch to creator."""
    return create_notification(
        recipient=campaign.creator,
        from_user=campaign.creator,
        notification_type='campaign_launched',
        title=f'Campaign Live: {campaign.title}',
        message=f'"{campaign.title}" is now live and accepting backers!',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_backer_withdrew(backer_user: User, campaign) -> Optional[Notification]:
    """Notify creator that a backer withdrew."""
    return create_notification(
        recipient=campaign.creator,
        from_user=backer_user,
        notification_type='campaign_withdrew',
        title=f'Backer Withdrew: {campaign.title}',
        message=f'A backer withdrew their contribution from "{campaign.title}".',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_stretch_reached(campaign, stretch_goal):
    """Bulk notify all backers that a stretch goal was reached."""
    _notify_all_backers(
        campaign,
        'campaign_stretch_hit',
        f'Stretch Goal Unlocked: {stretch_goal.title}',
        f'"{campaign.title}" unlocked stretch goal "{stretch_goal.title}" at ${stretch_goal.threshold_amount}!',
    )


def notify_campaign_role_interest(user: User, campaign, role_name: str) -> Optional[Notification]:
    """Notify creator that someone expressed interest in an open role."""
    return create_notification(
        recipient=campaign.creator,
        from_user=user,
        notification_type='campaign_role_interest',
        title=f'Role Interest: {role_name}',
        message=f'{user.username} expressed interest in the {role_name} role on "{campaign.title}".',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_team_joined(campaign, user: User, role_name: str):
    """Bulk notify all backers that a team member joined."""
    _notify_all_backers(
        campaign,
        'campaign_team_joined',
        f'Team Update: {campaign.title}',
        f'{user.username} has joined "{campaign.title}" as {role_name}.',
    )


def notify_campaign_team_complete(campaign):
    """Bulk notify all backers that all roles are filled."""
    _notify_all_backers(
        campaign,
        'campaign_team_complete',
        f'Team Complete: {campaign.title}',
        f'All roles on "{campaign.title}" are now filled! The team is ready for production.',
    )


def notify_campaign_update_posted(campaign, update):
    """Bulk notify all backers about a new campaign update."""
    _notify_all_backers(
        campaign,
        'campaign_prod_update',
        f'Update: {update.title}',
        f'{campaign.creator.username} posted an update on "{campaign.title}": {update.title}',
    )


def notify_campaign_role_deadline_warning(campaign, role_name: str, days_remaining: int) -> Optional[Notification]:
    """Warn creator that a role assignment deadline is approaching."""
    return create_notification(
        recipient=campaign.creator,
        from_user=campaign.creator,
        notification_type='campaign_role_warn',
        title=f'Role Deadline: {role_name}',
        message=(
            f'The {role_name} role on "{campaign.title}" must be filled within {days_remaining} days '
            f'or its milestones will be refunded to backers.'
        ),
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_campaign_role_refunded(campaign, role_name: str):
    """Notify creator and backers that unfilled role milestones were refunded."""
    create_notification(
        recipient=campaign.creator,
        from_user=campaign.creator,
        notification_type='campaign_role_refund',
        title=f'Role Refunded: {role_name}',
        message=f'The {role_name} role on "{campaign.title}" was not filled. Milestones have been refunded to backers.',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )
    _notify_all_backers(
        campaign,
        'campaign_partial_refund',
        f'Partial Refund: {campaign.title}',
        f'The {role_name} role on "{campaign.title}" was not filled. A proportional refund is being processed.',
    )


def notify_campaign_complete(campaign):
    """Bulk notify all backers that the campaign project is complete."""
    _notify_all_backers(
        campaign,
        'campaign_complete',
        f'Project Complete: {campaign.title}',
        f'"{campaign.title}" has been completed! Your rewards will be fulfilled soon.',
    )


def notify_campaign_refund(campaign, contribution, amount):
    """Notify a backer that their refund has been processed."""
    return create_notification(
        recipient=contribution.backer,
        from_user=campaign.creator,
        notification_type='campaign_refund',
        title=f'Refund Processed: {campaign.title}',
        message=f'Your refund of ${amount:.2f} for "{campaign.title}" has been processed.',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )


def notify_backer_content_access(contribution, milestone) -> Optional[Notification]:
    """Notify backer that they have access to completed work."""
    campaign = contribution.campaign
    return create_notification(
        recipient=contribution.backer,
        from_user=campaign.creator,
        notification_type='backer_content_access',
        title=f'Content Unlocked: {milestone.title}',
        message=f'You now have access to completed work from "{milestone.title}" on "{campaign.title}".',
        campaign=campaign,
        action_url=f'/campaigns/{campaign.id}',
    )
