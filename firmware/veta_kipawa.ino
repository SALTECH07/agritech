/*
  VETA KIPAWA AGRI TECH — IoT device firmware sample (v13)
  --------------------------------------------
  Mabadiliko ya v13:
   - Domain kuu sasa ni https://farming-guide.com kwa Cloudflare operation.
   - WiFi/API key zimehamishwa kwenye arduino_secrets.h ili zisivuja kwenye code.
   - Amri za dashboard sasa zinatuma ACK baada ya relay kutekelezwa.

  Mabadiliko ya v12:
   - v12: kila sample hubeba umri wake (captured_age_ms) na window variance
     ili server isikubali data zilizoganda/constant kama data halisi.
   - Offline buffer: readings zinapatapo shida ya internet zinahifadhiwa
     kwenye RAM (FIFO, capacity 24 samples ≈ dakika 12) na zi-upload
     kiotomatiki ISP inaporudi.
   - drainOfflineBuffer() huitwa kila upload inayofanikiwa ili ku-mimina
     data zilizosubiri kwa mpangilio wa muda.
   - Payload sasa hubeba `buffered_offline_count`, `captured_uptime_ms`
     na `captured_offline` ili server itambue reading iliyokuwa buffered.
   - OLED huonyesha idadi ya readings kwenye foleni ("Queue: N").
   Vipengele vya v10 (stuck-sensor, RSSI debug, endpoint trace) vinabaki.
*/


#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_task_wdt.h>

#if __has_include("arduino_secrets.h")
#include "arduino_secrets.h"
#endif

#ifndef FARM_WIFI_SSID
#define FARM_WIFI_SSID "YOUR_WIFI_NAME"
#endif

#ifndef FARM_WIFI_PASSWORD
#define FARM_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

#ifndef FARM_DEVICE_API_KEY
#define FARM_DEVICE_API_KEY "PASTE_DEVICE_KEY_FROM_FARM_BUDDY"
#endif

#ifndef FARM_CLOUD_BASE_URL_PRIMARY
#define FARM_CLOUD_BASE_URL_PRIMARY "https://farming-guide.com"
#endif

#ifndef FARM_CLOUD_BASE_URL_FALLBACK
#define FARM_CLOUD_BASE_URL_FALLBACK FARM_CLOUD_BASE_URL_PRIMARY
#endif

#ifndef FARM_CLOUD_BASE_URL_PREVIEW
#define FARM_CLOUD_BASE_URL_PREVIEW FARM_CLOUD_BASE_URL_PRIMARY
#endif

// Badilisha hizi kabla ya ku-upload kwenye kifaa chako cha IoT.
const char* WIFI_SSID = FARM_WIFI_SSID;
const char* WIFI_PASSWORD = FARM_WIFI_PASSWORD;

// MUHIMU: Cloudflare/hosting lazima iruhusu TLS 1.2 kwa vifaa visivyotumia TLS 1.3.
const char* CLOUD_BASE_URL_PRIMARY  = FARM_CLOUD_BASE_URL_PRIMARY;
const char* CLOUD_BASE_URL_FALLBACK = FARM_CLOUD_BASE_URL_FALLBACK;
const char* CLOUD_BASE_URL_PREVIEW  = FARM_CLOUD_BASE_URL_PREVIEW;
// Ikiwa ISP/domain moja inagoma, mfumo utajaribu custom, published, kisha preview/current build.
bool useFallbackHost = false;
unsigned int hostFailStreak = 0;
const char* CLOUD_BASE_URL = CLOUD_BASE_URL_PRIMARY;

// Device Key kutoka dashibodi. Usiweke key halisi kwenye file hili; tumia arduino_secrets.h.
const char* API_KEY = FARM_DEVICE_API_KEY;

const char* DEVICE_ID = "farm-esp32-001";
const char* LOCATION_NAME = "Dodoma";
const float LOCATION_LAT = -6.1630;
const float LOCATION_LON = 35.7516;
const char* CROP_NAME = "mahindi";
const char* SOIL_TYPE = "sandy loam";

// Cloud request settings.
// Cloudflare/hosting zinaweza kuzuia User-Agent ya default ya firmware (403/1010).
// Tumia browser-style UA ili request za hardware zisizuiwe kama bot.
const char* HTTP_USER_AGENT = "Mozilla/5.0 (Linux; Android 10; IoTDevice) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const unsigned long HTTP_TIMEOUT_MS = 15000;
const unsigned long HTTP_CONNECT_TIMEOUT_MS = 10000;

// Sensor pins.
const int SOIL_MOISTURE_PIN = 34;
const int PH_SENSOR_PIN = 35;
const int WATER_LEVEL_PIN = 32;

// DHT11.
const int DHT_PIN = 4;
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// OLED SSD1306.
const int OLED_WIDTH = 128;
const int OLED_HEIGHT = 64;
const int OLED_RESET = -1;
const int OLED_ADDRESS = 0x3C;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);
bool displayReady = false;

// Relay module ya channels mbili.
const bool ENABLE_PUMP_RELAY = true;
const int PUMP_RELAY_PIN = 26;
const bool ENABLE_VALVE_RELAY = true;
const int VALVE_RELAY_PIN = 27;
const bool RELAY_ACTIVE_HIGH = true;

// Soil moisture thresholds — DEFAULT tu; zitabadilishwa na server (config kutoka dashibodi).
float PUMP_ON_MOISTURE_PERCENT = 30.0;
float PUMP_OFF_MOISTURE_PERCENT = 45.0;
float TARGET_MOISTURE_PERCENT = 45.0;

// Tank logic.
const float TANK_FULL_LEVEL_PERCENT = 95.0;

// Calibration.
const int SOIL_DRY_RAW = 3300;
const int SOIL_WET_RAW = 1200;
const int WATER_EMPTY_RAW = 300;
const int WATER_FULL_RAW = 2500;
const float PH_NEUTRAL_VOLTAGE = 2.50;
const float PH_SLOPE = -5.70;

// v8: hali ya usajili wa kifaa. Server hurudi `claimed:true` tu kama mmiliki
// amelisajili kwenye dashibodi. Bila hii, hatutaki kuwasha pump/valve.
bool deviceClaimed = false;


// Timing.
const unsigned long SEND_INTERVAL_MS = 30000;
const unsigned long ADVICE_INTERVAL_MS = 120000;
const unsigned long COMMAND_INTERVAL_MS = 15000;
const unsigned long DECISION_INTERVAL_MS = 30000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 15000;
const unsigned long CLOUD_DECISION_MAX_AGE_MS = 30UL * 60UL * 1000UL;

