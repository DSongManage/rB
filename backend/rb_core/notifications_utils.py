"""
Notification Utility Functions
Helper functions to create notifications for collaboration events
"""

from decimal import Decimal
from typing import List, Optional
from rb_core.models import Notification, User, CollaborativeProject, CollaboratorRole


def create_notification(
    recipient: User,
    from_user: User,
    notification_type: str,
    title: str,
    message: str,
    project: Optional[CollaborativeProject] = None,
    action_url: Optional[str] = None
) -> Notification:
    """
    Create a new notification.

    Args:
        recipient: User who receives the notification
        from_user: User who triggered the notification
        notification_type: Type of notification (see Notification.NOTIFICATION_TYPES)
        title: Short title for the notification
        message: Detailed message
        project: Optional related collaborative project
        action_url: Optional URL to navigate to

    Returns:
        Created Notification instance
    """
    return Notification.objects.create(
        recipient=recipient,
        from_user=from_user,
        notification_type=notification_type,
        title=title,
        message=message,
        project=project,
        action_url=action_url or (f'/collaborations/{project.id}' if project else '')
    )


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
        action_url=f'/collaborations/{project.id}'
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
                title=f'Project Ready for Minting!',
                message=f'"{project.title}" has been fully approved and is ready to mint',
                project=project
            )
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
        action_url=f'/collaborations/{project.id}'
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
