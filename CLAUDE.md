# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

For a presentation-ready explanation of the project — the problem it solves, the key approach and results, real-world use cases, and a complete worked example ("AcmeAnalytics") with reference tables — see [`PROJECT_SHOWCASE.md`](PROJECT_SHOWCASE.md).

## Features

What the application actually does today (each maps to live routes / pages).

### Authentication & accounts
- **Self-service registration with email verification** — `POST /auth/register` creates the user and emails a verification link; `GET /auth/verify` confirms it; `POST /auth/resend-verification` re-sends. New users land on a client's default role.
- **Login / logout** — `POST /auth/login`, `POST /auth/logout`; rate-limited via `authLimiter`. JWTs are set as httpOnly cookies.
- **Silent session refresh** — `POST /auth/refresh` (cookie-based); the frontend's `authFetch` auto-retries once on 401.
- **Self lookup** — `GET /auth/me` (profile) and `GET /auth/me/permissions` (effective permissions for UI gating).

### User management (per client)
- **List / create / delete users** within the caller's client — `GET /auth/users`, `POST /auth/users`, `DELETE /auth/users/:id`, gated by `users:read|write|delete`.

### Roles & permissions (RBAC)
- **Role CRUD** — `POST /roles`, `GET /roles`, `PATCH /roles/:id` (gated by `roles:read|write`). One default role per client is enforced.
- **Assign roles to users in a context** — `POST /roles/assign` (the context-scoped `(user, client, context, role)` binding).
- **Manage a role's permissions** — `GET/POST /roles/:id/permissions`, `DELETE /roles/:id/permissions/:permissionId`.
- **Permission catalog** — `GET /permissions`, `POST /permissions` (the `resource:action` definitions roles draw from).

### Config management (versioned, MongoDB)
- **Create / update a config** — `POST /configs` writes a new immutable `ConfigVersion` and advances the active pointer (never overwrites).
- **Rollback** — `POST /configs/rollback` moves the active pointer back to a prior version.
- **Delete a config** — `DELETE /configs/:key`.
- **Read configs & history** — `GET /configs`, `GET /configs/:key/versions`; accepts an **API key OR a user session** (`readAuth`).

### API keys
- **Issue / list / revoke API keys** for programmatic config reads — `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:id`. Keys are stored as SHA-256 hashes; `last_used_at` is tracked.

### Feature flags
- **Per-client feature flags** (`feature_flags` table) checked in `authMiddleware` via `?flag=`/`x-feature-flag`; `featureFlagService` enables/disables and reads them. A disabled flag blocks the request.

### Platform admin / superadmin (cross-client)
- **Superadmin auth** — `POST /superadmin/login`, `POST /superadmin/logout` (separate `sa_token` JWT).
- **Client management** — list/create/update clients, view a client's users and roles (`/superadmin/clients...`).
- **Platform admin management** — `GET/POST /superadmin/admins`.
- **Per-client RBAC** — create roles for a client and manage their permissions; create users under a client.
- **Domain → client resolution** — public `GET /superadmin/client-by-domain` powers the frontend's hostname-based client detection.

### Admin UI pages
`login`, `register`, `verify`, `configs`, `roles`, `permissions`, `users`, `api-keys`, and a separate `superadmin/*` area (`login`, `onboarding`, dashboard).

## Repository layout

```
rbac-config-service/
├── config-management-service/   # Node.js + Express 5 backend (port 3001)
└── config-management-ui/        # Next.js 16 + React 19 frontend (port 3000)
```

## Commands

### Backend (`config-management-service/`)
```bash
npm start              # production (node src/server.js)
npm run dev            # development with nodemon
npm run create-superadmin   # interactive: create a platform admin (scripts/create_superadmin.js)
```

No test runner is wired up in `package.json`. The file at `tests/auth_flow.test.js` exists but has no script.

### Frontend (`config-management-ui/`)
```bash
npm run dev      # Next.js dev server (plain `next dev`, no Turbopack flag)
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
psql $DATABASE_URL -f db/migrations/004_platform_admin_and_domains.sql
psql $DATABASE_URL -f db/migrations/005_add_password_hash.sql
```
There is also `db/enforce_tenancy.sql` (RLS policies) and seed files under `db/` and `db/seeds/`.

