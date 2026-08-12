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
    const shown = wallets
      .filter((w) => w.name !== "Unsafe Burner Wallet" || IS_DEVNET)
      .map((w) => ({ name: w.name, readyState: w.readyState }));
    return {
      mounted: true,
      connecting,
      connected,
      publicKey: publicKey?.toBase58() ?? null,
      walletName: wallet?.name ?? null,
      network: SOLANA_NETWORK,
      connection,
      sendTransaction: sendTransaction
        ? (tx) => sendTransaction(tx, connection)
        : null,
      connect: async (name: string) => {
        select(name);
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
