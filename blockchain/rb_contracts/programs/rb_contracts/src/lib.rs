use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("YourProgramIDHere");

#[program]
pub mod rb_contracts {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, metadata: String, royalties: Vec<(Pubkey, u8)>) -> Result<()> {
        let total = royalties.iter().map(|&(_, p)| p as u32).sum::<u32>();
        if total != 100 { return err!(ErrorCode::InvalidRoyalties); }
        
        // Mint SPL token as NFT
        anchor_spl::token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            1,  // 1 token for NFT
        )?;
        
        // Store royalties in PDA
        let royalty_account = &mut ctx.accounts.royalty_account;
        royalty_account.royalties = royalties;
        royalty_account.platform_fee = 10;  // Initial 10% (dynamic adjustment post-MVP via oracle)
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    // Simplify space calc for placeholder (avoid reference to royalties in type-level calc)
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
    pub royalties: Vec<(Pubkey, u8)>,
    pub platform_fee: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Royalty percentages must sum to 100")]
    InvalidRoyalties,
}
