#!/bin/bash

# Kiloa Agent Installer
# Usage: curl -sL https://raw.githubusercontent.com/USER/REPO/main/agent/install.sh | bash -s -- -s http://your-dashboard.com -t your-secret-token

# Default variables
SERVER_URL="http://localhost:8080"
TOKEN="secret"
INTERVAL=2
INSTALL_DIR="/opt/kiloa-agent"
SERVICE_NAME="kiloa-agent"

# Parse arguments
while getopts "s:t:i:" opt; do
  case $opt in
    s) SERVER_URL="$OPTARG" ;;
    t) TOKEN="$OPTARG" ;;
    i) INTERVAL="$OPTARG" ;;
    *) echo "Usage: $0 [-s server_url] [-t token] [-i interval]" >&2; exit 1 ;;
  esac
done

# Interactive mode if no arguments provided
if [ $OPTIND -eq 1 ]; then
    echo "Starting Interactive Setup..."
    
    read -p "Enter Dashboard URL [$SERVER_URL]: " input_url < /dev/tty
    SERVER_URL=${input_url:-$SERVER_URL}

    read -p "Enter Secret Token [$TOKEN]: " input_token < /dev/tty
    TOKEN=${input_token:-$TOKEN}

    read -p "Enter Interval (seconds) [$INTERVAL]: " input_interval < /dev/tty
    INTERVAL=${input_interval:-$INTERVAL}
    
    echo "-----------------------------------"
fi

echo "Installing Kiloa Agent..."
echo "Server: $SERVER_URL"
echo "Interval: $INTERVAL seconds"

# 1. Create Directory
if [ ! -d "$INSTALL_DIR" ]; then
    sudo mkdir -p "$INSTALL_DIR"
    echo "Created $INSTALL_DIR"
fi

# 2. Download Binary (Mocking URL for now, user needs to replace REPO/USER)
# In a real scenario, we'd pull from GitHub Releases or the raw repo if binary is committed (not recommended for repo size)
# For this template, we assume the user will build or host the binary.
# FAILBACK: We will try to download the source and run go build if go is installed, otherwise warn user.

# 2. Stop Service (if running) to release file lock
echo "Stopping existing service to update binary..."
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

# 3. Download Binary (Mocking URL for now, user needs to replace REPO/USER)
echo "Downloading Agent Binary..."
sudo curl -L "https://github.com/demonte21/kiloa/releases/download/Prod/agent-linux-amd64" -o "$INSTALL_DIR/agent"
sudo chmod +x "$INSTALL_DIR/agent"

if [ ! -f "$INSTALL_DIR/agent" ]; then
    echo "⚠️  Agent binary not found in $INSTALL_DIR."
    echo "    Download failed. Please check the URL or network connection."
    exit 1
fi

# 3. Create Systemd Service
echo "Creating Systemd Service..."
cat <<EOF | sudo tee /etc/systemd/system/$SERVICE_NAME.service
[Unit]
Description=Kiloa Monitoring Agent
After=network.target

[Service]
ExecStart=$INSTALL_DIR/agent -server $SERVER_URL -token $TOKEN -interval $INTERVAL
Restart=always
User=root
WorkingDirectory=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

# 4. Enable and Start
echo "Enabling and Starting Service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo "✅ Kiloa Agent Installed and Started!"
echo "Check status directly: sudo systemctl status $SERVICE_NAME"
