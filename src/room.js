import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  darkWood, concrete, plaster, carpet, screenSurface, exitSign,
  glowSprite, brushedMetal, aisleRunner, apronWash, ceilingTile,
} from './textures.js';
import { createCurtain } from './curtains.js';

export const DIM = {
  halfW: 10.4,
  ceil: 11.3,
  soffit: 10.35,
  backZ: 9.9,
  screenZ: -15.0,
  screenW: 11.95,
  screenH: 6.0,
  screenBottom: 4.15,
  stageY: 2.5,
  stageFrontZ: -6.35,
  audFloorStartZ: -5.5,
  drapeZ: -13.72,
  floorY(z) {
    return 0.9 + 0.105 * (z - this.audFloorStartZ);
  },
};

export function buildRoom() {
  const g = new THREE.Group();
  const wood = darkWood();
  const conc = concrete();
  const pl = plaster(0.4);
  const carp = carpet();
  const runner = aisleRunner();
  const metalTex = brushedMetal();
  const glow = glowSprite();
  const exitTex = exitSign();

  /* --------------------------------------------------------- materials */
  // near-black lacquered hardwood panelling
  const wallMat = new THREE.MeshPhysicalMaterial({
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(0.07, 0.07),
    color: 0x141210,
    roughness: 0.92,
    metalness: 0.0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.9,
  });
  const trimMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0a09,
    roughness: 0.86,
    metalness: 0.06,
    clearcoat: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.95 });
  const carpetMat = new THREE.MeshPhysicalMaterial({
    map: carp.map,
    normalMap: carp.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0x232020,
    roughness: 0.96,
  });
  const runnerMat = new THREE.MeshPhysicalMaterial({
    map: runner.map,
    color: 0x39342f,
    roughness: 0.95,
  });
  const concreteMat = new THREE.MeshPhysicalMaterial({
    map: conc.map,
    normalMap: conc.normalMap,
    roughnessMap: conc.roughnessMap,
    color: 0x3d382f,
    roughness: 1.0,
    metalness: 0.0,
    specularIntensity: 0.12,      // matte painted deck: almost no sheen
    envMapIntensity: 0.25,
  });
  const plasterMat = new THREE.MeshStandardMaterial({
    map: pl.map,
    color: 0x8b8579,
    roughness: 0.94,
  });
  const metalMat = new THREE.MeshPhysicalMaterial({
    map: metalTex.map,
    normalMap: metalTex.normalMap,
    color: 0x3e3a34,
    roughness: 0.55,
    metalness: 0.7,
  });

  /* ------------------------------------------------------------------ walls */
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(DIM.backZ - DIM.screenZ, DIM.ceil), wallMat);
    wall.rotation.y = -s * Math.PI / 2;
    wall.position.set(s * DIM.halfW, DIM.ceil / 2, (DIM.backZ + DIM.screenZ) / 2);
    wall.receiveShadow = true;
    g.add(wall);

    // wide flitch panels: very low-contrast vertical seams
    for (let z = DIM.screenZ + 1.9; z < DIM.backZ; z += 2.35) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.028, DIM.ceil, 0.04), trimMat);
      rib.position.set(s * (DIM.halfW - 0.015), DIM.ceil / 2, z);
      g.add(rib);
    }

    // cove reveal line near the ceiling
    const cove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, DIM.backZ - DIM.screenZ), trimMat);
    cove.position.set(s * (DIM.halfW - 0.05), DIM.ceil - 0.3, (DIM.backZ + DIM.screenZ) / 2);
    g.add(cove);
  }

  /* ---------------------------------------------------------------- ceiling */
  const ceilW = DIM.halfW * 2;
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.96, emissive: 0x050506, emissiveIntensity: 1 });
  const houseCeil = new THREE.Mesh(new THREE.PlaneGeometry(ceilW, DIM.backZ + 9.6), ceilMat);
  houseCeil.rotation.x = Math.PI / 2;
  houseCeil.position.set(0, DIM.ceil - 0.15, (DIM.backZ - 9.6) / 2);
  houseCeil.receiveShadow = true;
  g.add(houseCeil);

  // shallow coffers
  const coff = new THREE.Group();
  for (let z = -6.4; z <= DIM.backZ; z += 2.4) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ceilW, 0.09, 0.1), trimMat);
    beam.position.set(0, DIM.ceil - 0.19, z);
    coff.add(beam);
  }
  for (const x of [-6, -3, 0, 3, 6]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, DIM.backZ + 9.6), darkMat);
    beam.position.set(x, DIM.ceil - 0.19, (DIM.backZ - 9.6) / 2);
    coff.add(beam);
  }
  g.add(coff);

  // lit tiled soffit over the stage — the only ceiling the house sees
  const soffitMat = new THREE.MeshStandardMaterial({
    map: ceilingTile(),
    color: 0x7c786f,
    roughness: 0.97,
    metalness: 0.0,
  });
  const soffit = new THREE.Mesh(new THREE.PlaneGeometry(ceilW, 5.4, 1, 1), soffitMat);
  soffit.rotation.x = Math.PI / 2;
  soffit.position.set(0, DIM.soffit + 0.01, -10.9);
  soffit.receiveShadow = true;
  g.add(soffit);

  const fascia = new THREE.Mesh(new THREE.BoxGeometry(ceilW, 0.22, 0.18), darkMat);
  fascia.position.set(0, DIM.soffit - 0.1, -8.2);
  g.add(fascia);

  /* ------------------------------------------------------------- back wall */
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ceilW, DIM.ceil), wallMat);
  backWall.position.set(0, DIM.ceil / 2, DIM.backZ);
  backWall.rotation.y = Math.PI;
  g.add(backWall);

  // screen wall
  const screenWall = new THREE.Mesh(new THREE.PlaneGeometry(ceilW, DIM.ceil), darkMat);
  screenWall.position.set(0, DIM.ceil / 2, DIM.screenZ - 0.2);
  g.add(screenWall);

  /* ---------------------------------------------------------------- stage */
  // note the sign: stageFrontZ is the *near* edge, drapeZ the far one
  const stageDepth = DIM.stageFrontZ - DIM.drapeZ;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(DIM.screenW + 3.4, 0.12, stageDepth),
    concreteMat
  );
  stage.position.set(0, DIM.stageY - 0.06, (DIM.drapeZ + DIM.stageFrontZ) / 2);
  stage.receiveShadow = true;
  g.add(stage);

  const apronGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(DIM.screenW + 3.4, stageDepth),
    new THREE.MeshBasicMaterial({
      map: apronWash(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.2,
      color: 0xffeed2,
    })
  );
  apronGlow.rotation.x = -Math.PI / 2;
  apronGlow.position.set(0, DIM.stageY + 0.006, (DIM.drapeZ + DIM.stageFrontZ) / 2);
  apronGlow.renderOrder = 2;
  g.add(apronGlow);

  const fasciaH = DIM.stageY - 0.4;
  const stageFascia = new THREE.Mesh(new THREE.BoxGeometry(DIM.screenW + 3.4, fasciaH, 0.12), trimMat);
  stageFascia.position.set(0, 0.4 + fasciaH / 2, DIM.stageFrontZ + 0.04);
  stageFascia.receiveShadow = true;
  g.add(stageFascia);

  // black stage wings framing the playing space
  for (const s of [-1, 1]) {
    // wings only mask the rear of the deck: any further forward and they
    // would eclipse the exit signs from the house camera.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, DIM.soffit - DIM.stageY, 3.6), darkMat);
    wing.position.set(s * (DIM.screenW / 2 + 0.9), DIM.stageY + (DIM.soffit - DIM.stageY) / 2, DIM.drapeZ + 1.9);
    wing.receiveShadow = true;
    g.add(wing);
  }

  /* --------------------------------------------------------- audience floor */
  const slope = Math.atan(0.105);      // matches DIM.floorY exactly
  const floorLen = DIM.backZ - DIM.audFloorStartZ + 1.2;
  const floorGeo = new THREE.PlaneGeometry(DIM.halfW * 2 - 0.06, floorLen);
  const floor = new THREE.Mesh(floorGeo, carpetMat);
  floor.rotation.x = -Math.PI / 2 - slope;
  floor.position.set(0, DIM.floorY((DIM.backZ + DIM.audFloorStartZ - 1.2) / 2), (DIM.backZ + DIM.audFloorStartZ - 1.2) / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // side runners
  for (const s of [-1, 1]) {
    const rw = 1.15;
    const run = new THREE.Mesh(new THREE.PlaneGeometry(rw, floorLen), runnerMat);
    run.rotation.x = -Math.PI / 2 - slope;
    run.position.set(s * (DIM.halfW - rw / 2 - 0.1), DIM.floorY((DIM.backZ + DIM.audFloorStartZ - 1.2) / 2) + 0.006, (DIM.backZ + DIM.audFloorStartZ - 1.2) / 2);
    run.receiveShadow = true;
    g.add(run);
  }

  /* -------------------------------------------------------- proscenium towers */
  const towerW = 1.24;
  const towerZ = -14.35;
  for (const s of [-1, 1]) {
    const tower = new THREE.Mesh(
      new RoundedBoxGeometry(towerW, DIM.ceil - DIM.stageY, 2.7, 2, 0.01),
      wallMat
    );
    tower.position.set(s * (DIM.halfW - towerW / 2 + 0.04), DIM.stageY + (DIM.ceil - DIM.stageY) / 2, towerZ);
    tower.castShadow = true;
    tower.receiveShadow = true;
    g.add(tower);

    // recessed panel with a dark reveal
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.86, 3.1, 0.1, 2, 0.008), trimMat);
    panel.position.set(s * (DIM.halfW - towerW / 2 + 0.04), 2.55, -12.94);
    g.add(panel);

    /* exit sign */
    const signY = 4.9;
    const signFrame = new THREE.Mesh(
      new RoundedBoxGeometry(0.72, 0.4, 0.08, 2, 0.014),
      new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.5 })
    );
    signFrame.position.set(s * (DIM.halfW - towerW / 2 + 0.04), signY, -12.86);
    g.add(signFrame);

    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: exitTex,
      emissiveIntensity: 2.2,
      roughness: 0.6,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.33), faceMat);
    face.position.set(s * (DIM.halfW - towerW / 2 + 0.04), signY, -12.795);
    g.add(face);
    face.userData.exitMat = true;

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0x53ffa8,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.position.copy(face.position);
    halo.position.z += 0.02;
    halo.scale.set(0.78, 0.5, 1);
    g.add(halo);
  }

  /* ------------------------------------------------------------- screen */
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x090909,
    roughness: 0.96,
    metalness: 0,
    emissive: 0xffffff,
    emissiveMap: screenSurface(),
    emissiveIntensity: 1.0,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(DIM.screenW, DIM.screenH, 1, 1), screenMat);
  screen.position.set(0, DIM.screenBottom + DIM.screenH / 2, DIM.screenZ);
  screen.receiveShadow = false;
  g.add(screen);

  // velvet masking frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x030405, roughness: 0.98 });
  const frameT = new THREE.Mesh(new THREE.BoxGeometry(DIM.screenW + 0.5, 0.2, 0.14), frameMat);
  frameT.position.set(0, DIM.screenBottom + DIM.screenH + 0.06, DIM.screenZ + 0.02);
  g.add(frameT);
  const frameB = frameT.clone();
  frameB.position.y = DIM.screenBottom - 0.06;
  g.add(frameB);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, DIM.screenH + 0.34, 0.14), frameMat);
    f.position.set(s * (DIM.screenW / 2 + 0.1), DIM.screenBottom + DIM.screenH / 2, DIM.screenZ + 0.02);
    g.add(f);
  }

  /* ---------------------------------------------------- masking side panels */
  for (const s of [-1, 1]) {
    const mask = createCurtain({
      width: 1.6,
      height: DIM.soffit - DIM.stageY,
      x: s * (DIM.halfW - 1.55),
      y: DIM.stageY + (DIM.soffit - DIM.stageY) / 2,
      z: DIM.drapeZ - 0.5,
      segX: 60,
      segY: 34,
      freq: 10,
      amp: 0.05,
      phase: s * 2.1,
      weight: 0.6,
      color: 0x0b0d10,
      sheenColor: 0x2b323c,
    });
    g.add(mask);
  }

  /* -------------------------------------------------------- ceiling lights */
  const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.5, metalness: 0.55 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xfff2dc,
    emissiveIntensity: 6.5,
    roughness: 0.45,
  });
  const downlights = [];
  const positions = [-4.15, 0, 4.15];
  for (const x of positions) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.34), fixtureMat);
    ring.position.set(x, DIM.soffit - 0.03, -11.65);
    g.add(ring);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, DIM.soffit - 0.085, -11.65);
    g.add(lens);
    downlights.push(lens);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow,
      color: 0xffe9c8,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.position.set(x, DIM.soffit - 0.1, -11.65);
    halo.scale.set(1.5, 1.0, 1);
    g.add(halo);
  }

  /* --------------------------------------------- house ceiling pin spots */
  const pinGroup = new THREE.Group();
  const pinSpots = [];
  for (const x of [-5.4, -2.2, 2.2, 5.4]) {
    for (const z of [-4.4, 0.4, 5.2]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, DIM.ceil - 0.2, z);
      pinGroup.add(lens);
      pinSpots.push({ mesh: lens, base: 0.3 + 0.5 * Math.random() });
    }
  }
  g.add(pinGroup);

  /* --------------------------------------------------------- aisle markers */
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    emissive: 0x8fb6e8,
    emissiveIntensity: 0.55,
    roughness: 0.6,
  });
  const markers = [];
  for (let r = 0; r < 12; r++) {
    for (const s of [-1, 1]) {
      const z = DIM.audFloorStartZ + r * 1.03;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.01, 0.028), markerMat);
      m.position.set(s * 7.18, DIM.floorY(z) + 0.008, z);
      markers.push(m);
      g.add(m);
    }
  }

  /* ----------------------------------------------------------- handrails */
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 16.5, 12), trimMat);
    rail.rotation.x = Math.PI / 2 - 0.03;
    rail.position.set(s * (DIM.halfW - 0.2), 1.36, 1.4);
    g.add(rail);
    for (let z = -6; z <= 8; z += 3) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.045), trimMat);
      bracket.position.set(s * (DIM.halfW - 0.1), 1.36 + 0.03 * (z - 1.4), z);
      g.add(bracket);
    }
  }

  return {
    group: g,
    apronGlow,
    screen,
    screenMat,
    downlights: downlights.map((m) => m.material),
    lensMats: [...new Set([...downlights.map((m) => m.material), lensMat])],
    pinSpots,
    markers,
  };
}
