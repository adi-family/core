FROM oven/bun:latest AS base
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY tsconfig.json ./
COPY backend ./backend
COPY db ./db
COPY utils ./utils

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["bun", "run", "backend/index.ts"]
