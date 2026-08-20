import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side escrow wallet foundation.
 *
 * Resolution order:
 *   1. ESCROW_PRIVATE_KEY env var (base58-encoded secret key) — for managed
 *      deployments. The private key NEVER leaves the server and is never
 *      exposed through any API.
 *   2. data/escrow.json (local development only).
 *
 * Managed deployments such as Vercel must provide ESCROW_PRIVATE_KEY. We do
 * not generate or write an escrow secret into the deployment filesystem.
 * This keeps the project client-ready and prevents read-only filesystem errors.
 *
 * Exposes only the public address via the API (GET /api/escrow/address).
 * Later delegations (funding / payout) will use getEscrowKeypair() to sign
 * release and refund transactions.
 */

let cached: Keypair | null = null;

function escrowFile(): string {
  return path.resolve(process.cwd(), "data", "escrow.json");
}

export async function getEscrowKeypair(): Promise<Keypair> {
  if (cached) return cached;

  const envKey = process.env.ESCROW_PRIVATE_KEY;
  if (envKey?.trim()) {
    // Invalid env key should fail loudly — never silently generate a new one.
    cached = Keypair.fromSecretKey(bs58.decode(envKey.trim()));
    return cached;
  }

  try {
    const raw = await readFile(escrowFile(), "utf8");
    const parsed = JSON.parse(raw) as { privateKey?: string };
    if (!parsed.privateKey) throw new Error("escrow.json missing privateKey");
    cached = Keypair.fromSecretKey(bs58.decode(parsed.privateKey));
    return cached;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
    throw new Error(
      "Escrow is not configured. Set ESCROW_PRIVATE_KEY for this deployment."
    );
  }
}

export async function getEscrowAddress(): Promise<string> {
  return (await getEscrowKeypair()).publicKey.toBase58();
}
