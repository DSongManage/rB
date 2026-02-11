#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Wait for database to be ready (handles Railway sleep/wake)
echo "Waiting for database..."
MAX_RETRIES=15
RETRY_DELAY=10
for i in $(seq 1 $MAX_RETRIES); do
  python -c "
import psycopg2, os, dj_database_url
db = dj_database_url.parse(os.environ.get('DATABASE_URL', ''))
psycopg2.connect(
    dbname=db['NAME'], user=db['USER'], password=db['PASSWORD'],
    host=db['HOST'], port=db['PORT'],
    connect_timeout=5
)
print('Database is ready!')
" 2>/dev/null && break
  echo "Database not ready (attempt $i/$MAX_RETRIES). Retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Verify static files were collected during build (fallback to collectstatic if needed)
if [ ! -d "/app/staticfiles/admin" ]; then
  echo "Static files not found, running collectstatic..."
  python manage.py collectstatic --noinput
fi

# Create test superuser for PR preview environments (non-production only)
if [ "$RAILWAY_ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Non-production environment detected. Creating test superuser..."
  python manage.py create_test_superuser || echo "Test superuser creation skipped or failed"
fi

# Configure gunicorn workers based on tier
# Hobby tier (512MB): 2 workers
# Pro tier (8GB): 4-8 workers (set via GUNICORN_WORKERS env var)
WORKERS=${GUNICORN_WORKERS:-2}
THREADS=${GUNICORN_THREADS:-1}
TIMEOUT=${GUNICORN_TIMEOUT:-120}

echo "Starting gunicorn with $WORKERS workers, $THREADS threads, ${TIMEOUT}s timeout..."
exec gunicorn renaissBlock.wsgi \
  --bind 0.0.0.0:8080 \
  --workers $WORKERS \
  --threads $THREADS \
  --timeout $TIMEOUT \
  --preload \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --log-file - \
  --access-logfile - \
  --error-logfile - \
  --log-level info
