# AgentPay — Step 7 Buyer Handover Guide

## Purpose

This guide prepares a future owner to deploy, configure, operate, and maintain AgentPay without relying on the original developer's personal wallets, secrets, or accounts.

## 1. What the buyer receives

- The complete AgentPay source repository.
- Production-ready Vercel application structure.
- React/Vite frontend and server/API implementation.
- Postgres/Neon database integration.
- Solana Devnet support.
- Task, agent, escrow, approval, refund, and transaction-history flows.
- Repository documentation and environment template.

## 2. Accounts the buyer needs

The buyer should control their own:

- GitHub repository/account or organization.
- Vercel team/project.
- PostgreSQL/Neon database.
- Solana wallet(s) used for their deployment.
- Optional OpenAI or Anthropic API account.
- Optional custom domain registrar/DNS provider.

The original developer's personal wallet and private keys should not be used for the buyer's production deployment.

## 3. Required environment variables

At minimum, configure:

- `DATABASE_URL` — buyer-owned Postgres/Neon connection string.
- `ESCROW_PRIVATE_KEY` — buyer-owned escrow wallet private key, stored only as a server-side secret.
- `AGENT_PAYOUT_ADDRESS` — buyer-controlled agent payout address.

For real AI execution, additionally configure one of:

- `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
- `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL`.

Solana configuration can remain on Devnet for testing. Before any mainnet deployment, the buyer must explicitly review and configure the network, RPC, USDC mint, wallets, and operational security.

## 4. Secret-handling rules

Never commit any of the following to GitHub:

- Private keys.
- Seed phrases.
- Database passwords or connection strings containing credentials.
- OpenAI API keys.
- Anthropic API keys.
- Other production secrets.

Use Vercel Environment Variables or the buyer's approved secret-management system.

## 5. First deployment checklist

1. Connect the buyer-owned GitHub repository to the buyer-owned Vercel project.
2. Create the buyer-owned Postgres/Neon database.
3. Add `DATABASE_URL` to the Vercel Production environment.
4. Create a dedicated escrow wallet for the buyer's deployment.
5. Add its private key as `ESCROW_PRIVATE_KEY` in Vercel Production.
6. Add the buyer's `AGENT_PAYOUT_ADDRESS`.
7. Configure the desired Solana network and RPC settings.
8. Add an LLM API key if real agent execution is required.
9. Deploy from the production branch.
10. Verify `/api/health` reports the expected network and database status.
11. Verify task creation, funding, execution, approval, and refund using a controlled Devnet test before handling real funds.

## 6. Database handover

The buyer should use a buyer-owned database. Do not transfer personal database credentials.

Before production use, verify that:

- The application can connect to Postgres.
- The schema is applied successfully.
- Tasks can be created and retrieved.
- Transaction records are stored correctly.
- The buyer has a backup/recovery policy appropriate to their deployment.

## 7. Escrow handover

The escrow private key is deployment-specific. The buyer should create or designate their own escrow wallet and configure its private key as `ESCROW_PRIVATE_KEY`.

For security, the private key must remain server-side and must never be exposed through the browser, repository, logs, screenshots, or documentation.

For Devnet, fund the escrow with enough Devnet SOL for controlled testing. For mainnet, perform a separate security review before funding any production escrow.

## 8. Admin and operational responsibilities

The owner is responsible for:

- Vercel project access and billing.
- Database access and backups.
- Solana wallet custody.
- API-key custody and rotation.
- Domain/DNS management.
- Monitoring runtime errors.
- Reviewing failed transactions and payout errors.
- Updating dependencies and redeploying tested changes.

## 9. Maintenance/update procedure

1. Make changes in a feature branch.
2. Review the diff before merging.
3. Run the available test suites.
4. Verify the application locally when practical.
5. Deploy to a non-production environment for validation.
6. Confirm database/API behavior.
7. Promote the tested change to Production.
8. Check Vercel runtime logs after deployment.

Do not make unreviewed production changes directly to a live deployment.

## 10. Client acceptance test

The buyer should confirm the following before accepting the project:

- Landing page loads publicly.
- Dashboard loads publicly.
- Wallet connection works on the selected network.
- A draft task can be created.
- A Devnet task can be funded.
- Deposit verification succeeds.
- Agent execution reaches review state.
- Approval releases the bounty to the configured payout address.
- Rejection refunds the funder.
- Transaction signatures are stored and visible in history.
- Missing configuration produces clear errors rather than server crashes.

## 11. Ownership boundary

The buyer's production environment should be fully independent from the original developer's personal infrastructure. This includes GitHub, Vercel, database, wallets, API keys, and domains.

The original developer's personal credentials should never be required for normal operation or maintenance after handover.

## 12. Current project state

AgentPay has verified production API/database behavior on Solana Devnet, including historical deposit, release, and refund transaction records. The current deployment intentionally does not contain a personal escrow private key. A buyer-owned `ESCROW_PRIVATE_KEY` is required before creating new funded escrow tasks in that deployment.

See the repository README and Step 6 documentation for architecture, environment configuration, API routes, testing, and Devnet details.
