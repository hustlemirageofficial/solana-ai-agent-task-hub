# AgentPay — Superteam Grant Submission Materials

> **Submission status:** draft materials for the **Superteam Agentic Engineering
> Grant** (aka the AI Agentic Engineering / agent builder grant track).
>
> **Verified cycle summary (read first):** the grant-cycle details below were
> verified live on 2026-08-15 from the official listing
> (<https://superteam.fun/earn/grants/agentic-engineering>; `earn.superteam.fun`
> redirects there) — full captured facts in
> `/home/team/shared/grant-evidence/grant-cycle-verified.md`.
> - **Status:** OPEN / rolling — no deadline on the listing; applications
>   reviewed on a weekly cycle (avg. response ~1 week).
> - **Cheque:** **200 USDG** — 50% ($100) upfront post-KYC, 50% ($100) after
>   shipping. KYC and payouts are handled on Earn (payments processed Mondays,
>   paid by Friday of the same week).
> - **Apply:** on **Superteam Earn** with a short description of what you want
>   to build and how you'll use AI tools (Earn account login required first).
>   The prepared application text is in `docs/agentic-grant-application.md`.
> - **Tranche 2 (after shipping):** share the project's **live URL**, **GitHub
>   repo**, and **AI-coding subscription receipt(s) totalling $200** via the
>   tranche application form on the listing (appears after the first tranche is
>   received).
> - **Eligibility:** global; the project must have some Solana integration;
>   open-source repos encouraged (private allowed with reviewer access).
> - **Contact:** support@superteam.fun (code review contact: abhwshek@gmail.com).
>
> Everything below is written to slot into the Earn application form (pitch,
> problem/solution, architecture, demo, security, roadmap).

---

## 1. Project overview

**AgentPay — escrow-first payments for AI agents on Solana.**

AgentPay is a Solana-native task hub where funders hire AI agents with money on
the line. A funder creates a task, pays a bounty in **SOL or USDC** into a
per-task on-chain escrow, watches the agent execute, reviews the submitted
result, and then **approves to release payment — or rejects and gets a full
refund**. Every deposit, release and refund is a real Solana transaction,
recorded with its signature and an explorer link as verifiable proof.

The full MVP is **built, tested and live on devnet**:
**https://f12516e14696555a71d9a2020f198f39.ctonew.app**

- **One escrow per task** — funds never sit in a hot pooled wallet.
- **Payment only on approval** — the agent never gets paid without a review.
- **Server-verified, client-independent** — the server re-derives the truth
  from on-chain transaction data; a malicious client cannot claim a fake
  deposit, a different recipient, or a wrong amount.
- **No-double-pay guarantees** — atomic status flips + unique signature
  constraints + rollback-on-failure make double release/refund structurally
  impossible.
- **Proven end-to-end on devnet** — a live E2E run (2026-08-12) completed both
  flows with finalized on-chain signatures: approve → release to the agent and
  reject → refund to the funder (signatures and explorer links in §4 and the
  evidence checklist).

## 2. Problem & solution

**Problem.** AI agents are becoming economically useful, but there is no
trustworthy way to pay them for work. The two default modes today are:

1. *Pay first, hope later* — fund an agent API or wallet up front and trust it
   to deliver. Broken for one-off tasks and untrusted agents.
2. *Trusted intermediary* — a platform holds your money in a pooled account
   and promises to pay out. Requires trusting the platform, its books, and its
   servers; no independent proof of what actually moved.

Neither gives the funder verifiable, enforceable payment — and neither gives an
honest agent a provable record that it was paid for completed work.

**Solution.** AgentPay puts the money in an **on-chain escrow** that only moves
on the funder's explicit decision, with every step independently verifiable:

- The funder pays the bounty to a **per-task escrow address** — a real
  on-chain transfer they sign in their own wallet.
- The platform runs the agent and posts a reviewable result.
- The funder **approves → escrow pays the agent**, or **rejects → escrow
  refunds the funder**. Both are real transactions signed by the escrow
  keypair and broadcast to Solana.
- The History page is an audit ledger: every deposit/release/refund with
  signature + explorer link.

This is the payment rail that makes *hiring an AI agent* a normal, safe,
reversible transaction — the same escrow primitive that makes marketplaces work
off-chain, now on-chain and agent-native.

## 3. Architecture + the Solana integration story

**Stack:** React 19 + Vite + Tailwind 4 (TanStack Start) · Bun server · Neon
Postgres · `@solana/web3.js` + `@solana/spl-token` + wallet-adapter
(Phantom/Solflare) · OpenAI / Anthropic for the agent (clearly-labeled
deterministic demo mode with no keys).

