# AgentPay — CTO New Transfer Blueprint

This document is the canonical transfer blueprint for reproducing the existing AgentPay Vercel/GitHub product vision in the CTO New working deployment.

## Source of truth

- Preserve the existing Vercel/GitHub implementation as the reference and backup.
- Do not delete or replace the existing landing-page implementation during transfer.
- CTO New remains the working deployment because its PostgreSQL/database layer and live test are already verified.
- Transfer the product UI/UX and application structure into CTO New without copying production secrets.

## Existing landing-page vision to reproduce

### Global visual language

- Product name: `AGENT-PAY`
- Premium dark Web3/SaaS presentation.
- Background foundation: near-black navy (`#030711`) with subtle violet/blue/emerald atmospheric gradients.
- Thin white borders with low opacity.
- White/silver primary typography, slate secondary text, violet accent, emerald live/status accent.
- Large bold display typography with tight tracking.
- Generous spacing and restrained rounded corners.
- Desktop-first composition that collapses cleanly on mobile.
- Backdrop blur for sticky navigation and small status panels.
- Avoid heavy imagery that harms performance; the hero is implemented as CSS/UI visualization.

### Header

- Sticky top navigation.
- AGENT-PAY wordmark on the left.
- Desktop navigation: Platform / How it works.
- Primary CTA: `Open AGENT-PAY` linking to `/app`.
- Mobile navigation remains compact and functional.

### Hero

Eyebrow:
`SOLANA PAYMENT INFRASTRUCTURE / DEVNET`

Headline:
`Pay AI agents. With confidence.`

Supporting message:
`AGENT-PAY gives autonomous work a payment layer you can control. Fund tasks through on-chain escrow, verify the result, and release payment only when the work is approved.`

CTAs:
- `Launch AGENT-PAY` → `/app`
- `Explore the workflow` → `#how-it-works`

Hero visual must reproduce the existing AgentVisual concept:

`AI AGENT → SOLANA → ESCROW`

- AI Agent state: EXECUTING
- Network state: SOLANA
- Escrow state: locked amount/status
- Animated rail/traveler effect.
- Violet-to-emerald lighting.
- Live payment-flow indicator.
- Responsive aspect ratio and mobile-safe sizing.

### Platform section

Heading:
`Payments built for autonomous work.`

Message:
`AI agents can execute tasks. AGENT-PAY makes the payment accountable—keeping the final decision with the task owner.`

Four workflow cards:

1. Fund — Create a task and lock the bounty in on-chain escrow.
2. Execute — Let your agent complete the work while funds remain protected.
3. Verify — Review the result before authorizing the payout.
4. Settle — Approve the work to release payment—or recover the escrow.

Cards use numbered nodes and a subtle animated workflow track.

### Live settlement chain

Section label:
`LIVE SETTLEMENT CHAIN`

Heading:
`Watch the payment move through the system.`

Five stages:

1. PROMPT — Task created
2. ESCROW FUNDED — 2.50 SOL locked (demo visualization only)
3. AGENT EXECUTION — Work in progress
4. RESULT VERIFIED — Review passed
5. SETTLEMENT — Ready to release

Important: demo/example values must never be represented as real transaction data.

### Final CTA

Label:
`THE PAYMENT LAYER FOR AI AGENTS`

Heading:
`Give autonomous work a payment system you can verify.`

Message:
`Connect a Solana wallet, create a task, and keep the final payment decision in your hands.`

CTA:
`Open AGENT-PAY` → `/app`

### Footer

- AGENT-PAY wordmark.
- Solana devnet / escrow / releases / refunds positioning.
- Launch app link.

## Application/dashboard vision

The CTO New application must retain its proven database implementation while matching the product language of the Vercel application:

- Wallet connection/authentication.
- Task creation.
- Task list and management.
- Escrow funding.
- Agent execution state.
- Result review/approval.
- Refund/recovery.
- Transaction/status feedback.
- Loading, empty, error and success states.
- Mobile-friendly wallet/task interactions.

## Database rule

CTO New's working PostgreSQL integration is the technical foundation. Do not replace it with the old demo/in-memory implementation.

Production credentials must remain server-side. Never commit a real `DATABASE_URL` to GitHub, expose it to frontend code, or put it in screenshots/documentation.

The repository-side database layer should remain portable through `DATABASE_URL`, schema initialization, task persistence, transaction persistence, and health checks.

## AgentPay Steps 1–9

1. Reliable live deployment — DONE in the existing deployments; CTO New is the current working deployment.
2. Professional website — reproduce the complete Vercel/GitHub visual system above.
3. High-resolution hero visual — reproduce the AgentVisual/AI Agent → Solana → Escrow experience with responsive performance.
4. Complete app/dashboard — integrate wallet, tasks, escrow, agent execution, approval, refund, transaction/status feedback and errors with the working database.
5. Solana Devnet testing — wallet, transactions, escrow, execution, approval, refund, edge cases and mobile testing.
6. Professional GitHub repository — README, setup, environment variables, architecture, screenshots, demo and Devnet instructions.
7. Buyer handover preparation — deployment, environment, access, admin and maintenance instructions.
8. Custom-domain readiness — owner-controlled domain/DNS and production deployment documentation.
9. Professional demo/presentation — product workflow, screenshots, architecture, Devnet demonstration and feature overview.

Step 10/pricing/selling is explicitly out of scope for this build phase.

## Transfer acceptance criteria

The CTO New version is considered visually transferred only when:

- The landing page has the same hierarchy, visual language and workflow concept as the Vercel reference.
- `/app` remains connected to the working PostgreSQL database.
- Wallet connection works.
- Database-backed task creation and persistence work.
- Escrow/transaction states are represented correctly.
- The live Devnet test passes.
- Mobile and desktop layouts are verified.
- Only one final production URL is presented to a client.
- Vercel remains available as a private backup/reference until parity and testing are complete.
