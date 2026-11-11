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
            await page.route('**/hyperdrive.css*', async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: `${await response.text()}\n*, *::before, *::after { animation: none !important; transition: none !important; }` });
            });
            await page.goto(base, { waitUntil: 'networkidle' });

            const links = await page.locator('.game').evaluateAll(cards => cards.map(card => {
                const play = card.querySelector('.game__play');
                return { slug: card.dataset.game, href: play.getAttribute('href'), target: play.target };
            }));
            assert.ok(links.length > 0, 'The arcade must list its games in the HTML');
            for (const { slug, href, target } of links) {
                assert.match(href, /^https:\/\//, `${slug} needs a native Play link`);
                assert.equal(target, '_blank', `${slug} must open in a new tab`);
            }

            // With scripts the page settles into the 3D arcade, or back into cards when WebGL is unavailable.
            let live = false;
            if (javaScriptEnabled) {
                const script = await page.locator('script[src*="main.js"]').getAttribute('src');
                assert.ok(new URL(script, base).searchParams.get('v'), 'Version the script so returning visitors receive matching modules');
                await page.waitForFunction(() => {
                    const state = document.documentElement.classList;
                    return state.contains('is-3d') || !state.contains('can-3d');
                });
                live = await page.evaluate(() => document.documentElement.classList.contains('is-3d'));
            }
            // Playwright scrolls targets into view; park at the arcade again before each 3D interaction.
            const dock = async () => {
                if (!live) return;
                await page.evaluate(() => window.scrollTo({ top: document.getElementById('arcade').offsetTop, behavior: 'instant' }));
                await page.locator('.arcade__screen').waitFor({ state: 'visible' });
            };

            for (const [slug, url] of games) {
                const card = page.locator(`.game[data-game="${slug}"]`);
                await dock();
                if (live) {
                    await activate(page.locator(`#tab-${slug}`));
                    await page.locator(`.game.is-active[data-game="${slug}"]`).waitFor();
                }
                await launch(page, url, () => activate(card.locator('.game__play')));
                if (live) {
                    await dock();
                    const screen = page.locator(`.arcade__screen[href="${url}"]`);
                    await screen.waitFor({ state: 'visible' });
                    await launch(page, url, () => activate(screen));
                }
                if (javaScriptEnabled) {
                    await dock();
                    await card.locator('.game__play').focus();
                    await launch(page, url, () => page.keyboard.press('Enter'));
                }
            }
            assert.deepEqual(errors, [], 'Arcade must not report script or resource errors');
            const mode = !javaScriptEnabled ? 'JavaScript off' : live ? '3D arcade' : 'cards';
            console.log(`${viewport.width}px, ${mode}: actual game tabs passed`);
            await context.close();
        }
    }
} finally {
    await browser.close();
}

