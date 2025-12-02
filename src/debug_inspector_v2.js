import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log('Starting debug inspector v2...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Login
    try {
        console.log('Logging in...');
        await page.goto('https://www.sexlog.com/login', { waitUntil: 'domcontentloaded' });
        await page.type('input#login', 'juliint44@gmail.com');
        await page.type('input[type="password"]', 'senha@123');
        const btn = await page.$('button[type="submit"]');
        if (btn) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                btn.click()
            ]);
        }
        console.log('Login submitted.');
    } catch (e) {
        console.error('Login error:', e);
    }

    const url = 'https://www.sexlog.com/livecam/mulheres';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll
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

    // Dump HTML
    const html = await page.content();
    fs.writeFileSync('debug_full_page.html', html);
    console.log('Saved debug_full_page.html');

    await browser.close();
})();
