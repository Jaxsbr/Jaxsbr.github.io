/**
 * Terrain: an endless neon grid valley flanked by low-poly mountains.
 *
 * The mesh is a window onto a fixed lattice. It follows the camera in whole cells,
 * and the lattice itself slides toward the camera by "travel", so the ground appears
 * to rush past while every vertex keeps the same height.
 */
import * as THREE from 'three';

const CELL = 4;

const VERTEX = noise => `
uniform vec2 uOrigin;
uniform vec2 uShift;
uniform float uCell;
varying vec3 vWorld;
varying vec2 vLocal;
varying vec2 vLattice;
varying float vMountain;
${noise}

float terrainHeight(vec2 c, out float mountain) {
    float ax = abs(c.x * uCell);
    mountain = smoothstep(26.0, 78.0, ax);
    float far = smoothstep(40.0, 240.0, ax);
    float ridge = noise2(c * 0.085 + 17.0);
    float detail = noise2(c * 0.21 + 5.0);
    float jag = hash21(c);
    float h = 2.0 + pow(ridge, 1.5) * (20.0 + 62.0 * far) + detail * 9.0 * (0.4 + far) + jag * (3.0 + 8.0 * far);
    return mountain * h;
}

void main() {
    vec2 local = position.xz / uCell;
    vec2 lattice = local + uOrigin;
    float mountain;
    float h = terrainHeight(lattice, mountain);
    vec3 world = vec3(position.x + uShift.x, h, position.z + uShift.y);
    vWorld = world;
    vLocal = local;
    vLattice = lattice;
    vMountain = mountain;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = noise => `
uniform float uTime;
uniform vec3 uCamera;
uniform vec3 uArena;
uniform float uArenaRadius;
uniform float uRingRadius;
uniform float uArenaOn;
uniform vec3 uPointer;
uniform float uFadeNear;
uniform float uFadeFar;
varying vec3 vWorld;
varying vec2 vLocal;
varying vec2 vLattice;
varying float vMountain;
${noise}

