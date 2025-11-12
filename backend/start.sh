#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start gunicorn with increased timeout and preload
echo "Starting gunicorn..."
exec gunicorn renaissBlock.wsgi \
  --bind 0.0.0.0:8080 \
  --workers 2 \
  --timeout 120 \
  --preload \
  --log-file - \
  --access-logfile - \
  --error-logfile - \
  --log-level info
