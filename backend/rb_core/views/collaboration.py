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
from decimal import Decimal

from ..models import (
    CollaborativeProject, CollaboratorRole, ProjectSection,
    ProjectComment, User as CoreUser
)
from ..serializers import (
    CollaborativeProjectSerializer, CollaborativeProjectListSerializer,
    CollaboratorRoleSerializer, ProjectSectionSerializer, ProjectCommentSerializer
)
from ..notifications_utils import (
    notify_collaboration_invitation, notify_invitation_response,
    notify_section_update, notify_comment_added, notify_approval_status_change,
    notify_revenue_proposal
)


class CollaborativeProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing collaborative projects.

    Users can view projects where they are creator or collaborator.
    Supports full CRUD operations plus collaboration-specific actions.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CollaborativeProjectSerializer

    def get_queryset(self):
        """Return projects where user is creator or accepted collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return CollaborativeProject.objects.none()

        # Projects created by user OR where user is a collaborator
        return CollaborativeProject.objects.filter(
            Q(created_by=core_user) | Q(collaborators__user=core_user)
        ).distinct()

    def get_serializer_class(self):
        """Use lightweight serializer for list view."""
        if self.action == 'list':
            return CollaborativeProjectListSerializer
        return CollaborativeProjectSerializer

    def perform_create(self, serializer):
        """Create project and add creator as first collaborator with 100% revenue."""
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
        """Invite a collaborator to the project.

        POST data:
        - user_id: int (user to invite)
        - role: str (Author, Illustrator, etc.)
        - revenue_percentage: decimal (0-100)
        - can_edit_text: bool
        - can_edit_images: bool
        - can_edit_audio: bool
        - can_edit_video: bool
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
        role = request.data.get('role', 'Collaborator')
        revenue_percentage = Decimal(str(request.data.get('revenue_percentage', 0)))

        # Validate revenue percentage
        if revenue_percentage < 0 or revenue_percentage > 100:
            return Response(
                {'error': 'Revenue percentage must be between 0 and 100'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check total revenue doesn't exceed 100%
        current_total = project.total_revenue_percentage()
        if current_total + revenue_percentage > 100:
            return Response(
                {'error': f'Total revenue would exceed 100% (current: {current_total}%)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create invitation
        collaborator = CollaboratorRole.objects.create(
            project=project,
            user=invited_user,
            role=role,
            revenue_percentage=revenue_percentage,
            status='invited',
            can_edit_text=request.data.get('can_edit_text', False),
            can_edit_images=request.data.get('can_edit_images', False),
            can_edit_audio=request.data.get('can_edit_audio', False),
            can_edit_video=request.data.get('can_edit_video', False)
        )

        # Send notification to invited user
        notify_collaboration_invitation(core_user, invited_user, project, role)

        serializer = CollaboratorRoleSerializer(collaborator)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def accept_invitation(self, request, pk=None):
        """Accept a collaboration invitation."""
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

        # Accept invitation
        invitation.status = 'accepted'
        invitation.accepted_at = timezone.now()
        invitation.save()

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

        # Decline invitation
        invitation.status = 'declined'
        invitation.save()

        # Notify project creator
        notify_invitation_response(invitation, accepted=False)

        return Response({'message': 'Invitation declined'})

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

    @action(detail=True, methods=['post'])
    def mint_collaborative_nft(self, request, pk=None):
        """
        Mint NFT for collaborative project with automatic revenue splits.

        Validates that:
        - All collaborators have approved the project
        - All collaborators have wallet addresses set
        - Revenue splits total 100%

        Then calls the Solana smart contract to mint the NFT with
        automatic revenue distribution.
        """
        project = self.get_object()

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

        if not collaborators.exists():
            return Response(
                {'error': 'No accepted collaborators found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check that all collaborators have wallet addresses
        collaborators_without_wallets = []
        for collab in collaborators:
            if not hasattr(collab.user, 'userprofile') or not collab.user.userprofile.wallet_address:
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
                'wallet_address': collab.user.userprofile.wallet_address,
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

        # TODO: Get actual sale price from project
        # For now, use a default price
        sale_amount_usd = Decimal('10.00')

        # Generate metadata URI
        # TODO: Upload actual metadata to Arweave/IPFS
        from ..utils.solana_integration import get_nft_metadata_uri
        metadata_uri = get_nft_metadata_uri(project.id, project.content_type)

        # Execute minting on Solana blockchain
        from ..utils.solana_integration import mint_collaborative_nft

        result = mint_collaborative_nft(
            project_id=project.id,
            sale_amount_usd=sale_amount_usd,
            creator_splits=creator_splits,
            metadata_uri=metadata_uri,
            title=project.title
        )

        if result['success']:
            # Update project status to minted
            project.status = 'minted'
            project.save()

            # TODO: Create Content record for marketplace
            # This allows the minted NFT to be listed and sold

            return Response({
                'success': True,
                'message': 'Collaborative NFT minted successfully',
                'transaction_signature': result['transaction_signature'],
                'mint_address': result['mint_address'],
                'sale_amount_lamports': result['sale_amount_lamports'],
                'platform_fee_lamports': result['platform_fee_lamports'],
                'creator_splits': result['creator_splits'],
                'num_creators': result['num_creators'],
                'project_id': project.id,
                'project_title': project.title,
            })
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Unknown error occurred'),
                'error_type': result.get('error_type', 'UnknownError'),
                'creator_splits': creator_splits
            }, status=status.HTTP_400_BAD_REQUEST)


class ProjectSectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project sections.

    Users can only edit sections they have permission for.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSectionSerializer

    def get_queryset(self):
        """Return sections from projects where user is a collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return ProjectSection.objects.none()

        # Sections from projects where user is creator or collaborator
        return ProjectSection.objects.filter(
            Q(project__created_by=core_user) | Q(project__collaborators__user=core_user)
        ).distinct()

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

    def get_queryset(self):
        """Return comments from projects where user is a collaborator."""
        user = self.request.user
        try:
            core_user = CoreUser.objects.get(username=user.username)
        except CoreUser.DoesNotExist:
            return ProjectComment.objects.none()

        # Comments from projects where user is creator or collaborator
        return ProjectComment.objects.filter(
            Q(project__created_by=core_user) | Q(project__collaborators__user=core_user)
        ).distinct()

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