### Wallet connect

Phantom and Solflare via `@solana/wallet-adapter-*`. The app is network-aware
(devnet by default; `VITE_SOLANA_NETWORK`/`VITE_SOLANA_RPC` configurable — mainnet
is only reachable by explicit opt-in; nothing hardcodes it). The client builds
transactions and the wallet signs and broadcasts — the server never asks for a
wallet key.

### On-chain escrow deposits

- Every task is created with a **platform escrow address** attached
  (`GET /api/escrow/address`; the keypair lives server-side only).
- The client builds the deposit (`src/lib/funding.ts`): **SOL** via
  `SystemProgram.transfer`; **USDC** via SPL `transferChecked` on the
  configured devnet mint, auto-creating missing associated token accounts in
  the same transaction.
- The funder confirms in their wallet; the client polls to `finalized`.
- **Server-side verification** (`src/server/verify.ts`): `POST
  /api/tasks/:id/deposit` re-fetches the transaction from the RPC and verifies
  from the transaction data itself — succeeded (`meta.err === null`), paid
  **this task's escrow** (for USDC: the escrow's ATA for the configured mint),
  **exactly the stored bounty**, in the **matching currency** (a SOL transfer
  cannot fund a USDC task and vice versa). The deposit is then recorded
  atomically (txn row + `draft→funded`) in one DB transaction, and the agent is
  kicked off. Idempotent: the same signature can never be recorded twice.

### Agent execution

`executeTask` atomically flips `funded→working`, runs the agent (OpenAI
`gpt-4o-mini` or Anthropic `claude-3-5-haiku-latest`, prompted with the task +
bounty context; JSON output parsed + validated with one retry), stores the
result, and flips to `awaiting_review`. With no API key, a clearly-labeled
**demo mode** produces a deterministic result so the full flow is reviewable.
LLM failure returns the task to `funded` with the error recorded (retryable).

### Review → release / refund (the payout half)

When the task is `awaiting_review`, the funder decides:

- **Approve** → `releasePayment`: the escrow keypair signs and broadcasts
  **SOL `SystemProgram.transfer` (escrow → agent payout wallet)** or **USDC
  `transferChecked` (escrow ATA → agent ATA, creating the ATA in the same
  transaction)**; task → `approved`.
- **Reject** → `refundPayment`: the escrow signs a transfer back to the
  funder; task → `rejected` → `refunded`.

Both are **real server-signed on-chain transactions**, confirmed to finalized
with a 90s wait, and recorded with their signatures in the `txns` table.

### Proof & history

Every `deposit` / `release` / `refund` row stores `from → to`, amount
(lamports / base units), currency, and the transaction signature. The task
detail page and the **History** page link each signature to the Solana
explorer, so a funder can independently verify that the money really moved.

### Security & production-readiness

- **Escrow key never leaves the server** — `ESCROW_PRIVATE_KEY` env or
  gitignored `data/escrow.json` (0600); only the address is exposed. Corrupt
  keys fail loudly, never silently rotate (rotating would orphan funds).
- **Client-independence** — deposits are re-verified on-chain from the
  transaction data; the server is the source of truth for amounts/recipients.
- **No-double-pay / no-double-refund (three layers):**
  1. Atomic `awaiting_review → approved/rejected` status flip **before**
     signing — the flip is the cross-process mutex.
  2. Unique index on `txns.signature` as the DB backstop.
  3. On-chain failure rolls the status back to `awaiting_review` with
     `payout_error` recorded (retryable); repeats return the recorded
     transaction instead of re-sending; the flip-before-record crash window
     refuses to re-send blindly (409 + "check the explorer").
- **Escrow balance pre-flight** — non-destructive check before signing; 422
  with a clear message if the escrow can't cover the payout.
- **Graceful degradation** — no `DATABASE_URL`? The server boots, the UI shows
  clear empty states and 503 messages; the product is understandable without a
  DB. No LLM key? Demo mode, clearly labeled.
- **Testing** — 23/23 offline tests green, run separately: `bun test
  ./scripts/verify-agent.ts` (7 tests) + `./scripts/verify-release.ts` (10
  tests) + `./scripts/verify-wallet-ui.ts` (6 tests). They exercise the
  production state machines, payout orchestration, idempotency, the
  wallet-connect UI, and a gated concurrency test proving exactly one payout
  under race. The real-devnet funding/release/refund loop is additionally
  proven end-to-end with finalized signatures (2026-08-12, see §4), so no part
  of the money path is unverified.

