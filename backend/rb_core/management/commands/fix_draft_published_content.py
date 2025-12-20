"""
Fix published chapters/books whose content is still marked as draft.

This fixes a bug where the doMint function wasn't passing content_id,
so content was never updated from 'draft' to 'minted' status.

Usage: python manage.py fix_draft_published_content
"""

from django.core.management.base import BaseCommand
from rb_core.models import Content, Chapter, BookProject


class Command(BaseCommand):
    help = 'Fix published chapters/books whose content is still marked as draft'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        fixed_count = 0

        # Fix chapters that are published but content is draft
        chapters = Chapter.objects.filter(
            is_published=True,
            published_content__inventory_status='draft'
        ).select_related('published_content')

        for chapter in chapters:
            content = chapter.published_content
            self.stdout.write(
                f"Chapter '{chapter.title}' (ID: {chapter.id}) -> "
                f"Content '{content.title}' (ID: {content.id}) is draft"
            )
            if not dry_run:
                content.inventory_status = 'minted'
                content.save()
                self.stdout.write(self.style.SUCCESS(f"  -> Fixed: now 'minted'"))
            fixed_count += 1

        # Fix book projects that are published but content is draft
        projects = BookProject.objects.filter(
            is_published=True,
            published_content__inventory_status='draft'
        ).select_related('published_content')

        for project in projects:
            content = project.published_content
            self.stdout.write(
                f"Book '{project.title}' (ID: {project.id}) -> "
                f"Content '{content.title}' (ID: {content.id}) is draft"
            )
            if not dry_run:
                content.inventory_status = 'minted'
                content.save()
                self.stdout.write(self.style.SUCCESS(f"  -> Fixed: now 'minted'"))
            fixed_count += 1

        if fixed_count == 0:
            self.stdout.write(self.style.SUCCESS("No draft content found that needs fixing."))
        elif dry_run:
            self.stdout.write(
                self.style.WARNING(f"\nDry run: {fixed_count} item(s) would be fixed. "
                                   f"Run without --dry-run to apply changes.")
            )
        else:
            self.stdout.write(self.style.SUCCESS(f"\nFixed {fixed_count} item(s)."))
