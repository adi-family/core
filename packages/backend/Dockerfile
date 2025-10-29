FROM oven/bun:1.2.23 AS base
WORKDIR /app

# Copy everything (node_modules and lockfiles excluded by .dockerignore)
COPY . .

# Debug: Show what we have
RUN echo "=== Root files ===" && ls -la && \
    echo "=== Packages directory ===" && ls -la packages/ && \
    echo "=== Utils package ===" && ls -la packages/utils/ || echo "utils not found" && \
    echo "=== Workspace in package.json ===" && cat package.json | grep -A5 workspaces

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
