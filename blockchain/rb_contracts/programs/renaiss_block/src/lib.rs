use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use std::str::FromStr;

declare_id!("9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH");

pub mod math {
    /// Returns (fee_amount, net_amount) given gross cents and basis points fee
    pub fn split_fee(gross_cents: u64, fee_bps: u16) -> (u64, u64) {
        let fee = ((gross_cents as u128) * (fee_bps as u128)) / 10_000u128;
        let fee = fee as u64;
        let net = gross_cents.saturating_sub(fee);
        (fee, net)
    }
}

/// Platform wallet configured at compile time (no private keys; public key only)
/// If not provided or invalid, royalties will omit the platform recipient.
pub fn get_platform_wallet() -> Option<Pubkey> {
    if let Some(val) = option_env!("PLATFORM_WALLET_PUBKEY") {
        if let Ok(pk) = Pubkey::from_str(val) {
            return Some(pk);
        }
    }
    None
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

        // Platform fee: 10% (1000 bps) of sale_amount_lamports sent to platform wallet (if configured)
        const PLATFORM_FEE_BPS: u16 = 1000; // 10%
        if let Some(platform_pk) = get_platform_wallet() {
            let fee: u64 = ((sale_amount_lamports as u128) * (PLATFORM_FEE_BPS as u128) / 10_000u128) as u64;
            if fee > 0 {
                // Validate the passed platform wallet matches compile-time configured wallet
                require_keys_eq!(ctx.accounts.platform_wallet.key(), platform_pk, FeeError::PlatformWalletMismatch);
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
        }

        // Emit an event to record mint and platform royalties recipient if configured
        emit!(Minted {
            payer: ctx.accounts.payer.key(),
            mint: ctx.accounts.mint.key(),
            recipient_token: ctx.accounts.recipient_token.key(),
            platform_wallet: get_platform_wallet().unwrap_or(Pubkey::default()),
            sale_amount_lamports,
            fee_bps: 1000,
        });
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
    /// CHECK: validated against compile-time constant
    #[account(mut)]
    pub platform_wallet: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
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

#[error_code]
pub enum FeeError {
    #[msg("Platform wallet account does not match configured pubkey")] 
    PlatformWalletMismatch,
}

#[cfg(test)]
mod tests {
    use super::math::*;
    use super::get_platform_wallet;

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
    fn test_platform_wallet_missing() {
        // When PLATFORM_WALLET_PUBKEY is not provided or invalid at compile time, expect None
        assert!(get_platform_wallet().is_none());
    }
}


