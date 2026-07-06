# Farm Buddy Operation Checklist

Use this when preparing the app for real IoT device operation.

## Required environment

The website can render with the public Supabase variables, but IoT device
registration, readings, command polling, and ACK routes require:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Copy `.env.example` to `.env` for local development, then fill in the real
Supabase values. Keep `.env` private.

## AI assistant API

Chat, farm advice, and finance advice call AI from the server only. Add one of
these key sets locally and in your hosting secrets. Gemini is the default when
`GEMINI_API_KEY` exists.

Gemini:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest
GEMINI_TEMPERATURE=0.3
```

OpenAI fallback:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
OPENAI_REASONING_EFFORT=low
OPENAI_TEXT_VERBOSITY=low
```

Do not put AI keys in browser/client code. The Settings page only shows whether
the server key is configured and which provider/model is active.

## Public domain

Device firmware should use the real internet domain:

```text
https://farming-guide.com
```

Do not use `localhost` or `127.0.0.1` in uploaded device firmware.

## Local website start

After dependencies can be downloaded:

```powershell
pnpm install
pnpm run dev
```

For a production check:

```powershell
pnpm run build
```

## Firmware setup

1. Copy `firmware/arduino_secrets.example.h` to `firmware/arduino_secrets.h`.
2. Fill in Wi-Fi name, Wi-Fi password, and the device key shown in Farm Buddy.
3. Open `firmware/veta_kipawa.ino` in Arduino IDE.
4. Install the libraries listed in `firmware/README.md`.
5. Upload to your compatible IoT controller.
6. Watch Serial Monitor at `115200` baud for Wi-Fi, API, reading, and ACK status.

## First live test

1. Start the website.
2. Sign in.
3. Create or claim a device.
4. Copy the device key into `firmware/arduino_secrets.h`.
5. Upload firmware.
6. Confirm the device page changes to online after the first reading.
7. Press pump/valve buttons and confirm the command changes from sent to acked.
