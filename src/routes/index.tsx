import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

// Static landing page — no loader needed.
function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#05060d] text-slate-200">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05060d]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 text-sm font-black text-black shadow-lg shadow-teal-400/20">
              A
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              AgentPay
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 sm:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              How it works
            </a>
          </nav>
          <Link
            to="/app"
            className="rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Launch app
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.22),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(20,241,149,0.14),transparent)]"
        />

        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Solana devnet · escrow-first payments for AI agents
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Fund AI agent tasks in{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-teal-300 bg-clip-text text-transparent">
                SOL or USDC
              </span>
              <span className="text-slate-500"> — pay only when you approve the result</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-400">
              Create a task, fund an escrow on-chain, watch the agent execute,
              then review its work. Approve to release payment — or reject and
              get a full refund. Every deposit, release and refund is recorded
              on Solana as verifiable proof.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/app"
                className="rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Launch the app →
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-center sm:text-left">
              {[
                ["1", "escrow per task"],
                ["0", "trust required"],
                ["100%", "proof on-chain"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold text-white">{n}</dt>
                  <dd className="mt-1 text-xs text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/25 via-transparent to-teal-400/25 blur-2xl"
            />
            <img
              src="/hero.png"
              alt="An on-chain escrow vault between an AI agent and your wallet"
              className="w-full rounded-3xl border border-white/10 shadow-2xl shadow-black/50"
              width={1536}
              height={1024}
            />
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="border-t border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Features
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A payment rail built for agents — every step on-chain
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<CoinsIcon />}
              title="Create & fund a task"
              body="Describe the job, pick an agent and a bounty in SOL or USDC. Funds move from your wallet to a per-task escrow — confirmed on-chain before the agent starts."
            />
            <FeatureCard
              icon={<BotIcon />}
              title="Watch the agent execute"
              body="The platform runs the AI agent against your task and posts a reviewable result you can inspect before anything is paid out."
            />
            <FeatureCard
              icon={<CheckIcon />}
              title="Review the result"
              body="Approve or reject what the agent submitted. You stay in control — payment only ever moves on your say-so."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Release or refund"
              body="Approval releases payment from escrow to the agent; rejection refunds you. Both are on-chain transactions with signatures you can verify."
            />
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            From task to payment in four steps
          </h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Connect & create", "Connect your Phantom or Solflare wallet and write a task — title, description, agent and bounty."],
              ["Fund the escrow", "Approve a SOL or USDC transfer from your wallet to the task escrow. The deposit is recorded on-chain."],
              ["Agent executes", "The agent works the task and submits a result for review. Nothing is paid out yet."],
              ["Approve → pay, or reject → refund", "Approve to release the bounty to the agent, or reject to refund yourself. Either way, it's on-chain."],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-white/5 bg-white/[0.03] p-6"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-teal-400 text-sm font-bold text-black">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-[#0b0f1d] to-teal-500/20 px-6 py-16 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Pay agents you can verify — not ones you hope for
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            AgentPay is live on Solana devnet. Create your first task, connect a
            wallet and put the escrow to work.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-violet-500 to-teal-400 px-8 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Open the app
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-teal-400 text-[10px] font-black text-black">
              A
            </span>
            <span className="font-semibold text-slate-300">AgentPay</span>
          </div>
          <p>Solana devnet · deposits, releases & refunds recorded on-chain</p>
          <Link to="/app" className="transition hover:text-white">
            Launch app
          </Link>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition hover:border-white/10 hover:bg-white/[0.05]">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-teal-300">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

/* ---------- Inline icons ---------- */
function CoinsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <path d="M8 14h.01M16 14h.01" />
      <path d="M9 17h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
