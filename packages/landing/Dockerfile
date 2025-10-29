# Multi-stage Dockerfile for Next.js landing page deployment
# Uses Bun for package management and Next.js standalone output

# Stage 1: Builder
FROM oven/bun:1.2.23-slim AS builder
WORKDIR /app

# Copy everything (node_modules and lockfiles excluded by .dockerignore)
COPY . .

# Install dependencies
RUN bun install

# Build the landing page
WORKDIR /app/packages/landing
RUN bun run build

# Stage 2: Runner
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
