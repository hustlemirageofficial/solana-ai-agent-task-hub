import { useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider as WalletAdapterProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import {
  IS_DEVNET,
  SOLANA_NETWORK,
  SOLANA_RPC,
} from "~/lib/solana";
import {
  WALLET_BRIDGE_DEFAULT,
  WalletBridgeProvider,
  type WalletBridgeState,
} from "./wallet-context";
import { normalizeBridgeWallets } from "./wallet-utils";

/**
 * App-level wallet provider (SSR-safe).
 *
 * Renders the connection/wallet-adapter tree only after mount (client-side);
 * before that — and during SSR — children render with the default (empty)
 * bridge state, so wallet-dependent components must gate on `mounted`.
 */

function buildAdapters() {
  const list = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  // A generic in-browser "burner" wallet, devnet only — lets the demo connect
  // without installing an extension. Never offered outside devnet.
  if (IS_DEVNET) list.push(new UnsafeBurnerWalletAdapter());
  return list;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <WalletBridgeProvider value={WALLET_BRIDGE_DEFAULT}>
        {children}
      </WalletBridgeProvider>
    );
  }

  return (
    <ConnectionProvider endpoint={SOLANA_RPC} config={{ commitment: "confirmed" }}>
      <WalletAdapterProvider wallets={buildAdapters()} autoConnect>
        <WalletBridgeInner>{children}</WalletBridgeInner>
      </WalletAdapterProvider>
    </ConnectionProvider>
  );
}

function WalletBridgeInner({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const {
    connect,
    connecting,
    connected,
    disconnect,
    publicKey,
    select,
    sendTransaction,
    wallet,
    wallets,
  } = useWallet();

  const value: WalletBridgeState = useMemo(() => {
    // See normalizeBridgeWallets for why we read `adapter.name`, not `w.name`
    // (wallet-adapter-react Wallet entries are `{ adapter, readyState }` —
    // `w.name` is always undefined and used to crash the dropdown on
    // `name.charAt(0)` in WalletConnect's initial()).
    const shown = normalizeBridgeWallets(wallets, IS_DEVNET);
    return {
      mounted: true,
      connecting,
      connected,
      publicKey: publicKey?.toBase58() ?? null,
      // `wallet` is the selected Wallet entry ({ adapter, readyState }) — its
      // display name is `adapter.name` (see normalizeBridgeWallets).
      walletName: wallet?.adapter?.name ?? null,
      network: SOLANA_NETWORK,
      connection,
      sendTransaction: sendTransaction
        ? (tx) => sendTransaction(tx, connection)
        : null,
      connect: async (name: string) => {
        select(name);
        // select() only updates React state — the WalletProvider's `connect`
        // closure still sees the previous (null) adapter, which would throw
        // WalletNotSelectedError. Give the selection a tick to render before
        // connecting (wallet-adapter's own autoConnect effect re-uses this).
        await new Promise((r) => setTimeout(r, 0));
        await connect();
      },
      disconnect: async () => {
        await disconnect();
      },
      wallets: shown,
    };
  }, [connecting, connected, publicKey, wallet, connection, sendTransaction, select, connect, disconnect, wallets]);

  return <WalletBridgeProvider value={value}>{children}</WalletBridgeProvider>;
}
