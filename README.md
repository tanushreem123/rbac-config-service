# rbac-config-service

A multi-tenant **RBAC + versioned configuration management** service — a control
plane for managing runtime configuration and feature toggles, with role-based
access control, immutable version history, and rollback safety.

### 🔗 Live demo — **[authzy.duckdns.org](https://authzy.duckdns.org)**

> Deployed on AWS EC2 (Amazon Linux 2023) behind Caddy with automatic HTTPS.
> Superadmin console: **[/superadmin/login](https://authzy.duckdns.org/superadmin/login)**.
> See **[DEPLOY.md](DEPLOY.md)** for the full one-instance deployment guide.

---

## What it does

- **RBAC** — clients (tenants), users, roles, and `resource:action` permissions,
  with context-scoped role assignments and per-tenant isolation (Postgres RLS).
- **Versioned config** — every config write creates a new **immutable** version
  and advances an active pointer; **rollback** just moves the pointer back.
- **Multi-tenant** — every query is scoped by `client_id`; a superadmin console
  manages clients across the platform.
- **Auth** — self-service registration with email verification, login/logout,
  silent session refresh; JWTs in httpOnly cookies.
- **API keys** — issue/revoke SHA-256-hashed keys for programmatic config reads.
- **Feature flags** — per-client flags checked in the auth middleware.

## Tech stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, **Express 5** (ESM), JWT, bcrypt, helmet, express-rate-limit |
| Frontend | **Next.js 16** + React 19 (App Router) |
| Data | **PostgreSQL** (RBAC data) + **MongoDB Atlas** (config version history) |
| Infra | Docker Compose, **Caddy** (auto-HTTPS reverse proxy), AWS EC2 |

## Architecture

```
Browser ──HTTPS──> Caddy ──/api/*──> Express API ──> PostgreSQL (RBAC)
                     │                     └────────> MongoDB Atlas (config versions)
                     └──/*───────────────> Next.js frontend
```

Everything runs on **one origin** (Caddy path-routes `/api/*` to the backend and
`/*` to the frontend), so auth cookies stay same-origin with no CORS.

- **PostgreSQL** holds all RBAC data: clients, users, contexts, roles,
  permissions, role assignments, refresh tokens, API keys, feature flags.
- **MongoDB Atlas** holds config versioning only: `Config` (active pointer) +
  `ConfigVersion` (immutable history).

## Local development

```bash
# Backend (config-management-service/)
cp .env.example config-management-service/.env   # fill in values
docker compose up                                # Postgres + API + frontend

# or run the whole stack with the dev compose:
docker compose up --build
```

Backend: `http://localhost:3001` · Frontend: `http://localhost:3000`.
See **[DOCKER_SETUP.md](DOCKER_SETUP.md)** and **[00_START_HERE.md](00_START_HERE.md)**.

## Deployment

Single-instance AWS EC2 deploy (Docker Compose + Caddy + MongoDB Atlas), with a
Postgres container, auto-HTTPS via Let's Encrypt, and a fresh admin bootstrap.
Full runbook: **[DEPLOY.md](DEPLOY.md)**.

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Documentation

| Doc | What's in it |
|-----|--------------|
| [PROJECT_SHOWCASE.md](PROJECT_SHOWCASE.md) | Problem, approach, use cases, worked example |
| [DEPLOY.md](DEPLOY.md) | AWS EC2 deployment runbook |
| [API_EXAMPLES.md](API_EXAMPLES.md) | Request/response examples |
| [CLAUDE.md](CLAUDE.md) | Architecture reference (routes, auth tiers, RBAC model) |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Local Docker setup |
