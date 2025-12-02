import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    console.log('Starting debug live inspector...');
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

    try {
        console.log('Waiting for "Fortaleza" or "Salvador"...');

        // Wait for text to appear in the body
        await page.waitForFunction(() => {
            const text = document.body.innerText;
            return text.includes('Fortaleza') || text.includes('Salvador');
        }, { timeout: 30000 });

        console.log('Found city text! Inspecting elements...');

        const cardInfo = await page.evaluate(() => {
            // Helper to find element by text
            function getElementByText(text) {
                const xpath = `//*[contains(text(),'${text}')]`;
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                return result.singleNodeValue;
            }

            const el = getElementByText('Fortaleza') || getElementByText('Salvador');
            if (!el) return 'Element not found via XPath';

            // Traverse up to find the card (assuming it's a few levels up)
            let parent = el.parentElement;
            let cardHtml = '';
            let classes = [];

            // Go up 5 levels to capture the card structure
            for (let i = 0; i < 5; i++) {
                if (parent) {
                    classes.push(parent.className);
                    cardHtml = parent.outerHTML;
                    parent = parent.parentElement;
                }
            }

            return {
                text: el.innerText,
                tagName: el.tagName,
                className: el.className,
                parentClasses: classes,
                cardHtml: cardHtml // This might be large, but useful
            };
        });

        console.log('Card Info:', JSON.stringify(cardInfo, null, 2));
        fs.writeFileSync('debug_card_structure.html', cardInfo.cardHtml || 'No HTML');

    } catch (e) {
        console.error('Error finding city:', e.message);
        // Dump body text to see what IS there
        const text = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('debug_inspector_fail.txt', text);
    } finally {
        await browser.close();
    }
})();
