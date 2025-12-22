#!/bin/bash

# Celery worker startup script
echo "Starting Celery worker..."

exec celery -A renaissBlock worker -l info --concurrency=2
