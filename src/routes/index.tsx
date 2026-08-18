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
    <div className="min-h-dvh overflow-x-clip bg-[#030711] text-slate-200 selection:bg-violet-400/30">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030711]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-[15px] font-black tracking-[0.18em] text-white" aria-label="AGENT-PAY home">AGENT<span className="mx-1 text-violet-300">-</span>PAY</Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          </nav>
          <Link to="/app" className="rounded-lg border border-white/10 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition duration-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-300/60">Open AGENT-PAY <span aria-hidden>↗</span></Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
          <div aria-hidden className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,.12),transparent_30%),radial-gradient(circle_at_82%_30%,rgba(20,241,149,.09),transparent_28%),linear-gradient(180deg,#030711_0%,#050a17_55%,#030711_100%)]" />
          <div aria-hidden className="absolute inset-0 -z-20 opacity-40 [background-image:linear-gradient(rgba(148,163,184,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.045)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-32 lg:pt-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">SOLANA PAYMENT INFRASTRUCTURE · DEVNET</p>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">Pay AI agents.<br /><span className="text-slate-300">With confidence.</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">AGENT-PAY gives autonomous work a payment layer you can control. Fund tasks through on-chain escrow, verify the result, and release payment only when the work is approved.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/app" className="rounded-lg bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/50">Launch AGENT-PAY <span aria-hidden>→</span></Link>
                <a href="#how-it-works" className="rounded-lg border border-white/10 bg-white/[0.035] px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]">Explore the workflow</a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-2 border-t border-white/[0.08] pt-6 sm:gap-5">
                <div><p className="text-sm font-bold text-white">SOL + USDC</p><p className="mt-1 text-[11px] text-slate-500">Supported assets</p></div>
                <div><p className="text-sm font-bold text-white">Non-custodial</p><p className="mt-1 text-[11px] text-slate-500">Wallet-controlled funds</p></div>
                <div><p className="text-sm font-bold text-white">On-chain</p><p className="mt-1 text-[11px] text-slate-500">Verifiable settlement</p></div>
              </div>
            </div>

            <div className="relative lg:pl-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07101c]/75 p-2 shadow-2xl shadow-black/60 ring-1 ring-violet-400/[0.08]">
                <img src="/hero.png" alt="AGENT-PAY escrow workflow" className="aspect-[3/2] w-full rounded-xl object-cover" width={1536} height={1024} />
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#050a13]/94 px-4 py-3 shadow-2xl backdrop-blur-xl">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Escrow status</p><p className="mt-0.5 text-sm font-bold text-white">Funds protected</p></div>
                  <span className="shrink-0 rounded-md border border-emerald-300/10 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-300">ON-CHAIN</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="relative border-b border-white/[0.06] py-20 sm:py-24">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,.08),transparent_42%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">THE AGENT-PAY PLATFORM</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Payments built for autonomous work.</h2><p className="mt-4 leading-7 text-slate-400">AI agents can execute tasks. AGENT-PAY makes the payment accountable—keeping the final decision with the task owner.</p></div>
            <div className="mt-12 grid overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101b]/55 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard index="01" title="Fund securely" body="Create a task and lock its bounty in a dedicated on-chain escrow." />
              <FeatureCard index="02" title="Let agents execute" body="Your selected agent works while the payment remains protected." />
              <FeatureCard index="03" title="Verify the work" body="Review the submitted result before authorizing any payout." />
              <FeatureCard index="04" title="Settle with control" body="Approve the result to release payment or reject it to recover the escrow." />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="relative py-20 sm:py-24">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_50%,rgba(20,241,149,.055),transparent_30%),radial-gradient(circle_at_80%_50%,rgba(124,58,237,.06),transparent_30%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">THE WORKFLOW</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">From prompt to payment.</h2></div><p className="max-w-md text-sm leading-6 text-slate-500">One controlled workflow for funding, execution, verification, and settlement.</p></div>
            <ol className="mt-12 grid overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101b]/55 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(([title, body], i) => <li key={title} className="border-b border-white/[0.07] p-6 transition hover:bg-white/[0.025] md:nth-[odd]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"><span className="text-xs font-bold tracking-[0.18em] text-violet-300">{String(i + 1).padStart(2, "0")}</span><h3 className="mt-7 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07101b]/80 px-6 py-16 text-center shadow-2xl shadow-black/30 sm:px-16"><div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,.12),transparent_50%),radial-gradient(circle_at_50%_100%,rgba(20,241,149,.07),transparent_45%)]" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">THE PAYMENT LAYER FOR AI AGENTS</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Give autonomous work a payment system you can verify.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">Connect a Solana wallet, create a task, and keep the final payment decision in your hands.</p><Link to="/app" className="mt-8 inline-flex rounded-lg bg-white px-7 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/50">Open AGENT-PAY <span aria-hidden>→</span></Link></div></div></section>
      </main>

      <footer className="border-t border-white/[0.06] py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8"><Link to="/" className="text-[13px] font-black tracking-[0.16em] text-white" aria-label="AGENT-PAY home">AGENT<span className="mx-1 text-violet-300">-</span>PAY</Link><p>Solana devnet · escrow, releases & refunds recorded on-chain</p><Link to="/app" className="transition hover:text-white">Launch app</Link></div></footer>
    </div>
  );
}

function FeatureCard({ index, title, body }: { index: string; title: string; body: string }) { return <article className="group border-b border-white/[0.07] p-6 last:border-b-0 sm:p-7 lg:border-b-0 lg:border-r lg:last:border-r-0"><p className="text-xs font-bold tracking-[0.18em] text-violet-300">{index}</p><h3 className="mt-7 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>; }
