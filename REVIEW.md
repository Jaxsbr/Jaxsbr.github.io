# Landing Page Review — jaxsbr.github.io

> Review date: 2026-04-04
> Context: Phase 3 prep from the online presence rethink plan

---

## Current State Summary

The site is a single-page "Neon Arcade" themed hub built in vanilla HTML/CSS/JS with no build tooling. It was fully rebuilt in Dec 2024 from a startbootstrap SPA into a custom cyberpunk arcade. The PRD shows 68/68 tasks completed across 4 phases — this is a finished v1, not a work in progress.

### What exists today

| Section | Content |
|---|---|
| **Header** | "Welcome to Jacobus' Arcade / Enter the Digital Realm" with CTA buttons |
| **About** | One sentence intro + family photo + blog link (just updated) |
| **Arcade** | 9 game cabinets with filter buttons (Action/Puzzle/Strategy), modal popups, play links |
| **Footer** | Copyright + GitHub link + Blog link |

### Tech stack
- Vanilla JS, CSS custom properties, no framework
- Google Fonts (Orbitron, Rajdhani) for cyberpunk typography
- Extensive CSS animations: neon glow, scan lines, matrix particles, cursor trails, Tron grid
- Web Audio API for optional arcade sounds
- Mobile responsive with hamburger nav
- Keyboard navigation + ARIA labels

### Visual identity
- Black background with cyan/pink/green/purple neon palette
- CRT scan line overlays, pulsing borders, matrix-style falling characters
- Arcade cabinet grid with hover overlays and "PLAY" buttons
- Family photo with neon-border overlay

---

## Strengths (keep these)

1. **Authenticity.** The arcade theme is not a generic template — it reflects someone who genuinely builds games for fun. This is rare and memorable. Don't sanitize it.

2. **Production quality.** The CSS work is serious: custom properties, layered animations, responsive breakpoints, scan-line effects, cursor trails. This isn't amateur hour. The implementation itself demonstrates frontend competence.

3. **Accessibility.** Keyboard navigation, ARIA labels, sound toggle, device compatibility labels on games. This shows engineering care.

4. **Working games.** All 9 arcade cabinets link to live, deployed GitHub Pages projects. Visitors can actually play something. This is more compelling than any skills list.

5. **Personal warmth.** The family photo and "follower of Jesus, father, husband" line immediately signal this is a real person, not a personal brand exercise.

6. **Zero-dependency stack.** No build tools, no framework. The site loads fast and will never have a broken npm dependency.

---

## Problems

### P1: Identity mismatch — reads as "game hobbyist" not "senior engineer"

The page opens with "Welcome to Jacobus' Arcade / Enter the Digital Realm" and the entire content is 9 game demos. A hiring manager or potential client landing here would think: creative hobbyist. They'd have no idea Jaco has built autonomous build systems, MCP-integrated knowledge management tools, or led compound engineering practices.

**The games demonstrate real skill** (custom physics, AI behavior trees, TypeScript frameworks) but the framing buries this. The game descriptions are minimal one-liners that don't surface the engineering decisions behind them.

### P2: No professional context

There is no mention of:
- What Jaco does professionally
- What he's working on currently
- What he's building in the open-source space
- Any engineering writing or blog content
- Any way to engage professionally (LinkedIn, email)

The about section is a single sentence. It introduces the arcade, not the person.

### P3: No narrative arc — static snapshot vs growth story

The 9 games appear as a flat grid. There's no sense of timeline, progression, or direction. A visitor can't tell if these were made last week or 5 years ago. The site doesn't communicate where Jaco started, where he is now, or where he's going.

### P4: Footer is doing the heavy lifting

GitHub and Blog are hidden in a tiny footer. These should be prominent — they're the primary vehicles for professional credibility.

### P5: Dead weight in the repo

- `index.html.backup` — the old startbootstrap version, still in the repo
- `css/freelancer.css`, `js/freelancer.js`, `vendor/` (bootstrap, jQuery, magnific-popup) — all from the old site, not referenced by the current neon-arcade version
- `img/` contains assets from the old site not used by current (isometric.png, animatedBackgrounds.PNG, etc.)
- `NEON_ARCADE_PRD.md` and `TASK_LIST.md` — internal build artifacts, not relevant to visitors

### P6: Missing meta / SEO basics

- Copyright says "2024" — should be current year or removed
- No structured data (JSON-LD)
- No canonical URL
- Open Graph description says "cyberpunk arcade environment" — doesn't help with professional discoverability
- No favicon that represents the current theme (using generic favicon.ico)

---

## Suggested Alterations

### Tier 1: Reframe without rebuilding (change content, keep architecture)

