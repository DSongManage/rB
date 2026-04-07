"""
Campaign (Fundraising) Views

Handles campaign CRUD, contribution intents, and lifecycle management.
Campaign escrow (PDA1) has 0% fee — funds flow into project escrow (PDA2)
where a 3% fee applies on milestone release.
"""

import json
import logging
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from ..models import (
    Campaign, CampaignContribution, CampaignUpdate,
    CampaignTier, CampaignMedia,
    CollaborativeProject, CollaboratorRole, ContractTask,
    StretchGoal, CampaignRoleInterest, User,
)

try:
    from solders.pubkey import Pubkey
except ImportError:
    Pubkey = None  # Solana SDK not installed

logger = logging.getLogger(__name__)


# ============================================================
# Serializers
# ============================================================


class CampaignTierSerializer(serializers.ModelSerializer):
    is_available = serializers.BooleanField(read_only=True)

    class Meta:
        model = CampaignTier
        fields = [
            'id', 'title', 'description', 'minimum_amount',
            'max_backers', 'current_backers', 'order', 'is_available',
            'includes_digital_copy', 'includes_print_copy',
            'includes_early_access', 'includes_credits',
            'custom_rewards', 'fulfillment_status',
        ]
        read_only_fields = ['id', 'current_backers']


class CampaignMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignMedia
        fields = ['id', 'image', 'caption', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


class StretchGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = StretchGoal
        fields = [
            'id', 'threshold_amount', 'title', 'description',
            'reached', 'reached_at', 'sort_order',
        ]
        read_only_fields = ['id', 'reached', 'reached_at']


class CampaignRoleInterestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CampaignRoleInterest
        fields = ['id', 'username', 'role_name', 'message', 'status', 'created_at']
        read_only_fields = ['id', 'username', 'status', 'created_at']


class CampaignListSerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    creator_display_name = serializers.SerializerMethodField()
    funding_percentage = serializers.IntegerField(read_only=True)
    is_goal_met = serializers.BooleanField(read_only=True)
    amount_per_chapter = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    tier_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'title', 'description', 'cover_image',
            'content_type', 'campaign_type',
            'funding_goal', 'current_amount', 'backer_count',
            'deadline', 'status',
            'creator_username', 'creator_display_name',
            'funding_percentage', 'is_goal_met',
            'chapter_count', 'chapters_published', 'amount_per_chapter',
            'tier_count',
            'created_at',
        ]

    def get_creator_display_name(self, obj):
        profile = getattr(obj.creator, 'profile', None)
        if profile and profile.display_name:
            return profile.display_name
        return obj.creator.username

    def get_tier_count(self, obj):
        return obj.tiers.count()


class CampaignDetailSerializer(CampaignListSerializer):
    project_id = serializers.IntegerField(source='project.id', read_only=True, allow_null=True)
    project_title = serializers.CharField(source='project.title', read_only=True, allow_null=True)
    contribution_count = serializers.SerializerMethodField()
    user_contribution = serializers.SerializerMethodField()
    tiers = CampaignTierSerializer(many=True, read_only=True)
    media = CampaignMediaSerializer(many=True, read_only=True)
    stretch_goals = StretchGoalSerializer(many=True, read_only=True)
    budget_breakdown = serializers.SerializerMethodField()
    production_progress = serializers.SerializerMethodField()
    open_roles = serializers.SerializerMethodField()
    team_members = serializers.SerializerMethodField()
    team_completion_percentage = serializers.SerializerMethodField()
    role_interest_counts = serializers.SerializerMethodField()
    previous_campaign_info = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta(CampaignListSerializer.Meta):
        fields = CampaignListSerializer.Meta.fields + [
            'pitch_html',
            'project_id', 'project_title',
            'campaign_pda', 'escrow_pda',
            'funded_at', 'escrow_creation_deadline', 'escrow_dormancy_deadline',
            'completed_at',
            'contribution_count', 'user_contribution',
            'tiers', 'media', 'stretch_goals',
            'collaborator_allocations', 'production_costs',
            'budget_breakdown', 'production_progress',
            'open_roles', 'team_members',
            'team_completion_percentage', 'role_interest_counts',
            'previous_campaign_info', 'days_remaining',
            'allow_overfunding', 'max_overfunding_amount',
            'production_start_deadline_days', 'role_assignment_deadline_days',
            'updated_at',
        ]

    def get_contribution_count(self, obj):
        return obj.contributions.filter(status='confirmed').count()

    def get_user_contribution(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        contribution = obj.contributions.filter(
            backer=request.user, status='confirmed'
        ).aggregate(total=Sum('amount'))
        return str(contribution['total'] or 0)

    def get_budget_breakdown(self, obj):
        """Budget breakdown from project milestones grouped by collaborator role."""
        if not obj.project:
            return []
        roles = obj.project.collaborators.select_related('user').all()
        breakdown = []
        for role in roles:
            tasks = ContractTask.objects.filter(collaborator_role=role).order_by('order')
            total = tasks.aggregate(total=Sum('payment_amount'))['total'] or Decimal('0')
            breakdown.append({
                'role': role.role,
                'assigned_to': role.user.username if role.status == 'accepted' else None,
                'total': str(total),
                'contract_type': role.contract_type,
                'milestones': [{
                    'title': t.title,
                    'amount': str(t.payment_amount),
                    'deadline': t.deadline.isoformat() if t.deadline else None,
                    'status': t.status,
                } for t in tasks],
                'milestone_count': tasks.count(),
                'status': 'assigned' if role.status == 'accepted' else 'open',
            })
        return breakdown

    def get_production_progress(self, obj):
        """Milestone status summary when in production."""
        if not obj.project or obj.status not in ('transferred', 'completed'):
            return None
        tasks = ContractTask.objects.filter(
            collaborator_role__project=obj.project
        )
        total = tasks.count()
        if total == 0:
            return None
        completed = tasks.filter(status__in=['complete', 'signed_off', 'released', 'approved']).count()
        in_progress = tasks.filter(status__in=['in_progress', 'submitted', 'under_review', 'resubmitted']).count()
        return {
            'total_milestones': total,
            'completed': completed,
            'in_progress': in_progress,
            'pending': total - completed - in_progress,
            'percentage': int((completed / total) * 100) if total > 0 else 0,
        }

    def get_open_roles(self, obj):
        """List unfilled roles from linked project."""
        if not obj.project:
            return []
        open_roles = obj.project.collaborators.exclude(
            status='accepted'
        ).values_list('role', flat=True).distinct()
        # Include interest counts
        result = []
        for role_name in open_roles:
            interest_count = obj.role_interests.filter(role_name=role_name).count()
            tasks = ContractTask.objects.filter(
                collaborator_role__project=obj.project,
                collaborator_role__role=role_name,
            )
            total_budget = tasks.aggregate(total=Sum('payment_amount'))['total'] or Decimal('0')
            result.append({
                'role': role_name,
                'milestone_count': tasks.count(),
                'budget': str(total_budget),
                'interest_count': interest_count,
            })
        return result

    def get_team_members(self, obj):
        """Accepted collaborators with profile data."""
        if not obj.project:
            return []
        accepted = obj.project.collaborators.filter(
            status='accepted'
        ).select_related('user')
        members = []
        for role in accepted:
            profile = getattr(role.user, 'profile', None)
            members.append({
                'username': role.user.username,
                'display_name': profile.display_name if profile and profile.display_name else role.user.username,
                'role': role.role,
                'avatar_url': profile.avatar_url if profile and profile.avatar_url else None,
            })
        return members

    def get_team_completion_percentage(self, obj):
        """Percentage of roles filled."""
        if not obj.project:
            return None
        total_roles = obj.project.collaborators.count()
        if total_roles == 0:
            return None
        accepted = obj.project.collaborators.filter(status='accepted').count()
        return int((accepted / total_roles) * 100)

    def get_role_interest_counts(self, obj):
        """Count of interest expressions per role name."""
        interests = obj.role_interests.values('role_name').annotate(
            count=Sum('id')  # Just need count
        )
        # Use a proper count
        from django.db.models import Count
        interests = obj.role_interests.values('role_name').annotate(
            count=Count('id')
        )
        return {item['role_name']: item['count'] for item in interests}

    def get_previous_campaign_info(self, obj):
        """Minimal info about the previous campaign in the series."""
        if not obj.previous_campaign:
            return None
        prev = obj.previous_campaign
        return {
            'id': prev.id,
            'title': prev.title,
            'status': prev.status,
        }

    def get_days_remaining(self, obj):
        """Days until campaign deadline."""
        if not obj.deadline:
            return None
        delta = obj.deadline - timezone.now()
        return max(0, delta.days)


class CampaignCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            'id', 'title', 'description', 'pitch_html', 'cover_image',
            'content_type', 'campaign_type',
            'funding_goal', 'deadline',
            'chapter_count', 'status',
            'collaborator_allocations', 'production_costs',
            'production_start_deadline_days', 'role_assignment_deadline_days',
            'allow_overfunding', 'max_overfunding_amount',
            'previous_campaign',
        ]
        read_only_fields = ['id', 'status']

    def validate_funding_goal(self, value):
        if value < Decimal('10.00'):
            raise serializers.ValidationError("Funding goal must be at least $10.")
        return value

    def validate_deadline(self, value):
        if value <= timezone.now() + timedelta(days=1):
            raise serializers.ValidationError("Deadline must be at least 24 hours from now.")
        if value > timezone.now() + timedelta(days=90):
            raise serializers.ValidationError("Deadline cannot be more than 90 days from now.")
        return value

    def validate(self, data):
        if data.get('campaign_type') == 'solo':
            if not data.get('chapter_count') or data['chapter_count'] < 1:
                raise serializers.ValidationError({
                    'chapter_count': 'Solo campaigns require at least 1 chapter.'
                })
        return data


