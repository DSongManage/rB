from django.db import models
from django.contrib.auth.models import AbstractUser  # Extend for custom users (no private keys stored)
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal

# Create your models here.

class User(AbstractUser):
    """Custom user model extended for renaissBlock (FR3, FR7).
    
    - Uses Web3Auth for wallet integration externally.
    - Stores minimal data: no private keys or sensitive info (GUIDELINES.md).
    - Future: Add fields for followers, metrics for tiering (FR9).
    """
    # Encrypt any sensitive metadata if needed (AES-256 per GUIDELINES.md)
    
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='rb_user_groups',  # Avoid conflict with auth.User
        related_query_name='rb_user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='rb_user_permissions',  # Avoid conflict with auth.User
        related_query_name='rb_user',
    )

    def search_collaborators(self, query):
        return User.objects.filter(username__icontains=query)  # Simple search for invites (FR8)

    # Read-only convenience property: source of truth is UserProfile.wallet_address
    @property
    def wallet_address(self):  # type: ignore[override]
        try:
            return self.profile.wallet_address
        except Exception:
            return None


class Tag(models.Model):
    """Flexible tagging system for content discovery.

    Tags are organized by category for better UX in selection UI.
    Supports both predefined platform tags and user-created custom tags.
    """
    CATEGORY_CHOICES = [
        ('genre', 'Genre'),
        ('theme', 'Theme'),
        ('mood', 'Mood'),
        ('custom', 'Custom'),
    ]

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='custom')
    is_predefined = models.BooleanField(default=False)
    usage_count = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-usage_count', 'name']

    def __str__(self):
        return f"{self.name} ({self.category})"


class Content(models.Model):
    """Model for uploaded content metadata (FR4, FR5).
    
    - Full content on IPFS/Arweave; only metadata/teaser links here.
    - NFT minting handled via Anchor (ARCHITECTURE.md).
    - Auto-generate teasers (first 10%).
    - Moderation: Flag for review to prevent violations (GUIDELINES.md).
    """
    CONTENT_TYPES = [
        ('book', 'Book'),
        ('art', 'Art'),
        ('film', 'Film'),
        ('music', 'Music'),
        ('comic', 'Comic'),
    ]
    GENRES = [
        ('fantasy', 'Fantasy'),
        ('scifi', 'Sci-Fi'),
        ('nonfiction', 'Non-Fiction'),
        ('drama', 'Drama'),
        ('comedy', 'Comedy'),
        ('other', 'Other'),
    ]
    creator = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    teaser_link = models.URLField()  # Public teaser (no auth needed, FR1)
    # Persist a local teaser fallback for text content to avoid IPFS dependency
    teaser_html = models.TextField(blank=True, default='')
    ipfs_hash = models.CharField(max_length=46, blank=True)  # Full content hash (gated by NFT)
    nft_contract = models.CharField(max_length=44, blank=True)  # Solana contract address
    content_type = models.CharField(max_length=16, choices=CONTENT_TYPES, default='book')
    genre = models.CharField(max_length=32, choices=GENRES, default='other')
    # Commerce fields (MVP)
    price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    editions = models.PositiveIntegerField(default=1)
    teaser_percent = models.PositiveIntegerField(default=10)
    watermark_preview = models.BooleanField(default=False)
    inventory_status = models.CharField(max_length=16, choices=[('draft','Draft'),('minted','Minted'),('unpublished','Unpublished'),('delisted','Delisted')], default='draft')
    flagged = models.BooleanField(default=False)  # For user flagging/moderation (FR14)
    created_at = models.DateTimeField(auto_now_add=True)
    # View tracking for analytics and discovery
    view_count = models.PositiveIntegerField(default=0, db_index=True)

    # Social engagement metrics (denormalized for performance)
    like_count = models.PositiveIntegerField(default=0, db_index=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, db_index=True)
    rating_count = models.PositiveIntegerField(default=0)

    # Author's note - optional short description from the creator (max ~100 words / 600 chars)
    authors_note = models.TextField(blank=True, default='', max_length=600)

    # Copyright notice - stored at time of publishing
    copyright_year = models.IntegerField(null=True, blank=True)
    copyright_holder = models.CharField(max_length=255, blank=True)  # Author name at time of publish

    # Tags for content discovery and search
    tags = models.ManyToManyField('Tag', blank=True, related_name='contents')

    class Meta:
        ordering = ['-created_at']  # Show newest content first

    def __str__(self):
        return self.title

    def is_owned_by(self, user):
        """Check if user owns this content via purchase, creation, or collaboration."""
        if not user or not user.is_authenticated:
            return False

        # Creator always has access to their own content
        if self.creator == user:
            return True

        # Check if user is a collaborator on this content (for collaborative projects)
        if hasattr(self, 'source_collaborative_project') and self.source_collaborative_project.exists():
            collab_project = self.source_collaborative_project.first()
            if collab_project and collab_project.collaborators.filter(
                user=user,
                status='accepted'
            ).exists():
                return True

        # Check for completed purchase (payment succeeded and not refunded)
        return self.purchases.filter(
            user=user,
            refunded=False,
            status__in=['payment_completed', 'completed', 'minting']
        ).exists()

    def purchases_count(self):
        """Count non-refunded purchases."""
        return self.purchases.filter(refunded=False).count()

    def revenue_total(self):
        """Calculate total revenue from this content."""
        from django.db.models import Sum
        from decimal import Decimal
        result = self.purchases.filter(refunded=False).aggregate(total=Sum('purchase_price_usd'))
        return result['total'] or Decimal('0.00')

    def creator_earnings_total(self):
        """Calculate total earnings for creator (after all fees)."""
        from django.db.models import Sum
        from decimal import Decimal
        result = self.purchases.filter(refunded=False).aggregate(total=Sum('creator_earnings_usd'))
        return result['total'] or Decimal('0.00')

    def get_collaborators_with_wallets(self):
        """
        Get all collaborators with their Web3Auth wallet addresses and revenue split.

        For collaborative projects (minted from CollaborativeProject), returns all
        accepted collaborators with their wallets and revenue percentages.
        For regular content, returns just the creator.

        Returns:
            list: List of dicts with {user, wallet, percentage, role}
        """
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f'[get_collaborators_with_wallets] Content ID: {self.id}, Title: {self.title}')

        # Check if this content comes from a collaborative project
        has_collab_attr = hasattr(self, 'source_collaborative_project')
        logger.info(f'[get_collaborators_with_wallets] Has source_collaborative_project attr: {has_collab_attr}')

        if has_collab_attr:
            collab_exists = self.source_collaborative_project.exists()
            logger.info(f'[get_collaborators_with_wallets] source_collaborative_project.exists(): {collab_exists}')

            if collab_exists:
                collab_project = self.source_collaborative_project.first()
                logger.info(f'[get_collaborators_with_wallets] Found CollaborativeProject: {collab_project.id} - {collab_project.title}')

                if collab_project:
                    collaborators = []
                    all_collab_roles = collab_project.collaborators.all()
                    logger.info(f'[get_collaborators_with_wallets] Total collaborators in project: {all_collab_roles.count()}')

                    accepted_roles = collab_project.collaborators.filter(status='accepted')
                    logger.info(f'[get_collaborators_with_wallets] Accepted collaborators: {accepted_roles.count()}')

                    for collab_role in accepted_roles:
                        logger.info(f'[get_collaborators_with_wallets] Collaborator: {collab_role.user.username}, Role: {collab_role.role}, Percentage: {collab_role.revenue_percentage}%')

                        # Get wallet from user's profile
                        wallet_address = None
                        if hasattr(collab_role.user, 'profile') and collab_role.user.profile:
                            wallet_address = collab_role.user.profile.wallet_address
                            logger.info(f'[get_collaborators_with_wallets]   Wallet: {wallet_address}')
                        else:
                            logger.info(f'[get_collaborators_with_wallets]   NO PROFILE or NO WALLET for {collab_role.user.username}')

                        if wallet_address:
                            collaborators.append({
                                'user': collab_role.user,
                                'wallet': wallet_address,
                                'percentage': float(collab_role.revenue_percentage),
                                'role': collab_role.role
                            })

                    logger.info(f'[get_collaborators_with_wallets] Found {len(collaborators)} collaborators with wallets')

                    if collaborators:
                        return collaborators
                    else:
                        logger.warning(f'[get_collaborators_with_wallets] No collaborators with wallets found, falling back to single creator')

        # Fallback: Single creator for non-collaborative content
        logger.info(f'[get_collaborators_with_wallets] Using FALLBACK - single creator: {self.creator.username}')
        wallet_address = None
        if hasattr(self.creator, 'profile') and self.creator.profile:
            wallet_address = self.creator.profile.wallet_address
            logger.info(f'[get_collaborators_with_wallets] Creator wallet: {wallet_address}')

        if wallet_address:
            return [{
                'user': self.creator,
                'wallet': wallet_address,
                'percentage': 90,  # 90% to creator, 10% platform
                'role': 'creator'
            }]

        logger.error(f'[get_collaborators_with_wallets] NO WALLET FOUND for creator {self.creator.username}')
        return []

    def update_rating_aggregates(self):
        """Update denormalized rating stats from ContentRating."""
        from django.db.models import Avg, Count
        aggregates = self.ratings.aggregate(
            avg=Avg('rating'),
            count=Count('id')
        )
        self.average_rating = aggregates['avg']
        self.rating_count = aggregates['count']
        self.save(update_fields=['average_rating', 'rating_count'])

    # Future: Methods for minting integration, revenue splits (FR9, FR13)
# Ensure input validation on save (prevent injection, GUIDELINES.md)

class Collaboration(models.Model):
    """Model for creator collaborations (FR8 in REQUIREMENTS.md).
    
    - Invites via backend API; co-mint with splits enforced in Anchor (FR9).
    - Metrics for tiering (followers/sales per FR9).
    """
    initiators = models.ManyToManyField(User, related_name='initiated_collabs')
    collaborators = models.ManyToManyField(User, related_name='joined_collabs')
    content = models.ForeignKey(Content, on_delete=models.CASCADE)
    revenue_split = models.JSONField(default=dict)  # e.g., {'user1': 50, 'user2': 50}
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('active', 'Active')])
    
    def __str__(self):
        return f"Collab for {self.content.title}"


class UserProfile(models.Model):
    """Profile for creators (LinkedIn-like layer).

    - username: immutable handle (mirrors `User.username`), unique, validated
    - display_name: editable, non-unique
    - email_hash: SHA-256 of normalized email (no raw email stored)
    - wallet_address: duplicate convenience field for quick joins (public only)
    """

    HANDLE_VALIDATOR = RegexValidator(
        regex=r"^[A-Za-z0-9_]{1,50}$",
        message="Username may only contain letters, numbers, and underscores (max 50).",
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    username = models.CharField(max_length=50, unique=True, validators=[HANDLE_VALIDATOR])
    display_name = models.CharField(max_length=100, blank=True, default='')
    email_hash = models.CharField(max_length=64, blank=True, default='')
    wallet_address = models.CharField(max_length=44, unique=True, null=True, blank=True, default=None)
    # Web3Auth/OpenLogin subject identifier for deterministic identity mapping
    web3auth_sub = models.CharField(max_length=128, unique=True, null=True, blank=True, default=None)

    # Wallet provider tracking
    WALLET_PROVIDER_CHOICES = [
        ('web3auth', 'Web3Auth'),
        ('external', 'External Wallet'),
    ]
    wallet_provider = models.CharField(max_length=30, choices=WALLET_PROVIDER_CHOICES,
                                      default='web3auth', blank=True)
    # Backward-compatible URL fields (kept); prefer uploaded images below
    avatar_url = models.URLField(blank=True, default='')
    banner_url = models.URLField(blank=True, default='')
    # Uploaded media (preferred)
    avatar_image = models.ImageField(upload_to='avatars/', blank=True, null=True, max_length=255)
    banner_image = models.ImageField(upload_to='banners/', blank=True, null=True, max_length=255)
    # Profile metadata
    location = models.CharField(max_length=120, blank=True, default='')
    roles = models.JSONField(default=list, blank=True)  # e.g., ["author", "artist"]
    genres = models.JSONField(default=list, blank=True)  # e.g., ["fantasy", "drama"]
    # Bio and extended profile information
    bio = models.TextField(max_length=2000, blank=True, default='')
    skills = models.JSONField(default=list, blank=True)  # e.g., ["illustration", "character design", "watercolor"]
    social_links = models.JSONField(default=dict, blank=True)  # e.g., {"behance": "url", "twitter": "url"}
    # Collaboration visibility and status
    is_private = models.BooleanField(default=True)
    STATUS_CHOICES = [
        # GREEN - Available
        ('Available', 'Available'),
        ('Open to Offers', 'Open to Offers'),
        # YELLOW - Limited availability
        ('Selective', 'Selective'),
        ('Booked', 'Booked'),
        # RED - Unavailable
        ('Unavailable', 'Unavailable'),
        ('On Hiatus', 'On Hiatus'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='Available')
    # Per-user stats and tiering
    content_count = models.PositiveIntegerField(default=0)
    total_sales_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tier = models.CharField(max_length=16, choices=[('Basic', 'Basic'), ('Pro', 'Pro'), ('Elite', 'Elite')], default='Basic')
    fee_bps = models.PositiveIntegerField(default=1000)  # default 10%

    # Creator review aggregates (from CreatorReview model)
    average_review_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, db_index=True)
    review_count = models.PositiveIntegerField(default=0)

    # Follower/following counts (denormalized for performance)
    follower_count = models.PositiveIntegerField(default=0, db_index=True)
    following_count = models.PositiveIntegerField(default=0)

    # Legal agreement tracking
    tos_accepted_at = models.DateTimeField(null=True, blank=True, help_text="When user accepted Terms of Service at signup")
    tos_version = models.CharField(max_length=20, blank=True, default='', help_text="Version of ToS accepted at signup")
    creator_agreement_accepted_at = models.DateTimeField(null=True, blank=True, help_text="When user accepted Creator Agreement")
    creator_agreement_version = models.CharField(max_length=20, blank=True, default='', help_text="Version of Creator Agreement accepted")

    # Beta onboarding tracking
    has_seen_beta_welcome = models.BooleanField(default=False, help_text="Whether user has seen the beta welcome modal")

    # Bridge.xyz Payout Preferences
    PAYOUT_DESTINATION_CHOICES = [
        ('wallet', 'Web3 Wallet'),
        ('bridge', 'Bank Account (via Bridge)'),
        ('split', 'Split (Wallet + Bank)'),
    ]
    payout_destination = models.CharField(
        max_length=32,
        choices=PAYOUT_DESTINATION_CHOICES,
        default='wallet',
        help_text="Where to send USDC earnings"
    )
    bridge_payout_percentage = models.PositiveSmallIntegerField(
        default=100,
        validators=[MaxValueValidator(100)],
        help_text="Percentage sent to Bridge (rest goes to wallet). Only used when payout_destination='split'"
    )
    pending_bridge_amount = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal('0'),
        help_text="Accumulated USDC awaiting Bridge payout threshold ($10)"
    )

    def save(self, *args, **kwargs):
        # Ensure handle mirrors auth username on create; treat as immutable afterwards
        if not self.pk:
            self.username = self.username or self.user.username
        else:
            # Prevent handle changes after creation
            orig = UserProfile.objects.get(pk=self.pk)
            self.username = orig.username
        # Keep public wallet in sync if set at User level
        if self.user.wallet_address and not self.wallet_address:
            self.wallet_address = self.user.wallet_address
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"@{self.username}"

    @property
    def resolved_avatar_url(self) -> str:
        import logging
        logger = logging.getLogger(__name__)

        try:
            if self.avatar_image:
                logger.info(f'[UserProfile] {self.username} has avatar_image: {self.avatar_image.name if hasattr(self.avatar_image, "name") else "unknown"}')
                if hasattr(self.avatar_image, 'url'):
                    url = self.avatar_image.url
                    logger.info(f'[UserProfile] {self.username} avatar URL: {url}')
                    return url
        except Exception as e:
            logger.error(f'[UserProfile] Error getting avatar for {self.username}: {e}')
            pass

        fallback = self.avatar_url or ''
        logger.info(f'[UserProfile] {self.username} using fallback avatar_url: {fallback}')
        return fallback

    @property
    def resolved_banner_url(self) -> str:
        try:
            if self.banner_image and hasattr(self.banner_image, 'url'):
                return self.banner_image.url
        except Exception:
            pass
        return self.banner_url or ''

    def update_review_aggregates(self):
        """Update denormalized review stats from CreatorReview."""
        from django.db.models import Avg, Count
        aggregates = CreatorReview.objects.filter(creator=self.user).aggregate(
            avg=Avg('rating'),
            count=Count('id')
        )
        self.average_review_rating = aggregates['avg']
        self.review_count = aggregates['count']
        self.save(update_fields=['average_review_rating', 'review_count'])


