import type { ReactNode } from "react";
import type { AgentResult } from "~/server/llm";

export function AgentResultView({ result }: { result: AgentResult }) {
  return (
    <div className="space-y-5">
      <CyberpunkAgentViz />
      {result.demo === true && <DemoBadge />}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{result.summary ?? ""}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agent output</h3>
        <div className="mt-1.5 space-y-3 text-sm leading-relaxed text-slate-300">
          {renderBlocks(result.content ?? "")}
        </div>
      </div>

      {Array.isArray(result.steps) && result.steps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Steps taken</h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            {result.steps.map((s, i) => <li key={i}>{renderInline(String(s))}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function CyberpunkAgentViz() {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,.18),transparent_35%),linear-gradient(135deg,#070711,#03040a)] p-4 shadow-[0_0_60px_rgba(124,58,237,.08)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative mx-auto flex min-h-[360px] max-w-3xl items-center justify-center">
        <div className="absolute h-64 w-64 animate-spin rounded-full border border-violet-400/10 [animation-duration:18s]" />
        <div className="absolute h-48 w-48 animate-spin rounded-full border border-teal-300/15 border-dashed [animation-direction:reverse] [animation-duration:12s]" />

        <div className="absolute left-2 top-8 rounded-xl border border-teal-300/20 bg-black/50 px-3 py-2 backdrop-blur sm:left-8">
          <div className="text-[10px] uppercase tracking-[.2em] text-teal-300/70">Wallet</div>
          <div className="mt-1 font-mono text-xs text-slate-200">CONNECTED</div>
        </div>
        <div className="absolute right-2 top-8 rounded-xl border border-violet-300/20 bg-black/50 px-3 py-2 backdrop-blur sm:right-8">
          <div className="text-[10px] uppercase tracking-[.2em] text-violet-300/70">Escrow</div>
          <div className="mt-1 font-mono text-xs text-slate-200">PROTECTED</div>
        </div>
        <div className="absolute bottom-8 left-2 rounded-xl border border-cyan-300/20 bg-black/50 px-3 py-2 backdrop-blur sm:left-8">
          <div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">Solana</div>
          <div className="mt-1 font-mono text-xs text-slate-200">ON-CHAIN</div>
        </div>
        <div className="absolute bottom-8 right-2 rounded-xl border border-emerald-300/20 bg-black/50 px-3 py-2 backdrop-blur sm:right-8">
          <div className="text-[10px] uppercase tracking-[.2em] text-emerald-300/70">Agent</div>
          <div className="mt-1 font-mono text-xs text-slate-200">ACTIVE CORE</div>
        </div>

        <div className="absolute h-72 w-72 animate-pulse rounded-full bg-violet-500/5 blur-2xl" />
        <div className="relative flex h-48 w-40 items-center justify-center drop-shadow-[0_0_28px_rgba(45,212,191,.22)]">
          <svg viewBox="0 0 160 220" className="h-full w-full" role="img" aria-label="Cyberpunk AI agent">
            <defs>
              <linearGradient id="robotMetal" x1="0" x2="1">
                <stop offset="0" stopColor="#111827" />
                <stop offset=".5" stopColor="#475569" />
                <stop offset="1" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="robotGlow" x1="0" x2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset=".5" stopColor="#a78bfa" />
                <stop offset="1" stopColor="#2dd4bf" />
              </linearGradient>
              <filter id="softGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <path d="M43 78 L31 94 L36 142 L52 151 L108 151 L124 142 L129 94 L117 78" fill="url(#robotMetal)" stroke="#64748b" strokeWidth="2" />
            <path d="M52 54 Q80 34 108 54 L113 91 Q80 106 47 91 Z" fill="#0b1120" stroke="url(#robotGlow)" strokeWidth="3" filter="url(#softGlow)" />
            <path d="M58 67 L70 62 L75 75 L62 80 Z M102 67 L90 62 L85 75 L98 80 Z" fill="#020617" stroke="#22d3ee" strokeWidth="2" />
            <circle cx="66" cy="71" r="3" fill="#67e8f9" filter="url(#softGlow)" />
            <circle cx="94" cy="71" r="3" fill="#a78bfa" filter="url(#softGlow)" />
            <path d="M68 88 Q80 94 92 88" fill="none" stroke="#2dd4bf" strokeWidth="2" />
            <path d="M55 107 L80 116 L105 107 L99 143 L80 151 L61 143 Z" fill="#111827" stroke="#475569" strokeWidth="2" />
            <path d="M68 118 H92 M66 128 H94 M70 138 H90" stroke="url(#robotGlow)" strokeWidth="2" strokeLinecap="round" />
            <path d="M31 101 L17 112 L24 145 L39 138 M129 101 L143 112 L136 145 L121 138" fill="url(#robotMetal)" stroke="#64748b" strokeWidth="2" />
            <path d="M55 151 L48 181 L61 202 L74 181 L80 154 L86 181 L99 202 L112 181 L105 151" fill="url(#robotMetal)" stroke="#64748b" strokeWidth="2" />
            <path d="M80 42 V28" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="80" cy="23" r="5" fill="#22d3ee" filter="url(#softGlow)" />
            <path d="M41 95 H24 M119 95 H136 M50 159 H34 M110 159 H126" stroke="#22d3ee" strokeWidth="1" opacity=".8" />
          </svg>
        </div>

        <div className="absolute inset-x-12 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-300/40 to-transparent" />
        <div className="absolute inset-x-1/2 top-10 h-[calc(100%-80px)] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-teal-300/20 to-transparent" />
      </div>
      <div className="relative mt-2 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] uppercase tracking-[.2em] text-slate-500">
        <span>AgentPay neural settlement layer</span>
        <span className="flex items-center gap-1.5 text-teal-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" /> LIVE</span>
      </div>
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Demo result
    </span>
  );
}

function renderBlocks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  for (const [bi, block] of text.split(/\n\s*\n/).entries()) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = block.split("\n").map((l) => l.trimEnd());
    const nonEmpty = lines.filter((l) => l.trim() !== "");
    const fence = trimmed.match(/^```[\w-]*\s*\n?([\s\S]*?)```$/);
    if (fence) { out.push(<CodeBlock key={bi} code={fence[1]!.trim()} />); continue; }
    if (/^```/.test(trimmed)) { out.push(<CodeBlock key={bi} code={trimmed.replace(/^```[\w-]*/, "").replace(/```$/, "").trim()} />); continue; }
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^[-*•]\s+/.test(l))) {
      out.push(<ul key={bi} className="list-disc space-y-1 pl-5">{nonEmpty.map((l, i) => <li key={i}>{renderInline(l.replace(/^[-*•]\s+/, ""))}</li>)}</ul>); continue;
    }
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\d+[.)]\s+/.test(l))) {
      out.push(<ol key={bi} className="list-decimal space-y-1 pl-5">{nonEmpty.map((l, i) => <li key={i}>{renderInline(l.replace(/^\d+[.)]\s+/, ""))}</li>)}</ol>); continue;
    }
    out.push(<p key={bi}>{nonEmpty.map((l, i) => <span key={i}>{i > 0 ? " " : ""}{renderInline(l)}</span>)}</p>);
  }
  return out;
}

function renderInline(text: string): ReactNode[] {
  return text.split("`").map((part, i) => i % 2 === 1 ? <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-teal-200">{part}</code> : <span key={i}>{part}</span>);
}

function CodeBlock({ code }: { code: string }) {
  return <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-200">{code}</pre>;
}
