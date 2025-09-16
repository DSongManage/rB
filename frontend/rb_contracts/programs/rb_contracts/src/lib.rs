use anchor_lang::prelude::*;

declare_id!("4znujrwLsjKTNQxLRncUYdGLAHnqsVLQarNP9jVEA57n");

#[program]
pub mod rb_contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
