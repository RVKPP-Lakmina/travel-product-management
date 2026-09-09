# AGENTS.md

Guidance for AI coding agents working in this repository. Humans: see
[`README.md`](./README.md) for setup and architecture, and
[`ui-architecture.md`](./ui-architecture.md) for the design system.

## What this is

An AI-assisted travel-product catalog. pnpm + Turborepo monorepo:

| Path | Stack | Role |
|---|---|---|
| `apps/api` | NestJS 12, ESM, Zod v4 | Owns every read/write of product data via a Supabase `service_role` client; verifies user JWTs locally against Supabase's JWKS |
| `apps/web` | React 19, Vite 8, Tailwind **v4**, TanStack Query v5, react-router v7 | SPA. Talks to the API over HTTP and to Supabase Auth directly — nothing else |
| `packages/validation` | Zod v4 schemas | **Single source of truth** for the product shape and the AI wire contracts. Consumed by both apps |
| `packages/typescript-config`, `packages/eslint-config` | — | Shared config |
| `supabase/migrations` | SQL | Schema, RLS, `security_invoker` views, RPCs |

## Commands

Run from the repo root. Turbo handles ordering and caching.

```sh
pnpm setup          # install + build @travel/validation (do this first on a fresh clone)
pnpm check          # lint + check-types + test + build  — run before every commit
pnpm dev            # all dev servers (api :3000, web :5173)
pnpm test           # all tests
pnpm lint           # oxlint (api) + eslint (web)
pnpm docker:dev     # hot-reload stack in containers
pnpm docker:prod    # production stack (nginx + api)
```

`pnpm check` must be green before you commit. There is no `web` test suite —
`apps/web` is covered by `check-types` + `lint` + `build` only.

## Hard constraints — do not violate

- **Tailwind v4 has no `tailwind.config.js`.** All theme config lives in
  `apps/web/src/index.css` under `@theme inline` and the token blocks above
  it. Do not create a JS/TS Tailwind config.
- **`packages/validation` is the only place a product shape is defined.**
  Never redeclare product fields in `apps/api` or `apps/web` — import from
  `@travel/validation`. A schema change there must land in the **same commit**
  as any migration it depends on.
- **The API is ESM.** Relative imports need the `.js` extension
  (`./products.service.js`), even from `.ts` files.
- **`apps/api/src/products/query-compiler.ts` must never read the base
  `products` table.** It only ever reads `products_listable` (the
  validity-filtered view). This is the mechanism that stops the AI search
  path from leaking expired rows — see the comment block in that file.
  Expired rows are reachable only through the separate `products_expired`
  view / `GET /api/v1/products/expired`.
- **Model output never becomes executable text.** No SQL, no PostgREST
  filter strings, no fetched URLs, no unescaped HTML. AI generation only
  populates a form the user re-submits through the normal validated
  `POST /products`; AI search only produces a `SearchFilter` object
  compiled by `query-compiler.ts`. See the header comment in
  `apps/api/src/ai/ai.controller.ts`.
- **`@nestjs/throttler` applies every registered named bucket to every
  route.** Keep exactly one bucket in `ThrottlerModule.forRoot` (`default`,
  100/min). Tighten it per-handler with `@Throttle({ default: {...} })` —
  never add a second named bucket, or it silently governs unrelated routes.
- **Secrets:** anything `VITE_`-prefixed is inlined into the public browser
  bundle. Only the Supabase URL + anon/publishable key may be `VITE_`.
  `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only, loaded
  at container runtime, never a build arg. CI greps `apps/web` source and
  the built bundle for leaks.
- **URI API versioning.** All routes are under `/api/v1/*`
  (`VersioningType.URI`, `defaultVersion: '1'`). Health/readiness stay
  unversioned at `/api/health` (`VERSION_NEUTRAL`). A breaking change ships
  as `/api/v2` beside v1 — add `@Version('2')` to the changed handler, don't
  mutate v1.
- **Zod v4** — `z.iso.date()` / `z.iso.datetime()`, not the removed
  `z.string().datetime()`. SQL that builds JSON for a Zod boundary must emit
  a trailing `Z`, not `+00:00`.

## Product validity

"Expired" = `valid_until < today (Asia/Colombo)`, independent of `status`.
Enforced in exactly one place: the `products_listable` view. Every
list/search/export read goes through it. `GET /products/:id` reads the base
table on purpose so an expired product can still be opened and renewed.
Dashboard `Total ≠ Active + Expired` — status and expiry are orthogonal.

## Code style

- Match the surrounding file — naming, structure, comment density.
- Comments explain **why**, not what. Several files carry load-bearing
  rationale comments that `README.md` cites as documentation-of-record;
  don't strip those. Don't add narration about your own change process.
- Feature-folder layout: `apps/api/src/<feature>/`,
  `apps/web/src/features/<feature>/`.
- API errors: throw the Nest HTTP exceptions; the global filter shapes the
  response `{ code, message, fieldErrors? }`.
- Web data access goes through `apps/web/src/lib/api.ts` and the hooks in
  `features/*/hooks.ts` — don't `fetch` directly from components.

## Commits

- **One logical change per commit**, file-by-file when the user asks for it.
- **Single-line message. No body. No `Co-Authored-By`, no `Signed-off-by`,
  no trailers of any kind.**
- Conventional prefix: `feat` / `fix` / `docs` / `chore` / `build` /
  `refactor` `(scope): lowercase summary`.
- Don't commit or push unless asked. Never `--no-verify`.

## Docker notes

- Local `supabase start` + the containerised API: the browser's JWT carries
  `iss=http://127.0.0.1:54321/...` while the API reaches Supabase via
  `host.docker.internal` — issuer mismatch → 401. `SUPABASE_JWT_ISSUER`
  pins it. Against a real hosted Supabase there is one URL and no gap.
- Dev compose bind-mounts the repo but masks every `node_modules` with a
  named volume — the host's (Windows) tree is not valid in the Linux
  container.
- File-watching across the Windows bind mount is unreliable; after editing
  `apps/api/src` you may need `pnpm docker:dev` → `docker compose ...
  restart api`.
