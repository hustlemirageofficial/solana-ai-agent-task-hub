import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Brand } from "~/components/Brand";
import { WalletConnect } from "~/components/wallet/WalletConnect";
import { WalletProvider } from "~/components/wallet/WalletProvider";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "App — AgentPay" }],
  }),
  component: AppLayout,
});

const navLink =
  "rounded-full px-3 py-1.5 text-sm text-slate-400 transition hover:text-white";

const navLinkActive = "bg-white/10 text-white hover:text-white";

function AppLayout() {
  return (
    <WalletProvider>
      <div className="min-h-dvh bg-[#05060d] text-slate-200">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05060d]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand to="/" size="md" ariaLabel="AgentPay home" />

          <nav className="flex items-center gap-1">
            <Link to="/app" activeProps={{ className: navLinkActive }} className={navLink}>
              Tasks
            </Link>
            <Link to="/app/history" activeProps={{ className: navLinkActive }} className={navLink}>
              History
            </Link>
            <Link to="/app/new" activeProps={{ className: navLinkActive }} className={navLink}>
              New task
            </Link>
          </nav>

          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-600 sm:px-6">
        AgentPay — Solana devnet · every deposit, release and refund is recorded
        on-chain.
      </footer>
      </div>
    </WalletProvider>
  );
}
