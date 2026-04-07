use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("4bHUxyXHijqKCh6WnrpaG7V8U67tcgXN44aSwSMgnstg");

/// Grace period after deadline (48 hours in seconds)
const GRACE_PERIOD_SECONDS: i64 = 48 * 60 * 60;
/// Review window after artist submits (72 hours in seconds)
const REVIEW_WINDOW_SECONDS: i64 = 72 * 60 * 60;
/// Hard backstop — max milestone lifetime (90 days in seconds)
const HARD_BACKSTOP_SECONDS: i64 = 90 * 24 * 60 * 60;
/// Max milestones per escrow vault (limited by Solana stack size)
const MAX_MILESTONES: usize = 25;
/// Basis points denominator (10_000 = 100%)
const BPS_DENOMINATOR: u64 = 10_000;
/// Campaign escrow creation window (60 days in seconds)
const CAMPAIGN_ESCROW_WINDOW: i64 = 60 * 24 * 60 * 60;

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
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, EscrowError::FeeTooHigh); // Max 10%
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
        vault.platform_wallet = ctx.accounts.platform_wallet.key();
        vault.fee_bps = fee_bps;
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

        // NOTE: No token transfer here. For campaign-funded escrows, funds come
        // from PDA1 via transfer_to_escrow instruction. For direct escrows,
        // the writer funds separately after initialization.
        msg!(
            "Escrow initialized: {} USDC capacity for {} milestones (awaiting funding)",
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

    /// Writer approves a submitted milestone. Funds release to artist (97%) and platform (3%).
    /// Approve path ignores deadline — if submitted, writer can approve anytime.
    pub fn approve_milestone(
        ctx: Context<ApproveMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        // Extract PDA seeds before mutable borrow
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let fee_bps = ctx.accounts.vault.fee_bps as u64;
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

        // Calculate fee split
        let platform_fee = payment * fee_bps / BPS_DENOMINATOR;
        let artist_payment = payment - platform_fee;

        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Transfer artist portion
        let transfer_artist = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.artist_token_account.to_account_info(),
                authority: vault_info.clone(),
            },
            signer_seeds,
        );
        token::transfer(transfer_artist, artist_payment)?;

        // Transfer platform fee (if any)
        if platform_fee > 0 {
            let transfer_platform = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.platform_token_account.to_account_info(),
                    authority: vault_info,
                },
                signer_seeds,
            );
            token::transfer(transfer_platform, platform_fee)?;
        }

        msg!(
            "Milestone {} approved. {} USDC to artist, {} USDC platform fee",
            milestone_index, artist_payment, platform_fee
        );
        Ok(())
    }

    /// Permissionless crank: auto-approve after 72hr review window expires.
    /// Same fee split as manual approve: artist gets 97%, platform gets 3%.
    pub fn auto_approve_milestone(
        ctx: Context<AutoApproveMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let fee_bps = ctx.accounts.vault.fee_bps as u64;
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

        // Calculate fee split
        let platform_fee = payment * fee_bps / BPS_DENOMINATOR;
        let artist_payment = payment - platform_fee;

        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Transfer artist portion
        let transfer_artist = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.artist_token_account.to_account_info(),
                authority: vault_info.clone(),
            },
            signer_seeds,
        );
        token::transfer(transfer_artist, artist_payment)?;

        // Transfer platform fee (if any)
        if platform_fee > 0 {
            let transfer_platform = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.platform_token_account.to_account_info(),
                    authority: vault_info,
                },
                signer_seeds,
            );
            token::transfer(transfer_platform, platform_fee)?;
        }

        msg!(
            "Milestone {} auto-approved. {} USDC to artist, {} USDC platform fee",
            milestone_index, artist_payment, platform_fee
        );
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

    /// Writer directly releases a milestone without requiring artist submission.
    /// Used by the platform when the off-chain delivery/review process is complete.
    /// Accepts milestones in Pending or Submitted status — same fee split as approve.
    pub fn release_milestone(
        ctx: Context<ApproveMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        let project_id = ctx.accounts.vault.project_id;
        let artist_key = ctx.accounts.vault.artist;
        let bump = ctx.accounts.vault.bump;
        let fee_bps = ctx.accounts.vault.fee_bps as u64;
        let vault_info = ctx.accounts.vault.to_account_info();

        let vault = &mut ctx.accounts.vault;
        let idx = milestone_index as usize;

        require!(idx < vault.milestone_count as usize, EscrowError::InvalidMilestoneIndex);
        require!(
            vault.milestones[idx].status == MilestoneStatus::Pending
                || vault.milestones[idx].status == MilestoneStatus::Submitted,
            EscrowError::InvalidMilestoneStatus
        );

        let payment = vault.milestones[idx].payment_amount;
        vault.milestones[idx].status = MilestoneStatus::Approved;
        vault.released_amount += payment;
        vault.milestones_approved += 1;

        // Calculate fee split
        let platform_fee = payment * fee_bps / BPS_DENOMINATOR;
        let artist_payment = payment - platform_fee;

        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Transfer artist portion
        let transfer_artist = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.artist_token_account.to_account_info(),
                authority: vault_info.clone(),
            },
            signer_seeds,
        );
        token::transfer(transfer_artist, artist_payment)?;

        // Transfer platform fee (if any)
        if platform_fee > 0 {
            let transfer_platform = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.platform_token_account.to_account_info(),
                    authority: vault_info,
                },
                signer_seeds,
            );
            token::transfer(transfer_platform, platform_fee)?;
        }

        msg!(
            "Milestone {} released. {} USDC to artist, {} USDC platform fee",
            milestone_index, artist_payment, platform_fee
        );
        Ok(())
    }

    // ============================================================
    // Campaign Instructions (PDA1)
    // ============================================================

    /// Initialize a campaign vault (PDA1) for fundraising.
    /// Creator sets funding goal, deadline, and campaign type.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        project_id: u64,
        funding_goal: u64,
        deadline: i64,
        campaign_type: CampaignType,
        chapter_count: u8,
        fee_bps: u16,
    ) -> Result<()> {
        require!(funding_goal > 0, EscrowError::ZeroAmount);
        require!(fee_bps <= 1000, EscrowError::FeeTooHigh);

        let clock = Clock::get()?;
        require!(deadline > clock.unix_timestamp, EscrowError::InvalidDeadline);

        let vault = &mut ctx.accounts.campaign_vault;
        vault.creator = ctx.accounts.creator.key();
        vault.project_id = project_id;
        vault.campaign_type = campaign_type;
        vault.funding_goal = funding_goal;
        vault.current_amount = 0;
        vault.backer_count = 0;
        vault.deadline = deadline;
        vault.status = CampaignStatus::Active;
        vault.funded_at = 0;
        vault.escrow_creation_deadline = 0;
        vault.chapter_count = chapter_count;
        vault.chapters_published = 0;
        vault.platform_wallet = ctx.accounts.platform_wallet.key();
        vault.fee_bps = fee_bps;
        vault.escrow_vault = Pubkey::default(); // Set during transfer_to_escrow
        vault.bump = ctx.bumps.campaign_vault;

        msg!("Campaign initialized: {} USDC goal, deadline={}", funding_goal, deadline);
        Ok(())
    }

    /// Backer contributes USDC to the campaign vault.
    /// If the contribution meets the goal, campaign is marked as Funded.
    pub fn contribute(
        ctx: Context<Contribute>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);

        // Extract immutable data before mutable borrow
        let campaign_key = ctx.accounts.campaign_vault.key();
        let backer_key = ctx.accounts.backer.key();

        let vault = &mut ctx.accounts.campaign_vault;
        require!(
            vault.status == CampaignStatus::Active,
            EscrowError::CampaignNotActive
        );

        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= vault.deadline, EscrowError::CampaignDeadlinePassed);

        // Initialize backer record
        let backer_record = &mut ctx.accounts.backer_record;
        // Verify this is a fresh backer record (defense in depth — Anchor init already guarantees this)
        require!(backer_record.amount == 0, EscrowError::AlreadyContributed);
        backer_record.campaign = campaign_key;
        backer_record.backer = backer_key;
        backer_record.amount = amount;
        backer_record.reclaimed = false;
        backer_record.bump = ctx.bumps.backer_record;

        // Transfer USDC from backer to campaign vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.backer_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.backer.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        vault.current_amount += amount;
        vault.backer_count += 1;

        // Check if goal is met
        if vault.current_amount >= vault.funding_goal {
            vault.status = CampaignStatus::Funded;
            vault.funded_at = clock.unix_timestamp;
            // 60-day window for escrow creation
            vault.escrow_creation_deadline = clock.unix_timestamp + CAMPAIGN_ESCROW_WINDOW;
            msg!("Campaign funded! {} USDC reached goal of {}", vault.current_amount, vault.funding_goal);
        } else {
            msg!("Contribution of {} USDC. Total: {}/{}", amount, vault.current_amount, vault.funding_goal);
        }

        Ok(())
    }

    /// Backer reclaims their contribution.
    /// Allowed when: (a) deadline passed & campaign still Active (goal not met),
    /// or (b) campaign is Reclaimable (60-day safety expired).
    pub fn reclaim_contribution(
        ctx: Context<ReclaimContribution>,
    ) -> Result<()> {
        let vault = &ctx.accounts.campaign_vault;
        let backer_record = &mut ctx.accounts.backer_record;

        require!(!backer_record.reclaimed, EscrowError::AlreadyReclaimed);

        let clock = Clock::get()?;
        let can_reclaim = match vault.status {
            CampaignStatus::Active => clock.unix_timestamp > vault.deadline,
            CampaignStatus::Reclaimable => true,
            _ => false,
        };
        require!(can_reclaim, EscrowError::CannotReclaim);

        let amount = backer_record.amount;
        backer_record.reclaimed = true;

        // Transfer USDC from vault back to backer
        let project_id_bytes = vault.project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"campaign", &project_id_bytes, &[vault.bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.backer_token_account.to_account_info(),
                authority: ctx.accounts.campaign_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, amount)?;

        msg!("Backer reclaimed {} USDC from campaign", amount);
        Ok(())
    }

    /// Transfer funds from campaign vault (PDA1) to project escrow vault (PDA2).
    /// Only the creator can call this after the campaign is funded.
    /// The target escrow vault must have a matching project_id.
    pub fn transfer_to_escrow(
        ctx: Context<TransferToEscrow>,
    ) -> Result<()> {
        // Extract data before mutable borrow
        let project_id = ctx.accounts.campaign_vault.project_id;
        let bump = ctx.accounts.campaign_vault.bump;
        let current_amount = ctx.accounts.campaign_vault.current_amount;
        let campaign_status = ctx.accounts.campaign_vault.status;
        let vault_info = ctx.accounts.campaign_vault.to_account_info();

        require!(
            campaign_status == CampaignStatus::Funded,
            EscrowError::CampaignNotFunded
        );
        // CRITICAL: Prevent double-transfer
        require!(
            ctx.accounts.campaign_vault.escrow_vault == Pubkey::default(),
            EscrowError::AlreadyTransferred
        );
        require!(
            ctx.accounts.escrow_vault.project_id == project_id,
            EscrowError::ProjectMismatch
        );

        // Update status BEFORE transfer to prevent re-entry
        let campaign = &mut ctx.accounts.campaign_vault;
        campaign.status = CampaignStatus::Transferred;
        campaign.escrow_vault = ctx.accounts.escrow_vault.key();

        // Transfer from campaign vault token account to escrow vault token account
        let project_id_bytes = project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"campaign", &project_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.campaign_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: vault_info,
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, current_amount)?;
        msg!("Campaign funds ({} USDC) transferred to project escrow", current_amount);
        Ok(())
    }

    /// Permissionless crank: mark campaign as reclaimable if 60-day
    /// escrow creation window has expired without transfer.
    pub fn check_escrow_creation_deadline(
        ctx: Context<CheckEscrowDeadline>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.campaign_vault;
        require!(
            vault.status == CampaignStatus::Funded,
            EscrowError::CampaignNotFunded
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp > vault.escrow_creation_deadline,
            EscrowError::EscrowWindowNotExpired
        );

        vault.status = CampaignStatus::Reclaimable;
        msg!("Campaign marked reclaimable: 60-day escrow creation window expired");
        Ok(())
    }

    /// Creator cancels campaign. If contributions exist, marks as reclaimable.
    pub fn cancel_campaign(
        ctx: Context<CancelCampaign>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.campaign_vault;
        require!(
            vault.status == CampaignStatus::Active,
            EscrowError::CampaignNotActive
        );

        if vault.current_amount > 0 {
            vault.status = CampaignStatus::Reclaimable;
            msg!("Campaign cancelled with contributions — marked reclaimable");
        } else {
            vault.status = CampaignStatus::Reclaimed;
            msg!("Campaign cancelled (no contributions)");
        }

        Ok(())
    }

    /// Return remaining escrow funds (PDA2) back to campaign vault (PDA1).
    /// Permissionless crank: anyone can call once all remaining milestones
    /// are past their hard_backstop (90-day dormancy).
    /// After return, campaign is marked Reclaimable so backers can reclaim.
    pub fn return_to_campaign(
        ctx: Context<ReturnToCampaign>,
    ) -> Result<()> {
        let vault = &ctx.accounts.escrow_vault;

        // Verify campaign is in Transferred status
        require!(
            ctx.accounts.campaign_vault.status == CampaignStatus::Transferred,
            EscrowError::CampaignNotTransferred
        );

        // Verify project_id match
        require!(
            ctx.accounts.campaign_vault.project_id == vault.project_id,
            EscrowError::ProjectMismatch
        );

        // Check all non-terminal milestones are past hard_backstop
        let clock = Clock::get()?;
        for i in 0..vault.milestone_count as usize {
            let ms = &vault.milestones[i];
            if ms.status == MilestoneStatus::Pending || ms.status == MilestoneStatus::Submitted {
                require!(
                    clock.unix_timestamp > ms.hard_backstop,
                    EscrowError::EscrowNotDormant
                );
            }
        }

        // Calculate remaining balance to return
        let remaining = vault.total_amount - vault.released_amount - vault.reclaimed_amount;
        if remaining == 0 {
            // Nothing to return — campaign should be Completed not Reclaimable
            let campaign = &mut ctx.accounts.campaign_vault;
            campaign.status = CampaignStatus::Completed;
            msg!("No remaining funds — campaign completed");
            return Ok(());
        }

        // CRITICAL: Update status BEFORE transfer to prevent double-call
        let campaign = &mut ctx.accounts.campaign_vault;
        campaign.status = CampaignStatus::Reclaimable;

        // Transfer remaining from escrow token account → campaign token account
        let project_id_bytes = vault.project_id.to_le_bytes();
        let artist_key = vault.artist;
        let escrow_bump = vault.bump;
        let seeds: &[&[u8]] = &[b"escrow", &project_id_bytes, artist_key.as_ref(), &[escrow_bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.campaign_token_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, remaining)?;

        msg!("Returned {} USDC from escrow to campaign. Backers can now reclaim.", remaining);
        Ok(())
    }

    /// Proportional reclaim: backer gets their share of remaining balance.
    /// Used after partial milestone completion (some funds already released).
    /// Math: backer_gets = backer_amount * vault_balance / campaign.current_amount
    pub fn proportional_reclaim_contribution(
        ctx: Context<ReclaimContribution>,
    ) -> Result<()> {
        let vault = &ctx.accounts.campaign_vault;
        let backer_record = &mut ctx.accounts.backer_record;

        require!(!backer_record.reclaimed, EscrowError::AlreadyReclaimed);
        require!(
            vault.status == CampaignStatus::Reclaimable,
            EscrowError::CannotReclaim
        );

        // Get current vault token balance for proportional calc
        let vault_balance = ctx.accounts.vault_token_account.amount;
        let backer_amount = backer_record.amount;
        let total_funded = vault.current_amount;

        // Proportional: backer_gets = backer_amount * vault_balance / total_funded
        let backer_gets = if total_funded > 0 {
            std::cmp::min(
                (backer_amount as u128 * vault_balance as u128 / total_funded as u128) as u64,
                vault_balance, // Cap at actual balance to prevent over-withdrawal
            )
        } else {
            0
        };

        require!(backer_gets > 0, EscrowError::ZeroAmount);
        backer_record.reclaimed = true;

        // Transfer from campaign vault to backer
        let project_id_bytes = vault.project_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"campaign", &project_id_bytes, &[vault.bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.backer_token_account.to_account_info(),
                authority: ctx.accounts.campaign_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, backer_gets)?;

        msg!("Backer reclaimed {} USDC (proportional)", backer_gets);
        Ok(())
    }

    /// Backer withdraws their contribution before the campaign deadline.
    /// Only allowed while campaign is Active or Funded and deadline has not passed.
    /// If withdrawal drops below goal and campaign was Funded, reverts to Active.
    pub fn withdraw_contribution(
        ctx: Context<ReclaimContribution>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.campaign_vault;
        let backer_record = &mut ctx.accounts.backer_record;

        require!(!backer_record.reclaimed, EscrowError::AlreadyReclaimed);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= vault.deadline, EscrowError::CampaignDeadlinePassed);
        require!(
            vault.status == CampaignStatus::Active || vault.status == CampaignStatus::Funded,
            EscrowError::CampaignNotActive
        );

        let amount = backer_record.amount;
        backer_record.reclaimed = true;
        require!(vault.current_amount >= amount, EscrowError::InsufficientBalance);
        vault.current_amount -= amount;
        require!(vault.backer_count > 0, EscrowError::InsufficientBalance);
        vault.backer_count -= 1;

        // If was funded and now below goal, revert to Active
        if vault.status == CampaignStatus::Funded && vault.current_amount < vault.funding_goal {
            vault.status = CampaignStatus::Active;
            vault.funded_at = 0;
            vault.escrow_creation_deadline = 0;
        }

        // Transfer USDC from vault back to backer
        let project_id_bytes = vault.project_id.to_le_bytes();
        let bump = vault.bump;
        let seeds: &[&[u8]] = &[b"campaign", &project_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.backer_token_account.to_account_info(),
                authority: ctx.accounts.campaign_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, amount)?;

        msg!("Backer withdrew {} USDC from campaign (pre-deadline)", amount);
        Ok(())
    }

    /// Add a stretch milestone to the escrow vault when a stretch goal threshold
    /// is crossed by overfunding. Transfers additional USDC from campaign vault
    /// to escrow vault to fund the new milestone.
    pub fn add_stretch_milestone(
        ctx: Context<AddStretchMilestone>,
        milestone_amount: u64,
        milestone_deadline: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_vault;
        let idx = escrow.milestone_count as usize;
        require!(idx < MAX_MILESTONES, EscrowError::InvalidMilestoneCount);
        require!(milestone_amount > 0, EscrowError::ZeroAmount);

        let clock = Clock::get()?;
        require!(milestone_deadline > clock.unix_timestamp, EscrowError::InvalidDeadline);

        // Initialize the new milestone
        escrow.milestones[idx] = MilestoneData {
            payment_amount: milestone_amount,
            deadline: milestone_deadline,
            grace_deadline: milestone_deadline + GRACE_PERIOD_SECONDS,
            hard_backstop: clock.unix_timestamp + HARD_BACKSTOP_SECONDS,
            status: MilestoneStatus::Pending,
            submitted_at: 0,
            review_deadline: 0,
        };
        escrow.milestone_count += 1;
        escrow.total_amount = escrow.total_amount
            .checked_add(milestone_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;

        // Transfer additional USDC from campaign vault to escrow vault
        let campaign = &ctx.accounts.campaign_vault;
        let project_id_bytes = campaign.project_id.to_le_bytes();
        let bump = campaign.bump;
        let seeds: &[&[u8]] = &[b"campaign", &project_id_bytes, &[bump]];
        let signer_seeds = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.campaign_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.campaign_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, milestone_amount)?;

        msg!("Added stretch milestone #{}: {} USDC, deadline {}", idx, milestone_amount, milestone_deadline);
        Ok(())
    }

    // ============================================================
    // End Campaign Instructions
    // ============================================================

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

    /// CHECK: Platform wallet pubkey, stored in vault for fee collection
    pub platform_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = writer,
        space = EscrowVault::SIZE,
        seeds = [b"escrow", project_id.to_le_bytes().as_ref(), artist.key().as_ref()],
        bump,
    )]
    pub vault: Box<Account<'info, EscrowVault>>,

    // No token accounts needed — init only creates the PDA structure.
    // Funding happens via transfer_to_escrow (from campaign PDA1).
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
    pub vault: Box<Account<'info, EscrowVault>>,
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub writer: Signer<'info>,

    #[account(
        mut,
        constraint = vault.writer == writer.key() @ EscrowError::Unauthorized,
    )]
    pub vault: Box<Account<'info, EscrowVault>>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Recipient's USDC token account (receives payment).
    /// For direct escrow: the artist. For campaign escrow: any collaborator.
    /// Writer (signer) authorizes who gets paid by approving the milestone.
    /// Must be same mint as the vault to prevent cross-token theft.
    #[account(
        mut,
        constraint = artist_token_account.mint == vault_token_account.mint @ EscrowError::InvalidTokenOwner,
    )]
    pub artist_token_account: Account<'info, TokenAccount>,

    /// Platform's USDC token account (receives fee)
    #[account(
        mut,
        constraint = platform_token_account.owner == vault.platform_wallet @ EscrowError::InvalidTokenOwner,
    )]
    pub platform_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AutoApproveMilestone<'info> {
    /// Anyone can crank auto-approve — no signer constraint on caller
    pub cranker: Signer<'info>,

    #[account(mut)]
    pub vault: Box<Account<'info, EscrowVault>>,

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

    /// Platform's USDC token account (receives fee)
    #[account(
        mut,
        constraint = platform_token_account.owner == vault.platform_wallet @ EscrowError::InvalidTokenOwner,
    )]
    pub platform_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReclaimMilestone<'info> {
    pub writer: Signer<'info>,

    #[account(
        mut,
        constraint = vault.writer == writer.key() @ EscrowError::Unauthorized,
    )]
    pub vault: Box<Account<'info, EscrowVault>>,

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
    pub vault: Box<Account<'info, EscrowVault>>,
}

