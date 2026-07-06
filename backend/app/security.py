from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Callable
from uuid import UUID

import jwt
from flask import current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
from .models import User


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"])).timestamp()),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def current_user() -> User | None:
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        user_id = UUID(payload["sub"])
    except Exception:
        return None
    return db.session.get(User, user_id)


def require_auth(handler: Callable):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        return handler(user, *args, **kwargs)

    return wrapper
