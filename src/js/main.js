/**
 * Page behaviour for jaxsbr.github.io.
 *
 * The pages are complete as plain HTML and CSS. This module adds the WebGL world,
 * the 3D arcade controls, pointer tilt, and optional sound. Game data lives only in
 * the HTML: each .game article is the source for its cabinet, tab, and Play link.
 */

const root = document.documentElement;
const page = document.body.dataset.page || 'home';
const version = new URL(import.meta.url).search;

window.__jbBooted = true;

// Scroll ranges of the two transitions: the title flying past (in viewport heights)
// and the arcade arriving (as flight progress, matching world/index.js).
const HERO_RUN = 0.62;
const ARRIVE_FROM = 0.84;
const ARRIVE_TO = 0.985;
const MAGNET = 48;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

const nav = document.getElementById('nav');
const heroPin = document.querySelector('.hero__pin');
const heroTitle = document.querySelector('.hero__title');
const photo = document.querySelector('.about__photo');
const arcadeSection = document.getElementById('arcade');
const arcadeLink = document.querySelector('.nav__link[href="#arcade"]');

document.getElementById('current-year').textContent = String(new Date().getFullYear());

const sound = createSound(document.getElementById('sound-toggle'));
const arcade = arcadeSection ? createArcade(arcadeSection) : null;
let world = null;
let docked = false;
let arcadeTop = 0;

/* ---------- Pointer ---------- */

const pointer = { x: 0, y: 0 };
const tilt = { x: 0, y: 0 };

window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer.x = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
    pointer.y = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
}, { passive: true });

document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const target = event.target.closest?.('.btn, .nav__link, .rack__item, .arcade__arrow, .game__play, .sound');
    if (target && !target.contains(event.relatedTarget)) sound.play('hover');
});

/* ---------- Guided flight for in-page links ---------- */

let flight = 0;

function cancelFlight() {
    cancelAnimationFrame(flight);
    flight = 0;
}

function flyTo(top, duration, done) {
    cancelFlight();
    const from = window.scrollY;
    const distance = top - from;
    const start = performance.now();
    const step = now => {
        const t = clamp((now - start) / duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        window.scrollTo({ top: from + distance * eased, behavior: 'instant' });
        if (t < 1) {
            flight = requestAnimationFrame(step);
            return;
        }
        flight = 0;
        if (done) done();
    };
    flight = requestAnimationFrame(step);
}

for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    window.addEventListener(type, cancelFlight, { passive: true });
}

// When scrolling comes to rest inside a transition, finish it, so the title and the
// arcade are never left half faded. Within MAGNET pixels of either end the page
// returns there, which absorbs stray nudges; further in, it follows the direction
// of travel. The middle of the flight is free to stop anywhere.
let settleTimer = 0;
let lastScrollY = window.scrollY;
let direction = 0;
let touching = false;

function settle() {
    if (flight || touching || page !== 'home' || !arcadeSection || !root.classList.contains('can-3d')) return;
    const top = arcadeSection.offsetTop;
    const y = window.scrollY;
    if (y <= 0 || y >= top - 1) return;
    const heroEnd = Math.min(window.innerHeight * HERO_RUN, top * 0.4);
    let target = -1;
    if (y <= MAGNET) target = 0;
    else if (y >= top - MAGNET) target = top;
    else if (y < heroEnd - 1) target = direction < 0 ? 0 : heroEnd;
    else if (direction > 0 && y >= top * (ARRIVE_FROM - 0.06)) target = top;
    else if (direction < 0 && y > top * ARRIVE_FROM) target = top * (ARRIVE_FROM - 0.02);
    if (target >= 0) flyTo(target, 380 + (Math.abs(target - y) / window.innerHeight) * 900);
}

function queueSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 170);
}

window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!flight && y !== lastScrollY) direction = Math.sign(y - lastScrollY);
    lastScrollY = y;
    queueSettle();
}, { passive: true });

window.addEventListener('touchstart', () => { touching = true; }, { passive: true });
for (const type of ['touchend', 'touchcancel']) {
    window.addEventListener(type, event => {
        touching = event.touches.length > 0;
        queueSettle();
    }, { passive: true });
}

document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || !root.classList.contains('can-3d')) return;
    const id = link.getAttribute('href').slice(1);
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const top = id === 'top' ? 0 : target.offsetTop;
    const screens = Math.abs(top - window.scrollY) / window.innerHeight;
    flyTo(top, 900 + Math.min(screens, 2.4) * 800, () => {
        if (id === 'top') return;
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
    });
});

