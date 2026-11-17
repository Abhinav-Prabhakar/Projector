import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seatFabric, brushedMetal, softDisc, mulberry32 } from './textures.js';

const fabric = seatFabric();
const metal = brushedMetal();

function xform(geo, { rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0 }) {
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

// merging requires a consistent attribute layout
function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('tangent');
  g.clearGroups();
  return g;
}

/* Baked ambient occlusion in vertex colours: this is what stops the
   upholstery reading as flat plastic. Top-facing, high surfaces stay
   bright; the shadowed lower rear and the crevices fall away. */
function bakeAO(geo, power = 1) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const ny = nrm.getY(i);
    const up = Math.max(0, ny);
    let v = 0.10 + up * 0.2 + THREE.MathUtils.smoothstep(y, 0.62, 1.34) * 0.5;
    if (y < 0.6) v = Math.max(v, 0.5 + up * 0.18);
    const g = Math.min(1, Math.max(0.08, v)) ** power;
    col[i * 3] = g;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = g;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Cinema seat, origin at floor centre, facing -Z (towards the screen).
 * The rear view is what matters here: a large black shell inset into a
 * red velvet rim with a fat top roll — exactly how these houses build them.
 */
function seatParts() {
  const red = [];
  const black = [];
  const chrome = [];

  const TILT = 0.145;

  // --- red velvet back body (the rim around the black shell) --------------
  red.push(
    xform(new RoundedBoxGeometry(0.65, 0.82, 0.17, 4, 0.062), {
      rx: TILT, y: 0.945, z: 0.2,
    })
  );
  // fat top roll that wraps over the back
  red.push(
    xform(new THREE.CapsuleGeometry(0.084, 0.482, 8, 22), {
      rz: Math.PI / 2, y: 1.288, z: 0.16,
    })
  );
  // front face pad (only seen looking down the rows)
  red.push(
    xform(new RoundedBoxGeometry(0.6, 0.64, 0.11, 4, 0.05), {
      rx: TILT, y: 0.945, z: 0.075,
    })
  );

  // --- seat cushion -------------------------------------------------------
  red.push(
    xform(new RoundedBoxGeometry(0.58, 0.145, 0.53, 4, 0.058), {
      rx: -0.06, y: 0.44, z: -0.07,
    })
  );
  red.push(
    xform(new THREE.CapsuleGeometry(0.052, 0.46, 5, 16), {
      rz: Math.PI / 2, y: 0.425, z: -0.3,
    })
  );

  // --- padded armrest caps ------------------------------------------------
  for (const s of [-1, 1]) {
    red.push(
      xform(new RoundedBoxGeometry(0.086, 0.05, 0.36, 3, 0.022), {
        y: 0.66, x: s * 0.328, z: -0.02,
      })
    );
  }

  // --- black shell --------------------------------------------------------
  // big inset panel on the rear face
  black.push(
    xform(new RoundedBoxGeometry(0.585, 0.565, 0.062, 4, 0.034), {
      rx: TILT, y: 0.862, z: 0.282,
    })
  );
  // dark reveal between the inset and the red rim
  black.push(
    xform(new RoundedBoxGeometry(0.615, 0.605, 0.028, 3, 0.012), {
      rx: TILT, y: 0.862, z: 0.265,
    })
  );
  // lower back shell under the red rim
  black.push(
    xform(new RoundedBoxGeometry(0.63, 0.34, 0.16, 4, 0.04), {
      rx: 0.06, y: 0.585, z: 0.205,
    })
  );
  // plinth
  black.push(
    xform(new RoundedBoxGeometry(0.36, 0.25, 0.4, 3, 0.034), {
      y: 0.115, z: 0.06,
    })
  );
  // seat deck + spine
  black.push(
    xform(new RoundedBoxGeometry(0.58, 0.15, 0.18, 3, 0.038), {
      y: 0.565, z: 0.17,
    })
  );
  for (const s of [-1, 1]) {
    // armrest body
    black.push(
      xform(new RoundedBoxGeometry(0.064, 0.21, 0.42, 3, 0.024), {
        x: s * 0.328, y: 0.52, z: -0.01,
      })
    );
    // rear support
    black.push(
      xform(new RoundedBoxGeometry(0.09, 0.32, 0.1, 3, 0.026), {
        x: s * 0.317, y: 0.34, z: 0.2,
      })
    );
  }

  // --- brushed seat number plaque + two studs ----------------------------
  chrome.push(
    xform(new RoundedBoxGeometry(0.048, 0.016, 0.008, 2, 0.004), {
      y: 0.74, z: 0.318,
    })
  );
  for (const s of [-1, 1]) {
    chrome.push(
      xform(new THREE.SphereGeometry(0.012, 10, 8), {
        x: s * 0.23, y: 0.63, z: 0.318,
      })
    );
  }

  return {
    red: bakeAO(mergeGeometries(red.map(flat), false)),
    black: bakeAO(mergeGeometries(black.map(flat), false), 1.15),
    chrome: mergeGeometries(chrome.map(flat), false),
  };
}

