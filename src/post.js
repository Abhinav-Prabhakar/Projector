import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Cinematic pipeline:
 *  HDR scene -> soft-knee bright pass -> dual-radius bloom ->
 *  filmic composite (ACES, lens CA, vignette, halation, grain).
 *  Deliberately cheap: four half/quarter-res passes, one fullscreen resolve.
 * ------------------------------------------------------------------ */

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float threshold;
  uniform float knee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float w = smoothstep(threshold, threshold + knee, l);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 texel;
  uniform vec2 dir;
  varying vec2 vUv;
  void main() {
    vec2 o = texel * dir;
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
    c += texture2D(tDiffuse, vUv + o * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tDiffuse, vUv - o * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tDiffuse, vUv + o * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tDiffuse, vUv - o * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const FXAA_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 px = 1.0 / resolution;
    vec3 rgbM  = texture2D(tDiffuse, vUv).rgb;
    vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb;
    vec3 rgbNE = texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * px).rgb;
    vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * px).rgb;
    vec3 rgbSE = texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * px).rgb;

    float lumaM = luma(rgbM);
    float lumaNW = luma(rgbNW);
    float lumaNE = luma(rgbNE);
    float lumaSW = luma(rgbSW);
    float lumaSE = luma(rgbSE);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    if (lumaMax - lumaMin < max(0.0312, lumaMax * 0.125)) {
      gl_FragColor = vec4(rgbM, 1.0);
      return;
    }

    vec2 dir = vec2(
      -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
       ((lumaNW + lumaSW) - (lumaNE + lumaSE))
    );
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.03125, 1.0 / 128.0);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, -8.0, 8.0) * px;

    vec3 rgbA = 0.5 * (
      texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
      texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
    );
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
      texture2D(tDiffuse, vUv + dir * -0.5).rgb +
      texture2D(tDiffuse, vUv + dir * 0.5).rgb
    );
    float lumaB = luma(rgbB);
    gl_FragColor = vec4((lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB, 1.0);
  }
