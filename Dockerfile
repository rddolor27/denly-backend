# syntax=docker/dockerfile:1

# denly-api image for Cloud Run (ADR 0013). The same image runs the service
# (`node dist/main.js`) and the migrate / seed Cloud Run jobs (docs/deployment.md).
#
# Base: node:24-bookworm-slim (Node 24 LTS on Debian 12), pinned by digest so base updates are
# explicit and reviewable. To bump, replace the digest in BOTH `FROM node:...` lines with:
#   docker pull node:24-bookworm-slim
#   docker inspect --format '{{index .RepoDigests 0}}' node:24-bookworm-slim

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
ENV PATH="$PNPM_HOME:$PATH"
# pnpm through corepack (bundled with Node 24); same version as package.json "packageManager".
RUN corepack enable pnpm && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app

# Production dependencies only. A fresh `--prod` install (instead of `pnpm prune --prod` after the
# build) depends on nothing but package.json + pnpm-lock.yaml, so this layer stays cached across
# source-only changes and never inherits anything the build stage left in node_modules.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# Drop declaration files and build info, then fail the build if a runtime entry point or data file
# is missing: the seed data ships via nest-cli assets, the rules bundle via its JSON import.
RUN pnpm build \
 && find dist -type f \( -name '*.d.ts' -o -name '*.tsbuildinfo' \) -delete \
 && test -f dist/main.js \
 && test -f dist/data-source.js \
 && test -f dist/seeders/run-seed.js \
 && test -f dist/seeders/data/taxonomy.yaml \
 && test -f dist/seeders/data/ingredient-overlay.json \
 && test -f dist/modules/ingredient-intelligence/data/rules-bundle.json

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
# Root-owned and read-only for the runtime user; the app writes only to stdout/stderr.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# package.json carries "type": "module" — dist/ is ESM and will not load without it.
COPY package.json ./
USER node
# Cloud Run injects PORT (8080 unless configured otherwise).
EXPOSE 8080
CMD ["node", "dist/main.js"]
