import * as THREE from 'three';
import { drapeTexture } from './textures.js';

const drape = drapeTexture();

export const curtainClock = { value: 0 };
export const curtainSway = { value: 1 };
export const curtainBreeze = { value: 1 };

/* ------------------------------------------------------------------ *
 *  Heavy theatrical drapery.
 *  Folds + breeze are evaluated analytically in the vertex shader so
 *  normals stay exact while the cloth moves. Both the top edge (batten)
 *  and the bottom hem are pinned; the belly of the cloth does the work.
 * ------------------------------------------------------------------ */
function curtainMaterial({ freq, amp, phase, weight, color = 0x0e1013, sheen = 0.38, scale = 1, sheenColor = 0x39424e }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.95,
    metalness: 0.0,
    sheen,
    sheenColor: new THREE.Color(sheenColor),
    sheenRoughness: 0.6,
    side: THREE.DoubleSide,
    normalMap: drape.normalMap,
    roughnessMap: drape.roughnessMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
  });

  const uniforms = {
    uTime: curtainClock,
    uSway: curtainSway,
    uSpeed: curtainBreeze,
    uFreq: { value: freq },
    uAmp: { value: amp },
    uPhase: { value: phase },
    uWeight: { value: weight },
  };

  mat.onBeforeCompile = (shader) => {
    if (typeof window !== 'undefined') window.__drapeCompiles = (window.__drapeCompiles || 0) + 1;
    Object.assign(shader.uniforms, uniforms);
    if (typeof window !== 'undefined') window.__drapeHasFold = shader.vertexShader.includes('#include <common>') && shader.fragmentShader.includes('#include <color_fragment>');
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uSway;
        uniform float uSpeed;
        uniform float uFreq;
        uniform float uAmp;
        uniform float uPhase;
        uniform float uWeight;
        varying float vDrapeFold;

        // static pleating: broad harmonics only, no high-frequency ripple
        float drapeFold(vec2 p, vec2 uvv) {
          float free = pow(clamp(1.0 - uvv.y, 0.0, 1.0), 1.1);
          free *= smoothstep(0.0, 0.055, uvv.y);       // hem sits on the floor
          float amp = uAmp * (0.1 + 0.9 * free) * uWeight;
          float x = p.x;
          float f = sin(x * uFreq + uPhase + sin(p.y * 0.16 + uPhase) * 0.55)
                  + sin(x * uFreq * 0.47 + 1.6 + uPhase * 0.6) * 0.34;
          float ampMod = 0.74 + 0.26 * sin(x * 0.19 + uPhase * 1.3);
          f = sign(f) * pow(abs(f) * 0.86, 0.95);
          return amp * ampMod * f;
        }

        // returns displacement along local Z; writes lateral shift through out-params
        float drapeZ(vec2 p, vec2 uvv, out float xoff) {
          float t = uTime * uSpeed;
          float free = pow(clamp(1.0 - uvv.y, 0.0, 1.0), 1.1);
          free *= smoothstep(0.0, 0.055, uvv.y);
          float x = p.x;
          float breeze = sin(t * 0.41 + x * 0.26 + p.y * 0.2) * 0.55
                       + sin(t * 0.19 - x * 0.13 + 1.7) * 0.3
                       + sin(t * 0.08 + x * 0.05 + 0.4) * 0.15;
          xoff = uSway * 0.014 * free * sin(t * 0.33 + p.y * 0.28 + uPhase);
          return drapeFold(p, uvv) + uSway * 0.015 * free * breeze;
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `float _xoff;
        float _z0 = drapeZ(position.xy, uv, _xoff);
        float _e = 0.012;
        float _xoff2;
        float _zx = (drapeZ(position.xy + vec2(_e, 0.0), uv, _xoff2) - _z0) / _e;
        float _zy = (drapeZ(position.xy + vec2(0.0, _e), uv + vec2(0.0, _e / max(uAmp * 8.0, 0.5)), _xoff2) - _z0) / _e;
        vec3 objectNormal = normalize(vec3(-_zx, -_zy, 1.0));
        vDrapeFold = clamp(0.5 + drapeFold(position.xy, uv) / max(uAmp * uWeight * 2.6, 0.0001), 0.0, 1.0);`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position.x + _xoff, position.y, position.z + _z0);`
      );

    // Bake the pleats into the albedo so the velvet reads folded even where
    // the key barely reaches it — crests catch light, valleys fall to black.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n        varying float vDrapeFold;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= (0.34 + 1.16 * vDrapeFold) * ${scale.toFixed(3)};`
      );
  };
  mat.customProgramCacheKey = () => `drape-${freq}-${amp}-${phase}-${color}-${scale}`;
  return mat;
}

/**
 * A hanging curtain panel in the XY plane, facing +Z.
 */
export function createCurtain({
  width,
  height,
  x = 0,
  y = 0,
  z = 0,
  segX = 160,
  segY = 46,
  freq = 20,
  amp = 0.1,
  phase = 0,
  weight = 1,
  color,
  sheen,
  scale,
  sheenColor,
}) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const mat = curtainMaterial({ freq, amp, phase, weight, color, sheen, scale, sheenColor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false; // displacement can exceed the bound slightly
  return mesh;
}

/**
 * Builds the full screen surround: two legs, a valance and the stage skirt.
 */
export function buildDrapery({ screenW, screenH, screenBottom, stageY, ceilY, z }) {
  const group = new THREE.Group();
  const halfW = screenW / 2;
  const legW = 4.3;
  // legs run from the screen edge out to the proscenium wall
  const legsX = halfW - 0.06 + legW / 2;
  const topY = ceilY;

  for (const side of [-1, 1]) {
    const leg = createCurtain({
      width: legW,
      height: topY - stageY,
      x: side * legsX,
      y: stageY + (topY - stageY) / 2,
      z,
      segX: 200,
      segY: 70,
      freq: 8.6,
      amp: 0.24,
      phase: side > 0 ? 0.9 : 3.6,
      weight: 1.0,
      color: 0x1b1f25,
    });
    leg.rotation.y = side * 0.012;
    group.add(leg);
  }

  const valance = createCurtain({
    width: screenW + legW * 2 + 0.4,
    height: 0.62,
    x: 0,
    y: topY - 0.29,
    z: z + 0.02,
    segX: 300,
    segY: 22,
    freq: 11.0,
    amp: 0.1,
    phase: 1.4,
    weight: 0.8,
    color: 0x08090b,
  });
  group.add(valance);

  const skirtH = screenBottom - stageY + 0.04;
  const skirt = createCurtain({
    width: screenW + 0.14,
    height: skirtH,
    x: 0,
    y: stageY + skirtH / 2 - 0.01,
    z: z + 0.05,
    segX: 280,
    segY: 40,
    freq: 12.5,
    amp: 0.09,
    phase: 0.2,
    weight: 0.9,
    color: 0x050506,
    sheen: 0.02,
    scale: 0.012,
    sheenColor: 0x252b33,
  });
  group.add(skirt);

  return group;
}
