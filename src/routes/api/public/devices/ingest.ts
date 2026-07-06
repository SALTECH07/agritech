import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { ingestEsp32Reading } from "@/lib/esp32-readings.server";

export const Route = createFileRoute("/api/public/devices/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }
        const result = await ingestEsp32Reading(device, body);
        return jsonResponse(result, result.ok ? 200 : (result.status ?? 500));
      },
    },
  },
});
