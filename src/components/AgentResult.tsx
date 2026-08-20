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
    <section className="relative isolate overflow-hidden rounded-[28px] border border-violet-400/25 bg-[#03040a] shadow-[0_0_90px_rgba(124,58,237,.12)]">
      <style>{`
        @keyframes ap-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ap-orbit-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes ap-scan { 0%,100% { opacity:.2; transform:translateY(-70px); } 50% { opacity:.7; transform:translateY(70px); } }
        @keyframes ap-pulse { 0%,100% { transform:scale(.96); opacity:.45; } 50% { transform:scale(1.04); opacity:.9; } }
        @keyframes ap-data { from { transform:translateX(-140%); } to { transform:translateX(260%); } }
        @keyframes ap-eye { 0%,46%,52%,100% { opacity:1; } 49% { opacity:.15; } }
        .ap-orbit { animation:ap-orbit 18s linear infinite; }
        .ap-orbit-r { animation:ap-orbit-reverse 13s linear infinite; }
        .ap-scan { animation:ap-scan 4s ease-in-out infinite; }
        .ap-pulse { animation:ap-pulse 2.8s ease-in-out infinite; }
        .ap-data { animation:ap-data 2.2s linear infinite; }
        .ap-eye { animation:ap-eye 5s steps(1) infinite; }
      `}</style>
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:30px_30px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,.20),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(20,184,166,.10),transparent_45%)]" />

      <div className="relative min-h-[430px] overflow-hidden p-5 sm:min-h-[500px] sm:p-7">
        <div className="absolute left-4 top-4 rounded-xl border border-teal-300/20 bg-black/60 px-3 py-2 backdrop-blur-md">
          <div className="text-[9px] font-semibold uppercase tracking-[.25em] text-teal-300/70">Solana link</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" /> DEVNET / ONLINE</div>
        </div>
        <div className="absolute right-4 top-4 rounded-xl border border-violet-300/20 bg-black/60 px-3 py-2 text-right backdrop-blur-md">
          <div className="text-[9px] font-semibold uppercase tracking-[.25em] text-violet-300/70">Settlement core</div>
          <div className="mt-1 font-mono text-[11px] text-slate-200">ESCROW PROTECTED</div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="ap-orbit absolute h-[340px] w-[340px] rounded-full border border-violet-400/15 sm:h-[400px] sm:w-[400px]" />
          <div className="ap-orbit-r absolute h-[270px] w-[270px] rounded-full border border-dashed border-teal-300/20 sm:h-[320px] sm:w-[320px]" />
          <div className="absolute h-[210px] w-[210px] rounded-full bg-violet-500/10 blur-3xl ap-pulse" />

          <div className="absolute h-px w-[82%] overflow-hidden bg-gradient-to-r from-transparent via-violet-300/30 to-transparent">
            <span className="ap-data block h-1 w-24 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-300 to-transparent blur-[1px]" />
          </div>
          <div className="absolute h-[82%] w-px overflow-hidden bg-gradient-to-b from-transparent via-teal-300/20 to-transparent">
            <span className="ap-data block h-24 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-violet-300 to-transparent blur-[1px]" />
          </div>

          <div className="relative h-[250px] w-[190px] [perspective:900px] sm:h-[300px] sm:w-[225px]">
            <div className="absolute left-1/2 top-1/2 h-[88%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-violet-500/10 blur-2xl ap-pulse" />
            <div className="absolute left-1/2 top-[10%] h-[31%] w-[62%] -translate-x-1/2 rounded-[35%_35%_28%_28%] border border-slate-400/60 bg-gradient-to-br from-slate-700 via-slate-950 to-black shadow-[inset_8px_8px_18px_rgba(255,255,255,.10),inset_-10px_-12px_24px_rgba(0,0,0,.8),0_0_30px_rgba(34,211,238,.12)] [transform:translateX(-50%)_rotateX(4deg)]">
              <div className="absolute left-1/2 top-[18%] h-[48%] w-[74%] -translate-x-1/2 rounded-[42%_42%_30%_30%] border border-cyan-200/20 bg-[#020617] shadow-[inset_0_0_22px_rgba(34,211,238,.12)]">
                <div className="ap-eye absolute left-[25%] top-[43%] h-2 w-7 rounded-full bg-cyan-200 shadow-[0_0_12px_#22d3ee]" />
                <div className="ap-eye absolute right-[25%] top-[43%] h-2 w-7 rounded-full bg-violet-200 shadow-[0_0_12px_#a78bfa]" />
                <div className="absolute bottom-[14%] left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-teal-300/80 shadow-[0_0_10px_#2dd4bf]" />
              </div>
              <div className="absolute left-1/2 top-[-13%] h-8 w-px -translate-x-1/2 bg-slate-500" />
              <div className="absolute left-1/2 top-[-18%] h-3 w-3 -translate-x-1/2 rounded-full bg-teal-300 shadow-[0_0_16px_#22d3ee]" />
            </div>

            <div className="absolute left-1/2 top-[39%] h-[45%] w-[76%] -translate-x-1/2 rounded-[28%_28%_18%_18%] border border-slate-500/70 bg-gradient-to-r from-slate-800 via-slate-950 to-slate-800 shadow-[inset_12px_0_24px_rgba(255,255,255,.05),inset_-14px_-12px_28px_rgba(0,0,0,.85)]">
              <div className="absolute left-1/2 top-[16%] h-[50%] w-[42%] -translate-x-1/2 rounded-2xl border border-violet-300/30 bg-black/70 shadow-[inset_0_0_22px_rgba(124,58,237,.20)]">
                <div className="absolute left-1/2 top-[22%] h-12 w-12 -translate-x-1/2 rounded-full border border-teal-300/50 bg-gradient-to-br from-violet-500/30 to-teal-300/10 shadow-[0_0_24px_rgba(45,212,191,.25)] ap-pulse" />
                <div className="absolute left-1/2 top-[39%] h-px w-20 -translate-x-1/2 bg-teal-300/50" />
                <div className="absolute left-1/2 top-[50%] h-px w-14 -translate-x-1/2 bg-violet-300/50" />
                <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-[.2em] text-teal-300">AGENT CORE</div>
              </div>
              <div className="ap-scan absolute left-[8%] right-[8%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
            </div>

            <div className="absolute left-[4%] top-[45%] h-[35%] w-[19%] rounded-[45%] border border-slate-500/60 bg-gradient-to-b from-slate-700 to-black shadow-[inset_4px_0_8px_rgba(255,255,255,.05)] [transform:rotate(10deg)]" />
            <div className="absolute right-[4%] top-[45%] h-[35%] w-[19%] rounded-[45%] border border-slate-500/60 bg-gradient-to-b from-slate-700 to-black shadow-[inset_-4px_0_8px_rgba(255,255,255,.05)] [transform:rotate(-10deg)]" />
            <div className="absolute left-[27%] bottom-[2%] h-[28%] w-[20%] rounded-[40%_40%_25%_25%] border border-slate-500/60 bg-gradient-to-b from-slate-700 to-black" />
            <div className="absolute right-[27%] bottom-[2%] h-[28%] w-[20%] rounded-[40%_40%_25%_25%] border border-slate-500/60 bg-gradient-to-b from-slate-700 to-black" />
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 w-[calc(100%-40px)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-black/65 px-4 py-3 text-center backdrop-blur-xl">
          <div className="text-[9px] font-semibold uppercase tracking-[.3em] text-violet-300/70">AgentPay autonomous core</div>
          <div className="mt-1 text-sm font-semibold text-white">CYBERPUNK AGENT ONLINE</div>
          <div className="mt-1 flex items-center justify-center gap-2 font-mono text-[10px] text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" /> WALLET → ESCROW → AGENT → OWNER</div>
        </div>
      </div>
    </section>
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
