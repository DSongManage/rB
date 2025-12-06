"""
Management command to clean up orphaned Content and empty BookProjects.

Orphaned Content: Content where both source_chapter and source_book_project are null
(the original chapter/book was deleted but Content remains due to purchases or other constraints)

Empty BookProjects: BookProjects with no chapters (all chapters were removed)
"""
from django.core.management.base import BaseCommand
from django.db.models import Q, Count
from django.utils import timezone
from django.db.models.deletion import ProtectedError
from rb_core.models import Content, BookProject, Chapter


class Command(BaseCommand):
    help = 'Clean up orphaned Content objects and empty BookProjects'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting cleanup of orphaned content and empty book projects...\n'))

        # Find orphaned Content (both source_chapter and source_book_project are null)
        orphaned_content = Content.objects.filter(
            source_chapter__isnull=True,
            source_book_project__isnull=True
        )

        self.stdout.write(f"Found {orphaned_content.count()} orphaned Content objects")

        for content in orphaned_content:
            self.stdout.write(f"  - Content {content.id}: {content.title} (status: {content.inventory_status})")

            # Delist orphaned content (don't delete in case there are purchases)
            content.is_listed = False
            content.delisted_at = timezone.now()
            content.delisted_reason = "Orphaned content - source chapter/book was deleted"
            content.save()
            self.stdout.write(self.style.SUCCESS(f"    -> Delisted"))

        # Find empty BookProjects (no chapters)
        empty_projects = BookProject.objects.annotate(
            chapter_count=Count('chapters')
        ).filter(chapter_count=0)

        self.stdout.write(f"\nFound {empty_projects.count()} empty BookProjects")

        for project in empty_projects:
            self.stdout.write(f"  - Project {project.id}: {project.title}")

            # Try to delete the book's published content if it exists
            if project.published_content:
                try:
                    content_id = project.published_content.id
                    project.published_content.delete()
                    self.stdout.write(self.style.SUCCESS(f"    -> Deleted published content {content_id}"))
                except ProtectedError as e:
                    # If can't delete (has purchases), delist instead
                    self.stdout.write(self.style.WARNING(
                        f"    -> Cannot delete content {project.published_content.id} (has purchases), delisting instead"
                    ))
                    project.published_content.is_listed = False
                    project.published_content.delisted_at = timezone.now()
                    project.published_content.delisted_reason = "Book project removed (no chapters)"
                    project.published_content.save()

            # Delete the empty project
            project_id = project.id
            project.delete()
            self.stdout.write(self.style.SUCCESS(f"    -> Deleted project {project_id}"))

        self.stdout.write(self.style.SUCCESS('\nCleanup complete!'))
