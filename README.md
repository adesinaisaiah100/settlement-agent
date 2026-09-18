# 🏛️ Settlement Agent

> **Autonomous Multi-Stream Settlement & Reconciliation Engine for CAS Practices**

Settlement Agent eliminates the **"Net Payout Trap"** for high-growth e-commerce and multi-channel brands. It automatically ingests processor payouts (Stripe, Shopify, Mindbody), deconstructs lumped sums into gross sales, fees, and state sales taxes, verifies the fundamental double-entry invariant ($\sum \text{Debits} - \sum \text{Credits} \equiv 0.00$), and stages draft manual journals into Xero and QuickBooks Online.

---

## 🏗️ Architecture Blueprint (Blueprint A)

- **Frontend (`apps/web`)**: React (Vite SPA) + Tailwind CSS (Strict Anti-Pill Geometry) + TanStack Table v8.
- **API Gateway (`apps/api`)**: Hono on Cloudflare Workers (0ms cold start, cryptographic HMAC webhook verification).
- **Durable Agent Workflow (`apps/api`)**: Cloudflare Workflows multi-step state machine with an automatic 3-retry self-repair loop.
- **AI Deconstruction (`apps/api`)**: Vercel AI SDK (`generateObject` with strict Zod schema to Claude 3.5 Sonnet).
- **The Balancing Tool (`apps/api`)**: Deterministic mathematical invariant gate ($\sum DR \equiv \sum CR$).
- **Database & Edge State**: Cloudflare D1 (SQLite at the edge) via Drizzle ORM.
- **Observability & Audit (`apps/api`)**: Langfuse OpenTelemetry client + Cloudflare AI Gateway.
- **Shared Contracts (`packages/shared`)**: Shared Zod schemas and 5-digit Chart of Accounts constants.

---

## 📁 Repository Structure

```
settlement-agent/
├── apps/
│   ├── web/          # React + Vite Frontend Dashboard
│   └── api/          # Hono + Cloudflare Workflows Edge Backend
├── packages/
│   └── shared/       # Shared TypeScript Types, Zod Schemas & COA
├── package.json      # Monorepo workspaces configuration
└── tsconfig.base.json
```
