"""
Management command to fix is_published status for comic issues
where the parent project is minted but the issue wasn't marked as published.
"""
from django.core.management.base import BaseCommand
from rb_core.models import CollaborativeProject, ComicIssue


class Command(BaseCommand):
    help = 'Fix is_published for comic issues of minted projects'

    def handle(self, *args, **options):
        # Find all minted comic projects
        minted_projects = CollaborativeProject.objects.filter(
            content_type='comic',
            status='minted'
        )

        fixed_count = 0
        for project in minted_projects:
            self.stdout.write(f'\nChecking project: {project.title} (ID: {project.id})')
            self.stdout.write(f'  Project published_content: {project.published_content_id}')

            # Get issues for this project that aren't marked as published
            issues = ComicIssue.objects.filter(
                project=project,
                is_published=False
            )

            for issue in issues:
                self.stdout.write(f'  Issue: {issue.title} (ID: {issue.id})')
                self.stdout.write(f'    Issue published_content: {issue.published_content_id}')

                # If project is minted, mark the first issue as published
                # Copy published_content from project if issue doesn't have it
                if issue.issue_number == 1:
                    if not issue.published_content and project.published_content:
                        issue.published_content = project.published_content
                        self.stdout.write(
                            self.style.WARNING(
                                f'    Copied published_content {project.published_content_id} from project to issue'
                            )
                        )

                    issue.is_published = True
                    issue.save()
                    fixed_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'    Fixed: is_published = True'
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(f'\nTotal issues fixed: {fixed_count}')
        )