class ExternalPortfolioItem(models.Model):
    """External portfolio item for showcasing work not on the platform.

    - Allows creators to showcase projects from Behance, personal sites, etc.
    - Supports image uploads for project thumbnails
    - Links to external project URLs
    - Orderable for custom portfolio arrangement
    """

    PROJECT_TYPE_CHOICES = [
        ('book', 'Book'),
        ('art', 'Art'),
        ('music', 'Music'),
        ('film', 'Film'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolio_items')
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=1000, blank=True, default='')
    image = models.ImageField(upload_to='portfolio/', blank=True, null=True)
    external_url = models.URLField(blank=True, default='')
    project_type = models.CharField(max_length=50, choices=PROJECT_TYPE_CHOICES, default='other')
    role = models.CharField(max_length=100, blank=True, default='')  # e.g., "Lead Illustrator", "Co-Author"
    created_date = models.DateField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['user', 'order']),
        ]

    def __str__(self):
        return f"{self.title} by {self.user.username}"


class TestFeeLog(models.Model):
    """MVP fee log for integration testing and mock minting.
    Stores amounts (USD-equivalent) and timestamps for platform fee tracking.
    """
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Intentionally minimal: URL resolution lives on UserProfile


class Series(models.Model):
    """Series for grouping multiple books into a collection.

    - Authors can create series to organize related books
    - Series have their own synopsis and cover image
    - Books can optionally belong to one series
    """
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='book_series')
    title = models.CharField(max_length=255)
    synopsis = models.TextField(blank=True, default='', help_text="Overview of the series (max ~300 words)")
    cover_image = models.ImageField(upload_to='series_covers/', null=True, blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name_plural = 'Series'

    def __str__(self):
        return f"{self.title} by {self.creator.username}"

    def book_count(self):
        return self.books.count()


class BookProject(models.Model):
    """Book project for managing multi-chapter books.
    
    - Authors can create books with multiple chapters
    - Chapters can be published individually or as a complete book
    - Content is encrypted at rest for privacy
    """
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='book_projects')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='', help_text="Book synopsis (max ~200 words)")
    cover_image = models.ImageField(upload_to='book_covers/', null=True, blank=True, max_length=500)
    series = models.ForeignKey('Series', on_delete=models.SET_NULL, null=True, blank=True, related_name='books', help_text="Optional series this book belongs to")
    series_order = models.PositiveIntegerField(default=0, help_text="Order of this book within the series")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)
    published_content = models.ForeignKey(Content, null=True, blank=True, on_delete=models.SET_NULL, related_name='source_book_project')
    
    class Meta:
        ordering = ['-updated_at']
        unique_together = ['creator', 'title']

    def __str__(self):
        return f"{self.title} by {self.creator.username}"


class Chapter(models.Model):
    """Individual chapter within a book project.

    - Each chapter has title and HTML content
    - Chapters are ordered within the book
    - Can be published individually as NFT or as part of complete book
    """
    book_project = models.ForeignKey(BookProject, on_delete=models.CASCADE, related_name='chapters')
    title = models.CharField(max_length=255)
    content_html = models.TextField(blank=True, default='')  # Encrypted at rest
    synopsis = models.TextField(blank=True, default='', help_text="Brief summary of this chapter (max ~150 words)")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)
    published_content = models.ForeignKey(Content, null=True, blank=True, on_delete=models.SET_NULL, related_name='source_chapter')

    # Pricing
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1.00,
        help_text="Price in USD for purchasing this chapter"
    )

    # Content removal and marketplace listing fields
    is_listed = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this chapter is visible in the marketplace (default: True)"
    )
    delisted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when chapter was delisted from marketplace"
    )
    delisted_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='delisted_chapters',
        help_text="User who delisted this chapter"
    )
    delisted_reason = models.TextField(
        blank=True,
        default='',
        help_text="Reason for delisting (visible to collaborators)"
    )

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ['book_project', 'order']
        indexes = [
            models.Index(fields=['is_listed', '-created_at']),
            models.Index(fields=['book_project', 'is_listed']),
        ]

    def __str__(self):
        return f"Chapter {self.order}: {self.title}"

    def get_collaborators_with_wallets(self):
        """
        Get all collaborators with their Web3Auth wallet addresses and revenue split.

        For now, returns the book project creator as the sole collaborator.
        TODO: Implement chapter-level collaborator system with revenue splits.

        Returns:
            List of dicts: [
                {
                    'user': User object,
                    'wallet': 'SolanaAddress...',
                    'percentage': 90,  # 90% to creator, 10% to platform
                    'role': 'author'
                },
                ...
            ]

        Raises:
            ValueError: If user doesn't have a Web3Auth wallet
        """
        collaborators = []

        # Get book project creator
        creator = self.book_project.creator

        # Verify creator has wallet
        if not creator.wallet_address:
            raise ValueError(f"User {creator.username} doesn't have a Web3Auth wallet")

        # For now, creator gets 90% (platform gets 10%)
        collaborators.append({
            'user': creator,
            'wallet': creator.wallet_address,
            'percentage': 90,
            'role': 'author'
        })

        # Validate total percentage doesn't exceed 90% (10% reserved for platform)
        total_percentage = sum(c['percentage'] for c in collaborators)
        if total_percentage > 90:
            raise ValueError(f"Total collaborator percentage ({total_percentage}%) exceeds 90%")

        return collaborators

    def get_purchase_count(self):
        """Count how many purchases (NFT mints) this chapter has."""
        if not self.published_content:
            return 0
        return Purchase.objects.filter(
            chapter=self,
            refunded=False,
            status__in=['payment_completed', 'completed', 'minting']
        ).count()

    def has_any_sales(self):
        """Check if any NFTs have been minted/sold for this chapter."""
        return self.get_purchase_count() > 0

    def can_be_removed_completely(self):
        """
        Check if this chapter can be FULLY removed from the database.

        Returns:
            bool: True if chapter has zero sales, False otherwise
        """
        return not self.has_any_sales()

    def can_be_delisted_by(self, user):
        """
        Check if a user has permission to delist this chapter.

        For solo content: Only the creator can delist
        For collaborative content: All collaborators must approve

        Args:
            user: User object attempting to delist

        Returns:
            bool: True if user can initiate/approve delisting
        """
        # Check if user is the book project creator
        if self.book_project.creator == user:
            return True

        # TODO: Check if user is a collaborator when collaboration system is implemented
        # For now, only creator can delist
        return False

    def is_collaborative(self):
        """
        Check if this chapter is collaborative content.

        Returns:
            bool: True if multiple collaborators, False if solo
        """
        # TODO: Implement when collaboration system is added
        # For now, all chapters are solo (creator only)
        return False

    def get_all_collaborators(self):
        """
        Get all collaborators for this chapter.

        Returns:
            QuerySet of User objects
        """
        # For now, just return the creator
        # TODO: Implement when collaboration system is added
        return [self.book_project.creator]

    def remove_completely(self, user, reason=''):
        """
        PERMANENTLY delete this chapter from the database.

        Only allowed if:
        1. No NFTs have been sold (zero purchases)
        2. User has permission to remove

        If the chapter's Content has purchases (can't be deleted due to PROTECT constraint),
        the Content will be delisted instead of deleted.

        Args:
            user: User object attempting removal
            reason: Optional reason for removal (for audit logs)

        Returns:
            dict: {'success': bool, 'message': str}

        Raises:
            ValueError: If chapter has sales or user lacks permission
        """
        if not self.can_be_removed_completely():
            raise ValueError(
                f"Cannot remove chapter '{self.title}': {self.get_purchase_count()} NFT(s) have been sold. "
                "Use delist_from_marketplace() instead to hide from marketplace while preserving access for NFT holders."
            )

        if not self.can_be_delisted_by(user):
            raise ValueError(
                f"User {user.username} does not have permission to remove this chapter."
            )

        # Audit log
        import logging
        from django.db.models.deletion import ProtectedError
        logger = logging.getLogger(__name__)
        logger.info(
            f"[Chapter Removal] User {user.username} is PERMANENTLY removing chapter {self.id} "
            f"('{self.title}'). Reason: {reason or 'No reason provided'}"
        )

        # Get book project before deletion
        book_project = self.book_project
        chapter_title = self.title

        # Delete the associated published Content if it exists
        if self.published_content:
            content_to_delete = self.published_content
            content_id = content_to_delete.id
            logger.info(f"[Chapter Removal] Attempting to delete associated Content {content_id}")

            try:
                content_to_delete.delete()
                logger.info(f"[Chapter Removal] Successfully deleted Content {content_id}")
            except ProtectedError as e:
                # Content has Purchase records - cannot delete due to PROTECT constraint
                # Delist it instead to hide from marketplace
                logger.warning(
                    f"[Chapter Removal] Cannot delete Content {content_id} due to existing purchases. "
                    f"Delisting instead. Error: {e}"
                )
                content_to_delete.is_listed = False
                content_to_delete.delisted_at = timezone.now()
                content_to_delete.delisted_by = user
                content_to_delete.delisted_reason = f"Chapter removed by {user.username}. {reason}"
                content_to_delete.save()
                logger.info(f"[Chapter Removal] Content {content_id} delisted instead of deleted")

        # Delete the chapter
        self.delete()

        # Check if book project has any remaining chapters
        remaining_chapters = book_project.chapters.count()
        logger.info(f"[Chapter Removal] Book project '{book_project.title}' has {remaining_chapters} remaining chapters")

        if remaining_chapters == 0:
            # No chapters left - delete the entire book project and its published content
            logger.info(f"[Chapter Removal] No chapters left in book project {book_project.id} - removing book project")

            if book_project.published_content:
                book_content_to_delete = book_project.published_content
                book_content_id = book_content_to_delete.id
                logger.info(f"[Chapter Removal] Attempting to delete book's published Content {book_content_id}")

                try:
                    book_content_to_delete.delete()
                    logger.info(f"[Chapter Removal] Successfully deleted book Content {book_content_id}")
                except ProtectedError as e:
                    # Book Content has Purchase records - delist instead
                    logger.warning(
                        f"[Chapter Removal] Cannot delete book Content {book_content_id} due to existing purchases. "
                        f"Delisting instead. Error: {e}"
                    )
                    book_content_to_delete.is_listed = False
                    book_content_to_delete.delisted_at = timezone.now()
                    book_content_to_delete.delisted_by = user
                    book_content_to_delete.delisted_reason = f"Book project removed (no chapters). {reason}"
                    book_content_to_delete.save()
                    logger.info(f"[Chapter Removal] Book Content {book_content_id} delisted instead of deleted")

            book_project.delete()
            logger.info(f"[Chapter Removal] Book project '{book_project.title}' has been permanently deleted")

        return {
            'success': True,
            'message': f"Chapter '{chapter_title}' has been permanently deleted."
        }

    def delist_from_marketplace(self, user, reason=''):
        """
        Hide this chapter from the marketplace (but preserve access for NFT holders).

        For solo content: Immediate delisting
        For collaborative content: Creates DelistApproval request for all collaborators

        Args:
            user: User object initiating delisting
            reason: Reason for delisting (required)

        Returns:
            dict: {
                'success': bool,
                'message': str,
                'requires_approval': bool,  # True if collaborative
                'approval_id': int or None  # DelistApproval ID if collaborative
            }

        Raises:
            ValueError: If chapter has no sales or user lacks permission
        """
        if not self.has_any_sales():
            raise ValueError(
                "Cannot delist chapter with zero sales. Use remove_completely() instead to permanently delete."
            )

        if not self.can_be_delisted_by(user):
            raise ValueError(
                f"User {user.username} does not have permission to delist this chapter."
            )

        if not reason:
            raise ValueError("Reason is required for delisting.")

        import logging
        logger = logging.getLogger(__name__)

        # Solo content: Immediate delisting
        if not self.is_collaborative():
            self.is_listed = False
            self.delisted_at = timezone.now()
            self.delisted_by = user
            self.delisted_reason = reason
            self.save(update_fields=['is_listed', 'delisted_at', 'delisted_by', 'delisted_reason'])

            logger.info(
                f"[Chapter Delist] User {user.username} delisted solo chapter {self.id} "
                f"('{self.title}'). Reason: {reason}"
            )

            return {
                'success': True,
                'message': f"Chapter '{self.title}' has been delisted from the marketplace.",
                'requires_approval': False,
                'approval_id': None
            }

        # Collaborative content: Create approval request
        else:
            # Import here to avoid circular dependency
            from .models import DelistApproval

            # Check if there's already a pending request
            existing = DelistApproval.objects.filter(
                chapter=self,
                status='pending'
            ).first()

            if existing:
                raise ValueError(
                    f"A delist request is already pending for this chapter (requested by {existing.requested_by.username})."
                )

            # Create delist approval request
            approval = DelistApproval.objects.create(
                chapter=self,
                requested_by=user,
                reason=reason
            )

            # Auto-approve for the requesting user
            from .models import CollaboratorApproval
            CollaboratorApproval.objects.create(
                delist_request=approval,
                collaborator=user,
                approved=True,
                responded_at=timezone.now()
            )

            logger.info(
                f"[Chapter Delist] User {user.username} created delist request {approval.id} "
                f"for collaborative chapter {self.id} ('{self.title}'). Awaiting collaborator approval."
            )

            # Send notifications to other collaborators
            self._notify_collaborators_of_delist_request(approval, user)

            return {
                'success': True,
                'message': f"Delist request created for '{self.title}'. Awaiting approval from all collaborators.",
                'requires_approval': True,
                'approval_id': approval.id
            }

    def relist_on_marketplace(self, user):
        """
        Restore this chapter to the marketplace (undo delisting).

        Args:
            user: User object attempting to relist

        Returns:
            dict: {'success': bool, 'message': str}

        Raises:
            ValueError: If chapter is not delisted or user lacks permission
        """
        if self.is_listed:
            raise ValueError("Chapter is already listed on the marketplace.")

        if not self.can_be_delisted_by(user):
            raise ValueError(
                f"User {user.username} does not have permission to relist this chapter."
            )

        import logging
        logger = logging.getLogger(__name__)

        # Relist the chapter
        self.is_listed = True
        self.delisted_at = None
        self.delisted_by = None
        self.delisted_reason = ''
        self.save(update_fields=['is_listed', 'delisted_at', 'delisted_by', 'delisted_reason'])

        logger.info(
            f"[Chapter Relist] User {user.username} relisted chapter {self.id} ('{self.title}')."
        )

        return {
            'success': True,
            'message': f"Chapter '{self.title}' has been relisted on the marketplace."
        }

    def _notify_collaborators_of_delist_request(self, approval, requesting_user):
        """
        Send notifications to all collaborators about a delist request.

        Args:
            approval: DelistApproval object
            requesting_user: User who requested the delist
        """
        # TODO: Implement notification service
        # For now, this is a placeholder
        pass


