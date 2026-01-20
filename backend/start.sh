#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files with debug info
echo "Collecting static files..."
echo "Current directory: $(pwd)"
echo "Python path: $(which python)"

# Debug: Check where Django admin static files are
echo "Looking for admin static files..."
python -c "import django.contrib.admin; import os; admin_path = os.path.dirname(django.contrib.admin.__file__); print(f'Admin module path: {admin_path}'); static_path = os.path.join(admin_path, 'static', 'admin'); print(f'Admin static path: {static_path}'); print(f'Exists: {os.path.exists(static_path)}'); import os; files = os.listdir(static_path) if os.path.exists(static_path) else []; print(f'Files: {files[:5]}')"

# Debug: Check staticfiles finders
echo "Checking staticfiles finders..."
python -c "from django.contrib.staticfiles import finders; print('Finders:', [f.__class__.__name__ for f in finders.get_finders()])"

# Run collectstatic
python manage.py collectstatic --noinput --verbosity 2

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
