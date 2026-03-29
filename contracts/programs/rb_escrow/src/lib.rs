use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("AiKX6rLM3kTJfcDPt8pwrmbeVR6WaT8PXAHuJhJZYLSH");

/// Grace period after deadline (48 hours in seconds)
const GRACE_PERIOD_SECONDS: i64 = 48 * 60 * 60;
/// Review window after artist submits (72 hours in seconds)
const REVIEW_WINDOW_SECONDS: i64 = 72 * 60 * 60;
/// Hard backstop — max milestone lifetime (90 days in seconds)
const HARD_BACKSTOP_SECONDS: i64 = 90 * 24 * 60 * 60;
/// Max milestones per escrow vault (limited by Solana stack size)
const MAX_MILESTONES: usize = 10;

#[program]
pub mod rb_escrow {
    use super::*;

    /// Initialize an escrow vault with milestones.
    /// Writer transfers full USDC amount to the PDA vault token account.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        project_id: u64,
        milestone_amounts: Vec<u64>,
        milestone_deadlines: Vec<i64>,
    ) -> Result<()> {
        require!(
            milestone_amounts.len() == milestone_deadlines.len(),
            EscrowError::MilestoneMismatch
        );
        require!(
            milestone_amounts.len() > 0 && milestone_amounts.len() <= MAX_MILESTONES,
            EscrowError::InvalidMilestoneCount
        );

        let total_amount: u64 = milestone_amounts.iter().sum();
        require!(total_amount > 0, EscrowError::ZeroAmount);

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        // Initialize vault state
        let vault = &mut ctx.accounts.vault;
        vault.writer = ctx.accounts.writer.key();
        vault.artist = ctx.accounts.artist.key();
        vault.project_id = project_id;
        vault.total_amount = total_amount;
        vault.released_amount = 0;
        vault.reclaimed_amount = 0;
        vault.milestone_count = milestone_amounts.len() as u8;
        vault.milestones_approved = 0;
        vault.milestones_reclaimed = 0;
        vault.created_at = now;
        vault.bump = ctx.bumps.vault;

        // Initialize milestone data inline (stored in vault account)
        for i in 0..milestone_amounts.len() {
            vault.milestones[i] = MilestoneData {
                payment_amount: milestone_amounts[i],
                deadline: milestone_deadlines[i],
                grace_deadline: milestone_deadlines[i] + GRACE_PERIOD_SECONDS,
                hard_backstop: now + HARD_BACKSTOP_SECONDS,
                status: MilestoneStatus::Pending,
                submitted_at: 0,
                review_deadline: 0,
            };
        }

        // Transfer USDC from writer to vault token account
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.writer_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.writer.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, total_amount)?;

        msg!(
            "Escrow initialized: {} USDC locked for {} milestones",
            total_amount,
            milestone_amounts.len()
        );

        Ok(())
    }

    /// Artist submits a milestone for review.
    pub fn submit_milestone(
        ctx: Context<SubmitMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let idx = milestone_index as usize;

        require!(idx < vault.milestone_count as usize, EscrowError::InvalidMilestoneIndex);

        let milestone = &mut vault.milestones[idx];
        require!(
            milestone.status == MilestoneStatus::Pending,
            EscrowError::InvalidMilestoneStatus
        );

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        // Must be within grace deadline (deadline + 48hr)
        require!(
            now <= milestone.grace_deadline,
            EscrowError::GracePeriodExpired
        );

        milestone.submitted_at = now;
        milestone.review_deadline = now + REVIEW_WINDOW_SECONDS;
        milestone.status = MilestoneStatus::Submitted;

        msg!("Milestone {} submitted for review", milestone_index);

        Ok(())
    }

    /// Writer approves a submitted milestone. Funds release to artist.
    /// Approve path ignores deadline — if submitted, writer can approve anytime.
    pub fn approve_milestone(
        ctx: Context<ApproveMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        // Extract PDA seeds before mutable borrow
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let vault_info = ctx.accounts.vault.to_account_info();

        let vault = &mut ctx.accounts.vault;
        let idx = milestone_index as usize;

        require!(idx < vault.milestone_count as usize, EscrowError::InvalidMilestoneIndex);
        require!(
            vault.milestones[idx].status == MilestoneStatus::Submitted,
            EscrowError::InvalidMilestoneStatus
        );

        let payment = vault.milestones[idx].payment_amount;
        vault.milestones[idx].status = MilestoneStatus::Approved;
        vault.released_amount += payment;
        vault.milestones_approved += 1;

        // Transfer USDC from vault to artist — 100% to artist
        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.artist_token_account.to_account_info(),
                authority: vault_info,
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, payment)?;

        msg!("Milestone {} approved. {} USDC released to artist", milestone_index, payment);
        Ok(())
    }

    /// Permissionless crank: auto-approve after 72hr review window expires.
    pub fn auto_approve_milestone(
        ctx: Context<AutoApproveMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let vault_info = ctx.accounts.vault.to_account_info();

        let vault = &mut ctx.accounts.vault;
        let idx = milestone_index as usize;

        require!(idx < vault.milestone_count as usize, EscrowError::InvalidMilestoneIndex);
        require!(
            vault.milestones[idx].status == MilestoneStatus::Submitted,
            EscrowError::InvalidMilestoneStatus
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp > vault.milestones[idx].review_deadline,
            EscrowError::ReviewWindowNotExpired
        );

        let payment = vault.milestones[idx].payment_amount;
        vault.milestones[idx].status = MilestoneStatus::AutoApproved;
        vault.released_amount += payment;
        vault.milestones_approved += 1;

        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.artist_token_account.to_account_info(),
                authority: vault_info,
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, payment)?;

        msg!("Milestone {} auto-approved. {} USDC released", milestone_index, payment);
        Ok(())
    }

    /// Writer reclaims funds for a milestone where grace period expired
    /// with no submission from the artist.
    pub fn reclaim_milestone(
        ctx: Context<ReclaimMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let vault_info = ctx.accounts.vault.to_account_info();

        let vault = &mut ctx.accounts.vault;
        let idx = milestone_index as usize;

        require!(idx < vault.milestone_count as usize, EscrowError::InvalidMilestoneIndex);
        require!(
            vault.milestones[idx].status == MilestoneStatus::Pending,
            EscrowError::InvalidMilestoneStatus
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp > vault.milestones[idx].grace_deadline,
            EscrowError::GracePeriodNotExpired
        );

        let payment = vault.milestones[idx].payment_amount;
        vault.milestones[idx].status = MilestoneStatus::Reclaimed;
        vault.reclaimed_amount += payment;
        vault.milestones_reclaimed += 1;

        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.writer_token_account.to_account_info(),
                authority: vault_info,
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, payment)?;

        msg!("Milestone {} reclaimed. {} USDC returned to writer", milestone_index, payment);
        Ok(())
    }

    /// Close the escrow vault after all milestones are resolved.
    /// Returns rent to the writer.
    pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
        let vault = &ctx.accounts.vault;

        // Verify all milestones are in terminal state
        for i in 0..vault.milestone_count as usize {
            let status = &vault.milestones[i].status;
            require!(
                *status == MilestoneStatus::Approved
                    || *status == MilestoneStatus::AutoApproved
                    || *status == MilestoneStatus::Reclaimed,
                EscrowError::UnresolvedMilestones
            );
        }

        msg!("Escrow vault closed. All milestones resolved.");

        // Account closure handled by Anchor's `close` constraint
        Ok(())
    }
}

