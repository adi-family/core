# Multi-stage Dockerfile for Next.js landing page deployment
# Uses Bun for package management and Next.js standalone output

# Stage 1: Dependencies
FROM oven/bun:1.2.23-slim AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock* ./
COPY packages/landing/package.json ./packages/landing/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN bun install

# Stage 2: Builder
FROM oven/bun:1.2.23-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/landing/node_modules ./packages/landing/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

# Copy workspace root files
COPY package.json bun.lock* turbo.json ./

# Copy workspace dependencies
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui

# Copy landing package source
COPY packages/landing ./packages/landing

# Build the landing page
WORKDIR /app/packages/landing
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV LANDING_PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/.next/static ./packages/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/public ./packages/landing/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start Next.js server using the standalone output
CMD ["bun", "run", "packages/landing/server.js"]
