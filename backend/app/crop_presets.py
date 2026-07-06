CROP_PRESETS = {
    "mahindi": {"name": "Mahindi", "target": 45, "on": 30, "off": 55, "aliases": ["maize", "corn"]},
    "mpunga": {"name": "Mpunga", "target": 70, "on": 55, "off": 80, "aliases": ["rice", "paddy"]},
    "maharage": {"name": "Maharage", "target": 45, "on": 32, "off": 55, "aliases": ["beans"]},
    "nyanya": {"name": "Nyanya", "target": 60, "on": 45, "off": 70, "aliases": ["tomato"]},
    "vitunguu": {"name": "Vitunguu", "target": 55, "on": 40, "off": 65, "aliases": ["onion"]},
    "kabichi": {"name": "Kabichi", "target": 65, "on": 50, "off": 75, "aliases": ["cabbage"]},
    "sukuma": {"name": "Sukuma wiki", "target": 60, "on": 45, "off": 70, "aliases": ["kale"]},
    "ndizi": {"name": "Ndizi", "target": 65, "on": 50, "off": 75, "aliases": ["banana"]},
    "embe": {"name": "Embe", "target": 45, "on": 30, "off": 60, "aliases": ["mango"]},
    "korosho": {"name": "Korosho", "target": 35, "on": 22, "off": 50, "aliases": ["cashew"]},
}


def _normal(value: str | None) -> str:
    return (value or "").strip().lower()


def resolve_crop_settings(crop: str | None, values: dict | None = None) -> dict:
    values = values or {}
    query = _normal(crop)
    preset = CROP_PRESETS["mahindi"]
    for key, item in CROP_PRESETS.items():
        names = [key, _normal(item["name"]), *[_normal(alias) for alias in item["aliases"]]]
        if query in names:
            preset = item
            break

    on = _bounded_number(values.get("pump_on_threshold"), preset["on"])
    off = _bounded_number(values.get("pump_off_threshold"), preset["off"])
    target = _bounded_number(values.get("target_moisture"), preset["target"])
    if on >= off:
        on = preset["on"]
        off = preset["off"]
    if target <= on or target >= off:
        target = preset["target"]
    return {
        "crop": crop.strip() if crop and crop.strip() else preset["name"],
        "target_moisture": target,
        "pump_on_threshold": on,
        "pump_off_threshold": off,
    }


def _bounded_number(value, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return float(fallback)
    return max(0.0, min(100.0, number))
