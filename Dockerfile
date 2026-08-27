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
RUN npm run build

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
