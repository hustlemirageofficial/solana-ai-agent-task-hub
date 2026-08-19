import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { listTasks, type TaskRow } from "~/server/tasks";
import { StatusBadge } from "~/components/StatusBadge";
import { explorerLink } from "~/lib/solana";
import { humanAmount, shortDate, shortSig } from "~/lib/format";

const getTasks = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { tasks: await listTasks(), error: null };
  } catch (err) {
    return { tasks: [], error: err instanceof Error ? err.message : String(err) };
  }
});

export const Route = createFileRoute("/app/")({ loader: () => getTasks(), component: TasksPage });

function TasksPage() {
  const { tasks, error } = Route.useLoaderData();
  const active = tasks.filter((t) => ["funded", "working", "submitted", "review"].includes(String(t.status))).length;
  const locked = tasks.filter((t) => ["funded", "working", "submitted", "review"].includes(String(t.status))).reduce((sum, t) => sum + Number(t.amount_lamports || 0), 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#06101b] p-6 sm:p-8">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(124,58,237,.12),transparent_32%),radial-gradient(circle_at_20%_100%,rgba(20,241,149,.055),transparent_35%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.24em] text-slate-500">AGENT-PAY WORKSPACE</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">Task control.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Create autonomous work, keep the bounty protected, and review every settlement decision from one controlled workspace.</p>
          </div>
          <Link to="/app/new" className="inline-flex w-fit items-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100">Create task <span className="ml-2">→</span></Link>
        </div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Active tasks" value={String(active).padStart(2, "0")} />
          <Metric label="Protected balance" value={locked ? `${(locked / 1_000_000_000).toFixed(2)} SOL` : "—"} />
          <Metric label="Settlement" value="Owner controlled" />
        </div>
      </section>

      {error && <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.05] px-4 py-3 text-sm text-amber-300">Database connection is not active yet. Tasks remain in a safe empty/demo state until <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">DATABASE_URL</code> is configured.</div>}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-slate-600">WORK QUEUE</p><h2 className="mt-2 text-lg font-bold text-white">Your tasks</h2></div>
          <span className="rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">On-chain settlement</span>
        </div>

        {tasks.length === 0 ? <EmptyState /> : <div className="mt-5 overflow-hidden rounded-2xl border border-white/[.08] bg-[#06101b]/70">
          <div className="hidden grid-cols-[minmax(260px,1.6fr)_1fr_1fr_1fr_110px] gap-4 border-b border-white/[.07] bg-white/[.025] px-5 py-3 text-[9px] font-bold uppercase tracking-[.18em] text-slate-600 md:grid"><span>Task</span><span>Agent</span><span>Bounty</span><span>Status</span><span>Created</span></div>
          <div className="divide-y divide-white/[.06]">{tasks.map((t) => <TaskRowView key={t.id} task={t} />)}</div>
        </div>}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-black/[.18] px-4 py-4"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-600">{label}</p><p className="mt-2 text-sm font-bold text-slate-200">{value}</p></div>;
}

function TaskRowView({ task: t }: { task: TaskRow }) {
  const status = String(t.status);
  return <Link to="/app/tasks/$taskId" params={{ taskId: t.id }} className="group block px-5 py-4 transition hover:bg-white/[.025]">
    <div className="grid gap-4 md:grid-cols-[minmax(260px,1.6fr)_1fr_1fr_1fr_110px] md:items-center">
      <div className="min-w-0"><div className="flex items-center gap-3"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300/70 shadow-[0_0_10px_rgba(196,181,253,.35)]" /><p className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">{String(t.title)}</p></div><p className="mt-1 truncate pl-[18px] text-xs text-slate-500">{String(t.description || "No description provided")}</p>{t.deposit_sig && <a href={explorerLink(String(t.deposit_sig))} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-block pl-[18px] text-[10px] font-semibold text-teal-400/80 hover:text-teal-300">✓ funded · {shortSig(String(t.deposit_sig))}</a>}</div>
      <div className="text-xs text-slate-400 md:text-sm">{String(t.agent)}</div>
      <div><span className="font-mono text-sm text-slate-200">{humanAmount(t.amount_lamports, String(t.currency))}</span> <span className="text-[10px] text-slate-600">{String(t.currency)}</span></div>
      <div className="flex items-center gap-2"><StatusBadge status={status} />{status === "working" && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.55)]" />}</div>
      <div className="text-xs text-slate-600 md:text-right">{shortDate(String(t.created_at))}</div>
    </div>
  </Link>;
}

function EmptyState() {
  return <div className="mt-5 rounded-2xl border border-dashed border-white/[.1] bg-white/[.015] px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-300/[.04] text-violet-200">＋</div><p className="mt-5 text-sm font-bold text-slate-200">No tasks yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create your first task, set a bounty, and keep the payment protected until the result is approved.</p><Link to="/app/new" className="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100">Create your first task <span className="ml-2">→</span></Link></div>;
}

export type { TaskRow };
