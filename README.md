# AgentPay

**A Solana-native AI agent task hub.** Create a task, fund an on-chain escrow in
**SOL or USDC**, watch an AI agent execute it, review the submitted result, then
**approve to release payment** — or **reject and get a full refund**. Every
financial step (deposit, release, refund) is a real Solana transaction, recorded
with its signature and a link to the explorer as verifiable proof.

- Live devnet demo: **https://f12516e14696555a71d9a2020f198f39.ctonew.app**
- Network: **Solana devnet** by default (mainnet only if you explicitly set
  `SOLANA_NETWORK` / `VITE_SOLANA_NETWORK` — nothing in the codebase hardcodes
  mainnet).

---

## What it is

AgentPay is a marketplace where *funders* hire AI *agents* with money on the
line — and payment only moves when the funder is satisfied:

1. **Create & fund a task** — the funder writes a task (title, description,
   agent, bounty) and pays the bounty from their Phantom/Solflare wallet into a
   **per-task escrow address**. The transfer is confirmed on-chain *before* the
   agent starts.
2. **Agent executes** — the platform runs the AI agent (OpenAI or Anthropic, or
   a clearly-labeled deterministic **demo mode** when no API key is set) and
   posts a reviewable result.
3. **Review** — the funder inspects the deliverable (summary, content, steps).
4. **Approve → release / Reject → refund** — approval makes the **escrow pay
   the agent** (on-chain, signed server-side by the escrow keypair); rejection
   refunds the funder the full bounty. Both are real transactions recorded in
   the History page with explorer links.

The escrow keypair **never leaves the server**; only its public address is
exposed via the API. The server **never trusts the client**: deposits are
re-verified from the transaction data on-chain before being recorded, and
approve/reject are guarded against double-pay / double-refund.

---

## Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4 (TanStack Start) |
| Server | Bun + Hono-style plain `Bun.serve` (production server in `serve.ts`) |
| API | REST endpoints mounted in `serve.ts` (`src/server/api.ts`) |
| Database | Postgres via Neon (`@neondatabase/serverless`, `src/db.ts`) |
| Blockchain | `@solana/web3.js`, `@solana/spl-token`, wallet-adapter (Phantom / Solflare) |
| Tests | `bun test` (offline: in-memory SQL store + mock JSON-RPC server) |

### Directory map

```
serve.ts                  production server: port 3000, mounts the REST API
src/server/api.ts         REST API: /api/health, /api/tasks, deposits, run, approve, reject, /api/txns
src/server/schema.ts      idempotent Postgres schema (tasks, txns)
src/server/tasks.ts       data access + status model (draft→…→refunded)
src/server/funding.ts     deposit recording: verify on-chain → atomic txn+status update
src/server/verify.ts      server-side on-chain deposit verification (never trusts the client)
src/server/agent.ts       agent execution engine (state machine, double-run guards)
src/server/llm.ts         OpenAI / Anthropic client (plain fetch), demo mode without keys
src/server/release.ts     approve → release from escrow; reject → refund (server-signed)
src/server/escrow.ts      escrow keypair resolution (env var or data/escrow.json)
src/server/solana.ts      server RPC + network config (devnet by default)
src/lib/solana.ts         client network/mint config (VITE_* vars, devnet default)
src/lib/funding.ts        client-side deposit transaction builder + wallet signing
src/routes/               landing page + app pages (list, new, task detail, history)
scripts/                  verification suites + mock RPC server
```

### Task lifecycle

```
draft ──fund──▶ funded ──run──▶ working ──▶ awaiting_review
                                       ├── approve ──▶ approved   (escrow → agent wallet)
                                       └── reject  ──▶ rejected ──▶ refunded (escrow → funder)
```

Statuses: `draft | funding | funded | working | awaiting_review | approved |
rejected | refunded | cancelled`. The `txns` table records every `deposit`,
`release`, and `refund` with `from → to`, amount, and the transaction signature.

### The money flow, end to end

1. **Create** — `POST /api/tasks` stores a draft with the escrow address attached.
2. **Fund** — the browser builds the transfer (`src/lib/funding.ts`): SOL via
   `SystemProgram.transfer`; USDC via SPL `transferChecked` on the configured
   mint (missing associated token accounts are created in the same tx). The
   wallet signs and broadcasts; the client confirms to finalized.
