import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log('Starting debug live cards (v2)...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Login Logic
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
            console.log('Login submitted.');
        }

        // Verify Login
        await new Promise(r => setTimeout(r, 3000));
        const content = await page.content();
        if (content.includes('href="/login')) {
            console.log('LOGIN FAILED: Login link still present.');
            // Try to dump html to see why
            fs.writeFileSync('debug_login_fail.html', content);
        } else {
            console.log('LOGIN SUCCESSFUL.');
        }

    } catch (e) {
        console.error('Login error:', e.message);
    }

    // Go to the page shown in screenshot
    const url = 'https://www.sexlog.com/livecam/mulheres';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Scroll a bit
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 5000)); // Wait longer for cards

        // Dump HTML
        const html = await page.content();
        fs.writeFileSync('debug_lives_v2.html', html);
        console.log('HTML saved to debug_lives_v2.html');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
