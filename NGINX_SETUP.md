# Nginx Setup For farming-guide.com

Use this when the app is self-hosted with Docker on a Linux server.

Nginx is installed directly on the Linux host, not inside Docker. Docker Compose
runs only:

```text
postgres
backend
frontend
```

Do not add an Nginx service to `docker-compose.yml` for this setup.

Nginx will receive public traffic on:

```text
https://farming-guide.com
```

Then host Nginx sends traffic internally to Docker-published localhost ports:

```text
Frontend: http://127.0.0.1:5173
Backend API: http://127.0.0.1:8000
```

Routes:

```text
https://farming-guide.com/            -> frontend
https://farming-guide.com/api/...     -> Flask backend
https://farming-guide.com/health      -> Flask backend health check
https://farming-guide.com/api/health  -> Flask API health check
```

## 1. Point DNS to the server

In Cloudflare DNS, create:

```text
A     farming-guide.com       YOUR_SERVER_IP
CNAME www                     farming-guide.com
```

For SSL, use Cloudflare SSL/TLS mode:

```text
Full (strict)
```

## 2. Install Nginx and Certbot

Run this on the Linux host, outside Docker:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

Open the web firewall:

```bash
sudo ufw allow 'Nginx Full'
```

## 3. Start the Docker app

From the project folder:

```bash
cp .env.production.example .env.docker
nano .env.docker
docker compose --env-file .env.docker up --build -d
```

Make sure these production values are set:

```text
VITE_API_BASE_URL=https://farming-guide.com
CORS_ORIGINS=https://farming-guide.com,https://www.farming-guide.com
FRONTEND_BIND_ADDRESS=127.0.0.1
BACKEND_BIND_ADDRESS=127.0.0.1
POSTGRES_BIND_ADDRESS=127.0.0.1
```

These bind addresses are important for host-based Nginx. They make Docker expose
the raw app ports only to the server itself, while public visitors use Nginx on
ports `80` and `443`.

## 4. Install the bootstrap Nginx config

Use this first because SSL files do not exist yet:

```bash
sudo cp nginx/farming-guide.com.bootstrap.conf /etc/nginx/sites-available/farming-guide.com
sudo ln -sf /etc/nginx/sites-available/farming-guide.com /etc/nginx/sites-enabled/farming-guide.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP:

```bash
curl -I http://farming-guide.com
curl -I http://farming-guide.com/health
curl -I http://farming-guide.com/api/health
```

## 5. Create the SSL certificate

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d farming-guide.com \
  -d www.farming-guide.com
```

## 6. Switch to the final HTTPS config

```bash
sudo cp nginx/farming-guide.com.conf /etc/nginx/sites-available/farming-guide.com
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTPS:

```bash
curl -I https://farming-guide.com
curl -I https://farming-guide.com/health
curl -I https://farming-guide.com/api/health
```

## 7. Renewal check

Certbot installs automatic renewal on most Ubuntu/Debian servers. Test it:

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

If Nginx returns `502 Bad Gateway`, check that Docker is running:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f backend frontend
```

If the website opens but API calls fail, confirm:

```text
VITE_API_BASE_URL=https://farming-guide.com
CORS_ORIGINS=https://farming-guide.com,https://www.farming-guide.com
```

If Vite shows `Blocked request. This host ("farming-guide.com") is not allowed`,
confirm `vite.config.ts` includes:

```ts
vite: {
  server: {
    allowedHosts: ["farming-guide.com", "www.farming-guide.com"],
  },
}
```

Then rebuild or restart the frontend container.

If Certbot cannot create the certificate, confirm the DNS record points to the
server and port 80 is reachable from the internet.