These changes work within the existing HTML/CSS/JS structure. No new sections needed — just content rewrites and reordering.

**1. Rewrite the header and intro**

Current: "Welcome to Jacobus' Arcade / Enter the Digital Realm"

Suggested approach: Lead with a professional identity statement, then invite into the arcade. Something like:

> I'm Jacobus — a senior product engineer who builds systems that make engineering teams dramatically more effective. I'm also a follower of Jesus, father, husband, and creative maker who builds games and software for fun.
>
> This is my arcade. The games below represent years of learning through building — from custom physics engines to AI behavior trees. For my current engineering work, read the blog or check GitHub.

The two CTA buttons could become: "Enter Arcade" (stays) + "Read Blog" (replaces "Learn More").

**2. Reorder the page: About first, then Arcade**

Currently: Header → About → Arcade → Footer

The About section is an afterthought positioned between the header and the real content. Flip the emphasis:

Header → **Who I Am + What I'm Building** → Arcade → Footer

This way the professional context comes before the games. The arcade becomes "and here's what I do for fun" rather than the entire story.

**3. Expand the About section into three blocks**

Currently it's one sentence + a photo. Expand to:

- **What I'm Building Now** — 3-4 cards linking to current projects (mustard, flow-mo, build-loop blog post, math-practice). Each card: project name, one-line description, link to repo or live demo. Style these in the existing neon-card aesthetic.
- **What Drives Me** — A short paragraph on faith and stewardship. Not testimony. Something like: "My work is grounded in a conviction that building well is an act of stewardship. I follow Jesus, and that shapes how I approach craft, people, and purpose." Optionally link 1-2 curated resources.
- **Family photo** — keep as-is, it's good.

**4. Add a "Growth Timeline" to the arcade section**

Instead of a flat grid, add a subtle timeline marker above or within the game cabinets. Group them loosely: "Early experiments" (2018-2020 era), "Getting serious" (2021-2023), "Current" (2024+). This turns the arcade from "9 random games" into "a story of someone who's been building and learning for years."

This can be done with simple date labels or subtle horizontal dividers — no major redesign needed.

**5. Promote navigation links**

Move GitHub, Blog, and LinkedIn from the footer into the main nav. The nav currently has: Arcade | About | Blog. Change to: About | Projects | Arcade | Blog | GitHub.

Add a LinkedIn link to the footer social links (an icon already exists in `img/if_linkedin_386655.ico`).

### Tier 2: Clean up the repo

**6. Remove old site artifacts**

Delete files not used by the current neon-arcade site:
- `index.html.backup`
- `css/freelancer.css`
- `js/freelancer.js`, `js/freelancer.min.js`
- `vendor/` directory (bootstrap, jQuery, magnific-popup)
- Unused images in `img/` (audit which are actually referenced)

This cuts the repo from 34MB to probably under 5MB.

**7. Move internal docs out of the repo root**

`NEON_ARCADE_PRD.md` and `TASK_LIST.md` are build artifacts. Move them to a `docs/` folder or delete them — they don't serve visitors and clutter the GitHub repo view.

### Tier 3: Polish (do after content is right)

**8. Update meta tags**

- OG title: "Jacobus Brink — Engineer, Maker, Builder"
- OG description: Something that surfaces engineering identity, not just "cyberpunk arcade"
- Update copyright year or remove it
- Add a `rel="me"` link to GitHub and LinkedIn for identity verification

**9. Consider a "Latest Blog Post" embed**

A small section below the About area that shows the title + date of the most recent blog post. This signals the site is alive and maintained. Can be done with a simple fetch to the Blog's public posts directory or a static update.

---

## What NOT to change

- **Don't drop the arcade theme.** It's distinctive and authentic. Plenty of devs have boring landing pages. This one is memorable.
- **Don't add a framework.** The vanilla stack is a feature, not a limitation. It loads fast, deploys easily, and will never break.
- **Don't remove the games.** They demonstrate real coding ability. Just reframe them as part of a larger story.
- **Don't over-polish the faith section.** A few authentic sentences are more powerful than a dedicated page. Let it breathe.
- **Don't add analytics yet.** Write good content first, optimize later.

---

## Recommended build order

1. Rewrite header + about section content (Tier 1, items 1-3)
2. Clean up old files (Tier 2, items 6-7)
3. Add project cards for current work (Tier 1, item 3 — depends on blog being live and mustard being presentable)
4. Add growth timeline to arcade (Tier 1, item 4)
5. Update nav and meta (Tier 1 item 5, Tier 3 item 8)
6. Latest blog post embed (Tier 3, item 9 — nice-to-have)

Items 1-2 can happen now. Items 3-6 depend on Phase 1 (blog) and Phase 2 (mustard) from the broader plan being complete.
