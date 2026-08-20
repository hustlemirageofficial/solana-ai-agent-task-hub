# AgentPay Database Setup

AgentPay keeps its database layer inside this repository so the product can be delivered to a client without shipping a vendor account or database credentials.

## What is included

- `src/db.ts` — server-only database connection using `DATABASE_URL`.
- `src/server/schema.ts` — idempotent PostgreSQL schema creation.
- `src/server/tasks.ts` — task and transaction data access plus database health checks.
- `.env.example` — safe configuration template; no real credentials.

## Client deployment model

The client supplies their own PostgreSQL connection string as the server-side `DATABASE_URL` environment variable. The value must never be committed to GitHub or exposed to the browser.

The repository does not require a pre-populated database dump. On first database-backed use, AgentPay applies the schema idempotently.

## Database objects

### `tasks`

Stores the task lifecycle and escrow/payment metadata:

- task identity, title, description, and selected agent
- currency and bounty amount in base units
- lifecycle status
- funder and escrow addresses
- deposit, release, and refund signatures
- agent result and payout error information
- creation/update timestamps

### `txns`

Stores verifiable payment events:

- task reference
- `deposit`, `release`, or `refund`
- currency and amount
- sender and recipient
- Solana transaction signature
- confirmation state
- creation timestamp

A unique index on transaction signatures prevents the same signature from being recorded more than once.

## Safe configuration

Copy `.env.example` to the deployment environment and configure:

```text
DATABASE_URL=<client PostgreSQL connection string>
```

Do not put the real value in source code, GitHub, screenshots, frontend variables, or public documentation.

## Verification sequence

After `DATABASE_URL` is configured:

1. Start the server.
2. Check `GET /api/health` and confirm the database status is `ok`.
3. Create a task and confirm it is persisted.
4. Fund a Devnet task and verify the deposit signature is persisted.
5. Verify the task moves through execution and review states.
6. Approve or reject the result.
7. Confirm the release/refund signature and transaction history are persisted.
8. Restart the server and confirm the task/history remain available.

The production database credential is intentionally not part of the repository. The repository contains the portable application-side database layer; the buyer supplies the database connection during deployment.
