/**
 * Sky: a nebula and star field baked once into a cube map, plus the sun,
 * a ringed planet, twinkling stars, and shooting stars that follow the camera.
 */
import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(0, 0.19, -1).normalize();

const BAKE_FRAGMENT = noise => `
varying vec3 vDir;
uniform vec3 uSun;
${noise}

float starLayer(vec3 d, float scale, float density, float size, float seed) {
    vec3 p = d * scale;
    vec3 id = floor(p);
    float h = hash31(id + seed);
    if (h > density) return 0.0;
    vec3 jitter = vec3(hash31(id + seed + 1.7), hash31(id + seed + 4.1), hash31(id + seed + 9.3)) - 0.5;
    float r = length(fract(p) - 0.5 - jitter * 0.6);
    float bright = h / density;
    return (1.0 - smoothstep(0.0, size, r)) * (0.3 + 0.7 * bright * bright);
}

void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    float t = clamp(y, 0.0, 1.0);

    vec3 zenith = vec3(0.005, 0.003, 0.028);
    vec3 upper = vec3(0.02, 0.006, 0.08);
    vec3 low = vec3(0.085, 0.015, 0.17);
    vec3 horizon = vec3(0.34, 0.055, 0.32);

    vec3 col = mix(horizon, low, smoothstep(0.0, 0.1, t));
    col = mix(col, upper, smoothstep(0.06, 0.36, t));
    col = mix(col, zenith, smoothstep(0.3, 0.9, t));

    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.3, 0.42) * pow(s, 9.0) * 0.1;
    col += vec3(1.0, 0.55, 0.3) * pow(s, 60.0) * 0.2;

    float n1 = fbm3(d * 2.4 + vec3(3.1, 1.7, 0.4));
    float n2 = fbm3(d * 5.0 + vec3(-8.0, 2.0, 5.0));
    float n3 = fbm3(d * 3.3 + 20.0);
    float cloud = smoothstep(0.42, 0.82, n1);
    vec3 nebula = mix(vec3(0.2, 0.04, 0.55), vec3(0.95, 0.16, 0.55), smoothstep(0.3, 0.75, n2));
    nebula = mix(nebula, vec3(0.08, 0.5, 0.9), smoothstep(0.52, 0.9, n3) * 0.75);
    float lane = (d.y - 0.44 - d.x * 0.28) * 2.5;
    float band = exp(-lane * lane);
    float above = smoothstep(0.02, 0.3, y);
    col += nebula * cloud * (0.07 + 0.27 * band) * above;

    float stars = starLayer(d, 62.0, 0.5, 0.1, 0.0) + starLayer(d, 27.0, 0.13, 0.13, 40.0) * 1.8;
    vec3 starTint = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.8, 0.92), hash31(floor(d * 62.0) + 3.0));
    col += starTint * stars * 1.7 * smoothstep(0.0, 0.14, y) * (1.0 + band);

    vec3 ground = vec3(0.01, 0.004, 0.03);
    vec3 below = mix(ground, horizon * 0.5, smoothstep(-0.14, 0.0, y));
    col = mix(col, below, step(y, 0.0));

    col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const SUN_FRAGMENT = `
varying vec2 vUv;
varying vec3 vRay;
uniform float uTime;

void main() {
    vec2 p = (vUv * 2.0 - 1.0) * 2.6;
    float r = length(p);
    float edge = fwidth(r) * 1.5;
    float disc = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);

    float t = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.55, 0.1, 0.95), vec3(1.0, 0.1, 0.55), smoothstep(0.0, 0.3, t));
    col = mix(col, vec3(1.0, 0.42, 0.18), smoothstep(0.26, 0.6, t));
    col = mix(col, vec3(1.0, 0.92, 0.42), smoothstep(0.56, 1.0, t));

    float k = clamp((0.66 - t) / 0.66, 0.0, 1.0);
    float rows = k * 9.0 - uTime * 0.1;
    float f = fract(rows);
    float thick = mix(0.08, 0.66, k);
    float aa = fwidth(rows) * 1.2;
    float gap = (1.0 - smoothstep(0.0, aa, abs(f - thick * 0.5) - thick * 0.5)) * step(0.0001, k);
    disc *= 1.0 - gap;

    float outside = max(r - 1.0, 0.0);
    float halo = exp(-outside * 3.2) * 0.5 + exp(-outside * 1.2) * 0.13;
    halo *= (1.0 - disc) * (1.0 - smoothstep(1.4, 2.6, r));

    vec3 rgb = mix(vec3(1.0, 0.3, 0.5), col * 1.25, disc);
    float alpha = clamp(disc + halo, 0.0, 1.0);
    alpha *= smoothstep(-0.012, 0.004, normalize(vRay).y);
    gl_FragColor = vec4(rgb, alpha);
}
`;

const PLANET_FRAGMENT = noise => `
varying vec3 vNormalW;
varying vec3 vNormalO;
varying vec3 vWorld;
uniform vec3 uSun;
${noise}

