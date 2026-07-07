import secrets
import string
from datetime import date
from uuid import UUID

import requests
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .crop_presets import resolve_crop_settings
from .extensions import db
from .models import Alert, Command, Device, FarmFinance, Reading, User, utcnow
from .security import hash_password, issue_token, require_auth, verify_password
from .sensors import parse_reading

api = Blueprint("api", __name__, url_prefix="/api")

COMMAND_LABELS = {
    "pump_on": "PUMP_ON",
    "pump_off": "PUMP_OFF",
    "valve_on": "VALVE_ON",
    "valve_off": "VALVE_OFF",
    "set_thresholds": "SET_THRESHOLDS",
}


def json_body() -> dict:
    if not request.data:
        return {}
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def make_device_key() -> str:
    return "dk_" + secrets.token_hex(24)


def make_claim_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


def owner_device_or_404(user: User, device_id: str):
    try:
        uid = UUID(device_id)
    except ValueError:
        return None
    return db.session.scalar(select(Device).where(Device.id == uid, Device.owner_id == user.id))


def device_from_key():
    header = (
        request.headers.get("Authorization")
        or request.headers.get("X-Device-Key")
        or request.headers.get("X-API-Key")
        or request.args.get("device_key")
        or request.args.get("api_key")
        or request.args.get("key")
        or request.args.get("token")
    )
    key = (header or "").strip()
    if key.lower().startswith("bearer "):
        key = key[7:].strip()
    if not key:
        return None
    return db.session.scalar(select(Device).where(Device.device_key == key))


def mark_device_online(device: Device) -> None:
    device.online = True
    device.last_seen_at = utcnow()


def config_for_device(device: Device) -> dict:
    return {
        "claimed": bool(device.is_claimed),
        "server_time": utcnow().isoformat(),
        "name": device.name,
        "crop": device.crop,
        "target_moisture": device.target_moisture,
        "pump_on_threshold": device.pump_on_threshold,
        "pump_off_threshold": device.pump_off_threshold,
        "rain_block_probability": device.rain_block_probability,
        "rain_block_amount_mm": device.rain_block_amount_mm,
    }


def public_device_required():
    device = device_from_key()
    if not device:
        return None, (
            jsonify(
                {
                    "error": "invalid_device_key",
                    "path": request.path,
                    "accepted_auth": [
                        "Authorization: Bearer <device_key>",
                        "X-Device-Key: <device_key>",
                        "X-API-Key: <device_key>",
                        "?device_key=<device_key>",
                    ],
                }
            ),
            401,
        )
    mark_device_online(device)
    return device, None


def latest_reading_for(device: Device):
    return db.session.scalar(
        select(Reading)
        .where(Reading.device_id == device.id)
        .order_by(Reading.recorded_at.desc())
        .limit(1)
    )


@api.get("/health")
def api_health():
    return jsonify({"ok": True, "service": "farm-buddy-flask-api"})


@api.post("/auth/register")
def register():
    body = json_body()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    if not email or "@" not in email:
        return jsonify({"error": "valid_email_required"}), 400
    if len(password) < 8:
        return jsonify({"error": "password_min_8"}), 400
    user = User(email=email, password_hash=hash_password(password), full_name=body.get("full_name"))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "email_already_registered"}), 409
    return jsonify({"token": issue_token(user), "user": user.to_dict()}), 201


@api.post("/auth/login")
def login():
    body = json_body()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    user = db.session.scalar(select(User).where(User.email == email))
    if not user or not verify_password(user.password_hash, password):
        return jsonify({"error": "invalid_email_or_password"}), 401
    return jsonify({"token": issue_token(user), "user": user.to_dict()})


@api.get("/auth/me")
@require_auth
def me(user: User):
    return jsonify({"user": user.to_dict()})


@api.get("/devices")
@require_auth
def list_devices(user: User):
    rows = db.session.scalars(select(Device).where(Device.owner_id == user.id).order_by(Device.created_at.desc()))
    return jsonify([row.to_dict() for row in rows])


