import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";

export const Route = createFileRoute("/api/public/devices/config")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        await markDeviceOnline(device.id);
        return jsonResponse({
          claimed: Boolean(device.is_claimed),
          server_time: new Date().toISOString(),
          name: device.name,
          crop: device.crop,
          target_moisture: Number(device.target_moisture),
          pump_on_threshold: Number(device.pump_on_threshold),
          pump_off_threshold: Number(device.pump_off_threshold),
          rain_block_probability: Number(device.rain_block_probability),
          rain_block_amount_mm: Number(device.rain_block_amount_mm),
        });
      },
    },
  },
});
