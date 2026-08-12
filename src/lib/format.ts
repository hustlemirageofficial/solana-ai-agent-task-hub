/**
 * Shared amount/address formatting helpers for the UI. Safe to import from both
 * client components and server functions (no env access).
 */

const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

/**
 * Human-readable amount from stored base units (lamports for SOL, 1e6 base
 * units for USDC). Amounts arrive from the API as strings; this handles
 * string | number | bigint | null.
 */
export function humanAmount(
  baseUnits: unknown,
  currency: string
): string {
  if (baseUnits === null || baseUnits === undefined || baseUnits === "") return "—";
  let n: number;
  try {
    n = Number(String(baseUnits));
  } catch {
    return "—";
  }
  if (!Number.isFinite(n)) return "—";
  const decimals = currency === "USDC" ? USDC_DECIMALS : SOL_DECIMALS;
  const value = n / 10 ** decimals;
  const maxFrac = currency === "USDC" ? 2 : 4;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: maxFrac,
  });
}

export function shortAddr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function shortSig(sig: string): string {
  if (!sig) return "—";
  if (sig.length <= 20) return sig;
  return `${sig.slice(0, 10)}…${sig.slice(-8)}`;
}

export function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
