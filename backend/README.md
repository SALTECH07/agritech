# Farm Buddy Flask Backend

This backend is the self-hosted replacement for Supabase server/database
features. It stores data in PostgreSQL and keeps sensitive keys on the server.

Main API groups:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/devices`
- `POST /api/devices/manual`
- `POST /api/devices/claim`
- `POST /api/public/devices/register`
- `POST /api/public/devices/ingest`
- `GET /api/public/commands/next`
- `POST /api/public/devices/ack`
- `GET /api/finance`
- `POST /api/finance`
- `POST /api/chat`

Run with Docker Compose from the project root:

```bash
docker compose --env-file .env.docker up --build
```
