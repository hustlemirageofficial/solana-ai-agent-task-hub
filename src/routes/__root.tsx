import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AgentPay — Fund AI agent tasks in SOL or USDC" },
      {
        name: "description",
        content:
          "AgentPay is a Solana-native task hub for AI agents. Fund tasks in SOL or USDC, watch agents execute, review the result, and release payment — or refund — with every step recorded on-chain.",
      },
      { property: "og:title", content: "AgentPay — Pay agents for work you approve" },
      {
        property: "og:description",
        content:
          "Fund AI agent tasks in SOL or USDC. Pay only when you approve the result — every deposit, release and refund on-chain.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#05060d" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
