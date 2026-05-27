#!/usr/bin/env bash
# setup-server.sh — First-time server setup for RuFlo on Debian 13 (Hetzner CX33)
# Run as root: bash setup-server.sh
set -euo pipefail

APP_USER="${APP_USER:-ops}"
APP_DIR="${APP_DIR:-/opt/ruflo}"
REPO_URL="${REPO_URL:-https://github.com/sistem-ciler/ruflo.git}"
BRANCH="${BRANCH:-main}"

echo "==> RuFlo server setup (Debian 13)"

# ---- 1. System packages ----
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban

# ---- 2. Install Docker (official repo) ----
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "==> Docker already installed: $(docker --version)"
fi

# ---- 3. App user ----
if ! id "$APP_USER" &>/dev/null; then
  echo "==> Creating user: $APP_USER"
  useradd -m -s /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER"

# ---- 4. Clone repo ----
if [ ! -d "$APP_DIR" ]; then
  echo "==> Cloning repo to $APP_DIR"
  git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
  echo "==> $APP_DIR already exists, skipping clone"
fi

# ---- 5. Create .env from example if missing ----
if [ ! -f "$APP_DIR/ruflo/.env" ]; then
  cp "$APP_DIR/ruflo/.env.example" "$APP_DIR/ruflo/.env"
  echo "==> Created $APP_DIR/ruflo/.env from .env.example"
  echo "    IMPORTANT: Edit $APP_DIR/ruflo/.env and add your API keys before deploying."
fi

# ---- 6. Systemd service ----
cat > /etc/systemd/system/ruflo.service << EOF
[Unit]
Description=RuFlo Chat UI (Docker Compose)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$APP_USER
WorkingDirectory=$APP_DIR/ruflo
ExecStart=/usr/bin/docker compose up -d --build --remove-orphans
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --build --remove-orphans
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ruflo.service
echo "==> Systemd service 'ruflo' enabled (will start on boot)"

# ---- 7. Firewall ----
echo "==> Configuring UFW firewall..."
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable
echo "==> UFW enabled (SSH, HTTP, HTTPS, 3000 open)"

# ---- 8. Fail2ban ----
systemctl enable --now fail2ban

echo ""
echo "================================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit $APP_DIR/ruflo/.env — add your OPENAI_API_KEY"
echo "  2. Deploy: sudo systemctl start ruflo"
echo "  3. View logs: docker compose -f $APP_DIR/ruflo/docker-compose.yml logs -f"
echo "  4. Access: http://<server-ip>:3000"
echo "================================================================"
