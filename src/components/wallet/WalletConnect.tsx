import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { networkLabel } from "~/lib/solana";
import { useWalletBridge } from "./wallet-context";
import {
  BURNER_WALLET_NAME,
  isMobileWeb,
  phantomBrowseLink,
  walletInitial,
  walletLabel,
} from "./wallet-utils";

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
  const [phantomHelp, setPhantomHelp] = useState(false);

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

  async function handleConnect(w: { name: string; readyState: string }) {
    setConnectError(null);
    setPhantomHelp(false);
    // iPhone/iPad/Android Safari/Chrome have no wallet browser extensions.
    // Phantom's documented mobile flow is to open the site inside the Phantom
    // app, where `window.phantom.solana` is injected and wallet-adapter connect
    // works. Rather than failing a doomed connect(), surface that path.
    if (w.name === "Phantom" && w.readyState === "NotDetected" && isMobileWeb()) {
      setPhantomHelp(true);
      return;
    }
    setOpen(false);
    try {
      await connect(w.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet connection failed";
      setConnectError(
        w.name === "Phantom" && /not detected/i.test(msg)
          ? `${msg} — install the Phantom browser extension at phantom.app`
          : msg,
      );
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
            {bridge.wallets.map((w, index) => (
              <button
                key={w.name ?? `wallet-${index}`}
                type="button"
                onClick={() => void handleConnect(w)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-teal-400/40 text-[10px] font-bold">
                  {walletInitial(w.name)}
                </span>
                <span className="flex-1">{walletLabel(w.name)}</span>
                {w.name !== BURNER_WALLET_NAME && (
                  <span className="text-[10px] text-slate-500">
                    {w.readyState === "Installed" ? "installed" : "not detected"}
                  </span>
                )}
              </button>
            ))}
            {phantomHelp && (
              <div className="mt-1 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2.5 text-xs text-slate-300">
                <p className="font-medium text-slate-100">
                  Phantom isn't available in this browser.
                </p>
                <p className="mt-1">
                  There is no Phantom extension on iPhone/iPad — open AgentPay
                  inside the Phantom app instead, where the wallet is injected
                  and connecting works.
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <a
                    href={phantomBrowseLink() ?? "https://phantom.app"}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-violet-500/20 px-2.5 py-1.5 font-medium text-violet-200 transition hover:bg-violet-500/30"
                  >
                    Open in Phantom app →
                  </a>
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2.5 py-1 text-slate-400 transition hover:text-slate-200"
                  >
                    Get Phantom at phantom.app
                  </a>
                </div>
              </div>
            )}
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