// v4: connection resilience — reconnect na backoff endapo uploads zinashindwa mfululizo.
const int UPLOAD_FAIL_HARD_RESET = 3;   // baada ya 3 fails mfululizo, disconnect+reconnect WiFi
const int UPLOAD_FAIL_WIFI_TOGGLE = 6;  // baada ya 6 fails mfululizo, toggle WiFi mode kabisa
const unsigned long UPLOAD_BACKOFF_MAX_MS = 60000UL; // dakika 1 max backoff ili data irudi haraka ISP ikirudi
int consecutiveUploadFailures = 0;
unsigned long uploadBackoffUntil = 0;

// v6: watchdog + long-outage auto-reboot.
const uint32_t WDT_TIMEOUT_SEC = 120;                             // reboot kama loop imekwama > 120s
const unsigned long OFFLINE_REBOOT_AFTER_MS = 15UL * 60UL * 1000UL; // dakika 15 bila internet -> restart
unsigned long lastOnlineAt = 0;         // muda wa mwisho tulipopata WiFi
volatile bool wifiJustReconnected = false; // event flag: ISP imerudi, tuma data mara moja

unsigned long lastSendAt = 0;
unsigned long lastAdviceAt = 0;
unsigned long lastCommandAt = 0;
unsigned long lastDecisionPollAt = 0;
unsigned long lastDecisionReceivedAt = 0;
unsigned long lastWifiAttemptAt = 0;


WiFiClient plainClient;
WiFiClientSecure secureClient;

int lastSoilRaw = 0;
int lastWaterLevelRaw = 0;
float lastMoisturePercent = 0;
float tankLevelPercent = 0;
float lastPH = 7.0;
float lastTemperatureC = NAN;
float lastAirHumidityPercent = NAN;
float waterDeficitPercent = 0.0;
float forecastRainProbabilityPercent = 0.0;
float forecastRainAmountMm = 0.0;
bool tankPumpIsOn = false;
bool valveIsOpen = false;
bool irrigationNeededBySensors = false;
bool irrigationAllowedByCloud = true;

// Dashboard control permissions.
bool tankPumpFillAllowed = true;
bool valveIrrigationAllowed = true;
bool tankFillNeeded = false;
bool manualPumpOverride = false;
bool manualValveOverride = false;

// Diagnostics ya OLED (v3).
int lastUploadHttpCode = 0;
String lastUploadStatus = "waiting";
unsigned long lastUploadLatencyMs = 0;
String lastUploadUrl = "-";
int lastWifiRssi = 0;

// v10: stuck-sensor detection — kifaa kikitoa data ileile mfululizo tunaonya kama sensor imekufa/disconnected.
int soilRawVariance = 0;
int waterRawVariance = 0;
bool soilSensorStuck = false;
bool waterSensorStuck = false;
const int STUCK_SENSOR_VARIANCE_THRESHOLD = 3; // ADC counts — chini ya hii kwa sample 9 = imekwama
const int SENSOR_WINDOW_SIZE = 8;
int soilRawWindow[SENSOR_WINDOW_SIZE];
int waterRawWindow[SENSOR_WINDOW_SIZE];
int sensorWindowCount = 0;
int sensorWindowIndex = 0;
int soilRawWindowVariance = 999;
int waterRawWindowVariance = 999;

String latestDecisionReason = "No cloud decision yet";

// v11/v12: Offline buffer — hifadhi readings ndani ya RAM wakati ISP haipo,
// kisha zi-upload kwa mpangilio (FIFO) mara tu WiFi + server zinapopatikana tena.
const int OFFLINE_BUFFER_CAPACITY = 24; // ≈ dakika 12 kwa sample kila 30s
String offlineBuffer[OFFLINE_BUFFER_CAPACITY];
unsigned long offlineBufferCapturedAt[OFFLINE_BUFFER_CAPACITY];
int offlineBufferCount = 0;
int offlineBufferDropped = 0;

void enqueueOfflineReading(const String& payload, unsigned long capturedAtMs) {
  if (offlineBufferCount >= OFFLINE_BUFFER_CAPACITY) {
    // Ondoa ya kongwe kabisa (FIFO) ili kuweka nafasi ya sample mpya.
    for (int i = 1; i < OFFLINE_BUFFER_CAPACITY; i++) {
      offlineBuffer[i-1] = offlineBuffer[i];
      offlineBufferCapturedAt[i-1] = offlineBufferCapturedAt[i];
    }
    offlineBufferCount = OFFLINE_BUFFER_CAPACITY - 1;
    offlineBufferDropped++;
  }
  offlineBuffer[offlineBufferCount] = payload;
  offlineBufferCapturedAt[offlineBufferCount] = capturedAtMs;
  offlineBufferCount++;
  Serial.printf(">>> OFFLINE BUFFER: readings=%d (dropped=%d)\n",
                offlineBufferCount, offlineBufferDropped);
}




int readAnalogAverage(int pin, int samples = 12) {
  long total = 0;
  for (int i = 0; i < samples; i++) {
    total += analogRead(pin);
    delay(10);
  }
  return total / samples;
}

// v4: median-of-9 sampling (kata noise ya mawimbi kama tank sensor).
int readAnalogMedian(int pin) {
  int v[9];
  for (int i = 0; i < 9; i++) { v[i] = analogRead(pin); delay(8); }
  // insertion sort ndogo
  for (int i = 1; i < 9; i++) {
    int k = v[i]; int j = i - 1;
    while (j >= 0 && v[j] > k) { v[j+1] = v[j]; j--; }
    v[j+1] = k;
  }
  return v[4];
}

