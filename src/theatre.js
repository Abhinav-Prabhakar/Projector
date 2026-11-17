import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildRoom, DIM } from './room.js';
import { buildSeating } from './seats.js';
import { buildDrapery, curtainClock, curtainSway, curtainBreeze } from './curtains.js';
import { glowSprite, softDisc, mulberry32 } from './textures.js';

RectAreaLightUniformsLib.init();

/* ------------------------------------------------------------------ *
 *  Procedural environment for subtle specular response
 * ------------------------------------------------------------------ */
function makeEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x030406);

  const screenPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 7),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5d6f8f) })
  );
  screenPanel.position.set(0, 5.5, -12);
  envScene.add(screenPanel);

  const ceilingPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a3229) })
  );
  ceilingPanel.rotation.x = Math.PI / 2;
  ceilingPanel.position.set(0, 9.5, 1);
  envScene.add(ceilingPanel);

  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 9),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6a4a2c) })
    );
    strip.rotation.y = -s * Math.PI / 2;
    strip.position.set(s * 8, 6, 0);
    envScene.add(strip);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.1);
  pmrem.dispose();
  envScene.traverse((o) => {
    if (o.material) o.material.dispose();
    if (o.geometry) o.geometry.dispose();
  });
  return rt.texture;
}

/* ------------------------------------------------------------------ *
 *  Volumetric projector shaft
 * ------------------------------------------------------------------ */
function makeBeam(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.06, 7.6, len, 44, 1, true);
  // cylinder is along +Y with top at +len/2: shift so the apex sits at the origin
  geo.translate(0, -len / 2, 0);
  geo.rotateX(-Math.PI / 2); // apex at origin, opens toward -Z

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.1 },
      uColor: { value: new THREE.Color(0xcfe0ff) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormalW), V));
        float core = pow(facing, 2.4);
        float along = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        float dust = 0.75 + 0.25 * noise(vUv * vec2(16.0, 7.0) + vec2(uTime * 0.03, -uTime * 0.012));
        float a = core * along * dust * uOpacity;
        a *= 0.65 + 0.35 * smoothstep(0.0, 0.5, vUv.x);
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from);
  mesh.lookAt(to); // -Z of the mesh points toward the screen
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ *
 *  Floating dust
 * ------------------------------------------------------------------ */
