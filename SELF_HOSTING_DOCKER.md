# Self-Hosting With Docker

This setup runs the project with:

- React/TanStack website on port `5173`
- Flask backend API on port `8000`
- PostgreSQL database on port `5432`

The Flask backend is the self-hosted replacement for Supabase. Secrets stay in
the backend container and PostgreSQL is private inside Docker.

## 1. Prepare environment

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Change at least:

```text
POSTGRES_PASSWORD=...
JWT_SECRET=...
GEMINI_API_KEY=...
```

## 2. Start all services

```bash
docker compose --env-file .env.docker up --build
```

Open:

```text
Website: http://localhost:5173
Backend: http://localhost:8000/health
PostgreSQL: localhost:5432
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
