"""
Social Engagement Views and API Endpoints
Handles likes, comments, ratings, and creator reviews
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.db import transaction
from django.db.models import F

from rb_core.models import (
    Content, User, UserProfile, Purchase,
    ContentLike, ContentComment, ContentRating, CreatorReview,
    CollaborativeProject, CollaboratorRole, Follow
)
from rb_core.serializers import (
    ContentLikeSerializer, ContentCommentSerializer,
    ContentRatingSerializer, CreatorReviewSerializer
)
from rb_core.notifications_utils import create_notification


# =============================================================================
# Pagination Classes
# =============================================================================

class CommentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class RatingPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50


# =============================================================================
# Content Likes
# =============================================================================

class ContentLikeView(APIView):
    """
    Toggle like on content.

    POST /api/content/{content_id}/like/ - Toggle like (create if not exists, delete if exists)
    GET /api/content/{content_id}/like/status/ - Check if user has liked
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, content_id):
        """Toggle like on content. Returns new like state and count."""
        try:
            content = Content.objects.get(pk=content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        existing_like = ContentLike.objects.filter(user=user, content=content).first()

        with transaction.atomic():
            if existing_like:
                # Unlike
                existing_like.delete()
                Content.objects.filter(pk=content_id).update(like_count=F('like_count') - 1)
                content.refresh_from_db()
                liked = False
            else:
                # Like
                ContentLike.objects.create(user=user, content=content)
                Content.objects.filter(pk=content_id).update(like_count=F('like_count') + 1)
                content.refresh_from_db()
                liked = True

                # Notify content creator (don't notify yourself)
                if content.creator != user:
                    create_notification(
                        recipient=content.creator,
                        from_user=user,
                        notification_type='content_like',
                        title=f'{user.username} liked your {content.content_type}',
                        message=f'{user.username} liked "{content.title}"',
                        action_url=f'/content/{content.id}'
                    )

        return Response({
            'liked': liked,
            'like_count': content.like_count
        })

    def get(self, request, content_id):
        """Check if user has liked this content."""
        try:
            content = Content.objects.get(pk=content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        liked = ContentLike.objects.filter(user=request.user, content=content).exists()
        return Response({
            'liked': liked,
            'like_count': content.like_count
        })


# =============================================================================
# Content Comments
# =============================================================================

class ContentCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for threaded content comments.

    GET /api/content-comments/?content={id} - List comments for content
    POST /api/content-comments/ - Create comment
    PATCH /api/content-comments/{id}/ - Edit comment
    DELETE /api/content-comments/{id}/ - Soft delete comment
    """
    serializer_class = ContentCommentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CommentPagination

    def get_queryset(self):
        """Filter comments by content and exclude deleted."""
        content_id = self.request.query_params.get('content')
        queryset = ContentComment.objects.filter(is_deleted=False)

        if content_id:
            queryset = queryset.filter(content_id=content_id)

        # Only show top-level comments by default (replies loaded separately)
        if self.request.query_params.get('top_level', 'true').lower() == 'true':
            queryset = queryset.filter(parent_comment__isnull=True)

        return queryset.select_related(
            'author', 'author__profile', 'content'
        ).order_by('-created_at')

    def get_permissions(self):
        """Allow unauthenticated users to list comments."""
        if self.action == 'list':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Create comment and notify content creator."""
        comment = serializer.save(author=self.request.user)

        # Notify content creator (don't notify yourself)
        if comment.content.creator != self.request.user:
            preview = comment.text[:100] + '...' if len(comment.text) > 100 else comment.text
            create_notification(
                recipient=comment.content.creator,
                from_user=self.request.user,
                notification_type='content_comment',
                title=f'New comment on your {comment.content.content_type}',
                message=f'{self.request.user.username}: {preview}',
                action_url=f'/content/{comment.content.id}'
            )

        # If this is a reply, notify the parent comment author
        if comment.parent_comment and comment.parent_comment.author != self.request.user:
            preview = comment.text[:100] + '...' if len(comment.text) > 100 else comment.text
            create_notification(
                recipient=comment.parent_comment.author,
                from_user=self.request.user,
                notification_type='content_comment',
                title='Reply to your comment',
                message=f'{self.request.user.username}: {preview}',
                action_url=f'/content/{comment.content.id}'
            )

    def perform_update(self, serializer):
        """Update comment with edit history tracking."""
        instance = self.get_object()

        # Only author can edit
        if instance.author != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only edit your own comments")

        # Track edit history
        old_text = instance.text
        new_text = serializer.validated_data.get('text', old_text)

        if old_text != new_text:
            if not instance.edit_history:
                instance.edit_history = []
            instance.edit_history.append({
                'text': old_text,
                'edited_at': timezone.now().isoformat()
            })
            instance.edited = True

        serializer.save()

    def perform_destroy(self, instance):
        """Soft delete comment (author or content creator can delete)."""
        user = self.request.user
        if instance.author != user and instance.content.creator != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You cannot delete this comment")

        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.deleted_by = user
        instance.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])

    @action(detail=True, methods=['get'])
    def replies(self, request, pk=None):
        """Get replies to a specific comment."""
        comment = self.get_object()
        replies = ContentComment.objects.filter(
            parent_comment=comment,
            is_deleted=False
        ).select_related('author', 'author__profile').order_by('created_at')

        serializer = self.get_serializer(replies, many=True)
        return Response(serializer.data)


