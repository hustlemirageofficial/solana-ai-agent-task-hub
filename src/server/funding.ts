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
import {
  DepositVerificationError,
  depositErrorDetail,
  verifyDeposit,
  type VerifiedDeposit,
} from "./verify";
import { kickoffExecution } from "./agent";

/**
 * Deposit recording — the server side of the funding flow.
 *
 * POST /api/tasks/:id/deposit { signature, amount }
 *
 * 1. Never trusts the client: the transaction is fetched from the RPC and
 *    verified against the task's escrow address + stored bounty (see verify.ts).
 *    The client-supplied `amount` is only cross-checked against the task.
 * 2. Idempotent: the same signature can never be recorded twice — a unique
 *    index on txns.signature is the backstop, and a repeat returns the already
 *    recorded result (200) instead of erroring.
 * 3. Atomic: the txns insert and the tasks status update run in a single
 *    transaction (sql().transaction) so a deposit can never be half-recorded.
 * 4. State-gated: only draft/funding tasks can receive a deposit.
 */

const FUNDABLE = new Set(["draft", "funding"]);

export type DepositResult = {
  task: TaskRow;
  txn: TxnRow;
  already: boolean;
};

export async function recordDeposit(
  taskId: string,
  body: { signature?: unknown; amount?: unknown }
): Promise<DepositResult> {
  if (!isDbConfigured()) {
    throw new ApiError(503, DB_NOT_CONFIGURED);
  }
  await ensureSchema();

  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!signature) throw new ApiError(400, "signature is required");

  const rawAmount = body.amount;
  const amount = rawAmount === undefined || rawAmount === null
    ? ""
    : String(rawAmount).trim();
  if (!/^\d+$/.test(amount)) {
    throw new ApiError(
      400,
      "amount must be a non-negative integer string (lamports / base units)"
    );
  }

  const task = await getTask(taskId);
  if (!task) throw new ApiError(404, "task not found");

  // ---- Idempotent repeat: this signature is already recorded as a deposit. ----
  const existing = await sql()`
    select * from txns where signature = ${signature} and kind = 'deposit' limit 1`;
  if (existing.length > 0) {
    const txn = toClientRow(existing[0]) as TxnRow;
    if (txn.task_id !== taskId) {
      throw new ApiError(409, "that deposit signature already belongs to another task");
    }
    return { task: (await getTask(taskId)) as TaskRow, txn, already: true };
  }

  // ---- State gate: only draft/funding tasks can be funded. ----
  const status = String(task.status);
  if (!FUNDABLE.has(status)) {
    throw new ApiError(
      409,
      `task is in status '${status}'; only draft/funding tasks can receive a deposit`
    );
  }
  const escrow = task.escrow ? String(task.escrow) : "";
  if (!escrow) {
    throw new ApiError(500, "task has no escrow address attached");
  }
  const expectedAmount = String(task.amount_lamports);
  const currency = task.currency === "USDC" ? ("USDC" as const) : ("SOL" as const);

  // The client's claimed amount must match the task bounty (authoritative).
  if (amount !== expectedAmount) {
    throw new ApiError(
      422,
      `submitted amount ${amount} does not match the task bounty (${expectedAmount} ${currency === "SOL" ? "lamports" : "base units"})`
    );
  }

  // ---- On-chain verification: the authoritative check. ----
  let verified: VerifiedDeposit;
  try {
    verified = await verifyDeposit({
      signature,
      escrowAddress: escrow,
      expectedAmount,
      currency,
    });
  } catch (err) {
    if (err instanceof DepositVerificationError) {
      throw new ApiError(422, depositErrorDetail(err));
    }
    throw err;
  }

  // ---- Record atomically: txn row + task → funded in one transaction. ----
  const txnId = crypto.randomUUID();
  const db = sql();
  let txnRows: Record<string, unknown>[] = [];
  let updatedRows: Record<string, unknown>[] = [];
  try {
    [txnRows, updatedRows] = await db.transaction([
      db`insert into txns (id, task_id, kind, currency, amount_lamports, from_addr, to_addr, signature, confirmed)
          values (${txnId}, ${taskId}, 'deposit', ${verified.currency}, ${verified.amount}, ${verified.from}, ${verified.to}, ${signature}, true)
          returning *`,
      db`update tasks
          set status = 'funded', deposit_sig = ${signature},
              funder = ${verified.from}, updated_at = now()
          where id = ${taskId} and status in ('draft', 'funding')
          returning *`,
    ]);
  } catch (err) {
    // Unique-violation race: a concurrent request recorded the same signature
    // between our pre-check and this insert — return the winner's row.
    const dup = await sql()`
      select * from txns where signature = ${signature} and kind = 'deposit' limit 1`;
    if (dup.length > 0) {
      const txn = toClientRow(dup[0]) as TxnRow;
      if (txn.task_id !== taskId) {
        throw new ApiError(409, "that deposit signature already belongs to another task");
      }
      return { task: (await getTask(taskId)) as TaskRow, txn, already: true };
    }
    throw err;
  }

  if (!updatedRows.length) {
    // The task left draft/funding inside our transaction (concurrent funding).
    // Remove our orphan txn row and report the conflict.
    await db`delete from txns where id = ${txnId}`.catch(() => undefined);
    const current = await getTask(taskId);
    throw new ApiError(
      409,
      `task is now '${current ? String(current.status) : "?"}' — deposit not recorded (only one deposit per task)`
    );
  }

  // Fire-and-forget agent kickoff: the platform immediately starts executing
  // the funded task. Never awaited — the deposit response must not block on
  // agent execution, and a worker failure is recorded on the task (back to
  // 'funded', retryable) instead of surfacing here.
  kickoffExecution(taskId);

  return {
    task: toClientRow(updatedRows[0]) as TaskRow,
    txn: toClientRow(txnRows[0]) as TxnRow,
    already: false,
  };
}
