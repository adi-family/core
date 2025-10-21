# adi-simple
turborepo-monorepo, typescript, database-infrastructure, migration-management, git-workflow, lint-automation

PROJECT STAGE - CAN EDIT EVERYTHING, NO NEED TO MAINTAIN

## Project Overview
- **Turborepo-managed monorepo** with workspaces in `packages/` directory
- **Workspaces**: backend, client, worker, db, utils, shared, types
- **.gitignore** follows ignore-all-allow-specific pattern (ignore everything, explicitly allow needed files)
- **packages/db/** contains shared database logic (client connection, queries) used by backend and worker

## Infrastructure
- **Docker Compose** manages Postgres database and migrations
- **Postgres database** exposed on host port 5436 (internal: postgres:5432)
- **migrations/** submodule uses golang-migrate for schema management
- **Migrations** run automatically via Docker container on `docker compose up`
- **Migration naming** follows timestamp format: `YYYYMMDDHHmmss_name.up/down.sql`

## Development Tools
- **Turborepo** orchestrates build, dev, typecheck, and lint tasks across all workspaces
- **Bun** package manager (packageManager: "bun@1.2.23")
- **ESLint** configured at root with TypeScript and React support
- **Pre-push hook** runs ESLint to prevent pushing code with lint errors
- **Commands**: `bun run dev`, `bun run build`, `bun run typecheck`, `bun run lint`
- **Turbo tasks**: Parallel execution, smart caching, task dependencies
- use glab tool please with custom gitlab domain ( https://gitlab.the-ihor.com )

## Code Style
- **Hono method chaining** - Always use chaining pattern for Hono routes (important for TypeScript type inference)
  - CORRECT: `return new Hono().get(...).post(...).patch(...)`
  - INCORRECT: `const app = new Hono(); app.get(...); app.post(...); return app`
  - INCORRECT: `let app = new Hono(); app = app.get(...); app = app.post(...); return app`

## UI Design Guidelines
- **Design philosophy** - Apple-inspired fluid design with minimalistic brutalist foundation
- **Zero rounded corners** - maintaining sharp square aesthetic while adding fluidity
- **Apple fluid color system**:
  - Vibrant accent colors: #007AFF (blue), #34C759 (green), #FFD60A (yellow), #FF3B30 (red)
  - Grayscale foundation with depth: from-gray-50 via-white to-gray-100
  - Semi-transparent overlays: /80, /90 opacity for glass effects
- **Typography system**:
  - Apple system fonts: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont
  - Uppercase with tracking for headings, labels, and navigation
  - Font smoothing: antialiased for crisp rendering
  - Clear hierarchy: 6xl gradient text for hero, xl for page titles, xs for labels
  - Text gradients: bg-gradient-to-r with bg-clip-text text-transparent
- **Spacing system** - max-w-7xl containers, 6px padding, consistent gaps
- **Backdrop blur effects** - backdrop-blur-xl, backdrop-blur-md, backdrop-saturate-150
- **Glass morphism**:
  - Navigation: bg-white/80 with backdrop-blur-xl
  - Cards: bg-white/90 with backdrop-blur-md
  - Inputs: bg-white/90 with backdrop-blur-sm
- **Fluid depth system** - layered shadows with subtle opacity
  - shadow-sm: 0 2px 8px rgb(0 0 0 / 0.08)
  - shadow-md: 0 4px 16px rgb(0 0 0 / 0.10)
  - shadow-lg: 0 8px 24px rgb(0 0 0 / 0.12)
  - shadow-xl: 0 16px 48px rgb(0 0 0 / 0.16)
- **Smooth transitions**:
  - transition-all duration-200/300
  - hover:scale-[1.02] for interactive elements
  - active:scale-95 for buttons
  - hover:shadow-xl for depth changes
- **Table design** - gradient header (from-gray-800 to-gray-900), hover gradients on rows
- **Status badges** - semi-transparent with backdrop-blur-sm, soft borders, hover states
- **Component library**:
  - Button: gradient backgrounds, shadow-sm, active:scale-95, uppercase tracking-wide
  - Input/Select: border-gray-300, focus:border-blue-500, focus:ring-blue-500
  - Label: xs uppercase tracking-wide
  - Card: border-gray-200/60, bg-white/90, backdrop-blur-md, hover:shadow-lg
- **Interactive animations** - scale transforms, smooth color transitions, gradient shifts
- **Navigation** - sticky top-0, glass effect, border-gray-200/80, hover:scale-105 links