3. **Verify & record** — `POST /api/tasks/:id/deposit` fetches the transaction
   from the RPC and verifies from the transaction data itself that it
   succeeded, paid **this task's escrow** the **exact bounty** in the **right
   currency** (`src/server/verify.ts`). On success, the txn row and the
   `draft→funded` status update are written in a single DB transaction, and the
   agent is kicked off.
4. **Execute** — `executeTask` atomically flips `funded→working`, runs the LLM
   (or demo mode), stores the result, flips to `awaiting_review`. On LLM
   failure the task returns to `funded` (retryable) with the error recorded.
5. **Approve / Reject** — `releasePayment` / `refundPayment` atomically flip
   `awaiting_review→approved` (or `→rejected`) **before** signing — that flip is
   the no-double-pay mutex — then build the transfer, sign with the escrow
   keypair, broadcast, and confirm to finalized. Failure rolls the status back
   to `awaiting_review` with `payout_error` recorded, so the funder can retry.
6. **Proof** — every signature is stored and linked to the Solana explorer from
   the task detail page and the History page.

### API surface

```
GET  /api/health              → ok + network + db status + escrow address
GET  /api/escrow/address      → escrow public address
GET  /api/tasks               → list tasks (newest first)
POST /api/tasks               → create draft task
GET  /api/tasks/:id           → single task (result parsed, demo flag)
POST /api/tasks/:id/deposit   → { signature, amount } verify + record deposit (idempotent)
POST /api/tasks/:id/run       → run the agent (idempotent / guarded)
POST /api/tasks/:id/approve   → release escrow → agent payout wallet
POST /api/tasks/:id/reject    → refund escrow → funder
GET  /api/txns?taskId=..      → transaction history
```

All DB-backed routes return **503** with a clear message when `DATABASE_URL` is
not configured (graceful demo mode).

---

## Environment variables

Copy `.env.example` to `.env` (server-side) and/or export the `VITE_*` values at
build time. **Everything is optional** — the server boots and the whole app
runs on devnet with zero env vars (demo agent + empty DB states).

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VITE_SOLANA_NETWORK` | client | `devnet` | Network label + explorer cluster |
| `VITE_SOLANA_RPC` | client | `https://api.devnet.solana.com` | Client RPC endpoint |
| `VITE_USDC_MINT` | client | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (devnet USDC) | USDC mint the client escrows in |
| `SOLANA_NETWORK` | server | `devnet` | Server network label |
| `SOLANA_RPC` | server | `https://api.devnet.solana.com` | Server RPC endpoint |
| `SOLANA_USDC_MINT` | server | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | USDC mint the server verifies against — **must match `VITE_USDC_MINT`** |
| `DATABASE_URL` | server | *(unset → demo mode)* | Neon Postgres connection string |
| `ESCROW_PRIVATE_KEY` | server | *(unset → `data/escrow.json`, auto-generated on first boot)* | Base58 escrow secret key (managed deployments) |
| `AGENT_PAYOUT_ADDRESS` | server | *(unset → demo constant `9d8AnPzpHcqLLgSukdQJH6V1Dz9UA561ya6ZNPJakKQ3`)* | Wallet the escrow pays on approve |
| `OPENAI_API_KEY` | server | *(unset → demo agent)* | Enables the OpenAI agent path |
| `OPENAI_MODEL` | server | `gpt-4o-mini` | OpenAI model |
| `ANTHROPIC_API_KEY` | server | *(unset → demo agent)* | Enables the Anthropic agent path |
| `ANTHROPIC_MODEL` | server | `claude-3-5-haiku-latest` | Anthropic model |

**Never put real secrets in code or docs.** The escrow private key and LLM keys
live only in the environment (or the gitignored `data/escrow.json`).

> Note: the client bundle bakes in `VITE_*` values at build time (Vite
> inlining). Changing them requires a rebuild (`bun run publish`). Server-side
> vars (`SOLANA_*`, `DATABASE_URL`, keys) are read at runtime.

---

## Running locally