@api.post("/devices")
@api.post("/devices/manual")
@require_auth
def create_manual_device(user: User):
    body = json_body()
    moisture = resolve_crop_settings(body.get("crop"), body)
    device = Device(
        owner_id=user.id,
        is_claimed=True,
        claimed_at=utcnow(),
        device_key=make_device_key(),
        hardware_id="manual-" + secrets.token_hex(6),
        claim_code=None,
        name=str(body.get("name") or "Farm device")[:120],
        crop=moisture["crop"],
        location_name=body.get("location_name"),
        lat=body.get("lat"),
        lon=body.get("lon"),
        target_moisture=moisture["target_moisture"],
        pump_on_threshold=moisture["pump_on_threshold"],
        pump_off_threshold=moisture["pump_off_threshold"],
        ip_address=body.get("ip_address"),
        operator_name=body.get("operator_name"),
        dashboard_widgets=body.get("dashboard_widgets"),
    )
    db.session.add(device)
    db.session.commit()
    return jsonify({"id": str(device.id), "device_key": device.device_key}), 201


@api.post("/devices/claim")
@require_auth
def claim_device(user: User):
    body = json_body()
    claim = str(body.get("claim_code", "")).strip()
    if not claim:
        return jsonify({"error": "claim_code_required"}), 400
    device = db.session.scalar(
        select(Device).where((Device.claim_code == claim.upper()) | (Device.device_key == claim))
    )
    if not device:
        return jsonify({"error": "device_not_found"}), 404
    if device.is_claimed and device.owner_id != user.id:
        return jsonify({"error": "device_already_claimed"}), 409
    moisture = resolve_crop_settings(body.get("crop"), body)
    device.owner_id = user.id
    device.is_claimed = True
    device.claimed_at = utcnow()
    device.claim_code = None
    device.name = str(body.get("name") or device.name)[:120]
    device.crop = moisture["crop"]
    device.target_moisture = moisture["target_moisture"]
    device.pump_on_threshold = moisture["pump_on_threshold"]
    device.pump_off_threshold = moisture["pump_off_threshold"]
    device.location_name = body.get("location_name", device.location_name)
    device.lat = body.get("lat", device.lat)
    device.lon = body.get("lon", device.lon)
    db.session.commit()
    return jsonify({"id": str(device.id), "device_key": device.device_key})


@api.get("/devices/<device_id>")
@require_auth
def get_device(user: User, device_id: str):
    device = owner_device_or_404(user, device_id)
    if not device:
        return jsonify({"error": "device_not_found"}), 404
    latest = db.session.scalar(
        select(Reading).where(Reading.device_id == device.id).order_by(Reading.recorded_at.desc()).limit(1)
    )
    history = db.session.scalars(
        select(Reading).where(Reading.device_id == device.id).order_by(Reading.recorded_at.desc()).limit(200)
    )
    return jsonify(
        {
            "device": device.to_dict(),
            "latest": latest.to_dict() if latest else None,
            "history": [row.to_dict() for row in history],
        }
    )


@api.patch("/devices/<device_id>")
@require_auth
def update_device(user: User, device_id: str):
    device = owner_device_or_404(user, device_id)
    if not device:
        return jsonify({"error": "device_not_found"}), 404
    body = json_body()
    for field in ["name", "crop", "location_name", "lat", "lon", "ip_address", "operator_name"]:
        if field in body:
            setattr(device, field, body[field])
    if any(key in body for key in ["target_moisture", "pump_on_threshold", "pump_off_threshold"]):
        moisture = resolve_crop_settings(device.crop, body)
        device.target_moisture = moisture["target_moisture"]
        device.pump_on_threshold = moisture["pump_on_threshold"]
        device.pump_off_threshold = moisture["pump_off_threshold"]
    db.session.commit()
    return jsonify({"ok": True, "device": device.to_dict()})


