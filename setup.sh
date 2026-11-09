#!/usr/bin/env bash
# One-time setup for an Ubuntu server (Oracle Cloud Always Free etc.)
# Run inside the uploaded folder:  bash setup.sh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_USER="$(whoami)"

read -r -s -p "Choose an ADMIN password (avoid quotes): " PW; echo
[ -n "$PW" ] || { echo "Password cannot be empty"; exit 1; }

echo "== Installing Node.js and nginx =="
sudo apt-get update
sudo apt-get install -y curl nginx
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "== Creating service =="
printf 'ADMIN_PASSWORD=%s\nPORT=3000\n' "$PW" | sudo tee /etc/nabanita-store.env >/dev/null
sudo chmod 600 /etc/nabanita-store.env
sudo tee /etc/systemd/system/nabanita-store.service >/dev/null <<UNIT
[Unit]
Description=Nabanita Group Paper Plate Store
After=network.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/nabanita-store.env
ExecStart=$(command -v node) server.js
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now nabanita-store

echo "== Configuring nginx (port 80 -> app) =="
sudo tee /etc/nginx/sites-available/nabanita-store >/dev/null <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/nabanita-store /etc/nginx/sites-enabled/nabanita-store
sudo nginx -t
sudo systemctl restart nginx

echo "== Opening ports 80 and 443 in the server firewall =="
for P in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $P -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport $P -j ACCEPT
done
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo
echo "Done. Open  http://YOUR_SERVER_PUBLIC_IP  in a browser."
echo "Admin page: http://YOUR_SERVER_PUBLIC_IP/admin"
