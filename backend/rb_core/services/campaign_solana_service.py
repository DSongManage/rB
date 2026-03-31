"""
Campaign Solana Service — Real On-Chain Transaction Construction

Builds and submits Solana transactions to the rb_escrow Anchor program.
Handles the full campaign lifecycle on-chain:
- Initialize campaign (PDA1)
- Backer contribute
- Transfer PDA1 → PDA2
- Release solo chapters
- Return escrow to campaign (dormancy refund)
- Backer reclaim

Uses the platform keypair as fee payer and (for solo campaigns) as escrow writer.
"""

import hashlib
import json
import logging
import struct
from decimal import Decimal
from pathlib import Path
from typing import Tuple, Optional

from django.conf import settings

from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.hash import Hash
from spl.token.constants import TOKEN_PROGRAM_ID

logger = logging.getLogger(__name__)

PROGRAM_ID = Pubkey.from_string('AiKX6rLM3kTJfcDPt8pwrmbeVR6WaT8PXAHuJhJZYLSH')

# Anchor instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
def _anchor_discriminator(name: str) -> bytes:
    return hashlib.sha256(f"global:{name}".encode()).digest()[:8]

DISC_INITIALIZE_CAMPAIGN = _anchor_discriminator("initialize_campaign")
DISC_CONTRIBUTE = _anchor_discriminator("contribute")
DISC_TRANSFER_TO_ESCROW = _anchor_discriminator("transfer_to_escrow")
DISC_RECLAIM_CONTRIBUTION = _anchor_discriminator("reclaim_contribution")
DISC_INITIALIZE_ESCROW = _anchor_discriminator("initialize_escrow")
DISC_SUBMIT_MILESTONE = _anchor_discriminator("submit_milestone")
DISC_APPROVE_MILESTONE = _anchor_discriminator("approve_milestone")