@api.delete("/devices/<device_id>")
@require_auth
def delete_device(user: User, device_id: str):
    device = owner_device_or_404(user, device_id)
    if not device:
        return jsonify({"error": "device_not_found"}), 404
    db.session.delete(device)
    db.session.commit()
    return jsonify({"ok": True})


@api.post("/devices/<device_id>/commands")
@require_auth
def issue_command(user: User, device_id: str):
    device = owner_device_or_404(user, device_id)
    if not device:
        return jsonify({"error": "device_not_found"}), 404
    body = json_body()
    kind = body.get("kind")
    if kind not in COMMAND_LABELS:
        return jsonify({"error": "invalid_command"}), 400
    command = Command(device_id=device.id, kind=kind, payload=body.get("payload") or {}, issued_by=user.id)
    db.session.add(command)
    db.session.add(
        Alert(
            user_id=user.id,
            device_id=device.id,
            kind=f"command_{kind}",
            level="info",
            title=f"Command sent - {device.name}",
            body=f"{kind} is waiting for device acknowledgement.",
            sent_at=utcnow(),
        )
    )
    db.session.commit()
    return jsonify({"ok": True, "command_id": str(command.id)}), 201


@api.post("/public/devices/register")
def public_register_device():
    body = json_body()
    hardware_id = str(body.get("hardware_id", "")).strip()[:80]
    if len(hardware_id) < 4:
        return jsonify({"error": "invalid_hardware_id"}), 400
    existing = db.session.scalar(select(Device).where(Device.hardware_id == hardware_id))
    if existing:
        return jsonify(
            {
                "device_key": existing.device_key,
                "claim_code": None if existing.is_claimed else existing.claim_code,
                "is_claimed": existing.is_claimed,
                "name": existing.name,
            }
        )
    claim_code = make_claim_code()
    while db.session.scalar(select(Device).where(Device.claim_code == claim_code)):
        claim_code = make_claim_code()
    device = Device(
        hardware_id=hardware_id,
        device_key=make_device_key(),
        claim_code=claim_code,
        name=f"IOT-{hardware_id[-6:].upper()}",
        is_claimed=False,
    )
    db.session.add(device)
    db.session.commit()
    return jsonify({"device_key": device.device_key, "claim_code": claim_code, "is_claimed": False}), 201


@api.post("/public/devices/ingest")
@api.post("/public/devices/sync")
@api.post("/public/readings")
@api.post("/readings")
def public_ingest():
    device, error = public_device_required()
    if error:
        return error
    body = json_body()
    if request.data and not body:
        db.session.rollback()
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "invalid_json",
                    "path": request.path,
                    "content_type": request.content_type,
                }
            ),
            400,
        )
    if body.get("ping") is True or body.get("heartbeat") is True:
        db.session.commit()
        return jsonify(
            {
                "ok": True,
                "heartbeat": True,
                "claimed": device.is_claimed,
                "config": config_for_device(device),
            }
        )
    parsed = parse_reading(body)
    if not any(value is not None for value in parsed.values()):
        db.session.rollback()
        return jsonify({"ok": False, "error": "no_sensor_data_detected", "received_keys": list(body.keys())}), 422
    reading = Reading(device_id=device.id, raw=body, **parsed)
    db.session.add(reading)
    db.session.commit()
    return jsonify(
        {
            "ok": True,
            "heartbeat": False,
            "claimed": device.is_claimed,
            "server_time": utcnow().isoformat(),
            "saved_reading": reading.to_dict(),
            "config": config_for_device(device),
        }
    )


@api.get("/public/devices/config")
@api.get("/devices/config")
def public_config():
    device, error = public_device_required()
    if error:
        return error
    db.session.commit()
    return jsonify(config_for_device(device))


