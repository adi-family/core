# Multi-stage build for client service
# Stage 1: Installer & Builder
FROM node:22-alpine AS installer
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies for all workspaces
RUN npm install --workspaces

# Build the client
# All env vars (CLIENT_PORT, BACKEND_URL, VITE_API_URL) come from Coolify
WORKDIR /app/packages/client
RUN npx vite build

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Copy only the built dist folder
COPY --from=installer /app/packages/client/dist ./dist

# Install a simple static file server
RUN npm install -g sirv-cli

# Set environment
ENV NODE_ENV=production

# Serve static files with sirv (CLIENT_PORT from Coolify)
CMD ["sh", "-c", "sirv dist --host 0.0.0.0 --port ${CLIENT_PORT:-4173} --single"]