// v10: median + variance (max-min) — kutambua sensor iliyokwama (variance ~0).
int readAnalogMedianWithVariance(int pin, int& varianceOut) {
  int v[9];
  for (int i = 0; i < 9; i++) { v[i] = analogRead(pin); delay(8); }
  int mn = v[0], mx = v[0];
  for (int i = 1; i < 9; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
  varianceOut = mx - mn;
  for (int i = 1; i < 9; i++) {
    int k = v[i]; int j = i - 1;
    while (j >= 0 && v[j] > k) { v[j+1] = v[j]; j--; }
    v[j+1] = k;
  }
  return v[4];
}

float clampFloat(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}



float soilMoisturePercentFromRaw(int raw) {
  float percent = ((float)SOIL_DRY_RAW - raw) * 100.0 / ((float)SOIL_DRY_RAW - SOIL_WET_RAW);
  return clampFloat(percent, 0.0, 100.0);
}

float waterLevelPercentFromRaw(int raw) {
  float percent = ((float)raw - WATER_EMPTY_RAW) * 100.0 / ((float)WATER_FULL_RAW - WATER_EMPTY_RAW);
  return clampFloat(percent, 0.0, 100.0);
}

float phFromRaw(int raw) {
  float voltage = raw * (3.3 / 4095.0);
  float ph = 7.0 + ((voltage - PH_NEUTRAL_VOLTAGE) * PH_SLOPE);
  return clampFloat(ph, 0.0, 14.0);
}

int computeWindowVariance(const int values[], int count) {
  if (count <= 1) return 999;
  int mn = values[0], mx = values[0];
  for (int i = 1; i < count; i++) {
    if (values[i] < mn) mn = values[i];
    if (values[i] > mx) mx = values[i];
  }
  return mx - mn;
}

void pushSensorWindow(int soilRaw, int waterRaw) {
  soilRawWindow[sensorWindowIndex] = soilRaw;
  waterRawWindow[sensorWindowIndex] = waterRaw;
  sensorWindowIndex = (sensorWindowIndex + 1) % SENSOR_WINDOW_SIZE;
  if (sensorWindowCount < SENSOR_WINDOW_SIZE) sensorWindowCount++;
  soilRawWindowVariance = computeWindowVariance(soilRawWindow, sensorWindowCount);
  waterRawWindowVariance = computeWindowVariance(waterRawWindow, sensorWindowCount);
}

String firmwareVersion() {
  return "v12";
}

String wholeNumberOrDash(float value) {
  if (isnan(value)) return "--";
  return String(value, 0);
}

void writeRelay(int pin, bool shouldBeOn) {
  bool outputHigh = RELAY_ACTIVE_HIGH ? shouldBeOn : !shouldBeOn;
  digitalWrite(pin, outputHigh ? HIGH : LOW);
}

void setPumpRelay(bool shouldBeOn) {
  tankPumpIsOn = shouldBeOn && ENABLE_PUMP_RELAY;
  if (ENABLE_PUMP_RELAY) writeRelay(PUMP_RELAY_PIN, tankPumpIsOn);
}

void setValveRelay(bool shouldOpen) {
  valveIsOpen = shouldOpen && ENABLE_VALVE_RELAY;
  if (ENABLE_VALVE_RELAY) writeRelay(VALVE_RELAY_PIN, valveIsOpen);
}

void showOnDisplay(String line1, String line2 = "", String line3 = "", String line4 = "") {
  if (!displayReady) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1.substring(0, 21));
  display.println(line2.substring(0, 21));
  display.println(line3.substring(0, 21));
  display.println(line4.substring(0, 21));
  display.display();
}

String makeUrl(String path) {
  String base = String(useFallbackHost ? CLOUD_BASE_URL_FALLBACK : CLOUD_BASE_URL_PRIMARY);
  if (base.endsWith("/")) base.remove(base.length() - 1);
  return base + path;
}

String makeUrlForBase(const char* baseUrl, String path) {
  String base = String(baseUrl);
  if (base.endsWith("/")) base.remove(base.length() - 1);
  return base + path;
}

const char* hostLabelForAttempt(int attempt, bool fallback) {
  if (attempt == 2) return "preview";
  return fallback ? "fallback" : "primary";
}

String urlForAttempt(const String& path, int attempt, bool originalFallback) {
  if (attempt == 2) return makeUrlForBase(CLOUD_BASE_URL_PREVIEW, path);
  useFallbackHost = attempt == 1 ? !originalFallback : originalFallback;
  return makeUrl(path);
}

// v7: badilisha kati ya primary/fallback host baada ya kushindwa mara kadhaa.
void noteHostResult(int code) {
  if (code >= 200 && code < 400) {
    hostFailStreak = 0;
    return;
  }
  hostFailStreak++;
  if (hostFailStreak >= 3) {
    useFallbackHost = !useFallbackHost;
    hostFailStreak = 0;
    Serial.print(">>> Kubadili host -> ");
    Serial.println(useFallbackHost ? CLOUD_BASE_URL_FALLBACK : CLOUD_BASE_URL_PRIMARY);
  }
}

void printHttpResult(const char* label, int responseCode, const String& response) {
  Serial.print(label);
  Serial.print(" code: ");
  Serial.println(responseCode);
  if (responseCode < 0) {
    Serial.print("HTTP client error: ");
    Serial.println(HTTPClient::errorToString(responseCode));
    Serial.println("Hint: hakikisha Cloudflare min TLS = 1.2 na ISP inaruhusu HTTPS.");
  }
  if (response.length() > 0) Serial.println(response);
  noteHostResult(responseCode);
}

void configureHttp(HTTPClient& http) {
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setUserAgent(HTTP_USER_AGENT);
  http.setReuse(false);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
}

int getWithFailover(const String& path, const char* label, String& response) {
  int responseCode = -999;
  response = "";
  bool originalFallback = useFallbackHost;
  for (int attempt = 0; attempt < 3; attempt++) {
    esp_task_wdt_reset();
    String url = urlForAttempt(path, attempt, originalFallback);
    if (attempt > 0) {
      Serial.print(">>> Retry GET kupitia host mbadala: ");
      Serial.println(url);
    }
    HTTPClient http;
    unsigned long t0 = millis();
    if (!beginHttp(http, url)) {
      responseCode = -999;
      response = "HTTP begin fail";
    } else {
      http.addHeader("X-API-Key", API_KEY);
      responseCode = http.GET();
      response = http.getString();
      http.end();
    }
    unsigned long dt = millis() - t0;
    Serial.printf("[TRACE] GET attempt=%d host=%s url=%s code=%d latency_ms=%lu rssi=%d bytes_in=%u\n",
      attempt + 1, hostLabelForAttempt(attempt, useFallbackHost),
      url.c_str(), responseCode, dt,
      WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0,
      (unsigned)response.length());
    printHttpResult(label, responseCode, response);
    if (responseCode >= 200 && responseCode < 300) break;

  }
  return responseCode;
}

