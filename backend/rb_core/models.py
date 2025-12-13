from django.db import models
from django.contrib.auth.models import AbstractUser  # Extend for custom users (no private keys stored)
from django.core.validators import RegexValidator
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
    inventory_status = models.CharField(max_length=16, choices=[('draft','Draft'),('minted','Minted')], default='draft')
    flagged = models.BooleanField(default=False)  # For user flagging/moderation (FR14)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title

    def is_owned_by(self, user):
        """Check if user owns this content via purchase."""
        if not user or not user.is_authenticated:
            return False
        # Only count completed purchases (payment succeeded and not refunded)
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
    # Collaboration visibility and status
    is_private = models.BooleanField(default=True)
    STATUS_CHOICES = [
        ('Mint-Ready Partner', 'Mint-Ready Partner'),
        ('Chain Builder', 'Chain Builder'),
        ('Open Node', 'Open Node'),
        ('Selective Forge', 'Selective Forge'),
        ('Linked Capacity', 'Linked Capacity'),
        ('Partial Protocol', 'Partial Protocol'),
        ('Locked Chain', 'Locked Chain'),
        ('Sealed Vault', 'Sealed Vault'),
        ('Exclusive Mint', 'Exclusive Mint'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='Open Node')
    # Per-user stats and tiering
    content_count = models.PositiveIntegerField(default=0)
    total_sales_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tier = models.CharField(max_length=16, choices=[('Basic', 'Basic'), ('Pro', 'Pro'), ('Elite', 'Elite')], default='Basic')
    fee_bps = models.PositiveIntegerField(default=1000)  # default 10%

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

class TestFeeLog(models.Model):
    """MVP fee log for integration testing and mock minting.
    Stores amounts (USD-equivalent) and timestamps for platform fee tracking.
    """
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Intentionally minimal: URL resolution lives on UserProfile


class BookProject(models.Model):
    """Book project for managing multi-chapter books.
    
    - Authors can create books with multiple chapters
    - Chapters can be published individually or as a complete book
    - Content is encrypted at rest for privacy
    """
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='book_projects')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    cover_image = models.ImageField(upload_to='book_covers/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)
    published_content = models.ForeignKey(Content, null=True, blank=True, on_delete=models.SET_NULL, related_name='source_book_project')
    
    class Meta:
        ordering = ['-updated_at']
    
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

    # Payment provider tracking
    payment_provider = models.CharField(
        max_length=20,
        choices=[
            ('stripe', 'Stripe'),
            ('circle', 'Circle'),
        ],
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
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_provider']),
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
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('ready_for_mint', 'Ready for Mint'),
        ('minted', 'Minted'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=16, choices=CONTENT_TYPE_CHOICES)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    milestones = models.JSONField(default=list, help_text="Milestone definitions and tracking")
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_projects',
        help_text="Project initiator"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def is_fully_approved(self):
        """Check if all collaborators have approved the current version and revenue split."""
        collaborators = self.collaborators.filter(status='accepted')
        if not collaborators.exists():
            return False
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
    role = models.CharField(
        max_length=50,
        help_text="Author, Illustrator, Musician, Editor, etc."
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

    class Meta:
        unique_together = ['project', 'user']
        ordering = ['-revenue_percentage']

    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.revenue_percentage}%)"

    def can_edit_section(self, section_type):
        """Check if this collaborator can edit a specific section type."""
        permission_map = {
            'text': self.can_edit_text,
            'image': self.can_edit_images,
            'audio': self.can_edit_audio,
            'video': self.can_edit_video,
        }
        return permission_map.get(section_type, False)


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

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ['project', 'order']

    def __str__(self):
        return f"{self.project.title} - {self.section_type} #{self.order}"


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

        if self.voting_threshold == 'unanimous':
            if votes['approve'] == total_collaborators:
                self.status = 'approved'
                self.resolved_at = timezone.now()
                self.save()
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
