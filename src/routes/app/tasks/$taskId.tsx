import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PublicKey } from "@solana/web3.js";
import { getTask, listTxns } from "~/server/tasks";
import type { TaskRow, TxnRow } from "~/server/tasks";
import { parseTaskResult } from "~/server/agent";
import type { AgentResult } from "~/server/llm";
import { payoutTarget } from "~/server/release";
import { useWalletBridge } from "~/components/wallet/wallet-context";
import { StatusBadge, KindBadge } from "~/components/StatusBadge";
import { AgentResultView } from "~/components/AgentResult";
import { devnetFaucetUrl, explorerLink } from "~/lib/solana";
import { FUND_STEPS, fundTask } from "~/lib/funding";
import type { FundStep } from "~/lib/funding";
import { humanAmount, shortAddr, shortDateTime, shortSig } from "~/lib/format";

/**
 * Task detail — funding flow + agent execution + review/payout.
 *
 * Draft/funding tasks show the escrow address and a "Fund & launch" control
 * that (1) builds the SOL or USDC transfer client-side, (2) sends it through
 * the connected wallet, (3) confirms on-chain, then (4) POSTs the signature to
 * POST /api/tasks/:id/deposit so the server re-verifies the payment from the
 * RPC and records it (task → funded). Every step is shown in a stepper with a
 * signature + explorer link once confirmed.
 *
 * Once funded the platform runs the agent automatically (see src/server/agent.ts):
 * funded → working → awaiting_review, with the reviewable result rendered in
 * the "Agent result" section (demo-badged when no LLM key is configured, and a
 * "Re-run" button when the last run failed).
 *
 * While awaiting_review the funder decides (see src/server/release.ts): APPROVE
 * releases the bounty on-chain from the escrow to the agent's payout wallet
 * (task → approved, kind=release txn), REJECT refunds it on-chain to the funder
 * (task → refunded, kind=refund txn). Both are real signed transactions with a
 * recorded signature + explorer link. A failed payout attempt rolls the task
 * back to awaiting_review with the error recorded (retryable).
 */
type PayoutInfo = { address: string; demo: boolean };