class DelistApproval(models.Model):
    """
    Approval workflow for delisting collaborative chapters.

    When a collaborator wants to delist collaborative content, all collaborators
    must approve before the chapter is hidden from the marketplace.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved (Delisted)'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        related_name='delist_requests',
        help_text='Chapter to be delisted'
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='delist_requests_initiated',
        help_text='Collaborator who initiated the delist request'
    )
    reason = models.TextField(
        help_text='Reason for delisting (visible to all collaborators)'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when all approvals received or request was rejected'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['chapter', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"Delist request for '{self.chapter.title}' by {self.requested_by.username} ({self.status})"

    def check_and_apply_if_approved(self):
        """
        Check if all collaborators have approved. If yes, delist the chapter.

        Returns:
            dict: {'approved': bool, 'message': str}
        """
        # Get all collaborators for this chapter
        all_collaborators = self.chapter.get_all_collaborators()
        total_collaborators = len(all_collaborators)

        # Count approvals
        approvals = self.collaborator_responses.filter(approved=True).count()

        # Check if all collaborators have approved
        if approvals >= total_collaborators:
            # Delist the chapter
            self.chapter.is_listed = False
            self.chapter.delisted_at = timezone.now()
            self.chapter.delisted_by = self.requested_by
            self.chapter.delisted_reason = self.reason
            self.chapter.save(update_fields=['is_listed', 'delisted_at', 'delisted_by', 'delisted_reason'])

            # Mark request as approved
            self.status = 'approved'
            self.resolved_at = timezone.now()
            self.save(update_fields=['status', 'resolved_at'])

            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"[DelistApproval] Request {self.id} approved by all collaborators. "
                f"Chapter {self.chapter.id} ('{self.chapter.title}') has been delisted."
            )

            return {
                'approved': True,
                'message': f"All collaborators approved. Chapter '{self.chapter.title}' has been delisted."
            }

        return {
            'approved': False,
            'message': f"Awaiting approval from {total_collaborators - approvals} more collaborator(s)."
        }

    def reject(self, rejecting_user):
        """
        Reject the delist request.

        Args:
            rejecting_user: User who rejected

        Returns:
            dict: {'success': bool, 'message': str}
        """
        self.status = 'rejected'
        self.resolved_at = timezone.now()
        self.save(update_fields=['status', 'resolved_at'])

        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            f"[DelistApproval] Request {self.id} rejected by {rejecting_user.username}. "
            f"Chapter '{self.chapter.title}' will remain listed."
        )

        return {
            'success': True,
            'message': f"Delist request rejected. Chapter '{self.chapter.title}' will remain on the marketplace."
        }

    def cancel(self, cancelling_user):
        """
        Cancel the delist request (can only be done by the requesting user).

        Args:
            cancelling_user: User attempting to cancel

        Returns:
            dict: {'success': bool, 'message': str}

        Raises:
            ValueError: If user is not the requester
        """
        if cancelling_user != self.requested_by:
            raise ValueError("Only the requesting user can cancel this delist request.")

        self.status = 'cancelled'
        self.resolved_at = timezone.now()
        self.save(update_fields=['status', 'resolved_at'])

        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            f"[DelistApproval] Request {self.id} cancelled by {cancelling_user.username}."
        )

        return {
            'success': True,
            'message': 'Delist request cancelled.'
        }


class CollaboratorApproval(models.Model):
    """
    Individual collaborator's response to a delist request.

    Tracks whether each collaborator approved or rejected the delist request.
    """

    delist_request = models.ForeignKey(
        DelistApproval,
        on_delete=models.CASCADE,
        related_name='collaborator_responses'
    )
    collaborator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='delist_responses'
    )
    approved = models.BooleanField(
        help_text='True if approved, False if rejected'
    )
    response_note = models.TextField(
        blank=True,
        default='',
        help_text='Optional note from collaborator'
    )
    responded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['delist_request', 'collaborator']
        ordering = ['-responded_at']
        indexes = [
            models.Index(fields=['delist_request', 'approved']),
        ]

    def __str__(self):
        status = 'Approved' if self.approved else 'Rejected'
        return f"{self.collaborator.username} {status} delist request #{self.delist_request.id}"


class Purchase(models.Model):
    """
    Track NFT purchases with ACTUAL fees from payment providers (Stripe/Circle) and blockchain.

    Payment Flow:
    1. Customer pays gross_amount
    2. Payment provider (Stripe/Circle) charges actual fee
    3. Net after fees = gross - payment_provider_fee
    4. Platform pays gas to mint NFT (actual cost from blockchain)
    5. Net after costs = net_after_fees - mint_cost
    6. Platform gets 10% of net_after_costs
    7. Creator gets 90% of net_after_costs
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    content = models.ForeignKey(Content, on_delete=models.PROTECT, related_name='purchases', null=True, blank=True)
    chapter = models.ForeignKey('Chapter', on_delete=models.PROTECT, related_name='purchases', null=True, blank=True)

    # Batch purchase reference (for cart checkout)
    batch_purchase = models.ForeignKey(
        'BatchPurchase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchases',
        help_text='Parent batch purchase if from cart checkout'
    )

    # Payment provider tracking
    PAYMENT_PROVIDER_CHOICES = [
        ('stripe', 'Stripe'),
        ('circle', 'Circle'),
        ('balance', 'Balance (USDC)'),
        ('coinbase', 'Coinbase Onramp'),
        ('direct_crypto', 'Direct Crypto'),
    ]
    payment_provider = models.CharField(
        max_length=20,
        choices=PAYMENT_PROVIDER_CHOICES,
        default='stripe',
        help_text='Payment provider used for this purchase'
    )

    # Stripe identifiers
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default='')
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, default='')
    stripe_charge_id = models.CharField(max_length=255, blank=True, default='')
    stripe_balance_txn_id = models.CharField(max_length=255, blank=True, default='')

    # NEW: Pricing breakdown with CC fee pass-through
    chapter_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Chapter's list price (what creator set)"
    )
    credit_card_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Fee passed to buyer for credit card processing"
    )
    buyer_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total amount buyer paid (chapter_price + credit_card_fee)"
    )

    # Payment amounts (ACTUAL only, no estimates)
    gross_amount = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="What customer paid"
    )
    stripe_fee = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="ACTUAL fee from Stripe balance_transaction"
    )
    net_after_stripe = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Gross - Stripe fee"
    )
    mint_cost = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="ACTUAL gas cost from blockchain transaction"
    )
    net_after_costs = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Net after Stripe AND gas"
    )
    platform_fee = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="10% of net_after_costs"
    )
    creator_amount = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="90% of net_after_costs"
    )

    # Legacy fields (kept for backward compatibility)
    purchase_price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    creator_earnings_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Blockchain tracking
    nft_mint_address = models.CharField(max_length=255, blank=True, default='',
                                       help_text='Solana NFT mint address')
    transaction_signature = models.CharField(max_length=128, blank=True, default='',
                                            help_text='Solana transaction signature for NFT mint')
    nft_minted = models.BooleanField(default=False)
    nft_mint_eligible_at = models.DateTimeField(null=True, blank=True)

    # USDC distribution tracking (ATOMIC SETTLEMENT)
    # Platform fronts USDC immediately from treasury wallet
    usdc_distribution_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending',
        help_text='Status of atomic USDC distribution'
    )
    platform_usdc_fronted = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Total USDC fronted from platform treasury for this purchase'
    )
    platform_usdc_earned = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Platform 10% fee in USDC (stays in treasury)'
    )
    usdc_distribution_transaction = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Solana transaction signature for atomic USDC distribution'
    )
    usdc_distributed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp of atomic USDC distribution'
    )

    # Collaborator payment breakdown (JSON)
    # Format: {
    #   "collaborators": [
    #     {"wallet": "Creator1...", "percentage": 40, "amount_usdc": 1.045, "role": "writer"},
    #     {"wallet": "Creator2...", "percentage": 30, "amount_usdc": 0.784, "role": "artist"}
    #   ]
    # }
    distribution_details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Breakdown of USDC distribution to collaborators'
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=[
            ('payment_pending', 'Payment Pending'),
            ('payment_completed', 'Payment Completed'),
            ('bridge_pending', 'Awaiting Bridge Conversion'),      # Bridge on-ramp
            ('bridge_converting', 'Converting USD to USDC'),       # Bridge on-ramp
            ('usdc_received', 'USDC Received'),                    # Bridge on-ramp
            ('minting', 'Minting NFT'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('refunded', 'Refunded'),
        ],
        default='payment_pending'
    )

    purchased_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    refunded = models.BooleanField(default=False)

    class Meta:
        ordering = ['-purchased_at']
        indexes = [
            models.Index(fields=['user', 'content']),
            models.Index(fields=['user', 'chapter']),  # For chapter ownership checks
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_provider']),
            models.Index(fields=['usdc_distribution_status']),  # For USDC distribution queries
        ]

    def __str__(self):
        return f"{self.user.username} purchased {self.content.title}"


class CollaboratorPayment(models.Model):
    """
    Individual collaborator payment record for atomic USDC distribution.

    Tracks each creator's payment in the atomic smart contract transaction.
    All collaborators are paid simultaneously in one blockchain transaction.
    """

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='collaborator_payments'
    )
    collaborator = models.ForeignKey(User, on_delete=models.CASCADE)
    collaborator_wallet = models.CharField(max_length=255)
    amount_usdc = models.DecimalField(max_digits=10, decimal_places=6)
    percentage = models.IntegerField(help_text='Revenue percentage (e.g., 40 for 40%)')
    role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Collaborator role (writer, artist, editor, etc.)'
    )
    paid_at = models.DateTimeField(auto_now_add=True)
    transaction_signature = models.CharField(
        max_length=255,
        help_text='Solana transaction signature (same for all collaborators in atomic tx)'
    )

    class Meta:
        unique_together = ['purchase', 'collaborator']
        ordering = ['-paid_at']

    def __str__(self):
        return f"{self.collaborator.username} - {self.amount_usdc} USDC ({self.percentage}%)"


class TreasuryReconciliation(models.Model):
    """
    Weekly treasury reconciliation for tracking platform USDC treasury health.

    Tracks:
    - Total USDC fronted from treasury
    - Platform fees earned
    - Net USDC to replenish
    - Treasury balance and runway
    """

    week_start = models.DateTimeField()
    week_end = models.DateTimeField()
    purchases_count = models.IntegerField()

    # USDC flows
    total_usdc_fronted = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        help_text='Total USDC fronted from treasury this week'
    )
    platform_fees_earned = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        help_text='Total platform fees (10%) earned this week'
    )
    net_usdc_to_replenish = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        help_text='Net USDC needed to replenish (fronted - fees)'
    )

    # Treasury status
    stripe_balance_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Stripe balance in USD at reconciliation time'
    )

    replenishment_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Manual Replenishment'),
            ('in_progress', 'ACH Transfer In Progress'),
            ('completed', 'Completed'),
        ],
        default='pending'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Treasury Reconciliation {self.week_start.date()} - {self.week_end.date()}"


