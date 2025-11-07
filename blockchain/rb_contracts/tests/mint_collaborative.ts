/**
 * Collaborative NFT Minting Tests
 *
 * Tests the multi-creator minting functionality with automatic revenue splitting
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { RenaissBlock } from "../target/types/renaiss_block";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { expect } from "chai";

// Use require for spl-token to avoid ESM/CJS compatibility issues
const splToken = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } = splToken;

describe("Collaborative NFT Minting", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RenaissBlock as Program<RenaissBlock>;
  const connection = provider.connection;

  let buyer: Keypair;
  let creator1: Keypair;
  let creator2: Keypair;
  let creator3: Keypair;
  let platform: Keypair;
  let mint: PublicKey;
  let buyerTokenAccount: PublicKey;

  // Helper function to airdrop SOL
  async function airdrop(publicKey: PublicKey, amount: number) {
    const signature = await connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  }

  // Helper function to get balance
  async function getBalance(publicKey: PublicKey): Promise<number> {
    return await connection.getBalance(publicKey);
  }

  beforeEach(async () => {
    // Generate keypairs for test accounts
    buyer = Keypair.generate();
    creator1 = Keypair.generate();
    creator2 = Keypair.generate();
    creator3 = Keypair.generate();
    platform = Keypair.generate();

    // Fund all accounts
    console.log("    Funding test accounts...");
    await airdrop(buyer.publicKey, 10);
    await airdrop(creator1.publicKey, 1);
    await airdrop(creator2.publicKey, 1);
    await airdrop(creator3.publicKey, 1);
    await airdrop(platform.publicKey, 1);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create NFT mint
    const mintKeypair = Keypair.generate();
    mint = await createMint(
      connection,
      buyer,
      buyer.publicKey,
      null,
      0, // 0 decimals for NFT
      mintKeypair
    );

    // Create buyer's token account
    const buyerTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      buyer,
      mint,
      buyer.publicKey
    );
    buyerTokenAccount = buyerTokenAccountInfo.address;

    console.log("    Test setup complete");
  });

  describe("Successful Minting Scenarios", () => {
    it("Scenario A: 2-Creator Split (70/30) with 1 SOL", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 70 },
        { creatorPubkey: creator2.publicKey, percentage: 30 },
      ];

      // Get initial balances
      const initialBalances = {
        buyer: await getBalance(buyer.publicKey),
        platform: await getBalance(platform.publicKey),
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
      };

      console.log("    Initial balances:");
      console.log(`      Buyer: ${initialBalances.buyer / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Platform: ${initialBalances.platform / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${initialBalances.creator1 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${initialBalances.creator2 / LAMPORTS_PER_SOL} SOL`);

      // Execute collaborative mint
      try {
        const tx = await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/test-metadata-70-30",
            "Collaborative Art 70/30"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
            { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          ])
          .signers([buyer])
          .rpc();

        console.log(`    Transaction signature: ${tx}`);
      } catch (error) {
        console.error("    Error:", error);
        throw error;
      }

      // Wait for transaction to finalize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get final balances
      const finalBalances = {
        buyer: await getBalance(buyer.publicKey),
        platform: await getBalance(platform.publicKey),
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
      };

      console.log("    Final balances:");
      console.log(`      Buyer: ${finalBalances.buyer / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Platform: ${finalBalances.platform / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${finalBalances.creator1 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${finalBalances.creator2 / LAMPORTS_PER_SOL} SOL`);

      // Calculate differences
      const platformReceived = finalBalances.platform - initialBalances.platform;
      const creator1Received = finalBalances.creator1 - initialBalances.creator1;
      const creator2Received = finalBalances.creator2 - initialBalances.creator2;

      console.log("    Amounts received:");
      console.log(`      Platform: ${platformReceived / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${creator1Received / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${creator2Received / LAMPORTS_PER_SOL} SOL`);

      // Verify platform received 10% (0.1 SOL = 100,000,000 lamports)
      expect(platformReceived).to.equal(0.1 * LAMPORTS_PER_SOL);

      // Verify Creator1 received 70% of remaining 90% (0.63 SOL = 630,000,000 lamports)
      expect(creator1Received).to.equal(0.63 * LAMPORTS_PER_SOL);

      // Verify Creator2 received 30% of remaining 90% (0.27 SOL = 270,000,000 lamports)
      expect(creator2Received).to.equal(0.27 * LAMPORTS_PER_SOL);

      // Verify NFT was minted to buyer
      const tokenAccountInfo = await getAccount(connection, buyerTokenAccount);
      expect(tokenAccountInfo.amount.toString()).to.equal("1");
    });

    it("Scenario B: 3-Creator Split (50/30/20) with 2 SOL", async () => {
      const saleAmount = new anchor.BN(2 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 50 },
        { creatorPubkey: creator2.publicKey, percentage: 30 },
        { creatorPubkey: creator3.publicKey, percentage: 20 },
      ];

      // Get initial balances
      const initialBalances = {
        buyer: await getBalance(buyer.publicKey),
        platform: await getBalance(platform.publicKey),
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
        creator3: await getBalance(creator3.publicKey),
      };

      console.log("    Initial balances:");
      console.log(`      Buyer: ${initialBalances.buyer / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Platform: ${initialBalances.platform / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${initialBalances.creator1 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${initialBalances.creator2 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator3: ${initialBalances.creator3 / LAMPORTS_PER_SOL} SOL`);

      // Execute collaborative mint
      const tx = await program.methods
        .mintCollaborativeNft(
          saleAmount,
          creatorSplits,
          "https://arweave.net/test-metadata-50-30-20",
          "Collaborative Music 50/30/20"
        )
        .accounts({
          buyer: buyer.publicKey,
          platform: platform.publicKey,
          mint: mint,
          buyerTokenAccount: buyerTokenAccount,
        })
        .remainingAccounts([
          { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator3.publicKey, isWritable: true, isSigner: false },
        ])
        .signers([buyer])
        .rpc();

      console.log(`    Transaction signature: ${tx}`);

      // Wait for transaction to finalize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get final balances
      const finalBalances = {
        buyer: await getBalance(buyer.publicKey),
        platform: await getBalance(platform.publicKey),
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
        creator3: await getBalance(creator3.publicKey),
      };

      console.log("    Final balances:");
      console.log(`      Buyer: ${finalBalances.buyer / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Platform: ${finalBalances.platform / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${finalBalances.creator1 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${finalBalances.creator2 / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator3: ${finalBalances.creator3 / LAMPORTS_PER_SOL} SOL`);

      // Calculate differences
      const platformReceived = finalBalances.platform - initialBalances.platform;
      const creator1Received = finalBalances.creator1 - initialBalances.creator1;
      const creator2Received = finalBalances.creator2 - initialBalances.creator2;
      const creator3Received = finalBalances.creator3 - initialBalances.creator3;

      console.log("    Amounts received:");
      console.log(`      Platform: ${platformReceived / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator1: ${creator1Received / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator2: ${creator2Received / LAMPORTS_PER_SOL} SOL`);
      console.log(`      Creator3: ${creator3Received / LAMPORTS_PER_SOL} SOL`);

      // Verify platform received 10% (0.2 SOL = 200,000,000 lamports)
      expect(platformReceived).to.equal(0.2 * LAMPORTS_PER_SOL);

      // Verify Creator1 received 50% of remaining 90% (0.9 SOL = 900,000,000 lamports)
      expect(creator1Received).to.equal(0.9 * LAMPORTS_PER_SOL);

      // Verify Creator2 received 30% of remaining 90% (0.54 SOL = 540,000,000 lamports)
      expect(creator2Received).to.equal(0.54 * LAMPORTS_PER_SOL);

      // Verify Creator3 received 20% of remaining 90% (0.36 SOL = 360,000,000 lamports)
      expect(creator3Received).to.equal(0.36 * LAMPORTS_PER_SOL);

      // Verify NFT was minted to buyer
      const tokenAccountInfo = await getAccount(connection, buyerTokenAccount);
      expect(tokenAccountInfo.amount.toString()).to.equal("1");
    });

    it("Equal Split: 2 Creators (50/50) with 1 SOL", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 50 },
        { creatorPubkey: creator2.publicKey, percentage: 50 },
      ];

      // Get initial balances
      const initialCreator1 = await getBalance(creator1.publicKey);
      const initialCreator2 = await getBalance(creator2.publicKey);

      // Execute collaborative mint
      await program.methods
        .mintCollaborativeNft(
          saleAmount,
          creatorSplits,
          "https://arweave.net/test-metadata-50-50",
          "Equal Collaboration 50/50"
        )
        .accounts({
          buyer: buyer.publicKey,
          platform: platform.publicKey,
          mint: mint,
          buyerTokenAccount: buyerTokenAccount,
        })
        .remainingAccounts([
          { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
        ])
        .signers([buyer])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get final balances
      const finalCreator1 = await getBalance(creator1.publicKey);
      const finalCreator2 = await getBalance(creator2.publicKey);

      const creator1Received = finalCreator1 - initialCreator1;
      const creator2Received = finalCreator2 - initialCreator2;

      // Both should receive 0.45 SOL (50% of 0.9 SOL)
      expect(creator1Received).to.equal(0.45 * LAMPORTS_PER_SOL);
      expect(creator2Received).to.equal(0.45 * LAMPORTS_PER_SOL);
    });
  });

  describe("Validation Tests - Should Fail", () => {
    it("Should fail when splits don't add to 100%", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 70 },
        { creatorPubkey: creator2.publicKey, percentage: 20 }, // Only 90%!
      ];

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "Invalid Split"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
            { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          ])
          .signers([buyer])
          .rpc();

        // Should not reach here
        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("InvalidSplitPercentage");
        console.log("    ✓ Correctly rejected invalid split percentage");
      }
    });

    it("Should fail with splits adding to more than 100%", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 70 },
        { creatorPubkey: creator2.publicKey, percentage: 50 }, // 120% total!
      ];

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "Invalid Split"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
            { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          ])
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("InvalidSplitPercentage");
        console.log("    ✓ Correctly rejected split exceeding 100%");
      }
    });

    it("Should fail with empty creator list", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const creatorSplits = []; // Empty!

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "No Creators"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([])
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("NoCreators");
        console.log("    ✓ Correctly rejected empty creator list");
      }
    });

    it("Should fail with more than 10 creators", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      // Create 11 creators
      const tooManyCreators = [];
      const remainingAccounts = [];
      for (let i = 0; i < 11; i++) {
        const creator = Keypair.generate();
        tooManyCreators.push({
          creatorPubkey: creator.publicKey,
          percentage: Math.floor(100 / 11), // Won't add to 100, but should fail before that check
        });
        remainingAccounts.push({
          pubkey: creator.publicKey,
          isWritable: true,
          isSigner: false,
        });
      }

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            tooManyCreators,
            "https://arweave.net/invalid",
            "Too Many Creators"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts(remainingAccounts)
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("TooManyCreators");
        console.log("    ✓ Correctly rejected more than 10 creators");
      }
    });

    it("Should fail with invalid creator percentage (0%)", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 0 }, // Invalid!
        { creatorPubkey: creator2.publicKey, percentage: 100 },
      ];

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "Zero Percentage"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
            { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          ])
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("InvalidCreatorPercentage");
        console.log("    ✓ Correctly rejected 0% creator percentage");
      }
    });

    it("Should fail with invalid creator percentage (100%)", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 100 }, // Invalid! (must be 1-99)
      ];

      try {
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "100% Single Creator"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
          ])
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("InvalidCreatorPercentage");
        console.log("    ✓ Correctly rejected 100% single creator percentage");
      }
    });

    it("Should fail when creator account mismatch", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 50 },
        { creatorPubkey: creator2.publicKey, percentage: 50 },
      ];

      try {
        // Pass wrong creator in remaining accounts
        await program.methods
          .mintCollaborativeNft(
            saleAmount,
            creatorSplits,
            "https://arweave.net/invalid",
            "Mismatched Creator"
          )
          .accounts({
            buyer: buyer.publicKey,
            platform: platform.publicKey,
            mint: mint,
            buyerTokenAccount: buyerTokenAccount,
          })
          .remainingAccounts([
            { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
            { pubkey: creator3.publicKey, isWritable: true, isSigner: false }, // Wrong! Should be creator2
          ])
          .signers([buyer])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (err) {
        expect(err).to.exist;
        expect(err.toString()).to.include("CreatorAccountMismatch");
        console.log("    ✓ Correctly rejected mismatched creator account");
      }
    });
  });

  describe("Edge Cases", () => {
    it("Should handle very small amounts correctly", async () => {
      const saleAmount = new anchor.BN(1000); // 1000 lamports (very small)

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 50 },
        { creatorPubkey: creator2.publicKey, percentage: 50 },
      ];

      const initialPlatform = await getBalance(platform.publicKey);
      const initialCreator1 = await getBalance(creator1.publicKey);
      const initialCreator2 = await getBalance(creator2.publicKey);

      await program.methods
        .mintCollaborativeNft(
          saleAmount,
          creatorSplits,
          "https://arweave.net/tiny-amount",
          "Tiny Amount Test"
        )
        .accounts({
          buyer: buyer.publicKey,
          platform: platform.publicKey,
          mint: mint,
          buyerTokenAccount: buyerTokenAccount,
        })
        .remainingAccounts([
          { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
        ])
        .signers([buyer])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalPlatform = await getBalance(platform.publicKey);
      const finalCreator1 = await getBalance(creator1.publicKey);
      const finalCreator2 = await getBalance(creator2.publicKey);

      // Platform gets 10% of 1000 = 100 lamports
      expect(finalPlatform - initialPlatform).to.equal(100);

      // Each creator gets 50% of remaining 900 = 450 lamports
      expect(finalCreator1 - initialCreator1).to.equal(450);
      expect(finalCreator2 - initialCreator2).to.equal(450);
    });

    it("Should handle uneven percentages that require rounding", async () => {
      const saleAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const creatorSplits = [
        { creatorPubkey: creator1.publicKey, percentage: 33 },
        { creatorPubkey: creator2.publicKey, percentage: 33 },
        { creatorPubkey: creator3.publicKey, percentage: 34 }, // Adds to 100
      ];

      const initialBalances = {
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
        creator3: await getBalance(creator3.publicKey),
      };

      await program.methods
        .mintCollaborativeNft(
          saleAmount,
          creatorSplits,
          "https://arweave.net/uneven-split",
          "Uneven Split Test"
        )
        .accounts({
          buyer: buyer.publicKey,
          platform: platform.publicKey,
          mint: mint,
          buyerTokenAccount: buyerTokenAccount,
        })
        .remainingAccounts([
          { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
          { pubkey: creator3.publicKey, isWritable: true, isSigner: false },
        ])
        .signers([buyer])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalBalances = {
        creator1: await getBalance(creator1.publicKey),
        creator2: await getBalance(creator2.publicKey),
        creator3: await getBalance(creator3.publicKey),
      };

      // Remaining after 10% platform fee: 900,000,000 lamports
      // Creator1: 33% of 900M = 297,000,000
      // Creator2: 33% of 900M = 297,000,000
      // Creator3: 34% of 900M = 306,000,000
      expect(finalBalances.creator1 - initialBalances.creator1).to.equal(297_000_000);
      expect(finalBalances.creator2 - initialBalances.creator2).to.equal(297_000_000);
      expect(finalBalances.creator3 - initialBalances.creator3).to.equal(306_000_000);
    });
  });
});