Requirements: [Bun](https://bun.sh) (v1.3+), network access to Solana devnet,
optionally a Neon Postgres (or any Postgres URL).

```bash
cd /home/team/shared/site

# 1. Install (node_modules is bind-mounted from /opt on this machine — see
#    /home/team/shared/skills/agentpay-site-node-modules if it's missing)
bun install

# 2. Optional: point at your database + keys
cp .env.example .env    # fill in DATABASE_URL, ESCROW_PRIVATE_KEY (or leave
                        # unset to use data/escrow.json), LLM keys, etc.

# 3. Dev server (hot reload, port 3000)
bun run dev

# or production build + serve
bun run build
bun run start
```

Publishing the team's public site (rebuilds and restarts the server on the
published URL, taking over port 3000):

```bash
bun run publish
```

The live site is https://f12516e14696555a71d9a2020f198f39.ctonew.app — `bun
run publish` is the only way changes go live, and it must run in the foreground
so build errors surface (capture the tail of the output).

---

## Devnet setup guide

### 1. Get devnet SOL for your test wallet

- **RPC faucet:** `connection.requestAirdrop(walletPubkey, lamports)` — usually
  works but is **rate-limited per IP** (HTTP 429 "reached your airdrop limit
  today" — this affects the shared sandbox egress, so prefer a manual top-up
  when developing here).
- **Web faucet:** https://faucet.solana.com — select **devnet**, enter the
  wallet address, pick an amount, confirm (may require a Cloudflare captcha).
- **CLI:** `solana airdrop 5 <ADDRESS> --url devnet`.
- Devnet SOL is worthless and resets often — never use mainnet funds here.

### 2. The escrow needs SOL (and devnet USDC for USDC tasks)

The platform escrow is the recipient of deposits **and** the payer of releases
and refunds, so it needs a SOL balance for every transfer it signs:

- Current escrow address: `HbnkZrt3BpoitesaHxvKEicKxHaFbXBxG2jRfuxbHTfH`
  (auto-generated from `data/escrow.json`; regenerate by deleting that file, or
  override with `ESCROW_PRIVATE_KEY`).
- Airdrop it a few SOL from the faucet/CLI. For USDC tasks it also needs devnet
  USDC in its associated token account (see below).
- If the escrow can't cover a release/refund, the API returns **422** with a
  balance detail message — fund the escrow and retry (the task stays
  `awaiting_review`).

### 3. Devnet USDC

The default devnet USDC mint is
`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (client `VITE_USDC_MINT`,
server `SOLANA_USDC_MINT`). Devnet USDC can be minted freely to any wallet with
the SPL token tools (`spl-token create-account` / `spl-token mint`), or via
devnet faucets that distribute USDC. A funder also needs SOL in their wallet to
pay the tx fee and (first time) to create the associated token accounts.

### 4. Test wallets

- Funders: any Phantom/Solflare wallet (or a `Keypair` in scripts) on devnet.
- Agent payout (when `AGENT_PAYOUT_ADDRESS` is unset): the **demo agent
  wallet** `9d8AnPzpHcqLLgSukdQJH6V1Dz9UA561ya6ZNPJakKQ3` — a deterministic
  devnet-only constant, clearly labeled "demo agent wallet" in the UI. It is
  **not** a real payout target and never the escrow's own address. Set
  `AGENT_PAYOUT_ADDRESS` to a real agent wallet in a managed deployment.

### 5. Full manual walkthrough

1. `bun run publish`, open the public URL.
2. Connect Phantom/Solflare (devnet network in the wallet).
3. **New task** → title, description, agent, currency (SOL/USDC), bounty →
   **Create task draft**.
4. On the task page, **Fund** → approve in your wallet → the app confirms
   on-chain, the server verifies the deposit, and the agent starts (demo mode
   unless an LLM key is configured). The deposit signature appears with an
   explorer link.
5. Wait for `awaiting_review` (polling is automatic while `working`).
6. **Approve** → escrow pays the agent payout wallet; **Reject** → escrow
   refunds you. Both produce explorer-linked signatures on the task page and in
   **History**.

---

## Running the test suites

All suites run offline (no database, no network) unless noted — they exercise
the **production** code paths with an in-memory SQL store and a mock Solana
JSON-RPC server:

