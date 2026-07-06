#!/bin/sh
set -e

flask --app app:create_app init-db
exec gunicorn --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-2}" --timeout 120 wsgi:app
