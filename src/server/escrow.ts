import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side escrow wallet foundation.
 *
 * Resolution order:
 *   1. ESCROW_PRIVATE_KEY env var (base58-encoded secret key) — for managed
 *      deployments. The private key NEVER leaves the server and is never
 *      exposed through any API.
 *   2. data/escrow.json (base58 secret key), generated on first boot when no
 *      env var is set. File is gitignored and written with 0600 perms.
 *
 * Exposes only the public address via the API (GET /api/escrow/address).
 * Later delegations (funding / payout) will use getEscrowKeypair() to sign
 * release and refund transactions.
 */

let cached: Keypair | null = null;

function escrowFile(): string {
  // process.cwd() is the site root when started via publish.sh / `bun run start`.
  return path.resolve(process.cwd(), "data", "escrow.json");
}

export async function getEscrowKeypair(): Promise<Keypair> {
  if (cached) return cached;

  const envKey = process.env.ESCROW_PRIVATE_KEY;
  if (envKey) {
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
    // Only generate when the file is absent. A corrupt file should fail loudly,
    // never be silently replaced (that would orphan any escrowed funds).
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
    const keypair = Keypair.generate();
    const dir = path.dirname(escrowFile());
    await mkdir(dir, { recursive: true });
    await writeFile(
      escrowFile(),
      JSON.stringify({ privateKey: bs58.encode(keypair.secretKey) }, null, 2) + "\n",
      { mode: 0o600 }
    );
    cached = keypair;
    return keypair;
  }
}

export async function getEscrowAddress(): Promise<string> {
  return (await getEscrowKeypair()).publicKey.toBase58();
}
