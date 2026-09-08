# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# base -- shared manifest-only layer, mirrors apps/api/Dockerfile's pattern.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

# ----------------------------------------------------------------------------
# development -- unchanged: bind-mounted by docker/compose.dev.yml.
# ----------------------------------------------------------------------------
FROM base AS development
COPY . .
RUN pnpm install
WORKDIR /workspace/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ----------------------------------------------------------------------------
# build -- compiles @travel/validation, then the Vite production bundle.
#
# VITE_* values are build ARGs, not runtime env vars -- Vite inlines
# `import.meta.env.VITE_*` into the JS bundle at build time, so there is no
# "set it at container start" option. `VITE_API_URL` defaults to `/api`
# (relative), which is what makes nginx's same-origin reverse proxy (see
# docker/nginx/default.conf) work without the browser needing to know the
# API's real host at all.
# ----------------------------------------------------------------------------
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @travel/validation build

# `docker build` prints a generic "SecretsUsedInArgOrEnv" lint warning on
# VITE_SUPABASE_PUBLISHABLE_KEY below -- that's a false positive here. This
# key is PUBLIC BY DESIGN (it's the anon/publishable key, meant to ship in
# a browser bundle; Row Level Security is what actually protects it -- see
# supabase/migrations/20260908000002_rls.sql and apps/web/.env.example).
# The linter can't distinguish that from an actual secret by name alone.
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

RUN pnpm --filter web build

# ----------------------------------------------------------------------------
# production -- static files served by nginx, unprivileged (no root, no
# CAP_NET_BIND_SERVICE) on port 8080. See docker/nginx/default.conf.
# ----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
