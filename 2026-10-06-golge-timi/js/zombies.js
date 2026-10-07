'use strict';
// Gölge Timi — Zombi modu: zombiler, köpekler, rauntlar, kapılar, duvar
// silahları, gizem kutusu, yetenek makineleri (Çay Ocağı dahil), dönüştürücü.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const FACE_N = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // ------------------------------------------------------------------
  class Zombie extends G.Character {
    constructor(kind, health, tier) {
      super({ team: 9, name: kind === 'dog' ? 'Cehennem Köpeği' : 'Zombi', kind, health });
      this.tier = tier;
      this.speed = kind === 'dog' ? U.rand(6.2, 7.2) : [U.rand(1.3, 1.8), U.rand(3.4, 4.0), U.rand(5.0, 5.8)][tier];
      this.radius = kind === 'dog' ? 0.4 : 0.32;
      this.height = kind === 'dog' ? 1.0 : 1.8;
      this.riseT = kind === 'dog' ? 1 : 0;
      this.attackT = 0;
      this.attackCD = 0;
      this.groanAt = G.time + U.rand(1, 6);
      this.stuckT = 0;
      this.lastPos = new THREE.Vector3();
      this.lastProgress = G.time;
    }
    buildModel(scene) {
      this.model = this.kind === 'dog' ? G.makeDog() : G.makeHumanoid({ kind: 'zombie', eyeColor: this.tier === 2 ? 0x40c0ff : 0xffa020 });
      scene.add(this.model.root);
    }
    update(dt, dir) {
      const m = this.model;
      if (!this.alive) {
        if (m) m.animate(dt, { dead: true });
        return;
      }
      const p = dir.player;
      const world = G.world;
      if (this.riseT < 1) {
        this.riseT = Math.min(1, this.riseT + dt / 1.2);
        if (m) {
          m.root.position.set(this.pos.x, 0, this.pos.z);
          m.root.rotation.y = this.yaw;
          m.animate(dt, { speed: 0, rise: this.riseT });
        }
        return;
      }
      if (m && m.root.position.y < 0) m.root.position.y = 0;
      const frozen = G.time < dir.teaBreakUntil;
      let mx = 0, mz = 0;
      const dxp = p.pos.x - this.pos.x, dzp = p.pos.z - this.pos.z;
      const distP = Math.hypot(dxp, dzp);
      // saldırı
      this.attackCD -= dt;
      if (this.attackT > 0) {
        this.attackT -= dt;
        if (this.attackT <= 0 && p.alive) {
          if (distP < (this.kind === 'dog' ? 1.8 : 1.7) && Math.abs(p.pos.y - this.pos.y) < 1.5) {
            p.takeDamage(this.kind === 'dog' ? 40 : 50, this, { weapon: this.name, melee: true, from: this.pos.clone() });
            G.audio.play('stab', { vol: 0.7 });
          }
        }
      } else if (!frozen && p.alive && distP < (this.kind === 'dog' ? 1.4 : 1.3) && this.attackCD <= 0 && Math.abs(p.pos.y - this.pos.y) < 1.5) {
        this.attackT = this.kind === 'dog' ? 0.3 : 0.45;
        this.attackCD = 1.1;
        G.audio.play(this.kind === 'dog' ? 'bark' : 'zattack', { pos: this.pos });
      } else if (!frozen && p.alive) {
        // yön: yakında ve görüşte ise doğrudan, değilse akış alanı
        const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
        let tx = p.pos.x, tz = p.pos.z;
        const direct = distP < 7 && G.gridLine(world.walk, world.w, world.h, this.pos.x / CELL, this.pos.z / CELL, p.pos.x / CELL, p.pos.z / CELL, 0.18);
        if (!direct && dir.field) {
          let best = dir.field[cx + cz * world.w], bx = -1, bz = -1;
          for (let ddz = -1; ddz <= 1; ddz++)
            for (let ddx = -1; ddx <= 1; ddx++) {
              if (!ddx && !ddz) continue;
              if (!G.canStep(world.walk, world.w, world.h, cx, cz, ddx, ddz)) continue;
              const v = dir.field[cx + ddx + (cz + ddz) * world.w];
              if (v < best) {
                best = v;
                bx = cx + ddx;
                bz = cz + ddz;
              }
            }
          if (bx >= 0) {
            tx = bx * CELL + CELL / 2;
            tz = bz * CELL + CELL / 2;
          } else if (!isFinite(dir.field[cx + cz * world.w])) {
            // ulaşılamaz hücrede: en yakın yürünebilire doğru
            const n = world.nearestWalkable(cx, cz);
            if (n) {
              tx = n[0] * CELL + 1;
              tz = n[1] * CELL + 1;
            }
          }
        }
        const dx = tx - this.pos.x, dz = tz - this.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        mx = dx / d;
        mz = dz / d;
      }
      // ayrışma
      for (const o of dir.zombies) {
        if (o === this || !o.alive) continue;
        const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.55 && d2 > 1e-5) {
          const d = Math.sqrt(d2);
          mx += (dx / d) * 0.7;
          mz += (dz / d) * 0.7;
        }
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) {
        mx /= l;
        mz /= l;
      }
      let sp = this.attackT > 0 ? 0.3 : this.speed;
      if (G.time < this.stunUntil) sp *= 0.4;
      if (G.time < (this.frozenUntil || 0)) {
        sp = 0;
        this.attackT = 0;
        if (Math.random() < 0.2) G.fx.sparkle(this.chest(new THREE.Vector3()), 0x9fefff, 1);
      }
      this.vel.x = U.damp(this.vel.x, mx * sp, 10, dt);
      this.vel.z = U.damp(this.vel.z, mz * sp, 10, dt);
      this.vel.y -= 20 * dt;
      world.moveCharacter(this, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
      if (this.grounded) this.vel.y = 0;
      // oyuncunun içine girme
      const ddx = this.pos.x - p.pos.x, ddz = this.pos.z - p.pos.z;
      const dd = Math.hypot(ddx, ddz);
      if (dd < 0.62 && dd > 1e-4 && p.alive) {
        this.pos.x = p.pos.x + (ddx / dd) * 0.62;
        this.pos.z = p.pos.z + (ddz / dd) * 0.62;
      }
      if (l > 0.1 && !frozen) {
        const wy = Math.atan2(-this.vel.x, -this.vel.z);
        this.yaw += U.clamp(U.wrapAngle(wy - this.yaw), -8 * dt, 8 * dt);
      }
      // takılma
      if (this.pos.distanceTo(this.lastPos) > 1.5) {
        this.lastPos.copy(this.pos);
        this.lastProgress = G.time;
      } else if (G.time - this.lastProgress > 12 && distP > 12 && !frozen) {
        dir.respawnStuck(this);
        return;
      }
      if (G.time > this.groanAt) {
        this.groanAt = G.time + U.rand(3, 8);
        G.audio.play(this.kind === 'dog' ? 'bark' : 'groan', { pos: this.pos, vol: 0.8, ref: 8 });
      }
      if (m) {
        m.root.position.set(this.pos.x, this.pos.y, this.pos.z);
        m.root.rotation.y = this.yaw;
        m.animate(dt, { speed: frozen ? 0 : Math.hypot(this.vel.x, this.vel.z), attack: this.attackT > 0 ? 1 : 0 });
      }
    }
  }
  G.Zombie = Zombie;

  // ------------------------------------------------------------------
  // Sevimli (v3) görseller: tabela balonları, güçlendirme simgeleri ve
  // oyuncak makineler. Biçim yardımcıları props.js'teki G.cuteKit'ten gelir.
  const INK = 0x3b2a4a;
  const CREAM = 0xfffaf3;
  const FONT = '"Baloo 2", "Nunito", sans-serif';
  const kit = () => G.cuteKit || null;
  const cssHex = (hex) => '#' + (hex >>> 0).toString(16).padStart(6, '0');
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function tint(hex, k) {
    _ca.setHex(hex);
    _cb.setHex(k > 0 ? 0xffffff : INK);
    return _ca.lerp(_cb, Math.abs(k)).getHex();
  }
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function mtx(x, y, z, ry, sx, sy, sz, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
    const u = sx == null ? 1 : sx;
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(u, sy == null ? u : sy, sz == null ? u : sz));
  }
  function rbox(w, h, d, r) {
    const K = kit();
    return K ? K.roundBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
  }
  let SH = null;
  function shapes() {
    if (SH) return SH;
    SH = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sph: new THREE.IcosahedronGeometry(1, 1),
      ball: new THREE.SphereGeometry(1, 12, 8),
      dot: new THREE.IcosahedronGeometry(1, 0),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
      taper: new THREE.CylinderGeometry(1, 0.62, 1, 10),
      cone: new THREE.ConeGeometry(1, 1, 10),
      torus: new THREE.TorusGeometry(1, 0.28, 6, 16),
      smile: new THREE.TorusGeometry(1, 0.26, 5, 8, Math.PI),
      dome: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    };
    return SH;
  }
  const toon = (key, p) => (G.toonMat ? G.toonMat(key, p) : new THREE.MeshLambertMaterial(p));
  const machMat = () => toon('zm-mach', { vertexColors: true });
  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fit(ctx, text, maxW, size, weight) {
    let s = Math.floor(size);
    ctx.font = `${weight || 800} ${s}px ${FONT}`;
    while (s > 10 && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = `${weight || 800} ${s}px ${FONT}`;
    }
    return s;
  }
  function inkText(ctx, text, x, y, fill, lw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = cssHex(INK);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }
  function whenFonts(fn) {
    const K = kit();
    if (K && K.onFonts) K.onFonts(fn);
  }
  function canvasTex(c, mip) {
    const t = new THREE.CanvasTexture(c);
    if (!mip) {
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
    }
    return t;
  }

  // Etiketli tabela sprite: krema kart, renkli kenar, mürekkep yazı, fiyat hapı
  function signSprite(text, sub, color, w, h) {
    const W = 384, H = 144;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const col = color || '#ffd23f';
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(59,42,74,0.32)';
      rrPath(ctx, 8, 14, W - 16, H - 18, 40);
      ctx.fill();
      ctx.fillStyle = cssHex(CREAM);
      rrPath(ctx, 6, 4, W - 12, H - 20, 40);
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.strokeStyle = col;
      rrPath(ctx, 10, 8, W - 20, H - 28, 36);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sub) {
        const s1 = fit(ctx, text, W - 60, 44);
        ctx.fillStyle = cssHex(INK);
        ctx.fillText(text, W / 2, 44 + s1 * 0.05);
        const s2 = fit(ctx, sub, W - 120, 30);
        const pw = Math.min(W - 70, ctx.measureText(sub).width + 44);
        ctx.fillStyle = col;
        rrPath(ctx, (W - pw) / 2, 74, pw, 38, 19);
        ctx.fill();
        inkText(ctx, sub, W / 2, 93 + s2 * 0.05, '#ffffff', 6);
      } else {
        const s1 = fit(ctx, text, W - 60, 56);
        ctx.fillStyle = cssHex(INK);
        ctx.fillText(text, W / 2, (H - 16) / 2 + s1 * 0.06);
      }
    };
    draw();
    const tex = canvasTex(c);
    whenFonts(() => {
      draw();
      tex.needsUpdate = true;
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(w || 1.6, h || 0.6, 1);
    return sp;
  }
  G.signSprite = signSprite;

  // ---- Simge çizimleri (yetenek makineleri ve güçlendirmeler) ----
  function heart(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.45, y - r * 0.05, x - r * 0.75, y - r * 1.25, x, y - r * 0.42);
    ctx.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.45, y - r * 0.05, x, y + r * 0.9);
    ctx.closePath();
  }
  function bulletShape(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2 + w / 2);
    ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
  }
  function teaGlass(ctx, x, y, s) {
    // ince belli çay bardağı + tabak + buhar
    ctx.beginPath();
    ctx.moveTo(x - 0.34 * s, y - 0.5 * s);
    ctx.quadraticCurveTo(x - 0.36 * s, y - 0.05 * s, x - 0.17 * s, y + 0.05 * s);
    ctx.quadraticCurveTo(x - 0.34 * s, y + 0.25 * s, x - 0.26 * s, y + 0.5 * s);
    ctx.lineTo(x + 0.26 * s, y + 0.5 * s);
    ctx.quadraticCurveTo(x + 0.34 * s, y + 0.25 * s, x + 0.17 * s, y + 0.05 * s);
    ctx.quadraticCurveTo(x + 0.36 * s, y - 0.05 * s, x + 0.34 * s, y - 0.5 * s);
    ctx.closePath();
  }
  function stroked(ctx, fill, lw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = cssHex(INK);
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const ICONS = {
    demirderi(ctx, x, y, s) {
      // kalkan + kalp
      ctx.beginPath();
      ctx.moveTo(x, y - 0.62 * s);
      ctx.quadraticCurveTo(x + 0.35 * s, y - 0.45 * s, x + 0.55 * s, y - 0.48 * s);
      ctx.quadraticCurveTo(x + 0.58 * s, y + 0.3 * s, x, y + 0.66 * s);
      ctx.quadraticCurveTo(x - 0.58 * s, y + 0.3 * s, x - 0.55 * s, y - 0.48 * s);
      ctx.quadraticCurveTo(x - 0.35 * s, y - 0.45 * s, x, y - 0.62 * s);
      ctx.closePath();
      stroked(ctx, '#ffffff', s * 0.12);
      heart(ctx, x, y - 0.02 * s, 0.3 * s);
      stroked(ctx, '#ff6b6b', s * 0.07);
    },
    hizliel(ctx, x, y, s) {
      // şimşek + hız çizgileri
      ctx.beginPath();
      ctx.moveTo(x + 0.12 * s, y - 0.66 * s);
      ctx.lineTo(x - 0.36 * s, y + 0.08 * s);
      ctx.lineTo(x - 0.02 * s, y + 0.08 * s);
      ctx.lineTo(x - 0.14 * s, y + 0.66 * s);
      ctx.lineTo(x + 0.38 * s, y - 0.12 * s);
      ctx.lineTo(x + 0.04 * s, y - 0.12 * s);
      ctx.closePath();
      stroked(ctx, '#ffffff', s * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = s * 0.08;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 0.75 * s, y - 0.3 * s + i * 0.25 * s);
        ctx.lineTo(x - 0.5 * s, y - 0.3 * s + i * 0.25 * s);
        ctx.stroke();
      }
    },
    ciftatis(ctx, x, y, s) {
      for (const dx of [-0.24, 0.24]) {
        bulletShape(ctx, x + dx * s, y - 0.02 * s, 0.34 * s, 1.0 * s);
        stroked(ctx, '#ffffff', s * 0.1);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + dx * s - 0.17 * s, y + 0.22 * s, 0.34 * s, 0.1 * s);
      }
    },
    cevikbacak(ctx, x, y, s) {
      // kanatlı spor ayakkabı
      ctx.beginPath();
      ctx.moveTo(x - 0.55 * s, y + 0.32 * s);
      ctx.lineTo(x - 0.5 * s, y - 0.3 * s);
      ctx.quadraticCurveTo(x - 0.2 * s, y - 0.38 * s, x - 0.1 * s, y - 0.05 * s);
      ctx.quadraticCurveTo(x + 0.4 * s, y - 0.02 * s, x + 0.6 * s, y + 0.18 * s);
      ctx.quadraticCurveTo(x + 0.62 * s, y + 0.34 * s, x + 0.45 * s, y + 0.34 * s);
      ctx.closePath();
      stroked(ctx, '#ffffff', s * 0.11);
      ctx.fillStyle = '#ff6fa8';
      ctx.fillRect(x - 0.55 * s, y + 0.22 * s, 1.1 * s, 0.1 * s);
      ctx.beginPath();
      ctx.ellipse(x - 0.42 * s, y - 0.42 * s, 0.32 * s, 0.14 * s, -0.5, 0, Math.PI * 2);
      stroked(ctx, '#bfe9ff', s * 0.08);
      ctx.beginPath();
      ctx.ellipse(x - 0.18 * s, y - 0.5 * s, 0.26 * s, 0.11 * s, -0.9, 0, Math.PI * 2);
      stroked(ctx, '#bfe9ff', s * 0.08);
    },
    ikincisans(ctx, x, y, s) {
      // haleli, kanatlı kalp
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sd * 0.48 * s, y + 0.02 * s, 0.3 * s, 0.16 * s, sd * -0.5, 0, Math.PI * 2);
        stroked(ctx, '#ffffff', s * 0.08);
      }
      heart(ctx, x, y + 0.04 * s, 0.4 * s);
      stroked(ctx, '#ff6fa8', s * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y - 0.55 * s, 0.3 * s, 0.09 * s, 0, 0, Math.PI * 2);
      ctx.lineWidth = s * 0.09;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
    },
    demlicay(ctx, x, y, s) {
      teaGlass(ctx, x, y + 0.05 * s, s);
      stroked(ctx, '#e0552e', s * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y + 0.6 * s, 0.55 * s, 0.1 * s, 0, 0, Math.PI * 2);
      stroked(ctx, '#ffffff', s * 0.07);
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.07;
      for (const dx of [-0.14, 0.14]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y - 0.55 * s);
        ctx.quadraticCurveTo(x + (dx + 0.12) * s, y - 0.7 * s, x + dx * s, y - 0.85 * s);
        ctx.stroke();
      }
    },
  };
  const iconCache = {};
  function perkIcon(id, color) {
    if (iconCache[id]) return iconCache[id];
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const col = cssHex(color);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = S * 0.035;
    ctx.strokeStyle = cssHex(INK);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, S * 0.1, 0, S * 0.9);
    g.addColorStop(0, cssHex(tint(color, 0.35)));
    g.addColorStop(1, col);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    // parlama
    ctx.beginPath();
    ctx.ellipse(S * 0.36, S * 0.28, S * 0.12, S * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    (ICONS[id] || ICONS.ikincisans)(ctx, S / 2, S / 2 + S * 0.02, S * 0.3);
    return (iconCache[id] = canvasTex(c, true));
  }

  // Güçlendirme simgesi: ışıltılı rozet
  const powCache = {};
  function powerTex(type) {
    if (powCache[type]) return powCache[type];
    const def = G.POWERUPS[type];
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const col = cssHex(def.color);
    const draw = () => {
      ctx.clearRect(0, 0, S, S);
      const halo = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.5);
      halo.addColorStop(0, col);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = cssHex(INK);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      const x = S / 2, y = S / 2, s = S * 0.22;
      if (type === 'cephane') {
        for (const dx of [-0.5, 0, 0.5]) {
          bulletShape(ctx, x + dx * s, y + (dx ? 0.08 : -0.04) * s, 0.36 * s, 1.15 * s);
          stroked(ctx, '#ffffff', 4);
        }
      } else if (type === 'tekvurus') {
        // sevimli kurukafa: kocaman gözler
        ctx.beginPath();
        ctx.arc(x, y - 0.12 * s, 0.7 * s, 0, Math.PI * 2);
        ctx.rect(x - 0.38 * s, y + 0.25 * s, 0.76 * s, 0.4 * s);
        stroked(ctx, '#ffffff', 4);
        ctx.fillStyle = cssHex(INK);
        for (const dx of [-0.3, 0.3]) {
          ctx.beginPath();
          ctx.arc(x + dx * s, y - 0.12 * s, 0.2 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        for (const dx of [-0.24, 0.36]) {
          ctx.beginPath();
          ctx.arc(x + dx * s, y - 0.2 * s, 0.06 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = cssHex(INK);
        for (const dx of [-0.2, 0, 0.2]) ctx.fillRect(x + dx * s - 1.5, y + 0.32 * s, 3, 0.28 * s);
      } else if (type === 'ciftpuan') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(s * 1.4)}px ${FONT}`;
        inkText(ctx, 'x2', x, y + s * 0.08, '#ffffff', 7);
      } else if (type === 'nukleer') {
        // çizgi film bombası
        ctx.beginPath();
        ctx.arc(x - 0.08 * s, y + 0.12 * s, 0.62 * s, 0, Math.PI * 2);
        stroked(ctx, cssHex(0x5a4f9a), 4);
        ctx.fillStyle = cssHex(INK);
        ctx.fillRect(x + 0.18 * s, y - 0.62 * s, 0.32 * s, 0.26 * s);
        ctx.beginPath();
        ctx.ellipse(x - 0.3 * s, y - 0.1 * s, 0.16 * s, 0.09 * s, -0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5, r = i % 2 ? 0.12 * s : 0.3 * s;
          ctx.lineTo(x + 0.5 * s + Math.cos(a) * r, y - 0.75 * s + Math.sin(a) * r);
        }
        ctx.closePath();
        stroked(ctx, '#ffd23f', 3);
      } else if (type === 'caymolasi') {
        // tabak + beyaz kenarlı ince belli bardak, içinde demli çay
        ctx.beginPath();
        ctx.ellipse(x, y + 0.92 * s, 0.78 * s, 0.17 * s, 0, 0, Math.PI * 2);
        stroked(ctx, '#ffffff', 4);
        teaGlass(ctx, x, y + 0.1 * s, s * 1.65);
        stroked(ctx, '#ffffff', 5);
        teaGlass(ctx, x, y + 0.2 * s, s * 1.3);
        ctx.fillStyle = '#c8441c';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - 0.22 * s, y - 0.2 * s, 0.07 * s, 0.2 * s, 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fill();
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(s * 1.4)}px ${FONT}`;
        inkText(ctx, '?', x, y, '#ffffff', 7);
      }
    };
    draw();
    const t = canvasTex(c, true);
    if (type === 'ciftpuan') {
      whenFonts(() => {
        draw();
        t.needsUpdate = true;
      });
    }
    return (powCache[type] = t);
  }

  // ---- Oyuncak makineler ----
  // Yetenek makinesi: şeker renkli otomat, tepede büyük simge
  function buildPerkMachine(perkId, color) {
    const S = shapes();
    const B = new G.Bucket();
    const light = tint(color, 0.3);
    for (const [x, z] of [[-0.42, -0.3], [0.42, -0.3], [-0.42, 0.3], [0.42, 0.3]]) B.addGeo(S.sph, mtx(x, 0.07, z, 0, 0.11, 0.08, 0.11), INK);
    B.addGeo(rbox(1.1, 1.8, 0.86, 0.2), mtx(0, 1.02, 0, 0), color);
    for (const sx of [-1, 1]) for (const y of [0.6, 1.45]) B.addGeo(S.box, mtx(sx * 0.553, y, 0, 0, 0.02, 0.1, 0.6), 0xffffff);
    // vitrin: koyu cam, krema çerçeve, içinde üç şişe
    B.addGeo(rbox(0.86, 0.78, 0.05, 0.14), mtx(0, 1.3, 0.425, 0), CREAM);
    B.addGeo(rbox(0.74, 0.66, 0.05, 0.11), mtx(0, 1.3, 0.445, 0), tint(color, -0.6));
    for (let i = 0; i < 3; i++) {
      const x = -0.22 + i * 0.22;
      B.addGeo(S.cyl, mtx(x, 1.18, 0.47, 0, 0.065, 0.24, 0.065), light);
      B.addGeo(S.box, mtx(x, 1.18, 0.53, 0, 0.1, 0.07, 0.01), 0xffffff);
      B.addGeo(S.taper, mtx(x, 1.36, 0.47, 0, 0.065, 0.14, 0.065, Math.PI), light);
      B.addGeo(S.dot, mtx(x, 1.45, 0.47, 0, 0.04, 0.03, 0.04), i === 1 ? 0xffd23f : 0xff6fa8);
    }
    // para yuvası ve düğme
    B.addGeo(S.box, mtx(0.38, 0.8, 0.44, 0, 0.2, 0.32, 0.05), CREAM);
    B.addGeo(S.box, mtx(0.38, 0.88, 0.468, 0, 0.1, 0.022, 0.02), INK);
    B.addGeo(S.sph, mtx(0.38, 0.74, 0.47, 0, 0.045, 0.045, 0.03), 0xff6fa8);
    // çıkış ağzı
    B.addGeo(rbox(0.56, 0.22, 0.06, 0.09), mtx(-0.08, 0.44, 0.43, 0), INK);
    B.addGeo(S.box, mtx(-0.08, 0.32, 0.45, 0, 0.62, 0.06, 0.12), light);
    // tepe kubbesi, simge diski ve lolipop topları
    B.addGeo(S.dome, mtx(0, 1.9, 0, 0, 0.52, 0.26, 0.42), light);
    B.addGeo(S.cyl, mtx(0, 2.1, 0, 0, 0.06, 0.24, 0.06), INK);
    B.addGeo(S.cyl, mtx(0, 2.44, 0, 0, 0.36, 0.1, 0.36, Math.PI / 2), CREAM);
    B.addGeo(S.torus, mtx(0, 2.44, 0, 0, 0.35, 0.35, 0.45), color);
    for (const sx of [-1, 1]) B.addGeo(S.sph, mtx(sx * 0.44, 1.97, 0.2, 0, 0.08), 0xffd23f);
    const mesh = B.mesh(machMat(), true);
    const icon = new THREE.Mesh(new THREE.CircleGeometry(0.31, 28), new THREE.MeshBasicMaterial({ map: perkIcon(perkId, color), transparent: true, alphaTest: 0.25 }));
    icon.position.set(0, 2.44, 0.056);
    const glow = new THREE.Mesh(rbox(0.9, 0.12, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: 0x3a3450 }));
    glow.position.set(0, 1.8, 0.43);
    return { mesh, icon, glow };
  }

  // Çay Ocağı: tezgâh, gülümseyen bakır semaver, demlik, ince belli bardaklar, çizgili tente
  function buildTeaStand() {
    const S = shapes();
    const B = new G.Bucket();
    const wood = 0xe8a970, copper = 0xf28a4e, brass = 0xffd23f, red = 0xff6b6b;
    B.addGeo(rbox(1.24, 0.84, 0.78, 0.12), mtx(0, 0.44, 0, 0), wood);
    B.addGeo(rbox(1.36, 0.08, 0.9, 0.04), mtx(0, 0.9, 0, 0), CREAM);
    B.addGeo(S.box, mtx(0, 0.58, 0.392, 0, 1.08, 0.18, 0.02), red);
    for (let i = 0; i < 6; i++) B.addGeo(S.box, mtx(-0.45 + i * 0.18, 0.58, 0.405, 0, 0.085, 0.085, 0.012, 0, Math.PI / 4), 0xfff1a8);
    // semaver
    const sx = -0.2;
    B.addGeo(S.cyl, mtx(sx, 0.99, 0, 0, 0.19, 0.1, 0.19), brass);
    B.addGeo(S.cyl, mtx(sx, 1.07, 0, 0, 0.1, 0.08, 0.1), copper);
    B.addGeo(S.ball, mtx(sx, 1.34, 0, 0, 0.27, 0.3, 0.27), copper);
    B.addGeo(S.torus, mtx(sx, 1.57, 0, 0, 0.18, 0.18, 0.18, Math.PI / 2), brass);
    B.addGeo(S.cyl, mtx(sx, 1.63, 0, 0, 0.09, 0.12, 0.09), copper);
    for (const s of [-1, 1]) B.addGeo(S.torus, mtx(sx + s * 0.29, 1.42, 0, Math.PI / 2, 0.08, 0.08, 0.08), brass);
    B.addGeo(S.cyl, mtx(sx, 1.17, 0.3, 0, 0.028, 0.12, 0.028, Math.PI / 2), brass);
    B.addGeo(S.sph, mtx(sx, 1.2, 0.36, 0, 0.038), red);
    // gülen yüz
    for (const s of [-1, 1]) {
      B.addGeo(S.sph, mtx(sx + s * 0.085, 1.4, 0.255, 0, 0.034, 0.046, 0.02), INK);
      B.addGeo(S.sph, mtx(sx + s * 0.085 - 0.012, 1.415, 0.272, 0, 0.012, 0.012, 0.006), 0xffffff);
      B.addGeo(S.sph, mtx(sx + s * 0.16, 1.32, 0.232, s * 0.55, 0.045, 0.026, 0.01), 0xff9ad5);
    }
    B.addGeo(S.smile, mtx(sx, 1.33, 0.262, 0, 0.045, 0.045, 0.03, 0, Math.PI), INK);
    // demlik (puantiyeli)
    B.addGeo(S.ball, mtx(sx, 1.82, 0, 0, 0.16, 0.13, 0.16), CREAM);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      B.addGeo(S.sph, mtx(sx + Math.cos(a) * 0.15, 1.83, Math.sin(a) * 0.15, -a + Math.PI / 2, 0.026, 0.026, 0.01), red);
    }
    B.addGeo(S.dome, mtx(sx, 1.93, 0, 0, 0.09, 0.05, 0.09), red);
    B.addGeo(S.sph, mtx(sx, 1.99, 0, 0, 0.03), red);
    B.addGeo(S.cone, mtx(sx + 0.19, 1.86, 0, 0, 0.035, 0.16, 0.035, 0, -0.9), CREAM);
    B.addGeo(S.torus, mtx(sx - 0.17, 1.82, 0, 0, 0.06), CREAM);
    // ince belli bardaklar ve tabaklar
    for (let i = 0; i < 3; i++) {
      const gx = 0.2 + i * 0.16, gz = 0.18 - (i % 2) * 0.14;
      B.addGeo(S.cyl, mtx(gx, 0.95, gz, 0, 0.075, 0.014, 0.075), CREAM);
      B.addGeo(S.taper, mtx(gx, 0.995, gz, 0, 0.04, 0.07, 0.04, Math.PI), 0xd2462a);
      B.addGeo(S.taper, mtx(gx, 1.065, gz, 0, 0.046, 0.07, 0.046), 0xe8653a);
      B.addGeo(S.cyl, mtx(gx, 1.103, gz, 0, 0.047, 0.012, 0.047), 0xfff4ea);
    }
    // şeker kâsesi
    B.addGeo(S.dome, mtx(0.46, 1.0, -0.2, 0, 0.1, 0.07, 0.1, Math.PI), CREAM);
    for (let i = 0; i < 3; i++) B.addGeo(S.box, mtx(0.43 + i * 0.03, 1.01 + (i % 2) * 0.02, -0.2, i, 0.035), 0xffffff);
    // tente: dört şeker çizgili direk, çizgili örtü, fisto
    for (const [px, pz] of [[-0.64, -0.38], [0.64, -0.38], [-0.64, 0.42], [0.64, 0.42]]) {
      for (let j = 0; j < 5; j++) B.addGeo(S.cyl, mtx(px, 0.23 + j * 0.45, pz, 0, 0.035, 0.45, 0.035), j % 2 ? 0xffffff : red);
    }
    const N = 7, W = 1.42;
    const tilt = Math.atan2(0.26, 1.05);
    for (let i = 0; i < N; i++) {
      const u = -W / 2 + ((i + 0.5) * W) / N;
      const c = i % 2 ? 0xffffff : red;
      B.addGeo(S.box, mtx(u, 2.33, 0.06, 0, W / N + 0.004, 0.04, 1.1, tilt), c);
      const K = kit();
      if (K) B.addGeo(K.scallop(W / N / 2, 0.04), mtx(u, 2.19, 0.6, 0), c);
    }
    const mesh = B.mesh(machMat(), true);
    const glow = new THREE.Mesh(rbox(0.16, 0.06, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0xff7020 }));
    glow.position.set(sx, 0.995, 0.19);
    // buhar pufları (yalnızca görsel)
    const steamMat = toon('zm-steam', { color: 0xffffff, transparent: true, opacity: 0.85 });
    const steam = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(S.sph, steamMat);
      p.scale.setScalar(0.05);
      p.userData.ph = i / 3;
      steam.push(p);
    }
    return { mesh, glow, steam, spout: new THREE.Vector3(sx + 0.27, 1.92, 0) };
  }

  // Gizem kutusu: puantiyeli hediye paketi, kurdele, fiyonk, kocaman "?"
  let giftTexC = null;
  function giftTex() {
    if (giftTexC) return giftTexC;
    const W = 512, H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const draw = () => {
      // üst yarı: ambalaj (512x256), alt yarı: kutunun içi
      ctx.fillStyle = '#e8559c';
      ctx.fillRect(0, 0, W, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let y = 0; y < 256; y += 44)
        for (let x = (y / 44) % 2 ? 22 : 0; x < W + 22; x += 44) {
          ctx.beginPath();
          ctx.arc(x, y + 14, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.beginPath();
      ctx.arc(W / 2, 128, 92, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf3';
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#9b5de5';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 150px ${FONT}`;
      inkText(ctx, '?', W / 2, 140, '#9b5de5', 14);
      const g = ctx.createRadialGradient(W / 2, 384, 10, W / 2, 384, 240);
      g.addColorStop(0, '#b47bff');
      g.addColorStop(1, '#3b2a4a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 256, W, 256);
      ctx.fillStyle = '#fff1a8';
      for (let i = 0; i < 18; i++) {
        const x = (i * 97) % W, y = 270 + ((i * 53) % 230);
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    giftTexC = canvasTex(c, true);
    whenFonts(() => {
      draw();
      giftTexC.needsUpdate = true;
    });
    return giftTexC;
  }
  function buildGiftBox() {
    const S = shapes();
    const sun = 0xf2b92a, lidCol = 0x3a9be0;
    // gövde: dokulu kutu; üst yüz kutunun içini gösterir
    const geo = new THREE.BoxGeometry(1.7, 0.85, 0.9);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const top = i >= 8 && i < 12;
      uv.setY(i, top ? uv.getY(i) * 0.5 : 0.5 + uv.getY(i) * 0.5);
    }
    const base = new THREE.Mesh(geo, toon('zm-gift', { map: giftTex() }));
    base.position.y = 0.425;
    base.castShadow = true;
    base.receiveShadow = true;
    const B = new G.Bucket();
    B.addGeo(S.box, mtx(0, 0.852, 0, 0, 1.72, 0.012, 0.2), sun);
    for (const s of [-1, 1]) B.addGeo(S.box, mtx(s * 0.852, 0.425, 0, 0, 0.012, 0.86, 0.2), sun);
    for (const [x, z] of [[-0.75, -0.36], [0.75, -0.36], [-0.75, 0.36], [0.75, 0.36]]) B.addGeo(S.sph, mtx(x, 0.02, z, 0, 0.09, 0.05, 0.09), 0x9b5de5);
    const trim = B.mesh(machMat(), true);
    // kapak (menteşe arkada): parçalar z += 0.45 ile pişirilir
    const L = new G.Bucket();
    L.addGeo(rbox(1.84, 0.2, 1.0, 0.08), mtx(0, 0.03, 0.45, 0), lidCol);
    L.addGeo(S.box, mtx(0, 0.03, 0.45, 0, 1.86, 0.205, 0.2), sun);
    L.addGeo(S.box, mtx(0, 0.03, 0.45, 0, 0.2, 0.205, 1.02), sun);
    for (const s of [-1, 1]) {
      L.addGeo(S.sph, mtx(s * 0.19, 0.24, 0.45, 0, 0.2, 0.12, 0.09, 0, s * -0.45), sun);
      L.addGeo(S.sph, mtx(s * 0.19, 0.24, 0.45, 0, 0.12, 0.06, 0.1, 0, s * -0.45), 0xffb347);
      L.addGeo(S.box, mtx(s * 0.09, 0.15, 0.66, s * 0.4, 0.07, 0.02, 0.24, -0.4), sun);
    }
    L.addGeo(S.sph, mtx(0, 0.2, 0.45, 0, 0.085), 0xffb347);
    const lidMesh = L.mesh(machMat(), true);
    return { base, trim, lidMesh };
  }

  // Dönüştürücü: lila oyuncak makine, şeker çizgili direkler, dönen pembe halka, yıldızlı tepe
  function buildUpgrader() {
    const S = shapes();
    const K = kit();
    const B = new G.Bucket();
    const body = 0x9277e0, pink = 0xff5a9d, sun = 0xf2b92a, coral = 0xf47884;
    for (const [x, z] of [[-0.66, -0.42], [0.66, -0.42], [-0.66, 0.42], [0.66, 0.42]]) B.addGeo(S.sph, mtx(x, 0.07, z, 0, 0.13, 0.08, 0.13), INK);
    B.addGeo(rbox(1.6, 1.2, 1.1, 0.22), mtx(0, 0.68, 0, 0), body);
    B.addGeo(rbox(1.2, 0.55, 0.05, 0.12), mtx(0, 0.66, 0.56, 0), CREAM);
    B.addGeo(rbox(0.5, 0.3, 0.05, 0.08), mtx(-0.25, 0.68, 0.58, 0), 0x9ad7ff);
    [coral, sun, 0x3ddc97].forEach((c, i) => B.addGeo(S.sph, mtx(0.18 + i * 0.15, 0.68, 0.59, 0, 0.055, 0.055, 0.035), c));
    for (const s of [-1, 1]) {
      // yan dişliler
      B.addGeo(S.cyl, mtx(s * 0.81, 0.72, 0, 0, 0.26, 0.06, 0.26, 0, Math.PI / 2), sun);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        B.addGeo(S.box, mtx(s * 0.81, 0.72 + Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0, 0.06, 0.1, 0.1, -a), sun);
      }
      B.addGeo(S.sph, mtx(s * 0.85, 0.72, 0, 0, 0.07), coral);
      // şeker çizgili direkler
      for (let j = 0; j < 6; j++) B.addGeo(S.cyl, mtx(s * 0.62, 1.37 + j * 0.18, 0, 0, 0.11, 0.18, 0.11), j % 2 ? 0xffffff : pink);
      B.addGeo(S.sph, mtx(s * 0.62, 2.42, 0, 0, 0.13), sun);
    }
    B.addGeo(rbox(1.55, 0.3, 1.0, 0.14), mtx(0, 2.5, 0, 0), coral);
    B.addGeo(rbox(1.62, 0.08, 1.06, 0.04), mtx(0, 2.37, 0, 0), CREAM);
    if (K) B.addGeo(K.starGeo(0.34, 0.1), mtx(0, 2.98, 0, 0), sun);
    B.addGeo(S.cyl, mtx(0, 2.72, 0, 0, 0.04, 0.16, 0.04), INK);
    const mesh = B.mesh(machMat(), true);
    // dönen halka: üzerinde küçük yıldız boncuklar (tek ağ)
    const R = new G.Bucket();
    R.addGeo(S.torus, mtx(0, 0, 0, 0, 0.44, 0.44, 0.44), pink);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      R.addGeo(S.sph, mtx(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0, 0, 0.075), i % 2 ? sun : 0xffffff);
    }
    const ring = R.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false);
    ring.matrixAutoUpdate = true;
    ring.position.set(0, 1.75, 0);
    return { mesh, ring };
  }

  // Güç şalteri: tereyağı sarısı pano, şimşek, pembe topuzlu kol
  function buildPowerSwitch() {
    const S = shapes();
    const K = kit();
    const B = new G.Bucket();
    B.addGeo(rbox(0.9, 1.3, 0.3, 0.14), mtx(0, 1.3, 0, 0), 0xffe27a);
    B.addGeo(rbox(0.7, 0.32, 0.04, 0.08), mtx(0, 1.72, 0.16, 0), CREAM);
    if (K) {
      const s = new THREE.Shape();
      s.moveTo(0.04, 0.14);
      s.lineTo(-0.08, -0.01);
      s.lineTo(-0.005, -0.01);
      s.lineTo(-0.04, -0.14);
      s.lineTo(0.08, 0.02);
      s.lineTo(0.005, 0.02);
      s.closePath();
      const bolt = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
      B.addGeo(bolt, mtx(0, 1.72, 0.17, 0), 0xff6b6b);
      bolt.dispose();
    }
    B.addGeo(rbox(0.3, 0.14, 0.08, 0.05), mtx(0, 1.15, 0.17, 0), INK);
    for (const s of [-1, 1]) B.addGeo(S.sph, mtx(s * 0.34, 0.75, 0.16, 0, 0.05, 0.05, 0.03), s < 0 ? 0x3ddc97 : 0xff6b6b);
    const mesh = B.mesh(machMat(), true);
    const lever = new THREE.Group();
    const L = new G.Bucket();
    L.addGeo(S.cyl, mtx(0, 0.2, 0, 0, 0.035, 0.4, 0.035), CREAM);
    L.addGeo(S.ball, mtx(0, 0.44, 0, 0, 0.085), 0xff6fa8);
    L.addGeo(S.ball, mtx(-0.03, 0.47, 0.06, 0, 0.025), 0xffffff);
    lever.add(L.mesh(machMat(), true));
    lever.position.set(0, 1.15, 0.2);
    lever.rotation.x = 0.6;
    return { mesh, lever };
  }

  // Duvar silahı panosu (çerçeveli, kancalı) — tüm panolar tek ağda birleşir
  function addWallboard(B, x, z, yaw, col) {
    const S = shapes();
    B.addGeo(rbox(2.0, 1.0, 0.06, 0.22), mtx(x, 1.18, z, yaw), col);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    let p = at(0, 0.035);
    B.addGeo(rbox(1.82, 0.82, 0.04, 0.16), mtx(p[0], 1.18, p[1], yaw), tint(col, 0.5));
    for (const lx of [-0.45, 0.45]) {
      p = at(lx, 0.08);
      B.addGeo(S.sph, mtx(p[0], 0.98, p[1], yaw, 0.04), INK);
    }
    for (const lx of [-0.78, 0.78]) {
      p = at(lx, 0.06);
      B.addGeo(S.sph, mtx(p[0], 1.5, p[1], yaw, 0.05, 0.05, 0.02), 0xffd23f);
    }
  }
  // Silah modelini tek ağlara indir (sergi silahları için çizim çağrısı az)
  // maxLen: en uzun yatay boyut sınırı (pano/kutu taşmasın); model ortalanır
  const _gb = new THREE.Box3(), _gc = new THREE.Vector3(), _gs = new THREE.Vector3();
  function displayGun(stats, scale, maxLen) {
    const g = G.buildGun(stats);
    if (G.mergeGroup) G.mergeGroup(g, []);
    g.updateMatrixWorld(true);
    _gb.setFromObject(g);
    if (_gb.isEmpty()) {
      g.scale.setScalar(scale);
      return g;
    }
    _gb.getSize(_gs);
    _gb.getCenter(_gc);
    const len = Math.max(_gs.x, _gs.z) || 1;
    const s = maxLen ? Math.min(scale, maxLen / len) : scale;
    g.scale.setScalar(s);
    g.position.set(-_gc.x * s, -_gc.y * s, -_gc.z * s);
    const wrap = new THREE.Group();
    wrap.add(g);
    return wrap;
  }

  // ------------------------------------------------------------------
  class ZombieDirector {
    constructor(match) {
      this.match = match;
      this.world = G.world;
      this.player = match.player;
      this.scene = match.scene;
      this.zombies = [];
      this.round = 0;
      this.toSpawn = 0;
      this.spawnCD = 0;
      this.nextRoundAt = G.time + 3;
      this.betweenRounds = true;
      this.dropsThisRound = 0;
      this.power = false;
      this.doubleUntil = 0;
      this.instakillUntil = 0;
      this.teaBreakUntil = 0;
      this.powerups = [];
      this.kills = 0;
      this.headshots = 0;
      this.field = null;
      this.fieldCell = -1;
      this.openZones = new Set();
      this.buildEntities();
    }

    get instakill() {
      return G.time < this.instakillUntil;
    }

    addMachineBox(cx, cz, w, h, d) {
      const x = cx * CELL + 1, z = cz * CELL + 1;
      this.world.addBox(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { kind: 'machine', metal: true });
      this.world.blockCell(cx, cz);
    }

    facePos(p, dist) {
      const f = FACE_N[p.face] || [0, 1];
      return new THREE.Vector3(p.x * CELL + 1 + f[0] * dist, 0, p.z * CELL + 1 + f[1] * dist);
    }

    buildEntities() {
      const pts = this.world.points;
      const scene = this.world.group;
      // başlangıç bölgesi
      const st = pts.start[0];
      this.openZones.add(this.world.zoneAt(st.x * CELL + 1, st.z * CELL + 1));
      // yetenek makineleri
      this.perks = [];
      this.cuteAnim = [];
      for (const p of pts.perk || []) {
        const def = G.ZM_PERKS[p.perk];
        const grp = new THREE.Group();
        const yaw = Math.atan2(FACE_N[p.face][0], FACE_N[p.face][1]);
        let glow, icon = null;
        if (p.perk === 'demlicay') {
          // Çay Ocağı: gülümseyen bakır semaver, ince belli bardaklar, çizgili tente
          const tea = buildTeaStand();
          grp.add(tea.mesh);
          glow = tea.glow;
          grp.add(glow);
          for (const puff of tea.steam) grp.add(puff);
          this.cuteAnim.push((t) => {
            for (const puff of tea.steam) {
              const k = (t * 0.45 + puff.userData.ph) % 1;
              puff.position.set(tea.spout.x + k * 0.12, tea.spout.y + k * 0.55, tea.spout.z + Math.sin(k * 6 + puff.userData.ph * 6) * 0.04);
              puff.scale.setScalar(0.04 + Math.sin(k * Math.PI) * 0.07);
            }
          });
        } else {
          // oyuncak otomat: şeker renkli gövde, vitrinde şişeler, tepede büyük simge
          const pm = buildPerkMachine(p.perk, def.color);
          grp.add(pm.mesh, pm.icon, pm.glow);
          glow = pm.glow;
          icon = pm.icon;
          const ph = this.perks.length * 1.7;
          this.cuteAnim.push((t) => {
            icon.position.y = 2.44 + Math.sin(t * 2.2 + ph) * 0.025;
            icon.rotation.z = Math.sin(t * 1.6 + ph) * 0.08;
          });
        }
        const sign = signSprite(def.name, def.price + ' PUAN', '#' + def.color.toString(16).padStart(6, '0'));
        sign.position.y = p.perk === 'demlicay' ? 2.85 : 3.15;
        grp.add(sign);
        grp.position.set(p.x * CELL + 1, 0, p.z * CELL + 1);
        grp.rotation.y = yaw;
        scene.add(grp);
        this.addMachineBox(p.x, p.z, 1.1, 2.2, 1.1);
        this.perks.push({ perk: p.perk, def, pos: this.facePos(p, 1.3), center: grp.position.clone(), glow, icon, color: def.color });
      }
      // duvar silahları: krema panolu, kancalı sergi
      this.wallbuys = [];
      const boards = new G.Bucket();
      const boardCols = [0xff6fa8, 0x4cc3ff, 0x3ddc97, 0xffb347, 0x9b5de5, 0xff6b6b];
      for (const p of pts.wallbuy || []) {
        const ws = G.WEAPONS[p.weapon];
        const f = FACE_N[p.face];
        const bx = p.x * CELL + 1, bz = p.z * CELL + 1;
        addWallboard(boards, bx + f[0] * 0.95, bz + f[1] * 0.95, Math.atan2(-f[0], -f[1]), boardCols[this.wallbuys.length % boardCols.length]);
        const sign = signSprite(ws.name, ws.zm.price + ' PUAN', '#' + boardCols[this.wallbuys.length % boardCols.length].toString(16).padStart(6, '0'), 1.8, 0.68);
        sign.position.set(bx + f[0] * 0.8, 2.05, bz + f[1] * 0.8);
        scene.add(sign);
        const gun = displayGun(G.computeStats(p.weapon, {}), 1.6, 1.62);
        gun.position.set(bx + f[0] * 0.84, 1.17, bz + f[1] * 0.84);
        gun.rotation.y = Math.atan2(-f[0], -f[1]) + Math.PI / 2;
        scene.add(gun);
        this.wallbuys.push({ weapon: p.weapon, price: ws.zm.price, pos: new THREE.Vector3(p.x * CELL + 1, 0, p.z * CELL + 1) });
      }
      const bm = boards.mesh(machMat(), true);
      if (bm) scene.add(bm);
      // gizem kutusu
      this.boxLocs = (pts.box || []).map((p) => p);
      this.box = { loc: 0, uses: 0, state: 'idle', t: 0, weapon: null, group: null, models: {} };
      this.buildBoxAt(0);
      // dönüştürücü
      const up = (pts.upgrade || [])[0];
      if (up) {
        const grp = new THREE.Group();
        const um = buildUpgrader();
        grp.add(um.mesh, um.ring);
        const ring = um.ring;
        const sign = signSprite('Dönüştürücü', '5000 PUAN', '#b47bff');
        sign.position.y = 3.5;
        grp.add(sign);
        grp.position.set(up.x * CELL + 1, 0, up.z * CELL + 1);
        grp.rotation.y = Math.atan2(FACE_N[up.face][0], FACE_N[up.face][1]);
        scene.add(grp);
        this.addMachineBox(up.x, up.z, 1.6, 2.5, 1.2);
        this.upgrade = { pos: this.facePos(up, 1.4), center: grp.position.clone(), ring, state: 'idle', t: 0, inst: null, gunMesh: null, grp };
      }
      // güç şalteri
      const pw = (pts.power || [])[0];
      if (pw) {
        const grp = new THREE.Group();
        const ps = buildPowerSwitch();
        grp.add(ps.mesh, ps.lever);
        const lever = ps.lever;
        const sign = signSprite('GÜÇ', 'Şalteri indir', '#ffd23f', 1.2, 0.45);
        sign.position.y = 2.4;
        grp.add(sign);
        grp.position.set(pw.x * CELL + 1, 0, pw.z * CELL + 1);
        grp.rotation.y = Math.atan2(FACE_N[pw.face][0], FACE_N[pw.face][1]);
        scene.add(grp);
        this.addMachineBox(pw.x, pw.z, 0.9, 2, 0.6);
        this.powerSwitch = { pos: this.facePos(pw, 1.2), lever };
      }
      this.recomputeField(true);
    }

    buildBoxAt(i) {
      const p = this.boxLocs[i];
      if (!p) return;
      const b = this.box;
      if (b.group) {
        this.world.group.remove(b.group);
        if (b.boxRef) b.boxRef.disabled = true;
        if (b.cell) this.world.walk[b.cell[0] + b.cell[1] * this.world.w] = 1;
      }
      const grp = new THREE.Group();
      // hediye paketi: puantiyeli gövde, kurdele, fiyonklu kapak (menteşe arkada)
      const gift = buildGiftBox();
      grp.add(gift.base, gift.trim);
      const lid = new THREE.Group();
      lid.add(gift.lidMesh);
      lid.position.set(0, 0.9, -0.45);
      grp.add(lid);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9ad5, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 16.1; // kutunun üstünden başlasın
      beam.renderOrder = -1; // tabelanın arkasında kalsın (yazı soluklaşmasın)
      grp.add(beam);
      const sign = signSprite('Gizem Kutusu', '950 PUAN', '#ff6fa8');
      sign.position.y = 1.9;
      grp.add(sign);
      grp.position.set(p.x * CELL + 1, 0, p.z * CELL + 1);
      grp.rotation.y = Math.atan2(FACE_N[p.face][0], FACE_N[p.face][1]);
      this.world.group.add(grp);
      const x = p.x * CELL + 1, z = p.z * CELL + 1;
      b.boxRef = this.world.addBox(x - 0.85, 0, z - 0.85, x + 0.85, 0.95, z + 0.85, { kind: 'machine' });
      this.world.blockCell(p.x, p.z);
      b.cell = [p.x, p.z];
      b.group = grp;
      b.lid = lid;
      b.loc = i;
      b.pos = this.facePos(p, 1.4);
      b.center = new THREE.Vector3(x, 0, z);
      b.state = 'idle';
      this.field = null;
      this.fieldCell = -1;
    }

    // ------------------------------------------------------------------
    addPoints(n) {
      const p = this.player;
      const v = Math.round(n * (G.time < this.doubleUntil ? 2 : 1));
      p.points += v;
      G.hud && G.hud.pointsPop(v);
    }
    spend(n) {
      const p = this.player;
      if (p.points < n) {
        G.audio.play('deny');
        G.hud && G.hud.medal('Yetersiz puan');
        return false;
      }
      p.points -= n;
      G.hud && G.hud.pointsPop(-n);
      G.audio.play('buy');
      return true;
    }

    giveWeapon(id, upgraded) {
      const p = this.player;
      const ws = p.weapons;
      for (let i = 0; i < 2; i++) {
        if (ws[i] && ws[i].id === id && !!ws[i].upgraded === !!upgraded) {
          ws[i].reserve = ws[i].stats.reserve;
          ws[i].ammo = ws[i].stats.mag;
          p.equip(i);
          return;
        }
      }
      const inst = G.makeWeaponInst(id, {}, { upgraded });
      let slot = ws[0] == null ? 0 : ws[1] == null ? 1 : p.cur;
      ws[slot] = inst;
      p.equip(slot);
    }

    findInteraction(p) {
      if (!p.alive) return null;
      const near = (pos, r) => {
        const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
        if (d > (r || 2)) return false;
        return true;
      };
      // kapılar
      for (const id in this.world.doors) {
        const d = this.world.doors[id];
        if (d.open) continue;
        if (near(d.center, 2.6)) {
          return { text: `Kapıyı aç (${d.name})`, cost: d.cost, action: () => this.openDoor(id) };
        }
      }
      // duvar silahları
      for (const wb of this.wallbuys) {
        if (!near(wb.pos, 1.6)) continue;
        const has = p.weapons.find((w) => w && w.id === wb.weapon);
        const name = G.WEAPONS[wb.weapon].name;
        if (has) {
          const cost = has.upgraded ? 2500 : Math.round(wb.price / 2);
          return { text: `${name} cephanesi al`, cost, action: () => { if (this.spend(cost)) { has.reserve = has.stats.reserve; has.ammo = has.stats.mag; } } };
        }
        return { text: `${name} satın al`, cost: wb.price, action: () => { if (this.spend(wb.price)) this.giveWeapon(wb.weapon); } };
      }
      // gizem kutusu
      const b = this.box;
      if (b.group && near(b.pos, 1.8)) {
        if (b.state === 'idle') return { text: 'Gizem Kutusu', cost: 950, action: () => { if (this.spend(950)) this.rollBox(); } };
        if (b.state === 'offer') return { text: `${G.WEAPONS[b.weapon].name} al`, cost: 0, action: () => this.takeBox() };
      }
      // yetenekler
      for (const pk of this.perks) {
        if (!near(pk.pos, 1.6)) continue;
        if (p.zmPerks.has(pk.perk)) return { text: `${pk.def.name} (sende var)`, cost: 0, action: () => {} };
        if (!this.power && !pk.def.noPower) return { text: `${pk.def.name}: önce gücü aç`, cost: 0, action: () => G.audio.play('deny') };
        return { text: `${pk.def.name} iç`, cost: pk.def.price, desc: pk.def.desc, action: () => { if (this.spend(pk.def.price)) this.givePerk(pk.perk); } };
      }
      // güç
      if (this.powerSwitch && !this.power && near(this.powerSwitch.pos, 1.6)) {
        return { text: 'Gücü aç', cost: 0, action: () => this.turnOnPower() };
      }
      // dönüştürücü
      const u = this.upgrade;
      if (u && near(u.pos, 1.8)) {
        if (!this.power) return { text: 'Dönüştürücü: önce gücü aç', cost: 0, action: () => G.audio.play('deny') };
        if (u.state === 'idle') {
          const w = p.weapon;
          if (!w || w.upgraded) return { text: 'Dönüştürücü (bu silah olmaz)', cost: 0, action: () => G.audio.play('deny') };
          return { text: `${w.stats.name} dönüştür`, cost: 5000, action: () => { if (this.spend(5000)) this.startUpgrade(); } };
        }
        if (u.state === 'ready') return { text: `${u.inst.stats.name} al`, cost: 0, action: () => this.takeUpgrade() };
      }
      return null;
    }

    openDoor(id) {
      const d = this.world.doors[id];
      if (!this.spend(d.cost)) return;
      this.world.openDoor(id);
      for (const z of d.zones) this.openZones.add(z);
      G.audio.play('door', { pos: d.center, priority: true });
      G.hud && G.hud.medal(`${d.name} açıldı`);
      this.field = null;
      this.fieldCell = -1;
    }

    givePerk(id) {
      const p = this.player;
      p.zmPerks.add(id);
      G.audio.play('perk', { priority: true });
      G.audio.play('drink', { delay: 0.2 });
      if (id === 'demirderi') {
        p.maxHealth = 300;
        p.health = 300;
      }
      if (id === 'demlicay') {
        p.cay = Math.max(p.cay, 1);
        if (p.vm) {
          p.vm.setItem('cay');
          p.vm.play('drink', 1.3);
        }
      }
      G.hud && G.hud.medal(G.ZM_PERKS[id].name + ' alındı!');
    }

    turnOnPower() {
      this.power = true;
      G.audio.play('power', { priority: true });
      G.hud && G.hud.bigMessage('GÜÇ AÇILDI', 'Yetenek makineleri ve Dönüştürücü çalışıyor');
      if (this.powerSwitch) this.powerSwitch.lever.rotation.x = -0.6;
      for (const pk of this.perks) if (pk.perk !== 'demlicay') pk.glow.material.color.setHex(pk.color);
      for (const l of this.world.lampLights) l.intensity *= 1.4;
      if (this.world.hemi) this.world.hemi.intensity *= 1.15;
    }

    rollBox() {
      const b = this.box;
      b.state = 'rolling';
      b.t = 0;
      b.uses++;
      G.audio.play('box', { pos: b.center, priority: true });
      const pool = Object.keys(G.WEAPONS).filter((id) => G.WEAPONS[id].zm && G.WEAPONS[id].zm.box > 0 && !this.player.weapons.find((w) => w && w.id === id));
      b.pool = pool.map((id) => [id, G.WEAPONS[id].zm.box]);
      b.teddy = b.uses > 3 && this.boxLocs.length > 1 && Math.random() < 0.14;
      b.weapon = G.weightedPick(b.pool);
    }

    boxModel(id) {
      const b = this.box;
      if (!b.models[id]) {
        b.models[id] = displayGun(G.computeStats(id, {}), 1.5, 1.6);
      }
      return b.models[id];
    }

    takeBox() {
      const b = this.box;
      this.giveWeapon(b.weapon);
      G.audio.play('buy');
      this.closeBox();
    }

    closeBox() {
      const b = this.box;
      if (b.shown) b.group.remove(b.shown);
      b.shown = null;
      b.state = 'idle';
      b.lid.rotation.x = 0;
    }

    startUpgrade() {
      const p = this.player;
      const u = this.upgrade;
      u.inst = p.weapon;
      p.weapons[p.cur] = null;
      const other = p.cur === 0 ? 1 : 0;
      if (p.weapons[other]) p.equip(other);
      else if (p.vm) p.vm.hidden = true;
      u.state = 'working';
      u.t = 0;
      G.audio.play('upgrade', { pos: u.center, priority: true });
      const g = displayGun(u.inst.stats, 1.4, 1.25);
      g.position.set(0, 1.75, 0);
      u.grp.add(g);
      u.gunMesh = g;
    }

    takeUpgrade() {
      const u = this.upgrade;
      const p = this.player;
      const id = u.inst.id;
      if (u.gunMesh) u.grp.remove(u.gunMesh);
      u.gunMesh = null;
      u.state = 'idle';
      if (p.vm) p.vm.hidden = false;
      const inst = G.makeWeaponInst(id, u.inst.att, { upgraded: true });
      const slot = p.weapons[0] == null ? 0 : p.weapons[1] == null ? 1 : p.cur;
      p.weapons[slot] = inst;
      p.equip(slot);
      u.inst = null;
      G.audio.play('powerup');
      G.hud && G.hud.medal(inst.stats.name + '!');
    }

    // ------------------------------------------------------------------
    recomputeField(force) {
      const p = this.player;
      const cx = Math.floor(p.pos.x / CELL), cz = Math.floor(p.pos.z / CELL);
      const idx = cx + cz * this.world.w;
      if (!force && idx === this.fieldCell && this.field) return;
      this.fieldCell = idx;
      const n = this.world.nearestWalkable(cx, cz) || [cx, cz];
      this.field = G.distanceField(this.world.walk, this.world.w, this.world.h, n[0], n[1], this.field);
    }

    spawnPoint(forDog) {
      const p = this.player;
      const world = this.world;
      if (forDog) {
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2, r = U.rand(7, 13);
          const x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
          const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
          if (world.isWalkable(cx, cz) && this.openZones.has(world.zoneOf[cx + cz * world.w]) && this.field && isFinite(this.field[cx + cz * world.w])) return world.cellCenter(cx, cz);
        }
      }
      const cands = [];
      for (const z of world.points.Z || []) {
        const c = world.cellCenter(z.x, z.z);
        const zone = world.zoneAt(c.x, c.z);
        if (!this.openZones.has(zone)) continue;
        const d = c.distanceTo(p.pos);
        if (d < 7) continue;
        cands.push([c, d < 40 ? 3 : 1]);
      }
      if (!cands.length) {
        const c = world.randomWalkable((x, z) => this.openZones.has(world.zoneOf[x + z * world.w]) && Math.hypot(x * CELL - p.pos.x, z * CELL - p.pos.z) > 8);
        return c ? world.cellCenter(c[0], c[1]) : null;
      }
      return G.weightedPick(cands).clone();
    }

    spawnZombie() {
      const dog = this.dogRound;
      const pos = this.spawnPoint(dog);
      if (!pos) return false;
      const hp = dog ? Math.round(G.zombieHealth(this.round) * 0.6) : G.zombieHealth(this.round);
      const z = new Zombie(dog ? 'dog' : 'zombie', hp, G.zombieSpeedTier(this.round, Math.random()));
      z.pos.copy(pos);
      z.pos.x += U.rand(-0.4, 0.4);
      z.pos.z += U.rand(-0.4, 0.4);
      z.yaw = Math.atan2(-(this.player.pos.x - pos.x), -(this.player.pos.z - pos.z));
      z.buildModel(this.world.group);
      z.model.root.position.copy(z.pos);
      if (dog) {
        G.fx.explosion(new THREE.Vector3(pos.x, 0.5, pos.z), 2, { plasma: false, small: true });
        G.audio.play('lightning', { pos });
      } else G.fx.dirt(pos);
      this.zombies.push(z);
      this.match.chars.push(z);
      return true;
    }

    respawnStuck(z) {
      z.alive = false;
      this.removeZombie(z);
      this.toSpawn++;
    }

    removeZombie(z) {
      const i = this.zombies.indexOf(z);
      if (i >= 0) this.zombies.splice(i, 1);
      const j = this.match.chars.indexOf(z);
      if (j >= 0) this.match.chars.splice(j, 1);
      if (z.model && z.model.root.parent) z.model.root.parent.remove(z.model.root);
    }

    startRound() {
      this.round++;
      this.dogRound = G.isDogRound(this.round);
      this.toSpawn = this.dogRound ? Math.min(24, 6 + Math.floor(this.round / 2)) : G.zombieCount(this.round);
      this.betweenRounds = false;
      this.dropsThisRound = 0;
      this.spawnCD = 1.5;
      G.audio.play('roundStart', { priority: true });
      G.hud && G.hud.roundChange(this.round, this.dogRound);
      if (this.dogRound) G.hud && G.hud.bigMessage('KÖPEK RAUNDU', 'Cehennem köpekleri geliyor!');
      if (this.player.zmPerks.has('demlicay')) this.player.cay = Math.min(3, this.player.cay + 1);
    }

    onZombieKilled(z, killer, info) {
      this.kills++;
      if (info.headshot) this.headshots++;
      if (killer === this.player) {
        let pts = info.melee ? 130 : info.headshot ? 100 : 60;
        this.addPoints(pts);
        G.progress.kill(info.weaponId, info, { zombie: true });
        if (info.headshot && z.model && z.model.popHead) z.model.popHead();
      }
      // güçlendirme düşür
      const lastOne = this.toSpawn === 0 && this.zombies.filter((x) => x.alive).length === 0;
      if (this.dogRound && lastOne) this.dropPowerup(z.pos, 'cephane');
      else if (!info.nuke && this.dropsThisRound < 4 && Math.random() < 0.03) {
        this.dropPowerup(z.pos, U.pick(Object.keys(G.POWERUPS)));
        this.dropsThisRound++;
      }
      setTimeout(() => this.removeZombie(z), 4000);
    }

    dropPowerup(pos, type) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerTex(type), transparent: true, depthWrite: false }));
      sp.scale.set(1.0, 1.0, 1);
      sp.userData.ph = Math.random() * 6.28;
      sp.position.set(pos.x, 1.1, pos.z);
      this.world.group.add(sp);
      const light = { sp, type, until: G.time + 26, base: pos.clone() };
      this.powerups.push(light);
      G.audio.play('powerupSpawn', { pos });
    }

    collectPowerup(pu) {
      const p = this.player;
      const def = G.POWERUPS[pu.type];
      G.audio.play('powerup', { priority: true });
      G.hud && G.hud.bigMessage(def.name.toUpperCase(), '');
      G.audio.announce(def.name);
      if (pu.type === 'cephane') {
        for (const w of p.weapons) if (w) w.reserve = w.stats.reserve;
        p.lethalCount = Math.max(p.lethalCount, 2);
      } else if (pu.type === 'tekvurus') this.instakillUntil = G.time + 30;
      else if (pu.type === 'ciftpuan') this.doubleUntil = G.time + 30;
      else if (pu.type === 'caymolasi') {
        this.teaBreakUntil = G.time + 7;
        p.cay++;
      } else if (pu.type === 'nukleer') {
        G.audio.play('nuke', { priority: true });
        G.fx.shake(0.6);
        for (const z of this.zombies.slice()) if (z.alive) z.takeDamage(1e9, null, { weapon: 'Nükleer', nuke: true, explosive: true });
        this.addPoints(400);
      }
    }

    // ------------------------------------------------------------------
    update(dt) {
      const p = this.player;
      this.recomputeField(false);
      // rauntlar
      const alive = this.zombies.filter((z) => z.alive).length;
      if (this.betweenRounds) {
        if (G.time >= this.nextRoundAt) this.startRound();
      } else {
        this.spawnCD -= dt;
        const maxAlive = this.dogRound ? 8 : Math.min(24, 10 + this.round * 2);
        if (this.toSpawn > 0 && alive < maxAlive && this.spawnCD <= 0) {
          if (this.spawnZombie()) this.toSpawn--;
          this.spawnCD = this.dogRound ? 1.2 : Math.max(0.35, 2.0 - this.round * 0.12);
        }
        if (this.toSpawn === 0 && alive === 0) {
          this.betweenRounds = true;
          this.nextRoundAt = G.time + 9;
          G.audio.play('roundEnd', { priority: true });
          G.hud && G.hud.medal(`${this.round}. raunt tamamlandı`);
        }
      }
      for (const z of this.zombies) z.update(dt, this);
      // güçlendirmeler
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        pu.sp.position.y = 1.1 + Math.sin(G.time * 3 + pu.sp.userData.ph) * 0.15;
        pu.sp.material.rotation = Math.sin(G.time * 2.4 + pu.sp.userData.ph) * 0.2;
        pu.sp.scale.setScalar(1 + Math.sin(G.time * 5 + pu.sp.userData.ph) * 0.06);
        const left = pu.until - G.time;
        pu.sp.visible = left > 6 || Math.floor(G.time * 6) % 2 === 0;
        if (p.alive && Math.hypot(pu.base.x - p.pos.x, pu.base.z - p.pos.z) < 1.6) {
          this.collectPowerup(pu);
          this.world.group.remove(pu.sp);
          pu.sp.material.dispose();
          this.powerups.splice(i, 1);
        } else if (left <= 0) {
          this.world.group.remove(pu.sp);
          pu.sp.material.dispose();
          this.powerups.splice(i, 1);
        }
      }
      // kutu animasyonu
      const b = this.box;
      if (b.state === 'rolling') {
        b.t += dt;
        b.lid.rotation.x = -Math.min(1.2, b.t * 3);
        if (b.shown) b.group.remove(b.shown);
        const ids = b.pool.map((x) => x[0]);
        const showId = b.t < 2.9 ? ids[Math.floor(b.t * 7) % ids.length] : b.weapon;
        b.shown = this.boxModel(showId);
        b.shown.position.set(0, 1.0 + Math.min(1, b.t / 2.9) * 0.6, 0);
        b.shown.rotation.y = Math.PI / 2;
        b.group.add(b.shown);
        if (b.t >= 3.2) {
          if (b.teddy) {
            b.state = 'moving';
            b.t = 0;
            if (b.shown) b.group.remove(b.shown);
            b.shown = null;
            this.player.points += 950;
            G.hud && G.hud.bigMessage('KUTU TAŞINIYOR', '950 puan iade edildi');
            G.audio.play('groan', { pos: b.center, priority: true });
          } else {
            b.state = 'offer';
            b.t = 0;
          }
        }
      } else if (b.state === 'offer') {
        b.t += dt;
        if (b.shown) b.shown.position.y = 1.6 - (b.t / 9) * 0.6;
        if (b.t > 9) this.closeBox();
      } else if (b.state === 'moving') {
        b.t += dt;
        b.group.position.y = b.t * 3;
        b.group.rotation.y += dt * 4;
        if (b.t > 2.5) {
          let ni = b.loc;
          while (ni === b.loc) ni = U.randInt(0, this.boxLocs.length - 1);
          b.uses = 0;
          this.buildBoxAt(ni);
          G.hud && G.hud.medal('Gizem Kutusu yeni yerinde');
        }
      }
      // dönüştürücü
      const u = this.upgrade;
      if (u) {
        u.ring.rotation.z += dt * (this.power ? 2 : 0.2);
        if (u.state === 'working') {
          u.t += dt;
          if (u.gunMesh) u.gunMesh.rotation.y += dt * 6;
          if (u.t > 3.4) {
            u.state = 'ready';
            u.t = 0;
          }
        } else if (u.state === 'ready') {
          u.t += dt;
          if (u.gunMesh) u.gunMesh.rotation.y += dt * 1.5;
          if (u.t > 12) {
            if (u.gunMesh) u.grp.remove(u.gunMesh);
            u.gunMesh = null;
            u.state = 'idle';
            u.inst = null;
            if (p.vm) p.vm.hidden = false;
          }
        }
      }
      this.animateProps(dt);
    }

    // Yalnızca görsel canlandırmalar (simgeler, buhar)
    animateProps(dt) {
      this.animT = (this.animT || 0) + dt;
      if (this.cuteAnim) for (const fn of this.cuteAnim) fn(this.animT);
    }

    modifyDamage(target, attacker, amount, info) {
      const p = this.player;
      if (target.kind === 'zombie' || target.kind === 'dog') {
        if (attacker !== p && !info.nuke && attacker !== null) return 0;
        if (this.instakill) return 1e9;
        return amount;
      }
      if (target === p) {
        if (G.time < (p.invulnUntil || 0)) return 0;
        if (p.health - amount <= 0 && p.zmPerks.has('ikincisans')) {
          p.zmPerks.delete('ikincisans');
          p.health = p.maxHealth * 0.6;
          p.invulnUntil = G.time + 3;
          G.hud && G.hud.bigMessage('İKİNCİ ŞANS', 'Ayağa kalktın!');
          G.audio.play('perk', { priority: true });
          for (const z of this.zombies) {
            if (!z.alive) continue;
            const d = z.pos.distanceTo(p.pos);
            if (d < 4) z.stunUntil = G.time + 2.5;
          }
          return 0;
        }
        return amount;
      }
      return amount;
    }

    onDamage(target, attacker, amount, info) {
      if ((target.kind === 'zombie' || target.kind === 'dog') && attacker === this.player && target.alive && !info.nuke) this.addPoints(10);
    }
  }
  G.ZombieDirector = ZombieDirector;
})();
