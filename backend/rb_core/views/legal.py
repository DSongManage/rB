"""
Legal API endpoints for renaissBlock.

Handles legal document retrieval and acceptance tracking.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.utils import timezone

from ..models import LegalDocument, UserLegalAcceptance, UserProfile


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class LegalDocumentView(APIView):
    """
    GET /api/legal/documents/<type>/

    Get a legal document by type (tos, privacy, creator_agreement, content_policy, dmca).
    Returns the current version of the document.
    """
    permission_classes = [AllowAny]

    def get(self, request, document_type):
        # Validate document type
        valid_types = dict(LegalDocument.DOCUMENT_TYPE_CHOICES).keys()
        if document_type not in valid_types:
            return Response(
                {'error': f'Invalid document type. Valid types: {list(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        document = LegalDocument.get_current_version(document_type)

        if not document:
            return Response(
                {'error': f'No document found for type: {document_type}'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'document_type': document.document_type,
            'document_type_display': document.get_document_type_display(),
            'version': document.version,
            'content': document.content,
            'effective_date': document.effective_date.isoformat(),
            'summary_of_changes': document.summary_of_changes,
        })


class LegalAcceptView(APIView):
    """
    POST /api/legal/accept/

    Record user's acceptance of a legal document.
    Body: { "document_type": "tos" | "privacy" | "creator_agreement" | etc. }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        document_type = request.data.get('document_type')

        # Validate document type
        valid_types = dict(LegalDocument.DOCUMENT_TYPE_CHOICES).keys()
        if document_type not in valid_types:
            return Response(
                {'error': f'Invalid document type. Valid types: {list(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ip_address = get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length

            acceptance, created = UserLegalAcceptance.record_acceptance(
                user=request.user,
                document_type=document_type,
                ip_address=ip_address,
                user_agent=user_agent
            )

            # Update UserProfile fields for quick checks
            if document_type in ['tos', 'privacy'] and hasattr(request.user, 'profile'):
                profile = request.user.profile
                if document_type == 'tos':
                    profile.tos_accepted_at = timezone.now()
                    profile.tos_version = acceptance.document.version
                    profile.save(update_fields=['tos_accepted_at', 'tos_version'])
            elif document_type == 'creator_agreement' and hasattr(request.user, 'profile'):
                profile = request.user.profile
                profile.creator_agreement_accepted_at = timezone.now()
                profile.creator_agreement_version = acceptance.document.version
                profile.save(update_fields=['creator_agreement_accepted_at', 'creator_agreement_version'])

            return Response({
                'accepted': True,
                'document_type': document_type,
                'version': acceptance.document.version,
                'accepted_at': acceptance.accepted_at.isoformat(),
            })

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class LegalCheckAcceptanceView(APIView):
    """
    GET /api/legal/check-acceptance/

    Check if user has accepted current versions of legal documents.
    Query params: ?document_type=tos (optional - if omitted, checks all)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        document_type = request.query_params.get('document_type')

        if document_type:
            # Check specific document type
            valid_types = dict(LegalDocument.DOCUMENT_TYPE_CHOICES).keys()
            if document_type not in valid_types:
                return Response(
                    {'error': f'Invalid document type. Valid types: {list(valid_types)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            current_doc = LegalDocument.get_current_version(document_type)
            if not current_doc:
                return Response({
                    'document_type': document_type,
                    'accepted': True,  # No document means nothing to accept
                    'version': None,
                    'accepted_at': None,
                })

            acceptance = UserLegalAcceptance.objects.filter(
                user=request.user,
                document=current_doc
            ).first()

            return Response({
                'document_type': document_type,
                'accepted': acceptance is not None,
                'version': current_doc.version,
                'accepted_at': acceptance.accepted_at.isoformat() if acceptance else None,
            })

        else:
            # Check all document types
            results = {}
            for doc_type, display_name in LegalDocument.DOCUMENT_TYPE_CHOICES:
                current_doc = LegalDocument.get_current_version(doc_type)
                if not current_doc:
                    results[doc_type] = {
                        'accepted': True,
                        'version': None,
                        'accepted_at': None,
                        'display_name': display_name,
                    }
                else:
                    acceptance = UserLegalAcceptance.objects.filter(
                        user=request.user,
                        document=current_doc
                    ).first()
                    results[doc_type] = {
                        'accepted': acceptance is not None,
                        'version': current_doc.version,
                        'accepted_at': acceptance.accepted_at.isoformat() if acceptance else None,
                        'display_name': display_name,
                    }

            return Response(results)


class LegalPendingAcceptancesView(APIView):
    """
    GET /api/legal/pending-acceptances/

    Get list of documents that require user acceptance.
    Returns documents where user hasn't accepted the current version.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending = UserLegalAcceptance.get_pending_acceptances(request.user)
        return Response({
            'pending': pending,
            'has_pending': len(pending) > 0,
        })


class CreatorAgreementStatusView(APIView):
    """
    GET /api/legal/creator-agreement-status/

    Quick check if user has accepted the creator agreement.
    Used to gate publishing functionality.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_accepted = UserLegalAcceptance.has_accepted_current(
            request.user,
            'creator_agreement'
        )

        # Also check the quick-lookup field on profile
        profile_accepted = False
        if hasattr(request.user, 'profile'):
            profile_accepted = request.user.profile.creator_agreement_accepted_at is not None

        return Response({
            'has_accepted': has_accepted or profile_accepted,
            'accepted_at': request.user.profile.creator_agreement_accepted_at.isoformat()
                if hasattr(request.user, 'profile') and request.user.profile.creator_agreement_accepted_at
                else None,
            'version': request.user.profile.creator_agreement_version
                if hasattr(request.user, 'profile')
                else None,
        })
