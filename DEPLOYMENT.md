# Website Deployment

This app uses TanStack Start with server routes for AI, devices, readings,
commands, and finance analysis. Deploy it as a Cloudflare Worker with assets;
do not upload only the static files, because the API routes will not work.

For Ubuntu/Debian server setup, see `LINUX_SERVER_INSTALLATION.md`.

## Production build

```powershell
npm run build
```

The build creates:

- `.output/public` for website assets
- `.output/server` for the Cloudflare Worker/API server

## Required environment values

Set public values before building:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Set server secrets in the hosting platform:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest
```

Optional OpenAI fallback:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

## Preview like production

```powershell
npm run preview:cloudflare
```

## Deploy to Cloudflare

Sign in once:

```powershell
npx wrangler login
```

Add secrets after a successful build:

```powershell
npx wrangler secret put SUPABASE_URL --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json
npx wrangler secret put AI_PROVIDER --config .output/server/wrangler.json
npx wrangler secret put GEMINI_API_KEY --config .output/server/wrangler.json
npx wrangler secret put GEMINI_MODEL --config .output/server/wrangler.json
```

Deploy:

```powershell
npm run deploy:cloudflare
```

After deployment, connect the custom domain in Cloudflare:

```text
https://farming-guide.com
```

Use that same domain in uploaded microcontroller firmware so devices send data
to the live website.

## Lovable deployment

If deploying from Lovable, keep the same environment values in Lovable project
secrets, then use the Lovable publish/deploy flow. Keep the branch buildable
before syncing changes.
