import { getEscrowAddress } from "./escrow";
import { DB_NOT_CONFIGURED, ApiError, createTask, dbStatus, getTask, isDbConfigured, listTasks, listTxns } from "./tasks";
import { recordDeposit } from "./funding";
import { executeTask, parseTaskResult } from "./agent";
import { releasePayment, refundPayment } from "./release";

/** REST API for AgentPay. */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

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

function escrowConfigured(): boolean {
  return Boolean(process.env.ESCROW_PRIVATE_KEY?.trim());
}

export async function handleApiRequest(req: Request): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!pathname.startsWith("/api/")) return null;

  const method = req.method;
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
          escrow: escrowConfigured() ? await getEscrowAddress() : null,
          escrow_configured: escrowConfigured(),
        });
      }
      case "/api/escrow/address": {
        if (method !== "GET") break;
        if (!escrowConfigured()) {
          return json({ error: "Escrow is not configured — set ESCROW_PRIVATE_KEY for this deployment.", escrow_configured: false }, 503);
        }
        return json({ address: await getEscrowAddress(), escrow_configured: true });
      }
      case "/api/tasks": {
        if (method === "GET") return json({ tasks: await listTasks() });
        if (method === "POST") {
          if (!escrowConfigured()) {
            throw new ApiError(503, "Escrow is not configured — set ESCROW_PRIVATE_KEY before creating funded tasks.");
          }
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
            return task ? json({ task: parseTaskResult(task) }) : json({ error: "task not found" }, 404);
          }
          if (method === "POST") return json(await recordDeposit(id, await readJson(req)));
        }
        const deposit = pathname.match(/^\/api\/tasks\/([^/]+)\/deposit$/);
        if (deposit && method === "POST") {
          return json(await recordDeposit(decodeURIComponent(deposit[1]), await readJson(req)));
        }
        const run = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
        if (run && method === "POST") {
          const task = await executeTask(decodeURIComponent(run[1]));
          return json({ task: parseTaskResult(task) });
        }
        const approve = pathname.match(/^\/api\/tasks\/([^/]+)\/approve$/);
        if (approve && method === "POST") {
          const res = await releasePayment(decodeURIComponent(approve[1]));
          return json({ task: parseTaskResult(res.task), txn: res.txn, already: res.already });
        }
        const reject = pathname.match(/^\/api\/tasks\/([^/]+)\/reject$/);
        if (reject && method === "POST") {
          const res = await refundPayment(decodeURIComponent(reject[1]));
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
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body must be a JSON object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "invalid JSON body");
  }
}