## Backend architecture

The backend is ESM (`"type": "module"`) using Express 5.

`app.js` wires global middleware in this order: **CORS** (with explicit preflight handling, must precede helmet) → **helmet** → **express-rate-limit** (1000 req / 15 min for `cms_…` API-key traffic, 100 otherwise; in-memory store — needs a shared store for multi-instance) → `express.json({ limit: '10kb' })` → **cookie-parser**. `GET /health` checks **both** Postgres and Mongo (`mongoose.connection.readyState`) and returns 503 if either is down.

Route mounts:
```
app.use("/",            configRoutes)   // paths: /configs, /configs/rollback, /configs/:key, /configs/:key/versions
app.use("/auth",        authRoutes)
app.use("/roles",       roleRoutes)
app.use("/permissions", permissionRoutes)
app.use("/superadmin",  superadminRoutes)
app.use("/api-keys",    apiKeyRoutes)
```

**Dual database:**
- **PostgreSQL** — all RBAC data: clients, users, contexts, roles, permissions, role assignments, refresh tokens, API keys, feature flags, platform admins
- **MongoDB (Atlas)** — config versioning only: `Config` (active version pointer) + `ConfigVersion` (immutable history)

**Required environment variables** (validated at startup in `server.js` — server exits if any are missing):
```
JWT_SECRET, DATABASE_URL, MONGO_URI,
SMTP_HOST, SMTP_USER, SMTP_PASS
```
Startup also **fails fast if MongoDB is unreachable** (all config data lives there). Optional: `PORT`, `NODE_ENV` (enables Secure/SameSite cookies), `CORS_ORIGIN`, `APP_URL`.

### Authentication tiers

All JWTs live in **httpOnly cookies** set by the backend (not localStorage). Middlewares also accept a `Bearer` header as a dev-tools fallback.

1. **User session (`userAuth`)** — validates the `access_token` cookie (or Bearer), confirms the user is active, sets `req.user` (`{ id, client_id }`). It does *not* run a context-scoped RBAC check; route handlers pair it with `requirePermission`. Used by `/auth/*` (`/me`, `/users`), `/roles/*`, `/permissions/*`, `/api-keys/*`.
   - `requirePermission(resource, action)` — checks whether the user holds `resource:action` across **any** of their role assignments for their client (context-independent). Platform admins (`req.platformAdmin`) bypass.

2. **Full config RBAC chain** — applied to config **writes** in this exact order:
   ```
   clientContextMiddleware → actionValidationMiddleware → authMiddleware
   ```
   - `clientContextMiddleware` — extracts `client_id` from `x-client-id` header (or query/body), sets `req.clientId`, writes `app.current_client_id` to Postgres for RLS
   - `actionValidationMiddleware` — maps HTTP method to `read/write/delete`, stores in `req.validatedAction`
   - `authMiddleware` — verifies the JWT cookie, enforces cross-client isolation, runs the context-scoped RBAC check, **and** gates on feature flags (see below)

3. **API key (`apiKeyAuth`)** — for programmatic config **reads**. Hashes the `Authorization` header value (SHA-256) and looks it up in `client_api_keys.key_hash` (non-revoked); sets `req.clientId` + `req.apiKeyClient` and bumps `last_used_at`. Config read routes (`GET /configs`, `GET /configs/:key/versions`) use a `readAuth` wrapper that accepts **API key OR user session** — API key first, falling back to the full user chain.

4. **Platform admin / superadmin (`platformAdminAuth`)** — validates the `sa_token` cookie (separate JWT with `type: 'platform_admin'`). Backs all `/superadmin/*` routes (cross-client management: clients, admins, per-client roles/permissions/users) and the `platform_admins` table (migration 004). `POST /superadmin/login` and `GET /superadmin/client-by-domain` are unauthenticated.

**Headers on a protected config write request:**
```
Cookie: access_token=<jwt>     (or Authorization: Bearer <jwt> in dev)
x-client-id: <client UUID>
x-context-id: <context UUID>
```

### RBAC permission model

Permissions are stored as `(service, resource, action)` in Postgres, but the runtime checks only use `resource:action` (the `service` column is not consulted). Example: `resource=config, action=read` grants the `config:read` capability.