bool beginHttp(HTTPClient& http, const String& url) {
  Serial.print("Request URL: ");
  Serial.println(url);
  bool started = false;
  if (url.startsWith("https://")) {
    secureClient.stop();
    secureClient.setInsecure();
    secureClient.setTimeout(HTTP_TIMEOUT_MS);
    started = http.begin(secureClient, url);
  } else {
    plainClient.stop();
    plainClient.setTimeout(HTTP_TIMEOUT_MS);
    started = http.begin(plainClient, url);
  }
  if (!started) {
    Serial.println("HTTP begin failed before request was sent.");
    return false;
  }
  configureHttp(http);
  return true;
}

void printNetworkDiagnostics() {
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.print("WiFi IP: "); Serial.println(WiFi.localIP());
  Serial.print("WiFi RSSI: "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  Serial.print("Gateway: "); Serial.println(WiFi.gatewayIP());
  Serial.print("DNS: "); Serial.println(WiFi.dnsIP());
  IPAddress cloudIp;
  String cloudHost = String(CLOUD_BASE_URL_PRIMARY);
  cloudHost.replace("https://", "");
  cloudHost.replace("http://", "");
  int slash = cloudHost.indexOf("/");
  if (slash >= 0) cloudHost = cloudHost.substring(0, slash);
  if (WiFi.hostByName(cloudHost.c_str(), cloudIp)) {
    Serial.print("Cloud DNS OK: "); Serial.println(cloudIp);
  } else {
    Serial.println("Cloud DNS FAILED — internet haipatikani.");
  }
}

// v8: pima host halisi. Jaribu primary kwanza, kisha fallback; chagua ile inayojibu 2xx.
int probeHost(const char* baseUrl) {
  HTTPClient http;
  String url = String(baseUrl) + "/api/public/readings";
  Serial.print("Probe host: "); Serial.println(baseUrl);
  bool ok;
  if (url.startsWith("https://")) {
    secureClient.stop(); secureClient.setInsecure(); secureClient.setTimeout(HTTP_TIMEOUT_MS);
    ok = http.begin(secureClient, url);
  } else {
    plainClient.stop(); plainClient.setTimeout(HTTP_TIMEOUT_MS);
    ok = http.begin(plainClient, url);
  }
  if (!ok) return -1;
  configureHttp(http);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  int code = http.POST("{\"ping\":true}");
  http.end();
  Serial.printf("  -> %d\n", code);
  return code;
}

void runConnectivitySelfTest() {
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.println("--- Self-test: kutafuta API inayofanya kazi ---");
  int cPri = probeHost(CLOUD_BASE_URL_PRIMARY);
  if (cPri >= 200 && cPri < 300) {
    useFallbackHost = false;
    Serial.println(">>> API HAI: primary");
    showOnDisplay("API OK (primary)", "Code " + String(cPri));
  } else {
    int cFb = probeHost(CLOUD_BASE_URL_FALLBACK);
    if (cFb >= 200 && cFb < 300) {
      useFallbackHost = true;
      Serial.println(">>> API HAI: fallback");
      showOnDisplay("API OK (fallback)", "Code " + String(cFb));
    } else {
      useFallbackHost = false;
      Serial.println(">>> API zote mbili zimeshindwa — angalia ISP/API_KEY");
      showOnDisplay("API zote FAIL", "Pri " + String(cPri), "Fb " + String(cFb));
    }
  }
  hostFailStreak = 0;
  delay(1000);
}


// v6: WiFi event handler — inaitwa mara ISP/WiFi inaporudi.
void onWifiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print(">>> WiFi GOT IP: "); Serial.println(WiFi.localIP());
      lastOnlineAt = millis();
      wifiJustReconnected = true;      // sema loop() ituma data mara moja
      consecutiveUploadFailures = 0;
      uploadBackoffUntil = 0;
      showOnDisplay("ISP RETURNED", WiFi.localIP().toString(), "Auto-reconnect OK");
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println(">>> WiFi disconnected — auto-reconnect...");
      WiFi.reconnect();
      break;
    default: break;
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) { lastOnlineAt = millis(); return; }
  unsigned long now = millis();
  if (lastWifiAttemptAt > 0 && now - lastWifiAttemptAt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiAttemptAt = now;
  WiFi.persistent(false);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);   // v6: OS ijaribu yenyewe
  WiFi.disconnect(true, true);
  delay(300);
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi SSID: "); Serial.println(WIFI_SSID);
  showOnDisplay("Connecting WiFi", WIFI_SSID);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    esp_task_wdt_reset();          // v6: usimwache WDT akushike wakati wa kuunga
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected.");
    lastOnlineAt = millis();
    printNetworkDiagnostics();
    showOnDisplay("WiFi connected", WiFi.localIP().toString());
  } else {
    Serial.printf("\nWiFi failed. status=%d\n", WiFi.status());
    showOnDisplay("WiFi failed", "Check SSID/pass");
    WiFi.disconnect(false, false);
  }
}


bool ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) return true;
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("Cloud request skipped: WiFi is not connected.");
  return false;
}

bool hasFreshCloudDecision() {
  return lastDecisionReceivedAt > 0 && (millis() - lastDecisionReceivedAt) <= CLOUD_DECISION_MAX_AGE_MS;
}

void updateTankPumpAutomation() {
  if (manualPumpOverride) return;
  // v8: kifaa kisichosajiliwa katika dashibodi hakiwezi kuwasha pump.
  if (!deviceClaimed) { setPumpRelay(false); tankFillNeeded = false; return; }
  bool tankIsFull = tankLevelPercent >= TANK_FULL_LEVEL_PERCENT;
  tankFillNeeded = tankPumpFillAllowed && !tankIsFull;
  setPumpRelay(tankFillNeeded);
}

void updateValveIrrigationAutomation() {
  if (manualValveOverride) return;
  // v8: kifaa kisichosajiliwa hakiwezi kuwasha valve.
  if (!deviceClaimed) { setValveRelay(false); irrigationNeededBySensors = false; return; }
  waterDeficitPercent = max(0.0f, TARGET_MOISTURE_PERCENT - lastMoisturePercent);
  irrigationNeededBySensors = false;
  if (lastMoisturePercent < PUMP_ON_MOISTURE_PERCENT) irrigationNeededBySensors = true;
  else if (valveIsOpen && lastMoisturePercent < PUMP_OFF_MOISTURE_PERCENT) irrigationNeededBySensors = true;
  bool shouldOpenValve = valveIrrigationAllowed && irrigationNeededBySensors;
  if (hasFreshCloudDecision()) shouldOpenValve = shouldOpenValve && irrigationAllowedByCloud;
  setValveRelay(shouldOpenValve);
}


