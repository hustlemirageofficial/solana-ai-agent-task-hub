/**
 * AgentPay — release & refund flow verification.
 *
 * Exercises the PRODUCTION code paths end-to-end against an in-memory SQL
 * store (mocked `~/db` via bun:test's mock.module, extended to txns) and a
 * mock Solana JSON-RPC server (scripts/mock-rpc.ts — a real local HTTP server
 * speaking the RPC methods web3.js issues; SOLANA_RPC is pointed at it so
 * `getServerConnection()` talks to the mock):
 *
 *   - src/server/release.ts → releasePayment / refundPayment: the real payout
 *     and refund orchestration (atomic flips, balance checks, server-signed
 *     transfers, txn recording, failure rollback)
 *   - src/server/api.ts      → POST /api/tasks/:id/approve | /reject (guards,
 *     idempotent repeats, 503 without a DB)
 *
 * Run from the site dir:
 *   bun test ./scripts/verify-release.ts
 *
 * NOTE: mock.module only exists under the test runner (bun test, not bun run).
 * The escrow signs with a deterministic throwaway keypair set via
 * ESCROW_PRIVATE_KEY; no real funds, no network, no database.
 */
import { mockRpcUrl, setRpcState, stopMockRpc } from "./mock-rpc";
import type { RpcState } from "./mock-rpc";
import { test, expect, mock, afterAll } from "bun:test";
import { PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "node:crypto";
import bs58 from "bs58";

afterAll(() => stopMockRpc());

// ---------------------------------------------------------------------------
// Deterministic test keypairs / addresses
// ---------------------------------------------------------------------------

const escrowKeypair = Keypair.fromSeed(
  createHash("sha256").update("agentpay-test-escrow").digest()
);
const ESCROW = escrowKeypair.publicKey.toBase58();
const FUNDER = "3nCK5549dynQ7RugcLWfd8GQGxKQgvTmRPZgUq9km4Bb"; // demo funder constant

// ---------------------------------------------------------------------------
// In-memory SQL store — mirrors the exact query shapes the server issues.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class MemStore {
  tasks = new Map<string, Row>();
  txns = new Map<string, Row>();

  seed(row: Row): void {
    this.tasks.set(String(row.id), { ...row });
  }

  get(id: string): Row | undefined {
    const t = this.tasks.get(id);
    return t ? { ...t } : undefined;
  }

  patch(id: string, fields: Record<string, unknown>): void {
    const t = this.tasks.get(id);
    if (t) Object.assign(t, fields);
  }

  query(sqlRaw: string, params: unknown[]): Row[] {
    const sqlText = sqlRaw.replace(/\s+/g, " ").trim();

    if (/^(create table|create index|create unique index|alter table)/i.test(sqlText)) {
      return []; // DDL from ensureSchema (strings)
    }

    let m = sqlText.match(/^select \* from tasks where id = \? limit 1$/i);
    if (m) {
      const t = this.tasks.get(String(params[0]));
      return t ? [{ ...t }] : [];
    }

    // findTxn: select * from txns where task_id = ? and kind = ? order by created_at desc limit 1
    m = sqlText.match(
      /^select \* from txns where task_id = \? and kind = \? order by created_at desc limit 1$/i
    );
    if (m) {
      const rows = [...this.txns.values()]
        .filter((r) => String(r.task_id) === String(params[0]) && String(r.kind) === String(params[1]))
        .sort((a, b) => (new Date(String(a.created_at)) > new Date(String(b.created_at)) ? -1 : 1));
      return rows.length ? [{ ...rows[0] }] : [];
    }

    // Deposit idempotency pre-check (funding.ts): select * from txns where
    // signature = ? and kind = 'deposit' limit 1
    m = sqlText.match(/^select \* from txns where signature = \? and kind = 'deposit' limit 1$/i);
    if (m) {
      return [...this.txns.values()]
        .filter((r) => String(r.signature) === String(params[0]) && String(r.kind) === "deposit")
        .slice(0, 1)
        .map((r) => ({ ...r }));
    }

    // listTxns (task-scoped / global) — used by the History page loader & API.
    m = sqlText.match(/^select \* from txns where task_id = \? order by created_at desc limit \?$/i);
    if (m) {
      return [...this.txns.values()]
        .filter((r) => String(r.task_id) === String(params[0]))
        .sort((a, b) => (new Date(String(a.created_at)) > new Date(String(b.created_at)) ? -1 : 1))
        .slice(0, Number(params[1]))
        .map((r) => ({ ...r }));
    }
    m = sqlText.match(/^select \* from txns order by created_at desc limit \?$/i);
    if (m) {
      return [...this.txns.values()]
        .sort((a, b) => (new Date(String(a.created_at)) > new Date(String(b.created_at)) ? -1 : 1))
        .slice(0, Number(params[0]))
        .map((r) => ({ ...r }));
    }

    // listTasks — used by the History page loader for titles.
    m = sqlText.match(/^select \* from tasks order by created_at desc limit \?$/i);
    if (m) {
      return [...this.tasks.values()]
        .sort((a, b) => (new Date(String(a.created_at)) > new Date(String(b.created_at)) ? -1 : 1))
        .slice(0, Number(params[0]))
        .map((r) => ({ ...r }));
    }

    // insert into <table> (...) values (...) returning *  (tasks + txns)
    m = sqlText.match(/^insert into (\w+) \(([^)]+)\) values \(([^)]+)\) returning \*$/i);
    if (m) {
      const cols = m[2]!.split(",").map((c) => c.trim());
      const vals = m[3]!.split(",").map((v) => v.trim());
      const row: Row = {};
      let p = 0;
      cols.forEach((col, i) => {
        row[col] = vals[i] === "?" ? params[p++] : vals[i]!.replace(/^'(.*)'$/, "$1");
      });
      row.id = String(row.id);
      row.created_at = new Date();
      row.updated_at = new Date();
      if (m[1] === "tasks") this.tasks.set(row.id as string, { ...row });
      if (m[1] === "txns") this.txns.set(row.id as string, { ...row });
      return [{ ...row }];
    }

    // Atomic flip: update tasks set status='X', updated_at=now() where id=? and status='Y' returning *
    m = sqlText.match(
      /^update tasks set status = '(\w+)', updated_at = now\(\) where id = \? and status = '(\w+)' returning \*$/i
    );
    if (m) {
      const next = m[1]!;
      const expectedPrev = m[2]!;
      const t = this.tasks.get(String(params[0]));
      if (t && t.status === expectedPrev) {
        t.status = next;
        t.updated_at = new Date();
        return [{ ...t }];
      }
      return [];
    }

    // Record release: update tasks set release_sig=?, payout_error=null, updated_at=now() where id=? returning *
    m = sqlText.match(
      /^update tasks set release_sig = \?, payout_error = null, updated_at = now\(\) where id = \? returning \*$/i
    );
    if (m) {
      const t = this.tasks.get(String(params[1]));
      if (t) {
        t.release_sig = params[0];
        t.payout_error = null;
        t.updated_at = new Date();
        return [{ ...t }];
      }
      return [];
    }

    // Record refund: update tasks set status='refunded', refund_sig=?, payout_error=null, updated_at=now() where id=? returning *
    m = sqlText.match(
      /^update tasks set status = '(\w+)', refund_sig = \?, payout_error = null, updated_at = now\(\) where id = \? returning \*$/i
    );
    if (m) {
      const t = this.tasks.get(String(params[1]));
      if (t) {
        t.status = m[1]!;
        t.refund_sig = params[0];
        t.payout_error = null;
        t.updated_at = new Date();
        return [{ ...t }];
      }
      return [];
    }

    // Failure rollback: update tasks set status='awaiting_review', payout_error=?, updated_at=now() where id=?
    m = sqlText.match(
      /^update tasks set status = '(\w+)', payout_error = \?, updated_at = now\(\) where id = \?$/i
    );
    if (m) {
      const t = this.tasks.get(String(params[1]));
      if (t) {
        t.status = m[1]!;
        t.payout_error = params[0];
        t.updated_at = new Date();
      }
      return [];
    }

    throw new Error(`MemStore: unsupported SQL: ${sqlText}`);
  }
}

