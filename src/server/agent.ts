import { sql } from "~/db";
import { ensureSchema } from "./schema";
import {
  ApiError,
  DB_NOT_CONFIGURED,
  getTask,
  isDbConfigured,
  toClientRow,
  type TaskRow,
} from "./tasks";
import {
  isLlmConfigured,
  runAgentLlm,
  type AgentResult,
  type AgentRunContext,
} from "./llm";

/**
 * Agent execution engine — the "working" phase of the task lifecycle.
 *
 * When a task is funded, the platform runs an AI agent (or a deterministic
 * demo mode when no LLM API key is configured) and posts a reviewable result:
 *
 *   funded ──executeTask()──▶ working ──▶ awaiting_review
 *                    │
 *                    └─ LLM failure: result = {error}, status back to funded
 *                       (retryable via POST /api/tasks/:id/run)
 *
 * Double-run protection is layered:
 *   1. In-process Set — added synchronously before the first await, so two
 *      truly-concurrent calls in this process cannot both proceed.
 *   2. Atomic status flip — `update … where id = ? and status = 'funded'` with
 *      a rows-affected check, the cross-process backstop (two server instances
 *      or a race past the Set cannot both win the flip).
 */

const RUNNING = new Set<string>();

export function isAgentRunning(taskId: string): boolean {
  return RUNNING.has(taskId);
}

/**
 * Execute a funded task end-to-end: flip to working, run the agent, store the
 * result and flip to awaiting_review. On agent failure, records the error in
 * tasks.result and returns the task to 'funded' so it can be retried.
 *
 * Throws ApiError: 404 unknown task, 409 wrong state / already running,
 * 503 no database, 502 agent execution failed (task left retryable).
 */
export async function executeTask(taskId: string): Promise<TaskRow> {
  if (!isDbConfigured()) {
    throw new ApiError(503, DB_NOT_CONFIGURED);
  }
  await ensureSchema();

  // In-process guard — must run before the first await so concurrent calls in
  // this process are rejected deterministically (the atomic UPDATE below is the
  // cross-process backstop and is still exercised for every run).
  if (RUNNING.has(taskId)) {
    throw new ApiError(409, "task is already being executed");
  }
  RUNNING.add(taskId);

  try {
    const task = await getTask(taskId);
    if (!task) throw new ApiError(404, "task not found");
    if (task.status !== "funded") {
      throw new ApiError(
        409,
        `task is in status '${String(task.status)}'; only funded tasks can be executed`
      );
    }

    // Atomic funded → working. Zero rows means a concurrent runner won the
    // flip — never double-run.
    const db = sql();
    const flipped = await db`
      update tasks set status = 'working', updated_at = now()
      where id = ${taskId} and status = 'funded'
      returning *`;
    if (!flipped.length) {
      throw new ApiError(
        409,
        "task is already being executed (a concurrent run won the status transition)"
      );
    }

    // ---- Run the agent (LLM, or deterministic demo mode without keys). ----
    const result = await runAgent(task);

    const stored = { ...result };
    const rows = await db`
      update tasks set status = 'awaiting_review', result = ${JSON.stringify(stored)}, updated_at = now()
      where id = ${taskId}
      returning *`;
    if (!rows.length) {
      throw new ApiError(500, "task disappeared while the agent was executing");
    }
    return toClientRow(rows[0]) as TaskRow;
  } finally {
    RUNNING.delete(taskId);
  }
}

/**
 * Run the agent for a task. Returns demo output when no LLM key is configured.
 * On LLM failure: records { error } into tasks.result, sets status back to
 * 'funded' (retryable), then rethrows as ApiError(502).
 */
async function runAgent(task: TaskRow): Promise<AgentResult> {
  const ctx: AgentRunContext = {
    title: String(task.title ?? ""),
    description: String(task.description ?? ""),
    currency: task.currency === "USDC" ? "USDC" : "SOL",
    amount: String(task.amount_lamports ?? "0"),
  };

  if (!isLlmConfigured()) {
    return buildDemoResult(ctx);
  }

  const db = sql();
  try {
    return await runAgentLlm(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db`
      update tasks set status = 'funded', result = ${JSON.stringify({ error: message })}, updated_at = now()
      where id = ${task.id}`;
    throw new ApiError(502, `agent execution failed: ${message}`);
  }
}

/**
 * Deterministic, clearly-labeled demo result — used when neither OPENAI_API_KEY
 * nor ANTHROPIC_API_KEY is configured. The server must boot and run the whole
 * flow without any API key; the demo result is task-specific (built from the
 * title/description) and flagged { demo: true } so the UI badges it.
 */
export function buildDemoResult(ctx: AgentRunContext): AgentResult {
  const described = ctx.description.trim();
  const content = [
    `I reviewed the task "${ctx.title}" and prepared a deliverable.`,
    "",
    described
      ? `Task details: ${described}`
      : "The task was created without a description — see the title for the request.",
    "",
    "This result was generated in demo mode because no LLM API key is configured on the server. " +
      "It demonstrates the shape of what a real agent will produce (summary, content and steps) " +
      "so the flow can be reviewed end-to-end.",
  ].join("\n");

  return {
    demo: true,
    summary:
      "Demo result — no LLM API key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to run a real agent.",
    content,
    steps: [
      "Read the funded task and its description.",
      `Prepared a response for: ${ctx.title}.`,
      "Built the reviewable result (summary, content, steps) locally — no LLM call was made.",
      "Posted the result for your review.",
    ],
  };
}

/**
 * Serialize a task for the client: result is ALWAYS returned as a parsed JSON
 * object (never a raw string) when set, plus a boolean `demo` flag on the task
 * (true when the stored result was produced by demo mode).
 */
export type ParsedTaskResult = AgentResult | null;

export function parseTaskResult<T extends TaskRow>(
  task: T
): T & { result: ParsedTaskResult; demo: boolean } {
  const raw = task.result;
  if (raw == null || raw === "") return { ...task, result: null, demo: false };

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    return { ...task, result: obj as AgentResult, demo: obj.demo === true };
  }
  return { ...task, result: null, demo: false };
}

/**
 * Fire-and-forget kickoff after a successful deposit. The deposit response
 * must not block on agent execution, and a worker failure must never crash the
 * request that recorded the deposit — errors are logged and the task stays
 * 'funded' (retryable via POST /api/tasks/:id/run).
 */
export function kickoffExecution(taskId: string): void {
  void executeTask(taskId).catch((err) => {
    console.warn(
      `[agentpay:agent] kickoff for task ${taskId} failed: ${err instanceof Error ? err.message : String(err)}`
    );
  });
}