// ============================================================
// Campaign Account Structs
// ============================================================

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Platform wallet pubkey, stored in vault for fee collection
    pub platform_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = CampaignVault::SIZE,
        seeds = [b"campaign", project_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    /// Fee payer — platform wallet that sponsors rent for backer_record PDA.
    /// In sponsored transactions, this is the platform; backer only signs for USDC authority.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Backer — signs to authorize the USDC transfer from their token account.
    pub backer: Signer<'info>,

    #[account(mut)]
    pub campaign_vault: Account<'info, CampaignVault>,

    #[account(
        init,
        payer = payer,
        space = BackerRecord::SIZE,
        seeds = [b"backer", campaign_vault.key().as_ref(), backer.key().as_ref()],
        bump,
    )]
    pub backer_record: Account<'info, BackerRecord>,

    /// Backer's USDC token account
    #[account(
        mut,
        constraint = backer_token_account.owner == backer.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub backer_token_account: Account<'info, TokenAccount>,

    /// Campaign vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == campaign_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclaimContribution<'info> {
    pub backer: Signer<'info>,

    #[account(
        constraint = campaign_vault.key() == backer_record.campaign @ EscrowError::Unauthorized,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,

    #[account(
        mut,
        constraint = backer_record.backer == backer.key() @ EscrowError::Unauthorized,
    )]
    pub backer_record: Account<'info, BackerRecord>,

    /// Backer's USDC token account (receives refund)
    #[account(
        mut,
        constraint = backer_token_account.owner == backer.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub backer_token_account: Account<'info, TokenAccount>,

    /// Campaign vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == campaign_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferToEscrow<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = campaign_vault.creator == creator.key() @ EscrowError::Unauthorized,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,

    /// The target project escrow vault (PDA2)
    pub escrow_vault: Box<Account<'info, EscrowVault>>,

    /// Campaign vault's USDC token account (source)
    #[account(
        mut,
        constraint = campaign_token_account.owner == campaign_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub campaign_token_account: Account<'info, TokenAccount>,

    /// Escrow vault's USDC token account (destination)
    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CheckEscrowDeadline<'info> {
    /// Anyone can crank this check
    pub cranker: Signer<'info>,

    #[account(mut)]
    pub campaign_vault: Account<'info, CampaignVault>,
}