class BlockchainAuditLog(models.Model):
    """
    Append-only audit trail for all blockchain operations.

    Tracks NFT mints, USDC distributions, IPFS uploads, payment detections,
    and treasury reconciliation events. Designed for compliance, debugging,
    and operational visibility.

    All records are immutable once created (no edit/delete in admin).
    """

    ACTION_CHOICES = [
        ('nft_mint', 'NFT Mint'),
        ('usdc_distribute', 'USDC Distribution'),
        ('ipfs_upload', 'IPFS Upload'),
        ('payment_detected', 'Payment Detected'),
        ('treasury_reconciliation', 'Treasury Reconciliation'),
        ('wallet_creation', 'Wallet Creation'),
        ('refund', 'Refund'),
        ('retry', 'Retry Operation'),
    ]

    STATUS_CHOICES = [
        ('started', 'Started'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
    ]

    # Core fields
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='started', db_index=True)

    # Related entities (all nullable for flexibility)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blockchain_audit_logs',
        help_text='User associated with this operation (nullable for system tasks)'
    )
    purchase = models.ForeignKey(
        'Purchase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blockchain_audit_logs',
        help_text='Purchase associated with this operation'
    )
    batch_purchase = models.ForeignKey(
        'BatchPurchase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blockchain_audit_logs',
        help_text='Batch purchase associated with this operation'
    )

    # Blockchain-specific fields
    transaction_signature = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        db_index=True,
        help_text='Solana transaction signature'
    )
    nft_mint_address = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text='NFT mint address if applicable'
    )
    from_wallet = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text='Source wallet address'
    )
    to_wallet = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text='Destination wallet address'
    )

    # Financial tracking
    amount_usdc = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='USDC amount involved in operation'
    )
    gas_fee_usd = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Gas fee in USD'
    )
    platform_fee_usdc = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Platform fee in USDC'
    )

    # Flexible metadata for additional context
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional structured data (IPFS URIs, collaborator details, etc.)'
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text='Error message if operation failed'
    )
    error_code = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='Error code or exception type'
    )

    # Async task tracking
    celery_task_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Celery task ID for async operations'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the operation completed (success or failure)'
    )
    duration_ms = models.IntegerField(
        null=True,
        blank=True,
        help_text='Operation duration in milliseconds'
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Blockchain Audit Log'
        verbose_name_plural = 'Blockchain Audit Logs'
        indexes = [
            models.Index(fields=['action', 'status', 'created_at']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['purchase', 'created_at']),
            models.Index(fields=['transaction_signature']),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else 'system'
        return f"{self.action} ({self.status}) - {user_str} @ {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class ReadingProgress(models.Model):
    """Track user's reading position in content."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reading_progress', db_index=True)
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='reading_progress', db_index=True)

    # Progress tracking
    progress_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="0.00 to 100.00"
    )
    last_position = models.TextField(
        blank=True,
        default='',
        help_text="JSON: scroll position, chapter ID, timestamp, etc."
    )

    # Timestamps
    last_read_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'content']
        ordering = ['-last_read_at']
        indexes = [
            models.Index(fields=['user', 'content']),
            models.Index(fields=['user', '-last_read_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.content.title} ({self.progress_percentage}%)"


class RoleDefinition(models.Model):
    """Standard role definitions with preset capabilities.

    Users can select from standard roles or create custom roles.
    Standard roles automatically populate permissions and UI components.

    Permission structure (JSON):
    {
        "create": ["text", "image", "audio", "video"],
        "edit": {"scope": "own|assigned|all", "types": ["text", ...]},
        "review": ["text", "image", "audio", "video"]
    }

    UI components determine what interface elements the role sees:
    - chapter_editor: Full chapter editing interface
    - image_uploader: Image upload and gallery
    - audio_uploader: Audio upload interface
    - video_uploader: Video upload interface
    - content_viewer: Read-only content view
    - comment_panel: Commenting/annotation tools
    - task_tracker: Contract task display
    """

    CATEGORY_CHOICES = [
        ('creator', 'Creator'),         # Primary content creators
        ('contributor', 'Contributor'), # Secondary content creators
        ('reviewer', 'Reviewer'),       # Review/comment only
        ('technical', 'Technical'),     # Technical roles (editing, mixing)
        ('management', 'Management'),   # Project management
    ]

    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField()

    # Applicable project types
    applicable_to_book = models.BooleanField(default=False)
    applicable_to_art = models.BooleanField(default=False)
    applicable_to_music = models.BooleanField(default=False)
    applicable_to_video = models.BooleanField(default=False)
    applicable_to_comic = models.BooleanField(default=False)

    # Default permissions (JSON)
    default_permissions = models.JSONField(
        default=dict,
        help_text='Default permissions for this role'
    )

    # UI components this role should see
    ui_components = models.JSONField(
        default=list,
        help_text='List of UI components: chapter_editor, image_uploader, etc.'
    )

    # Icon/badge for visual identification
    icon = models.CharField(max_length=50, default='user')
    color = models.CharField(max_length=7, default='#94a3b8')  # Hex color

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.category})"

    def is_applicable_to(self, project_type):
        """Check if this role is applicable to a project type."""
        mapping = {
            'book': self.applicable_to_book,
            'art': self.applicable_to_art,
            'music': self.applicable_to_music,
            'video': self.applicable_to_video,
            'comic': self.applicable_to_comic,
        }
        return mapping.get(project_type, False)


class CollaborativeProject(models.Model):
    """Collaborative project model for multi-creator content.

    - Supports multiple creators working together on books, music, video, or art
    - Tracks project status from draft to minted
    - Manages milestones and revenue splits
    - Requires all collaborators to approve before minting
    """

    CONTENT_TYPE_CHOICES = [
        ('book', 'Book'),
        ('music', 'Music'),
        ('video', 'Video'),
        ('art', 'Art'),
        ('comic', 'Comic'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('ready_for_mint', 'Ready for Mint'),
        ('minted', 'Minted'),
        ('unpublished', 'Unpublished'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=16, choices=CONTENT_TYPE_CHOICES)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    price_usd = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('10.00'),
        help_text="NFT sale price in USD"
    )
    editions = models.PositiveIntegerField(
        default=1,
        help_text="Number of editions available for sale"
    )
    teaser_percent = models.PositiveIntegerField(
        default=10,
        help_text="Percentage of content shown as teaser (0-100)"
    )
    watermark_preview = models.BooleanField(
        default=False,
        help_text="Show watermark on teaser preview"
    )
    authors_note = models.TextField(
        blank=True,
        default='',
        max_length=600,
        help_text="Author's note about this work (max ~100 words)"
    )
    milestones = models.JSONField(default=list, help_text="Milestone definitions and tracking")
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_projects',
        help_text="Project initiator"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Link to Content record for marketplace listing (set when minted)
    published_content = models.ForeignKey(
        'Content',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='source_collaborative_project',
        help_text="Content record created when project is minted"
    )
    # Flag to indicate solo projects (created through solo creation flow)
    is_solo = models.BooleanField(
        default=False,
        help_text="True if this is a solo project (single creator, no collaborators)"
    )
    # Cover image for the project
    cover_image = models.ImageField(
        upload_to='project_covers/',
        null=True,
        blank=True,
        max_length=500,
        help_text="Cover image for the project"
    )

    # Reading direction for comic projects (manga vs western)
    READING_DIRECTION_CHOICES = [
        ('ltr', 'Left-to-Right (Western)'),
        ('rtl', 'Right-to-Left (Manga)'),
    ]
    reading_direction = models.CharField(
        max_length=3,
        choices=READING_DIRECTION_CHOICES,
        default='ltr',
        help_text="Reading direction for comic pages"
    )

    # Dispute/freeze status
    has_active_dispute = models.BooleanField(
        default=False,
        help_text="Whether project has an active dispute (blocks minting)"
    )
    has_active_breach = models.BooleanField(
        default=False,
        help_text="Whether any collaborator has an uncured breach (blocks minting)"
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = ['created_by', 'title']

    def __str__(self):
        return self.title

    def can_mint(self):
        """Check if project can be minted (pre-mint gate checks)."""
        blockers = []

        # Check for active disputes (applies to both solo and collaborative)
        if self.has_active_dispute:
            blockers.append("Active dispute must be resolved")

        # For solo projects, skip collaboration-specific checks
        if self.is_solo:
            return {
                'can_mint': len(blockers) == 0,
                'blockers': blockers
            }

        # Single-creator project is effectively solo — skip collab checks
        accepted = self.collaborators.filter(status='accepted')
        if accepted.count() == 1 and accepted.first().user_id == self.created_by_id:
            return {
                'can_mint': len(blockers) == 0,
                'blockers': blockers
            }

        # --- Collaborative project checks below ---

        # Check for uncured breaches
        if self.collaborators.filter(has_active_breach=True, breach_cured_at__isnull=True).exists():
            blockers.append("Uncured breaches must be resolved")

        # Check all collaborators accepted
        if self.collaborators.filter(status='invited').exists():
            blockers.append("All invitations must be accepted or declined")

        # Check all tasks signed off
        for collab in self.collaborators.filter(status='accepted'):
            if collab.tasks_total > 0 and collab.tasks_signed_off < collab.tasks_total:
                blockers.append(f"Tasks for {collab.user.username} must be signed off")

        # Check all approvals
        if not self.is_fully_approved():
            blockers.append("All collaborators must approve content and revenue split")

        # Check warranty acknowledgments
        if self.collaborators.filter(
            status='accepted',
            warranty_of_originality_acknowledged=False
        ).exists():
            blockers.append("All collaborators must acknowledge warranty of originality")

        return {
            'can_mint': len(blockers) == 0,
            'blockers': blockers
        }

    def is_fully_approved(self):
        """Check if all collaborators have approved the current version and revenue split."""
        # Solo projects are always considered "fully approved" - no team approval needed
        if self.is_solo:
            return True

        collaborators = self.collaborators.filter(status='accepted')
        if not collaborators.exists():
            return False

        # Single-creator project with no other collaborators is effectively solo
        if collaborators.count() == 1 and collaborators.first().user_id == self.created_by_id:
            return True

        return all(
            c.approved_current_version and c.approved_revenue_split
            for c in collaborators
        )

    def total_revenue_percentage(self):
        """Calculate total revenue percentage allocated to all collaborators."""
        from django.db.models import Sum
        result = self.collaborators.filter(status='accepted').aggregate(
            total=Sum('revenue_percentage')
        )
        return result['total'] or Decimal('0.00')


class CollaboratorRole(models.Model):
    """Role assignment for collaborators in a project.

    - Links users to projects with specific roles (Author, Illustrator, etc.)
    - Defines revenue splits and permissions
    - Tracks invitation and approval status
    - Manages editing permissions per content type
    - Supports role-based UI rendering via role_definition
    """

    STATUS_CHOICES = [
        ('invited', 'Invited'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('exited', 'Exited'),
    ]

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='collaborators'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='collaborations'
    )

    # Link to standard role definition (optional)
    role_definition = models.ForeignKey(
        'RoleDefinition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collaborator_instances',
        help_text='Standard role template (if selected)'
    )

    # Custom role name (or uses role_definition.name)
    role = models.CharField(
        max_length=50,
        blank=True,
        help_text="Custom role name (or uses role_definition.name)"
    )

    # Granular permission structure (JSON) - overrides role_definition defaults
    # Format: {
    #   "create": ["text", "image"],
    #   "edit": {"scope": "own|assigned|all", "types": ["text", "image"]},
    #   "review": ["text"],
    #   "custom": {"can_approve_final": true, "can_invite": false}
    # }
    permissions = models.JSONField(
        default=dict,
        blank=True,
        help_text='Granular permissions for this collaborator'
    )

    # Sections explicitly assigned to this collaborator for editing
    assigned_sections = models.ManyToManyField(
        'ProjectSection',
        blank=True,
        related_name='assigned_collaborators',
        help_text='Specific sections this collaborator can edit'
    )
    revenue_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Revenue share percentage (0.00 to 100.00)"
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='invited')

    # Permissions by content type
    can_edit_text = models.BooleanField(default=False)
    can_edit_images = models.BooleanField(default=False)
    can_edit_audio = models.BooleanField(default=False)
    can_edit_video = models.BooleanField(default=False)

    # Approval tracking
    approved_current_version = models.BooleanField(default=False)
    approved_revenue_split = models.BooleanField(default=False)

    # Counter-proposal fields (for invitee to propose different terms)
    proposed_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Counter-proposed revenue percentage"
    )
    counter_message = models.TextField(
        blank=True,
        help_text="Message explaining the counter-proposal"
    )

    # Deadline and accountability fields
    delivery_deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline for collaborator to complete their sections"
    )
    deadline_extended_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When deadline was last extended"
    )
    deadline_extension_reason = models.TextField(
        blank=True,
        help_text="Reason for deadline extension"
    )
    sections_due = models.JSONField(
        default=list,
        blank=True,
        help_text="List of section IDs the collaborator is responsible for"
    )

    # Multi-party governance fields
    is_lead = models.BooleanField(
        default=False,
        help_text="Lead collaborator with additional permissions"
    )
    can_invite_others = models.BooleanField(
        default=False,
        help_text="Can invite additional collaborators to the project"
    )
    voting_weight = models.IntegerField(
        default=1,
        help_text="Weight of vote in proposals (default 1)"
    )

    # Contract management fields (for task-based collaboration)
    contract_version = models.PositiveIntegerField(
        default=1,
        help_text="Version of the contract, incremented on acceptance"
    )
    contract_locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when contract was locked (on acceptance)"
    )
    contract_effective_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When contract obligations begin (defaults to acceptance date if not set)"
    )
    # Breach tracking (enhanced)
    BREACH_TYPE_CHOICES = [
        ('deadline', 'Deadline Breach'),
        ('quality', 'Quality Breach'),
        ('communication', 'Communication Breach'),
        ('abandonment', 'Abandonment'),
        ('scope', 'Scope Violation'),
        ('confidentiality', 'Confidentiality Breach'),
    ]

    BREACH_SEVERITY_CHOICES = [
        ('minor', 'Minor'),       # Warning on record
        ('moderate', 'Moderate'), # Revenue reduction eligible
        ('severe', 'Severe'),     # Termination eligible
        ('critical', 'Critical'), # Immediate termination + legal
    ]

    has_active_breach = models.BooleanField(
        default=False,
        help_text="Whether collaborator has an active breach"
    )
    current_breach_type = models.CharField(
        max_length=20,
        choices=BREACH_TYPE_CHOICES,
        blank=True,
        help_text="Type of current active breach"
    )
    current_breach_severity = models.CharField(
        max_length=20,
        choices=BREACH_SEVERITY_CHOICES,
        blank=True,
        help_text="Severity level of current breach"
    )
    breach_detected_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the current breach was detected"
    )
    cure_deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline to cure the breach"
    )
    cure_actions_required = models.TextField(
        blank=True,
        help_text="Description of actions needed to cure the breach"
    )
    breach_cured_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the breach was cured (null if uncured)"
    )
    breach_contested = models.BooleanField(
        default=False,
        help_text="Whether the collaborator has contested this breach"
    )
    breach_count = models.PositiveIntegerField(
        default=0,
        help_text="Cumulative count of breaches for this collaboration"
    )
    cancellation_eligible = models.BooleanField(
        default=False,
        help_text="Whether owner can cancel due to breach"
    )

    # Warranty of originality acknowledgment
    warranty_of_originality_acknowledged = models.BooleanField(
        default=False,
        help_text="Collaborator acknowledges their contributions are original work"
    )
    warranty_acknowledged_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When warranty of originality was acknowledged"
    )

    # Denormalized task counters for performance
    tasks_total = models.PositiveIntegerField(
        default=0,
        help_text="Total number of contract tasks"
    )
    tasks_signed_off = models.PositiveIntegerField(
        default=0,
        help_text="Number of tasks signed off by owner"
    )

    class Meta:
        unique_together = ['project', 'user']
        ordering = ['-revenue_percentage']

    def __str__(self):
        role_name = self.effective_role_name
        return f"{self.user.username} - {role_name} ({self.revenue_percentage}%)"

    @property
    def effective_role_name(self):
        """Get role name from definition or custom field."""
        if self.role_definition:
            return self.role_definition.name
        return self.role or 'Collaborator'

    @property
    def effective_permissions(self):
        """
        Merge default permissions from role_definition with custom overrides.
        Legacy boolean flags are always included as a fallback layer.
        """
        # Start with legacy boolean flags as the base
        legacy_perms = {
            'create': [],
            'edit': {'scope': 'own', 'types': []},
            'review': []
        }
        if self.can_edit_text:
            legacy_perms['create'].append('text')
            legacy_perms['edit']['types'].append('text')
        if self.can_edit_images:
            legacy_perms['create'].append('image')
            legacy_perms['edit']['types'].append('image')
        if self.can_edit_audio:
            legacy_perms['create'].append('audio')
            legacy_perms['edit']['types'].append('audio')
        if self.can_edit_video:
            legacy_perms['create'].append('video')
            legacy_perms['edit']['types'].append('video')

        # Layer role_definition permissions on top
        role_perms = None
        if self.role_definition:
            role_perms = self.role_definition.default_permissions.copy() if self.role_definition.default_permissions else None
        elif self.role:
            # Fallback: try to look up RoleDefinition by name
            try:
                role_def = RoleDefinition.objects.filter(name=self.role).first()
                if role_def and role_def.default_permissions:
                    role_perms = role_def.default_permissions.copy()
            except Exception:
                pass

        # Merge: role_perms extends legacy_perms (combine types lists)
        if role_perms:
            merged = legacy_perms.copy()
            for key, value in role_perms.items():
                if key == 'edit' and isinstance(value, dict):
                    merged['edit'] = {
                        'scope': value.get('scope', merged['edit'].get('scope', 'own')),
                        'types': list(set(merged['edit'].get('types', []) + value.get('types', [])))
                    }
                elif key in ('create', 'review') and isinstance(value, list):
                    merged[key] = list(set(merged.get(key, []) + value))
                else:
                    merged[key] = value
        else:
            merged = legacy_perms

        # Custom permissions override everything
        if self.permissions:
            for key, value in self.permissions.items():
                merged[key] = value

        return merged

    def get_ui_components(self):
        """Get list of UI components this role should see."""
        if self.role_definition and self.role_definition.ui_components:
            return self.role_definition.ui_components

        # Fallback: try to look up RoleDefinition by name
        if self.role:
            try:
                role_def = RoleDefinition.objects.filter(name=self.role).first()
                if role_def and role_def.ui_components:
                    return role_def.ui_components
            except Exception:
                pass

        # Final fallback: derive from legacy boolean flags
        components = []
        if self.can_edit_text:
            components.append('chapter_editor')
        if self.can_edit_images:
            components.append('image_uploader')
        if self.can_edit_audio:
            components.append('audio_uploader')
        if self.can_edit_video:
            components.append('video_uploader')
        components.append('task_tracker')

        return components

    def can_create_section_type(self, section_type):
        """Check if collaborator can create new sections of this type."""
        perms = self.effective_permissions
        return section_type in perms.get('create', [])

    def can_edit_section_instance(self, section):
        """Check if collaborator can edit a specific section instance."""
        perms = self.effective_permissions
        edit_config = perms.get('edit', {})

        # Check type permission
        if section.section_type not in edit_config.get('types', []):
            return False

        # Check scope
        scope = edit_config.get('scope', 'own')
        if scope == 'all':
            return True
        elif scope == 'own':
            return section.owner == self.user
        elif scope == 'assigned':
            return section in self.assigned_sections.all()

        return False

    def can_review_section_type(self, section_type):
        """Check if collaborator can review/comment on this type."""
        perms = self.effective_permissions
        return section_type in perms.get('review', [])

    @property
    def all_tasks_complete(self):
        """Check if all contract tasks have been signed off."""
        return self.tasks_total > 0 and self.tasks_signed_off == self.tasks_total

    def can_edit_section(self, section_type):
        """Check if this collaborator can edit a specific section type (legacy method)."""
        # First check new permission system
        perms = self.effective_permissions
        edit_config = perms.get('edit', {})
        if section_type in edit_config.get('types', []):
            return True

        # Fallback to legacy boolean flags
        permission_map = {
            'text': self.can_edit_text,
            'image': self.can_edit_images,
            'audio': self.can_edit_audio,
            'video': self.can_edit_video,
        }
        return permission_map.get(section_type, False)

    def update_task_counts(self):
        """Update denormalized task counters from actual ContractTask records."""
        self.tasks_total = self.contract_tasks.count()
        self.tasks_signed_off = self.contract_tasks.filter(status='signed_off').count()
        self.save(update_fields=['tasks_total', 'tasks_signed_off'])

    def trigger_breach(self, breach_type, severity, cure_actions, notify=True):
        """
        Trigger a breach for this collaborator.

        Cure periods by severity:
        - minor: 7 days
        - moderate: 14 days
        - severe: 7 days
        - critical: 0 days (immediate)
        """
        from datetime import timedelta
        now = timezone.now()

        cure_days = {
            'minor': 7,
            'moderate': 14,
            'severe': 7,
            'critical': 0,
        }

        # Halve cure period for repeat offenders (3+ breaches)
        days = cure_days.get(severity, 7)
        if self.breach_count >= 2:
            days = max(0, days // 2)

        self.has_active_breach = True
        self.current_breach_type = breach_type
        self.current_breach_severity = severity
        self.breach_detected_at = now
        self.cure_deadline = now + timedelta(days=days) if days > 0 else now
        self.cure_actions_required = cure_actions
        self.breach_cured_at = None
        self.breach_contested = False
        self.breach_count += 1

        # Set cancellation eligibility for severe/critical breaches
        if severity in ['severe', 'critical']:
            self.cancellation_eligible = True

        self.save()

        # TODO: Send breach notification to collaborator if notify=True
        return self

    def cure_breach(self, notes=''):
        """Mark the current breach as cured."""
        if not self.has_active_breach:
            raise ValueError("No active breach to cure")

        now = timezone.now()
        self.has_active_breach = False
        self.breach_cured_at = now
        self.cancellation_eligible = False
        self.save()

        return self

    def contest_breach(self, reason=''):
        """Collaborator contests the breach, triggering dispute escalation."""
        if not self.has_active_breach:
            raise ValueError("No active breach to contest")

        self.breach_contested = True
        self.save()

        # This should trigger creation of a Dispute record
        return self

    def check_quality_breach(self):
        """Check if task rejection count triggers a quality breach."""
        # Quality breach: 3+ rejections on same task
        for task in self.contract_tasks.all():
            if task.rejection_count >= 3 and not self.has_active_breach:
                self.trigger_breach(
                    breach_type='quality',
                    severity='moderate',
                    cure_actions=f'Submit acceptable revision for task: {task.title}'
                )
                return True
        return False

    def check_abandonment(self, days_threshold=30):
        """Check for abandonment (no activity for threshold days)."""
        from datetime import timedelta
        now = timezone.now()

        # Check if any task has been updated in the threshold period
        recent_activity = self.contract_tasks.filter(
            updated_at__gte=now - timedelta(days=days_threshold)
        ).exists()

        if not recent_activity and not self.has_active_breach and self.status == 'accepted':
            if self.tasks_signed_off < self.tasks_total:  # Still has pending work
                self.trigger_breach(
                    breach_type='abandonment',
                    severity='severe',
                    cure_actions='Resume active work on assigned tasks'
                )
                return True
        return False


class ContractTask(models.Model):
    """Individual task within a collaboration contract.

    Tasks are defined during invite and become immutable once accepted.
    Changes require a Proposal with unanimous approval.

    Lifecycle:
    - pending: Task defined but contract not yet accepted
    - in_progress: Contract accepted, collaborator working on task
    - complete: Collaborator marked task as done, awaiting owner sign-off
    - signed_off: Owner verified and approved the completed work
    - cancelled: Task cancelled via unanimous Proposal
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),           # Before contract acceptance
        ('in_progress', 'In Progress'),   # Default after acceptance
        ('complete', 'Marked Complete'),  # Collaborator marked done
        ('signed_off', 'Signed Off'),     # Owner verified and approved
        ('cancelled', 'Cancelled'),       # Task cancelled via Proposal
    ]

    collaborator_role = models.ForeignKey(
        CollaboratorRole,
        on_delete=models.CASCADE,
        related_name='contract_tasks',
        help_text="The collaborator responsible for this task"
    )
    title = models.CharField(
        max_length=200,
        help_text="Brief title describing the deliverable"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of what's expected"
    )
    deadline = models.DateTimeField(
        help_text="Deadline for task completion"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Completion tracking (two-step approval)
    marked_complete_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When collaborator marked task complete"
    )
    marked_complete_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_marked_complete',
        help_text="User who marked the task complete"
    )
    completion_notes = models.TextField(
        blank=True,
        help_text="Notes from collaborator when marking complete"
    )

    # Sign-off tracking (owner approval)
    signed_off_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When owner signed off on the task"
    )
    signed_off_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_signed_off',
        help_text="Owner who signed off on the task"
    )
    signoff_notes = models.TextField(
        blank=True,
        help_text="Notes from owner when signing off"
    )

    # Rejection tracking (for when owner rejects completion)
    rejection_notes = models.TextField(
        blank=True,
        help_text="Reason for rejecting the completion"
    )
    rejected_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the completion was rejected"
    )
    rejection_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this task has been rejected (3+ triggers quality breach)"
    )

    # Breach tracking
    is_overdue = models.BooleanField(
        default=False,
        help_text="Whether task has passed its deadline without sign-off"
    )
    overdue_notified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When overdue notification was sent"
    )

    # Ordering within the contract
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order of task in contract"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'deadline']
        indexes = [
            models.Index(fields=['collaborator_role', 'status']),
            models.Index(fields=['deadline', 'status']),
            models.Index(fields=['is_overdue']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    def mark_complete(self, user, notes=''):
        """Collaborator marks their task as complete."""
        if self.status != 'in_progress':
            raise ValueError(f"Cannot mark task complete: current status is {self.status}")

        self.status = 'complete'
        self.marked_complete_at = timezone.now()
        self.marked_complete_by = user
        self.completion_notes = notes
        self.save()

    def sign_off(self, owner, notes=''):
        """Owner signs off on completed task."""
        if self.status != 'complete':
            raise ValueError(f"Cannot sign off: task status is {self.status}, expected 'complete'")

        self.status = 'signed_off'
        self.signed_off_at = timezone.now()
        self.signed_off_by = owner
        self.signoff_notes = notes
        self.save()

        # Update denormalized counters on CollaboratorRole
        self.collaborator_role.update_task_counts()

    def reject_completion(self, owner, reason):
        """Owner rejects the completion and sends back for revision.

        After 3 rejections on the same task, triggers a quality breach.
        """
        if self.status != 'complete':
            raise ValueError(f"Cannot reject: task status is {self.status}, expected 'complete'")

        self.status = 'in_progress'
        self.rejection_notes = reason
        self.rejected_at = timezone.now()
        self.rejection_count += 1

        # Clear completion tracking
        self.marked_complete_at = None
        self.marked_complete_by = None
        self.completion_notes = ''
        self.save()

        # Check for quality breach (3+ rejections)
        self.collaborator_role.check_quality_breach()

    def check_overdue(self):
        """Check if task is overdue and update breach status if needed."""
        if self.status in ['signed_off', 'cancelled']:
            return False  # Already resolved

        if timezone.now() > self.deadline and not self.is_overdue:
            self.is_overdue = True
            self.overdue_notified_at = timezone.now()
            self.save()

            # Trigger deadline breach using the new breach system
            role = self.collaborator_role
            if not role.has_active_breach:
                role.trigger_breach(
                    breach_type='deadline',
                    severity='minor',  # First deadline breach is minor
                    cure_actions=f'Complete overdue task: {self.title}'
                )

            return True  # Newly overdue
        return self.is_overdue


class Dispute(models.Model):
    """Dispute tracking for collaboration conflicts (PRE-MINT ONLY).

    Escalation levels:
    0 - Self-resolution (proposals/voting)
    1 - Structured negotiation (formal ticket, 7-day window)
    2 - Platform mediation (staff review, non-binding recommendation)
    3 - Binding resolution (platform decision or external arbitration)

    Once a project is minted, disputes are impossible - the smart contract governs.
    """

    CATEGORY_CHOICES = [
        ('revenue', 'Revenue Dispute'),
        ('quality', 'Quality Dispute'),
        ('deadline', 'Deadline Dispute'),
        ('scope', 'Scope Dispute'),
        ('attribution', 'Attribution Dispute'),
        ('bad_faith', 'Bad Faith / Fraud'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('negotiating', 'Negotiating'),
        ('mediating', 'Under Mediation'),
        ('binding', 'Binding Decision Pending'),
        ('resolved', 'Resolved'),
        ('withdrawn', 'Withdrawn'),
    ]

    LEVEL_CHOICES = [
        (0, 'Self-Resolution'),
        (1, 'Structured Negotiation'),
        (2, 'Platform Mediation'),
        (3, 'Binding Resolution'),
    ]

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='disputes',
        help_text="Project this dispute relates to"
    )
    opened_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='disputes_opened',
        help_text="User who opened the dispute"
    )
    respondent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='disputes_against',
        help_text="User the dispute is against"
    )
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        help_text="Category of dispute"
    )
    level = models.PositiveIntegerField(
        choices=LEVEL_CHOICES,
        default=1,
        help_text="Current escalation level"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open'
    )

    # Dispute content
    title = models.CharField(
        max_length=200,
        help_text="Brief title describing the dispute"
    )
    opener_position = models.TextField(
        help_text="Opening party's statement of the dispute"
    )
    respondent_position = models.TextField(
        blank=True,
        help_text="Respondent's statement/defense"
    )

    # Mediation/resolution
    mediator_recommendation = models.TextField(
        blank=True,
        help_text="Platform mediator's non-binding recommendation"
    )
    final_decision = models.TextField(
        blank=True,
        help_text="Binding decision if escalated to level 3"
    )
    decision_by = models.CharField(
        max_length=50,
        blank=True,
        help_text="Who made the final decision (username or 'platform')"
    )

    # Timestamps
    opened_at = models.DateTimeField(auto_now_add=True)
    escalated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When dispute was last escalated"
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When dispute was resolved"
    )

    # Related breach (if dispute stems from breach contest)
    related_breach = models.BooleanField(
        default=False,
        help_text="Whether this dispute is from a contested breach"
    )

    class Meta:
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['opened_by', 'status']),
            models.Index(fields=['respondent', 'status']),
        ]

    def __str__(self):
        return f"Dispute: {self.title} ({self.get_status_display()})"

    def escalate(self):
        """Escalate dispute to next level."""
        if self.level >= 3:
            raise ValueError("Cannot escalate beyond level 3")

        self.level += 1
        self.escalated_at = timezone.now()

        # Update status based on level
        if self.level == 1:
            self.status = 'negotiating'
        elif self.level == 2:
            self.status = 'mediating'
        elif self.level == 3:
            self.status = 'binding'

        self.save()

        # Freeze project actions
        self.project.has_active_dispute = True
        self.project.save(update_fields=['has_active_dispute'])

        return self

    def resolve(self, resolution, decision_by='platform'):
        """Resolve the dispute."""
        self.status = 'resolved'
        self.final_decision = resolution
        self.decision_by = decision_by
        self.resolved_at = timezone.now()
        self.save()

        # Unfreeze project if no other active disputes
        active_disputes = self.project.disputes.filter(
            status__in=['open', 'negotiating', 'mediating', 'binding']
        ).exclude(id=self.id).exists()

        if not active_disputes:
            self.project.has_active_dispute = False
            self.project.save(update_fields=['has_active_dispute'])

        return self

    def withdraw(self):
        """Opener withdraws the dispute."""
        self.status = 'withdrawn'
        self.resolved_at = timezone.now()
        self.save()

        # Unfreeze project if no other active disputes
        active_disputes = self.project.disputes.filter(
            status__in=['open', 'negotiating', 'mediating', 'binding']
        ).exclude(id=self.id).exists()

        if not active_disputes:
            self.project.has_active_dispute = False
            self.project.save(update_fields=['has_active_dispute'])

        return self