const loadTask = createServerFn({ method: "GET" })
  .validator((d: string) => d)
  .handler(async ({ data: id }) => {
    try {
      const task = await getTask(id);
      const txns = task ? await listTxns(id) : [];
      let payout: PayoutInfo | null = null;
      try {
        payout = payoutTarget();
      } catch {
        payout = null; // invalid AGENT_PAYOUT_ADDRESS — the page still loads
      }
      // result is always parsed client-side (never a raw string), with a
      // boolean `demo` flag derived from the stored result.
      return { task: task ? parseTaskResult(task) : null, txns, payout, error: null };
    } catch (err) {
      return {
        task: null,
        txns: [],
        payout: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

export const Route = createFileRoute("/app/tasks/$taskId")({
  loader: ({ params }) => loadTask({ data: params.taskId }),
  head: () => ({ meta: [{ title: "Task — AgentPay" }] }),
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { task, txns, payout, error } = Route.useLoaderData();
  const router = useRouter();
  const bridge = useWalletBridge();
  const [step, setStep] = useState<FundStep>("idle");
  const [failedStep, setFailedStep] = useState<FundStep | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<"approve" | "reject" | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const lastStepRef = useRef<FundStep>("idle");
  const taskStatus = String(task?.status ?? "");
  // While the agent is working, poll until the task leaves 'working' so the
  // reviewable result appears without a manual refresh.
  useEffect(() => {
    if (taskStatus !== "working") return;
    const timer = setInterval(() => {
      void router.invalidate();
    }, 3000);
    return () => clearInterval(timer);
  }, [taskStatus, router]);
  const fundable = task !== null && (task.status === "draft" || task.status === "funding");
  const funded = task !== null && !fundable;
  const canFund =
    fundable &&
    bridge.mounted &&
    bridge.connected &&
    bridge.publicKey !== null &&
    bridge.connection !== null &&
    bridge.sendTransaction !== null;
  // Agent result (already parsed server-side by the loader): null until a run
  // completed or failed.
  const result: AgentResult | null =
    task !== null && task.result && typeof task.result === "object"
      ? (task.result as AgentResult)
      : null;
  const lastRunFailed =
    result !== null && typeof result.error === "string" && result.error.length > 0;
  const showResult =
    result !== null &&
    !lastRunFailed &&
    (taskStatus === "awaiting_review" ||
      taskStatus === "approved" ||
      taskStatus === "rejected" ||
      taskStatus === "refunded" ||
      taskStatus === "cancelled");
  function handleStep(s: FundStep) {
    lastStepRef.current = s;
    setStep(s);
  }
  /** Manual retry: POST /api/tasks/:id/run (guarded server-side). */
  async function handleRerun() {
    if (!task) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const resp = await fetch(`/api/tasks/${task.id}/run`, { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? `Agent run failed (HTTP ${resp.status})`);
      }
      await router.invalidate();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunBusy(false);
    }
  }
  async function recordDepositOnServer(taskId: string, sig: string, amount: string) {
    const resp = await fetch(`/api/tasks/${taskId}/deposit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature: sig, amount }),
    });
    const data = (await resp.json().catch(() => ({}))) as { error?: string };
    if (!resp.ok) {
      throw new Error(
        data.error
          ? `Payment confirmed on-chain, but recording it failed: ${data.error}`
          : `Deposit recording failed (HTTP ${resp.status})`
      );
    }
    return data;
  }
  async function handleFund() {
    if (!task || !canFund || !bridge.connection || !bridge.publicKey || !bridge.sendTransaction) return;
    setBusy(true);
    setFundError(null);
    setSignature(null);
    setFailedStep(null);
    setStep("idle");
    lastStepRef.current = "idle";
    try {
      const { signature: sig } = await fundTask({
        connection: bridge.connection,
        sendTransaction: bridge.sendTransaction,
        payer: new PublicKey(bridge.publicKey),
        escrowAddress: String(task.escrow),
        amountLamports: String(task.amount_lamports),
        currency: task.currency === "USDC" ? "USDC" : "SOL",
        onStep: handleStep,
      });
      setSignature(sig);
      // Server-side re-verification + recording (idempotent).
      await recordDepositOnServer(task.id, sig, String(task.amount_lamports));
      setStep("verified");
      await router.invalidate();
    } catch (err) {
      const failed = lastStepRef.current;
      if (failed !== "idle" && failed !== "verified") setFailedStep(failed);
      setStep("error");
      setFundError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  /** Retry only the server-side recording after an on-chain success. */
  async function handleRetryRecord() {
    if (!task || !signature) return;
    setBusy(true);
    setFundError(null);
    try {
      await recordDepositOnServer(task.id, signature, String(task.amount_lamports));
      setStep("verified");
      await router.invalidate();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  /**
   * Review decision — APPROVE (release to the agent wallet) or REJECT (refund
   * the funder). Server-side POST /api/tasks/:id/approve | /reject signs and
   * broadcasts the real escrow transaction; the server guards against
   * double-pay/double-refund (409) and rolls back to awaiting_review with the
   * recorded error when the on-chain attempt fails.
   */
  async function handleReview(action: "approve" | "reject") {
    if (!task) return;
    const amount = humanAmount(task.amount_lamports, currency);
    const target = action === "approve"
      ? payout
        ? `${payout.address}${payout.demo ? " (demo agent wallet)" : ""}`
        : "the agent wallet"
      : task.funder
        ? shortAddr(task.funder)
        : "your wallet";
    const confirmed = window.confirm(
      action === "approve"
        ? `Approve the agent's result and release ${amount} ${currency} from escrow to the agent wallet (${target})?\n\nThis is a real on-chain payment and cannot be undone.`
        : `Reject the agent's result and refund ${amount} ${currency} back to the funder (${target})?\n\nThis is a real on-chain refund and cannot be undone.`
    );
    if (!confirmed) return;
    setReviewBusy(action);
    setReviewError(null);
    try {
      const resp = await fetch(`/api/tasks/${task.id}/${action === "approve" ? "approve" : "reject"}`, {
        method: "POST",
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        throw new Error(
          data.error
            ? `${action === "approve" ? "Release" : "Refund"} failed: ${data.error}`
            : `${action === "approve" ? "Release" : "Refund"} failed (HTTP ${resp.status})`
        );
      }
      await router.invalidate();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewBusy(null);
    }
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <div className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
          {error}
        </div>
      </div>
    );
  }
  if (!task) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-400">
          Task not found (or the database is not connected).
        </div>
      </div>
    );
  }
  const currency = task.currency === "USDC" ? "USDC" : "SOL";
  const faucet = devnetFaucetUrl();
  const releaseTxn = txns.find((t) => t.kind === "release");
  const refundTxn = txns.find((t) => t.kind === "refund");
  const releaseSig = task.release_sig
    ? String(task.release_sig)
    : releaseTxn && releaseTxn.signature
      ? String(releaseTxn.signature)
      : null;
  const refundSig = task.refund_sig
    ? String(task.refund_sig)
    : refundTxn && refundTxn.signature
      ? String(refundTxn.signature)
      : null;
  const payoutError = task.payout_error ? String(task.payout_error) : null;
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">{String(task.title)}</h1>
        <StatusBadge status={String(task.status)} />
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {String(task.description || "No description provided.")}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm">
          <span className="text-slate-500">Bounty:</span>{" "}
          <span className="font-mono text-white">
            {humanAmount(task.amount_lamports, currency)} {currency}
          </span>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm">
          <span className="text-slate-500">Agent:</span>{" "}
          <span className="text-slate-200">{String(task.agent)}</span>
        </div>
      </div>
      {fundable && (
        <Section title="Fund & launch">
          <p className="text-sm text-slate-400">
            Fund this task to escrow it on-chain. Once the deposit confirms, the
            platform agent starts working and posts a result for your review.
          </p>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Escrow:</span>
              <a
                href={explorerLink(String(task.escrow), "address")}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-teal-300 hover:text-teal-200"
              >
                {shortAddr(String(task.escrow))}
              </a>
              <span className="text-xs text-slate-500">(platform escrow — server-held)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Amount:</span>
              <span className="font-mono text-slate-200">
                {humanAmount(task.amount_lamports, currency)} {currency}
              </span>
              <span className="text-xs text-slate-500">
                {currency === "SOL" ? "lamports" : "USDC base units"}: {String(task.amount_lamports)}
              </span>
            </div>
          </div>
          {bridge.mounted && !bridge.connected && (
            <p className="mt-3 text-sm text-amber-300">
              Connect your wallet to fund this task.
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleFund()}
            disabled={!canFund || busy}
            className="mt-4 rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Funding…" : "Fund & launch"}
          </button>
          {step !== "idle" && (
            <FundStepper step={step} failedStep={failedStep} signature={signature} />
          )}
          {fundError && (
            <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
              <p>{fundError}</p>
              {failedStep === "verified" && signature && (
                <button
                  type="button"
                  onClick={() => void handleRetryRecord()}
                  disabled={busy}
                  className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                >
                  Retry recording deposit
                </button>
              )}
            </div>
          )}
          {faucet && (
            <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-500">
              Testing on devnet? Get free devnet SOL from the{" "}
              <a
                href={faucet}
                target="_blank"
                rel="noreferrer"
                className="text-teal-300 hover:text-teal-200"
              >
                Solana faucet
              </a>
              . For devnet USDC, mint/obtain it on devnet first (e.g. via the SPL
              token CLI or a devnet faucet) — devnet tokens are test funds.
            </p>
          )}
        </Section>
      )}
      {funded && (
        <>
          <Section title="Deposit">
            <p className="text-sm text-slate-400">
              This task is funded and its bounty is held in escrow on-chain.
              {taskStatus === "awaiting_review" &&
                " The agent has submitted a result below — approve it to release payment to the agent, or reject it to refund your escrow."}
            </p>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Funder:</span>
                <span className="font-mono text-slate-300">
                  {task.funder ? shortAddr(task.funder) : "—"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Deposit tx:</span>
                {task.deposit_sig ? (
                  <a
                    href={explorerLink(String(task.deposit_sig))}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-teal-300 hover:text-teal-200"
                  >
                    {shortSig(String(task.deposit_sig))}
                  </a>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>
            </div>
          </Section>
          {taskStatus === "working" && (
            <Section title="Agent working">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                <p className="text-sm text-slate-300">
                  The agent is executing this task right now. Its result will
                  appear here for your review in a moment.
                </p>
              </div>
            </Section>
          )}
          {taskStatus === "funded" && lastRunFailed && (
            <Section title="Agent run failed">
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
                <p>{String(result?.error ?? "The agent run failed.")}</p>
                <p className="mt-1.5 text-xs text-slate-400">
                  The task is back to <span className="text-blue-300">funded</span>{" "}
                  and can be retried — nothing was paid out.
                </p>
                <button
                  type="button"
                  onClick={() => void handleRerun()}
                  disabled={runBusy}
                  className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runBusy ? "Re-running…" : "Re-run agent"}
                </button>
              </div>
              {runError && (
                <p className="mt-2 text-xs text-rose-300">{runError}</p>
              )}
            </Section>
          )}
          {showResult && result && (
            <Section title="Agent result">
              <AgentResultView result={result} />
              {taskStatus === "awaiting_review" && (
                <ReviewActions
                  task={task}
                  payout={payout}
                  busy={reviewBusy}
                  error={reviewError}
                  payoutError={payoutError}
                  onAction={(a) => void handleReview(a)}
                />
              )}
              {taskStatus === "approved" && releaseSig && (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-300">
                  <p className="font-medium">
                    ✓ Result approved — the bounty was released to the agent wallet.
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Release transaction:{" "}
                    <a
                      href={explorerLink(releaseSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-emerald-300 hover:text-emerald-200"
                    >
                      {shortSig(releaseSig)}
                    </a>{" "}
                    ·{" "}
                    <a
                      href={explorerLink(releaseSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-300"
                    >
                      open in explorer ↗
                    </a>
                  </p>
                </div>
              )}
              {taskStatus === "refunded" && refundSig && (
                <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-400/5 px-4 py-3 text-sm text-teal-300">
                  <p className="font-medium">
                    ✓ Result rejected — the bounty was refunded to the funder.
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Refund transaction:{" "}
                    <a
                      href={explorerLink(refundSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-teal-300 hover:text-teal-200"
                    >
                      {shortSig(refundSig)}
                    </a>{" "}
                    ·{" "}
                    <a
                      href={explorerLink(refundSig)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-300"
                    >
                      open in explorer ↗
                    </a>
                  </p>
                </div>
              )}
            </Section>
          )}
        </>
      )}
      <Section title="Proof — transactions">
        {txns.length === 0 ? (
          <p className="text-sm text-slate-500">
            No on-chain transactions recorded for this task yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {txns.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <KindBadge kind={String(t.kind)} />
                <span className="font-mono text-slate-200">
                  {humanAmount(t.amount_lamports, String(t.currency))}{" "}
                  <span className="text-xs text-slate-500">{String(t.currency)}</span>
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {shortAddr(t.from_addr)} → {shortAddr(t.to_addr)}
                </span>
                {t.signature ? (
                  <a
                    href={explorerLink(String(t.signature))}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-teal-300 hover:text-teal-200"
                  >
                    {shortSig(String(t.signature))}
                  </a>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
                <span className="text-xs text-slate-600">
                  {shortDateTime(String(t.created_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/**
 * Approve / Reject controls shown while a task is awaiting_review. Shows the
 * payout target (with a "demo agent wallet" label when the server fallback is
 * in use), a recorded last-attempt error when one exists (retryable), and the
 * two decision buttons with busy states.
 */
function ReviewActions({
  task,
  payout,
  busy,
  error,
  payoutError,
  onAction,
}: {
  task: TaskRow;
  payout: PayoutInfo | null;
  busy: "approve" | "reject" | null;
  error: string | null;
  payoutError: string | null;
  onAction: (action: "approve" | "reject") => void;
}) {
  const currency = task.currency === "USDC" ? "USDC" : "SOL";
  const amount = humanAmount(task.amount_lamports, currency);
  return (
    <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300/80">
        Review decision
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Payout target:</span>
        <a
          href={explorerLink(payout?.address ?? "", "address")}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-slate-200 hover:text-teal-300"
        >
          {payout ? shortAddr(payout.address) : "—"}
        </a>
        {payout?.demo && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            demo agent wallet
          </span>
        )}
        {payout && (
          <span className="text-xs text-slate-500">
            (full: <span className="font-mono">{payout.address}</span>)
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Approving releases{" "}
        <span className="font-mono text-slate-200">
          {amount} {currency}
        </span>{" "}
        from escrow to the agent wallet. Rejecting refunds it on-chain to the
        funder ({task.funder ? shortAddr(task.funder) : "—"}). Either way the
        transaction is recorded on the History page.
      </p>
      {payoutError && (
        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-300">
          <p className="font-medium">A previous payout attempt failed:</p>
          <p className="mt-0.5 font-mono text-amber-200/80">{payoutError}</p>
          <p className="mt-1.5 text-slate-400">
            No payment moved. The task is back to awaiting review — you can retry below.
          </p>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAction("approve")}
          disabled={busy !== null}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "approve" ? "Releasing…" : "Approve & release payment"}
        </button>
        <button
          type="button"
          onClick={() => onAction("reject")}
          disabled={busy !== null}
          className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "reject" ? "Refunding…" : "Reject & refund"}
        </button>
      </div>
    </div>
  );
}

function FundStepper({
  step,
  failedStep,
  signature,
}: {
  step: FundStep;
  failedStep: FundStep | null;
  signature: string | null;
}) {
  const activeIndex = FUND_STEPS.findIndex((s) => s.key === step);
  const failIndex = failedStep ? FUND_STEPS.findIndex((s) => s.key === failedStep) : -1;
  return (
    <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <ol className="space-y-2.5">
        {FUND_STEPS.map((s, i) => {
          let state: "done" | "active" | "pending" | "error" = "pending";
          if (step === "verified") state = "done";
          else if (step === "error" && failIndex >= 0) {
            if (i < failIndex) state = "done";
            else if (i === failIndex) state = "error";
          } else if (activeIndex >= 0) {
            if (i < activeIndex) state = "done";
            else if (i === activeIndex) state = "active";
          }
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  state === "done"
                    ? "bg-emerald-400/20 text-emerald-300"
                    : state === "active"
                      ? "bg-teal-400/20 text-teal-300"
                      : state === "error"
                        ? "bg-rose-400/20 text-rose-300"
                        : "bg-white/5 text-slate-600"
                }`}
              >
                {state === "done" ? "✓" : state === "error" ? "✗" : i + 1}
              </span>
              <span
                className={
                  state === "done"
                    ? "text-slate-400"
                    : state === "active"
                      ? "text-white"
                      : state === "error"
                        ? "text-rose-300"
                        : "text-slate-600"
                }
              >
                {s.label}
                {state === "active" && (
                  <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border border-teal-300 border-t-transparent align-middle" />
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {signature && (
        <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-400">
          Transaction signature:{" "}
          <a
            href={explorerLink(signature)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-teal-300 hover:text-teal-200"
          >
            {shortSig(signature)}
          </a>{" "}
          ·{" "}
          <a
            href={explorerLink(signature)}
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-slate-300"
          >
            open in explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
function BackLink() {
  return (
    <Link to="/app" className="text-sm text-slate-400 transition hover:text-white">
      ← Back to tasks
    </Link>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
export type { TaskRow, TxnRow };
