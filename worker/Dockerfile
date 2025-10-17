FROM oven/bun:latest AS base
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY worker ./worker
COPY db ./db
COPY utils ./utils

# Create .apps directory for runtime data
RUN mkdir -p .apps

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["bun", "run", "worker/index.ts"]
