import { Link } from "@tanstack/react-router";
import { useId } from "react";

/**
 * AgentPay brand — logo mark + wordmark, centralized.
 *
 * Purely presentational (no business logic): renders the geometric logo mark
 * (gradient escrow tile with an approval check + payment dot) beside the
 * two-weight wordmark ("Agent" bold / "Pay" lighter). Dependency-free SVG.
 *
 * Usage:
 *   <Brand to="/" size="md" />            → clickable wordmark+logo (SPA link)
 *   <Brand size="sm" />                   → inline wordmark+logo
 *   <Brand showWordmark={false} />        → logo mark only (favicon/app-icon style)
 *   <Brand href="/" tone="light" />       → full-page link, light-background variant
 */

export type BrandSize = "sm" | "md" | "lg";
export type BrandTone = "dark" | "light";

const MARK_SIZE: Record<BrandSize, string> = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-11 w-11",
};

const WORDMARK_SIZE: Record<BrandSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const GAP: Record<BrandSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

export interface BrandProps {
  /** Mark + wordmark size. Defaults to "md" (navbar). */
  size?: BrandSize;
  /** "dark" (default) for dark surfaces, "light" for light surfaces. */
  tone?: BrandTone;
  /** Render the wordmark next to the mark. Defaults to true. */
  showWordmark?: boolean;
  /** Render as an SPA link (client-side navigation). */
  to?: string;
  /** Render as a plain anchor. */
  href?: string;
  /** Extra classes on the root element. */
  className?: string;
  /** Accessible label; defaults to "AgentPay" (or the wordmark text). */
  ariaLabel?: string;
}

/** Geometric logo mark — standalone SVG, works at favicon size too. */
export function LogoMark({
  size = "md",
  ariaLabel = "AgentPay",
  decorative = false,
  className = "",
}: {
  size?: BrandSize;
  ariaLabel?: string;
  /** Hide from assistive tech — use when the wordmark already names the brand. */
  decorative?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative || undefined}
      focusable="false"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      className={`${MARK_SIZE[size]} ${className}`}
    >
      {!decorative && <title>{ariaLabel}</title>}
      <defs>
        <linearGradient
          id={`ap-${uid}-tile`}
          x1="3"
          y1="2"
          x2="29"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      {/* Escrow tile */}
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill={`url(#ap-${uid}-tile)`}
      />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.25"
      />
      {/* Approval check */}
      <path
        d="M8.75 16.9 L13.9 22.05 L23.75 10.35"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Payment dot */}
      <circle cx="26.6" cy="5.8" r="2" fill="#FFFFFF" />
    </svg>
  );
}

/** Two-weight wordmark: "Agent" bold, "Pay" lighter + slightly muted. */
function Wordmark({ size, tone }: { size: BrandSize; tone: BrandTone }) {
  const agentCls = tone === "dark" ? "text-white" : "text-slate-900";
  const payCls = tone === "dark" ? "text-white/75" : "text-slate-900/60";
  return (
    <span
      className={`${WORDMARK_SIZE[size]} font-sans font-extrabold leading-tight tracking-[-0.02em] ${agentCls}`}
    >
      Agent
      <span className={`font-semibold ${payCls}`}>Pay</span>
    </span>
  );
}

export function Brand({
  size = "md",
  tone = "dark",
  showWordmark = true,
  to,
  href,
  className = "",
  ariaLabel,
}: BrandProps) {
  const label = ariaLabel ?? (showWordmark ? undefined : "AgentPay");
  const content = showWordmark ? (
    <>
      <LogoMark size={size} decorative className="shrink-0" ariaLabel={label} />
      <Wordmark size={size} tone={tone} />
    </>
  ) : (
    <LogoMark size={size} ariaLabel={label ?? "AgentPay"} className="shrink-0" />
  );
  const rootCls = `inline-flex shrink-0 items-center ${GAP[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={rootCls} aria-label={label}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={rootCls} aria-label={label}>
        {content}
      </a>
    );
  }
  return <span className={rootCls}>{content}</span>;
}
