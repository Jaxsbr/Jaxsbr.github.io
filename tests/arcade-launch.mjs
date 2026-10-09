import assert from 'node:assert/strict';

// Point PLAYWRIGHT_MODULE at an existing Playwright installation; no site dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5290/';
const games = [
    ['little-light-library', 'https://jesusfilm.github.io/little-light-library/'],
    ['shepherd-adventure', 'https://jesusfilm.github.io/story-lab/prototypes/shepherd-adventure/']
];
const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
    ignoreDefaultArgs: ['--disable-popup-blocking']
});

async function launch(page, url, action) {
    const popup = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
    await action();
    const opened = await popup;
    assert.ok(opened, `Play must open a real tab for ${url}`);
    try {
        await opened.waitForURL(url, { waitUntil: 'commit' });
        assert.equal(opened.url(), url);
    } finally {
        await opened.close();
    }
}

try {
    for (const javaScriptEnabled of [false, true]) {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const mobile = viewport.width < 600;
            const context = await browser.newContext({ javaScriptEnabled, viewport, isMobile: mobile, hasTouch: mobile });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            const activate = locator => mobile ? locator.tap() : locator.click();
            await page.route('**/neon-arcade.css*', async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: `${await response.text()}\n*, *::before, *::after { animation: none !important; transition: none !important; }` });
            });
            await page.goto(base, { waitUntil: 'networkidle' });
            if (javaScriptEnabled) {
                const script = await page.locator('script[src*="neon-arcade.js"]').getAttribute('src');
                assert.ok(new URL(script, base).searchParams.get('v'), 'Version the script when game registrations change');
                const links = await page.locator('.arcade-cabinet').evaluateAll(cards => cards.map(card => ({
                    slug: card.dataset.game,
                    href: card.querySelector('.play-button').href
                })));
                const urls = await page.evaluate(() => Object.fromEntries(Object.entries(gameData).map(([slug, game]) => [slug, game.url])));
                for (const { slug, href } of links) assert.equal(href, urls[slug], `${slug} Play link must match its modal URL`);
            }
            for (const [slug, url] of games) {
                const card = page.locator(`[data-game="${slug}"]`);
                await launch(page, url, () => activate(card.locator('.play-button')));
                if (javaScriptEnabled) {
                    await activate(card.locator('.game-title'));
                    await launch(page, url, () => activate(page.locator('#play-link')));
                    await card.locator('.play-button').focus();
                    await launch(page, url, () => page.keyboard.press('Enter'));
                }
            }
            assert.deepEqual(errors, [], 'Arcade must not report script or resource errors');
            console.log(`${viewport.width}px, JavaScript ${javaScriptEnabled ? 'on' : 'off'}: actual game tabs passed`);
            await context.close();
        }
    }
} finally {
    await browser.close();
}
