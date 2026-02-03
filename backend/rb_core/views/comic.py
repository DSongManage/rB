"""
Comic Book Collaboration ViewSets.

Handles CRUD operations for comic pages, panels, and speech bubbles
in collaborative comic projects.
"""

from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db import models, transaction

from ..models import (
    ComicPage, ComicPanel, SpeechBubble, DividerLine,
    CollaborativeProject, CollaboratorRole,
    ComicSeries, ComicIssue, Content, ArtworkLibraryItem
)
from ..serializers import (
    ComicPageSerializer,
    ComicPanelSerializer, SpeechBubbleSerializer, DividerLineSerializer,
    ComicSeriesSerializer, ComicSeriesListSerializer,
    ComicIssueSerializer, ComicIssueListSerializer,
    ArtworkLibraryItemSerializer
)


class ComicPageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing comic pages.

    - List pages for a project (filter by ?project=ID)
    - Create new pages
    - Update page settings (format, dimensions, background)
    - Delete pages (reorders remaining pages)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None  # Return raw array for frontend

    def get_serializer_class(self):
        # Always use full serializer with panels - frontend needs panel data
        # The list endpoint is used by the editor which requires full panel info
        return ComicPageSerializer

    def get_queryset(self):
        """Filter pages by project or issue and verify user access."""
        # For detail views (retrieve, update, destroy), allow lookup by ID
        # with permission check in get_object
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'reorder']:
            return ComicPage.objects.all().prefetch_related('panels__speech_bubbles')

        # For list views, support filtering by issue or project
        issue_id = self.request.query_params.get('issue')
        project_id = self.request.query_params.get('project')

        # Filter by issue (preferred - new system)
        if issue_id:
            issue = get_object_or_404(ComicIssue, id=issue_id)
            # Verify user has access via series or project
            if issue.series and issue.series.creator != self.request.user:
                return ComicPage.objects.none()
            if issue.project:
                user_role = issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if not user_role and issue.project.created_by != self.request.user:
                    return ComicPage.objects.none()
            return ComicPage.objects.filter(issue_id=issue_id).prefetch_related(
                'panels__speech_bubbles'
            ).order_by('page_number')

        # Filter by project (legacy/fallback)
        if project_id:
            project = get_object_or_404(CollaborativeProject, id=project_id, content_type='comic')
            user_role = project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()

            if not user_role and project.created_by != self.request.user:
                return ComicPage.objects.none()

            return ComicPage.objects.filter(project_id=project_id).prefetch_related(
                'panels__speech_bubbles'
            ).order_by('page_number')

        return ComicPage.objects.none()

    def perform_create(self, serializer):
        """Create a new page, auto-assigning page_number."""
        project = serializer.validated_data.get('project')
        issue = serializer.validated_data.get('issue')

        # Verify project is a comic project (if provided)
        if project and project.content_type != 'comic':
            raise serializers.ValidationError("Project must be a comic type")

        # Verify user has access
        if issue:
            # Check access via issue's series or project
            if issue.series and issue.series.creator != self.request.user:
                raise PermissionError("You don't have access to this issue")
            if issue.project:
                user_role = issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if not user_role and issue.project.created_by != self.request.user:
                    raise PermissionError("You don't have access to this project")
            # Auto-assign page number within issue
            last_page = issue.issue_pages.order_by('-page_number').first()
            next_page_number = (last_page.page_number + 1) if last_page else 1
            # When page belongs to issue, don't set project directly (avoids unique constraint)
            # Project association comes through the issue
            serializer.save(page_number=next_page_number, project=None)
            return
        elif project:
            user_role = project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if not user_role and project.created_by != self.request.user:
                raise PermissionError("You don't have access to this project")
            # Auto-assign page number within project
            last_page = project.comic_pages.order_by('-page_number').first()
            next_page_number = (last_page.page_number + 1) if last_page else 1
        else:
            raise serializers.ValidationError("Either project or issue is required")

        serializer.save(page_number=next_page_number)

    def perform_destroy(self, instance):
        """Delete page and reorder remaining pages."""
        issue = instance.issue
        project = instance.project
        page_number = instance.page_number

        with transaction.atomic():
            instance.delete()
            # Reorder pages after deleted one (within issue or project)
            # Update one at a time in ascending order to avoid unique constraint issues
            if issue:
                pages_to_update = issue.issue_pages.filter(
                    page_number__gt=page_number
                ).order_by('page_number')
                for page in pages_to_update:
                    page.page_number = page.page_number - 1
                    page.save(update_fields=['page_number'])
            elif project:
                pages_to_update = project.comic_pages.filter(
                    page_number__gt=page_number
                ).order_by('page_number')
                for page in pages_to_update:
                    page.page_number = page.page_number - 1
                    page.save(update_fields=['page_number'])

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        """Move page to a new position."""
        page = self.get_object()
        new_position = request.data.get('new_position')

        if new_position is None:
            return Response(
                {'error': 'new_position is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_position = int(new_position)
        except (TypeError, ValueError):
            return Response(
                {'error': 'new_position must be an integer'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_position < 1:
            return Response(
                {'error': 'new_position must be at least 1'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_position = page.page_number
        if old_position == new_position:
            return Response({'status': 'no change needed'})

        with transaction.atomic():
            if old_position < new_position:
                # Moving down: decrement pages between old and new
                page.project.comic_pages.filter(
                    page_number__gt=old_position,
                    page_number__lte=new_position
                ).update(page_number=models.F('page_number') - 1)
            else:
                # Moving up: increment pages between new and old
                page.project.comic_pages.filter(
                    page_number__gte=new_position,
                    page_number__lt=old_position
                ).update(page_number=models.F('page_number') + 1)

            page.page_number = new_position
            page.save()

        return Response({'status': 'reordered', 'new_position': new_position})


class ComicPanelViewSet(viewsets.ModelViewSet):
    """ViewSet for managing comic panels.

    - Create/update/delete panels
    - Upload artwork to panels
    - Update panel positioning
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ComicPanelSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None  # Return raw array for frontend

    def get_queryset(self):
        """Filter panels by page and verify user access."""
        # For detail views (retrieve, update, destroy), allow lookup by ID
        # with permission check in get_object
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'upload_artwork']:
            return ComicPanel.objects.all().prefetch_related('speech_bubbles')

        # For list views, require page parameter
        page_id = self.request.query_params.get('page')
        if not page_id:
            return ComicPanel.objects.none()

        page = get_object_or_404(ComicPage, id=page_id)
        project = page.project

        # Verify user has access
        user_role = project.collaborators.filter(
            user=self.request.user,
            status='accepted'
        ).first()

        if not user_role and project.created_by != self.request.user:
            return ComicPanel.objects.none()

        return ComicPanel.objects.filter(page_id=page_id).prefetch_related('speech_bubbles')

    def perform_create(self, serializer):
        """Create panel, assigning artist if user has image permissions."""
        page = serializer.validated_data.get('page')

        # Check user permissions - handle both project and issue-based pages
        can_edit_images = self._check_edit_permission(page)

        # Auto-assign order
        last_panel = page.panels.order_by('-order').first()
        next_order = (last_panel.order + 1) if last_panel else 0

        # Optionally assign artist
        artist = self.request.user if can_edit_images else None

        serializer.save(order=next_order, artist=artist)

    def _check_edit_permission(self, page):
        """Check if current user can edit panels on this page."""
        # Check via direct project
        if page.project:
            if page.project.created_by == self.request.user:
                return True
            user_role = page.project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if user_role and user_role.can_edit_images:
                return True

        # Check via issue
        if page.issue:
            # Series-based issue
            if page.issue.series and page.issue.series.creator == self.request.user:
                return True
            # Project-based issue
            if page.issue.project:
                if page.issue.project.created_by == self.request.user:
                    return True
                user_role = page.issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if user_role and user_role.can_edit_images:
                    return True

        return False

    @action(detail=True, methods=['post'])
    def upload_artwork(self, request, pk=None):
        """Upload artwork image to a panel."""
        panel = self.get_object()

        # Check user has image edit permissions
        can_edit_images = self._check_edit_permission(panel.page)

        if not can_edit_images:
            return Response(
                {'error': "You don't have permission to upload artwork"},
                status=status.HTTP_403_FORBIDDEN
            )

        artwork_file = request.FILES.get('artwork')
        if not artwork_file:
            return Response(
                {'error': 'No artwork file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        valid_types = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
        if artwork_file.content_type not in valid_types:
            return Response(
                {'error': 'Invalid file type. Must be PNG, JPG, WebP, or GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (50MB max)
        if artwork_file.size > 50 * 1024 * 1024:
            return Response(
                {'error': 'File size must be under 50MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        panel.artwork = artwork_file
        panel.artist = request.user
        panel.save()

        serializer = self.get_serializer(panel)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def batch_update_positions(self, request):
        """Batch update positions for multiple panels (for drag operations)."""
        updates = request.data.get('panels', [])

        if not isinstance(updates, list):
            return Response(
                {'error': 'panels must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_panels = []
        with transaction.atomic():
            for update in updates:
                panel_id = update.get('id')
                if not panel_id:
                    continue

                try:
                    panel = ComicPanel.objects.get(id=panel_id)
                except ComicPanel.DoesNotExist:
                    continue

                # Verify permission
                can_edit = self._check_edit_permission(panel.page)

                if not can_edit:
                    continue

                # Update position fields
                for field in ['x_percent', 'y_percent', 'width_percent', 'height_percent', 'z_index', 'rotation']:
                    if field in update:
                        setattr(panel, field, update[field])

                panel.save()
                updated_panels.append(panel.id)

        return Response({'updated': updated_panels})


class SpeechBubbleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing speech bubbles.

    - Create/update/delete bubbles
    - Update bubble text and styling
    - Position bubbles on panels
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SpeechBubbleSerializer
    parser_classes = [JSONParser]
    pagination_class = None  # Return raw array for frontend

    def _check_text_permission(self, page):
        """Check if current user can edit text on this page."""
        # Check via direct project
        if page.project:
            if page.project.created_by == self.request.user:
                return True
            user_role = page.project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if user_role and user_role.can_edit_text:
                return True

        # Check via issue
        if page.issue:
            # Series-based issue
            if page.issue.series and page.issue.series.creator == self.request.user:
                return True
            # Project-based issue
            if page.issue.project:
                if page.issue.project.created_by == self.request.user:
                    return True
                user_role = page.issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if user_role and user_role.can_edit_text:
                    return True

        return False

    def _check_access(self, page):
        """Check if current user has any access to this page."""
        # Check via direct project
        if page.project:
            if page.project.created_by == self.request.user:
                return True
            user_role = page.project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if user_role:
                return True

        # Check via issue
        if page.issue:
            if page.issue.series and page.issue.series.creator == self.request.user:
                return True
            if page.issue.project:
                if page.issue.project.created_by == self.request.user:
                    return True
                user_role = page.issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if user_role:
                    return True

        return False

    def get_queryset(self):
        """Filter bubbles by panel and verify user access."""
        # For detail views (retrieve, update, destroy), allow lookup by ID
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return SpeechBubble.objects.all()

        # For list views, require panel parameter
        panel_id = self.request.query_params.get('panel')
        if not panel_id:
            return SpeechBubble.objects.none()

        panel = get_object_or_404(ComicPanel, id=panel_id)

        # Verify user has access
        if not self._check_access(panel.page):
            return SpeechBubble.objects.none()

        return SpeechBubble.objects.filter(panel_id=panel_id)

    def perform_create(self, serializer):
        """Create bubble, assigning writer if user has text permissions."""
        panel = serializer.validated_data.get('panel')

        # Check user permissions
        can_edit_text = self._check_text_permission(panel.page)

        if not can_edit_text:
            raise PermissionError("You don't have permission to add speech bubbles")

        # Auto-assign order
        last_bubble = panel.speech_bubbles.order_by('-order').first()
        next_order = (last_bubble.order + 1) if last_bubble else 0

        serializer.save(order=next_order, writer=self.request.user)

    def perform_update(self, serializer):
        """Update bubble, checking permissions."""
        bubble = self.get_object()

        # Check user permissions
        can_edit_text = self._check_text_permission(bubble.panel.page)

        if not can_edit_text:
            raise PermissionError("You don't have permission to edit speech bubbles")

        serializer.save()

    @action(detail=False, methods=['post'])
    def batch_create(self, request):
        """Batch create multiple speech bubbles."""
        bubbles_data = request.data.get('bubbles', [])

        if not isinstance(bubbles_data, list):
            return Response(
                {'error': 'bubbles must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_bubbles = []
        with transaction.atomic():
            for bubble_data in bubbles_data:
                panel_id = bubble_data.get('panel')
                if not panel_id:
                    continue

                try:
                    panel = ComicPanel.objects.get(id=panel_id)
                except ComicPanel.DoesNotExist:
                    continue

                # Check permissions
                can_edit_text = self._check_text_permission(panel.page)

                if not can_edit_text:
                    continue

                # Create bubble
                serializer = SpeechBubbleSerializer(data=bubble_data)
                if serializer.is_valid():
                    last_bubble = panel.speech_bubbles.order_by('-order').first()
                    next_order = (last_bubble.order + 1) if last_bubble else 0
                    bubble = serializer.save(order=next_order, writer=request.user)
                    created_bubbles.append(SpeechBubbleSerializer(bubble).data)

        return Response({'created': created_bubbles})

    @action(detail=False, methods=['post'])
    def batch_update_positions(self, request):
        """Batch update positions for multiple bubbles."""
        updates = request.data.get('bubbles', [])

        if not isinstance(updates, list):
            return Response(
                {'error': 'bubbles must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_bubbles = []
        with transaction.atomic():
            for update in updates:
                bubble_id = update.get('id')
                if not bubble_id:
                    continue

                try:
                    bubble = SpeechBubble.objects.get(id=bubble_id)
                except SpeechBubble.DoesNotExist:
                    continue

                # Verify permission
                can_edit = self._check_text_permission(bubble.panel.page)

                if not can_edit:
                    continue

                # Update position fields
                for field in ['x_percent', 'y_percent', 'width_percent', 'height_percent', 'z_index']:
                    if field in update:
                        setattr(bubble, field, update[field])

                bubble.save()
                updated_bubbles.append(bubble.id)

        return Response({'updated': updated_bubbles})


class ComicSeriesViewSet(viewsets.ModelViewSet):
    """ViewSet for managing comic series.

    - List user's series
    - Create new series
    - Update series metadata
    - Delete series
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return ComicSeriesListSerializer
        return ComicSeriesSerializer

    def get_queryset(self):
        """Return user's comic series."""
        return ComicSeries.objects.filter(creator=self.request.user)

    def perform_create(self, serializer):
        """Create a new series for the current user."""
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish entire series as a single NFT."""
        series = self.get_object()

        # Verify user owns the series
        if series.creator != request.user:
            return Response(
                {'error': 'You do not own this series'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already published
        if series.is_published:
            return Response(
                {'error': 'Series is already published'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check series has at least one issue
        if series.issues.count() == 0:
            return Response(
                {'error': 'Series must have at least one issue'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create Content record for the series
        content = Content.objects.create(
            creator=request.user,
            title=series.title,
            teaser_html=series.synopsis,
            content_type='comic',
            genre='other',
            inventory_status='draft',
        )
        content.save()

        series.published_content = content
        series.save()

        return Response({
            'content_id': content.id,
            'message': 'Series prepared for publishing'
        })


class ComicIssueViewSet(viewsets.ModelViewSet):
    """ViewSet for managing comic issues.

    - List issues (filter by series or project)
    - Create new issues
    - Update issue metadata
    - Delete issues
    - Prepare/publish individual issues
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return ComicIssueListSerializer
        return ComicIssueSerializer

    def get_queryset(self):
        """Filter issues by series, project, or return user's issues."""
        series_id = self.request.query_params.get('series')
        project_id = self.request.query_params.get('project')

        if series_id:
            series = get_object_or_404(ComicSeries, id=series_id, creator=self.request.user)
            return ComicIssue.objects.filter(series=series)

        if project_id:
            project = get_object_or_404(CollaborativeProject, id=project_id)
            # Verify user has access to project
            user_role = project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if not user_role and project.created_by != self.request.user:
                return ComicIssue.objects.none()
            return ComicIssue.objects.filter(project=project)

        # Return all issues the user has access to
        return ComicIssue.objects.filter(
            models.Q(series__creator=self.request.user) |
            models.Q(project__created_by=self.request.user) |
            models.Q(project__collaborators__user=self.request.user, project__collaborators__status='accepted')
        ).distinct()

    def perform_create(self, serializer):
        """Create a new issue."""
        series = serializer.validated_data.get('series')
        project = serializer.validated_data.get('project')

        # Verify ownership
        if series and series.creator != self.request.user:
            raise PermissionError("You don't own this series")

        if project:
            user_role = project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if not user_role and project.created_by != self.request.user:
                raise PermissionError("You don't have access to this project")

        # Auto-assign issue number
        if series:
            last_issue = series.issues.order_by('-issue_number').first()
            next_number = (last_issue.issue_number + 1) if last_issue else 1
        elif project:
            last_issue = project.comic_issues.order_by('-issue_number').first()
            next_number = (last_issue.issue_number + 1) if last_issue else 1
        else:
            next_number = 1

        serializer.save(issue_number=next_number)

    @action(detail=True, methods=['post'])
    def prepare(self, request, pk=None):
        """Prepare issue for minting."""
        issue = self.get_object()

        # Verify user has access
        if issue.series and issue.series.creator != request.user:
            return Response(
                {'error': 'You do not own this series'},
                status=status.HTTP_403_FORBIDDEN
            )
        if issue.project:
            user_role = issue.project.collaborators.filter(
                user=request.user,
                status='accepted'
            ).first()
            if not user_role and issue.project.created_by != request.user:
                return Response(
                    {'error': 'You do not have access to this project'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Check if already published
        if issue.is_published:
            return Response(
                {'error': 'Issue is already published'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create Content record
        if issue.published_content:
            content = issue.published_content
        else:
            # Get first page's first panel artwork as teaser
            teaser_link = None
            first_page = issue.issue_pages.order_by('page_number').first()
            if first_page:
                first_panel = first_page.panels.order_by('z_index').first()
                if first_panel and first_panel.artwork:
                    teaser_link = first_panel.artwork.url

            # Fallback to issue cover, project cover, or placeholder
            if not teaser_link:
                if issue.cover_image:
                    teaser_link = issue.cover_image.url
                elif issue.project and issue.project.cover_image:
                    teaser_link = issue.project.cover_image.url
                elif issue.series and issue.series.cover_image:
                    teaser_link = issue.series.cover_image.url
                else:
                    teaser_link = '/media/defaults/placeholder.png'

            creator = issue.series.creator if issue.series else (
                issue.project.created_by if issue.project else request.user
            )

            content = Content.objects.create(
                creator=creator,
                title=f"{issue.series.title} - {issue.title}" if issue.series else issue.title,
                teaser_link=teaser_link,
                content_type='comic',
                genre='other',
                inventory_status='draft',
                price_usd=issue.price,
            )

            issue.published_content = content
            issue.save()

        return Response({
            'content_id': content.id,
            'message': 'Issue prepared for minting'
        })

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish issue (mark as published after successful mint)."""
        issue = self.get_object()

        # Same permission checks as prepare
        if issue.series and issue.series.creator != request.user:
            return Response(
                {'error': 'You do not own this series'},
                status=status.HTTP_403_FORBIDDEN
            )
        if issue.project:
            user_role = issue.project.collaborators.filter(
                user=request.user,
                status='accepted'
            ).first()
            if not user_role and issue.project.created_by != request.user:
                return Response(
                    {'error': 'You do not have access to this project'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if issue.is_published:
            return Response(
                {'error': 'Issue is already published'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not issue.published_content:
            return Response(
                {'error': 'Issue has not been prepared for minting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        issue.is_published = True
        issue.save()

        return Response({
            'message': 'Issue published successfully',
            'content_id': issue.published_content.id
        })

    @action(detail=False, methods=['post'], url_path='prepare-series')
    def prepare_series(self, request):
        """Prepare all unpublished issues in a project for minting."""
        project_id = request.data.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        project = get_object_or_404(CollaborativeProject, id=project_id)

        # Verify access
        user_role = project.collaborators.filter(
            user=request.user, status='accepted'
        ).first()
        if not user_role and project.created_by != request.user:
            return Response(
                {'error': 'You do not have access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        issues = ComicIssue.objects.filter(project=project, is_published=False)
        if not issues.exists():
            return Response(
                {'error': 'No unpublished issues found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prepared = []
        for issue in issues:
            # Get or create Content record
            if not issue.published_content:
                teaser_link = None
                first_page = issue.issue_pages.order_by('page_number').first()
                if first_page:
                    first_panel = first_page.panels.order_by('z_index').first()
                    if first_panel and first_panel.artwork:
                        teaser_link = first_panel.artwork.url

                creator = issue.series.creator if issue.series else (
                    issue.project.created_by if issue.project else request.user
                )

                content = Content.objects.create(
                    creator=creator,
                    title=f"{issue.series.title} - {issue.title}" if issue.series else issue.title,
                    teaser_link=teaser_link,
                    content_type='comic',
                    genre='other',
                    inventory_status='draft',
                    price_usd=issue.price,
                )
                issue.published_content = content
                issue.save()

            prepared.append({
                'issue_id': issue.id,
                'content_id': issue.published_content.id,
                'title': issue.title,
            })

        return Response({
            'prepared': prepared,
            'message': f'{len(prepared)} issues prepared for minting'
        })

    @action(detail=False, methods=['post'], url_path='publish-series')
    def publish_series(self, request):
        """Publish all prepared (but unpublished) issues in a project."""
        project_id = request.data.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        project = get_object_or_404(CollaborativeProject, id=project_id)

        user_role = project.collaborators.filter(
            user=request.user, status='accepted'
        ).first()
        if not user_role and project.created_by != request.user:
            return Response(
                {'error': 'You do not have access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        issues = ComicIssue.objects.filter(
            project=project, is_published=False, published_content__isnull=False
        )

        published = []
        for issue in issues:
            issue.is_published = True
            issue.save(update_fields=['is_published'])
            published.append({
                'issue_id': issue.id,
                'content_id': issue.published_content.id,
                'title': issue.title,
            })

        return Response({
            'published': published,
            'message': f'{len(published)} issues published'
        })


class DividerLineViewSet(viewsets.ModelViewSet):
    """ViewSet for managing divider lines on comic pages.

    - Create/update/delete divider lines
    - Lines split the page into panel regions
    - Supports straight lines and bezier curves
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DividerLineSerializer
    parser_classes = [JSONParser]
    pagination_class = None

    def get_queryset(self):
        """Filter lines by page and verify user access."""
        # For detail views, allow lookup by ID with permission check
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return DividerLine.objects.all()

        # For list views, require page parameter
        page_id = self.request.query_params.get('page')
        if not page_id:
            return DividerLine.objects.none()

        page = get_object_or_404(ComicPage, id=page_id)

        # Verify user has access via project or issue
        if page.project:
            user_role = page.project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if not user_role and page.project.created_by != self.request.user:
                return DividerLine.objects.none()
        elif page.issue:
            if page.issue.series and page.issue.series.creator != self.request.user:
                return DividerLine.objects.none()
            if page.issue.project:
                user_role = page.issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if not user_role and page.issue.project.created_by != self.request.user:
                    return DividerLine.objects.none()

        return DividerLine.objects.filter(page_id=page_id).order_by('order')

    def perform_create(self, serializer):
        """Create a new divider line, checking permissions."""
        page = serializer.validated_data.get('page')

        # Verify user has edit access
        can_edit = self._check_edit_permission(page)
        if not can_edit:
            raise PermissionError("You don't have permission to edit this page")

        # Auto-assign order
        last_line = page.divider_lines.order_by('-order').first()
        next_order = (last_line.order + 1) if last_line else 0

        serializer.save(order=next_order)

    def perform_update(self, serializer):
        """Update divider line, checking permissions."""
        line = self.get_object()
        can_edit = self._check_edit_permission(line.page)
        if not can_edit:
            raise PermissionError("You don't have permission to edit this page")
        serializer.save()

    def perform_destroy(self, instance):
        """Delete divider line, checking permissions."""
        can_edit = self._check_edit_permission(instance.page)
        if not can_edit:
            raise PermissionError("You don't have permission to edit this page")
        instance.delete()

    def _check_edit_permission(self, page):
        """Check if current user can edit the page layout."""
        if page.project:
            if page.project.created_by == self.request.user:
                return True
            user_role = page.project.collaborators.filter(
                user=self.request.user,
                status='accepted'
            ).first()
            if user_role and user_role.can_edit_images:
                return True
        elif page.issue:
            if page.issue.series and page.issue.series.creator == self.request.user:
                return True
            if page.issue.project:
                if page.issue.project.created_by == self.request.user:
                    return True
                user_role = page.issue.project.collaborators.filter(
                    user=self.request.user,
                    status='accepted'
                ).first()
                if user_role and user_role.can_edit_images:
                    return True
        return False

    @action(detail=False, methods=['post'])
    def batch_create(self, request):
        """Batch create multiple divider lines (for templates)."""
        lines_data = request.data.get('lines', [])
        page_id = request.data.get('page')

        if not page_id:
            return Response(
                {'error': 'page is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(lines_data, list):
            return Response(
                {'error': 'lines must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        page = get_object_or_404(ComicPage, id=page_id)
        can_edit = self._check_edit_permission(page)
        if not can_edit:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        created_lines = []
        with transaction.atomic():
            # Clear existing lines if requested
            if request.data.get('clear_existing', False):
                page.divider_lines.all().delete()

            for i, line_data in enumerate(lines_data):
                line_data['page'] = page_id
                serializer = DividerLineSerializer(data=line_data)
                if serializer.is_valid():
                    line = serializer.save(order=i)
                    created_lines.append(DividerLineSerializer(line).data)

        return Response({'created': created_lines})

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """Batch update multiple divider lines."""
        updates = request.data.get('lines', [])

        if not isinstance(updates, list):
            return Response(
                {'error': 'lines must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_lines = []
        with transaction.atomic():
            for update in updates:
                line_id = update.get('id')
                if not line_id:
                    continue

                try:
                    line = DividerLine.objects.get(id=line_id)
                except DividerLine.DoesNotExist:
                    continue

                can_edit = self._check_edit_permission(line.page)
                if not can_edit:
                    continue

                # Update allowed fields
                for field in ['line_type', 'start_x', 'start_y', 'end_x', 'end_y',
                              'control1_x', 'control1_y', 'control2_x', 'control2_y',
                              'thickness', 'color', 'order']:
                    if field in update:
                        setattr(line, field, update[field])

                line.save()
                updated_lines.append(line.id)

        return Response({'updated': updated_lines})


class ArtworkLibraryViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project artwork library.

    Allows collaborators to upload reusable artwork assets that can be
    dragged and dropped into comic panels.

    Endpoints:
    - GET /api/collaborative-projects/{id}/artwork-library/ - List project artwork
    - POST /api/collaborative-projects/{id}/artwork-library/ - Upload new artwork
    - DELETE /api/artwork-library/{id}/ - Remove artwork item
    - POST /api/artwork-library/{id}/apply-to-panel/ - Apply artwork to a panel
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ArtworkLibraryItemSerializer
    pagination_class = None

    def get_queryset(self):
        """Filter artwork by project."""
        project_pk = self.kwargs.get('project_pk')
        if project_pk:
            return ArtworkLibraryItem.objects.filter(project_id=project_pk)
        # For detail views (delete, apply), allow lookup by ID
        return ArtworkLibraryItem.objects.all()

    def get_serializer_context(self):
        """Add request to serializer context for URL building."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        """Upload artwork to project library."""
        project_pk = self.kwargs.get('project_pk')
        if not project_pk:
            return Response(
                {'error': 'Project ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        project = get_object_or_404(
            CollaborativeProject, id=project_pk, content_type='comic'
        )

        # Verify user has permission
        can_upload = self._check_upload_permission(project)
        if not can_upload:
            return Response(
                {'error': "You don't have permission to upload artwork"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate file
        artwork_file = request.FILES.get('file')
        if not artwork_file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        valid_types = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
        if artwork_file.content_type not in valid_types:
            return Response(
                {'error': 'File must be PNG, JPEG, WebP, or GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (50MB max)
        if artwork_file.size > 50 * 1024 * 1024:
            return Response(
                {'error': 'File size must be under 50MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create artwork item
        title = request.data.get('title', '')
        artwork_item = ArtworkLibraryItem.objects.create(
            project=project,
            file=artwork_file,
            title=title,
            filename=artwork_file.name,
            uploader=request.user
        )

        serializer = self.get_serializer(artwork_item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """Delete artwork from library."""
        instance = self.get_object()

        # Verify user has permission (uploader or project creator)
        can_delete = (
            instance.uploader == request.user or
            instance.project.created_by == request.user
        )
        if not can_delete:
            return Response(
                {'error': "You don't have permission to delete this artwork"},
                status=status.HTTP_403_FORBIDDEN
            )

        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def apply_to_panel(self, request, pk=None, project_pk=None):
        """Apply library artwork to a comic panel.

        POST data:
        - panel_id: int (existing ComicPanel ID)
        OR for computed panels:
        - page_id: int
        - bounds: object {x, y, width, height} in percentages
        """
        artwork_item = self.get_object()

        # Verify user has permission
        can_apply = self._check_upload_permission(artwork_item.project)
        if not can_apply:
            return Response(
                {'error': "You don't have permission to apply artwork"},
                status=status.HTTP_403_FORBIDDEN
            )

        panel_id = request.data.get('panel_id')
        page_id = request.data.get('page_id')
        bounds = request.data.get('bounds')

        if panel_id:
            # Update existing panel
            panel = get_object_or_404(ComicPanel, id=panel_id)
            panel.artwork = artwork_item.file
            panel.artist = artwork_item.uploader
            panel.save()
        elif page_id and bounds:
            # Create new panel for computed region
            page = get_object_or_404(ComicPage, id=page_id)

            # Verify page belongs to same project
            if page.project != artwork_item.project and (
                page.issue and page.issue.project != artwork_item.project
            ):
                return Response(
                    {'error': 'Page does not belong to this project'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create panel with artwork
            panel = ComicPanel.objects.create(
                page=page,
                x_percent=bounds.get('x', 0),
                y_percent=bounds.get('y', 0),
                width_percent=bounds.get('width', 100),
                height_percent=bounds.get('height', 100),
                artwork=artwork_item.file,
                artist=artwork_item.uploader,
                border_style='none',
                border_width=0
            )
        else:
            return Response(
                {'error': 'panel_id or (page_id + bounds) required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Increment usage count
        artwork_item.usage_count += 1
        artwork_item.save()

        return Response(ComicPanelSerializer(panel).data)

    def _check_upload_permission(self, project):
        """Check if current user can upload artwork to project."""
        # Project creator always has permission
        if project.created_by == self.request.user:
            return True

        # Check collaborator role
        user_role = project.collaborators.filter(
            user=self.request.user,
            status='accepted'
        ).first()

        if user_role and user_role.can_edit_images:
            return True

        return False
