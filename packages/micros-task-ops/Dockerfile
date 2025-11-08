# Multi-stage build for micros-task-ops service
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (includes nx in devDependencies)
RUN npm install --legacy-peer-deps

# Copy entire monorepo
COPY . .

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from builder
COPY --from=builder /app .

# Install tsx for TypeScript support
RUN npm install -g tsx

WORKDIR /app/packages/micros-task-ops
CMD ["tsx", "index.ts"]