@api.get("/public/devices/commands")
@api.get("/devices/commands")
def public_commands():
    device, error = public_device_required()
    if error:
        return error
    commands = db.session.scalars(
        select(Command)
        .where(Command.device_id == device.id, Command.status.in_(["pending", "sent"]))
        .order_by(Command.created_at.asc())
        .limit(10)
    ).all()
    for command in commands:
        command.status = "sent"
    db.session.commit()
    return jsonify({"commands": [command.to_dict() for command in commands]})


@api.get("/public/commands/next")
@api.get("/commands/next")
def public_next_command():
    device, error = public_device_required()
    if error:
        return error
    command = db.session.scalar(
        select(Command)
        .where(Command.device_id == device.id, Command.status.in_(["pending", "sent"]))
        .order_by(Command.created_at.asc())
        .limit(1)
    )
    if not command:
        db.session.commit()
        return jsonify({"command": "NONE"})
    command.status = "sent"
    db.session.commit()
    return jsonify(
        {
            "command": COMMAND_LABELS.get(command.kind, "NONE"),
            "id": str(command.id),
            "params": command.payload or {},
            "ack_url": "/api/public/devices/ack",
            "ack_required": True,
        }
    )


@api.post("/public/devices/ack")
@api.post("/devices/ack")
def public_ack():
    device, error = public_device_required()
    if error:
        return error
    body = json_body()
    command_id = body.get("id") or body.get("command_id")
    if not command_id:
        return jsonify({"error": "missing_id"}), 400
    try:
        cid = UUID(str(command_id))
    except ValueError:
        return jsonify({"error": "invalid_id"}), 400
    command = db.session.scalar(
        select(Command).where(Command.id == cid, Command.device_id == device.id)
    )
    if not command:
        return jsonify({"error": "command_not_found"}), 404
    ok = body.get("ok") is not False
    command.status = "acked" if ok else "failed"
    command.acked_at = utcnow()
    if device.owner_id:
        db.session.add(
            Alert(
                user_id=device.owner_id,
                device_id=device.id,
                kind=f"ack_{command.kind}",
                level="info" if ok else "warning",
                title=f"Device acknowledged - {device.name}",
                body=f"{command.kind} {'completed' if ok else 'failed'} on the device.",
                sent_at=utcnow(),
            )
        )
    db.session.commit()
    return jsonify({"ok": True})


@api.get("/public/irrigation/decision")
@api.get("/irrigation/decision")
def public_irrigation_decision():
    device, error = public_device_required()
    if error:
        return error

    latest = latest_reading_for(device)
    moisture = latest.soil_moisture if latest else None
    pump_off = float(device.pump_off_threshold or 55)
    allow_irrigation = moisture is None or moisture < pump_off
    reason = (
        "Hakuna mvua iliyozuiwa kwenye Flask backend; ruhusu kifaa kitumie thresholds zake."
        if allow_irrigation
        else f"Unyevu wa udongo uko {moisture:.0f}%, umefikia kiwango cha kuzima pampu."
    )

    db.session.commit()
    return jsonify(
        {
            "allow_irrigation": allow_irrigation,
            "forecast": {
                "rain_probability_percent": 0,
                "rain_amount_mm": 0,
            },
            "reason": reason,
            "source": "flask",
            "latest_reading_at": latest.recorded_at.isoformat() if latest else None,
        }
    )


@api.get("/public/advice/latest")
@api.get("/advice/latest")
def public_latest_advice():
    device, error = public_device_required()
    if error:
        return error

    latest = latest_reading_for(device)
    if not latest or latest.soil_moisture is None:
        advice_text = "Hakuna ushauri bado. Subiri kifaa kitume vipimo vya unyevu."
        action = "wait"
    elif latest.soil_moisture < float(device.pump_on_threshold or 30):
        advice_text = (
            f"Udongo umekauka ({latest.soil_moisture:.0f}%). "
            f"Washa umwagiliaji mpaka ufike {float(device.pump_off_threshold or 55):.0f}%."
        )
        action = "pump_on"
    elif latest.soil_moisture >= float(device.pump_off_threshold or 55):
        advice_text = (
            f"Unyevu umetosha ({latest.soil_moisture:.0f}%). "
            "Zima pampu au acha ikiwa imezimwa."
        )
        action = "pump_off"
    else:
        advice_text = f"Unyevu uko sawa ({latest.soil_moisture:.0f}%). Endelea kufuatilia."
        action = "hold"

    db.session.commit()
    return jsonify(
        {
            "advice_text": advice_text,
            "action": action,
            "created_at": latest.recorded_at.isoformat() if latest else None,
            "source": "flask_rules",
        }
    )


