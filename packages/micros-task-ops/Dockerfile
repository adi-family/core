# Multi-stage build for micros-task-ops service
# Stage 1: Installer
FROM node:22-alpine AS installer
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies (lockfile will be generated fresh)
RUN npm install

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from installer
COPY --from=installer /app .

# Install tsx for TypeScript support
RUN npm install -g tsx

WORKDIR /app/packages/micros-task-ops
CMD ["tsx", "index.ts"]
