/**
 * Server-only LLM client for the AgentPay execution engine. Plain fetch, no
 * SDKs, no heavy dependencies. API keys are read from the environment at call
 * time and NEVER leave the server — this module is only ever imported by
 * server-side code and never bundled into client assets.
 *
 * Provider selection (first match wins, checked per call):
 *   OPENAI_API_KEY    → POST https://api.openai.com/v1/chat/completions
 *                       (model OPENAI_MODEL, default "gpt-4o-mini")
 *   ANTHROPIC_API_KEY → POST https://api.anthropic.com/v1/messages
 *                       (model ANTHROPIC_MODEL, default "claude-3-5-haiku-latest")
 *
 * The agent is the hired contractor: given the task title/description and the
 * bounty context (currency + amount), it must return a JSON object of the form
 *   { "summary": string, "content": string, "steps": string[] }
 * The output is parsed and validated. A parse failure retries the provider
 * ONCE, then throws LlmError("invalid_response").
 */

export type AgentResult = {
  summary: string;
  content: string;
  steps: string[];
  /** True when the result was produced by demo mode (no API key configured). */
  demo?: boolean;
  /** Set when a run failed — the task is left retryable (status 'funded'). */
  error?: string;
};

export type AgentRunContext = {
  title: string;
  description: string;
  currency: "SOL" | "USDC";
  /** Bounty in lamports (SOL) or 1e6 base units (USDC), as stored. */
  amount: string;
};

export type LlmErrorCode =
  | "no_key" // no provider configured
  | "timeout" // request exceeded LLM_TIMEOUT_MS
  | "http" // provider returned a non-2xx status
  | "network" // fetch failed / malformed response envelope
  | "invalid_response"; // agent output JSON failed parse/validation

export class LlmError extends Error {
  constructor(
    public code: LlmErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export const LLM_TIMEOUT_MS = 60_000;

/** Retry the provider once on parse failure only (never on http/timeout). */
const MAX_PARSE_ATTEMPTS = 2;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) || Boolean(process.env.ANTHROPIC_API_KEY);
}

export function buildAgentPrompt(ctx: AgentRunContext): { system: string; user: string } {
  const system =
    "You are the hired contractor on AgentPay, a Solana escrow marketplace for AI-agent tasks. " +
    "A funder created a task and escrowed a bounty for it; you are being paid to complete it. " +
    "Complete the task as described, then reply with a single JSON object and NOTHING else " +
    "(no markdown fences, no commentary, no trailing text) in exactly this shape:\n" +
    '{"summary":"one or two sentences summarizing what you did",' +
    '"content":"the full deliverable the funder will review (plain text, short paragraphs; use \'- \' for bullet lists and fenced ``` code blocks for code)",' +
    '"steps":["step 1","step 2",...]}\n' +
    "The 'steps' array lists 3-6 concrete steps you took. The 'content' field is what the funder " +
    "reviews, so make it complete but concise.";

  const amountLabel =
    ctx.currency === "USDC"
      ? `${ctx.amount} base units (USDC)`
      : `${ctx.amount} lamports (SOL)`;

  const user = [
    `TASK TITLE: ${ctx.title}`,
    `TASK DESCRIPTION: ${ctx.description || "(none provided)"}`,
    `BOUNTY: ${amountLabel} — held in escrow until the funder approves your result.`,
    "",
    "Now complete the task and return the JSON result.",
  ].join("\n");

  return { system, user };
}

/**
 * Run the configured provider once and return its raw text content.
 * Throws LlmError on no_key / timeout / http / network.
 */
async function callProvider(ctx: AgentRunContext): Promise<string> {
  const { system, user } = buildAgentPrompt(ctx);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new LlmError(
          "http",
          `OpenAI API error: HTTP ${resp.status} — ${await safeErrorText(resp)}`
        );
      }
      const envelope = (await resp.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = envelope?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new LlmError("network", "OpenAI response contained no text content");
      }
      return content;
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (anthropicKey) {
      const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.3,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new LlmError(
          "http",
          `Anthropic API error: HTTP ${resp.status} — ${await safeErrorText(resp)}`
        );
      }
      const envelope = (await resp.json()) as {
        content?: { type?: string; text?: unknown }[];
      };
      const text = envelope?.content?.find((b) => b.type === "text")?.text;
      if (typeof text !== "string" || !text.trim()) {
        throw new LlmError("network", "Anthropic response contained no text content");
      }
      return text;
    }

    throw new LlmError(
      "no_key",
      "No LLM API key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)."
    );
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if ((err as Error)?.name === "AbortError" || (err as Error)?.name === "TimeoutError") {
      throw new LlmError("timeout", `LLM request timed out after ${LLM_TIMEOUT_MS / 1000}s`);
    }
    throw new LlmError(
      "network",
      `LLM request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Run the agent once, retrying the provider once when the JSON fails to parse. */
export async function runAgentLlm(ctx: AgentRunContext): Promise<AgentResult> {
  if (!isLlmConfigured()) {
    throw new LlmError(
      "no_key",
      "No LLM API key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)."
    );
  }
  let lastErr: LlmError | null = null;
  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const raw = await callProvider(ctx); // http/timeout/network throw straight through
    try {
      return parseAgentJson(raw);
    } catch (err) {
      lastErr =
        err instanceof LlmError ? err : new LlmError("invalid_response", String(err));
      // fall through and retry once (attempt 2)
    }
  }
  throw lastErr ?? new LlmError("invalid_response", "agent output could not be parsed");
}

/**
 * Parse + validate the agent's JSON output. Accepts a bare object, a fenced
 * ```json block, or text containing one JSON object. Throws LlmError on any
 * malformed shape — never returns a partial/guess object.
 */
export function parseAgentJson(raw: string): AgentResult {
  const extracted = extractJsonObject(raw);
  if (extracted === null) {
    throw new LlmError("invalid_response", "agent output did not contain a JSON object");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(extracted);
  } catch {
    throw new LlmError("invalid_response", "agent output was not valid JSON");
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    throw new LlmError("invalid_response", "agent output JSON was not an object");
  }
  const o = obj as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  const content = typeof o.content === "string" ? o.content : "";
  const steps = Array.isArray(o.steps) ? o.steps.filter((s): s is string => typeof s === "string") : [];
  if (!summary) throw new LlmError("invalid_response", "agent output missing non-empty 'summary'");
  if (!content.trim()) throw new LlmError("invalid_response", "agent output missing 'content'");
  if (steps.length === 0) throw new LlmError("invalid_response", "agent output missing 'steps' array");
  return { summary, content, steps };
}

/** Pull a JSON object out of whatever the model returned (fences / prose). */
function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1]!.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

/** Read a non-2xx body without letting a huge body blow up the error message. */
async function safeErrorText(resp: Response): Promise<string> {
  try {
    const text = (await resp.text()).trim().slice(0, 300);
    return text || resp.statusText;
  } catch {
    return resp.statusText;
  }
}
