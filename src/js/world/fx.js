/**
 * Atmosphere: drifting dust, speed streaks, floating monoliths that stream past
 * with the ground, and the gates the camera flies through on the way to the arcade.
 */
import * as THREE from 'three';

const BOX = 150;
const STREAM = 720;
const BEHIND = 90;

const FIELD_VERTEX = `
attribute vec3 aSeed;
attribute float aSize;
attribute float aEnd;
uniform vec3 uCamera;
uniform float uTravel;
uniform float uPixel;
uniform float uStretch;
uniform float uBox;
varying float vFade;
varying float vTint;

void main() {
    vec3 p = aSeed * vec3(uBox, 80.0, uBox);
    p.z += uTravel;
    vec2 rel = mod(p.xz - uCamera.xz + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 world = vec3(uCamera.x + rel.x, p.y + 0.4, uCamera.z + rel.y - aEnd * uStretch);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = max(-mv.z, 0.5);
    gl_PointSize = clamp(aSize * uPixel * 46.0 / depth, 1.0, 9.0 * uPixel);
    vFade = (1.0 - smoothstep(uBox * 0.28, uBox * 0.5, length(rel))) * smoothstep(0.8, 5.0, depth);
    vTint = fract(aSeed.x * 91.7 + aSeed.y * 13.1);
}
`;

const DUST_FRAGMENT = `
uniform float uStrength;
varying float vFade;
varying float vTint;

void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.05, 0.5, d);
    vec3 col = mix(vec3(0.35, 0.9, 1.0), vec3(1.0, 0.35, 0.75), step(0.55, vTint));
    col = mix(col, vec3(1.0), step(0.88, vTint));
    gl_FragColor = vec4(col * a * vFade * uStrength, 1.0);
}
`;

const STREAK_FRAGMENT = `
uniform float uStrength;
varying float vFade;
varying float vTint;

void main() {
    vec3 col = mix(vec3(0.45, 0.9, 1.0), vec3(1.0, 0.5, 0.85), step(0.6, vTint));
    gl_FragColor = vec4(col * vFade * uStrength, 1.0);
}
`;

