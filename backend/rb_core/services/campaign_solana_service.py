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

PROGRAM_ID = Pubkey.from_string('4bHUxyXHijqKCh6WnrpaG7V8U67tcgXN44aSwSMgnstg')

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
DISC_WITHDRAW_CONTRIBUTION = _anchor_discriminator("withdraw_contribution")
DISC_ADD_STRETCH_MILESTONE = _anchor_discriminator("add_stretch_milestone")


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

    def _get_nonce_info(self) -> tuple:
        """Get the durable nonce account pubkey and current nonce hash.
        Returns (nonce_pubkey, nonce_hash) for use as blockhash replacement.
        """
        import json
        nonce_path = str(Path.home() / '.solana' / 'nonce-account.json')
        with open(nonce_path) as f:
            data = json.load(f)
        nonce_pubkey = Pubkey.from_string(data['pubkey'])
        # Fetch current nonce value from on-chain
        acct = self.client.get_account_info(nonce_pubkey, commitment=Confirmed)
        if not acct.value:
            raise Exception('Nonce account not found on-chain')
        acct_data = acct.value.data
        # Nonce account layout: 4 bytes version + 4 bytes state + 32 bytes authority + 32 bytes nonce_hash
        nonce_hash = Hash.from_bytes(acct_data[40:72])
        return nonce_pubkey, nonce_hash

    def _build_nonce_advance_ix(self, nonce_pubkey: Pubkey) -> Instruction:
        """Build the AdvanceNonceAccount instruction (must be first ix in tx)."""
        from solders.system_program import advance_nonce_account, AdvanceNonceAccountParams
        return advance_nonce_account(AdvanceNonceAccountParams(
            nonce_pubkey=nonce_pubkey,
            authorized_pubkey=self.platform_pubkey,
        ))

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

    # USDC mint (devnet / mainnet — configure via settings)
    @property
    def usdc_mint(self) -> Pubkey:
        mint_str = getattr(settings, 'USDC_MINT', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')  # devnet
        return Pubkey.from_string(mint_str)

    def _usd_to_lamports(self, amount: Decimal) -> int:
        """Convert USD amount to USDC lamports (6 decimals)."""
        return int(Decimal(str(amount)) * 1_000_000)

    # ============================================================
    # Phase 1: Initialize Campaign (PDA1)
    # ============================================================

    def initialize_campaign_on_chain(self, campaign) -> str:
        """Create PDA1 on-chain. Called when campaign launches.

        Uses campaign.id as the on-chain project_id seed.
        Returns transaction signature.
        """
        campaign_id = campaign.id
        funding_goal = self._usd_to_lamports(campaign.funding_goal)
        deadline = int(campaign.deadline.timestamp())
        campaign_type = 1 if campaign.campaign_type == 'solo' else 0
        chapter_count = campaign.chapter_count or 0
        fee_bps = 300  # 3% escrow release fee

        campaign_pda, campaign_bump = self.derive_campaign_pda(campaign_id)

        data = DISC_INITIALIZE_CAMPAIGN
        data += struct.pack('<Q', campaign_id)
        data += struct.pack('<Q', funding_goal)
        data += struct.pack('<q', deadline)
        data += struct.pack('<B', campaign_type)
        data += struct.pack('<B', chapter_count)
        data += struct.pack('<H', fee_bps)

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # creator/payer
            AccountMeta(self.platform_pubkey, is_signer=False, is_writable=False),  # platform_wallet
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),           # campaign_vault (PDA, init)
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        # Store PDA + bump in DB
        campaign.campaign_pda = str(campaign_pda)
        campaign.campaign_pda_bump = campaign_bump
        campaign.on_chain_initialized = True
        campaign.save(update_fields=['campaign_pda', 'campaign_pda_bump', 'on_chain_initialized'])

        logger.info('[CampaignSolana] Campaign %d initialized. PDA: %s, TX: %s', campaign_id, campaign_pda, sig)
        return sig

    # ============================================================
    # Phase 2: Contribute (client-side signed, backend verifies)
    # ============================================================

    def get_contribute_instruction_params(self, campaign, backer_wallet: str, amount: Decimal) -> dict:
        """Return instruction data + accounts for frontend to build the contribute tx.

        The backer signs client-side. Backend calls this to provide the params.
        """
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)
        backer_pubkey = Pubkey.from_string(backer_wallet)
        backer_record_pda, _ = self.derive_backer_pda(campaign_pda, backer_pubkey)
        vault_ata = self.derive_ata(campaign_pda, self.usdc_mint)
        backer_ata = self.derive_ata(backer_pubkey, self.usdc_mint)

        amount_lamports = self._usd_to_lamports(amount)

        # Instruction data: discriminator + amount(u64)
        data = DISC_CONTRIBUTE + struct.pack('<Q', amount_lamports)

        # Accounts must match Anchor struct order: payer, backer, campaign_vault, backer_record, ...
        accounts = [
            {'pubkey': str(self.platform_pubkey), 'is_signer': True, 'is_writable': True},  # payer
            {'pubkey': str(backer_pubkey), 'is_signer': True, 'is_writable': False},         # backer
            {'pubkey': str(campaign_pda), 'is_signer': False, 'is_writable': True},           # campaign_vault
            {'pubkey': str(backer_record_pda), 'is_signer': False, 'is_writable': True},      # backer_record (init)
            {'pubkey': str(backer_ata), 'is_signer': False, 'is_writable': True},             # backer_token_account
            {'pubkey': str(vault_ata), 'is_signer': False, 'is_writable': True},              # vault_token_account
            {'pubkey': str(TOKEN_PROGRAM_ID), 'is_signer': False, 'is_writable': False},
            {'pubkey': str(SYSTEM_PROGRAM_ID), 'is_signer': False, 'is_writable': False},
        ]

        return {
            'program_id': str(PROGRAM_ID),
            'instruction_data': data.hex(),
            'accounts': accounts,
            'campaign_pda': str(campaign_pda),
            'vault_ata': str(vault_ata),
            'backer_record_pda': str(backer_record_pda),
            'amount_lamports': amount_lamports,
        }

    def build_sponsored_contribute_tx(self, campaign, backer_wallet: str, amount: Decimal) -> dict:
        """Build a sponsored VersionedTransaction for campaign contribution.

        Platform pays gas fees. User signs as backer (USDC authority + account init).
        Returns serialized_transaction for frontend Web3Auth signing.
        """
        import base64
        from solders.signature import Signature

        campaign_pda, _ = self.derive_campaign_pda(campaign.id)
        backer_pubkey = Pubkey.from_string(backer_wallet)
        backer_record_pda, _ = self.derive_backer_pda(campaign_pda, backer_pubkey)
        vault_ata = self.derive_ata(campaign_pda, self.usdc_mint)
        backer_ata = self.derive_ata(backer_pubkey, self.usdc_mint)

        amount_lamports = self._usd_to_lamports(amount)

        # Build the contribute instruction
        # Account order must match Anchor struct: payer, backer, campaign_vault, backer_record, ...
        data = DISC_CONTRIBUTE + struct.pack('<Q', amount_lamports)
        contribute_ix = Instruction(PROGRAM_ID, data, [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),  # payer (platform sponsors rent)
            AccountMeta(backer_pubkey, is_signer=True, is_writable=False),        # backer (signs USDC transfer)
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),         # campaign_vault
            AccountMeta(backer_record_pda, is_signer=False, is_writable=True),    # backer_record (init)
            AccountMeta(backer_ata, is_signer=False, is_writable=True),           # backer_token_account
            AccountMeta(vault_ata, is_signer=False, is_writable=True),            # vault_token_account
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ])

        # Use recent blockhash with Processed commitment for maximum freshness
        from solana.rpc.commitment import Processed
        resp = self.client.get_latest_blockhash(Processed)
        blockhash = resp.value.blockhash

        message = MessageV0.try_compile(
            payer=self.platform_pubkey,
            instructions=[contribute_ix],
            address_lookup_table_accounts=[],
            recent_blockhash=blockhash,
        )

        # Create transaction with placeholder signatures
        # Signers: [platform (fee payer), backer (token authority)]
        placeholder_sig = Signature.default()
        unsigned_tx = VersionedTransaction.populate(message, [placeholder_sig, placeholder_sig])
        tx_bytes = bytes(unsigned_tx)

        return {
            'serialized_transaction': base64.b64encode(tx_bytes).decode('utf-8'),
            'serialized_message': base64.b64encode(bytes(message)).decode('utf-8'),
            'blockhash': str(blockhash),
            'user_pubkey': backer_wallet,
            'platform_pubkey': str(self.platform_pubkey),
            'amount_lamports': amount_lamports,
        }

    def submit_contribution_with_platform_sig(self, serialized_message: str, signed_transaction_b64: str) -> str:
        """Add platform signature to user-signed contribution and submit.

        The frontend sends the full user-signed VersionedTransaction.
        We extract the message from it, sign with platform, rebuild with both sigs.

        Args:
            serialized_message: Base64 encoded MessageV0 (from intent, for reference)
            signed_transaction_b64: Base64 encoded VersionedTransaction with user's signature

        Returns:
            Transaction signature string
        """
        import base64
        from solders.signature import Signature
        from solana.rpc.types import TxOpts

        # Decode the user-signed transaction bytes
        tx_bytes = bytearray(base64.b64decode(signed_transaction_b64))

        # TX layout: [num_sigs(1 byte), sig0(64 bytes), sig1(64 bytes), message_bytes...]
        # sig[0] = platform placeholder (all zeros) — we need to fill this
        # sig[1] = user's real signature from Web3Auth
        msg_start = 1 + (2 * 64)  # after compact-u16 prefix + 2 signatures
        msg_bytes = bytes(tx_bytes[msg_start:])

        # Platform signs the message bytes
        platform_sig = self.platform_keypair.sign_message(msg_bytes)

        # Inject platform signature at slot [0] (bytes 1-64)
        tx_bytes[1:65] = bytes(platform_sig)

        # Submit raw transaction bytes directly
        resp = self.client.send_raw_transaction(
            bytes(tx_bytes),
            opts=TxOpts(skip_preflight=True, preflight_commitment=Confirmed),
        )
        sig = str(resp.value)
        logger.info('[CampaignSolana] Sponsored contribution submitted. TX: %s', sig)
        return sig

    def verify_contribution_tx(self, signature: str, campaign, backer_wallet: str, expected_amount: Decimal) -> bool:
        """Verify a contribution transaction on-chain.

        Fetches the tx, checks it invoked our program, and that the amount matches.
        Returns True if valid.
        """
        try:
            from solders.signature import Signature
            sig = Signature.from_string(signature)
            resp = self.client.get_transaction(sig, commitment=Confirmed, max_supported_transaction_version=0)
            if resp.value is None:
                logger.warning('[CampaignSolana] TX not found: %s', signature)
                return False

            # Verify the transaction includes our program
            tx_meta = resp.value
            account_keys = tx_meta.transaction.transaction.message.account_keys
            program_found = any(str(key) == str(PROGRAM_ID) for key in account_keys)
            if not program_found:
                logger.warning('[CampaignSolana] TX %s does not invoke our program', signature)
                return False

            # Check for errors
            if tx_meta.transaction.meta and tx_meta.transaction.meta.err:
                logger.warning('[CampaignSolana] TX %s has errors: %s', signature, tx_meta.transaction.meta.err)
                return False

            logger.info('[CampaignSolana] Contribution TX verified: %s', signature)
            return True
        except Exception as e:
            logger.error('[CampaignSolana] Failed to verify TX %s: %s', signature, e)
            return False

    # ============================================================
    # Phase 3: Transfer PDA1 → PDA2
    # ============================================================

    def initialize_escrow_on_chain(self, campaign, artist_pubkey: Pubkey,
                                    milestone_amounts: list, milestone_deadlines: list) -> str:
        """Create PDA2 (escrow vault) on-chain. Called before transfer.

        Uses campaign.id as project_id seed so it matches PDA1.
        """
        campaign_id = campaign.id
        escrow_pda, escrow_bump = self.derive_escrow_pda(campaign_id, artist_pubkey)

        # Instruction data: discriminator + project_id(u64) +
        #   Vec<u64> milestone_amounts (Borsh: u32 len + items) +
        #   Vec<i64> milestone_deadlines (Borsh: u32 len + items) +
        #   fee_bps(u16)
        data = DISC_INITIALIZE_ESCROW
        data += struct.pack('<Q', campaign_id)
        # Borsh Vec<u64>: 4-byte length prefix + items
        data += struct.pack('<I', len(milestone_amounts))
        for amt in milestone_amounts:
            data += struct.pack('<Q', amt)
        # Borsh Vec<i64>: 4-byte length prefix + items
        data += struct.pack('<I', len(milestone_deadlines))
        for dl in milestone_deadlines:
            data += struct.pack('<q', dl)
        data += struct.pack('<H', 300)  # 3% fee

        # No token accounts needed — init only creates the PDA, no funds transfer
        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # writer/payer
            AccountMeta(artist_pubkey, is_signer=False, is_writable=False),         # artist
            AccountMeta(self.platform_pubkey, is_signer=False, is_writable=False),  # platform_wallet
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),             # vault (PDA, init)
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Escrow initialized for campaign %d. PDA2: %s, TX: %s',
                    campaign_id, escrow_pda, sig)
        return sig

    def transfer_to_escrow_on_chain(self, campaign) -> str:
        """Transfer funds from PDA1 (campaign vault) to PDA2 (escrow vault).

        Must be called after initialize_escrow_on_chain.
        """
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)

        # Determine artist pubkey for escrow PDA derivation
        if campaign.campaign_type == 'solo':
            creator_wallet = campaign.creator.wallet_address
            if not creator_wallet:
                raise ValueError(f"Creator {campaign.creator.username} has no wallet address")
            artist_pubkey = Pubkey.from_string(creator_wallet)
        else:
            # Collaborative: use the campaign CREATOR's wallet for single PDA2
            # All funds go to one escrow vault managed by the creator
            project = campaign.project
            if not project:
                raise ValueError("Collaborative campaign has no linked project")
            creator_wallet = campaign.creator.wallet_address
            if creator_wallet:
                artist_pubkey = Pubkey.from_string(creator_wallet)
            else:
                raise ValueError("No collaborator with wallet address found")

        escrow_pda, _ = self.derive_escrow_pda(campaign.id, artist_pubkey)
        campaign_vault_ata = self.derive_ata(campaign_pda, self.usdc_mint)
        escrow_vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)

        data = DISC_TRANSFER_TO_ESCROW

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),    # creator/signer
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),            # campaign_vault
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),              # escrow_vault
            AccountMeta(campaign_vault_ata, is_signer=False, is_writable=True),      # campaign_token_account
            AccountMeta(escrow_vault_ata, is_signer=False, is_writable=True),        # escrow_token_account
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Transferred PDA1→PDA2 for campaign %d. TX: %s', campaign.id, sig)
        return sig

    def setup_solo_escrow(self, campaign) -> dict:
        """Get escrow setup info for a solo campaign (derivation only, no on-chain call)."""
        creator_wallet = campaign.creator.wallet_address
        if not creator_wallet:
            raise ValueError(f"Creator {campaign.creator.username} has no wallet address")

        artist_pubkey = Pubkey.from_string(creator_wallet)
        escrow_pda, escrow_bump = self.derive_escrow_pda(campaign.id, artist_pubkey)
        chapter_count = campaign.chapter_count or 1
        total_lamports = self._usd_to_lamports(campaign.funding_goal)
        per_chapter = total_lamports // chapter_count

        return {
            'escrow_pda': str(escrow_pda),
            'escrow_pda_bump': escrow_bump,
            'chapter_count': chapter_count,
            'per_chapter_lamports': per_chapter,
            'total_lamports': total_lamports,
            'artist_wallet': creator_wallet,
            'artist_pubkey': artist_pubkey,
        }

    # ============================================================
    # Phase 4: Cancel + Reclaim
    # ============================================================

    def cancel_campaign_on_chain(self, campaign) -> str:
        """Mark campaign as cancelled/reclaimable on-chain so backers can reclaim."""
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)

        data = _anchor_discriminator("cancel_campaign")

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),  # creator
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),          # campaign_vault
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        campaign.cancel_tx_signature = sig
        campaign.save(update_fields=['cancel_tx_signature'])

        logger.info('[CampaignSolana] Campaign %d cancelled on-chain. TX: %s', campaign.id, sig)
        return sig

    def return_to_campaign_on_chain(self, campaign) -> str:
        """Return dormant escrow funds (PDA2) back to campaign vault (PDA1)."""
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)

        # Determine escrow PDA
        if campaign.campaign_type == 'solo':
            escrow_info = self.setup_solo_escrow(campaign)
            escrow_pda = Pubkey.from_string(escrow_info['escrow_pda'])
        else:
            # Collaborative — use stored escrow_pda
            if not campaign.escrow_pda:
                raise ValueError("No escrow PDA stored for campaign")
            escrow_pda = Pubkey.from_string(campaign.escrow_pda)

        campaign_vault_ata = self.derive_ata(campaign_pda, self.usdc_mint)
        escrow_vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)

        data = _anchor_discriminator("return_to_campaign")

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),
            AccountMeta(campaign_vault_ata, is_signer=False, is_writable=True),
            AccountMeta(escrow_vault_ata, is_signer=False, is_writable=True),
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Returned escrow→campaign for campaign %d. TX: %s', campaign.id, sig)
        return sig

    def get_reclaim_instruction_params(self, campaign, backer_wallet: str) -> dict:
        """Return instruction params for frontend to build the reclaim tx (backer signs)."""
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)
        backer_pubkey = Pubkey.from_string(backer_wallet)
        backer_record_pda, _ = self.derive_backer_pda(campaign_pda, backer_pubkey)
        vault_ata = self.derive_ata(campaign_pda, self.usdc_mint)
        backer_ata = self.derive_ata(backer_pubkey, self.usdc_mint)

        data = DISC_RECLAIM_CONTRIBUTION

        accounts = [
            {'pubkey': str(backer_pubkey), 'is_signer': True, 'is_writable': True},
            {'pubkey': str(campaign_pda), 'is_signer': False, 'is_writable': True},
            {'pubkey': str(backer_record_pda), 'is_signer': False, 'is_writable': True},
            {'pubkey': str(vault_ata), 'is_signer': False, 'is_writable': True},
            {'pubkey': str(backer_ata), 'is_signer': False, 'is_writable': True},
            {'pubkey': str(self.usdc_mint), 'is_signer': False, 'is_writable': False},
            {'pubkey': str(TOKEN_PROGRAM_ID), 'is_signer': False, 'is_writable': False},
        ]

        return {
            'program_id': str(PROGRAM_ID),
            'instruction_data': data.hex(),
            'accounts': accounts,
        }

    # ============================================================
    # Phase 5: Milestone Submit + Approve (solo chapter releases)
    # ============================================================

    def submit_milestone_on_chain(self, campaign, milestone_index: int) -> str:
        """Submit a milestone for approval (platform submits on behalf of solo creator)."""
        escrow_info = self.setup_solo_escrow(campaign)
        escrow_pda = Pubkey.from_string(escrow_info['escrow_pda'])

        data = DISC_SUBMIT_MILESTONE + struct.pack('<B', milestone_index)

        accounts = [
            AccountMeta(escrow_info['artist_pubkey'], is_signer=False, is_writable=False),  # artist
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),                      # escrow_vault
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),             # writer/submitter
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Milestone %d submitted for campaign %d. TX: %s',
                    milestone_index, campaign.id, sig)
        return sig

    def approve_milestone_on_chain(self, campaign, milestone_index: int) -> str:
        """Approve a milestone and release funds from escrow (platform auto-approves for solo)."""
        escrow_info = self.setup_solo_escrow(campaign)
        escrow_pda = Pubkey.from_string(escrow_info['escrow_pda'])
        artist_pubkey = escrow_info['artist_pubkey']
        escrow_vault_ata = self.derive_ata(escrow_pda, self.usdc_mint)
        artist_ata = self.derive_ata(artist_pubkey, self.usdc_mint)
        platform_ata = self.derive_ata(self.platform_pubkey, self.usdc_mint)

        data = DISC_APPROVE_MILESTONE + struct.pack('<B', milestone_index)

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),   # writer/approver
            AccountMeta(artist_pubkey, is_signer=False, is_writable=False),         # artist
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),             # escrow_vault
            AccountMeta(escrow_vault_ata, is_signer=False, is_writable=True),       # escrow_token_account
            AccountMeta(artist_ata, is_signer=False, is_writable=True),             # artist_token_account
            AccountMeta(platform_ata, is_signer=False, is_writable=True),           # platform_fee_account
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Milestone %d approved for campaign %d. TX: %s',
                    milestone_index, campaign.id, sig)
        return sig

    # ============================================================
    # Helpers
    # ============================================================

    def get_campaign_pda_for_db(self, campaign) -> dict:
        pda, bump = self.derive_campaign_pda(campaign.id)
        return {'campaign_pda': str(pda), 'campaign_pda_bump': bump}

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
                details.update({k: v for k, v in escrow_info.items() if k != 'artist_pubkey'})
            except Exception as e:
                details['escrow_error'] = str(e)

        logger.info('[CampaignSolana] Transfer details: %s', details)
        return details

    # ============================================================
    # Withdraw & Stretch Goal Methods
    # ============================================================

    def get_withdraw_instruction_params(self, campaign, backer_wallet: str) -> dict:
        """Return instruction params for frontend to build a withdraw_contribution tx.

        Uses the same account layout as reclaim_contribution but calls
        withdraw_contribution instruction (pre-deadline withdrawal).
        """
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)
        backer_pubkey = Pubkey.from_string(backer_wallet)
        backer_record_pda, _ = self.derive_backer_pda(campaign_pda, backer_pubkey)

        usdc_mint = Pubkey.from_string(self.usdc_mint)
        backer_ata = self.derive_ata(backer_pubkey, usdc_mint)
        vault_ata = self.derive_ata(campaign_pda, usdc_mint)

        return {
            'instruction': 'withdraw_contribution',
            'program_id': str(PROGRAM_ID),
            'accounts': {
                'backer': backer_wallet,
                'campaign_vault': str(campaign_pda),
                'backer_record': str(backer_record_pda),
                'backer_token_account': str(backer_ata),
                'vault_token_account': str(vault_ata),
                'token_program': str(TOKEN_PROGRAM_ID),
            },
            'discriminator': DISC_WITHDRAW_CONTRIBUTION.hex(),
        }

    def add_stretch_milestone_on_chain(self, campaign, milestone_amount: Decimal, deadline_timestamp: int) -> str:
        """Add a stretch milestone to the escrow vault on-chain.

        Called when a stretch goal threshold is crossed by overfunding.
        Transfers additional USDC from campaign vault to escrow vault.
        """
        campaign_pda, _ = self.derive_campaign_pda(campaign.id)

        # Get the escrow vault pubkey from campaign
        escrow_pda = Pubkey.from_string(campaign.escrow_pda)
        usdc_mint = Pubkey.from_string(self.usdc_mint)

        campaign_ata = self.derive_ata(campaign_pda, usdc_mint)
        escrow_ata = self.derive_ata(escrow_pda, usdc_mint)

        amount_lamports = self._usd_to_lamports(milestone_amount)

        data = (
            DISC_ADD_STRETCH_MILESTONE
            + struct.pack('<Q', amount_lamports)        # milestone_amount: u64
            + struct.pack('<q', deadline_timestamp)     # milestone_deadline: i64
        )

        accounts = [
            AccountMeta(self.platform_pubkey, is_signer=True, is_writable=True),    # platform
            AccountMeta(campaign_pda, is_signer=False, is_writable=True),            # campaign_vault
            AccountMeta(escrow_pda, is_signer=False, is_writable=True),              # escrow_vault
            AccountMeta(campaign_ata, is_signer=False, is_writable=True),            # campaign_token_account
            AccountMeta(escrow_ata, is_signer=False, is_writable=True),              # escrow_token_account
            AccountMeta(Pubkey.from_string(str(TOKEN_PROGRAM_ID)), is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_ID, data, accounts)
        sig = self._build_and_send([ix], [self.platform_keypair])

        logger.info('[CampaignSolana] Stretch milestone added: $%s, deadline %d, campaign %d. TX: %s',
                    milestone_amount, deadline_timestamp, campaign.id, sig)
        return sig
