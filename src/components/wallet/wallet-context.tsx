import { createContext, useContext } from "react";
import type { Connection, Transaction } from "@solana/web3.js";

/**
 * SSR-safe wallet bridge.
 *
 * The wallet-adapter provider tree touches browser APIs (window, localStorage),
 * so it can only mount on the client. This context carries the mounted wallet
 * state + API to any component (header control, task detail page) with safe
 * defaults, so server-rendered markup never calls into the adapter.
 *
 * Components should treat `mounted === false` as "render a placeholder / hide
 * wallet-dependent UI" and otherwise use `connection` / `publicKey` /
 * `sendTransaction` from the bridge.
 */

export type WalletBridgeState = {
  mounted: boolean;
  connecting: boolean;
  connected: boolean;
  publicKey: string | null;
  walletName: string | null;
  network: string;
  connection: Connection | null;
  sendTransaction: ((tx: Transaction) => Promise<string>) | null;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  wallets: { name: string; readyState: string }[];
};

export const WALLET_BRIDGE_DEFAULT: WalletBridgeState = {
  mounted: false,
  connecting: false,
  connected: false,
  publicKey: null,
  walletName: null,
  network: "devnet",
  connection: null,
  sendTransaction: null,
  connect: async () => {},
  disconnect: async () => {},
  wallets: [],
};

const WalletBridgeContext = createContext<WalletBridgeState>(WALLET_BRIDGE_DEFAULT);

export function WalletBridgeProvider({
  value,
  children,
}: {
  value: WalletBridgeState;
  children: React.ReactNode;
}) {
  return (
    <WalletBridgeContext.Provider value={value}>
      {children}
    </WalletBridgeContext.Provider>
  );
}

export function useWalletBridge(): WalletBridgeState {
  return useContext(WalletBridgeContext);
}