void readSensors() {
  lastSoilRaw = readAnalogMedianWithVariance(SOIL_MOISTURE_PIN, soilRawVariance);
  lastWaterLevelRaw = readAnalogMedianWithVariance(WATER_LEVEL_PIN, waterRawVariance);
  pushSensorWindow(lastSoilRaw, lastWaterLevelRaw);
  int phRaw = readAnalogAverage(PH_SENSOR_PIN);
  float temperatureC = dht.readTemperature();
  float airHumidity = dht.readHumidity();

  // v10: kama variance ni ndogo sana kwa muda mrefu, sensor imekwama/imekatika.
  soilSensorStuck = ((soilRawVariance <= STUCK_SENSOR_VARIANCE_THRESHOLD) ||
                    (sensorWindowCount >= SENSOR_WINDOW_SIZE && soilRawWindowVariance <= STUCK_SENSOR_VARIANCE_THRESHOLD)) &&
                    (lastSoilRaw <= 5 || lastSoilRaw >= 4090);
  waterSensorStuck = ((waterRawVariance <= STUCK_SENSOR_VARIANCE_THRESHOLD) ||
                     (sensorWindowCount >= SENSOR_WINDOW_SIZE && waterRawWindowVariance <= STUCK_SENSOR_VARIANCE_THRESHOLD)) &&
                     (lastWaterLevelRaw <= 5 || lastWaterLevelRaw >= 4090);

  lastMoisturePercent = soilMoisturePercentFromRaw(lastSoilRaw);
  tankLevelPercent = waterLevelPercentFromRaw(lastWaterLevelRaw);
  lastPH = phFromRaw(phRaw);
  if (!isnan(temperatureC)) lastTemperatureC = temperatureC;
  if (!isnan(airHumidity)) lastAirHumidityPercent = airHumidity;
  updateTankPumpAutomation();
  updateValveIrrigationAutomation();

  lastWifiRssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  const char* rssiBand = lastWifiRssi == 0 ? "OFFLINE"
                       : lastWifiRssi >= -60 ? "EXCELLENT"
                       : lastWifiRssi >= -70 ? "GOOD"
                       : lastWifiRssi >= -80 ? "FAIR" : "WEAK";

  Serial.printf("SENSOR REALTIME => soil_raw=%d(var=%d win=%d%s) soil=%.1f%% | ph=%.2f | temp=%.1fC | hum=%.0f%% | water_raw=%d(var=%d win=%d%s) tank=%.1f%% | pump=%s | valve=%s | rain=%.0f%% | claimed=%s\n",
    lastSoilRaw, soilRawVariance, soilRawWindowVariance, soilSensorStuck ? " STUCK" : "",
    lastMoisturePercent, lastPH, lastTemperatureC, lastAirHumidityPercent,
    lastWaterLevelRaw, waterRawVariance, waterRawWindowVariance, waterSensorStuck ? " STUCK" : "",
    tankLevelPercent,
    tankPumpIsOn ? "ON" : "OFF", valveIsOpen ? "OPEN" : "CLOSED", forecastRainProbabilityPercent,
    deviceClaimed ? "YES" : "NO");
  Serial.printf("[WIFI] rssi=%d dBm band=%s ssid=%s ip=%s\n",
    lastWifiRssi, rssiBand, WiFi.SSID().c_str(),
    WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "-");
  if (soilSensorStuck) Serial.println("[WARN] Soil sensor imeganda muda mrefu — data hii haitatumika dashibodi hadi ibadilike.");
  if (waterSensorStuck) Serial.println("[WARN] Water level sensor imeganda muda mrefu — data hii haitatumika dashibodi hadi ibadilike.");

  String rssiLine = "RSSI " + String(lastWifiRssi) + " " + rssiBand;
  showOnDisplay(
    "Soil " + String(lastMoisturePercent, 0) + "% pH " + String(lastPH, 1),
    "Tank " + String(tankLevelPercent, 0) + "% P:" + String(tankPumpIsOn ? "ON" : "OFF"),
    "V:" + String(valveIsOpen ? "OPEN" : "CLOSE") + " " + lastUploadStatus + " " + String(lastUploadHttpCode),
    rssiLine
  );
}



// v11: helper — jaribu ku-POST payload moja (na host failover). Rudisha true iwapo 2xx.
bool postReadingPayload(const String& payload, int& codeOut, String& respOut, unsigned long& latencyOut) {
  codeOut = -999;
  respOut = "";
  latencyOut = 0;
  bool originalFallback = useFallbackHost;
  for (int attempt = 0; attempt < 3; attempt++) {
    String url = urlForAttempt("/api/public/readings", attempt, originalFallback);
    if (attempt > 0) {
      Serial.print(">>> Retry upload kupitia host mbadala: ");
      Serial.println(url);
    }
    HTTPClient http;
    lastUploadUrl = url;
    unsigned long t0 = millis();
    if (!beginHttp(http, url)) {
      codeOut = -999;
      respOut = "HTTP begin fail";
    } else {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", API_KEY);
      codeOut = http.POST(payload);
      respOut = http.getString();
      http.end();
    }
    unsigned long dt = millis() - t0;
    latencyOut += dt;
    Serial.printf("[TRACE] upload attempt=%d host=%s url=%s code=%d latency_ms=%lu rssi=%d bytes_out=%u bytes_in=%u\n",
      attempt + 1,
      hostLabelForAttempt(attempt, useFallbackHost),
      url.c_str(), codeOut, dt, lastWifiRssi,
      (unsigned)payload.length(), (unsigned)respOut.length());
    printHttpResult("POST /api/public/readings", codeOut, respOut);
    if (codeOut >= 200 && codeOut < 300) return true;
  }
  return false;
}

String payloadWithSampleAge(const String& payload, unsigned long capturedAtMs) {
  StaticJsonDocument<2304> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) return payload;
  unsigned long ageMs = millis() >= capturedAtMs ? millis() - capturedAtMs : 0;
  doc["captured_age_ms"] = ageMs;
  doc["captured_offline"] = ageMs > 5000;
  String updated;
  serializeJson(doc, updated);
  return updated;
}

