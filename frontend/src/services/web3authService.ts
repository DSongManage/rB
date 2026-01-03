/**
 * Web3Auth Service
 *
 * Handles Web3Auth initialization, connection, and Solana transaction signing.
 * Used for sending USDC from user's wallet to external addresses (off-ramp, transfers).
 */

import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from '@web3auth/base';
import { SolanaPrivateKeyProvider } from '@web3auth/solana-provider';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Configuration
const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
const SOLANA_NETWORK = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');

// USDC Mint addresses
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT = SOLANA_NETWORK === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
export const USDC_DECIMALS = 6;

// Singleton instance
let web3authInstance: Web3Auth | null = null;
let solanaConnection: Connection | null = null;

/**
 * Get or create Solana connection
 */
export function getSolanaConnection(): Connection {
  if (!solanaConnection) {
    solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');
  }
  return solanaConnection;
}

/**
 * Initialize Web3Auth modal (singleton)
 */
export async function initWeb3Auth(): Promise<Web3Auth> {
  if (web3authInstance) {
    return web3authInstance;
  }

  if (!WEB3AUTH_CLIENT_ID) {
    throw new Error('Web3Auth client ID not configured');
  }

  const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.SOLANA,
    chainId: SOLANA_NETWORK === 'mainnet-beta' ? '0x1' : '0x3',
    rpcTarget: SOLANA_RPC_URL,
    displayName: SOLANA_NETWORK === 'mainnet-beta' ? 'Solana Mainnet' : 'Solana Devnet',
    blockExplorerUrl: SOLANA_NETWORK === 'mainnet-beta'
      ? 'https://solscan.io'
      : 'https://solscan.io/?cluster=devnet',
    ticker: 'SOL',
    tickerName: 'Solana',
  };

  const privateKeyProvider = new SolanaPrivateKeyProvider({
    config: { chainConfig },
  });

  web3authInstance = new Web3Auth({
    clientId: WEB3AUTH_CLIENT_ID,
    chainConfig,
    privateKeyProvider,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    uiConfig: {
      appName: 'RenaissBlock',
      mode: 'dark',
      loginMethodsOrder: ['google', 'discord'],
      defaultLanguage: 'en',
    },
  });

  await web3authInstance.initModal();
  return web3authInstance;
}

/**
 * Connect to Web3Auth and get the provider
 * Opens the modal for user to authenticate
 */
export async function connectWeb3Auth(): Promise<IProvider> {
  const web3auth = await initWeb3Auth();

  // If already connected, return existing provider
  if (web3auth.connected && web3auth.provider) {
    return web3auth.provider;
  }

  // Connect (opens modal)
  const provider = await web3auth.connect();
  if (!provider) {
    throw new Error('Failed to connect to Web3Auth');
  }

  return provider;
}

/**
 * Get the connected wallet's public key
 */
export async function getConnectedPublicKey(): Promise<PublicKey> {
  const provider = await connectWeb3Auth();

  const accounts = await provider.request({ method: 'getAccounts' }) as string[] | null;
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found');
  }

  return new PublicKey(accounts[0]);
}

/**
 * Sign and send a transaction using Web3Auth
 */
export async function signAndSendTransaction(
  transaction: Transaction | VersionedTransaction
): Promise<string> {
  const provider = await connectWeb3Auth();
  const connection = getSolanaConnection();

  // Get the public key
  const accounts = await provider.request({ method: 'getAccounts' }) as string[] | null;
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found');
  }
  const publicKey = new PublicKey(accounts[0]);

  // Set recent blockhash and fee payer if legacy transaction
  if (transaction instanceof Transaction) {
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
  }

  // Serialize the transaction
  const serializedTx = transaction instanceof Transaction
    ? transaction.serialize({ requireAllSignatures: false })
    : transaction.serialize();

  // Sign the transaction via Web3Auth provider
  const signedTxResponse = await provider.request({
    method: 'signTransaction',
    params: {
      message: Buffer.from(serializedTx).toString('base64'),
    },
  }) as Uint8Array | null;

  if (!signedTxResponse) {
    throw new Error('Failed to sign transaction');
  }

  // Send the signed transaction
  const signature = await connection.sendRawTransaction(
    new Uint8Array(signedTxResponse),
    { skipPreflight: false, preflightCommitment: 'confirmed' }
  );

  // Confirm the transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

/**
 * Get SOL balance for a wallet
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  const connection = getSolanaConnection();
  const publicKey = new PublicKey(walletAddress);
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get USDC balance for a wallet
 */
export async function getUSDCBalance(walletAddress: string): Promise<number> {
  const connection = getSolanaConnection();
  const publicKey = new PublicKey(walletAddress);
  const usdcMint = new PublicKey(USDC_MINT);

  try {
    // Get the associated token account address
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    // Get token account balance
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return parseFloat(balance.value.uiAmountString || '0');
  } catch (error: any) {
    // If account doesn't exist, balance is 0
    if (error.message?.includes('could not find account')) {
      return 0;
    }
    throw error;
  }
}

/**
 * Check if Web3Auth is connected
 */
export async function isWeb3AuthConnected(): Promise<boolean> {
  if (!web3authInstance) {
    return false;
  }
  return web3authInstance.connected;
}

/**
 * Disconnect from Web3Auth
 */
export async function disconnectWeb3Auth(): Promise<void> {
  if (web3authInstance && web3authInstance.connected) {
    await web3authInstance.logout();
  }
}

/**
 * Get explorer link for a transaction
 */
export function getTransactionExplorerLink(signature: string): string {
  const cluster = SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=devnet';
  return `https://solscan.io/tx/${signature}${cluster}`;
}

/**
 * Get explorer link for an address
 */
export function getAddressExplorerLink(address: string): string {
  const cluster = SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=devnet';
  return `https://solscan.io/account/${address}${cluster}`;
}

/**
 * Validate a Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
