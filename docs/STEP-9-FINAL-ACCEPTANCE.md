# AgentPay — Step 9: Final Acceptance & Demo

## Purpose

This document defines the final client-facing acceptance pass for AgentPay. It separates verified current capabilities from client-supplied production configuration.

## Verified now

- Vercel Production deployment is live.
- `/api/health` returns a healthy service response with `db: ok`.
- `/api/tasks` reads persisted task records.
- Individual task retrieval works.
- `/api/txns` reads persisted transaction history.
- The dashboard loads persisted tasks and settlement states.
- Historical Solana Devnet deposit, release, and refund signatures are stored and displayed.
- Missing escrow configuration produces a controlled configuration message rather than the previous read-only filesystem error.
- No personal wallet private key is required for the current client-ready deployment.

## Final demo flow

1. Open the public production landing page.
2. Enter the AgentPay workspace.
3. Review existing task history and settlement states.
4. Open an existing task and verify its result and settlement metadata.
5. Review transaction history.
6. Open Create Task and verify that the form loads.
7. Without a client escrow key, verify that funded-task creation is blocked with a clear configuration message.
8. For a real client acceptance test, configure the client's own escrow key in Vercel Production and use a small Devnet bounty.
9. Verify the complete funded workflow: fund → execute → review → approve/release or reject/refund.
10. Verify transaction signatures and task state are persisted after the workflow.

## Client-owned production configuration

The client must provide and control:

- `DATABASE_URL`
- `ESCROW_PRIVATE_KEY`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` if real LLM execution is required
- Production custom domain and DNS access

Secrets must be entered through the deployment platform's environment-variable controls. They must not be committed to GitHub, placed in source code, or shared in chat.

## Acceptance criteria

AgentPay is ready for handover when:

- Production deployment is Ready.
- Public landing page and `/app` load without errors.
- Database health is `ok`.
- Tasks and transactions can be read from production.
- Client-owned escrow configuration is present for funded-task testing.
- A small Devnet end-to-end transaction is confirmed.
- Approval/release and rejection/refund paths are verified.
- Transaction signatures are persisted and visible.
- Client domain is connected and HTTPS is active, if a custom domain is being used.
- No development-only secrets or personal wallets remain in the production configuration.

## Current handover boundary

The current deployment is intentionally safe without a personal escrow key. Historical Devnet evidence is retained in the database, while new funded transactions require the future client's escrow configuration. This is a deliberate security boundary, not a production defect.

## Rollback

If a client acceptance deployment introduces a regression, redeploy the last known-good Vercel Production deployment. Do not overwrite or delete the database while troubleshooting an application deployment.
