'use strict';
// Gölge Timi — parçacıklar, izli mermiler, kurşun delikleri, patlamalar.
(function () {
  const G = window.G;
  const U = G.util;

  const VS = [
    'attribute float psize; attribute float palpha; attribute vec3 pcolor;',
    'uniform float scale; varying vec3 vC; varying float vA;',
    'void main(){',
    ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    ' gl_Position = projectionMatrix * mv;',
    ' gl_PointSize = max(1.0, psize * scale / max(0.1, -mv.z));',
    ' vC = pcolor; vA = palpha;',
    '}',
  ].join('\n');
  const FS = [
    'varying vec3 vC; varying float vA;',
    'void main(){',
    ' vec2 d = gl_PointCoord - 0.5;',
    ' if (dot(d, d) > 0.25) discard;',
    ' gl_FragColor = vec4(vC, vA);',
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
      for (const at of [this.pa, this.ca, this.aa, this.sa]) at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.pa);
      g.setAttribute('pcolor', this.ca);
      g.setAttribute('palpha', this.aa);
      g.setAttribute('psize', this.sa);
      g.setDrawRange(0, 0);
      this.mat = new THREE.ShaderMaterial({
        uniforms: { scale: { value: 400 } },
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
    add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, grav, drag) {
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
        }
        this.s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        const fadeIn = Math.min(1, t * 8);
        this.a[i] = this.a0[i] * fadeIn * (1 - t);
      }
      this.points.geometry.setDrawRange(0, this.n);
      this.pa.needsUpdate = this.ca.needsUpdate = this.aa.needsUpdate = this.sa.needsUpdate = true;
    }
  }

  const fx = (G.fx = {
    trauma: 0,
    scene: null,
  });

  fx.init = function (scene) {
    fx.scene = scene;
    fx.add = new PSys(G.settings.quality === 'dusuk' ? 900 : 2200, true);
    fx.alpha = new PSys(G.settings.quality === 'dusuk' ? 800 : 1800, false);
    scene.add(fx.add.points, fx.alpha.points);
    // izli mermiler
    fx.tracers = [];
    const tg = new THREE.BoxGeometry(1, 1, 1);
    tg.translate(0, 0, -0.5);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      fx.tracers.push({ mesh: m, life: 0, max: 0.1 });
    }
    fx.tracerIdx = 0;
    // kurşun delikleri
    const holeMat = new THREE.MeshBasicMaterial({ map: G.spriteTex('hole'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    fx.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), holeMat, 160);
    fx.holes.count = 0;
    fx.holes.frustumCulled = false;
    fx.holeIdx = 0;
    scene.add(fx.holes);
    const scMat = new THREE.MeshBasicMaterial({ map: G.spriteTex('scorch'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    fx.scorches = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), scMat, 24);
    fx.scorches.count = 0;
    fx.scorches.frustumCulled = false;
    fx.scorchIdx = 0;
    scene.add(fx.scorches);
    // dünya namlu alevleri
    fx.flashes = [];
    const fm = new THREE.SpriteMaterial({ map: G.spriteTex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(fm);
      s.visible = false;
      scene.add(s);
      fx.flashes.push({ s, life: 0 });
    }
    fx.flashIdx = 0;
    fx.emitters = [];
    fx.dummy = new THREE.Object3D();
  };

  fx.clear = function () {
    if (!fx.add) return;
    fx.add.n = 0;
    fx.alpha.n = 0;
    fx.holes.count = 0;
    fx.scorches.count = 0;
    fx.emitters.length = 0;
    for (const t of fx.tracers) t.mesh.visible = false;
  };

  fx.update = function (dt, camera, renderH) {
    if (!fx.add) return;
    const scale = renderH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    fx.add.mat.uniforms.scale.value = scale;
    fx.alpha.mat.uniforms.scale.value = scale;
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
    fx.add.update(dt);
    fx.alpha.update(dt);
    for (const t of fx.tracers) {
      if (!t.mesh.visible) continue;
      t.life += dt;
      const k = 1 - t.life / t.max;
      if (k <= 0) t.mesh.visible = false;
      else t.mesh.material.opacity = k * 0.9;
    }
    for (const f of fx.flashes) {
      if (!f.s.visible) continue;
      f.life -= dt;
      if (f.life <= 0) f.s.visible = false;
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
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(0.045, 0.045, Math.min(d, 18));
    // izi kurşun yönünde biraz ileri kaydır (hızlı görünür)
    m.material.color.setHex(color || 0xffe08a);
    m.material.opacity = 0.9;
    m.visible = true;
    t.life = 0;
    t.max = 0.07 + Math.min(0.08, d / 600);
  };

  fx.hole = function (x, y, z, nx, ny, nz) {
    if (!fx.holes) return;
    const d = fx.dummy;
    d.position.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    d.lookAt(x + nx, y + ny, z + nz);
    d.rotateZ(Math.random() * 6.28);
    const s = 0.7 + Math.random() * 0.6;
    d.scale.set(s, s, s);
    d.updateMatrix();
    const i = fx.holeIdx++ % 160;
    fx.holes.setMatrixAt(i, d.matrix);
    fx.holes.count = Math.min(160, Math.max(fx.holes.count, i + 1));
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

  // Mermi isabeti: yüzeye göre kıvılcım veya toz
  fx.impact = function (x, y, z, nx, ny, nz, metal) {
    if (!fx.add) return;
    const n = metal ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const sp = 3 + Math.random() * 5;
      fx.add.add(x, y, z, nx * sp + U.rand(-2, 2), ny * sp + U.rand(0, 3), nz * sp + U.rand(-2, 2), 0.15 + Math.random() * 0.2, 0.05, 0.02, 1, 0.8, 0.4, 1, 12, 2);
    }
    const dc = metal ? [0.35, 0.35, 0.37] : [0.55, 0.5, 0.42];
    for (let i = 0; i < 4; i++) {
      fx.alpha.add(x, y, z, nx * U.rand(0.3, 1.5) + U.rand(-0.4, 0.4), ny * U.rand(0.3, 1.5) + U.rand(0, 0.6), nz * U.rand(0.3, 1.5) + U.rand(-0.4, 0.4), 0.5 + Math.random() * 0.5, 0.12, 0.45, dc[0], dc[1], dc[2], 0.7, 0.5, 2);
    }
    if (ny < 0.9 || Math.random() < 0.6) fx.hole(x, y, z, nx, ny, nz);
  };

  fx.blood = function (x, y, z, dx, dy, dz, amount, color) {
    if (!fx.alpha) return;
    const c = color || [0.55, 0.03, 0.03];
    const n = Math.round(6 * (amount || 1));
    for (let i = 0; i < n; i++) {
      fx.alpha.add(x, y, z, dx * U.rand(1, 4) + U.rand(-1.2, 1.2), dy * U.rand(1, 3) + U.rand(-0.5, 2), dz * U.rand(1, 4) + U.rand(-1.2, 1.2), 0.4 + Math.random() * 0.4, 0.07, 0.04, c[0], c[1], c[2], 0.95, 9, 1);
    }
    fx.alpha.add(x, y, z, 0, 0.3, 0, 0.35, 0.2, 0.55, c[0] * 0.8, c[1], c[2], 0.6, 0, 3);
  };

  fx.muzzle = function (pos, dir, big) {
    if (!fx.flashes) return;
    const f = fx.flashes[fx.flashIdx++ % fx.flashes.length];
    f.s.position.copy(pos);
    const s = big ? 0.75 : 0.5;
    f.s.scale.set(s, s, s);
    f.s.material.rotation = Math.random() * 6.28;
    f.s.visible = true;
    f.life = 0.05;
    fx.alpha.add(pos.x, pos.y, pos.z, dir.x * 1.5, dir.y * 1.5 + 0.3, dir.z * 1.5, 0.5, 0.1, 0.5, 0.6, 0.6, 0.6, 0.25, -0.3, 2);
  };

  fx.flashLight = function (pos, intensity) {
    const w = G.world;
    if (!w || !w.muzzleLight) return;
    w.muzzleLight.position.copy(pos);
    w.muzzleLight.intensity = Math.max(w.muzzleLight.intensity, intensity || 2.2);
  };

  fx.explosion = function (pos, radius, opts) {
    if (!fx.add) return;
    const o = opts || {};
    const r = radius || 5;
    const col = o.frost ? [0.55, 0.9, 1] : o.plasma ? [0.3, 1, 0.55] : [1, 0.55, 0.15];
    for (let i = 0; i < 26 + r * 3; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5;
      const sp = U.rand(2, 7) * (r / 5);
      fx.add.add(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1.5, Math.sin(a) * Math.cos(e) * sp, 0.35 + Math.random() * 0.4, 0.9 + Math.random() * 0.8, 1.6 + Math.random(), col[0], col[1], col[2], 1, -1, 3);
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = U.rand(6, 16);
      fx.add.add(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * sp * 0.7, U.rand(4, 12), Math.sin(a) * sp * 0.7, 0.6 + Math.random() * 0.6, 0.12, 0.05, 1, 0.85, 0.4, 1, 18, 0.5);
    }
    if (!o.plasma) {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = U.rand(0.5, 2.5);
        const g = U.rand(0.12, 0.22);
        fx.alpha.add(pos.x + U.rand(-1, 1), pos.y + U.rand(0, 1.5), pos.z + U.rand(-1, 1), Math.cos(a) * sp, U.rand(0.8, 2.8), Math.sin(a) * sp, 1.8 + Math.random() * 1.6, 1.5, 4.2, g, g, g, 0.75, -0.2, 0.8);
      }
      if (pos.y < 1.5) fx.scorch(pos.x, pos.z, r * 0.6);
    }
    const w = G.world;
    if (w && w.boomLight) {
      w.boomLight.position.set(pos.x, pos.y + 1, pos.z);
      w.boomLight.color.setRGB(col[0], col[1] * 0.9, col[2]);
      w.boomLight.intensity = 7;
    }
    // kamera sarsıntısı
    const cam = G.camera;
    if (cam) {
      const d = cam.position.distanceTo(pos);
      fx.shake(U.clamp(1.1 - d / (r * 5), 0, 0.9));
    }
  };

  fx.smokeCloud = function (pos, dur) {
    if (!fx.alpha) return;
    const until = G.time + dur;
    fx.emitters.push({
      acc: 0,
      rate: 0.045,
      until,
      fn: () => {
        const left = until - G.time;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
        const g = U.rand(0.62, 0.75);
        fx.alpha.add(pos.x + Math.cos(a) * r, pos.y + U.rand(0.2, 1.8), pos.z + Math.sin(a) * r, U.rand(-0.4, 0.4), U.rand(0.05, 0.4), U.rand(-0.4, 0.4), Math.min(4.5, left + 1), 3, 6.5, g, g, g + 0.02, 0.55, -0.02, 0.2);
      },
    });
  };

  fx.fireEmitter = function (pos, dur) {
    if (!fx.add) return;
    fx.emitters.push({
      acc: 0,
      rate: 0.05,
      until: G.time + dur,
      fn: () => {
        fx.add.add(pos.x + U.rand(-0.4, 0.4), pos.y, pos.z + U.rand(-0.4, 0.4), U.rand(-0.2, 0.2), U.rand(1, 2.5), U.rand(-0.2, 0.2), 0.5 + Math.random() * 0.4, 0.5, 0.15, 1, 0.5, 0.12, 0.9, -1, 1);
        if (Math.random() < 0.3) {
          const g = 0.15;
          fx.alpha.add(pos.x, pos.y + 0.8, pos.z, U.rand(-0.2, 0.2), U.rand(0.8, 1.5), U.rand(-0.2, 0.2), 2, 0.6, 2.4, g, g, g, 0.5, -0.1, 0.3);
        }
      },
    });
  };

  fx.sparkle = function (pos, color, n) {
    if (!fx.add) return;
    const c = new THREE.Color(color || 0xffd23a);
    for (let i = 0; i < (n || 10); i++) {
      fx.add.add(pos.x + U.rand(-0.3, 0.3), pos.y + U.rand(-0.3, 0.3), pos.z + U.rand(-0.3, 0.3), U.rand(-1, 1), U.rand(0.5, 2.5), U.rand(-1, 1), 0.6 + Math.random() * 0.5, 0.12, 0.02, c.r, c.g, c.b, 1, 1, 1);
    }
  };

  fx.brass = function (pos, vel) {
    if (!fx.alpha) return;
    fx.alpha.add(pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, 0.7, 0.035, 0.035, 0.85, 0.65, 0.2, 1, 10, 0.5);
  };

  fx.plasmaTrail = function (pos) {
    if (!fx.add) return;
    fx.add.add(pos.x, pos.y, pos.z, U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), 0.25, 0.3, 0.05, 0.3, 1, 0.6, 0.9, 0, 1);
  };

  fx.rocketTrail = function (pos) {
    if (!fx.alpha) return;
    fx.add.add(pos.x, pos.y, pos.z, U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), 0.15, 0.3, 0.1, 1, 0.6, 0.2, 1, 0, 1);
    const g = 0.6;
    fx.alpha.add(pos.x, pos.y, pos.z, U.rand(-0.2, 0.2), U.rand(0, 0.4), U.rand(-0.2, 0.2), 1.4, 0.3, 1.4, g, g, g, 0.5, -0.1, 0.5);
  };

  // zombi doğarken topraktan çıkma
  fx.dirt = function (pos) {
    if (!fx.alpha) return;
    for (let i = 0; i < 14; i++) {
      fx.alpha.add(pos.x + U.rand(-0.5, 0.5), 0.1, pos.z + U.rand(-0.5, 0.5), U.rand(-1.5, 1.5), U.rand(1.5, 4), U.rand(-1.5, 1.5), 0.8, 0.12, 0.08, 0.25, 0.2, 0.15, 1, 10, 0.5);
    }
  };
})();
