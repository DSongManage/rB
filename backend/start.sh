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

# Start gunicorn
echo "Starting gunicorn..."
exec gunicorn renaissBlock.wsgi --log-file - --workers 2
