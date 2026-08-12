import type { ReactNode } from "react";
import type { AgentResult } from "~/server/llm";

/**
 * Agent result viewer — renders { summary, content, steps } from the agent.
 *
 * SAFETY: agent output is untrusted text. Every string is rendered as a JSX
 * text node, which React escapes automatically — this file never uses
 * dangerouslySetInnerHTML and never interprets HTML from the agent. The
 * markdown-lite parser below only splits the escaped text into blocks
 * (paragraphs, bullet lines, numbered lines, fenced code blocks); it cannot
 * introduce markup. No heavy markdown dependency — plain, safe rendering.
 */

export function AgentResultView({ result }: { result: AgentResult }) {
  return (
    <div className="space-y-5">
      {result.demo === true && <DemoBadge />}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Summary
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
          {result.summary ?? ""}
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Agent output
        </h3>
        <div className="mt-1.5 space-y-3 text-sm leading-relaxed text-slate-300">
          {renderBlocks(result.content ?? "")}
        </div>
      </div>

      {Array.isArray(result.steps) && result.steps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Steps taken
          </h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            {result.steps.map((s, i) => (
              <li key={i}>{renderInline(String(s))}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Demo result
    </span>
  );
}

// ---------------------------------------------------------------------------
// Markdown-lite (safe): block splitting on RAW text, rendered as JSX text.
// ---------------------------------------------------------------------------

function renderBlocks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const blocks = text.split(/\n\s*\n/);

  blocks.forEach((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    const lines = block.split("\n").map((l) => l.trimEnd());
    const nonEmpty = lines.filter((l) => l.trim() !== "");

    // Fenced code block: ```lang\n…\n``` (possibly spanning the whole block).
    const fence = trimmed.match(/^```[\w-]*\s*\n?([\s\S]*?)```$/);
    if (fence) {
      out.push(<CodeBlock key={bi} code={fence[1]!.trim()} />);
      return;
    }
    // Stray opening fence — render the remainder as code.
    if (/^```/.test(trimmed)) {
      out.push(
        <CodeBlock
          key={bi}
          code={trimmed.replace(/^```[\w-]*/, "").replace(/```$/, "").trim()}
        />
      );
      return;
    }

    // Bullet list: every non-empty line starts with "- ", "* " or "• ".
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^[-*•]\s+/.test(l))) {
      out.push(
        <ul key={bi} className="list-disc space-y-1 pl-5">
          {nonEmpty.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^[-*•]\s+/, ""))}</li>
          ))}
        </ul>
      );
      return;
    }

    // Numbered list: every non-empty line starts with "1. " / "1) " etc.
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\d+[.)]\s+/.test(l))) {
      out.push(
        <ol key={bi} className="list-decimal space-y-1 pl-5">
          {nonEmpty.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^\d+[.)]\s+/, ""))}</li>
          ))}
        </ol>
      );
      return;
    }

    // Paragraph: join the block's lines with spaces.
    out.push(
      <p key={bi}>
        {nonEmpty.map((l, i) => (
          <span key={i}>
            {i > 0 ? " " : ""}
            {renderInline(l)}
          </span>
        ))}
      </p>
    );
  });

  return out;
}

/** Inline `` `code` `` spans (raw text in, JSX text out — React escapes). */
function renderInline(text: string): ReactNode[] {
  const parts = text.split("`");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-teal-200"
      >
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-200">
      {code}
    </pre>
  );
}
