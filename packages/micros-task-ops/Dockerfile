# Turborepo-optimized multi-stage build for micros-task-ops service
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM oven/bun:1.2.23-slim AS pruner
WORKDIR /app

# Copy entire monorepo
COPY . .

# Prune the monorepo for the micros-task-ops package using bunx
# Creates out/json/ with package.json files and out/full/ with source code
RUN bunx turbo prune @adi/micros-task-ops --docker

# Stage 2: Installer
FROM oven/bun:1.2.23 AS installer
WORKDIR /app

# Copy lockfile and package.json files from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

# Install dependencies with lockfile for deterministic builds
RUN bun install --frozen-lockfile

# Copy source code from pruner
COPY --from=pruner /app/out/full/ .

# Stage 3: Runner - production image
FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from installer
COPY --from=installer /app .

WORKDIR /app/packages/micros-task-ops
CMD ["bun", "run", "index.ts"]
