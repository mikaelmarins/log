import puppeteer from 'puppeteer';
import fs from 'fs';

export async function detectStream(url, updateStatus) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Load cookies if available
    if (fs.existsSync('cookies.json')) {
        try {
            const cookiesString = fs.readFileSync('cookies.json', 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log('Cookies loaded in detector.');
        } catch (e) {
            console.error('Failed to load cookies:', e.message);
        }
    }

    // Store found stream info
    let streamInfo = null;

    // Enable request interception
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue();
    });

    // Listen for responses to find the m3u8
    page.on('response', async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('.m3u8')) {
            if (!streamInfo) {
                streamInfo = {
                    m3u8Url: responseUrl,
                    headers: response.request().headers(),
                    userAgent: await page.browser().userAgent(),
                    referer: page.url(),
                    cookies: [
                        ...(await page.cookies()),
                        ...(await page.cookies(responseUrl))
                    ]
                };
            }
        }
    });

    updateStatus('Loading page...');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Check if we were redirected to a video page (VOD)
        if (page.url().includes('/videos/')) {
            console.log('Redirected to video page (VOD). Aborting.');
            await browser.close();
            return null;
        }

    } catch (e) {
        // Sometimes networkidle2 times out on streaming sites, which is expected.
        // We continue if we found the stream.
    }

    // Wait a bit more if stream hasn't been found yet
    if (!streamInfo) {
        updateStatus('Waiting for stream to start...');
        const start = Date.now();
        while (!streamInfo && Date.now() - start < 15000) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    await browser.close();
    return streamInfo;
}
