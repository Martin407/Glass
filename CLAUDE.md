# Glass Project Guide

Documentation for development, build, and coding standards in the Glass monorepo.

## Project Overview
- **Monorepo Structure**: `frontend/` (React/Vite) and `backend/` (Cloudflare Workers/Hono).
- **Stack**: TypeScript, React 19, Tailwind CSS v4, Hono, Cloudflare D1, Durable Objects.

## Build and Development Commands
### Root Commands
- `npm run dev`: Start both frontend and backend development servers.
- `npm test`: Run all tests across the monorepo.

### Frontend (`frontend/`)
- `npm run dev`: Start Vite dev server.
- `npm run build`: Build production assets (`tsc -b && vite build`).
- `npm run lint`: Run ESLint (`eslint .`).
- `npm test`: Run tests using Vitest (`vitest run`).

### Backend (`backend/`)
- `npm run dev`: Start Cloudflare Workers dev server (`wrangler dev`).
- `npm run deploy`: Deploy to Cloudflare (`wrangler deploy --minify`).
- `npm run cf-typegen`: Update Cloudflare Bindings types.
- `npm test`: Run tests using Vitest (`vitest run`).

## Coding Standards
### General
- **Language**: TypeScript (strict mode enabled).
- **Formatting**: 2-space indentation, use semicolons.
- **Imports**: Standard modules first, then third-party libraries, then local files.

### Frontend
- **Framework**: React 19 (functional components, hooks).
- **Styling**: Tailwind CSS v4 with `tailwindcss-animate`.
- **UI Components**: shadcn/ui (located in `src/components/ui`).
- **Path Aliases**: Use `@/` to reference `src/` (e.g., `import { X } from '@/lib/utils'`).
- **Icons**: Lucide React.

### Backend
- **Framework**: Hono (ES modules).
- **State Management**: Durable Objects for realtime state (see `src/durable-object.ts`).
- **Database**: Cloudflare D1 (`DB` binding).
- **Bindings**: Types defined in `src/index.ts` and `worker-configuration.d.ts`.
- **Cache**: `TTLMemoryCache` for in-memory caching with eviction.

## Testing Strategy
- **Framework**: Vitest for both frontend and backend.
- **Organization**:
  - Backend: Tests in `src/*.test.ts` and `src/__tests__/*.test.ts`.
  - Frontend: Tests co-located with components (`*.test.tsx`) or in `src/lib/*.test.ts`.
- **Commands**: Always run `npm test` before submitting changes.
