# Multi-stage build for micros-task-ops service
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies for all workspaces (includes nx in devDependencies)
RUN npm install --legacy-peer-deps

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Install git (required for GitLab operations)
RUN apk add --no-cache git

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from builder
COPY --from=builder /app .

# Install tsx for TypeScript support
RUN npm install -g tsx

WORKDIR /app/packages/micros-task-ops
CMD ["tsx", "index.ts"]
