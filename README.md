# Kiloa Monitoring

**Simple, lightweight, open-source VPS monitoring.**

Kiloa consists of a central **Dashboard** (Node.js) to view your servers and a lightweight **Agent** (Go) to install on your VPS instances.

![Dashboard Preview](dashboard_preview.png)

## Features
- **Real-time Monitoring**: CPU, RAM, Disk, Network usage.
- **Detailed Stats**: Historical graphs (24h), Load Average, Detailed System Info.
- **Single Binary Agent**: No dependencies, just one executable on the VPS.
- **Easy Deployment**: Docker ready (compatible with Coolify).
- **Database Support**: SQLite (Dev) and PostgreSQL (Prod).

---

## 🚀 Getting Started

### 1. Run the Dashboard
You can run the dashboard using Docker (Recommended) or locally with Node.js.

#### Option A: Docker (Recommended)
```bash
docker run -d \
  -p 8080:8080 \
  -e KILOA_TOKEN="secret" \
  -v ./kiloa_data:/app/dashboard \
  kiloa-dashboard
```
*Note: Mounting `-v` ensures your SQLite database persists across restarts. For production, consider using PostgreSQL.*

#### Option B: Node.js Local
```bash
cd dashboard
npm install
node server.js
```

### 2. Install the Agent
On your VPS:
```bash
curl -sL https://raw.githubusercontent.com/demonte21/kiloa/master/agent/install.sh | bash
```
Follow the interactive prompts or pass arguments directly:
```bash
curl -sL https://raw.githubusercontent.com/demonte21/kiloa/master/agent/install.sh | bash -s -- -s "http://YOUR-IP:8080" -t "secret"
```

---

## 🛠️ Configuration

### Environment Variables (Dashboard)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `KILOA_TOKEN` | `secret` | Authentication token for agents (Must match agent) |
| `DB_CLIENT` | `better-sqlite3` | Database client: `better-sqlite3` (SQLite) or `pg` (PostgreSQL) |
| `DATABASE_URL` | - | Connection string for PostgreSQL (Required if `DB_CLIENT=pg`) |
| `DB_PATH` | `./kiloa.db` | Path for SQLite database file (if using SQLite) |

### Agent Arguments
- `-server`: URL of your Dashboard (e.g., `http://1.2.3.4:8080`)
- `-token`: Auth token (default: `secret`)
- `-id`: Custom Node ID (default: hostname)
- `-interval`: Reporting interval in seconds (default: 2)

## License
MIT
