import { Connection } from "@solana/web3.js";

/**
 * Server-side Solana configuration. The server reads plain env vars (the client
 * bundle uses VITE_* vars from src/lib/solana.ts — never mix the two).
 * Devnet by default; nothing in this codebase ever hardcodes mainnet.
 *
 * Env vars:
 *   SOLANA_NETWORK  — "devnet" | "testnet" | "mainnet-beta" | "custom"
 *   SOLANA_RPC      — RPC endpoint override
 *   SOLANA_USDC_MINT — USDC mint the platform escrows in (devnet default)
 */

export function serverNetwork(): string {
  return process.env.SOLANA_NETWORK ?? "devnet";
}

export function serverRpcUrl(): string {
  return process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
}

/** USDC mint used for deposits. Must match the client's VITE_USDC_MINT. */
export function serverUsdcMint(): string {
  return (
    process.env.SOLANA_USDC_MINT ??
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // devnet USDC
  );
}

export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

let conn: Connection | null = null;

/**
 * Shared server-side Connection. "confirmed" commitment for reads; deposit
 * verification uses finalized, which getParsedTransaction defaults to.
 */
export function getServerConnection(): Connection {
  if (!conn) {
    conn = new Connection(serverRpcUrl(), {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return conn;
}
