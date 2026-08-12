/**
 * Client-side Solana configuration. Devnet by default; override at build/runtime
 * via VITE_SOLANA_NETWORK and VITE_SOLANA_RPC (Vite inlines VITE_* vars into the
 * client bundle). Never hardcode mainnet here — mainnet is only reachable by
 * explicitly setting these env vars, which this scaffold never does.
 */
export const SOLANA_NETWORK: string =
  (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? "devnet";

export const SOLANA_RPC: string =
  (import.meta.env.VITE_SOLANA_RPC as string | undefined) ??
  "https://api.devnet.solana.com";

export const IS_DEVNET: boolean = SOLANA_NETWORK.toLowerCase() === "devnet";

/** Network label shown in the UI (e.g. "Devnet", "Mainnet", "Custom"). */
export function networkLabel(): string {
  if (IS_DEVNET) return "Devnet";
  const n = SOLANA_NETWORK.toLowerCase();
  if (n === "mainnet" || n === "mainnet-beta") return "Mainnet";
  if (n === "testnet") return "Testnet";
  return "Custom";
}

/**
 * USDC mint the platform escrows in. Devnet USDC by default; override via
 * VITE_USDC_MINT. Must match the server's SOLANA_USDC_MINT on the same network.
 */
export const USDC_MINT: string =
  (import.meta.env.VITE_USDC_MINT as string | undefined) ??
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

/** Devnet faucet link — only ever offered on devnet. */
export function devnetFaucetUrl(): string | null {
  return IS_DEVNET ? "https://faucet.solana.com" : null;
}

/** Solana explorer link builder (devnet by default). */
export function explorerLink(txOrAddress: string, type: "tx" | "address" = "tx"): string {
  const cluster = IS_DEVNET ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/${type === "tx" ? "tx" : "address"}/${txOrAddress}${cluster}`;
}
