# Arcade launch regression

Serve the site locally, then run this check with an existing Playwright installation:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/arcade-launch.mjs
```

The default site URL is `http://127.0.0.1:5290/`. Set `ARCADE_URL` to another local server or the deployed site. Chrome must be installed; set `BROWSER_CHANNEL` to use another installed Chromium channel.

The check opens actual game tabs with popup blocking enabled. It covers both JesusFilm entries at desktop and mobile widths, direct links without JavaScript, modal links, and Enter on the Play links. It disables visual animations only in the test so clicks remain stable.

Keep each card's native Play URL in sync with `gameData`. Update the script's `v` query parameter in `index.html` when game registrations change so returning visitors receive the matching script.