class DisputeMessage(models.Model):
    """Messages within a dispute thread."""

    dispute = models.ForeignKey(
        Dispute,
        on_delete=models.CASCADE,
        related_name='messages',
        help_text="Parent dispute"
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="Message author"
    )
    content = models.TextField(
        help_text="Message content"
    )
    is_mediator = models.BooleanField(
        default=False,
        help_text="Whether this message is from platform mediator"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message by {self.author.username} on {self.dispute.title}"


class ProjectSection(models.Model):
    """Individual section within a collaborative project.

    - Represents discrete content blocks (text, image, audio, video)
    - Assigned to specific collaborators for editing
    - Ordered sequentially within the project
    - Supports mixed media content
    """

    SECTION_TYPE_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('audio', 'Audio'),
        ('video', 'Video'),
    ]

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='sections'
    )
    section_type = models.CharField(max_length=16, choices=SECTION_TYPE_CHOICES)
    title = models.CharField(max_length=200, blank=True)
    content_html = models.TextField(blank=True, help_text="For text sections")
    synopsis = models.TextField(blank=True, default='', help_text="Brief summary of this section (max ~150 words)")
    media_file = models.FileField(
        upload_to='collaborative_content/',
        blank=True,
        null=True,
        help_text="For image, audio, or video sections"
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="Collaborator who can edit this section"
    )
    order = models.IntegerField(default=0, help_text="Display order within project")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Asset provenance tracking (for termination/split handling)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_sections',
        help_text="User who uploaded the current media file"
    )
    is_derivative = models.BooleanField(
        default=False,
        help_text="True if content is derived from another collaborator's work"
    )
    parent_section = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derivatives',
        help_text="Original section this was derived from (for derivative tracking)"
    )

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ['project', 'order']

    def __str__(self):
        return f"{self.project.title} - {self.section_type} #{self.order}"

    @property
    def is_separable(self):
        """
        Determine if this section can be cleanly separated on termination.
        Separable = uploaded as original by owner, not derived from others.
        """
        return not self.is_derivative and (
            self.uploaded_by is None or self.uploaded_by == self.owner
        )


class ProjectComment(models.Model):
    """Comments and discussions on collaborative projects.

    - Supports threaded discussions via parent_comment
    - Can be attached to entire project or specific sections
    - Resolvable for issue tracking
    - Maintains conversation history
    """

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    section = models.ForeignKey(
        ProjectSection,
        on_delete=models.CASCADE,
        related_name='comments',
        null=True,
        blank=True,
        help_text="Optional: specific section this comment refers to"
    )
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    parent_comment = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        help_text="For threaded discussions"
    )

    # Enhanced features
    mentions = models.ManyToManyField(
        User,
        related_name='mentioned_in_comments',
        blank=True,
        help_text="Users mentioned in this comment with @username"
    )
    edit_history = models.JSONField(
        default=list,
        blank=True,
        help_text="History of edits with timestamps and previous content"
    )

    # Status and timestamps
    resolved = models.BooleanField(default=False)
    edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
            models.Index(fields=['section', '-created_at']),
            models.Index(fields=['parent_comment', '-created_at']),
        ]

    def __str__(self):
        return f"Comment by {self.author.username} on {self.project.title}"

    def get_thread_depth(self):
        """Calculate the depth of this comment in the thread."""
        depth = 0
        current = self.parent_comment
        while current is not None:
            depth += 1
            current = current.parent_comment
        return depth

    def get_reply_count(self):
        """Get total number of replies (including nested)."""
        count = self.replies.count()
        for reply in self.replies.all():
            count += reply.get_reply_count()
        return count


