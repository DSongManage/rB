"""
Seed database with realistic test data for development and demo.

Usage:
    python manage.py seed_data          # Full seed (100+ users, 200+ content)
    python manage.py seed_data --small  # Small seed (10 users, 20 content)
    python manage.py seed_data --clear  # Only clear test data, don't reseed

Test data is identified by username prefix 'test_' for easy cleanup.
"""

import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from faker import Faker

from rb_core.models import (
    User, UserProfile, Content, Tag, BookProject, Chapter, Series,
    Purchase, Follow, ContentLike, ContentRating, CreatorReview,
)


fake = Faker()

# Realistic content data
BOOK_TITLES = [
    "The Last Algorithm", "Echoes of Tomorrow", "Neon Dreams", "The Forgotten Kingdom",
    "Whispers in the Dark", "Beyond the Horizon", "The Crystal Prophecy", "Shadow's Edge",
    "The Time Weaver", "Secrets of the Abyss", "The Iron Phoenix", "Moonlit Deception",
    "The Quantum Garden", "Eternal Winter", "The Lost Chronicler", "Starfall Legacy",
    "The Crimson Mask", "Beneath the Surface", "The Silent Storm", "Obsidian Heart",
    "The Wanderer's Path", "Digital Souls", "The Emerald Throne", "Fractured Realms",
    "The Clockwork Prince", "Void Walker", "The Sapphire Curse", "Burning Skies",
    "The Memory Thief", "Tides of Fate", "The Glass Tower", "Phantom Protocol",
    "The Scarlet Dawn", "Frozen Echoes", "The Last Sanctuary", "Cosmic Drift",
    "The Bone Oracle", "Silent Rebellion", "The Golden Serpent", "Ash and Thunder",
]

CHAPTER_TITLES = [
    "The Beginning", "First Steps", "Into the Unknown", "The Discovery", "Rising Tension",
    "Dark Revelations", "The Turning Point", "New Alliances", "Shadows Gather", "The Test",
    "Unexpected Allies", "Crossing the Threshold", "The Price of Power", "Hidden Truths",
    "The Confrontation", "Shattered Illusions", "The Long Night", "Dawn Approaches",
    "The Final Stand", "Resolution", "Epilogue", "A New Beginning",
]

GENRES = ['fantasy', 'scifi', 'drama', 'comedy', 'nonfiction', 'other']
CONTENT_TYPES = ['book', 'comic', 'art']

BIOS = [
    "Award-winning author exploring the boundaries of imagination.",
    "Storyteller by day, dreamer by night. Writing worlds you'll want to live in.",
    "Former journalist turned fiction writer. Every story has a hidden truth.",
    "Creating adventures one chapter at a time. Coffee enthusiast.",
    "Visual storyteller blending art and narrative into immersive experiences.",
    "Indie creator passionate about bringing diverse stories to life.",
    "Writing the stories I wished I could read as a kid.",
    "Crafting tales that challenge, inspire, and entertain.",
    "Artist and writer building worlds from scratch.",
    "Believer in the power of stories to change perspectives.",
]

ROLES = [
    ['author'], ['author', 'editor'], ['artist'], ['author', 'artist'],
    ['colorist'], ['letterer'], ['writer', 'illustrator'], ['comic_creator'],
]

SKILLS = [
    ['creative writing', 'world building', 'character development'],
    ['illustration', 'digital art', 'concept art'],
    ['storytelling', 'dialogue', 'pacing'],
    ['manga art', 'panel composition', 'action sequences'],
    ['watercolor', 'oil painting', 'mixed media'],
    ['editing', 'proofreading', 'critique'],
]

LOCATIONS = [
    "New York, USA", "Los Angeles, USA", "London, UK", "Tokyo, Japan",
    "Berlin, Germany", "Paris, France", "Toronto, Canada", "Sydney, Australia",
    "Seoul, South Korea", "Amsterdam, Netherlands", "Barcelona, Spain",
    "Singapore", "Melbourne, Australia", "San Francisco, USA", "Chicago, USA",
]

STATUSES = ['Available', 'Open to Offers', 'Selective', 'Booked', 'Unavailable']


