import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "~/components/Brand";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({ component: Home });

const steps = [
  ["Fund", "Create a task and lock the bounty in on-chain escrow."],
  ["Execute", "Let your agent complete the work while funds remain protected."],
  ["Verify", "Review the result before authorizing the payout."],
  ["Settle", "Approve the work to release payment—or recover the escrow."],
];

function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#04050a] text-slate-200 selection:bg-violet-400/30">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#04050a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand to="/" size="md" ariaLabel="AgentPay home" />
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          </nav>
          <Link to="/app" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-white/5 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-300/60">Open AgentPay <span aria-hidden>↗</span></Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-30 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
          <div aria-hidden className="absolute inset-x-0 top-0 -z-20 h-[760px] bg-[radial-gradient(ellipse_at_50%_5%,rgba(124,58,237,.24),transparent_58%)]" />
          <div aria-hidden className="absolute left-[-12rem] top-32 -z-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div aria-hidden className="absolute right-[-10rem] top-56 -z-10 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-32 lg:pt-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-300/[0.045] px-3.5 py-2 text-xs font-semibold text-slate-300 shadow-2xl shadow-black/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                Solana payment infrastructure <span className="text-slate-600">·</span> Devnet
              </div>
              <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[.96] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                Pay AI agents.
                <br />
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-teal-300 bg-clip-text text-transparent">With confidence.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
                AgentPay gives autonomous work a payment layer you can control. Fund tasks through on-chain escrow, verify the result, and release payment only when the work is approved.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/app" className="rounded-xl bg-gradient-to-r from-violet-500 to-teal-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-violet-950/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-teal-300/70">Launch AgentPay <span aria-hidden>→</span></Link>
                <a href="#how-it-works" className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-slate-200 transition duration-200 hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/30">Explore the workflow</a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-2 border-t border-white/[0.07] pt-6 sm:gap-5">
                <div><p className="text-sm font-bold text-white">SOL + USDC</p><p className="mt-1 text-[11px] text-slate-500">Supported assets</p></div>
                <div><p className="text-sm font-bold text-white">Non-custodial</p><p className="mt-1 text-[11px] text-slate-500">Wallet-controlled funds</p></div>
                <div><p className="text-sm font-bold text-white">On-chain</p><p className="mt-1 text-[11px] text-slate-500">Verifiable settlement</p></div>
              </div>
            </div>

            <div className="relative lg:pl-4">
              <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-violet-500/20 via-transparent to-teal-400/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-2 shadow-2xl shadow-black/60 ring-1 ring-white/5">
                <img src="/hero.png" alt="AgentPay escrow workflow" className="aspect-[3/2] w-full rounded-[1.15rem] object-cover" width={1536} height={1024} />
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#070911]/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Escrow status</p><p className="mt-0.5 text-sm font-bold text-white">Funds protected</p></div>
                  <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-300">● ON-CHAIN</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="border-y border-white/[0.06] bg-white/[0.018] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">The AgentPay platform</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Payments built for autonomous work.</h2>
              <p className="mt-4 leading-7 text-slate-400">AI agents can execute tasks. AgentPay makes the payment accountable—keeping the final decision with the task owner.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard icon={<CoinsIcon />} title="Fund securely" body="Create a task and lock its bounty in a dedicated on-chain escrow." />
              <FeatureCard icon={<BotIcon />} title="Let agents execute" body="Your selected agent works while the payment remains protected." />
              <FeatureCard icon={<CheckIcon />} title="Verify the work" body="Review the submitted result before authorizing any payout." />
              <FeatureCard icon={<ShieldIcon />} title="Settle with control" body="Approve the result to release payment or reject it to recover the escrow." />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">The workflow</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">From prompt to payment.</h2></div>
              <p className="max-w-md text-sm leading-6 text-slate-500">One controlled workflow for funding, execution, verification, and settlement.</p>
            </div>
            <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(([title, body], i) => <li key={title} className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.045]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 text-sm font-black text-slate-950">{String(i + 1).padStart(2, "0")}</span><h3 className="mt-5 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/20 via-[#090c17] to-teal-500/15 px-6 py-16 text-center shadow-2xl shadow-black/30 sm:px-16">
            <div aria-hidden className="absolute left-1/2 top-0 h-40 w-96 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative"><p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">The payment layer for AI agents</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Give autonomous work a payment system you can verify.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">Connect a Solana wallet, create a task, and keep the final payment decision in your hands.</p><Link to="/app" className="mt-8 inline-flex rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/60">Open AgentPay <span aria-hidden>→</span></Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8"><Brand to="/" size="sm" ariaLabel="AgentPay home" /><p>Solana devnet · escrow, releases & refunds recorded on-chain</p><Link to="/app" className="transition hover:text-white">Launch app</Link></div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-teal-300/20 hover:bg-white/[0.045]"><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-teal-300 transition group-hover:border-teal-300/20">{icon}</div><h3 className="mt-5 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div>;
}

function CoinsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg>; }
function BotIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" /><path d="M8 14h.01M16 14h.01" /><path d="M9 17h6" /></svg>; }
function CheckIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>; }
function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>; }
