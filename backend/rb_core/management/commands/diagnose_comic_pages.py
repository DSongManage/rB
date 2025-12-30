"""
Diagnostic command to check comic page and issue assignments.
"""

from django.core.management.base import BaseCommand
from rb_core.models import ComicPage, ComicIssue, CollaborativeProject


class Command(BaseCommand):
    help = 'Diagnose comic page and issue assignments'

    def handle(self, *args, **options):
        self.stdout.write('\n=== Comic Projects ===')
        projects = CollaborativeProject.objects.filter(content_type='comic')
        for project in projects:
            self.stdout.write(f'\nProject: "{project.title}" (ID: {project.id})')
            
            # Check issues for this project
            issues = ComicIssue.objects.filter(project=project)
            self.stdout.write(f'  Issues: {issues.count()}')
            for issue in issues:
                page_count = issue.issue_pages.count()
                self.stdout.write(f'    - Issue #{issue.issue_number}: "{issue.title}" (ID: {issue.id}) - {page_count} pages')
            
            # Check pages directly on project (not via issue)
            direct_pages = ComicPage.objects.filter(project=project)
            self.stdout.write(f'  Pages with project_id={project.id}: {direct_pages.count()}')
            for page in direct_pages[:5]:  # Show first 5
                self.stdout.write(f'    - Page {page.page_number} (ID: {page.id}, issue_id: {page.issue_id})')
        
        self.stdout.write('\n=== Orphan Analysis ===')
        # Pages with project but no issue
        orphan_project = ComicPage.objects.filter(project__isnull=False, issue__isnull=True).count()
        self.stdout.write(f'Pages with project but NO issue: {orphan_project}')
        
        # Pages with issue but no project  
        orphan_issue = ComicPage.objects.filter(project__isnull=True, issue__isnull=False).count()
        self.stdout.write(f'Pages with issue but NO project: {orphan_issue}')
        
        # Pages with BOTH project and issue
        both = ComicPage.objects.filter(project__isnull=False, issue__isnull=False).count()
        self.stdout.write(f'Pages with BOTH project AND issue: {both}')
        
        # Pages with neither
        neither = ComicPage.objects.filter(project__isnull=True, issue__isnull=True).count()
        self.stdout.write(f'Pages with NEITHER project nor issue: {neither}')
        
        self.stdout.write('')
