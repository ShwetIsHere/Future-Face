#!/bin/bash
# Azure App Service Linux Startup Script for FutureFace
echo "=========================================================="
echo "Starting Future-Face on Microsoft Azure App Service"
echo "=========================================================="

export PORT=${PORT:-5000}
export PYTHONUNBUFFERED=1

echo "[Azure Startup] Binding to port: $PORT"
exec gunicorn -c gunicorn.conf.py app:app
