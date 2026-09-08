# Travel Product Management System

An AI-assisted travel product catalog: create, search, and manage travel
products (tours, dining, transport, and more) with natural-language product
generation and natural-language search, built on a NestJS API, a React SPA,
and Supabase Postgres.

Built against [the spec](./AI%20Travel%20Product%20Management%20System.pdf)
— this README covers what a reviewer needs: what it is, how to run it, and
the decisions worth explaining.

## Architecture

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

- **`apps/web`** — React 19 + Vite + Tailwind v4 + shadcn-style components.
  Talks to the API over HTTP and to Supabase Auth directly (nothing else —
  all product data goes through the API).
- **`apps/api`** — NestJS 12, ESM. Owns every read/write of product data via
  a `service_role` Supabase client; verifies user identity locally via
  Supabase's JWKS endpoint (no round-trip to Supabase per request).
- **`packages/validation`** — zod schemas shared by both apps and by the
  AI layer's OpenAI structured-output contracts — one source of truth for
  what a "product" is, enforced identically whether the data came from a
  form, an AI draft, or a direct API call.
- **`supabase/migrations`** — the database schema, RLS policies, the
  validity-filtered view, and the dashboard RPC. `supabase/seed.sql` seeds
  ~20 demo products (several deliberately expired) plus a demo login.

## Quick start

### Option A — Docker (recommended, no local Node/pnpm needed)

```sh
# 1. Start a local Supabase stack (needs the Supabase CLI + Docker)
supabase start
supabase db reset   # applies migrations/ + seed.sql

# 2. Copy env files and fill in the Supabase keys `supabase start` printed
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp docker/.env.example docker/.env
# apps/api/.env needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# apps/web/.env and docker/.env need: VITE_SUPABASE_PUBLISHABLE_KEY
# (docker/.env supplies build-time args to `docker compose build` —
# separate from apps/*/.env, which are loaded at container runtime)
# All three need a real OPENAI_API_KEY to exercise the AI features live —
# without one, generation/image endpoints return a clear error and AI
# search gracefully falls back to keyword matching (see below).

# 3. Build and run
pnpm docker:prod
```

`pnpm docker:prod` builds both images, starts the stack, waits for it to
actually respond, and prints the URL to open — no manual `docker compose`
invocation, no port-guessing. Log in with the seeded demo account
(`demo@travel.local` / `DemoPassword123!`).

| Command | What it does |
|---|---|
| `pnpm docker:prod` | Build + start the production stack (nginx + api), print the URL |
| `pnpm docker:prod:logs` | Tail logs from both containers |
| `pnpm docker:prod:down` | Stop and remove the containers |
| `pnpm docker:dev` | Build + start the dev stack (hot-reloading Nest + Vite) |
| `pnpm docker:dev:logs` / `pnpm docker:dev:down` | Same, for the dev stack |

> **Local-Docker-testing caveat, not a production issue:** the API
> container reaches your locally-running Supabase stack via
> `host.docker.internal` (127.0.0.1 inside a container is the container's
> own loopback, not your host's — see the comments in `docker/compose.dev.yml`
> and `docker/compose.prod.yml`). Because of that, a JWT your browser
> obtains from `http://127.0.0.1:54321` carries that as its `iss` claim,
> which won't match what the containerized API expects when it reaches the
> *same* local instance via a different hostname — so a **fully
> authenticated round trip through the Dockerized API against a local
> Supabase CLI stack will 401 on token verification**, even though every
> other part of the stack (routing, headers, unauthenticated endpoints,
> the build itself) works exactly as in production. This is purely an
> artifact of one physical machine wearing two different hostnames in two
> different network namespaces at once. Against a **real hosted Supabase
> project** (the actual target for `compose.prod.yml`), there is only ever
> one canonical URL, reachable identically from the browser and the API —
> this gap does not exist there. For full local authenticated testing today,
> use Option B below.

### Option B — Local (pnpm), for full local testing

```sh
pnpm install
supabase start && supabase db reset
cp apps/api/.env.example apps/api/.env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
cp apps/web/.env.example apps/web/.env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

pnpm --filter @travel/validation build
pnpm --filter api start:dev    # http://localhost:3000
pnpm --filter web dev          # http://localhost:5173
```

Everything runs directly on the host here, so there's no container-vs-host
hostname split — `127.0.0.1` means the same thing everywhere.

### Running the test suite

```sh
pnpm turbo run build check-types lint test
```

77 API tests + 29 shared-schema tests, including frozen-clock date-boundary
tests, mocked-OpenAI tests for every AI failure mode (timeout, refusal,
schema-violation, injected-instruction), and query-compiler tests that
assert which PostgREST methods fire (the mechanism that proves the
injection-safety claims below, without needing a live database).

## What's implemented

