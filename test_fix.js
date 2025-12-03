import puppeteer from 'puppeteer';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth'; // Skip stealth for simple test
import { downloadStream } from './src/downloader.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// puppeteer.use(StealthPlugin());

async function getLiveStream() {
    console.log('Searching for a live stream to test...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.sexlog.com/livecam/casais', { waitUntil: 'networkidle2' });

        // Scroll to load items
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 2000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract first live link using robust selectors
        const liveLink = await page.evaluate(() => {
            // Try to find a live card first
            const card = document.querySelector('button[data-testid="livecam-list__live-card"]');
            if (card) {
                const usernameEl = card.querySelector('[data-testid="livecam-list__live-card-login"]');
                if (usernameEl) {
                    return `https://www.sexlog.com/${usernameEl.innerText.trim()}/livecam`;
                }
            }
            // Fallback to any livecam link
            const link = document.querySelector('a[href*="/livecam"]');
            return link ? link.href : null;
        });

        if (!liveLink) {
            throw new Error('No live stream found for testing.');
        }

        console.log(`Found live channel: ${liveLink}`);
        await page.goto(liveLink, { waitUntil: 'domcontentloaded' });

        // Wait for m3u8
        const m3u8Url = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(null), 15000);
            page.on('response', res => {
                if (res.url().includes('.m3u8')) {
                    clearTimeout(timeout);
                    resolve(res.url());
                }
            });
        });

        if (!m3u8Url) throw new Error('Could not detect m3u8.');

        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        return { m3u8Url, headers: { 'Cookie': cookieString, 'Referer': liveLink, 'User-Agent': await browser.userAgent() } };

    } finally {
        await browser.close();
    }
}

async function validateRecording(filePath) {
    return new Promise((resolve) => {
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
        exec(cmd, (err, stdout) => {
            if (err) {
                console.error('Validation failed:', err);
                resolve(false);
            } else {
                const duration = parseFloat(stdout.trim());
                console.log(`Recorded Duration: ${duration}s`);
                if (duration > 5 && duration < 30) {
                    console.log('VALIDATION SUCCESS: Duration is within expected range.');
                    resolve(true);
                } else {
                    console.error('VALIDATION FAILED: Duration mismatch.');
                    resolve(false);
                }
            }
        });
    });
}

(async () => {
    try {
        const streamInfo = await getLiveStream();
        console.log(`Testing recording on: ${streamInfo.m3u8Url}`);

        // Set short duration for test
        streamInfo.duration = 15;
        const outputPath = path.resolve('test_video.ts');

        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        await downloadStream(streamInfo, outputPath);

        console.log('Recording finished. Validating...');
        const isValid = await validateRecording(outputPath);

        if (isValid) {
            console.log('TEST PASSED: System is ready.');
            process.exit(0);
        } else {
            console.error('TEST FAILED.');
            process.exit(1);
        }

    } catch (e) {
        console.error('Test Error:', e);
        process.exit(1);
    }
})();
