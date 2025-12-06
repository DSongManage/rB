"""
Chapter Management Views - Content Removal Policy

Handles chapter removal, delisting, relisting, and approval workflows.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from ..models import Chapter, DelistApproval, CollaboratorApproval

logger = logging.getLogger(__name__)


class RemoveChapterView(APIView):
    """
    POST /api/chapters/{id}/remove/

    Permanently delete a chapter from the database.
    Only allowed if chapter has zero sales.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Remove chapter permanently (only if no sales)."""
        reason = request.data.get('reason', '')

        try:
            chapter = Chapter.objects.get(id=pk)
        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Chapter not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            with transaction.atomic():
                result = chapter.remove_completely(request.user, reason=reason)

            logger.info(
                f"[RemoveChapter] User {request.user.username} removed chapter {pk} "
                f"('{chapter.title}'). Reason: {reason}"
            )

            return Response(result, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[RemoveChapter] Error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DelistChapterView(APIView):
    """
    POST /api/chapters/{id}/delist/

    Hide chapter from marketplace (preserves access for NFT holders).
    For collaborative content, creates approval workflow.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Delist chapter from marketplace."""
        reason = request.data.get('reason', '')

        if not reason:
            return Response(
                {'error': 'Reason is required for delisting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            chapter = Chapter.objects.get(id=pk)
        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Chapter not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            with transaction.atomic():
                result = chapter.delist_from_marketplace(request.user, reason=reason)

            logger.info(
                f"[DelistChapter] User {request.user.username} initiated delist for chapter {pk}. "
                f"Requires approval: {result.get('requires_approval', False)}"
            )

            return Response(result, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[DelistChapter] Error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RelistChapterView(APIView):
    """
    POST /api/chapters/{id}/relist/

    Restore chapter to marketplace (undo delisting).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Relist chapter on marketplace."""
        try:
            chapter = Chapter.objects.get(id=pk)
        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Chapter not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            with transaction.atomic():
                result = chapter.relist_on_marketplace(request.user)

            logger.info(
                f"[RelistChapter] User {request.user.username} relisted chapter {pk}"
            )

            return Response(result, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[RelistChapter] Error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChapterRemovalStatusView(APIView):
    """
    GET /api/chapters/{id}/removal-status/

    Get removal status and permissions for a chapter.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get chapter removal status."""
        try:
            chapter = Chapter.objects.select_related(
                'book_project__creator',
                'delisted_by'
            ).get(id=pk)
        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Chapter not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get purchase count
        purchase_count = chapter.get_purchase_count()
        has_sales = chapter.has_any_sales()

        # Get permissions
        can_remove = chapter.can_be_removed_completely()
        can_delist = chapter.can_be_delisted_by(request.user)

        # Get pending delist requests
        pending_delist = DelistApproval.objects.filter(
            chapter=chapter,
            status='pending'
        ).first()

        response_data = {
            'chapter_id': chapter.id,
            'title': chapter.title,
            'is_listed': chapter.is_listed,
            'delisted_at': chapter.delisted_at.isoformat() if chapter.delisted_at else None,
            'delisted_by': chapter.delisted_by.username if chapter.delisted_by else None,
            'delisted_reason': chapter.delisted_reason,
            'purchase_count': purchase_count,
            'has_sales': has_sales,
            'can_remove_completely': can_remove,
            'can_delist': can_delist,
            'is_collaborative': chapter.is_collaborative(),
            'pending_delist_request': None
        }

        if pending_delist:
            # Get collaborator responses
            total_collaborators = len(chapter.get_all_collaborators())
            approvals = pending_delist.collaborator_responses.filter(approved=True).count()

            response_data['pending_delist_request'] = {
                'id': pending_delist.id,
                'requested_by': pending_delist.requested_by.username,
                'reason': pending_delist.reason,
                'created_at': pending_delist.created_at.isoformat(),
                'approvals_count': approvals,
                'total_collaborators': total_collaborators,
                'status': pending_delist.status
            }

        return Response(response_data, status=status.HTTP_200_OK)


class RespondToDelistRequestView(APIView):
    """
    POST /api/delist-approvals/{id}/respond/

    Approve or reject a delist request.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Respond to delist request."""
        approved = request.data.get('approved')
        response_note = request.data.get('response_note', '')

        if approved is None:
            return Response(
                {'error': 'approved field is required (true/false)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            delist_request = DelistApproval.objects.select_related(
                'chapter',
                'requested_by'
            ).get(id=pk)
        except DelistApproval.DoesNotExist:
            return Response(
                {'error': 'Delist request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if request is still pending
        if delist_request.status != 'pending':
            return Response(
                {'error': f'Request is {delist_request.status}, cannot respond'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user is a collaborator
        if not delist_request.chapter.can_be_delisted_by(request.user):
            return Response(
                {'error': 'You are not a collaborator on this chapter'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            with transaction.atomic():
                # If rejecting, mark as rejected immediately
                if not approved:
                    result = delist_request.reject(request.user)

                    # Record the rejection
                    CollaboratorApproval.objects.update_or_create(
                        delist_request=delist_request,
                        collaborator=request.user,
                        defaults={
                            'approved': False,
                            'response_note': response_note
                        }
                    )

                    logger.info(
                        f"[DelistApproval] User {request.user.username} rejected "
                        f"delist request {pk}"
                    )

                    return Response(result, status=status.HTTP_200_OK)

                # If approving, record approval and check if all approved
                else:
                    CollaboratorApproval.objects.update_or_create(
                        delist_request=delist_request,
                        collaborator=request.user,
                        defaults={
                            'approved': True,
                            'response_note': response_note
                        }
                    )

                    # Check if all collaborators have approved
                    result = delist_request.check_and_apply_if_approved()

                    logger.info(
                        f"[DelistApproval] User {request.user.username} approved "
                        f"delist request {pk}. All approved: {result['approved']}"
                    )

                    return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[DelistApproval] Error: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PendingDelistRequestsView(APIView):
    """
    GET /api/delist-approvals/pending/

    Get all pending delist requests for the current user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get pending delist requests."""
        # Get all chapters where user is a collaborator
        # For now, this is just chapters from user's book projects
        user_chapters = Chapter.objects.filter(
            book_project__creator=request.user
        ).values_list('id', flat=True)

        # Get pending delist requests for these chapters
        pending_requests = DelistApproval.objects.filter(
            chapter_id__in=user_chapters,
            status='pending'
        ).select_related(
            'chapter',
            'chapter__book_project',
            'requested_by'
        ).order_by('-created_at')

        # Build response
        requests_data = []
        for req in pending_requests:
            # Check if user has already responded
            user_response = req.collaborator_responses.filter(
                collaborator=request.user
            ).first()

            # Count approvals
            total_collaborators = len(req.chapter.get_all_collaborators())
            approvals = req.collaborator_responses.filter(approved=True).count()

            requests_data.append({
                'id': req.id,
                'chapter': {
                    'id': req.chapter.id,
                    'title': req.chapter.title,
                    'book_project': req.chapter.book_project.title
                },
                'requested_by': {
                    'username': req.requested_by.username
                },
                'reason': req.reason,
                'created_at': req.created_at.isoformat(),
                'approvals_count': approvals,
                'total_collaborators': total_collaborators,
                'user_has_responded': user_response is not None,
                'user_approved': user_response.approved if user_response else None,
                'user_response_note': user_response.response_note if user_response else None
            })

        return Response({
            'pending_requests': requests_data,
            'count': len(requests_data)
        }, status=status.HTTP_200_OK)
