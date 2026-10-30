# syntax=docker/dockerfile:1
# Images of the Cubeship demo (see README.md): one build, three targets.
#
#   docker build -f infra/deploy/Dockerfile --target api|worker|web \
#     --build-arg SITE_URL=https://… .
#
# The web inlines NEXT_PUBLIC_* and the /api rewrite (API_URL) at build time,
# so the site URL and the API's internal address are build arguments.
ARG NODE_IMAGE=node:24.21.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

FROM base AS build
# Dependencies first, from the lockfile only, so a source change reuses them.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile
ARG SITE_URL
ARG API_URL=http://cubeship-arenaz-production-api:4200
ARG NEXT_PUBLIC_DEMO_MODE=true
RUN test -n "$SITE_URL" || (echo 'SITE_URL é obrigatório' >&2 && exit 1)
RUN NEXT_PUBLIC_SITE_URL="$SITE_URL" API_URL="$API_URL" \
    NEXT_PUBLIC_DEMO_MODE="$NEXT_PUBLIC_DEMO_MODE" \
    pnpm turbo run build --env-mode=loose --output-logs=errors-only
# Keep the build output, swap the dependencies for production ones only.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    find . -name node_modules -type d -prune -exec rm -rf {} + \
    && pnpm install --offline --frozen-lockfile --prod \
    && rm -rf apps/web/.next/cache

# One shared layer for the three images, so the registry stores it once.
FROM ${NODE_IMAGE} AS runtime
COPY --from=build --chown=node:node /repo /repo
USER node

FROM runtime AS api
WORKDIR /repo/apps/api
EXPOSE 4200
CMD ["node", "dist/main.js"]

FROM runtime AS worker
WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]

FROM runtime AS web
WORKDIR /repo/apps/web
EXPOSE 3200
CMD ["node", "scripts/next.mjs", "start"]
