# Travel Product Management System

An AI-assisted travel product catalog to create, search, and manage travel products (tours, dining, transport). Features include natural-language product generation, natural-language search, and AI image generation.

**Tech Stack:**

- **Frontend:** React 19, Vite, Tailwind v4, shadcn-style components (`apps/web`)
- **Backend:** NestJS 12 (`apps/api`)
- **Database & Auth:** Supabase (Postgres)
- **AI:** OpenAI API (Structured outputs, `gpt-image-1`)

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Node.js & pnpm](https://pnpm.io/installation) (for local dev)

### 1. Database Setup

Start your local Supabase stack and seed the database with demo data:

```sh
supabase start
supabase db reset
```

_Note: Save the `API URL` and `service_role key` printed in your terminal._

### 2. Environment Variables

Copy the example environment files:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp docker/.env.example docker/.env
```

**Required Keys to Fill:**

- `apps/api/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- `apps/web/.env` & `docker/.env`: `VITE_SUPABASE_PUBLISHABLE_KEY`
  _(Note: An `OPENAI_API_KEY` is required for AI features. Without it, search falls back to keyword matching)._

### 3. Run the Application

You can run the app via Docker (closest to production) or locally via pnpm.

**Option A: Docker (Recommended)**

```sh
pnpm docker:dev
```

Once running, log in with the seeded demo account:

- **Email:** `demo@travel.local`
- **Password:** `DemoPassword123!`

> ⚠️ **Local Docker Auth Caveat**: When running the API via Docker against a _local_ Supabase CLI instance, authentication may fail with a 401. This is due to a known issuer mismatch between `localhost` (browser) and `host.docker.internal` (container). **For full authenticated local testing, use Option B.**

**Option B: Local Development (pnpm)**

```sh
pnpm install
pnpm --filter @travel/validation build
pnpm --filter api start:dev    # Starts API on http://localhost:3000
pnpm --filter web dev          # Starts SPA on http://localhost:5173
```

---

## 🧪 Testing

Run the full test suite (84 API tests + 37 shared-schema tests):

```sh
pnpm turbo run build check-types lint test
```

_Tests include frozen-clock date boundaries, mocked OpenAI failure modes, and PostgREST query-compiler assertions._

---

## 📁 Project Structure

```text
├── apps/
│   ├── api/                 # NestJS backend (features, AI, health)
│   └── web/                 # React SPA
├── packages/
│   └── validation/          # Shared Zod schemas (API, DB, and AI contracts)
├── supabase/
│   ├── migrations/          # DB schema, RLS policies, views
│   └── seed.sql             # Demo data
└── docker/                  # Compose files and Nginx configs
```

---

## 🏗️ Architecture & Decisions

### Data Flow

```
                         Browser
                            │
                 ┌──────────┴──────────┐
                 │   nginx (port 80)   │  static SPA + reverse proxy
                 └──────────┬──────────┘
                            │ same-origin /api/* proxy
                 ┌──────────┴──────────┐
                 │   NestJS API        │  auth guard · validation · throttling
                 │   (apps/api)        │
                 └────┬───────────┬────┘
                      │           │
              ┌───────┘           └───────┐
              ▼                           ▼
      Supabase Postgres              OpenAI API
      (service_role client,          (structured outputs:
       RLS as defense in depth)       generation, search, images)
```

### Notable Design Decisions

- **Single Source of Truth:** `packages/validation` shares Zod schemas across the DB, React frontend, NestJS backend, and OpenAI strict structured outputs.
- **No pgvector:** Lexical matching (`tsvector` + GIN) handles the current catalog size perfectly. The LLM handles the semantic normalization (extracting destinations/prices) prior to the database query.
- **Graceful AI Degradation:** If the OpenAI API times out or fails, search automatically degrades to a heuristic keyword/regex fallback to prevent 500 errors.
- **Product Validity (Expiration):** Products expire when `valid_until < today (Asia/Colombo)`. This is enforced via a single Postgres view (`products_listable`) rather than scattered `WHERE` clauses.

### Security Controls

| Feature              | Implementation                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt Injection** | Static system prompts; untrusted input is delimited and marker-stripped. Strict structured outputs prevent execution of injected instructions. |
| **AuthN & AuthZ**    | Supabase JWT verified locally via asymmetric JWKS. Global default-deny guards. Mutations re-check `created_by` to prevent IDOR.                |
| **SQL/PostgREST**    | `websearch_to_tsquery` escapes inputs. Multi-value matches use `.in()`, never dynamic string-built `.or()` logic.                              |
| **Rate Limiting**    | Route-specific buckets (AI: 10/min, Image: 5/5min, Default: 100/min) + daily DB quota tables.                                                  |
| **HTTP Hardening**   | Helmet (API) + CSP, HSTS, and X-Frame-Options configured via Nginx.                                                                            |
| **Export Safety**    | CSV formula injection prevented by prefixing `=+-@` cells with `'`.                                                                            |

---

## ✨ Features Implemented

- **Core:** Full product CRUD, AI natural-language product drafting, AI natural-language search, automatic expiration filtering, and a metrics dashboard.
- **Bonus:** Synchronous AI image generation (`gpt-image-1`) stored in Supabase, responsive UI (mobile-friendly bottom sheets/cards), active-filter Excel exports, and Docker Compose deployment.