document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!arcade || !arcade.isLive() || progress() < 0.9) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    arcade.step(event.key === 'ArrowRight' ? 1 : -1);
});

// Keyboard focus that lands inside the arcade brings the whole stage into view.
if (arcadeSection) {
    arcadeSection.addEventListener('focusin', event => {
        if (flight || !root.classList.contains('can-3d') || !event.target.matches(':focus-visible')) return;
        const top = arcadeSection.offsetTop;
        if (window.scrollY < top - 2) flyTo(top, 700);
    });
}

/* ---------- Scroll state ---------- */

function progress() {
    if (page === 'home' && arcadeSection) {
        arcadeTop = arcadeSection.offsetTop;
        return arcadeTop > 0 ? clamp(window.scrollY / arcadeTop) : 1;
    }
    const range = root.scrollHeight - window.innerHeight;
    return range > 0 ? clamp(window.scrollY / range) : 0;
}

// Resizing moves the point where the arcade starts; stay parked there if we were.
window.addEventListener('resize', () => {
    if (!docked || !arcadeSection) return;
    const top = arcadeSection.offsetTop;
    if (Math.abs(top - arcadeTop) > 1) window.scrollTo({ top, behavior: 'instant' });
});

let lastFly = -1;
let lastTiltX = 2;
let lastTiltY = 2;
let lastTime = performance.now();

function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const ease = 1 - Math.exp(-dt * 6);
    tilt.x += (pointer.x - tilt.x) * ease;
    tilt.y += (pointer.y - tilt.y) * ease;
    if (Math.abs(tilt.x - lastTiltX) > 0.002 || Math.abs(tilt.y - lastTiltY) > 0.002) {
        lastTiltX = tilt.x;
        lastTiltY = tilt.y;
        for (const element of [heroTitle, photo]) {
            if (!element) continue;
            element.style.setProperty('--tilt-x', tilt.x.toFixed(3));
            element.style.setProperty('--tilt-y', tilt.y.toFixed(3));
        }
    }

    const scrollY = window.scrollY;
    nav.classList.toggle('is-stuck', scrollY > 24);

    const immersive = root.classList.contains('can-3d');
    if (heroPin) {
        const fly = immersive ? clamp(scrollY / (window.innerHeight * HERO_RUN)) : 0;
        if (Math.abs(fly - lastFly) > 0.001) {
            lastFly = fly;
            heroPin.style.setProperty('--fly', fly.toFixed(3));
            const gone = fly > 0.78;
            heroPin.classList.toggle('is-gone', gone);
            heroPin.inert = gone;
        }
    }

    const u = progress();
    docked = immersive && page === 'home' && u > ARRIVE_TO;
    if (arcadeLink) {
        if (u > 0.9) arcadeLink.setAttribute('aria-current', 'location');
        else arcadeLink.removeAttribute('aria-current');
    }

    if (world) {
        world.setProgress(u);
        world.setPointer(tilt.x, tilt.y);
        if (arcade) world.setStage(arcade.stageRect());
        const state = world.tick(now);
        if (arcade) arcade.sync(state);
    }
}

requestAnimationFrame(frame);

/* ---------- WebGL world ---------- */

function flatten() {
    root.classList.remove('can-3d', 'is-3d');
    if (arcade) arcade.flatten();
    if (world) world.dispose();
    world = null;
}

async function boot() {
    if (!root.classList.contains('can-3d')) return;
    try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) throw new Error('WebGL2 is unavailable');
        probe.getExtension('WEBGL_lose_context')?.loseContext();

        if (arcade) arcade.build();
        const { createWorld } = await import(`./world/index.js${version}`);
        world = await createWorld({
            canvas: document.getElementById('world'),
            mode: page,
            games: arcade ? arcade.games : [],
            lowPower: window.matchMedia('(pointer: coarse)').matches || navigator.deviceMemory <= 4,
            progress: progress(),
            onLost: flatten,
        });
        if (arcade) arcade.attach(world);
        root.classList.add('is-3d');
    } catch (error) {
        console.warn('The 3D world is unavailable; showing the flat layout.', error);
        flatten();
    }
}

boot();

/* ---------- Arcade ---------- */

