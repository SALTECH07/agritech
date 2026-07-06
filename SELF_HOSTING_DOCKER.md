# Self-Hosting With Docker

This setup runs the project with:

- React/TanStack website on port `5173`
- Flask backend API on port `8000`
- PostgreSQL database on port `5432`

The Flask backend is the self-hosted replacement for Supabase. Secrets stay in
the backend container and PostgreSQL is private inside Docker.

For public HTTPS deployment on `farming-guide.com`, install Nginx directly on
the Linux host, use the reverse proxy files in `nginx/`, and follow
`NGINX_SETUP.md`. Nginx is not part of Docker Compose in this setup.

## 1. Prepare environment

Development:

```bash
cp .env.development.example .env.docker
nano .env.docker
```

Production:

```bash
cp .env.production.example .env.docker
nano .env.docker
```

Change at least:

```text
POSTGRES_PASSWORD=...
JWT_SECRET=...
GEMINI_API_KEY=...
```

For the full variable list and security notes, see `ENVIRONMENT_VARIABLES.md`.

## 2. Start all services

```bash
docker compose --env-file .env.docker up --build -d
```

Open:

```text
Website: http://localhost:5173
Backend: http://localhost:8000/health
PostgreSQL: localhost:5432
```

In production, Nginx should be the public entry point:

```text
Website: https://farming-guide.com
Backend API: https://farming-guide.com/api
```

Docker services should stay bound to `127.0.0.1` so only host Nginx can reach
the raw frontend, backend, and database ports.

After the first successful build, use this faster command when you only want to
start the existing containers:

```bash
docker compose --env-file .env.docker up -d
```

Rebuild only after changing `package.json`, `package-lock.json`,
`Dockerfile.frontend`, backend requirements, or Docker files:

```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

## Frontend build speed and dependency warnings

The first frontend build can take a while because Docker must download the full
React, TanStack, Vite, chart, QR, and UI dependency tree inside a clean Linux
image. A first `npm ci` around one or two minutes is normal on many machines.

This project keeps an npm download cache inside Docker builds, so later rebuilds
should be faster when `package.json` and `package-lock.json` have not changed.

The current deprecation warnings are from frontend packages:

- `recharts@2.15.4`: the v2 chart library branch is deprecated. The website can
  still run, but moving to Recharts v3 should be handled as a separate tested
  chart migration.
- `tsconfck@3.1.6`: this is pulled through `vite-tsconfig-paths`, which is used
  by the Lovable/TanStack Vite setup. This warning is not caused by the Flask
  backend and does not expose secrets in the browser.

For normal daily use, prefer:

```bash
npm run docker:start
```

Use a rebuild when you changed dependencies or Docker configuration:

```bash
npm run docker:up
```

Watch service logs when needed:

```bash
npm run docker:logs
```

## 3. Create a farmer account

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"farmer@example.com","password":"change-me-123","full_name":"Demo Farmer"}'
```

Copy the returned `token`. Use it as:

```text
Authorization: Bearer YOUR_TOKEN
```

## 4. Create a manual device

```bash
curl -X POST http://localhost:8000/api/devices/manual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Greenhouse 1","crop":"Tomato","location_name":"Kipawa"}'
```

Copy the returned `device_key`.

## 5. Send microcontroller data

```bash
curl -X POST http://localhost:8000/api/public/devices/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEVICE_KEY" \
  -d '{"soil_moisture":41,"temperature_c":28,"humidity":63,"water_level":72,"pump_on":false}'
```

For a microcontroller on the same network, use your server IP:

```text
http://SERVER_IP:8000/api/public/devices/ingest
```

For production with a domain and HTTPS, put Nginx or Cloudflare in front of the
backend:

```text
https://farming-guide.com/api/public/devices/ingest
```

## 6. Stop services

```bash
docker compose --env-file .env.docker down
```

Keep database data:

```bash
docker compose --env-file .env.docker down
```

Delete database data:

```bash
docker compose --env-file .env.docker down -v
```

## 7. Important migration note

The Flask backend and PostgreSQL are ready for self-hosting. The current React
screens still contain Supabase client calls, so the next step is to migrate
frontend pages to `VITE_API_BASE_URL` endpoints:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Start with auth, devices, finance, alerts, then chat.
