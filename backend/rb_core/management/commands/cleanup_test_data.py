"""
Django management command to delete all non-admin users and their content.
Preserves the admin/superuser account.

Usage: python manage.py cleanup_test_data
"""
from django.core.management.base import BaseCommand
from rb_core.models import User, Content, UserProfile, Collaboration


class Command(BaseCommand):
    help = 'Delete all non-admin users and their associated content'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion without prompting',
        )

    def handle(self, *args, **options):
        # Get all non-superuser users
        non_admin_users = User.objects.filter(is_superuser=False)
        user_count = non_admin_users.count()
        
        if user_count == 0:
            self.stdout.write(self.style.SUCCESS('No non-admin users to delete.'))
            return

        # Get content count before deletion
        content_ids = list(Content.objects.filter(creator__in=non_admin_users).values_list('id', flat=True))
        content_count = len(content_ids)
        
        # Show what will be deleted
        self.stdout.write(self.style.WARNING(f'\nThis will delete:'))
        self.stdout.write(f'  - {user_count} non-admin users')
        self.stdout.write(f'  - {content_count} content items')
        self.stdout.write(f'  - Associated profiles, collaborations, and notifications')
        
        # List admin users that will be preserved
        admin_users = User.objects.filter(is_superuser=True)
        self.stdout.write(self.style.SUCCESS(f'\nPreserving {admin_users.count()} admin user(s):'))
        for admin in admin_users:
            self.stdout.write(f'  - {admin.username} (ID: {admin.id})')

        # Confirm deletion
        if not options['confirm']:
            confirm = input('\nType "yes" to confirm deletion: ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.ERROR('Deletion cancelled.'))
                return

        # Delete content first (cascade will handle related objects)
        deleted_content = Content.objects.filter(id__in=content_ids).delete()
        self.stdout.write(self.style.SUCCESS(f'✓ Deleted {deleted_content[0]} content items'))

        # Delete collaborations
        deleted_collabs = Collaboration.objects.filter(
            initiators__in=non_admin_users
        ).delete()
        self.stdout.write(self.style.SUCCESS(f'✓ Deleted {deleted_collabs[0]} collaborations'))

        # Delete user profiles
        deleted_profiles = UserProfile.objects.filter(user__in=non_admin_users).delete()
        self.stdout.write(self.style.SUCCESS(f'✓ Deleted {deleted_profiles[0]} user profiles'))

        # Delete users (this will cascade to remaining related objects)
        deleted_users = non_admin_users.delete()
        self.stdout.write(self.style.SUCCESS(f'✓ Deleted {deleted_users[0]} users'))

        self.stdout.write(self.style.SUCCESS('\n✅ Cleanup complete!'))
        
        # Show remaining data
        remaining_users = User.objects.count()
        remaining_content = Content.objects.count()
        self.stdout.write(f'\nRemaining in database:')
        self.stdout.write(f'  - {remaining_users} users (admin only)')
        self.stdout.write(f'  - {remaining_content} content items')