function createArcade(section) {
    const list = section.querySelector('.arcade__games');
    const games = Array.from(list.querySelectorAll('.game'), (el, index) => {
        const art = el.querySelector('.game__art');
        const [px = 50, py = 50] = (art.style.objectPosition || '').split(/\s+/).map(parseFloat).filter(Number.isFinite);
        return {
            index,
            el,
            art,
            play: el.querySelector('.game__play'),
            slug: el.dataset.game,
            title: el.querySelector('.game__title').textContent.trim(),
            image: new URL(art.getAttribute('src'), document.baseURI).href,
            pixel: art.classList.contains('game__art--pixel'),
            contain: art.classList.contains('game__art--contain'),
            position: [px / 100, py / 100],
            accent: el.style.getPropertyValue('--accent').trim() || '#2ee8ff',
        };
    });

    let active = 0;
    let built = false;
    let stage = null;
    let rack = null;
    let screenLink = null;
    let tabs = [];
    let scene = null;
    let drag = null;
    let swallowClick = false;
    let wheelSum = 0;
    let wheelLock = 0;
    let lastArrive = -1;
    let lastScreen = null;
    let stageBox = null;

    function fromHash() {
        const match = /^#game-(.+)$/.exec(window.location.hash);
        const game = match && games.find(item => item.slug === match[1]);
        return game ? game.index : -1;
    }

    function select(index, options = {}) {
        const count = games.length;
        const next = ((index % count) + count) % count;
        const changed = next !== active;
        active = next;
        if (!built) return;
        for (const game of games) {
            const on = game.index === active;
            game.el.classList.toggle('is-active', on);
            tabs[game.index].setAttribute('aria-selected', String(on));
            tabs[game.index].tabIndex = on ? 0 : -1;
        }
        const current = games[active];
        screenLink.href = current.play.href;
        screenLink.setAttribute('aria-label', current.play.getAttribute('aria-label'));
        const tab = tabs[active];
        rack.scrollTo({ left: tab.offsetLeft - rack.offsetLeft - (rack.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
        if (scene) scene.select(active);
        if (changed && !options.silent) sound.play('select');
    }

    function button(className, label) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = className;
        element.setAttribute('aria-label', label);
        return element;
    }

    function build() {
        if (built) return;
        built = true;

        stage = document.createElement('div');
        stage.className = 'arcade__stage';
        screenLink = document.createElement('a');
        screenLink.className = 'arcade__screen';
        screenLink.target = '_blank';
        screenLink.rel = 'noopener';
        screenLink.tabIndex = -1;
        screenLink.hidden = true;
        const previous = button('arcade__arrow arcade__arrow--prev', 'Previous game');
        const following = button('arcade__arrow arcade__arrow--next', 'Next game');
        stage.append(screenLink, previous, following);
        section.querySelector('.arcade__head').after(stage);

        rack = document.createElement('div');
        rack.className = 'rack';
        rack.setAttribute('role', 'tablist');
        rack.setAttribute('aria-label', 'Games');
        tabs = games.map(game => {
            const tab = button('rack__item', game.title);
            tab.id = `tab-${game.slug}`;
            tab.title = game.title;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', game.el.id);
            tab.style.setProperty('--accent', game.accent);
            const thumb = new Image();
            thumb.alt = '';
            thumb.decoding = 'async';
            thumb.draggable = false;
            thumb.className = game.art.className.replaceAll('game__art', 'rack__art');
            thumb.style.objectPosition = game.art.style.objectPosition;
            thumb.src = game.image;
            tab.append(thumb);
            tab.addEventListener('click', () => select(game.index));
            game.el.setAttribute('role', 'tabpanel');
            game.el.setAttribute('aria-labelledby', tab.id);
            return tab;
        });
        rack.append(...tabs);
        section.append(rack);
        list.classList.add('is-live');

        previous.addEventListener('click', () => select(active - 1));
        following.addEventListener('click', () => select(active + 1));

        rack.addEventListener('keydown', event => {
            const moves = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: games.length - 1 };
            if (!(event.key in moves)) return;
            event.preventDefault();
            select(moves[event.key]);
            tabs[active].focus();
        });

        const insertCoin = () => {
            sound.play('coin');
            if (scene) scene.pulse();
        };
        for (const game of games) game.play.addEventListener('click', insertCoin);
        screenLink.addEventListener('click', insertCoin);

        stage.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (event.target.closest('.arcade__arrow')) return;
            drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastT: event.timeStamp, speed: 0, moved: false };
        });

        stage.addEventListener('pointermove', event => {
            if (drag && event.pointerId === drag.id) {
                const dx = event.clientX - drag.startX;
                const dy = event.clientY - drag.startY;
                if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                    drag.moved = true;
                    stage.setPointerCapture(event.pointerId);
                    stage.classList.add('is-dragging');
                    if (scene) scene.grab();
                }
                if (drag.moved && scene) {
                    const step = event.clientX - drag.lastX;
                    const elapsed = Math.max(event.timeStamp - drag.lastT, 1);
                    drag.speed = drag.speed * 0.6 + (step / elapsed) * 1000 * 0.4;
                    drag.lastX = event.clientX;
                    drag.lastT = event.timeStamp;
                    scene.drag(step);
                }
                return;
            }
            if (event.pointerType !== 'mouse' || !scene) return;
            const hit = event.target === stage ? scene.hover(event.clientX, event.clientY) : scene.hover(-1, -1);
            stage.classList.toggle('is-pointing', hit >= 0 && hit !== active);
        });

        const release = event => {
            if (!drag || event.pointerId !== drag.id) return;
            const finished = drag;
            drag = null;
            stage.classList.remove('is-dragging');
            if (finished.moved) {
                swallowClick = true;
                setTimeout(() => { swallowClick = false; }, 60);
                if (scene) select(scene.release(finished.speed));
                return;
            }
            if (event.type === 'pointerup' && scene && event.target === stage) {
                const hit = scene.pick(event.clientX, event.clientY);
                if (hit >= 0 && hit !== active) select(hit);
            }
        };
        stage.addEventListener('pointerup', release);
        stage.addEventListener('pointercancel', release);
        stage.addEventListener('pointerleave', () => {
            if (scene) scene.hover(-1, -1);
            stage.classList.remove('is-pointing');
        });

        // A drag that ends over the screen link must not open the game.
        stage.addEventListener('click', event => {
            if (!swallowClick) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);

        // Sideways trackpad swipes turn the carousel; vertical scrolling is left alone.
        stage.addEventListener('wheel', event => {
            if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.2) return;
            event.preventDefault();
            const now = performance.now();
            if (now < wheelLock) return;
            wheelSum += event.deltaX;
            if (Math.abs(wheelSum) < 50) return;
            select(active + Math.sign(wheelSum));
            wheelSum = 0;
            wheelLock = now + 380;
        }, { passive: false });

        const linked = fromHash();
        select(linked >= 0 ? linked : active, { silent: true });
        if (linked >= 0) {
            const align = () => {
                if (built && fromHash() >= 0) window.scrollTo({ top: section.offsetTop, behavior: 'instant' });
            };
            align();
            window.addEventListener('load', () => requestAnimationFrame(align), { once: true });
        }
        window.addEventListener('hashchange', () => {
            const index = fromHash();
            if (index < 0 || !built) return;
            select(index);
            flyTo(section.offsetTop, 700);
        });
    }

    function flatten() {
        if (!built) return;
        built = false;
        scene = null;
        stage.remove();
        rack.remove();
        list.classList.remove('is-live');
        section.classList.remove('is-away');
        section.style.removeProperty('--arrive');
        lastScreen = null;
        stageBox = null;
        for (const game of games) {
            game.el.classList.remove('is-active');
            game.el.removeAttribute('role');
            game.el.removeAttribute('aria-labelledby');
        }
    }

    function sync(state) {
        if (!built) return;
        const arrive = smoothstep(ARRIVE_FROM, ARRIVE_TO, state.progress);
        const edge = (arrive === 0) !== (lastArrive === 0) || (arrive === 1) !== (lastArrive === 1);
        if (edge || Math.abs(arrive - lastArrive) > 0.004) {
            lastArrive = arrive;
            section.style.setProperty('--arrive', arrive.toFixed(3));
            section.classList.toggle('is-away', arrive < 0.5);
        }
        const screen = state.screen;
        if (!screen || !stageBox) {
            if (lastScreen) {
                lastScreen = null;
                screenLink.hidden = true;
            }
            return;
        }
        // The link only has to cover the screen, so it ignores the camera's slow sway.
        const next = { x: screen.x - stageBox.x, y: screen.y - stageBox.y, w: screen.w, h: screen.h };
        if (lastScreen && ['x', 'y', 'w', 'h'].every(side => Math.abs(next[side] - lastScreen[side]) < 3)) return;
        lastScreen = next;
        screenLink.hidden = false;
        screenLink.style.transform = `translate(${next.x.toFixed(1)}px, ${next.y.toFixed(1)}px)`;
        screenLink.style.width = `${next.w.toFixed(1)}px`;
        screenLink.style.height = `${next.h.toFixed(1)}px`;
    }

    return {
        games,
        build,
        flatten,
        select,
        sync,
        isLive: () => built,
        step(delta) {
            select(active + delta);
        },
        attach(nextScene) {
            scene = nextScene;
            scene.select(active, true);
        },
        stageRect() {
            if (!built) return null;
            const box = stage.getBoundingClientRect();
            stageBox = { x: box.left, y: box.top, w: box.width, h: box.height };
            return stageBox;
        },
    };
}

