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

from ..models import (
    CollaborativeProject, CollaboratorRole, ProjectSection,
    ProjectComment, User as CoreUser, Content
)
from ..serializers import (
    CollaborativeProjectSerializer, CollaborativeProjectListSerializer,
    CollaboratorRoleSerializer, ProjectSectionSerializer, ProjectCommentSerializer
)
from ..notifications_utils import (
    notify_collaboration_invitation, notify_invitation_response,
    notify_section_update, notify_comment_added, notify_approval_status_change,
    notify_revenue_proposal, notify_counter_proposal
)


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

        project.save()

        # Reset revenue split approvals if price or editions changed
        if old_price != project.price_usd or old_editions != project.editions:
            project.collaborators.filter(status='accepted').update(approved_revenue_split=False)
            if project.status == 'ready_for_mint':
                project.status = 'active'
                project.save()

        serializer = CollaborativeProjectSerializer(project)
        return Response(serializer.data)

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

            # Create Content record for marketplace listing
            # This allows the minted NFT to be listed and sold on the home page
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
                nft_contract=result.get('mint_address', ''),
            )
            # Set teaser link to the content's teaser endpoint
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
                'message': 'Collaborative NFT minted successfully',
                'transaction_signature': result['transaction_signature'],
                'mint_address': result['mint_address'],
                'sale_amount_lamports': result['sale_amount_lamports'],
                'platform_fee_lamports': result['platform_fee_lamports'],
                'creator_splits': result['creator_splits'],
                'num_creators': result['num_creators'],
                'project_id': project.id,
                'project_title': project.title,
                'content_id': content.id,  # Content ID for marketplace listing
            })
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Unknown error occurred'),
                'error_type': result.get('error_type', 'UnknownError'),
                'creator_splits': creator_splits
            }, status=status.HTTP_400_BAD_REQUEST)

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
    pagination_class = None  # Disable pagination for comment lists

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