#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = campaign_vault.creator == creator.key() @ EscrowError::Unauthorized,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,
}

#[derive(Accounts)]
pub struct ReturnToCampaign<'info> {
    /// Permissionless cranker
    pub cranker: Signer<'info>,

    #[account(mut)]
    pub escrow_vault: Box<Account<'info, EscrowVault>>,

    #[account(
        mut,
        constraint = campaign_vault.escrow_vault == escrow_vault.key() @ EscrowError::ProjectMismatch,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,

    /// Escrow vault's USDC token account (source)
    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Campaign vault's USDC token account (destination)
    #[account(
        mut,
        constraint = campaign_token_account.owner == campaign_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub campaign_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AddStretchMilestone<'info> {
    /// Platform signer (only platform can add stretch milestones)
    pub platform: Signer<'info>,

    #[account(
        mut,
        constraint = campaign_vault.status == CampaignStatus::Transferred @ EscrowError::CampaignNotTransferred,
        constraint = campaign_vault.escrow_vault == escrow_vault.key() @ EscrowError::ProjectMismatch,
    )]
    pub campaign_vault: Account<'info, CampaignVault>,

    #[account(mut)]
    pub escrow_vault: Box<Account<'info, EscrowVault>>,

    /// Campaign vault's USDC token account (source of additional funds)
    #[account(
        mut,
        constraint = campaign_token_account.owner == campaign_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub campaign_token_account: Account<'info, TokenAccount>,

    /// Escrow vault's USDC token account (destination)
    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow_vault.key() @ EscrowError::InvalidTokenOwner,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ============================================================
