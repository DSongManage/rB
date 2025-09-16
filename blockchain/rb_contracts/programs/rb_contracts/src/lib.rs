use anchor_lang::prelude::*;

declare_id!("YourProgramIDHere");

#[program]
pub mod rb_contracts {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, metadata: String, royalties: Vec<(Pubkey, u8)>) -> Result<()> {
        // Mint NFT using anchor_spl (assume token account setup)
        // Store royalties for secondary sales distribution (FR13)
        let total = royalties.iter().map(|&(_, p)| p as u32).sum::<u32>();
        if total != 100 { return err!(ErrorCode::InvalidRoyalties); }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    // Accounts for minting
}

#[error_code]
pub enum ErrorCode {
    #[msg("Royalty percentages must sum to 100")]
    InvalidRoyalties,
}
