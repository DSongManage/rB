"""
Create a test superuser for PR preview environments.

This command only runs in non-production environments (DEBUG=True or
RAILWAY_ENVIRONMENT != 'production').
"""

import os
from django.core.management.base import BaseCommand
from django.conf import settings
from rb_core.models import User


class Command(BaseCommand):
    help = "Create a test superuser for PR preview environments (non-production only)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force creation even if environment checks would normally prevent it',
        )

    def handle(self, *args, **options):
        # Safety check: Only run in non-production environments
        is_production = (
            os.getenv('RAILWAY_ENVIRONMENT') == 'production' or
            os.getenv('ENVIRONMENT') == 'production'
        )
        is_debug = settings.DEBUG

        if is_production and not options['force']:
            self.stderr.write(
                self.style.ERROR(
                    'Refusing to create test superuser in production environment. '
                    'Use --force to override (not recommended).'
                )
            )
            return

        if not is_debug and not options['force']:
            self.stdout.write(
                self.style.WARNING(
                    'DEBUG is False. Creating test superuser anyway for PR preview.'
                )
            )

        # Test superuser credentials
        username = 'testadmin'
        email = 'test@test.com'
        password = 'testpass123'

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            # Update password in case it changed
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Test superuser "{username}" already exists. Password updated.'
                )
            )
        else:
            # Create new superuser
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Test superuser created:\n'
                    f'  Username: {username}\n'
                    f'  Email: {email}\n'
                    f'  Password: {password}'
                )
            )

        self.stdout.write(
            self.style.WARNING(
                '\n⚠️  This user is for testing only. '
                'Do not use these credentials in production!'
            )
        )
