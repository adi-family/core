# Turborepo-optimized multi-stage build for backend service
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM oven/bun:1.2.23-slim AS pruner
WORKDIR /app

# Copy entire monorepo
COPY . .

# Prune the monorepo for the backend package using bunx
# Creates out/json/ with package.json files and out/full/ with source code
RUN bunx turbo prune @adi-simple/backend --docker

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

# Copy root tsconfig for path alias resolution
COPY --from=pruner /app/tsconfig.json ./tsconfig.json

# Stage 3: Runner - production image
FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from installer
COPY --from=installer /app .

# Health check (uses SERVER_PORT from Coolify)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${SERVER_PORT:-5174}/webhooks/gitlab || exit 1

# Run the application
CMD ["bun", "run", "packages/backend/index.ts"]