class Command(BaseCommand):
    help = 'Seed database with realistic test data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--small',
            action='store_true',
            help='Create small dataset (10 users, 20 content)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Only clear test data without reseeding',
        )

    def handle(self, *args, **options):
        small = options['small']
        clear_only = options['clear']

        self.stdout.write(self.style.WARNING('Clearing existing test data...'))
        self._clear_test_data()

        if clear_only:
            self.stdout.write(self.style.SUCCESS('Test data cleared. No reseeding.'))
            return

        if small:
            num_users = 10
            num_content_per_user = 2
            num_follows = 30
            num_purchases = 20
            num_likes = 50
            num_ratings = 30
            num_creator_reviews = 15
        else:
            num_users = 120
            num_content_per_user = 2  # ~240 content items
            num_follows = 500
            num_purchases = 300
            num_likes = 800
            num_ratings = 400
            num_creator_reviews = 200

        with transaction.atomic():
            self.stdout.write('Creating tags...')
            tags = self._create_tags()

            self.stdout.write(f'Creating {num_users} users with profiles...')
            users = self._create_users(num_users)

            self.stdout.write(f'Creating content for each user...')
            all_content = self._create_content(users, tags, num_content_per_user)

            self.stdout.write(f'Creating {num_follows} follow relationships...')
            self._create_follows(users, num_follows)

            self.stdout.write(f'Creating {num_purchases} purchases...')
            self._create_purchases(users, all_content, num_purchases)

            self.stdout.write(f'Creating {num_likes} likes...')
            self._create_likes(users, all_content, num_likes)

            self.stdout.write(f'Creating {num_ratings} ratings...')
            self._create_ratings(users, all_content, num_ratings)

            self.stdout.write(f'Creating {num_creator_reviews} creator reviews...')
            self._create_creator_reviews(users, num_creator_reviews)

        self.stdout.write(self.style.SUCCESS(
            f'\nSeed complete!\n'
            f'  - {num_users} users\n'
            f'  - {len(all_content)} content items\n'
            f'  - {num_follows} follows\n'
            f'  - {num_purchases} purchases\n'
            f'  - {num_likes} likes\n'
            f'  - {num_ratings} ratings\n'
            f'  - {num_creator_reviews} creator reviews'
        ))

    def _clear_test_data(self):
        """Clear all test data (identified by test_ prefix)."""
        # Delete in order to respect foreign key constraints
        test_users = User.objects.filter(username__startswith='test_')

        # Delete related data
        ContentLike.objects.filter(user__in=test_users).delete()
        ContentRating.objects.filter(user__in=test_users).delete()
        CreatorReview.objects.filter(reviewer__in=test_users).delete()
        CreatorReview.objects.filter(creator__in=test_users).delete()
        Follow.objects.filter(follower__in=test_users).delete()
        Follow.objects.filter(following__in=test_users).delete()
        Purchase.objects.filter(user__in=test_users).delete()

        # Delete content created by test users
        Content.objects.filter(creator__in=test_users).delete()
        Chapter.objects.filter(book_project__creator__in=test_users).delete()
        BookProject.objects.filter(creator__in=test_users).delete()
        Series.objects.filter(creator__in=test_users).delete()

        # Delete profiles and users
        UserProfile.objects.filter(user__in=test_users).delete()
        test_users.delete()

        # Clear test tags
        Tag.objects.filter(name__startswith='test_').delete()

        self.stdout.write(self.style.SUCCESS('Cleared existing test data.'))

    def _create_tags(self):
        """Create predefined tags or get existing ones."""
        tag_data = [
            ('fantasy', 'genre'), ('sci-fi', 'genre'), ('romance', 'genre'),
            ('mystery', 'genre'), ('horror', 'genre'), ('thriller', 'genre'),
            ('adventure', 'theme'), ('coming-of-age', 'theme'), ('redemption', 'theme'),
            ('dark', 'mood'), ('uplifting', 'mood'), ('nostalgic', 'mood'),
        ]
        tags = []
        for name, category in tag_data:
            slug = name.lower().replace(' ', '-')
            # Try to get by slug first (unique field), then by name
            tag = Tag.objects.filter(slug=slug).first()
            if not tag:
                tag = Tag.objects.filter(name=name).first()
            if not tag:
                tag = Tag.objects.create(
                    name=name,
                    slug=slug,
                    category=category,
                    is_predefined=True
                )
            tags.append(tag)
        return tags

    def _create_users(self, count):
        """Create test users with profiles."""
        users = []
        for i in range(count):
            username = f"test_{fake.user_name()}_{i}"[:50]
            email = f"test_{i}_{fake.email()}"

            user = User.objects.create_user(
                username=username,
                email=email,
                password='testpass123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
            )

            # Create profile with realistic data
            # Use picsum.photos for placeholder images (different seed per user)
            avatar_seed = random.randint(1, 1000)
            banner_seed = random.randint(1, 1000)

            profile = UserProfile.objects.create(
                user=user,
                username=username,
                display_name=fake.name(),
                bio=random.choice(BIOS),
                location=random.choice(LOCATIONS),
                roles=random.choice(ROLES),
                genres=random.sample(GENRES, k=random.randint(1, 3)),
                skills=random.choice(SKILLS),
                status=random.choice(STATUSES),
                is_private=random.choice([True, False]),
                wallet_address=f"Test{fake.sha256()[:40]}",  # Fake Solana address
                tier=random.choice(['Basic', 'Pro', 'Elite']),
                total_sales_usd=Decimal(random.randint(0, 10000)),
                content_count=0,
                follower_count=0,
                following_count=0,
                # Placeholder profile images
                avatar_url=f"https://picsum.photos/seed/{avatar_seed}/200/200",
                banner_url=f"https://picsum.photos/seed/{banner_seed}/1200/300",
            )

            users.append(user)

            if (i + 1) % 20 == 0:
                self.stdout.write(f'  Created {i + 1}/{count} users...')

        return users

    def _create_content(self, users, tags, items_per_user):
        """Create content (books with chapters) for each user."""
        all_content = []
        book_titles_used = set()

        for user in users:
            for _ in range(items_per_user):
                # Pick unique title
                title = random.choice(BOOK_TITLES)
                while title in book_titles_used and len(book_titles_used) < len(BOOK_TITLES):
                    title = random.choice(BOOK_TITLES)
                book_titles_used.add(title)

                if len(book_titles_used) >= len(BOOK_TITLES):
                    title = f"{random.choice(BOOK_TITLES)} {fake.word().title()}"

                content_type = random.choice(CONTENT_TYPES)
                genre = random.choice(GENRES)
                price = Decimal(random.choice([0.99, 1.99, 2.99, 4.99, 9.99, 14.99]))

                # Use picsum.photos for content cover images (book cover ratio)
                cover_seed = random.randint(1, 1000)

                # Create Content
                content = Content.objects.create(
                    creator=user,
                    title=title,
                    teaser_link=f"https://picsum.photos/seed/{cover_seed}/400/600",
                    content_type=content_type,
                    genre=genre,
                    price_usd=price,
                    editions=random.randint(10, 1000),
                    inventory_status=random.choice(['draft', 'minted']),
                    view_count=random.randint(0, 5000),
                    like_count=0,
                    rating_count=0,
                    authors_note=fake.paragraph(nb_sentences=2),
                )

                # Add random tags
                content.tags.set(random.sample(tags, k=random.randint(1, 4)))

                # Create BookProject and Chapters
                book = BookProject.objects.create(
                    creator=user,
                    title=title,
                    description=fake.paragraph(nb_sentences=3),
                    is_published=content.inventory_status == 'minted',
                    published_content=content if content.inventory_status == 'minted' else None,
                )

                num_chapters = random.randint(3, 8)
                chapter_titles_shuffled = random.sample(CHAPTER_TITLES, k=min(num_chapters, len(CHAPTER_TITLES)))

                for order, ch_title in enumerate(chapter_titles_shuffled, 1):
                    Chapter.objects.create(
                        book_project=book,
                        title=ch_title,
                        content_html=f"<p>{fake.paragraph(nb_sentences=10)}</p>" * 3,
                        synopsis=fake.paragraph(nb_sentences=2),
                        order=order,
                        price=Decimal(random.choice([0.99, 1.49, 1.99, 2.49])),
                        is_published=book.is_published,
                        published_content=content if book.is_published else None,
                    )

                all_content.append(content)

                # Update user's content count
                user.profile.content_count += 1
                user.profile.save()

        return all_content

    def _create_follows(self, users, count):
        """Create follow relationships."""
        created = 0
        attempts = 0
        max_attempts = count * 3

        while created < count and attempts < max_attempts:
            follower = random.choice(users)
            following = random.choice(users)

            if follower != following:
                follow, is_new = Follow.objects.get_or_create(
                    follower=follower,
                    following=following,
                )
                if is_new:
                    created += 1
                    # Update counts
                    follower.profile.following_count += 1
                    follower.profile.save()
                    following.profile.follower_count += 1
                    following.profile.save()

            attempts += 1

    def _create_purchases(self, users, content_list, count):
        """Create purchase records."""
        minted_content = [c for c in content_list if c.inventory_status == 'minted']
        if not minted_content:
            return

        created = 0
        attempts = 0
        max_attempts = count * 3

        while created < count and attempts < max_attempts:
            user = random.choice(users)
            content = random.choice(minted_content)

            # Don't let users buy their own content
            if user != content.creator:
                # Check if already purchased
                if not Purchase.objects.filter(user=user, content=content).exists():
                    purchase_price = content.price_usd
                    stripe_fee = purchase_price * Decimal('0.029') + Decimal('0.30')
                    net_after_stripe = purchase_price - stripe_fee
                    mint_cost = Decimal(random.uniform(0.001, 0.01))
                    net_after_costs = net_after_stripe - mint_cost
                    platform_fee = net_after_costs * Decimal('0.10')
                    creator_earnings = net_after_costs - platform_fee

                    Purchase.objects.create(
                        user=user,
                        content=content,
                        purchase_price_usd=purchase_price,
                        gross_amount=purchase_price,
                        stripe_fee=stripe_fee,
                        net_after_stripe=net_after_stripe,
                        mint_cost=mint_cost,
                        net_after_costs=net_after_costs,
                        platform_fee=platform_fee,
                        creator_earnings_usd=creator_earnings,
                        status='completed',
                        nft_minted=True,
                        nft_mint_address=f"Test{fake.sha256()[:40]}",
                        transaction_signature=f"Test{fake.sha256()[:80]}",
                    )
                    created += 1

                    # Update creator's total sales
                    content.creator.profile.total_sales_usd += purchase_price
                    content.creator.profile.save()

            attempts += 1

    def _create_likes(self, users, content_list, count):
        """Create content likes."""
        created = 0
        attempts = 0
        max_attempts = count * 3

        while created < count and attempts < max_attempts:
            user = random.choice(users)
            content = random.choice(content_list)

            if user != content.creator:
                like, is_new = ContentLike.objects.get_or_create(user=user, content=content)
                if is_new:
                    content.like_count += 1
                    content.save()
                    created += 1

            attempts += 1

    def _create_ratings(self, users, content_list, count):
        """Create content ratings."""
        created = 0
        attempts = 0
        max_attempts = count * 3

        while created < count and attempts < max_attempts:
            user = random.choice(users)
            content = random.choice(content_list)

            if user != content.creator:
                rating_obj, is_new = ContentRating.objects.get_or_create(
                    user=user,
                    content=content,
                    defaults={
                        'rating': random.randint(3, 5),  # Skew positive
                        'review_text': fake.paragraph(nb_sentences=2) if random.random() > 0.5 else '',
                    }
                )
                if is_new:
                    # Update content's average rating using model's method
                    content.update_rating_aggregates()
                    created += 1

            attempts += 1

    def _create_creator_reviews(self, users, count):
        """Create creator reviews (displayed on collaborators page).

        Reviews are from users who have 'purchased' from a creator.
        This populates the average_review_rating field on UserProfile.
        """
        # Build a map of purchasers for each creator
        creator_purchasers = {}
        for purchase in Purchase.objects.filter(user__in=users, status='completed').select_related('content__creator'):
            creator = purchase.content.creator
            if creator not in creator_purchasers:
                creator_purchasers[creator] = set()
            creator_purchasers[creator].add(purchase.user)

        created = 0
        attempts = 0
        max_attempts = count * 3

        # Only creators with purchasers can be reviewed
        eligible_creators = [c for c in creator_purchasers.keys() if creator_purchasers[c]]

        if not eligible_creators:
            self.stdout.write(self.style.WARNING('  No eligible creators for reviews (no purchases yet)'))
            return

        while created < count and attempts < max_attempts:
            creator = random.choice(eligible_creators)
            purchasers = list(creator_purchasers[creator])
            if not purchasers:
                attempts += 1
                continue

            reviewer = random.choice(purchasers)

            # Don't let users review themselves
            if reviewer == creator:
                attempts += 1
                continue

            # Check if already reviewed
            if not CreatorReview.objects.filter(reviewer=reviewer, creator=creator).exists():
                CreatorReview.objects.create(
                    reviewer=reviewer,
                    creator=creator,
                    rating=random.randint(3, 5),  # Skew positive
                    review_text=fake.paragraph(nb_sentences=2) if random.random() > 0.5 else '',
                    verification_type='purchase',
                )
                created += 1

                # Update creator's average review rating
                creator.profile.update_review_aggregates()

            attempts += 1
