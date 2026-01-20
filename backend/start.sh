#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
echo "Current directory: $(pwd)"

# Debug: Try to find a specific admin static file using Django's findstatic
echo "Testing findstatic for admin/css/base.css..."
python manage.py findstatic admin/css/base.css --verbosity 2 || echo "findstatic failed"

# Run collectstatic with verbosity
echo "Running collectstatic..."
python manage.py collectstatic --noinput --verbosity 2

# Debug: Show what was collected
echo "Contents of staticfiles directory:"
ls -la /app/staticfiles/ 2>/dev/null || echo "staticfiles directory does not exist"
ls -la /app/staticfiles/admin/ 2>/dev/null || echo "admin subdirectory does not exist"

# Create test superuser for PR preview environments (non-production only)
if [ "$RAILWAY_ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Non-production environment detected. Creating test superuser..."
  python manage.py create_test_superuser || echo "Test superuser creation skipped or failed"
fi

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