// ============================================================
// Account Structs
// ============================================================

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub writer: Signer<'info>,

    /// CHECK: Artist pubkey, validated by being stored in vault
    pub artist: UncheckedAccount<'info>,

    #[account(
        init,
        payer = writer,
        space = EscrowVault::SIZE,
        seeds = [b"escrow", project_id.to_le_bytes().as_ref(), artist.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, EscrowVault>,

    /// Writer's USDC token account (source of funds)
    #[account(
        mut,
        constraint = writer_token_account.owner == writer.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub writer_token_account: Account<'info, TokenAccount>,

    /// Vault's USDC token account (escrow destination)
    /// This is an ATA owned by the vault PDA
    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    pub artist: Signer<'info>,

    #[account(
        mut,
        constraint = vault.artist == artist.key() @ EscrowError::Unauthorized,
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub writer: Signer<'info>,

    #[account(
        mut,
        constraint = vault.writer == writer.key() @ EscrowError::Unauthorized,
    )]
    pub vault: Account<'info, EscrowVault>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Artist's USDC token account (receives payment)
    #[account(
        mut,
        constraint = artist_token_account.owner == vault.artist @ EscrowError::InvalidTokenOwner,
    )]
    pub artist_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AutoApproveMilestone<'info> {
    /// Anyone can crank auto-approve — no signer constraint on caller
    pub cranker: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, EscrowVault>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Artist's USDC token account
    #[account(
        mut,
        constraint = artist_token_account.owner == vault.artist @ EscrowError::InvalidTokenOwner,
    )]
    pub artist_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReclaimMilestone<'info> {
    pub writer: Signer<'info>,

    #[account(
        mut,
        constraint = vault.writer == writer.key() @ EscrowError::Unauthorized,
    )]
    pub vault: Account<'info, EscrowVault>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Writer's USDC token account (receives refund)
    #[account(
        mut,
        constraint = writer_token_account.owner == writer.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub writer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(mut)]
    pub writer: Signer<'info>,

    #[account(
        mut,
        constraint = vault.writer == writer.key() @ EscrowError::Unauthorized,
        close = writer,
    )]
    pub vault: Account<'info, EscrowVault>,
}

