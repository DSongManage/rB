#!/usr/bin/env python
"""
Beta User Management Script
Manage beta invites, approvals, and user access
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'renaissBlock.settings')

import django
django.setup()

from rb_core.models import BetaInvite
from django.core.mail import send_mail
from django.conf import settings


def send_beta_invite_email(beta_invite):
    """Send beta invite email"""
    subject = 'Welcome to renaissBlock Beta!'
    frontend_url = settings.FRONTEND_URL
    invite_url = f"{frontend_url}/register?code={beta_invite.invite_code}"

    message = f"""
Hello!

You've been invited to join the renaissBlock beta!

Your invite code: {beta_invite.invite_code}

Click here to register: {invite_url}

About renaissBlock:
- Publish and collaborate on books
- Mint your work as NFTs on Solana
- Earn from your creative work

This is a test environment:
- Using Solana devnet (test blockchain)
- Using Stripe test mode (no real payments)

We'd love your feedback! Click the feedback button in the app to share your thoughts.

Welcome aboard!
The renaissBlock Team

---
This is a beta invite. Your feedback will help shape the platform.
"""

    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #8b5cf6;">Welcome to renaissBlock Beta! 🎉</h2>

    <p>You've been invited to join our exclusive beta testing program!</p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Your Invite Code:</h3>
        <p style="font-size: 24px; font-weight: bold; color: #8b5cf6; letter-spacing: 2px;">
            {beta_invite.invite_code}
        </p>
        <a href="{invite_url}"
           style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Register Now
        </a>
    </div>

    <h3>About renaissBlock:</h3>
    <ul>
        <li>📚 Publish and collaborate on books</li>
        <li>🪙 Mint your work as NFTs on Solana</li>
        <li>💰 Earn from your creative work</li>
    </ul>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <strong>⚠️ This is a test environment:</strong>
        <ul style="margin: 10px 0 0 0;">
            <li>Using Solana devnet (test blockchain)</li>
            <li>Using Stripe test mode (no real payments)</li>
        </ul>
    </div>

    <p>We'd love your feedback! Click the feedback button in the app to share your thoughts.</p>

    <p style="margin-top: 30px;">
        Welcome aboard!<br>
        <strong>The renaissBlock Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #6b7280;">
        This is a beta invite. Your feedback will help shape the platform.
    </p>
</body>
</html>
"""

    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [beta_invite.email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f'Error sending email: {e}')
        return False


def approve_and_send_invite(email):
    """Approve beta request and send invite"""
    try:
        beta_invite = BetaInvite.objects.get(email=email, status='requested')
        beta_invite.generate_invite_code()
        beta_invite.status = 'approved'
        beta_invite.save()

        if send_beta_invite_email(beta_invite):
            print(f'✅ Sent invite to {email}')
            print(f'   Code: {beta_invite.invite_code}')
        else:
            print(f'⚠️  Generated code but email failed for {email}')
            print(f'   Code: {beta_invite.invite_code}')
        return beta_invite.invite_code
    except BetaInvite.DoesNotExist:
        print(f'❌ No beta request found for {email}')
        return None


def create_direct_invite(email):
    """Create and send direct invite (skip request step)"""
    if BetaInvite.objects.filter(email=email).exists():
        existing = BetaInvite.objects.get(email=email)
        print(f'⚠️  Invite already exists for {email}')
        print(f'   Status: {existing.status}')
        print(f'   Code: {existing.invite_code or "Not generated"}')
        return existing.invite_code

    beta_invite = BetaInvite.objects.create(
        email=email,
        status='approved'
    )
    beta_invite.generate_invite_code()
    beta_invite.save()

    if send_beta_invite_email(beta_invite):
        print(f'✅ Created and sent direct invite to {email}')
        print(f'   Code: {beta_invite.invite_code}')
    else:
        print(f'⚠️  Generated code but email failed for {email}')
        print(f'   Code: {beta_invite.invite_code}')
    return beta_invite.invite_code


def list_beta_users():
    """List all beta users and their status"""
    invites = BetaInvite.objects.all().order_by('-created_at')
    print(f'\n📊 Total beta invites: {invites.count()}')
    print('=' * 80)

    # Stats
    stats = {
        'requested': invites.filter(status='requested').count(),
        'approved': invites.filter(status='approved').count(),
        'used': invites.filter(status='used').count(),
    }
    print(f"Requested: {stats['requested']} | Approved: {stats['approved']} | Used: {stats['used']}")
    print('=' * 80)

    if invites.count() == 0:
        print('No beta invites yet.')
        return

    print(f"{'Email':<35} {'Status':<12} {'Date':<12} {'Code':<15}")
    print('-' * 80)
    for invite in invites:
        email = invite.email[:32] + '...' if len(invite.email) > 35 else invite.email
        status_emoji = {
            'requested': '📝',
            'approved': '✅',
            'used': '🎉'
        }.get(invite.status, '❓')
        print(f"{email:<35} {status_emoji} {invite.status:<10} {invite.created_at.strftime('%Y-%m-%d'):<12} {invite.invite_code or 'N/A':<15}")


def list_pending_requests():
    """List pending beta requests"""
    pending = BetaInvite.objects.filter(status='requested').order_by('-created_at')
    print(f'\n📬 Pending beta requests: {pending.count()}')
    print('=' * 80)

    if pending.count() == 0:
        print('No pending requests.')
        return

    for invite in pending:
        print(f"\nEmail: {invite.email}")
        print(f"Date: {invite.created_at.strftime('%Y-%m-%d %H:%M')}")
        if invite.message:
            print(f"Message: {invite.message[:100]}...")
        print('-' * 80)


def show_usage():
    """Show usage instructions"""
    print("""
🎯 Beta User Management Tool

Usage:
    python manage_beta.py <command> [arguments]

Commands:
    list                        List all beta invites
    pending                     List pending beta requests
    invite <email>              Create and send direct invite
    approve <email>             Approve pending request and send invite

Examples:
    python manage_beta.py list
    python manage_beta.py pending
    python manage_beta.py invite friend@example.com
    python manage_beta.py approve user@example.com

Notes:
    - Emails are sent via SMTP configured in settings
    - Invite codes are generated automatically
    - Make sure EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are set
""")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        show_usage()
        sys.exit(0)

    command = sys.argv[1]

    if command == 'list':
        list_beta_users()
    elif command == 'pending':
        list_pending_requests()
    elif command == 'invite' and len(sys.argv) == 3:
        email = sys.argv[2]
        create_direct_invite(email)
    elif command == 'approve' and len(sys.argv) == 3:
        email = sys.argv[2]
        approve_and_send_invite(email)
    else:
        show_usage()
        sys.exit(1)
