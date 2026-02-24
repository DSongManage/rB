"""Collaboration API views for multi-creator projects.

Provides endpoints for:
- Creating and managing collaborative projects
- Inviting and managing collaborators
- Creating and editing project sections
- Approval workflow for minting
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from datetime import datetime

from ..models import (
    CollaborativeProject, CollaboratorRole, ProjectSection,
    ProjectComment, User as CoreUser, Content, ContractTask, RoleDefinition,
    ComicPage
)
from ..serializers import (
    CollaborativeProjectSerializer, CollaborativeProjectListSerializer,
    CollaboratorRoleSerializer, ProjectSectionSerializer, ProjectCommentSerializer,
    ContractTaskSerializer, ContractTaskCreateSerializer, RoleDefinitionSerializer
)
from ..notifications_utils import (
    notify_collaboration_invitation, notify_invitation_response,
    notify_section_update, notify_comment_added, notify_approval_status_change,
    notify_revenue_proposal, notify_counter_proposal
)
from ..utils.copyright import get_author_display_name


class CollaborativeProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing collaborative projects.

    Users can view projects where they are creator or collaborator.
    Supports full CRUD operations plus collaboration-specific actions.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborativeProjectSerializer
    pagination_class = None  # Disable pagination for collaboration views

    def get_queryset(self):
        """Return projects where user is creator or accepted collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return CollaborativeProject.objects.none()

        # Projects created by user OR where user is a collaborator
        # Prefetch related objects to avoid N+1 queries
        return CollaborativeProject.objects.filter(
            Q(created_by=core_user) | Q(collaborators__user=core_user)
        ).select_related(
            'created_by'
        ).prefetch_related(
            'collaborators__user',
            'collaborators__contract_tasks',  # Include contract tasks for TaskTracker
            'sections',
            'comments__author'
        ).distinct()

    def get_serializer_class(self):
        """Use lightweight serializer for list view."""
        if self.action == 'list':
            return CollaborativeProjectListSerializer
        return CollaborativeProjectSerializer

    def perform_create(self, serializer):
        """Create project and add creator as first collaborator with 100% revenue."""
        # MVP: Music and Video content types are coming soon - reject creation attempts
        content_type = self.request.data.get('content_type', '').strip().lower()
        if content_type in ('music', 'video'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'content_type': 'Music and Video content types are coming soon. Please create Book or Art projects for now.'
            })

        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            core_user = CoreUser.objects.create_user(username=user.username)

        # Create project
        project = serializer.save(created_by=core_user)

        # Add creator as first collaborator with 100% revenue
        CollaboratorRole.objects.create(
            project=project,
            user=core_user,
            role='Project Lead',
            revenue_percentage=Decimal('100.00'),
            status='accepted',
            can_edit_text=True,
            can_edit_images=True,
            can_edit_audio=True,
            can_edit_video=True,
            approved_current_version=True,
            approved_revenue_split=True
        )

    @action(detail=True, methods=['post'])
    def invite_collaborator(self, request, pk=None):
        """Invite a collaborator to the project with contract tasks.

        POST data:
        - user_id: int (user to invite)
        - role: str (Author, Illustrator, etc.) - custom role name
        - role_definition_id: int (optional) - standard role template ID
        - permissions: dict (optional) - custom permission overrides
        - revenue_percentage: decimal (0-100)
        - can_edit_text: bool (legacy, still supported)
        - can_edit_images: bool (legacy, still supported)
        - can_edit_audio: bool (legacy, still supported)
        - can_edit_video: bool (legacy, still supported)
        - tasks: array of {title, description, deadline} (optional but recommended)
        """
        project = self.get_object()

        # Verify requester is project creator or has permission
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if project.created_by != core_user:
            return Response(
                {'error': 'Only project creator can invite collaborators'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get invited user
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invited_user = CoreUser.objects.get(id=user_id)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'Invited user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if already a collaborator
        if project.collaborators.filter(user=invited_user).exists():
            return Response(
                {'error': 'User is already a collaborator'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get collaboration details
        role = request.data.get('role', '')
        role_definition_id = request.data.get('role_definition_id')
        permissions = request.data.get('permissions', {})
        revenue_percentage = Decimal(str(request.data.get('revenue_percentage', 0)))

        # Get role definition if provided
        role_definition = None
        if role_definition_id:
            try:
                role_definition = RoleDefinition.objects.get(id=role_definition_id, is_active=True)
                # Validate role is applicable to this project type
                if not role_definition.is_applicable_to(project.content_type):
                    return Response(
                        {'error': f'Role "{role_definition.name}" is not applicable to {project.content_type} projects'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Use role definition name if custom role not provided
                if not role:
                    role = role_definition.name
            except RoleDefinition.DoesNotExist:
                return Response(
                    {'error': 'Role definition not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Fallback to 'Collaborator' if no role specified
        if not role:
            role = 'Collaborator'

        # Validate revenue percentage
        if revenue_percentage < 0 or revenue_percentage > 100:
            return Response(
                {'error': 'Revenue percentage must be between 0 and 100'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the inviter's (creator's) current collaborator role
        try:
            inviter_role = project.collaborators.get(user=core_user, status='accepted')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'You must be an accepted collaborator to invite others'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if inviter has enough revenue percentage to give away
        if inviter_role.revenue_percentage < revenue_percentage:
            return Response(
                {'error': f'You only have {inviter_role.revenue_percentage}% to allocate (requested: {revenue_percentage}%)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate tasks if provided
        tasks_data = request.data.get('tasks', [])
        if tasks_data:
            for i, task in enumerate(tasks_data):
                task_serializer = ContractTaskCreateSerializer(data=task)
                if not task_serializer.is_valid():
                    return Response(
                        {'error': f'Invalid task at index {i}', 'details': task_serializer.errors},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Create invitation within transaction
        with transaction.atomic():
            # Deduct revenue percentage from inviter's share
            inviter_role.revenue_percentage -= revenue_percentage
            inviter_role.save(update_fields=['revenue_percentage'])

            collaborator = CollaboratorRole.objects.create(
                project=project,
                user=invited_user,
                role=role,
                role_definition=role_definition,
                permissions=permissions,
                revenue_percentage=revenue_percentage,
                status='invited',
                can_edit_text=request.data.get('can_edit_text', False),
                can_edit_images=request.data.get('can_edit_images', False),
                can_edit_audio=request.data.get('can_edit_audio', False),
                can_edit_video=request.data.get('can_edit_video', False)
            )

            # Create contract tasks (status='pending' until accepted)
            for i, task_data in enumerate(tasks_data):
                ContractTask.objects.create(
                    collaborator_role=collaborator,
                    title=task_data.get('title'),
                    description=task_data.get('description', ''),
                    deadline=task_data.get('deadline'),
                    status='pending',
                    order=i
                )

            # Update task counts
            collaborator.tasks_total = len(tasks_data)
            collaborator.save(update_fields=['tasks_total'])

        # Send notification to invited user
        effective_role = collaborator.effective_role_name
        notify_collaboration_invitation(core_user, invited_user, project, effective_role)

        serializer = CollaboratorRoleSerializer(collaborator, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def accept_invitation(self, request, pk=None):
        """Accept a collaboration invitation and lock the contract.

        On acceptance:
        - Warranty of originality must be acknowledged
        - Contract becomes locked (immutable)
        - All pending tasks become 'in_progress'
        - Contract version is recorded
        - Contract effective date is set (defaults to acceptance time)
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find invitation
        try:
            invitation = project.collaborators.get(user=core_user, status='invited')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'No pending invitation found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get warranty acknowledgment from request
        warranty_acknowledged = request.data.get('warranty_of_originality_acknowledged', False)
        if not warranty_acknowledged:
            return Response(
                {'error': 'You must acknowledge the warranty of originality to accept this invitation'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Accept invitation and lock contract within transaction
        with transaction.atomic():
            now = timezone.now()

            # Accept invitation
            invitation.status = 'accepted'
            invitation.accepted_at = now

            # Record warranty acknowledgment
            invitation.warranty_of_originality_acknowledged = True
            invitation.warranty_acknowledged_at = now

            # Lock the contract
            invitation.contract_locked_at = now
            invitation.contract_version += 1

            # Set contract effective date (defaults to now if not already set)
            if not invitation.contract_effective_date:
                invitation.contract_effective_date = now

            invitation.save()

            # Activate all pending tasks (change from 'pending' to 'in_progress')
            invitation.contract_tasks.filter(status='pending').update(status='in_progress')

        # Notify project creator and other collaborators
        notify_invitation_response(invitation, accepted=True)

        serializer = CollaboratorRoleSerializer(invitation)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def decline_invitation(self, request, pk=None):
        """Decline a collaboration invitation."""
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find invitation
        try:
            invitation = project.collaborators.get(user=core_user, status='invited')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'No pending invitation found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Decline invitation and return revenue percentage to project creator
        with transaction.atomic():
            # Return revenue percentage to project creator
            try:
                creator_role = project.collaborators.get(user=project.created_by, status='accepted')
                creator_role.revenue_percentage += invitation.revenue_percentage
                creator_role.save(update_fields=['revenue_percentage'])
            except CollaboratorRole.DoesNotExist:
                pass  # Creator role doesn't exist (shouldn't happen)

            invitation.status = 'declined'
            invitation.save()

        # Notify project creator
        notify_invitation_response(invitation, accepted=False)

        return Response({'message': 'Invitation declined'})

    @action(detail=True, methods=['post'])
    def counter_propose(self, request, pk=None):
        """Submit a counter-proposal for a collaboration invitation.

        POST data:
        - proposed_percentage: decimal (0-100) - the counter-proposed revenue percentage
        - message: str - message explaining the counter-proposal
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find invitation
        try:
            invitation = project.collaborators.get(user=core_user, status='invited')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'No pending invitation found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get counter-proposal details
        proposed_percentage = request.data.get('proposed_percentage')
        message = request.data.get('message', '')

        if proposed_percentage is None:
            return Response(
                {'error': 'proposed_percentage is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            proposed_percentage = Decimal(str(proposed_percentage))
        except Exception:
            return Response(
                {'error': 'Invalid proposed_percentage value'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate percentage
        if proposed_percentage < 0 or proposed_percentage > 100:
            return Response(
                {'error': 'proposed_percentage must be between 0 and 100'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Store counter-proposal
        invitation.proposed_percentage = proposed_percentage
        invitation.counter_message = message
        invitation.save()

        # Notify project creator
        notify_counter_proposal(core_user, project, float(proposed_percentage), message)

        serializer = CollaboratorRoleSerializer(invitation)
        return Response({
            'message': 'Counter-proposal submitted',
            'invitation': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='respond-to-counter-proposal')
    def respond_to_counter_proposal(self, request, pk=None):
        """Respond to a counter-proposal from a collaborator.

        POST data:
        - collaborator_id: int - the collaborator role ID
        - action: str - 'accept' or 'decline'
        - message: str (optional) - message to the collaborator
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only project creator can respond to counter-proposals
        if project.created_by != core_user:
            return Response(
                {'error': 'Only project creator can respond to counter-proposals'},
                status=status.HTTP_403_FORBIDDEN
            )

        collaborator_id = request.data.get('collaborator_id')
        action = request.data.get('action')
        message = request.data.get('message', '')

        if not collaborator_id:
            return Response(
                {'error': 'collaborator_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if action not in ['accept', 'decline']:
            return Response(
                {'error': 'action must be "accept" or "decline"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find the collaborator with the counter-proposal
        try:
            collaborator = project.collaborators.get(id=collaborator_id, status='invited')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'Collaborator invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify there's actually a counter-proposal
        if collaborator.proposed_percentage is None:
            return Response(
                {'error': 'No counter-proposal found for this collaborator'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if action == 'accept':
            # Accept the counter-proposal: update revenue_percentage to proposed_percentage
            old_percentage = collaborator.revenue_percentage
            new_percentage = collaborator.proposed_percentage

            # Calculate the difference and adjust the project lead's share
            difference = new_percentage - old_percentage
            lead_collab = project.collaborators.get(user=project.created_by)

            # Make sure lead has enough share to give
            if lead_collab.revenue_percentage - difference < Decimal('0'):
                return Response(
                    {'error': 'Accepting this counter-proposal would make your share negative'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Update the collaborator's percentage to their proposed amount
                collaborator.revenue_percentage = new_percentage
                # Clear the counter-proposal fields
                collaborator.proposed_percentage = None
                collaborator.counter_message = ''
                collaborator.save()

                # Adjust the project lead's share
                lead_collab.revenue_percentage = lead_collab.revenue_percentage - difference
                lead_collab.save()

            # Notify the collaborator that their counter-proposal was accepted
            # Link to profile page where they can accept the updated invitation (not the collab workspace yet)
            from ..notifications_utils import create_notification
            create_notification(
                recipient=collaborator.user,
                from_user=core_user,
                notification_type='collaboration_update',
                title=f'Counter-Proposal Accepted: {project.title}',
                message=f'{core_user.username} accepted your counter-proposal of {new_percentage}% revenue split. Accept the invitation to join!' + (f' "{message}"' if message else ''),
                project=project,
                action_url='/profile'
            )

            # Re-fetch project to get fresh collaborator data
            project = self.get_object()
            serializer = CollaborativeProjectSerializer(project, context={'request': request})
            return Response({
                'message': 'Counter-proposal accepted',
                'project': serializer.data
            })

        else:  # action == 'decline'
            # Decline: clear the counter-proposal fields but keep original terms
            collaborator.proposed_percentage = None
            collaborator.counter_message = ''
            collaborator.save()

            # Notify the collaborator that their counter-proposal was declined
            # Link to profile page where they can see the invite and respond (not the collab workspace)
            from ..notifications_utils import create_notification
            create_notification(
                recipient=collaborator.user,
                from_user=core_user,
                notification_type='collaboration_update',
                title=f'Counter-Proposal Declined: {project.title}',
                message=f'{core_user.username} declined your counter-proposal. The original offer of {collaborator.revenue_percentage}% still stands.' + (f' "{message}"' if message else ''),
                project=project,
                action_url='/profile'
            )

            # Re-fetch project to get fresh collaborator data
            project = self.get_object()
            serializer = CollaborativeProjectSerializer(project, context={'request': request})
            return Response({
                'message': 'Counter-proposal declined',
                'project': serializer.data
            })

    @action(detail=True, methods=['post'])
    def approve_version(self, request, pk=None):
        """Approve current version for minting."""
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find collaborator role
        try:
            collaborator = project.collaborators.get(user=core_user, status='accepted')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'You are not a collaborator on this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Approve version
        collaborator.approved_current_version = True
        collaborator.save()

        # Notify about approval
        notify_approval_status_change(collaborator, 'version')

        # Check if all collaborators approved
        if project.is_fully_approved():
            project.status = 'ready_for_mint'
            project.save()

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve_project(self, request, pk=None):
        """Approve content and/or revenue split for the project.

        POST data:
        - approve_content: bool - approve the current content version
        - approve_revenue: bool - approve the revenue split
        - feedback: str (optional) - feedback message
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find collaborator role
        try:
            collaborator = project.collaborators.get(user=core_user, status='accepted')
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'You are not a collaborator on this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        approve_content = request.data.get('approve_content', False)
        approve_revenue = request.data.get('approve_revenue', False)

        # Update approvals based on request
        if approve_content:
            collaborator.approved_current_version = True
            notify_approval_status_change(collaborator, 'version')

        if approve_revenue:
            collaborator.approved_revenue_split = True
            notify_approval_status_change(collaborator, 'revenue')

        collaborator.save()

        # Check if all collaborators approved
        if project.is_fully_approved():
            project.status = 'ready_for_mint'
            project.save()

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def propose_revenue_split(self, request, pk=None):
        """Propose new revenue split percentages.

        POST data:
        - splits: [{user_id: int, percentage: decimal}, ...]
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify requester is project creator
        if project.created_by != core_user:
            return Response(
                {'error': 'Only project creator can propose revenue splits'},
                status=status.HTTP_403_FORBIDDEN
            )

        splits = request.data.get('splits', [])
        if not splits:
            return Response(
                {'error': 'splits array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate total equals 100%
        total = sum(Decimal(str(s.get('percentage', 0))) for s in splits)
        if total != 100:
            return Response(
                {'error': f'Revenue splits must total 100% (currently {total}%)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update splits and reset approvals
        with transaction.atomic():
            for split in splits:
                user_id = split.get('user_id')
                percentage = Decimal(str(split.get('percentage', 0)))

                try:
                    collaborator = project.collaborators.get(user_id=user_id)
                    collaborator.revenue_percentage = percentage
                    collaborator.approved_revenue_split = False  # Require re-approval
                    collaborator.save()
                except CollaboratorRole.DoesNotExist:
                    return Response(
                        {'error': f'User {user_id} is not a collaborator'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Build summary of changes for notification
        changes_summary = ', '.join([
            f"{CoreUser.objects.get(id=s['user_id']).username}: {s['percentage']}%"
            for s in splits[:3]  # Show first 3 splits
        ])
        if len(splits) > 3:
            changes_summary += f" and {len(splits) - 3} more"

        # Notify collaborators about revenue split proposal
        notify_revenue_proposal(core_user, project, changes_summary)

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def set_price(self, request, pk=None):
        """Set the NFT price for this project.

        POST data:
        - price_usd: decimal - the price in USD

        Only project creator can set price.
        Setting price resets all revenue split approvals (since earnings change).
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only project creator can set price
        if project.created_by != core_user:
            return Response(
                {'error': 'Only project creator can set price'},
                status=status.HTTP_403_FORBIDDEN
            )

        price_usd = request.data.get('price_usd')
        if price_usd is None:
            return Response(
                {'error': 'price_usd is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            price_usd = Decimal(str(price_usd))
            if price_usd <= 0:
                raise ValueError("Price must be positive")
        except (ValueError, InvalidOperation) as e:
            return Response(
                {'error': f'Invalid price: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update price
        old_price = project.price_usd
        project.price_usd = price_usd
        project.save()

        # Reset revenue split approvals if price changed (earnings are now different)
        if old_price != price_usd:
            project.collaborators.filter(status='accepted').update(approved_revenue_split=False)
            if project.status == 'ready_for_mint':
                project.status = 'active'
                project.save()

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_customization(self, request, pk=None):
        """Update customization settings for the project.

        POST data:
        - price_usd: decimal (optional) - the price in USD
        - editions: int (optional) - number of editions
        - teaser_percent: int (optional) - percentage of content shown as teaser (0-100)
        - watermark_preview: bool (optional) - show watermark on teaser

        Only project creator can update these settings.
        Updating price or editions resets all revenue split approvals.
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only project creator can update customization
        if project.created_by != core_user:
            return Response(
                {'error': 'Only project creator can update customization settings'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Track if price or editions changed (requires re-approval)
        old_price = project.price_usd
        old_editions = project.editions

        # Update price
        price_usd = request.data.get('price_usd')
        if price_usd is not None:
            try:
                price_usd = Decimal(str(price_usd))
                if price_usd <= 0:
                    raise ValueError("Price must be positive")
                project.price_usd = price_usd
            except (ValueError, InvalidOperation) as e:
                return Response(
                    {'error': f'Invalid price: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update editions
        editions = request.data.get('editions')
        if editions is not None:
            try:
                editions = int(editions)
                if editions < 1:
                    raise ValueError("Editions must be at least 1")
                project.editions = editions
            except ValueError as e:
                return Response(
                    {'error': f'Invalid editions: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update teaser_percent
        teaser_percent = request.data.get('teaser_percent')
        if teaser_percent is not None:
            try:
                teaser_percent = int(teaser_percent)
                if teaser_percent < 0 or teaser_percent > 100:
                    raise ValueError("Teaser percent must be between 0 and 100")
                project.teaser_percent = teaser_percent
            except ValueError as e:
                return Response(
                    {'error': f'Invalid teaser_percent: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update watermark_preview
        watermark_preview = request.data.get('watermark_preview')
        if watermark_preview is not None:
            project.watermark_preview = bool(watermark_preview)

        # Update authors_note
        authors_note = request.data.get('authors_note')
        if authors_note is not None:
            # Validate length (max ~100 words / 600 chars)
            if len(authors_note) > 600:
                return Response(
                    {'error': 'Authors note must be 600 characters or less'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            project.authors_note = authors_note

        project.save()

        # Reset revenue split approvals if price or editions changed
        if old_price != project.price_usd or old_editions != project.editions:
            project.collaborators.filter(status='accepted').update(approved_revenue_split=False)
            if project.status == 'ready_for_mint':
                project.status = 'active'
                project.save()

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

    # ========== CONTRACT TASK MANAGEMENT ENDPOINTS ==========

    @action(detail=True, methods=['post'], url_path='tasks/(?P<task_id>[^/.]+)/mark-complete')
    def mark_task_complete(self, request, pk=None, task_id=None):
        """Collaborator marks their task as complete.

        POST data:
        - completion_notes: str (optional) - notes about what was completed

        After marking complete, the owner must sign off to finalize.
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find the task
        try:
            task = ContractTask.objects.get(
                id=task_id,
                collaborator_role__project=project
            )
        except ContractTask.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify the user owns this task (is the collaborator)
        if task.collaborator_role.user != core_user:
            return Response(
                {'error': 'Only the assigned collaborator can mark this task complete'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Mark complete
        try:
            notes = request.data.get('completion_notes', '')
            task.mark_complete(core_user, notes)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Notify project owner

        serializer = ContractTaskSerializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='tasks/(?P<task_id>[^/.]+)/sign-off')
    def sign_off_task(self, request, pk=None, task_id=None):
        """Project owner signs off on a completed task.

        POST data:
        - signoff_notes: str (optional) - approval notes

        Only the project owner can sign off on tasks.
        This finalizes the task and updates completion counts.
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify requester is project owner
        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can sign off on tasks'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find the task
        try:
            task = ContractTask.objects.get(
                id=task_id,
                collaborator_role__project=project
            )
        except ContractTask.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Sign off
        try:
            notes = request.data.get('signoff_notes', '')
            task.sign_off(core_user, notes)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Notify collaborator

        serializer = ContractTaskSerializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='tasks/(?P<task_id>[^/.]+)/reject-completion')
    def reject_task_completion(self, request, pk=None, task_id=None):
        """Project owner rejects a task completion and sends back for revision.

        POST data:
        - rejection_reason: str (required) - explanation of what needs to be fixed

        The task goes back to 'in_progress' status.
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify requester is project owner
        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can reject task completions'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find the task
        try:
            task = ContractTask.objects.get(
                id=task_id,
                collaborator_role__project=project
            )
        except ContractTask.DoesNotExist:
            return Response(
                {'error': 'Task not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get rejection reason
        reason = request.data.get('rejection_reason', '')
        if not reason:
            return Response(
                {'error': 'rejection_reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reject completion
        try:
            task.reject_completion(core_user, reason)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Notify collaborator

        serializer = ContractTaskSerializer(task)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='handle-breach/(?P<role_id>[^/.]+)')
    def handle_breach(self, request, pk=None, role_id=None):
        """Project owner handles a deadline breach.

        POST data:
        - action: str - one of 'cancel', 'waive', or 'extend'
        - extension_days: int (only for 'extend') - number of days to extend

        Actions:
        - cancel: Remove the collaborator from the project
        - waive: Acknowledge the breach and continue
        - extend: Create a deadline extension (modifies task deadlines)
        """
        project = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify requester is project owner
        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can handle breaches'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find the collaborator role
        try:
            collab_role = CollaboratorRole.objects.get(
                id=role_id,
                project=project
            )
        except CollaboratorRole.DoesNotExist:
            return Response(
                {'error': 'Collaborator not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify there's actually a breach
        if not collab_role.cancellation_eligible:
            return Response(
                {'error': 'No active breach for this collaborator'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action = request.data.get('action')
        if action not in ['cancel', 'waive', 'extend']:
            return Response(
                {'error': 'action must be one of: cancel, waive, extend'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone
        from datetime import timedelta

        if action == 'cancel':
            # Remove collaborator from project
            with transaction.atomic():
                collab_role.status = 'exited'
                collab_role.save()

                # Cancel all their tasks
                collab_role.contract_tasks.update(status='cancelled')

            return Response({
                'message': 'Collaboration cancelled due to breach',
                'collaborator_id': collab_role.id,
                'action': 'cancel'
            })

        elif action == 'waive':
            # Acknowledge breach and continue
            collab_role.has_active_breach = False
            collab_role.cancellation_eligible = False
            collab_role.save()

            return Response({
                'message': 'Breach waived, collaboration continues',
                'collaborator_id': collab_role.id,
                'action': 'waive'
            })

        elif action == 'extend':
            # Extend deadlines
            extension_days = request.data.get('extension_days')
            if not extension_days or not isinstance(extension_days, int) or extension_days < 1:
                return Response(
                    {'error': 'extension_days must be a positive integer'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Extend all overdue tasks
                overdue_tasks = collab_role.contract_tasks.filter(is_overdue=True)
                for task in overdue_tasks:
                    task.deadline = timezone.now() + timedelta(days=extension_days)
                    task.is_overdue = False
                    task.save()

                # Clear breach flags
                collab_role.has_active_breach = False
                collab_role.cancellation_eligible = False
                collab_role.save()

            return Response({
                'message': f'Deadlines extended by {extension_days} days',
                'collaborator_id': collab_role.id,
                'action': 'extend',
                'extension_days': extension_days
            })

    @action(detail=True, methods=['get'], url_path='contract-status')
    def contract_status(self, request, pk=None):
        """Get overall contract fulfillment status for all collaborators.

        Returns summary of task completion across all collaborators.
        """
        project = self.get_object()

        collaborators = project.collaborators.filter(status='accepted')

        status_summary = []
        for collab in collaborators:
            tasks = collab.contract_tasks.all()
            status_summary.append({
                'collaborator_id': collab.id,
                'user_id': collab.user.id,
                'username': collab.user.username,
                'role': collab.role,
                'tasks_total': collab.tasks_total,
                'tasks_signed_off': collab.tasks_signed_off,
                'all_tasks_complete': collab.all_tasks_complete,
                'has_active_breach': collab.has_active_breach,
                'cancellation_eligible': collab.cancellation_eligible,
                'tasks': ContractTaskSerializer(tasks, many=True).data
            })

        all_complete = all(c['all_tasks_complete'] for c in status_summary if c['tasks_total'] > 0)

        return Response({
            'project_id': project.id,
            'all_contracts_fulfilled': all_complete,
            'collaborators': status_summary
        })

    # ========== END CONTRACT TASK MANAGEMENT ENDPOINTS ==========

    @action(detail=False, methods=['get'])
    def pending_invites(self, request):
        """Get all projects where current user has a pending invitation.

        Returns list of projects with the user's invitation details.
        This is more efficient than loading each project individually.
        """
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find all projects where current user has status='invited'
        pending_projects = CollaborativeProject.objects.filter(
            collaborators__user=core_user,
            collaborators__status='invited'
        ).select_related(
            'created_by'
        ).prefetch_related(
            'collaborators__user',
            'collaborators__contract_tasks',  # Include contract tasks for invite preview
            'sections',
        ).distinct()

        results = []
        for project in pending_projects:
            # Get the user's specific invitation
            try:
                my_invite = project.collaborators.get(user=core_user, status='invited')
                results.append({
                    'project': CollaborativeProjectSerializer(project, context={'request': request}).data,
                    'invite': CollaboratorRoleSerializer(my_invite).data
                })
            except CollaboratorRole.DoesNotExist:
                continue

        return Response(results)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Generate combined preview of all sections."""
        project = self.get_object()

        sections = project.sections.all().order_by('order')

        preview_data = {
            'title': project.title,
            'content_type': project.content_type,
            'sections': []
        }

        for section in sections:
            section_data = {
                'type': section.section_type,
                'title': section.title,
                'order': section.order
            }

            if section.section_type == 'text':
                section_data['content'] = section.content_html
            elif section.media_file:
                section_data['media_url'] = request.build_absolute_uri(section.media_file.url)

            preview_data['sections'].append(section_data)

        return Response(preview_data)

    @action(detail=True, methods=['post'], url_path='mint')
    def mint_collaborative_nft(self, request, pk=None):
        """
        Mint NFT for collaborative project with automatic revenue splits.

        Validates that:
        - Only the project owner can mint
        - All collaborators have approved the project
        - All collaborators have wallet addresses set
        - Revenue splits total 100%

        Then calls the Solana smart contract to mint the NFT with
        automatic revenue distribution.
        """
        project = self.get_object()

        # Verify requester is the project owner
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can mint the NFT'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verify project is in the correct status
        if project.status == 'minted':
            return Response(
                {'error': 'Project has already been minted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if project.status == 'cancelled':
            return Response(
                {'error': 'Cannot mint a cancelled project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ========== MINIMUM PUBLISHING CRITERIA ==========
        # Validate title requirements
        title = (project.title or '').strip()
        if not title:
            return Response(
                {
                    'error': 'Project must have a title before publishing',
                    'detail': 'Please set a title for your project'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(title) < 3:
            return Response(
                {
                    'error': 'Project title is too short',
                    'detail': 'Title must be at least 3 characters long'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if title.startswith('Collaboration Invite'):
            return Response(
                {
                    'error': 'Project has a placeholder title',
                    'detail': 'Please set a proper title for your project (not "Collaboration Invite...")'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate content requirements based on project type
        if project.content_type == 'comic':
            # Comic projects store content as ComicPages via ComicIssues, not sections
            from rb_core.models import ComicPage
            comic_pages = ComicPage.objects.filter(issue__project=project)
            if not comic_pages.exists():
                return Response(
                    {
                        'error': 'Comic has no pages',
                        'detail': 'Please add at least one page with artwork to your comic before publishing'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            sections = project.sections.all()
            if not sections.exists():
                return Response(
                    {
                        'error': 'Project has no content',
                        'detail': 'Please add at least one section to your project before publishing'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # For book projects, validate text content exists
        if project.content_type == 'book':
            text_sections = sections.filter(section_type='text')
            if not text_sections.exists():
                return Response(
                    {
                        'error': 'Book project requires text content',
                        'detail': 'Please add at least one text section to your book'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check that at least one text section has actual content
            has_content = False
            for section in text_sections:
                content_html = (section.content_html or '').strip()
                # Remove common empty HTML tags to check for actual content
                clean_content = content_html.replace('<p>', '').replace('</p>', '').replace('<br>', '').replace('<br/>', '').strip()
                if len(clean_content) >= 50:  # Minimum 50 characters of actual text
                    has_content = True
                    break

            if not has_content:
                return Response(
                    {
                        'error': 'Book content is too short',
                        'detail': 'Please add at least 50 characters of text content to your book'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # For other content types (art, music, video), validate media exists
        elif project.content_type in ['art', 'video', 'music']:
            media_sections = sections.exclude(section_type='text')
            has_media = any(section.media_file for section in media_sections)

            if not has_media:
                content_type_name = project.content_type.capitalize()
                return Response(
                    {
                        'error': f'{content_type_name} project requires media content',
                        'detail': f'Please upload {project.content_type} files to your project before publishing'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate price is set (must be greater than 0)
        if not project.price_usd or project.price_usd <= 0:
            return Response(
                {
                    'error': 'Project price not set',
                    'detail': 'Please set a price greater than $0 for your NFT'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate editions (must be at least 1)
        if not project.editions or project.editions < 1:
            return Response(
                {
                    'error': 'Invalid edition count',
                    'detail': 'Please set at least 1 edition for your NFT'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ========== END MINIMUM PUBLISHING CRITERIA ==========

        if project.is_solo:
            # Solo projects only need the creator's wallet
            creator = project.created_by
            if not hasattr(creator, 'profile') or not creator.profile.wallet_address:
                return Response(
                    {
                        'error': 'Wallet address required',
                        'detail': 'Please connect your wallet before minting'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Solo: single creator gets 100%
            creator_splits = [{
                'user_id': creator.id,
                'username': creator.username,
                'wallet_address': creator.profile.wallet_address,
                'percentage': 100.0,
                'role': 'Creator'
            }]
        else:
            # ========== COLLABORATIVE PROJECT CHECKS ==========

            # Verify all collaborators have approved
            if not project.is_fully_approved():
                return Response(
                    {
                        'error': 'All collaborators must approve before minting',
                        'detail': 'Check that all collaborators have approved the current version and revenue split'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get accepted collaborators with wallet addresses
            collaborators = project.collaborators.filter(status='accepted')

            # ========== TASK COMPLETION CHECK ==========
            # Verify all contract tasks are signed off
            collaborators_with_incomplete_tasks = []
            for collab in collaborators:
                if collab.tasks_total > 0 and not collab.all_tasks_complete:
                    incomplete_count = collab.tasks_total - collab.tasks_signed_off
                    collaborators_with_incomplete_tasks.append({
                        'user_id': collab.user.id,
                        'username': collab.user.username,
                        'role': collab.role,
                        'incomplete_tasks': incomplete_count,
                        'total_tasks': collab.tasks_total
                    })

            if collaborators_with_incomplete_tasks:
                return Response(
                    {
                        'error': 'All contract tasks must be signed off before minting',
                        'detail': 'Some collaborators have unsigned tasks',
                        'collaborators_with_incomplete_tasks': collaborators_with_incomplete_tasks
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            # ========== END TASK COMPLETION CHECK ==========

            if not collaborators.exists():
                return Response(
                    {'error': 'No accepted collaborators found'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check that all collaborators have wallet addresses
            collaborators_without_wallets = []
            for collab in collaborators:
                if not hasattr(collab.user, 'profile') or not collab.user.profile.wallet_address:
                    collaborators_without_wallets.append({
                        'user_id': collab.user.id,
                        'username': collab.user.username,
                        'role': collab.role
                    })

            if collaborators_without_wallets:
                return Response(
                    {
                        'error': 'All collaborators must have wallet addresses set',
                        'collaborators_without_wallets': collaborators_without_wallets
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Prepare creator splits for smart contract
            creator_splits = []
            for collab in collaborators:
                creator_splits.append({
                    'user_id': collab.user.id,
                    'username': collab.user.username,
                    'wallet_address': collab.user.profile.wallet_address,
                    'percentage': float(collab.revenue_percentage),
                    'role': collab.role
                })

            # Validate splits total 100%
            total_percentage = sum(split['percentage'] for split in creator_splits)
            if abs(total_percentage - 100.0) > 0.01:
                return Response(
                    {
                        'error': f'Revenue splits must total 100%, got {total_percentage}%',
                        'creator_splits': creator_splits
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Get sale price from project
        sale_amount_usd = project.price_usd

        # Generate metadata URI
        # TODO: Upload actual metadata to Arweave/IPFS
        from ..utils.solana_integration import get_nft_metadata_uri
        metadata_uri = get_nft_metadata_uri(project.id, project.content_type)

        # Publishing step: create the Content record and mark project as minted.
        # Actual on-chain NFT minting + USDC distribution happens at purchase
        # time via process_atomic_purchase / mint_and_distribute_atomic.
        try:
            # Update project status to minted
            project.status = 'minted'
            project.save()

            # Create Content record for marketplace listing
            # This allows the minted NFT to be listed and sold on the home page
            author_name = get_author_display_name(core_user)
            content = Content.objects.create(
                creator=core_user,
                title=project.title,
                teaser_link='',  # Will be set below
                content_type=project.content_type,
                price_usd=project.price_usd,
                editions=project.editions,
                teaser_percent=project.teaser_percent,
                watermark_preview=project.watermark_preview,
                inventory_status='minted',
                nft_contract='',  # Set at purchase time when NFT is minted on-chain
                copyright_year=datetime.now().year,
                copyright_holder=author_name,
            )
            # Set teaser link: prefer project cover art, fall back to teaser endpoint
            if project.cover_image:
                content.teaser_link = project.cover_image.url
            else:
                content.teaser_link = f'/api/content/{content.id}/teaser/'

            # Build teaser_html from project sections (for book content)
            if project.content_type == 'book':
                sections = project.sections.order_by('order')
                teaser_parts = []
                for section in sections:
                    if section.section_type == 'text' and section.content_html:
                        teaser_parts.append(section.content_html)
                if teaser_parts:
                    full_html = '\n'.join(teaser_parts)
                    # Calculate teaser based on teaser_percent
                    teaser_ratio = project.teaser_percent / 100.0
                    teaser_length = int(len(full_html) * teaser_ratio)
                    content.teaser_html = full_html[:teaser_length]

            content.save()

            # Link the project to the content
            project.published_content = content
            project.save(update_fields=['published_content'])

            return Response({
                'success': True,
                'message': 'NFT published successfully',
                'project_id': project.id,
                'project_title': project.title,
                'content_id': content.id,
                'metadata_uri': metadata_uri,
                'creator_splits': creator_splits,
                'num_creators': len(creator_splits),
            })

        except Exception as e:
            logger.error(f"Publishing failed for project {project.id}: {e}")
            return Response({
                'success': False,
                'error': str(e),
                'error_type': 'PublishingError',
                'creator_splits': creator_splits
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ========== Real-time Collaboration Stub Endpoints ==========
    # These are placeholder endpoints to prevent 404 errors.
    # Full implementation requires WebSocket/real-time infrastructure.

    @action(detail=True, methods=['get'])
    def activities(self, request, pk=None):
        """Get recent activity feed for the project (stub)."""
        # TODO: Implement activity tracking with timestamps
        return Response([])

    @action(detail=True, methods=['get'], url_path='online-users')
    def online_users(self, request, pk=None):
        """Get list of users currently online in this project (stub)."""
        # TODO: Implement presence tracking with WebSockets
        return Response([])

    @action(detail=True, methods=['get'], url_path='currently-editing')
    def currently_editing(self, request, pk=None):
        """Get sections currently being edited by users (stub)."""
        # TODO: Implement edit locks with WebSockets
        # Returns array of CurrentlyEditing objects
        return Response([])

    @action(detail=True, methods=['get', 'post'])
    def heartbeat(self, request, pk=None):
        """Update user's online status / heartbeat (stub).

        Accepts both GET and POST to avoid CSRF issues with background polling.
        """
        # TODO: Implement presence heartbeat
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='start-editing')
    def start_editing(self, request, pk=None):
        """Notify that user started editing a section (stub).

        POST data:
        - section_id: int
        """
        # TODO: Implement real-time edit locks
        section_id = request.data.get('section_id')
        return Response({
            'status': 'ok',
            'section_id': section_id,
            'message': 'Editing started (stub)'
        })

    @action(detail=True, methods=['post'], url_path='stop-editing')
    def stop_editing(self, request, pk=None):
        """Notify that user stopped editing a section (stub).

        POST data:
        - section_id: int
        """
        # TODO: Implement real-time edit locks
        section_id = request.data.get('section_id')
        return Response({
            'status': 'ok',
            'section_id': section_id,
            'message': 'Editing stopped (stub)'
        })

    @action(detail=True, methods=['post'], url_path='log-activity')
    def log_activity(self, request, pk=None):
        """Log a new activity for the project (stub).

        POST data:
        - activity_type: str
        - description: str
        - metadata: dict (optional)
        """
        # TODO: Implement activity logging
        activity_type = request.data.get('activity_type', 'unknown')
        description = request.data.get('description', '')
        return Response({
            'id': 0,  # Stub ID
            'project_id': pk,
            'activity_type': activity_type,
            'description': description,
            'created_at': timezone.now().isoformat()
        })

    @action(detail=True, methods=['post'], url_path='prepare_comic_for_mint')
    def prepare_comic_for_mint(self, request, pk=None):
        """Prepare a comic project for minting by creating a Content record.

        This is used for solo comics created through the studio.
        Creates a Content record with content_type='art' (comics are visual content)
        and links it to the CollaborativeProject.

        Returns:
        - content_id: int - The ID of the created Content record
        """
        project = self.get_object()

        # Verify user is the project creator
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project creator can publish'},
                status=status.HTTP_403_FORBIDDEN
            )

        if project.content_type != 'comic':
            return Response(
                {'error': 'Project is not a comic'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate comic has at least one page with content
        # Pages are linked via issues, so query through the issue relationship
        pages = ComicPage.objects.filter(issue__project=project)
        if not pages.exists():
            return Response(
                {'error': 'Comic must have at least one page'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if any panels have artwork
        has_artwork = False
        first_panel_with_art = None
        for page in pages.order_by('page_number'):
            panel = page.panels.filter(artwork__isnull=False).exclude(artwork='').first()
            if panel:
                if not has_artwork:
                    first_panel_with_art = panel
                has_artwork = True
                break

        if not has_artwork:
            return Response(
                {'error': 'Comic must have at least one panel with artwork'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get teaser image: prefer project cover art, fall back to first panel artwork
        teaser_link = ''
        if project.cover_image:
            teaser_link = project.cover_image.url
        elif first_panel_with_art and first_panel_with_art.artwork:
            teaser_link = first_panel_with_art.artwork.url

        # Check if Content already exists for this project
        existing_content = Content.objects.filter(
            source_collaborative_project=project
        ).first()

        if existing_content:
            # Update existing
            existing_content.title = project.title or 'Untitled Comic'
            existing_content.teaser_link = teaser_link
            existing_content.save()
            content = existing_content
        else:
            # Create new Content record
            content = Content.objects.create(
                creator=core_user,
                title=project.title or 'Untitled Comic',
                teaser_link=teaser_link,
                content_type='comic',  # Comics have dedicated viewer
                genre='other',
                inventory_status='draft',
            )
            # Link to the project
            content.source_collaborative_project.add(project)

        return Response({
            'content_id': content.id,
            'message': 'Comic prepared for minting'
        }, status=status.HTTP_201_CREATED)

    # ========== Unpublish & Delete Features ==========

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Remove published content from marketplace.

        Only the project owner can unpublish. The project must be in 'minted' status.
        Unpublished projects can be re-published by calling the republish endpoint.
        Existing buyers retain access to their purchased content.
        """
        project = self.get_object()

        # Get core user
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only owner can unpublish
        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can unpublish'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Must be in minted status
        if project.status != 'minted':
            return Response(
                {'error': 'Only published projects can be unpublished'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update project status
        project.status = 'unpublished'
        project.save()

        # Update linked Content record to remove from marketplace
        if project.published_content:
            project.published_content.inventory_status = 'delisted'
            project.published_content.save()

        return Response({
            'status': 'unpublished',
            'message': 'Content removed from marketplace'
        })

    @action(detail=True, methods=['post'])
    def republish(self, request, pk=None):
        """Re-list unpublished content on marketplace.

        Only the project owner can republish. The project must be in 'unpublished' status.
        This returns the project to 'minted' status and re-lists the content for sale.
        """
        project = self.get_object()

        # Get core user
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only owner can republish
        if project.created_by != core_user:
            return Response(
                {'error': 'Only the project owner can republish'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Must be in unpublished status
        if project.status != 'unpublished':
            return Response(
                {'error': 'Only unpublished projects can be republished'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update project status back to minted
        project.status = 'minted'
        project.save()

        # Re-list the Content record
        if project.published_content:
            project.published_content.inventory_status = 'minted'
            if project.cover_image:
                project.published_content.teaser_link = project.cover_image.url
            project.published_content.save()

        return Response({
            'status': 'minted',
            'message': 'Content re-listed on marketplace'
        })

    def perform_destroy(self, instance):
        """Delete project with ownership validation.

        Deletion rules:
        - Only the project owner (created_by) can initiate deletion
        - Cannot delete minted projects (must unpublish first)
        - Solo projects (1 collaborator): owner can delete freely
        - Multi-collaborator projects: require >=51% ownership to delete

        For collaborative deletion when no single majority owner exists,
        collaborators should contact each other to negotiate deletion.
        """
        project = instance

        # Get core user
        try:
            core_user = CoreUser.objects.get(username=self.request.user.username)
        except CoreUser.DoesNotExist:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('User not found')

        # Must be owner to initiate delete
        if project.created_by != core_user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the project owner can delete projects')

        # Cannot delete minted projects (must unpublish first)
        if project.status == 'minted':
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Cannot delete published projects. Unpublish first.')

        # Get current user's collaborator role
        user_collab = project.collaborators.filter(user=core_user).first()
        if not user_collab:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You are not a collaborator on this project')

        # Check ownership threshold
        total_collaborators = project.collaborators.filter(status='accepted').count()

        if total_collaborators <= 1:
            # Solo project - owner can delete
            instance.delete()
            return

        # Multi-collaborator: need >=51% ownership
        user_ownership = float(user_collab.revenue_percentage)

        if user_ownership >= 51:
            # Majority owner can delete
            instance.delete()
            return

        # Otherwise, cannot delete
        from rest_framework.exceptions import ValidationError
        raise ValidationError(
            f'You have {user_ownership:.1f}% ownership. Need >=51% to delete. '
            'Contact collaborators to request deletion.'
        )


class ProjectSectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project sections.

    Users can only edit sections they have permission for.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSectionSerializer
    pagination_class = None  # Disable pagination for section lists

    def get_queryset(self):
        """Return sections from projects where user is a collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return ProjectSection.objects.none()

        # Sections from projects where user is creator or collaborator
        queryset = ProjectSection.objects.filter(
            Q(project__created_by=core_user) | Q(project__collaborators__user=core_user)
        ).distinct()

        # CRITICAL: Filter by specific project ID if provided
        # This prevents content from other collaborations from leaking through
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset

    def perform_create(self, serializer):
        """Create section with permission validation."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            raise serializers.ValidationError('User not found')

        project_id = self.request.data.get('project')
        section_type = self.request.data.get('section_type')

        if not project_id:
            raise serializers.ValidationError('project is required')

        try:
            project = CollaborativeProject.objects.get(id=project_id)
        except CollaborativeProject.DoesNotExist:
            raise serializers.ValidationError('Project not found')

        # Check if user is a collaborator with edit permission
        try:
            collaborator = project.collaborators.get(user=core_user, status='accepted')
        except CollaboratorRole.DoesNotExist:
            raise serializers.ValidationError('You are not a collaborator on this project')

        # Check permission for section type
        if not collaborator.can_edit_section(section_type):
            raise serializers.ValidationError(
                f'You do not have permission to create {section_type} sections'
            )

        # Set owner to current user
        section = serializer.save(owner=core_user)

        # Notify collaborators about new section
        notify_section_update(core_user, project, section.title)

    def perform_update(self, serializer):
        """Update section with ownership and permission validation."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            raise serializers.ValidationError('User not found')

        section = self.get_object()

        # Check if user owns this section OR is project creator
        if section.owner != core_user and section.project.created_by != core_user:
            raise serializers.ValidationError('You can only edit sections you own')

        # If changing section type, verify permission
        new_type = self.request.data.get('section_type')
        if new_type and new_type != section.section_type:
            try:
                collaborator = section.project.collaborators.get(user=core_user, status='accepted')
                if not collaborator.can_edit_section(new_type):
                    raise serializers.ValidationError(
                        f'You do not have permission to create {new_type} sections'
                    )
            except CollaboratorRole.DoesNotExist:
                raise serializers.ValidationError('You are not a collaborator on this project')

        updated_section = serializer.save()

        # Notify collaborators about section update
        notify_section_update(core_user, section.project, updated_section.title)

    def perform_destroy(self, instance):
        """Delete section with ownership validation."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            raise serializers.ValidationError('User not found')

        # Only owner or project creator can delete
        if instance.owner != core_user and instance.project.created_by != core_user:
            raise serializers.ValidationError('You can only delete sections you own')

        instance.delete()


class ProjectCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project comments and discussions."""
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectCommentSerializer
    pagination_class = None  # Disable pagination for comment lists

    def get_queryset(self):
        """Return comments from projects where user is a collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return ProjectComment.objects.none()

        # Comments from projects where user is creator or collaborator
        queryset = ProjectComment.objects.filter(
            Q(project__created_by=core_user) | Q(project__collaborators__user=core_user)
        ).distinct()

        # CRITICAL: Filter by specific project ID if provided
        # This prevents comments from other collaborations from leaking through
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset

    def perform_create(self, serializer):
        """Create comment with author set to current user."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            raise serializers.ValidationError('User not found')

        # Verify user is a collaborator on the project
        project_id = self.request.data.get('project')
        try:
            project = CollaborativeProject.objects.get(id=project_id)
        except CollaborativeProject.DoesNotExist:
            raise serializers.ValidationError('Project not found')

        is_collaborator = (
            project.created_by == core_user or
            project.collaborators.filter(user=core_user).exists()
        )

        if not is_collaborator:
            raise serializers.ValidationError('You must be a collaborator to comment')

        comment = serializer.save(author=core_user)

        # Notify collaborators about new comment
        comment_preview = comment.content[:100] if len(comment.content) > 100 else comment.content
        notify_comment_added(core_user, project, comment_preview)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark comment as resolved."""
        comment = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only comment author or project creator can resolve
        if comment.author != core_user and comment.project.created_by != core_user:
            return Response(
                {'error': 'Only comment author or project creator can resolve comments'},
                status=status.HTTP_403_FORBIDDEN
            )

        comment.resolved = True
        comment.save()

        serializer = ProjectCommentSerializer(comment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def unresolve(self, request, pk=None):
        """Mark comment as unresolved."""
        comment = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only comment author or project creator can unresolve
        if comment.author != core_user and comment.project.created_by != core_user:
            return Response(
                {'error': 'Only comment author or project creator can unresolve comments'},
                status=status.HTTP_403_FORBIDDEN
            )

        comment.resolved = False
        comment.save()

        serializer = ProjectCommentSerializer(comment)
        return Response(serializer.data)


# Import timezone for timestamps
from django.utils import timezone
from rest_framework import serializers
from datetime import timedelta

from ..models import Proposal, ProposalVote, CollaboratorRating


# ===== Proposal & Voting Endpoints =====

class ProposalViewSet(viewsets.ModelViewSet):
    """ViewSet for managing proposals in collaborative projects."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return proposals for a specific project."""
        project_id = self.kwargs.get('project_pk')
        if not project_id:
            return Proposal.objects.none()
        return Proposal.objects.filter(project_id=project_id).prefetch_related('votes')

    def get_serializer_class(self):
        # Use inline serializer for now
        from rest_framework import serializers as drf_serializers

        class ProposalVoteSerializer(drf_serializers.ModelSerializer):
            voter_username = drf_serializers.CharField(source='voter.username', read_only=True)
            voter_id = drf_serializers.IntegerField(source='voter.id', read_only=True)

            class Meta:
                model = ProposalVote
                fields = ['id', 'voter_id', 'voter_username', 'vote', 'comment', 'voted_at']

        class ProposalSerializer(drf_serializers.ModelSerializer):
            proposer_username = drf_serializers.CharField(source='proposer.username', read_only=True)
            proposer_id = drf_serializers.IntegerField(source='proposer.id', read_only=True)
            votes = ProposalVoteSerializer(many=True, read_only=True)
            vote_counts = drf_serializers.SerializerMethodField()
            total_voters = drf_serializers.SerializerMethodField()

            class Meta:
                model = Proposal
                fields = [
                    'id', 'proposal_type', 'title', 'description', 'proposal_data',
                    'status', 'voting_threshold', 'proposer_id', 'proposer_username',
                    'expires_at', 'resolved_at', 'created_at', 'votes', 'vote_counts',
                    'total_voters'
                ]

            def get_vote_counts(self, obj):
                return obj.get_vote_counts()

            def get_total_voters(self, obj):
                return obj.project.collaborators.filter(status='accepted').count()

        return ProposalSerializer

    def perform_create(self, serializer):
        """Create a new proposal."""
        user = self.request.user
        project_id = self.kwargs.get('project_pk')

        try:
            core_user = CoreUser.objects.get(username=user.username)
            project = CollaborativeProject.objects.get(id=project_id)
        except (CoreUser.DoesNotExist, CollaborativeProject.DoesNotExist):
            raise serializers.ValidationError('User or project not found')

        # Verify user is a collaborator
        if not project.collaborators.filter(user=core_user, status='accepted').exists():
            raise serializers.ValidationError('Only collaborators can create proposals')

        # Set expiration (default 7 days)
        expires_in_days = self.request.data.get('expires_in_days', 7)
        expires_at = timezone.now() + timedelta(days=expires_in_days)

        serializer.save(
            project=project,
            proposer=core_user,
            expires_at=expires_at
        )

    @action(detail=True, methods=['post'])
    def vote(self, request, project_pk=None, pk=None):
        """Cast a vote on a proposal."""
        proposal = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify user is a collaborator
        if not proposal.project.collaborators.filter(user=core_user, status='accepted').exists():
            return Response(
                {'error': 'Only collaborators can vote'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check proposal is still pending
        if proposal.status != 'pending':
            return Response(
                {'error': 'Proposal is no longer accepting votes'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get vote data
        vote_choice = request.data.get('vote')
        comment = request.data.get('comment', '')

        if vote_choice not in ['approve', 'reject', 'abstain']:
            return Response(
                {'error': 'Invalid vote. Must be approve, reject, or abstain'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create or update vote
        vote, created = ProposalVote.objects.update_or_create(
            proposal=proposal,
            voter=core_user,
            defaults={'vote': vote_choice, 'comment': comment}
        )

        # Check if proposal should be resolved
        proposal.check_and_resolve()

        return Response({
            'id': vote.id,
            'voter_id': core_user.id,
            'voter_username': core_user.username,
            'vote': vote.vote,
            'comment': vote.comment,
            'voted_at': vote.voted_at.isoformat(),
            'proposal_status': proposal.status,
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, project_pk=None, pk=None):
        """Cancel a proposal."""
        proposal = self.get_object()

        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only proposer or project owner can cancel
        if proposal.proposer != core_user and proposal.project.created_by != core_user:
            return Response(
                {'error': 'Only the proposer or project owner can cancel'},
                status=status.HTTP_403_FORBIDDEN
            )

        if proposal.status != 'pending':
            return Response(
                {'error': 'Can only cancel pending proposals'},
                status=status.HTTP_400_BAD_REQUEST
            )

        proposal.status = 'cancelled'
        proposal.save()

        return Response({'message': 'Proposal cancelled'})


# ===== Collaborator Rating Endpoint =====

class CollaboratorRatingViewSet(viewsets.ViewSet):
    """ViewSet for collaborator ratings."""
    permission_classes = [IsAuthenticated]

    def create(self, request, project_pk=None):
        """
        Rate a collaborator after project completion.

        POST data:
        - rated_user_id: int
        - quality_score: int (1-5)
        - deadline_score: int (1-5)
        - communication_score: int (1-5)
        - would_collab_again: int (1-5)
        - private_note: str (optional)
        - public_feedback: str (optional)
        """
        try:
            project = CollaborativeProject.objects.get(pk=project_pk)
            core_user = CoreUser.objects.get(username=request.user.username)
        except (CollaborativeProject.DoesNotExist, CoreUser.DoesNotExist):
            return Response(
                {'error': 'Project or user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify rater is a collaborator
        if not project.collaborators.filter(user=core_user, status='accepted').exists():
            return Response(
                {'error': 'Only collaborators can rate'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get rated user
        rated_user_id = request.data.get('rated_user_id')
        try:
            rated_user = CoreUser.objects.get(id=rated_user_id)
        except CoreUser.DoesNotExist:
            return Response(
                {'error': 'Rated user not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot rate yourself
        if rated_user == core_user:
            return Response(
                {'error': 'Cannot rate yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify rated user is also a collaborator
        if not project.collaborators.filter(user=rated_user, status='accepted').exists():
            return Response(
                {'error': 'Rated user is not a collaborator on this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate scores
        scores = ['quality_score', 'deadline_score', 'communication_score', 'would_collab_again']
        for score_field in scores:
            score = request.data.get(score_field)
            if score is None or not isinstance(score, int) or score < 1 or score > 5:
                return Response(
                    {'error': f'{score_field} must be an integer between 1 and 5'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Create or update rating
        rating, created = CollaboratorRating.objects.update_or_create(
            project=project,
            rater=core_user,
            rated_user=rated_user,
            defaults={
                'quality_score': request.data.get('quality_score'),
                'deadline_score': request.data.get('deadline_score'),
                'communication_score': request.data.get('communication_score'),
                'would_collab_again': request.data.get('would_collab_again'),
                'private_note': request.data.get('private_note', ''),
                'public_feedback': request.data.get('public_feedback', ''),
            }
        )

        return Response({
            'id': rating.id,
            'project_id': project.id,
            'project_title': project.title,
            'rater_id': core_user.id,
            'rater_username': core_user.username,
            'rated_user_id': rated_user.id,
            'rated_user_username': rated_user.username,
            'quality_score': rating.quality_score,
            'deadline_score': rating.deadline_score,
            'communication_score': rating.communication_score,
            'would_collab_again': rating.would_collab_again,
            'average_score': rating.average_score,
            'public_feedback': rating.public_feedback,
            'created_at': rating.created_at.isoformat(),
        })

    def list(self, request, project_pk=None):
        """List ratings for a project."""
        try:
            project = CollaborativeProject.objects.get(pk=project_pk)
        except CollaborativeProject.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        ratings = CollaboratorRating.objects.filter(project=project)
        return Response([{
            'id': r.id,
            'rater_id': r.rater.id,
            'rater_username': r.rater.username,
            'rated_user_id': r.rated_user.id,
            'rated_user_username': r.rated_user.username,
            'quality_score': r.quality_score,
            'deadline_score': r.deadline_score,
            'communication_score': r.communication_score,
            'would_collab_again': r.would_collab_again,
            'average_score': r.average_score,
            'public_feedback': r.public_feedback,
            'created_at': r.created_at.isoformat(),
        } for r in ratings])


from rest_framework.decorators import api_view, permission_classes as drf_permission_classes

@api_view(['GET'])
@drf_permission_classes([IsAuthenticated])
def get_user_ratings(request, user_id):
    """Get all public ratings for a user across all projects."""
    try:
        user = CoreUser.objects.get(id=user_id)
    except CoreUser.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    ratings = CollaboratorRating.objects.filter(rated_user=user)

    # Calculate aggregate stats
    if ratings.exists():
        avg_quality = sum(r.quality_score for r in ratings) / len(ratings)
        avg_deadline = sum(r.deadline_score for r in ratings) / len(ratings)
        avg_communication = sum(r.communication_score for r in ratings) / len(ratings)
        avg_would_collab = sum(r.would_collab_again for r in ratings) / len(ratings)
        overall_avg = (avg_quality + avg_deadline + avg_communication + avg_would_collab) / 4
    else:
        avg_quality = avg_deadline = avg_communication = avg_would_collab = overall_avg = 0

    return Response({
        'user_id': user.id,
        'username': user.username,
        'total_ratings': ratings.count(),
        'average_scores': {
            'quality': round(avg_quality, 1),
            'deadline': round(avg_deadline, 1),
            'communication': round(avg_communication, 1),
            'would_collab_again': round(avg_would_collab, 1),
            'overall': round(overall_avg, 1),
        },
        'ratings': [{
            'id': r.id,
            'project_id': r.project.id,
            'project_title': r.project.title,
            'rater_username': r.rater.username,
            'quality_score': r.quality_score,
            'deadline_score': r.deadline_score,
            'communication_score': r.communication_score,
            'would_collab_again': r.would_collab_again,
            'average_score': r.average_score,
            'public_feedback': r.public_feedback,
            'created_at': r.created_at.isoformat(),
        } for r in ratings]
    })


# ========== ROLE DEFINITION API ==========

class RoleDefinitionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for listing and retrieving role definitions.

    Provides read-only access to standard role templates that can be used
    when inviting collaborators to projects. Supports filtering by project type.

    Endpoints:
    - GET /api/role-definitions/ - List all active role definitions
    - GET /api/role-definitions/?project_type=book - Filter by applicable project type
    - GET /api/role-definitions/{id}/ - Retrieve specific role definition
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RoleDefinitionSerializer
    pagination_class = None

    def get_queryset(self):
        """Return active role definitions, optionally filtered by project type."""
        queryset = RoleDefinition.objects.filter(is_active=True)

        # Filter by project type if provided
        project_type = self.request.query_params.get('project_type')
        if project_type:
            if project_type == 'book':
                queryset = queryset.filter(applicable_to_book=True)
            elif project_type == 'art':
                queryset = queryset.filter(applicable_to_art=True)
            elif project_type == 'music':
                queryset = queryset.filter(applicable_to_music=True)
            elif project_type == 'video':
                queryset = queryset.filter(applicable_to_video=True)
            elif project_type == 'comic':
                queryset = queryset.filter(applicable_to_comic=True)

        # Optional filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset.order_by('category', 'name')

    @action(detail=False, methods=['get'], url_path='by-project-type/(?P<project_type>[^/.]+)')
    def by_project_type(self, request, project_type=None):
        """Get all roles applicable to a specific project type.

        Returns roles grouped by category for easier UI rendering.
        """
        queryset = RoleDefinition.objects.filter(is_active=True)

        if project_type == 'book':
            queryset = queryset.filter(applicable_to_book=True)
        elif project_type == 'art':
            queryset = queryset.filter(applicable_to_art=True)
        elif project_type == 'music':
            queryset = queryset.filter(applicable_to_music=True)
        elif project_type == 'video':
            queryset = queryset.filter(applicable_to_video=True)
        elif project_type == 'comic':
            queryset = queryset.filter(applicable_to_comic=True)
        else:
            return Response(
                {'error': f'Invalid project type: {project_type}. Must be book, art, music, video, or comic.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Group by category
        roles_by_category = {}
        for role in queryset.order_by('category', 'name'):
            category = role.get_category_display()
            if category not in roles_by_category:
                roles_by_category[category] = []
            roles_by_category[category].append(RoleDefinitionSerializer(role).data)

        return Response({
            'project_type': project_type,
            'roles_by_category': roles_by_category,
            'total_roles': queryset.count()
        })
