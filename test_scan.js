import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadsDir = path.join(__dirname, 'downloads');
console.log('Scanning directory:', downloadsDir);

if (!fs.existsSync(downloadsDir)) {
    console.log('Downloads directory does not exist.');
    process.exit(1);
}

const usersMap = new Map();

function scanDir(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else {
            if (item.endsWith('.mkv') || item.endsWith('.mp4')) {
                const parentDir = path.basename(path.dirname(fullPath));
                const filename = item;

                let username = 'Unknown';
                if (parentDir !== 'downloads') {
                    username = parentDir;
                } else if (filename.includes('-')) {
                    username = filename.split('-')[0];
                }

                const stats = fs.statSync(fullPath);
                const fileData = {
                    name: item,
                    path: path.relative(downloadsDir, fullPath).replace(/\\/g, '/'),
                    size: stats.size,
                    date: stats.mtime
                };

                if (!usersMap.has(username)) {
                    usersMap.set(username, {
                        username,
                        files: [],
                        totalSize: 0,
                        lastRecording: new Date(0)
                    });
                }

                const user = usersMap.get(username);
                user.files.push(fileData);
                user.totalSize += stats.size;
                if (stats.mtime > user.lastRecording) {
                    user.lastRecording = stats.mtime;
                }
            }
        }
    });
}

scanDir(downloadsDir);

const usersArray = Array.from(usersMap.values()).sort((a, b) => b.lastRecording - a.lastRecording);
console.log(JSON.stringify(usersArray, null, 2));
