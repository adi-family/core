# Multi-stage build for Next.js landing page
# Stage 1: Installer & Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY packages/landing/package*.json ./packages/landing/

# Install dependencies (includes nx in devDependencies)
RUN npm install --legacy-peer-deps

# Copy entire monorepo
COPY . .

# Build the landing page using Nx
RUN npx nx build landing

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/.next/static ./packages/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/landing/public ./packages/landing/public

USER nextjs

# PORT and LANDING_PORT come from Coolify
ENV HOSTNAME="0.0.0.0"

# Start Next.js server using the standalone output
CMD ["node", "packages/landing/server.js"]
