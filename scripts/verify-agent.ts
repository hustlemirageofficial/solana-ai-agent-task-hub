/**
 * AgentPay — agent execution engine verification.
 *
 * Exercises the PRODUCTION code paths end-to-end against an in-memory SQL
 * store (mocked `~/db` via bun:test's mock.module) and a mocked global fetch:
 *
 *   - src/server/agent.ts  → executeTask: the real worker (state machine,
 *     double-run guards, error → funded retry)
 *   - src/server/llm.ts    → the real LLM client (OpenAI + Anthropic request
 *     construction, JSON parse + retry-once, timeout-free mocked responses)
 *   - src/server/api.ts    → the real REST handler for GET /api/tasks/:id and
 *     POST /api/tasks/:id/run (404/409 guards, parsed result + demo flag)
 *
 * Run from the site dir:
 *   bun test ./scripts/verify-agent.ts
 *
 * NOTE: bun:test's mock.module is only available under the test runner, which
 * is why this verification uses `bun test` rather than a plain `bun run`
 * script. The demo-mode path needs no keys; the LLM paths use a mocked fetch
 * (a real provider call needs a live OPENAI_API_KEY / ANTHROPIC_API_KEY and is
 * documented in the final report instead).
 */
import { test, expect, mock } from "bun:test";

// ---------------------------------------------------------------------------
// In-memory SQL store — implements the exact query shapes the server code
// issues. Anything unexpected fails loudly so a drift in the SQL is caught.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class MemStore {
  tasks = new Map<string, Row>();

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

    if (/^(create table|create index|create unique index)/i.test(sqlText)) {
      return []; // DDL from ensureSchema
    }

    let m = sqlText.match(/^select \* from tasks where id = \? limit 1$/i);
    if (m) {
      const t = this.tasks.get(String(params[0]));
      return t ? [{ ...t }] : [];
    }

    // insert into tasks (...) values (?, ?, ...) returning *
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
      return [{ ...row }];
    }

    // update … set status='X', updated_at=now() where id=? and status='Y' returning *  (atomic flip)
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

    // update … set status='X', result=?, updated_at=now() where id=? returning *  (success)
    m = sqlText.match(
      /^update tasks set status = '(\w+)', result = \?, updated_at = now\(\) where id = \? returning \*$/i
    );
    if (m) {
      const t = this.tasks.get(String(params[1]));
      if (t) {
        t.status = m[1]!;
        t.result = params[0];
        t.updated_at = new Date();
        return [{ ...t }];
      }
      return [];
    }

    // update … set status='X', result=?, updated_at=now() where id=?  (error rollback)
    m = sqlText.match(
      /^update tasks set status = '(\w+)', result = \?, updated_at = now\(\) where id = \?$/i
    );
    if (m) {
      const t = this.tasks.get(String(params[1]));
      if (t) {
        t.status = m[1]!;
        t.result = params[0];
        t.updated_at = new Date();
      }
      return [];
    }

    throw new Error(`MemStore: unsupported SQL: ${sqlText}`);
  }
}

function makeSql(store: MemStore) {
  return (strings: TemplateStringsArray | string, ...params: unknown[]): Promise<Row[]> => {
    if (typeof strings === "string") return Promise.resolve([]); // DDL strings
    return Promise.resolve(store.query(strings.join("?"), params));
  };
}

// Must be registered BEFORE the first dynamic import of anything that pulls in
// ~/db (all site imports below happen inside tests).
process.env.DATABASE_URL = "postgres://mock:mock@localhost/mock";
const store = new MemStore();
mock.module("~/db", () => ({ sql: () => makeSql(store) }));

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

type FetchHandler = (url: string, init: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchHandler): void {
  const wrapped: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init ?? {});
  }) as typeof fetch;
  globalThis.fetch = wrapped;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fundedTask(id: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    title: "Write a haiku about Solana",
    description: "Three lines, five-seven-five syllables, mention devnet.",
    agent: "general-assistant",
    currency: "SOL",
    amount_lamports: "1000000000",
    status: "funded",
    funder: "FunderWallet11111111111111111111111111111111",
    escrow: "EscrowWallet11111111111111111111111111111111",
    deposit_sig: "1111111111111111111111111111111111111111111111111111111111111111",
    result: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...extra,
  };
}

const OK_JSON = {
  summary: "Completed the task",
  content: "Line one\nLine two\n- bullet a\n- bullet b",
  steps: ["Read the brief", "Drafted", "Delivered"],
};

const OK_JSON_STR = JSON.stringify(OK_JSON);