function makeDust(count = 900) {
  const rand = mulberry32(4242);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 17;
    pos[i * 3 + 1] = 0.9 + rand() * 10.2;
    pos[i * 3 + 2] = -16 + rand() * 22;
    seed[i] = rand() * 100;
    size[i] = 0.5 + rand() * 1.7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: softDisc() },
      uOpacity: { value: 0.5 },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      varying float vFade;
      void main() {
        vec3 p = position;
        float t = uTime * 0.12 + aSeed;
        p.x += sin(t * 0.7 + aSeed) * 0.55;
        p.y += sin(t * 0.43 + aSeed * 1.7) * 0.42;
        p.z += cos(t * 0.31 + aSeed * 0.7) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale * (34.0 / -mv.z);
        vFade = smoothstep(0.0, 6.0, -mv.z) * smoothstep(30.0, 8.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vFade * uOpacity * 0.5;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(0.92, 0.9, 0.84), a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}

/* ------------------------------------------------------------------ *
 *  Theatre assembly
 * ------------------------------------------------------------------ */
export function createTheatre(scene, renderer, camera) {
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.07;
  scene.fog = new THREE.FogExp2(0x05070a, 0.0068);

  const room = buildRoom();
  scene.add(room.group);

  const drapery = buildDrapery({
    screenW: DIM.screenW,
    screenH: DIM.screenH,
    screenBottom: DIM.screenBottom,
    stageY: DIM.stageY,
    ceilY: DIM.soffit,
    z: DIM.drapeZ,
  });
  scene.add(drapery);

  const seating = buildSeating({
    rows: 12,
    perRow: 23,
    pitch: 0.78,
    rowPitch: 1.0,
    frontZ: DIM.audFloorStartZ - 0.82,
    floorY: (z) => DIM.floorY(z),
  });
  scene.add(seating);

  /* ---------------------------------------------------------------- lights */
  // The screen's spill, modelled as a soft spot so it washes the seats and
  // not the drapery hanging in the screen plane.
  const screenLight = new THREE.SpotLight(0xfff0d8, 84, 40, 1.05, 1.0, 1.05);
  screenLight.position.set(0, DIM.screenBottom + DIM.screenH * 0.22, DIM.screenZ + 1.1);
  screenLight.target.position.set(0, 1.1, 2.0);
  scene.add(screenLight, screenLight.target);

  const houseArea = new THREE.RectAreaLight(0xffe4c4, 0.045, 16, 15);
  houseArea.position.set(0, DIM.ceil - 0.55, 0.5);
  houseArea.lookAt(0, 0, 0.5);
  scene.add(houseArea);

  // house key: a warm practical from the rear of the auditorium, so the
  // seating falls off into the dark towards the screen like the reference
  const key = new THREE.SpotLight(0xffd9ac, 132, 26, 0.62, 0.92, 1.25);
  key.position.set(0, 9.8, 4.4);
  key.target.position.set(0, 1.1, 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 36;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 6;
  scene.add(key, key.target);

  const fill = new THREE.HemisphereLight(0x252b33, 0x070503, 0.02);
  scene.add(fill);

  const spots = [];
  for (const x of [-4.35, 0, 4.35]) {
    const s = new THREE.SpotLight(0xfff0da, 30, 26, 0.5, 0.95, 1.35);
    s.position.set(x, DIM.soffit - 0.04, -11.65);
    s.target.position.set(x * 0.72, DIM.stageY + 0.4, DIM.drapeZ + 3.4);
    scene.add(s, s.target);
    spots.push(s);
  }

  // broad wash over the stage floor + drapery fronts
  const stageWash = new THREE.RectAreaLight(0xfff1de, 0.8, 7.4, 4.2);
  stageWash.position.set(0, DIM.soffit - 0.12, -10.9);
  stageWash.lookAt(0, DIM.stageY, -10.9);
  scene.add(stageWash);

  // grazing practicals that rake the drapery folds
  const legRakes = [];
  for (const sgn of [-1, 1]) {
    const sp = new THREE.SpotLight(0xffefdc, 72, 17, 0.42, 0.98, 1.05);
    sp.position.set(sgn * 3.6, DIM.soffit - 0.12, -11.0);
    sp.target.position.set(sgn * 7.2, 5.9, DIM.drapeZ - 0.15);
    scene.add(sp, sp.target);
    legRakes.push(sp);
  }

  // gentle front wash that reveals the drapery folds
  const drapeWash = new THREE.SpotLight(0xfff4e6, 46, 36, 0.6, 1.0, 0.82);
  drapeWash.position.set(0, 8.2, 3.4);
  drapeWash.target.position.set(0, 6.0, DIM.drapeZ);
  scene.add(drapeWash, drapeWash.target);

  // broad practical over the stage floor: a wide, slowly-decaying wash so
  // the whole apron reads as one lit plane instead of a hot pool
  const apronLight = new THREE.SpotLight(0xffeed6, 19, 30, 1.0, 0.9, 0.62);
  apronLight.position.set(0, DIM.soffit - 0.12, -10.4);
  apronLight.target.position.set(0, DIM.stageY, -10.4);
  scene.add(apronLight, apronLight.target);

  // narrow practical that lifts the rear of the deck, where the skirt and
  // the screen above it leave the apron in shadow
  const rearDeck = new THREE.SpotLight(0xfff0d6, 46, 14, 0.36, 1.0, 0.9);
  rearDeck.position.set(0, DIM.soffit - 0.16, -12.35);
  rearDeck.target.position.set(0, DIM.stageY, -12.35);
  scene.add(rearDeck, rearDeck.target);

  // screen bounce onto the apron
  const screenBounce = new THREE.PointLight(0xdfe7ff, 5.4, 16, 1.7);
  screenBounce.position.set(0, 5.2, DIM.screenZ + 3.4);
  scene.add(screenBounce);

  // little pools of spill on the ceiling around each fixture
  const ceilingGlows = [];
  for (const x of [-4.15, 0, 4.15]) {
    const p = new THREE.PointLight(0xffe9c9, 4.2, 7.2, 1.7);
    p.position.set(x, DIM.soffit - 0.34, -11.55);
    scene.add(p);
    ceilingGlows.push(p);
  }

  // cove glow along the side walls
  const coveLights = [];
  for (const s of [-1, 1]) {
    for (let z = -12; z <= 8; z += 5) {
      const p = new THREE.PointLight(0xffc98f, 0.3, 9, 2.0);
      p.position.set(s * (DIM.halfW - 0.55), DIM.ceil - 0.75, z);
      scene.add(p);
      coveLights.push(p);
    }
  }

  // exit sign spill
  const exitLights = [];
  for (const s of [-1, 1]) {
    const p = new THREE.PointLight(0x45ff9f, 1.6, 5.2, 2.0);
    p.position.set(s * (DIM.halfW - 0.62), 4.9, -13.1);
    scene.add(p);
    exitLights.push(p);
  }

  /* ---------------------------------------------------------------- beam */
  const projectorPos = new THREE.Vector3(0, 9.9, 9.55);
  const beam = makeBeam(projectorPos, new THREE.Vector3(0, DIM.screenBottom + DIM.screenH / 2, DIM.screenZ + 0.1));
  scene.add(beam);

  const dust = makeDust(520);
  scene.add(dust);

  /* --------------------------------------------------------------- updater */
  const state = {
    screen: 1, house: 0.9, stage: 1, cove: 0.8, exits: 1, beam: 0.24,
    sway: 1, breeze: 1, haze: 1,
  };

  const exitFaceMats = [];
  room.group.traverse((o) => {
    if (o.userData.exitMat) exitFaceMats.push(o.material);
    if (o.isSprite && o.material.color && o.material.color.g > 0.5 && o.material.color.b > 0.3) {
      // green halo sprites
      o.userData.exitHalo = true;
    }
  });
  const exitHalos = [];
  room.group.traverse((o) => {
    if (o.isSprite && o.material.color.getHex() === 0x53ffa8) exitHalos.push(o.material);
  });

  const houseLights = [houseArea, key];

  function update(dt, time, params) {
    Object.assign(state, params);

    curtainClock.value = time;
    curtainSway.value = state.sway;
    curtainBreeze.value = state.breeze;

    room.screenMat.emissiveIntensity = 1.5 * state.screen * (1 + Math.sin(time * 0.9) * 0.004);
    screenLight.intensity = 84 * state.screen;
    // screen emissive also feeds a touch of local spill toward the stage
    screenLight.visible = state.screen > 0.01;

    houseArea.intensity = 0.045 * state.house;
    key.intensity = 132 * state.house;
    fill.intensity = 0.006 + state.house * 0.008;

    for (const s of spots) s.intensity = 30 * state.stage;
    room.apronGlow.material.opacity = 0.22 * state.stage;
    apronLight.intensity = 19 * state.stage;
    rearDeck.intensity = 46 * state.stage;
    for (const l of legRakes) l.intensity = 78 * state.stage;
    const houseUp = Math.max(0, state.house - 0.95);
    room.wallMat.emissiveIntensity = 0.07 + 0.16 * houseUp;
    for (const l of ceilingGlows) l.intensity = 8 * state.stage + 30 * houseUp;
    stageWash.intensity = 0.8 * state.stage;
    drapeWash.intensity = 40 * state.stage;
    screenBounce.intensity = 5.4 * state.screen;
    for (const l of coveLights) l.intensity = 0.18 * state.cove;

    for (const m of exitFaceMats) m.emissiveIntensity = 3.8 * state.exits;
    for (const m of exitHalos) m.opacity = 0.1 * state.exits;
    for (const l of exitLights) l.intensity = 1.1 * state.exits;
    for (const p of room.pinSpots) {
      // pin spots go dark with the house
    }

    beam.material.uniforms.uOpacity.value = 0.13 * state.beam;
    beam.visible = state.beam > 0.005;
    dust.material.uniforms.uTime.value = time;
    dust.material.uniforms.uOpacity.value = 0.05 + state.beam * 0.16;
    beam.material.uniforms.uTime.value = time;

    scene.fog.density = 0.0068 * state.haze;

    // gently breathe the beam
    const flicker = 1 + Math.sin(time * 2.3) * 0.008 + Math.sin(time * 7.1) * 0.004;
    beam.material.uniforms.uOpacity.value *= flicker;
  }

  return { update, room, drapery, seating, beam, dust, screenLight };
}
