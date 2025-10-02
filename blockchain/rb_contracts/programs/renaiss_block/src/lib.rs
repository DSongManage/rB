use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("11111111111111111111111111111111"); // placeholder; Anchor replaces on deploy

pub mod math {
    /// Returns (fee_amount, net_amount) given gross cents and basis points fee
    pub fn split_fee(gross_cents: u64, fee_bps: u16) -> (u64, u64) {
        let fee = ((gross_cents as u128) * (fee_bps as u128)) / 10_000u128;
        let fee = fee as u64;
        let net = gross_cents.saturating_sub(fee);
        (fee, net)
    }
}

#[program]
pub mod renaiss_block {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, _metadata_uri: String, _royalties_bps: u16) -> Result<()> {
        // Minimal: mint 1 token to recipient
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::mint_to(cpi_ctx, 1)?;
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
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
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
}