function asApiError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; message?: string };
  return { status: e.status ?? 0, message: e.message ?? String(err) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("demo mode: full state machine through the real API handler (funded → awaiting_review, demo result)", async () => {
  // Demo mode: NO provider keys, fetch must never be called.
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  mockFetch(async () => {
    throw new Error("fetch must not be called in demo mode");
  });

  const { handleApiRequest } = await import("../src/server/api");

  // Create a draft task through the real API.
  const created = await handleApiRequest(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Write a haiku about Solana", description: "Three lines.", amount_lamports: "1000" }),
    })
  );
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as { task: Row };
  expect(createdBody.task.status).toBe("draft");

  // A draft task must NOT run (409 guard through the API).
  const guardResp = await handleApiRequest(
    new Request(`http://localhost/api/tasks/${String(createdBody.task.id)}/run`, { method: "POST" })
  );
  expect(guardResp.status).toBe(409);

  // Simulate the deposit having been recorded (recordDeposit needs a real
  // on-chain signature — verified separately in verify-funding.ts), then run.
  const id = String(createdBody.task.id);
  store.patch(id, { status: "funded", deposit_sig: "1111", funder: "funder" });

  const runResp = await handleApiRequest(
    new Request(`http://localhost/api/tasks/${id}/run`, { method: "POST" })
  );
  expect(runResp.status).toBe(200);
  const runBody = (await runResp.json()) as { task: Row & { result: unknown; demo: boolean } };
  expect(runBody.task.status).toBe("awaiting_review");
  expect(runBody.task.demo).toBe(true); // demo flag on the task

  // result is a parsed object — NEVER a raw string.
  expect(typeof runBody.task.result).toBe("object");
  expect(runBody.task.result).not.toBeNull();
  const r = runBody.task.result as {
    demo?: boolean;
    summary: string;
    content: string;
    steps: string[];
  };
  expect(r.demo).toBe(true);
  expect(typeof r.summary).toBe("string");
  expect(r.summary.length).toBeGreaterThan(0);
  expect(typeof r.content).toBe("string");
  expect(r.content).toContain("Write a haiku about Solana"); // task-specific
  expect(Array.isArray(r.steps)).toBe(true);
  expect(r.steps.length).toBeGreaterThan(0);
  for (const s of r.steps) expect(typeof s).toBe("string");

  // GET /api/tasks/:id returns the parsed result + demo boolean (never raw string).
  const getResp = await handleApiRequest(new Request(`http://localhost/api/tasks/${id}`));
  expect(getResp.status).toBe(200);
  const getBody = (await getResp.json()) as {
    task: Row & { result: unknown; demo: boolean };
  };
  expect(getBody.task.status).toBe("awaiting_review");
  expect(typeof getBody.task.result).toBe("object");
  expect(getBody.task.demo).toBe(true);
  expect(typeof getBody.task.result).not.toBe("string");

  // Running an already-reviewed task must 409 (idempotent guard).
  const again = await handleApiRequest(
    new Request(`http://localhost/api/tasks/${id}/run`, { method: "POST" })
  );
  expect(again.status).toBe(409);
});

test("/run guards: 404 unknown task, 409 wrong state (draft), 503 without DB", async () => {
  const { handleApiRequest } = await import("../src/server/api");

  const notFound = await handleApiRequest(
    new Request("http://localhost/api/tasks/does-not-exist/run", { method: "POST" })
  );
  expect(notFound.status).toBe(404);

  store.seed(fundedTask("guard-draft", { status: "draft" }));
  const wrongState = await handleApiRequest(
    new Request("http://localhost/api/tasks/guard-draft/run", { method: "POST" })
  );
  expect(wrongState.status).toBe(409);

  // 503 guard: without DATABASE_URL every DB route degrades gracefully.
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const noDb = await handleApiRequest(
      new Request("http://localhost/api/tasks/guard-draft/run", { method: "POST" })
    );
    expect(noDb.status).toBe(503);
    const noDbBody = (await noDb.json()) as { error?: string };
    expect(noDbBody.error).toContain("DATABASE_URL");
  } finally {
    process.env.DATABASE_URL = prev;
  }
});