// v11: mimina buffer ya offline kwa mpangilio wa FIFO baada ya kupata internet.
void drainOfflineBuffer() {
  if (offlineBufferCount <= 0) return;
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.printf(">>> DRAIN OFFLINE BUFFER: %d readings pending\n", offlineBufferCount);
  int sent = 0;
  while (offlineBufferCount > 0) {
    esp_task_wdt_reset();
    String payload = payloadWithSampleAge(offlineBuffer[0], offlineBufferCapturedAt[0]);
    int code; String resp; unsigned long lat;
    bool ok = postReadingPayload(payload, code, resp, lat);
    if (!ok) {
      Serial.printf(">>> DRAIN paused — bado %d readings kwenye buffer\n", offlineBufferCount);
      return;
    }
    // shift kushoto
    for (int i = 1; i < offlineBufferCount; i++) {
      offlineBuffer[i-1] = offlineBuffer[i];
      offlineBufferCapturedAt[i-1] = offlineBufferCapturedAt[i];
    }
    offlineBuffer[--offlineBufferCount] = String();
    sent++;
    delay(300);
  }
  Serial.printf(">>> DRAIN OK: readings sent=%d, dropped_before=%d\n", sent, offlineBufferDropped);
  offlineBufferDropped = 0;
}

void sendReadingToCloud() {
  unsigned long capturedAtMs = millis();
  bool wifiOk = ensureWifiConnected();
  StaticJsonDocument<2048> doc;
  doc["device_id"] = DEVICE_ID;
  doc["firmware_version"] = firmwareVersion();
  doc["api_host"] = useFallbackHost ? "fallback" : "primary";
  doc["wifi_rssi"] = lastWifiRssi;
  doc["wifi_ssid"] = WiFi.SSID();
  doc["soil_sensor_stuck"] = soilSensorStuck;
  doc["water_sensor_stuck"] = waterSensorStuck;
  doc["soil_raw_variance"] = soilRawVariance;
  doc["water_raw_variance"] = waterRawVariance;
  doc["soil_raw_window_variance"] = soilRawWindowVariance;
  doc["water_raw_window_variance"] = waterRawWindowVariance;
  doc["buffered_offline_count"] = offlineBufferCount;

  doc["crop"] = CROP_NAME;
  doc["soil_type"] = SOIL_TYPE;
  doc["soil_moisture_raw"] = lastSoilRaw;
  doc["soil_moisture_percent"] = lastMoisturePercent;
  doc["target_moisture_percent"] = TARGET_MOISTURE_PERCENT;
  doc["water_deficit_percent"] = waterDeficitPercent;
  doc["water_level_raw"] = lastWaterLevelRaw;
  doc["water_level_percent"] = tankLevelPercent;
  doc["tank_full_level_percent"] = TANK_FULL_LEVEL_PERCENT;
  doc["tank_pump_fill_allowed"] = tankPumpFillAllowed;
  doc["tank_fill_needed"] = tankFillNeeded;
  doc["soil_ph"] = lastPH;
  if (isnan(lastTemperatureC)) doc["temperature_c"] = nullptr; else doc["temperature_c"] = lastTemperatureC;
  if (isnan(lastAirHumidityPercent)) doc["humidity_percent"] = nullptr; else doc["humidity_percent"] = lastAirHumidityPercent;
  doc["pump_enabled"] = ENABLE_PUMP_RELAY;
  doc["pump_is_on"] = tankPumpIsOn;
  doc["tank_pump_is_on"] = tankPumpIsOn;
  doc["valve_enabled"] = ENABLE_VALVE_RELAY;
  doc["valve_is_open"] = valveIsOpen;
  doc["valve_irrigation_allowed"] = valveIrrigationAllowed;
  doc["irrigation_is_on"] = valveIsOpen;
  doc["irrigation_needed_by_sensors"] = irrigationNeededBySensors;
  doc["irrigation_allowed_by_cloud"] = irrigationAllowedByCloud;
  doc["forecast_rain_probability_percent"] = forecastRainProbabilityPercent;
  doc["forecast_rain_amount_mm"] = forecastRainAmountMm;
  doc["pump_on_threshold_percent"] = PUMP_ON_MOISTURE_PERCENT;
  doc["pump_off_threshold_percent"] = PUMP_OFF_MOISTURE_PERCENT;
  // Tag ya wakati wa lokali (ms tangu boot) — server anaweza kutofautisha reading iliyokaa kwenye buffer.
  doc["captured_uptime_ms"] = capturedAtMs;
  doc["captured_age_ms"] = 0;
  doc["captured_offline"] = !wifiOk;
  JsonObject location = doc.createNestedObject("location");
  location["name"] = LOCATION_NAME;
  location["lat"] = LOCATION_LAT;
  location["lon"] = LOCATION_LON;

  String payload;
  serializeJson(doc, payload);
  Serial.print("POST payload bytes: "); Serial.println(payload.length());
  Serial.print("SERIAL->API JSON: "); Serial.println(payload);

  if (!wifiOk) {
    Serial.println(">>> OFFLINE: hakuna WiFi — reading imehifadhiwa kwenye buffer");
    enqueueOfflineReading(payload, capturedAtMs);
    lastUploadStatus = "BUFFERED";
    showOnDisplay("OFFLINE — buffered", "Queue: " + String(offlineBufferCount),
                  "Tank " + String(tankLevelPercent, 0) + "%",
                  "Subiri ISP...");
    return;
  }

  int responseCode; String response; unsigned long totalLatency;
  bool ok = postReadingPayload(payload, responseCode, response, totalLatency);
  lastUploadLatencyMs = totalLatency;
  lastUploadHttpCode = responseCode;

  if (ok) {
    lastUploadStatus = "OK";
    consecutiveUploadFailures = 0;
    uploadBackoffUntil = 0;

    // v8: soma hali halisi ya usajili + thresholds kutoka server.
    StaticJsonDocument<1024> rdoc;
    if (!deserializeJson(rdoc, response)) {
      bool wasClaimed = deviceClaimed;
      deviceClaimed = rdoc["claimed"] | false;
      if (rdoc.containsKey("config")) {
        JsonObject cfg = rdoc["config"];
        float tm = cfg["target_moisture"] | TARGET_MOISTURE_PERCENT;
        float pon = cfg["pump_on_threshold"] | PUMP_ON_MOISTURE_PERCENT;
        float poff = cfg["pump_off_threshold"] | PUMP_OFF_MOISTURE_PERCENT;
        if (tm > 0)  TARGET_MOISTURE_PERCENT   = tm;
        if (pon > 0) PUMP_ON_MOISTURE_PERCENT  = pon;
        if (poff > 0) PUMP_OFF_MOISTURE_PERCENT = poff;
      }
      if (!deviceClaimed) {
        setPumpRelay(false); setValveRelay(false);
        tankFillNeeded = false; irrigationNeededBySensors = false;
      }
      if (wasClaimed != deviceClaimed) {
        Serial.printf(">>> Claim state: %s\n", deviceClaimed ? "CLAIMED" : "UNCLAIMED");
      }
      if (rdoc.containsKey("saved_reading")) {
        JsonObject saved = rdoc["saved_reading"];
        Serial.printf("API->DB SAVED => id=%ld soil=%.1f ph=%.2f temp=%.1f hum=%.1f tank=%.1f pump=%s valve=%s at=%s\n",
          saved["id"] | 0,
          saved["soil_moisture"] | -1.0,
          saved["soil_ph"] | -1.0,
          saved["air_temp"] | -1.0,
          saved["air_humidity"] | -1.0,
          saved["water_level"] | -1.0,
          (saved["pump_on"] | false) ? "ON" : "OFF",
          (saved["valve_on"] | false) ? "OPEN" : "CLOSED",
          saved["recorded_at"] | "-");
      }
    }
    Serial.println(">>> UPLOAD OK");
    String cs = deviceClaimed ? "Registered" : "NOT registered";
    showOnDisplay("Upload OK " + String(responseCode),
                  "Tank " + String(tankLevelPercent, 0) + "%",
                  "Buf " + String(offlineBufferCount) + " P:" + String(tankPumpIsOn ? "ON" : "OFF"),
                  cs);

    // v11: server imepatikana — mimina buffer ya offline (kama zipo).
    drainOfflineBuffer();

  } else {
    lastUploadStatus = "FAIL";
    consecutiveUploadFailures++;
    Serial.printf(">>> UPLOAD FAILED (#%d) — reading imehifadhiwa kwenye offline buffer\n", consecutiveUploadFailures);
    // v11: usipoteze reading — hifadhi hadi ISP itakaporudi.
    enqueueOfflineReading(payload, capturedAtMs);
    showOnDisplay("UPLOAD FAIL #" + String(consecutiveUploadFailures),
                  "Code " + String(responseCode),
                  "Queue: " + String(offlineBufferCount),
                  "Auto-recover...");

    if (consecutiveUploadFailures >= UPLOAD_FAIL_WIFI_TOGGLE) {
      Serial.println(">>> Full WiFi reset (mode toggle)");
      WiFi.disconnect(true, true);
      delay(500);
      WiFi.mode(WIFI_OFF);
      delay(1000);
      WiFi.mode(WIFI_STA);
      lastWifiAttemptAt = 0;
      connectWifi();
    } else if (consecutiveUploadFailures >= UPLOAD_FAIL_HARD_RESET) {
      Serial.println(">>> Reconnecting WiFi (soft)");
      WiFi.disconnect(false, false);
      delay(300);
      lastWifiAttemptAt = 0;
      connectWifi();
    }

    unsigned long backoff = min((unsigned long)(1000UL << min(consecutiveUploadFailures, 8)), UPLOAD_BACKOFF_MAX_MS);
    uploadBackoffUntil = millis() + backoff;
    Serial.printf(">>> Backoff: %lu ms\n", backoff);
    delay(1500);
  }
}


