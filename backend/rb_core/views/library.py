from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from ..models import Purchase, Content, ReadingProgress, ComicPage, CollaborativeProject, ComicIssue
from ..serializers import ContentSerializer, ReadingProgressSerializer, ComicPageSerializer


class LibraryView(APIView):
    """List user's library (grouped by content type)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's purchased content grouped by type."""
        from django.db.models import Prefetch

        # Prefetch reading progress to avoid N+1 queries
        progress_prefetch = Prefetch(
            'content__reading_progress',
            queryset=ReadingProgress.objects.filter(user=request.user),
            to_attr='user_progress'
        )

        # Get all purchases with optimized query (1 query instead of N+1)
        # Only show purchases that are completed (same logic as ownership check)
        purchases = Purchase.objects.filter(
            user=request.user,
            refunded=False,
            status__in=['payment_completed', 'completed', 'minting']
        ).select_related(
            'content',
            'content__creator'
        ).prefetch_related(
            progress_prefetch
        ).order_by('-purchased_at')

        # Group by content type
        library = {
            'books': [],
            'art': [],
            'film': [],
            'music': [],
            'comics': []
        }

        # Track content IDs to prevent duplicates
        seen_content_ids = set()

        for purchase in purchases:
            content = purchase.content

            # Skip if we've already added this content
            # (prevents duplicates from multiple purchase records)
            if content.id in seen_content_ids:
                continue
            seen_content_ids.add(content.id)

            # Get reading progress from prefetched data (no extra query!)
            progress_percentage = 0
            last_read_at = None
            if hasattr(content, 'user_progress') and content.user_progress:
                progress_percentage = float(content.user_progress[0].progress_percentage)
                last_read_at = content.user_progress[0].last_read_at.isoformat() if content.user_progress[0].last_read_at else None

            item = {
                'id': content.id,
                'title': content.title,
                'creator': content.creator.username if content.creator else 'Unknown',
                'thumbnail': content.teaser_link or '',
                'content_type': content.content_type,
                'purchased_at': purchase.purchased_at.isoformat(),
                'progress': progress_percentage,
                'last_read_at': last_read_at
            }

            # Add to appropriate category
            content_type = content.content_type.lower()
            if content_type == 'book':
                library['books'].append(item)
            elif content_type == 'art':
                library['art'].append(item)
            elif content_type == 'film':
                library['film'].append(item)
            elif content_type == 'music':
                library['music'].append(item)
            elif content_type == 'comic':
                library['comics'].append(item)
            else:
                # Default to books if unknown
                library['books'].append(item)

        return Response(library, status=status.HTTP_200_OK)


