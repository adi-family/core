# Multi-stage build for backend service
# Stage 1: Installer
FROM node:22-alpine AS builder
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies for all workspaces (includes nx in devDependencies)
RUN npm install --legacy-peer-deps --workspaces

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from builder
COPY --from=builder /app .

# Health check (uses SERVER_PORT from Coolify)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:${SERVER_PORT:-5174}/healthcheck').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the application with tsx for TypeScript support
RUN npm install -g tsx
CMD ["tsx", "packages/backend/index.ts"]