void fetchIrrigationDecision() {
  if (!ensureWifiConnected()) return;
  String response;
  int responseCode = getWithFailover("/api/public/irrigation/decision?device_id=" + String(DEVICE_ID), "GET /api/public/irrigation/decision", response);
  if (responseCode < 200 || responseCode >= 300) return;
  StaticJsonDocument<1536> doc;
  if (deserializeJson(doc, response)) return;
  irrigationAllowedByCloud = doc["allow_irrigation"] | true;
  forecastRainProbabilityPercent = doc["forecast"]["rain_probability_percent"] | 0.0;
  forecastRainAmountMm = doc["forecast"]["rain_amount_mm"] | 0.0;
  const char* reason = doc["reason"] | "No reason";
  latestDecisionReason = String(reason);
  lastDecisionReceivedAt = millis();
  updateValveIrrigationAutomation();
}

void fetchAdvice() {
  if (!ensureWifiConnected()) return;
  String response;
  int responseCode = getWithFailover("/api/public/advice/latest?device_id=" + String(DEVICE_ID), "GET /api/public/advice/latest", response);
  if (responseCode < 200 || responseCode >= 300) return;
  StaticJsonDocument<2048> doc;
  if (deserializeJson(doc, response)) return;
  String advice = doc["advice_text"] | "Hakuna ushauri bado";
  Serial.println("AI advice:"); Serial.println(advice);
}

bool ackCommand(const String& commandId, bool ok, const String& message) {
  if (commandId.length() == 0) return false;
  if (!ensureWifiConnected()) return false;

  StaticJsonDocument<256> doc;
  doc["id"] = commandId;
  doc["ok"] = ok;
  doc["message"] = message;
  String payload;
  serializeJson(doc, payload);

  int responseCode = -999;
  String response = "";
  bool originalFallback = useFallbackHost;
  for (int attempt = 0; attempt < 3; attempt++) {
    String url = urlForAttempt("/api/public/devices/ack", attempt, originalFallback);
    HTTPClient http;
    if (!beginHttp(http, url)) {
      responseCode = -999;
      response = "HTTP begin fail";
    } else {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", API_KEY);
      responseCode = http.POST(payload);
      response = http.getString();
      http.end();
    }
    Serial.printf("[TRACE] ACK command=%s ok=%s attempt=%d code=%d bytes_in=%u\n",
      commandId.c_str(), ok ? "true" : "false", attempt + 1, responseCode,
      (unsigned)response.length());
    printHttpResult("POST /api/public/devices/ack", responseCode, response);
    if (responseCode >= 200 && responseCode < 300) return true;
  }
  return false;
}

