import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SerializerMixin:
    def to_dict(self) -> dict:
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, uuid.UUID):
                value = str(value)
            elif isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, date):
                value = value.isoformat()
            elif hasattr(value, "__float__") and column.name == "amount":
                value = float(value)
            result[column.name] = value
        return result


class User(db.Model, SerializerMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(30))
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    devices = relationship("Device", back_populates="owner")


class Device(db.Model, SerializerMixin):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    hardware_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    device_key: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True)
    claim_code: Mapped[str | None] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    crop: Mapped[str | None] = mapped_column(String(80))
    location_name: Mapped[str | None] = mapped_column(String(160))
    lat: Mapped[float | None]
    lon: Mapped[float | None]
    target_moisture: Mapped[float] = mapped_column(default=45.0, nullable=False)
    pump_on_threshold: Mapped[float] = mapped_column(default=30.0, nullable=False)
    pump_off_threshold: Mapped[float] = mapped_column(default=55.0, nullable=False)
    rain_block_probability: Mapped[float] = mapped_column(default=65.0, nullable=False)
    rain_block_amount_mm: Mapped[float] = mapped_column(default=3.0, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    operator_name: Mapped[str | None] = mapped_column(String(120))
    dashboard_widgets: Mapped[dict | None] = mapped_column(JSONB)
    is_claimed: Mapped[bool] = mapped_column(default=False, nullable=False)
    online: Mapped[bool] = mapped_column(default=False, nullable=False)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    owner = relationship("User", back_populates="devices")
    readings = relationship("Reading", back_populates="device", cascade="all, delete-orphan")
    commands = relationship("Command", back_populates="device", cascade="all, delete-orphan")


class Reading(db.Model, SerializerMixin):
    __tablename__ = "readings"
    __table_args__ = (Index("readings_device_time_idx", "device_id", "recorded_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    soil_moisture: Mapped[float | None]
    soil_ph: Mapped[float | None]
    air_temp: Mapped[float | None]
    air_humidity: Mapped[float | None]
    pump_on: Mapped[bool | None]
    valve_on: Mapped[bool | None]
    water_level: Mapped[float | None]
    water_deficit: Mapped[float | None]
    tank_fill_needed: Mapped[bool | None]
    irrigation_needed: Mapped[bool | None]
    raw: Mapped[dict | None] = mapped_column(JSONB)

    device = relationship("Device", back_populates="readings")


class Command(db.Model, SerializerMixin):
    __tablename__ = "commands"
    __table_args__ = (Index("commands_device_status_idx", "device_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    issued_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    device = relationship("Device", back_populates="commands")


class Alert(db.Model, SerializerMixin):
    __tablename__ = "alerts"
    __table_args__ = (Index("alerts_user_time_idx", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"))
    kind: Mapped[str] = mapped_column(String(80), default="system", nullable=False)
    channel: Mapped[str] = mapped_column(String(40), default="in_app", nullable=False)
    level: Mapped[str] = mapped_column(String(20), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class FarmFinance(db.Model, SerializerMixin):
    __tablename__ = "farm_finance"
    __table_args__ = (
        Index("farm_finance_owner_time_idx", "owner_id", "occurred_at"),
        Index("farm_finance_device_idx", "device_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"))
    season: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="TZS", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
