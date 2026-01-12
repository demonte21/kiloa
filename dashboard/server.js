require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.KILOA_TOKEN || 'secret';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper: Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'K', 'M', 'G', 'T'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// POST /api/report - Receive stats from agents
app.post('/api/report', (req, res) => {
    const token = req.headers.authorization;
    if (token !== AUTH_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = req.body;
    const nodeId = data.node_id;

    if (!nodeId) {
        return res.status(400).json({ error: 'Missing node_id' });
    }

    const now = new Date().toISOString();

    // Check if node exists
    const existing = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);

    if (existing) {
        // Update existing node
        db.prepare(`
      UPDATE nodes SET
        updated_at = ?,
        last_seen = ?,
        location = COALESCE(?, location),
        isp = COALESCE(?, isp),
        cores = COALESCE(?, cores),
        load_1 = COALESCE(?, load_1),
        load_5 = COALESCE(?, load_5),
        load_15 = COALESCE(?, load_15),
        mem_used = COALESCE(?, mem_used),
        mem_total = COALESCE(?, mem_total),
        disk_used = COALESCE(?, disk_used),
        disk_total = COALESCE(?, disk_total),
        cpu_steal = COALESCE(?, cpu_steal),
        net_up = COALESCE(?, net_up),
        net_down = COALESCE(?, net_down)
      WHERE id = ?
    `).run(
            now, now,
            data.location, data.isp,
            data.cores, data.load_1, data.load_5, data.load_15,
            data.mem_used, data.mem_total, data.disk_used, data.disk_total,
            data.cpu_steal, data.net_up, data.net_down,
            nodeId
        );
    } else {
        // Insert new node
        db.prepare(`
      INSERT INTO nodes (id, created_at, updated_at, last_seen, location, isp, cores, load_1, load_5, load_15, mem_used, mem_total, disk_used, disk_total, cpu_steal, net_up, net_down)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            nodeId, now, now, now,
            data.location || 'Unknown', data.isp || 'Unknown',
            data.cores || 0, data.load_1 || 0, data.load_5 || 0, data.load_15 || 0,
            data.mem_used || 0, data.mem_total || 0, data.disk_used || 0, data.disk_total || 0,
            data.cpu_steal || 0, data.net_up || 0, data.net_down || 0
        );
    }

    res.json({ status: 'ok' });
});

// GET / - Dashboard
app.get('/', (req, res) => {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY last_seen DESC').all();

    // Process nodes: add status and computed fields
    const processedNodes = nodes.map(node => {
        const lastSeen = new Date(node.last_seen);
        const now = new Date();
        const diffMs = now - lastSeen;
        const diffMins = diffMs / 1000 / 60;

        return {
            ...node,
            status: diffMins < 2 ? 'online' : 'offline',
            memUsedGB: (node.mem_used / 1073741824).toFixed(2),
            memTotalGB: (node.mem_total / 1073741824).toFixed(2),
            memPercent: node.mem_total > 0 ? ((node.mem_used / node.mem_total) * 100).toFixed(1) : 0,
            diskUsedGB: (node.disk_used / 1073741824).toFixed(2),
            diskTotalGB: (node.disk_total / 1073741824).toFixed(2),
            diskPercent: node.disk_total > 0 ? ((node.disk_used / node.disk_total) * 100).toFixed(1) : 0,
            loadPercent: node.cores > 0 ? ((node.load_1 / node.cores) * 100).toFixed(1) : 0,
        };
    });

    // Aggregate stats
    const stats = {
        totalNodes: nodes.length,
        memUsed: formatBytes(nodes.reduce((sum, n) => sum + (n.mem_used || 0), 0)),
        memTotal: formatBytes(nodes.reduce((sum, n) => sum + (n.mem_total || 0), 0)),
        diskUsed: formatBytes(nodes.reduce((sum, n) => sum + (n.disk_used || 0), 0)),
        diskTotal: formatBytes(nodes.reduce((sum, n) => sum + (n.disk_total || 0), 0)),
        netUp: nodes.reduce((sum, n) => sum + (n.net_up || 0), 0).toFixed(2),
        netDown: nodes.reduce((sum, n) => sum + (n.net_down || 0), 0).toFixed(2),
    };

    res.render('index', { nodes: processedNodes, stats });
});

// GET /api/nodes - JSON endpoint for polling
app.get('/api/nodes', (req, res) => {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY last_seen DESC').all();
    res.json(nodes);
});

// Start server
app.listen(PORT, () => {
    console.log(`Kiloa Dashboard running on http://localhost:${PORT}`);
});