export function buildSeating({ rows = 11, perRow = 22, pitch = 0.645, rowPitch = 1.03, frontZ = -6.5, floorY }) {
  const parts = seatParts();

  const redMat = new THREE.MeshPhysicalMaterial({
    map: fabric.map,
    normalMap: fabric.normalMap,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughnessMap: fabric.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    color: 0xffffff,
    vertexColors: true,
    sheen: 0.1,
    sheenColor: new THREE.Color(0x7e1a0e),
    sheenRoughness: 0.7,
  });

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x06070a,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.7,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a958a,
    map: metal.map,
    normalMap: metal.normalMap,
    roughness: 0.5,
    metalness: 0.85,
    emissive: 0x2a2822,
    emissiveIntensity: 0.3,
  });

  const total = rows * perRow;
  const redMesh = new THREE.InstancedMesh(parts.red, redMat, total);
  const blackMesh = new THREE.InstancedMesh(parts.black, shellMat, total);
  const chromeMesh = new THREE.InstancedMesh(parts.chrome, chromeMat, total);

  // soft contact shadow beneath every seat
  const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: softDisc(),
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, total);
  shadowMesh.renderOrder = 1;

  const dummy = new THREE.Object3D();
  const rand = mulberry32(2027);
  const tint = new THREE.Color();
  let i = 0;

  for (let r = 0; r < rows; r++) {
    const stagger = r % 2 === 0 ? 0 : pitch * 0.5;
    const z = frontZ + r * rowPitch;
    const y = floorY(z);
    for (let s = 0; s < perRow; s++) {
      const x = (s - (perRow - 1) / 2) * pitch + stagger;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, (rand() - 0.5) * 0.02, (rand() - 0.5) * 0.008);
      dummy.scale.setScalar(0.99 + rand() * 0.02);
      dummy.updateMatrix();
      redMesh.setMatrixAt(i, dummy.matrix);
      blackMesh.setMatrixAt(i, dummy.matrix);
      chromeMesh.setMatrixAt(i, dummy.matrix);

      const v = 0.72 + rand() * 0.28;
      tint.setRGB(v * 1.02, v * 0.9, v * 0.92);
      redMesh.setColorAt(i, tint);
      const b = 0.8 + rand() * 0.35;
      tint.setRGB(b, b, b);
      blackMesh.setColorAt(i, tint);

      dummy.position.set(x, y + 0.012, z + 0.02);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      shadowMesh.setMatrixAt(i, dummy.matrix);

      i++;
    }
  }

  for (const m of [redMesh, blackMesh, chromeMesh, shadowMesh]) {
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
  }
  if (redMesh.instanceColor) redMesh.instanceColor.needsUpdate = true;
  if (blackMesh.instanceColor) blackMesh.instanceColor.needsUpdate = true;

  for (const m of [redMesh, blackMesh, chromeMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  const group = new THREE.Group();
  group.add(redMesh, blackMesh, chromeMesh, shadowMesh);
  return group;
}
