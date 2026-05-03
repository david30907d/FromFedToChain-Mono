# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/pipeline/package.json packages/pipeline/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/pipeline packages/pipeline
COPY prompts prompts
RUN pnpm --filter @from-fed-to-chain-mono/pipeline build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/pipeline/node_modules ./packages/pipeline/node_modules
COPY --from=build /app/packages/pipeline/package.json ./packages/pipeline/package.json
COPY --from=build /app/packages/pipeline/dist ./packages/pipeline/dist
COPY --from=build /app/prompts ./prompts

WORKDIR /app/packages/pipeline
EXPOSE 3000
CMD ["node", "dist/index.js"]
