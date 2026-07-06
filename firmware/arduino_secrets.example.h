// Copy this file to firmware/arduino_secrets.h and fill in your local values.
// firmware/arduino_secrets.h is ignored by git so Wi-Fi and device keys stay private.

#pragma once

#define FARM_WIFI_SSID "YOUR_WIFI_NAME"
#define FARM_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Use the Device key shown on the device detail page after creating/claiming a device.
#define FARM_DEVICE_API_KEY "PASTE_DEVICE_KEY_FROM_FARM_BUDDY"

// Keep the public Cloudflare domain here for real IoT device operation.
#define FARM_CLOUD_BASE_URL_PRIMARY "https://farming-guide.com"

// Optional fallback hosts. Leave as-is unless you intentionally use them.
#define FARM_CLOUD_BASE_URL_FALLBACK "https://farming-guide.com"
#define FARM_CLOUD_BASE_URL_PREVIEW "https://farming-guide.com"
