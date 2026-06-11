#!/bin/bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root or with sudo."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_SRC="$REPO_ROOT/config/cloudflare-tunnel.yml"

# --- Install cloudflared ---
echo "==> Installing cloudflared..."
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  CF_ARCH="amd64" ;;
  aarch64) CF_ARCH="arm64" ;;
  armv7l)  CF_ARCH="arm"   ;;
  *)
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

if command -v cloudflared &>/dev/null; then
  echo "    cloudflared already installed: $(cloudflared --version)"
elif command -v apt-get &>/dev/null; then
  DEB_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb"
  echo "    Downloading $DEB_URL"
  curl -fsSL "$DEB_URL" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
elif command -v yum &>/dev/null || command -v dnf &>/dev/null; then
  RPM_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.rpm"
  echo "    Downloading $RPM_URL"
  curl -fsSL "$RPM_URL" -o /tmp/cloudflared.rpm
  if command -v dnf &>/dev/null; then
    dnf install -y /tmp/cloudflared.rpm
  else
    yum install -y /tmp/cloudflared.rpm
  fi
  rm /tmp/cloudflared.rpm
else
  BIN_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
  echo "    No package manager found. Downloading binary: $BIN_URL"
  curl -fsSL "$BIN_URL" -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

echo "    cloudflared version: $(cloudflared --version)"

# --- Authenticate if needed ---
echo "==> Checking Cloudflare authentication..."
if ! cloudflared tunnel list &>/dev/null; then
  echo "    Not authenticated. Starting login flow..."
  cloudflared tunnel login
fi

# --- Create or reuse tunnel ---
echo "==> Ensuring tunnel 'getopscore' exists..."
EXISTING=$(cloudflared tunnel list --output json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data:
    if t.get('name') == 'getopscore':
        print(t['id'])
        break
" 2>/dev/null || true)

if [ -n "$EXISTING" ]; then
  TUNNEL_ID="$EXISTING"
  echo "    Reusing existing tunnel: $TUNNEL_ID"
else
  echo "    Creating new tunnel 'getopscore'..."
  CREATE_OUT=$(cloudflared tunnel create getopscore)
  echo "$CREATE_OUT"
  TUNNEL_ID=$(echo "$CREATE_OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  echo "    Created tunnel: $TUNNEL_ID"
fi

if [ -z "$TUNNEL_ID" ]; then
  echo "ERROR: Could not determine TUNNEL_ID."
  exit 1
fi

# --- Deploy config ---
echo "==> Installing tunnel config to /etc/cloudflared/config.yml..."
mkdir -p /etc/cloudflared
sed "s|<TUNNEL_ID>|$TUNNEL_ID|g" "$CONFIG_SRC" > /etc/cloudflared/config.yml
echo "    Config written."

# --- DNS routes ---
echo "==> Creating DNS routes..."
cloudflared tunnel route dns getopscore getopscore.com
cloudflared tunnel route dns getopscore api.getopscore.com
cloudflared tunnel route dns getopscore agents.getopscore.com
echo "    DNS routes created."

# --- Systemd service ---
echo "==> Installing cloudflared as systemd service..."
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
echo "    Service enabled and started."

echo ""
echo "==> Done. Verify with:"
echo "    cloudflared tunnel info getopscore"
echo "    systemctl status cloudflared"
