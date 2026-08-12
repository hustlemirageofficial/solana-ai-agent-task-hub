import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { sql } from "~/db";
import { ensureSchema } from "./schema";
import {
  ApiError,
  DB_NOT_CONFIGURED,
  getTask,
  isDbConfigured,
  toClientRow,
  type TaskRow,
  type TxnRow,
} from "./tasks";
import { getEscrowKeypair } from "./escrow";
import { getServerConnection, serverUsdcMint, USDC_DECIMALS } from "./solana";

/**
 * Release & refund — the payout half of the AgentPay lifecycle.
 *
 * When a task is `awaiting_review` the funder decides:
 *
 *   POST /api/tasks/:id/approve  → escrow pays the agent's payout wallet
 *                                  (release; task → approved)
 *   POST /api/tasks/:id/reject   → escrow refunds the funder
 *                                  (refund; task → rejected → refunded)
 *
 * Both are REAL server-signed on-chain transactions. The escrow keypair
 * (src/server/escrow.ts) is the payer/signer and NEVER leaves the server.
 *
 * No-double-pay / no-double-refund is layered:
 *   1. Atomic status flip BEFORE signing — `update … where id = ? and
 *      status = 'awaiting_review'` with a rows-affected check, so two
 *      concurrent approves cannot both build and sign a payout (the flip is
 *      the cross-process mutex).
 *   2. Unique index on txns.signature as the database backstop.
 *   3. Failure rolls the status back to `awaiting_review` and records the
 *      error in tasks.payout_error so the funder can retry.
 *
 * SOL  → SystemProgram.transfer (escrow → payout/funder, exact lamports).
 * USDC → SPL transferChecked escrow's ATA → recipient's ATA; a missing
 *        recipient ATA is created in the same transaction (escrow pays rent).
 */

export const DEMO_AGENT_PAYOUT_ADDRESS =
  "9d8AnPzpHcqLLgSukdQJH6V1Dz9UA561ya6ZNPJakKQ3";

/**
 * The agent's payout target. Resolution order:
 *   1. AGENT_PAYOUT_ADDRESS env var (base58) — the real agent wallet in a
 *      managed deployment. Invalid values fail loudly (config error).
 *   2. DEMO_AGENT_PAYOUT_ADDRESS — a documented devnet-only demo constant
 *      derived deterministically from the seed "agentpay-demo-agent-wallet-v1"
 *      (Keypair.fromSeed(sha256(seed)).publicKey). It is never the escrow's own
 *      address and never a mainnet address; the UI labels it "demo agent
 *      wallet" so nobody mistakes it for a real payout target.
 */
export function payoutTarget(): { address: string; demo: boolean } {
  const env = process.env.AGENT_PAYOUT_ADDRESS;
  if (env && env.trim()) {
    const address = env.trim();
    try {
      new PublicKey(address);
    } catch {
      throw new ApiError(
        500,
        "AGENT_PAYOUT_ADDRESS is not a valid Solana base58 address"
      );
    }
    return { address, demo: false };
  }
  return { address: DEMO_AGENT_PAYOUT_ADDRESS, demo: true };
}

export type PayoutErrorCode =
  | "bad_amount" // amount is negative / not an integer string
  | "invalid_target" // payout/funder address invalid
  | "insufficient" // escrow balance does not cover the transfer
  | "failed" // transaction failed on-chain
  | "timeout" // confirmation timed out
  | "rpc"; // RPC error while building/sending

export class PayoutError extends Error {
  constructor(
    public code: PayoutErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PayoutError";
  }
}

export type Currency = "SOL" | "USDC";

function currencyOf(task: TaskRow): Currency {
  return task.currency === "USDC" ? "USDC" : "SOL";
}

function amountOf(task: TaskRow): string {
  return String(task.amount_lamports ?? "0");
}

// ---------------------------------------------------------------------------
// Transaction building (pure-ish, testable with a mocked RPC)
// ---------------------------------------------------------------------------

export type BuiltEscrowTransfer = {
  instructions: TransactionInstruction[];
  /** from_addr / to_addr recorded on the txns row (ATA addresses for USDC). */
  from: string;
  to: string;
  /** USDC only: the two associated token accounts (informational). */
  accounts?: { escrowAta: PublicKey; targetAta: PublicKey };
};

/**
 * Build the instruction list for moving `amountLamports` from the escrow to a
 * target address. SOL: SystemProgram.transfer. USDC: transferChecked via the
 * associated token accounts, creating the target's ATA in the same transaction
 * when it does not exist (escrow is the payer and the owner's delegate).
 */