class CampaignContributionSerializer(serializers.ModelSerializer):
    backer_username = serializers.CharField(source='backer.username', read_only=True)
    tier_title = serializers.SerializerMethodField()

    class Meta:
        model = CampaignContribution
        fields = [
            'id', 'amount', 'status', 'backer_username',
            'transaction_signature', 'tier_title',
            'percentage_of_total', 'withdrawn',
            'reward_tier_id', 'created_at',
        ]

    def get_tier_title(self, obj):
        if obj.reward_tier:
            return obj.reward_tier.title
        tier = obj.campaign.tiers.filter(
            minimum_amount__lte=obj.amount
        ).order_by('-minimum_amount').first()
        return tier.title if tier else None


class CampaignUpdateSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = CampaignUpdate
        fields = ['id', 'title', 'body', 'author_username', 'created_at']


# ============================================================
# ViewSet
# ============================================================


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action in ('create', 'partial_update', 'update'):
            return CampaignCreateSerializer
        if self.action == 'list':
            return CampaignListSerializer
        return CampaignDetailSerializer

    # Actions that are publicly readable (no auth required, public queryset)
    PUBLIC_READ_ACTIONS = ('retrieve', 'discover', 'campaign_updates', 'contributions',
                           'manage_tiers', 'manage_media', 'open_roles', 'manage_stretch_goals')

    # Actions that any authenticated user can perform on any active campaign
    PUBLIC_WRITE_ACTIONS = ('back', 'withdraw', 'express_interest', 'reclaim')

    def get_permissions(self):
        if self.action in self.PUBLIC_READ_ACTIONS and self.request.method == 'GET':
            return [AllowAny()]
        if self.action == 'discover':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # For public read actions + public write actions: show all non-draft campaigns
        if self.action in self.PUBLIC_READ_ACTIONS or self.action in self.PUBLIC_WRITE_ACTIONS:
            return Campaign.objects.exclude(
                status='draft'
            ).select_related('creator', 'project').prefetch_related('tiers', 'media')

        # For list and other actions: only show user's own campaigns + backed campaigns
        user = self.request.user
        if not user.is_authenticated:
            return Campaign.objects.none()
        return Campaign.objects.filter(
            Q(creator=user) |
            Q(contributions__backer=user, contributions__status='confirmed')
        ).distinct().select_related('creator', 'project').prefetch_related('tiers', 'media')

    def perform_create(self, serializer):
        campaign = serializer.save(creator=self.request.user)
        # If collaborative, try to link to a project
        project_id = self.request.data.get('project_id')
        if project_id and campaign.campaign_type == 'collaborative':
            try:
                project = CollaborativeProject.objects.get(
                    id=project_id, created_by=self.request.user
                )
                campaign.project = project

                # Validate/correct allocations against project milestones
                alloc_json = self.request.data.get('collaborator_allocations')
                if alloc_json:
                    allocations = json.loads(alloc_json) if isinstance(alloc_json, str) else alloc_json
                    corrected = False
                    for alloc in allocations:
                        role_id = alloc.get('collaborator_role_id')
                        if role_id:
                            project_total = ContractTask.objects.filter(
                                collaborator_role_id=role_id
                            ).aggregate(total=Sum('payment_amount'))['total'] or Decimal('0')
                            campaign_amount = Decimal(str(alloc.get('amount', '0')))
                            if project_total > 0 and abs(campaign_amount - project_total) > Decimal('0.01'):
                                logger.warning(
                                    'Campaign allocation mismatch for role %s: campaign=$%s vs project=$%s. Using project amount.',
                                    role_id, campaign_amount, project_total
                                )
                                alloc['amount'] = str(project_total)
                                corrected = True
                    if corrected:
                        campaign.collaborator_allocations = allocations

                campaign.save(update_fields=['project', 'collaborator_allocations'])
            except CollaborativeProject.DoesNotExist:
                pass

        # Create tiers if provided (JSON string in FormData)
        tiers_json = self.request.data.get('tiers_json')
        if tiers_json:
            try:
                tiers = json.loads(tiers_json) if isinstance(tiers_json, str) else tiers_json
                for i, tier_data in enumerate(tiers):
                    CampaignTier.objects.create(
                        campaign=campaign,
                        title=tier_data.get('title', ''),
                        description=tier_data.get('description', ''),
                        minimum_amount=Decimal(str(tier_data.get('minimum_amount', 0))),
                        max_backers=tier_data.get('max_backers'),
                        order=i,
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    @action(detail=True, methods=['post'])
    def launch(self, request, pk=None):
        """Activate a draft campaign and initialize PDA1 on-chain."""
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response(
                {'error': 'Only the creator can launch a campaign.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if campaign.status != 'draft':
            return Response(
                {'error': f'Cannot launch: campaign is {campaign.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Initialize campaign PDA on-chain before transitioning to active
        try:
            from ..services.campaign_solana_service import CampaignSolanaService
            service = CampaignSolanaService()
            sig = service.initialize_campaign_on_chain(campaign)
            logger.info('Campaign %d initialized on-chain: %s', campaign.id, sig)
        except Exception as e:
            logger.error('Failed to initialize campaign %d on-chain: %s', campaign.id, e)
            return Response(
                {'error': 'Failed to initialize on-chain escrow. Please try again.', 'detail': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        campaign.status = 'active'
        campaign.save(update_fields=['status', 'updated_at'])

        from ..notifications_utils import notify_campaign_launched
        notify_campaign_launched(campaign)

        return Response(CampaignDetailSerializer(campaign, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a campaign. If active with contributions, backers can reclaim."""
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response(
                {'error': 'Only the creator can cancel.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if campaign.status not in ('draft', 'active'):
            return Response(
                {'error': f'Cannot cancel: campaign is {campaign.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if campaign.current_amount > 0:
            campaign.status = 'reclaimable'
        else:
            campaign.status = 'cancelled'
        campaign.cancelled_at = timezone.now()
        campaign.save(update_fields=['status', 'cancelled_at', 'updated_at'])

        if campaign.current_amount > 0:
            from ..notifications_utils import notify_campaign_failed
            notify_campaign_failed(campaign)

        return Response(CampaignDetailSerializer(campaign, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def contributions(self, request, pk=None):
        """List contributions for a campaign."""
        campaign = self.get_object()
        if campaign.creator == request.user:
            qs = campaign.contributions.filter(status='confirmed')
        else:
            qs = campaign.contributions.filter(backer=request.user)
        serializer = CampaignContributionSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='updates')
    def campaign_updates(self, request, pk=None):
        """List or create campaign updates."""
        campaign = self.get_object()

        if request.method == 'GET':
            updates = campaign.updates.all()
            serializer = CampaignUpdateSerializer(updates, many=True)
            return Response(serializer.data)

        if campaign.creator != request.user:
            return Response(
                {'error': 'Only the creator can post updates.'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_obj = serializer.save(campaign=campaign, author=request.user)

        from ..notifications_utils import notify_campaign_update_posted
        notify_campaign_update_posted(campaign, update_obj)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post', 'delete'], url_path='tiers')
    def manage_tiers(self, request, pk=None):
        """CRUD for campaign reward tiers."""
        campaign = self.get_object()

        if request.method == 'GET':
            serializer = CampaignTierSerializer(campaign.tiers.all(), many=True)
            return Response(serializer.data)

        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can manage tiers.'}, status=status.HTTP_403_FORBIDDEN)
        if campaign.status not in ('draft', 'active'):
            return Response({'error': 'Cannot modify tiers after campaign is funded.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.method == 'POST':
            serializer = CampaignTierSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(campaign=campaign)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # DELETE — expects tier_id in body
        tier_id = request.data.get('tier_id')
        if not tier_id:
            return Response({'error': 'tier_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        campaign.tiers.filter(id=tier_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post', 'delete'], url_path='media')
    def manage_media(self, request, pk=None):
        """CRUD for campaign media gallery."""
        campaign = self.get_object()

        if request.method == 'GET':
            serializer = CampaignMediaSerializer(campaign.media.all(), many=True)
            return Response(serializer.data)

        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can manage media.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            image = request.FILES.get('image')
            if not image:
                return Response({'error': 'image file is required.'}, status=status.HTTP_400_BAD_REQUEST)
            media = CampaignMedia.objects.create(
                campaign=campaign,
                image=image,
                caption=request.data.get('caption', ''),
                order=campaign.media.count(),
            )
            return Response(CampaignMediaSerializer(media).data, status=status.HTTP_201_CREATED)

        # DELETE
        media_id = request.data.get('media_id')
        if not media_id:
            return Response({'error': 'media_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        campaign.media.filter(id=media_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='transfer-to-escrow')
    def transfer_to_escrow(self, request, pk=None):
        """Transfer campaign funds from PDA1 to PDA2 (project escrow).

        Solo: auto-creates a CollaborativeProject, initializes escrow PDA2, transfers funds.
        Collaborative: requires existing project, initializes escrow PDA2, transfers funds.
        """
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can transfer funds.'}, status=status.HTTP_403_FORBIDDEN)
        if campaign.status != 'funded':
            return Response({'error': f'Cannot transfer: campaign is {campaign.status}, must be funded.'}, status=status.HTTP_400_BAD_REQUEST)

        from ..services.campaign_solana_service import CampaignSolanaService
        service = CampaignSolanaService()

        try:
            if campaign.campaign_type == 'solo':
                # Auto-create project for solo campaign
                if not campaign.project:
                    project = CollaborativeProject.objects.create(
                        title=campaign.title,
                        content_type=campaign.content_type or 'comic',
                        description=campaign.description,
                        created_by=campaign.creator,
                        status='active',
                        is_solo=True,
                    )
                    campaign.project = project
                    campaign.save(update_fields=['project'])
                    logger.info('[CampaignTransfer] Auto-created project %d for solo campaign %d', project.id, campaign.id)

                # Initialize escrow PDA2 on-chain
                escrow_info = service.setup_solo_escrow(campaign)
                chapter_count = escrow_info['chapter_count']
                per_chapter = escrow_info['per_chapter_lamports']
                milestone_amounts = [per_chapter] * chapter_count
                # Spread deadlines evenly over the escrow period (90 days)
                import time
                base_deadline = int(time.time()) + (90 * 86400)
                milestone_deadlines = [base_deadline + (i * 30 * 86400) for i in range(chapter_count)]

                service.initialize_escrow_on_chain(
                    campaign, escrow_info['artist_pubkey'], milestone_amounts, milestone_deadlines
                )

                # Transfer PDA1 → PDA2 on-chain
                transfer_sig = service.transfer_to_escrow_on_chain(campaign)

                escrow_pda = escrow_info['escrow_pda']
                escrow_bump = escrow_info['escrow_pda_bump']

            else:
                # Collaborative: project must already exist
                if not campaign.project:
                    return Response(
                        {'error': 'Collaborative campaigns must be linked to a project.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Use CREATOR's wallet for single PDA2 — all campaign funds go to one escrow
                creator_wallet = campaign.creator.wallet_address
                if not creator_wallet:
                    return Response(
                        {'error': 'Creator has no wallet address.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                creator_pubkey_obj = Pubkey.from_string(creator_wallet)
                total_campaign_lamports = service._usd_to_lamports(campaign.current_amount)

                # Compute milestones from project tasks
                import time
                base_deadline = int(time.time()) + (90 * 86400)
                funding_time = timezone.now()

                project_tasks = ContractTask.objects.filter(
                    collaborator_role__project=campaign.project,
                    collaborator_role__status='accepted',
                ).order_by('collaborator_role__id', 'order')

                if project_tasks.exists():
                    for task in project_tasks:
                        if task.deadline_days_after_funding and not task.deadline:
                            task.deadline = funding_time + timedelta(days=task.deadline_days_after_funding)
                            task.save(update_fields=['deadline'])

                    milestone_amounts = [service._usd_to_lamports(t.payment_amount) for t in project_tasks]
                    milestone_deadlines = [
                        int(t.deadline.timestamp()) if t.deadline else base_deadline + (i * 30 * 86400)
                        for i, t in enumerate(project_tasks)
                    ]
                else:
                    # Fallback: single milestone for full amount
                    milestone_amounts = [total_campaign_lamports]
                    milestone_deadlines = [base_deadline]

                # Initialize escrow with creator as owner — ALL campaign funds
                service.initialize_escrow_on_chain(
                    campaign, creator_pubkey_obj, milestone_amounts, milestone_deadlines
                )
                transfer_sig = service.transfer_to_escrow_on_chain(campaign)

                escrow_pda_obj, escrow_bump = service.derive_escrow_pda(campaign.id, creator_pubkey_obj)
                escrow_pda = str(escrow_pda_obj)

            # Update DB state
            campaign.transfer_tx_signature = transfer_sig
            campaign.mark_transferred(escrow_pda, escrow_bump)
            campaign.contributions.filter(status='confirmed').update(status='transferred')

            # Set escrow_pda_address on all accepted work-for-hire roles
            # This wires them into the existing process_escrow_release Celery flow
            for role in campaign.project.collaborators.filter(
                status='accepted', contract_type__in=['work_for_hire', 'hybrid']
            ):
                role.escrow_pda_address = escrow_pda
                role.save(update_fields=['escrow_pda_address'])

            logger.info('[CampaignTransfer] Campaign %d transferred. PDA2: %s, TX: %s',
                        campaign.id, escrow_pda, transfer_sig)

        except Exception as e:
            logger.error('[CampaignTransfer] Failed for campaign %d: %s', campaign.id, e, exc_info=True)
            return Response(
                {'error': 'Transfer to escrow failed. Please try again.', 'detail': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(CampaignDetailSerializer(campaign, context={'request': request}).data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def discover(self, request):
        """Public listing of campaigns (active + funded + in production + completed)."""
        campaigns = Campaign.objects.filter(
            status__in=['active', 'funded', 'transferred', 'completed']
        ).select_related('creator', 'project').order_by('-created_at')

        campaign_type = request.query_params.get('type')
        content_type = request.query_params.get('content_type')
        if campaign_type:
            campaigns = campaigns.filter(campaign_type=campaign_type)
        if content_type:
            campaigns = campaigns.filter(content_type=content_type)

        serializer = CampaignListSerializer(campaigns, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-campaigns')
    def my_campaigns(self, request):
        """List campaigns created by the current user (for profile page)."""
        campaigns = Campaign.objects.filter(
            creator=request.user
        ).select_related('creator', 'project').order_by('-created_at')
        serializer = CampaignListSerializer(campaigns, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reclaim(self, request, pk=None):
        """Backer initiates reclaim of their contribution.

        Available when campaign status is 'failed' or 'reclaimable'.
        If request includes transaction_signature, verifies and marks as reclaimed.
        Otherwise, returns instruction params for frontend wallet signing.
        """
        campaign = self.get_object()
        if campaign.status not in ('failed', 'reclaimable'):
            return Response(
                {'error': f'Cannot reclaim: campaign is {campaign.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contribution = campaign.contributions.filter(
            backer=request.user, status__in=['confirmed', 'transferred']
        ).first()
        if not contribution:
            return Response({'error': 'No reclaimable contribution found.'}, status=status.HTTP_404_NOT_FOUND)

        transaction_signature = request.data.get('transaction_signature', '')

        if transaction_signature:
            # Verify the on-chain reclaim tx, then mark as reclaimed
            if campaign.on_chain_initialized:
                try:
                    from ..services.campaign_solana_service import CampaignSolanaService
                    service = CampaignSolanaService()
                    verified = service.verify_contribution_tx(transaction_signature, campaign, '', Decimal('0'))
                    if not verified:
                        return Response({'error': 'Reclaim transaction verification failed.'}, status=status.HTTP_400_BAD_REQUEST)
                except Exception as e:
                    logger.warning('Reclaim TX verification error: %s', e)

            contribution.status = 'reclaimed'
            contribution.reclaim_tx_signature = transaction_signature
            contribution.save(update_fields=['status', 'reclaim_tx_signature'])

            logger.info('[CampaignReclaim] %s reclaimed $%s from campaign %s',
                        request.user.username, contribution.amount, campaign.id)

            return Response({
                'contribution_id': contribution.id,
                'refund_amount': str(contribution.amount),
                'campaign_pda': campaign.campaign_pda,
                'status': 'reclaimed',
            })
        else:
            # Return instruction params for frontend to build reclaim tx
            reclaim_params = {}
            backer_wallet = getattr(request.user, 'wallet_address', '')
            if backer_wallet and campaign.on_chain_initialized:
                try:
                    from ..services.campaign_solana_service import CampaignSolanaService
                    service = CampaignSolanaService()
                    reclaim_params = service.get_reclaim_instruction_params(campaign, backer_wallet)
                except Exception as e:
                    logger.warning('Failed to build reclaim instruction params: %s', e)

            return Response({
                'contribution_id': contribution.id,
                'refund_amount': str(contribution.amount),
                'campaign_pda': campaign.campaign_pda,
                **reclaim_params,
            })

    @action(detail=True, methods=['get'], url_path='escrow-status')
    def escrow_status(self, request, pk=None):
        """Get escrow/production status for a funded or transferred campaign."""
        campaign = self.get_object()
        if campaign.status not in ('funded', 'transferred', 'completed'):
            return Response(
                {'error': 'Escrow status only available for funded/transferred/completed campaigns.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'campaign_id': campaign.id,
            'status': campaign.status,
            'campaign_pda': campaign.campaign_pda,
            'escrow_pda': campaign.escrow_pda,
            'funding_goal': str(campaign.funding_goal),
            'current_amount': str(campaign.current_amount),
            'campaign_type': campaign.campaign_type,
            'chapter_count': campaign.chapter_count,
            'chapters_published': campaign.chapters_published,
            'funded_at': campaign.funded_at.isoformat() if campaign.funded_at else None,
            'escrow_dormancy_deadline': campaign.escrow_dormancy_deadline.isoformat() if campaign.escrow_dormancy_deadline else None,
            'completed_at': campaign.completed_at.isoformat() if campaign.completed_at else None,
        })

    # ---- New campaign endpoints ----

    @action(detail=True, methods=['post'])
    def back(self, request, pk=None):
        """Back a campaign with an optional tier selection.

        Creates a contribution, validates overfunding caps and tier availability,
        checks stretch goals, and sends notifications.
        """
        campaign = self.get_object()
        if campaign.status not in ('active', 'funded'):
            return Response({'error': f'Cannot back: campaign is {campaign.status}.'}, status=status.HTTP_400_BAD_REQUEST)
        if campaign.deadline and campaign.deadline < timezone.now():
            return Response({'error': 'Campaign deadline has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get('amount')
        tier_id = request.data.get('tier_id')
        tx_signature = request.data.get('transaction_signature', '')

        if not amount:
            return Response({'error': 'amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(amount))
            if amount < Decimal('1.00'):
                return Response({'error': 'Minimum contribution is $1.00.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        # Overfunding cap check
        if not campaign.allow_overfunding and campaign.is_goal_met:
            return Response({'error': 'Campaign does not accept overfunding.'}, status=status.HTTP_400_BAD_REQUEST)
        if campaign.max_overfunding_amount:
            max_total = campaign.funding_goal + campaign.max_overfunding_amount
            if campaign.current_amount + amount > max_total:
                return Response({
                    'error': f'Exceeds overfunding cap. Maximum additional: ${max_total - campaign.current_amount:.2f}'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Tier validation
        tier = None
        if tier_id:
            try:
                tier = campaign.tiers.get(id=tier_id)
            except CampaignTier.DoesNotExist:
                return Response({'error': 'Tier not found.'}, status=status.HTTP_404_NOT_FOUND)
            if not tier.is_available:
                return Response({'error': 'This tier is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)
            if amount < tier.minimum_amount:
                return Response({
                    'error': f'Minimum amount for this tier is ${tier.minimum_amount}.'
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            contribution = CampaignContribution.objects.create(
                campaign=campaign, backer=request.user,
                amount=amount, status='confirmed',
                reward_tier=tier,
                transaction_signature=tx_signature,
            )
            if tier:
                tier.current_backers += 1
                tier.save(update_fields=['current_backers'])

            campaign.current_amount += amount
            campaign.backer_count = campaign.contributions.filter(
                status='confirmed', withdrawn=False,
            ).values('backer').distinct().count()
            campaign.save(update_fields=['current_amount', 'backer_count', 'updated_at'])

            goal_just_met = campaign.is_goal_met and campaign.status == 'active'
            if goal_just_met:
                campaign.mark_funded()

            # Recalculate backer percentages
            _recalculate_backer_percentages(campaign)

        # Check stretch goals
        _check_stretch_goals(campaign)

        # Notifications
        from ..notifications_utils import (
            notify_campaign_backed, notify_campaign_new_backer,
            notify_campaign_funded, notify_campaign_goal_reached,
        )
        notify_campaign_backed(request.user, campaign)
        notify_campaign_new_backer(request.user, campaign)
        if goal_just_met:
            notify_campaign_funded(campaign)
            notify_campaign_goal_reached(campaign)

        return Response({
            'contribution_id': contribution.id,
            'amount': str(amount),
            'campaign_status': campaign.status,
            'current_amount': str(campaign.current_amount),
            'funding_percentage': campaign.funding_percentage,
            'is_goal_met': campaign.is_goal_met,
        })

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw backing before campaign deadline."""
        campaign = self.get_object()
        if campaign.status not in ('active', 'funded'):
            return Response({'error': f'Cannot withdraw: campaign is {campaign.status}.'}, status=status.HTTP_400_BAD_REQUEST)
        if campaign.deadline and campaign.deadline < timezone.now():
            return Response({'error': 'Cannot withdraw after deadline.'}, status=status.HTTP_400_BAD_REQUEST)

        contribution = campaign.contributions.filter(
            backer=request.user, status='confirmed', withdrawn=False,
        ).first()
        if not contribution:
            return Response({'error': 'No active contribution found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            contribution.withdrawn = True
            contribution.withdrawn_at = timezone.now()
            contribution.save(update_fields=['withdrawn', 'withdrawn_at'])

            campaign.current_amount -= contribution.amount
            campaign.backer_count = campaign.contributions.filter(
                status='confirmed', withdrawn=False,
            ).values('backer').distinct().count()

            # Decrement tier counter
            if contribution.reward_tier:
                tier = contribution.reward_tier
                tier.current_backers = max(0, tier.current_backers - 1)
                tier.save(update_fields=['current_backers'])

            # Revert funded status if below goal
            if campaign.status == 'funded' and not campaign.is_goal_met:
                campaign.status = 'active'
                campaign.funded_at = None
                campaign.escrow_creation_deadline = None
                campaign.save(update_fields=[
                    'current_amount', 'backer_count', 'status',
                    'funded_at', 'escrow_creation_deadline', 'updated_at',
                ])
            else:
                campaign.save(update_fields=['current_amount', 'backer_count', 'updated_at'])

            _recalculate_backer_percentages(campaign)

        # Notification
        from ..notifications_utils import notify_campaign_backer_withdrew
        notify_campaign_backer_withdrew(request.user, campaign)

        # Return on-chain reclaim params if applicable
        reclaim_params = {}
        backer_wallet = getattr(request.user, 'wallet_address', '')
        if backer_wallet and campaign.on_chain_initialized:
            try:
                from ..services.campaign_solana_service import CampaignSolanaService
                service = CampaignSolanaService()
                reclaim_params = service.get_reclaim_instruction_params(campaign, backer_wallet)
            except Exception as e:
                logger.warning('Failed to build withdraw instruction params: %s', e)

        return Response({
            'contribution_id': contribution.id,
            'refund_amount': str(contribution.amount),
            'campaign_status': campaign.status,
            'current_amount': str(campaign.current_amount),
            **reclaim_params,
        })

    @action(detail=True, methods=['get'], url_path='open-roles')
    def open_roles(self, request, pk=None):
        """List unfilled roles from the linked project."""
        campaign = self.get_object()
        if not campaign.project:
            return Response({'error': 'No project linked to this campaign.'}, status=status.HTTP_400_BAD_REQUEST)

        roles = campaign.project.collaborators.exclude(status='accepted')
        result = []
        for role in roles:
            tasks = ContractTask.objects.filter(collaborator_role=role)
            total_budget = tasks.aggregate(total=Sum('payment_amount'))['total'] or Decimal('0')
            interest_count = campaign.role_interests.filter(role_name=role.role).count()
            result.append({
                'role_id': role.id,
                'role': role.role,
                'milestone_count': tasks.count(),
                'budget': str(total_budget),
                'interest_count': interest_count,
                'status': role.status,
            })
        return Response(result)

    @action(detail=True, methods=['post'], url_path='express-interest')
    def express_interest(self, request, pk=None):
        """Creator expresses interest in an open campaign role."""
        campaign = self.get_object()
        role_name = request.data.get('role_name', '').strip()
        message = request.data.get('message', '')

        if not role_name:
            return Response({'error': 'role_name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicate
        existing = campaign.role_interests.filter(
            user=request.user, role_name=role_name,
        ).first()
        if existing:
            return Response({'error': 'You already expressed interest in this role.'},
                            status=status.HTTP_400_BAD_REQUEST)

        interest = CampaignRoleInterest.objects.create(
            campaign=campaign, user=request.user,
            role_name=role_name, message=message,
        )

        from ..notifications_utils import notify_campaign_role_interest
        notify_campaign_role_interest(request.user, campaign, role_name)

        return Response(CampaignRoleInterestSerializer(interest).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='role-interests/(?P<interest_id>[^/.]+)/accept')
    def accept_role_interest(self, request, pk=None, interest_id=None):
        """Accept a role interest — creates CollaboratorRole + ContractTasks from TBD allocation."""
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can accept role interests.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            interest = CampaignRoleInterest.objects.get(
                id=interest_id, campaign=campaign, status='pending',
            )
        except CampaignRoleInterest.DoesNotExist:
            return Response({'error': 'Pending interest not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Find matching TBD allocation
        allocations = campaign.collaborator_allocations or []
        tbd_alloc = None
        tbd_idx = None
        for i, alloc in enumerate(allocations):
            if alloc.get('is_tbd') and alloc.get('role') == interest.role_name:
                tbd_alloc = alloc
                tbd_idx = i
                break

        if not tbd_alloc:
            return Response({'error': 'No TBD allocation found for role: %s' % interest.role_name},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create CollaboratorRole
            role = CollaboratorRole.objects.create(
                project=campaign.project,
                user=interest.user,
                role=interest.role_name,
                status='invited',
                revenue_percentage=Decimal('0'),
                contract_type='work_for_hire',
                total_contract_amount=Decimal(str(tbd_alloc.get('amount', '0'))),
            )

            # Set escrow_pda_address if campaign already transferred
            if campaign.escrow_pda:
                role.escrow_pda_address = campaign.escrow_pda
                role.save(update_fields=['escrow_pda_address'])

            # Create ContractTasks from TBD milestones
            milestones = tbd_alloc.get('milestones', [])
            for i, m in enumerate(milestones):
                days_after = int(m.get('days_after_funding', 30))
                # Compute absolute deadline if campaign is already funded
                deadline = None
                if campaign.funded_at:
                    from datetime import timedelta
                    deadline = campaign.funded_at + timedelta(days=days_after)

                ContractTask.objects.create(
                    collaborator_role=role,
                    title=m.get('title', 'Milestone %d' % (i + 1)),
                    description=m.get('description', ''),
                    deadline=deadline,
                    deadline_days_after_funding=days_after,
                    payment_amount=Decimal(str(m.get('amount', '0'))),
                    status='pending',
                    escrow_release_status='pending',
                    milestone_type=m.get('milestone_type', 'custom'),
                    order=i,
                )

            # Update allocation — mark as assigned
            allocations[tbd_idx] = {
                **tbd_alloc,
                'is_tbd': False,
                'collaborator_role_id': role.id,
                'username': interest.user.username,
            }
            campaign.collaborator_allocations = allocations
            campaign.save(update_fields=['collaborator_allocations'])

            # Update interest status
            interest.status = 'accepted'
            interest.save(update_fields=['status'])

            # Decline all other pending interests for this role
            CampaignRoleInterest.objects.filter(
                campaign=campaign, role_name=interest.role_name, status='pending',
            ).exclude(id=interest.id).update(status='declined')

        # Notifications
        from ..notifications_utils import notify_collaboration_invitation, notify_campaign_team_joined
        notify_collaboration_invitation(request.user, interest.user, campaign.project, interest.role_name)
        if campaign.status in ('active', 'funded', 'transferred'):
            notify_campaign_team_joined(campaign, interest.user, interest.role_name)

        return Response({
            'status': 'accepted',
            'collaborator_role_id': role.id,
            'username': interest.user.username,
            'role': interest.role_name,
            'milestones_created': len(milestones),
        })

    @action(detail=True, methods=['post'], url_path='role-interests/(?P<interest_id>[^/.]+)/decline')
    def decline_role_interest(self, request, pk=None, interest_id=None):
        """Decline a role interest."""
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can decline role interests.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            interest = CampaignRoleInterest.objects.get(
                id=interest_id, campaign=campaign, status='pending',
            )
        except CampaignRoleInterest.DoesNotExist:
            return Response({'error': 'Pending interest not found.'}, status=status.HTTP_404_NOT_FOUND)

        interest.status = 'declined'
        interest.save(update_fields=['status'])
        return Response({'status': 'declined'})

    @action(detail=True, methods=['get', 'post', 'delete'], url_path='stretch-goals')
    def manage_stretch_goals(self, request, pk=None):
        """CRUD for campaign stretch goals."""
        campaign = self.get_object()

        if request.method == 'GET':
            serializer = StretchGoalSerializer(campaign.stretch_goals.all(), many=True)
            return Response(serializer.data)

        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can manage stretch goals.'},
                            status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            if campaign.status not in ('draft', 'active', 'funded'):
                return Response({'error': 'Cannot add stretch goals after campaign closes.'},
                                status=status.HTTP_400_BAD_REQUEST)

            serializer = StretchGoalSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            threshold = serializer.validated_data['threshold_amount']
            if threshold <= campaign.funding_goal:
                return Response({'error': 'Stretch goal threshold must exceed the funding goal.'},
                                status=status.HTTP_400_BAD_REQUEST)

            serializer.save(campaign=campaign)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # DELETE
        goal_id = request.data.get('stretch_goal_id')
        if not goal_id:
            return Response({'error': 'stretch_goal_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = campaign.stretch_goals.filter(id=goal_id, reached=False).delete()
        if not deleted:
            return Response({'error': 'Stretch goal not found or already reached.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _check_stretch_goals(campaign):
    """Check and activate any newly reached stretch goals."""
    unreached = campaign.stretch_goals.filter(
        reached=False, threshold_amount__lte=campaign.current_amount,
    ).order_by('threshold_amount')
    for goal in unreached:
        goal.reached = True
        goal.reached_at = timezone.now()
        goal.save(update_fields=['reached', 'reached_at'])
        from ..notifications_utils import notify_campaign_stretch_reached
        notify_campaign_stretch_reached(campaign, goal)


def _recalculate_backer_percentages(campaign):
    """Recalculate percentage_of_total for all active contributions."""
    total = campaign.current_amount
    if total <= 0:
        return
    for c in campaign.contributions.filter(status='confirmed', withdrawn=False):
        c.percentage_of_total = (c.amount / total * 100).quantize(Decimal('0.01'))
        c.save(update_fields=['percentage_of_total'])


# ============================================================
# Payment Views
# ============================================================


class CreateCampaignContributionIntentView(APIView):
    """Create a pending contribution for a campaign (acts as intent)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        campaign_id = request.data.get('campaign_id')
        amount = request.data.get('amount')

        if not campaign_id or not amount:
            return Response({'error': 'campaign_id and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
            if amount < Decimal('1.00'):
                return Response({'error': 'Minimum contribution is $1.00.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            campaign = Campaign.objects.get(id=campaign_id, status='active')
        except Campaign.DoesNotExist:
            return Response({'error': 'Campaign not found or not active.'}, status=status.HTTP_404_NOT_FOUND)

        # Reuse or replace any existing pending contribution for this backer
        existing = CampaignContribution.objects.filter(
            campaign=campaign, backer=request.user, status='pending', withdrawn=False,
        ).first()
        if existing:
            existing.amount = amount
            existing.save(update_fields=['amount'])
            contribution = existing
        else:
            contribution = CampaignContribution.objects.create(
                campaign=campaign, backer=request.user, amount=amount, status='pending',
            )

        try:
            from ..models import UserBalance
            balance = UserBalance.objects.get(user=request.user)
            has_sufficient_balance = Decimal(str(balance.cached_balance)) >= amount
            current_balance = str(balance.cached_balance)
        except Exception:
            has_sufficient_balance = False
            current_balance = '0.00'

        # Build sponsored transaction for Web3Auth signing
        sponsored_tx = {}
        wallet_balance = '0.00'
        backer_wallet = getattr(request.user, 'wallet_address', None)
        try:
            if backer_wallet and campaign.on_chain_initialized and campaign.campaign_pda:
                from ..services.campaign_solana_service import CampaignSolanaService
                service = CampaignSolanaService()
                sponsored_tx = service.build_sponsored_contribute_tx(campaign, backer_wallet, amount)

                # Check on-chain USDC balance
                try:
                    from solana.rpc.types import TokenAccountOpts
                    from solders.pubkey import Pubkey as SolPubkey
                    usdc_mint = SolPubkey.from_string(str(service.usdc_mint))
                    backer_pk = SolPubkey.from_string(backer_wallet)
                    token_resp = service.client.get_token_accounts_by_owner_json_parsed(
                        backer_pk, TokenAccountOpts(mint=usdc_mint)
                    )
                    if token_resp.value:
                        for acct in token_resp.value:
                            info = acct.account.data.parsed
                            wallet_balance = str(info['info']['tokenAmount']['uiAmount'] or 0)
                except Exception as e:
                    logger.warning('Failed to check on-chain USDC balance: %s', e)
        except Exception as e:
            logger.warning('Failed to build sponsored contribution tx: %s', e)

        # For on-chain campaigns, check wallet balance too
        has_wallet_balance = float(wallet_balance) >= float(amount) if backer_wallet else False

        return Response({
            'contribution_id': contribution.id,
            'amount': str(amount),
            'campaign_id': campaign.id,
            'campaign_title': campaign.title,
            'has_sufficient_balance': has_sufficient_balance or has_wallet_balance,
            'current_balance': current_balance,
            'wallet_balance': wallet_balance,
            'has_wallet_balance': has_wallet_balance,
            'fee': '0.00',
            'fee_note': 'Campaign contributions have 0% platform fee.',
            'on_chain': campaign.on_chain_initialized,
            # Sponsored transaction for Web3Auth signing
            **sponsored_tx,
        })


class ConfirmCampaignContributionView(APIView):
    """Confirm a pending campaign contribution after payment is processed."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        contribution_id = request.data.get('contribution_id')
        transaction_signature = request.data.get('transaction_signature', '')

        if not contribution_id:
            return Response({'error': 'contribution_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            contribution = CampaignContribution.objects.select_related('campaign').get(
                id=contribution_id, backer=request.user, status='pending',
            )
        except CampaignContribution.DoesNotExist:
            return Response({'error': 'Pending contribution not found.'}, status=status.HTTP_404_NOT_FOUND)

        campaign = contribution.campaign
        if campaign.status != 'active':
            return Response({'error': 'Campaign is no longer active.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify on-chain transaction if signature provided
        if transaction_signature and campaign.on_chain_initialized:
            try:
                from ..services.campaign_solana_service import CampaignSolanaService
                service = CampaignSolanaService()
                backer_wallet = getattr(request.user, 'wallet_address', '')
                if backer_wallet:
                    verified = service.verify_contribution_tx(
                        transaction_signature, campaign, backer_wallet, contribution.amount
                    )
                    if not verified:
                        logger.warning('Contribution TX verification failed: %s', transaction_signature)
                        return Response(
                            {'error': 'Transaction verification failed. Please check and try again.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    # Store backer record PDA
                    campaign_pda, _ = service.derive_campaign_pda(campaign.id)
                    backer_pubkey = Pubkey.from_string(backer_wallet)
                    backer_record_pda, _ = service.derive_backer_pda(campaign_pda, backer_pubkey)
                    contribution.backer_record_pda = str(backer_record_pda)
            except Exception as e:
                logger.warning('Contribution TX verification error (non-blocking): %s', e)

        with transaction.atomic():
            contribution.status = 'confirmed'
            contribution.transaction_signature = transaction_signature
            contribution.save(update_fields=['status', 'transaction_signature', 'backer_record_pda'])

            campaign.current_amount += contribution.amount
            campaign.backer_count = campaign.contributions.filter(
                status='confirmed'
            ).values('backer').distinct().count()
            campaign.save(update_fields=['current_amount', 'backer_count', 'updated_at'])

            goal_just_met = campaign.is_goal_met and campaign.status == 'active'
            if goal_just_met:
                campaign.mark_funded()

            _recalculate_backer_percentages(campaign)

        # Check stretch goals
        _check_stretch_goals(campaign)

        # Notifications
        from ..notifications_utils import (
            notify_campaign_backed, notify_campaign_new_backer,
            notify_campaign_funded, notify_campaign_goal_reached,
        )
        notify_campaign_backed(request.user, campaign)
        notify_campaign_new_backer(request.user, campaign)
        if goal_just_met:
            notify_campaign_funded(campaign)
            notify_campaign_goal_reached(campaign)

        logger.info('[CampaignContribution] %s backed %s with $%s (total: $%s/%s)',
            request.user.username, campaign.title, contribution.amount, campaign.current_amount, campaign.funding_goal)

        return Response({
            'contribution_id': contribution.id,
            'amount': str(contribution.amount),
            'campaign_status': campaign.status,
            'current_amount': str(campaign.current_amount),
            'funding_percentage': campaign.funding_percentage,
            'is_goal_met': campaign.is_goal_met,
        })


class SubmitSignedContributionView(APIView):
    """Submit a user-signed campaign contribution transaction.

    After the frontend signs the sponsored tx with Web3Auth,
    this endpoint adds the platform signature and submits to Solana.
    Then confirms the contribution in the DB.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        contribution_id = request.data.get('contribution_id')
        signed_message = request.data.get('serialized_message', '')
        user_signature = request.data.get('user_signature', '')

        if not contribution_id or not signed_message or not user_signature:
            return Response({'error': 'contribution_id, serialized_message, and user_signature are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            contribution = CampaignContribution.objects.select_related('campaign').get(
                id=contribution_id, backer=request.user, status='pending',
            )
        except CampaignContribution.DoesNotExist:
            return Response({'error': 'Pending contribution not found.'}, status=status.HTTP_404_NOT_FOUND)

        campaign = contribution.campaign

        try:
            from ..services.campaign_solana_service import CampaignSolanaService
            service = CampaignSolanaService()
            tx_sig = service.submit_contribution_with_platform_sig(signed_message, user_signature)
        except Exception as e:
            logger.error('[CampaignContribution] On-chain submit failed: %s', e, exc_info=True)
            return Response({'error': 'Transaction submission failed. Please try again.', 'detail': str(e)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Confirm contribution in DB
        with transaction.atomic():
            contribution.status = 'confirmed'
            contribution.transaction_signature = tx_sig
            contribution.save(update_fields=['status', 'transaction_signature'])

            campaign.current_amount += contribution.amount
            campaign.backer_count = campaign.contributions.filter(
                status='confirmed', withdrawn=False,
            ).values('backer').distinct().count()
            campaign.save(update_fields=['current_amount', 'backer_count', 'updated_at'])

            goal_just_met = campaign.is_goal_met and campaign.status == 'active'
            if goal_just_met:
                campaign.mark_funded()

            _recalculate_backer_percentages(campaign)

        _check_stretch_goals(campaign)

        from ..notifications_utils import (
            notify_campaign_backed, notify_campaign_new_backer,
            notify_campaign_funded, notify_campaign_goal_reached,
        )
        notify_campaign_backed(request.user, campaign)
        notify_campaign_new_backer(request.user, campaign)
        if goal_just_met:
            notify_campaign_funded(campaign)
            notify_campaign_goal_reached(campaign)

        logger.info('[CampaignContribution] %s backed %s with $%s on-chain. TX: %s',
                    request.user.username, campaign.title, contribution.amount, tx_sig)

        return Response({
            'contribution_id': contribution.id,
            'amount': str(contribution.amount),
            'transaction_signature': tx_sig,
            'campaign_status': campaign.status,
            'current_amount': str(campaign.current_amount),
            'funding_percentage': campaign.funding_percentage,
            'is_goal_met': campaign.is_goal_met,
        })


# ============================================================
# Unified Campaign + Project Creation
# ============================================================


class CreateCampaignProjectView(APIView):
    """Atomically create a CollaborativeProject + Campaign + team roles + milestones.

    Used by the unified campaign wizard. Creates everything in one call:
    - CollaborativeProject (with is_campaign_funded=True)
    - CollaboratorRoles for each team member (invited) or TBD slots (stored in campaign allocations)
    - ContractTasks with relative deadlines (deadline_days_after_funding)
    - Campaign linked to the project
    - CampaignTiers for backer rewards
    - Auto-calculated funding goal from milestone totals + production costs
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        data = request.data
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        content_type = data.get('content_type', 'comic')
        pitch_html = data.get('pitch_html', '')
        deadline_str = data.get('deadline', '')
        production_costs = Decimal(str(data.get('production_costs', '0') or '0'))
        cover_image = request.FILES.get('cover_image')

        # Parse JSON fields from FormData
        team_json = data.get('team', '[]')
        team = json.loads(team_json) if isinstance(team_json, str) else team_json
        tiers_json = data.get('tiers', '[]')
        tiers_data = json.loads(tiers_json) if isinstance(tiers_json, str) else tiers_json

        # Validation
        if not title:
            return Response({'error': 'Title is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not deadline_str:
            return Response({'error': 'Campaign deadline is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from dateutil.parser import parse as parse_date
            campaign_deadline = parse_date(deadline_str)
        except Exception:
            return Response({'error': 'Invalid deadline format.'}, status=status.HTTP_400_BAD_REQUEST)

        if campaign_deadline <= timezone.now() + timedelta(days=1):
            return Response({'error': 'Deadline must be at least 24 hours from now.'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate funding goal from team milestones + production costs
        total_milestone_amount = Decimal('0')
        for member in team:
            milestones = member.get('milestones', [])
            for m in milestones:
                total_milestone_amount += Decimal(str(m.get('amount', '0')))
        funding_goal = total_milestone_amount + production_costs

        # Allow manual funding_goal override when no milestones defined
        manual_goal = data.get('funding_goal')
        if manual_goal and funding_goal < Decimal('10.00'):
            funding_goal = Decimal(str(manual_goal))

        if funding_goal < Decimal('10.00'):
            return Response({'error': 'Funding goal must be at least $10.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 1. Create CollaborativeProject
            project = CollaborativeProject.objects.create(
                title=title,
                content_type=content_type,
                description=description,
                created_by=request.user,
                status='active',
                is_solo=False,
                is_campaign_funded=True,
            )
            if cover_image:
                project.cover_image = cover_image
                project.save(update_fields=['cover_image'])

            # Create owner as collaborator
            CollaboratorRole.objects.create(
                project=project,
                user=request.user,
                role='Creator',
                status='accepted',
                revenue_percentage=Decimal('100'),
                contract_type='revenue_share',
            )

            # 2. Create team roles + milestones
            collaborator_allocations = []
            for member in team:
                user_id = member.get('user_id')
                role_name = member.get('role', 'Collaborator')
                contract_type = member.get('contract_type', 'work_for_hire')
                total_amount = Decimal(str(member.get('total_amount', '0')))
                milestones = member.get('milestones', [])

                if user_id:
                    # Real user — create CollaboratorRole + ContractTasks
                    try:
                        invitee = User.objects.get(id=user_id)
                    except User.DoesNotExist:
                        continue

                    role = CollaboratorRole.objects.create(
                        project=project,
                        user=invitee,
                        role=role_name,
                        status='invited',
                        revenue_percentage=Decimal('0'),
                        contract_type=contract_type,
                        total_contract_amount=total_amount,
                    )

                    for i, m in enumerate(milestones):
                        ContractTask.objects.create(
                            collaborator_role=role,
                            title=m.get('title', f'Milestone {i + 1}'),
                            description=m.get('description', ''),
                            deadline=None,  # Computed on funding
                            deadline_days_after_funding=int(m.get('days_after_funding', 30)),
                            payment_amount=Decimal(str(m.get('amount', '0'))),
                            status='pending',
                            escrow_release_status='pending',
                            milestone_type=m.get('milestone_type', 'custom'),
                            order=i,
                        )

                    # Notify invitee
                    from ..notifications_utils import notify_collaboration_invitation
                    notify_collaboration_invitation(request.user, invitee, project, role_name)

                    collaborator_allocations.append({
                        'collaborator_role_id': role.id,
                        'username': invitee.username,
                        'role': role_name,
                        'amount': str(total_amount),
                    })
                else:
                    # TBD role — store in campaign allocations only
                    collaborator_allocations.append({
                        'collaborator_role_id': None,
                        'username': None,
                        'role': role_name,
                        'amount': str(total_amount),
                        'is_tbd': True,
                        'milestones': milestones,
                    })

            # 3. Create Campaign
            campaign = Campaign.objects.create(
                project=project,
                creator=request.user,
                title=title,
                description=description,
                content_type=content_type,
                campaign_type='collaborative',
                pitch_html=pitch_html,
                funding_goal=funding_goal,
                deadline=campaign_deadline,
                collaborator_allocations=collaborator_allocations,
                production_costs=production_costs,
            )

            if cover_image:
                campaign.cover_image = cover_image
                campaign.save(update_fields=['cover_image'])

            # 4. Create tiers
            for i, tier_data in enumerate(tiers_data):
                CampaignTier.objects.create(
                    campaign=campaign,
                    title=tier_data.get('title', ''),
                    description=tier_data.get('description', ''),
                    minimum_amount=Decimal(str(tier_data.get('minimum_amount', '0'))),
                    max_backers=tier_data.get('max_backers') or None,
                    includes_digital_copy=tier_data.get('includes_digital_copy', False),
                    includes_print_copy=tier_data.get('includes_print_copy', False),
                    includes_early_access=tier_data.get('includes_early_access', False),
                    includes_credits=tier_data.get('includes_credits', False),
                    order=i,
                )

        logger.info('[CampaignProject] Created project %d + campaign %d for user %s (goal: $%s)',
                    project.id, campaign.id, request.user.username, funding_goal)

        return Response({
            'campaign_id': campaign.id,
            'project_id': project.id,
            'funding_goal': str(funding_goal),
            'team_members': len([m for m in team if m.get('user_id')]),
            'tbd_roles': len([m for m in team if not m.get('user_id')]),
            'status': 'draft',
        }, status=status.HTTP_201_CREATED)