/* ---------- Sound (off until the visitor turns it on) ---------- */

function createSound(toggle) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!toggle || !AudioContextClass) return { play() {} };

    const TEMPO = 92;
    const STEP = 60 / TEMPO / 4;
    const CHORDS = [
        { root: 33, notes: [57, 60, 64, 67] },
        { root: 29, notes: [53, 57, 60, 64] },
        { root: 36, notes: [55, 60, 64, 67] },
        { root: 31, notes: [55, 59, 62, 66] },
    ];
    const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
    const hz = note => 440 * 2 ** ((note - 69) / 12);

    let context = null;
    let master = null;
    let music = null;
    let echo = null;
    let timer = 0;
    let step = 0;
    let nextTime = 0;
    let on = false;

    function voice(type, frequency, start, attack, hold, release, peak, cutoff, destination) {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + attack);
        gain.gain.setValueAtTime(peak, start + attack + hold);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
        oscillator.connect(filter).connect(gain).connect(destination);
        oscillator.start(start);
        oscillator.stop(start + attack + hold + release + 0.05);
        return oscillator;
    }

    function scheduleStep(index, time) {
        const bar = Math.floor(index / 32) % CHORDS.length;
        const chord = CHORDS[bar];
        const beat = index % 32;
        if (beat === 0) {
            const length = STEP * 32;
            for (const note of chord.notes) {
                voice('sawtooth', hz(note), time, 1.1, length - 1.1, 1.6, 0.016, 620, music).detune.value = -7;
                voice('sawtooth', hz(note), time, 1.1, length - 1.1, 1.6, 0.016, 620, music).detune.value = 7;
            }
        }
        if (beat % 2 === 0) voice('sawtooth', hz(chord.root), time, 0.008, 0.05, 0.2, 0.075, 240, music);
        if (beat % 4 === 0) {
            const kick = voice('sine', 120, time, 0.004, 0.02, 0.16, 0.16, 900, music);
            kick.frequency.exponentialRampToValueAtTime(42, time + 0.14);
        }
        const tone = chord.notes[ARP[index % ARP.length]] + 12;
        voice('square', hz(tone), time, 0.004, 0.02, 0.17, 0.022, 1700, echo);
    }

    function schedule() {
        while (nextTime < context.currentTime + 0.3) {
            scheduleStep(step, nextTime);
            nextTime += STEP;
            step += 1;
        }
    }

    function start() {
        if (!context) {
            context = new AudioContextClass();
            const limiter = context.createDynamicsCompressor();
            limiter.threshold.value = -16;
            limiter.ratio.value = 5;
            master = context.createGain();
            master.gain.value = 0;
            master.connect(limiter).connect(context.destination);
            music = context.createGain();
            music.gain.value = 0.9;
            music.connect(master);
            echo = context.createGain();
            const delay = context.createDelay(1);
            const feedback = context.createGain();
            delay.delayTime.value = STEP * 3;
            feedback.gain.value = 0.34;
            echo.connect(music);
            echo.connect(delay);
            delay.connect(feedback).connect(delay);
            delay.connect(music);
        }
        context.resume();
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(0.6, context.currentTime, 0.4);
        step = 0;
        nextTime = context.currentTime + 0.08;
        clearInterval(timer);
        timer = setInterval(schedule, 60);
        schedule();
    }

    function stop() {
        clearInterval(timer);
        if (!context) return;
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(0, context.currentTime, 0.08);
        setTimeout(() => { if (!on) context.suspend(); }, 500);
    }

    toggle.hidden = false;
    toggle.addEventListener('click', () => {
        on = !on;
        toggle.setAttribute('aria-pressed', String(on));
        if (on) start();
        else stop();
    });

    return {
        play(name) {
            if (!on || !context) return;
            const now = context.currentTime;
            if (name === 'hover') {
                voice('sine', 1320, now, 0.003, 0.01, 0.07, 0.03, 4000, master);
            } else if (name === 'select') {
                voice('triangle', 523.25, now, 0.004, 0.03, 0.12, 0.07, 3000, master);
                voice('triangle', 783.99, now + 0.07, 0.004, 0.03, 0.18, 0.07, 3000, master);
            } else if (name === 'coin') {
                voice('square', 987.77, now, 0.003, 0.05, 0.05, 0.05, 5000, master);
                voice('square', 1318.51, now + 0.085, 0.003, 0.09, 0.45, 0.05, 5000, master);
            }
        },
    };
}