class CommentReaction(models.Model):
    """Emoji reactions on comments.

    - Users can react to comments with emojis
    - One reaction type per user per comment
    - Supports common emoji reactions
    """

    REACTION_TYPES = [
        ('👍', 'Thumbs Up'),
        ('👎', 'Thumbs Down'),
        ('❤️', 'Heart'),
        ('😊', 'Smile'),
        ('😂', 'Laugh'),
        ('🎉', 'Party'),
        ('🚀', 'Rocket'),
        ('👀', 'Eyes'),
    ]

    comment = models.ForeignKey(
        ProjectComment,
        on_delete=models.CASCADE,
        related_name='reactions'
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=10, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['comment', 'user', 'emoji']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to comment {self.comment.id}"


class CommentAttachment(models.Model):
    """File attachments on comments.

    - Support for images, documents, and other files
    - Tracks file metadata and upload info
    """

    comment = models.ForeignKey(
        ProjectComment,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='comment_attachments/%Y/%m/')
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField(help_text="File size in bytes")
    file_type = models.CharField(max_length=100, help_text="MIME type")
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"Attachment: {self.filename} on comment {self.comment.id}"

    def get_file_size_display(self):
        """Return human-readable file size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"


# =============================================================================
# Comic Book Collaboration Models
# =============================================================================

class ComicSeries(models.Model):
    """Series container for multiple comic issues/volumes.

    Similar to BookProject but for sequential comic publications.
    Allows publishing individual issues or the entire series as NFTs.
    """
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comic_series')
    title = models.CharField(max_length=255)
    synopsis = models.TextField(blank=True, default='', help_text="Series description")
    cover_image = models.ImageField(upload_to='comic_series_covers/', null=True, blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)
    published_content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='source_comic_series'
    )

    class Meta:
        ordering = ['-updated_at']
        verbose_name_plural = 'Comic Series'
        unique_together = ['creator', 'title']

    def __str__(self):
        return f"{self.title} by {self.creator.username}"

    def issue_count(self):
        return self.issues.count()


class ComicIssue(models.Model):
    """Individual comic issue within a series or standalone.

    Like Chapter for books - can be published individually or as part of series.
    Each issue contains multiple pages with panels and speech bubbles.
    """
    # Can belong to a series OR be standalone via CollaborativeProject
    series = models.ForeignKey(
        ComicSeries,
        on_delete=models.CASCADE,
        related_name='issues',
        null=True,
        blank=True,
        help_text="Optional series this issue belongs to"
    )
    # Also linked to CollaborativeProject for collaboration features
    project = models.ForeignKey(
        'CollaborativeProject',
        on_delete=models.CASCADE,
        related_name='comic_issues',
        null=True,
        blank=True,
        help_text="Collaborative project for this issue"
    )

    title = models.CharField(max_length=255)
    issue_number = models.PositiveIntegerField(default=1)
    synopsis = models.TextField(blank=True, default='', help_text="Issue synopsis")
    cover_image = models.ImageField(upload_to='comic_issue_covers/', null=True, blank=True, max_length=500)

    # Pricing
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1.00,
        help_text="Price in USD for this issue"
    )

    # Publishing state
    is_published = models.BooleanField(default=False)
    published_content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='source_comic_issue'
    )

    # Marketplace listing
    is_listed = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this issue is visible in the marketplace"
    )
    delisted_at = models.DateTimeField(null=True, blank=True)
    delisted_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='delisted_comic_issues'
    )
    delisted_reason = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['issue_number', 'created_at']

    def __str__(self):
        if self.series:
            return f"{self.series.title} - Issue #{self.issue_number}: {self.title}"
        return f"Issue #{self.issue_number}: {self.title}"

    def page_count(self):
        return self.issue_pages.count()

    def get_collaborators_with_wallets(self):
        """Get collaborators from linked project or series creator."""
        if self.project:
            # Delegate to project's collaboration system
            collaborators = []
            for role in self.project.collaborators.filter(status='accepted'):
                if role.user.wallet_address:
                    collaborators.append({
                        'user': role.user,
                        'wallet': role.user.wallet_address,
                        'percentage': role.revenue_percentage,
                        'role': role.role
                    })
            return collaborators

        # Solo issue - return series creator or issue owner
        creator = self.series.creator if self.series else None
        if creator and creator.wallet_address:
            return [{
                'user': creator,
                'wallet': creator.wallet_address,
                'percentage': 90,
                'role': 'creator'
            }]
        return []

    def get_purchase_count(self):
        """Count how many purchases (NFT mints) this issue has."""
        if not self.published_content:
            return 0
        from .models import Purchase
        return Purchase.objects.filter(
            content=self.published_content,
            refunded=False,
            status__in=['payment_completed', 'completed', 'minting']
        ).count()

    def has_any_sales(self):
        """Check if any NFTs have been minted/sold for this issue."""
        return self.get_purchase_count() > 0


class ComicPage(models.Model):
    """Represents a single page in a comic book project.

    - Each page contains multiple panels
    - Pages are ordered sequentially
    - Pages can have different aspect ratios (standard, manga, webtoon)
    - Supports line-based panel layout (v2) or legacy rectangle-based (v1)
    """

    PAGE_FORMAT_CHOICES = [
        ('standard', 'Standard (Letter 8.5x11)'),
        ('manga', 'Manga (B5)'),
        ('webtoon', 'Webtoon (Vertical Scroll)'),
        ('custom', 'Custom'),
    ]

    # Page orientation presets for the line-based editor
    ORIENTATION_CHOICES = [
        ('portrait', 'Portrait (8.5x11)'),
        ('landscape', 'Landscape (11x8.5)'),
        ('square', 'Square (10x10)'),
        ('webtoon', 'Webtoon (Vertical Scroll)'),
        ('manga_b5', 'Manga B5'),
        ('social_square', 'Social Square (1:1)'),
        ('social_story', 'Social Story (9:16)'),
    ]

    # New: Pages can belong to an issue (for chapter-based publishing)
    issue = models.ForeignKey(
        ComicIssue,
        on_delete=models.CASCADE,
        related_name='issue_pages',
        null=True,
        blank=True,
        help_text="Issue this page belongs to (for chapter-based publishing)"
    )
    # Legacy: Keep project FK for backward compatibility during migration
    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='comic_pages',
        null=True,  # Made nullable for migration
        blank=True
    )
    page_number = models.PositiveIntegerField()
    page_format = models.CharField(
        max_length=20,
        choices=PAGE_FORMAT_CHOICES,
        default='standard'
    )
    # Canvas dimensions in pixels (for custom sizing)
    canvas_width = models.PositiveIntegerField(default=2550)  # 8.5" at 300dpi
    canvas_height = models.PositiveIntegerField(default=3300)  # 11" at 300dpi

    # Page-level background (optional)
    background_image = models.FileField(
        upload_to='comic_pages/',
        blank=True,
        null=True
    )
    background_color = models.CharField(max_length=7, default='#FFFFFF')

    # Line-based layout settings (v2)
    orientation = models.CharField(
        max_length=20,
        choices=ORIENTATION_CHOICES,
        default='portrait',
        help_text="Page orientation/aspect ratio preset"
    )
    gutter_mode = models.BooleanField(
        default=True,
        help_text="True = visible gutters between panels, False = border lines only"
    )
    default_gutter_width = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.5,
        help_text="Default gutter/line width in percentage of page width"
    )
    default_line_color = models.CharField(
        max_length=7,
        default='#6b7280',  # Grey like pencil
        help_text="Default color for divider lines"
    )
    layout_version = models.IntegerField(
        default=2,
        help_text="1 = legacy rectangle-based panels, 2 = line-based dividers"
    )

    # Script data for writer-to-artist collaboration
    # Structure: { "page_description": "...", "panels": [{ "panel_number": 1, "scene": "...", "dialogue": "...", "notes": "..." }] }
    script_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured script data for this page (description, panel scripts)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page_number']
        # Note: unique_together with nullable fields may not enforce uniqueness
        # We use both constraints to support migration period
        constraints = [
            models.UniqueConstraint(
                fields=['issue', 'page_number'],
                name='unique_issue_page_number',
                condition=models.Q(issue__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['project', 'page_number'],
                name='unique_project_page_number',
                condition=models.Q(project__isnull=False)
            ),
        ]

    def __str__(self):
        if self.issue:
            return f"{self.issue.title} - Page {self.page_number}"
        elif self.project:
            return f"{self.project.title} - Page {self.page_number}"
        return f"Page {self.page_number}"


class ComicPanel(models.Model):
    """Individual panel within a comic page.

    - Freeform positioning (x, y, width, height as percentages)
    - Can overlap other panels for creative layouts
    - Artist uploads art, writer adds bubbles separately
    """

    BORDER_STYLE_CHOICES = [
        ('solid', 'Solid'),
        ('dashed', 'Dashed'),
        ('none', 'None'),
        ('jagged', 'Jagged/Action'),
        ('wavy', 'Wavy'),
    ]

    ARTWORK_FIT_CHOICES = [
        ('contain', 'Contain'),
        ('cover', 'Cover'),
        ('fill', 'Fill'),
    ]

    page = models.ForeignKey(
        ComicPage,
        on_delete=models.CASCADE,
        related_name='panels'
    )

    # Positioning (as percentages 0-100 of page canvas)
    x_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    y_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    width_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    height_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)

    # Z-index for layering
    z_index = models.IntegerField(default=0)

    # Panel styling
    border_style = models.CharField(
        max_length=20,
        choices=BORDER_STYLE_CHOICES,
        default='solid'
    )
    border_width = models.PositiveIntegerField(default=2)
    border_color = models.CharField(max_length=7, default='#000000')
    border_radius = models.PositiveIntegerField(default=0)
    background_color = models.CharField(max_length=7, default='#FFFFFF')

    # Rotation in degrees (-180 to 180)
    rotation = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Skew transforms for diagonal/dynamic panel effects (-45 to 45 degrees)
    skew_x = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    skew_y = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Panel content (artwork uploaded by artist)
    artwork = models.FileField(
        upload_to='comic_panels/',
        max_length=500,  # Allow long filenames
        blank=True,
        null=True,
        help_text="Panel artwork uploaded by artist"
    )
    artwork_fit = models.CharField(
        max_length=20,
        choices=ARTWORK_FIT_CHOICES,
        default='cover'
    )

    # Ownership/assignment
    artist = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_panels',
        help_text="Artist responsible for this panel's artwork"
    )

    # Derivative tracking (for termination/split handling)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_panels',
        help_text="User who uploaded the current artwork"
    )
    is_derivative = models.BooleanField(
        default=False,
        help_text="True if artwork is derived from another collaborator's work"
    )
    source_panel = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derivatives',
        help_text="Original panel this was derived from"
    )

    order = models.PositiveIntegerField(default=0, help_text="Reading order within page")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page', 'order', 'z_index']

    def __str__(self):
        return f"Panel {self.order} on Page {self.page.page_number}"

    @property
    def is_separable(self):
        """
        Determine if this panel can be cleanly separated on termination.
        """
        return not self.is_derivative and (
            self.uploaded_by is None or self.uploaded_by == self.artist
        )


class ArtworkLibraryItem(models.Model):
    """Reusable artwork assets for comic collaboration projects.

    - Project-wide artwork library (shared across all issues)
    - Supports drag-and-drop to panels
    - Tracks original uploader for attribution
    """

    project = models.ForeignKey(
        'CollaborativeProject',
        on_delete=models.CASCADE,
        related_name='artwork_library',
        help_text="Parent comic project"
    )

    file = models.FileField(
        upload_to='artwork_library/',
        max_length=500,
        help_text="Original artwork file"
    )

    # Optional thumbnail (can use same file for small images)
    thumbnail = models.FileField(
        upload_to='artwork_library/thumbnails/',
        max_length=500,
        blank=True,
        null=True,
        help_text="Thumbnail for sidebar display"
    )

    # Metadata
    title = models.CharField(max_length=200, blank=True, help_text="Display name")
    filename = models.CharField(max_length=255, help_text="Original filename")

    # Dimensions for UI display hints
    width = models.PositiveIntegerField(default=0, help_text="Image width in pixels")
    height = models.PositiveIntegerField(default=0, help_text="Image height in pixels")
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")

    # Attribution
    uploader = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_artwork',
        help_text="User who uploaded this artwork"
    )

    # Usage tracking
    usage_count = models.PositiveIntegerField(default=0, help_text="Times used in panels")

    # Derivative tracking (for termination/split handling)
    is_derivative = models.BooleanField(
        default=False,
        help_text="True if artwork is derived from another collaborator's work"
    )
    source_artwork = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derivatives',
        help_text="Original artwork this was derived from"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Artwork Library Item"
        verbose_name_plural = "Artwork Library Items"

    def __str__(self):
        return f"{self.title or self.filename} ({self.project.title})"

    @property
    def is_separable(self):
        """
        Determine if this artwork can be cleanly separated on termination.
        """
        return not self.is_derivative

    def save(self, *args, **kwargs):
        # Auto-populate filename from file if not set
        if self.file and not self.filename:
            self.filename = self.file.name.split('/')[-1]

        # Extract image dimensions on first save
        if self.file and (not self.width or not self.height):
            try:
                from PIL import Image
                img = Image.open(self.file)
                self.width, self.height = img.size
                self.file_size = self.file.size
            except Exception:
                pass

        super().save(*args, **kwargs)


class SpeechBubble(models.Model):
    """Speech bubble/text overlay on a comic panel.

    - Supports multiple bubble styles (oval, thought, shout, narrative)
    - Positioned relative to parent panel
    - Pointer can be positioned to point at characters
    """

    BUBBLE_TYPE_CHOICES = [
        ('oval', 'Standard Oval'),
        ('thought', 'Thought Cloud'),
        ('shout', 'Shout/Jagged'),
        ('whisper', 'Whisper (dotted)'),
        ('narrative', 'Narrative Box'),
        ('caption', 'Caption'),
        ('radio', 'Radio/Electronic'),
        ('burst', 'Action Burst'),
        # New manga/western types
        ('flash', 'Manga Flash'),       # Radial sunburst speed lines
        ('wavy', 'Nervous/Wavy'),       # Trembling outline for fear/hesitation
        ('angry', 'Angry Spikes'),      # Small hostile spikes around edge
        ('poof', 'Sound Effect'),       # POOF/BAM cloud for SFX
        ('electric', 'Electric/Shock'), # Lightning bolt edges
    ]

    BUBBLE_STYLE_CHOICES = [
        ('manga', 'Manga/Japanese'),
        ('western', 'Western/American'),
        ('custom', 'Custom'),
    ]

    POINTER_DIRECTION_CHOICES = [
        ('none', 'None'),
        ('top', 'Top'),
        ('bottom', 'Bottom'),
        ('left', 'Left'),
        ('right', 'Right'),
        ('top-left', 'Top Left'),
        ('top-right', 'Top Right'),
        ('bottom-left', 'Bottom Left'),
        ('bottom-right', 'Bottom Right'),
    ]

    TEXT_ALIGN_CHOICES = [
        ('left', 'Left'),
        ('center', 'Center'),
        ('right', 'Right'),
    ]

    FONT_WEIGHT_CHOICES = [
        ('normal', 'Normal'),
        ('bold', 'Bold'),
    ]

    FONT_STYLE_CHOICES = [
        ('normal', 'Normal'),
        ('italic', 'Italic'),
    ]

    TAIL_TYPE_CHOICES = [
        ('straight', 'Straight'),
        ('curved', 'Curved'),
        ('dots', 'Thought Dots'),
    ]

    panel = models.ForeignKey(
        ComicPanel,
        on_delete=models.CASCADE,
        related_name='speech_bubbles'
    )

    bubble_type = models.CharField(
        max_length=20,
        choices=BUBBLE_TYPE_CHOICES,
        default='oval'
    )

    # Positioning within panel (as percentages)
    x_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    y_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    width_percent = models.DecimalField(max_digits=5, decimal_places=2, default=30)
    height_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20)

    # Z-index for bubble layering
    z_index = models.IntegerField(default=10)

    # Text content
    text = models.TextField(blank=True)
    font_family = models.CharField(max_length=100, default='Comic Sans MS')
    font_size = models.PositiveIntegerField(default=14)
    font_color = models.CharField(max_length=7, default='#000000')
    font_weight = models.CharField(
        max_length=10,
        choices=FONT_WEIGHT_CHOICES,
        default='normal'
    )
    font_style = models.CharField(
        max_length=10,
        choices=FONT_STYLE_CHOICES,
        default='normal'
    )
    text_align = models.CharField(
        max_length=10,
        choices=TEXT_ALIGN_CHOICES,
        default='center'
    )

    # Bubble styling
    background_color = models.CharField(max_length=7, default='#FFFFFF')
    border_color = models.CharField(max_length=7, default='#000000')
    border_width = models.PositiveIntegerField(default=2)

    # Pointer/tail (legacy fields for backward compatibility)
    pointer_direction = models.CharField(
        max_length=20,
        choices=POINTER_DIRECTION_CHOICES,
        default='bottom'
    )
    # Pointer position along the edge (0-100%)
    pointer_position = models.DecimalField(max_digits=5, decimal_places=2, default=50)

    # New draggable tail system
    # Tail endpoint position (as % of panel, relative to bubble center)
    # Values > 100 or < 0 mean tail points outside the panel
    tail_end_x_percent = models.DecimalField(
        max_digits=6, decimal_places=2, default=50,
        help_text='X position where tail tip points (as % of panel width)'
    )
    tail_end_y_percent = models.DecimalField(
        max_digits=6, decimal_places=2, default=120,
        help_text='Y position where tail tip points (as % of panel height). >100 means below panel.'
    )
    tail_type = models.CharField(
        max_length=20,
        choices=TAIL_TYPE_CHOICES,
        default='curved',
        help_text='Style of the tail: straight, curved bezier, or dots for thought bubbles'
    )

    # Style preset system (manga vs western)
    bubble_style = models.CharField(
        max_length=20,
        choices=BUBBLE_STYLE_CHOICES,
        default='manga',
        help_text='Overall style preset: manga (clean, thin strokes) or western (halftone, thick strokes)'
    )
    speed_lines_enabled = models.BooleanField(
        default=False,
        help_text='Enable radial speed lines (manga-style emphasis effect)'
    )
    halftone_shadow = models.BooleanField(
        default=False,
        help_text='Enable halftone dot pattern shadow (western comics style)'
    )

    # Ownership
    writer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='written_bubbles'
    )

    # Order for reading sequence
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['panel', 'order', 'z_index']

    def __str__(self):
        return f"{self.bubble_type} bubble in Panel {self.panel.order}"


class DividerLine(models.Model):
    """A line that divides a comic page into panel regions.

    - Lines can be straight or bezier curves
    - Lines connect page edges or other lines (T-junctions)
    - Panel regions are computed from the enclosed areas
    - Supports per-line styling overrides
    """

    LINE_TYPE_CHOICES = [
        ('straight', 'Straight'),
        ('bezier', 'Bezier Curve'),
    ]

    page = models.ForeignKey(
        ComicPage,
        on_delete=models.CASCADE,
        related_name='divider_lines'
    )

    # Line type
    line_type = models.CharField(
        max_length=20,
        choices=LINE_TYPE_CHOICES,
        default='straight'
    )

    # Start and end points (percentages 0-100)
    start_x = models.DecimalField(max_digits=10, decimal_places=4)
    start_y = models.DecimalField(max_digits=10, decimal_places=4)
    end_x = models.DecimalField(max_digits=10, decimal_places=4)
    end_y = models.DecimalField(max_digits=10, decimal_places=4)

    # Bezier control points (optional, for curved lines)
    control1_x = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    control1_y = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    control2_x = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    control2_y = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)

    # Line styling (override page defaults if set)
    thickness = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Line thickness in percentage of page width. Overrides page default if set."
    )
    color = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        help_text="Line color in hex. Overrides page default if set."
    )

    # Order for rendering/reading
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page', 'order']

    def __str__(self):
        return f"{self.line_type} line on Page {self.page.page_number}"


class Notification(models.Model):
    """Real-time notification system for collaboration activities.

    - Tracks collaboration invitations, comments, approvals, and updates
    - Supports read/unread states for user inbox management
    - Auto-links to related projects for easy navigation
    - Efficient querying with database indexes
    """

    NOTIFICATION_TYPES = [
        ('invitation', 'Collaboration Invitation'),
        ('invitation_response', 'Invitation Response'),
        ('counter_proposal', 'Counter Proposal'),
        ('comment', 'Comment'),
        ('approval', 'Approval Status Change'),
        ('section_update', 'Section Update'),
        ('revenue_proposal', 'Revenue Split Proposal'),
        ('mint_ready', 'Project Ready for Minting'),
        # Social engagement notifications
        ('content_like', 'Content Like'),
        ('content_comment', 'Content Comment'),
        ('content_rating', 'Content Rating'),
        ('creator_review', 'Creator Review'),
        ('content_purchase', 'Content Purchase'),
    ]

    # Core fields
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="User who receives this notification"
    )
    from_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_notifications',
        help_text="User who triggered this notification"
    )

    # Notification content
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPES,
        db_index=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Related objects (optional linking)
    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text="Related collaborative project"
    )

    # Navigation
    action_url = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="URL to navigate to when notification is clicked"
    )

    # State tracking
    read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'read', '-created_at']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f"{self.notification_type}: {self.title} (to {self.recipient.username})"

    def mark_as_read(self):
        """Mark this notification as read."""
        if not self.read:
            self.read = True
            self.read_at = timezone.now()
            self.save(update_fields=['read', 'read_at'])


class Proposal(models.Model):
    """Proposal for multi-party decisions in collaborative projects.

    - Revenue split changes
    - Adding/removing collaborators
    - Project changes requiring consensus
    - Supports different voting thresholds
    """

    PROPOSAL_TYPES = [
        ('revenue_split', 'Revenue Split Change'),
        ('new_member', 'Invite New Collaborator'),
        ('remove_member', 'Remove Collaborator'),
        ('project_change', 'Project Change'),
        ('deadline_extension', 'Deadline Extension'),
        ('exit_collaborator', 'Exit Collaborator'),
        ('contract_amendment', 'Contract Task Amendment'),
        ('unpublish_content', 'Unpublish Content'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Votes'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    THRESHOLD_CHOICES = [
        ('majority', 'Majority (>50%)'),
        ('unanimous', 'Unanimous (100%)'),
        ('owner_decides', 'Owner Decides'),
    ]

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='proposals'
    )
    proposer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='proposals_created'
    )
    proposal_type = models.CharField(max_length=30, choices=PROPOSAL_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    proposal_data = models.JSONField(
        default=dict,
        help_text="JSON data containing the actual proposal content"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    voting_threshold = models.CharField(
        max_length=20,
        choices=THRESHOLD_CHOICES,
        default='majority'
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the proposal expires if not enough votes"
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the proposal was approved/rejected"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_proposal_type_display()}: {self.title}"

    def get_vote_counts(self):
        """Get counts of approve/reject/abstain votes."""
        votes = self.votes.all()
        return {
            'approve': votes.filter(vote='approve').count(),
            'reject': votes.filter(vote='reject').count(),
            'abstain': votes.filter(vote='abstain').count(),
            'total': votes.count(),
        }

    def get_weighted_votes(self):
        """Get weighted vote totals based on collaborator voting_weight."""
        votes = self.votes.all()
        approve_weight = sum(
            v.voter_role.voting_weight for v in votes.filter(vote='approve')
            if hasattr(v, 'voter_role') and v.voter_role
        )
        reject_weight = sum(
            v.voter_role.voting_weight for v in votes.filter(vote='reject')
            if hasattr(v, 'voter_role') and v.voter_role
        )
        return {'approve': approve_weight, 'reject': reject_weight}

    def check_and_resolve(self):
        """Check if proposal should be resolved based on votes."""
        if self.status != 'pending':
            return

        votes = self.get_vote_counts()
        total_collaborators = self.project.collaborators.filter(
            status='accepted'
        ).count()

        approved = False

        if self.voting_threshold == 'unanimous':
            if votes['approve'] == total_collaborators:
                self.status = 'approved'
                self.resolved_at = timezone.now()
                self.save()
                approved = True
            elif votes['reject'] > 0:
                self.status = 'rejected'
                self.resolved_at = timezone.now()
                self.save()

        elif self.voting_threshold == 'majority':
            needed = (total_collaborators // 2) + 1
            if votes['approve'] >= needed:
                self.status = 'approved'
                self.resolved_at = timezone.now()
                self.save()
                approved = True
            elif votes['reject'] >= needed:
                self.status = 'rejected'
                self.resolved_at = timezone.now()
                self.save()

        elif self.voting_threshold == 'owner_decides':
            # Check if owner has voted
            owner_vote = self.votes.filter(voter=self.project.created_by).first()
            if owner_vote:
                self.status = 'approved' if owner_vote.vote == 'approve' else 'rejected'
                self.resolved_at = timezone.now()
                self.save()
                if owner_vote.vote == 'approve':
                    approved = True

        # Execute proposal action if approved
        if approved:
            self._execute_proposal_action()

    def _execute_proposal_action(self):
        """Execute the action for an approved proposal."""
        if self.proposal_type == 'unpublish_content':
            # Unpublish the collaborative content
            if self.project.published_content:
                self.project.published_content.inventory_status = 'unpublished'
                self.project.published_content.save()


class ProposalVote(models.Model):
    """Individual vote on a proposal."""

    VOTE_CHOICES = [
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('abstain', 'Abstain'),
    ]

    proposal = models.ForeignKey(
        Proposal,
        on_delete=models.CASCADE,
        related_name='votes'
    )
    voter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='proposal_votes'
    )
    vote = models.CharField(max_length=10, choices=VOTE_CHOICES)
    comment = models.TextField(
        blank=True,
        help_text="Optional comment explaining the vote"
    )
    voted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['proposal', 'voter']
        ordering = ['-voted_at']

    def __str__(self):
        return f"{self.voter.username}: {self.vote} on {self.proposal.title}"

    @property
    def voter_role(self):
        """Get the voter's CollaboratorRole for this project."""
        return CollaboratorRole.objects.filter(
            project=self.proposal.project,
            user=self.voter
        ).first()


class CollaboratorRating(models.Model):
    """Post-completion rating between collaborators.

    - Quality of work
    - Meeting deadlines
    - Communication
    - Would collaborate again?
    """

    project = models.ForeignKey(
        CollaborativeProject,
        on_delete=models.CASCADE,
        related_name='ratings'
    )
    rater = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ratings_given'
    )
    rated_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ratings_received'
    )
    quality_score = models.IntegerField(
        help_text="Quality of work (1-5)"
    )
    deadline_score = models.IntegerField(
        help_text="Meeting deadlines (1-5)"
    )
    communication_score = models.IntegerField(
        help_text="Communication quality (1-5)"
    )
    would_collab_again = models.IntegerField(
        help_text="Would collaborate again (1-5)"
    )
    private_note = models.TextField(
        blank=True,
        help_text="Private note only visible to rated user"
    )
    public_feedback = models.TextField(
        blank=True,
        help_text="Public feedback visible on profile"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['project', 'rater', 'rated_user']
        ordering = ['-created_at']

    def __str__(self):
        return f"Rating: {self.rater.username} -> {self.rated_user.username}"

    @property
    def average_score(self):
        """Calculate average of all rating categories."""
        return (
            self.quality_score +
            self.deadline_score +
            self.communication_score +
            self.would_collab_again
        ) / 4


class BetaInvite(models.Model):
    """Beta access invitation management.

    Tracks beta access requests, invite codes, and usage.
    """
    email = models.EmailField(unique=True)
    invite_code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='beta_invites_sent')
    status = models.CharField(
        max_length=20,
        choices=[
            ('requested', 'Requested'),
            ('approved', 'Approved'),
            ('sent', 'Invite Sent'),
            ('used', 'Account Created'),
            ('declined', 'Declined')
        ],
        default='requested',
        db_index=True
    )
    message = models.TextField(blank=True, help_text='Why they want access')
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['invite_code']),
        ]

    def generate_invite_code(self):
        """Generate a unique invite code."""
        import uuid
        self.invite_code = str(uuid.uuid4()).replace('-', '')[:16].upper()

    def __str__(self):
        return f'{self.email} - {self.status}'


