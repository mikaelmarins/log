import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log('Starting debug login check...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    const url = 'https://www.sexlog.com/login';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Dump HTML of login page
        const html = await page.content();
        fs.writeFileSync('debug_login_page.html', html);
        console.log('Login page HTML saved.');

        // Attempt Login
        console.log('Typing credentials...');
        await page.type('input#login', 'juliint44@gmail.com');
        await page.type('input[type="password"]', 'senha@123');

        // Find submit button
        const btn = await page.$('button[type="submit"]');
        if (btn) {
            console.log('Submit button found. Clicking...');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(e => console.log('Nav timeout ignored')),
                btn.click()
            ]);
        } else {
            console.log('Submit button NOT found via button[type="submit"]. Trying generic class...');
            // Try finding by text or class
        }

        console.log('Post-login check...');
        await new Promise(r => setTimeout(r, 5000)); // Wait for any JS redirects

        await page.screenshot({ path: 'debug_login_result.png' });
        console.log('Screenshot saved.');

        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        const content = await page.content();
        if (content.includes('href="/login')) {
            console.log('STILL NOT LOGGED IN (Login link found)');
        } else {
            console.log('LOGIN SUCCESSFUL (Login link not found)');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
