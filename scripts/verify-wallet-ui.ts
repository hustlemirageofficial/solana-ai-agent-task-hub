/**
 * AgentPay — wallet dropdown crash-safety verification.
 *
 * Unit tests for the pure wallet-UI helpers that fixed the iPhone Safari
 * "Connect Wallet" crash (`undefined is not an object (evaluating 'e.charAt')`):
 *
 *   - src/components/wallet/wallet-utils.ts
 *     - normalizeBridgeWallets: reads `adapter.name` (wallet-adapter-react
 *       `Wallet` entries are `{ adapter, readyState }`, so `w.name` is always
 *       undefined — the crash), drops malformed entries, falls back to
 *       non-empty strings
 *     - walletInitial / walletLabel: safe for undefined/empty names
 *
 * Run from the site dir:
 *   bun test ./scripts/verify-wallet-ui.ts
 */
import { test, expect } from "bun:test";
import type { Wallet } from "@solana/wallet-adapter-react";
import {
  normalizeBridgeWallets,
  walletInitial,
  walletLabel,
} from "../src/components/wallet/wallet-utils";

/** Build a wallet-adapter-react `Wallet` entry; pass `undefined` to simulate a
 * malformed entry with no adapter (what a bad standard-wallet registration can
 * produce at runtime even though the type marks it required). */
function fakeWallet(name: string | undefined, readyState = "NotDetected"): Wallet {
  return {
    adapter: name === undefined ? undefined : { name, readyState },
    readyState,
  } as unknown as Wallet;
}

test("normalizeBridgeWallets reads adapter.name (not w.name) — the crash fix", () => {
  const wallets = [fakeWallet("Phantom"), fakeWallet("Solflare")];
  const shown = normalizeBridgeWallets(wallets, true);
  // Before the fix, `w.name` was always undefined, so the dropdown called
  // `initial(undefined)` → `name.charAt(0)` → TypeError.
  expect(shown).toEqual([
    { name: "Phantom", readyState: "NotDetected" },
    { name: "Solflare", readyState: "NotDetected" },
  ]);
});

test("normalizeBridgeWallets drops entries with no usable adapter/name", () => {
  const wallets = [
    fakeWallet(undefined), // no adapter at all
    fakeWallet(""), // blank name
    fakeWallet("   "), // whitespace-only name
    fakeWallet("Phantom"),
  ];
  const shown = normalizeBridgeWallets(wallets, true);
  expect(shown.map((w) => w.name)).toEqual(["Phantom"]);
});

test("normalizeBridgeWallets hides the devnet burner wallet outside devnet", () => {
  const wallets = [fakeWallet("Phantom"), fakeWallet("Burner Wallet")];
  expect(normalizeBridgeWallets(wallets, true).map((w) => w.name)).toEqual([
    "Phantom",
    "Burner Wallet",
  ]);
  expect(normalizeBridgeWallets(wallets, false).map((w) => w.name)).toEqual([
    "Phantom",
  ]);
});

test("normalizeBridgeWallets falls back to NotDetected when readyState is missing", () => {
  const wallets = [fakeWallet("Phantom")];
  // Simulate a wallet entry whose readyState is missing at runtime.
  (wallets[0] as { readyState?: unknown }).readyState = undefined;
  expect(normalizeBridgeWallets(wallets, true)[0].readyState).toBe("NotDetected");
});

test("walletInitial is safe for undefined/empty names", () => {
  expect(walletInitial(undefined)).toBe("?");
  expect(walletInitial(null)).toBe("?");
  expect(walletInitial("")).toBe("?");
  expect(walletInitial("Phantom")).toBe("P");
  expect(walletInitial("Solflare")).toBe("S");
  expect(walletInitial("Burner Wallet")).toBe("B");
});

test("walletLabel is safe for undefined/empty names", () => {
  expect(walletLabel(undefined)).toBe("Wallet");
  expect(walletLabel(null)).toBe("Wallet");
  expect(walletLabel("")).toBe("Wallet");
  expect(walletLabel("Phantom")).toBe("Phantom");
  expect(walletLabel("Burner Wallet")).toBe("Devnet burner wallet");
});
