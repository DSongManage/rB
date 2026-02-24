"""
Notification Views and API Endpoints
Handles real-time notification system for collaboration activities
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.mixins import DestroyModelMixin
from django.utils import timezone
from django.db.models import Q

from rb_core.models import Notification, NotificationPreference, NOTIFICATION_DEFAULTS
from rb_core.serializers import NotificationSerializer


class NotificationViewSet(DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for managing user notifications.

    Endpoints:
    - GET /api/notifications/ - List all notifications for current user
    - GET /api/notifications/{id}/ - Get specific notification
    - POST /api/notifications/{id}/mark-read/ - Mark notification as read
    - POST /api/notifications/mark-all-read/ - Mark all notifications as read
    - DELETE /api/notifications/{id}/ - Delete a notification
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return notifications for the current user only."""
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related(
            'from_user',
            'from_user__profile',
            'project'
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """
        List all notifications for the current user.
        Returns notifications ordered by created_at (newest first).
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        """Get a specific notification."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """
        Mark a single notification as read.

        POST /api/notifications/{id}/mark-read/
        """
        notification = self.get_object()

        if not notification.read:
            notification.read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['read', 'read_at'])

        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """
        Mark all notifications as read for the current user.

        POST /api/notifications/mark-all-read/
        """
        updated_count = Notification.objects.filter(
            recipient=request.user,
            read=False
        ).update(
            read=True,
            read_at=timezone.now()
        )

        return Response({
            'status': 'success',
            'updated_count': updated_count
        })

    def destroy(self, request, *args, **kwargs):
        """
        Delete a notification.

        DELETE /api/notifications/{id}/
        """
        notification = self.get_object()
        notification.delete()

        return Response(
            {'status': 'success', 'message': 'Notification deleted'},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """
        Get count of unread notifications.

        GET /api/notifications/unread-count/
        """
        count = Notification.objects.filter(
            recipient=request.user,
            read=False
        ).count()

        return Response({'count': count})

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        Get notification statistics for the current user.

        GET /api/notifications/stats/

        Returns:
            - total: Total notification count
            - unread: Unread notification count
            - by_type: Count grouped by notification type
        """
        from django.db.models import Count, Q

        queryset = self.get_queryset()

        # Use aggregation to count total and unread in single query
        counts = queryset.aggregate(
            total=Count('id'),
            unread=Count('id', filter=Q(read=False))
        )

        # Use values + annotate to group by type in single query
        by_type_qs = queryset.values('notification_type').annotate(
            count=Count('id')
        ).values_list('notification_type', 'count')

        # Convert to dict
        by_type_dict = dict(by_type_qs)

        # Ensure all notification types are present (even if count is 0)
        for notif_type, _ in Notification.NOTIFICATION_TYPES:
            if notif_type not in by_type_dict:
                by_type_dict[notif_type] = 0

        stats = {
            'total': counts['total'],
            'unread': counts['unread'],
            'by_type': by_type_dict
        }

        return Response(stats)

    # ------------------------------------------------------------------
    # Notification Preferences
    # ------------------------------------------------------------------

    PREFERENCE_LABELS = {
        'invitation': 'Collaboration Invitations',
        'invitation_response': 'Invitation Responses',
        'counter_proposal': 'Counter Proposals',
        'revenue_proposal': 'Revenue Proposals',
        'approval': 'Approvals',
        'mint_ready': 'Mint Ready',
        'content_purchase': 'Purchases',
        'content_like': 'Likes',
        'content_comment': 'Content Comments',
        'content_rating': 'Ratings',
        'creator_review': 'Reviews',
        'section_update': 'Section Updates',
        'comment': 'Studio Comments',
        'new_follower': 'New Followers',
    }

    ACTION_ITEM_TYPES = {
        'invitation', 'invitation_response', 'counter_proposal',
        'revenue_proposal', 'approval', 'mint_ready', 'content_purchase',
    }

    @action(detail=False, methods=['get'], url_path='preferences')
    def preferences(self, request):
        """
        GET /api/notifications/preferences/

        Returns all 14 notification types with effective preferences,
        grouped by category.
        """
        overrides = {
            p.notification_type: {'in_app': p.in_app, 'email': p.email}
            for p in NotificationPreference.objects.filter(user=request.user)
        }

        action_items = []
        engagement = []

        for ntype, defaults in NOTIFICATION_DEFAULTS.items():
            effective = overrides.get(ntype, defaults)
            entry = {
                'notification_type': ntype,
                'label': self.PREFERENCE_LABELS.get(ntype, ntype),
                'in_app': effective['in_app'],
                'email': effective['email'],
            }
            if ntype in self.ACTION_ITEM_TYPES:
                action_items.append(entry)
            else:
                engagement.append(entry)

        return Response({
            'action_items': action_items,
            'engagement': engagement,
        })

    @action(detail=False, methods=['put'], url_path='preferences/update')
    def update_preferences(self, request):
        """
        PUT /api/notifications/preferences/update/

        Body: { "preferences": [{ "notification_type": "...", "in_app": bool, "email": bool }] }
        """
        prefs = request.data.get('preferences', [])
        if not isinstance(prefs, list):
            return Response(
                {'error': 'preferences must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_types = set(NOTIFICATION_DEFAULTS.keys())
        updated = []

        for item in prefs:
            ntype = item.get('notification_type')
            if ntype not in valid_types:
                continue

            obj, _ = NotificationPreference.objects.update_or_create(
                user=request.user,
                notification_type=ntype,
                defaults={
                    'in_app': item.get('in_app', True),
                    'email': item.get('email', False),
                },
            )
            updated.append({
                'notification_type': obj.notification_type,
                'in_app': obj.in_app,
                'email': obj.email,
            })

        return Response({'status': 'success', 'updated': updated})
