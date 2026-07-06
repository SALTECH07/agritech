import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { markDeviceOnline } from "@/lib/esp32-auth.server";

type Esp32Device = {
  id: string;
  owner_id?: string | null;
  is_claimed?: boolean | null;
  name?: string | null;
  crop?: string | null;
  pump_on_threshold?: number | string | null;
  target_moisture?: number | string | null;
  pump_off_threshold?: number | string | null;
  rain_block_probability?: number | string | null;
  rain_block_amount_mm?: number | string | null;
};

const NUMBER_TRUE = new Set(["1", "true", "on", "yes", "open", "enabled"]);
const NUMBER_FALSE = new Set(["0", "false", "off", "no", "closed", "disabled"]);

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readPath(source: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let value: unknown = source;
  for (const part of parts) {
    if (!value || typeof value !== "object") return undefined;
    const objectValue = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(objectValue, part)) {
      value = objectValue[part];
      continue;
    }
    const normalizedPart = normalizeKey(part);
    const matchingKey = Object.keys(objectValue).find(
      (key) => normalizeKey(key) === normalizedPart,
    );
    if (!matchingKey) return undefined;
    value = objectValue[matchingKey];
  }
  return value;
}

function firstValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readPath(source, key);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function num(source: Record<string, unknown>, keys: string[]) {
  const value = firstValue(source, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function percentFromRaw(raw: number | null, emptyRaw: number, fullRaw: number) {
  if (raw === null || !Number.isFinite(raw)) return null;
  const percent = ((raw - emptyRaw) * 100) / (fullRaw - emptyRaw);
  return Math.max(0, Math.min(100, percent));
}

function percentOrRaw(
  source: Record<string, unknown>,
  percentKeys: string[],
  rawKeys: string[],
  rawToPercent: (raw: number | null) => number | null,
) {
  const direct = num(source, percentKeys);
  if (direct !== null) {
    if (direct >= 0 && direct <= 100) return direct;
    if (direct > 100 && direct <= 4095) return rawToPercent(direct);
  }
  return rawToPercent(num(source, rawKeys));
}

function phOrRaw(source: Record<string, unknown>, keys: string[], rawKeys: string[]) {
  const direct = num(source, keys);
  if (direct !== null) {
    if (direct >= 3 && direct <= 10) return direct;
    if (direct > 14 && direct <= 4095) {
      const voltage = (direct / 4095) * 3.3;
      return clampRange(7 + (voltage - 2.5) * -5.7, 3, 10);
    }
  }
  const raw = num(source, rawKeys);
  if (raw === null) return null;
  const voltage = (raw / 4095) * 3.3;
  return clampRange(7 + (voltage - 2.5) * -5.7, 3, 10);
}

function bool(source: Record<string, unknown>, keys: string[]) {
  const value = firstValue(source, keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (NUMBER_TRUE.has(normalized)) return true;
    if (NUMBER_FALSE.has(normalized)) return false;
  }
  return null;
}

// Kila sensor ina range halisi ya kilimo. Thamani nje ya hii = sensor
// haijaunganishwa / imeharibika — tunahifadhi NULL ili kuepuka kumdanganya mkulima.
function clampRange(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function closeEnough(a: number | null, b: unknown, tolerance: number) {
  const other = toNumberOrNull(b);
  if (a === null && other === null) return true;
  if (a === null || other === null) return false;
  return Math.abs(a - other) <= tolerance;
}

async function looksLikeRepeatedConstantReading(
  deviceId: string,
  incoming: {
    soil_moisture: number | null;
    soil_ph: number | null;
    air_temp: number | null;
    air_humidity: number | null;
    water_level: number | null;
  },
) {
  const numericCount = Object.values(incoming).filter((value) => value !== null).length;
  if (numericCount < 3) return false;

  const { data } = await supabaseAdmin
    .from("readings")
    .select("soil_moisture, soil_ph, air_temp, air_humidity, water_level, recorded_at")
    .eq("device_id", deviceId)
    .gte("recorded_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
    .order("recorded_at", { ascending: false })
    .limit(3);

  if (!data || data.length < 3) return false;
  return data.every(
    (row) =>
      closeEnough(incoming.soil_moisture, row.soil_moisture, 0.05) &&
      closeEnough(incoming.soil_ph, row.soil_ph, 0.02) &&
      closeEnough(incoming.air_temp, row.air_temp, 0.05) &&
      closeEnough(incoming.air_humidity, row.air_humidity, 0.05) &&
      closeEnough(incoming.water_level, row.water_level, 0.05),
  );
}

function configForDevice(device: Esp32Device) {
  return {
    target_moisture: Number(device.target_moisture),
    pump_on_threshold: Number(device.pump_on_threshold),
    pump_off_threshold: Number(device.pump_off_threshold),
    rain_block_probability: Number(device.rain_block_probability),
    rain_block_amount_mm: Number(device.rain_block_amount_mm),
  };
}

export async function ingestEsp32Reading(device: Esp32Device, body: Record<string, unknown>) {
  const soil_moisture = percentOrRaw(
    body,
    [
      "soil_moisture_percent",
      "soil_moisture",
      "soilMoisturePercent",
      "soilMoisture",
      "moisture_percent",
      "moisture",
      "moisture_pct",
      "soil_percent",
      "soil",
      "soil_humidity",
      "soilHumidity",
      "sensors.soil",
      "sensors.moisture",
      "sensors.soil_moisture",
      "sensors.soil_moisture_percent",
      "sensor.soil",
      "sensor.moisture",
      "data.soil",
      "data.moisture",
      "reading.soil",
      "readings.soil",
    ],
    [
      "soil_moisture_raw",
      "soilRaw",
      "soil_raw",
      "moisture_raw",
      "soil_adc",
      "soilAdc",
      "sensors.soil_raw",
      "sensors.soil_moisture_raw",
      "sensor.soil_raw",
      "data.soil_raw",
      "reading.soil_raw",
      "readings.soil_raw",
    ],
    (raw) => percentFromRaw(raw, 3300, 1200),
  );
  const soil_ph = phOrRaw(
    body,
    [
      "soil_ph",
      "soil_pH",
      "ph",
      "pH",
      "soilPh",
      "ph_value",
      "phValue",
      "sensors.ph",
      "sensor.ph",
      "data.ph",
      "reading.ph",
      "readings.ph",
    ],
    [
      "ph_raw",
      "phRaw",
      "soil_ph_raw",
      "soilPhRaw",
      "ph_adc",
      "phAdc",
      "sensors.ph_raw",
      "sensor.ph_raw",
      "data.ph_raw",
    ],
  );
  const air_temp = clampRange(
    num(body, [
      "temperature_c",
      "air_temp",
      "temperature",
      "temp_c",
      "temp",
      "airTemp",
      "airTemperature",
      "dht_temp",
      "dhtTemp",
      "sensors.temperature",
      "sensors.temperature_c",
      "sensors.temp",
      "sensor.temperature",
      "data.temperature",
      "reading.temperature",
    ]),
    -10,
    60,
  );
  const air_humidity = clampRange(
    num(body, [
      "humidity_percent",
      "air_humidity",
      "humidity",
      "airHumidity",
      "hum",
      "dht_humidity",
      "dhtHumidity",
      "sensors.humidity",
      "sensors.humidity_percent",
      "sensor.humidity",
      "data.humidity",
      "reading.humidity",
    ]),
    0,
    100,
  );
  const pump_on = bool(body, [
    "tank_pump_is_on",
    "pump_is_on",
    "pump_on",
    "tankPumpIsOn",
    "pumpOn",
    "pump",
    "pump_state",
    "pumpState",
    "pump_status",
    "pumpStatus",
  ]);
  const valve_on = bool(body, [
    "irrigation_is_on",
    "valve_is_open",
    "valve_on",
    "irrigationOn",
    "valveOpen",
    "valveOn",
    "valve",
    "valve_state",
    "valveState",
    "valve_status",
    "valveStatus",
  ]);
  const water_level = percentOrRaw(
    body,
    [
      "water_level_percent",
      "water_level",
      "tank_level_percent",
      "tankLevelPercent",
      "waterLevelPercent",
      "tank",
      "tank_level",
      "tankLevel",
      "water",
      "waterLevel",
      "sensors.water",
      "sensors.tank",
      "sensors.water_level",
      "sensor.water",
      "data.water",
      "data.tank",
      "reading.water",
      "readings.water",
    ],
    [
      "water_level_raw",
      "waterRaw",
      "water_raw",
      "tank_raw",
      "tankRaw",
      "water_adc",
      "waterAdc",
      "tank_adc",
      "tankAdc",
      "sensors.water_raw",
      "sensors.tank_raw",
      "sensor.water_raw",
      "data.water_raw",
      "reading.water_raw",
    ],
    (raw) => percentFromRaw(raw, 300, 2500),
  );
  const water_deficit = num(body, [
    "water_deficit_percent",
    "water_deficit",
    "waterDeficitPercent",
    "waterDeficit",
    "deficit",
    "sensors.water_deficit",
  ]);
  const tank_fill_needed = bool(body, [
    "tank_fill_needed",
    "tankFillNeeded",
    "tank_needed",
    "tankNeeded",
  ]);
  const irrigation_needed = bool(body, [
    "irrigation_needed_by_sensors",
    "irrigation_needed",
    "irrigationNeeded",
    "needs_irrigation",
    "needsIrrigation",
  ]);

  const hasSensorData = [
    soil_moisture,
    soil_ph,
    air_temp,
    air_humidity,
    pump_on,
    valve_on,
    water_level,
    water_deficit,
    tank_fill_needed,
    irrigation_needed,
  ].some((value) => value !== null);

  await markDeviceOnline(device.id);

  const capturedAgeMsRaw = num(body, [
    "captured_age_ms",
    "sample_age_ms",
    "age_ms",
    "ageMs",
    "offline_age_ms",
  ]);
  const capturedAgeMs =
    capturedAgeMsRaw !== null && capturedAgeMsRaw >= 0 && capturedAgeMsRaw <= 24 * 60 * 60 * 1000
      ? capturedAgeMsRaw
      : null;
  const recordedAt =
    capturedAgeMs !== null ? new Date(Date.now() - capturedAgeMs).toISOString() : undefined;

  if (body.ping === true || body.heartbeat === true) {
    return {
      ok: true,
      heartbeat: true,
      claimed: Boolean(device.is_claimed),
      message: "device_online_no_reading_inserted",
      config: configForDevice(device),
    };
  }

  if (!hasSensorData) {
    return {
      ok: false,
      status: 422,
      error: "no_sensor_data_detected",
      message: "Request imefika, lakini haikuwa na data ya sensor inayotambulika.",
      received_keys: Object.keys(body),
      expected_examples: [
        "soil_moisture_percent",
        "soil_moisture_raw",
        "temperature_c",
        "humidity_percent",
        "water_level_percent",
        "water_level_raw",
        "soil_ph",
      ],
      claimed: Boolean(device.is_claimed),
      config: configForDevice(device),
    };
  }

  const { data: insertedReading, error: rErr } = await supabaseAdmin
    .from("readings")
    .insert({
      device_id: device.id,
      ...(recordedAt ? { recorded_at: recordedAt } : {}),
      soil_moisture,
      soil_ph,
      air_temp,
      air_humidity,
      pump_on,
      valve_on,
      water_level,
      water_deficit,
      tank_fill_needed,
      irrigation_needed,
      raw: body as never,
    })
    .select("id, recorded_at")
    .single();
  if (rErr) return { ok: false, status: 500, error: rErr.message };

  const rainProbability = num(body, [
    "forecast_rain_probability_percent",
    "forecast.rain_probability",
    "weather.rain_probability",
  ]);
  const rainAmount = num(body, [
    "forecast_rain_amount_mm",
    "forecast.rain_amount_mm",
    "weather.rain_amount_mm",
  ]);
  if (rainProbability !== null || rainAmount !== null) {
    await supabaseAdmin.from("weather_snapshots").insert({
      device_id: device.id,
      rain_probability: rainProbability,
      rain_amount_mm: rainAmount,
      forecast_summary:
        typeof readPath(body, "weather.summary") === "string"
          ? (readPath(body, "weather.summary") as string)
          : null,
      raw: { source: "esp32_firmware", payload: body } as never,
    });
  }

  if (device.is_claimed && device.owner_id) {
    try {
      const { evaluateAlerts } = await import("@/lib/alerts.server");
      await evaluateAlerts({
        device: {
          id: device.id,
          owner_id: device.owner_id,
          name: device.name ?? "IoT device",
          crop: device.crop ?? null,
          pump_on_threshold: Number(device.pump_on_threshold),
          is_claimed: Boolean(device.is_claimed),
        },
        soil_moisture,
        rain_amount_mm: rainAmount,
        rain_probability: rainProbability,
        was_offline: false,
      });
    } catch (e) {
      console.error("evaluateAlerts failed", e);
    }
  }

  return {
    ok: true,
    heartbeat: false,
    claimed: Boolean(device.is_claimed),
    server_time: new Date().toISOString(),
    saved_reading: {
      id: insertedReading?.id ?? null,
      recorded_at: insertedReading?.recorded_at ?? null,
      soil_moisture,
      soil_ph,
      air_temp,
      air_humidity,
      water_level,
      water_deficit,
      pump_on,
      valve_on,
      tank_fill_needed,
      irrigation_needed,
      sample_age_ms: capturedAgeMs,
    },
    config: configForDevice(device),
  };
}