// ============================================================
// State
// ============================================================

#[account]
pub struct EscrowVault {
    pub writer: Pubkey,
    pub artist: Pubkey,
    pub project_id: u64,
    pub total_amount: u64,
    pub released_amount: u64,
    pub reclaimed_amount: u64,
    pub milestone_count: u8,
    pub milestones_approved: u8,
    pub milestones_reclaimed: u8,
    pub created_at: i64,
    pub bump: u8,
    /// Inline milestone data (avoids separate PDA per milestone)
    pub milestones: [MilestoneData; MAX_MILESTONES],
}

impl EscrowVault {
    /// 8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 8 + 1
    /// + 25 * MilestoneData::SIZE
    const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 8 + 1
        + MAX_MILESTONES * MilestoneData::SIZE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct MilestoneData {
    pub payment_amount: u64,
    pub deadline: i64,
    pub grace_deadline: i64,
    pub hard_backstop: i64,
    pub status: MilestoneStatus,
    pub submitted_at: i64,
    pub review_deadline: i64,
}

impl MilestoneData {
    /// 8 + 8 + 8 + 8 + 1 + 8 + 8 = 49
    const SIZE: usize = 8 + 8 + 8 + 8 + 1 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum MilestoneStatus {
    #[default]
    Pending,
    Submitted,
    Approved,
    AutoApproved,
    Reclaimed,
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum EscrowError {
    #[msg("Milestone amounts and deadlines must have the same length")]
    MilestoneMismatch,
    #[msg("Must have between 1 and 10 milestones")]
    InvalidMilestoneCount,
    #[msg("Total amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid milestone index")]
    InvalidMilestoneIndex,
    #[msg("Milestone is not in the required status for this operation")]
    InvalidMilestoneStatus,
    #[msg("Grace period has expired — submission is no longer accepted")]
    GracePeriodExpired,
    #[msg("Grace period has not yet expired — cannot reclaim")]
    GracePeriodNotExpired,
    #[msg("Review window has not yet expired — cannot auto-approve")]
    ReviewWindowNotExpired,
    #[msg("Not all milestones are resolved — cannot close escrow")]
    UnresolvedMilestones,
    #[msg("Unauthorized: you are not the writer or artist for this escrow")]
    Unauthorized,
    #[msg("Token account owner does not match expected authority")]
    InvalidTokenOwner,
}
