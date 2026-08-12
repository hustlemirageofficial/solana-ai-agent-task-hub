import { sql } from "~/db";

/**
 * AgentPay schema. Applied idempotently at server boot (serve.ts) and lazily
 * before any DB-backed API call, but ONLY when DATABASE_URL is set — the server
 * must boot and serve the whole app in demo mode without a database.
 *
 * Each statement runs separately: the Neon serverless driver executes one
 * statement per query, so multi-statement strings would silently fail.
 */
const STATEMENTS = [
  `create table if not exists tasks (
    id              text primary key,
    title           text not null,
    description     text not null default '',
    agent           text not null,
    currency        text not null default 'SOL' check (currency in ('SOL','USDC')),
    amount_lamports numeric not null default 0,
    status          text not null default 'draft'
                    check (status in ('draft','funding','funded','working',
                                      'awaiting_review','approved','rejected',
                                      'refunded','cancelled')),
    funder          text,
    escrow          text,
    deposit_sig     text,
    result          text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
  )`,
  `create table if not exists txns (
    id              text primary key,
    task_id         text not null references tasks(id) on delete cascade,
    kind            text not null check (kind in ('deposit','release','refund')),
    currency        text not null default 'SOL' check (currency in ('SOL','USDC')),
    amount_lamports numeric not null default 0,
    from_addr       text,
    to_addr         text,
    signature       text,
    confirmed       boolean not null default false,
    created_at      timestamptz not null default now()
  )`,
  `create index if not exists idx_tasks_created_at on tasks (created_at desc)`,
  `create index if not exists idx_txns_task_id on txns (task_id)`,
  // Payout/refund bookkeeping — added idempotently so existing databases
  // (created before the release milestone) pick them up on the next boot.
  `alter table tasks add column if not exists release_sig text`,
  `alter table tasks add column if not exists refund_sig text`,
  `alter table tasks add column if not exists payout_error text`,
  // A signature can only ever be recorded once (idempotent deposits). NULLs are
  // allowed to repeat — release/refund rows may not have a signature yet.
  `create unique index if not exists uq_txns_signature on txns (signature)`,
];

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotent schema setup. Resolves immediately when DATABASE_URL is absent so
 * boot never fails; a failed run is re-attempted on the next call.
 */
export function ensureSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) return Promise.resolve();
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = sql();
      for (const stmt of STATEMENTS) {
        // Neon's driver rejects plain-string calls — use .query() for
        // function-style statements (tagged templates don't fit this loop).
        await db.query(stmt);
      }
    })().catch((err: unknown) => {
      ensurePromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return ensurePromise;
}
