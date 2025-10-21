FROM oven/bun:1.2.23 AS base
WORKDIR /app

# Copy all source code (including workspace packages)
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile --production

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["bun", "run", "packages/backend/index.ts"]
