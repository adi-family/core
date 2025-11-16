# Multi-stage build for Claude worker microservice
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies for all workspaces
RUN npm install --legacy-peer-deps

# Build TypeScript
RUN npm run build --workspace=@adi-simple/micros-claude-worker

# Stage 2: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and built source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package*.json ./

# Health check - simple process check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ps aux | grep -q 'node.*micros-claude-worker' || exit 1

# Run the worker with tsx for TypeScript support
RUN npm install -g tsx
CMD ["tsx", "packages/micros-claude-worker/src/index.ts"]
