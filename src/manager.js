import { scanForLives } from './scanner.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { startServer } from './server.js';

// Load config
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Track active recordings: Map<username, ChildProcess>
const activeRecordings = new Map();

// Start Dashboard
startServer();

function updateStatus() {
    const status = {
        activeRecordings: Array.from(activeRecordings.keys()).map(username => ({
            username,
            startTime: Date.now() // Ideally track actual start time
        })),
        lastScan: new Date().toISOString()
    };
    fs.writeFileSync('status.json', JSON.stringify(status, null, 2));
}

async function runCycle() {
    try {
        // Reload config to check for changes (e.g. systemEnabled toggle)
        const currentConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

        if (!currentConfig.systemEnabled) {
            console.log('System is disabled. Skipping scan.');
            return;
        }

        console.log(`\n[${new Date().toISOString()}] Starting scan cycle...`);
        console.log(chalk.blue('--- Starting Scan Cycle ---'));
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        updateStatus();

        const candidates = await scanForLives();

        console.log(chalk.cyan(`Found ${candidates.length} candidates.`));

        for (const candidate of candidates) {
            const { username, location, url } = candidate;

            if (activeRecordings.has(username)) {
                console.log(chalk.yellow(`Skipping ${username} (Already recording)`));
                continue;
            }

            if (activeRecordings.size >= (config.concurrentLimit || 5)) {
                console.log(chalk.red('Concurrent limit reached. Skipping remaining candidates.'));
                break;
            }

            startRecording(username, location, url);
        }

        console.log(chalk.blue('--- Cycle Finished ---'));
        updateStatus();
    } catch (e) {
        console.error('Error in runCycle:', e);
    }
}

function startRecording(username, location, url) {
    console.log(chalk.green(`Starting recording for ${username} (${location})`));

    // Spawn the recording process
    const args = [
        'src/index.js',
        '--url', url,
        '--city', location,
        '--username', username,
        '--duration', config.recordingDurationMinutes * 60
    ];

    const child = spawn('node', args, {
        stdio: 'inherit',
        shell: true
    });

    activeRecordings.set(username, child);
    updateStatus();

    child.on('close', (code) => {
        console.log(chalk.magenta(`Recording finished for ${username} (Exit code: ${code})`));
        activeRecordings.delete(username);
        updateStatus();
    });

    child.on('error', (err) => {
        console.error(chalk.red(`Error spawning process for ${username}:`), err);
        activeRecordings.delete(username);
        updateStatus();
    });
}

// Main Loop
const intervalMs = config.scanIntervalMinutes * 60 * 1000;

// Run immediately then schedule
runCycle();
setInterval(runCycle, intervalMs);

console.log(chalk.bold(`Manager started. Scanning every ${config.scanIntervalMinutes} minutes.`));
console.log(chalk.bold(`Target cities: ${config.cities.join(', ')}`));

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log(chalk.red('\n\nStopping manager... Killing active recordings...'));

    for (const [username, child] of activeRecordings) {
        console.log(chalk.yellow(`Killing process for ${username}...`));
        child.kill();
    }

    console.log(chalk.green('All processes terminated. Goodbye.'));
    process.exit(0);
});