void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vWorld);
    float light = smoothstep(-0.25, 0.75, dot(n, normalize(uSun + vec3(-0.35, 0.25, 0.0))));
    float lat = vNormalO.y * 7.0 + noise2(vNormalO.xz * 3.0) * 0.8;
    float bands = noise2(vec2(lat * 2.0, 3.7)) * 0.6 + noise2(vec2(lat * 6.0, 9.1)) * 0.4;
    vec3 base = mix(vec3(0.16, 0.05, 0.42), vec3(0.75, 0.22, 0.6), bands);
    base = mix(base, vec3(0.2, 0.55, 0.9), smoothstep(0.62, 0.9, bands) * 0.5);
    float rim = pow(clamp(1.0 - dot(n, v), 0.0, 1.0), 2.6);
    vec3 col = base * light * 0.95;
    col += mix(vec3(0.35, 0.3, 1.0), vec3(1.0, 0.5, 0.75), light) * rim * (0.22 + light * 1.5);
    col += vec3(0.006, 0.003, 0.02);
    gl_FragColor = vec4(col, 1.0);
}
`;

const RING_FRAGMENT = noise => `
varying vec3 vPos;
${noise}

void main() {
    float r = length(vPos.xy);
    float t = (r - 1.4) / 0.95;
    float bands = noise2(vec2(r * 26.0, 1.3)) * 0.65 + noise2(vec2(r * 80.0, 7.7)) * 0.35;
    float alpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t)) * smoothstep(0.18, 0.75, bands) * 0.6;
    vec3 col = mix(vec3(0.75, 0.45, 1.0), vec3(1.0, 0.65, 0.8), bands);
    gl_FragColor = vec4(col * 0.85, alpha);
}
`;

const STAR_VERTEX = `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
varying float vGlow;

