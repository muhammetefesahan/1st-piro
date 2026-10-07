'use strict';
// Gölge Timi — sevimli efektler: yıldız/konfeti isabetleri, "puf" bulutları,
// çizgi film patlamaları, şeker renkli izli mermiler, uçan hasar sayıları.
// Kan yok, is yok: her şey yuvarlak, parlak ve zıplayan.
(function () {
  const G = window.G;
  const U = G.util;

  // ---------------- Palet ----------------
  function hex3(h) {
    return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  }
  const PAL = {
    white: hex3(0xffffff),
    cream: hex3(0xfff6e4),
    peach: hex3(0xffd3b6),
    pink: hex3(0xffc2dc),
    bubble: hex3(0xff6fa8),
    sun: hex3(0xffd23f),
    tang: hex3(0xffb347),
    coral: hex3(0xff6b6b),
    purple: hex3(0x9b5de5),
    lilac: hex3(0xcdb4ff),
    sky: hex3(0x4cc3ff),
    skyL: hex3(0xbfe9ff),
    mint: hex3(0x3ddc97),
    mintL: hex3(0xb8f5d8),
    lime: hex3(0xb8f25a),
    teal: hex3(0x4ecdc4),
    sand: hex3(0xffd99a),
    caramel: hex3(0xd9a066),
  };
  // takım/tür renk takımları: [ana, ikinci, vurgu]
  const TINTS = {
    team0: [PAL.sky, PAL.sun, PAL.white],
    team1: [PAL.coral, PAL.purple, PAL.pink],
    zombie: [PAL.mint, PAL.lime, PAL.bubble],
    candy: [PAL.bubble, PAL.sun, PAL.sky],
  };
  const STAR_COLS = [PAL.sun, PAL.bubble, PAL.sky, PAL.mint, PAL.lilac, PAL.tang];
  const PUFF_COLS = [PAL.cream, PAL.peach, PAL.pink, hex3(0xe9ddff), PAL.cream, PAL.white];
  const SMOKE_COLS = [hex3(0xeee4ff), hex3(0xffe6f1), hex3(0xdcfff0), hex3(0xfff5df), hex3(0xe2f4ff)];
  // eski izli mermi renkleri → şeker renkleri
  const TRACER_MAP = { 0xffe08a: 0xffd23f, 0x9fdcff: 0x5fd0ff, 0xffb070: 0xff7fb0, 0xb47bff: 0xc08bff, 0xfff0a0: 0xffe45c, 0xffd070: 0xffb347 };
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function qmul() {
    const q = G.settings.quality;
    return q === 'dusuk' ? 0.45 : q === 'orta' ? 0.75 : 1;
  }
  function cnt(n) {
    return Math.max(1, Math.round(n * qmul()));
  }

  // ---------------- Nokta parçacıkları (şekilli) ----------------
  // şekiller: 0 = yuvarlak (alpha: toon puf, glow: yumuşak ışık), 1 = yıldız, 2 = konfeti, 3 = pırıltı, 4 = halka
  const SH = { ROUND: 0, STAR: 1, CONF: 2, TWINKLE: 3, RING: 4 };
  const VS = [
    'attribute float psize; attribute float palpha; attribute vec3 pcolor; attribute float pshape; attribute float prot;',
    'uniform float scale; varying vec3 vC; varying float vA; varying float vS; varying float vR;',
    'void main(){',
    ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    ' gl_Position = projectionMatrix * mv;',
    ' gl_PointSize = max(1.0, psize * scale / max(0.1, -mv.z));',
    ' vC = pcolor; vA = palpha; vS = pshape; vR = prot;',
    '}',
  ].join('\n');
  const FS = [
    'uniform float glow; varying vec3 vC; varying float vA; varying float vS; varying float vR;',
    'const vec3 INK = vec3(0.231, 0.165, 0.29);',
    'void main(){',
    ' vec2 d = gl_PointCoord - 0.5;',
    ' vec3 col = vC; float a = vA;',
    ' float r = length(d) * 2.0;',
    ' if (vS < 0.5) {',
    '  if (r > 1.0) discard;',
    '  if (glow > 0.5) { a *= 1.0 - r * r; col = mix(col, vec3(1.0), (1.0 - r) * 0.5); }',
    '  else {',
    '   vec3 n = vec3(d.x * 2.0, -d.y * 2.0, sqrt(max(0.0, 1.0 - r * r)));',
    '   float l = dot(n, vec3(-0.42, 0.62, 0.66));',
    '   col *= l > 0.45 ? 1.0 : (l > -0.1 ? 0.88 : 0.76);',
    '   col = mix(col, vec3(1.0), step(0.86, l) * 0.5);',
    '   col = mix(col, INK, step(0.86, r) * 0.45);',
    '  }',
    ' } else {',
    '  float c = cos(vR), s = sin(vR);',
    '  vec2 q = vec2(c * d.x - s * d.y, s * d.x + c * d.y) * 2.0;',
    '  if (vS < 1.5) {',
    '   float ang = atan(q.y, q.x);',
    '   float t = abs(fract(ang * 0.7957747 + 0.25) - 0.5) * 2.0;',
    '   float b = mix(0.5, 0.98, t * t);',
    '   if (r > b) discard;',
    '   col = mix(col, vec3(1.0), smoothstep(0.38, 0.0, r) * 0.6);',
    '   if (glow < 0.5) col = mix(col, INK, step(b - 0.2, r) * 0.85);',
    '  } else if (vS < 2.5) {',
    '   vec2 aq = abs(q);',
    '   if (aq.x > 0.9 || aq.y > 0.48) discard;',
    '   col *= 0.84 + 0.16 * step(0.0, q.y);',
    '  } else if (vS < 3.5) {',
    '   vec2 aq = abs(q);',
    '   float k = max(max(0.0, 1.0 - aq.x * 5.0) * max(0.0, 1.0 - aq.y), max(0.0, 1.0 - aq.y * 5.0) * max(0.0, 1.0 - aq.x));',
    '   float core = max(0.0, 1.0 - r * 2.4);',
    '   a *= clamp(k * 1.7 + core, 0.0, 1.0);',
    '   col = mix(col, vec3(1.0), core);',
    '   if (a < 0.02) discard;',
    '  } else {',
    '   if (r > 1.0 || r < 0.72) discard;',
    '   col = mix(col, vec3(1.0), 0.25);',
    '  }',
    ' }',
    ' gl_FragColor = vec4(col, a);',
    '}',
  ].join('\n');

  class PSys {
    constructor(cap, additive) {
      this.cap = cap;
      this.n = 0;
      this.p = new Float32Array(cap * 3);
      this.v = new Float32Array(cap * 3);
      this.c = new Float32Array(cap * 3);
      this.a = new Float32Array(cap);
      this.s = new Float32Array(cap);
      this.sh = new Float32Array(cap);
      this.rot = new Float32Array(cap);
      this.spin = new Float32Array(cap);
      this.life = new Float32Array(cap);
      this.max = new Float32Array(cap);
      this.s0 = new Float32Array(cap);
      this.s1 = new Float32Array(cap);
      this.a0 = new Float32Array(cap);
      this.grav = new Float32Array(cap);
      this.drag = new Float32Array(cap);
      const g = new THREE.BufferGeometry();
      this.pa = new THREE.BufferAttribute(this.p, 3);
      this.ca = new THREE.BufferAttribute(this.c, 3);
      this.aa = new THREE.BufferAttribute(this.a, 1);
      this.sa = new THREE.BufferAttribute(this.s, 1);
      this.sha = new THREE.BufferAttribute(this.sh, 1);
      this.ra = new THREE.BufferAttribute(this.rot, 1);
      for (const at of [this.pa, this.ca, this.aa, this.sa, this.sha, this.ra]) at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.pa);
      g.setAttribute('pcolor', this.ca);
      g.setAttribute('palpha', this.aa);
      g.setAttribute('psize', this.sa);
      g.setAttribute('pshape', this.sha);
      g.setAttribute('prot', this.ra);
      g.setDrawRange(0, 0);
      this.mat = new THREE.ShaderMaterial({
        uniforms: { scale: { value: 400 }, glow: { value: additive ? 1 : 0 } },
        vertexShader: VS,
        fragmentShader: FS,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = additive ? 5 : 4;
    }
    // (eski imza korunur; shape ve spin isteğe bağlı)
    add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, grav, drag, shape, spin) {
      let i = this.n;
      if (i >= this.cap) i = Math.floor(Math.random() * this.cap);
      else this.n++;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
      this.life[i] = 0;
      this.max[i] = life;
      this.s0[i] = s0;
      this.s1[i] = s1;
      this.a0[i] = a0;
      this.grav[i] = grav || 0;
      this.drag[i] = drag || 0;
      this.s[i] = s0;
      this.a[i] = a0;
      this.sh[i] = shape || 0;
      this.rot[i] = Math.random() * 6.28;
      this.spin[i] = spin || 0;
    }
    kill(i) {
      const j = --this.n;
      if (i === j) return;
      for (let k = 0; k < 3; k++) {
        this.p[i * 3 + k] = this.p[j * 3 + k];
        this.v[i * 3 + k] = this.v[j * 3 + k];
        this.c[i * 3 + k] = this.c[j * 3 + k];
      }
      this.life[i] = this.life[j];
      this.max[i] = this.max[j];
      this.s0[i] = this.s0[j];
      this.s1[i] = this.s1[j];
      this.a0[i] = this.a0[j];
      this.grav[i] = this.grav[j];
      this.drag[i] = this.drag[j];
      this.s[i] = this.s[j];
      this.a[i] = this.a[j];
      this.sh[i] = this.sh[j];
      this.rot[i] = this.rot[j];
      this.spin[i] = this.spin[j];
    }
    update(dt) {
      for (let i = this.n - 1; i >= 0; i--) {
        this.life[i] += dt;
        const t = this.life[i] / this.max[i];
        if (t >= 1) {
          this.kill(i);
          continue;
        }
        const k = 1 - this.drag[i] * dt;
        const i3 = i * 3;
        this.v[i3] *= k;
        this.v[i3 + 1] = this.v[i3 + 1] * k - this.grav[i] * dt;
        this.v[i3 + 2] *= k;
        this.p[i3] += this.v[i3] * dt;
        this.p[i3 + 1] += this.v[i3 + 1] * dt;
        this.p[i3 + 2] += this.v[i3 + 2] * dt;
        if (this.p[i3 + 1] < 0.02 && this.grav[i] > 0) {
          this.p[i3 + 1] = 0.02;
          this.v[i3 + 1] *= -0.3;
          this.v[i3] *= 0.5;
          this.v[i3 + 2] *= 0.5;
          this.spin[i] *= 0.5;
        }
        this.rot[i] += this.spin[i] * dt;
        // büyüme: hızlı "pop" sonra hedef boya
        const pop = t < 0.15 ? t / 0.15 : 1;
        this.s[i] = (this.s0[i] + (this.s1[i] - this.s0[i]) * t) * (0.4 + 0.6 * pop);
        const fadeIn = Math.min(1, t * 8);
        this.a[i] = this.a0[i] * fadeIn * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
      }
      this.points.geometry.setDrawRange(0, this.n);
      this.pa.needsUpdate = this.ca.needsUpdate = this.aa.needsUpdate = this.sa.needsUpdate = this.sha.needsUpdate = this.ra.needsUpdate = true;
    }
  }

  // ---------------- Toon puf küreleri (patlama dumanı, "puf" bulutu, sis) ----------------
  function backOut(x) {
    const c1 = 1.9, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  class PuffSys {
    constructor(cap, seg) {
      this.cap = cap;
      this.n = 0;
      this.p = new Float32Array(cap * 3);
      this.v = new Float32Array(cap * 3);
      this.life = new Float32Array(cap);
      this.max = new Float32Array(cap);
      this.r0 = new Float32Array(cap);
      this.r1 = new Float32Array(cap);
      this.drag = new Float32Array(cap);
      this.lift = new Float32Array(cap);
      this.ph = new Float32Array(cap);
      const geo = new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7)));
      const mat = G.toonMat
        ? G.toonMat('fx-puff', { color: 0xffffff, emissive: 0x3a2e44, emissiveIntensity: 0.25 })
        : new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x4a3a52 });
      this.mesh = new THREE.InstancedMesh(geo, mat, cap);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.col = new Float32Array(cap * 3);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.col, 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.m = this.mesh.instanceMatrix.array;
      this.mesh.count = 0;
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 3;
    }
    add(x, y, z, vx, vy, vz, life, r0, r1, c, drag, lift) {
      let i = this.n;
      if (i >= this.cap) i = Math.floor(Math.random() * this.cap);
      else this.n++;
      const i3 = i * 3;
      this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
      this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
      // toon basamakları parlamada kaybolmasın diye biraz kısılır (ateş topu >1 renk verir)
      // neredeyse beyaz renkler parlamada düz beyaza patlamasın: daha çok kısılır
      const f = c[0] + c[1] + c[2] > 2.6 ? 0.66 : 0.78;
      this.col[i3] = c[0] * f; this.col[i3 + 1] = c[1] * f; this.col[i3 + 2] = c[2] * f;
      this.life[i] = 0;
      this.max[i] = life;
      this.r0[i] = r0;
      this.r1[i] = r1;
      this.drag[i] = drag || 0;
      this.lift[i] = lift || 0;
      this.ph[i] = Math.random() * 6.28;
    }
    kill(i) {
      const j = --this.n;
      if (i === j) return;
      for (let k = 0; k < 3; k++) {
        this.p[i * 3 + k] = this.p[j * 3 + k];
        this.v[i * 3 + k] = this.v[j * 3 + k];
        this.col[i * 3 + k] = this.col[j * 3 + k];
      }
      this.life[i] = this.life[j];
      this.max[i] = this.max[j];
      this.r0[i] = this.r0[j];
      this.r1[i] = this.r1[j];
      this.drag[i] = this.drag[j];
      this.lift[i] = this.lift[j];
      this.ph[i] = this.ph[j];
    }
    update(dt) {
      const m = this.m;
      for (let i = this.n - 1; i >= 0; i--) {
        this.life[i] += dt;
        const t = this.life[i] / this.max[i];
        if (t >= 1) {
          this.kill(i);
          continue;
        }
        const i3 = i * 3;
        const k = 1 - this.drag[i] * dt;
        this.v[i3] *= k;
        this.v[i3 + 1] = this.v[i3 + 1] * k + this.lift[i] * dt;
        this.v[i3 + 2] *= k;
        this.p[i3] += this.v[i3] * dt;
        this.p[i3 + 1] += this.v[i3 + 1] * dt;
        this.p[i3 + 2] += this.v[i3 + 2] * dt;
        // pop (geri yaylanma) → yavaş büyüme → küçülerek kaybolma
        const grow = this.r0[i] + (this.r1[i] - this.r0[i]) * (1 - (1 - t) * (1 - t));
        const env = t < 0.12 ? backOut(t / 0.12) : t > 0.55 ? 1 - Math.pow((t - 0.55) / 0.45, 2) : 1;
        const s = Math.max(0.0001, grow * env);
        const w = Math.sin(this.life[i] * 13 + this.ph[i]) * 0.06 * (1 - t);
        const o = i * 16;
        m[o] = s * (1 - w); m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
        m[o + 4] = 0; m[o + 5] = s * (1 + w); m[o + 6] = 0; m[o + 7] = 0;
        m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s * (1 - w); m[o + 11] = 0;
        m[o + 12] = this.p[i3]; m[o + 13] = this.p[i3 + 1]; m[o + 14] = this.p[i3 + 2]; m[o + 15] = 1;
      }
      this.mesh.count = this.n;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  // ---------------- Doku önbelleği (canvas başına bir kez) ----------------
  const TEX = {};
  function canvasTex(key, size, draw, linear) {
    if (TEX[key]) return TEX[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    if (!linear) t.generateMipmaps = true;
    TEX[key] = t;
    return t;
  }
  function starPath(ctx, cx, cy, ro, ri, pts, rot) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? ri : ro;
      const a = rot + (i * Math.PI) / pts;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  // namlu alevi: kalın kenarlı sarı yıldız + beyaz göbek
  function flashTex() {
    return canvasTex('flash', 128, (ctx, s) => {
      ctx.lineJoin = 'round';
      starPath(ctx, s / 2, s / 2, s * 0.47, s * 0.22, 6, -Math.PI / 2);
      ctx.fillStyle = '#ffb347';
      ctx.fill();
      starPath(ctx, s / 2, s / 2, s * 0.38, s * 0.18, 6, -Math.PI / 2);
      ctx.fillStyle = '#ffe45c';
      ctx.fill();
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.22);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,240,0.95)');
      g.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  // şok dalgası halkası
  function ringTex() {
    return canvasTex('ring', 128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.8, 'rgba(255,255,255,1)');
      g.addColorStop(0.92, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  // minik sevimli isabet izi: soluk lila yıldızcık
  function holeTex() {
    return canvasTex('hole', 64, (ctx, s) => {
      ctx.lineJoin = 'round';
      starPath(ctx, s / 2, s / 2, s * 0.4, s * 0.19, 5, -Math.PI / 2);
      ctx.fillStyle = 'rgba(255,236,150,0.85)';
      ctx.fill();
      ctx.lineWidth = s * 0.06;
      ctx.strokeStyle = 'rgba(59,42,74,0.45)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.44, s * 0.42, s * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    });
  }
  // patlama izi: yumuşak lila leke + yıldızlar (is yok)
  function scorchTex() {
    return canvasTex('scorch', 128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(120,96,150,0.32)');
      g.addColorStop(0.65, 'rgba(150,120,180,0.18)');
      g.addColorStop(1, 'rgba(150,120,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,240,180,0.45)';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        starPath(ctx, s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3, s * 0.06, s * 0.028, 5, a);
        ctx.fill();
      }
    });
  }
  // hasar sayısı rakam atlası (4x4 hücre, 0-9)
  let digitTex = null;
  const DIGIT_FONT = '800 50px "Baloo 2", "Nunito", "Arial Rounded MT Bold", sans-serif';
  function drawDigits(c) {
    const ctx = c.getContext('2d');
    const cell = c.width / 4;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = DIGIT_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 10; i++) {
      const x = (i % 4) * cell + cell / 2, y = Math.floor(i / 4) * cell + cell / 2 + 3;
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#3b2a4a';
      ctx.strokeText(String(i), x, y + 2);
      ctx.strokeText(String(i), x, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(i), x, y);
    }
  }
  function getDigitTex() {
    if (digitTex) return digitTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    drawDigits(c);
    digitTex = new THREE.CanvasTexture(c);
    digitTex.flipY = false;
    digitTex.minFilter = THREE.LinearFilter;
    digitTex.generateMipmaps = false;
    // yazı tipi sonradan yüklenirse atlası yeniden çiz
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('800 50px "Baloo 2"').then(() => {
          drawDigits(c);
          digitTex.needsUpdate = true;
        }).catch(() => {});
      }
    } catch (e) { /* yoksay */ }
    return digitTex;
  }

  // ---------------- Uçan hasar sayıları (tek Points çizimi) ----------------
  const NUM_REC = 24, NUM_DIG = 5;
  const DVS = [
    'attribute float dsize; attribute float dalpha; attribute float dchar; attribute float doff; attribute vec3 dcolor;',
    'uniform vec2 vp; uniform float uis; varying float vA; varying float vCh; varying vec3 vC;',
    'void main(){',
    ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    ' vec4 cp = projectionMatrix * mv;',
    ' float dist = max(0.1, -mv.z);',
    ' float px = dsize * uis * mix(1.0, 0.62, clamp((dist - 4.0) / 40.0, 0.0, 1.0));',
    ' cp.x += doff * px * 0.56 * 2.0 / vp.x * cp.w;',
    ' gl_Position = cp;',
    ' gl_PointSize = px;',
    ' vA = mv.z < -0.2 ? dalpha : 0.0; vCh = dchar; vC = dcolor;',
    '}',
  ].join('\n');
  const DFS = [
    'uniform sampler2D atlas; varying float vA; varying float vCh; varying vec3 vC;',
    'void main(){',
    ' if (vA < 0.01) discard;',
    ' vec2 cell = vec2(mod(vCh, 4.0), floor(vCh / 4.0));',
    ' vec4 t = texture2D(atlas, (cell + gl_PointCoord) / 4.0);',
    ' if (t.a < 0.04) discard;',
    ' float fill = clamp((t.r - 0.3) / 0.6, 0.0, 1.0);',
    ' vec3 col = mix(t.rgb, vC, fill);',
    ' gl_FragColor = vec4(col, t.a * vA);',
    '}',
  ].join('\n');
  class NumSys {
    constructor() {
      const N = NUM_REC * NUM_DIG;
      this.pos = new Float32Array(N * 3);
      this.size = new Float32Array(N);
      this.alpha = new Float32Array(N);
      this.ch = new Float32Array(N);
      this.off = new Float32Array(N);
      this.col = new Float32Array(N * 3);
      const g = new THREE.BufferGeometry();
      this.at = {
        position: new THREE.BufferAttribute(this.pos, 3),
        dsize: new THREE.BufferAttribute(this.size, 1),
        dalpha: new THREE.BufferAttribute(this.alpha, 1),
        dchar: new THREE.BufferAttribute(this.ch, 1),
        doff: new THREE.BufferAttribute(this.off, 1),
        dcolor: new THREE.BufferAttribute(this.col, 3),
      };
      for (const k in this.at) {
        this.at[k].setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(k, this.at[k]);
      }
      this.mat = new THREE.ShaderMaterial({
        uniforms: { vp: { value: new THREE.Vector2(1280, 720) }, uis: { value: 1 }, atlas: { value: getDigitTex() } },
        vertexShader: DVS,
        fragmentShader: DFS,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = 40;
      this.recs = [];
      for (let i = 0; i < NUM_REC; i++) this.recs.push({ on: false, x: 0, y: 0, z: 0, val: 0, life: 0, max: 1, head: false, kill: false, born: 0, n: 0, jx: 0 });
      this.idx = 0;
      this.dirty = true;
    }
    spawn(x, y, z, amount, head, kill, target) {
      const v = Math.max(1, Math.round(amount));
      // aynı hedefe art arda isabetler (otomatik ateş) tek sayıda toplanır ve yeniden "pop" eder;
      // hedef bilinmiyorsa aynı noktaya çok yakın zamanda gelenler (saçma) toplanır
      let stack = 0;
      for (const r of this.recs) {
        if (!r.on) continue;
        const same = target ? r.target === target && r.life < r.max * 0.55 : r.head === head && G.time - r.born < 0.16 && Math.abs(r.x - x) + Math.abs(r.z - z) < 0.9 && Math.abs(r.y0 - y) < 0.9;
        if (same) {
          if (target) {
            // sayı hareket eden hedefi yumuşakça izler
            r.x += (x - r.x) * 0.5;
            r.z += (z - r.z) * 0.5;
            r.y0 += (y - r.y0) * 0.5;
          }
          r.val = Math.min(99999, r.val + v);
          r.life = Math.min(r.life, 0.03);
          r.head = r.head || !!head;
          r.kill = r.kill || !!kill;
          r.max = r.kill ? 1.25 : 0.95;
          return;
        }
        // farklı hedeflerin yakın sayıları üst üste binmesin
        if (G.time - r.born < 0.5 && Math.abs(r.x - x) + Math.abs(r.z - z) < 1.6 && Math.abs(r.y0 - y) < 1.2) stack++;
      }
      const r = this.recs[this.idx++ % NUM_REC];
      r.on = true;
      r.target = target || null;
      r.x = x + U.rand(-0.25, 0.25);
      r.y0 = y + Math.min(3, stack) * 0.38;
      r.z = z + U.rand(-0.25, 0.25);
      r.val = Math.min(99999, v);
      r.life = 0;
      r.head = !!head;
      r.kill = !!kill;
      r.max = kill ? 1.25 : 0.95;
      r.born = G.time;
    }
    update(dt) {
      const P = this.pos, S = this.size, A = this.alpha, CH = this.ch, OF = this.off, C = this.col;
      let any = false;
      for (let ri = 0; ri < NUM_REC; ri++) {
        const r = this.recs[ri];
        const b = ri * NUM_DIG;
        if (!r.on) {
          if (A[b] !== 0) for (let k = 0; k < NUM_DIG; k++) A[b + k] = 0;
          continue;
        }
        any = true;
        r.life += dt;
        const t = r.life / r.max;
        if (t >= 1) {
          r.on = false;
          r.target = null;
          for (let k = 0; k < NUM_DIG; k++) A[b + k] = 0;
          continue;
        }
        const pop = t < 0.14 ? 0.25 + 0.75 * backOut(t / 0.14) : 1;
        const y = r.y0 + 0.25 + 0.85 * (1 - (1 - t) * (1 - t));
        const al = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38;
        const base = (r.kill ? 54 : r.head ? 46 : 38) * pop;
        // rakamlar
        let v = r.val, n = 0;
        const tmpD = NumSys.tmp;
        do {
          tmpD[n++] = v % 10;
          v = Math.floor(v / 10);
        } while (v > 0 && n < NUM_DIG);
        const cr = r.head ? 1 : r.kill ? 1 : 1, cg = r.head ? 0.86 : r.kill ? 0.62 : 1, cb = r.head ? 0.25 : r.kill ? 0.78 : 1;
        for (let k = 0; k < NUM_DIG; k++) {
          const i = b + k;
          if (k >= n) {
            A[i] = 0;
            continue;
          }
          P[i * 3] = r.x; P[i * 3 + 1] = y; P[i * 3 + 2] = r.z;
          CH[i] = tmpD[n - 1 - k];
          OF[i] = k - (n - 1) / 2;
          S[i] = base;
          A[i] = al;
          C[i * 3] = cr; C[i * 3 + 1] = cg; C[i * 3 + 2] = cb;
        }
      }
      if (any || this.dirty) {
        for (const k in this.at) this.at[k].needsUpdate = true;
        this.dirty = any;
      }
    }
    clear() {
      for (const r of this.recs) {
        r.on = false;
        r.target = null;
      }
      this.alpha.fill(0);
      this.dirty = true;
    }
  }
  NumSys.tmp = new Int32Array(NUM_DIG);

  const fx = (G.fx = {
    trauma: 0,
    scene: null,
    PAL,
  });
  const tv = new THREE.Vector3();
  const tv2 = new THREE.Vector3();

  // önceki sahnenin dinamik tamponlarını bırak (her maçta yeni sahne kurulur)
  function disposeOld() {
    if (!fx.add) return;
    for (const o of [fx.add.points, fx.alpha.points, fx.puffs.mesh, fx.nums.points, fx.holes, fx.scorches]) {
      if (o.parent) o.parent.remove(o);
      o.geometry.dispose();
    }
    fx.add.mat.dispose();
    fx.alpha.mat.dispose();
    fx.nums.mat.dispose();
    for (const t of fx.tracers) {
      if (t.mesh.parent) t.mesh.parent.remove(t.mesh);
      t.mesh.material.dispose();
    }
    for (const r of fx.rings) {
      if (r.s.parent) r.s.parent.remove(r.s);
      r.s.material.dispose();
    }
    for (const f of fx.flashes) if (f.s.parent) f.s.parent.remove(f.s);
    fx.flashes[0].s.material.dispose();
    fx.holes.material.dispose();
    fx.scorches.material.dispose();
  }

  fx.init = function (scene) {
    disposeOld();
    fx.scene = scene;
    const low = G.settings.quality === 'dusuk';
    fx.add = new PSys(low ? 700 : 1800, true);
    fx.alpha = new PSys(low ? 700 : 1700, false);
    fx.puffs = new PuffSys(low ? 110 : 200, low ? 8 : 12);
    fx.nums = new NumSys();
    scene.add(fx.add.points, fx.alpha.points, fx.puffs.mesh, fx.nums.points);
    // izli mermiler: hızla uçan şeker çubukları
    fx.tracers = [];
    if (!TEX.tracerGeo) {
      TEX.tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
      TEX.tracerGeo.rotateX(Math.PI / 2);
    }
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(TEX.tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 6;
      scene.add(m);
      fx.tracers.push({ mesh: m, life: 0, max: 0.1, fx: 0, fy: 0, fz: 0, dx: 0, dy: 0, dz: 0, d: 0, len: 1 });
    }
    fx.tracerIdx = 0;
    // minik isabet izleri
    const holeMat = new THREE.MeshBasicMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    fx.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.12), holeMat, 120);
    fx.holes.count = 0;
    fx.holes.frustumCulled = false;
    fx.holeIdx = 0;
    scene.add(fx.holes);
    const scMat = new THREE.MeshBasicMaterial({ map: scorchTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    fx.scorches = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), scMat, 24);
    fx.scorches.count = 0;
    fx.scorches.frustumCulled = false;
    fx.scorchIdx = 0;
    scene.add(fx.scorches);
    // dünya namlu alevleri (yıldız)
    fx.flashes = [];
    const fm = new THREE.SpriteMaterial({ map: flashTex(), depthWrite: false, transparent: true });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(fm);
      s.visible = false;
      s.renderOrder = 7;
      scene.add(s);
      fx.flashes.push({ s, life: 0 });
    }
    fx.flashIdx = 0;
    // şok dalgası halkaları
    fx.rings = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), depthWrite: false, transparent: true, color: 0xffffff }));
      s.visible = false;
      s.renderOrder = 8;
      scene.add(s);
      fx.rings.push({ s, life: 0, max: 0.4, r: 1 });
    }
    fx.ringIdx = 0;
    fx.emitters = [];
    fx.dummy = new THREE.Object3D();
    fx.stepT = 0;
    hookDeaths();
  };

  fx.clear = function () {
    if (!fx.add) return;
    fx.add.n = 0;
    fx.alpha.n = 0;
    fx.puffs.n = 0;
    fx.puffs.mesh.count = 0;
    fx.nums.clear();
    fx.holes.count = 0;
    fx.scorches.count = 0;
    fx.emitters.length = 0;
    for (const t of fx.tracers) t.mesh.visible = false;
    for (const r of fx.rings) r.s.visible = false;
  };

  // sersemlemiş karakterlerin başında dönen yıldızlar + adım tozu
  function charOverlays(dt) {
    const m = G.game;
    if (!m || !m.chars || dt <= 0) return;
    const cam = G.camera;
    fx.stepT -= dt;
    const doSteps = fx.stepT <= 0 && G.settings.quality !== 'dusuk';
    if (doSteps) fx.stepT = 0.12;
    for (let i = 0; i < m.chars.length; i++) {
      const c = m.chars[i];
      if (!c.alive || c.isPlayer || !c.pos) continue;
      if (c.stunUntil && G.time < c.stunUntil && c.headPos) {
        const h = c.headPos(tv);
        const base = G.time * 6;
        for (let k = 0; k < 4; k++) {
          const a = base + (k * Math.PI * 2) / 4;
          const sc = STAR_COLS[k];
          fx.alpha.add(h.x + Math.cos(a) * 0.36, h.y + 0.34 + Math.sin(a * 2) * 0.04, h.z + Math.sin(a) * 0.36, 0, 0, 0, dt * 1.6 + 0.01, 0.2, 0.2, sc[0], sc[1], sc[2], 1, 0, 0, SH.STAR, 4);
        }
      }
      if (doSteps && c.kind !== 'dog') {
        const lx = c._fxLX, lz = c._fxLZ;
        c._fxLX = c.pos.x;
        c._fxLZ = c.pos.z;
        if (lx == null) continue;
        const mv = Math.abs(c.pos.x - lx) + Math.abs(c.pos.z - lz);
        if (mv > 0.38 && mv < 3 && cam && Math.abs(cam.position.x - c.pos.x) + Math.abs(cam.position.z - c.pos.z) < 34) {
          c._fxStep = ((c._fxStep || 0) + 1) % 2;
          if (c._fxStep === 0) {
            const col = Math.random() < 0.5 ? PAL.cream : PAL.sand;
            fx.alpha.add(c.pos.x + U.rand(-0.15, 0.15), c.pos.y + 0.08, c.pos.z + U.rand(-0.15, 0.15), U.rand(-0.3, 0.3), 0.4, U.rand(-0.3, 0.3), 0.45, 0.12, 0.3, col[0], col[1], col[2], 0.8, 0, 2);
          }
        }
      }
    }
  }

  fx.update = function (dt, camera, renderH) {
    if (!fx.add) return;
    const scale = renderH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    fx.add.mat.uniforms.scale.value = scale;
    fx.alpha.mat.uniforms.scale.value = scale;
    fx.nums.mat.uniforms.vp.value.set(renderH * (camera.aspect || 1.7), renderH);
    // sayı boyu CSS yüksekliğine göre: telefonda (360px) okunur kalsın, büyük ekranda taşmasın
    const cssH = window.innerHeight || renderH;
    fx.nums.mat.uniforms.uis.value = (renderH / cssH) * U.clamp(cssH / 720, 0.8, 1.3);
    // yayıcılar (sis bombası, yangın)
    for (let i = fx.emitters.length - 1; i >= 0; i--) {
      const e = fx.emitters[i];
      e.acc += dt;
      while (e.acc > e.rate) {
        e.acc -= e.rate;
        e.fn(e);
      }
      if (G.time > e.until) fx.emitters.splice(i, 1);
    }
    charOverlays(dt);
    fx.add.update(dt);
    fx.alpha.update(dt);
    fx.puffs.update(dt);
    fx.nums.update(dt);
    for (const t of fx.tracers) {
      if (!t.mesh.visible) continue;
      t.life += dt;
      const k = t.life / t.max;
      if (k >= 1) {
        t.mesh.visible = false;
        continue;
      }
      // baş kısım hedefe doğru uçar, kuyruk takip eder
      const head = Math.min(t.d, t.d * Math.min(1, k * 1.25) + t.len * 0.5);
      const tail = Math.max(0, head - t.len);
      const mid = (head + tail) * 0.5, L = Math.max(0.05, head - tail);
      t.mesh.position.set(t.fx + t.dx * mid, t.fy + t.dy * mid, t.fz + t.dz * mid);
      t.mesh.scale.z = L;
      t.mesh.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    }
    for (const f of fx.flashes) {
      if (!f.s.visible) continue;
      f.life -= dt;
      if (f.life <= 0) f.s.visible = false;
      else {
        const s = f.s.scale.x * (1 + dt * 6);
        f.s.scale.set(s, s, s);
      }
    }
    for (const r of fx.rings) {
      if (!r.s.visible) continue;
      r.life += dt;
      const k = r.life / r.max;
      if (k >= 1) {
        r.s.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const s = r.r * (0.15 + e);
      r.s.scale.set(s, s, s);
      r.s.material.opacity = (1 - k) * (1 - k) * 0.95;
    }
    fx.trauma = Math.max(0, fx.trauma - dt * 1.4);
  };

  fx.shake = function (amount) {
    fx.trauma = Math.min(1, fx.trauma + amount);
  };

  fx.tracer = function (from, to, color) {
    if (!fx.tracers) return;
    const t = fx.tracers[fx.tracerIdx++ % fx.tracers.length];
    const d = from.distanceTo(to);
    if (d < 1) return;
    const m = t.mesh;
    t.fx = from.x; t.fy = from.y; t.fz = from.z;
    t.dx = (to.x - from.x) / d; t.dy = (to.y - from.y) / d; t.dz = (to.z - from.z) / d;
    t.d = d;
    t.len = Math.min(d, 2.2 + d * 0.05);
    tv.copy(from).add(to).multiplyScalar(0.5);
    m.position.copy(tv);
    m.lookAt(to);
    const th = 0.026;
    m.scale.set(th, th, 0.05);
    const c = color == null ? 0xffe08a : color;
    m.material.color.setHex(TRACER_MAP[c] != null ? TRACER_MAP[c] : c);
    m.material.opacity = 1;
    m.visible = true;
    t.life = 0;
    t.max = 0.06 + Math.min(0.16, d / 260);
  };

  fx.hole = function (x, y, z, nx, ny, nz) {
    if (!fx.holes) return;
    const d = fx.dummy;
    d.position.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    d.lookAt(x + nx, y + ny, z + nz);
    d.rotateZ(Math.random() * 6.28);
    const s = 0.6 + Math.random() * 0.6;
    d.scale.set(s, s, s);
    d.updateMatrix();
    const i = fx.holeIdx++ % 120;
    fx.holes.setMatrixAt(i, d.matrix);
    fx.holes.count = Math.min(120, Math.max(fx.holes.count, i + 1));
    fx.holes.instanceMatrix.needsUpdate = true;
  };

  fx.scorch = function (x, z, size) {
    if (!fx.scorches) return;
    const d = fx.dummy;
    d.position.set(x, 0.03, z);
    d.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28);
    d.scale.set(size, size, size);
    d.updateMatrix();
    const i = fx.scorchIdx++ % 24;
    fx.scorches.setMatrixAt(i, d.matrix);
    fx.scorches.count = Math.min(24, Math.max(fx.scorches.count, i + 1));
    fx.scorches.instanceMatrix.needsUpdate = true;
  };

  // halka (şok dalgası / isabet "pop" halkası)
  fx.ring = function (pos, radius, color, dur) {
    if (!fx.rings) return;
    const r = fx.rings[fx.ringIdx++ % fx.rings.length];
    r.s.position.copy(pos);
    r.s.material.color.setHex(color == null ? 0xfff3a0 : color);
    r.s.material.opacity = 1;
    r.s.scale.set(0.01, 0.01, 0.01);
    r.r = radius;
    r.life = 0;
    r.max = dur || 0.4;
    r.s.visible = true;
  };

  // yıldız patlaması (ortak yardımcı)
  function starBurst(x, y, z, n, speed, size, life, cols, up) {
    const nn = cnt(n);
    for (let i = 0; i < nn; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = U.rand(-0.3, 1);
      const sp = speed * U.rand(0.55, 1);
      const c = cols ? pick(cols) : pick(STAR_COLS);
      fx.alpha.add(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + (up || 0), Math.sin(a) * Math.cos(e) * sp, life * U.rand(0.75, 1.15), size, size * 0.55, c[0], c[1], c[2], 1, 6, 1.8, SH.STAR, U.rand(-9, 9));
    }
  }
  function confetti(x, y, z, n, dx, dy, dz, speed, cols) {
    const nn = cnt(n);
    for (let i = 0; i < nn; i++) {
      const c = pick(cols);
      fx.alpha.add(x, y, z, dx * speed * U.rand(0.4, 1.2) + U.rand(-1.6, 1.6), dy * speed * U.rand(0.3, 1) + U.rand(0.8, 3), dz * speed * U.rand(0.4, 1.2) + U.rand(-1.6, 1.6), U.rand(0.7, 1.2), 0.07, 0.06, c[0], c[1], c[2], 1, 5, 2.6, SH.CONF, U.rand(-14, 14));
    }
  }
  function twinkles(x, y, z, n, spread, size, cols) {
    const nn = cnt(n);
    for (let i = 0; i < nn; i++) {
      const c = cols ? pick(cols) : PAL.white;
      fx.add.add(x + U.rand(-spread, spread), y + U.rand(-spread, spread), z + U.rand(-spread, spread), U.rand(-0.8, 0.8), U.rand(0.3, 1.6), U.rand(-0.8, 0.8), U.rand(0.35, 0.6), size, size * 0.3, c[0], c[1], c[2], 1, 0, 1.5, SH.TWINKLE, U.rand(-3, 3));
    }
  }

  // Mermi isabeti: minik toz pufu + pırıltı (metalde yıldız kıvılcım)
  fx.impact = function (x, y, z, nx, ny, nz, metal) {
    if (!fx.add) return;
    const n = cnt(metal ? 4 : 2);
    for (let i = 0; i < n; i++) {
      const sp = 2.5 + Math.random() * 3;
      const c = metal ? (Math.random() < 0.5 ? PAL.sun : PAL.white) : PAL.sun;
      fx.add.add(x, y, z, nx * sp + U.rand(-1.5, 1.5), ny * sp + U.rand(0, 2.5), nz * sp + U.rand(-1.5, 1.5), 0.2 + Math.random() * 0.15, 0.09, 0.03, c[0], c[1], c[2], 1, 9, 2, metal ? SH.STAR : SH.TWINKLE, 8);
    }
    // küçük ve kısa ömürlü: yakın duvara tararken hedefi kapatan bulut oluşmasın
    const camI = G.camera;
    const near = camI ? Math.abs(camI.position.x - x) + Math.abs(camI.position.y - y) + Math.abs(camI.position.z - z) < 5 : false;
    const pn = near ? 1 : cnt(2);
    for (let i = 0; i < pn; i++) {
      const c = metal ? PAL.skyL : pick(PUFF_COLS);
      fx.alpha.add(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx * U.rand(0.4, 1.2) + U.rand(-0.4, 0.4), ny * U.rand(0.4, 1.2) + U.rand(0.1, 0.7), nz * U.rand(0.4, 1.2) + U.rand(-0.4, 0.4), 0.22 + Math.random() * 0.18, 0.07, near ? 0.12 : 0.2, c[0], c[1], c[2], 0.85, -0.4, 3);
    }
    if (Math.random() < 0.45) fx.hole(x, y, z, nx, ny, nz);
  };

  // renk → sevimli renk takımı (koyu kırmızılar şekere döner)
  function tintFor(color) {
    if (!color) return TINTS.candy;
    if (color.length === 3 && Array.isArray(color[0])) return color;
    const r = color[0], g = color[1], b = color[2];
    if (r > g * 2 && r > b * 2) {
      // eski "zombi kanı" kahverengi-kırmızısı → nane/limon; diğer kırmızılar → şeker
      return r < 0.45 ? TINTS.zombie : TINTS.candy;
    }
    if (g > r && g > b) return TINTS.zombie;
    return [color, PAL.white, PAL.sun];
  }
  fx.tintFor = function (who) {
    if (!who) return TINTS.candy;
    if (who.kind === 'zombie' || who.kind === 'dog') return TINTS.zombie;
    if (who.team === 0) return TINTS.team0;
    if (who.team === 1) return TINTS.team1;
    return TINTS.candy;
  };

  // "Kan" artık konfeti + yıldız: renk koyu kırmızı bile gelse sevimli tonlara çevrilir
  fx.blood = function (x, y, z, dx, dy, dz, amount, color) {
    if (!fx.alpha) return;
    const cols = tintFor(color);
    const am = amount || 1;
    confetti(x, y, z, 5 * am, dx, dy, dz, 2.2, cols);
    starBurst(x, y, z, 1 + am * 1.2, 2.4, 0.13, 0.5, cols, 1.2);
    twinkles(x, y, z, 1 + am, 0.12, 0.22, null);
    // isabet "pop" halkası (nokta)
    const c = cols[0];
    fx.alpha.add(x, y, z, 0, 0.2, 0, 0.16, 0.1, 0.3, c[0], c[1], c[2], 0.85, 0, 0, SH.RING, 0);
    if (am >= 3) fx.poof(tv2.set(x, y, z), cols, 0.7);
  };

  // Ölüm "puf" bulutu: beyaz pufl halkası + yıldızlar + konfeti
  fx.poof = function (pos, cols, size) {
    if (!fx.puffs) return;
    const c = cols && Array.isArray(cols[0]) ? cols : TINTS.candy;
    const s = size || 1;
    const n = cnt(9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = U.rand(1.6, 2.6) * s;
      const pc = i % 3 === 0 ? pick(PUFF_COLS) : PAL.white;
      fx.puffs.add(pos.x + Math.cos(a) * 0.15, pos.y + U.rand(-0.35, 0.35), pos.z + Math.sin(a) * 0.15, Math.cos(a) * sp, U.rand(0.2, 1.2), Math.sin(a) * sp, U.rand(0.45, 0.7), 0.16 * s, U.rand(0.28, 0.42) * s, pc, 4.5, 1.2);
    }
    fx.puffs.add(pos.x, pos.y, pos.z, 0, 0.6, 0, 0.5, 0.3 * s, 0.55 * s, PAL.white, 3, 0.5);
    starBurst(pos.x, pos.y + 0.1, pos.z, 7, 4.2 * s, 0.2 * s, 0.75, STAR_COLS, 2);
    confetti(pos.x, pos.y, pos.z, 10, 0, 1, 0, 1.5, c);
    twinkles(pos.x, pos.y, pos.z, 4, 0.5, 0.35, null);
  };

  // Uçan hasar sayısı: beyaz (kafa: sarı, öldürme: pembe ve büyük).
  // opts.target (isteğe bağlı): aynı hedefe art arda gelen isabetler tek sayıda toplanır.
  fx.damageNumber = function (pos, amount, opts) {
    if (!fx.nums || !pos || !(amount > 0)) return;
    if (G.settings.damageNumbers === false) return;
    const o = opts || {};
    fx.nums.spawn(pos.x, pos.y, pos.z, amount, !!o.head, !!o.kill, o.target);
    if (o.kill) starBurst(pos.x, pos.y + 0.3, pos.z, 4, 2.5, 0.14, 0.55, [PAL.sun, PAL.bubble, PAL.white], 1.5);
  };

  fx.muzzle = function (pos, dir, big) {
    if (!fx.flashes) return;
    const f = fx.flashes[fx.flashIdx++ % fx.flashes.length];
    f.s.position.copy(pos);
    const s = big ? 0.6 : 0.42;
    f.s.scale.set(s, s, s);
    f.s.material.rotation = Math.random() * 6.28;
    f.s.visible = true;
    f.life = 0.055;
    if (Math.random() < 0.6) {
      const c = Math.random() < 0.5 ? PAL.sun : PAL.white;
      fx.add.add(pos.x, pos.y, pos.z, dir.x * 2 + U.rand(-0.6, 0.6), dir.y * 2 + U.rand(0, 0.8), dir.z * 2 + U.rand(-0.6, 0.6), 0.22, 0.12, 0.04, c[0], c[1], c[2], 1, 0, 3, SH.STAR, 10);
    }
    fx.alpha.add(pos.x, pos.y, pos.z, dir.x * 1.2, dir.y * 1.2 + 0.3, dir.z * 1.2, 0.4, 0.06, 0.24, 1, 0.97, 0.92, 0.45, -0.3, 2);
  };

  fx.flashLight = function (pos, intensity) {
    const w = G.world;
    if (!w || !w.muzzleLight) return;
    w.muzzleLight.position.copy(pos);
    w.muzzleLight.intensity = Math.max(w.muzzleLight.intensity, intensity || 2.2);
  };

  // Çizgi film patlaması: pop eden ateş topu + yuvarlak krem/şeftali pufları + halka + yıldızlar
  fx.explosion = function (pos, radius, opts) {
    if (!fx.add) return;
    const o = opts || {};
    const r = radius || 5;
    const k = o.stun ? 0.75 : U.clamp(r / 5, 0.35, 1.6);
    const x = pos.x, y = pos.y, z = pos.z;
    let core, puffCols, ringCol, starCols, light;
    if (o.stun) {
      core = [[1.1, 1.08, 1.15], [1.15, 1.05, 0.5]];
      puffCols = [hex3(0xf4ecff), hex3(0xe2f4ff), PAL.cream, PAL.pink];
      ringCol = 0xffffff;
      starCols = [PAL.sun, PAL.white, PAL.sky, PAL.bubble];
      light = [1, 1, 0.9];
    } else if (o.frost) {
      core = [PAL.white, PAL.skyL];
      puffCols = [PAL.white, PAL.skyL, PAL.lilac, hex3(0xe2f4ff)];
      ringCol = 0x9ff0ff;
      starCols = [PAL.sky, PAL.white, PAL.lilac];
      light = [0.6, 0.9, 1];
    } else if (o.plasma) {
      core = [PAL.mintL, PAL.white];
      puffCols = [PAL.mintL, hex3(0xd6ffe9), PAL.white];
      ringCol = 0x7dffc0;
      starCols = [PAL.mint, PAL.lime, PAL.white];
      light = [0.4, 1, 0.65];
    } else {
      core = [[1.3, 1.05, 0.35], [1.3, 0.8, 0.3], [1.35, 1.2, 0.55]];
      puffCols = PUFF_COLS;
      ringCol = 0xfff1a0;
      starCols = STAR_COLS;
      light = [1, 0.7, 0.45];
    }
    // ateş topu: parlak sarı küreler hızla pop edip söner
    const nc = o.small ? 2 : cnt(4);
    for (let i = 0; i < nc; i++) {
      fx.puffs.add(x + U.rand(-0.4, 0.4) * k, y + 0.4 * k + U.rand(0, 0.5) * k, z + U.rand(-0.4, 0.4) * k, U.rand(-1, 1), U.rand(0.5, 2), U.rand(-1, 1), U.rand(0.28, 0.4), 0.3 * k, U.rand(0.9, 1.3) * k, pick(core), 2, 0);
    }
    // duman pufları
    const np = o.small ? 4 : cnt(o.stun ? 8 : 12);
    for (let i = 0; i < np; i++) {
      const a = (i / np) * Math.PI * 2 + Math.random() * 0.5;
      const sp = U.rand(2.5, 5.5) * k;
      const big = U.rand(0.65, 1.15) * k;
      fx.puffs.add(x + Math.cos(a) * 0.4 * k, y + U.rand(0.2, 0.9) * k, z + Math.sin(a) * 0.4 * k, Math.cos(a) * sp, U.rand(0.8, 3.2) * k, Math.sin(a) * sp, U.rand(1.1, 1.8), big * 0.35, big, pick(puffCols), 2.6, 0.7);
    }
    // üstte büyük "mantar" puflar
    if (!o.small && !o.stun) {
      for (let i = 0; i < cnt(3); i++) {
        fx.puffs.add(x + U.rand(-0.6, 0.6) * k, y + 1 * k, z + U.rand(-0.6, 0.6) * k, U.rand(-0.5, 0.5), U.rand(2.5, 4) * k, U.rand(-0.5, 0.5), U.rand(1.5, 2.1), 0.4 * k, U.rand(1.1, 1.5) * k, pick(puffCols), 1.8, 0.4);
      }
    }
    // şok dalgası
    fx.ring(tv.set(x, y + 0.6 * k, z), r * (o.stun ? 2.4 : 1.9), ringCol, o.stun ? 0.5 : 0.38);
    if (!o.small) fx.ring(tv.set(x, y + 0.6 * k, z), r * 1.1, 0xffffff, 0.22);
    // ışık pırıltıları (glow)
    twinkles(x, y + 0.6 * k, z, o.small ? 4 : 10, 0.8 * k, 0.7 * k, o.frost ? [PAL.skyL, PAL.white] : o.plasma ? [PAL.mint, PAL.white] : [PAL.sun, PAL.white]);
    // yıldızlar + konfeti
    starBurst(x, y + 0.6 * k, z, o.small ? 4 : o.stun ? 16 : 10, 7 * k, 0.32 * Math.max(0.6, k), 1.1, starCols, 3);
    if (!o.small) confetti(x, y + 0.5, z, 14, 0, 1, 0, 3, starCols);
    if (!o.plasma && !o.stun && !o.small && pos.y < 1.5) fx.scorch(x, z, r * 0.55);
    const w = G.world;
    if (w && w.boomLight) {
      w.boomLight.position.set(x, y + 1, z);
      w.boomLight.color.setRGB(light[0], light[1], light[2]);
      w.boomLight.intensity = o.small ? 3 : 7;
    }
    // kamera sarsıntısı
    const cam = G.camera;
    if (cam) {
      const d = cam.position.distanceTo(pos);
      fx.shake(U.clamp(1.1 - d / (r * 5), 0, 0.9) * (o.stun ? 0.5 : 1));
    }
  };

  // Sis bombası: pastel pamuk şeker bulutu
  fx.smokeCloud = function (pos, dur) {
    if (!fx.puffs) return;
    const until = G.time + dur;
    const px = pos.x, py = pos.y, pz = pos.z;
    // açılış pufu
    for (let i = 0; i < cnt(10); i++) {
      const a = Math.random() * Math.PI * 2;
      fx.puffs.add(px, py + 0.5, pz, Math.cos(a) * U.rand(2, 4), U.rand(0.5, 2), Math.sin(a) * U.rand(2, 4), U.rand(2.5, 4), 0.4, U.rand(1.1, 1.6), pick(SMOKE_COLS), 1.2, 0);
    }
    fx.emitters.push({
      acc: 0,
      rate: G.settings.quality === 'dusuk' ? 0.2 : 0.13,
      until,
      fn: () => {
        const left = until - G.time;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.6;
        fx.puffs.add(px + Math.cos(a) * r, py + U.rand(0.3, 2.2), pz + Math.sin(a) * r, U.rand(-0.25, 0.25), U.rand(0.02, 0.2), U.rand(-0.25, 0.25), Math.min(4.5, left + 1.2), 0.5, U.rand(1.1, 1.75), pick(SMOKE_COLS), 0.3, 0);
        if (Math.random() < 0.3) twinkles(px + Math.cos(a) * r, py + 1.2, pz + Math.sin(a) * r, 1, 0.5, 0.3, [PAL.white, PAL.pink]);
      },
    });
  };

  // Şeker renkli alevler (varil, işaret fişeği)
  fx.fireEmitter = function (pos, dur) {
    if (!fx.add) return;
    const px = pos.x, py = pos.y, pz = pos.z;
    fx.emitters.push({
      acc: 0,
      rate: G.settings.quality === 'dusuk' ? 0.09 : 0.055,
      until: G.time + dur,
      fn: () => {
        const c = Math.random() < 0.5 ? PAL.tang : Math.random() < 0.5 ? PAL.sun : PAL.bubble;
        fx.add.add(px + U.rand(-0.35, 0.35), py, pz + U.rand(-0.35, 0.35), U.rand(-0.2, 0.2), U.rand(1.2, 2.6), U.rand(-0.2, 0.2), 0.45 + Math.random() * 0.35, 0.55, 0.12, c[0], c[1], c[2], 0.95, -1, 1);
        if (Math.random() < 0.25) fx.alpha.add(px, py + 0.5, pz, U.rand(-0.5, 0.5), U.rand(1.5, 2.5), U.rand(-0.5, 0.5), 0.7, 0.14, 0.08, c[0], c[1], c[2], 1, 1, 1, SH.STAR, U.rand(-6, 6));
        if (Math.random() < 0.12) fx.puffs.add(px, py + 0.9, pz, U.rand(-0.2, 0.2), U.rand(0.8, 1.4), U.rand(-0.2, 0.2), 1.6, 0.15, U.rand(0.35, 0.55), pick(PUFF_COLS), 0.4, 0.2);
      },
    });
  };

  // yanan karakterden şeker alev yalazı
  fx.flameLick = function (x, y, z) {
    if (!fx.add) return;
    const c = Math.random() < 0.6 ? PAL.tang : PAL.bubble;
    fx.add.add(x, y, z, 0, U.rand(1, 2), 0, 0.4, 0.25, 0.05, c[0], c[1], c[2], 0.9, -1, 1);
  };

  fx.sparkle = function (pos, color, n) {
    if (!fx.add) return;
    const c = hex3(color == null ? 0xffd23a : color);
    for (let i = 0; i < (n || 10); i++) {
      fx.add.add(pos.x + U.rand(-0.3, 0.3), pos.y + U.rand(-0.3, 0.3), pos.z + U.rand(-0.3, 0.3), U.rand(-1, 1), U.rand(0.5, 2.5), U.rand(-1, 1), 0.6 + Math.random() * 0.5, 0.18, 0.04, c[0], c[1], c[2], 1, 1, 1, SH.TWINKLE, U.rand(-3, 3));
    }
  };

  // boş kovan: minik altın şeker çubuğu
  fx.brass = function (pos, vel) {
    if (!fx.alpha) return;
    fx.alpha.add(pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, 0.7, 0.05, 0.05, 1, 0.82, 0.25, 1, 10, 0.5, SH.CONF, U.rand(12, 22));
  };

  fx.plasmaTrail = function (pos) {
    if (!fx.add) return;
    fx.add.add(pos.x, pos.y, pos.z, U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), 0.3, 0.32, 0.05, 0.35, 1, 0.7, 0.9, 0, 1);
    if (Math.random() < 0.3) fx.add.add(pos.x, pos.y, pos.z, U.rand(-0.5, 0.5), U.rand(-0.5, 0.5), U.rand(-0.5, 0.5), 0.4, 0.16, 0.04, 0.8, 1, 0.9, 1, 0, 1, SH.TWINKLE, 4);
  };

  // roket izi: pembe ışık + yuvarlak krem puf zinciri
  fx.rocketTrail = function (pos) {
    if (!fx.alpha) return;
    fx.add.add(pos.x, pos.y, pos.z, U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), 0.15, 0.3, 0.1, 1, 0.55, 0.65, 1, 0, 1);
    const c = Math.random() < 0.6 ? PAL.white : PAL.cream;
    fx.alpha.add(pos.x, pos.y, pos.z, U.rand(-0.2, 0.2), U.rand(0, 0.4), U.rand(-0.2, 0.2), 1.1, 0.2, 0.7, c[0], c[1], c[2], 0.9, -0.1, 0.5);
  };

  // zombi doğarken topraktan çıkma: karamel toprak topakları + kum pufu
  fx.dirt = function (pos) {
    if (!fx.alpha) return;
    for (let i = 0; i < cnt(12); i++) {
      const c = Math.random() < 0.5 ? PAL.caramel : PAL.sand;
      fx.alpha.add(pos.x + U.rand(-0.5, 0.5), 0.1, pos.z + U.rand(-0.5, 0.5), U.rand(-1.5, 1.5), U.rand(1.5, 4), U.rand(-1.5, 1.5), 0.8, 0.14, 0.1, c[0], c[1], c[2], 1, 10, 0.5);
    }
    if (fx.puffs) {
      for (let i = 0; i < cnt(5); i++) {
        const a = (i / 5) * Math.PI * 2;
        fx.puffs.add(pos.x + Math.cos(a) * 0.3, 0.2, pos.z + Math.sin(a) * 0.3, Math.cos(a) * 1.4, U.rand(0.3, 0.9), Math.sin(a) * 1.4, 0.8, 0.12, U.rand(0.28, 0.4), PAL.sand, 3, 0.3);
      }
    }
    twinkles(pos.x, 0.6, pos.z, 3, 0.4, 0.3, [PAL.mint, PAL.white]);
  };

  // Karakter ölünce "puf": Character.prototype.die bir kez sarılır (davranış aynı kalır)
  function hookDeaths() {
    const C = G.Character;
    if (!C || !C.prototype || C.prototype._fxPoof) return;
    const orig = C.prototype.die;
    C.prototype._fxPoof = true;
    C.prototype.die = function (attacker, info) {
      const was = this.alive;
      orig.call(this, attacker, info);
      if (!was || this.isPlayer || !fx.puffs) return;
      try {
        const p = this.chest ? this.chest(tv2) : tv2.copy(this.pos);
        fx.poof(p, fx.tintFor(this), this.kind === 'dog' ? 0.75 : 1);
      } catch (e) { /* görsel; yoksay */ }
    };
  }
})();