class FullContentView(APIView):
    """Get full content (ownership verified)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get full content for owned items."""
        try:
            content = Content.objects.select_related('creator').get(id=pk)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check ownership
        is_owned = content.is_owned_by(request.user)

        if not is_owned:
            return Response(
                {'error': 'You do not own this content', 'code': 'NOT_OWNED'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Return full content
        # Try to get content from linked chapter first, otherwise use teaser
        content_html = content.teaser_html or ''
        try:
            if hasattr(content, 'source_chapter'):
                chapter = content.source_chapter.first()
                if chapter and chapter.content_html:
                    content_html = chapter.content_html
        except Exception:
            pass

        response_data = {
            'id': content.id,
            'title': content.title,
            'content_html': content_html,
            'creator': content.creator.username if content.creator else 'Unknown',
            'content_type': content.content_type,
            'owned': True,
            # Include teaser_link for art/music/film content which store media URLs
            'teaser_link': content.teaser_link if content.teaser_link else None,
        }

        return Response(response_data, status=status.HTTP_200_OK)


class ReadingProgressView(APIView):
    """Track and retrieve reading progress."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Update reading progress for content."""
        content_id = request.data.get('content_id')
        progress_percentage = request.data.get('progress_percentage')
        last_position = request.data.get('last_position', '')

        if not content_id:
            return Response(
                {'error': 'content_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if progress_percentage is None:
            return Response(
                {'error': 'progress_percentage is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            content = Content.objects.get(id=content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify ownership
        if not content.is_owned_by(request.user):
            return Response(
                {'error': 'You do not own this content'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Update or create progress
        progress, created = ReadingProgress.objects.update_or_create(
            user=request.user,
            content=content,
            defaults={
                'progress_percentage': progress_percentage,
                'last_position': last_position
            }
        )

        serializer = ReadingProgressSerializer(progress)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def get(self, request, content_id=None):
        """Get reading progress for a specific content or all content."""
        if content_id:
            # Get progress for specific content
            try:
                progress = ReadingProgress.objects.get(
                    user=request.user,
                    content_id=content_id
                )
                serializer = ReadingProgressSerializer(progress)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except ReadingProgress.DoesNotExist:
                return Response(
                    {
                        'progress_percentage': 0,
                        'last_position': '',
                        'last_read_at': None
                    },
                    status=status.HTTP_200_OK
                )
        else:
            # Get all progress for user
            progress_list = ReadingProgress.objects.filter(user=request.user)
            serializer = ReadingProgressSerializer(progress_list, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)


class ComicPreviewView(APIView):
    """Get comic preview pages for public viewing (no ownership required)."""

    permission_classes = []  # Public endpoint

    def get(self, request, pk):
        """Get limited comic pages for preview."""
        try:
            content = Content.objects.select_related('creator').get(id=pk)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only allow for comic content
        if content.content_type != 'comic':
            return Response(
                {'error': 'This content is not a comic'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the linked CollaborativeProject
        # First try whole-project publishing (CollaborativeProject.published_content -> Content)
        project = content.source_collaborative_project.filter(
            content_type='comic'
        ).first()

        # Fallback: per-issue publishing (ComicIssue.published_content -> Content)
        if not project:
            from ..models import ComicIssue
            issue = ComicIssue.objects.filter(published_content=content).select_related('project').first()
            if issue and issue.project:
                project = issue.project

        if not project:
            return Response(
                {'error': 'Comic data not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all pages that have panel content (pages may be linked directly to project or via issues)
        # Only include pages that have at least one panel with non-empty artwork
        # Order by issue number first, then page number
        from django.db.models import Exists, OuterRef
        from ..models import ComicPanel

        # Subquery to check if page has at least one panel with artwork
        has_artwork = ComicPanel.objects.filter(
            page=OuterRef('pk'),
            artwork__isnull=False
        ).exclude(artwork='')

        all_pages = ComicPage.objects.filter(
            Q(project=project) | Q(issue__project=project)
        ).annotate(
            has_panel_artwork=Exists(has_artwork)
        ).filter(
            has_panel_artwork=True
        ).distinct().order_by('issue__issue_number', 'page_number')
        total_pages = all_pages.count()

        if total_pages == 0:
            return Response({
                'content_id': content.id,
                'title': content.title,
                'creator': content.creator.display_name if hasattr(content.creator, 'display_name') and content.creator.display_name else content.creator.username,
                'total_pages': 0,
                'preview_pages': 0,
                'pages': [],
                'is_preview': True
            }, status=status.HTTP_200_OK)

        # Calculate preview pages based on teaser_percent
        # For comics: show at least 1 page, max based on percentage
        teaser_percent = content.teaser_percent or 10
        preview_page_count = max(1, int(total_pages * teaser_percent / 100))
        # Cap at 3 pages for preview to leave incentive to purchase
        preview_page_count = min(preview_page_count, 3)

        # Get only the preview pages
        preview_pages = all_pages[:preview_page_count]

        serializer = ComicPageSerializer(preview_pages, many=True)

        return Response({
            'content_id': content.id,
            'title': content.title,
            'creator': content.creator.display_name if hasattr(content.creator, 'display_name') and content.creator.display_name else content.creator.username,
            'total_pages': total_pages,
            'preview_pages': preview_page_count,
            'pages': serializer.data,
            'is_preview': True
        }, status=status.HTTP_200_OK)


class ComicReaderDataView(APIView):
    """Get comic pages/panels/bubbles for reading a published comic."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get full comic data for owned comics."""
        try:
            content = Content.objects.select_related('creator').get(id=pk)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check ownership
        is_owned = content.is_owned_by(request.user)

        if not is_owned:
            return Response(
                {'error': 'You do not own this content', 'code': 'NOT_OWNED'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get the linked CollaborativeProject (comic source)
        project = content.source_collaborative_project.filter(
            content_type='comic'
        ).first()

        # Fallback: per-issue publishing (ComicIssue.published_content -> Content)
        if not project:
            from ..models import ComicIssue
            issue = ComicIssue.objects.filter(published_content=content).select_related('project').first()
            if issue and issue.project:
                project = issue.project

        if not project:
            return Response(
                {'error': 'Comic data not found. This content may not be a comic.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get all pages for the comic project that have panel content
        # Pages may be linked directly to project or via issues
        # Only include pages that have at least one panel with non-empty artwork
        # Order by issue number first, then page number
        from django.db.models import Exists, OuterRef
        from ..models import ComicPanel

        # Subquery to check if page has at least one panel with artwork
        has_artwork = ComicPanel.objects.filter(
            page=OuterRef('pk'),
            artwork__isnull=False
        ).exclude(artwork='')

        pages = ComicPage.objects.filter(
            Q(project=project) | Q(issue__project=project)
        ).annotate(
            has_panel_artwork=Exists(has_artwork)
        ).filter(
            has_panel_artwork=True
        ).distinct().order_by('issue__issue_number', 'page_number')

        # Serialize the pages (includes nested panels and speech bubbles)
        serializer = ComicPageSerializer(pages, many=True)

        return Response({
            'content_id': content.id,
            'title': content.title,
            'creator': content.creator.display_name if hasattr(content.creator, 'display_name') and content.creator.display_name else content.creator.username,
            'total_pages': pages.count(),
            'pages': serializer.data
        }, status=status.HTTP_200_OK)
