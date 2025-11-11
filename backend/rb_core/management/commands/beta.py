"""
Django management command for beta user management
Usage: python manage.py beta <command> [arguments]
"""
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from rb_core.models import BetaInvite


class Command(BaseCommand):
    help = 'Manage beta invites and users'

    def add_arguments(self, parser):
        parser.add_argument(
            'action',
            type=str,
            choices=['list', 'pending', 'invite', 'approve', 'stats'],
            help='Action to perform'
        )
        parser.add_argument(
            'email',
            type=str,
            nargs='?',
            help='Email address (for invite/approve actions)'
        )

    def handle(self, *args, **options):
        action = options['action']

        if action == 'list':
            self.list_invites()
        elif action == 'pending':
            self.list_pending()
        elif action == 'stats':
            self.show_stats()
        elif action == 'invite':
            if not options['email']:
                self.stdout.write(self.style.ERROR('Email required for invite command'))
                return
            self.create_invite(options['email'])
        elif action == 'approve':
            if not options['email']:
                self.stdout.write(self.style.ERROR('Email required for approve command'))
                return
            self.approve_request(options['email'])

    def list_invites(self):
        """List all beta invites"""
        invites = BetaInvite.objects.all().order_by('-created_at')

        self.stdout.write(f'\n📊 Total beta invites: {invites.count()}')
        self.stdout.write('=' * 80)

        stats = {
            'requested': invites.filter(status='requested').count(),
            'approved': invites.filter(status='approved').count(),
            'used': invites.filter(status='used').count(),
        }
        self.stdout.write(f"Requested: {stats['requested']} | Approved: {stats['approved']} | Used: {stats['used']}")
        self.stdout.write('=' * 80)

        if invites.count() == 0:
            self.stdout.write('No beta invites yet.')
            return

        self.stdout.write(f"{'Email':<35} {'Status':<12} {'Date':<12} {'Code':<15}")
        self.stdout.write('-' * 80)

        for invite in invites:
            email = invite.email[:32] + '...' if len(invite.email) > 35 else invite.email
            status_display = self.style.SUCCESS(invite.status) if invite.status == 'used' else invite.status
            self.stdout.write(
                f"{email:<35} {status_display:<12} {invite.created_at.strftime('%Y-%m-%d'):<12} {invite.invite_code or 'N/A':<15}"
            )

    def list_pending(self):
        """List pending beta requests"""
        pending = BetaInvite.objects.filter(status='requested').order_by('-created_at')

        self.stdout.write(f'\n📬 Pending beta requests: {pending.count()}')
        self.stdout.write('=' * 80)

        if pending.count() == 0:
            self.stdout.write('No pending requests.')
            return

        for invite in pending:
            self.stdout.write(f"\nEmail: {invite.email}")
            self.stdout.write(f"Date: {invite.created_at.strftime('%Y-%m-%d %H:%M')}")
            if invite.message:
                self.stdout.write(f"Message: {invite.message[:100]}...")
            self.stdout.write('-' * 80)

    def show_stats(self):
        """Show beta statistics"""
        invites = BetaInvite.objects.all()

        stats = {
            'total': invites.count(),
            'requested': invites.filter(status='requested').count(),
            'approved': invites.filter(status='approved').count(),
            'used': invites.filter(status='used').count(),
        }

        self.stdout.write('\n📊 Beta Program Statistics')
        self.stdout.write('=' * 50)
        self.stdout.write(f"Total Invites:     {stats['total']}")
        self.stdout.write(f"Pending Requests:  {stats['requested']}")
        self.stdout.write(f"Approved (unused): {stats['approved']}")
        self.stdout.write(f"Registered Users:  {stats['used']}")
        self.stdout.write('=' * 50)

        if stats['total'] > 0:
            conversion_rate = (stats['used'] / stats['total']) * 100
            self.stdout.write(f"Conversion Rate:   {conversion_rate:.1f}%")

    def create_invite(self, email):
        """Create and send direct invite"""
        if BetaInvite.objects.filter(email=email).exists():
            existing = BetaInvite.objects.get(email=email)
            self.stdout.write(self.style.WARNING(f'Invite already exists for {email}'))
            self.stdout.write(f'Status: {existing.status}')
            self.stdout.write(f'Code: {existing.invite_code or "Not generated"}')
            return

        beta_invite = BetaInvite.objects.create(
            email=email,
            status='approved'
        )
        beta_invite.generate_invite_code()
        beta_invite.save()

        if self.send_invite_email(beta_invite):
            self.stdout.write(self.style.SUCCESS(f'✅ Created and sent direct invite to {email}'))
            self.stdout.write(f'Code: {beta_invite.invite_code}')
        else:
            self.stdout.write(self.style.WARNING(f'⚠️  Generated code but email failed for {email}'))
            self.stdout.write(f'Code: {beta_invite.invite_code}')

    def approve_request(self, email):
        """Approve beta request and send invite"""
        try:
            beta_invite = BetaInvite.objects.get(email=email, status='requested')
            beta_invite.generate_invite_code()
            beta_invite.status = 'approved'
            beta_invite.save()

            if self.send_invite_email(beta_invite):
                self.stdout.write(self.style.SUCCESS(f'✅ Approved and sent invite to {email}'))
                self.stdout.write(f'Code: {beta_invite.invite_code}')
            else:
                self.stdout.write(self.style.WARNING(f'⚠️  Approved but email failed for {email}'))
                self.stdout.write(f'Code: {beta_invite.invite_code}')
        except BetaInvite.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ No pending beta request found for {email}'))

    def send_invite_email(self, beta_invite):
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
            self.stdout.write(self.style.ERROR(f'Error sending email: {e}'))
            return False
