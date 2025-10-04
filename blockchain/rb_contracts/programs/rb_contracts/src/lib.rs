use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("4znujrwLsjKTNQxLRncUYdGLAHnqsVLQarNP9jVEA57n");

#[program]
pub mod rb_contracts {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, metadata: String, royalties: Vec<RoyaltyShare>) -> Result<()> {
        let total: u32 = royalties.iter().map(|s| s.percent as u32).sum();
        if total != 100 { return err!(ErrorCode::InvalidRoyalties); }
        
        anchor_spl::token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            1,
        )?;
        
        let royalty_account = &mut ctx.accounts.royalty_account;
        royalty_account.royalties = royalties;
        royalty_account.platform_fee = 10;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(init, payer = user, space = 8 + 4 + (32 + 1) * 10 + 1)]
    pub royalty_account: Account<'info, RoyaltyAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct RoyaltyAccount {
    pub royalties: Vec<RoyaltyShare>,
    pub platform_fee: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct RoyaltyShare {
    pub recipient: Pubkey,
    pub percent: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Royalty percentages must sum to 100")]
    InvalidRoyalties,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn royalties_sum_to_100_ok() {
        let shares = vec![
            RoyaltyShare { recipient: Pubkey::new_unique(), percent: 60 },
            RoyaltyShare { recipient: Pubkey::new_unique(), percent: 40 },
        ];
        let total: u32 = shares.iter().map(|s| s.percent as u32).sum();
        assert_eq!(total, 100);
    }

    #[test]
    fn royalties_sum_to_100_fail() {
        let shares = vec![
            RoyaltyShare { recipient: Pubkey::new_unique(), percent: 50 },
            RoyaltyShare { recipient: Pubkey::new_unique(), percent: 60 },
        ];
        let total: u32 = shares.iter().map(|s| s.percent as u32).sum();
        assert_ne!(total, 100);
    }
}
