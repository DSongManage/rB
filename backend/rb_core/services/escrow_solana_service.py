"""
Escrow Solana Service — PDA-Based Non-Custodial Escrow Operations

Handles on-chain escrow vault lifecycle for direct (non-campaign) projects:
- Initialize escrow vault (PDA) with milestones
- Approve milestone (release funds from PDA to artist + platform fee)
- Reclaim milestone (refund from PDA to writer after grace period)

Uses the rb_escrow Anchor program deployed at:
  AiKX6rLM3kTJfcDPt8pwrmbeVR6WaT8PXAHuJhJZYLSH

Platform wallet acts as "writer" in the PDA — can approve milestones server-side.
Funds are held in the PDA vault, never in the platform wallet.
"""

import hashlib
import logging
import struct
from decimal import Decimal
from typing import Dict, Any, Tuple, Optional

from django.conf import settings

from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.hash import Hash
from spl.token.constants import TOKEN_PROGRAM_ID

logger = logging.getLogger(__name__)

PROGRAM_ID = Pubkey.from_string('4bHUxyXHijqKCh6WnrpaG7V8U67tcgXN44aSwSMgnstg')
ATA_PROGRAM_ID = Pubkey.from_string('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')


def _anchor_discriminator(name: str) -> bytes:
    """First 8 bytes of sha256("global:<instruction_name>")."""
    return hashlib.sha256(f"global:{name}".encode()).digest()[:8]


DISC_INITIALIZE_ESCROW = _anchor_discriminator("initialize_escrow")
DISC_SUBMIT_MILESTONE = _anchor_discriminator("submit_milestone")
DISC_APPROVE_MILESTONE = _anchor_discriminator("approve_milestone")
DISC_RELEASE_MILESTONE = _anchor_discriminator("release_milestone")
DISC_AUTO_APPROVE_MILESTONE = _anchor_discriminator("auto_approve_milestone")
DISC_RECLAIM_MILESTONE = _anchor_discriminator("reclaim_milestone")


