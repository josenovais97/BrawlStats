# Next.js standalone on arm64 (Ampere A1 / Hetzner CAX). Multi-stage so the
# runtime image carries neither the toolchain nor the dev dependencies.
#
# Debian slim rather than Alpine on purpose: Prisma 7 talks to Postgres through
# @prisma/adapter-pg, which is pure JS, but musl has bitten enough Node native
# deps that the ~40 MB is worth not thinking about it.
# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies -----------------------------------------------------------
# prisma/ and prisma.config.ts are copied here because `postinstall` runs
# `prisma generate`, which reads both. Without them npm ci fails on a clean
# build.
FROM base AS deps
# Pinned to the npm that wrote package-lock.json. The image's own npm resolves
# @tailwindcss/oxide-wasm32-wasi's nested tree differently and fails `npm ci`
# with "Missing: @emnapi/runtime from lock file" — a version skew, not a bad
# lockfile. Bump this when you regenerate the lockfile locally.
RUN npm i -g npm@11.6.2

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it has to
# be present now — setting it at runtime does nothing.
ARG NEXT_PUBLIC_SITE_URL=https://brawlzone.net
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# `npm run build` is `prisma generate && next build`; the generated client
# lands in src/generated, which is gitignored and must be built here.
#
# The build needs real credentials: pages with `revalidate` and no dynamic
# segment are PRERENDERED HERE, so a build without a database bakes "not enough
# data" into the shipped HTML and a build without the API key bakes "key is not
# set". On Vercel these were present at build time and it was invisible.
#
# Mounted as a BuildKit secret rather than an ARG/ENV so nothing lands in an
# image layer. BUILD_DATABASE_URL overrides DATABASE_URL because the runtime
# value (db:5432) resolves only on the compose network, which a build does not
# join; it points at the loopback-published port instead.
#
# BUILD_MONTH exists only to invalidate this layer. Page titles carry the
# current month and are baked into prerendered HTML here, so a rebuild that
# reuses a cached build layer would re-ship last month's titles — which is the
# whole failure the monthly refresh is meant to prevent. Placed immediately
# before the build so it invalidates nothing above it: `npm ci` and the Prisma
# client are untouched, and a forced monthly rebuild costs only `next build`.
# Not a secret, so an ARG is the right home for it.
ARG BUILD_MONTH=unset
RUN --mount=type=secret,id=build_env,uid=0 \
    echo "build month: $BUILD_MONTH" >/dev/null && \
    set -a && . /run/secrets/build_env && set +a && \
    export DATABASE_URL="${BUILD_DATABASE_URL:-$DATABASE_URL}" && \
    npm run build

# ---- runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Created and chowned in the image so the named volume mounted here inherits
# the ownership. A root-owned cache dir means every ISR write fails silently
# and the site re-renders everything on every request.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
