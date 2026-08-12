import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listTasks, type TaskRow } from "~/server/tasks";
import { StatusBadge } from "~/components/StatusBadge";
import { explorerLink } from "~/lib/solana";
import { humanAmount, shortDate, shortSig } from "~/lib/format";

/**
 * Server function backing the Tasks page. Graceful in demo mode: without
 * DATABASE_URL it returns an empty list plus an explanatory error string.
 */
const getTasks = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { tasks: await listTasks(), error: null };
  } catch (err) {
    return {
      tasks: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

export const Route = createFileRoute("/app/")({
  loader: () => getTasks(),
  component: TasksPage,
});

function TasksPage() {
  const { tasks, error } = Route.useLoaderData();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tasks</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every task you fund is escrowed and settled on-chain.
          </p>
        </div>
        <Link
          to="/app/new"
          className="rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          + New task
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
          Database not connected — showing demo state. Set{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
            DATABASE_URL
          </code>{" "}
          to persist tasks.
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/5 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Bounty</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tasks.map((t) => (
                <tr key={t.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/tasks/$taskId"
                      params={{ taskId: t.id }}
                      className="font-medium text-white hover:text-teal-300"
                    >
                      {String(t.title)}
                    </Link>
                    <div className="mt-0.5 max-w-[16rem] truncate text-xs text-slate-500">
                      {String(t.description || "")}
                    </div>
                    {t.deposit_sig && (
                      <a
                        href={explorerLink(String(t.deposit_sig))}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-block text-xs text-teal-400/80 hover:text-teal-300"
                        title={String(t.deposit_sig)}
                      >
                        ✓ funded — {shortSig(String(t.deposit_sig))}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{String(t.agent)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-200">
                      {humanAmount(t.amount_lamports, String(t.currency))}
                    </span>{" "}
                    <span className="text-xs text-slate-500">{String(t.currency)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={String(t.status)} />
                      {String(t.status) === "working" && (
                        <span
                          className="inline-block h-3 w-3 animate-spin rounded-full border border-indigo-300 border-t-transparent"
                          title="Agent is executing this task"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {shortDate(String(t.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
        📋
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">No tasks yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
        Create your first task, fund it with SOL or USDC, and an agent will pick
        it up — payment only moves when you approve the result.
      </p>
      <Link
        to="/app/new"
        className="mt-6 inline-block rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
      >
        Create your first task
      </Link>
    </div>
  );
}

export type { TaskRow };
