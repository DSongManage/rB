"""
Beta access management views.

Handles beta access requests, invite code validation, and approval workflow.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import logging

from ..models import BetaInvite
from ..serializers import BetaInviteSerializer

logger = logging.getLogger(__name__)


@api_view(['POST'])
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

    # Notify admin about new request
    try:
        admin_email = settings.ADMIN_EMAIL if hasattr(settings, 'ADMIN_EMAIL') else 'admin@example.com'
        send_mail(
            subject=f'[renaissBlock] New Beta Access Request - {email}',
            message=f'''New beta access request received:

Email: {email}
Message: {message or "(No message provided)"}
Date: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}

To approve this request:
1. Log in to Django admin: {settings.BACKEND_URL}/admin/
2. Navigate to Beta Invites
3. Select the request and use "Approve and send invites" action

Or approve via API:
POST {settings.BACKEND_URL}/api/beta/approve/
{{
    "invite_id": {beta_invite.id}
}}
''',
            from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@renaissblock.com',
            recipient_list=[admin_email],
            fail_silently=True
        )
        logger.info(f'Beta access requested by {email}')
    except Exception as e:
        logger.error(f'Failed to send admin notification: {e}')

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


@api_view(['POST'])
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

    subject = '🎨 Welcome to renaissBlock Beta!'

    message = f'''Hi there!

Welcome to the future of creative collaboration!

You're one of the first people to experience renaissBlock - the world's first platform where creators can collaborate and automatically split revenue using blockchain technology.

🚀 Your Beta Access:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website: {frontend_url}
Invite Code: {beta_invite.invite_code}
Direct Link: {invite_url}
Valid for 30 days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 What to Try:
• Create content (book chapter, artwork, music)
• Test the purchase flow (use test card: 4242 4242 4242 4242)
• Try collaborating with other beta users
• Browse and discover content

⚠️ Beta Notes:
• This is test mode - no real money charged
• Blockchain features use fake SOL (devnet)
• Some features still being polished
• Your feedback is incredibly valuable!

🗣️ Share Your Thoughts:
Found a bug? Love a feature? Confused by something?
Email us at feedback@renaissblock.com

Thanks for being an early explorer!

The renaissBlock Team

P.S. As a beta tester, you'll get special perks when we launch!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
renaissBlock - The Future of Creative Collaboration
{frontend_url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
'''

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'beta@renaissblock.com',
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
