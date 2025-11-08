# Turborepo-optimized multi-stage build for client service
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM node:22-alpine AS pruner
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo@2.6.0

# Copy entire monorepo
COPY . .

# Prune the monorepo for the client package
# Creates out/json/ with package.json files and out/full/ with source code
RUN turbo prune @adi-simple/client --docker

# Stage 2: Installer & Builder
FROM node:22-alpine AS installer
WORKDIR /app

# Copy lockfile and package.json files from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Install dependencies
# Upgrade npm to fix the 'extraneous' bug in npm 10.9.4
RUN npm install -g npm@10.8.2
RUN npm install

# Copy source code from pruner
COPY --from=pruner /app/out/full/ .

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
