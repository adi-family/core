# Turborepo-optimized multi-stage build for client service
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM oven/bun:1.2.23-slim AS pruner
WORKDIR /app

# Copy entire monorepo
COPY . .

# Prune the monorepo for the client package using bunx
# Creates out/json/ with package.json files and out/full/ with source code
RUN bunx turbo prune @adi-simple/client --docker

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

# Build the client
ENV CLIENT_PORT=4173
ENV BACKEND_URL=http://backend:3000
ENV VITE_API_URL=/api
WORKDIR /app/packages/client
RUN bunx vite build

# Stage 3: Runner - production image
FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app

# Copy only the built dist folder
COPY --from=installer /app/packages/client/dist ./dist

# Install a simple static file server
RUN bun add sirv-cli

# Set environment
ENV NODE_ENV=production
ENV CLIENT_PORT=4173

# Serve static files with sirv
CMD ["bunx", "sirv", "dist", "--host", "0.0.0.0", "--port", "4173", "--single"]
