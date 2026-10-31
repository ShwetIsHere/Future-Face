# syntax=docker/dockerfile:1
# Future-Face Production Dockerfile for Microsoft Azure Deployment
FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Install system dependencies for OpenCV, PyTorch StyleGAN2 C++ extensions, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specification and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Ensure startup and helper scripts are executable
RUN chmod +x startup.sh 2>/dev/null || true

# Expose the application port
EXPOSE 5000

# Run with Gunicorn production WSGI server
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
