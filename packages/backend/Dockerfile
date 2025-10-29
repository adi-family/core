FROM oven/bun:1.2.23 AS base
WORKDIR /app

# Copy everything (node_modules excluded by .dockerignore)
COPY . .

# Install dependencies (lockfile not frozen to handle any version mismatches)
RUN bun install --no-frozen-lockfile --verbose

# Set environment
ENV NODE_ENV=production
ENV SERVER_PORT=5174

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5174/webhooks/gitlab || exit 1

# Run the application
CMD ["bun", "run", "packages/backend/index.ts"]
