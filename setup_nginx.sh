#!/bin/bash
set -e

echo "[1/4] Fixing directory permissions for Nginx and installing vector fonts..."
sudo apt-get update -qq && sudo apt-get install -y fonts-dejavu-core -qq
chmod o+rx /home/Shwet_Patel
chmod o+rx /home/Shwet_Patel/Future-Face
chmod -R o+rX /home/Shwet_Patel/Future-Face/static
chmod -R o+rX /home/Shwet_Patel/Future-Face/demo

echo "[2/4] Writing clean Nginx configuration..."
cat << 'EOF' | sudo tee /etc/nginx/sites-available/futureface > /dev/null
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 30M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /static/ {
        alias /home/Shwet_Patel/Future-Face/static/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location /demo/ {
        alias /home/Shwet_Patel/Future-Face/demo/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/futureface /etc/nginx/sites-enabled/futureface
sudo nginx -t
sudo systemctl restart nginx

echo "[3/4] Configuring FutureFace Systemd background service..."
cat << 'EOF' | sudo tee /etc/systemd/system/futureface.service > /dev/null
[Unit]
Description=FutureFace AI Service
After=network.target

[Service]
User=Shwet_Patel
WorkingDirectory=/home/Shwet_Patel/Future-Face
Environment="PATH=/home/Shwet_Patel/Future-Face/venv/bin:/usr/bin"
Environment="PORT=5000"
ExecStart=/home/Shwet_Patel/Future-Face/venv/bin/gunicorn -b 127.0.0.1:5000 -w 1 --threads 4 -t 300 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable futureface
sudo systemctl restart futureface

echo "[4/4] Verifying services..."
sudo systemctl status futureface --no-pager
sudo systemctl status nginx --no-pager

echo "=========================================================="
echo "FUTURE-FACE IS NOW RUNNING WITH FULL STYLES & FAST NGINX!"
echo "Open: http://104.208.71.163"
echo "=========================================================="
