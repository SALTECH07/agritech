from flask import Flask, jsonify
from sqlalchemy import text

from .config import Config
from .extensions import cors, db


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )
    db.init_app(app)

    from .routes import api

    app.register_blueprint(api)

    @app.get("/health")
    def health():
        try:
            db.session.execute(text("select 1"))
            database = "ok"
        except Exception as exc:  # pragma: no cover - health response should include error.
            database = f"error: {exc}"
        return jsonify({"ok": database == "ok", "service": "farm-buddy-flask-api", "database": database})

    @app.cli.command("init-db")
    def init_db_command():
        with app.app_context():
            db.create_all()
        print("Database tables are ready.")

    return app
