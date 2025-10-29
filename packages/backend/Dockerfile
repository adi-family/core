FROM oven/bun:1.2.23 AS base
WORKDIR /app

# First, copy all package.json files explicitly
COPY package.json ./
COPY packages/*/package.json ./packages/

# Then copy everything else
COPY . .

# Install dependencies from scratch (no lockfile)
RUN bun install

# Set environment
ENV NODE_ENV=production
ENV SERVER_PORT=5174

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5174/webhooks/gitlab || exit 1

# Run the application
CMD ["bun", "run", "packages/backend/index.ts"]
