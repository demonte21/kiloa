require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db'); // Knex instance

const app = express();
const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.KILOA_TOKEN || 'secret';

// Middleware
app.use(express.json());
// Serve static files (Tailwind CDN is used, but we might have local assets later)
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
app.post('/api/report', async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (token !== AUTH_TOKEN) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = req.body;
        const nodeId = data.node_id;

        if (!nodeId) {
            return res.status(400).json({ error: 'Missing node_id' });
        }

        const now = new Date();

        // 1. Update/Insert Node
        const existing = await db('nodes').where({ id: nodeId }).first();

        const nodeData = {
            updated_at: now,
            last_seen: now,
            // Use provided data or fallback to existing (if updating) or defaults (schema defaults handle 'Unknown')
            // For updates, we only want to update fields that are present in data (and not null/undefined if possible)
            // But usually agent sends complete data struct.
            location: data.location,
            isp: data.isp,
            cores: data.cores || 0,
            load_1: data.load_1 || 0,
            load_5: data.load_5 || 0,
            load_15: data.load_15 || 0,
            mem_used: data.mem_used || 0,
            mem_total: data.mem_total || 0,
            disk_used: data.disk_used || 0,
            disk_total: data.disk_total || 0,
            cpu_steal: data.cpu_steal || 0,
            net_up: data.net_up || 0,
            net_down: data.net_down || 0,
            // Static info - update if present
            host_name: data.host_name,
            os_distro: data.os_distro,
            kernel_version: data.kernel_version,
            cpu_model: data.cpu_model,
            cpu_cores_detail: data.cpu_cores_detail,
            boot_time: data.boot_time,
            public_ip: data.public_ip
        };

        // Filter out undefined values to avoid overwriting with NULL if partial update (though usually full)
        // Actually, if data.field is missing, it is undefined. Knex ignores undefined in update object? 
        // Yes, Knex ignores undefined properties. So this is safe.
        // But we need to handle "Unknown" defaults if creating new.

        if (existing) {
            await db('nodes').where({ id: nodeId }).update(nodeData);
        } else {
            // For insert, ensure ID is there
            nodeData.id = nodeId;
            nodeData.created_at = now;
            // Defaults are handled by DB schema if undefined, but better to be explicit often.
            // Knex insert: undefined values for columns with defaults will use defaults.
            await db('nodes').insert(nodeData);
        }

        // 2. Insert into History (Throttled 1 min)
        const lastHistory = await db('history')
            .where({ node_id: nodeId })
            .orderBy('timestamp', 'desc')
            .first();

        const lastTime = lastHistory ? new Date(lastHistory.timestamp) : new Date(0);
        const shouldInsertHistory = (now - lastTime) > 60000; // 60s

        if (shouldInsertHistory) {
            const memPercent = data.mem_total > 0 ? (data.mem_used / data.mem_total) * 100 : 0;
            const diskPercent = data.disk_total > 0 ? (data.disk_used / data.disk_total) * 100 : 0;

            await db('history').insert({
                node_id: nodeId,
                timestamp: now,
                load_1: data.load_1 || 0,
                mem_percent: memPercent,
                disk_percent: diskPercent,
                net_in: data.net_down || 0, // Inverted naming in history vs report? report: net_down (IN), net_up (OUT)
                net_out: data.net_up || 0
            });

            // Cleanup old history (random sample to prune)
            if (Math.random() < 0.01) {
                // 30 days retention
                // Using JS Date object ensures compatibility with both SQLite and Postgres
                const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                await db('history').where('timestamp', '<', cutoff).del();
            }
        }

        res.json({ status: 'ok' });

    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET / - Dashboard
app.get('/', async (req, res) => {
    try {
        const nodes = await db('nodes').orderBy('last_seen', 'desc');

        // Process nodes
        const processedNodes = nodes.map(node => {
            const lastSeen = new Date(node.last_seen);
            const now = new Date();
            const diffMs = now - lastSeen;
            const diffMins = diffMs / 1000 / 60;

            const memUsed = Number(node.mem_used);
            const memTotal = Number(node.mem_total);
            const diskUsed = Number(node.disk_used);
            const diskTotal = Number(node.disk_total);

            return {
                ...node,
                status: diffMins < 2 ? 'online' : 'offline',
                memUsedGB: (memUsed / 1073741824).toFixed(2),
                memTotalGB: (memTotal / 1073741824).toFixed(2),
                memPercent: memTotal > 0 ? ((memUsed / memTotal) * 100).toFixed(1) : 0,
                diskUsedGB: (diskUsed / 1073741824).toFixed(2),
                diskTotalGB: (diskTotal / 1073741824).toFixed(2),
                diskPercent: diskTotal > 0 ? ((diskUsed / diskTotal) * 100).toFixed(1) : 0,
                loadPercent: node.cores > 0 ? ((node.load_1 / node.cores) * 100).toFixed(1) : 0,
            };
        });

        // Aggregate stats
        const stats = {
            totalNodes: nodes.length,
            memUsed: formatBytes(nodes.reduce((sum, n) => sum + Number(n.mem_used || 0), 0)),
            memTotal: formatBytes(nodes.reduce((sum, n) => sum + Number(n.mem_total || 0), 0)),
            diskUsed: formatBytes(nodes.reduce((sum, n) => sum + Number(n.disk_used || 0), 0)),
            diskTotal: formatBytes(nodes.reduce((sum, n) => sum + Number(n.disk_total || 0), 0)),
            netUp: nodes.reduce((sum, n) => sum + (n.net_up || 0), 0).toFixed(2),
            netDown: nodes.reduce((sum, n) => sum + (n.net_down || 0), 0).toFixed(2),
        };

        res.render('index', { nodes: processedNodes, stats });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// GET /api/nodes
app.get('/api/nodes', async (req, res) => {
    try {
        const nodes = await db('nodes').orderBy('last_seen', 'desc');
        res.json(nodes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /node/:id - Node Detail Page
app.get('/node/:id', async (req, res) => {
    try {
        const node = await db('nodes').where({ id: req.params.id }).first();
        if (!node) return res.status(404).send('Node not found');

        const lastSeen = new Date(node.last_seen);
        const now = new Date();
        const diffMs = now - lastSeen;
        const diffMins = diffMs / 1000 / 60;

        node.status = diffMins < 2 ? 'online' : 'offline';
        node.memUsedGB = (Number(node.mem_used) / 1073741824).toFixed(2);
        node.memTotalGB = (Number(node.mem_total) / 1073741824).toFixed(2);

        // Format Uptime
        let uptimeStr = "Unknown";
        if (node.boot_time) {
            const bootDate = new Date(Number(node.boot_time) * 1000);
            const uptimeMs = now - bootDate;
            const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            const uptimeHours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            uptimeStr = `${uptimeDays} days, ${uptimeHours} hours`;
        }

        res.render('detail', { node, uptimeStr });

    } catch (err) {
        console.error('Detail Page Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// GET /api/node/:id/history - JSON for charts
app.get('/api/node/:id/history', async (req, res) => {
    try {
        const range = req.query.range || '24h';
        let ms = 24 * 60 * 60 * 1000; // Default 24h

        if (range === '7d') {
            ms = 7 * 24 * 60 * 60 * 1000;
        } else if (range === '30d') {
            ms = 30 * 24 * 60 * 60 * 1000;
        }

        const cutoff = new Date(Date.now() - ms);

        const history = await db('history')
            .select('timestamp', 'load_1', 'mem_percent', 'disk_percent', 'net_in', 'net_out')
            .where('node_id', req.params.id)
            .andWhere('timestamp', '>', cutoff)
            .orderBy('timestamp', 'asc');

        res.json(history);
    } catch (err) {
        console.error('History API Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Kiloa Dashboard running on http://localhost:${PORT}`);
});