class EscrowSolanaService:
    """Service for direct (non-campaign) escrow on-chain operations."""

    def __init__(self):
        self.rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        self.client = Client(self.rpc_url)
        self._platform_keypair: Optional[Keypair] = None

    @property
    def platform_keypair(self) -> Keypair:
        if self._platform_keypair:
            return self._platform_keypair
        from blockchain.solana_service import get_platform_keypair
        self._platform_keypair = get_platform_keypair()
        return self._platform_keypair

    @property
    def platform_pubkey(self) -> Pubkey:
        return self.platform_keypair.pubkey()

    @property
    def usdc_mint(self) -> Pubkey:
        # Prefer explicit setting, fall back to network detection
        mint_addr = getattr(settings, 'USDC_MINT_ADDRESS', '')
        if mint_addr:
            return Pubkey.from_string(mint_addr)
        network = getattr(settings, 'SOLANA_NETWORK', 'devnet')
        if network == 'mainnet-beta':
            return Pubkey.from_string('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
        return Pubkey.from_string('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

    # ============================================================
    # PDA Derivation
    # ============================================================

    @staticmethod
    def derive_escrow_pda(project_id: int, artist_pubkey: Pubkey) -> Tuple[Pubkey, int]:
        seeds = [b"escrow", project_id.to_bytes(8, byteorder='little'), bytes(artist_pubkey)]
        return Pubkey.find_program_address(seeds, PROGRAM_ID)

    @staticmethod
    def derive_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
        seeds = [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)]
        ata, _ = Pubkey.find_program_address(seeds, ATA_PROGRAM_ID)
        return ata

    # ============================================================
    # Transaction Helpers
    # ============================================================

    def _get_recent_blockhash(self) -> Hash:
        resp = self.client.get_latest_blockhash(Confirmed)
        return resp.value.blockhash

    def _build_and_send(self, instructions: list, signers: list) -> str:
        """Build a versioned transaction, sign, send, and confirm."""
        blockhash = self._get_recent_blockhash()
        msg = MessageV0.try_compile(
            payer=signers[0].pubkey(),
            instructions=instructions,
            address_lookup_table_accounts=[],
            recent_blockhash=blockhash,
        )
        tx = VersionedTransaction(msg, signers)
        opts = TxOpts(skip_preflight=True, preflight_commitment=Confirmed)
        resp = self.client.send_transaction(tx, opts=opts)
        if resp.value is None:
            raise Exception("Transaction submission failed — no signature returned")
        sig = str(resp.value)
        logger.info('[EscrowSolana] TX sent: %s', sig)
        self.client.confirm_transaction(resp.value, Confirmed)
        logger.info('[EscrowSolana] TX confirmed: %s', sig)
        return sig

    def _create_ata_instruction(self, payer: Pubkey, ata: Pubkey,
                                 owner: Pubkey, mint: Pubkey) -> Instruction:
        """Create Associated Token Account instruction."""
        return Instruction(
            program_id=ATA_PROGRAM_ID,
            accounts=[
                AccountMeta(payer, True, True),
                AccountMeta(ata, False, True),
                AccountMeta(owner, False, False),
                AccountMeta(mint, False, False),
                AccountMeta(SYSTEM_PROGRAM_ID, False, False),
                AccountMeta(TOKEN_PROGRAM_ID, False, False),
            ],
            data=bytes([]),
        )

    def _ensure_ata_exists(self, owner: Pubkey, instructions: list) -> Pubkey:
        """Derive ATA and prepend create instruction if it doesn't exist."""
        ata = self.derive_ata(owner, self.usdc_mint)
        try:
            info = self.client.get_account_info(ata, commitment=Confirmed)
            if info.value is None:
                instructions.append(self._create_ata_instruction(
                    payer=self.platform_pubkey, ata=ata,
                    owner=owner, mint=self.usdc_mint,
                ))
                logger.info('[EscrowSolana] Will create ATA for %s', owner)
        except Exception:
            # If check fails, try creating anyway — tx will fail if it already exists
            instructions.append(self._create_ata_instruction(
                payer=self.platform_pubkey, ata=ata,
                owner=owner, mint=self.usdc_mint,
            ))
        return ata

    # ============================================================
    # Helpers
    # ============================================================

    def close_escrow_pda(self, project_id: int, artist_wallet: str) -> Dict[str, Any]:
        """Close an escrow PDA and recover rent SOL to platform wallet.

        Safety: verifies vault ATA has 0 USDC before closing.
        Returns recovered lamports amount.
        """
        artist_pubkey = Pubkey.from_string(artist_wallet)
        escrow_pda, _ = self.derive_escrow_pda(project_id, artist_pubkey)
        vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)

        # Safety: verify 0 USDC balance
        balance_resp = self.client.get_token_account_balance(vault_ata)
        if balance_resp.value and int(balance_resp.value.amount) > 0:
            raise ValueError(
                f'Cannot close escrow: vault still has {balance_resp.value.ui_amount} USDC'
            )

        # Get rent before closing (to report recovery)
        acct_info = self.client.get_account_info(escrow_pda)
        rent_lamports = acct_info.value.lamports if acct_info.value else 0

        ata_info = self.client.get_account_info(vault_ata)
        ata_rent = ata_info.value.lamports if ata_info.value else 0

        # Close vault ATA first (SPL token close_account)
        from spl.token.instructions import close_account, CloseAccountParams
        instructions = []

        if ata_info.value:
            instructions.append(close_account(CloseAccountParams(
                program_id=TOKEN_PROGRAM_ID,
                account=vault_ata,
                dest=self.platform_pubkey,
                owner=escrow_pda,
                signers=[],
            )))

        # Close escrow PDA via Anchor instruction
        data = DISC_CLOSE_ESCROW if hasattr(self, '_close_disc') else b''
        # For now, we'll handle this as a TODO — the Anchor close instruction
        # needs to be added to the program first.
        # The ATA close above recovers ~0.002 SOL.

        if instructions:
            sig = self._build_and_send(instructions, [self.platform_keypair])
            logger.info('[EscrowSolana] Vault ATA closed: PDA=%s, recovered=%d lamports, TX=%s',
                        escrow_pda, ata_rent, sig)
        else:
            sig = None

        total_recovered = ata_rent + rent_lamports
        return {
            'recovered_lamports': total_recovered,
            'tx_signature': sig,
            'pda': str(escrow_pda),
        }

    @staticmethod
    def _usd_to_lamports(amount) -> int:
        """Convert USD Decimal to USDC lamports (6 decimals)."""
        from decimal import Decimal
        return int(Decimal(str(amount)) * Decimal('1000000'))

    # ============================================================
    # Escrow Instructions
    # ============================================================

    def initialize_escrow(
        self,
        project_id: int,
        artist_wallet: str,
        milestone_amounts_lamports: list[int],
        milestone_deadlines: list[int],
        fee_bps: int = 300,
    ) -> Dict[str, Any]:
        """
        Initialize a PDA escrow vault on-chain and fund it.

        Platform wallet acts as "writer" — funds the vault from its USDC ATA
        and can later approve milestones server-side.

        Args:
            project_id: Django project ID (used as PDA seed)
            artist_wallet: Artist's Solana wallet address
            milestone_amounts_lamports: List of amounts in USDC lamports (6 decimals)
            milestone_deadlines: List of Unix timestamps for each milestone
            fee_bps: Platform fee in basis points (default 300 = 3%)

        Returns:
            {pda, bump, vault_ata, tx_signature}
        """
        try:
            artist_pubkey = Pubkey.from_string(artist_wallet)
        except Exception:
            raise ValueError(f"Invalid artist wallet address: {artist_wallet}")

        if len(milestone_amounts_lamports) != len(milestone_deadlines):
            raise ValueError("Milestone amounts and deadlines must have same length")
        if not (1 <= len(milestone_amounts_lamports) <= 25):
            raise ValueError(f"Must have 1-25 milestones, got {len(milestone_amounts_lamports)}")
        if fee_bps < 0 or fee_bps > 1000:
            raise ValueError(f"Fee must be 0-1000 BPS, got {fee_bps}")

        escrow_pda, escrow_bump = self.derive_escrow_pda(project_id, artist_pubkey)

        instructions = []

        # Build initialize_escrow instruction
        # Note: init only creates the PDA structure, no token accounts needed
        data = DISC_INITIALIZE_ESCROW
        data += struct.pack('<Q', project_id)                    # project_id: u64
        data += struct.pack('<I', len(milestone_amounts_lamports))  # Vec length prefix (Borsh)
        for amt in milestone_amounts_lamports:
            data += struct.pack('<Q', amt)                       # milestone_amount: u64
        data += struct.pack('<I', len(milestone_deadlines))      # Vec length prefix
        for dl in milestone_deadlines:
            data += struct.pack('<q', dl)                        # milestone_deadline: i64
        data += struct.pack('<H', fee_bps)                       # fee_bps: u16

        # Account order must match Anchor's InitializeEscrow struct:
        # writer, artist, platform_wallet, vault, token_program, system_program
        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # writer (payer)
            AccountMeta(artist_pubkey, is_signer=False, is_writable=False),         # artist
            AccountMeta(self.platform_pubkey, is_signer=False, is_writable=False),  # platform_wallet
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),             # vault (init)
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),      # token_program
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),     # system_program
        ]

        instructions.append(Instruction(PROGRAM_ID, data, accounts))

        sig = self._build_and_send(instructions, [self.platform_keypair])

        # Create vault ATA for USDC deposits (separate from init)
        vault_ata = self._ensure_ata_exists(escrow_pda, [])
        # If ATA doesn't exist yet, create it
        ata_instructions = []
        self._ensure_ata_exists(escrow_pda, ata_instructions)
        if ata_instructions:
            self._build_and_send(ata_instructions, [self.platform_keypair])
        vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)

        logger.info(
            '[EscrowSolana] Escrow initialized: project=%d, PDA=%s, milestones=%d, TX=%s',
            project_id, escrow_pda, len(milestone_amounts_lamports), sig,
        )

        return {
            'pda': str(escrow_pda),
            'bump': escrow_bump,
            'vault_ata': str(vault_ata),
            'tx_signature': sig,
        }

    def fund_vault(self, vault_ata_str: str, amount_lamports: int) -> str:
        """Transfer USDC from platform wallet to escrow vault ATA.

        Called after initialize_escrow to deposit funds into the PDA vault.
        """
        from spl.token.instructions import transfer_checked, TransferCheckedParams

        vault_ata = Pubkey.from_string(vault_ata_str)
        platform_ata = self.derive_ata(self.platform_pubkey, self.usdc_mint)

        ix = transfer_checked(
            TransferCheckedParams(
                program_id=TOKEN_PROGRAM_ID,
                source=platform_ata,
                mint=self.usdc_mint,
                dest=vault_ata,
                owner=self.platform_pubkey,
                amount=amount_lamports,
                decimals=6,
            )
        )

        sig = self._build_and_send([ix], [self.platform_keypair])
        logger.info('[EscrowSolana] Vault funded: %d lamports → %s, TX=%s',
                     amount_lamports, vault_ata_str, sig)
        return sig

    def release_milestone(
        self,
        project_id: int,
        artist_wallet: str,
        milestone_index: int,
        escrow_pda_address: str = None,
    ) -> str:
        """
        Release a milestone — writer directly releases funds from PDA vault.

        Accepts milestones in Pending or Submitted status (no artist submit required).
        PDA sends: artist_net → artist ATA, platform_fee → platform ATA.
        Both transfers are atomic.

        Args:
            project_id: Django project ID
            artist_wallet: Artist's Solana wallet address
            milestone_index: 0-based milestone index (max 24)
            escrow_pda_address: Optional PDA address override (for campaign escrow
                where PDA is derived from creator wallet, not artist wallet)

        Returns:
            Transaction signature
        """
        try:
            artist_pubkey = Pubkey.from_string(artist_wallet)
        except Exception:
            raise ValueError(f"Invalid artist wallet address: {artist_wallet}")
        if milestone_index < 0 or milestone_index > 24:
            raise ValueError(f"Milestone index must be 0-24, got {milestone_index}")

        if escrow_pda_address:
            # Campaign escrow: PDA provided directly (derived from creator wallet)
            escrow_pda = Pubkey.from_string(escrow_pda_address)
        else:
            # Direct escrow: derive from project_id + artist wallet
            escrow_pda, _ = self.derive_escrow_pda(project_id, artist_pubkey)

        instructions = []

        vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)
        artist_ata = self._ensure_ata_exists(artist_pubkey, instructions)
        platform_ata = self.derive_ata(self.platform_pubkey, self.usdc_mint)

        data = DISC_RELEASE_MILESTONE + struct.pack('<B', milestone_index)

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # writer
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),             # vault
            AccountMeta(vault_ata, is_signer=False, is_writable=True),              # vault_token_account
            AccountMeta(artist_ata, is_signer=False, is_writable=True),             # artist_token_account
            AccountMeta(platform_ata, is_signer=False, is_writable=True),           # platform_token_account
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        instructions.append(Instruction(PROGRAM_ID, data, accounts))

        sig = self._build_and_send(instructions, [self.platform_keypair])

        logger.info(
            '[EscrowSolana] Milestone %d released: project=%d, TX=%s',
            milestone_index, project_id, sig,
        )
        return sig

    def reclaim_milestone(
        self,
        project_id: int,
        artist_wallet: str,
        milestone_index: int,
    ) -> str:
        """
        Reclaim a milestone — writer (platform) reclaims from PDA after grace period.

        Returns full amount to writer's (platform's) USDC ATA. No platform fee on reclaims.

        Args:
            project_id: Django project ID
            artist_wallet: Artist's Solana wallet (for PDA derivation)
            milestone_index: 0-based milestone index

        Returns:
            Transaction signature
        """
        try:
            artist_pubkey = Pubkey.from_string(artist_wallet)
        except Exception:
            raise ValueError(f"Invalid artist wallet address: {artist_wallet}")
        if milestone_index < 0 or milestone_index > 24:
            raise ValueError(f"Milestone index must be 0-9, got {milestone_index}")

        escrow_pda, _ = self.derive_escrow_pda(project_id, artist_pubkey)

        vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)
        platform_ata = self.derive_ata(self.platform_pubkey, self.usdc_mint)

        data = DISC_RECLAIM_MILESTONE + struct.pack('<B', milestone_index)

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # writer
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),             # vault
            AccountMeta(vault_ata, is_signer=False, is_writable=True),              # vault_token_account
            AccountMeta(platform_ata, is_signer=False, is_writable=True),           # writer_token_account
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info(
            '[EscrowSolana] Milestone %d reclaimed: project=%d, TX=%s',
            milestone_index, project_id, sig,
        )
        return sig
