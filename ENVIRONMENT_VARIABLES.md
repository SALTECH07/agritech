# Environment Variables

Use these templates:

- Development: `.env.development.example`
- Production: `.env.production.example`
- Docker Compose runtime file: `.env.docker`

Do not commit `.env`, `.env.docker`, or any file containing real secrets.

## Quick Start For Development

```bash
cp .env.development.example .env.docker
docker compose --env-file .env.docker up --build
```

Development URLs:

```text
Frontend: http://localhost:5173
Backend: http://localhost:8000
Database: localhost:5432
```

## Quick Start For Production

```bash
cp .env.production.example .env.docker
nano .env.docker
docker compose --env-file .env.docker up --build -d
```

Change every `CHANGE_ME` value before running production.

## Public vs Secret

Values starting with `VITE_` are public because they are included in browser
JavaScript. Users can inspect them in the browser.

Safe public values:

```text
VITE_API_BASE_URL
VITE_SUPABASE_URL placeholder
VITE_SUPABASE_PUBLISHABLE_KEY placeholder
```

Secret backend-only values:

```text
POSTGRES_PASSWORD
DATABASE_URL
JWT_SECRET
GEMINI_API_KEY
OPENAI_API_KEY
TWILIO_API_KEY
```

Never add real secrets to a variable beginning with `VITE_`.

## Required Variables

PostgreSQL:

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_PORT
```

Flask backend:

```text
BACKEND_PORT
JWT_SECRET
JWT_EXPIRES_HOURS
CORS_ORIGINS
```

React frontend:

```text
FRONTEND_PORT
VITE_API_BASE_URL
```

AI assistant:

```text
AI_PROVIDER
GEMINI_API_KEY
GEMINI_MODEL
OPENAI_API_KEY
OPENAI_MODEL
```

## Recommended Production Values

For `https://farming-guide.com`:

```text
CORS_ORIGINS=https://farming-guide.com,https://www.farming-guide.com
VITE_API_BASE_URL=https://farming-guide.com
```

If the API is hosted separately:

```text
CORS_ORIGINS=https://farming-guide.com,https://www.farming-guide.com
VITE_API_BASE_URL=https://api.farming-guide.com
```

## Generate Strong Secrets

Linux:

```bash
openssl rand -hex 32
```

PowerShell:

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Use one generated value for `JWT_SECRET`, and a different strong password for
`POSTGRES_PASSWORD`.
