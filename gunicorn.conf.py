# Gunicorn Production Configuration for Microsoft Azure App Service & Containers
import os

port = os.environ.get("PORT", "5000")
bind = f"0.0.0.0:{port}"

# For GPU/Heavy PyTorch workloads, 1 worker with multiple threads prevents VRAM exhaustion
workers = int(os.environ.get("WEB_CONCURRENCY", 1))
threads = int(os.environ.get("PYTHON_GET_THREADS", 4))

# Allow up to 300 seconds for deep learning age progression inference
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 300))
graceful_timeout = 30
keepalive = 5

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