export function createFx(ctx) {
    const { scene, camera, quality } = ctx;
    const random = mulberry(20261111);

    // --- Dust and speed streaks share one wrapped field around the camera ---
    const count = quality.dust;
    const seeds = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        seeds.set([random(), random() ** 1.6, random()], i * 3);
        sizes[i] = 0.6 + random() ** 2 * 2.4;
    }
    const fieldUniforms = {
        uCamera: { value: new THREE.Vector3() },
        uTravel: { value: 0 },
        uPixel: { value: 1 },
        uStretch: { value: 0 },
        uBox: { value: BOX },
        uStrength: { value: 0.9 },
    };
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    dustGeometry.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(count), 1));
    const dust = new THREE.Points(dustGeometry, new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: fieldUniforms,
        vertexShader: FIELD_VERTEX,
        fragmentShader: DUST_FRAGMENT,
    }));
    dust.frustumCulled = false;
    dust.renderOrder = 5;
    scene.add(dust);

    const streakCount = Math.round(count * 0.45);
    const streakSeeds = new Float32Array(streakCount * 6);
    const streakEnds = new Float32Array(streakCount * 2);
    for (let i = 0; i < streakCount; i++) {
        const seed = [random(), random() ** 1.3, random()];
        streakSeeds.set(seed, i * 6);
        streakSeeds.set(seed, i * 6 + 3);
        streakEnds[i * 2 + 1] = 1;
    }
    const streakUniforms = { ...fieldUniforms, uStrength: { value: 0 }, uStretch: { value: 0 } };
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(streakCount * 6), 3));
    streakGeometry.setAttribute('aSeed', new THREE.BufferAttribute(streakSeeds, 3));
    streakGeometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(streakCount * 2), 1));
    streakGeometry.setAttribute('aEnd', new THREE.BufferAttribute(streakEnds, 1));
    const streaks = new THREE.LineSegments(streakGeometry, new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: streakUniforms,
        vertexShader: FIELD_VERTEX,
        fragmentShader: STREAK_FRAGMENT,
    }));
    streaks.frustumCulled = false;
    streaks.renderOrder = 5;
    scene.add(streaks);

    // --- Monoliths ---
    const shapes = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.OctahedronGeometry(1, 0),
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.TetrahedronGeometry(1, 0),
    ];
    const edgeShapes = shapes.map(shape => new THREE.EdgesGeometry(shape));
    const palette = [new THREE.Color(0.2, 1.5, 2.0), new THREE.Color(2.0, 0.3, 1.2), new THREE.Color(1.0, 0.55, 2.0)];
    const monoliths = [];
    const monolithCount = quality.low ? 7 : 12;
    for (let i = 0; i < monolithCount; i++) {
        const shape = i % shapes.length;
        const side = i % 2 === 0 ? 1 : -1;
        const x = side * (34 + random() * 120);
        const size = 5 + random() * 11;
        const group = new THREE.Group();
        const wire = new THREE.LineSegments(edgeShapes[shape], new THREE.LineBasicMaterial({
            color: palette[i % palette.length],
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        const core = new THREE.Mesh(shapes[shape], new THREE.MeshBasicMaterial({ color: 0x07031a, transparent: true, opacity: 0.6 }));
        core.scale.setScalar(0.985);
        group.add(core, wire);
        group.scale.setScalar(size);
        group.renderOrder = 3;
        wire.renderOrder = 3;
        core.renderOrder = 3;
        scene.add(group);
        monoliths.push({
            group,
            wire,
            core,
            x,
            y: 16 + Math.abs(x) * 0.42 + random() * 26 + size,
            z: (i / monolithCount) * STREAM + random() * 30,
            spin: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.5),
        });
    }

    // --- Gates along the flight path ---
    const gates = [];
    const gateColors = [new THREE.Color(0.2, 1.5, 2.1), new THREE.Color(2.1, 0.3, 1.2)];
    const gateGeometry = new THREE.TorusGeometry(8.5, 0.11, 8, 120);
    const gateOuter = new THREE.TorusGeometry(10, 0.045, 6, 120);
    const forward = new THREE.Vector3(0, 0, 1);

    function setGates(points) {
        while (gates.length < points.length) {
            const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
            const group = new THREE.Group();
            group.add(new THREE.Mesh(gateGeometry, material), new THREE.Mesh(gateOuter, material));
            group.traverse(object => { object.renderOrder = 4; });
            scene.add(group);
            gates.push({ group, material, tint: gateColors[gates.length % 2] });
        }
        gates.forEach((gate, i) => {
            const point = points[i];
            gate.placed = Boolean(point);
            gate.group.visible = false;
            if (!point) return;
            gate.group.position.copy(point.position);
            gate.group.quaternion.setFromUnitVectors(forward, point.tangent);
        });
    }

    return {
        setGates,
        update(state) {
            const position = camera.position;
            fieldUniforms.uCamera.value.copy(position);
            fieldUniforms.uTravel.value = state.travel % BOX;
            fieldUniforms.uPixel.value = state.pixelRatio;
            const rush = THREE.MathUtils.clamp(state.rush, 0, 1);
            streakUniforms.uStrength.value = rush * 0.9;
            streakUniforms.uStretch.value = 2 + rush * 26;
            streaks.visible = rush > 0.02;

            for (const monolith of monoliths) {
                const ahead = STREAM - BEHIND;
                const rel = THREE.MathUtils.euclideanModulo(monolith.z + state.travel - position.z + ahead, STREAM) - ahead;
                monolith.group.position.set(monolith.x, monolith.y, position.z + rel);
                monolith.group.rotation.x += monolith.spin.x * state.dt;
                monolith.group.rotation.y += monolith.spin.y * state.dt;
                monolith.group.rotation.z += monolith.spin.z * state.dt;
                const fade = THREE.MathUtils.smoothstep(-rel, -BEHIND, -BEHIND + 50) * (1 - THREE.MathUtils.smoothstep(-rel, ahead - 230, ahead - 20));
                monolith.wire.material.opacity = fade;
                monolith.core.material.opacity = fade * 0.6;
                monolith.group.visible = fade > 0.01;
            }

            for (const gate of gates) {
                if (!gate.placed) continue;
                gate.group.visible = state.gateOn > 0.001;
                if (!gate.group.visible) continue;
                const distance = gate.group.position.distanceTo(position);
                const near = 1 - THREE.MathUtils.smoothstep(distance, 4, 60);
                const fade = (1 - THREE.MathUtils.smoothstep(distance, 150, 300)) * state.gateOn;
                gate.material.color.copy(gate.tint).multiplyScalar(fade * (0.75 + near * 1.6));
            }
        },
        dispose() {
            dustGeometry.dispose();
            streakGeometry.dispose();
        },
    };
}

function mulberry(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

