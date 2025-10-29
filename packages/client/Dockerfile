FROM oven/bun:1.2.23 AS builder
WORKDIR /app

# Copy everything (node_modules and lockfiles excluded by .dockerignore)
COPY . .

# Install all dependencies (including devDependencies for build)
RUN bun install

# Build the client
ENV CLIENT_PORT=4173
ENV BACKEND_URL=http://backend:3000
ENV VITE_API_URL=/api
WORKDIR /app/packages/client
RUN bunx vite build

# Production stage
FROM oven/bun:1.2.23
WORKDIR /app

# Copy built files and config
COPY --from=builder /app/packages/client/dist ./dist
COPY --from=builder /app/packages/client/vite.config.ts ./vite.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install vite and dependencies for preview server
RUN bun add vite @vitejs/plugin-react vite-tsconfig-paths

# Set environment
ENV NODE_ENV=production
ENV CLIENT_PORT=4173

# Run preview server directly pointing to dist
CMD ["bunx", "vite", "preview", "--outDir", "dist", "--host", "0.0.0.0", "--port", "4173"]
