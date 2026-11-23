# Production image for Railway (Node.js web service).
# Build: docker build -t vegansugar .
# Run: docker run -e DATABASE_URL=... -e AUTH_SECRET=... -p 3000:3000 vegansugar

# Node 20 is end-of-life (2026-04-30, no security fixes). Node 24 is Maintenance LTS until 2028-04-30.
FROM node:24.22.3-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build public pages without requiring runtime secrets.
ENV NEXT_PUBLIC_SITE_URL=http://localhost:3000
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migration runner needs drizzle sources + drizzle-kit in production image.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
USER nextjs
EXPOSE 3000
# Railway provides PORT. Next standalone server.js respects PORT and HOSTNAME.
# SIGTERM is handled by node as PID 1 via exec-form CMD.
CMD ["node", "server.js"]
