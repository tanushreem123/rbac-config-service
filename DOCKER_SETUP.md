# Docker Setup Guide

## Prerequisites

- **Docker**: [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Docker Compose**: Included with Docker Desktop

## Quick Start

### 1. Start All Services
```bash
docker-compose up -d
```

This will start:
- ✅ PostgreSQL database on port 5432
- ✅ Node.js API backend on port 3001
- ✅ Next.js frontend on port 3000

### 2. Check Service Status
```bash
docker-compose ps
```

### 3. View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f frontend
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health

## Setup Database

The database is automatically initialized on first run. If you need to manually seed test data:

```bash
# Connect to PostgreSQL inside Docker
docker-compose exec postgres psql -U tanushreemiskin -d rbac_db

# Or run SQL file
docker-compose exec postgres psql -U tanushreemiskin -d rbac_db -f /app/db/seed_users.sql
```

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Key variables:**
- `DB_USER`: PostgreSQL username (default: tanushreemiskin)
- `DB_PASSWORD`: PostgreSQL password (default: Tanushree@123)
- `JWT_SECRET`: JWT signing secret
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint

## Common Commands

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Data
```bash
docker-compose down -v
```

### Rebuild Services
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Rebuild Specific Service
```bash
docker-compose build --no-cache api
docker-compose up -d api
```

### View Database
```bash
docker-compose exec postgres psql -U tanushreemiskin -d rbac_db

# List tables
\dt

# Exit
\q
```

### View API Logs
```bash
docker-compose logs -f api
```

### Shell Access to Container
```bash
# API container
docker-compose exec api sh

# Database container
docker-compose exec postgres sh

# Frontend container
docker-compose exec frontend sh
```

## Troubleshooting

### Port Already in Use
If ports 3000, 3001, or 5432 are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "3001:3001"  # Change first number (e.g., "3002:3001")
```

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### API Can't Connect to Database
```bash
# Verify network connectivity
docker-compose exec api ping postgres

# Check database credentials
docker-compose logs postgres
```

### Clean Restart
```bash
# Stop all services and remove everything
docker-compose down -v

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

## Development Workflow

### Hot Reload (Frontend)
Changes to `/app` are automatically reflected in the running Next.js app.

### Hot Reload (Backend)
Changes to `/src` are automatically reflected if `npm start` supports watch mode.

To use nodemon for hot reload, update backend package.json:
```json
"scripts": {
  "start": "nodemon src/server.js"
}
```

Then rebuild:
```bash
docker-compose build --no-cache api
docker-compose up -d api
```

## Production Deployment

For production, use environment-specific compose files:

```bash
# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

## Network Details

All services communicate on the `config-network` bridge network:
- `api` → `postgres` (port 5432)
- `frontend` → `api` (port 3001)

Internal DNS names:
- `postgres:5432` (from api)
- `api:3001` (from frontend)

## Monitoring

### Container Stats
```bash
docker stats
```

### Persistent Volume
PostgreSQL data is stored in `postgres_data` volume, persisting across restarts.

To backup:
```bash
docker run --rm -v postgres_data:/data -v $(pwd):/backup postgres:15 tar czf /backup/postgres_backup.tar.gz -C / data
```

## Support

For Docker issues:
- Check logs: `docker-compose logs -f`
- Verify container health: `docker-compose ps`
- Rebuild: `docker-compose build --no-cache && docker-compose up -d`
