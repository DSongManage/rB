/**
 * USDC Transfer Service
 *
 * Handles building and sending USDC transfers from user's Web3Auth wallet.
 * Supports:
 * - Sending to Bridge liquidation address (off-ramp to bank)
 * - Sending to any external Solana wallet
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  getSolanaConnection,
  getConnectedPublicKey,
  signAndSendTransaction,
  getUSDCBalance,
  USDC_MINT,
  USDC_DECIMALS,
  isValidSolanaAddress,
  getTransactionExplorerLink,
} from './web3authService';
import { API_URL } from '../config';

export interface TransferResult {
  success: boolean;
  signature?: string;
  explorerLink?: string;
  error?: string;
}

export interface LiquidationAddress {
  id: string;
  address: string;
  chain: string;
  is_primary: boolean;
  external_account?: {
    id: string;
    bank_name: string;
    account_last_four: string;
  };
}

/**
 * Get user's primary Bridge liquidation address from backend
 */
export async function getPrimaryLiquidationAddress(): Promise<LiquidationAddress | null> {
  try {
    const response = await fetch(`${API_URL}/api/bridge/liquidation-addresses/`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch liquidation addresses');
    }

    const data = await response.json();
    const addresses: LiquidationAddress[] = data.results || data || [];

    // Find the primary address
    const primary = addresses.find(addr => addr.is_primary);
    return primary || addresses[0] || null;
  } catch (error) {
    console.error('Error fetching liquidation address:', error);
    return null;
  }
}

/**
 * Build a USDC transfer transaction
 */
async function buildUSDCTransferTransaction(
  fromWallet: PublicKey,
  toAddress: string,
  amount: number
): Promise<Transaction> {
  const connection = getSolanaConnection();
  const usdcMint = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(toAddress);

  // Get sender's USDC token account
  const fromTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    fromWallet,
    false,
    TOKEN_PROGRAM_ID
  );

  // Get recipient's USDC token account
  const toTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    toPubkey,
    true, // Allow off-curve for PDAs
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction();

  // Check if recipient's token account exists
  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

  if (!toAccountInfo) {
    // Create associated token account for recipient
    // The sender pays for this (standard practice)
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromWallet, // payer
        toTokenAccount, // associated token account
        toPubkey, // owner
        usdcMint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Convert amount to token units (USDC has 6 decimals)
  const amountInUnits = BigInt(Math.floor(amount * Math.pow(10, USDC_DECIMALS)));

  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      fromTokenAccount, // source
      toTokenAccount, // destination
      fromWallet, // owner
      amountInUnits, // amount
      [], // multi-signers (none)
      TOKEN_PROGRAM_ID
    )
  );

  return transaction;
}

/**
 * Send USDC to Bridge liquidation address for off-ramp
 */
export async function withdrawToBank(amount: number): Promise<TransferResult> {
  try {
    // Validate amount
    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    // Get the liquidation address
    const liquidationAddr = await getPrimaryLiquidationAddress();
    if (!liquidationAddr) {
      return {
        success: false,
        error: 'No liquidation address found. Please complete Bridge setup first.',
      };
    }

    // Get user's wallet
    const fromWallet = await getConnectedPublicKey();

    // Check balance
    const balance = await getUSDCBalance(fromWallet.toString());
    if (balance < amount) {
      return {
        success: false,
        error: `Insufficient USDC balance. Available: ${balance.toFixed(2)} USDC`,
      };
    }

    // Build and send transaction
    const transaction = await buildUSDCTransferTransaction(
      fromWallet,
      liquidationAddr.address,
      amount
    );

    const signature = await signAndSendTransaction(transaction);

    return {
      success: true,
      signature,
      explorerLink: getTransactionExplorerLink(signature),
    };
  } catch (error: any) {
    console.error('Withdraw to bank error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send transaction',
    };
  }
}

/**
 * Send USDC to any external wallet address
 */
export async function sendUSDC(
  toAddress: string,
  amount: number
): Promise<TransferResult> {
  try {
    // Validate address
    if (!isValidSolanaAddress(toAddress)) {
      return { success: false, error: 'Invalid Solana address' };
    }

    // Validate amount
    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    // Get user's wallet
    const fromWallet = await getConnectedPublicKey();

    // Don't allow sending to self
    if (fromWallet.toString() === toAddress) {
      return { success: false, error: 'Cannot send to your own wallet' };
    }

    // Check balance
    const balance = await getUSDCBalance(fromWallet.toString());
    if (balance < amount) {
      return {
        success: false,
        error: `Insufficient USDC balance. Available: ${balance.toFixed(2)} USDC`,
      };
    }

    // Build and send transaction
    const transaction = await buildUSDCTransferTransaction(
      fromWallet,
      toAddress,
      amount
    );

    const signature = await signAndSendTransaction(transaction);

    return {
      success: true,
      signature,
      explorerLink: getTransactionExplorerLink(signature),
    };
  } catch (error: any) {
    console.error('Send USDC error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send transaction',
    };
  }
}

/**
 * Estimate transaction fee for USDC transfer
 * Returns fee in SOL
 */
export async function estimateTransferFee(
  toAddress: string,
  needsAccountCreation: boolean = false
): Promise<number> {
  const connection = getSolanaConnection();

  // Base transaction fee (signature + recent blockhash)
  const baseFee = 5000; // 5000 lamports = 0.000005 SOL

  // If we need to create the recipient's token account, add rent
  let accountCreationFee = 0;
  if (needsAccountCreation) {
    // Rent for an SPL token account (165 bytes)
    const rentExemption = await connection.getMinimumBalanceForRentExemption(165);
    accountCreationFee = rentExemption;
  }

  const totalLamports = baseFee + accountCreationFee;
  return totalLamports / 1e9; // Convert to SOL
}

/**
 * Check if recipient needs token account creation
 */
export async function checkRecipientNeedsAccount(toAddress: string): Promise<boolean> {
  if (!isValidSolanaAddress(toAddress)) {
    return false;
  }

  const connection = getSolanaConnection();
  const usdcMint = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(toAddress);

  const toTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    toPubkey,
    true,
    TOKEN_PROGRAM_ID
  );

  const accountInfo = await connection.getAccountInfo(toTokenAccount);
  return accountInfo === null;
}
