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
        return self.purchases.filter(user=user, refunded=False).exists()

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
        try:
            if self.avatar_image and hasattr(self.avatar_image, 'url'):
                return self.avatar_image.url
        except Exception:
            pass
        return self.avatar_url or ''

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
    
    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ['book_project', 'order']
    
    def __str__(self):
        return f"Chapter {self.order}: {self.title}"


class Purchase(models.Model):
    """Track NFT purchases for ownership verification and revenue."""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    content = models.ForeignKey(Content, on_delete=models.PROTECT, related_name='purchases')
    
    # Payment details
    purchase_price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    platform_fee_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    creator_earnings_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Stripe identifiers
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True, blank=True, default='')
    
    # Blockchain tracking
    transaction_signature = models.CharField(max_length=128, blank=True, default='')
    nft_minted = models.BooleanField(default=False)
    nft_mint_eligible_at = models.DateTimeField(null=True, blank=True)
    
    purchased_at = models.DateTimeField(auto_now_add=True)
    refunded = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-purchased_at']
        indexes = [
            models.Index(fields=['user', 'content']),
            models.Index(fields=['stripe_payment_intent_id']),
        ]
    
    def __str__(self):
        return f"{self.user.username} purchased {self.content.title}"


class ReadingProgress(models.Model):
    """Track user's reading position in content."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reading_progress')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='reading_progress')

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
