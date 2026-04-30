# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (Next.js app and API on :3001)
npm run dev

# Production build
npm run build

# Production start
npm run start

# Build + start in one step
npm run start:prod
```

In development and production, Next.js serves both the UI and `/api/*` routes from `http://localhost:3001`.

## Architecture

ElasticScope is a full-stack TypeScript app built with **Next.js App Router**. The React UI lives under `src/`, and API logic is exposed through Next route handlers.

### Request flow

```
Browser → Next.js UI/API (/api) → Elasticsearch cluster
```

The API layer acts as an authenticated proxy. It holds the active Elasticsearch `Client` instance in process memory inside `server/api/handler.ts`. All frontend Elasticsearch operations go through same-origin `/api/*` endpoints rather than talking to ES directly, which also eliminates CORS issues.

### Frontend (`src/`)

- **`src/App.tsx`** — root component. Manages active connection state, current view (`dashboard | index | rest | monitor`), sidebar width, and the document comparison queue (max 2 docs). Navigation is URL-search-param based (`?index=...&view=...`).
- **`src/app/`** — Next.js App Router entrypoints, including the client-only SPA wrapper and catch-all API route.
- **`src/api/elasticsearchClient.ts`** — all API calls. A thin wrapper around same-origin `fetch('/api/...')`. Throws errors with `errorCode` strings for i18n translation.
- **`src/types/index.ts`** — all shared TypeScript types.
- **`src/utils/storage.ts`** — typed `localStorage` accessors (sidebar width, page size, pinned fields, column config, REST tabs, etc.). Use `createStorageItem`, `createNumericStorageItem`, or `createStringArrayStorageItem` to add new persisted settings.
- **`src/utils/columnStorage.ts`** — per-index column visibility/order config stored in localStorage.
- **`src/i18n.ts`** — i18next setup. Translations live in `src/locales/en.json` and `src/locales/tr.json`. Use `useTranslation()` hook and `t('key')` in components; error codes returned from the API are translated on the frontend.
- **`src/constants/index.ts`** — app-wide constants (e.g. `MIN_SIDEBAR_WIDTH`, `MAX_SIDEBAR_WIDTH`).
- **`src/hooks/`** — `useResizable` (drag-to-resize panels), `useClickOutside`, `useDropdown`.

### API (`src/app/api` + `server/`)

- **`src/app/api/[...path]/route.ts`** — Next.js route handler entrypoint for `/api/*`.
- **`server/api/handler.ts`** — Node-only API implementation. Holds active ES client instance. Key route groups:
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

The REST Console proxy blocks a hardcoded list of destructive Elasticsearch paths (`DANGEROUS_PATHS` and `DANGEROUS_PATH_PATTERNS` in `server/api/handler.ts`). When adding new proxy routes, check whether they need to be added to this list.

### `NEXT_PUBLIC_APP_VERSION`

Injected by `next.config.mjs` from `package.json`. Available in frontend code through `process.env.NEXT_PUBLIC_APP_VERSION`.