void main() {
    float dist = distance(vWorld, uCamera);
    float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
    if (fade < 0.004) discard;

    // Grid lines, anti-aliased and thinned out before they turn to noise in the distance.
    vec2 width = fwidth(vLocal);
    vec2 d = abs(fract(vLocal - 0.5) - 0.5);
    vec2 density = clamp(1.0 - width * 1.7, 0.0, 1.0);
    vec2 lines = (1.0 - smoothstep(vec2(0.011), vec2(0.011) + width * 1.25, d)) * density;
    vec2 glows = exp(-d * 14.0) * density;
    float line = max(lines.x, lines.y);
    float glow = max(glows.x, glows.y);

    // Light packets racing toward the camera along the long lines.
    float lane = floor(vLattice.x + 0.5);
    float phase = -vLattice.y * 0.035 + uTime * (0.1 + hash11(lane) * 0.16) + hash11(lane + 7.0) * 10.0;
    float comet = pow(1.0 - fract(phase), 16.0) * step(0.55, hash11(lane + 3.0));

    // Faceted mountain shading.
    vec3 facet = cross(dFdx(vWorld), dFdy(vWorld));
    float facetLength = length(facet);
    vec3 normal = facetLength > 1e-9 ? facet / facetLength : vec3(0.0, 1.0, 0.0);
    if (normal.y < 0.0) normal = -normal;
    float skyLight = normal.y * 0.5 + 0.5;
    float key = max(dot(normal, normalize(vec3(-0.45, 0.5, 0.74))), 0.0);
    float rim = pow(max(dot(normal, normalize(vec3(0.0, 0.3, -1.0))), 0.0), 1.5);
    vec3 col = mix(vec3(0.006, 0.002, 0.018), vec3(0.016, 0.006, 0.05), skyLight);
    col += vMountain * (vec3(0.02, 0.03, 0.11) * key + vec3(0.5, 0.09, 0.32) * rim * 0.4);
    col += vMountain * vec3(0.14, 0.02, 0.13) * smoothstep(18.0, 90.0, vWorld.y) * 0.3;

    vec3 lineColor = mix(vec3(1.0, 0.15, 0.6), vec3(0.15, 0.85, 1.0), smoothstep(1.0, 36.0, vWorld.y));
    float reachFade = mix(1.0, 0.45, smoothstep(40.0, 320.0, dist));
    col += lineColor * (line * 1.35 + glow * 0.1) * reachFade;
    col += vec3(0.8, 0.95, 1.0) * comet * lines.x * 3.0 * (1.0 - vMountain);

    // The sun laid across the valley floor like wet glass.
    float valley = 1.0 - vMountain;
    float ahead = 1.0 - smoothstep(-40.0, 0.0, vWorld.z - uCamera.z);
    float across = (vWorld.x - uCamera.x) / (5.0 + dist * 0.075);
    float streak = exp(-across * across) * smoothstep(10.0, 170.0, dist) * valley * ahead;
    col += vec3(1.0, 0.42, 0.34) * streak * 0.1;
    col += lineColor * line * streak * 1.0;

    // A soft light under the pointer.
    float reach = length(vWorld.xz - uPointer.xy);
    col += lineColor * (line * 1.6 + 0.05) * exp(-reach * reach / 90.0) * uPointer.z;

    // The arcade floor: darker, glossy, ringed with light.
    vec2 away = vWorld.xz - uArena.xz;
    float radius = length(away);
    float inside = (1.0 - smoothstep(uArenaRadius, uArenaRadius + 3.5, radius)) * uArenaOn;
    col = mix(col, col * 0.3 + vec3(0.006, 0.002, 0.02), inside * 0.85);
    float rings = exp(-abs(radius - (uRingRadius + 1.9)) * 26.0);
    rings += exp(-abs(radius - (uRingRadius - 1.15)) * 30.0) * 0.55;
    rings += exp(-abs(radius - (uArenaRadius + 1.4)) * 16.0) * 0.8;
    float angle = radius > 0.001 ? atan(away.y, away.x) : 0.0;
    float ticks = step(0.5, fract(angle * 5.7296 + uTime * 0.035)) * exp(-abs(radius - (uArenaRadius + 2.5)) * 4.5);
    col += (vec3(0.2, 0.9, 1.0) * rings * 1.05 + vec3(1.0, 0.2, 0.6) * ticks * 0.8) * uArenaOn;
    float alpha = mix(1.0, 0.58, inside);

    float haze = smoothstep(30.0, uFadeFar, dist);
    col = mix(col, vec3(0.2, 0.035, 0.22), haze * haze * 0.7);

    gl_FragColor = vec4(col, alpha * fade);
}
`;

export function createTerrain(ctx) {
    const { scene, quality, noise, arena, ringRadius } = ctx;
    const segments = quality.low ? 140 : 190;
    const size = segments * CELL;
    const ahead = Math.round(segments * 0.3);

    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const uniforms = {
        uTime: ctx.time,
        uCell: { value: CELL },
        uOrigin: { value: new THREE.Vector2() },
        uShift: { value: new THREE.Vector2() },
        uCamera: { value: new THREE.Vector3() },
        uArena: { value: arena },
        uArenaRadius: { value: ringRadius + 3.4 },
        uRingRadius: { value: ringRadius },
        uArenaOn: { value: 0 },
        uPointer: { value: new THREE.Vector3() },
        uFadeNear: { value: size * 0.5 * 0.62 },
        uFadeFar: { value: size * 0.5 * 0.96 },
    };

    const material = new THREE.ShaderMaterial({
        transparent: true,
        uniforms,
        vertexShader: VERTEX(noise),
        fragmentShader: FRAGMENT(noise),
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    scene.add(mesh);

    return {
        update(state) {
            const { camera, travel } = state;
            const ox = Math.round(camera.position.x / CELL);
            const oz = Math.round((camera.position.z - travel) / CELL) - ahead;
            uniforms.uOrigin.value.set(ox, oz);
            uniforms.uShift.value.set(ox * CELL, oz * CELL + travel);
            uniforms.uCamera.value.copy(camera.position);
            uniforms.uArenaOn.value = state.arenaOn;
            uniforms.uPointer.value.copy(state.pointerGround);
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}

