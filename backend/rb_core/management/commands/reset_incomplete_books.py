"""
Management command to reset incomplete book publications.
These are books where is_published=True but the Content object has no price set.
"""
from django.core.management.base import BaseCommand
from rb_core.models import BookProject, Content


class Command(BaseCommand):
    help = 'Reset incomplete book publications (published but without price/proper minting)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--usernames',
            nargs='+',
            help='Only process books for these usernames',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        usernames = options.get('usernames')

        # Find published books where the Content has no price set (incomplete publish)
        query = BookProject.objects.filter(
            is_published=True,
            published_content__isnull=False
        )

        if usernames:
            query = query.filter(creator__username__in=usernames)

        incomplete_books = []
        for book in query:
            content = book.published_content
            # Check if content is incomplete (no price, or price is 0/None)
            if content and (content.price_usd is None or content.price_usd == 0):
                incomplete_books.append((book, content))

        self.stdout.write(f"Found {len(incomplete_books)} incomplete book publications")

        for book, content in incomplete_books:
            self.stdout.write(f"  - {book.title} by {book.creator.username} (Content ID: {content.id})")

            if not dry_run:
                # Reset the book project
                book.is_published = False
                book.published_content = None
                book.save()
                self.stdout.write(f"    -> Reset book project")

                # Delete the orphaned content
                content.delete()
                self.stdout.write(f"    -> Deleted orphaned content")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run - no changes made. Run without --dry-run to apply."))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nReset {len(incomplete_books)} incomplete book publications"))