// State
// ============================================================

#[account]
pub struct EscrowVault {
    pub writer: Pubkey,
    pub artist: Pubkey,
    pub platform_wallet: Pubkey,
    pub project_id: u64,
    pub total_amount: u64,
    pub released_amount: u64,
    pub reclaimed_amount: u64,
    pub fee_bps: u16,
    pub milestone_count: u8,
    pub milestones_approved: u8,
    pub milestones_reclaimed: u8,
    pub created_at: i64,
    pub bump: u8,
    /// Inline milestone data (avoids separate PDA per milestone)
    pub milestones: [MilestoneData; MAX_MILESTONES],
}

impl EscrowVault {
    /// 8 (discriminator) + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 1 + 1 + 1 + 8 + 1
    /// + MAX_MILESTONES * MilestoneData::SIZE
    const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 1 + 1 + 1 + 8 + 1
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
// Campaign State
// ============================================================

#[account]
pub struct CampaignVault {
    pub creator: Pubkey,
    pub project_id: u64,
    pub campaign_type: CampaignType,
    pub funding_goal: u64,
    pub current_amount: u64,
    pub backer_count: u32,
    pub deadline: i64,
    pub status: CampaignStatus,
    pub funded_at: i64,
    pub escrow_creation_deadline: i64,
    pub chapter_count: u8,
    pub chapters_published: u8,
    pub platform_wallet: Pubkey,
    pub fee_bps: u16,
    pub escrow_vault: Pubkey,
    pub bump: u8,
}

impl CampaignVault {
    /// 8 (discriminator) + 32 + 8 + 1 + 8 + 8 + 4 + 8 + 1 + 8 + 8 + 1 + 1 + 32 + 2 + 32 + 1 = 163
    const SIZE: usize = 8 + 32 + 8 + 1 + 8 + 8 + 4 + 8 + 1 + 8 + 8 + 1 + 1 + 32 + 2 + 32 + 1;
}

#[account]
pub struct BackerRecord {
    pub campaign: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
    pub reclaimed: bool,
    pub bump: u8,
}

impl BackerRecord {
    /// 8 (discriminator) + 32 + 32 + 8 + 1 + 1 = 82
    const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum CampaignType {
    #[default]
    Collaborative,
    Solo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum CampaignStatus {
    #[default]
    Active,
    Funded,
    Transferred,
    Reclaimable,
    Reclaimed,
    Completed,
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
    #[msg("Fee basis points cannot exceed 1000 (10%)")]
    FeeTooHigh,
    #[msg("Campaign deadline must be in the future")]
    InvalidDeadline,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Campaign deadline has passed")]
    CampaignDeadlinePassed,
    #[msg("Contribution already reclaimed")]
    AlreadyReclaimed,
    #[msg("Cannot reclaim: campaign is not in reclaimable state")]
    CannotReclaim,
    #[msg("Campaign is not funded")]
    CampaignNotFunded,
    #[msg("Project ID mismatch between campaign and escrow")]
    ProjectMismatch,
    #[msg("Escrow creation window has not yet expired")]
    EscrowWindowNotExpired,
    #[msg("Not all milestones are past their hard backstop — escrow is not dormant")]
    EscrowNotDormant,
    #[msg("Campaign must be in Transferred status for this operation")]
    CampaignNotTransferred,
    #[msg("Funds have already been transferred to escrow")]
    AlreadyTransferred,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Insufficient balance for this operation")]
    InsufficientBalance,
    #[msg("Already contributed to this campaign")]
    AlreadyContributed,
}