`rbacService.js` has a **working in-memory TTL cache** (not a stub): L1 keyed by user/context (~60s), L2 keyed by role (~300s) via internal `_get`/`_set`. It is in-memory only — **swap for Redis before horizontal scaling**; a multi-instance deploy would have inconsistent caches.

### Feature flags

`featureFlagService.js` reads `feature_flags (client_id, flag_name, enabled)` from Postgres. `authMiddleware` calls `canUseFeature` when a request names a flag via `?flag=` or the `x-feature-flag` header — a disabled flag blocks the request. `enableFeature`/`disableFeature` manage rows.

### Config versioning (MongoDB)

Live implementation: **`src/services/configServices.js`** (plural). `Config` documents hold only the `activeVersion` pointer; `ConfigVersion` documents hold the immutable value history. Create/update always inserts a new `ConfigVersion` and increments the pointer — never mutates existing versions. Rollback just moves the pointer. Values are coerced by `type` (`string|boolean|number|json`). Every query requires `clientId` for multi-tenant isolation.

### Email

Generic SMTP via nodemailer (`emailService.js`), configured with `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_USER`, `SMTP_PASS`. `SMTP_FROM` must be a sender the provider has verified — with Brevo single-sender verification that's your own email (no domain required); an unverified `from` is rejected. `FRONTEND_URL` controls the verification link host.

## Frontend architecture

Next.js App Router, all pages are `'use client'`. No server components or Next.js API routes — every page talks directly to the backend at `NEXT_PUBLIC_API_BASE_URL`.

**Auth layer (`lib/auth.js`):**
- Tokens are **httpOnly cookies** — JS cannot read them. All requests use `credentials: 'include'`; `authFetch` does **not** inject an `Authorization` header.
- localStorage holds only non-sensitive `session_user`; `client_id` comes from `localStorage('detected_client_id')` (resolved from hostname by `lib/clientDetection.js`), `context_id` from `NEXT_PUBLIC_CONTEXT_ID`. These go out as `x-client-id` / `x-context-id`.
- `authFetch` auto-refreshes on 401 by calling `/auth/refresh` (cookie-based), then retries once.
- Auth guards use `window.location.replace('/login')` (hard redirect, not `router.replace`) to avoid redirect loops under React Strict Mode.

**Pages:** `login`, `register`, `verify`, `configs`, `roles`, `permissions`, `users`, `api-keys`, and a separate `superadmin/*` area (`login`, `onboarding`, dashboard).

**Service layer:**
- `lib/ConfigService.js` — config CRUD and version history
- `lib/RbacService.js` — users, roles, permissions, role assignments
- `lib/permissions.js` — permission labels/helpers
- `lib/SuperadminService.js` + `lib/superadminAuth.js` — superadmin area (uses `saFetch`, stores `sa_info` in localStorage)
- `lib/clientDetection.js` — resolves `client_id` from the domain, caches in localStorage

**Environment variables (`.env.local`):**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CONTEXT_ID=<context UUID>
NEXT_PUBLIC_CLIENT_ID=<client UUID>
```

## Removed code (don't reintroduce)

- `src/middleware/adminAuth.js` (the `x-admin-token` tier) — **deleted**. `/auth`, `/roles`, `/permissions` use `userAuth` + `requirePermission`; `ADMIN_API_TOKEN` is no longer required.
- `src/services/configService.js` (singular, Postgres-based) — **deleted**. The live service is `configServices.js` (plural, MongoDB).

## Known issues / gotchas

- **MongoDB Atlas IP whitelist** — if `configversions.find() buffering timed out` errors appear, the current machine's IP is not whitelisted in Atlas.
- **Only one default role per client** — creating a new `is_default` role automatically unsets `is_default` on all other roles for that client.
- **In-memory per-process state** — the RBAC cache (L1 ~60s) and the rate limiter both live in process memory, so a multi-instance deploy needs a shared store (Redis) to avoid stale permissions and per-instance rate limits.
- **Cross-origin cookies** — auth cookies use `sameSite: 'strict'` in production (`authRoutes.js`, `superadminRoutes.js`). If the UI and API are deployed on different sites (not just different subdomains), the browser won't send the cookie and auth breaks; use `sameSite: 'none'` + `secure: true` in that topology.
