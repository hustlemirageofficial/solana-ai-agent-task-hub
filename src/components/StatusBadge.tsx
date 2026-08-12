/**
 * Shared status / kind badges used across the app (task list, task detail,
 * history).
 */

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-300",
  funding: "bg-amber-400/15 text-amber-300",
  funded: "bg-blue-400/15 text-blue-300",
  working: "bg-indigo-400/15 text-indigo-300",
  awaiting_review: "bg-purple-400/15 text-purple-300",
  approved: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-rose-400/15 text-rose-300",
  refunded: "bg-teal-400/15 text-teal-300",
  cancelled: "bg-slate-500/15 text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const KIND_STYLES: Record<string, string> = {
  deposit: "bg-blue-400/15 text-blue-300",
  release: "bg-emerald-400/15 text-emerald-300",
  refund: "bg-rose-400/15 text-rose-300",
};

export function KindBadge({ kind }: { kind: string }) {
  const cls = KIND_STYLES[kind] ?? "bg-slate-500/15 text-slate-300";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {kind}
    </span>
  );
}
