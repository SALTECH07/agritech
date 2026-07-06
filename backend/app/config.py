import os

from sqlalchemy.engine import URL


def _csv_env(name: str, default: str) -> list[str] | str:
    value = os.getenv(name, default).strip()
    if value == "*":
        return "*"
    return [item.strip() for item in value.split(",") if item.strip()]


def _database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url.replace("postgres://", "postgresql://", 1)

    return URL.create(
        "postgresql+psycopg2",
        username=os.getenv("POSTGRES_USER", "farmbuddy"),
        password=os.getenv("POSTGRES_PASSWORD", "farmbuddy"),
        host=os.getenv("POSTGRES_HOST", "postgres"),
        port=int(os.getenv("POSTGRES_INTERNAL_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "farmbuddy"),
    ).render_as_string(
        hide_password=False,
    )


class Config:
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv("JWT_SECRET", "change-this-dev-secret")
    JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "168"))
    CORS_ORIGINS = _csv_env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.5")
