"""
Beta access management views.

Handles beta access requests, invite code validation, and approval workflow.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
import logging

from ..models import BetaInvite, User as CoreUser, UserProfile
from ..serializers import BetaInviteSerializer
from rest_framework.permissions import IsAuthenticated

signer = TimestampSigner(salt='beta-quick-approve')

logger = logging.getLogger(__name__)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def request_beta_access(request):
    """
    Public endpoint for requesting beta access.

    Accepts email and optional message. Creates a beta request record
    and notifies admin for approval.
    """
    email = request.data.get('email', '').lower().strip()
    message = request.data.get('message', '').strip()

    # Validate email
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if already requested
    if BetaInvite.objects.filter(email=email).exists():
        existing = BetaInvite.objects.get(email=email)
        if existing.status == 'used':
            return Response(
                {'error': 'This email already has an account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {'error': 'You have already requested beta access. Check your email for an invite!'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create beta request
    beta_invite = BetaInvite.objects.create(
        email=email,
        message=message,
        status='requested'
    )

    # Notify admin about new request (with one-click approve link)
    try:
        admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@example.com')
        token = signer.sign(str(beta_invite.id))
        approve_url = f'{settings.BACKEND_URL}/api/beta/quick-approve/{token}/'
        send_mail(
            subject=f'[renaissBlock] New Beta Access Request - {email}',
            message=f'''New beta access request received:

Email: {email}
Message: {message or "(No message provided)"}
Date: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}

==> ONE-CLICK APPROVE:
{approve_url}

Or manage in Django admin:
{settings.BACKEND_URL}/admin/rb_core/betainvite/{beta_invite.id}/change/
''',
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@renaissblock.com'),
            recipient_list=[admin_email],
            fail_silently=False
        )
        logger.info(f'Beta access requested by {email}, admin notified at {admin_email}')
    except Exception as e:
        logger.error(f'Failed to send admin notification for {email}: {e}', exc_info=True)

    return Response({
        'success': True,
        'message': 'Beta access requested! We\'ll review your request and send an invite if approved.'
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def approve_beta_request(request):
    """
    Admin endpoint to approve and send beta invite.

    Requires admin authentication. Generates invite code and sends email.
    """
    invite_id = request.data.get('invite_id')

    if not invite_id:
        return Response(
            {'error': 'invite_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        beta_invite = BetaInvite.objects.get(id=invite_id, status='requested')

        # Generate invite code
        beta_invite.generate_invite_code()
        beta_invite.status = 'approved'
        beta_invite.invited_by = request.user
        beta_invite.save()

        # Send invite email
        send_beta_invite_email(beta_invite)

        logger.info(f'Beta invite approved and sent to {beta_invite.email} by {request.user.username}')

        return Response({
            'success': True,
            'invite_code': beta_invite.invite_code,
            'email': beta_invite.email
        }, status=status.HTTP_200_OK)

    except BetaInvite.DoesNotExist:
        return Response(
            {'error': 'Beta request not found or already processed'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f'Error approving beta request: {e}')
        return Response(
            {'error': 'Failed to approve beta request'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@require_GET
def quick_approve_beta(request, token):
    """
    One-click beta approval via signed URL sent in admin notification email.

    The token is a TimestampSigner-signed invite ID, valid for 7 days.
    No login required — the signed token IS the authorization.
    """
    try:
        invite_id = signer.unsign(token, max_age=60 * 60 * 24 * 7)  # 7 days
    except SignatureExpired:
        return HttpResponse(
            '<h2>Link expired</h2><p>This approval link has expired (7-day limit). '
            'Please approve via the <a href="{}/admin/rb_core/betainvite/">Django admin</a>.</p>'.format(
                settings.BACKEND_URL
            ),
            content_type='text/html', status=410,
        )
    except BadSignature:
        return HttpResponse(
            '<h2>Invalid link</h2><p>This approval link is invalid or has been tampered with.</p>',
            content_type='text/html', status=400,
        )

    try:
        beta_invite = BetaInvite.objects.get(id=invite_id)
    except BetaInvite.DoesNotExist:
        return HttpResponse(
            '<h2>Not found</h2><p>Beta invite request not found.</p>',
            content_type='text/html', status=404,
        )

    # Already processed?
    if beta_invite.status in ('approved', 'sent', 'used'):
        return HttpResponse(
            '<h2>Already processed</h2>'
            '<p>This invite for <b>{email}</b> was already approved '
            '(code: <code>{code}</code>, status: {status}).</p>'.format(
                email=beta_invite.email,
                code=beta_invite.invite_code or 'N/A',
                status=beta_invite.status,
            ),
            content_type='text/html',
        )

    if beta_invite.status == 'declined':
        return HttpResponse(
            '<h2>Declined</h2><p>This invite was previously declined.</p>',
            content_type='text/html', status=409,
        )

    # Approve: generate code and send invite email
    beta_invite.generate_invite_code()
    beta_invite.status = 'approved'
    beta_invite.save()

    try:
        send_beta_invite_email(beta_invite)
        return HttpResponse(
            '<h2>Done!</h2>'
            '<p>Invite sent to <b>{email}</b> (code: <code>{code}</code>).</p>'.format(
                email=beta_invite.email,
                code=beta_invite.invite_code,
            ),
            content_type='text/html',
        )
    except Exception as e:
        logger.error(f'Quick-approve email failed for {beta_invite.email}: {e}')
        return HttpResponse(
            '<h2>Approved but email failed</h2>'
            '<p>Invite for <b>{email}</b> approved (code: <code>{code}</code>), '
            'but the invite email failed to send. Error: {err}</p>'
            '<p>You can resend from <a href="{backend}/admin/rb_core/betainvite/{id}/change/">Django admin</a>.</p>'.format(
                email=beta_invite.email,
                code=beta_invite.invite_code,
                err=str(e),
                backend=settings.BACKEND_URL,
                id=beta_invite.id,
            ),
            content_type='text/html', status=500,
        )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def validate_invite_code(request):
    """
    Validate invite code during signup.

    Public endpoint that checks if an invite code is valid and unused.
    Returns the associated email if valid.
    """
    invite_code = request.data.get('invite_code', '').strip().upper()

    if not invite_code:
        return Response(
            {'valid': False, 'error': 'Invite code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        beta_invite = BetaInvite.objects.get(
            invite_code=invite_code,
            status__in=['approved', 'sent'],
            used_at__isnull=True
        )

        return Response({
            'valid': True,
            'email': beta_invite.email
        }, status=status.HTTP_200_OK)

    except BetaInvite.DoesNotExist:
        return Response({
            'valid': False,
            'error': 'Invalid or expired invite code'
        }, status=status.HTTP_200_OK)  # Return 200 but valid=false


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def mark_invite_used(request):
    """
    Mark an invite code as used after successful signup.

    Should be called by signup endpoint after account creation.
    """
    invite_code = request.data.get('invite_code', '').strip().upper()

    if not invite_code:
        return Response(
            {'error': 'Invite code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        beta_invite = BetaInvite.objects.get(
            invite_code=invite_code,
            status__in=['approved', 'sent'],
            used_at__isnull=True
        )

        beta_invite.status = 'used'
        beta_invite.used_at = timezone.now()
        beta_invite.save()

        logger.info(f'Beta invite {invite_code} marked as used for {beta_invite.email}')

        return Response({
            'success': True
        }, status=status.HTTP_200_OK)

    except BetaInvite.DoesNotExist:
        return Response(
            {'error': 'Invalid invite code'},
            status=status.HTTP_404_NOT_FOUND
        )


def send_beta_invite_email(beta_invite):
    """
    Send professional beta invite email.

    Args:
        beta_invite: BetaInvite instance
    """
    frontend_url = settings.FRONTEND_URL
    invite_url = f'{frontend_url}/signup?invite={beta_invite.invite_code}'

    subject = 'Your renaissBlock beta access is ready'

    message = f'''Hey,

Thanks for signing up — your beta access is ready.

renaissBlock is a marketplace where writers and artists collaborate on comics with automatic revenue sharing. You find a creative partner, agree on a split, publish chapter by chapter, and every sale distributes earnings instantly. No contracts, no chasing payments.

Your access:

Invite Code: {beta_invite.invite_code}
Sign up here: {invite_url}

Your code is valid for 30 days.

What to do first:

Set up your profile — upload your work, list your genres, and mark yourself as open to collaborations if you're looking for a partner. Then browse other creators and see who's on the platform. If someone's style clicks with your vision, send them a project proposal.

A few things to know:

This is a real, working platform — not a demo. Purchases use real money and creators earn real revenue. That said, we're still in beta, so you may run into rough edges. If something breaks or confuses you, I want to hear about it.

Reply directly to this email with any feedback, bugs, or ideas. I read everything.

— F1KAL

P.S. The first 50 creators to complete a project earning $100+ in sales lock in a permanent 1% platform fee (instead of the standard 10%). Forever. You're early enough to claim one of those spots.
'''

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@renaissblock.com'),
            recipient_list=[beta_invite.email],
            fail_silently=False
        )

        beta_invite.status = 'sent'
        beta_invite.save()

        logger.info(f'Beta invite email sent to {beta_invite.email}')

    except Exception as e:
        logger.error(f'Failed to send beta invite email to {beta_invite.email}: {e}')
        # Don't change status if email failed
        raise


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_beta_welcome_seen(request):
    """
    Mark the beta welcome modal as seen for the authenticated user.

    This endpoint is called when a user closes the beta welcome modal,
    ensuring they won't see it again even on different browsers/devices.
    """
    try:
        core_user = CoreUser.objects.get(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(
            user=core_user,
            defaults={'username': request.user.username}
        )

        profile.has_seen_beta_welcome = True
        profile.save(update_fields=['has_seen_beta_welcome'])

        logger.info(f'Beta welcome marked as seen for user {request.user.username}')

        return Response({
            'success': True,
            'has_seen_beta_welcome': True
        }, status=status.HTTP_200_OK)

    except CoreUser.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f'Error marking beta welcome as seen: {e}')
        return Response(
            {'error': 'Failed to update'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
