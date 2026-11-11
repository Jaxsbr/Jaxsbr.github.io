/**
 * Arcade: a carousel of procedurally built cabinets on a glossy floor.
 *
 * Every cabinet is generated from one side profile. Its screen shows the game's
 * artwork through a CRT shader, and a mirrored copy under the floor stands in
 * for a reflection.
 */
import * as THREE from 'three';

// Side profile as [depth, height] pairs, front of the cabinet toward +depth.
const PROFILE = [[-0.45, 0], [0.42, 0], [0.42, 0.9], [0.62, 1.0], [0.62, 1.08], [0.3, 1.22], [0.12, 2.25], [0.4, 2.36], [0.4, 2.72], [-0.45, 2.72]];
const BODY_WIDTH = 1.6;
const PANEL = 0.06;
const SCREEN_W = 1.44;
const SCREEN_H = 0.81;
const SCREEN_ASPECT = SCREEN_W / SCREEN_H;
const SCREEN_TILT = -Math.atan2(0.18, 1.03);
const SCREEN_CENTER = new THREE.Vector3(0, 1.7374, 0.2238);
const DECK_TILT = Math.atan2(0.14, 0.32);
const HIT_BOX = new THREE.Box3(new THREE.Vector3(-0.88, 0, -0.48), new THREE.Vector3(0.88, 2.76, 0.66));
const BUTTON_COLORS = ['#2ee8ff', '#ff2e97', '#ffd447', '#6dff8a', '#b98cff'];

const SCREEN_FRAGMENT = noise => `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec4 uFit;
uniform float uOn;
uniform float uPower;
uniform float uTime;
uniform float uSeed;
uniform vec3 uAccent;
varying vec2 vUv;
${noise}

void main() {
    vec2 c = vUv * 2.0 - 1.0;
    vec2 bent = c * (1.0 + 0.03 * dot(c, c));
    vec2 uv = bent * 0.5 + 0.5;
    float edge = (1.0 - smoothstep(0.95, 1.0, abs(bent.x))) * (1.0 - smoothstep(0.93, 1.0, abs(bent.y)));

    vec2 q = uv * uFit.xy + uFit.zw;
    float inArt = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    float split = 0.0014 * (0.4 + dot(c, c));
    vec3 art = vec3(
        texture2D(uMap, q + vec2(split, 0.0)).r,
        texture2D(uMap, q).g,
        texture2D(uMap, q - vec2(split, 0.0)).b
    );
    vec3 fill = texture2D(uMap, uv, 6.0).rgb * 0.28 + uAccent * 0.035;
    art = mix(fill, art, inArt);

    float grain = hash21(floor(vUv * vec2(150.0, 84.0)) + floor(uTime * 20.0) * 7.0);
    vec3 snow = mix(vec3(0.02), uAccent * 0.5 + 0.12, grain * grain);
    art = mix(snow, art, uHasMap);

    float rows = uv.y * 600.0;
    float scan = mix(0.86 + 0.14 * sin(rows), 0.94, smoothstep(1.0, 3.0, fwidth(rows)));
    float roll = 1.0 + 0.07 * (1.0 - smoothstep(0.0, 0.07, abs(fract(uv.y * 0.6 - uTime * 0.07 + uSeed) - 0.5)));
    float flicker = 0.97 + 0.03 * sin(uTime * 41.0 + uSeed * 17.0);

    vec3 col = art * scan * roll * flicker * edge;
    col *= mix(0.4, 1.0, uOn) * uPower;
    col += vec3(0.5, 0.7, 1.0) * pow(clamp(1.0 - abs(vUv.x * 0.7 + vUv.y - 1.25) * 2.2, 0.0, 1.0), 4.0) * 0.05;
    gl_FragColor = vec4(col, 1.0);
}
`;

const MIRROR_VERTEX = `
varying vec2 vUv;
varying float vHeight;
#ifdef USE_COLOR
varying vec3 vTint;
#endif

void main() {
    vUv = uv;
    #ifdef USE_COLOR
    vTint = color;
    #endif
    vec4 world = modelMatrix * vec4(position, 1.0);
    vHeight = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const MIRROR_FRAGMENT = `
