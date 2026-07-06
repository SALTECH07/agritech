NUMBER_TRUE = {"1", "true", "on", "yes", "open", "enabled"}
NUMBER_FALSE = {"0", "false", "off", "no", "closed", "disabled"}


def normalize_key(key: str) -> str:
    return "".join(ch for ch in key.lower() if ch.isalnum())


def read_path(source: dict, path: str):
    value = source
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        if part in value:
            value = value[part]
            continue
        target = normalize_key(part)
        match = next((key for key in value.keys() if normalize_key(str(key)) == target), None)
        if match is None:
            return None
        value = value[match]
    return value


def first_value(source: dict, keys: list[str]):
    for key in keys:
        value = read_path(source, key)
        if value not in (None, ""):
            return value
    return None


def number(source: dict, keys: list[str]) -> float | None:
    value = first_value(source, keys)
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def boolean(source: dict, keys: list[str]) -> bool | None:
    value = first_value(source, keys)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in NUMBER_TRUE:
            return True
        if cleaned in NUMBER_FALSE:
            return False
    return None


def clamp(value: float | None, minimum: float, maximum: float) -> float | None:
    if value is None:
        return None
    if value < minimum or value > maximum:
        return None
    return value


def percent_from_raw(raw: float | None, empty_raw: float, full_raw: float) -> float | None:
    if raw is None:
        return None
    percent = ((raw - empty_raw) * 100) / (full_raw - empty_raw)
    return max(0.0, min(100.0, percent))


def percent_or_raw(source: dict, percent_keys: list[str], raw_keys: list[str], empty_raw: float, full_raw: float):
    direct = number(source, percent_keys)
    if direct is not None:
        if 0 <= direct <= 100:
            return direct
        if 100 < direct <= 4095:
            return percent_from_raw(direct, empty_raw, full_raw)
    return percent_from_raw(number(source, raw_keys), empty_raw, full_raw)


def ph_or_raw(source: dict) -> float | None:
    direct = number(
        source,
        ["soil_ph", "soil_pH", "ph", "pH", "soilPh", "ph_value", "sensors.ph", "data.ph"],
    )
    if direct is not None:
        if 3 <= direct <= 10:
            return direct
        if 14 < direct <= 4095:
            voltage = (direct / 4095) * 3.3
            return clamp(7 + (voltage - 2.5) * -5.7, 3, 10)
    raw = number(source, ["ph_raw", "phRaw", "soil_ph_raw", "soilPhRaw", "ph_adc", "data.ph_raw"])
    if raw is None:
        return None
    voltage = (raw / 4095) * 3.3
    return clamp(7 + (voltage - 2.5) * -5.7, 3, 10)


def parse_reading(body: dict) -> dict:
    soil_moisture = percent_or_raw(
        body,
        [
            "soil_moisture_percent",
            "soil_moisture",
            "soilMoisture",
            "moisture_percent",
            "moisture",
            "sensors.soil",
            "data.moisture",
        ],
        ["soil_moisture_raw", "soilRaw", "soil_raw", "moisture_raw", "soil_adc", "data.soil_raw"],
        3300,
        1200,
    )
    water_level = percent_or_raw(
        body,
        [
            "water_level_percent",
            "water_level",
            "tank_level_percent",
            "tank",
            "water",
            "sensors.water",
            "data.water",
        ],
        ["water_level_raw", "waterRaw", "water_raw", "tank_raw", "water_adc", "data.water_raw"],
        300,
        2500,
    )
    return {
        "soil_moisture": soil_moisture,
        "soil_ph": ph_or_raw(body),
        "air_temp": clamp(
            number(
                body,
                ["temperature_c", "air_temp", "temperature", "temp_c", "temp", "sensors.temperature", "data.temperature"],
            ),
            -10,
            60,
        ),
        "air_humidity": clamp(
            number(body, ["humidity_percent", "air_humidity", "humidity", "airHumidity", "sensors.humidity"]),
            0,
            100,
        ),
        "pump_on": boolean(body, ["pump_on", "pump_is_on", "pump", "pump_state", "tank_pump_is_on"]),
        "valve_on": boolean(body, ["valve_on", "valve_is_open", "valve", "valve_state", "irrigation_is_on"]),
        "water_level": water_level,
        "water_deficit": number(body, ["water_deficit_percent", "water_deficit", "deficit"]),
        "tank_fill_needed": boolean(body, ["tank_fill_needed", "tankFillNeeded", "tank_needed"]),
        "irrigation_needed": boolean(body, ["irrigation_needed", "irrigationNeeded", "needs_irrigation"]),
    }
