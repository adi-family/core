FROM oven/bun:1.2.23 AS base
WORKDIR /app

# Copy workspace configuration and all package.json files
COPY package.json bun.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/queue/package.json ./packages/queue/

# Install dependencies
RUN bun install

# Copy all source code
COPY . .

# Set environment
ENV NODE_ENV=production
ENV SERVER_PORT=5174

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5174/webhooks/gitlab || exit 1

# Run the application
CMD ["bun", "run", "packages/backend/index.ts"]