function makeSql(store: MemStore) {
  const q = (strings: TemplateStringsArray | string, ...params: unknown[]): Promise<Row[]> => {
    if (typeof strings === "string") return Promise.resolve([]); // DDL strings
    return Promise.resolve(store.query(strings.join("?"), params));
  };
  // Mirror the real Neon driver: function-style calls use .query() (schema.ts).
  q.query = (sqlText: string, params: unknown[] = []): Promise<Row[]> =>
    /^\s*(create|alter|drop|truncate)\b/i.test(sqlText)
      ? Promise.resolve([]) // DDL no-op, same as the plain-string path above
      : Promise.resolve(store.query(sqlText, params));
  // db.transaction([q1, q2]) — same shape funding.ts / release.ts use.
  q.transaction = (queries: Promise<Row[]>[]): Promise<Row[][]> => Promise.all(queries);
  return q;
}

// Register the ~/db mock BEFORE importing anything that pulls it in.
process.env.DATABASE_URL = "postgres://mock:mock@localhost/mock";
process.env.ESCROW_PRIVATE_KEY = bs58.encode(escrowKeypair.secretKey);
// Point the server-side Connection at the mock JSON-RPC server.
process.env.SOLANA_RPC = mockRpcUrl();
delete process.env.AGENT_PAYOUT_ADDRESS;
delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
const store = new MemStore();
mock.module("~/db", () => ({ sql: () => makeSql(store) }));

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function awaitingTask(id: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    title: "Write a haiku about Solana",
    description: "Three lines, five-seven-five syllables, mention devnet.",
    agent: "general-assistant",
    currency: "SOL",
    amount_lamports: "1000000000", // 1 SOL
    status: "awaiting_review",
    funder: FUNDER,
    escrow: ESCROW,
    deposit_sig: "1111111111111111111111111111111111111111111111111111111111111111",
    result: JSON.stringify({ summary: "Done", content: "ok", steps: ["a"] }),
    release_sig: null,
    refund_sig: null,
    payout_error: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...extra,
  };
}

