FROM node:22-alpine AS development

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

COPY . .

RUN pnpm install

WORKDIR /workspace/apps/web

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]