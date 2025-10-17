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
ENV BACKEND_URL=http://backend:3000
ENV VITE_API_URL=/api
RUN bun run client:build

# Production stage
FROM oven/bun:latest
WORKDIR /app

# Copy built files and config
COPY --from=builder /app/client/dist ./dist
COPY --from=builder /app/client/vite.config.ts ./vite.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install vite and dependencies for preview server
RUN bun add vite @vitejs/plugin-react vite-tsconfig-paths

# Set environment
ENV NODE_ENV=production
ENV CLIENT_PORT=4173

# Run preview server directly pointing to dist
CMD ["bunx", "vite", "preview", "--outDir", "dist", "--host", "0.0.0.0", "--port", "4173"]
