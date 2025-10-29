FROM oven/bun:1.2.23 AS builder
WORKDIR /app

# Copy workspace configuration and all package.json files
COPY package.json bun.lock* ./
COPY packages/micros-task-ops/package.json ./packages/micros-task-ops/
COPY packages/micros-task-sync/package.json ./packages/micros-task-sync/
COPY packages/micros-task-eval/package.json ./packages/micros-task-eval/
COPY packages/micros-task-impl/package.json ./packages/micros-task-impl/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/queue/package.json ./packages/queue/
COPY packages/backend/package.json ./packages/backend/
COPY packages/worker/package.json ./packages/worker/

# Install all dependencies
RUN bun install

# Copy all source code
COPY . .

# Production stage
FROM oven/bun:1.2.23
WORKDIR /app

# Copy all required workspace dependencies
COPY --from=builder /app/packages/micros-task-ops ./micros-task-ops
COPY --from=builder /app/packages/micros-task-sync ./micros-task-sync
COPY --from=builder /app/packages/micros-task-eval ./micros-task-eval
COPY --from=builder /app/packages/micros-task-impl ./micros-task-impl
COPY --from=builder /app/packages/db ./db
COPY --from=builder /app/packages/utils ./utils
COPY --from=builder /app/packages/shared ./shared
COPY --from=builder /app/packages/types ./types
COPY --from=builder /app/packages/queue ./queue
COPY --from=builder /app/packages/backend ./backend
COPY --from=builder /app/packages/worker ./worker
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Set environment
ENV NODE_ENV=production

WORKDIR /app/micros-task-ops
CMD ["bun", "run", "index.ts"]
