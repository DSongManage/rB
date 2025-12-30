"""
Cleanup duplicate comic issues and consolidate pages.
"""

from django.core.management.base import BaseCommand
from django.db import transaction, connection
from rb_core.models import ComicPage, ComicIssue, CollaborativeProject


class Command(BaseCommand):
    help = 'Cleanup duplicate comic issues and consolidate pages'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made\n'))

        projects = CollaborativeProject.objects.filter(content_type='comic')

        for project in projects:
            self.stdout.write(f'\n=== Processing "{project.title}" (ID: {project.id}) ===')

            issues = list(ComicIssue.objects.filter(project=project).order_by('id'))

            if len(issues) == 0:
                self.stdout.write('  No issues found, skipping')
                continue

            if len(issues) == 1:
                self.stdout.write('  Only 1 issue, just cleaning up pages')
                issue = issues[0]
                if not dry_run:
                    # Clear project_id from all pages with this issue
                    ComicPage.objects.filter(issue=issue).update(project=None)
                self.stdout.write(f'    Cleared project_id from pages')
                continue

            # Multiple issues - keep first one, consolidate rest
            keep_issue = issues[0]
            self.stdout.write(f'  Keeping Issue #{keep_issue.issue_number}: "{keep_issue.title}" (ID: {keep_issue.id})')

            with transaction.atomic():
                # Collect all pages from all issues
                all_pages = []
                for issue in issues:
                    pages = list(issue.issue_pages.all())
                    all_pages.extend(pages)
                    self.stdout.write(f'    Issue {issue.id} has {len(pages)} pages')

                # Also get pages directly on project
                project_pages = list(ComicPage.objects.filter(project=project, issue__isnull=True))
                all_pages.extend(project_pages)
                if project_pages:
                    self.stdout.write(f'    Project has {len(project_pages)} orphan pages')

                # Remove duplicates (by page ID)
                seen_ids = set()
                unique_pages = []
                for page in all_pages:
                    if page.id not in seen_ids:
                        seen_ids.add(page.id)
                        unique_pages.append(page)

                self.stdout.write(f'  Total unique pages: {len(unique_pages)}')

                # Sort by original page number and reassign
                unique_pages.sort(key=lambda p: (p.page_number, p.id))

                if not dry_run:
                    # Step 1: Use raw SQL to set all page_numbers to high values (avoid constraint)
                    page_ids = [p.id for p in unique_pages]
                    if page_ids:
                        with connection.cursor() as cursor:
                            # Temporarily set page_numbers to high values to avoid conflicts
                            placeholders = ','.join(['%s'] * len(page_ids))
                            cursor.execute(
                                f"UPDATE rb_core_comicpage SET page_number = 10000 + id WHERE id IN ({placeholders})",
                                page_ids
                            )
                            # Now update all pages to the target issue and clear project
                            cursor.execute(
                                f"UPDATE rb_core_comicpage SET issue_id = %s, project_id = NULL WHERE id IN ({placeholders})",
                                [keep_issue.id] + page_ids
                            )

                        # Step 2: Now assign sequential page numbers
                        for i, page in enumerate(unique_pages, start=1):
                            ComicPage.objects.filter(id=page.id).update(page_number=i)
                            self.stdout.write(f'    Page {page.id} -> Issue {keep_issue.id}, page_number={i}')
                else:
                    for i, page in enumerate(unique_pages, start=1):
                        self.stdout.write(f'    Page {page.id} -> Issue {keep_issue.id}, page_number={i}')

                # Delete other issues
                issues_to_delete = issues[1:]
                self.stdout.write(f'  Deleting {len(issues_to_delete)} duplicate issues')
                for issue in issues_to_delete:
                    if not dry_run:
                        issue.delete()
                    self.stdout.write(f'    Deleted issue {issue.id}')

                # Rename kept issue
                if not dry_run:
                    keep_issue.title = 'Issue #1'
                    keep_issue.issue_number = 1
                    keep_issue.save()
                self.stdout.write(f'  Renamed kept issue to "Issue #1"')

        self.stdout.write(self.style.SUCCESS('\nCleanup complete!'))
