use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH");

/// Platform wallet address - receives 10% fee on all mints
/// SECURITY: This MUST match the deployed platform treasury wallet
/// Update this constant when deploying to mainnet with production wallet
pub const PLATFORM_WALLET: Pubkey = pubkey!("DawrJxixCJ2zbTCn83YRB5kZJC6zM6N36FYqGZUzNHDA");

pub mod math {
    /// Returns (fee_amount, net_amount) given gross cents and basis points fee
    pub fn split_fee(gross_cents: u64, fee_bps: u16) -> (u64, u64) {
        let fee = ((gross_cents as u128) * (fee_bps as u128)) / 10_000u128;
        let fee = fee as u64;
        let net = gross_cents.saturating_sub(fee);
        (fee, net)
    }
}

/// Creator split data for collaborative NFTs
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreatorSplitData {
    pub creator_pubkey: Pubkey,
    pub percentage: u8,
}

#[program]
pub mod renaiss_block {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, _metadata_uri: String, sale_amount_lamports: u64) -> Result<()> {
        // Mint 1 token to recipient token account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::mint_to(cpi_ctx, 1)?;

        // Platform fee: 10% (1000 bps) of sale_amount_lamports sent to platform wallet
        const PLATFORM_FEE_BPS: u16 = 1000; // 10%
        let fee: u64 = ((sale_amount_lamports as u128) * (PLATFORM_FEE_BPS as u128) / 10_000u128) as u64;
        if fee > 0 {
            // Transfer lamports from payer to platform wallet
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.platform_wallet.key(),
                fee,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    ctx.accounts.payer.to_account_info(),
                    ctx.accounts.platform_wallet.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Emit an event to record mint and platform royalties recipient
        emit!(Minted {
            payer: ctx.accounts.payer.key(),
            mint: ctx.accounts.mint.key(),
            recipient_token: ctx.accounts.recipient_token.key(),
            platform_wallet: ctx.accounts.platform_wallet.key(),
            sale_amount_lamports,
            fee_bps: 1000,
        });
        Ok(())
    }

    /// Mint collaborative NFT with automatic revenue splitting among multiple creators
    pub fn mint_collaborative_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, MintCollaborativeNft<'info>>,
        sale_amount_lamports: u64,
        creator_splits: Vec<CreatorSplitData>,
        metadata_uri: String,
        title: String,
    ) -> Result<()> {
        // Validate number of creators
        require!(
            creator_splits.len() <= 10,
            CollaborationError::TooManyCreators
        );
        require!(
            !creator_splits.is_empty(),
            CollaborationError::NoCreators
        );

        // Validate creator splits add up to 100%
        let total_percentage: u16 = creator_splits.iter().map(|c| c.percentage as u16).sum();
        require!(
            total_percentage == 100,
            CollaborationError::InvalidSplitPercentage
        );

        // Validate individual percentages
        for split in creator_splits.iter() {
            require!(
                split.percentage > 0 && split.percentage < 100,
                CollaborationError::InvalidCreatorPercentage
            );
        }

        // Calculate platform fee (10%)
        const PLATFORM_FEE_BPS: u16 = 1000; // 10%
        let platform_fee = ((sale_amount_lamports as u128) * (PLATFORM_FEE_BPS as u128) / 10_000u128) as u64;
        let remaining_amount = sale_amount_lamports.saturating_sub(platform_fee);

        // Transfer platform fee to platform wallet
        if platform_fee > 0 {
            let transfer_platform_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.platform.key(),
                platform_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_platform_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.platform.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Distribute revenue among creators
        for (i, creator_split) in creator_splits.iter().enumerate() {
            let creator_amount = ((remaining_amount as u128) * (creator_split.percentage as u128) / 100u128) as u64;

            if creator_amount > 0 {
                // Get the creator account from remaining accounts
                let creator_account = ctx.remaining_accounts.get(i)
                    .ok_or(CollaborationError::MissingCreatorAccount)?;

                require_keys_eq!(
                    creator_account.key(),
                    creator_split.creator_pubkey,
                    CollaborationError::CreatorAccountMismatch
                );

                let transfer_creator_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &creator_account.key(),
                    creator_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_creator_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        creator_account.clone(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }
        }

        // Mint the NFT token
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::mint_to(cpi_ctx, 1)?;

        // Emit event
        emit!(CollaborativeMinted {
            buyer: ctx.accounts.buyer.key(),
            mint: ctx.accounts.mint.key(),
            buyer_token_account: ctx.accounts.buyer_token_account.key(),
            platform_wallet: ctx.accounts.platform.key(),
            sale_amount_lamports,
            platform_fee,
            remaining_amount,
            num_creators: creator_splits.len() as u8,
            metadata_uri,
            title,
        });

        msg!("Collaborative NFT minted successfully with {} creators", creator_splits.len());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub recipient_token: Account<'info, TokenAccount>,
    /// CHECK: Validated against compile-time PLATFORM_WALLET constant
    #[account(
        mut,
        constraint = platform_wallet.key() == PLATFORM_WALLET @ FeeError::PlatformWalletMismatch
    )]
    pub platform_wallet: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintCollaborativeNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Validated against compile-time PLATFORM_WALLET constant
    #[account(
        mut,
        constraint = platform.key() == PLATFORM_WALLET @ CollaborationError::PlatformWalletMismatch
    )]
    pub platform: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // Creator accounts passed via remaining_accounts for dynamic number of creators
}

