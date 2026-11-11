/**
 * World: renderer, camera flight, and post-processing.
 *
 * Scroll progress (0 at the top of the page, 1 at the arcade) drives the camera
 * along a spline. The ground also streams past on its own, so the scene moves
 * even while the page is still. The sibling modules are loaded with this file's
 * version query, which is why they receive shared values through "ctx" instead
 * of importing one another.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const version = new URL(import.meta.url).search;
const part = name => import(new URL(`./${name}.js${version}`, import.meta.url).href);

const ARENA = new THREE.Vector3(0, 0, -440);
const RING_RADIUS = 3.3;
const GATES = [0.5, 0.57, 0.64, 0.71, 0.78, 0.85];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

const NOISE = `
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y);
    float b = mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y);
    return mix(a, b, f.z);
}

float fbm3(vec3 p) {
    float amplitude = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 5; i++) {
        sum += amplitude * noise3(p);
        p = p * 2.02 + 11.7;
        amplitude *= 0.5;
    }
    return sum;
}
`;

// Runs before bloom so one bad pixel can never spread across the frame.
const GUARD = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
            gl_FragColor = vec4(clamp(col, 0.0, 48.0), 1.0);
        }
    `,
};

// Final colour pass: lens fringing, a radial smear at speed, vignette, and grain.
const GRADE = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uWarp: { value: 0 },
        uFringe: { value: 0.0009 },
        uVignette: { value: 0.5 },
        uGrain: { value: 0.05 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uWarp;
        uniform float uFringe;
        uniform float uVignette;
        uniform float uGrain;
        varying vec2 vUv;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);
            float jitter = hash(gl_FragCoord.xy + fract(uTime) * 61.0);
            vec3 col;
            if (uWarp > 0.004) {
                vec2 cell = gl_FragCoord.xy + mod(floor(uTime * 60.0), 64.0) * 5.588238;
                float dither = fract(52.9829189 * fract(dot(cell, vec2(0.06711056, 0.00583715))));
                vec3 sum = vec3(0.0);
                for (int i = 0; i < 14; i++) {
                    float f = (float(i) + dither) / 14.0;
                    sum += texture2D(tDiffuse, vUv - c * f * uWarp * 0.24).rgb;
                }
                col = sum / 14.0;
            } else {
                float fringe = uFringe * (0.25 + r2 * 4.0);
                col.r = texture2D(tDiffuse, vUv - c * fringe).r;
                col.g = texture2D(tDiffuse, vUv).g;
                col.b = texture2D(tDiffuse, vUv + c * fringe).b;
            }
            col *= mix(1.0, 1.0 - smoothstep(0.28, 0.92, sqrt(r2)), uVignette);
            col += (jitter - 0.5) * uGrain * (0.05 + col);
            gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
    `,
};

export async function createWorld({ canvas, mode, games, lowPower, progress = 0, onLost }) {
    const [skyPart, terrainPart, arcadePart, fxPart] = await Promise.all(['sky', 'terrain', 'arcade', 'fx'].map(part));

    const quality = {
        low: Boolean(lowPower),
        pixelRatio: lowPower ? 1.5 : 2,
        pixelBudget: lowPower ? 2.3e6 : 5.2e6,
        skySize: lowPower ? 512 : 1024,
        samples: lowPower ? 0 : 4,
        dust: lowPower ? 500 : 1300,
        artSize: lowPower ? 1024 : 2048,
    };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x03010a, 1);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 6000);
    const viewport = { width: 1, height: 1, pixelRatio: 1 };
    const time = { value: 0 };
    const ctx = { renderer, scene, camera, quality, noise: NOISE, games, arena: ARENA, ringRadius: RING_RADIUS, time, viewport };

    scene.add(new THREE.HemisphereLight(0x9a86ff, 0x2a0618, 1.0));
    const sunLight = new THREE.DirectionalLight(0xff7ab8, 2.4);
    sunLight.position.copy(skyPart.SUN_DIRECTION).multiplyScalar(100);
    scene.add(sunLight);

    const sky = skyPart.createSky(ctx);
    const terrain = terrainPart.createTerrain(ctx);
    const fx = fxPart.createFx(ctx);
    const arcade = mode === 'home' && games.length ? arcadePart.createArcade(ctx) : null;

    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.samples }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(GUARD));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.5, 0.95);
    composer.addPass(bloom);
    const grade = new ShaderPass(GRADE);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    // --- Camera rig ---
    const rig = {
        goal: clamp(progress),
        progress: clamp(progress),
        travel: 0,
        rush: 0,
        intro: progress < 0.02 ? 1 : 0,
        stage: null,
        pointer: new THREE.Vector2(),
        pointerSeen: -10,
    };
    let baseFov = 58;
    let path = null;
    let pathDirty = true;
    let scaleDown = 1;
    let disposed = false;

    function arcadePose() {
        const stage = rig.stage || { x: 0, y: viewport.height * 0.14, w: viewport.width, h: viewport.height * 0.6 };
        const pixelsPerUnit = Math.max(40, Math.min((stage.h * 0.9) / 3.2, (stage.w * 0.94) / 2.0));
        const distance = clamp(viewport.height / (2 * Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * pixelsPerUnit), 3.4, 24);
        const focus = arcade.focusPoint;
        return {
            pixelsPerUnit,
            position: [focus.x, focus.y + distance * 0.075, focus.z + distance],
            target: [focus.x, focus.y, focus.z],
        };
    }

    function keys() {
        if (!arcade) {
            return [
                { u: 0, position: [-7, 27, 0], target: [16, 21, -120], roll: -0.05 },
                { u: 1, position: [6, 38, -70], target: [-12, 27, -210], roll: 0.05 },
            ];
        }
        const pose = arcadePose();
        arcade.setScale(pose.pixelsPerUnit);
        return [
            { u: 0, position: [0, 3.1, 0], target: [0, 9.5, -80], roll: 0 },
            { u: 0.2, position: [0, 6.5, -46], target: [0, 12, -150], roll: 0 },
            { u: 0.46, position: [-10, 24, -150], target: [8, 15, -300], roll: -0.14 },
            { u: 0.7, position: [8, 16, -292], target: [0, 4, -430], roll: 0.12 },
            { u: 0.88, position: [0, 5.2, -398], target: [0, 1.9, -438], roll: 0 },
            { u: 1, position: pose.position, target: pose.target, roll: 0 },
        ];
    }

    function samplePath(u, position, target) {
        const list = path.keys;
        let i = 0;
        while (i < list.length - 2 && u > list[i + 1].u) i++;
        const span = list[i + 1].u - list[i].u;
        const local = span > 0 ? clamp((u - list[i].u) / span) : 0;
        const t = (i + local) / (list.length - 1);
        path.position.getPoint(t, position);
        path.target.getPoint(t, target);
        return THREE.MathUtils.lerp(list[i].roll, list[i + 1].roll, local * local * (3 - 2 * local));
    }

    function rebuildPath() {
        const list = keys();
        const curve = name => new THREE.CatmullRomCurve3(list.map(key => new THREE.Vector3(...key[name])), false, 'centripetal');
        path = { keys: list, position: curve('position'), target: curve('target') };
        pathDirty = false;
        if (!arcade) return;
        const scratch = new THREE.Vector3();
        fx.setGates(GATES.map(u => {
            const position = new THREE.Vector3();
            const next = new THREE.Vector3();
            samplePath(u, position, scratch);
            samplePath(u + 0.01, next, scratch);
            return { position, tangent: next.sub(position).normalize() };
        }));
    }

    function resize() {
        const width = Math.max(1, canvas.clientWidth || window.innerWidth);
        const height = Math.max(1, canvas.clientHeight || window.innerHeight);
        let ratio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio) * scaleDown;
        const pixels = width * height * ratio * ratio;
        if (pixels > quality.pixelBudget) ratio *= Math.sqrt(quality.pixelBudget / pixels);
        viewport.width = width;
        viewport.height = height;
        viewport.pixelRatio = ratio;
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        composer.setPixelRatio(ratio);
        composer.setSize(width, height);
        const aspect = width / height;
        baseFov = aspect >= 1 ? 58 : THREE.MathUtils.lerp(58, 80, clamp((1 - aspect) / 0.55));
        camera.aspect = aspect;
        pathDirty = true;
    }

    let resizeTimer = 0;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 90);
    };
    window.addEventListener('resize', onResize);

    const onContextLost = event => {
        event.preventDefault();
        if (onLost) onLost();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    // --- Frame ---
    const position = new THREE.Vector3();
    const target = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const probe = new THREE.Vector3();
    const pointerGround = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let lastTime = 0;
    let frameCost = 16;
    let slowFrames = 0;
    let frames = 0;

    function tick(now) {
        if (disposed) return { progress: rig.progress, screen: null };
        const elapsed = lastTime ? now - lastTime : 16;
        lastTime = now;
        const dt = clamp(elapsed / 1000, 0.001, 0.05);
        if (pathDirty) rebuildPath();
        time.value += dt;

        const before = rig.progress;
        rig.progress += (rig.goal - rig.progress) * (1 - Math.exp(-dt * 5));
        if (Math.abs(rig.goal - rig.progress) < 0.0002) rig.progress = rig.goal;
        const pace = Math.abs(rig.progress - before) / dt;
        rig.rush += (clamp(pace * 2.4) - rig.rush) * (1 - Math.exp(-dt * 6));
        rig.intro = Math.max(0, rig.intro - dt / 1.9);
        const intro = rig.intro * rig.intro;
        const rush = clamp(rig.rush + intro);

        const u = rig.progress;
        const cruise = arcade ? 15 * (1 - smoothstep(0.4, 0.72, u)) : 8;
        rig.travel += dt * cruise * (1 + rig.rush * 5 + intro * 10);

        const arenaOn = arcade ? smoothstep(0.3, 0.55, u) : 0;
        const arrive = arcade ? smoothstep(0.84, 0.985, u) : 0;

        // Camera pose: spline, a slow idle sway, and a little pointer parallax.
        const roll = samplePath(u, position, target);
        const calm = arcade ? 1 - arrive * 0.8 : 0.7;
        const t = time.value;
        camera.position.copy(position);
        camera.up.set(0, 1, 0);
        camera.lookAt(target);
        right.setFromMatrixColumn(camera.matrix, 0);
        up.setFromMatrixColumn(camera.matrix, 1);
        const swayX = Math.sin(t * 0.21) * 0.5 * calm + rig.pointer.x * (0.3 + 1.5 * calm);
        const swayY = Math.sin(t * 0.17 + 1.3) * 0.3 * calm - rig.pointer.y * (0.15 + 0.7 * calm);
        camera.position.addScaledVector(right, swayX).addScaledVector(up, swayY);
        camera.lookAt(target);
        camera.rotateZ(roll - rig.pointer.x * 0.02 * calm);
        camera.fov = baseFov + intro * 30 + rig.rush * 9;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        // Shift the picture so the front cabinet sits in the middle of its stage element.
        const hold = smoothstep(0.6, 1, u);
        if (arcade && rig.stage && hold > 0.001) {
            probe.copy(arcade.focusPoint).project(camera);
            if (Number.isFinite(probe.x) && Number.isFinite(probe.y) && probe.z < 1) {
                const px = (probe.x * 0.5 + 0.5) * viewport.width;
                const py = (0.5 - probe.y * 0.5) * viewport.height;
                const cx = rig.stage.x + rig.stage.w / 2;
                const cy = rig.stage.y + rig.stage.h / 2;
                camera.setViewOffset(viewport.width, viewport.height, (px - cx) * hold, (py - cy) * hold, viewport.width, viewport.height);
            }
        }

        // Where the pointer meets the ground, for the light that follows it.
        const active = clamp(1 - (t - rig.pointerSeen - 2.5) / 1.5);
        pointerGround.z += (active - pointerGround.z) * (1 - Math.exp(-dt * 4));
        ndc.set(rig.pointer.x, -rig.pointer.y);
        raycaster.setFromCamera(ndc, camera);
        const ray = raycaster.ray;
        if (ray.direction.y < -0.02) {
            const reach = -ray.origin.y / ray.direction.y;
            if (reach < 240) {
                pointerGround.x = ray.origin.x + ray.direction.x * reach;
                pointerGround.y = ray.origin.z + ray.direction.z * reach;
            }
        }

        const gateOn = arcade ? smoothstep(0.2, 0.38, u) : 0;
        const state = { dt, time: t, travel: rig.travel, camera, pixelRatio: viewport.pixelRatio, rush, arenaOn, arrive, gateOn, pointerGround };
        sky.update(state);
        terrain.update(state);
        fx.update(state);
        if (arcade) arcade.update(state);

        grade.uniforms.uTime.value = t;
        grade.uniforms.uWarp.value = intro * 0.85 + rig.rush * 0.32;
        bloom.strength = 0.42 + intro * 0.6 + rig.rush * 0.2;
        composer.render(dt);

        // Step the resolution down if the device cannot keep up.
        frames += 1;
        if (elapsed < 200) frameCost += (elapsed - frameCost) * 0.06;
        if (frames > 120 && frameCost > 24 && scaleDown > 0.5) {
            slowFrames += 1;
            if (slowFrames > 50) {
                scaleDown = Math.max(0.5, scaleDown * 0.8);
                slowFrames = 0;
                frames = 60;
                resize();
            }
        } else {
            slowFrames = 0;
        }

        return { progress: u, screen: arcade && arrive > 0.98 ? arcade.screenRect() : null };
    }

    resize();
    rebuildPath();
    tick(performance.now());

    return {
        tick,
        setProgress(value) {
            rig.goal = clamp(value);
        },
        setPointer(x, y) {
            if (Math.abs(x - rig.pointer.x) + Math.abs(y - rig.pointer.y) > 0.0015) rig.pointerSeen = time.value;
            rig.pointer.set(x, y);
        },
        setStage(rect) {
            if (!rect) return;
            if (!rig.stage || Math.abs(rect.w - rig.stage.w) > 1 || Math.abs(rect.h - rig.stage.h) > 1) pathDirty = true;
            rig.stage = rect;
        },
        select(index, instant) {
            if (arcade) arcade.select(index, instant);
        },
        hover: (x, y) => (arcade ? arcade.hover(x, y) : -1),
        pick: (x, y) => (arcade ? arcade.pick(x, y) : -1),
        grab() {
            if (arcade) arcade.grab();
        },
        drag(pixels) {
            if (arcade) arcade.drag(pixels);
        },
        release: speed => (arcade ? arcade.release(speed) : 0),
        pulse() {
            if (arcade) arcade.pulse();
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            clearTimeout(resizeTimer);
            window.removeEventListener('resize', onResize);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            for (const item of [sky, terrain, fx, arcade]) {
                if (item) item.dispose();
            }
            composer.dispose();
            renderer.dispose();
        },
    };
}

