# AgentPay — Step 8: Custom-Domain Readiness

## Purpose

Prepare AgentPay for a client-owned custom domain without changing the current production application or requiring a domain purchase during development.

## Current production domain

The application is currently reachable through its Vercel production domain. The Vercel project remains the deployment source of truth until client handover is complete.

## Client domain model

The recommended final setup is:

`client domain → Vercel Production → AgentPay application → database/API`

The client should own the domain and DNS account. Do not register or permanently bind a personal domain to the delivered client project unless explicitly agreed.

## Domain configuration checklist

- [ ] Client owns or controls the production domain.
- [ ] Client confirms the desired hostname, for example `app.example.com` or `agentpay.example.com`.
- [ ] Add the hostname to the Vercel project under Domains.
- [ ] Configure the DNS records requested by Vercel at the client's DNS provider.
- [ ] Wait for DNS propagation and Vercel domain verification.
- [ ] Confirm HTTPS is active.
- [ ] Confirm the production hostname serves the current production deployment.
- [ ] Test `/app` from the custom hostname.
- [ ] Test `/api/health` from the custom hostname.
- [ ] Test `/api/tasks` from the custom hostname.
- [ ] Verify API requests use the intended production origin.
- [ ] Verify no preview/development hostname is presented to clients.

## Environment and secrets

A domain change does not require putting secrets into the repository.

Client-owned production secrets remain in Vercel Environment Variables, including when required:

- `DATABASE_URL`
- `ESCROW_PRIVATE_KEY`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Any future provider/API credentials documented by the application

Never commit secret values to GitHub.

## Escrow boundary

The current development deployment intentionally does not contain a personal escrow private key. A client must configure their own escrow wallet for funded production tasks.

The custom domain can be configured independently of escrow configuration.

## Verification after domain cutover

The acceptance test should confirm:

1. Custom hostname resolves to Vercel.
2. `/app` loads the AgentPay workspace.
3. `/api/health` reports the service as healthy.
4. `/api/tasks` returns the expected database-backed records.
5. Existing transaction history remains accessible.
6. Authentication/access controls, if enabled later, apply to the intended hostname.
7. No old preview hostname is used in client-facing documentation.

## Rollback

If the custom domain has a problem, keep the Vercel production hostname available while DNS is corrected. Do not delete the Vercel project or deployment merely because DNS verification is pending.

## Handover requirement

The final domain should be client-owned. After handover, the client should control:

- Domain registrar/DNS
- Vercel team/project access
- Database account
- Production environment variables and secrets
- Escrow wallet/key
- AI provider credentials

## Status

Step 8 is **ready for client domain configuration**. No custom domain is being purchased or bound as part of this documentation step.