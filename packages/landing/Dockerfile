# Turborepo-optimized multi-stage build for Next.js landing page
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM oven/bun:1.2.23-slim AS pruner
WORKDIR /app

# Copy entire monorepo
COPY . .

# Prune the monorepo for the landing package using bunx
# Creates out/json/ with package.json files and out/full/ with source code
RUN bunx turbo prune @adi-simple/landing --docker

# Stage 2: Installer & Builder
FROM oven/bun:1.2.23 AS installer
WORKDIR /app

# Copy lockfile and package.json files from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies with lockfile for deterministic builds
RUN bun install --frozen-lockfile

# Copy source code from pruner
COPY --from=pruner /app/out/full/ .

# Build the landing page
WORKDIR /app/packages/landing
RUN bun run build

# Stage 3: Runner - production image
FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV LANDING_PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/.next/static ./packages/landing/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/public ./packages/landing/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start Next.js server using the standalone output
CMD ["bun", "run", "packages/landing/server.js"]
