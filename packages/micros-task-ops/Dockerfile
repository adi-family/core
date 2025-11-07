# Turborepo-optimized multi-stage build for micros-task-ops service
# Stage 1: Pruner - extracts only the required workspace dependencies
FROM node:22-alpine AS pruner
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo@2.6.0

# Copy entire monorepo
COPY . .

# Prune the monorepo for the micros-task-ops package
# Creates out/json/ with package.json files and out/full/ with source code
RUN turbo prune @adi-simple/micros-task-ops --docker

# Stage 2: Installer
FROM node:22-alpine AS installer
WORKDIR /app

# Copy lockfile and package.json files from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code from pruner
COPY --from=pruner /app/out/full/ .

# Copy root tsconfig for path alias resolution
COPY --from=pruner /app/tsconfig.json ./tsconfig.json

# Stage 3: Runner - production image
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy installed node_modules and source from installer
COPY --from=installer /app .

# Install tsx for TypeScript support
RUN npm install -g tsx

WORKDIR /app/packages/micros-task-ops
CMD ["tsx", "index.ts"]
