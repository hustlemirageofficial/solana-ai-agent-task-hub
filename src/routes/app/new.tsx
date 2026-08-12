import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export const Route = createFileRoute("/app/new")({
  head: () => ({ meta: [{ title: "New task — AgentPay" }] }),
  component: NewTaskPage,
});

/**
 * Create-task form — wired to POST /api/tasks (draft + escrow attached).
 * On success the user is taken to /app/tasks/:id where they can fund it.
 * Without DATABASE_URL the API returns 503 and a clear message is shown.
 */

const AGENTS = [
  { id: "general-assistant", label: "General assistant" },
  { id: "research-analyst", label: "Research analyst" },
  { id: "code-reviewer", label: "Code reviewer" },
  { id: "data-extractor", label: "Data extractor" },
  { id: "translator", label: "Translator" },
];

const SOL_LAMPORTS_PER_UNIT = 1_000_000_000;
const USDC_BASE_UNITS_PER_UNIT = 1_000_000;

function NewTaskPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agent, setAgent] = useState(AGENTS[0].id);
  const [currency, setCurrency] = useState<"SOL" | "USDC">("SOL");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amountNum) && amountNum > 0;

  const lamports = useMemo(() => {
    if (!amountValid) return null;
    const units = currency === "SOL" ? SOL_LAMPORTS_PER_UNIT : USDC_BASE_UNITS_PER_UNIT;
    return BigInt(Math.round(amountNum * units)).toString();
  }, [amountValid, amountNum, currency]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          title,
          description,
          agent,
          currency,
          amount_lamports: lamports,
        },
        null,
        2
      ),
    [title, description, agent, currency, lamports]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !amountValid || lamports === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          agent,
          currency,
          amount_lamports: lamports,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        task?: { id: string };
        error?: string;
      };
      if (!resp.ok || !data.task) {
        setSubmitError(
          data.error ?? `Request failed (HTTP ${resp.status}) — is the database connected?`
        );
        return;
      }
      await navigate({
        to: "/app/tasks/$taskId",
        params: { taskId: data.task.id },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app" className="text-sm text-slate-400 transition hover:text-white">
        ← Back to tasks
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
        Create a task
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Describe the job, pick an agent and set a bounty. After creating, you&apos;ll
        fund the task from your wallet — payment is held in escrow until you
        approve the agent&apos;s result.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6"
      >
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summarize this research paper"
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-teal-400/50"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context, inputs, and what a good result looks like…"
            rows={4}
            className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-teal-400/50"
          />
        </Field>

        <Field label="Agent">
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0b101d] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-teal-400/50"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
            Currency & bounty
          </span>
          <div className="flex gap-2">
            {(["SOL", "USDC"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  currency === c
                    ? "border-teal-400/50 bg-teal-400/10 text-teal-300"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              className="w-40 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-teal-400/50"
            />
            <span className="text-sm text-slate-400">{currency}</span>
            {lamports && (
              <span className="font-mono text-xs text-slate-500">
                = {lamports} {currency === "SOL" ? "lamports" : "base units"}
              </span>
            )}
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim() || !amountValid || submitting}
          className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-teal-400 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Creating…" : "Create task draft"}
        </button>

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">
            Payload preview (what the API will receive)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
            {payload}
          </pre>
        </details>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}
