import { sql } from "~/db";
import { ensureSchema } from "./schema";
import { getEscrowAddress } from "./escrow";

/**
 * Shared data-access layer for AgentPay tasks & transactions.
 * Used by both the REST API (src/server/api.ts, wired in serve.ts) and the
 * server functions powering the app pages. All timestamps/numerics are coerced
 * to strings before returning so the client receives plain JSON.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const DB_NOT_CONFIGURED =
  "Database is not configured — set DATABASE_URL to enable persistence. The app runs in demo mode until then.";

export type TaskRow = Record<string, unknown> & { id: string };
export type TxnRow = Record<string, unknown> & { id: string };

/** Dates → ISO strings, numbers/bigints → strings, everything else untouched. */
export function toClientRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "number" || typeof v === "bigint") out[k] = String(v);
    else out[k] = v;
  }
  return out as T;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(limit = 100): Promise<TaskRow[]> {
  await ensureSchema();
  const rows = await sql()`select * from tasks order by created_at desc limit ${limit}`;
  return rows.map(toClientRow);
}

export async function getTask(id: string): Promise<TaskRow | null> {
  await ensureSchema();
  const rows = await sql()`select * from tasks where id = ${id} limit 1`;
  return rows.length ? toClientRow(rows[0]) : null;
}

export type CreateTaskInput = {
  title?: unknown;
  description?: unknown;
  agent?: unknown;
  currency?: unknown;
  amount_lamports?: unknown;
};

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  await ensureSchema();

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new ApiError(400, "title is required");

  const description =
    typeof input.description === "string" ? input.description.trim() : "";

  const agent =
    typeof input.agent === "string" && input.agent.trim()
      ? input.agent.trim()
      : "general-assistant";

  const currency = input.currency === "USDC" ? "USDC" : "SOL";

  const rawAmount = input.amount_lamports ?? 0;
  const amountStr = String(rawAmount);
  if (!/^\d+$/.test(amountStr)) {
    throw new ApiError(
      400,
      "amount_lamports must be a non-negative integer (lamports / base units) as a string"
    );
  }

  const id = crypto.randomUUID();
  // Every task is created as a draft with the platform escrow attached, so the
  // funding flow always has an address to pay. The escrow private key stays
  // server-side; only the address is stored/exposed.
  const escrow = await getEscrowAddress();
  const rows = await sql()`
    insert into tasks (id, title, description, agent, currency, amount_lamports, status, escrow)
    values (${id}, ${title}, ${description}, ${agent}, ${currency}, ${amountStr}, 'draft', ${escrow})
    returning *`;
  return toClientRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function listTxns(
  taskId?: string,
  limit = 100
): Promise<TxnRow[]> {
  await ensureSchema();
  const rows = taskId
    ? await sql()`select * from txns where task_id = ${taskId} order by created_at desc limit ${limit}`
    : await sql()`select * from txns order by created_at desc limit ${limit}`;
  return rows.map(toClientRow);
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function dbStatus(): Promise<"ok" | "not_configured" | "error"> {
  if (!isDbConfigured()) return "not_configured";
  try {
    await ensureSchema();
    await sql()`select 1`;
    return "ok";
  } catch {
    return "error";
  }
}
