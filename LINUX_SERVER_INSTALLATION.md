# Linux Server Installation

Use these steps on an Ubuntu or Debian server. The website and backend API run
together from this project. Supabase stores the database/auth data, and the AI
assistant uses the server-side Gemini/OpenAI key from `.env`.

For full self-hosting without Supabase, using Flask + PostgreSQL + Docker, see
`SELF_HOSTING_DOCKER.md`.

For a self-hosted public domain with Nginx and HTTPS on `farming-guide.com`, see
`NGINX_SETUP.md`.

## 1. Install server packages

```bash
sudo apt update
sudo apt install -y git curl unzip build-essential
```

Install Node.js 22 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2. Upload or clone the project

Example folder:

```bash
mkdir -p ~/apps
cd ~/apps
```

If the project is in GitHub:

```bash
git clone YOUR_REPOSITORY_URL farm-buddy
cd farm-buddy
```

If you copied the project by ZIP, unzip it and enter the folder:

```bash
unzip farm-buddy.zip -d farm-buddy
cd farm-buddy
```

## 3. Install website/backend packages

```bash
npm install
```

## 4. Create environment file

```bash
cp .env.example .env
nano .env
```

Fill these values with your real keys:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest
```

Optional OpenAI fallback:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

Keep `.env` private. Do not upload it to GitHub.

## 5. Test the app on the Linux server

For development/testing:

```bash
npm run dev -- --host 0.0.0.0
```

Open:

```text
http://SERVER_IP:5173
```

The backend API is on the same server:

```text
http://SERVER_IP:5173/api/public/devices/register
http://SERVER_IP:5173/api/public/devices/sync
```

For a microcontroller on the same network, use:

```text
http://SERVER_IP:5173
```

For the real online farm website, use:

```text
https://farming-guide.com
```

## 6. Run a production build check

```bash
npm run build
```

If this passes, the app is ready to deploy.

## 7. Deploy from the Linux server to Cloudflare

This project is configured for Cloudflare Worker deployment. Sign in once:

```bash
npx wrangler login
```

Add the required server secrets:

```bash
npx wrangler secret put SUPABASE_URL --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json
npx wrangler secret put AI_PROVIDER --config .output/server/wrangler.json
npx wrangler secret put GEMINI_API_KEY --config .output/server/wrangler.json
npx wrangler secret put GEMINI_MODEL --config .output/server/wrangler.json
```

Deploy:

```bash
npm run deploy:cloudflare
```

After deployment, connect your domain in Cloudflare:

```text
https://farming-guide.com
```

## 8. Optional: keep local test server running with PM2

Use this only for local/testing access on your Linux server. For real public
production, Cloudflare deployment is better for this project.

```bash
sudo npm install -g pm2
pm2 start "npm run dev -- --host 0.0.0.0" --name farm-buddy
pm2 save
pm2 startup
```

Check logs:

```bash
pm2 logs farm-buddy
```

Stop it:

```bash
pm2 stop farm-buddy
```

## 9. Optional: open firewall port

If you want to test from another device:

```bash
sudo ufw allow 5173/tcp
sudo ufw status
```

## 10. Quick troubleshooting

If install fails, check Node:

```bash
node -v
npm -v
```

If AI assistant does not answer, confirm `GEMINI_API_KEY` is set in `.env` or in
Cloudflare secrets.

If devices cannot send data, confirm the microcontroller uses the correct URL:

```text
Local Linux test: http://SERVER_IP:5173
Live website: https://farming-guide.com
```

If the website opens but database actions fail, check Supabase values:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```
