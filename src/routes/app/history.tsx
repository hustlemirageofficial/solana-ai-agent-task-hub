import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTasks, listTxns } from "~/server/tasks";
import type { TxnRow } from "~/server/tasks";
import { KindBadge } from "~/components/StatusBadge";
import { explorerLink } from "~/lib/solana";
import { humanAmount, shortAddr, shortDateTime, shortSig } from "~/lib/format";

/**
 * History page — the on-chain proof ledger. Lists every recorded transaction
 * (deposit / release / refund) with the task title, human amounts, from → to,
 * and a signature link to the explorer. Filterable by kind client-side.
 * Graceful in demo mode: without DATABASE_URL it shows the empty state.
 */
const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [txns, tasks] = await Promise.all([listTxns(), listTasks()]);
    const titleById = new Map(tasks.map((t) => [String(t.id), String(t.title ?? "")]));
    const withTitles = txns.map((t) => ({
      ...t,
      task_title: titleById.get(String(t.task_id)) ?? null,
    })) as HistoryTxn[];
    return { txns: withTitles, error: null };
  } catch (err) {
    return {
      txns: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

type HistoryTxn = TxnRow & { task_title: string | null };

const KIND_FILTERS: { key: "all" | "deposit" | "release" | "refund"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "release", label: "Releases" },
  { key: "refund", label: "Refunds" },
];

export const Route = createFileRoute("/app/history")({
  loader: () => getHistory(),
  component: HistoryPage,
});

function HistoryPage() {
  const { txns, error } = Route.useLoaderData();
  const [filter, setFilter] = useState<"all" | "deposit" | "release" | "refund">("all");
  const shown = filter === "all" ? txns : txns.filter((t) => t.kind === filter);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">History</h1>
      <p className="mt-1 text-sm text-slate-400">
        Every on-chain event — deposits, releases and refunds — with signatures
        you can verify on the explorer.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
          Database not connected — transaction history appears once{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
            DATABASE_URL
          </code>{" "}
          is set.
        </div>
      )}

      {txns.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
            🧾
          </div>
          <h2 className="mt-5 text-lg font-semibold text-white">No transactions yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Once you fund a task, its deposit — and later its release or refund —
            will show up here with on-chain proof.
          </p>
          <Link
            to="/app/new"
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Create a task
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  filter === f.key
                    ? "border-teal-400/40 bg-teal-400/15 text-teal-200"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-slate-500">
                  {f.key === "all"
                    ? txns.length
                    : txns.filter((t) => t.kind === f.key).length}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-white/5 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">From → To</th>
                  <th className="px-4 py-3 font-medium">Signature</th>
                  <th className="px-4 py-3 font-medium">Confirmed</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shown.map((t: HistoryTxn) => (
                  <tr key={t.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <KindBadge kind={String(t.kind)} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200">
                        {humanAmount(t.amount_lamports, String(t.currency))}
                      </span>{" "}
                      <span className="text-xs text-slate-500">{String(t.currency)}</span>
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      {t.task_title ? (
                        <Link
                          to="/app/tasks/$taskId"
                          params={{ taskId: String(t.task_id) }}
                          className="block truncate text-slate-300 hover:text-teal-300"
                          title={t.task_title}
                        >
                          {t.task_title}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {shortAddr(t.from_addr)} → {shortAddr(t.to_addr)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {t.signature ? (
                        <a
                          href={explorerLink(String(t.signature))}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-400/90 hover:text-teal-300"
                        >
                          {shortSig(String(t.signature))}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.confirmed ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-slate-600">pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {shortDateTime(String(t.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No {filter} transactions yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
