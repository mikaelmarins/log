import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Mock status for now, ideally this should be shared with manager.js
// We might need to run manager.js INSIDE server.js or communicate via file/db
// For simplicity, let's have manager.js write a status.json file periodically?
// OR, we export the app and run it from manager.js.

// Let's assume manager.js writes to 'status.json' for now as a simple IPC
const STATUS_FILE = 'status.json';

app.get('/api/status', (req, res) => {
    if (fs.existsSync(STATUS_FILE)) {
        res.json(JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')));
    } else {
        res.json({ activeRecordings: [], lastScan: null });
    }
});

app.get('/api/config', (req, res) => {
    if (fs.existsSync('config.json')) {
        res.json(JSON.parse(fs.readFileSync('config.json', 'utf-8')));
    } else {
        res.json({});
    }
});

app.post('/api/config', (req, res) => {
    try {
        fs.writeFileSync('config.json', JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/target-users', (req, res) => {
    try {
        const { username, action } = req.body;
        if (!fs.existsSync('config.json')) return res.status(404).json({ error: 'Config not found' });

        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        if (!config.targetUsers) config.targetUsers = [];

        if (action === 'add') {
            if (!config.targetUsers.includes(username)) config.targetUsers.push(username);
        } else if (action === 'remove') {
            config.targetUsers = config.targetUsers.filter(u => u !== username);
        }

        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        res.json({ success: true, targetUsers: config.targetUsers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/cities', (req, res) => {
    try {
        const { city, action } = req.body;
        if (!fs.existsSync('config.json')) return res.status(404).json({ error: 'Config not found' });

        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        if (!config.cities) config.cities = [];

        if (action === 'add') {
            if (!config.cities.includes(city)) config.cities.push(city);
        } else if (action === 'remove') {
            config.cities = config.cities.filter(c => c !== city);
        }

        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        res.json({ success: true, cities: config.cities });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/toggle-system', (req, res) => {
    try {
        const { enabled } = req.body;
        if (!fs.existsSync('config.json')) return res.status(404).json({ error: 'Config not found' });

        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        config.systemEnabled = enabled;

        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        res.json({ success: true, systemEnabled: config.systemEnabled });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/recordings', (req, res) => {
    const downloadsDir = path.join(__dirname, '../downloads');
    if (!fs.existsSync(downloadsDir)) {
        return res.json([]);
    }

    const files = [];
    // Recursive function to find files
    function scanDir(dir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                scanDir(fullPath);
            } else {
                if (item.endsWith('.mkv') || item.endsWith('.mp4')) {
                    files.push({
                        name: item,
                        path: path.relative(downloadsDir, fullPath),
                        size: fs.statSync(fullPath).size,
                        date: fs.statSync(fullPath).mtime
                    });
                }
            }
        });
    }

    try {
        scanDir(downloadsDir);
        // Sort by date desc
        files.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch (e) {
        res.json([]);
    }
});

export function startServer() {
    app.listen(port, () => {
        console.log(`Dashboard running at http://localhost:${port}`);
    });
}
