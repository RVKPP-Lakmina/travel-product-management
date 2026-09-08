# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
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
# ----------------------------------------------------------------------------
FROM base AS development
COPY . .
RUN pnpm install
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
FROM deps AS build
RUN pnpm --filter @travel/validation build
RUN pnpm --filter api build

# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
FROM build AS pruned
RUN pnpm --filter api deploy --prod --legacy /prod/api

# ----------------------------------------------------------------------------
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
