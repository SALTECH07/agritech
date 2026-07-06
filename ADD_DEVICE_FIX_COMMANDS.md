# Add Device Fix Notes

Use this file later when you need to open, test, or continue the device setup work.

## Website URL

- Local website: http://127.0.0.1:5173/
- Add new device page: http://127.0.0.1:5173/devices/new
- Public device API base used in controller setup: https://farming-guide.com

## What Was Fixed

- The website refreshes the sign-in token before creating or claiming a device.
- The backend accepts the real Supabase session token instead of rejecting valid sessions as an invalid token.
- GPS is optional on the add-device page.
- The page no longer asks for GPS automatically when it opens.
- If GPS is blocked, the farmer can still add the device by leaving latitude and longitude blank or entering them manually.
- The Create button can continue even when device name is blank; the website generates a name from crop and location.
- Manual Create now uses the signed-in user session first, so it does not need `SUPABASE_SERVICE_ROLE_KEY` just to create a device and generate the API.
- Hardware Claim still needs `SUPABASE_SERVICE_ROLE_KEY` because unclaimed hardware is hidden by database security rules.
- The add-device page now shows clearer steps: choose crop, GPS optional, then Create generates the Device Key and API for any microcontroller.

## Files Changed

- src/integrations/supabase/auth-attacher.ts
- src/integrations/supabase/auth-middleware.ts
- src/routes/api/chat.ts
- src/routes/_authenticated/devices.new.tsx
- src/lib/devices.functions.ts
- ADD_DEVICE_FIX_COMMANDS.md

## Commands

Start the website if normal Node commands are available:

```bash
npm run dev
```

Check the code if normal Node commands are available:

```bash
npm run lint
```

Build the website if normal Node commands are available:

```bash
npm run build
```

If Windows says `node`, `npm`, or `npx` is not recognized, use the bundled Codex Node:

```powershell
& 'C:\Users\75DEEZY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vite\bin\vite.js dev
```

```powershell
& 'C:\Users\75DEEZY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\eslint\bin\eslint.js .
```

```powershell
& 'C:\Users\75DEEZY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vite\bin\vite.js build
```

## Farmer Use

1. Open http://127.0.0.1:5173/devices/new.
2. Sign in if the app asks for sign-in.
3. Choose the crop. The moisture values fill automatically.
4. Type a device name, or leave it blank and the website will create one from crop and location.
5. Press Use GPS only when you want automatic latitude and longitude.
6. If GPS is blocked, leave latitude and longitude blank or type them manually.
7. Create the device.
8. Copy the generated Device Key and API URL into the controller firmware.