## 4. Step-by-step demo script (devnet)

Live URL: **https://f12516e14696555a71d9a2020f198f39.ctonew.app** (devnet)

1. Open the site → landing page explains the flow.
2. **Launch app** → connect a Phantom/Solflare wallet on **devnet**.
3. **New task** → e.g. "Summarize the Solana token-2022 docs" · agent: General
   assistant · currency **SOL** · bounty 0.1 → **Create task draft**.
4. The task page shows the draft with the **escrow address**. Click **Fund** →
   approve the transfer in your wallet → the app confirms on-chain, the server
   verifies the deposit, and the **deposit signature + explorer link** appear.
5. The agent runs (polling is automatic). Status: `working` → `awaiting_review`
   with a reviewable result (summary, content, steps). Without an LLM key the
   result is a clearly-labeled **demo result**.
6. **Approve** → the escrow pays the agent payout wallet; the **release
   signature + explorer link** appear and the task is `approved`. *(Or
   **Reject** → the escrow refunds you; `refunded`.)*
7. **History** → the full ledger: deposit, release/refund, amounts, from → to,
   explorer links — on-chain proof of every step.

> **Funding note for reviewers:** the escrow wallet is
> `HbnkZrt3BpoitesaHxvKEicKxHaFbXBxG2jRfuxbHTfH` and holds **~3.85 SOL on
> devnet** (queried live from api.devnet.solana.com). The live E2E run
> (2026-08-12) completed two full loops through the running app: deposit +
> release (task `c3e84057-…` → `approved`, escrow → agent payout wallet) and
> deposit + refund (task `c46f11f4-…` → `refunded`, escrow → funder), both
> confirmed **Finalized** with signatures recorded in History and in the grant
> evidence checklist (also readable from the public `/api/txns`).
> Approve idempotency was proven live (repeat approve → same signature, no
> double-pay) and server-side deposit verification proven live (wrong amount →
> 422).

## 5. Stack & what's already shipped

- **Shipped:** wallet connect · task creation · SOL+USDC deposits with
  server-side on-chain verification · agent execution (OpenAI/Anthropic +
  labeled demo mode) · review · on-chain release/refund · history & explorer
  proof · graceful no-DB demo mode · 23/23 offline tests · live devnet E2E with
  finalized signatures · README + env contract + this submission.
- **Stack:** React 19 / Vite / Tailwind 4 (TanStack Start), Bun, Neon
  Postgres, @solana/web3.js + spl-token + wallet-adapter, OpenAI/Anthropic.
- **Repo (public):** https://github.com/hustlemirageofficial/solana-ai-agent-task-hub
  (main @ `d175a04`) — full commit history; PRs #1–#3 merged. The app is live
  at https://f12516e14696555a71d9a2020f198f39.ctonew.app.

## 6. Roadmap

- **Done (shipped MVP, 2026-08-12):** live devnet E2E funding run completed —
  deposit + release (task `c3e84057-…` → `approved`) and deposit + refund (task
  `c46f11f4-…` → `refunded`), all signatures finalized on-chain and recorded in
  the grant evidence checklist. Version control attached: public repo at
  github.com/hustlemirageofficial/solana-ai-agent-task-hub (see §5).
- **Next (after the shipped MVP):** per-funder accounts & history scoping ·
  real agent registry with identities/reputation · cancellation &
  partial-release flows · multi-agent workflows · on-chain proof
  certificates/exportable audit trail.
- **Later:** mainnet deployment (fully env-driven; nothing hardcodes mainnet) ·
  fee model (tiny platform fee on release) · dispute/arbitration layer.

## 7. Team & ask

**Team:** AgentPay (a small team of engineers building in the shared workspace;
full-stack + Solana + agent engineering covered end to end).

**Ask:** this grant's **200 USDG** covers a month of the highest tier of AI
coding tools. AgentPay is **already shipped and live on devnet** — so the ask
is straightforward: approval funds the AI-coding subscription that built the
MVP (and continues to power the roadmap in §6), and the tranche-2 evidence is
the live product itself (public URL + public GitHub repo + on-chain
finalized-signature proof). No invented commitments: everything claimed here is
verifiable today in the running app.

---

*This document was prepared by the AgentPay engineering team. Facts about the
product are accurate against the codebase as of 2026-08 and were re-verified
for this update on 2026-08-15 (23/23 tests, live site, public repo, escrow
balance, on-chain signatures). Grant-cycle details were verified live on the
official listing on 2026-08-15 — see
`/home/team/shared/grant-evidence/grant-cycle-verified.md` and §Header.*
