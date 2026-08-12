import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { networkLabel } from "~/lib/solana";
import { useWalletBridge } from "./wallet-context";

/**
 * Header wallet control. Reads the app-level wallet bridge (WalletProvider),
 * which only mounts the wallet-adapter tree on the client — so this renders a
 * placeholder until mounted and stays SSR-safe.
 */

export function WalletConnect() {
  const bridge = useWalletBridge();

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const { mounted, connected, publicKey, connection, connect, disconnect } = bridge;

  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    setBalanceError(false);
    if (connected && publicKey && connection) {
      connection
        .getBalance(publicKey)
        .then((b) => {
          if (!cancelled) setBalance(b / LAMPORTS_PER_SOL);
        })
        .catch(() => {
          if (!cancelled) setBalanceError(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, connection]);

  async function handleConnect(name: string) {
    setConnectError(null);
    setOpen(false);
    try {
      await connect(name);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  async function handleCopy() {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="h-9 w-40 animate-pulse rounded-full border border-white/10 bg-white/5"
      />
    );
  }

  if (!connected || !publicKey) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={bridge.connecting}
          className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:border-teal-400/40 hover:bg-white/10 disabled:opacity-60"
        >
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          {bridge.connecting ? "Connecting…" : "Connect wallet"}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0b101d] p-2 shadow-2xl shadow-black/50">
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {networkLabel()} · {bridge.network}
            </p>
            {bridge.wallets.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => void handleConnect(w.name)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-teal-400/40 text-[10px] font-bold">
                  {initial(w.name)}
                </span>
                <span className="flex-1">{label(w.name)}</span>
                {w.name !== "Unsafe Burner Wallet" && (
                  <span className="text-[10px] text-slate-500">
                    {w.readyState === "Installed" ? "installed" : "not detected"}
                  </span>
                )}
              </button>
            ))}
            {connectError && (
              <p className="border-t border-white/5 px-3 py-2 text-xs text-amber-400">
                {connectError}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const addr = publicKey;
  const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleCopy()}
        title={addr}
        className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-slate-100 transition hover:bg-white/10"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-mono">{short}</span>
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-300">
          {networkLabel()}
        </span>
      </button>

      <button
        type="button"
        onClick={() =>
          void connection
            ?.getBalance(publicKey)
            .then((b) => setBalance(b / LAMPORTS_PER_SOL))
            .catch(() => setBalanceError(true))
        }
        title="Click to refresh balance"
        className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10"
      >
        <span className="text-teal-300">
          {balanceError ? "—" : balance === null ? "…" : balance.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </span>
        <span className="text-xs text-slate-400">SOL</span>
      </button>

      <button
        type="button"
        onClick={() => void disconnect()}
        title={`Disconnect ${bridge.walletName ?? "wallet"}`}
        className="flex h-9 items-center rounded-full border border-white/10 px-3 text-sm text-slate-400 transition hover:border-red-400/40 hover:text-red-300"
      >
        Disconnect
      </button>

      {copied && <span className="text-xs text-emerald-400">Copied!</span>}
    </div>
  );
}

function label(name: string): string {
  if (name === "Unsafe Burner Wallet") return "Devnet burner wallet";
  if (name === "Solflare") return "Solflare";
  return name;
}

function initial(name: string): string {
  if (name === "Unsafe Burner Wallet") return "B";
  return name.charAt(0).toUpperCase();
}