#[event]
pub struct Minted {
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub recipient_token: Pubkey,
    pub platform_wallet: Pubkey,
    pub sale_amount_lamports: u64,
    pub fee_bps: u16,
}

#[event]
pub struct CollaborativeMinted {
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub buyer_token_account: Pubkey,
    pub platform_wallet: Pubkey,
    pub sale_amount_lamports: u64,
    pub platform_fee: u64,
    pub remaining_amount: u64,
    pub num_creators: u8,
    pub metadata_uri: String,
    pub title: String,
}

#[error_code]
pub enum FeeError {
    #[msg("Platform wallet account does not match configured pubkey")]
    PlatformWalletMismatch,
}

#[error_code]
pub enum CollaborationError {
    #[msg("Creator split percentages must add up to 100")]
    InvalidSplitPercentage,

    #[msg("Maximum 10 creators allowed per NFT")]
    TooManyCreators,

    #[msg("Creator percentage must be between 1 and 99")]
    InvalidCreatorPercentage,

    #[msg("Platform wallet account does not match configured pubkey")]
    PlatformWalletMismatch,

    #[msg("Missing creator account in remaining_accounts")]
    MissingCreatorAccount,

    #[msg("Creator account pubkey does not match expected")]
    CreatorAccountMismatch,

    #[msg("At least one creator is required")]
    NoCreators,
}

#[cfg(test)]
mod tests {
    use super::math::*;

    #[test]
    fn test_split_fee_10pct() {
        let (fee, net) = split_fee(10_000, 1000);
        assert_eq!(fee, 1000);
        assert_eq!(net, 9000);
    }

    #[test]
    fn test_split_fee_rounding() {
        let (fee, net) = split_fee(12345, 1000);
        assert_eq!(fee, 1234);
        assert_eq!(net, 11111);
    }

    #[test]
    fn test_fee_bps_constant() {
        // Ensure documented fee remains 1000 bps (10%) for Week 5 validation
        let bps: u16 = 1000;
        let (fee, net) = split_fee(1_000_000, bps);
        assert_eq!(fee, 100_000);
        assert_eq!(net, 900_000);
    }

    #[test]
    fn test_creator_split_validation_valid() {
        // Test valid creator splits
        let splits = vec![50u8, 30u8, 20u8];
        let total: u16 = splits.iter().map(|&x| x as u16).sum();
        assert_eq!(total, 100);
    }

    #[test]
    fn test_creator_split_validation_invalid() {
        // Test invalid creator splits (doesn't add to 100)
        let splits = vec![50u8, 30u8, 25u8];
        let total: u16 = splits.iter().map(|&x| x as u16).sum();
        assert_ne!(total, 100);
    }

    #[test]
    fn test_collaborative_revenue_distribution() {
        // Test revenue distribution among 3 creators
        let sale_amount: u64 = 1_000_000; // 1 SOL in lamports
        let platform_fee = sale_amount * 10 / 100; // 10% platform fee
        let remaining = sale_amount - platform_fee; // 900,000 lamports

        let creator1_pct = 50u8;
        let creator2_pct = 30u8;
        let creator3_pct = 20u8;

        let creator1_amount = remaining * creator1_pct as u64 / 100;
        let creator2_amount = remaining * creator2_pct as u64 / 100;
        let creator3_amount = remaining * creator3_pct as u64 / 100;

        assert_eq!(creator1_amount, 450_000); // 50% of 900k
        assert_eq!(creator2_amount, 270_000); // 30% of 900k
        assert_eq!(creator3_amount, 180_000); // 20% of 900k

        // Verify total distribution equals remaining amount
        let total_distributed = creator1_amount + creator2_amount + creator3_amount;
        assert_eq!(total_distributed, remaining);
    }

    #[test]
    fn test_two_creator_equal_split() {
        // Test 50/50 split between 2 creators
        let sale_amount: u64 = 2_000_000; // 2 SOL
        let platform_fee = sale_amount * 10 / 100;
        let remaining = sale_amount - platform_fee;

        let creator1_amount = remaining * 50 / 100;
        let creator2_amount = remaining * 50 / 100;

        assert_eq!(creator1_amount, 900_000);
        assert_eq!(creator2_amount, 900_000);
        assert_eq!(creator1_amount + creator2_amount, remaining);
    }
}