**Core (spec requirements 1–5):** full product CRUD; a natural-language
"describe your product" box that drafts a product via OpenAI structured
outputs; a natural-language search box; automatic hiding of expired
products from listing/search (never from direct access — see
[Product validity](#product-validity)); a dashboard with Total/Active/Expired
counts.

**Bonus:** AI product-image generation (`gpt-image-1`, stored in Supabase
Storage); a responsive UI (table → cards below `md`, a bottom-sheet AI
dialog below `sm`); Excel export respecting the active filter; a
Docker Compose deployment with an nginx reverse proxy in front.

## Security controls

| Concern | Control |
|---|---|
| Prompt injection | Static system prompts (never interpolate user text into them); untrusted input delimited and marker-forgery-stripped (`apps/api/src/ai/sanitize.ts`); OpenAI strict Structured Outputs constrain the model's entire output to a closed schema — an injected instruction has no field to express itself in; zero tools/function-calling surface |
| Model output → query | AI search never produces SQL or a query string — only a validated `SearchFilter` object, compiled by the same code path plain listing uses (`apps/api/src/products/query-compiler.ts`) |
| PostgREST injection | Multi-value matching uses `.in()`, never string-built `.or()`/`.filter()`; keyword search uses `websearch_to_tsquery`, which never throws and treats operators as literal terms |
| AuthN | Supabase JWT verified locally via JWKS (`jose`, asymmetric — the API never holds signing capability), not the legacy shared HS256 secret; default-deny global guard |
| AuthZ | Mutations re-check `created_by = current user` in the query itself; a mismatch is a 404, not a 403 (no enumeration oracle) |
| RLS | Enabled on every table even though the API's `service_role` key bypasses it — it's what protects the public anon/publishable key's direct-to-PostgREST path (see `supabase/migrations/0002_rls.sql`) |
| Secrets | `VITE_`-prefixed values are the only ones in `apps/web` (statically inlined at build time — anything else is `undefined` in the browser); CI greps both source and the built bundle for a leaked server-only secret |
| Input validation | Every request body validated by a zod `strictObject` — unknown fields are **rejected**, not silently stripped (a client-supplied `createdBy` is a 400, not a no-op) |
| Rate limiting | Per-route named throttler buckets (`ai`: 10/min, `image`: 5/5min, `default`: 100/min), plus a separate daily-quota table independent of the per-minute buckets (stops a slow-drip cost attack) |
| HTTP hardening | `helmet` on the API; a real CSP, HSTS, and `X-Frame-Options` on nginx (not just documented — verified by an actual header dump against the built image, see `docker/nginx/` comments for the add_header-inheritance pitfall that first broke this) |
| Export safety | Any cell value starting with `=+-@` is prefixed with `'` (CSV/Excel formula-injection defense) |
| Supply chain | One lockfile, `--frozen-lockfile` in CI, lifecycle scripts blocked by default (pnpm), CI actions pinned to commit SHAs, non-root containers, multi-stage builds with a pruned production `node_modules` |

## Product validity

A product is "expired" purely from `valid_until < today (Asia/Colombo)` —
independent of the `status` field. This is enforced in exactly one place,
`products_listable` (a Postgres view), which every list/search/export read
goes through — not repeated `WHERE` clauses scattered across query
builders, which is exactly the kind of thing an AI-search code path would
be first to forget. `GET /products/:id` deliberately reads the *base*
table instead, so an expired product can still be opened and corrected;
the UI shows an "Expired" warning banner in that case.

**Total ≠ Active + Expired + Inactive** on the dashboard — status and
expiry are orthogonal (an inactive product can also be expired). See the
info note under the dashboard tiles.

## Notable design decisions

- **No pgvector.** The LLM already does the semantic work by normalizing a
  query into structured fields (destination, category, price range); the
  database only needs lexical matching on already-disambiguated terms,
  which `tsvector` + GIN handles exactly and instantly for a catalog this
  size. Embeddings would double AI latency on the search hot path for no
  benefit until the catalog is far larger or queries turn genuinely
  vibe-based ("somewhere romantic for an anniversary") rather than
  noun-based, which the spec's own example queries are not.
- **Image generation is synchronous**, not a queued job. `gpt-image-1` at
  low quality is ~5–15s; a BullMQ+Redis queue is real infrastructure for
  one bonus feature on a 24-hour assessment. At production scale this
  becomes a queued job + webhook.
- **AI search always degrades, never fails** — a heuristic keyword/regex
  fallback (`apps/api/src/ai/search/heuristic-fallback.ts`, zero external
  dependencies) covers every one of the spec's example queries and kicks
  in on any OpenAI timeout, refusal, or schema-violating response, so an
  API outage never turns into a 500 for the end user.
- **RLS style-src `'unsafe-inline'`** on the nginx CSP is a known, bounded
  relaxation — React inline styles and Radix's positioning logic set the
  `style` attribute directly. `script-src` has no such relaxation.
- **URI API versioning** (`/api/v1/*`, NestJS `VersioningType.URI` with
  `defaultVersion: '1'`). A breaking change ships as `/api/v2` beside v1
  rather than mutating the contract under a deployed SPA. Liveness and
  readiness stay unversioned at `/api/health` so orchestrators track one
  stable path. The web client's base URL (`VITE_API_URL`, default
  `/api/v1`) and nginx's `/api/` proxy prefix cover both.

## Repository layout

```
apps/
  api/      NestJS API — feature folders (products/, ai/, health/, common/)
  web/      React SPA — feature folders (features/products, features/ai, ...)
packages/
  validation/   shared zod schemas (the AI wire contracts + the DB row shape)
supabase/
  migrations/   schema, RLS, the validity view, storage policies
  seed.sql      demo data
docker/
  compose.dev.yml / compose.prod.yml
  nginx/        reverse proxy + security headers
scripts/
  docker-up.mjs   build/start/wait-for-ready wrapper behind `pnpm docker:*`
.github/workflows/ci.yml
```

## Submission checklist

- [x] Source code
- [x] Database script — `supabase/migrations/` + `supabase/seed.sql`
- [x] README with setup instructions — this file
- [x] `.env.example` without real keys — `apps/api/.env.example`,
      `apps/web/.env.example`
