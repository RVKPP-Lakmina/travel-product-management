# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# base -- shared setup for both build paths. Manifests only in this layer
# (not source) so `pnpm install` is cached across code-only rebuilds.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache tini
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

# ----------------------------------------------------------------------------
# development -- bind-mounted by docker/compose.dev.yml, runs the Nest dev
# server with hot reload.
# ----------------------------------------------------------------------------
FROM base AS development
COPY . .
RUN pnpm install
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ----------------------------------------------------------------------------
# deps -- full workspace install, locked. Separate stage from `build` so a
# source-only change doesn't invalidate the (slow) install layer.
# ----------------------------------------------------------------------------
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# build -- compiles @travel/validation then the API. Both packages declare
# "files": ["dist"] in package.json -- required for the `pnpm deploy` step
# below, since dist/ is gitignored and `pnpm deploy` packs a package the
# same way `npm pack` would (falling back to .gitignore-based exclusion
# when no `files` field is present, which would otherwise silently drop
# the compiled output from the deployed image).
# ----------------------------------------------------------------------------
FROM deps AS build
RUN pnpm --filter @travel/validation build
RUN pnpm --filter api build

# ----------------------------------------------------------------------------
# pruned -- `pnpm deploy` produces a self-contained directory: the api
# package plus its resolved PRODUCTION dependencies only (devDependencies
# and the rest of the monorepo excluded), with workspace deps like
# @travel/validation copied in as real files rather than symlinks. This is
# what keeps the final image from carrying the whole monorepo's
# node_modules.
#
# `--legacy`: pnpm v10+ defaults to refusing to deploy unless
# `injectWorkspacePackages: true` is set workspace-wide -- but that setting
# also changes how EVERY local `pnpm install` links workspace packages
# (hard-copy instead of symlink), which breaks the fast "rebuild
# @travel/validation, see it immediately" local dev loop. `--legacy` opts
# just this one deploy command into the older (still fully supported)
# symlink-free packing behavior, with zero effect on local installs.
# ----------------------------------------------------------------------------
FROM build AS pruned
RUN pnpm --filter api deploy --prod --legacy /prod/api

# ----------------------------------------------------------------------------
# production -- the runtime image. Non-root, read-only-friendly (no writes
# outside what compose.prod.yml mounts as tmpfs), tini as PID 1 so SIGTERM
# reaches Nest's shutdown hooks (app.enableShutdownHooks() in main.ts)
# instead of killing the process group directly.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS production
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=pruned --chown=node:node /prod/api ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