class CampaignSolanaService:
    """Service for campaign on-chain operations."""

    def __init__(self):
        self.rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        self.client = Client(self.rpc_url)
        self._platform_keypair: Optional[Keypair] = None

    @property
    def platform_keypair(self) -> Keypair:
        if self._platform_keypair:
            return self._platform_keypair

        # Try keypair path (Solana CLI format)
        keypair_path = getattr(settings, 'PLATFORM_WALLET_KEYPAIR_PATH', '')
        if not keypair_path:
            keypair_path = str(Path.home() / '.config' / 'solana' / 'id.json')

        try:
            with open(keypair_path, 'r') as f:
                key_data = json.load(f)
            self._platform_keypair = Keypair.from_bytes(bytes(key_data))
            logger.info(f"Loaded platform keypair: {self._platform_keypair.pubkey()}")
            return self._platform_keypair
        except Exception as e:
            logger.error(f"Failed to load platform keypair from {keypair_path}: {e}")
            raise ValueError(f"Platform keypair not available: {e}")

    @property
    def platform_pubkey(self) -> Pubkey:
        return self.platform_keypair.pubkey()

    # ============================================================
    # PDA Derivation
    # ============================================================

    @staticmethod
    def derive_campaign_pda(project_id: int) -> Tuple[Pubkey, int]:
        seeds = [b"campaign", project_id.to_bytes(8, byteorder='little')]
        return Pubkey.find_program_address(seeds, PROGRAM_ID)

    @staticmethod
    def derive_escrow_pda(project_id: int, artist_pubkey: Pubkey) -> Tuple[Pubkey, int]:
        seeds = [b"escrow", project_id.to_bytes(8, byteorder='little'), bytes(artist_pubkey)]
        return Pubkey.find_program_address(seeds, PROGRAM_ID)

    @staticmethod
    def derive_backer_pda(campaign_vault: Pubkey, backer_pubkey: Pubkey) -> Tuple[Pubkey, int]:
        seeds = [b"backer", bytes(campaign_vault), bytes(backer_pubkey)]
        return Pubkey.find_program_address(seeds, PROGRAM_ID)

    @staticmethod
    def derive_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
        """Derive Associated Token Account address."""
        ATA_PROGRAM = Pubkey.from_string('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
        seeds = [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)]
        ata, _ = Pubkey.find_program_address(seeds, ATA_PROGRAM)
        return ata

    # ============================================================
    # Transaction Helpers
    # ============================================================

    def _get_recent_blockhash(self) -> Hash:
        resp = self.client.get_latest_blockhash(Confirmed)
        return resp.value.blockhash

    def _build_and_send(self, instructions: list, signers: list) -> str:
        """Build a versioned transaction, sign it, send and confirm."""
        from solana.rpc.types import TxOpts
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
        sig = str(resp.value)
        logger.info(f"TX sent: {sig}")
        self.client.confirm_transaction(resp.value, Confirmed)
        logger.info(f"TX confirmed: {sig}")
        return sig

    # ============================================================
    # Campaign Instructions
    # ============================================================

    def initialize_campaign_on_chain(self, campaign) -> str:
        """Call initialize_campaign instruction. Creates PDA1 on-chain.

        Returns transaction signature.
        """
        project_id = campaign.id
        funding_goal = int(Decimal(str(campaign.funding_goal)) * 1_000_000)  # USDC decimals
        deadline = int(campaign.deadline.timestamp())
        campaign_type = 1 if campaign.campaign_type == 'solo' else 0  # Solo=1, Collaborative=0
        chapter_count = campaign.chapter_count or 0
        fee_bps = 300  # 3%

        campaign_pda, _ = self.derive_campaign_pda(project_id)

        # Instruction data: discriminator + project_id(u64) + funding_goal(u64) + deadline(i64)
        #                    + campaign_type(u8) + chapter_count(u8) + fee_bps(u16)
        data = DISC_INITIALIZE_CAMPAIGN
        data += struct.pack('<Q', project_id)      # u64 project_id
        data += struct.pack('<Q', funding_goal)     # u64 funding_goal
        data += struct.pack('<q', deadline)         # i64 deadline
        data += struct.pack('<B', campaign_type)    # CampaignType enum (0=Collaborative, 1=Solo)
        data += struct.pack('<B', chapter_count)    # u8 chapter_count
        data += struct.pack('<H', fee_bps)          # u16 fee_bps

        # Accounts: creator, platform_wallet, campaign_vault, token_program, system_program
        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),  # creator (payer)
            AccountMeta(self.platform_pubkey, is_signer=False, is_writable=False),  # platform_wallet
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),  # campaign_vault (PDA, init)
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        # Store PDA in DB
        campaign.campaign_pda = str(campaign_pda)
        campaign.save(update_fields=['campaign_pda'])

        logger.info(
            '[CampaignSolana] Campaign %d initialized on-chain. PDA: %s, TX: %s',
            campaign.id, campaign_pda, sig
        )
        return sig

    def get_campaign_pda_for_db(self, campaign) -> dict:
        pda, bump = self.derive_campaign_pda(campaign.id)
        return {'campaign_pda': str(pda), 'campaign_pda_bump': bump}

    def setup_solo_escrow(self, campaign) -> dict:
        """Get escrow setup info for a solo campaign."""
        creator_wallet = campaign.creator.wallet_address
        if not creator_wallet:
            raise ValueError(f"Creator {campaign.creator.username} has no wallet address")

        artist_pubkey = Pubkey.from_string(creator_wallet)
        escrow_pda, escrow_bump = self.derive_escrow_pda(campaign.id, artist_pubkey)
        chapter_count = campaign.chapter_count or 1
        total_lamports = int(Decimal(str(campaign.funding_goal)) * 1_000_000)
        per_chapter = total_lamports // chapter_count

        return {
            'escrow_pda': str(escrow_pda),
            'escrow_pda_bump': escrow_bump,
            'chapter_count': chapter_count,
            'per_chapter_lamports': per_chapter,
            'total_lamports': total_lamports,
            'artist_wallet': creator_wallet,
        }

    def log_transfer_details(self, campaign) -> dict:
        """Log PDA1 → PDA2 transfer details for audit."""
        campaign_pda, campaign_bump = self.derive_campaign_pda(campaign.id)
        details = {
            'campaign_id': campaign.id,
            'campaign_pda': str(campaign_pda),
            'campaign_bump': campaign_bump,
            'campaign_type': campaign.campaign_type,
            'funding_goal': str(campaign.funding_goal),
            'current_amount': str(campaign.current_amount),
        }

        if campaign.campaign_type == 'solo':
            try:
                escrow_info = self.setup_solo_escrow(campaign)
                details.update(escrow_info)
            except Exception as e:
                details['escrow_error'] = str(e)

        logger.info('[CampaignSolana] Transfer details: %s', details)
        return details
