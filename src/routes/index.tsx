import { createFileRoute, Link } from "@tanstack/react-router";

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
              <LiveEscrowPreview />
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

function LiveEscrowPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050b15]/95 p-4 shadow-2xl shadow-black/60 ring-1 ring-violet-400/[0.08] sm:p-5">
      <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Escrow flow</p><p className="mt-1 text-sm font-bold text-white">Autonomous task #042</p></div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-300/[0.06] px-2.5 py-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Live preview</span></div>
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Bounty</p><p className="mt-1 text-2xl font-black tracking-tight text-white">2.50 <span className="text-sm font-bold text-slate-400">SOL</span></p></div><span className="text-[10px] font-semibold text-slate-500">ESCROWED</span></div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full w-[76%] rounded-full bg-gradient-to-r from-violet-400 to-emerald-300" /></div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>Protected</span><span>76%</span></div>
        </div>

        <div className="mt-5 space-y-3">
          <FlowRow number="01" title="Funds locked" detail="Escrow secured" state="complete" />
          <FlowRow number="02" title="Agent executing" detail="Task in progress" state="active" />
          <FlowRow number="03" title="Result verification" detail="Awaiting approval" state="pending" />
          <FlowRow number="04" title="Payment release" detail="Owner controlled" state="pending" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4"><span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Solana devnet</span><span className="font-mono text-[10px] text-slate-500">7xK9...P4mQ</span></div>
      </div>
    </div>
  );
}

function FlowRow({ number, title, detail, state }: { number: string; title: string; detail: string; state: "complete" | "active" | "pending" }) {
  const active = state === "active";
  const complete = state === "complete";
  return <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${active ? "border-violet-300/20 bg-violet-300/[0.045]" : "border-white/[0.06] bg-white/[0.018]"}`}><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-black ${complete ? "bg-emerald-300/10 text-emerald-300" : active ? "bg-violet-300/10 text-violet-200" : "bg-white/[0.05] text-slate-500"}`}>{complete ? "✓" : number}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{title}</p><p className="mt-0.5 text-[10px] text-slate-500">{detail}</p></div>{active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />}{complete && <span className="text-[10px] font-semibold text-emerald-300">DONE</span>}</div>;
}

function FeatureCard({ index, title, body }: { index: string; title: string; body: string }) { return <article className="group border-b border-white/[0.07] p-6 last:border-b-0 sm:p-7 lg:border-b-0 lg:border-r lg:last:border-r-0"><p className="text-xs font-bold tracking-[0.18em] text-violet-300">{index}</p><h3 className="mt-7 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>; }
