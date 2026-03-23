# Menu Sync Platform

A SaaS platform to help restaurant owners synchronize their menus across delivery services.

## Tech Stack

- **API**: Fastify, TypeScript, Drizzle ORM, PostgreSQL
- **Web**: React, TypeScript, Vite
- **Monorepo**: pnpm workspaces

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 15+

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment config
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your database URL

# Generate and run database migrations
pnpm db:generate
pnpm db:migrate
```

## Development

```bash
# Start API server (port 3001)
pnpm dev:api

# Start web dev server (port 3000)
pnpm dev:web
```

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `pnpm dev:api`      | Start API server in dev mode |
| `pnpm dev:web`      | Start web dev server         |
| `pnpm build`        | Build all packages           |
| `pnpm lint`         | Run ESLint                   |
| `pnpm format`       | Format code with Prettier    |
| `pnpm format:check` | Check formatting             |
| `pnpm typecheck`    | Run TypeScript type checking |
| `pnpm test`         | Run all tests                |
| `pnpm db:generate`  | Generate Drizzle migrations  |
| `pnpm db:migrate`   | Apply database migrations    |

## Project Structure

```
packages/
  api/        # Fastify API server + Drizzle ORM
  web/        # React + Vite frontend
```
