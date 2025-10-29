FROM oven/bun:1.2.23 AS builder
WORKDIR /app

# Copy everything (node_modules excluded by .dockerignore)
COPY . .

# Install all dependencies
RUN bun install

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
