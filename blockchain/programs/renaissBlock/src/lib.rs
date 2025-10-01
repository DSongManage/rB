// Placeholder Anchor program for renaissBlock
// This file is a non-functional stub intended for Week 4 prototyping.
// It demonstrates the program shape and royalty math only.
// Do NOT include any private keys. Use a dummy devnet wallet string for configuration.

#![allow(unused)]

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
}

// The real Anchor program would be defined under the `#[program]` module and
// define an instruction like `mint_nft` that mints an NFT and distributes
// royalties. For MVP, we keep logic here and log platform fee server-side in
// Django via TestFeeLog when the mock mint endpoint is called.