`;

const FINAL_FRAG = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom1;
  uniform sampler2D tBloom2;
  uniform sampler2D tDepth;
  uniform float exposure;
  uniform float bloomStrength;
  uniform float grain;
  uniform float time;
  uniform float focus;
  uniform float dof;
  uniform vec2 resolution;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float debugDepth;
  varying vec2 vUv;

  // ACES filmic (Narkowicz fit refined by three.js)
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602)
  );
  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 ACESFilmic(vec3 color) {
    color = ACESInputMat * color;
    color = RRTAndODTFit(color);
    color = ACESOutputMat * color;
    return clamp(color, 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float viewZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float z = d * 2.0 - 1.0;
    return -((2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear)));
  }

  void main() {
    vec2 uv = vUv;
    if (debugDepth > 0.5) {
      float dd = texture2D(tDepth, uv).x;
      gl_FragColor = vec4(fract(dd * 100.0), fract(dd * 1000.0), dd, 1.0);
      return;
    }
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);

    // gentle barrel distortion for a real projection lens
    vec2 duv = uv + c * r2 * 0.008;

    // lateral chromatic aberration, strongest at the corners
    float ca = (0.0008 + 0.0016 * r2);

    // shallow depth of field: the screen plane is sharp, the near rows fall off
    float vz = abs(viewZ(uv));
    float coc = clamp((focus - vz) / focus, 0.0, 1.0);
    coc = pow(coc, 1.35) * dof;
    float radius = coc * 0.013 * (resolution.y / 776.0);

    vec2 px = vec2(1.0 / resolution.x, 1.0 / resolution.y);
    vec3 sharp = texture2D(tScene, duv).rgb;

    // golden-angle disc: 12 taps, and skipped where the frame is already sharp
    vec3 blur = sharp;
    if (radius > 0.4) {
      float wsum = 0.0;
      blur = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996323;
        float rr = sqrt((float(i) + 0.5) / 12.0);
        vec2 o = vec2(cos(a), sin(a)) * rr * radius * vec2(1.0, resolution.x / resolution.y);
        blur += texture2D(tScene, duv + o).rgb;
        wsum += 1.0;
      }
      blur /= wsum;
    }

    vec3 col = mix(sharp, blur, smoothstep(0.02, 0.5, coc));

    // lateral chromatic aberration, strongest at the corners
    vec3 caCol;
    caCol.r = texture2D(tScene, duv + c * ca * (0.5 + coc)).r;
    caCol.g = texture2D(tScene, duv + c * ca * 0.25).g;
    caCol.b = texture2D(tScene, duv - c * ca * (0.5 + coc)).b;
    col = mix(caCol, col, 0.55);

    vec3 b1 = texture2D(tBloom1, duv).rgb;
    vec3 b2 = texture2D(tBloom2, duv).rgb;
    col += (b1 * 0.52 + b2 * 0.72) * bloomStrength;

    col *= exposure;
    col = ACESFilmic(col * 0.94);

    // cool the shadows, keep the highlights neutral (cinema grade)
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float shadowMask = 1.0 - smoothstep(0.0, 0.42, lum);
    col = mix(col, col * vec3(0.88, 0.97, 1.12), shadowMask * 0.55);

    // vignette
    float vig = smoothstep(1.3, 0.3, length(c * vec2(1.02, 0.94)));
    col *= mix(1.0, vig, 0.34);

    // sRGB transfer
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

    // display-referred grain: subtle, luma weighted
    vec2 gp = uv * resolution + fract(time) * 917.0;
    float g = hash12(gp) - 0.5;
    col += g * (0.008 + 0.010 * (1.0 - lum)) * grain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function rt(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    ...opts,
  });
}

export class Post {
  constructor(renderer) {
    this.renderer = renderer;

    // MSAA cannot be resolved together with a readable depth texture in
    // WebGL2, so the scene renders single-sampled and receives a cheap FXAA.
    this.depthTexture = new THREE.DepthTexture(1, 1);
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      generateMipmaps: false,
      depthTexture: this.depthTexture,
    });

    this.sceneFX = rt(1, 1);
    this.halfA = rt(1, 1);
    this.halfB = rt(1, 1);
    this.quartA = rt(1, 1);
    this.quartB = rt(1, 1);

    this.fxaaMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: FXAA_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.62 },
        knee: { value: 0.75 },
      },
      vertexShader: VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        texel: { value: new THREE.Vector2() },
        dir: { value: new THREE.Vector2(1, 0) },
      },
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        exposure: { value: 1.05 },
        bloomStrength: { value: 1.0 },
        grain: { value: 1.0 },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        tDepth: { value: null },
        focus: { value: 19.0 },
        dof: { value: 1.0 },
        cameraNear: { value: 0.05 },
        cameraFar: { value: 90 },
        debugDepth: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FINAL_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geo, this.brightMat);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.w = 1;
    this.h = 1;
  }

  setSize(w, h) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    this.sceneFX.setSize(w, h);
    this.depthTexture.image.width = w;
    this.depthTexture.image.height = h;
    this.depthTexture.needsUpdate = true;
    this.fxaaMat.uniforms.resolution.value.set(w, h);
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));
    const qw = Math.max(1, Math.floor(w / 4));
    const qh = Math.max(1, Math.floor(h / 4));
    this.halfA.setSize(hw, hh);
    this.halfB.setSize(hw, hh);
    this.quartA.setSize(qw, qh);
    this.quartB.setSize(qw, qh);
    this.halfSize = new THREE.Vector2(hw, hh);
    this.quartSize = new THREE.Vector2(qw, qh);
    this.finalMat.uniforms.resolution.value.set(w, h);
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  blur(src, targetA, targetB, size, iterations = 2) {
    const texel = this.blurMat.uniforms.texel.value;
    this.blurMat.uniforms.tDiffuse.value = src.texture;
    for (let i = 0; i < iterations; i++) {
      texel.set(1 / size.x, 1 / size.y);
      this.blurMat.uniforms.dir.value.set(1, 0);
      this.blurMat.uniforms.tDiffuse.value = src.texture;
      this.pass(this.blurMat, targetA);

      this.blurMat.uniforms.tDiffuse.value = targetA.texture;
      this.blurMat.uniforms.dir.value.set(0, 1);
      this.pass(this.blurMat, targetB);
      src = targetB;
    }
    return src;
  }

  render(scene, camera, params, time) {
    const r = this.renderer;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    // anti-alias the single-sampled scene (keeps the depth texture readable)
    this.fxaaMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.pass(this.fxaaMat, this.sceneFX);

    // bright pass at half resolution
    this.brightMat.uniforms.tDiffuse.value = this.sceneFX.texture;
    this.pass(this.brightMat, this.halfA);

    const half = this.blur(this.halfA, this.halfB, this.halfA, this.halfSize, 2);

    // quarter-resolution, wider halo
    this.quad.material = this.blurMat;
    this.blurMat.uniforms.tDiffuse.value = this.halfA.texture;
    this.blurMat.uniforms.texel.value.set(1 / this.halfSize.x, 1 / this.halfSize.y);
    this.blurMat.uniforms.dir.value.set(0, 1);
    this.pass(this.blurMat, this.quartA);

    const quart = this.blur(this.quartA, this.quartB, this.quartA, this.quartSize, 2);

    this.finalMat.uniforms.tScene.value = this.sceneFX.texture;
    this.finalMat.uniforms.tDepth.value = this.depthTexture;
    this.finalMat.uniforms.tBloom1.value = half.texture;
    this.finalMat.uniforms.tBloom2.value = quart.texture;
    this.finalMat.uniforms.exposure.value = params.exposure;
    this.finalMat.uniforms.bloomStrength.value = params.bloom;
    this.finalMat.uniforms.grain.value = params.grain;
    this.finalMat.uniforms.focus.value = params.focus ?? 19;
    this.finalMat.uniforms.dof.value = params.dof ?? 1;
    this.finalMat.uniforms.cameraNear.value = camera.near;
    this.finalMat.uniforms.cameraFar.value = camera.far;
    this.finalMat.uniforms.debugDepth.value = params.debugDepth || 0;
    this.finalMat.uniforms.tDepth.value = this.depthTexture;
    this.finalMat.uniforms.time.value = time;

    r.setRenderTarget(null);
    this.pass(this.finalMat, null);
  }
}
