import puppeteer from 'puppeteer';
import fs from 'fs';

export async function scanForLives() {

    console.log('Starting scan...');
    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-zygote'
        ]
    });

    try {
        const page = await browser.newPage();
        // Capture browser logs
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        // Load cookies if they exist
        if (fs.existsSync('cookies.json')) {
            try {
                const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
                await page.setCookie(...cookies);
                console.log(`Loaded ${cookies.length} cookies.`);
            } catch (e) {
                console.error('Failed to load cookies:', e.message);
            }
        }

        // Login Logic
        try {
            console.log('Checking login status...');
            await page.goto('https://www.sexlog.com/login', { waitUntil: 'domcontentloaded' });

            await new Promise(r => setTimeout(r, 2000));

            let isLoginPage = await page.$('input#login');

            if (!isLoginPage) {
                const content = await page.content();
                if (content.includes('href="/login')) {
                    const loginLink = await page.$('a[href*="/login"]');
                    if (loginLink) {
                        console.log('Login form not found, but Login link exists. Clicking it...');
                        await loginLink.click();
                        await new Promise(r => setTimeout(r, 2000));
                        isLoginPage = await page.$('input#login');
                    }
                }
            }

            if (isLoginPage) {
                console.log('Logging in...');
                await page.type('input#login', 'juliint44@gmail.com');
                await page.type('input[type="password"]', 'senha@123');

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                    page.click('button[type="submit"]')
                ]);
                console.log('Login submitted.');

                await new Promise(r => setTimeout(r, 5000));

                const content = await page.content();
                const isLoggedIn = !content.includes('href="/login') && !content.includes('href="/cadastro');

                if (!isLoggedIn) {
                    console.error('LOGIN FAILED: Login/Register links still detected.');
                } else {
                    console.log('LOGIN SUCCESSFUL.');
                    const cookies = await page.cookies();
                    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
                    console.log('Cookies saved.');
                }
            } else {
                console.log('Already logged in (no login form found).');
            }
        } catch (e) {
            console.error('Login failed or skipped:', e.message);
        }

        const categories = ['mulheres', 'casais'];
        let allMatches = [];

        for (const category of categories) {
            const url = `https://www.sexlog.com/livecam/${category}`;
            console.log(`Scanning category: ${category} at ${url}...`);

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                await page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 100;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight || totalHeight > 5000) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100);
                    });
                });

                await new Promise(r => setTimeout(r, 5000));

                try {
                    const clearFiltersBtn = await page.$('button[aria-label="Limpar todos os filtros"]');
                    if (clearFiltersBtn) {
                        await clearFiltersBtn.click();
                        await new Promise(r => setTimeout(r, 3000));
                    }
                } catch (e) { }

                const { items, debugInfo } = await page.evaluate(() => {
                    const items = [];

                    // 1. Scrape Live Cards
                    const liveCards = document.querySelectorAll('button[data-testid="livecam-list__live-card"]');
                    liveCards.forEach(card => {
                        try {
                            const usernameEl = card.querySelector('[data-testid="livecam-list__live-card-login"]');
                            const locationEl = card.querySelector('[data-testid="livecam-list__live-card-location"]');
                            const genderEl = card.querySelector('[data-testid="livecam-list__live-card-gender"]');

                            if (usernameEl) {
                                const username = usernameEl.innerText.trim();
                                const location = locationEl ? locationEl.innerText.trim() : "Desconhecido";
                                const gender = genderEl ? genderEl.innerText.trim() : "";
                                const combinedInfo = `${location} ${gender}`;

                                items.push({
                                    username,
                                    location: combinedInfo,
                                    url: `https://www.sexlog.com/${username}/livecam`,
                                    isVideoCard: false
                                });
                            }
                        } catch (e) { }
                    });

                    // 2. Scrape Video Links (Fallback)
                    const links = document.querySelectorAll('a[href*="/videos/"]');
                    links.forEach(el => {
                        const href = el.href;
                        if (!href) return;

                        let username = null;
                        try {
                            const urlObj = new URL(href);
                            const path = urlObj.pathname;
                            const parts = path.split('/');
                            if (parts.length >= 3) {
                                username = parts[2];
                            }
                        } catch (e) { }

                        if (username && !items.some(i => i.username === username)) {
                            const cardText = el.innerText || el.textContent || "";
                            const cleanText = cardText.replace(/\n/g, ' ').trim();

                            items.push({
                                username,
                                location: cleanText,
                                url: `https://www.sexlog.com/${username}/livecam`,
                                isVideoCard: true
                            });
                        }
                    });

                    const debugInfo = {
                        title: document.title,
                        bodyLength: document.body.innerHTML.length,
                        liveCardCount: liveCards.length,
                        videoLinkCount: links.length,
                        sampleUsername: items.length > 0 ? items[0].username : 'NONE'
                    };

                    return { items, debugInfo };
                });

                console.log(`DEBUG INFO for ${category}:`, JSON.stringify(debugInfo, null, 2));
                console.log(`Found ${items.length} items in ${category}.`);
                allMatches = allMatches.concat(items);

            } catch (error) {
                console.error(`Error scanning ${category}:`, error.message);
            }
        }

        const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.username, item])).values());
        console.log(`Total unique potential lives found: ${uniqueMatches.length}`);

        // Load config inside function to support hot-reloading
        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        const targetCities = (config.cities || []).map(c => c.toLowerCase());
        const targetUsers = (config.targetUsers || []).map(u => u.toLowerCase());

        const matches = uniqueMatches.filter(live => {
            try {
                const username = live.username.toLowerCase();
                const info = (live.location || "").toLowerCase();
                let isMatch = false;

                // 1. Check Target Users (Priority)
                if (targetUsers.includes(username)) {
                    console.log(`[MATCH] ${live.username} is a TARGET USER.`);
                    // Ensure location is set if missing
                    if (!live.location || live.location === "Desconhecido") {
                        live.location = "TargetUsers";
                    }
                    return true;
                }

                // 2. Gender Filter
                const isMulher = info.includes('mulher') || info.includes('menina') || info.includes('garota');
                const isCasal = info.includes('casal') || info.includes('ele/ela');

                if (info.includes('homem') || info.includes('travesti') || info.includes('transexual')) {
                    return false;
                }

                // 3. City Filter
                const cityMatch = targetCities.some(city => info.includes(city));

                if (cityMatch) {
                    isMatch = true;
                } else {
                    if (live.isVideoCard || info.length < 10) {
                        isMatch = true;
                        if (!live.location) live.location = "Desconhecido";
                    }
                }

                if (isMatch) {
                    if (!live.location || live.location.length > 50) live.location = "Desconhecido";
                    if (cityMatch) {
                        const matchedCity = config.cities.find(c => info.includes(c.toLowerCase()));
                        if (matchedCity) live.location = matchedCity;
                    }

                    console.log(`[MATCH] ${live.username} - Loc: ${live.location}`);
                }
                return isMatch;
            } catch (e) {
                console.error(`Error filtering item ${live.username}:`, e.message);
                return false;
            }
        });

        console.log(`Returning ${matches.length} qualified lives.`);
        return matches;

    } catch (e) {
        console.error('Fatal error in scanForLives:', e);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}