function fundedState(extra: Partial<RpcState> = {}): RpcState {
  return {
    balances: new Map([[ESCROW, 5_000_000_000n]]), // 5 SOL
    tokenBalances: new Map(),
    existingAccounts: new Set(),
    ...extra,
  };
}

function draftTask(id: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    title: "Write a haiku about Solana",
    description: "Three lines, five-seven-five syllables, mention devnet.",
    agent: "general-assistant",
    currency: "SOL",
    amount_lamports: "1000000000", // 1 SOL
    status: "draft",
    funder: null,
    escrow: ESCROW,
    deposit_sig: null,
    result: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...extra,
  };
}

function asApiError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; message?: string };
  return { status: e.status ?? 0, message: e.message ?? String(err) };
}

async function api(method: string, path: string): Promise<{ status: number; body: any }> {
  const { handleApiRequest } = await import("../src/server/api");
  const resp = await handleApiRequest(new Request(`http://localhost${path}`, { method }));
  return { status: resp.status, body: (await resp.json()) as any };
}

async function apiBody(
  method: string,
  path: string,
  body: string
): Promise<{ status: number; body: any }> {
  const { handleApiRequest } = await import("../src/server/api");
  const resp = await handleApiRequest(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body,
    })
  );
  return { status: resp.status, body: (await resp.json()) as any };
}

