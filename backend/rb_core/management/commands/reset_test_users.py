"""
Management command to reset test users for development
Usage: python manage.py reset_test_users
"""
from django.core.management.base import BaseCommand
from rb_core.models import User, UserProfile


class Command(BaseCommand):
    help = 'Reset test users (Web3Auth accounts and auto-generated usernames)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Reset specific username (e.g., Learn6)',
        )
        parser.add_argument(
            '--all-web3auth',
            action='store_true',
            help='Reset all Web3Auth linked accounts',
        )

    def handle(self, *args, **options):
        if options['username']:
            # Reset specific user
            try:
                user = User.objects.get(username=options['username'])
                profile = UserProfile.objects.get(user=user)
                self.stdout.write(f"Deleting user: {user.username}")
                self.stdout.write(f"  - Wallet: {profile.wallet_address}")
                self.stdout.write(f"  - Web3Auth Sub: {profile.web3auth_sub}")
                user.delete()
                self.stdout.write(self.style.SUCCESS(f'✅ Deleted {options["username"]}'))
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'❌ User {options["username"]} not found'))
            except UserProfile.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'⚠️ User has no profile, deleting anyway'))
                user.delete()
                
        elif options['all_web3auth']:
            # Reset all Web3Auth users
            profiles = UserProfile.objects.filter(web3auth_sub__isnull=False)
            count = profiles.count()
            self.stdout.write(f"Found {count} Web3Auth profiles:")
            for p in profiles:
                self.stdout.write(f"  - @{p.user.username} ({p.wallet_address[:8]}...)")
            
            if count > 0:
                confirm = input(f"\n🗑️  Delete all {count} Web3Auth users? (yes/no): ")
                if confirm.lower() == 'yes':
                    for p in profiles:
                        p.user.delete()
                    self.stdout.write(self.style.SUCCESS(f'✅ Deleted {count} Web3Auth users'))
                else:
                    self.stdout.write('Cancelled')
        else:
            # Default: show stats
            web3_count = UserProfile.objects.filter(web3auth_sub__isnull=False).count()
            auto_count = User.objects.filter(username__startswith='renaiss').count()
            
            self.stdout.write("📊 Test User Stats:")
            self.stdout.write(f"  - Web3Auth users: {web3_count}")
            self.stdout.write(f"  - Auto-generated (@renaiss*): {auto_count}")
            self.stdout.write("\nUsage:")
            self.stdout.write("  python manage.py reset_test_users --username Learn6")
            self.stdout.write("  python manage.py reset_test_users --all-web3auth")

