'use strict';
// Gölge Timi — insansı modeller (asker, zombi, köpek) ve ortak karakter sınıfı.
(function () {
  const G = window.G;
  const U = G.util;

  const gc = {};
  function box(w, h, d) {
    const k = w + ':' + h + ':' + d;
    if (!gc[k]) gc[k] = new THREE.BoxGeometry(w, h, d);
    return gc[k];
  }
  const mc = {};
  function mat(color, opts) {
    const k = color + JSON.stringify(opts || {});
    if (!mc[k]) {
      const o = opts || {};
      const params = { color, roughness: 0.85, metalness: 0.05 };
      if (o.emissive != null) params.emissive = new THREE.Color(o.emissive);
      if (o.ei != null) params.emissiveIntensity = o.ei;
      mc[k] = G.settings.quality === 'dusuk' ? new THREE.MeshLambertMaterial(params) : new THREE.MeshStandardMaterial(params);
    }
    return mc[k];
  }
  function add(parent, geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = G.settings.quality === 'yuksek';
    parent.add(m);
    return m;
  }

  const TEAM_LOOK = {
    0: { uniform: 0x48523f, vest: 0x2f3a2c, accent: 0x4cc3ff, helmet: 0x3b4633 }, // Gölge Timi
    1: { uniform: 0x3b3a40, vest: 0x22232a, accent: 0xff4d3d, helmet: 0x2a2a30 }, // Kızıl Pençe
    2: { uniform: 0x6a5a40, vest: 0x40352a, accent: 0xffc23a, helmet: 0x4a4030 },
  };
  G.TEAM_LOOK = TEAM_LOOK;
  G.TEAM_NAMES = ['Gölge Timi', 'Kızıl Pençe'];

  // ------------------------------------------------------------------
  // Asker / zombi modeli
  // ------------------------------------------------------------------
  G.makeHumanoid = function (o) {
    const zombie = o.kind === 'zombie';
    const look = zombie ? null : TEAM_LOOK[o.look != null ? o.look : 0] || TEAM_LOOK[0];
    const skin = zombie ? U.pick([0x6f8a62, 0x7d8f6a, 0x667a5e, 0x8a8f72]) : U.pick([0xd8a47f, 0xc68a62, 0xa8714d, 0xe0b48f]);
    const shirt = zombie ? U.pick([0x5a4a3a, 0x3e4a5a, 0x6a2e2a, 0x4a4a42, 0xc8c2b0]) : look.uniform;
    const pants = zombie ? U.pick([0x2e3442, 0x3d3a33, 0x4a4036]) : look.uniform;
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.92;
    root.add(hips);
    const mkLeg = (x) => {
      const l = new THREE.Group();
      l.position.set(x, 0, 0);
      add(l, box(0.17, 0.62, 0.2), mat(pants), 0, -0.31, 0);
      add(l, box(0.16, 0.3, 0.18), mat(pants), 0, -0.72, 0);
      add(l, box(0.18, 0.12, 0.27), mat(zombie ? 0x2a2420 : 0x1e1d1b), 0, -0.86, -0.04);
      hips.add(l);
      return l;
    };
    const legL = mkLeg(-0.11), legR = mkLeg(0.11);
    const torso = new THREE.Group();
    hips.add(torso);
    add(torso, box(0.44, 0.58, 0.25), mat(shirt), 0, 0.29, 0);
    if (!zombie) {
      add(torso, box(0.48, 0.38, 0.31), mat(look.vest), 0, 0.33, 0);
      add(torso, box(0.12, 0.1, 0.06), mat(look.vest), -0.12, 0.22, -0.17);
      add(torso, box(0.12, 0.1, 0.06), mat(look.vest), 0.0, 0.22, -0.17);
      add(torso, box(0.5, 0.06, 0.32), mat(0x1c1c1a), 0, 0.03, 0);
      // kol bandı (takım rengi)
    } else {
      add(torso, box(0.3, 0.2, 0.02), mat(0x5a0f0f), 0.05, 0.3, -0.13);
    }
    const head = new THREE.Group();
    head.position.y = 0.6;
    torso.add(head);
    add(head, box(0.24, 0.26, 0.25), mat(skin), 0, 0.13, 0);
    if (!zombie) {
      add(head, box(0.29, 0.12, 0.31), mat(look.helmet), 0, 0.29, 0.01);
      add(head, box(0.3, 0.04, 0.32), mat(look.helmet), 0, 0.22, 0.0);
      const visor = add(head, box(0.22, 0.05, 0.02), mat(0x111111, { emissive: look.accent, ei: 0.5 }), 0, 0.17, -0.13);
      visor.castShadow = false;
      add(head, box(0.2, 0.08, 0.02), mat(0x2a2a2a), 0, 0.06, -0.128);
    } else {
      const eyeM = new THREE.MeshBasicMaterial({ color: o.eyeColor || 0xffa020 });
      add(head, box(0.05, 0.03, 0.02), eyeM, -0.06, 0.16, -0.13);
      add(head, box(0.05, 0.03, 0.02), eyeM, 0.06, 0.16, -0.13);
      add(head, box(0.12, 0.04, 0.02), mat(0x3a0a0a), 0, 0.05, -0.128);
      add(head, box(0.2, 0.06, 0.2), mat(0x2a2a20), 0.02, 0.27, 0.02);
    }
    const mkArm = (x) => {
      const a = new THREE.Group();
      a.position.set(x, 0.52, 0);
      add(a, box(0.13, 0.32, 0.14), mat(shirt), 0, -0.16, 0);
      add(a, box(0.12, 0.3, 0.13), mat(zombie ? skin : shirt), 0, -0.45, 0);
      add(a, box(0.1, 0.1, 0.11), mat(zombie ? skin : 0x1d1f1e), 0, -0.63, 0);
      if (!zombie) add(a, box(0.14, 0.06, 0.15), mat(look.accent, { emissive: look.accent, ei: 0.25 }), 0, -0.1, 0);
      torso.add(a);
      return a;
    };
    const armL = mkArm(-0.3), armR = mkArm(0.3);
    let gun = null;
    if (o.weapon) {
      gun = G.buildGun(o.weapon, { shadow: G.settings.quality === 'yuksek' });
      gun.scale.setScalar(1.15);
      gun.position.set(0.1, 0.36, -0.3);
      torso.add(gun);
    }
    // yaka fotoğrafı (sadece oyuncunun kendi modeli)
    if (o.photoTex) {
      const frame = add(torso, box(0.13, 0.15, 0.012), mat(0xc9a14a, { emissive: 0x2a1a00 }), 0.12, 0.47, -0.162);
      frame.castShadow = false;
      const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.13), new THREE.MeshBasicMaterial({ map: o.photoTex }));
      ph.position.set(0.12, 0.47, -0.17);
      ph.rotation.y = Math.PI;
      torso.add(ph);
    }
    if (o.tag) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.tag, depthTest: false, transparent: true }));
      sp.scale.set(o.tagW || 0.35, o.tagH || 0.35, 1);
      sp.position.y = 2.15;
      sp.renderOrder = 10;
      root.add(sp);
      root.userData.tag = sp;
    }
    return {
      root, hips, torso, head, legL, legR, armL, armR, gun, zombie,
      phase: Math.random() * 6,
      deathT: 0,
      deathDir: 1,
      animate(dt, st) {
        // st: {speed, crouch, pitch, dead, attack, rise}
        if (st.dead) {
          this.deathT += dt;
          const k = U.clamp(this.deathT / 0.45, 0, 1);
          const e = 1 - Math.pow(1 - k, 3);
          this.hips.rotation.x = this.deathDir * e * 1.45;
          this.hips.position.y = 0.92 - e * 0.68;
          this.armL.rotation.x = -e * 2.4;
          this.armR.rotation.x = -e * 2.2;
          this.legL.rotation.x = e * 0.25;
          this.legR.rotation.x = -e * 0.15;
          if (this.deathT > 3.2) this.root.position.y = -(this.deathT - 3.2) * 0.5;
          return;
        }
        const sp = st.speed || 0;
        this.phase += dt * (2.5 + sp * 1.6);
        const amp = Math.min(1, sp / 4.5) * (this.zombie ? 0.55 : 0.7);
        const s = Math.sin(this.phase) * amp;
        const c = st.crouch || 0;
        this.hips.position.y = 0.92 - c * 0.42 - Math.abs(Math.cos(this.phase)) * amp * 0.05;
        this.legL.rotation.x = s - c * 1.1;
        this.legR.rotation.x = -s - c * 0.6;
        this.torso.rotation.x = c * 0.25 + (this.zombie ? 0.35 : 0);
        this.head.rotation.x = -(st.pitch || 0) * 0.5 - (this.zombie ? 0.25 : 0);
        if (this.zombie) {
          const atk = st.attack || 0;
          this.armL.rotation.x = -1.35 + Math.sin(this.phase * 0.5) * 0.15 - atk * 0.8;
          this.armR.rotation.x = -1.45 - Math.sin(this.phase * 0.5) * 0.15 - atk * 1.2;
          this.armR.rotation.z = atk * 0.6;
          this.torso.rotation.y = Math.sin(this.phase * 0.5) * 0.12;
          if (st.rise != null) {
            this.root.position.y = (st.rise - 1) * 1.7;
          }
        } else {
          const p = st.pitch || 0;
          this.armR.rotation.set(-1.25 - p, -0.15, 0);
          this.armL.rotation.set(-1.35 - p, 0.55, 0);
          if (this.gun) this.gun.rotation.x = -p * 0.9;
          if (sp > 5.5) {
            // koşu: silah aşağı
            this.armR.rotation.x = -0.6 + s * 0.3;
            this.armL.rotation.x = -0.9 - s * 0.3;
            if (this.gun) this.gun.rotation.x = 0.6;
          }
        }
      },
    };
  };

  // ------------------------------------------------------------------
  // Zombi köpeği
  // ------------------------------------------------------------------
  G.makeDog = function () {
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 0.55;
    root.add(body);
    const fur = mat(0x2a2220);
    const skin = mat(0x5a1a12, { emissive: 0x3a0800, ei: 0.4 });
    add(body, box(0.36, 0.34, 0.95), fur, 0, 0.05, 0);
    add(body, box(0.3, 0.1, 0.5), skin, 0, 0.23, 0.05);
    const head = new THREE.Group();
    head.position.set(0, 0.22, -0.55);
    body.add(head);
    add(head, box(0.28, 0.26, 0.32), fur, 0, 0, 0);
    add(head, box(0.18, 0.14, 0.22), fur, 0, -0.05, -0.24);
    add(head, box(0.06, 0.12, 0.06), fur, -0.09, 0.17, 0.05);
    add(head, box(0.06, 0.12, 0.06), fur, 0.09, 0.17, 0.05);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff5a10 });
    add(head, box(0.05, 0.04, 0.02), eyeM, -0.08, 0.05, -0.17);
    add(head, box(0.05, 0.04, 0.02), eyeM, 0.08, 0.05, -0.17);
    const legs = [];
    for (const [x, z] of [[-0.13, -0.35], [0.13, -0.35], [-0.13, 0.35], [0.13, 0.35]]) {
      const l = new THREE.Group();
      l.position.set(x, -0.1, z);
      add(l, box(0.1, 0.45, 0.1), fur, 0, -0.22, 0);
      body.add(l);
      legs.push(l);
    }
    const tail = add(body, box(0.06, 0.06, 0.35), fur, 0, 0.12, 0.6);
    tail.rotation.x = -0.6;
    return {
      root, body, head, legs, phase: Math.random() * 6, deathT: 0,
      animate(dt, st) {
        if (st.dead) {
          this.deathT += dt;
          const k = U.clamp(this.deathT / 0.35, 0, 1);
          this.body.rotation.z = k * 1.5;
          this.body.position.y = 0.55 - k * 0.35;
          if (this.deathT > 2.5) this.root.position.y = -(this.deathT - 2.5) * 0.5;
          return;
        }
        const sp = st.speed || 0;
        this.phase += dt * (3 + sp * 1.8);
        const s = Math.sin(this.phase) * Math.min(1, sp / 5) * 0.8;
        this.legs[0].rotation.x = s;
        this.legs[3].rotation.x = s;
        this.legs[1].rotation.x = -s;
        this.legs[2].rotation.x = -s;
        this.body.position.y = 0.55 + Math.abs(Math.cos(this.phase)) * 0.05;
        this.head.rotation.x = (st.attack || 0) * -0.5;
      },
    };
  };

  // ------------------------------------------------------------------
  // Ortak karakter
  // ------------------------------------------------------------------
  let nextId = 1;
  const tmpV = new THREE.Vector3();

  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const lx = cx - ox, ly = cy - oy, lz = cz - oz;
    const tc = lx * dx + ly * dy + lz * dz;
    if (tc < 0) return -1;
    const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
    if (d2 > r * r) return -1;
    return tc - Math.sqrt(r * r - d2);
  }
  function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = -Infinity, tmax = Infinity;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) return -1;
      } else {
        let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (tmax < 0) return -1;
    return tmin >= 0 ? tmin : 0;
  }
  G.raySphere = raySphere;
  G.rayBox = rayBox;

  class Character {
    constructor(o) {
      this.id = nextId++;
      this.team = o.team != null ? o.team : 0;
      this.name = o.name || 'Asker';
      this.kind = o.kind || 'soldier';
      this.isPlayer = !!o.isPlayer;
      this.pos = new THREE.Vector3();
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.radius = 0.35;
      this.height = 1.8;
      this.stance = 'stand';
      this.crouchT = 0;
      this.maxHealth = o.health || 150;
      this.health = this.maxHealth;
      this.alive = true;
      this.grounded = true;
      this.lastHurt = -99;
      this.damageLog = [];
      this.kills = 0;
      this.deaths = 0;
      this.assists = 0;
      this.score = 0;
      this.streak = 0;
      this.model = null;
      this.diedAt = 0;
      this.spotted = 0; // haritada görünür olduğu süre sonu
      this.stunUntil = 0;
    }
    get forwardX() {
      return -Math.sin(this.yaw);
    }
    get forwardZ() {
      return -Math.cos(this.yaw);
    }
    eyeHeight() {
      if (this.stance === 'prone') return 0.42;
      return U.lerp(1.62, 1.12, this.crouchT);
    }
    eye(out) {
      return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z);
    }
    chest(out) {
      const h = this.stance === 'prone' ? 0.3 : this.kind === 'dog' ? 0.6 : U.lerp(1.25, 0.85, this.crouchT);
      return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + h, this.pos.z);
    }
    headPos(out) {
      const o = out || new THREE.Vector3();
      if (this.kind === 'dog') return o.set(this.pos.x + this.forwardX * 0.6, this.pos.y + 0.78, this.pos.z + this.forwardZ * 0.6);
      if (this.stance === 'prone') return o.set(this.pos.x + this.forwardX * 0.7, this.pos.y + 0.33, this.pos.z + this.forwardZ * 0.7);
      const fwd = this.kind === 'zombie' ? 0.12 : 0;
      return o.set(this.pos.x + this.forwardX * fwd, this.pos.y + U.lerp(1.63, 1.13, this.crouchT), this.pos.z + this.forwardZ * fwd);
    }
    // Işın-karakter isabeti
    hitTest(ox, oy, oz, dx, dy, dz, maxT) {
      if (!this.alive) return null;
      const p = this.pos;
      // kaba eleme
      const lx = p.x - ox, lz = p.z - oz;
      const tc = lx * dx + lz * dz;
      if (tc < -1.5 || tc > maxT + 1.5) return null;
      const h = this.headPos(tmpV);
      const th = raySphere(ox, oy, oz, dx, dy, dz, h.x, h.y, h.z, this.kind === 'dog' ? 0.2 : 0.16);
      let best = th >= 0 && th < maxT ? th : Infinity;
      let part = best < Infinity ? 'head' : null;
      let tb;
      if (this.kind === 'dog') {
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.35, p.y + 0.3, p.z - 0.35, p.x + 0.35, p.y + 0.85, p.z + 0.35);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
      } else if (this.stance === 'prone') {
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.5, p.y, p.z - 0.5, p.x + 0.5, p.y + 0.45, p.z + 0.5);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
      } else {
        const c = this.crouchT;
        const by0 = U.lerp(0.85, 0.55, c), by1 = U.lerp(1.5, 1.0, c);
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.26, p.y + by0, p.z - 0.26, p.x + 0.26, p.y + by1, p.z + 0.26);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
        const tl = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.22, p.y, p.z - 0.22, p.x + 0.22, p.y + by0, p.z + 0.22);
        if (tl >= 0 && tl < best && tl < maxT) {
          best = tl;
          part = 'legs';
        }
      }
      if (!part) return null;
      return { t: best, part };
    }
    takeDamage(amount, attacker, info) {
      if (!this.alive || amount <= 0) return false;
      const game = G.game;
      if (game && game.modifyDamage) amount = game.modifyDamage(this, attacker, amount, info || {});
      if (amount <= 0) return false;
      this.health -= amount;
      this.lastHurt = G.time;
      if (attacker && attacker !== this) {
        this.damageLog.push({ by: attacker, t: G.time, amount });
        if (this.damageLog.length > 8) this.damageLog.shift();
      }
      if (this.onHurt) this.onHurt(amount, attacker, info || {});
      if (game && game.onDamage) game.onDamage(this, attacker, amount, info || {});
      if (this.health <= 0) {
        this.health = 0;
        this.die(attacker, info || {});
        return true;
      }
      return false;
    }
    die(attacker, info) {
      if (!this.alive) return;
      this.alive = false;
      this.diedAt = G.time;
      this.deaths++;
      if (this.model) this.model.deathDir = info && info.dirSign ? info.dirSign : Math.random() < 0.5 ? 1 : -1;
      if (this.onDeath) this.onDeath(attacker, info);
      if (G.game && G.game.onKill) G.game.onKill(this, attacker, info || {});
    }
    regen(dt, delay, rate) {
      if (this.alive && this.health < this.maxHealth && G.time - this.lastHurt > delay) {
        this.health = Math.min(this.maxHealth, this.health + rate * dt);
      }
    }
  }
  G.Character = Character;
})();
