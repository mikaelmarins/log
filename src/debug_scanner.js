import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting profile check...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Intercept requests to find m3u8
    let m3u8Found = false;
    await page.setRequestInterception(true);
    page.on('request', request => {
        request.continue();
    });
    page.on('response', response => {
        const url = response.url();
        if (url.includes('.m3u8')) {
            console.log('M3U8 FOUND:', url);
            m3u8Found = true;
        }
    });

    // Try a user from the list
    const username = 'casalexibicioni_3932';
    const url = `https://www.sexlog.com/${username}/livecam`;

    console.log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Navigation complete. Waiting for stream...');

        await new Promise(r => setTimeout(r, 10000));

        if (!m3u8Found) {
            console.log('No m3u8 found. Taking screenshot...');
            await page.screenshot({ path: 'debug_profile.png' });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
