# rb_contracts (archived)

This workspace now uses `programs/renaiss_block` as the single program of record for devnet.

- `programs/rb_contracts` is retained as an archived/localnet prototype.
- Devnet mappings (see `Anchor.toml`) point to `renaiss_block`.
- Scripts and backend integrations load the `renaiss_block` IDL.

Recommended: avoid modifying `rb_contracts` for new work; focus on `renaiss_block`.