void pollCommand() {
  if (!ensureWifiConnected()) return;
  String response;
  int responseCode = getWithFailover("/api/public/commands/next?device_id=" + String(DEVICE_ID), "GET /api/public/commands/next", response);
  if (responseCode < 200 || responseCode >= 300) return;
  StaticJsonDocument<768> doc;
  if (deserializeJson(doc, response)) return;
  String command = doc["command"] | "NONE";
  if (command == "NONE") return;
  String commandId = doc["id"] | "";
  Serial.print("Remote command: "); Serial.println(command);
  // v8: kifaa kisichosajiliwa hakiwezi kupokea amri za actuator.
  bool isActuator = command.startsWith("PUMP_") || command.startsWith("VALVE_") || command.startsWith("IRRIGATION_");
  if (isActuator && !deviceClaimed) {
    Serial.println(">>> Amri imekataliwa: kifaa hakijasajiliwa dashibodi.");
    showOnDisplay("Amri KATALIWA", "Kifaa hakijasajiliwa");
    ackCommand(commandId, false, "device_not_claimed");
    return;
  }

  bool handled = true;
  if (command == "LCD_MESSAGE" || command == "OLED_MESSAGE") {
    String message = doc["params"]["message"] | "Ujumbe cloud";
    showOnDisplay("Cloud message", message);
  } else if (command == "PUMP_ON" && ENABLE_PUMP_RELAY) {
    manualPumpOverride = true;
    tankPumpFillAllowed = true;
    setPumpRelay(true);
    tankFillNeeded = true;
    showOnDisplay("Tank pump", "Manual ON");
  } else if (command == "PUMP_OFF" && ENABLE_PUMP_RELAY) {
    manualPumpOverride = false;
    tankPumpFillAllowed = false;
    setPumpRelay(false);
    tankFillNeeded = false;
    showOnDisplay("Tank pump", "Manual OFF");
  } else if (command == "VALVE_ON" && ENABLE_VALVE_RELAY) {
    manualValveOverride = true;
    valveIrrigationAllowed = true;
    setValveRelay(true);
    irrigationNeededBySensors = true;
    showOnDisplay("Valve", "Manual OPEN");
  } else if (command == "VALVE_OFF" && ENABLE_VALVE_RELAY) {
    manualValveOverride = false;
    valveIrrigationAllowed = false;
    setValveRelay(false);
    irrigationNeededBySensors = false;
    showOnDisplay("Valve", "Manual CLOSED");
  } else if (command == "SET_THRESHOLDS") {
    float target = doc["params"]["target_moisture"] | TARGET_MOISTURE_PERCENT;
    float pumpOn = doc["params"]["pump_on_threshold"] | PUMP_ON_MOISTURE_PERCENT;
    float pumpOff = doc["params"]["pump_off_threshold"] | PUMP_OFF_MOISTURE_PERCENT;
    if (target > 0 && target <= 100) TARGET_MOISTURE_PERCENT = target;
    if (pumpOn > 0 && pumpOn <= 100) PUMP_ON_MOISTURE_PERCENT = pumpOn;
    if (pumpOff > 0 && pumpOff <= 100) PUMP_OFF_MOISTURE_PERCENT = pumpOff;
    showOnDisplay("Thresholds updated",
                  "Target " + String(TARGET_MOISTURE_PERCENT, 0) + "%",
                  "On " + String(PUMP_ON_MOISTURE_PERCENT, 0) + "%",
                  "Off " + String(PUMP_OFF_MOISTURE_PERCENT, 0) + "%");
  } else if (command == "IRRIGATION_ON") {
    manualValveOverride = true;
    valveIrrigationAllowed = true;
    setValveRelay(true);
    irrigationNeededBySensors = true;
    showOnDisplay("Irrigation", "Manual ON");
  } else if (command == "IRRIGATION_OFF") {
    manualValveOverride = false;
    valveIrrigationAllowed = false;
    setValveRelay(false);
    irrigationNeededBySensors = false;
    showOnDisplay("Irrigation", "Manual OFF");
  } else {
    handled = false;
    Serial.println(">>> Amri haijulikani, haitatekelezwa.");
  }

  ackCommand(commandId, handled, handled ? "executed" : "unknown_command");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nVETA KIPAWA AGRI TECH IoT device v13 starting...");
  analogReadResolution(12);
  Wire.begin(21, 22);
  dht.begin();
  displayReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (!displayReady) Serial.println("OLED SSD1306 not found.");
  showOnDisplay("VETA KIPAWA", "AGRI TECH v13", "Auto-detect API");


  if (ENABLE_PUMP_RELAY) pinMode(PUMP_RELAY_PIN, OUTPUT);
  if (ENABLE_VALVE_RELAY) pinMode(VALVE_RELAY_PIN, OUTPUT);
  setPumpRelay(false);
  setValveRelay(false);

  // v6: Task Watchdog — kama loop() ikikwama > WDT_TIMEOUT_SEC, ESP inareboot yenyewe.
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);

  // v6: sikia matukio ya WiFi/IP ili kujibu haraka ISP inaporudi.
  WiFi.onEvent(onWifiEvent);

  connectWifi();
  runConnectivitySelfTest();
  lastOnlineAt = millis();
}

void loop() {
  esp_task_wdt_reset();  // v6: mwambie WDT tunaishi
  unsigned long now = millis();

  // Auto-reconnect kila loop kama WiFi imepotea.
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  } else {
    lastOnlineAt = now;
  }

  // v6: kama tumekosa internet dakika 15 mfululizo, restart ESP kabisa.
  if (lastOnlineAt > 0 && now - lastOnlineAt > OFFLINE_REBOOT_AFTER_MS) {
    Serial.println(">>> Offline > 15min — full ESP.restart() ili kurejesha ISP link.");
    showOnDisplay("Long outage", "Rebooting ESP", "Auto-recover");
    delay(1000);
    ESP.restart();
  }

  // v6: ISP imerudi sasa hivi -> tuma data mara moja, usisubiri interval.
  if (wifiJustReconnected && WiFi.status() == WL_CONNECTED) {
    wifiJustReconnected = false;
    Serial.println(">>> ISP returned — flushing reading immediately.");
    readSensors();
    sendReadingToCloud();
    fetchIrrigationDecision();
    pollCommand();
    lastSendAt = now;
    lastDecisionPollAt = now;
    lastCommandAt = now;
  }

  if (now - lastSendAt >= SEND_INTERVAL_MS || lastSendAt == 0) {
    readSensors();
    if (uploadBackoffUntil == 0 || now >= uploadBackoffUntil) {
      sendReadingToCloud();
    } else {
      Serial.printf("Upload skipped (backoff %lu ms left)\n", uploadBackoffUntil - now);
    }
    lastSendAt = now;
  }
  if (now - lastDecisionPollAt >= DECISION_INTERVAL_MS || lastDecisionPollAt == 0) {
    fetchIrrigationDecision();
    lastDecisionPollAt = now;
  }
  if (now - lastAdviceAt >= ADVICE_INTERVAL_MS || lastAdviceAt == 0) {
    fetchAdvice();
    lastAdviceAt = now;
  }
  if (now - lastCommandAt >= COMMAND_INTERVAL_MS || lastCommandAt == 0) {
    pollCommand();
    lastCommandAt = now;
  }
  delay(200);
}
