// Placeholder Anchor program for renaissBlock
// This file is a non-functional stub intended for Week 4 prototyping.
// It demonstrates the program shape and royalty math only.
// Do NOT include any private keys. Use a dummy devnet wallet string for configuration.

#![allow(unused)]

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111"); // Placeholder; use Anchor.toml for real ID

// Optional: platform wallet pubkey, configured at runtime via client; kept as const placeholder here
pub const PLATFORM_WALLET_PUBKEY: &str = env!("PLATFORM_WALLET_PUBKEY", "UnknownPlatformPubkey");

#[program]
pub mod renaiss_block {
    use super::*;

    pub fn mint_nft(_ctx: Context<MintNft>, _metadata_uri: String, _royalties_bps: u16) -> Result<()> {
        // Placeholder: In a real implementation, create mint, metadata, and set royalties.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: placeholder; real program would require proper accounts
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub mod math {
    /// Returns (platform_fee_amount, creator_amount)
    pub fn split_fee(gross_cents: u64, fee_bps: u16) -> (u64, u64) {
        let fee = (gross_cents as u128 * fee_bps as u128) / 10_000u128;
        let fee = fee as u64;
        let net = gross_cents.saturating_sub(fee);
        (fee, net)
    }
}

#[cfg(test)]
mod tests {
    use super::math::*;

    #[test]
    fn test_split_fee_10pct() {
        // $100.00 represented as 10000 cents
        let (fee, net) = split_fee(10_000, 1000); // 10% in bps
        assert_eq!(fee, 1000);
        assert_eq!(net, 9000);
    }

    #[test]
    fn test_split_fee_rounding() {
        let (fee, net) = split_fee(12345, 1000); // 10%
        assert_eq!(fee, 1234);
        assert_eq!(net, 11111);
    }

    #[test]
    fn test_platform_wallet_env_present() {
        // The const will be set to default if env isn't provided during build
        let s = super::PLATFORM_WALLET_PUBKEY;
        assert!(!s.is_empty());
    }
}

// The real Anchor program would be defined under the `#[program]` module and
// define an instruction like `mint_nft` that mints an NFT and distributes
// royalties. For MVP, we keep logic here and log platform fee server-side in
// Django via TestFeeLog when the mock mint endpoint is called.