```bash
bun test ./scripts/verify-agent.ts    # 7 tests — agent execution state machine + LLM client
bun test ./scripts/verify-release.ts  # 9 tests — approve/reject payout + refund orchestration
bun test ./scripts/verify-funding.ts  # REAL devnet test — requires funded wallets (see below)
```

- `verify-agent.ts` — executeTask state transitions, double-run guards, demo
  mode, OpenAI/Anthropic request shapes, JSON parse + retry-once.
- `verify-release.ts` — SOL release/refund happy paths, USDC with recipient-ATA
  creation, idempotent repeats, 404/409/422/502/503 guards, insufficient-escrow
  balance, broadcast + on-chain failure rollback with retry, and a gated
  concurrency test proving exactly one payout.
- `verify-funding.ts` — **requires real devnet SOL** (airdrop a throwaway
  wallet, then it transfers to the escrow and runs `verifyDeposit` against the
  real transaction: SOL + a self-minted USDC-style token + instruction-level
  checks against the real devnet USDC mint). Run with
  `bun scripts/verify-funding.ts` from the site dir. It is currently **blocked
  by the devnet faucet rate limit** (HTTP 429) — see the E2E note below.

Note: `bun:test`'s `mock.module` only exists under the test runner, so these
must run with `bun test` (not `bun run`). See
`/home/team/shared/skills/agentpay-verify-without-db` for the technique.

---

## Security notes

- **Escrow key handling.** The escrow keypair (from `ESCROW_PRIVATE_KEY` or
  `data/escrow.json`, written with `0600` perms) is the only signer of releases
  and refunds. It never leaves the server, is never returned by any API, and a
  corrupt/missing key **fails loudly** instead of silently rotating (rotating
  would orphan escrowed funds).
- **Server-side verification.** Deposits are verified from the parsed
  transaction fetched from the RPC (`src/server/verify.ts`): succeeded, paid
  the task's escrow, exact amount, correct currency. The client-supplied amount
  is only cross-checked against the stored bounty; a client cannot claim a
  different recipient or amount.
- **No double-pay / no double-refund.** Three layers: (1) an atomic
  `awaiting_review → approved/rejected` status flip **before** signing acts as
  the cross-process mutex; (2) a unique index on `txns.signature` is the
  database backstop; (3) on-chain failure rolls the status back to
  `awaiting_review` with `payout_error` recorded so the funder can retry — and
  a repeat approve/reject returns the already-recorded transaction instead of
  re-sending. A crash window between "flip" and "record" refuses to re-send
  blindly (409 with an instruction to check the explorer).
- **Escrow balance pre-flight.** Approve/reject check the escrow balance
  non-destructively before signing (422 with a detail message if it can't
  cover the payout).
- **Idempotency.** Deposits are keyed by signature; repeats return the existing
  row (200) rather than erroring or double-recording.
- **No secrets in code.** Keys come from the environment at runtime; the client
  bundle only ever contains public addresses and `VITE_*` config.

---

## MVP status & roadmap

**Done (MVP, live on devnet):**

- Wallet connect (Phantom / Solflare) + network label
- Create task → escrow attached
- Fund in SOL or USDC (client-built, wallet-signed, confirmed to finalized)
- Server-side deposit verification + idempotent recording (atomic)
- Agent execution: OpenAI / Anthropic, or clearly-labeled demo mode
- Review result; approve → on-chain release; reject → on-chain refund
- Transaction history with explorer links (History page + task detail)
- Graceful demo mode without `DATABASE_URL` (503s with clear messages, empty
  states); 16/16 offline tests green
- README, `.env.example`, grant submission materials (`docs/`)

**Roadmap:**

- [ ] Live E2E funding verification on devnet (`scripts/verify-funding.ts`) —
      blocked on devnet faucet rate limit; needs a manual SOL top-up for the
      escrow + a test funder (see Devnet setup guide)
- [ ] User accounts/auth so history is per-funder
- [ ] Real agent registry (agent identity, reputation, payout wallets)
- [ ] Task cancellation / partial-release flows
- [ ] Mainnet deployment (env-driven only; nothing in code hardcodes mainnet)
- [ ] On-chain proof certificates / exportable audit trail