export async function buildEscrowTransferInstructions(input: {
  connection: Connection;
  escrow: PublicKey;
  target: PublicKey;
  amountLamports: string;
  currency: Currency;
}): Promise<BuiltEscrowTransfer> {
  const { connection, escrow, target, amountLamports, currency } = input;
  if (!/^\d+$/.test(amountLamports)) {
    throw new PayoutError("bad_amount", "amount must be a non-negative integer string");
  }
  const amount = BigInt(amountLamports);

  if (currency === "SOL") {
    return {
      instructions: [
        SystemProgram.transfer({
          fromPubkey: escrow,
          toPubkey: target,
          lamports: amount,
        }),
      ],
      from: escrow.toBase58(),
      to: target.toBase58(),
    };
  }

  // ---- USDC: SPL transfer via associated token accounts ----
  let mint: PublicKey;
  try {
    mint = new PublicKey(serverUsdcMint());
  } catch {
    throw new PayoutError("invalid_target", "USDC mint configuration is invalid");
  }
  const escrowAta = await getAssociatedTokenAddress(mint, escrow);
  const targetAta = await getAssociatedTokenAddress(mint, target);

  const instructions: TransactionInstruction[] = [];
  let targetAtaInfo: Awaited<ReturnType<Connection["getAccountInfo"]>> = null;
  try {
    targetAtaInfo = await connection.getAccountInfo(targetAta);
  } catch (err) {
    throw new PayoutError(
      "rpc",
      `could not check the recipient token account: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!targetAtaInfo) {
    // Create the recipient's ATA in the same transaction, funded by the escrow.
    instructions.push(
      createAssociatedTokenAccountInstruction(escrow, targetAta, target, mint)
    );
  }
  instructions.push(
    createTransferCheckedInstruction(
      escrowAta,
      mint,
      targetAta,
      escrow,
      amount,
      USDC_DECIMALS
    )
  );

  return {
    instructions,
    from: escrowAta.toBase58(),
    to: targetAta.toBase58(),
    accounts: { escrowAta, targetAta },
  };
}

/**
 * Sanity-check the escrow covers the amount BEFORE signing (the escrow is the
 * only spender, so there is no race). Non-destructive: returns a detail string
 * instead of throwing so the caller can decide the error code (422).
 */
export async function checkEscrowBalance(input: {
  connection: Connection;
  escrow: PublicKey;
  currency: Currency;
  amountLamports: string;
}): Promise<{ ok: boolean; detail: string }> {
  const { connection, escrow, currency } = input;
  const amount = BigInt(input.amountLamports || "0");
  const human = currency === "SOL" ? "SOL" : "USDC";

  if (currency === "SOL") {
    let balance: number;
    try {
      balance = await connection.getBalance(escrow);
    } catch (err) {
      throw new PayoutError(
        "rpc",
        `could not check the escrow balance: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const ok = balance >= amount;
    return {
      ok,
      detail: ok
        ? ""
        : `escrow SOL balance is ${balance} lamports but the ${human} payout requires ${amount.toString()} lamports (plus a small tx fee)`,
    };
  }

  // USDC: the escrow's ATA for the configured mint.
  const mint = new PublicKey(serverUsdcMint());
  const escrowAta = await getAssociatedTokenAddress(mint, escrow);
  let value: Awaited<ReturnType<Connection["getParsedTokenAccountsByOwner"]>>["value"];
  try {
    const res = await connection.getParsedTokenAccountsByOwner(escrow, { mint });
    value = res.value;
  } catch (err) {
    throw new PayoutError(
      "rpc",
      `could not check the escrow USDC balance: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const found = value.find((v) => v.pubkey.toBase58() === escrowAta.toBase58());
  const available = found
    ? BigInt(
        (found.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } })
          .parsed?.info?.tokenAmount?.amount ?? "0"
      )
    : 0n;
  const ok = available >= amount;
  return {
    ok,
    detail: ok
      ? ""
      : `escrow USDC balance is ${available.toString()} base units but the ${human} payout requires ${amount.toString()} base units`,
  };
}

/**
 * Sign with the escrow keypair, broadcast, and confirm to finalized.
 * Returns the transaction signature. Throws PayoutError on on-chain failure or
 * timeout (a "confirmed" result is accepted after the finality wait expires —
 * the payment is already on-chain and the signature is recorded either way).
 */
export async function signSendConfirm(
  connection: Connection,
  tx: Transaction,
  escrow: Keypair,
  timeoutMs = 90_000
): Promise<string> {
  let signature: string;
  try {
    tx.sign(escrow);
    signature = await connection.sendRawTransaction(tx.serialize(), {
      preflightCommitment: "confirmed",
    });
  } catch (err) {
    throw new PayoutError(
      "failed",
      `could not broadcast the payout transaction: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const deadline = Date.now() + timeoutMs;
  let lastStatus: Awaited<ReturnType<Connection["getSignatureStatus"]>>["value"] = null;
  while (Date.now() < deadline) {
    let value: Awaited<ReturnType<Connection["getSignatureStatus"]>>["value"] = null;
    try {
      const res = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      value = res.value;
    } catch {
      // transient RPC error — keep polling
    }
    if (value) {
      lastStatus = value;
      if (value.err) {
        throw new PayoutError(
          "failed",
          `transaction failed on-chain: ${JSON.stringify(value.err)}`
        );
      }
      if (value.confirmationStatus === "finalized") return signature;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Timeout: accept "confirmed" as a last check — the payment is on-chain.
  if (lastStatus && !lastStatus.err && lastStatus.confirmationStatus) {
    return signature;
  }
  throw new PayoutError(
    "timeout",
    "confirmation timed out — the payment may still land; check the signature on the explorer and retry"
  );
}

// ---------------------------------------------------------------------------
// Payout / refund orchestration
// ---------------------------------------------------------------------------

export type PayoutResult = {
  task: TaskRow;
  txn: TxnRow;
  /** True when this call was an idempotent repeat of an already-processed action. */
  already: boolean;
};

async function findTxn(taskId: string, kind: "release" | "refund"): Promise<TxnRow | null> {
  const rows = await sql()`
    select * from txns where task_id = ${taskId} and kind = ${kind} order by created_at desc limit 1`;
  return rows.length ? (toClientRow(rows[0]) as TxnRow) : null;
}

/**
 * Approve the agent's result: escrow pays the agent's payout wallet.
 * Guards: 404 unknown task, 409 wrong state / double-action, 422 escrow
 * balance insufficient, 502 payout failed on-chain (task left retryable),
 * 503 no database. Idempotent repeats return the recorded release + `already`.
 */
export async function releasePayment(taskId: string): Promise<PayoutResult> {
  if (!isDbConfigured()) throw new ApiError(503, DB_NOT_CONFIGURED);
  await ensureSchema();

  const task = await getTask(taskId);
  if (!task) throw new ApiError(404, "task not found");

  const status = String(task.status);
  if (status === "approved") {
    const existing = await findTxn(taskId, "release");
    if (existing) return { task, txn: existing, already: true };
    // Crash window: flipped to approved but no release txn was recorded. Do not
    // re-send blindly — that could double-pay if the tx actually landed.
    throw new ApiError(
      409,
      "task is already approved but no release transaction was recorded — check the explorer for an outgoing escrow transfer before retrying"
    );
  }
  if (status !== "awaiting_review") {
    throw new ApiError(
      409,
      `task is in status '${status}'; only awaiting_review tasks can be approved`
    );
  }

  const payout = payoutTarget(); // 500 on invalid AGENT_PAYOUT_ADDRESS
  const escrow = await getEscrowKeypair();
  if (payout.address === escrow.publicKey.toBase58()) {
    throw new ApiError(
      500,
      "payout target resolves to the escrow itself — refusing to build a no-op release"
    );
  }
  const currency = currencyOf(task);
  const amount = amountOf(task);
  const connection = getServerConnection();

  // Pre-flight, non-destructive balance sanity check (422, status untouched).
  const check = await checkEscrowBalance({
    connection,
    escrow: escrow.publicKey,
    currency,
    amountLamports: amount,
  });
  if (!check.ok) {
    throw new ApiError(422, `escrow does not cover the release: ${check.detail}`);
  }

  // ---- NO DOUBLE-PAY: atomic awaiting_review → approved BEFORE signing. ----
  const db = sql();
  const flipped = await db`
    update tasks set status = 'approved', updated_at = now()
    where id = ${taskId} and status = 'awaiting_review'
    returning *`;
  if (!flipped.length) {
    const current = await getTask(taskId);
    if (current && String(current.status) === "approved") {
      const existing = await findTxn(taskId, "release");
      if (existing) return { task: current, txn: existing, already: true };
    }
    throw new ApiError(
      409,
      `task is now '${current ? String(current.status) : "?"}' — release not performed (only one payout per task)`
    );
  }

  try {
    const built = await buildEscrowTransferInstructions({
      connection,
      escrow: escrow.publicKey,
      target: new PublicKey(payout.address),
      amountLamports: amount,
      currency,
    });
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: escrow.publicKey, blockhash, lastValidBlockHeight });
    tx.add(...built.instructions);

    const signature = await signSendConfirm(connection, tx, escrow);

    // Record atomically: release txn row + signature on the task.
    const txnId = crypto.randomUUID();
    const [txnRows, updatedRows] = await db.transaction([
      db`insert into txns (id, task_id, kind, currency, amount_lamports, from_addr, to_addr, signature, confirmed)
          values (${txnId}, ${taskId}, 'release', ${currency}, ${amount}, ${built.from}, ${built.to}, ${signature}, true)
          returning *`,
      db`update tasks set release_sig = ${signature}, payout_error = null, updated_at = now()
          where id = ${taskId}
          returning *`,
    ]);
    if (!updatedRows.length) {
      throw new ApiError(500, "task disappeared while recording the release");
    }
    return {
      task: toClientRow(updatedRows[0]) as TaskRow,
      txn: toClientRow(txnRows[0]) as TxnRow,
      already: false,
    };
  } catch (err) {
    // Roll the status back so the funder can retry; record the error. The
    // unique index on txns.signature stays the backstop against any partial
    // recording race.
    const message = err instanceof Error ? err.message : String(err);
    await db`
      update tasks set status = 'awaiting_review', payout_error = ${message}, updated_at = now()
      where id = ${taskId}`;
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, `release failed: ${message}`);
  }
}

/**
 * Reject the agent's result: escrow refunds the funder.
 * Same guards as releasePayment; the refund target is the task's funder.
 * Failure rolls status back to `awaiting_review` (retryable); success leaves
 * the task `refunded` with a recorded kind=refund txn.
 */
export async function refundPayment(taskId: string): Promise<PayoutResult> {
  if (!isDbConfigured()) throw new ApiError(503, DB_NOT_CONFIGURED);
  await ensureSchema();

  const task = await getTask(taskId);
  if (!task) throw new ApiError(404, "task not found");

  const status = String(task.status);
  if (status === "refunded") {
    const existing = await findTxn(taskId, "refund");
    if (existing) return { task, txn: existing, already: true };
    throw new ApiError(
      409,
      "task is already refunded but no refund transaction was recorded — check the explorer before retrying"
    );
  }
  if (status === "rejected") {
    // In-flight refund or a crash after the flip but before recording.
    throw new ApiError(
      409,
      "a refund is already in progress for this task — check the History page or the explorer before retrying"
    );
  }
  if (status !== "awaiting_review") {
    throw new ApiError(
      409,
      `task is in status '${status}'; only awaiting_review tasks can be rejected`
    );
  }

  const funder = task.funder ? String(task.funder) : "";
  if (!funder) {
    throw new ApiError(500, "task has no funder recorded — cannot refund");
  }
  let funderPubkey: PublicKey;
  try {
    funderPubkey = new PublicKey(funder);
  } catch {
    throw new ApiError(500, "task funder address is invalid — cannot refund");
  }

  const escrow = await getEscrowKeypair();
  const currency = currencyOf(task);
  const amount = amountOf(task);
  const connection = getServerConnection();

  const check = await checkEscrowBalance({
    connection,
    escrow: escrow.publicKey,
    currency,
    amountLamports: amount,
  });
  if (!check.ok) {
    throw new ApiError(422, `escrow does not cover the refund: ${check.detail}`);
  }

  // ---- NO DOUBLE-REFUND: atomic awaiting_review → rejected BEFORE signing. ----
  const db = sql();
  const flipped = await db`
    update tasks set status = 'rejected', updated_at = now()
    where id = ${taskId} and status = 'awaiting_review'
    returning *`;
  if (!flipped.length) {
    const current = await getTask(taskId);
    if (current && String(current.status) === "refunded") {
      const existing = await findTxn(taskId, "refund");
      if (existing) return { task: current, txn: existing, already: true };
    }
    throw new ApiError(
      409,
      `task is now '${current ? String(current.status) : "?"}' — refund not performed (only one refund per task)`
    );
  }

  try {
    const built = await buildEscrowTransferInstructions({
      connection,
      escrow: escrow.publicKey,
      target: funderPubkey,
      amountLamports: amount,
      currency,
    });
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: escrow.publicKey, blockhash, lastValidBlockHeight });
    tx.add(...built.instructions);

    const signature = await signSendConfirm(connection, tx, escrow);

    const txnId = crypto.randomUUID();
    const [txnRows, updatedRows] = await db.transaction([
      db`insert into txns (id, task_id, kind, currency, amount_lamports, from_addr, to_addr, signature, confirmed)
          values (${txnId}, ${taskId}, 'refund', ${currency}, ${amount}, ${built.from}, ${built.to}, ${signature}, true)
          returning *`,
      db`update tasks set status = 'refunded', refund_sig = ${signature}, payout_error = null, updated_at = now()
          where id = ${taskId}
          returning *`,
    ]);
    if (!updatedRows.length) {
      throw new ApiError(500, "task disappeared while recording the refund");
    }
    return {
      task: toClientRow(updatedRows[0]) as TaskRow,
      txn: toClientRow(txnRows[0]) as TxnRow,
      already: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db`
      update tasks set status = 'awaiting_review', payout_error = ${message}, updated_at = now()
      where id = ${taskId}`;
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, `refund failed: ${message}`);
  }
}
