FROM oven/bun:latest AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY client ./client
COPY backend ./backend
COPY db ./db
COPY tsconfig.json ./

# Build the client
ENV CLIENT_PORT=4173
ENV SERVER_PORT=3000
RUN bun run client:build

# Production stage
FROM oven/bun:latest
WORKDIR /app

# Copy built files and package.json
COPY --from=builder /app/client/dist ./dist
COPY --from=builder /app/package.json ./

# Install vite for preview server
RUN bun install vite --production

# Set environment
ENV NODE_ENV=production

# Run preview server
CMD ["bun", "run", "client:preview", "--", "--host", "0.0.0.0"]
