// Minimal devnet mint test using @coral-xyz/anchor and @solana/web3.js
// Usage (copy/paste the following exports for devnet):
//   export ANCHOR_WALLET="$(pwd)/blockchain/target/platform_wallet.json"
//   export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
//   export PLATFORM_WALLET_PUBKEY="<platform_pubkey>"
//   export ANCHOR_PROGRAM_ID="9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH"
//   # Optional: backend sync after mint (runs Django management command)
//   export CONTENT_ID="<content_pk>"
//   export BACKEND_DIR="$(pwd)/backend"
//   ts-node blockchain/scripts/mint_test.ts

import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram, Connection, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.ANCHOR_WALLET || path.resolve(__dirname, '..', 'target', 'platform_wallet.json');
  const platformPubkey = process.env.PLATFORM_WALLET_PUBKEY || '';
  const programIdStr = process.env.ANCHOR_PROGRAM_ID || '9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH';

  // Validate essential env/setup
  if (!fs.existsSync(walletPath)) {
    throw new Error('Missing ANCHOR_WALLET file at ' + walletPath);
  }
  if (!programIdStr) {
    throw new Error('Missing ANCHOR_PROGRAM_ID');
  }

  console.log('env check:');
  console.log('  ANCHOR_PROVIDER_URL=', rpc);
  console.log('  ANCHOR_WALLET=', walletPath);
  console.log('  PLATFORM_WALLET_PUBKEY=', platformPubkey ? platformPubkey.slice(0, 8) + '...' : '(missing)');
  console.log('  ANCHOR_PROGRAM_ID=', programIdStr);
  const key = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
  const kp = Keypair.fromSecretKey(key);

  const connection = new Connection(rpc, 'confirmed');
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: 'confirmed' });
  anchor.setProvider(provider);

  // Load IDL: prefer on-chain, fallback to local file
  const idlPath = path.resolve(__dirname, '..', 'rb_contracts', 'target', 'idl', 'renaiss_block.json');
  const programId = new PublicKey(programIdStr);
  let rawIdl: any = null;
  try {
    rawIdl = await anchor.Program.fetchIdl(programId, provider);
    if (rawIdl) {
      console.log('fetched on-chain IDL');
    }
  } catch (e) {
    console.log('fetchIdl failed; will use local IDL');
  }
  if (!rawIdl) {
    rawIdl = JSON.parse(fs.readFileSync(idlPath, 'utf8')) as any;
    console.log('idl path:', idlPath);
  }
  const idl = rawIdl as unknown as anchor.Idl;
  console.log('idl name:', (idl as any).name);
  const idlMethods = ((idl as any)?.instructions || []).map((i: any) => i.name);
  console.log('idl methods:', idlMethods);
  const hasCamel = idlMethods.includes('mintNft');
  const hasSnake = idlMethods.includes('mint_nft');
  if (!hasCamel && !hasSnake) {
    throw new Error('IDL missing mintNft/mint_nft. Ensure anchor build -p renaiss_block generated an up-to-date IDL.');
  }
  const program = new (anchor as any).Program(idl as any, programId, provider);
  const coderKeys = Object.keys(((program as any).coder?.instruction) || {});
  console.log('coder instruction keys:', coderKeys);

  // If on-chain IDL was fetched, log a brief diff vs local file
  try {
    const localPath = path.resolve(__dirname, '..', 'rb_contracts', 'target', 'idl', 'renaiss_block.json');
    const localRaw = JSON.parse(fs.readFileSync(localPath, 'utf8')) as any;
    const localInstr = (localRaw?.instructions || []).map((i: any) => i.name);
    const remoteInstr = idlMethods;
    if (JSON.stringify(localInstr) !== JSON.stringify(remoteInstr)) {
      console.log('IDL diff: local instructions', localInstr, 'remote', remoteInstr);
    }
  } catch {}

  // Simple 429 retry helper
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  async function with429Retry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
    let delay = 500;
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes('429') && attempt < maxAttempts) {
          console.warn(`${label} 429; retrying after ${delay}ms ...`);
          await sleep(delay);
          delay = Math.min(delay * 2, 8000);
          attempt += 1;
          continue;
        }
        throw e;
      }
    }
  }

  const skipAirdrop = process.env.SKIP_AIRDROP === '1';
  // Airdrop if low balance (best-effort)
  if (!skipAirdrop) {
    try { await with429Retry(() => provider.connection.requestAirdrop(kp.publicKey, 1_000_000_000), 'airdrop'); } catch {}
  }

  // Optional: use an alternate payer to demonstrate platform wallet positive delta
  // Set USE_ALT_PAYER=1 to generate a temporary keypair, or provide ALT_PAYER_KEYPAIR to load from file
  let altKp: Keypair | null = null;
  const useAlt = process.env.USE_ALT_PAYER === '1' || !!process.env.ALT_PAYER_KEYPAIR;
  if (useAlt) {
    try {
      if (process.env.ALT_PAYER_KEYPAIR && fs.existsSync(process.env.ALT_PAYER_KEYPAIR)) {
        const raw = Uint8Array.from(JSON.parse(fs.readFileSync(process.env.ALT_PAYER_KEYPAIR, 'utf8')));
        altKp = Keypair.fromSecretKey(raw);
      } else {
        altKp = Keypair.generate();
      }
      // Airdrop to alt payer
      if (!skipAirdrop) {
        try { await with429Retry(() => provider.connection.requestAirdrop(altKp!.publicKey, 1_000_000_000), 'airdrop alt'); } catch {}
      }
      // If skipping airdrop (e.g., QuickNode), fund alt payer from provider wallet
      if (skipAirdrop) {
        const fundLamports = Number(process.env.FUND_LAMPORTS || 200_000_000); // 0.2 SOL default
        try {
          const txFund = new Transaction().add(SystemProgram.transfer({
            fromPubkey: kp.publicKey,
            toPubkey: altKp!.publicKey,
            lamports: fundLamports,
          }));
          const sig = await with429Retry(() => provider.sendAndConfirm(txFund, [], { commitment: 'confirmed' }), 'fund alt payer');
          console.log('funded alt payer with', fundLamports, 'lamports; sig:', sig);
        } catch (e) {
          console.warn('Funding alt payer failed (ensure provider wallet has SOL):', e);
        }
      }
    } catch (e) {
      console.warn('Failed to init alternate payer, falling back to provider wallet:', e);
      altKp = null;
    }
  }

  // Pre-init: create mint (decimals 0) with payer as mint authority, and ensure recipient ATA exists (owned by payer)
  const payer = (altKp ? altKp.publicKey : kp.publicKey);
  let mintPubkey: PublicKey;
  try {
    // mintAuthority = payer; freezeAuthority = null; decimals = 0
    mintPubkey = await with429Retry(() => createMint(provider.connection, kp, payer, null, 0), 'createMint');
  } catch (e) {
    console.error('Mint creation failed:', e);
    throw e;
  }
  // Prepare platform wallet pubkey; we'll snapshot balance right before mint to avoid including any pre-funding/ATA costs
  let platformKey: PublicKey | null = null;
  try { platformKey = platformPubkey ? new PublicKey(platformPubkey) : null; } catch { platformKey = null; }
  let preBal: number | null = null;

  let ata: PublicKey;
  try {
    // Create ATA owned by payer (alt or provider). Fee payer for this ix is the provider wallet (kp)
    const ataAddr = await getAssociatedTokenAddress(mintPubkey, payer, false, TOKEN_PROGRAM_ID);
    const ix = createAssociatedTokenAccountInstruction(
      kp.publicKey,
      ataAddr,
      payer,
      mintPubkey
    );
    const txAta = new Transaction().add(ix);
    const ataSig = await with429Retry(() => provider.sendAndConfirm(txAta, [], { commitment: 'confirmed' }), 'create ATA');
    console.log('ATA created:', ataAddr.toBase58(), 'sig:', ataSig);
    ata = ataAddr;
  } catch (e) {
    console.error('ATA creation failed:', e);
    throw e;
  }

  console.log('provider wallet (platform?)', kp.publicKey.toBase58());
  console.log('payer', payer.toBase58());
  console.log('mint', mintPubkey.toBase58());
  console.log('recipient token', ata.toBase58());

  // Call on-chain instruction
  try {
    const methodName = (['mintNft','mint_nft'] as string[]).find(n => typeof (program as any).methods?.[n] === 'function')
      || coderKeys.find(k => k.toLowerCase().includes('mint'))
      || '';
    const mintMethod = (program as any).methods?.[methodName];
    if (!mintMethod) {
      throw new Error('Program methods missing mint function; available coder keys: ' + coderKeys.join(','));
    }
    const saleLamports = 1_000_000; // 0.001 SOL example
    const builder = mintMethod('ipfs://metadata', saleLamports)
      .accounts({
        payer,
        mint: mintPubkey,
        recipientToken: ata,
        platformWallet: platformKey || payer,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
    // If using an alternate payer, ensure the payer signs
    const maybeSigned = altKp ? builder.signers([altKp]) : builder;

    // Validate accounts before rpc
    const accts: Record<string, any> = { payer, mint: mintPubkey, recipientToken: ata, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
    const undef = Object.entries(accts).filter(([, v]) => !v);
    if (undef.length) {
      console.error('Undefined accounts:', undef.map(([k]) => k));
      throw new Error('Aborting due to undefined accounts');
    }

    // Snapshot platform balance just before invoking program to isolate fee delta from pre-steps
    if (platformKey) {
      try { preBal = await with429Retry(() => provider.connection.getBalance(platformKey!), 'getBalance pre-mint'); } catch {}
    }

    let txSig: string | undefined;
    try {
      txSig = await with429Retry<string>(() => (maybeSigned as any).rpc(), 'program rpc');
    } catch (encodeErr) {
      console.warn('Anchor encode/rpc failed; attempting raw TransactionInstruction fallback ...');
      // Build raw instruction using IDL discriminator + Borsh args (metadata_uri: string, sale_amount: u64)
      const instr = ((idl as any)?.instructions || []).find((i: any) => i.name === 'mint_nft');
      if (!instr || !Array.isArray(instr.discriminator)) {
        throw encodeErr;
      }
      const disc = Buffer.from(instr.discriminator);
      const metaUri = 'ipfs://metadata';
      const uriBytes = Buffer.from(metaUri, 'utf8');
      const len = Buffer.alloc(4); len.writeUInt32LE(uriBytes.length, 0);
      const lamports = Buffer.alloc(8); lamports.writeBigUInt64LE(BigInt(saleLamports), 0);
      const data = Buffer.concat([disc, len, uriBytes, lamports]);
      console.log('raw ix data lens:', { disc: disc.length, uriLen: len.readUInt32LE(0), uriBytes: uriBytes.length, lamports: lamports.length, total: data.length });

      const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: platformKey || payer, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];
      const ix2 = new TransactionInstruction({ programId, keys, data });
      const tx = new Transaction().add(ix2);
      const extraSigners = altKp ? [altKp] as Keypair[] : [];
      txSig = await with429Retry(() => provider.sendAndConfirm(tx, extraSigners, { commitment: 'confirmed' }), 'raw send');
    }
    console.log('tx', txSig);
    // Confirm and log platform wallet balance delta
    try {
      const conf = await with429Retry(() => provider.connection.confirmTransaction(txSig as string, 'confirmed'), 'confirm');
      console.log('tx confirmed:', conf?.value?.err ? 'error' : 'success', conf?.value);
    } catch (e) { console.warn('confirmTransaction failed:', e); }
    if (platformKey) {
      try {
        const postBal = await with429Retry(() => provider.connection.getBalance(platformKey!), 'getBalance post');
        if (typeof preBal === 'number') {
          console.log('platform wallet balance delta (lamports):', postBal - preBal);
        } else {
          console.log('platform wallet balance (post):', postBal);
        }
      } catch {}
    }

    // Optional backend sync: update Content/TestFeeLog via Django management command
    const contentId = process.env.CONTENT_ID;
    const backendDir = process.env.BACKEND_DIR;
    if (contentId && backendDir && fs.existsSync(path.join(backendDir, 'manage.py'))) {
      try {
        console.log('Syncing backend state via mint_content management command...');
        execSync(`python3 manage.py mint_content --content-id ${contentId}`, { cwd: backendDir, stdio: 'inherit' });
      } catch (e) {
        console.error('Backend sync failed:', e);
      }
    }
  } catch (e: any) {
    console.error('mint failed:', e);
    try {
      if (typeof e.getLogs === 'function') {
        const logs = await e.getLogs();
        console.error('tx logs:', logs);
      }
    } catch {}
    console.error('Tip: ensure the mint exists and ATA is initialized (this script pre-inits both).');
  }

  // Note: Content/TestFeeLog updates are performed in Django via MintView or management command.
  // To sync backend state after a successful on-chain mint, run:
  //   source venv/bin/activate && cd backend
  //   python manage.py mint_content --content-id <id>
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


