# Firmware ya Kifaa cha IoT — VETA KIPAWA AGRI TECH

## Maktaba zinazohitajika (Arduino Library Manager)

- `Adafruit GFX Library`
- `Adafruit SSD1306`
- `ArduinoJson` (Benoit Blanchon)
- `DHT sensor library` (Adafruit)
- `QRCode` (ricmoo)

WiFi, HTTPClient, na Preferences zinatoka kwenye board core unayotumia.

## Hatua

1. Copy `arduino_secrets.example.h` kwenda `arduino_secrets.h`.
2. Weka Wi-Fi yako na `FARM_DEVICE_API_KEY` kutoka kwenye ukurasa wa kifaa.
3. Hakikisha `FARM_CLOUD_BASE_URL_PRIMARY` ni `https://farming-guide.com`.
4. Fungua `veta_kipawa.ino` kwenye Arduino IDE na chagua board core inayolingana na kifaa chako.
5. Pakia kwenye microcontroller yako inayotumia Wi-Fi na HTTP/HTTPS.
6. Washa kifaa. Itaonyesha hali ya Wi-Fi/API kwenye OLED na Serial Monitor.
7. Kwenye app, fungua **Vifaa -> Ongeza kifaa**, scan QR au andika code, jaza jina la shamba.
8. Kifaa kitaanza kutuma vipimo na kuthibitisha amri za pump/valve baada ya kuzitekeleza.

## Kufuta usajili

Bonyeza kitufe cha BOOT (GPIO0) kwa sekunde 5. Kifaa kitafuta keys na kuanza tena.

## Wiring (chaguo-msingi)

| Sensor / Actuator        | Pin GPIO |
| ------------------------ | -------- |
| Soil moisture (analog)   | 34       |
| DHT22 (joto/unyevunyevu) | 4        |
| Relay ya pampu           | 26       |
| Relay ya valvu           | 27       |
| OLED SSD1306 SDA / SCL   | 21 / 22  |
