"""
Blockchain Audit Trail Utilities.

Provides BlockchainAuditLogger for tracking all blockchain operations
including NFT mints, USDC distributions, IPFS uploads, and treasury reconciliation.
"""

import time
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class BlockchainAuditLogger:
    """
    Context manager for tracking blockchain operations with duration.

    Usage as context manager (for operations with duration):
        with BlockchainAuditLogger('nft_mint', user=user, purchase=purchase) as audit:
            result = mint_nft(...)
            audit.set_transaction(result['tx_signature'])
            audit.set_nft_mint(result['nft_mint_address'])
            audit.set_amount(usdc_amount)
        # Auto-marks completed/failed on exit

    Usage for simple logging (one-shot):
        BlockchainAuditLogger.log(
            action='payment_detected',
            status='completed',
            user=user,
            transaction_signature=tx_sig,
            amount_usdc=Decimal('10.00')
        )
    """

    def __init__(
        self,
        action: str,
        user=None,
        purchase=None,
        batch_purchase=None,
        celery_task_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize audit logger.

        Args:
            action: The action type (nft_mint, usdc_distribute, ipfs_upload, etc.)
            user: User model instance (nullable for system tasks)
            purchase: Purchase model instance (nullable)
            batch_purchase: BatchPurchase model instance (nullable)
            celery_task_id: Celery task ID for async operations
            metadata: Additional metadata dict
        """
        self.action = action
        self.user = user
        self.purchase = purchase
        self.batch_purchase = batch_purchase
        self.celery_task_id = celery_task_id
        self.metadata = metadata or {}
        self._audit_log = None
        self._start_time = None
        self._transaction_signature = None
        self._nft_mint_address = None
        self._from_wallet = None
        self._to_wallet = None
        self._amount_usdc = None
        self._gas_fee_usd = None
        self._platform_fee_usdc = None
        self._error_message = None
        self._error_code = None

    def __enter__(self):
        """Start tracking the operation."""
        from .models import BlockchainAuditLog

        self._start_time = time.time()

        self._audit_log = BlockchainAuditLog.objects.create(
            action=self.action,
            status='started',
            user=self.user,
            purchase=self.purchase,
            batch_purchase=self.batch_purchase,
            celery_task_id=self.celery_task_id,
            metadata=self.metadata,
        )

        logger.info(f"[Audit] Started {self.action} (log_id={self._audit_log.id})")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Complete or fail the operation based on exception status."""
        from django.utils import timezone

        if self._audit_log is None:
            return False

        # Calculate duration
        duration_ms = None
        if self._start_time:
            duration_ms = int((time.time() - self._start_time) * 1000)

        # Update the log record
        now = timezone.now()

        if exc_type is not None:
            # Operation failed
            self._audit_log.status = 'failed'
            self._audit_log.error_message = str(exc_val) if exc_val else str(exc_type)
            self._audit_log.error_code = exc_type.__name__ if exc_type else None
            logger.error(f"[Audit] Failed {self.action} (log_id={self._audit_log.id}): {exc_val}")
        else:
            # Operation completed
            self._audit_log.status = 'completed'
            logger.info(f"[Audit] Completed {self.action} (log_id={self._audit_log.id}, duration={duration_ms}ms)")

        self._audit_log.completed_at = now
        self._audit_log.duration_ms = duration_ms
        self._audit_log.transaction_signature = self._transaction_signature
        self._audit_log.nft_mint_address = self._nft_mint_address
        self._audit_log.from_wallet = self._from_wallet
        self._audit_log.to_wallet = self._to_wallet
        self._audit_log.amount_usdc = self._amount_usdc
        self._audit_log.gas_fee_usd = self._gas_fee_usd
        self._audit_log.platform_fee_usdc = self._platform_fee_usdc

        # Merge any updates to metadata
        if self.metadata:
            self._audit_log.metadata = {**(self._audit_log.metadata or {}), **self.metadata}

        self._audit_log.save()

        # Don't suppress exceptions
        return False

    def set_status(self, status: str):
        """Update the status during operation (e.g., 'processing', 'retrying')."""
        if self._audit_log:
            self._audit_log.status = status
            self._audit_log.save(update_fields=['status'])
            logger.info(f"[Audit] Status update for {self.action} (log_id={self._audit_log.id}): {status}")

    def set_transaction(self, signature: str):
        """Set the Solana transaction signature."""
        self._transaction_signature = signature

    def set_nft_mint(self, mint_address: str):
        """Set the NFT mint address."""
        self._nft_mint_address = mint_address

    def set_wallets(self, from_wallet: Optional[str] = None, to_wallet: Optional[str] = None):
        """Set wallet addresses."""
        if from_wallet:
            self._from_wallet = from_wallet
        if to_wallet:
            self._to_wallet = to_wallet

    def set_amount(self, amount_usdc: Optional[Decimal] = None, gas_fee_usd: Optional[Decimal] = None, platform_fee_usdc: Optional[Decimal] = None):
        """Set monetary amounts."""
        if amount_usdc is not None:
            self._amount_usdc = Decimal(str(amount_usdc))
        if gas_fee_usd is not None:
            self._gas_fee_usd = Decimal(str(gas_fee_usd))
        if platform_fee_usdc is not None:
            self._platform_fee_usdc = Decimal(str(platform_fee_usdc))

    def set_error(self, message: str, code: Optional[str] = None):
        """Set error details (will mark as failed on exit)."""
        self._error_message = message
        self._error_code = code
        if self._audit_log:
            self._audit_log.error_message = message
            self._audit_log.error_code = code

    def add_metadata(self, **kwargs):
        """Add additional metadata."""
        self.metadata.update(kwargs)

    @property
    def log_id(self) -> Optional[int]:
        """Get the audit log record ID."""
        return self._audit_log.id if self._audit_log else None

    @classmethod
    def log(
        cls,
        action: str,
        status: str,
        user=None,
        purchase=None,
        batch_purchase=None,
        transaction_signature: Optional[str] = None,
        nft_mint_address: Optional[str] = None,
        from_wallet: Optional[str] = None,
        to_wallet: Optional[str] = None,
        amount_usdc: Optional[Decimal] = None,
        gas_fee_usd: Optional[Decimal] = None,
        platform_fee_usdc: Optional[Decimal] = None,
        error_message: Optional[str] = None,
        error_code: Optional[str] = None,
        celery_task_id: Optional[str] = None,
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Create a one-shot audit log entry.

        Args:
            action: The action type
            status: The status (started, processing, completed, failed, retrying)
            user: User model instance
            purchase: Purchase model instance
            batch_purchase: BatchPurchase model instance
            transaction_signature: Solana transaction signature
            nft_mint_address: NFT mint address
            from_wallet: Source wallet address
            to_wallet: Destination wallet address
            amount_usdc: USDC amount involved
            gas_fee_usd: Gas fee in USD
            platform_fee_usdc: Platform fee in USDC
            error_message: Error message if failed
            error_code: Error code if failed
            celery_task_id: Celery task ID
            duration_ms: Operation duration in milliseconds
            metadata: Additional metadata dict

        Returns:
            BlockchainAuditLog: The created audit log record
        """
        from django.utils import timezone
        from .models import BlockchainAuditLog

        now = timezone.now()
        completed_at = now if status in ('completed', 'failed') else None

        audit_log = BlockchainAuditLog.objects.create(
            action=action,
            status=status,
            user=user,
            purchase=purchase,
            batch_purchase=batch_purchase,
            transaction_signature=transaction_signature,
            nft_mint_address=nft_mint_address,
            from_wallet=from_wallet,
            to_wallet=to_wallet,
            amount_usdc=Decimal(str(amount_usdc)) if amount_usdc is not None else None,
            gas_fee_usd=Decimal(str(gas_fee_usd)) if gas_fee_usd is not None else None,
            platform_fee_usdc=Decimal(str(platform_fee_usdc)) if platform_fee_usdc is not None else None,
            error_message=error_message,
            error_code=error_code,
            celery_task_id=celery_task_id,
            duration_ms=duration_ms,
            completed_at=completed_at,
            metadata=metadata or {},
        )

        log_level = logging.ERROR if status == 'failed' else logging.INFO
        logger.log(log_level, f"[Audit] {action} {status} (log_id={audit_log.id})")

        return audit_log


def audit_nft_mint(
    user,
    purchase,
    transaction_signature: str,
    nft_mint_address: str,
    amount_usdc: Decimal,
    gas_fee_usd: Optional[Decimal] = None,
    platform_fee_usdc: Optional[Decimal] = None,
    to_wallet: Optional[str] = None,
    batch_purchase=None,
    celery_task_id: Optional[str] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to log a successful NFT mint.

    Args:
        user: User who received the NFT
        purchase: Purchase model instance
        transaction_signature: Solana transaction signature
        nft_mint_address: The minted NFT address
        amount_usdc: Total USDC distributed
        gas_fee_usd: Gas fee in USD
        platform_fee_usdc: Platform fee in USDC
        to_wallet: Buyer's wallet address
        batch_purchase: BatchPurchase model instance (for batch mints)
        celery_task_id: Celery task ID
        duration_ms: Operation duration in milliseconds
        metadata: Additional metadata

    Returns:
        BlockchainAuditLog: The created audit log record
    """
    return BlockchainAuditLogger.log(
        action='nft_mint',
        status='completed',
        user=user,
        purchase=purchase,
        batch_purchase=batch_purchase,
        transaction_signature=transaction_signature,
        nft_mint_address=nft_mint_address,
        amount_usdc=amount_usdc,
        gas_fee_usd=gas_fee_usd,
        platform_fee_usdc=platform_fee_usdc,
        to_wallet=to_wallet,
        celery_task_id=celery_task_id,
        duration_ms=duration_ms,
        metadata=metadata,
    )


def audit_nft_mint_failed(
    user,
    purchase,
    error_message: str,
    error_code: Optional[str] = None,
    batch_purchase=None,
    celery_task_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to log a failed NFT mint.

    Args:
        user: User who would have received the NFT
        purchase: Purchase model instance
        error_message: Description of the error
        error_code: Error code or exception type
        batch_purchase: BatchPurchase model instance (for batch mints)
        celery_task_id: Celery task ID if async
        metadata: Additional metadata

    Returns:
        BlockchainAuditLog: The created audit log record
    """
    return BlockchainAuditLogger.log(
        action='nft_mint',
        status='failed',
        user=user,
        purchase=purchase,
        batch_purchase=batch_purchase,
        error_message=error_message,
        error_code=error_code,
        celery_task_id=celery_task_id,
        metadata=metadata,
    )


def audit_ipfs_upload(
    status: str,
    ipfs_uri: Optional[str] = None,
    user=None,
    purchase=None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to log an IPFS upload.

    Args:
        status: 'completed' or 'failed'
        ipfs_uri: The resulting IPFS URI (if successful)
        user: User associated with the upload
        purchase: Purchase associated with the upload
        error_message: Error message if failed
        duration_ms: Operation duration in milliseconds
        metadata: Additional metadata (content_type, file_size, etc.)

    Returns:
        BlockchainAuditLog: The created audit log record
    """
    upload_metadata = metadata or {}
    if ipfs_uri:
        upload_metadata['ipfs_uri'] = ipfs_uri

    return BlockchainAuditLogger.log(
        action='ipfs_upload',
        status=status,
        user=user,
        purchase=purchase,
        error_message=error_message,
        duration_ms=duration_ms,
        metadata=upload_metadata,
    )


def audit_usdc_distribution(
    user,
    purchase,
    transaction_signature: str,
    from_wallet: str,
    to_wallet: str,
    amount_usdc: Decimal,
    role: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to log a USDC distribution to a collaborator.

    Args:
        user: User receiving the USDC
        purchase: Purchase model instance
        transaction_signature: Solana transaction signature
        from_wallet: Source wallet (treasury)
        to_wallet: Destination wallet
        amount_usdc: Amount distributed
        role: Collaborator role (creator, illustrator, etc.)
        metadata: Additional metadata

    Returns:
        BlockchainAuditLog: The created audit log record
    """
    dist_metadata = metadata or {}
    if role:
        dist_metadata['role'] = role

    return BlockchainAuditLogger.log(
        action='usdc_distribute',
        status='completed',
        user=user,
        purchase=purchase,
        transaction_signature=transaction_signature,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        amount_usdc=amount_usdc,
        metadata=dist_metadata,
    )


def audit_treasury_reconciliation(
    reconciliation_id: int,
    purchases_count: int,
    total_fronted: Decimal,
    platform_fees_earned: Decimal,
    net_to_replenish: Decimal,
    treasury_balance: float,
    health_status: str,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Convenience function to log a treasury reconciliation.

    Args:
        reconciliation_id: TreasuryReconciliation record ID
        purchases_count: Number of purchases in the period
        total_fronted: Total USDC fronted from treasury
        platform_fees_earned: Platform fees earned
        net_to_replenish: Net amount to replenish
        treasury_balance: Current treasury balance
        health_status: Treasury health status (HEALTHY, WARNING, CRITICAL)
        metadata: Additional metadata

    Returns:
        BlockchainAuditLog: The created audit log record
    """
    recon_metadata = {
        'reconciliation_id': reconciliation_id,
        'purchases_count': purchases_count,
        'total_fronted': str(total_fronted),
        'platform_fees_earned': str(platform_fees_earned),
        'net_to_replenish': str(net_to_replenish),
        'treasury_balance': treasury_balance,
        'health_status': health_status,
        **(metadata or {}),
    }

    return BlockchainAuditLogger.log(
        action='treasury_reconciliation',
        status='completed',
        amount_usdc=total_fronted,
        platform_fee_usdc=platform_fees_earned,
        metadata=recon_metadata,
    )
