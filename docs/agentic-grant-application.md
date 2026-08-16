# Superteam Agentic Engineering Grant — Application Text

> Ready to paste into the Earn application form. The form asks for "a clear
> description of what you want to build and how you'll use AI tools" — this is
> that text (~300 words). Replace `[Applicant name]` with the Earn account
> holder's name before submitting.

---

## What I want to build

**AgentPay — a Solana-native AI agent task hub with escrow-first payments.**

AgentPay lets funders hire AI agents with money on the line. A funder creates a
task, funds a bounty in **SOL or USDC** into a dedicated on-chain escrow — one
escrow per task, so funds never sit in a hot pooled wallet — watches the agent
execute, reviews the submitted result, and then **approves to release payment
to the agent, or rejects and gets a full refund**. Every deposit, release and
refund is a real Solana transaction with its signature and explorer link, so
the entire money flow is independently verifiable proof rather than a promise.
The agent is paid only on the funder's explicit approval.

## Status: already built, tested, and live

The MVP is shipped, not a pitch:

- **Live app:** https://f12516e14696555a71d9a2020f198f39.ctonew.app (devnet)
- **Public GitHub:** https://github.com/hustlemirageofficial/solana-ai-agent-task-hub
- **Tests:** 23/23 offline tests green (state machine, payout, no-double-pay,
  idempotency, wallet UI)
- **Live devnet E2E with finalized signatures:** approve → on-chain release to
  the agent, and reject → on-chain refund to the funder — both confirmed
  Finalized on-chain (signatures in the app's History with explorer links)
- **Features:** wallet connect (Phantom/Solflare) · SOL + USDC deposits with
  server-side on-chain verification · agent execution (OpenAI `gpt-4o-mini` /
  Anthropic `claude-3-5-haiku-latest`, with a clearly-labeled demo mode when no
  API key is set) · on-chain release/refund · history & proof ledger

## How I'll use AI tools

AI is both the product and the process. **As the product:** AgentPay executes
tasks with LLM-backed agents, so the grant's target use case is the product
itself. **As the process:** the full stack — React 19 / Vite / Bun / Postgres /
Solana — was built with heavy AI-assisted coding. The **AI-coding subscription
the grant funds** would cover the tooling for the next phase, which is already
scoped:

- per-funder accounts with scoped history
- an agent registry with identities and reputation
- cancellation and partial-release flows
- mainnet deployment (the app is fully env-driven; nothing hardcodes devnet)

The scope is deliberately shippable: the MVP is already live on devnet with
on-chain proof, and this grant funds the tooling that keeps the roadmap
moving. 50% upfront covers the subscription; the shipped product is the
tranche-2 evidence.

---

**[Applicant name]**
