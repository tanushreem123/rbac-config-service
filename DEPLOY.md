# Deploying to AWS EC2 (single instance)

Production deploy of the RBAC + config service onto **one EC2 instance** running
everything via Docker Compose, with **MongoDB Atlas** for config data and a
**Postgres container** for RBAC data. Caddy terminates TLS and routes a single
domain. Target cost: **~$18/mo**, comfortably inside the $200 / 6-month credits.

```
                 Internet
                    │  :443 / :80
            ┌───────▼─────────────────────────┐
            │ EC2 t3.small  (Elastic IP = EIP) │
            │  ┌────────────────────────────┐  │
            │  │ Caddy (TLS, reverse proxy) │  │
            │  │   /api/* → api:3001        │  │
            │  │   /*     → frontend:3000   │  │
            │  └──────┬───────────┬─────────┘  │
            │     api:3001    frontend:3000     │
            │         │                          │
            │   postgres:5432 (container+volume) │
            └─────────┼──────────────────────────┘
                      │ outbound (TLS)
                      ▼
              MongoDB Atlas  ← whitelist the EIP only
```

Files this uses (all in the repo):
`docker-compose.prod.yml`, `deploy/Caddyfile`, `config-management-ui/Dockerfile.prod`,
`.env.prod.example`, `deploy/setup-ec2.sh`, `deploy/backup-postgres.sh`.

---

## Phase 1 — AWS provisioning (one-time, console)

1. **Launch EC2**
   - AMI: **Ubuntu 22.04 LTS**
   - Type: **t3.small** (2 GB RAM — `t3.micro`/1 GB will OOM on the Next.js build)
   - Storage: **20 GB gp3**
   - Key pair: create/download one for SSH.

2. **Allocate an Elastic IP** → associate it with the instance. This is your
   permanent address — call it `<EIP>`. (It's free *while attached to a running
   instance*; a stopped instance or unattached EIP starts billing ~$3.6/mo.)

3. **Security Group — inbound rules** (everything else stays closed; Postgres,
   api, and frontend are never exposed publicly):
   | Port | Source | Why |
   |------|--------|-----|
   | 22   | **My IP only** | SSH |
   | 80   | 0.0.0.0/0 | HTTP→HTTPS redirect + Let's Encrypt ACME |
   | 443  | 0.0.0.0/0 | HTTPS |

4. **MongoDB Atlas → Network Access → Add IP** → `<EIP>/32`.
   One time. This is the fix for the dynamic-laptop-IP whitelist pain.

5. **DNS** → at [duckdns.org](https://www.duckdns.org/domains), set the
   `authzy` domain's IP to `<EIP>` and click **update ip**. (It starts pointing at
   your laptop — it MUST be changed to the EC2 Elastic IP or Let's Encrypt fails.)

6. **Billing alarm** (recommended) → AWS Budgets → alert at ~$25 so you're warned
   before/after the credits run out at month 6.

---

## Phase 2 — Host setup (on the instance)

```bash
ssh -i your-key.pem ubuntu@<EIP>

git clone https://github.com/<you>/rbac-config-service.git
cd rbac-config-service

bash deploy/setup-ec2.sh     # installs Docker + compose + awscli, adds 2 GB swap
exit                          # log out/in so the docker group applies
```

Re-SSH after the re-login.

---

## Phase 3 — Configure secrets

```bash
cd rbac-config-service
cp .env.prod.example .env.prod
chmod 600 .env.prod
nano .env.prod               # fill in EVERY value (see notes below)
```

Required values in `.env.prod`:
- `DOMAIN` = `authzy.duckdns.org`, `ACME_EMAIL` = your email (TLS certs)
- `DB_USER` / `DB_PASSWORD` / `DB_NAME` — strong password (`openssl rand -base64 24`)
- `MONGO_URI` — your Atlas connection string
- `JWT_SECRET` — `openssl rand -hex 32`
- `SMTP_*` — Brevo (or other) creds; `SMTP_FROM` must be a **verified** sender
- `NEXT_PUBLIC_CONTEXT_ID` — optional, the context UUID

> The backend exits at startup if `JWT_SECRET`, `DATABASE_URL`, `MONGO_URI`,
> `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` are missing — so fill them all.

---

## Phase 4 — Launch

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First boot:
- Postgres initialises **schema → migrations 001–005 → RLS** automatically (only
  on the first run, against the empty volume).
- Caddy fetches a Let's Encrypt cert for `DOMAIN` (needs DNS already pointing at
  `<EIP>` and ports 80/443 open).

Then create the platform admin (interactive):
```bash
docker exec -it config_api npm run create-superadmin
```

> **Seed data:** automatic init applies schema + migrations only. If you need the
> permission catalog / sample seeds, apply them manually, e.g.:
> `docker exec -i rbac_db psql -U $DB_USER -d $DB_NAME < config-management-service/db/seeds/user_seeds.sql`

---

## Phase 5 — Verify

```bash
curl -i https://authzy.duckdns.org/api/health      # → 200 (checks Postgres + Mongo)
docker compose -f docker-compose.prod.yml ps    # all containers Up/healthy
docker compose -f docker-compose.prod.yml logs -f api   # watch for startup errors
```
Then open `https://authzy.duckdns.org` in a browser → log in / register.

If `/api/health` returns 503 with a Mongo error, the EIP isn't whitelisted in
Atlas yet (Phase 1.4).

---

## Operations

**Deploy an update:**
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

**Backups (set up once):**
```bash
crontab -e
# nightly at 03:00
0 3 * * * /home/ubuntu/rbac-config-service/deploy/backup-postgres.sh >> /home/ubuntu/pg-backup.log 2>&1
```
Set `BACKUP_S3_BUCKET` in `.env.prod` to also push dumps to S3.

**Restore a backup:**
```bash
gunzip -c ~/pg-backups/rbac_db-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i rbac_db psql -U $DB_USER -d $DB_NAME
```

**Logs / restart:**
```bash
docker compose -f docker-compose.prod.yml logs -f <api|frontend|caddy|postgres>
docker compose -f docker-compose.prod.yml restart api
```

---

## Notes & limits (by design, for this single-instance setup)

- **Single instance only.** The RBAC cache and rate limiter live in process
  memory. Do **not** add a second instance / load balancer without first moving
  them to Redis (see CLAUDE.md → "In-memory per-process state").
- **Same-origin cookies.** UI and API share one domain via Caddy path routing, so
  the backend's `sameSite='strict'` prod cookies work and there's no CORS. If you
  ever split them onto different sites, revisit cookie `sameSite`/`secure`.
- **Postgres durability is on you.** It's a container on this box — the nightly
  `pg_dump` is your safety net. For zero-ops durability later, move to RDS.
- **Atlas link is public-internet (TLS) but IP-restricted** to the EIP. For a
  fully private link (VPC peering / PrivateLink) you'd need an M10+ cluster.