uniform sampler2D uMap;
uniform vec4 uFit;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
varying float vHeight;
#ifdef USE_COLOR
varying vec3 vTint;
#endif

void main() {
    vec3 col = uColor;
    #ifdef USE_ART
    col *= texture2D(uMap, clamp(vUv * uFit.xy + uFit.zw, 0.0, 1.0)).rgb;
    #endif
    #ifdef USE_COLOR
    col *= vTint;
    #endif
    float fade = smoothstep(-2.5, -0.02, vHeight);
    gl_FragColor = vec4(col * fade * fade * uStrength, 1.0);
}
`;

const BEAM_VERTEX = `
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec2 vUv;

void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const BEAM_FRAGMENT = `
uniform vec3 uColor;
uniform float uStrength;
uniform float uFalloff;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec2 vUv;

void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float facing = pow(abs(dot(normalize(vNormalW), view)), 2.0);
    float along = pow(clamp(vUv.y, 0.0, 1.0), uFalloff);
    gl_FragColor = vec4(uColor * facing * along * uStrength, 1.0);
}
`;

/** Collects transformed, coloured copies of small geometries into one mesh. */
class Bucket {
    constructor() {
        this.position = [];
        this.normal = [];
        this.uv = [];
        this.color = [];
    }

    add(geometry, matrix, color, range) {
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        const uvs = geometry.attributes.uv;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
        const v = new THREE.Vector3();
        const start = range ? range.start : 0;
        const end = range ? range.start + range.count : positions.count;
        for (let i = start; i < end; i++) {
            v.fromBufferAttribute(positions, i).applyMatrix4(matrix);
            this.position.push(v.x, v.y, v.z);
            v.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
            this.normal.push(v.x, v.y, v.z);
            this.uv.push(uvs ? uvs.getX(i) : 0, uvs ? uvs.getY(i) : 0);
            this.color.push(color.r, color.g, color.b);
        }
        return this;
    }

    build() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
        return geometry;
    }
}

const place = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
);

/** Scales a colour to a fixed brightness so every hue glows equally under bloom. */
function neon(color, brightness = 1) {
    const value = new THREE.Color(color);
    const luma = value.r * 0.299 + value.g * 0.587 + value.b * 0.114;
    return value.multiplyScalar(brightness / Math.max(luma, 0.12));
}

function offsetPolygon(points, amount) {
    const count = points.length;
    return points.map((point, i) => {
        const before = points[(i + count - 1) % count];
        const after = points[(i + 1) % count];
        const inLength = Math.hypot(point[0] - before[0], point[1] - before[1]);
        const outLength = Math.hypot(after[0] - point[0], after[1] - point[1]);
        const n1 = [(point[1] - before[1]) / inLength, -(point[0] - before[0]) / inLength];
        const n2 = [(after[1] - point[1]) / outLength, -(after[0] - point[0]) / outLength];
        let mx = n1[0] + n2[0];
        let my = n1[1] + n2[1];
        const length = Math.hypot(mx, my) || 1;
        mx /= length;
        my /= length;
        const reach = amount / Math.max(mx * n1[0] + my * n1[1], 0.4);
        return [point[0] + mx * reach, Math.max(point[1] + my * reach, 0)];
    });
}

/** Extrudes the side profile across the cabinet; the result spans x from -depth to 0. */
function extrudeProfile(points, depth) {
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    geometry.rotateY(-Math.PI / 2);
    return geometry;
}

function createParts() {
    return {
        body: extrudeProfile(PROFILE, BODY_WIDTH),
        panel: extrudeProfile(offsetPolygon(PROFILE, 0.035), PANEL),
        box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
        cylinder: new THREE.CylinderGeometry(1, 1, 1, 20).toNonIndexed(),
        sphere: new THREE.SphereGeometry(1, 16, 12).toNonIndexed(),
    };
}