# =============================================================================
# Social Engagement Models (Likes, Comments, Ratings, Reviews, Follows)
# =============================================================================

class Follow(models.Model):
    """User following relationship.

    - One-way relationship (follower follows following)
    - Denormalized counts stored on UserProfile for performance
    - Used to power the "Following Feed" for latest drops
    """
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='following_set',
        help_text="The user who is following"
    )
    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='follower_set',
        help_text="The user being followed"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['follower', 'following']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['follower', '-created_at']),
            models.Index(fields=['following', '-created_at']),
        ]

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"

    def clean(self):
        """Prevent users from following themselves."""
        from django.core.exceptions import ValidationError
        if self.follower_id == self.following_id:
            raise ValidationError("Users cannot follow themselves.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class ContentLike(models.Model):
    """Instagram-style like for published content.

    - One like per user per content (unique constraint)
    - Toggle action (create to like, delete to unlike)
    - Denormalized count stored on Content.like_count for performance
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='content_likes')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'content']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} liked {self.content.title}"


class ContentView(models.Model):
    """Track unique views on published content.

    Deduplication:
    - Logged-in users: one view per user per content (unique constraint)
    - Anonymous users: tracked by session_key (24-hour window)

    Self-views by creators are excluded and not recorded.
    """
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='content_views')
    session_key = models.CharField(max_length=40, null=True, blank=True)  # For anonymous users
    ip_address = models.GenericIPAddressField(null=True, blank=True)  # Backup for anonymous tracking
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['content', 'user']),
            models.Index(fields=['content', 'session_key']),
            models.Index(fields=['content', '-created_at']),
        ]

    def __str__(self):
        viewer = self.user.username if self.user else f"anon:{self.session_key[:8] if self.session_key else 'unknown'}"
        return f"{viewer} viewed {self.content.title}"


class ContentComment(models.Model):
    """Threaded comments on published content.

    - Reddit-style nested comments via parent_comment FK
    - Edit history tracking
    - Soft delete for moderation (author or content creator can delete)
    """
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='content_comments')
    text = models.TextField(max_length=5000)
    parent_comment = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )

    # Edit tracking
    edited = models.BooleanField(default=False)
    edit_history = models.JSONField(default=list, blank=True)

    # Soft delete for moderation
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_content_comments'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content', '-created_at']),
            models.Index(fields=['author', '-created_at']),
            models.Index(fields=['parent_comment', '-created_at']),
            models.Index(fields=['content', 'is_deleted', '-created_at']),
        ]

    def __str__(self):
        return f"{self.author.username} on {self.content.title}: {self.text[:50]}"

    def get_thread_depth(self):
        """Calculate nesting depth (max 4 levels recommended for UI)."""
        depth = 0
        current = self.parent_comment
        while current and depth < 10:
            depth += 1
            current = current.parent_comment
        return depth


class ContentRating(models.Model):
    """Star rating (1-5) with optional review text for published content.

    - One rating per user per content
    - Denormalized aggregates on Content (average_rating, rating_count)
    - Anyone can rate public content
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='content_ratings')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='ratings')
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Star rating 1-5"
    )
    review_text = models.TextField(max_length=2000, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'content']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content', '-created_at']),
            models.Index(fields=['content', 'rating']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} rated {self.content.title}: {self.rating}/5"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update denormalized aggregates on Content
        self.content.update_rating_aggregates()


class CreatorReview(models.Model):
    """Yelp-style review on creator profiles.

    Eligibility (verified via):
    - Purchased from this creator (via Purchase model)
    - Collaborated with this creator (via CollaboratorRole)

    Creator can respond once to each review.
    """
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='creator_reviews')

    # Review content
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Star rating 1-5"
    )
    review_text = models.TextField(max_length=2000, blank=True, default='')

    # Verification type
    VERIFICATION_TYPE_CHOICES = [
        ('purchase', 'Verified Purchase'),
        ('collaboration', 'Past Collaborator'),
    ]
    verification_type = models.CharField(max_length=20, choices=VERIFICATION_TYPE_CHOICES)

    # Creator response (one-time only)
    response_text = models.TextField(max_length=2000, blank=True, default='')
    response_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['reviewer', 'creator']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['creator', '-created_at']),
            models.Index(fields=['creator', 'rating']),
            models.Index(fields=['reviewer', '-created_at']),
        ]

    def __str__(self):
        return f"{self.reviewer.username} reviewed {self.creator.username}: {self.rating}/5"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update denormalized aggregates on UserProfile
        if hasattr(self.creator, 'profile'):
            self.creator.profile.update_review_aggregates()


# ============================================================================
# Legal Agreement Tracking Models
# ============================================================================

class LegalDocument(models.Model):
    """
    Store versions of legal documents for compliance tracking.

    Documents are stored with version numbers and effective dates.
    When terms change, a new version is created and users must re-accept.
    """
    DOCUMENT_TYPE_CHOICES = [
        ('tos', 'Terms of Service'),
        ('privacy', 'Privacy Policy'),
        ('creator_agreement', 'Creator Agreement'),
        ('content_policy', 'Content Policy'),
        ('dmca', 'DMCA Policy'),
        ('cookie_policy', 'Cookie Policy'),
    ]

    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES, db_index=True)
    version = models.CharField(max_length=20, help_text="Version string, e.g., '1.0', '2.0'")
    content = models.TextField(help_text="Full content of the legal document (markdown)")
    summary_of_changes = models.TextField(
        blank=True,
        default='',
        help_text="Human-readable summary of what changed from previous version"
    )
    effective_date = models.DateField(help_text="Date when this version becomes/became effective")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-effective_date', '-created_at']
        unique_together = ['document_type', 'version']
        indexes = [
            models.Index(fields=['document_type', '-effective_date']),
        ]

    def __str__(self):
        return f"{self.get_document_type_display()} v{self.version}"

    @classmethod
    def get_current_version(cls, document_type):
        """Get the current active version of a document type."""
        return cls.objects.filter(
            document_type=document_type,
            effective_date__lte=timezone.now().date()
        ).order_by('-effective_date', '-created_at').first()


class UserLegalAcceptance(models.Model):
    """
    Track user acceptance of legal documents.

    Records when a user accepted each version of each document type,
    along with metadata for compliance (IP address, user agent).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='legal_acceptances')
    document = models.ForeignKey(LegalDocument, on_delete=models.PROTECT, related_name='acceptances')
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-accepted_at']
        unique_together = ['user', 'document']
        indexes = [
            models.Index(fields=['user', 'document']),
            models.Index(fields=['user', '-accepted_at']),
        ]

    def __str__(self):
        return f"{self.user.username} accepted {self.document} at {self.accepted_at}"

    @classmethod
    def has_accepted_current(cls, user, document_type):
        """Check if user has accepted the current version of a document type."""
        if not user or not user.is_authenticated:
            return False

        current_doc = LegalDocument.get_current_version(document_type)
        if not current_doc:
            # No document exists for this type, consider it accepted
            return True

        return cls.objects.filter(user=user, document=current_doc).exists()

    @classmethod
    def get_pending_acceptances(cls, user):
        """Get list of document types that need user acceptance."""
        if not user or not user.is_authenticated:
            return []

        pending = []
        for doc_type, _ in LegalDocument.DOCUMENT_TYPE_CHOICES:
            if not cls.has_accepted_current(user, doc_type):
                current_doc = LegalDocument.get_current_version(doc_type)
                if current_doc:
                    pending.append({
                        'document_type': doc_type,
                        'version': current_doc.version,
                        'document_id': current_doc.id,
                    })
        return pending

    @classmethod
    def record_acceptance(cls, user, document_type, ip_address=None, user_agent=''):
        """Record user's acceptance of a legal document."""
        current_doc = LegalDocument.get_current_version(document_type)
        if not current_doc:
            raise ValueError(f"No current document found for type: {document_type}")

        acceptance, created = cls.objects.update_or_create(
            user=user,
            document=current_doc,
            defaults={
                'ip_address': ip_address,
                'user_agent': user_agent,
            }
        )
        return acceptance, created


# =============================================================================
# SHOPPING CART MODELS
# =============================================================================


class Cart(models.Model):
    """
    User's shopping cart for batch purchasing.

    Each user has one active cart at a time.
    Carts expire after 24 hours of inactivity to prevent stale pricing.

    Cart Flow:
    1. User adds items -> status='active'
    2. User clicks checkout -> status='checkout' (cart locked)
    3. Payment completes -> status='completed'
    4. Cart abandoned/expired -> status='abandoned'
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='cart'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('checkout', 'In Checkout'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    # Stripe session for multi-item checkout
    stripe_checkout_session_id = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )

    # Aggregated pricing (calculated at checkout)
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Sum of all item prices'
    )
    credit_card_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Single CC fee for entire cart'
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Final amount charged to buyer'
    )

    MAX_ITEMS = 10  # Cart item limit

    class Meta:
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', '-updated_at']),
        ]

    def __str__(self):
        return f"Cart for {self.user.username} ({self.items.count()} items)"

    def calculate_totals(self):
        """
        Calculate cart totals with SINGLE CC fee for all items.

        Major savings: One $0.30 + 2.9% instead of per-item.
        """
        from .payment_utils import calculate_cart_breakdown

        item_prices = [item.unit_price for item in self.items.all()]
        if not item_prices:
            self.subtotal = None
            self.credit_card_fee = None
            self.total = None
            self.save(update_fields=['subtotal', 'credit_card_fee', 'total'])
            return None

        breakdown = calculate_cart_breakdown(item_prices)

        self.subtotal = breakdown['subtotal']
        self.credit_card_fee = breakdown['credit_card_fee']
        self.total = breakdown['buyer_total']
        self.save(update_fields=['subtotal', 'credit_card_fee', 'total'])

        return breakdown

    def can_add_item(self):
        """Check if cart can accept more items."""
        return self.items.count() < self.MAX_ITEMS

    def clear(self):
        """Remove all items from cart."""
        self.items.all().delete()
        self.subtotal = None
        self.credit_card_fee = None
        self.total = None
        self.status = 'active'
        self.stripe_checkout_session_id = ''
        self.save()


class CartItem(models.Model):
    """
    Individual item in a shopping cart.

    Supports both Chapter and Content purchases.
    Price is snapshot at time of add to prevent checkout surprises.
    """
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )

    # Purchasable items (one must be set)
    chapter = models.ForeignKey(
        'Chapter',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='cart_items'
    )
    content = models.ForeignKey(
        Content,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='cart_items'
    )

    # Price snapshot (at time of add)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Price when item was added to cart'
    )

    # Creator info for multi-author distribution
    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text='Item creator for revenue distribution'
    )

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [
            ('cart', 'chapter'),
            ('cart', 'content'),
        ]
        ordering = ['added_at']
        indexes = [
            models.Index(fields=['cart', 'chapter']),
            models.Index(fields=['cart', 'content']),
        ]

    def __str__(self):
        item = self.chapter or self.content
        return f"{item.title} - ${self.unit_price}"

    @property
    def item(self):
        """Return the purchasable item (Chapter or Content)."""
        return self.chapter or self.content

    @property
    def item_type(self):
        """Return 'chapter' or 'content'."""
        return 'chapter' if self.chapter else 'content'


class BatchPurchase(models.Model):
    """
    Tracks a batch purchase from cart checkout.

    Links to multiple individual Purchase records.
    Handles partial fulfillment and refunds.

    Batch Flow:
    1. Cart checkout creates BatchPurchase (status='payment_pending')
    2. Stripe webhook confirms payment (status='payment_completed')
    3. process_batch_purchase task runs (status='processing')
    4. Each item is minted individually with best-effort approach
    5. Partial refunds issued for failed items
    6. Final status: 'completed' | 'partial' | 'failed'
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='batch_purchases'
    )

    # Stripe tracking
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default='')

    # Aggregated amounts
    total_items = models.PositiveIntegerField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    credit_card_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total_charged = models.DecimalField(max_digits=10, decimal_places=2)

    # Processing status
    STATUS_CHOICES = [
        ('payment_pending', 'Payment Pending'),
        ('payment_completed', 'Payment Completed'),
        ('bridge_pending', 'Awaiting Bridge Conversion'),      # Bridge on-ramp
        ('bridge_converting', 'Converting USD to USDC'),       # Bridge on-ramp
        ('usdc_received', 'USDC Received'),                    # Bridge on-ramp
        ('processing', 'Processing Mints'),
        ('completed', 'Completed'),
        ('partial', 'Partially Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Fully Refunded'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='payment_pending')

    # Minting progress
    items_minted = models.PositiveIntegerField(default=0)
    items_failed = models.PositiveIntegerField(default=0)

    # Refund tracking
    total_refunded = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text='Total amount refunded for failed items'
    )

    # Detailed processing log
    processing_log = models.JSONField(
        default=list,
        help_text='Log of minting attempts and results'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['stripe_checkout_session_id']),
        ]

    def __str__(self):
        return f"Batch {self.id}: {self.items_minted}/{self.total_items} for {self.user.username}"


# =============================================================================
# Bridge.xyz Integration Models
# =============================================================================

