"""
Management command to fix orphaned comic pages.
Assigns pages that have project_id but no issue_id to Issue #1 of their project.
"""

from django.core.management.base import BaseCommand
from rb_core.models import ComicPage, ComicIssue


class Command(BaseCommand):
    help = 'Fix orphaned comic pages by assigning them to Issue #1 of their project'

    def handle(self, *args, **options):
        # Find pages with project but no issue
        orphan_pages = ComicPage.objects.filter(
            project__isnull=False,
            issue__isnull=True
        )
        
        self.stdout.write(f'Found {orphan_pages.count()} orphaned pages')
        
        fixed_count = 0
        for page in orphan_pages:
            project = page.project
            
            # Find or create Issue #1 for this project
            issue, created = ComicIssue.objects.get_or_create(
                project=project,
                issue_number=1,
                defaults={
                    'title': 'Issue #1',
                    'synopsis': '',
                }
            )
            
            if created:
                self.stdout.write(f'  Created Issue #1 for project "{project.title}"')
            
            # Assign page to issue
            page.issue = issue
            page.project = None  # Clear project FK to avoid unique constraint issues
            page.save()
            fixed_count += 1
            self.stdout.write(f'  Assigned page {page.page_number} to Issue #1 of "{project.title}"')
        
        self.stdout.write(self.style.SUCCESS(f'Fixed {fixed_count} orphaned pages'))