@api.get("/finance")
@require_auth
def list_finance(user: User):
    query = select(FarmFinance).where(FarmFinance.owner_id == user.id).order_by(FarmFinance.occurred_at.desc())
    device_id = request.args.get("device_id")
    if device_id:
        query = query.where(FarmFinance.device_id == UUID(device_id))
    rows = db.session.scalars(query.limit(500))
    return jsonify([row.to_dict() for row in rows])


@api.post("/finance")
@require_auth
def add_finance(user: User):
    body = json_body()
    entry_type = body.get("entry_type")
    if entry_type not in {"income", "expense"}:
        return jsonify({"error": "entry_type_must_be_income_or_expense"}), 400
    row = FarmFinance(
        owner_id=user.id,
        device_id=UUID(body["device_id"]) if body.get("device_id") else None,
        season=str(body.get("season") or "")[:80],
        entry_type=entry_type,
        category=str(body.get("category") or "")[:80],
        amount=float(body.get("amount") or 0),
        currency=str(body.get("currency") or "TZS")[:8],
        description=body.get("description"),
        occurred_at=date.fromisoformat(str(body.get("occurred_at") or date.today().isoformat())),
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"ok": True, "entry": row.to_dict()}), 201


@api.delete("/finance/<entry_id>")
@require_auth
def delete_finance(user: User, entry_id: str):
    row = db.session.scalar(select(FarmFinance).where(FarmFinance.id == UUID(entry_id), FarmFinance.owner_id == user.id))
    if not row:
        return jsonify({"error": "entry_not_found"}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True})


@api.get("/alerts")
@require_auth
def list_alerts(user: User):
    rows = db.session.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(100))
    return jsonify([row.to_dict() for row in rows])


@api.post("/alerts/<alert_id>/read")
@require_auth
def mark_alert_read(user: User, alert_id: str):
    row = db.session.scalar(select(Alert).where(Alert.id == UUID(alert_id), Alert.user_id == user.id))
    if not row:
        return jsonify({"error": "alert_not_found"}), 404
    row.read_at = utcnow()
    db.session.commit()
    return jsonify({"ok": True})


@api.post("/chat")
@require_auth
def chat(user: User):
    body = json_body()
    messages = body.get("messages") if isinstance(body.get("messages"), list) else []
    question = ""
    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "user":
            question = str(message.get("content") or "")
            break
    if not question:
        question = str(body.get("question") or "")
    answer = run_farm_ai(question)
    return jsonify({"answer": answer, "user_id": str(user.id)})


def run_farm_ai(question: str) -> str:
    system_text = (
        "You are a farming technical assistant. Give practical advice about crops, irrigation, "
        "soil moisture, pests, fertilizer, farm expenses, and IoT farm sensors. Be concise."
    )
    if current_app.config["GEMINI_API_KEY"]:
        try:
            response = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{current_app.config['GEMINI_MODEL']}:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "X-goog-api-key": current_app.config["GEMINI_API_KEY"],
                },
                json={"contents": [{"parts": [{"text": f"{system_text}\n\nQuestion: {question}"}]}]},
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass
    return (
        "I can help with farming advice. Check soil moisture, crop stage, weather, and recent "
        "expenses. For irrigation, water when moisture is below the crop minimum and avoid watering "
        "before heavy rain. Add GEMINI_API_KEY to get live AI answers."
    )