void main() {
    vGlow = 0.45 + 0.55 * sin(uTime * (0.6 + fract(aPhase * 7.31) * 1.8) + aPhase * 40.0);
    vec4 mv = viewMatrix * vec4(position + cameraPosition, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel;
}
`;

const STAR_FRAGMENT = `
varying float vGlow;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vec3(0.85, 0.93, 1.0) * a * a * vGlow * 2.4, 1.0);
}
`;

export function createSky(ctx) {
    const { renderer, scene, camera, quality, noise } = ctx;

    // --- Baked sky cube ---
    const cube = new THREE.WebGLCubeRenderTarget(quality.skySize, { colorSpace: THREE.SRGBColorSpace, generateMipmaps: false });
    const bakeScene = new THREE.Scene();
    const bakeMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        uniforms: { uSun: { value: SUN_DIRECTION } },
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: BAKE_FRAGMENT(noise),
    });
    const bakeMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), bakeMaterial);
    bakeScene.add(bakeMesh);
    const cubeCamera = new THREE.CubeCamera(0.1, 100, cube);
    cubeCamera.update(renderer, bakeScene);
    bakeMesh.geometry.dispose();
    bakeMaterial.dispose();
    scene.background = cube.texture;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromCubemap(cube.texture);
    pmrem.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.85;

    // --- Sun ---
    const sunDistance = 2600;
    const sunRadius = sunDistance * Math.tan(THREE.MathUtils.degToRad(12.5));
    const sunMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: ctx.time },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vRay;
            void main() {
                vUv = uv;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vRay = world.xyz - cameraPosition;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: SUN_FRAGMENT,
    });
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMaterial);
    sun.scale.setScalar(sunRadius * 2 * 2.6);
    sun.frustumCulled = false;
    sun.renderOrder = -2;
    scene.add(sun);

    // --- Planet ---
    const planetDirection = new THREE.Vector3(0.56, 0.3, -0.78).normalize();
    const planetDistance = 2100;
    const planetRadius = 240;
    const planet = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 56, 36),
        new THREE.ShaderMaterial({
            uniforms: { uSun: { value: SUN_DIRECTION } },
            vertexShader: `
                varying vec3 vNormalW;
                varying vec3 vNormalO;
                varying vec3 vWorld;
                void main() {
                    vNormalO = normal;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    vec4 world = modelMatrix * vec4(position, 1.0);
                    vWorld = world.xyz;
                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,
            fragmentShader: PLANET_FRAGMENT(noise),
        }),
    );
    const rings = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 2.35, 128, 1),
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: RING_FRAGMENT(noise),
        }),
    );
    rings.rotation.x = Math.PI / 2;
    planet.add(body, rings);
    planet.rotation.set(0.42, 0, -0.38);
    planet.scale.setScalar(planetRadius);
    planet.traverse(object => { object.frustumCulled = false; });
    rings.renderOrder = -1;
    scene.add(planet);

    // --- Twinkling stars ---
    const starCount = quality.low ? 500 : 1100;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
        const y = 0.03 + Math.random() * 0.97;
        const angle = Math.random() * Math.PI * 2;
        const radial = Math.sqrt(1 - y * y);
        starPositions.set([Math.cos(angle) * radial * 3000, y * 3000, Math.sin(angle) * radial * 3000], i * 3);
        starSizes[i] = 1.4 + Math.random() ** 3 * 3.2;
        starPhases[i] = Math.random();
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
    const starMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: ctx.time, uPixel: { value: 1 } },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.frustumCulled = false;
    stars.renderOrder = -3;
    scene.add(stars);

    // --- Shooting stars ---
    const meteorCount = 4;
    const meteorPositions = new Float32Array(meteorCount * 6);
    const meteorColors = new Float32Array(meteorCount * 6);
    const meteorGeometry = new THREE.BufferGeometry();
    meteorGeometry.setAttribute('position', new THREE.BufferAttribute(meteorPositions, 3));
    meteorGeometry.setAttribute('color', new THREE.BufferAttribute(meteorColors, 3));
    const meteors = new THREE.LineSegments(meteorGeometry, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    }));
    meteors.frustumCulled = false;
    meteors.renderOrder = -1;
    scene.add(meteors);
    const meteorState = Array.from({ length: meteorCount }, () => ({ life: 0, wait: 1 + Math.random() * 5, head: new THREE.Vector3(), velocity: new THREE.Vector3() }));

    function updateMeteors(dt, origin) {
        for (let i = 0; i < meteorCount; i++) {
            const meteor = meteorState[i];
            if (meteor.life <= 0) {
                meteor.wait -= dt;
                if (meteor.wait <= 0) {
                    const angle = (Math.random() - 0.5) * 2.2 - Math.PI / 2;
                    const height = 0.25 + Math.random() * 0.5;
                    meteor.head.set(Math.cos(angle) * 1500, height * 1500, Math.sin(angle) * 1500);
                    const side = Math.random() < 0.5 ? -1 : 1;
                    meteor.velocity.set(side * (520 + Math.random() * 520), -170 - Math.random() * 200, (Math.random() - 0.5) * 240);
                    meteor.life = 1;
                    meteor.wait = 2.5 + Math.random() * 7;
                }
            } else {
                meteor.life -= dt * 0.9;
                meteor.head.addScaledVector(meteor.velocity, dt);
            }
            const glow = Math.max(meteor.life, 0) * Math.min((1 - meteor.life) * 6, 1) * 2.2;
            const offset = i * 6;
            meteorPositions[offset] = origin.x + meteor.head.x;
            meteorPositions[offset + 1] = origin.y + meteor.head.y;
            meteorPositions[offset + 2] = origin.z + meteor.head.z;
            meteorPositions[offset + 3] = origin.x + meteor.head.x - meteor.velocity.x * 0.22;
            meteorPositions[offset + 4] = origin.y + meteor.head.y - meteor.velocity.y * 0.22;
            meteorPositions[offset + 5] = origin.z + meteor.head.z - meteor.velocity.z * 0.22;
            meteorColors.set([glow, glow, glow * 1.1, 0, 0, 0], offset);
        }
        meteorGeometry.attributes.position.needsUpdate = true;
        meteorGeometry.attributes.color.needsUpdate = true;
    }

    return {
        update(state) {
            const origin = camera.position;
            sun.position.copy(origin).addScaledVector(SUN_DIRECTION, sunDistance);
            sun.lookAt(origin);
            planet.position.copy(origin).addScaledVector(planetDirection, planetDistance);
            starMaterial.uniforms.uPixel.value = state.pixelRatio;
            updateMeteors(state.dt, origin);
        },
        dispose() {
            cube.dispose();
            environment.dispose();
        },
    };
}

