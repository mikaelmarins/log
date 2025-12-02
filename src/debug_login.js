import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting debug login...');
    // Launch headful to see what happens, user asked for background but for debugging I need to see or take screenshots.
    // I will use headless: "new" and take screenshots.
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
        console.log('Navigation complete.');

        await page.screenshot({ path: 'debug_login_page.png' });
        console.log('Screenshot saved.');

        // Dump form inputs to find selectors
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(el => ({
                id: el.id,
                name: el.name,
                type: el.type,
                placeholder: el.placeholder,
                className: el.className
            }));
        });
        console.log('Inputs found:', inputs);

        // Try to identify login fields
        // Usually 'login' or 'email' and 'password'

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
