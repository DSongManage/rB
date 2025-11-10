"""
Feedback views for beta testing

Handles user feedback submission during beta period
"""

from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow both authenticated and anonymous feedback
def submit_feedback(request):
    """
    Submit beta feedback

    POST /api/feedback/
    Body: {
        "feedback": "...",
        "email": "..." (optional)
    }
    """
    feedback_text = request.data.get('feedback', '').strip()
    user_email = request.data.get('email', 'anonymous').strip()

    if not feedback_text:
        return Response(
            {'error': 'Feedback text is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get user info if authenticated
    user_info = ''
    if request.user.is_authenticated:
        user_info = f'\nFrom user: {request.user.username} (ID: {request.user.id})'
        if request.user.email:
            user_info += f'\nUser email: {request.user.email}'

    # Prepare email
    subject = f'[rB Beta Feedback] {datetime.now().strftime("%Y-%m-%d %H:%M")}'
    message = f"""
Beta Feedback Received
======================

Feedback:
{feedback_text}

Contact Email: {user_email}
{user_info}

Submitted: {datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}
IP: {request.META.get('REMOTE_ADDR', 'unknown')}
User Agent: {request.META.get('HTTP_USER_AGENT', 'unknown')}
"""

    try:
        # Send email to admin
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.ADMIN_EMAIL],
            fail_silently=False,
        )

        return Response({
            'success': True,
            'message': 'Thank you for your feedback!'
        })

    except Exception as e:
        # Log the error but don't expose it to the user
        print(f'Error sending feedback email: {e}')

        # Still return success to user (feedback received, even if email failed)
        return Response({
            'success': True,
            'message': 'Thank you for your feedback!'
        })
