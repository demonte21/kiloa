# Kiloa Monitoring

**Simple, lightweight, open-source VPS monitoring.**

Kiloa is a self-hosted monitoring solution written in Go. It consists of a central **Dashboard** to view your servers and a lightweight **Agent** to install on your VPS instances.

![Dashboard Preview](dashboard_preview.png)

## Features
- **Real-time Monitoring**: CPU, RAM, Disk, Network usage.
- **Single Binary**: No dependencies, just one executable.
- **Easy Deployment**: Runs on any Linux VPS (Ubuntu/Debian recommended).
- **Modern UI**: Clean, dark-themed dashboard.

---

## 🚀 Getting Started

### 1. Run the Dashboard
You need a central server to host the dashboard.

1.  Clone this repository.
2.  Build and run the dashboard:
    ```bash
    cd dashboard
    go build -o dashboard main.go
    ./dashboard
    ```
3.  The dashboard is available at `http://YOUR_SERVER_IP:8080`.

**Note:** By default, the dashboard uses an SQLite database (`kiloa.db`) stored in the running directory.

### 2. Install the Agent on your VPS
On every VPS you want to monitor:

1.  **Build the Agent for Linux** (from your dev machine):
    ```bash
    cd agent
    env GOOS=linux GOARCH=amd64 go build -o agent main.go
    ```
2.  **Upload the `agent` binary** to your VPS (e.g., via SCP).
3.  **Run the install script** (or manually run the binary):
    ```bash
    # Copy agent to /opt/kiloa-agent/agent first
    chmod +x /opt/kiloa-agent/agent
    
    # Run directly
    ./agent -server "http://YOUR_DASHBOARD_IP:8080" -token "secret"
    ```

*(A proper automated install script `install.sh` is provided in the `agent/` folder, but requires you to host the compiled binary somewhere accessible via data-url, like GitHub Releases).*

---

## 🛠️ Configuration

**Agent Arguments:**
- `-server`: URL of your Kiloa Dashboard (default: `http://localhost:8080`)
- `-token`: Authentication token (default: `secret`). *Must match the dashboard.*
- `-id`: Custom Node ID (default: hostname)
- `-interval`: Reporting interval in seconds (default: 2)

**Dashboard Auth:**
Currently, the token is hardcoded as `secret` in `dashboard/main.go`. Change this header check in the source code for production usage!

## License
MIT
