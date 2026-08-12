import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type SignatureStatus,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { USDC_DECIMALS, USDC_MINT } from "./solana";

/**
 * Client-side funding: builds the deposit transaction, sends it through the
 * connected wallet adapter, and confirms it on-chain. The server separately
 * re-verifies the resulting signature (src/server/verify.ts) before recording
 * the deposit — this module only moves money, it never claims anything.
 *
 * SOL  → SystemProgram.transfer(wallet → task.escrow), amount in lamports.
 * USDC → SPL transferChecked(wallet's ATA → escrow's ATA) on the configured
 *        USDC mint (VITE_USDC_MINT, devnet default). Missing associated token
 *        accounts (the payer's and/or the escrow's) are created in the same
 *        transaction, paid for by the funder.
 */

export type FundStep =
  | "idle"
  | "building"
  | "awaiting_signature"
  | "broadcasting"
  | "confirming"
  | "verified"
  | "error";

export const FUND_STEPS: { key: FundStep; label: string }[] = [
  { key: "building", label: "Building transaction" },
  { key: "awaiting_signature", label: "Approve in your wallet" },
  { key: "broadcasting", label: "Broadcasting to Solana" },
  { key: "confirming", label: "Confirming on-chain" },
  { key: "verified", label: "Verified & recorded" },
];

export type FundErrorCode =
  | "rejected"
  | "insufficient"
  | "wrong_network"
  | "timeout"
  | "network"
  | "unknown";

export class FundError extends Error {
  constructor(
    public code: FundErrorCode,
    message: string
  ) {
    super(message);
    this.name = "FundError";
  }
}

export type BuildDepositInput = {
  connection: Connection;
  payer: PublicKey;
  escrowAddress: string;
  /** Lamports (SOL) or 1e6 base units (USDC), as a non-negative integer string. */
  amountLamports: string;
  currency: "SOL" | "USDC";
};

export type BuiltDeposit = {
  instructions: TransactionInstruction[];
  /** For USDC: the accounts involved (informational). */
  accounts?: { payerAta: PublicKey; escrowAta: PublicKey };
};

export async function buildDepositInstructions(
  input: BuildDepositInput
): Promise<BuiltDeposit> {
  const { connection, payer, escrowAddress, amountLamports, currency } = input;
  const amount = BigInt(amountLamports);
  if (amount < 0n) throw new FundError("unknown", "Amount cannot be negative");

  if (currency === "SOL") {
    return {
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(escrowAddress),
          lamports: amount,
        }),
      ],
    };
  }

  // ---- USDC: SPL transfer via associated token accounts ----
  const mint = new PublicKey(USDC_MINT);
  const escrow = new PublicKey(escrowAddress);
  const payerAta = await getAssociatedTokenAddress(mint, payer);
  const escrowAta = await getAssociatedTokenAddress(mint, escrow);

  const instructions: TransactionInstruction[] = [];

  // Create missing ATAs in the same transaction (funder pays the rent).
  const [payerAtaInfo, escrowAtaInfo] = await Promise.all([
    connection.getAccountInfo(payerAta),
    connection.getAccountInfo(escrowAta),
  ]);
  if (!payerAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, payerAta, payer, mint)
    );
  }
  if (!escrowAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, escrowAta, escrow, mint)
    );
  }
  instructions.push(
    createTransferCheckedInstruction(
      payerAta,
      mint,
      escrowAta,
      payer,
      amount,
      USDC_DECIMALS
    )
  );

  return { instructions, accounts: { payerAta, escrowAta } };
}

export type FundTaskInput = BuildDepositInput & {
  /** Wallet adapter send — signs and broadcasts via the connected wallet. */
  sendTransaction: (tx: Transaction) => Promise<string>;
  onStep?: (step: FundStep) => void;
  confirmTimeoutMs?: number;
};

export type FundTaskResult = {
  signature: string;
  status: "finalized" | "confirmed";
};

/**
 * Build → sign (wallet) → broadcast → confirm (finalized). Throws FundError
 * with a user-friendly message on rejection / insufficient balance / timeout /
 * network failure.
 */
export async function fundTask(input: FundTaskInput): Promise<FundTaskResult> {
  const { connection, sendTransaction, onStep } = input;
  const confirmTimeoutMs = input.confirmTimeoutMs ?? 90_000;

  const step = (s: FundStep) => onStep?.(s);

  try {
    step("building");
    const { instructions } = await buildDepositInstructions(input);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      feePayer: input.payer,
      blockhash,
      lastValidBlockHeight,
    });
    tx.add(...instructions);

    step("awaiting_signature");
    const signature = await sendTransaction(tx);

    step("broadcasting");
    step("confirming");
    const { status } = await pollForFinality(
      connection,
      signature,
      confirmTimeoutMs
    );

    step("verified");
    return { signature, status };
  } catch (err) {
    // The caller drives the error UI state; we just surface the mapped error.
    throw mapFundError(err);
  }
}

async function pollForFinality(
  connection: Connection,
  signature: string,
  timeoutMs: number
): Promise<{ status: "finalized" | "confirmed" }> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: SignatureStatus | null = null;

  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (value) {
      lastStatus = value;
      if (value.err) {
        throw new Error(
          `transaction failed on-chain: ${JSON.stringify(value.err)}`
        );
      }
      if (value.confirmationStatus === "finalized") {
        return { status: "finalized" };
      }
      if (value.confirmationStatus === "confirmed") {
        // Keep polling for finality; confirmed is a safe fallback below.
        lastStatus = value;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Timeout — one last check before giving up: if it at least reached
  // "confirmed", report success with that weaker guarantee (finality may be
  // slow on devnet but the payment is already on-chain).
  if (lastStatus && !lastStatus.err && lastStatus.confirmationStatus) {
    return { status: "confirmed" };
  }
  throw new FundError(
    "timeout",
    "Confirmation timed out — the payment may still land. Check the signature on the explorer and retry."
  );
}

/** Map wallet/RPC errors to friendly, actionable messages. */
export function mapFundError(err: unknown): FundError {
  const detail = err instanceof Error ? err.message : String(err);
  const msg = detail.toLowerCase();

  if (
    msg.includes("rejected") ||
    msg.includes("declined") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("not approved") ||
    msg.includes("request rejected")
  ) {
    return new FundError(
      "rejected",
      "Transaction was rejected in your wallet. No payment was sent."
    );
  }
  if (
    msg.includes("insufficient") ||
    msg.includes("0x1") ||
    msg.includes("not enough") ||
    msg.includes("simulation failed")
  ) {
    return new FundError(
      "insufficient",
      "The wallet reported an insufficient balance or the transaction would fail (simulation). Check your funds and try again."
    );
  }
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("block height exceeded") ||
    msg.includes("blockheight exceeded")
  ) {
    return new FundError(
      "timeout",
      "The transaction timed out. It may still be confirmed on-chain — check the explorer and retry."
    );
  }
  if (
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("connection") ||
    msg.includes("socket") ||
    msg.includes("rpc")
  ) {
    return new FundError(
      "network",
      "Could not reach the Solana network. Check your connection and try again."
    );
  }
  if (msg.includes("usdc") || msg.includes("token account") || msg.includes("mint")) {
    return new FundError(
      "unknown",
      `USDC transfer problem: ${detail}`
    );
  }

  return new FundError("unknown", detail);
}