/** Count recorded txns for one task (the store is shared across tests). */
function txnCount(taskId: string): number {
  return [...store.txns.values()].filter((t) => String(t.task_id) === taskId).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("release happy path (SOL): approve → on-chain release recorded, status approved, txns row", async () => {
  const rpc = fundedState();
  setRpcState(rpc);
  store.seed(awaitingTask("rel-happy"));

  const res = await api("POST", "/api/tasks/rel-happy/approve");
  expect(res.status).toBe(200);
  expect(res.body.already).toBe(false);
  expect(res.body.task.status).toBe("approved");
  expect(res.body.task.release_sig).toBe("test-release-signature-123");
  expect(res.body.txn.kind).toBe("release");
  expect(res.body.txn.signature).toBe("test-release-signature-123");
  expect(res.body.txn.from_addr).toBe(ESCROW);
  expect(res.body.txn.to_addr).toBe("9d8AnPzpHcqLLgSukdQJH6V1Dz9UA561ya6ZNPJakKQ3"); // demo payout
  expect(res.body.txn.amount_lamports).toBe("1000000000");
  expect(res.body.txn.currency).toBe("SOL");
  expect(res.body.txn.confirmed).toBeTruthy();

  // The txns row is really stored (History page / task proof list read from it).
  expect(txnCount("rel-happy")).toBe(1);
  expect(store.get("rel-happy")!.status).toBe("approved");

  // The broadcast transaction is a single SystemProgram.transfer escrow → payout.
  const sent = rpc.sentTxs![0]!;
  const decoded = Transaction.from(sent.raw);
  expect(decoded.instructions.length).toBe(1);
  expect(decoded.instructions[0]!.programId.equals(SystemProgram.programId)).toBe(true);
  expect(decoded.feePayer!.toBase58()).toBe(ESCROW);

  // Idempotent repeat: 200 + already flag, no second txn.
  const again = await api("POST", "/api/tasks/rel-happy/approve");
  expect(again.status).toBe(200);
  expect(again.body.already).toBe(true);
  expect(txnCount("rel-happy")).toBe(1);
});

test("refund happy path (SOL): reject → on-chain refund recorded, status refunded, txns row", async () => {
  setRpcState(fundedState());
  store.seed(awaitingTask("ref-happy"));

  const res = await api("POST", "/api/tasks/ref-happy/reject");
  expect(res.status).toBe(200);
  expect(res.body.already).toBe(false);
  expect(res.body.task.status).toBe("refunded");
  expect(res.body.task.refund_sig).toBe("test-release-signature-123");
  expect(res.body.txn.kind).toBe("refund");
  expect(res.body.txn.signature).toBe("test-release-signature-123");
  expect(res.body.txn.from_addr).toBe(ESCROW);
  expect(res.body.txn.to_addr).toBe(FUNDER);
  expect(res.body.txn.amount_lamports).toBe("1000000000");
  expect(store.get("ref-happy")!.status).toBe("refunded");

  // Double-reject: idempotent repeat returns existing refund + already flag.
  const again = await api("POST", "/api/tasks/ref-happy/reject");
  expect(again.status).toBe(200);
  expect(again.body.already).toBe(true);
  expect(again.body.txn.kind).toBe("refund");
  expect(txnCount("ref-happy")).toBe(1);
});

test("double-action & wrong-state guards (409); unknown task 404", async () => {
  setRpcState(fundedState());

  store.seed(awaitingTask("g-draft", { status: "draft" }));
  const draft = await api("POST", "/api/tasks/g-draft/approve");
  expect(draft.status).toBe(409);

  store.seed(awaitingTask("g-working", { status: "working" }));
  const working = await api("POST", "/api/tasks/g-working/approve");
  expect(working.status).toBe(409);

  store.seed(awaitingTask("g-funded", { status: "funded" }));
  const funded = await api("POST", "/api/tasks/g-funded/reject");
  expect(funded.status).toBe(409);

  // approve on an already-refunded task → 409
  store.seed(awaitingTask("g-refunded", { status: "refunded", refund_sig: "abc" }));
  const onRefunded = await api("POST", "/api/tasks/g-refunded/approve");
  expect(onRefunded.status).toBe(409);

  // reject on an already-approved task → 409
  store.seed(awaitingTask("g-approved", { status: "approved", release_sig: "abc" }));
  const onApproved = await api("POST", "/api/tasks/g-approved/reject");
  expect(onApproved.status).toBe(409);

  const notFound = await api("POST", "/api/tasks/does-not-exist/approve");
  expect(notFound.status).toBe(404);
});

test("POST /api/tasks/:id/deposit routes to recordDeposit (contract fix): guarded errors, never 404, nothing recorded", async () => {
  setRpcState(fundedState());

  // (a) Empty body → the route is matched (a 404 would mean it still misses
  //     the switch) and readJson rejects with 400 invalid JSON.
  const empty = await apiBody("POST", "/api/tasks/dep-route/deposit", "");
  expect(empty.status).toBe(400);
  expect(String(empty.body.error)).toContain("invalid JSON body");

  // (b) `{}` → reaches recordDeposit's own first guard (signature required).
  const noSig = await apiBody("POST", "/api/tasks/dep-route/deposit", "{}");
  expect(noSig.status).toBe(400);
  expect(String(noSig.body.error)).toContain("signature is required");

  // (c) Valid-format signature + matching bounty on a draft task → passes the
  //     local guards, then on-chain verification fails against the mock RPC
  //     (no parsed tx) → 422, task untouched, no txn row. Proves the full
  //     recordDeposit path is reachable via /deposit.
  store.seed(draftTask("dep-route"));
  const sig = "1".repeat(64); // valid 64-byte base58 (zero bytes)
  const verify = await apiBody(
    "POST",
    "/api/tasks/dep-route/deposit",
    JSON.stringify({ signature: sig, amount: "1000000000" })
  );
  expect(verify.status).toBe(422);
  expect(String(verify.body.error)).toContain("not found on-chain");
  expect(String(store.get("dep-route")!.status)).toBe("draft"); // untouched
  expect(txnCount("dep-route")).toBe(0);

  // (d) The legacy POST /api/tasks/:id route keeps working with identical
  //     semantics (guarded error, nothing recorded).
  const legacy = await apiBody(
    "POST",
    "/api/tasks/dep-route",
    JSON.stringify({ signature: sig, amount: "1000000000" })
  );
  expect(legacy.status).toBe(422);
  expect(String(legacy.body.error)).toContain("not found on-chain");
  expect(String(store.get("dep-route")!.status)).toBe("draft");
  expect(txnCount("dep-route")).toBe(0);
});

test("escrow-insufficient-balance → 422, status untouched (no flip, no error recorded)", async () => {
  setRpcState(fundedState({ balances: new Map([[ESCROW, 100n]]) })); // 100 lamports < 1 SOL
  store.seed(awaitingTask("insufficient"));

  const res = await api("POST", "/api/tasks/insufficient/approve");
  expect(res.status).toBe(422);
  expect(res.body.error).toContain("escrow does not cover");
  expect(store.get("insufficient")!.status).toBe("awaiting_review");
  expect(store.get("insufficient")!.payout_error ?? null).toBeNull();
  expect(txnCount("insufficient")).toBe(0);

  const rej = await api("POST", "/api/tasks/insufficient/reject");
  expect(rej.status).toBe(422);
  expect(store.get("insufficient")!.status).toBe("awaiting_review");
});

test("USDC release with ATA creation: recipient ATA created + transferChecked in the same tx", async () => {
  const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  const escrowAta = (
    await getAssociatedTokenAddress(new PublicKey(USDC_MINT), new PublicKey(ESCROW))
  ).toBase58();
  const rpc: RpcState = fundedState({
    tokenBalances: new Map([[escrowAta, 1_000_000n]]), // 1 USDC
    existingAccounts: new Set(), // recipient ATA missing → must be created
  });
  setRpcState(rpc);
  store.seed(
    awaitingTask("usdc-release", {
      currency: "USDC",
      amount_lamports: "1000000", // 1 USDC in base units
    })
  );

  const res = await api("POST", "/api/tasks/usdc-release/approve");
  expect(res.status).toBe(200);
  expect(res.body.task.status).toBe("approved");
  expect(res.body.txn.kind).toBe("release");
  expect(res.body.txn.currency).toBe("USDC");
  expect(res.body.txn.amount_lamports).toBe("1000000");
  expect(res.body.txn.from_addr).toBe(escrowAta); // from the escrow ATA

  // Instruction-level proof: createAssociatedTokenAccount + transferChecked.
  const decoded = Transaction.from(rpc.sentTxs![0]!.raw);
  const programs = decoded.instructions.map((ix) => ix.programId.toBase58());
  expect(programs).toContain(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()); // ATA creation
  expect(programs).toContain(TOKEN_PROGRAM_ID.toBase58()); // transferChecked

  // USDC refund to the funder also works (funder ATA created).
  store.seed(
    awaitingTask("usdc-refund", {
      currency: "USDC",
      amount_lamports: "1000000",
    })
  );
  rpc.sentTxs = [];
  const rej = await api("POST", "/api/tasks/usdc-refund/reject");
  expect(rej.status).toBe(200);
  expect(rej.body.task.status).toBe("refunded");
  expect(rej.body.txn.kind).toBe("refund");
  const decodedRefund = Transaction.from(rpc.sentTxs![0]!.raw);
  expect(decodedRefund.instructions.map((ix) => ix.programId.toBase58())).toContain(
    ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()
  );
});

test("payout-target fallback: env override, demo fallback, invalid env fails loudly", async () => {
  const { payoutTarget, DEMO_AGENT_PAYOUT_ADDRESS } = await import("../src/server/release");
  delete process.env.AGENT_PAYOUT_ADDRESS;
  const fallback = payoutTarget();
  expect(fallback.address).toBe(DEMO_AGENT_PAYOUT_ADDRESS);
  expect(fallback.demo).toBe(true);
  expect(fallback.address).not.toBe(ESCROW); // never the escrow itself

  process.env.AGENT_PAYOUT_ADDRESS = FUNDER;
  try {
    const env = payoutTarget();
    expect(env.address).toBe(FUNDER);
    expect(env.demo).toBe(false);
  } finally {
    delete process.env.AGENT_PAYOUT_ADDRESS;
  }

  process.env.AGENT_PAYOUT_ADDRESS = "not-a-valid-address";
  try {
    try {
      payoutTarget();
      throw new Error("expected invalid payout env to throw");
    } catch (err) {
      expect(asApiError(err).status).toBe(500);
      expect(asApiError(err).message).toContain("AGENT_PAYOUT_ADDRESS");
    }
  } finally {
    delete process.env.AGENT_PAYOUT_ADDRESS;
  }
});

test("payout failure → task back to awaiting_review with recorded error, then retry succeeds", async () => {
  const rpc = fundedState({ failSend: true });
  setRpcState(rpc);
  store.seed(awaitingTask("retry-payout"));

  const res = await api("POST", "/api/tasks/retry-payout/approve");
  expect(res.status).toBe(502);
  expect(res.body.error).toContain("release failed");
  // Retryable: flipped back to awaiting_review with the error recorded.
  expect(store.get("retry-payout")!.status).toBe("awaiting_review");
  expect(String(store.get("retry-payout")!.payout_error)).toContain("send failed");
  expect(txnCount("retry-payout")).toBe(0);

  // Heal the RPC and retry → succeeds, error cleared.
  rpc.failSend = false;
  const retry = await api("POST", "/api/tasks/retry-payout/approve");
  expect(retry.status).toBe(200);
  expect(retry.body.task.status).toBe("approved");
  expect(retry.body.task.payout_error ?? null).toBeNull();
  expect(store.get("retry-payout")!.status).toBe("approved");
  expect(txnCount("retry-payout")).toBe(1);
});

test("on-chain failure (signature status err) → 502, refund rolls back to awaiting_review", async () => {
  setRpcState(fundedState({ statusErr: { InstructionError: [0, "Custom"] } }));
  store.seed(awaitingTask("retry-refund"));

  const res = await api("POST", "/api/tasks/retry-refund/reject");
  expect(res.status).toBe(502);
  expect(res.body.error).toContain("refund failed");
  expect(store.get("retry-refund")!.status).toBe("awaiting_review");
  expect(String(store.get("retry-refund")!.payout_error)).toContain("failed on-chain");
  expect(txnCount("retry-refund")).toBe(0);
});

test("503 without DATABASE_URL; concurrent double-approve is rejected, only one payout", async () => {
  setRpcState(fundedState());

  // 503 graceful degradation.
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const noDb = await api("POST", "/api/tasks/x/approve");
    expect(noDb.status).toBe(503);
    expect(noDb.body.error).toContain("DATABASE_URL");
  } finally {
    process.env.DATABASE_URL = prev;
  }

  // Concurrency: gate the RPC send so approve #1 is mid-flight after the
  // atomic flip (status already 'approved'), then a second approve must 409 —
  // it can never sign a second release.
  store.seed(awaitingTask("race"));
  let releaseRpc!: () => void;
  const gate = new Promise<void>((r) => (releaseRpc = r));
  setRpcState(fundedState({ gateSend: gate }));

  const first = api("POST", "/api/tasks/race/approve");
  await new Promise((r) => setTimeout(r, 50)); // let #1 flip + reach send
  expect(store.get("race")!.status).toBe("approved"); // flip happened

  const second = await api("POST", "/api/tasks/race/approve");
  expect(second.status).toBe(409); // no double-pay

  releaseRpc();
  const firstRes = await first;
  expect(firstRes.status).toBe(200);
  expect(txnCount("race")).toBe(1); // exactly one release txn
});
