import type { Wallet } from "@solana/wallet-adapter-react";

/**
 * Pure helpers for the Connect Wallet dropdown.
 *
 * Extracted into a module with no React / wallet-adapter runtime imports so the
 * crash-safety logic is unit-testable (`scripts/verify-wallet-ui.ts`) without
 * mounting the adapter tree.
 */

export type BridgeWallet = { name: string; readyState: string };

/**
 * Actual `name` of UnsafeBurnerWalletAdapter (`UnsafeBurnerWalletName` export
 * in @solana/wallet-adapter-unsafe-burner). The devnet-only burner wallet.
 * NOTE: older code compared against the literal "Unsafe Burner Wallet", which
 * never matched this real adapter name — that special-casing was dead code.
 */
export const BURNER_WALLET_NAME = "Burner Wallet";

/** First letter of a wallet name; "?" when the name is missing/empty. */
export function walletInitial(name: string | undefined | null): string {
  if (!name) return "?";
  if (name === BURNER_WALLET_NAME) return "B";
  return name.charAt(0).toUpperCase();
}

/** Human label for a wallet; "Wallet" when the name is missing/empty. */
export function walletLabel(name: string | undefined | null): string {
  if (!name) return "Wallet";
  if (name === BURNER_WALLET_NAME) return "Devnet burner wallet";
  return name;
}

/**
 * Normalize `useWallet().wallets` for the dropdown UI.
 *
 * Root-cause note: wallet-adapter-react's `Wallet` entries are shaped
 * `{ adapter, readyState }` — the display name lives on `adapter.name`, NOT on
 * the entry itself. Reading `w.name` is therefore ALWAYS `undefined`, which
 * crashed the dropdown in `initial()` (`name.charAt(0)`) on every browser —
 * first reported on iPhone Safari. See WalletProviderBase in
 * @solana/wallet-adapter-react v0.15.39 (`wallets` is
 * `adapters.map((adapter) => ({ adapter, readyState }))`).
 *
 * We also defensively drop entries with no usable adapter/name (malformed
 * dynamically-registered standard-wallet entries can surface without one) and
 * normalize every shown entry to non-empty strings so the UI can never render
 * `undefined` names or readyStates.
 */
export function normalizeBridgeWallets(
  wallets: Wallet[],
  isDevnet: boolean,
): BridgeWallet[] {
  return wallets
    .filter(
      (w) =>
        !!w.adapter &&
        typeof w.adapter.name === "string" &&
        w.adapter.name.trim().length > 0,
    )
    .filter((w) => w.adapter.name !== BURNER_WALLET_NAME || isDevnet)
    .map((w) => ({
      name: w.adapter.name.trim() || "Wallet",
      readyState: w.readyState ?? "NotDetected",
    }));
}

/** True on iPhone/iPad/iPod or Android mobile browsers (no wallet extensions). */
export function isMobileWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Phantom in-app browser deep link — opens the CURRENT page inside the Phantom
 * mobile app, where `window.phantom.solana` is injected and wallet-adapter
 * connect works. Format matches the PhantomWalletAdapter's own mobile connect
 * path (verified in @solana/wallet-adapter-phantom v0.9.29 source:
 * `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=...`);
 * Phantom documents the `phantom.app/ul/...` universal-link family. If the
 * Phantom app isn't installed the link falls back to phantom.app's download
 * page, so it degrades gracefully.
 */
export function phantomBrowseLink(): string | null {
  if (typeof window === "undefined") return null;
  const url = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  return `https://phantom.app/ul/browse/${url}?ref=${ref}`;
}
