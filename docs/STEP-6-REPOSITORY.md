# AgentPay — Step 6 Repository Documentation

## Repository purpose

AgentPay is a Solana-native AI agent task hub. A funder creates a task, deposits a bounty into escrow, the agent produces a reviewable result, and the funder approves release or rejects for a refund.

## Production architecture

- Frontend: React 19 + Vite 7 + Tailwind 4 + TanStack Start
- Runtime/API: Vercel entry point backed by the shared REST API in `src/server/api.ts`
- Database: Neon Postgres via `@neondatabase/serverless`
- Blockchain: Solana Devnet by default
- Wallets: Phantom / Solflare through wallet-adapter
- Agent: OpenAI or Anthropic when configured; deterministic demo mode when no LLM key is configured

## Important production configuration

### Required for database-backed production features

`DATABASE_URL`

Add this as a Vercel **server-side** environment variable. Never commit the connection string to GitHub.

### Required for funded escrow operations

`ESCROW_PRIVATE_KEY`

The production owner/client must provide a dedicated escrow wallet secret. Never use a developer's personal wallet and never commit the secret to GitHub.

The application intentionally handles a missing escrow key safely: health and database read endpoints remain available, while funded task creation and escrow operations return a clear configuration error instead of attempting to write to the Vercel deployment filesystem.

### Optional agent configuration

`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` enables real LLM execution. Without either key, the app uses clearly labeled deterministic demo mode for workflow testing.

`AGENT_PAYOUT_ADDRESS` can be set by the production owner to the wallet that receives approved payouts.

## Verified production API checks

The Vercel production deployment has been verified for:

- `GET /api/health` — API reachable and database reports `ok`
- `GET /api/tasks` — task records load from Postgres
- `GET /api/tasks/:id` — individual task and stored result load correctly
- `GET /api/txns` — deposit, release, and refund records load correctly
- `/app` — dashboard renders database-backed task history

Existing Devnet history includes confirmed deposit, release, and refund signatures. These records are retained as demonstration evidence; they do not imply that a production escrow secret is configured for the current deployment.

## Local development

1. Install Bun 1.3+.
2. Copy `.env.example` to `.env`.
3. Add a development `DATABASE_URL` if database-backed testing is required.
4. Keep secrets local or in the deployment provider; never commit `.env`.
5. Run the documented Bun development/build commands from the repository README.

## Deployment

The production project is connected to GitHub and deploys from `main`. Server-side environment variables are configured in Vercel. Client `VITE_*` variables are build-time values and require a new deployment after changes.

## Handover checklist reference

Step 6 prepares the repository for handover. Step 7 separately covers access transfer, deployment ownership, environment variables, and maintenance instructions. Step 8 covers custom-domain configuration. Step 9 covers the final demo/presentation.

## Security rules

- Never commit private keys, API keys, database URLs, or `.env` files.
- Use a dedicated escrow wallet for each production owner/deployment.
- Keep Solana network configuration explicit and verify the intended cluster before funding.
- Treat Devnet assets as test assets only.
