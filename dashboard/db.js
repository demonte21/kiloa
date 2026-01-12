const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'kiloa.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    location TEXT DEFAULT 'Unknown',
    isp TEXT DEFAULT 'Unknown',
    last_seen TEXT DEFAULT (datetime('now')),
    cores INTEGER DEFAULT 0,
    load_1 REAL DEFAULT 0,
    load_5 REAL DEFAULT 0,
    load_15 REAL DEFAULT 0,
    mem_used INTEGER DEFAULT 0,
    mem_total INTEGER DEFAULT 0,
    disk_used INTEGER DEFAULT 0,
    disk_total INTEGER DEFAULT 0,
    cpu_steal REAL DEFAULT 0,
    net_up REAL DEFAULT 0,
    net_down REAL DEFAULT 0,
    host_name TEXT,
    os_distro TEXT,
    kernel_version TEXT,
    cpu_model TEXT,
    cpu_cores_detail TEXT,
    boot_time INTEGER,
    public_ip TEXT
  )
`);

// Create history table
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT,
    timestamp TEXT,
    load_1 REAL,
    mem_percent REAL,
    disk_percent REAL,
    net_in REAL,
    net_out REAL
  );
  CREATE INDEX IF NOT EXISTS idx_history_node_time ON history(node_id, timestamp);
`);

module.exports = db;
