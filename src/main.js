import * as THREE from 'three';
import { createTheatre } from './theatre.js';
import { Post } from './post.js';
import { createUI } from './ui.js';
import { DIM } from './room.js';

const qs = new URLSearchParams(location.search);
const fixedQuality = qs.has('fixed');
const hideUI = qs.get('ui') === '0';
const raw = qs.get('raw') === '1';

/* ------------------------------------------------------------------ renderer */
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  stencil: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 90);

/* --------------------------------------------------------------------- world */
const theatre = createTheatre(scene, renderer, camera);
const post = new Post(renderer);

/* ------------------------------------------------------------------- camera */
class Rig {
  constructor(cam) {
    this.cam = cam;
    this.base = new THREE.Vector3(0, 4.4, 7.6);
    this.look = new THREE.Vector3(0, 2.35, DIM.screenZ);

    this.baseYaw = 0;
    this.basePitch = Math.asin(
      new THREE.Vector3().subVectors(this.look, this.base).normalize().y
    );

    this.yaw = 0;
    this.pitch = 0;
    this.dolly = 0;
    this.tYaw = 0;
    this.tPitch = 0;
    this.tDolly = 0;
    this.dragYaw = 0;
    this.dragPitch = 0;

    this.pointer = new THREE.Vector2();
    this.par = new THREE.Vector2();
    this.drift = true;

    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.bind();
  }

  bind() {
    const el = canvas;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      this.pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragYaw = THREE.MathUtils.clamp(this.dragYaw - dx * 0.0022, -0.13, 0.13);
      this.dragPitch = THREE.MathUtils.clamp(this.dragPitch - dy * 0.0016, -0.045, 0.055);
    });
    const end = () => {
      this.dragging = false;
      canvas.classList.remove('dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.tDolly = THREE.MathUtils.clamp(this.tDolly + e.deltaY * 0.0011, -0.9, 0.95);
    }, { passive: false });
  }

  reset() {
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.tDolly = 0;
  }

  update(t, dt) {
    const k = 1 - Math.exp(-dt * 4.2);
    const kd = 1 - Math.exp(-dt * 2.6);

    this.par.x += (this.pointer.x * 0.0075 - this.par.x) * kd;
    this.par.y += (this.pointer.y * 0.0038 - this.par.y) * kd;

    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;
    this.dolly += (this.tDolly - this.dolly) * (1 - Math.exp(-dt * 3));

    let driftYaw = 0;
    let driftPitch = 0;
    let liftY = 0;
    if (this.drift) {
      driftYaw = Math.sin(t * 0.083) * 0.0032 + Math.sin(t * 0.031 + 1.3) * 0.0018;
      driftPitch = Math.sin(t * 0.071 + 0.8) * 0.0016;
      liftY = Math.sin(t * 0.117 + 0.4) * 0.012;
    }

    const yaw = -this.dragYaw + driftYaw - this.par.x;
    const pitch = -this.dragPitch + driftPitch + this.par.y;

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(this.basePitch + pitch, this.baseYaw + yaw, 0, 'YXZ')
    );

    this.cam.position.copy(this.base);
    this.cam.position.y += liftY;
    this.cam.position.addScaledVector(dir, this.dolly);
    this.cam.quaternion.setFromEuler(
      new THREE.Euler(this.basePitch + pitch, this.baseYaw + yaw, 0, 'YXZ')
    );
    this.cam.updateMatrixWorld();
  }
}

const rig = new Rig(camera);

/* ----------------------------------------------------------------- controls */
const target = {
  screen: 1, stage: 1, house: 0.9, cove: 0.8, exits: 1, beam: 0.24,
  sway: 1, breeze: 1, exposure: 1.08, bloom: 0.42, grain: 1, haze: 1, dof: 0.45, focus: 13.0, debugDepth: 0,
};
const live = { ...target };

const ui = createUI({
  target,
  onPreset: () => {},
  onResetView: () => rig.reset(),
  onToggleDrift: (on) => { rig.drift = on; },
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const tag = e.key;
  if (tag === 'r' || tag === 'R') rig.reset();
  if (tag === 'd' || tag === 'D') {
    rig.drift = !rig.drift;
    document.getElementById('drift').classList.toggle('on', rig.drift);
  }
  if (tag === '1') ui.applyPreset('showtime');
  if (tag === '2') ui.applyPreset('intermission');
  if (tag === '3') ui.applyPreset('house');
  if (tag === '4') ui.applyPreset('blackout');
  if (tag === 'l' || tag === 'L') {
    target.house = target.house > 0.5 ? 0.02 : 0.9;
    target.cove = target.house > 0.5 ? 0.8 : 0.05;
    ui.paintAll();
  }
  if (tag === 'b' || tag === 'B') {
    target.beam = target.beam > 0.1 ? 0 : 0.24;
    ui.paintAll();
  }
});

/* ------------------------------------------------------------------ quality */
const maxDpr = Math.min(
  window.devicePixelRatio || 1,
  2,
  Math.max(1, Math.sqrt(4200000 / (window.innerWidth * window.innerHeight)))
);
let dpr = maxDpr;
let samples = [];
let lastHud = 0;
let frames = 0;
let fpsTimer = 0;
let fps = 60;

function applySize() {
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(db.x, db.y);
  document.getElementById('res').textContent = `${db.x}×${db.y}`;
}
applySize();

let resizeTimer;
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applySize, 120);
});

/* --------------------------------------------------------------------- loop */
const start = performance.now();
let last = start;
let firstFrame = true;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = (now - start) / 1000;

  // ease the live lighting toward the console values
  const ke = 1 - Math.exp(-dt * 3.2);
  for (const key in live) live[key] += (target[key] - live[key]) * ke;

  rig.update(t, dt);
  theatre.update(dt, t, live);
  if (raw) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    post.render(scene, camera, live, t);
  }

  // frame statistics
  frames++;
  fpsTimer += dt;
  if (fpsTimer > 0.5) {
    fps = Math.round(frames / fpsTimer);
    document.getElementById('fps').textContent = fps;
    frames = 0;
    fpsTimer = 0;
  }

  if (!fixedQuality && !firstFrame) {
    samples.push(dt);
    if (samples.length >= 80) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg > 0.0178 && dpr > 1.1) {
        dpr = Math.max(1, dpr - 0.2);
        applySize();
      } else if (avg < 0.0132 && dpr < maxDpr) {
        dpr = Math.min(maxDpr, dpr + 0.15);
        applySize();
      }
      samples = [];
    }
  }

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => {
      document.getElementById('veil').classList.add('lift');
      setTimeout(() => document.getElementById('hint').classList.add('gone'), 7000);
    });
  }
}

requestAnimationFrame(frame);

if (hideUI) {
  ui.hide(true);
  document.getElementById('brand').style.display = 'none';
  document.getElementById('hud').style.display = 'none';
}

window.__theatre = { THREE, scene, camera, renderer, theatre, post, rig, live, target, ui };
