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
    net_down REAL DEFAULT 0
  )
`);

module.exports = db;
