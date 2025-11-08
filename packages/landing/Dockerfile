# Multi-stage build for Next.js landing page
# Stage 1: Installer & Builder
FROM node:22-alpine AS installer
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies for all workspaces
RUN npm install --workspaces

# Build the landing page
WORKDIR /app/packages/landing
RUN npm run build

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/.next/static ./packages/landing/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/packages/landing/public ./packages/landing/public

USER nextjs

# PORT and LANDING_PORT come from Coolify
ENV HOSTNAME="0.0.0.0"

# Start Next.js server using the standalone output
CMD ["node", "packages/landing/server.js"]