# =============================================================================
# Content Ratings
# =============================================================================

class ContentRatingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for content ratings (star reviews).

    GET /api/content-ratings/?content={id} - List ratings for content
    POST /api/content-ratings/ - Create or update rating
    GET /api/content-ratings/mine/?content={id} - Get user's rating for content
    """
    serializer_class = ContentRatingSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = RatingPagination

    def get_queryset(self):
        """Filter ratings by content."""
        content_id = self.request.query_params.get('content')
        queryset = ContentRating.objects.all()

        if content_id:
            queryset = queryset.filter(content_id=content_id)

        return queryset.select_related(
            'user', 'user__profile', 'content'
        ).order_by('-created_at')

    def get_permissions(self):
        """Allow unauthenticated users to list ratings."""
        if self.action == 'list':
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Create or update rating (one per user per content)."""
        content_id = request.data.get('content')

        try:
            content = Content.objects.get(pk=content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user already rated - update instead
        existing = ContentRating.objects.filter(
            user=request.user,
            content=content
        ).first()

        if existing:
            # Update existing rating
            existing.rating = request.data.get('rating', existing.rating)
            existing.review_text = request.data.get('review_text', existing.review_text)
            existing.save()
            serializer = self.get_serializer(existing)
            return Response(serializer.data)

        # Create new rating
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.save(user=request.user)

        # Notify content creator (don't notify yourself)
        if content.creator != request.user:
            create_notification(
                recipient=content.creator,
                from_user=request.user,
                notification_type='content_rating',
                title=f'New {rating.rating}-star rating on your {content.content_type}',
                message=f'{request.user.username} rated "{content.title}" {rating.rating}/5 stars',
                action_url=f'/content/{content.id}'
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Get user's rating for a specific content."""
        content_id = request.query_params.get('content')
        if not content_id:
            return Response(
                {'error': 'content parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        rating = ContentRating.objects.filter(
            user=request.user,
            content_id=content_id
        ).first()

        if rating:
            serializer = self.get_serializer(rating)
            return Response(serializer.data)
        return Response(None)


# =============================================================================
# Creator Reviews
# =============================================================================

def can_review_creator(reviewer: User, creator: User) -> tuple:
    """
    Check if reviewer is eligible to review this creator.

    Returns (is_eligible, verification_type, reason) tuple.
    """
    # Cannot review yourself
    if reviewer == creator:
        return (False, '', 'You cannot review yourself')

    # Check if already reviewed
    if CreatorReview.objects.filter(reviewer=reviewer, creator=creator).exists():
        return (False, '', 'You have already reviewed this creator')

    # Check for verified purchase from this creator
    has_purchase = Purchase.objects.filter(
        user=reviewer,
        content__creator=creator,
        refunded=False,
        status__in=['payment_completed', 'completed']
    ).exists()

    if has_purchase:
        return (True, 'purchase', '')

    # Check for past collaboration with this creator
    # Find projects where both are accepted collaborators
    reviewer_projects = CollaboratorRole.objects.filter(
        user=reviewer,
        status='accepted'
    ).values_list('project_id', flat=True)

    has_collaboration = CollaboratorRole.objects.filter(
        user=creator,
        status='accepted',
        project_id__in=reviewer_projects
    ).exists()

    if has_collaboration:
        return (True, 'collaboration', '')

    return (False, '', 'You must have purchased from or collaborated with this creator to leave a review')


class CreatorReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creator reviews (Yelp-style).

    GET /api/creator-reviews/?creator={username} - List reviews for creator
    POST /api/creator-reviews/ - Create review (requires eligibility)
    POST /api/creator-reviews/{id}/respond/ - Creator responds to review
    GET /api/creator-reviews/can-review/{user_id}/ - Check if can review
    """
    serializer_class = CreatorReviewSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = RatingPagination

    def get_queryset(self):
        """Filter reviews by creator username."""
        creator_username = self.request.query_params.get('creator')
        queryset = CreatorReview.objects.all()

        if creator_username:
            queryset = queryset.filter(creator__username=creator_username)

        return queryset.select_related(
            'reviewer', 'reviewer__profile', 'creator', 'creator__profile'
        ).order_by('-created_at')

    def get_permissions(self):
        """Allow unauthenticated users to list reviews."""
        if self.action == 'list':
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Create review with eligibility check."""
        creator_id = request.data.get('creator')

        try:
            creator = User.objects.get(pk=creator_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Creator not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        is_eligible, verification_type, reason = can_review_creator(request.user, creator)

        if not is_eligible:
            return Response(
                {'error': reason},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save(
            reviewer=request.user,
            verification_type=verification_type
        )

        # Notify creator
        create_notification(
            recipient=creator,
            from_user=request.user,
            notification_type='creator_review',
            title=f'New {review.rating}-star review',
            message=f'{request.user.username} left a {review.rating}/5 star review on your profile',
            action_url=f'/profile/{creator.username}'
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        """Creator responds to a review (once only)."""
        review = self.get_object()

        if review.creator != request.user:
            return Response(
                {'error': 'Only the creator can respond to this review'},
                status=status.HTTP_403_FORBIDDEN
            )

        if review.response_text:
            return Response(
                {'error': 'You have already responded to this review'},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_text = request.data.get('response_text', '').strip()
        if not response_text:
            return Response(
                {'error': 'Response text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(response_text) > 2000:
            return Response(
                {'error': 'Response text must be 2000 characters or less'},
                status=status.HTTP_400_BAD_REQUEST
            )

        review.response_text = response_text
        review.response_at = timezone.now()
        review.save(update_fields=['response_text', 'response_at'])

        serializer = self.get_serializer(review)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='can-review/(?P<user_id>[^/.]+)')
    def can_review(self, request, user_id=None):
        """Check if current user can review the specified creator."""
        try:
            creator = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        is_eligible, verification_type, reason = can_review_creator(request.user, creator)

        return Response({
            'can_review': is_eligible,
            'verification_type': verification_type if is_eligible else None,
            'reason': reason if not is_eligible else None
        })


# =============================================================================
# User Following
# =============================================================================

class FollowPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class FollowView(APIView):
    """
    Follow/unfollow a user.

    POST /api/users/{username}/follow/ - Follow user
    DELETE /api/users/{username}/follow/ - Unfollow user
    GET /api/users/{username}/follow/status/ - Check if following
    """
    permission_classes = [IsAuthenticated]

    def get_target_user(self, username):
        """Get target user by username."""
        try:
            return User.objects.select_related('profile').get(username=username)
        except User.DoesNotExist:
            return None

    def post(self, request, username):
        """Follow a user."""
        target_user = self.get_target_user(username)
        if not target_user:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot follow yourself
        if target_user == request.user:
            return Response(
                {'error': 'You cannot follow yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already following
        if Follow.objects.filter(follower=request.user, following=target_user).exists():
            return Response(
                {'error': 'You are already following this user'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Create follow relationship
            Follow.objects.create(follower=request.user, following=target_user)

            # Update denormalized counts
            UserProfile.objects.filter(user=request.user).update(
                following_count=F('following_count') + 1
            )
            UserProfile.objects.filter(user=target_user).update(
                follower_count=F('follower_count') + 1
            )

            # Notify the user being followed
            create_notification(
                recipient=target_user,
                from_user=request.user,
                notification_type='new_follower',
                title='New follower',
                message=f'@{request.user.username} started following you',
                action_url=f'/profile/{request.user.username}'
            )

        # Get updated count
        target_user.profile.refresh_from_db()

        return Response({
            'following': True,
            'follower_count': target_user.profile.follower_count
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, username):
        """Unfollow a user."""
        target_user = self.get_target_user(username)
        if not target_user:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        follow = Follow.objects.filter(follower=request.user, following=target_user).first()
        if not follow:
            return Response(
                {'error': 'You are not following this user'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Delete follow relationship
            follow.delete()

            # Update denormalized counts (prevent negative)
            UserProfile.objects.filter(user=request.user, following_count__gt=0).update(
                following_count=F('following_count') - 1
            )
            UserProfile.objects.filter(user=target_user, follower_count__gt=0).update(
                follower_count=F('follower_count') - 1
            )

        # Get updated count
        target_user.profile.refresh_from_db()

        return Response({
            'following': False,
            'follower_count': target_user.profile.follower_count
        })

    def get(self, request, username):
        """Check if current user is following the target user."""
        target_user = self.get_target_user(username)
        if not target_user:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        is_following = Follow.objects.filter(
            follower=request.user,
            following=target_user
        ).exists()

        return Response({
            'following': is_following,
            'follower_count': target_user.profile.follower_count
        })


class FollowersListView(APIView):
    """
    List followers for a user.

    GET /api/users/{username}/followers/ - Paginated list of followers
    """
    permission_classes = [AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get followers with profile info
        followers = Follow.objects.filter(
            following=user
        ).select_related(
            'follower', 'follower__profile'
        ).order_by('-created_at')

        # Paginate
        paginator = FollowPagination()
        page = paginator.paginate_queryset(followers, request)

        # Serialize
        data = []
        for follow in page:
            follower = follow.follower
            profile = getattr(follower, 'profile', None)
            data.append({
                'id': follower.id,
                'username': follower.username,
                'display_name': profile.display_name if profile else follower.username,
                'avatar': profile.resolved_avatar_url if profile else None,
                'bio': profile.bio[:100] if profile and profile.bio else None,
                'followed_at': follow.created_at.isoformat(),
            })

        return paginator.get_paginated_response(data)


class FollowingListView(APIView):
    """
    List users that a user is following.

    GET /api/users/{username}/following/ - Paginated list of following
    """
    permission_classes = [AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get following with profile info
        following = Follow.objects.filter(
            follower=user
        ).select_related(
            'following', 'following__profile'
        ).order_by('-created_at')

        # Paginate
        paginator = FollowPagination()
        page = paginator.paginate_queryset(following, request)

        # Serialize
        data = []
        for follow in page:
            followed_user = follow.following
            profile = getattr(followed_user, 'profile', None)
            data.append({
                'id': followed_user.id,
                'username': followed_user.username,
                'display_name': profile.display_name if profile else followed_user.username,
                'avatar': profile.resolved_avatar_url if profile else None,
                'bio': profile.bio[:100] if profile and profile.bio else None,
                'followed_at': follow.created_at.isoformat(),
            })

        return paginator.get_paginated_response(data)


class FollowingFeedView(APIView):
    """
    Feed of content from followed users.

    GET /api/feed/following/ - Paginated feed of content from followed creators
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get users the current user is following
        following_ids = Follow.objects.filter(
            follower=request.user
        ).values_list('following_id', flat=True)

        if not following_ids:
            return Response({
                'count': 0,
                'next': None,
                'previous': None,
                'results': []
            })

        # Get minted content from followed users, ordered by creation date
        content = Content.objects.filter(
            creator_id__in=following_ids,
            inventory_status='minted'
        ).select_related(
            'creator', 'creator__profile'
        ).order_by('-created_at')

        # Paginate
        paginator = FollowPagination()
        page = paginator.paginate_queryset(content, request)

        # Serialize with creator info
        data = []
        for item in page:
            creator = item.creator
            profile = getattr(creator, 'profile', None)

            # Determine cover image
            cover_image = None
            if item.content_type in ['art', 'music', 'video'] and item.teaser_link:
                cover_image = item.teaser_link if item.teaser_link.startswith('http') else request.build_absolute_uri(item.teaser_link)

            data.append({
                'id': item.id,
                'title': item.title,
                'content_type': item.content_type,
                'genre': item.genre,
                'price_usd': str(item.price_usd),
                'cover_image': cover_image,
                'view_count': item.view_count,
                'like_count': item.like_count,
                'created_at': item.created_at.isoformat(),
                'creator': {
                    'id': creator.id,
                    'username': creator.username,
                    'display_name': profile.display_name if profile else creator.username,
                    'avatar': profile.resolved_avatar_url if profile else None,
                }
            })

        return paginator.get_paginated_response(data)
