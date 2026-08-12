import { getEscrowAddress } from "./escrow";
import { DB_NOT_CONFIGURED, ApiError, createTask, dbStatus, getTask, isDbConfigured, listTasks, listTxns } from "./tasks";
import { recordDeposit } from "./funding";
import { executeTask, parseTaskResult } from "./agent";
import { releasePayment, refundPayment } from "./release";

/**
 * REST API for AgentPay.
 *
 * IMPORTANT (version note): this TanStack Start version (@tanstack/react-start
 * 1.168.x) no longer ships the createAPIFileRoute / src/routes/api/* mechanism,
 * so the API is mounted directly in serve.ts (the production Bun server) ahead
 * of the TanStack handler. Shared logic lives in src/server/* and is also used
 * by server functions in the app pages, so there is a single source of truth.
 *
 * Endpoints:
 *   GET  /api/health          → ok + db status + escrow address
 *   GET  /api/escrow/address  → escrow public address
 *   GET  /api/tasks           → list tasks (newest first)
 *   POST /api/tasks           → create a draft task (escrow attached)
 *   GET  /api/tasks/:id       → single task (result parsed as JSON when set,
 *                               plus a `demo` boolean)
 *   POST /api/tasks/:id/deposit → verify + record an on-chain deposit
 *                                  { signature, amount } (idempotent)
 *   POST /api/tasks/:id/run   → run the agent on a funded task (idempotent /
 *                                guarded: 404 unknown, 409 wrong state or
 *                                already running, 503 no DB)
 *   POST /api/tasks/:id/approve → approve the result: escrow pays the agent's
 *                                payout wallet on-chain (release). Guards:
 *                                404/409/422/502/503; no double-pay; a repeat
 *                                returns the recorded release with `already`.
 *   POST /api/tasks/:id/reject  → reject the result: escrow refunds the funder
 *                                on-chain. Same guards; no double-refund.
 *   GET  /api/txns?taskId=..  → transaction history (seam for the History page)
 *
 * Returns null for paths that are not ours, so serve.ts falls through to the
 * TanStack handler / static files.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

// /api/tasks[/:id][/deposit] — everything under these is DB-backed.
const DB_ROUTES = new Set(["/api/tasks", "/api/txns"]);

function isDbRoute(pathname: string): boolean {
  return (
    DB_ROUTES.has(pathname) ||
    /^\/api\/tasks\/[^/]+$/.test(pathname) ||
    /^\/api\/tasks\/[^/]+\/deposit$/.test(pathname) ||
    /^\/api\/tasks\/[^/]+\/run$/.test(pathname) ||
    /^\/api\/tasks\/[^/]+\/approve$/.test(pathname) ||
    /^\/api\/tasks\/[^/]+\/reject$/.test(pathname)
  );
}

export async function handleApiRequest(req: Request): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!pathname.startsWith("/api/")) return null;

  const method = req.method;

  // Everything under /api/ except the explicitly allowed GETs is an error if
  // the path is unknown; DB-backed routes degrade gracefully without DATABASE_URL.
  if (isDbRoute(pathname) && !isDbConfigured()) {
    return json({ error: DB_NOT_CONFIGURED, db: "not_configured" }, 503);
  }

  try {
    switch (pathname) {
      case "/api/health": {
        if (method !== "GET") break;
        return json({
          ok: true,
          service: "agentpay",
          network: process.env.SOLANA_NETWORK ?? "devnet",
          db: await dbStatus(),
          escrow: await getEscrowAddress(),
        });
      }
      case "/api/escrow/address": {
        if (method !== "GET") break;
        return json({ address: await getEscrowAddress() });
      }
      case "/api/tasks": {
        if (method === "GET") return json({ tasks: await listTasks() });
        if (method === "POST") {
          const body = await readJson(req);
          return json({ task: await createTask(body) }, 201);
        }
        break;
      }
      case "/api/txns": {
        if (method !== "GET") break;
        const taskId = new URL(req.url).searchParams.get("taskId") ?? undefined;
        return json({ txns: await listTxns(taskId) });
      }
      default: {
        const m = pathname.match(/^\/api\/tasks\/([^/]+)$/);
        if (m) {
          const id = decodeURIComponent(m[1]);
          if (method === "GET") {
            const task = await getTask(id);
            return task
              ? json({ task: parseTaskResult(task) })
              : json({ error: "task not found" }, 404);
          }
          if (method === "POST") {
            const body = await readJson(req);
            return json(await recordDeposit(id, body));
          }
        }
        // POST /api/tasks/:id/deposit — the browser "Fund & launch" flow. Same
        // contract as POST /api/tasks/:id (below): read the JSON body, then
        // verify + record. All guards live in recordDeposit (404 unknown task,
        // 409 wrong state / already recorded elsewhere, 422 amount mismatch or
        // unverifiable on-chain, 503 no DB); repeats are idempotent and return
        // { already: true } — the unique uq_txns_signature index stays the
        // backstop, never weakened.
        const deposit = pathname.match(/^\/api\/tasks\/([^/]+)\/deposit$/);
        if (deposit) {
          if (method !== "POST") break;
          const id = decodeURIComponent(deposit[1]);
          const body = await readJson(req);
          return json(await recordDeposit(id, body));
        }
        const run = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
        if (run) {
          if (method !== "POST") break;
          const id = decodeURIComponent(run[1]);
          // executeTask is guarded: 404 unknown task, 409 wrong state or
          // already running, 503 no DB; idempotent — a running task rejects
          // with 409 instead of double-executing.
          const task = await executeTask(id);
          return json({ task: parseTaskResult(task) });
        }
        const approve = pathname.match(/^\/api\/tasks\/([^/]+)\/approve$/);
        if (approve) {
          if (method !== "POST") break;
          const id = decodeURIComponent(approve[1]);
          // releasePayment is guarded: 404 unknown, 409 wrong state / double
          // action, 422 escrow balance, 502 on-chain failure (task left
          // retryable), 503 no DB. Repeats return { already: true }.
          const res = await releasePayment(id);
          return json({ task: parseTaskResult(res.task), txn: res.txn, already: res.already });
        }
        const reject = pathname.match(/^\/api\/tasks\/([^/]+)\/reject$/);
        if (reject) {
          if (method !== "POST") break;
          const id = decodeURIComponent(reject[1]);
          const res = await refundPayment(id);
          return json({ task: parseTaskResult(res.task), txn: res.txn, already: res.already });
        }
      }
    }
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[agentpay:api]", method, pathname, detail);
    return json({ error: "internal error", detail }, 500);
  }

  return json({ error: "not found" }, 404);
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "invalid JSON body");
  }
}
