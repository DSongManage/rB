/**
 * Test script for minting collaborative NFTs with multiple creators
 *
 * This demonstrates how to call the mint_collaborative_nft instruction
 * with automatic revenue splitting among multiple creators.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { RenaissBlock } from "../target/types/renaiss_block";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.RenaissBlock as Program<RenaissBlock>;

/**
 * Example: Mint a collaborative NFT with 3 creators
 * - Creator 1: 50% revenue share
 * - Creator 2: 30% revenue share
 * - Creator 3: 20% revenue share
 */
async function testCollaborativeMint() {
  console.log("🚀 Testing Collaborative NFT Minting...\n");

  // Get provider and connection
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;

  // Buyer wallet (payer)
  const buyer = provider.wallet.payer;
  console.log("Buyer:", buyer.publicKey.toBase58());

  // Generate keypairs for 3 creators
  const creator1 = Keypair.generate();
  const creator2 = Keypair.generate();
  const creator3 = Keypair.generate();

  console.log("Creator 1:", creator1.publicKey.toBase58(), "(50%)");
  console.log("Creator 2:", creator2.publicKey.toBase58(), "(30%)");
  console.log("Creator 3:", creator3.publicKey.toBase58(), "(20%)\n");

  // Airdrop SOL to creators for rent
  await connection.requestAirdrop(creator1.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await connection.requestAirdrop(creator2.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await connection.requestAirdrop(creator3.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create mint for the NFT
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    buyer,
    buyer.publicKey,
    null,
    0, // 0 decimals for NFT
    mintKeypair
  );
  console.log("NFT Mint:", mint.toBase58());

  // Get or create buyer's token account
  const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    buyer,
    mint,
    buyer.publicKey
  );
  console.log("Buyer Token Account:", buyerTokenAccount.address.toBase58(), "\n");

  // Platform wallet (should match PLATFORM_WALLET_PUBKEY env var or use default)
  const platformWallet = new PublicKey("YOUR_PLATFORM_WALLET_PUBKEY_HERE");

  // Define creator splits
  const creatorSplits = [
    {
      creatorPubkey: creator1.publicKey,
      percentage: 50,
    },
    {
      creatorPubkey: creator2.publicKey,
      percentage: 30,
    },
    {
      creatorPubkey: creator3.publicKey,
      percentage: 20,
    },
  ];

  // Sale amount (1 SOL)
  const saleAmountLamports = new anchor.BN(1 * LAMPORTS_PER_SOL);

  // NFT metadata
  const metadataUri = "https://arweave.net/YOUR_METADATA_URI";
  const title = "Collaborative Masterpiece #1";

  console.log("💰 Sale Amount:", saleAmountLamports.toNumber() / LAMPORTS_PER_SOL, "SOL");
  console.log("📊 Platform Fee (10%):", (saleAmountLamports.toNumber() * 0.1) / LAMPORTS_PER_SOL, "SOL");
  console.log("💵 Total to Creators (90%):", (saleAmountLamports.toNumber() * 0.9) / LAMPORTS_PER_SOL, "SOL\n");

  // Get balances before
  const buyer_before = await connection.getBalance(buyer.publicKey);
  const creator1_before = await connection.getBalance(creator1.publicKey);
  const creator2_before = await connection.getBalance(creator2.publicKey);
  const creator3_before = await connection.getBalance(creator3.publicKey);

  console.log("📈 Balances Before:");
  console.log("  Buyer:", buyer_before / LAMPORTS_PER_SOL, "SOL");
  console.log("  Creator 1:", creator1_before / LAMPORTS_PER_SOL, "SOL");
  console.log("  Creator 2:", creator2_before / LAMPORTS_PER_SOL, "SOL");
  console.log("  Creator 3:", creator3_before / LAMPORTS_PER_SOL, "SOL\n");

  try {
    // Call mint_collaborative_nft instruction
    const tx = await program.methods
      .mintCollaborativeNft(
        saleAmountLamports,
        creatorSplits,
        metadataUri,
        title
      )
      .accounts({
        buyer: buyer.publicKey,
        platform: platformWallet,
        mint: mint,
        buyerTokenAccount: buyerTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        // Pass creator accounts in same order as splits
        { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
        { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
        { pubkey: creator3.publicKey, isWritable: true, isSigner: false },
      ])
      .rpc();

    console.log("✅ Transaction successful!");
    console.log("📝 Transaction signature:", tx, "\n");

    // Get balances after
    await new Promise(resolve => setTimeout(resolve, 2000));
    const buyer_after = await connection.getBalance(buyer.publicKey);
    const creator1_after = await connection.getBalance(creator1.publicKey);
    const creator2_after = await connection.getBalance(creator2.publicKey);
    const creator3_after = await connection.getBalance(creator3.publicKey);

    console.log("📉 Balances After:");
    console.log("  Buyer:", buyer_after / LAMPORTS_PER_SOL, "SOL");
    console.log("  Creator 1:", creator1_after / LAMPORTS_PER_SOL, "SOL (+", (creator1_after - creator1_before) / LAMPORTS_PER_SOL, ")");
    console.log("  Creator 2:", creator2_after / LAMPORTS_PER_SOL, "SOL (+", (creator2_after - creator2_before) / LAMPORTS_PER_SOL, ")");
    console.log("  Creator 3:", creator3_after / LAMPORTS_PER_SOL, "SOL (+", (creator3_after - creator3_before) / LAMPORTS_PER_SOL, ")\n");

    // Verify revenue distribution
    const creator1_received = creator1_after - creator1_before;
    const creator2_received = creator2_after - creator2_before;
    const creator3_received = creator3_after - creator3_before;

    const remaining_amount = saleAmountLamports.toNumber() * 0.9; // After 10% platform fee
    const expected_creator1 = remaining_amount * 0.5;
    const expected_creator2 = remaining_amount * 0.3;
    const expected_creator3 = remaining_amount * 0.2;

    console.log("✅ Revenue Distribution Verification:");
    console.log("  Creator 1 Expected:", expected_creator1 / LAMPORTS_PER_SOL, "SOL, Received:", creator1_received / LAMPORTS_PER_SOL, "SOL");
    console.log("  Creator 2 Expected:", expected_creator2 / LAMPORTS_PER_SOL, "SOL, Received:", creator2_received / LAMPORTS_PER_SOL, "SOL");
    console.log("  Creator 3 Expected:", expected_creator3 / LAMPORTS_PER_SOL, "SOL, Received:", creator3_received / LAMPORTS_PER_SOL, "SOL");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

/**
 * Example: Test with 2 creators (50/50 split)
 */
async function testTwoCreatorsSplit() {
  console.log("\n🚀 Testing 2 Creators (50/50 Split)...\n");

  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  const buyer = provider.wallet.payer;

  const creator1 = Keypair.generate();
  const creator2 = Keypair.generate();

  console.log("Creator 1:", creator1.publicKey.toBase58(), "(50%)");
  console.log("Creator 2:", creator2.publicKey.toBase58(), "(50%)\n");

  await connection.requestAirdrop(creator1.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await connection.requestAirdrop(creator2.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const mintKeypair = Keypair.generate();
  const mint = await createMint(connection, buyer, buyer.publicKey, null, 0, mintKeypair);
  const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, buyer, mint, buyer.publicKey);

  const platformWallet = new PublicKey("YOUR_PLATFORM_WALLET_PUBKEY_HERE");

  const creatorSplits = [
    { creatorPubkey: creator1.publicKey, percentage: 50 },
    { creatorPubkey: creator2.publicKey, percentage: 50 },
  ];

  const saleAmountLamports = new anchor.BN(2 * LAMPORTS_PER_SOL);

  const tx = await program.methods
    .mintCollaborativeNft(
      saleAmountLamports,
      creatorSplits,
      "https://arweave.net/metadata2",
      "Duet Collaboration #1"
    )
    .accounts({
      buyer: buyer.publicKey,
      platform: platformWallet,
      mint: mint,
      buyerTokenAccount: buyerTokenAccount.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts([
      { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
      { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
    ])
    .rpc();

  console.log("✅ 50/50 Split Transaction successful!");
  console.log("📝 Signature:", tx);
}

// Run tests
async function main() {
  console.log("=".repeat(60));
  console.log("COLLABORATIVE NFT MINTING TESTS");
  console.log("=".repeat(60), "\n");

  try {
    await testCollaborativeMint();
    await testTwoCreatorsSplit();
    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Tests failed:", error);
    process.exit(1);
  }
}

main();
