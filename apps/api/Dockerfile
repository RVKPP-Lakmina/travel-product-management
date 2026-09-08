FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

FROM base AS development

COPY . .

RUN pnpm install

WORKDIR /workspace/apps/api

EXPOSE 3000

CMD ["pnpm", "start:dev"]