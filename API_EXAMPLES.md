# API Examples & cURL Commands

Use these examples to test the API directly from your terminal or in Insomnia.

---

## 🟢 Public Endpoints (No Authentication Required)

### 1. Health Check
**Purpose**: Verify the API is running

**cURL Command:**
```bash
curl -X GET http://localhost:3001/health
```

**Expected Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### 2. Get All Active Configs for an Environment
**Purpose**: Fetch all active configuration values for a specific environment

**cURL Command:**
```bash
curl -X GET "http://localhost:3001/configs?env=production"
```

**URL Parameters:**
- `env` (required): The environment name
  - Examples: `production`, `staging`, `development`, `qa`

**Expected Response (200 OK):**
```json
{
  "database_url": "postgresql://user:password@db.example.com:5432/mydb",
  "api_key": "sk-1234567890",
  "debug_mode": "false",
  "max_connections": "100"
}
```

**Example with different environments:**
```bash
# Staging environment
curl -X GET "http://localhost:3001/configs?env=staging"

# Development environment
curl -X GET "http://localhost:3001/configs?env=development"
```

---

### 3. Get Config Version History
**Purpose**: View all historical versions of a specific config key

**cURL Command:**
```bash
curl -X GET "http://localhost:3001/configs/database_url/versions?env=production"
```

**URL Parameters:**
- `:key` (in URL): The config key name (e.g., `database_url`, `api_key`)
- `env` (query): The environment name

**Expected Response (200 OK):**
```json
[
  {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "configKey": "database_url",
    "environment": "production",
    "version": 3,
    "value": "postgresql://user:password@new-db.example.com:5432/mydb",
    "createdBy": "admin",
    "createdAt": "2026-05-13T14:30:00Z"
  },
  {
    "_id": "665f1a2b3c4d5e6f7a8b9c0c",
    "configKey": "database_url",
    "environment": "production",
    "version": 2,
    "value": "postgresql://user:password@db.example.com:5432/mydb",
    "createdBy": "john_doe",
    "createdAt": "2026-05-13T12:00:00Z"
  },
  {
    "_id": "665f1a2b3c4d5e6f7a8b9c0b",
    "configKey": "database_url",
    "environment": "production",
    "version": 1,
    "value": "postgresql://user:password@old-db.example.com:5432/mydb",
    "createdBy": "admin",
    "createdAt": "2026-05-13T09:00:00Z"
  }
]
```

**Other examples:**
```bash
# Get versions for an API key in staging
curl -X GET "http://localhost:3001/configs/api_key/versions?env=staging"

# Get versions for debug mode in development
curl -X GET "http://localhost:3001/configs/debug_mode/versions?env=development"
```

---

## 🔐 Admin Endpoints (Authentication Required)

> **Note**: These endpoints require:
> - Header: `x-admin-token: super-secret-admin-token`
> - Header: `Authorization: Bearer <JWT_TOKEN>` (if auth is enforced)

### 1. Create or Update Config
**Purpose**: Create a new config or update an existing one. Each change creates a new immutable version.

**cURL Command:**
```bash
curl -X POST http://localhost:3001/configs \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "key": "database_url",
    "environment": "production",
    "value": "postgresql://user:password@db.example.com:5432/mydb",
    "createdBy": "admin"
  }'
```

**Request Body Parameters:**
- `key` (string, required): The config key identifier
- `environment` (string, required): Target environment
- `value` (string, required): The configuration value
- `createdBy` (string, optional): Who made this change (default: "admin")

**Expected Response (200 OK):**
```json
{
  "key": "database_url",
  "environment": "production",
  "version": 1
}
```

**More Examples:**

Create API Key:
```bash
curl -X POST http://localhost:3001/configs \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "api_key",
    "environment": "staging",
    "value": "sk-staging-1234567890abcdef",
    "createdBy": "devops_team"
  }'
```

Update Debug Mode:
```bash
curl -X POST http://localhost:3001/configs \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "debug_mode",
    "environment": "development",
    "value": "true",
    "createdBy": "john_doe"
  }'
```

---

### 2. Rollback Config to Previous Version
**Purpose**: Revert a config to a specific previous version

**cURL Command:**
```bash
curl -X POST http://localhost:3001/configs/rollback \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "key": "database_url",
    "environment": "production",
    "targetVersion": 2
  }'
```

**Request Body Parameters:**
- `key` (string, required): The config key identifier
- `environment` (string, required): Target environment
- `targetVersion` (integer, required): The version number to revert to

**Expected Response (200 OK):**
```json
{
  "key": "database_url",
  "environment": "production",
  "version": 2
}
```

**Example: Rollback to first version:**
```bash
curl -X POST http://localhost:3001/configs/rollback \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "api_key",
    "environment": "staging",
    "targetVersion": 1
  }'
```

---

## 📊 Common Testing Workflows

### Workflow 1: Create and Verify a Config
```bash
# Step 1: Create a new config
curl -X POST http://localhost:3001/configs \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "max_retries",
    "environment": "development",
    "value": "3",
    "createdBy": "dev_team"
  }'

# Step 2: Retrieve all development configs to verify
curl -X GET "http://localhost:3001/configs?env=development"

# Step 3: Check the version history
curl -X GET "http://localhost:3001/configs/max_retries/versions?env=development"
```

### Workflow 2: Update and Rollback
```bash
# Step 1: Update a config
curl -X POST http://localhost:3001/configs \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "max_connections",
    "environment": "production",
    "value": "200",
    "createdBy": "devops"
  }'

# Step 2: Verify the new value
curl -X GET "http://localhost:3001/configs?env=production"

# Step 3: View version history (will show version 2 is now active)
curl -X GET "http://localhost:3001/configs/max_connections/versions?env=production"

# Step 4: If something is wrong, rollback to version 1
curl -X POST http://localhost:3001/configs/rollback \
  -H "Content-Type: application/json" \
  -H "x-admin-token: super-secret-admin-token" \
  -d '{
    "key": "max_connections",
    "environment": "production",
    "targetVersion": 1
  }'
```

### Workflow 3: Cross-Environment Testing
```bash
# Create same config in multiple environments
for env in development staging production; do
  curl -X POST http://localhost:3001/configs \
    -H "Content-Type: application/json" \
    -H "x-admin-token: super-secret-admin-token" \
    -d "{
      \"key\": \"feature_flags\",
      \"environment\": \"$env\",
      \"value\": \"{\\\"new_ui\\\": true}\",
      \"createdBy\": \"automation\"
    }"
done

# View each environment's config
for env in development staging production; do
  echo "=== $env ===" 
  curl -X GET "http://localhost:3001/configs?env=$env"
done
```

---

## 🔍 Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Config created/retrieved successfully |
| 400 | Bad Request | Missing required fields, invalid data |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Admin token invalid or access denied |
| 404 | Not Found | Config key or version doesn't exist |
| 500 | Server Error | Internal server error |

---

## 🐛 Example Error Responses

**Missing Required Field:**
```json
{
  "error": "key is required"
}
```

**Invalid Environment:**
```json
{
  "error": "environment is required"
}
```

**Version Not Found:**
```json
{
  "error": "Version 10 not found for key: database_url"
}
```

---

## 💻 Insomnia Import

All these requests are pre-configured in the `Insomnia_Collection.json` file. Import it to Insomnia to get started quickly!

See `INSOMNIA_QUICK_START.md` for detailed import instructions.
