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
    CollaborativeProject,
)

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
        ]
        read_only_fields = ['id', 'current_backers']


class CampaignMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignMedia
        fields = ['id', 'image', 'caption', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


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

    class Meta(CampaignListSerializer.Meta):
        fields = CampaignListSerializer.Meta.fields + [
            'pitch_html',
            'project_id', 'project_title',
            'campaign_pda', 'escrow_pda',
            'funded_at', 'escrow_creation_deadline', 'escrow_dormancy_deadline',
            'completed_at',
            'contribution_count', 'user_contribution',
            'tiers', 'media',
            'collaborator_allocations', 'production_costs',
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


class CampaignCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            'id', 'title', 'description', 'pitch_html', 'cover_image',
            'content_type', 'campaign_type',
            'funding_goal', 'deadline',
            'chapter_count', 'status',
            'collaborator_allocations', 'production_costs',
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
            'transaction_signature', 'tier_title', 'created_at',
        ]

    def get_tier_title(self, obj):
        # Find matching tier based on amount
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
    PUBLIC_READ_ACTIONS = ('retrieve', 'discover', 'campaign_updates', 'contributions', 'manage_tiers', 'manage_media')

    def get_permissions(self):
        if self.action in self.PUBLIC_READ_ACTIONS and self.request.method == 'GET':
            return [AllowAny()]
        if self.action == 'discover':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # For public read actions: show all non-draft campaigns
        if self.action in self.PUBLIC_READ_ACTIONS:
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
                campaign.save(update_fields=['project'])
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
        """Activate a draft campaign."""
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
        campaign.status = 'active'
        campaign.save(update_fields=['status', 'updated_at'])
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
        campaign.save(update_fields=['status', 'updated_at'])
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
        serializer.save(campaign=campaign, author=request.user)
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

        For solo campaigns: auto-creates escrow with chapter-based milestones
        (platform=writer, creator=artist). Then transfers funds PDA1→PDA2.

        For collaborative campaigns: requires collaborator contracts to be set up first.
        """
        campaign = self.get_object()
        if campaign.creator != request.user:
            return Response({'error': 'Only the creator can transfer funds.'}, status=status.HTTP_403_FORBIDDEN)
        if campaign.status != 'funded':
            return Response({'error': f'Cannot transfer: campaign is {campaign.status}, must be funded.'}, status=status.HTTP_400_BAD_REQUEST)

        # Compute PDA addresses and log transfer details
        from ..services.campaign_solana_service import CampaignSolanaService
        service = CampaignSolanaService()
        transfer_details = service.log_transfer_details(campaign)

        # For solo: auto-setup escrow and mark transferred
        if campaign.campaign_type == 'solo':
            escrow_pda = transfer_details.get('escrow_pda', '')
            escrow_bump = transfer_details.get('escrow_pda_bump')
            campaign.mark_transferred(escrow_pda, escrow_bump)
            campaign.contributions.filter(status='confirmed').update(status='transferred')

            logger.info(
                '[CampaignTransfer] Solo campaign %s ($%s) transferred. Escrow PDA: %s',
                campaign.id, campaign.current_amount, escrow_pda
            )
        else:
            # Collaborative: verify collaborator contracts exist
            if not campaign.project:
                return Response(
                    {'error': 'Collaborative campaigns must be linked to a project with collaborator contracts.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            escrow_pda = transfer_details.get('escrow_pda', '')
            escrow_bump = transfer_details.get('escrow_pda_bump')
            campaign.mark_transferred(escrow_pda, escrow_bump)
            campaign.contributions.filter(status='confirmed').update(status='transferred')

            logger.info(
                '[CampaignTransfer] Collab campaign %s ($%s) transferred. Escrow PDA: %s',
                campaign.id, campaign.current_amount, escrow_pda
            )

        # Trigger async on-chain transfer task
        from ..tasks import process_campaign_transfer
        process_campaign_transfer.delay(campaign.id)

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
        Returns the backer's contribution amount and reclaim info.
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

        # Calculate proportional refund if some milestones were released
        total_funded = float(campaign.current_amount)
        backer_amount = float(contribution.amount)
        # For pre-transfer reclaims, backer gets full amount
        # For post-transfer (proportional), amount is scaled by remaining balance
        refund_amount = backer_amount  # Full amount for pre-transfer

        # Mark contribution as reclaimed
        contribution.status = 'reclaimed'
        contribution.save(update_fields=['status'])

        logger.info(
            '[CampaignReclaim] %s reclaimed $%s from campaign %s',
            request.user.username, refund_amount, campaign.id
        )

        return Response({
            'contribution_id': contribution.id,
            'refund_amount': str(refund_amount),
            'campaign_pda': campaign.campaign_pda,
            'status': 'reclaimed',
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

        return Response({
            'contribution_id': contribution.id,
            'amount': str(amount),
            'campaign_id': campaign.id,
            'campaign_title': campaign.title,
            'has_sufficient_balance': has_sufficient_balance,
            'current_balance': current_balance,
            'fee': '0.00',
            'fee_note': 'Campaign contributions have 0% platform fee.',
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

        with transaction.atomic():
            contribution.status = 'confirmed'
            contribution.transaction_signature = transaction_signature
            contribution.save(update_fields=['status', 'transaction_signature'])

            campaign.current_amount += contribution.amount
            campaign.backer_count = campaign.contributions.filter(
                status='confirmed'
            ).values('backer').distinct().count()
            campaign.save(update_fields=['current_amount', 'backer_count', 'updated_at'])

            if campaign.is_goal_met and campaign.status == 'active':
                campaign.mark_funded()

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
