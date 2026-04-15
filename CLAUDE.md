# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (frontend + backend together)
npm run dev:all

# Frontend only (Vite dev server on :5173)
npm run dev

# Backend only (Express server on :3001)
npm run server

# Type check
npm run typecheck

# Production build
npm run build

# Production start
npm run start

# Build + start in one step
npm run start:prod
```

In development, Vite proxies `/api` requests to the Express backend at `http://localhost:3001`, so `VITE_API_URL` is only needed for production builds.

## Architecture

ElasticScope is a full-stack TypeScript app: a **Vite/React frontend** (`src/`) and an **Express backend** (`server/`), both in the same repo.

### Request flow

```
Browser → Vite dev proxy (/api) → Express (server/index.ts) → Elasticsearch cluster
```

The backend acts as an authenticated proxy. It holds the active Elasticsearch `Client` instance in memory (a module-level variable in `server/index.ts`). All frontend Elasticsearch operations go through `/api/*` endpoints rather than talking to ES directly, which also eliminates CORS issues.

### Frontend (`src/`)

- **`src/App.tsx`** — root component. Manages active connection state, current view (`dashboard | index | rest | monitor`), sidebar width, and the document comparison queue (max 2 docs). Navigation is URL-search-param based (`?index=...&view=...`).
- **`src/api/elasticsearchClient.ts`** — all API calls. A thin wrapper around `fetch` that hits the Express backend. Throws errors with `errorCode` strings for i18n translation.
- **`src/types/index.ts`** — all shared TypeScript types.
- **`src/utils/storage.ts`** — typed `localStorage` accessors (sidebar width, page size, pinned fields, column config, REST tabs, etc.). Use `createStorageItem`, `createNumericStorageItem`, or `createStringArrayStorageItem` to add new persisted settings.
- **`src/utils/columnStorage.ts`** — per-index column visibility/order config stored in localStorage.
- **`src/i18n.ts`** — i18next setup. Translations live in `src/locales/en.json` and `src/locales/tr.json`. Use `useTranslation()` hook and `t('key')` in components; error codes returned from the API are translated on the frontend.
- **`src/constants/index.ts`** — app-wide constants (e.g. `MIN_SIDEBAR_WIDTH`, `MAX_SIDEBAR_WIDTH`).
- **`src/hooks/`** — `useResizable` (drag-to-resize panels), `useClickOutside`, `useDropdown`.

### Backend (`server/`)

- **`server/index.ts`** — Express app. Holds active ES client instance. Key route groups:
  - `/api/connections` — CRUD for saved connections (stored in local DB)
  - `/api/connect` / `/api/disconnect` — activates/deactivates the ES client
  - `/api/indices`, `/api/search`, `/api/aggregations` — ES operations
  - `/api/rest` — raw REST proxy (used by REST Console); blocked paths defined in `DANGEROUS_PATHS` / `DANGEROUS_PATH_PATTERNS`
  - `/api/queries`, `/api/search-queries` — saved REST queries and saved search queries
  - `/api/copy-document`, `/api/copy-documents` — cross-cluster document copy
  - `/api/cluster/*`, `/api/nodes/*`, `/api/tasks`, `/api/cat/*` — cluster monitoring
- **`server/database/`** — database abstraction layer:
  - `index.ts` — factory + singleton. Reads `DB_TYPE` env var and returns the right adapter. Exports convenience functions (`getAllConnections`, `createQuery`, etc.) that delegate to the active adapter.
  - `adapters/sqlite.ts`, `adapters/postgresql.ts`, `adapters/mysql.ts` — concrete adapters implementing `DatabaseAdapter` interface (`server/database/types.ts`).
  - `encryption.ts` — AES-256-GCM password encryption. Uses `ENCRYPTION_KEY` env var (defaults to a dev placeholder; change in production).

### Database configuration

Set `DB_TYPE=sqlite|postgresql|mysql`. SQLite default path: `./data/connections.db`. For PostgreSQL/MySQL set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Optionally `DB_SSL=true`, `DB_POOL_SIZE`.

### Internationalization

All user-visible strings must use `t('...')`. Add keys to both `src/locales/en.json` and `src/locales/tr.json`. API error responses should return an `errorCode` string (not a human-readable message) so the frontend can translate it.

### Security note

The REST Console proxy blocks a hardcoded list of destructive Elasticsearch paths (`DANGEROUS_PATHS` and `DANGEROUS_PATH_PATTERNS` at the top of `server/index.ts`). When adding new proxy routes, check whether they need to be added to this list.

### `__APP_VERSION__`

Injected at build time by Vite from `package.json`. Available globally in frontend code without an import.