test("double-run rejection: in-process guard + atomic flip never run a task twice", async () => {
  process.env.OPENAI_API_KEY = "sk-test-openai";
  try {
    // Gate the LLM response so the first run stays in 'working'.
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    mockFetch(async () => {
      await gate;
      return jsonResponse({
        choices: [{ message: { content: OK_JSON_STR } }],
      });
    });

    store.seed(fundedTask("double-run"));
    const { executeTask, isAgentRunning } = await import("../src/server/agent");

    const run1 = executeTask("double-run");
    await tick(); // let run1 reach the LLM call

    // Intermediate state is observable: working + in-process guard engaged.
    expect(store.get("double-run")!.status).toBe("working");
    expect(isAgentRunning("double-run")).toBe(true);

    // Second run must be rejected (409) while the first is still executing.
    try {
      await executeTask("double-run");
      throw new Error("expected double-run to be rejected");
    } catch (err) {
      const { status, message } = asApiError(err);
      expect(status).toBe(409);
      expect(message).toMatch(/already being executed|concurrent/);
    }
    expect(store.get("double-run")!.status).toBe("working"); // untouched

    release();
    const finalTask = await run1;
    expect(finalTask.status).toBe("awaiting_review");
    const parsed = JSON.parse(String(finalTask.result)) as typeof OK_JSON;
    expect(parsed.summary).toBe(OK_JSON.summary);

    // After completion the guard is released.
    expect(isAgentRunning("double-run")).toBe(false);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test("LLM failure → task back to funded with recorded error, then retry succeeds (demo)", async () => {
  process.env.OPENAI_API_KEY = "sk-test-openai";
  try {
    mockFetch(async () => new Response("upstream exploded", { status: 500 }));
    store.seed(fundedTask("err-retry"));
    const { executeTask } = await import("../src/server/agent");

    try {
      await executeTask("err-retry");
      throw new Error("expected executeTask to throw on LLM failure");
    } catch (err) {
      const { status, message } = asApiError(err);
      expect(status).toBe(502);
      expect(message).toMatch(/agent execution failed/);
      expect(message).toContain("HTTP 500");
    }

    // Task is retryable: status back to funded, error recorded in result.
    expect(store.get("err-retry")!.status).toBe("funded");
    const recorded = JSON.parse(String(store.get("err-retry")!.result)) as { error: string };
    expect(typeof recorded.error).toBe("string");
    expect(recorded.error).toContain("HTTP 500");

    // Retry in demo mode (no key) → succeeds.
    delete process.env.OPENAI_API_KEY;
    const done = await executeTask("err-retry");
    expect(done.status).toBe("awaiting_review");
    const okResult = JSON.parse(String(done.result)) as { demo?: boolean };
    expect(okResult.demo).toBe(true);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test("OpenAI path: request shape + JSON parse, retry-once on parse failure, then exhausted", async () => {
  process.env.OPENAI_API_KEY = "sk-test-openai";
  try {
    let calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    let firstInvalid = true;
    mockFetch(async (url, init) => {
      calls.push({
        url,
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
      });
      if (firstInvalid) {
        firstInvalid = false;
        return jsonResponse({ choices: [{ message: { content: "this is not json" } }] });
      }
      return jsonResponse({ choices: [{ message: { content: OK_JSON_STR } }] });
    });

    store.seed(fundedTask("openai-retry"));
    const { executeTask } = await import("../src/server/agent");
    const done = await executeTask("openai-retry");

    // Retried once on parse failure → 2 provider calls.
    expect(calls.length).toBe(2);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer sk-test-openai");
    expect(calls[0]!.body.model).toBe("gpt-4o-mini"); // default model
    const messages = calls[0]!.body.messages as { role: string; content: string }[];
    expect(messages.some((m) => m.content.includes("TASK TITLE: Write a haiku about Solana"))).toBe(true);

    expect(done.status).toBe("awaiting_review");
    const parsed = JSON.parse(String(done.result)) as typeof OK_JSON;
    expect(parsed.steps).toEqual(OK_JSON.steps);

    // Both responses invalid → retry exhausted → error recorded, task funded.
    let invalid = 0;
    mockFetch(async () => {
      invalid++;
      return jsonResponse({ choices: [{ message: { content: "still not json" } }] });
    });
    store.seed(fundedTask("openai-exhausted"));
    try {
      await executeTask("openai-exhausted");
      throw new Error("expected failure when both parse attempts are invalid");
    } catch (err) {
      expect(asApiError(err).status).toBe(502);
    }
    expect(invalid).toBe(2); // retried exactly once
    expect(store.get("openai-exhausted")!.status).toBe("funded");
    const errResult = JSON.parse(String(store.get("openai-exhausted")!.result)) as { error: string };
    expect(errResult.error).toMatch(/could not be parsed|invalid|JSON/i);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test("Anthropic path: request shape + result stored", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    let captured: { url: string; headers: Headers; body: Record<string, unknown> } | null = null;
    mockFetch(async (url, init) => {
      captured = {
        url,
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
      };
      return jsonResponse({
        content: [{ type: "text", text: OK_JSON_STR }],
      });
    });

    store.seed(fundedTask("anthropic-run"));
    const { executeTask } = await import("../src/server/agent");
    const done = await executeTask("anthropic-run");

    expect(captured).not.toBeNull();
    expect(captured!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(captured!.headers.get("x-api-key")).toBe("sk-ant-test");
    expect(captured!.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(captured!.body.model).toBe("claude-3-5-haiku-latest"); // default model

    expect(done.status).toBe("awaiting_review");
    const parsed = JSON.parse(String(done.result)) as typeof OK_JSON;
    expect(parsed.summary).toBe(OK_JSON.summary);
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("demo result is deterministic and well-formed", async () => {
  const { buildDemoResult } = await import("../src/server/agent");
  const ctx = {
    title: "Write a haiku about Solana",
    description: "Three lines, five-seven-five syllables, mention devnet.",
    currency: "SOL" as const,
    amount: "1000000000",
  };
  const a = buildDemoResult(ctx);
  const b = buildDemoResult(ctx);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // deterministic
  expect(a.demo).toBe(true);
  expect(a.summary).toContain("Demo result");
  expect(a.content).toContain(ctx.title); // task-specific
  expect(Array.isArray(a.steps)).toBe(true);
  expect(a.steps.length).toBeGreaterThan(0);
});
