# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
rbac-config-service/
├── config-management-service/   # Node.js + Express 5 backend (port 3001)
└── config-management-ui/        # Next.js 16 + React 19 frontend (port 3000)
```

## Commands

### Backend (`config-management-service/`)
```bash
npm start        # production (node src/server.js)
npm run dev      # development with nodemon
```

No test runner is wired up in `package.json`. The test file at `tests/auth_flow.test.js` exists but has no script.

### Frontend (`config-management-ui/`)
```bash
npm run dev      # Next.js dev server with Turbopack
npm run build    # production build (run this to catch compile errors)
npm start        # serve production build
```

### Database setup
```bash
# Apply base schema
psql $DATABASE_URL -f db/schemas.sql

# Apply migrations in order
psql $DATABASE_URL -f db/migrations/001_add_email_verification.sql
psql $DATABASE_URL -f db/migrations/002_add_refresh_tokens.sql
psql $DATABASE_URL -f db/migrations/003_add_role_default.sql
```

## Backend architecture

The backend is ESM (`"type": "module"`) using Express 5.

**Dual database:**
- **PostgreSQL** — all RBAC data: clients, users, contexts, roles, permissions, role assignments, refresh tokens
- **MongoDB (Atlas)** — config versioning only: `Config` (active version pointer) + `ConfigVersion` (immutable history)

**Required environment variables** (validated at startup — server exits if any are missing):
```
JWT_SECRET, DATABASE_URL, MONGO_URI,
MAILTRAP_HOST, MAILTRAP_USER, MAILTRAP_PASS, ADMIN_API_TOKEN
```

### Two authentication tiers

**Admin auth** (`x-admin-token` header against `ADMIN_API_TOKEN`):  
Used by `/auth/*`, `/roles/*`, `/permissions/*`. Bypasses RBAC entirely.

**JWT auth** (full RBAC chain):  
Used by `/configs/*`. The middleware chain is always applied in this exact order:
```
clientContextMiddleware → actionValidationMiddleware → authMiddleware
```
- `clientContextMiddleware` — extracts `client_id` from `x-client-id` header (or query/body), sets `req.clientId`, and writes `app.current_client_id` to Postgres for RLS
- `actionValidationMiddleware` — maps HTTP method to `read/write/delete`, stores in `req.validatedAction`
- `authMiddleware` — verifies JWT, enforces cross-client isolation, then calls RBAC check

**Three headers required on every protected config request:**
```
Authorization: Bearer <access_token>
x-client-id: <client UUID>
x-context-id: <context UUID>
```

### RBAC permission model

Permissions are stored as `(service, resource, action)` in Postgres, but the runtime check only uses `resource:action` strings (the `service` column is not consulted during `checkPermission`). Example: a permission with `resource=config, action=read` grants the `config:read` capability.

The RBAC check (`rbacService.js`) has an in-memory L1/L2 cache that is currently stubbed as no-ops — every call hits Postgres. Replace `getFromL1Cache`/`setToL1Cache`/`setToL2Cache` with a real Redis implementation before going to production.

### Config versioning (MongoDB)

`Config` documents hold only the `activeVersion` pointer. `ConfigVersion` documents hold the immutable value history. Creating or updating a config always inserts a new `ConfigVersion` and increments the pointer — never mutates existing versions. Rollback just updates the pointer.

Both models require `clientId` on every query for multi-tenancy isolation.

### Email

Mailtrap SMTP sandbox is used. Emails never reach real inboxes — check the Mailtrap dashboard. `APP_URL` in `.env` controls the verification link host.

## Frontend architecture

Next.js App Router, all pages are `'use client'` components. No server components or Next.js API routes are used — every page talks directly to the backend at `NEXT_PUBLIC_API_BASE_URL`.

**Auth layer (`lib/auth.js`):**
- Tokens stored in `localStorage` (`access_token`, `refresh_token`)
- `authFetch(url, options)` — wraps `fetch`, injects `Authorization`, `x-client-id` (decoded from JWT payload), `x-context-id` (from `NEXT_PUBLIC_CONTEXT_ID` env var), auto-refreshes on 401
- Auth guards use `window.location.replace('/login')` (hard redirect, not `router.replace`) to avoid redirect loops under React Strict Mode

**Service layer:**
- `lib/ConfigService.js` — config CRUD and version history
- `lib/RbacService.js` — users, roles, permissions, role assignments

**Environment variables (`.env.local`):**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CONTEXT_ID=<context UUID>
NEXT_PUBLIC_CLIENT_ID=<client UUID>
```

## Known issues / gotchas

- **`POST /permissions` requires `service` field**, but the frontend's `createPermission` in `RbacService.js` sends `name` instead of `service`. Creating permissions from the UI will fail until this is aligned.
- **Roles and permissions routes use admin auth**, not JWT. The frontend's `authFetch` sends a JWT `Authorization` header which the admin routes ignore — it uses `x-admin-token`. If these calls start failing with 401, the admin token header is missing.
- **MongoDB Atlas IP whitelist** — if `configversions.find() buffering timed out` errors appear, the current machine's IP is not whitelisted in Atlas.
- **Only one default role per client** — creating a new `is_default` role automatically unsets `is_default` on all other roles for that client.
