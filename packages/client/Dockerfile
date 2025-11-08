# Multi-stage build for client service
# Stage 1: Installer & Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY packages/client/package*.json ./packages/client/

# Install dependencies (includes nx in devDependencies)
RUN npm install --legacy-peer-deps

# Copy entire monorepo
COPY . .

# Build the client using Nx
# All env vars (CLIENT_PORT, BACKEND_URL, VITE_API_URL) come from Coolify
RUN npx nx build client

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Copy only the built dist folder
COPY --from=builder /app/packages/client/dist ./dist

# Install a simple static file server
RUN npm install -g sirv-cli

# Set environment
ENV NODE_ENV=production

# Serve static files with sirv (CLIENT_PORT from Coolify)
CMD ["sh", "-c", "sirv dist --host 0.0.0.0 --port ${CLIENT_PORT:-4173} --single"]
