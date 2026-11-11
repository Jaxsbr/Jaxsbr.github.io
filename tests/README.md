
# Arcade launch regression

Serve the site locally, then run this check with an existing Playwright installation:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/arcade-launch.mjs
```

The default site URL is `http://127.0.0.1:5290/`. Set `ARCADE_URL` to another local server or the deployed site. Chrome must be installed; set `BROWSER_CHANNEL` to use another installed Chromium channel.

The check opens actual game tabs with popup blocking enabled. It covers both JesusFilm entries at desktop and mobile widths: the native Play links without JavaScript, and with JavaScript the Play link, the cabinet screen link, and Enter on the Play link. It reports which layout it exercised, the 3D arcade or the cards shown when WebGL is unavailable. It disables CSS animations only in the test so clicks remain stable.

Each game is registered once, as a `.game` article in `index.html`; the cabinet, thumbnail, and screen link are built from it. Update the `v` query parameter on the stylesheet and `src/js/main.js` in both pages when shipping changes so returning visitors receive matching files.