class BridgeCustomer(models.Model):
    """Maps a user to their Bridge.xyz customer record for off-ramp functionality.

    Bridge.xyz provides USDC → USD conversion via liquidation addresses.
    This model tracks the KYC status and links to the Bridge customer.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='bridge_customer')
    bridge_customer_id = models.CharField(max_length=128, unique=True, help_text="Bridge's customer ID")

    # KYC Status
    KYC_STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('incomplete', 'Incomplete'),
    ]
    kyc_status = models.CharField(max_length=32, choices=KYC_STATUS_CHOICES, default='not_started')
    kyc_link = models.URLField(blank=True, help_text="KYC verification URL from Bridge")
    kyc_completed_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bridge Customer'
        verbose_name_plural = 'Bridge Customers'
        indexes = [
            models.Index(fields=['kyc_status']),
        ]

    def __str__(self):
        return f"Bridge Customer: {self.user.username} ({self.kyc_status})"


class BridgeExternalAccount(models.Model):
    """Linked bank account via Bridge.xyz.

    Stores non-sensitive account metadata for display purposes.
    Actual account details are stored securely in Bridge's systems.
    """
    bridge_customer = models.ForeignKey(
        BridgeCustomer,
        on_delete=models.CASCADE,
        related_name='external_accounts'
    )
    bridge_external_account_id = models.CharField(max_length=128, unique=True)

    # Account info (non-sensitive, for display only)
    account_name = models.CharField(max_length=255, help_text="e.g., 'Chase ****1234'")
    bank_name = models.CharField(max_length=255, blank=True)
    last_four = models.CharField(max_length=4, blank=True)

    ACCOUNT_TYPE_CHOICES = [
        ('checking', 'Checking'),
        ('savings', 'Savings'),
    ]
    account_type = models.CharField(max_length=32, choices=ACCOUNT_TYPE_CHOICES, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Default account for new liquidation addresses")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['bridge_customer', 'is_active']),
        ]

    def __str__(self):
        return f"{self.account_name} ({self.bank_name})"

    def save(self, *args, **kwargs):
        # Ensure only one default account per customer
        if self.is_default:
            BridgeExternalAccount.objects.filter(
                bridge_customer=self.bridge_customer,
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class BridgeLiquidationAddress(models.Model):
    """Solana address that auto-converts USDC to fiat via Bridge.xyz.

    When USDC is sent to this address, Bridge automatically:
    1. Detects the incoming transaction
    2. Converts USDC to USD
    3. Deposits USD to the linked bank account

    This enables automatic off-ramp for creator earnings.
    """
    bridge_customer = models.ForeignKey(
        BridgeCustomer,
        on_delete=models.CASCADE,
        related_name='liquidation_addresses'
    )
    external_account = models.ForeignKey(
        BridgeExternalAccount,
        on_delete=models.PROTECT,
        related_name='liquidation_addresses',
        help_text="Bank account to receive converted funds"
    )
    bridge_liquidation_address_id = models.CharField(max_length=128, unique=True)

    # The actual Solana address for receiving USDC
    solana_address = models.CharField(max_length=44, unique=True, help_text="Solana address for USDC deposits")

    # Status
    is_active = models.BooleanField(default=True)
    is_primary = models.BooleanField(default=False, help_text="Primary address for receiving payouts")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', '-created_at']
        indexes = [
            models.Index(fields=['bridge_customer', 'is_active']),
            models.Index(fields=['solana_address']),
        ]

    def __str__(self):
        return f"Liquidation: {self.solana_address[:8]}... → {self.external_account.account_name}"

    def save(self, *args, **kwargs):
        # Ensure only one primary address per customer
        if self.is_primary:
            BridgeLiquidationAddress.objects.filter(
                bridge_customer=self.bridge_customer,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class BridgeDrain(models.Model):
    """Tracks individual off-ramp transactions (drains) via Bridge.xyz.

    A 'drain' is when Bridge converts USDC from a liquidation address
    to USD and deposits it to the user's bank account.
    """
    liquidation_address = models.ForeignKey(
        BridgeLiquidationAddress,
        on_delete=models.CASCADE,
        related_name='drains'
    )
    bridge_drain_id = models.CharField(max_length=128, unique=True)

    # Transaction details
    usdc_amount = models.DecimalField(max_digits=18, decimal_places=6, help_text="USDC received")
    usd_amount = models.DecimalField(max_digits=18, decimal_places=2, help_text="USD deposited after conversion")
    fee_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0, help_text="Bridge conversion fee")

    # Source transaction (Solana)
    source_tx_signature = models.CharField(max_length=128, blank=True, help_text="Solana tx that funded this drain")

    # Status
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')

    # Timestamps from Bridge
    initiated_at = models.DateTimeField(help_text="When Bridge detected the incoming USDC")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="When USD was deposited to bank")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-initiated_at']
        indexes = [
            models.Index(fields=['liquidation_address', 'status']),
            models.Index(fields=['status', '-initiated_at']),
            models.Index(fields=['source_tx_signature']),
        ]

    def __str__(self):
        return f"Drain {self.bridge_drain_id}: ${self.usdc_amount} USDC → ${self.usd_amount} USD ({self.status})"


class BridgeOnRampTransfer(models.Model):
    """
    Tracks USD → USDC on-ramp conversions via Bridge.xyz Transfers API.

    This model links Stripe payments to Bridge conversions to purchase fulfillment.
    It's the key reconciliation record that ensures we can track the flow:
    Stripe payment → Bridge conversion → USDC delivery → NFT minting

    The platform no longer fronts USDC from treasury - Bridge handles the conversion
    and delivers USDC directly to the platform's Solana wallet.
    """

    # Link to purchase (single or batch) - only one should be set
    purchase = models.OneToOneField(
        'Purchase',
        on_delete=models.CASCADE,
        related_name='bridge_onramp',
        null=True,
        blank=True,
        help_text='Single purchase this on-ramp is for'
    )
    batch_purchase = models.OneToOneField(
        'BatchPurchase',
        on_delete=models.CASCADE,
        related_name='bridge_onramp',
        null=True,
        blank=True,
        help_text='Batch purchase this on-ramp is for'
    )

    # Bridge Transfer IDs
    bridge_transfer_id = models.CharField(
        max_length=128,
        unique=True,
        help_text="Bridge's transfer ID from Transfers API"
    )
    bridge_source_deposit_id = models.CharField(
        max_length=128,
        blank=True,
        help_text="Bridge's source deposit ID (if using virtual accounts)"
    )

    # Stripe Reference (for reconciliation)
    stripe_payment_intent_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Stripe payment intent ID that funded this transfer"
    )

    # Amounts
    usd_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="USD amount sent to Bridge (after Stripe fees)"
    )
    usdc_amount = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="USDC received from Bridge (may differ due to Bridge fees)"
    )
    bridge_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Bridge's conversion fee"
    )

    # Destination (Platform's Solana wallet)
    destination_wallet = models.CharField(
        max_length=44,
        help_text="Platform's Solana wallet address where USDC is delivered"
    )

    # Status tracking
    ONRAMP_STATUS_CHOICES = [
        ('pending', 'Pending - Transfer Created'),
        ('awaiting_funds', 'Awaiting Funds from Stripe'),
        ('funds_received', 'Funds Received by Bridge'),
        ('converting', 'Converting USD to USDC'),
        ('completed', 'Completed - USDC Delivered'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded via Stripe'),
    ]
    status = models.CharField(
        max_length=32,
        choices=ONRAMP_STATUS_CHOICES,
        default='pending'
    )
    failure_reason = models.TextField(
        blank=True,
        help_text="Reason for failure if status is 'failed'"
    )

    # Timing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    funds_received_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When Bridge received USD funds"
    )
    conversion_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When Bridge delivered USDC to platform wallet"
    )

    # Solana transaction reference
    solana_tx_signature = models.CharField(
        max_length=128,
        blank=True,
        help_text="Solana transaction where Bridge delivered USDC"
    )

    class Meta:
        verbose_name = 'Bridge On-Ramp Transfer'
        verbose_name_plural = 'Bridge On-Ramp Transfers'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['bridge_transfer_id']),
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        usdc_str = f"{self.usdc_amount}" if self.usdc_amount else "pending"
        return f"OnRamp {self.bridge_transfer_id}: ${self.usd_amount} → {usdc_str} USDC ({self.status})"


# =============================================================================
# DUAL PAYMENT SYSTEM MODELS (Coinbase Onramp + Direct Crypto)
# =============================================================================

class UserBalance(models.Model):
    """
    Cached USDC balance for user's Web3Auth wallet.

    Synced from Solana blockchain periodically and after transactions.
    Used to avoid real-time RPC calls for every page load.
    Displayed to users as "renaissBlock Balance" (not "USDC balance").
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='usdc_balance'
    )

    # Cached USDC balance (6 decimal places like USDC)
    usdc_balance = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal('0'),
        help_text='Cached USDC balance from blockchain'
    )

    # Last sync timestamp
    last_synced_at = models.DateTimeField(null=True, blank=True)

    # Sync status
    SYNC_STATUS_CHOICES = [
        ('synced', 'Synced'),
        ('syncing', 'Syncing'),
        ('stale', 'Stale'),
        ('error', 'Error'),
    ]
    sync_status = models.CharField(
        max_length=20,
        choices=SYNC_STATUS_CHOICES,
        default='stale'
    )

    # Last known Solana slot for change detection
    last_slot = models.BigIntegerField(null=True, blank=True)

    # Error tracking
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Balance'
        verbose_name_plural = 'User Balances'

    def __str__(self):
        return f"{self.user.username}: ${self.usdc_balance:.2f}"

    @property
    def display_balance(self):
        """Format balance for display (2 decimal places, USD style)."""
        return f"${self.usdc_balance:.2f}"

    def is_sufficient_for(self, amount):
        """Check if balance covers a purchase amount."""
        from decimal import Decimal
        if isinstance(amount, str):
            amount = Decimal(amount)
        return self.usdc_balance >= amount

    @property
    def is_stale(self):
        """Check if balance needs to be refreshed (older than 5 minutes)."""
        from datetime import timedelta
        if not self.last_synced_at:
            return True
        return timezone.now() - self.last_synced_at > timedelta(minutes=5)


class PurchaseIntent(models.Model):
    """
    Represents a user's intent to purchase content.

    Created when user clicks purchase, tracks the payment method selection
    and coordinates between balance check, Coinbase onramp, or direct crypto.

    This is created BEFORE payment - a Purchase record is only created
    after payment is confirmed.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='purchase_intents'
    )

    # What they want to buy (one must be set, or is_cart_purchase=True)
    chapter = models.ForeignKey(
        'Chapter',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='purchase_intents'
    )
    content = models.ForeignKey(
        Content,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='purchase_intents'
    )

    # Cart purchase (for batch)
    is_cart_purchase = models.BooleanField(default=False)
    cart_snapshot = models.JSONField(
        null=True,
        blank=True,
        help_text='Snapshot of cart items at time of intent'
    )

    # Pricing at time of intent (locked in)
    item_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Price of item(s) at time of intent'
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Total amount including any fees'
    )

    # Payment method selection
    PAYMENT_METHOD_CHOICES = [
        ('balance', 'Pay with Balance'),
        ('coinbase', 'Coinbase Onramp'),
        ('direct_crypto', 'Direct Crypto'),
        ('stripe', 'Stripe (Legacy)'),
    ]
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True
    )

    # Status tracking
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('payment_method_selected', 'Payment Method Selected'),
        ('awaiting_payment', 'Awaiting Payment'),
        ('payment_received', 'Payment Received'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
        ('canceled', 'Canceled'),
    ]
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='created'
    )

    # Balance check result at creation time
    user_balance_at_creation = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True
    )
    balance_sufficient = models.BooleanField(default=False)

    # For Coinbase: minimum amount to add (enforcing $5 min)
    coinbase_minimum_add = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Minimum amount user must add via Coinbase ($5 min)'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)

    # Result - links to actual Purchase after completion
    purchase = models.OneToOneField(
        'Purchase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_intent'
    )
    batch_purchase = models.OneToOneField(
        'BatchPurchase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_intent'
    )

    # Error tracking
    failure_reason = models.TextField(blank=True)

    # Transaction tracking (for recovery after network errors)
    solana_tx_signature = models.CharField(
        max_length=128,
        blank=True,
        default='',
        help_text='Solana transaction signature when payment is submitted'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status', '-created_at']),
            models.Index(fields=['status', 'expires_at']),
        ]

    def __str__(self):
        item = self.chapter or self.content or "Cart"
        return f"Intent {self.id}: {item} for {self.user.username} ({self.status})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at and self.status in ['created', 'payment_method_selected', 'awaiting_payment']

    def calculate_coinbase_minimum(self):
        """
        Calculate minimum Coinbase add amount.
        Enforces $5 minimum, accounts for existing balance.
        """
        COINBASE_MINIMUM = Decimal('5.00')

        balance = self.user_balance_at_creation or Decimal('0')
        needed = self.total_amount - balance

        if needed <= 0:
            return Decimal('0')  # Balance sufficient

        # Must add at least $5, even if they only need $2
        return max(needed, COINBASE_MINIMUM)

    def get_item_display(self):
        """Get display name for the item being purchased."""
        if self.is_cart_purchase:
            count = len(self.cart_snapshot.get('items', [])) if self.cart_snapshot else 0
            return f"{count} items"
        elif self.chapter:
            return f"Chapter: {self.chapter.title}"
        elif self.content:
            return self.content.title
        return "Unknown"


class CoinbaseTransaction(models.Model):
    """
    Tracks Coinbase Onramp transactions (fiat -> USDC).

    Flow:
    1. User initiates onramp via Coinbase widget
    2. Coinbase processes payment (Apple Pay, debit card)
    3. Coinbase sends USDC to user's Web3Auth wallet
    4. Webhook confirms arrival, triggers purchase if linked
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='coinbase_transactions'
    )

    # Coinbase identifiers
    coinbase_charge_id = models.CharField(
        max_length=128,
        unique=True,
        help_text='Coinbase Commerce charge ID or Onramp session ID'
    )
    coinbase_checkout_id = models.CharField(
        max_length=128,
        blank=True,
        help_text='Coinbase checkout session ID'
    )

    # Transaction amounts
    fiat_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Amount in USD charged to user'
    )
    usdc_amount = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='USDC received (after fees)'
    )
    coinbase_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Coinbase processing fee'
    )

    # Destination
    destination_wallet = models.CharField(
        max_length=44,
        help_text="User's Web3Auth Solana wallet address"
    )

    # Status tracking
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
        ('canceled', 'Canceled'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Solana transaction when USDC arrives
    solana_tx_signature = models.CharField(
        max_length=128,
        blank=True,
        help_text='Solana transaction signature for USDC deposit'
    )

    # Optional: Link to a purchase intent (if loading balance for specific purchase)
    purchase_intent = models.ForeignKey(
        PurchaseIntent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coinbase_transactions'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Error tracking
    failure_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Coinbase Transaction'
        verbose_name_plural = 'Coinbase Transactions'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['coinbase_charge_id']),
        ]

    def __str__(self):
        return f"Coinbase {self.coinbase_charge_id}: ${self.fiat_amount} -> {self.status}"


class DirectCryptoTransaction(models.Model):
    """
    Tracks direct USDC payments from external wallets (Phantom, etc).

    Flow:
    1. User sees platform USDC address + unique memo
    2. User sends USDC from external wallet with memo
    3. Solana polling detects incoming transaction matching memo + amount
    4. Purchase is fulfilled
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='direct_crypto_transactions'
    )

    # Payment details
    expected_amount = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text='Expected USDC amount'
    )
    received_amount = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Actual USDC received'
    )

    # Payment identification via memo
    payment_memo = models.CharField(
        max_length=64,
        unique=True,
        help_text='Unique memo to identify this payment (e.g., RB-ABC123)'
    )

    # Wallet addresses
    from_wallet = models.CharField(
        max_length=44,
        blank=True,
        help_text='Source wallet address (detected from transaction)'
    )
    to_wallet = models.CharField(
        max_length=44,
        help_text='Platform USDC receiving address'
    )

    # Solana transaction
    solana_tx_signature = models.CharField(
        max_length=128,
        blank=True,
        help_text='Solana transaction signature'
    )

    # Status tracking
    STATUS_CHOICES = [
        ('awaiting_payment', 'Awaiting Payment'),
        ('detected', 'Payment Detected'),
        ('confirming', 'Confirming'),
        ('confirmed', 'Confirmed'),
        ('processing', 'Processing Purchase'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='awaiting_payment'
    )

    # Link to purchase intent
    purchase_intent = models.OneToOneField(
        PurchaseIntent,
        on_delete=models.CASCADE,
        related_name='direct_crypto_transaction'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        help_text='Payment must arrive before this time'
    )
    detected_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    # Error tracking
    failure_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Direct Crypto Transaction'
        verbose_name_plural = 'Direct Crypto Transactions'
        indexes = [
            models.Index(fields=['status', 'expires_at']),
            models.Index(fields=['payment_memo']),
            models.Index(fields=['to_wallet', 'status']),
        ]

    def __str__(self):
        return f"DirectCrypto {self.payment_memo}: {self.expected_amount} USDC -> {self.status}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at and self.status == 'awaiting_payment'
