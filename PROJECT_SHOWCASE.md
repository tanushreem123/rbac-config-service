# rbac-config-service — Project Showcase

A presentation-ready guide to the project: what problem it solves, how it works, who uses it, and a complete worked example with reference tables.

---

## Table of Contents

1. [Project Explanation](#1-project-explanation)
   - [The Problem It Solves](#the-problem-it-solves)
   - [The Key Approach](#the-key-approach)
   - [Key Results Achieved](#key-results-achieved)
2. [Narrative Walkthrough (spoken style)](#2-narrative-walkthrough-spoken-style)
3. [Use Cases](#3-use-cases)
4. [Worked Example — "AcmeAnalytics"](#4-worked-example--acmeanalytics)
   - [Narrative](#narrative)
   - [Reference Tables](#reference-tables)

---

## 1. Project Explanation

**rbac-config-service** is a multi-tenant platform that does two things usually built separately: it manages *who is allowed to do what* across many client organizations, and it manages *application configuration* (feature flags and settings) in a way that's safe to change and easy to undo.

- **Backend:** Node.js + Express 5 (port 3001)
- **Frontend:** Next.js 16 + React 19 admin dashboard (port 3000)
- **Storage:** PostgreSQL (relational RBAC data) + MongoDB (config versioning)

### The Problem It Solves

Modern SaaS platforms serve **many client organizations from one deployment**, which creates two hard problems:

1. **Who is allowed to do what?** Each client needs its own users, roles, and permissions — and one client must *never* see or touch another's data. A simple "admin vs. user" flag doesn't scale; real organizations need fine-grained, context-scoped access (e.g. "edit configs for *Project A* but only read them for *Team B*").

2. **How do you change application config safely?** Feature flags and runtime config change constantly. Editing them directly is dangerous — a bad value breaks production with no easy undo, and no record of *who changed what, when, and to what*.

The concrete pains it removes:
- **Tenant data leakage** → hard isolation between client organizations.
- **Coarse permissions** → context-scoped `resource:action` grants.
- **Risky config edits** → immutable, fully versioned config with one-click rollback.
- **Manual access provisioning** → self-service registration, email verification, and a superadmin onboarding flow.

### The Key Approach

**A. Layered, multi-tier authentication** — different callers get different doors:

| Tier | Mechanism | Used by |
|------|-----------|---------|
| User session | `access_token` httpOnly cookie + `requirePermission` | Roles, users, permissions UIs |
| Config RBAC chain | `clientContext → actionValidation → authMiddleware` | Config **writes** (context-scoped, flag-gated) |
| API key | SHA-256 hashed key lookup | Programmatic config **reads** |
| Platform admin | separate `sa_token` JWT | Cross-client management |

All JWTs live in **httpOnly cookies** (not localStorage) — defends against token theft via XSS.

**B. A relational RBAC model in PostgreSQL.** Access is modeled as data, not hardcoded:
`users → user_role_assignments → client_roles → role_permissions → permissions`, where every assignment is scoped to a **`(client, context)`** pair. Contexts are hierarchical (`client → team → project`), so the same user can hold different roles in different scopes.

**C. Defense-in-depth tenant isolation.** Enforced both in app code *and* at the database via **Postgres Row-Level Security** (`enforce_tenancy.sql`), with `app.current_client_id` set per request. Even a buggy query can't cross tenants.

**D. Polyglot persistence — right tool per job:**
- **PostgreSQL** for relational RBAC data (clients, users, roles, permissions, API keys, feature flags).
- **MongoDB** for config versioning, using an **immutable append-only history**: a `Config` document holds only an `activeVersion` pointer; every `ConfigVersion` is written once and never mutated. Create/update = insert new version + bump pointer; **rollback = just move the pointer**. Full audit trail and instant rollback come essentially for free.

**E. Performance & operational hardening:** an in-memory **two-level TTL cache** in `rbacService` (L1 per-user/context ~60s, L2 per-role ~300s); rate limiting; helmet; CORS preflight handling; and **fail-fast startup** that validates required env vars and DB connectivity before serving traffic.

### Key Results Achieved

- **A working multi-tenant control plane** — registration, email verification, login/refresh, role/permission management, API keys, and a separate superadmin onboarding area — backed by a clean 6-route Express 5 API and a Next.js / React admin UI.
- **True tenant isolation at two layers** (application checks *and* Postgres RLS), making cross-client access structurally impossible.
- **Safe, auditable configuration** — every change versioned immutably with full history and O(1) rollback.
- **Context-scoped fine-grained authorization** working end-to-end and fast, thanks to the TTL cache.
- **A security posture that improved over time** — the weak `x-admin-token` shared-secret tier was removed in favor of proper user-permission checks; config storage was consolidated onto the versioned MongoDB path (the older Postgres config service was deleted).
- **Developer-ready** — Docker Compose, an importable Insomnia collection, seed data, and a superadmin bootstrap script.

**Honest caveat:** the RBAC cache and rate limiter are *in-process*, so the system is currently single-instance. Horizontal scaling would require moving both to Redis to avoid stale permissions and per-instance rate limits.

---

## 2. Narrative Walkthrough (spoken style)

> A version written to be *said out loud* — for a demo or interview. Paced to run past five minutes with elaboration.

**Opening — what it is, in one breath.** "The project is **rbac-config-service**. At its heart it's a multi-tenant platform that does two things usually built separately: it manages *who is allowed to do what* across many client organizations, and it manages *application configuration* — feature flags and settings — in a way that's safe to change and easy to undo. It's a Node/Express backend on port 3001 and a Next.js/React admin dashboard on port 3000."

**The problem — why it needed to exist.** "Picture running one application serving lots of different companies from the same deployment. Two things get scary. First, **access control** — every company has its own people who need different access, and *no company should ever see another's data*. A simple 'admin or not' toggle falls apart, because the same person might be an admin on one project but a viewer on another. Second, **changing config in production** — one wrong value and something breaks, and you're left asking *who changed this, when, what was it before, and how fast can we undo it?* This project answers both: airtight tenant isolation and real RBAC on one side, safe versioned config with instant rollback on the other."

**The approach — decision by decision.**
- *Authentication:* different tiers for different callers. Humans get a JWT in an **httpOnly cookie** (JS can't read it — closes off token theft). Machines get an **API key**, hashed with SHA-256 so the raw key is never stored. Platform admins get a separate, walled-off token.
- *Permission model:* modeled as **data in PostgreSQL**, not hardcoded — users → role assignments → roles → permissions, each permission a `resource` + `action`. Every assignment is tied to a **context**, and contexts are hierarchical (client → team → project). That's what lets one person be an editor here and a viewer there.
- *Tenant isolation:* pushed down into the database with **Postgres Row-Level Security** — even a buggy query can't cross tenants. Defense in depth.
- *Storage:* two databases on purpose. Postgres for relational RBAC; **MongoDB with an append-only, immutable history** for config. A config doc stores only a pointer to its active version; changes write a *new* version and move the pointer, so history is preserved and **rollback is just moving the pointer back**.
- *Production-minded:* a **two-level in-memory cache** for permission checks, plus rate limiting, helmet, CORS handling, and a **fail-fast startup** that validates env vars and DB connectivity before accepting traffic.

**The results.** "A working multi-tenant control plane — register, verify email, log in, auto-refresh, manage roles/permissions/API keys, onboard new clients via superadmin. Isolation at two layers so cross-company access is structurally impossible. Config changes that are safe, versioned, and instantly reversible. And it shows *evolution* — I ripped out an early weak shared-secret admin token and replaced it with proper per-user permission checks."

**Honest closing.** "The cache and rate limiter live in the server's memory — fine for one instance, but to scale horizontally I'd move both to **Redis**. I've documented that as a known issue rather than pretend it isn't there. So that's the whole thing — multi-tenant RBAC plus safe, versioned config, with security and isolation as first principles."

---

## 3. Use Cases

This system is the **control plane behind the product** — the layer deciding, per company, who can do what and what the settings are. Its users are operators, admins, and other backend services, not the general public.

1. **B2B SaaS serving many clients.** One deployment, many tenant organizations (e.g. Acme, Globex, Initech), with hard walls between them via RLS. The bread-and-butter case.

2. **Delegated, self-service administration.** Give each customer an admin account so *they* manage their own users and roles — turning a support burden into a self-service feature. You onboard the company once via superadmin; they're self-sufficient after.

3. **Context-scoped permissions inside one company.** For organizations with internal structure (teams, projects). The same person can be a full admin on one project and read-only on another — expressed natively because every role assignment carries a context.

4. **Safe feature-flag and config management.** Roll out changes per client, carefully, with versioning and instant rollback. Config changes stop being scary one-way doors; there's always an answer to "who changed this and when?"

5. **Programmatic access for other services.** Backend services authenticate with a hashed API key and read config over REST, making this the **single source of truth** so services don't drift out of sync.

**One-sentence pitch:** *The system you reach for when running one platform for many client organizations, needing airtight separation, flexible per-team permissions, and a safe, auditable way to manage configuration — for both human admins and other services.*

**Where it's the wrong tool:**
- A **single-tenant app** — multi-tenancy and context scoping would be overkill.
- A **massive, high-traffic platform today** — needs the Redis upgrade first (currently single-instance). 
- **Consumer apps with millions of anonymous users** — built for *structured organizations* with admins and teams, not a flat sea of individual accounts.

The sweet spot: **multi-tenant B2B, real organizational structure, config that matters.**

---

## 4. Worked Example — "AcmeAnalytics"

### Narrative

**Setting the scene.** AcmeAnalytics is a mid-sized company on our platform that runs dashboards for *its* customers. It's a single **tenant** — everything about it lives in a sealed box no other client can see into. A platform superadmin created the client and its first admin during onboarding; from then on, Acme runs itself.

**Internal structure (contexts).** Acme isn't flat. The hierarchy: the **company level** (AcmeAnalytics), a **Payments team** (billing-sensitive work), a **Growth team** (marketing/experiments), and under Growth a project called **"New Onboarding Flow."** A person's permissions are always scoped to one of these contexts — not the whole company at once.

**People and roles.**
- **Maya** — platform admin, **Admin** role at the company level. Can do everything.
- **Raj** — senior engineer, **Editor** scoped *only* to Payments. He can read/write Payments config; touching a Growth config is denied because he has no assignment there.
- **Sara** — PM, **Editor** scoped to the "New Onboarding Flow" project, plus **Viewer** at the broader Growth team. She actively changes her experiment but can only look at the rest of Growth.

**What roles mean (permissions).** "Admin/Editor/Viewer" are just labels; permissions give them teeth. A permission is a `resource` + `action` (e.g. `config:read`, `config:write`). Viewer gets the reads; Editor adds `config:write`; Admin adds `user:write`, `role:write`, `flag:write`. None of it is hardcoded — Maya can invent a new "Auditor" role by attaching read permissions, no deploy needed.

**The live scenario — a real-time rollout.** Sara wants to launch her new onboarding flow carefully. She's an Editor on the project, so she's allowed. She updates `onboarding.flow.version` from `'classic'` to `'v2'`. Under the hood the old value isn't overwritten — a *new version* is written and the active pointer moves to it. Then she flips the feature flag `new_onboarding_enabled` to **on**, but only for AcmeAnalytics — no other company is affected. The new flow goes live.

**When it goes wrong — the payoff.** Twenty minutes later, support tickets: users stuck on step two. Sara flips `new_onboarding_enabled` back to **off** — the product instantly falls back to the classic flow. Then she **rolls back** the config: because every version is immutable and preserved, rollback just moves the pointer back to the known-good version — instant and guaranteed correct. Next morning, Maya sees the full audit trail: version created by Sara at 2:14 PM, flag toggled, rolled back at 2:38 PM. No detective work.

**The machine angle.** Acme's product isn't a person clicking buttons — it's backend services. On startup, Acme's onboarding service calls our API with an **API key** and asks for the current onboarding config; we hand back the active version. The system is the **single source of truth** — humans manage via dashboard, machines read via API, everyone in sync.

### Reference Tables

#### The Client (Tenant)

| Field | Value |
|-------|-------|
| Client name | AcmeAnalytics |
| Client ID | `acme-1111-...` (UUID) |
| Onboarded by | Platform superadmin |
| Isolation | Postgres RLS — `app.current_client_id` scoped to this UUID |

#### Contexts (`client → team → project`)

| Context | Type | Parent | Purpose |
|---------|------|--------|---------|
| AcmeAnalytics | `client` | — | Company-wide top level |
| Payments | `team` | AcmeAnalytics | Billing-sensitive work |
| Growth | `team` | AcmeAnalytics | Marketing & experiments |
| New Onboarding Flow | `project` | Growth | The live experiment |

#### Users

| User | Real role at Acme |
|------|-------------------|
| Maya | Platform admin for the company |
| Raj | Senior engineer, Payments |
| Sara | Product manager, Growth |

#### Permissions (`resource:action` building blocks)

| Permission | resource | action | Capability granted |
|------------|----------|--------|--------------------|
| `config:read` | config | read | View configuration values |
| `config:write` | config | write | Create/update config (new version) |
| `flag:read` | flag | read | View feature flags |
| `flag:write` | flag | write | Toggle feature flags |
| `user:write` | user | write | Add/manage users |
| `role:write` | role | write | Create/modify roles |

#### Roles → Permissions

| Role | config:read | config:write | flag:read | flag:write | user:write | role:write |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Viewer** | ✅ | — | ✅ | — | — | — |
| **Editor** | ✅ | ✅ | ✅ | — | — | — |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Role Assignments (note the **context** column)

| User | Role | Scoped to context | What it means in practice |
|------|------|-------------------|---------------------------|
| Maya | Admin | AcmeAnalytics (client) | Full control company-wide |
| Raj | Editor | Payments (team) | Can read/write Payments config only |
| Sara | Editor | New Onboarding Flow (project) | Can change the experiment's config |
| Sara | Viewer | Growth (team) | Read-only across the rest of Growth |

> The heart of it: Sara is an **Editor** in one context and a **Viewer** in another. Raj writing to a Growth config → **denied**.

#### Configs (versioned, MongoDB)

| Config key | Active version | Value | Type | Owning context |
|------------|:-:|-------|------|----------------|
| `onboarding.flow.version` | v5 → **rolled back to v4** | `'classic'` | string | New Onboarding Flow |
| `dashboard.refresh.seconds` | v2 | `30` | number | AcmeAnalytics |
| `payments.retry.enabled` | v3 | `true` | boolean | Payments |

**Version history for `onboarding.flow.version`** (nothing is ever overwritten):

| Version | Value | Created by | Time | Status |
|:-:|-------|-----------|------|--------|
| v3 | `'classic'` | Maya | last month | superseded |
| v4 | `'classic'` | Maya | last week | **← active after rollback** |
| v5 | `'v2'` | Sara | Tue 2:14 PM | created, then rolled back |

> Rollback = pointer moves from v5 back to v4. v5 still exists in history; it's just no longer active.

#### Feature Flags (per-client, Postgres)

| Flag name | Client | Enabled | Environment | Toggled by |
|-----------|--------|:-:|------|-----------|
| `new_onboarding_enabled` | AcmeAnalytics | ❌ (off after incident) | production | Sara |
| `beta_export_tools` | AcmeAnalytics | ✅ | production | Maya |

#### Incident Timeline

| Time | Actor | Action | System effect |
|------|-------|--------|---------------|
| 2:14 PM | Sara | Set `onboarding.flow.version` → `'v2'` | New version **v5** written; pointer → v5 |
| 2:15 PM | Sara | Flip `new_onboarding_enabled` → on | v2 flow live **for Acme only** |
| 2:36 PM | — | Support tickets: users stuck | Incident begins |
| 2:37 PM | Sara | Flip `new_onboarding_enabled` → off | Product falls back to classic instantly |
| 2:38 PM | Sara | Rollback config | Pointer → **v4** (`'classic'`), guaranteed-correct |
| Next AM | Maya | Reviews history | Full audit trail visible — no detective work |

---

*This document maps directly to the real system: contexts (`client → team → project`), `resource:action` permissions, per-client feature flags, immutable `ConfigVersion` history with pointer-based rollback, and API-key reads.*
