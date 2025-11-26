from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from ..models import Purchase, Content, ReadingProgress
from ..serializers import ContentSerializer, ReadingProgressSerializer


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
        purchases = Purchase.objects.filter(
            user=request.user,
            refunded=False
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
            'music': []
        }

        for purchase in purchases:
            content = purchase.content

            # Get reading progress from prefetched data (no extra query!)
            progress_percentage = 0
            if hasattr(content, 'user_progress') and content.user_progress:
                progress_percentage = float(content.user_progress[0].progress_percentage)

            item = {
                'id': content.id,
                'title': content.title,
                'creator': content.creator.username if content.creator else 'Unknown',
                'thumbnail': content.teaser_link or '',
                'content_type': content.content_type,
                'purchased_at': purchase.purchased_at.isoformat(),
                'progress': progress_percentage
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
            'owned': True
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