function buildCabinetGeometry(parts, accent) {
    const body = new Bucket();
    const lights = new Bucket();
    const half = BODY_WIDTH / 2;
    const shell = new THREE.Color('#1c1842');
    const dark = new THREE.Color('#0c0a1e');
    const panelTint = shell.clone().lerp(accent, 0.3);
    const glow = brightness => neon(accent, brightness);

    body.add(parts.body, place(half, 0, 0), shell);
    const [caps, rims] = parts.panel.groups;
    for (const x of [half + PANEL, -half]) {
        body.add(parts.panel, place(x, 0, 0), panelTint, caps);
        lights.add(parts.panel, place(x, 0, 0), glow(1.25), rims);
    }

    // Diagonal stripes on both side panels.
    for (const side of [-1, 1]) {
        for (const [y, length] of [[0.48, 0.8], [0.7, 0.62]]) {
            lights.add(parts.box, place(side * (half + PANEL + 0.004), y, -0.03, -0.6, 0, 0, 0.008, 0.06, length), glow(0.8));
        }
    }

    // Screen bezel.
    const screen = place(SCREEN_CENTER.x, SCREEN_CENTER.y, SCREEN_CENTER.z, SCREEN_TILT);
    const bars = [
        [0, SCREEN_H / 2 + 0.022, SCREEN_W + 0.06, 0.016],
        [0, -SCREEN_H / 2 - 0.022, SCREEN_W + 0.06, 0.016],
        [SCREEN_W / 2 + 0.022, 0, 0.016, SCREEN_H + 0.06],
        [-SCREEN_W / 2 - 0.022, 0, 0.016, SCREEN_H + 0.06],
    ];
    for (const [x, y, w, h] of bars) {
        lights.add(parts.box, screen.clone().multiply(place(x, y, 0, 0, 0, 0, w, h, 0.012)), glow(0.8));
    }

    // Marquee frame.
    for (const y of [2.54 + 0.166, 2.54 - 0.166]) {
        lights.add(parts.box, place(0, y, 0.404, 0, 0, 0, BODY_WIDTH - 0.04, 0.014, 0.014), glow(1.0));
    }

    // Control deck: joystick and buttons sit on the sloped surface.
    const deck = (x, along, lift) => {
        const z = 0.62 - 0.32 * along;
        const y = 1.08 + 0.14 * along;
        return place(x, y, z, DECK_TILT).multiply(place(0, lift, 0));
    };
    body.add(parts.cylinder, deck(-0.42, 0.5, 0.008).multiply(place(0, 0, 0, 0, 0, 0, 0.07, 0.016, 0.07)), dark);
    body.add(parts.cylinder, deck(-0.42, 0.5, 0.075).multiply(place(0, 0, 0, 0, 0, 0, 0.016, 0.13, 0.016)), new THREE.Color('#3a3a4d'));
    lights.add(parts.sphere, deck(-0.42, 0.5, 0.16).multiply(place(0, 0, 0, 0, 0, 0, 0.048, 0.048, 0.048)), neon('#ff3158', 1.0));
    const buttons = [[0.05, 0.36], [0.21, 0.42], [0.37, 0.36], [0.13, 0.72], [0.29, 0.78]];
    buttons.forEach(([x, along], i) => {
        lights.add(parts.cylinder, deck(x, along, 0.012).multiply(place(0, 0, 0, 0, 0, 0, 0.043, 0.024, 0.043)), neon(BUTTON_COLORS[i], 1.0));
    });

    // Coin door.
    body.add(parts.box, place(0, 0.47, 0.428, 0, 0, 0, 0.58, 0.42, 0.02), dark);
    const gold = neon('#ffc247', 1.5);
    for (const x of [-0.12, 0.12]) {
        lights.add(parts.box, place(x, 0.5, 0.44, 0, 0, 0, 0.028, 0.11, 0.012), gold);
    }
    const doorLines = [[0, 0.682, 0.58, 0.01], [0, 0.258, 0.58, 0.01], [0.292, 0.47, 0.01, 0.434], [-0.292, 0.47, 0.01, 0.434]];
    for (const [x, y, w, h] of doorLines) {
        lights.add(parts.box, place(x, y, 0.44, 0, 0, 0, w, h, 0.01), glow(0.6));
    }

    // Light strip at the foot of the cabinet.
    lights.add(parts.box, place(0, 0.05, 0.424, 0, 0, 0, BODY_WIDTH - 0.08, 0.03, 0.014), glow(1.1));

    return { body: body.build(), neon: lights.build() };
}

function glowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function drawMarquee(canvas, title, accent) {
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#170a3a');
    background.addColorStop(1, '#05020f');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.fillStyle = accent;
    context.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
        const inset = 26 + i * 24;
        for (const x of [inset, width - inset - 10]) {
            context.fillRect(x, height * 0.3, 10, height * 0.4);
        }
    }
    context.globalAlpha = 1;

    const text = title.toUpperCase();
    let size = 124;
    const font = () => `900 ${size}px Orbitron, 'Arial Black', sans-serif`;
    context.font = font();
    while (context.measureText(text).width > width - 250 && size > 36) {
        size -= 4;
        context.font = font();
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = accent;
    context.shadowBlur = 34;
    context.fillStyle = accent;
    context.fillText(text, width / 2, height / 2 + 6);
    context.fillText(text, width / 2, height / 2 + 6);
    context.shadowBlur = 0;
    context.fillStyle = '#ffffff';
    context.fillText(text, width / 2, height / 2 + 6);
}

export function createArcade(ctx) {
    const { renderer, scene, camera, quality, noise, games, arena, ringRadius } = ctx;
    const count = games.length;
    const step = count > 0 ? (Math.PI * 2) / count : Math.PI * 2;

    const root = new THREE.Group();
    root.position.copy(arena);
    scene.add(root);
    const ring = new THREE.Group();
    const mirrorRing = new THREE.Group();
    mirrorRing.scale.y = -1;
    root.add(ring, mirrorRing);

    const parts = createParts();
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;
    const glowMap = glowTexture();

    const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.5, envMapIntensity: 1.2 });
    const mirrorUniforms = { uStrength: { value: 0.55 } };
    const mirrorMaterial = (options = {}) => new THREE.ShaderMaterial({
        vertexColors: Boolean(options.vertexColors),
        defines: options.map ? { USE_ART: '' } : {},
        uniforms: {
            uMap: options.map || { value: blank },
            uFit: options.fit || { value: new THREE.Vector4(1, 1, 0, 0) },
            uColor: { value: options.color || new THREE.Color(1, 1, 1) },
            uStrength: mirrorUniforms.uStrength,
        },
        vertexShader: MIRROR_VERTEX,
        fragmentShader: MIRROR_FRAGMENT,
    });
    const bodyMirror = mirrorMaterial({ color: new THREE.Color(0.022, 0.016, 0.06) });
    const neonMirror = mirrorMaterial({ vertexColors: true });

    const screenGeometry = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);
    const marqueeGeometry = new THREE.PlaneGeometry(BODY_WIDTH - 0.06, 0.3);
    const glowGeometry = new THREE.PlaneGeometry(3.4, 2.7);
    glowGeometry.rotateX(-Math.PI / 2);

    const cabinets = games.map((game, index) => {
        const accent = new THREE.Color(game.accent);
        const geometry = buildCabinetGeometry(parts, accent);
        const angle = index * step;

        const uniforms = {
            uMap: { value: blank },
            uHasMap: { value: 0 },
            uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
            uOn: { value: 0 },
            uPower: { value: 0.75 },
            uTime: ctx.time,
            uSeed: { value: Math.random() },
            uAccent: { value: accent },
        };
        const screenMaterial = new THREE.ShaderMaterial({
            uniforms,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: SCREEN_FRAGMENT(noise),
        });

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 200;
        drawMarquee(canvas, game.title, game.accent);
        const marqueeMap = new THREE.CanvasTexture(canvas);
        marqueeMap.colorSpace = THREE.SRGBColorSpace;
        marqueeMap.anisotropy = 4;
        const marqueeMaterial = new THREE.MeshBasicMaterial({
            map: marqueeMap,
            color: new THREE.Color(1.1, 1.1, 1.1),
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
        });
        const neonMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

        const group = new THREE.Group();
        const mirror = new THREE.Group();
        const build = (target, materials) => {
            const screen = new THREE.Mesh(screenGeometry, materials.screen);
            screen.position.copy(SCREEN_CENTER);
            screen.rotation.x = SCREEN_TILT;
            const marquee = new THREE.Mesh(marqueeGeometry, materials.marquee);
            marquee.position.set(0, 2.54, 0.4045);
            target.add(new THREE.Mesh(geometry.body, materials.body), new THREE.Mesh(geometry.neon, materials.neon), screen, marquee);
            return screen;
        };
        const screen = build(group, { body: bodyMaterial, neon: neonMaterial, screen: screenMaterial, marquee: marqueeMaterial });
        build(mirror, {
            body: bodyMirror,
            neon: neonMirror,
            screen: mirrorMaterial({ map: uniforms.uMap, fit: uniforms.uFit }),
            marquee: mirrorMaterial({ map: { value: marqueeMap } }),
        });

        const underglow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({
            map: glowMap,
            color: accent,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        underglow.position.set(0, 0.02, 0.1);
        underglow.renderOrder = 3;
        group.add(underglow);

        group.rotation.y = angle;
        mirror.rotation.y = angle;
        ring.add(group);
        mirrorRing.add(mirror);

        return { game, index, angle, accent, group, mirror, screen, uniforms, canvas, marqueeMap, marqueeMaterial, neonMaterial, underglow, focus: 0, lift: 0 };
    });

    // Redraw the marquees once the display font is available.
    if (document.fonts && document.fonts.load) {
        document.fonts.load("900 100px Orbitron").then(() => {
            for (const cabinet of cabinets) {
                drawMarquee(cabinet.canvas, cabinet.game.title, cabinet.game.accent);
                cabinet.marqueeMap.needsUpdate = true;
            }
        }).catch(() => {});
    }

    // Artwork loads one cabinet at a time, starting from the one in front.
    async function loadArt(cabinet) {
        const image = new Image();
        image.decoding = 'async';
        image.src = cabinet.game.image;
        try {
            await image.decode();
        } catch (error) {
            if (!image.complete || !image.naturalWidth) return;
        }
        if (disposed) return;
        let source = image;
        const longest = Math.max(image.naturalWidth, image.naturalHeight);
        if (longest > quality.artSize) {
            const scale = quality.artSize / longest;
            source = document.createElement('canvas');
            source.width = Math.round(image.naturalWidth * scale);
            source.height = Math.round(image.naturalHeight * scale);
            source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
        }
        const texture = new THREE.Texture(source);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (cabinet.game.pixel) texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        renderer.initTexture(texture);

        const ratio = image.naturalWidth / image.naturalHeight / SCREEN_ASPECT;
        const [px, py] = cabinet.game.position || [0.5, 0.5];
        const fit = cabinet.uniforms.uFit.value;
        if (cabinet.game.contain) {
            const sx = Math.max(1, 1 / ratio);
            const sy = Math.max(1, ratio);
            fit.set(sx, sy, (1 - sx) / 2, (1 - sy) / 2);
        } else {
            const sx = Math.min(1, 1 / ratio);
            const sy = Math.min(1, ratio);
            fit.set(sx, sy, (1 - sx) * px, (1 - sy) * (1 - py));
        }
        cabinet.uniforms.uMap.value = texture;
        cabinet.uniforms.uHasMap.value = 1;
        cabinet.uniforms.uPower.value = 2.2;
        cabinet.texture = texture;
    }

    let disposed = false;
    let loading = false;
    async function loadAll(first) {
        if (loading) return;
        loading = true;
        const order = cabinets.map((_, i) => {
            const offset = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
            return cabinets[((first + offset) % count + count) % count];
        });
        for (const cabinet of order) {
            if (disposed) return;
            await loadArt(cabinet);
        }
    }

    // --- Stage dressing ---
    const dressing = new THREE.Group();
    root.add(dressing);

    const haloMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.85, 1.2) });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(ringRadius + 0.5, 0.013, 8, 200), haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 3.12;
    const runners = new THREE.Group();
    const runnerMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.42, 1.25) });
    for (let i = 0; i < 3; i++) {
        const runner = new THREE.Mesh(new THREE.TorusGeometry(ringRadius + 0.5, 0.024, 8, 24, 0.36), runnerMaterial);
        runner.rotation.x = Math.PI / 2;
        runner.rotation.z = (i * Math.PI * 2) / 3;
        runners.add(runner);
    }
    runners.position.y = 3.12;
    dressing.add(halo, runners);

    const beamMaterial = (color, strength, falloff) => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: color }, uStrength: { value: strength }, uFalloff: { value: falloff } },
        vertexShader: BEAM_VERTEX,
        fragmentShader: BEAM_FRAGMENT,
    });

    // A beacon rising from the middle of the ring, visible on the approach.
    const beaconGeometry = new THREE.CylinderGeometry(1.3, 0.5, 420, 28, 1, true);
    beaconGeometry.rotateX(Math.PI);
    const beacon = new THREE.Mesh(beaconGeometry, beamMaterial(new THREE.Color(0.35, 0.75, 1.0), 0.5, 1.6));
    beacon.position.y = 210;
    beacon.renderOrder = 4;
    dressing.add(beacon);

    const key = new THREE.PointLight(0xa8dcff, 90, 28, 2);
    key.position.set(-3.2, 4.6, ringRadius + 4.2);
    const fill = new THREE.PointLight(0xff5fb0, 60, 26, 2);
    fill.position.set(3.4, 2.3, ringRadius + 3.4);
    dressing.add(key, fill);

    // --- Carousel state ---
    const carousel = { angle: 0, target: 0, velocity: 0, index: 0, held: false, pixelsPerUnit: 160 };
    let hovered = -1;

    const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

    function targetFor(index) {
        const goal = -index * step;
        return carousel.angle + wrap(goal - carousel.angle);
    }

    function select(index, instant = false) {
        if (!count) return;
        carousel.index = ((index % count) + count) % count;
        carousel.target = targetFor(carousel.index);
        carousel.held = false;
        if (instant) {
            carousel.angle = carousel.target;
            carousel.velocity = 0;
            loadAll(carousel.index);
        }
    }

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const localRay = new THREE.Ray();
    const inverse = new THREE.Matrix4();
    const hitPoint = new THREE.Vector3();

    function pick(clientX, clientY) {
        if (clientX < 0 || !root.visible) return -1;
        const width = ctx.viewport.width;
        const height = ctx.viewport.height;
        pointerNdc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
        raycaster.setFromCamera(pointerNdc, camera);
        let best = -1;
        let bestDistance = Infinity;
        for (const cabinet of cabinets) {
            inverse.copy(cabinet.group.matrixWorld).invert();
            localRay.copy(raycaster.ray).applyMatrix4(inverse);
            if (!localRay.intersectBox(HIT_BOX, hitPoint)) continue;
            const distance = hitPoint.applyMatrix4(cabinet.group.matrixWorld).distanceToSquared(raycaster.ray.origin);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = cabinet.index;
            }
        }
        return best;
    }

    const corner = new THREE.Vector3();
    function screenRect() {
        const cabinet = cabinets[carousel.index];
        if (!cabinet || cabinet.focus < 0.985 || Math.abs(carousel.velocity) > 0.05 || carousel.held) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            corner.set((x * SCREEN_W) / 2, (y * SCREEN_H) / 2, 0);
            cabinet.screen.localToWorld(corner).project(camera);
            const px = (corner.x * 0.5 + 0.5) * ctx.viewport.width;
            const py = (0.5 - corner.y * 0.5) * ctx.viewport.height;
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return {
        select,
        pick,
        screenRect,
        focusPoint: new THREE.Vector3(arena.x, 1.5, arena.z + ringRadius + 0.3),
        setScale(pixelsPerUnit) {
            carousel.pixelsPerUnit = pixelsPerUnit;
        },
        hover(clientX, clientY) {
            hovered = pick(clientX, clientY);
            return hovered;
        },
        grab() {
            carousel.held = true;
            carousel.velocity = 0;
        },
        drag(pixels) {
            carousel.angle += pixels / (carousel.pixelsPerUnit * (ringRadius + 0.6));
        },
        release(pixelsPerSecond) {
            const speed = pixelsPerSecond / (carousel.pixelsPerUnit * (ringRadius + 0.6));
            const landing = carousel.angle + THREE.MathUtils.clamp(speed, -9, 9) * 0.2;
            carousel.index = ((Math.round(-landing / step) % count) + count) % count;
            carousel.target = carousel.angle + wrap(-carousel.index * step - carousel.angle);
            carousel.velocity = THREE.MathUtils.clamp(speed, -9, 9);
            carousel.held = false;
            return carousel.index;
        },
        pulse() {
            const cabinet = cabinets[carousel.index];
            if (cabinet) cabinet.uniforms.uPower.value = 2.2;
        },
        update(state) {
            const on = state.arenaOn;
            root.visible = on > 0.001;
            if (!root.visible) return;
            const dt = state.dt;

            if (!carousel.held) {
                const force = (carousel.target - carousel.angle) * 46 - carousel.velocity * 11.5;
                carousel.velocity += force * dt;
                carousel.angle += carousel.velocity * dt;
            }
            ring.rotation.y = carousel.angle;
            mirrorRing.rotation.y = carousel.angle;

            const settle = 1 - Math.exp(-dt * 9);
            for (const cabinet of cabinets) {
                const offset = Math.abs(wrap(cabinet.angle + carousel.angle));
                const facing = THREE.MathUtils.smoothstep(1 - offset / (step * 0.62), 0, 1);
                cabinet.focus += (facing - cabinet.focus) * settle;
                cabinet.lift += ((hovered === cabinet.index ? 1 : 0) - cabinet.lift) * settle;
                const out = ringRadius + cabinet.focus * 0.3 + cabinet.lift * 0.08;
                const scale = 1 + cabinet.focus * 0.06 + cabinet.lift * 0.025;
                for (const object of [cabinet.group, cabinet.mirror]) {
                    object.position.set(Math.sin(cabinet.angle) * out, 0, Math.cos(cabinet.angle) * out);
                    object.scale.setScalar(scale);
                }
                cabinet.mirror.visible = offset < 1.75;
                const uniforms = cabinet.uniforms;
                uniforms.uOn.value = Math.max(cabinet.focus, cabinet.lift * 0.6) * on;
                const rest = uniforms.uHasMap.value > 0.5 ? 1 : 0.75;
                uniforms.uPower.value += (rest - uniforms.uPower.value) * (1 - Math.exp(-dt * 5));
                cabinet.neonMaterial.color.setScalar(0.7 + cabinet.focus * 0.3 + cabinet.lift * 0.2);
                cabinet.marqueeMaterial.color.setScalar(0.75 + cabinet.focus * 0.3 + cabinet.lift * 0.15);
                cabinet.underglow.material.opacity = (0.22 + cabinet.focus * 0.5 + cabinet.lift * 0.2) * on;
            }

            runners.rotation.y = state.time * 0.55;
            halo.rotation.z = state.time * 0.05;
            beacon.material.uniforms.uStrength.value = 0.5 * on * (1 - state.arrive * 0.7) * (0.85 + 0.15 * Math.sin(state.time * 2.1));
            key.intensity = 90 * on;
            fill.intensity = 60 * on;
            mirrorUniforms.uStrength.value = 0.55 * state.arrive;
        },
        dispose() {
            disposed = true;
            for (const cabinet of cabinets) {
                if (cabinet.texture) cabinet.texture.dispose();
                cabinet.marqueeMap.dispose();
            }
        },
    };
}

