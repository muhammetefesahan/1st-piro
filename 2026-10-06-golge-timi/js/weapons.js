'use strict';
// Gölge Timi — silah modelleri (kutu tabanlı), birinci şahıs görünümü (eller,
// şarjör değiştirme, sürgü çekme, nişan alma animasyonları).
(function () {
  const G = window.G;
  const U = G.util;

  const geoCache = {};
  function box(w, h, d) {
    const k = w + ':' + h + ':' + d;
    if (!geoCache[k]) geoCache[k] = new THREE.BoxGeometry(w, h, d);
    return geoCache[k];
  }
  function cyl(r, l, seg) {
    const k = 'c' + r + ':' + l + ':' + (seg || 8);
    if (!geoCache[k]) {
      const g = new THREE.CylinderGeometry(r, r, l, seg || 8);
      g.rotateX(Math.PI / 2);
      geoCache[k] = g;
    }
    return geoCache[k];
  }
  const matCache = {};
  function mat(color, opts) {
    const k = color + ':' + JSON.stringify(opts || {});
    if (!matCache[k]) {
      const o = opts || {};
      matCache[k] = new THREE.MeshStandardMaterial({
        color,
        roughness: o.rough != null ? o.rough : 0.55,
        metalness: o.metal != null ? o.metal : 0.45,
        emissive: o.emissive != null ? new THREE.Color(o.emissive) : new THREE.Color(0),
        emissiveIntensity: o.ei != null ? o.ei : 1,
      });
    }
    return matCache[k];
  }
  G.gunMat = mat;

  function part(group, geo, material, x, y, z, name) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (name) m.name = name;
    group.add(m);
    return m;
  }

  // Silah modeli. Köken: tetik/kabza. Namlu -Z yönünde. Nişan hattı y = sightY.
  G.buildGun = function (stats, opts) {
    const o = opts || {};
    const L = stats.look || {};
    const g = new THREE.Group();
    const upgraded = !!stats.upgraded;
    const body = upgraded ? mat(0x2a1640, { metal: 0.6, emissive: 0x5a1fa0, ei: 0.35 }) : mat(L.body || 0x2a2d30);
    const accent = upgraded ? mat(0x3fd0ff, { emissive: 0x1a90ff, ei: 0.6 }) : mat(L.accent || 0x444444, { metal: 0.3 });
    const wood = mat(0x6b4426, { metal: 0.05, rough: 0.8 });
    const dark = mat(0x111214, { metal: 0.6 });
    const parts = {};
    let sightY = 0.07;
    let muzzleZ;

    if (L.launcher) {
      part(g, cyl(0.07, 1.0, 10), body, 0, 0.09, -0.25);
      part(g, box(0.06, 0.12, 0.08), dark, 0, -0.03, 0);
      part(g, box(0.06, 0.12, 0.08), dark, 0, -0.03, -0.3);
      parts.mag = part(g, new THREE.ConeGeometry(0.075, 0.22, 8).rotateX(-Math.PI / 2), mat(0x5d6b45, { metal: 0.2 }), 0, 0.09, -0.86);
      part(g, box(0.04, 0.06, 0.06), accent, -0.07, 0.17, -0.2);
      sightY = 0.18;
      muzzleZ = -0.78;
    } else if (L.pistol) {
      if (L.wonder) {
        part(g, box(0.06, 0.09, 0.26), body, 0, 0.06, -0.08);
        part(g, cyl(0.035, 0.12, 8), accent, 0, 0.06, -0.26);
        for (let i = 0; i < 3; i++) part(g, new THREE.TorusGeometry(0.045, 0.01, 6, 12), accent, 0, 0.06, -0.12 - i * 0.06);
        part(g, box(0.05, 0.13, 0.06), body, 0, -0.04, 0.01).rotation.x = 0.25;
        parts.mag = part(g, box(0.04, 0.05, 0.08), mat(0x39ff9a, { emissive: 0x20ff80, ei: 1.2 }), 0, 0.12, -0.05);
        sightY = 0.12;
        muzzleZ = -0.33;
      } else if (L.revolver) {
        part(g, cyl(0.022, 0.2, 8), body, 0, 0.065, -0.17);
        part(g, box(0.03, 0.03, 0.2), body, 0, 0.09, -0.15);
        parts.mag = part(g, cyl(0.04, 0.07, 8), body, 0, 0.055, -0.03);
        part(g, box(0.045, 0.06, 0.1), body, 0, 0.06, 0.03);
        const grip = part(g, box(0.04, 0.12, 0.05), wood, 0, -0.03, 0.06);
        grip.rotation.x = 0.35;
        sightY = 0.112;
        muzzleZ = -0.28;
      } else {
        parts.slide = part(g, box(0.035, 0.04, 0.2), body, 0, 0.07, -0.07);
        part(g, box(0.032, 0.03, 0.16), accent, 0, 0.04, -0.06);
        const grip = part(g, box(0.034, 0.11, 0.05), accent, 0, -0.02, 0.01);
        grip.rotation.x = 0.22;
        parts.mag = part(g, box(0.028, 0.05, 0.035), dark, 0, -0.08, 0.025);
        part(g, box(0.006, 0.012, 0.006), dark, 0, 0.096, -0.16);
        part(g, box(0.02, 0.012, 0.006), dark, 0, 0.096, 0.02);
        sightY = 0.1;
        muzzleZ = -0.18;
      }
    } else {
      const rec = L.rec || 0.36;
      const barrel = L.barrel || 0.3;
      const guard = L.guard || 0.22;
      // gövde
      part(g, box(0.06, 0.085, rec), body, 0, 0.04, -rec / 2 + 0.06);
      part(g, box(0.05, 0.025, rec * 0.9), accent, 0, 0.09, -rec / 2 + 0.06);
      // el kundağı
      const gz = -rec + 0.06;
      if (guard > 0.05) parts.guard = part(g, box(0.065, 0.07, guard), L.wood ? wood : accent, 0, 0.035, gz - guard / 2);
      // namlu
      const bz = gz - guard;
      part(g, cyl(0.014, barrel, 8), dark, 0, 0.055, bz - barrel / 2 + guard * 0.5);
      muzzleZ = bz - barrel + guard * 0.5;
      // kabza
      const grip = part(g, box(0.045, 0.11, 0.05), accent, 0, -0.04, 0.03);
      grip.rotation.x = 0.3;
      // dipçik
      if (L.stock === 'full') {
        part(g, box(0.045, 0.08, 0.24), L.wood ? wood : body, 0, 0.02, 0.2);
        part(g, box(0.05, 0.11, 0.03), dark, 0, 0.0, 0.32);
      } else if (L.stock === 'folding') {
        part(g, box(0.015, 0.015, 0.22), dark, 0.02, 0.05, 0.18);
        part(g, box(0.015, 0.015, 0.22), dark, 0.02, 0.0, 0.18);
        part(g, box(0.02, 0.07, 0.02), dark, 0.02, 0.025, 0.29);
      }
      // şarjör
      if (L.mag === 'curved') {
        const m = part(g, box(0.035, 0.16, 0.06), dark, 0, -0.06, -0.08);
        m.rotation.x = -0.25;
        parts.mag = m;
      } else if (L.mag === 'straight') {
        parts.mag = part(g, box(0.035, 0.15, 0.05), dark, 0, -0.06, -0.06);
      } else if (L.mag === 'box') {
        parts.mag = part(g, box(0.04, 0.07, 0.07), dark, 0, -0.02, -0.06);
      } else if (L.mag === 'drum') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), dark);
        m.rotation.z = Math.PI / 2;
        m.position.set(0, -0.07, -0.08);
        g.add(m);
        parts.mag = m;
      } else if (L.mag === 'tube') {
        part(g, cyl(0.016, guard + 0.2, 8), dark, 0, 0.012, gz - guard / 2 - 0.05);
        parts.mag = part(g, box(0.02, 0.02, 0.02), mat(0xb02020), 0, -0.01, -0.02);
        parts.mag.visible = false;
      }
      // gez-arpacık
      if (!L.scope) {
        part(g, box(0.008, 0.03, 0.008), dark, 0, 0.11, bz + 0.03);
        part(g, box(0.03, 0.02, 0.01), dark, 0, 0.11, -0.01);
      }
      sightY = 0.12;
      // sürgü kolu
      parts.bolt = part(g, box(0.03, 0.015, 0.015), mat(0x888888, { metal: 0.8 }), 0.04, 0.06, -0.05);
    }

    // ---- eklentiler ----
    const att = stats.att || {};
    const railY = L.pistol ? 0.09 : 0.105;
    const opticZ = L.pistol ? -0.06 : -0.08;
    if (L.scope) {
      const s = new THREE.Group();
      part(s, cyl(0.026, 0.3, 10), dark, 0, 0, 0);
      part(s, cyl(0.034, 0.06, 10), dark, 0, 0, -0.16);
      part(s, cyl(0.03, 0.05, 10), dark, 0, 0, 0.14);
      part(s, box(0.02, 0.04, 0.02), dark, 0, -0.035, -0.06);
      part(s, box(0.02, 0.04, 0.02), dark, 0, -0.035, 0.06);
      const lens = part(s, new THREE.CircleGeometry(0.024, 10), mat(0x3060a0, { emissive: 0x102040, metal: 0.9, rough: 0.1 }), 0, 0, -0.191);
      lens.rotation.y = Math.PI;
      s.position.set(0, 0.155, -0.08);
      g.add(s);
      sightY = 0.155;
    } else if (att.optic === 'kirmizi' || att.optic === 'holo') {
      const s = new THREE.Group();
      if (att.optic === 'kirmizi') {
        part(s, cyl(0.022, 0.06, 10), dark, 0, 0.028, 0);
        part(s, box(0.03, 0.02, 0.05), dark, 0, 0, 0);
      } else {
        part(s, box(0.05, 0.012, 0.08), dark, 0, 0, 0);
        part(s, box(0.006, 0.05, 0.08), dark, -0.022, 0.028, 0);
        part(s, box(0.006, 0.05, 0.08), dark, 0.022, 0.028, 0);
        part(s, box(0.05, 0.006, 0.08), dark, 0, 0.055, 0);
      }
      const dot = part(s, box(0.004, 0.004, 0.001), new THREE.MeshBasicMaterial({ color: att.optic === 'holo' ? 0xff3355 : 0xff2020 }), 0, 0.028, -0.02);
      parts.reticle = dot;
      s.position.set(0, railY, opticZ);
      g.add(s);
      sightY = railY + 0.028;
    } else if (att.optic === 'durbun') {
      const s = new THREE.Group();
      part(s, cyl(0.024, 0.16, 10), dark, 0, 0.035, 0);
      part(s, cyl(0.03, 0.03, 10), dark, 0, 0.035, -0.08);
      part(s, box(0.025, 0.03, 0.06), dark, 0, 0.005, 0);
      s.position.set(0, railY, opticZ);
      g.add(s);
      sightY = railY + 0.035;
    }
    if (att.muzzle === 'susturucu') {
      part(g, cyl(0.022, 0.18, 10), dark, 0, L.pistol ? 0.07 : 0.055, muzzleZ - 0.09);
      muzzleZ -= 0.18;
    } else if (att.muzzle === 'kompansator') {
      part(g, cyl(0.02, 0.06, 6), mat(0x555555, { metal: 0.8 }), 0, 0.055, muzzleZ - 0.03);
      muzzleZ -= 0.06;
    } else if (att.muzzle === 'alev') {
      part(g, cyl(0.018, 0.07, 6), dark, 0, 0.055, muzzleZ - 0.035);
      muzzleZ -= 0.07;
    }
    if (att.under === 'dikey') part(g, box(0.025, 0.08, 0.025), dark, 0, -0.03, -0.24);
    else if (att.under === 'acili') {
      const a = part(g, box(0.03, 0.05, 0.06), dark, 0, -0.02, -0.24);
      a.rotation.x = 0.5;
    } else if (att.under === 'lazer') {
      part(g, box(0.025, 0.025, 0.06), dark, 0.035, 0.03, -0.24);
      part(g, box(0.008, 0.008, 0.002), new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0.035, 0.03, -0.272);
    }
    if (att.barrel === 'uzun' && !L.pistol) part(g, cyl(0.015, 0.1, 8), dark, 0, 0.055, muzzleZ + 0.02);
    if (att.mag === 'genis' && parts.mag && L.mag !== 'drum' && L.mag !== 'tube') parts.mag.scale.y = 1.35;

    // namlu ağzı
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, L.pistol ? 0.07 : L.launcher ? 0.09 : 0.055, muzzleZ - 0.02);
    g.add(muzzle);
    parts.muzzle = muzzle;
    g.userData = { sightY, parts, muzzleZ };
    if (o.shadow) g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return g;
  };

  // ------------------------------------------------------------------
  // Birinci şahıs görünümü
  // ------------------------------------------------------------------
  class ViewModel {
    constructor(scene) {
      this.scene = scene;
      this.root = new THREE.Group();
      scene.add(this.root);
      this.sway = new THREE.Vector2();
      this.kick = 0;
      this.kickRot = 0;
      this.kickSide = 0;
      this.bobT = 0;
      this.gun = null;
      this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.spriteTex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.flash.visible = false;
      this.flashLife = 0;
      this.knife = this.buildKnife();
      this.knife.visible = false;
      this.root.add(this.knife);
      this.item = new THREE.Group();
      this.item.visible = false;
      this.root.add(this.item);
      this.anim = null; // {type, t, dur}
      this.arms = this.buildArms();
      const light = new THREE.HemisphereLight(0xffffff, 0x404050, 0.9);
      const dir = new THREE.DirectionalLight(0xffffff, 0.7);
      dir.position.set(0.5, 1, 0.6);
      scene.add(light, dir);
      this.light = light;
      this.dirLight = dir;
      this.adsAmount = 0;
      this.hidden = false;
    }

    setLighting(theme) {
      const night = theme && theme.night;
      this.light.intensity = night ? 0.55 : 0.95;
      this.dirLight.intensity = night ? 0.35 : 0.75;
      this.light.color.setHex(theme ? theme.hemiSky : 0xffffff);
    }

    buildArms() {
      const sleeve = mat(0x3a4235, { metal: 0, rough: 0.9 });
      const glove = mat(0x1d1f1e, { metal: 0.05, rough: 0.8 });
      const mkArm = () => {
        const a = new THREE.Group();
        const s = new THREE.Mesh(box(0.085, 0.085, 0.42), sleeve);
        s.position.z = 0.2;
        a.add(s);
        const cuff = new THREE.Mesh(box(0.09, 0.09, 0.05), mat(0x2b3128, { metal: 0, rough: 0.9 }));
        cuff.position.z = 0.0;
        a.add(cuff);
        const h = new THREE.Mesh(box(0.07, 0.06, 0.1), glove);
        h.position.z = -0.06;
        a.add(h);
        return a;
      };
      const right = mkArm();
      const left = mkArm();
      this.root.add(right, left);
      // saat (sol bilekte) — küçük ayrıntı
      const watch = new THREE.Mesh(box(0.095, 0.03, 0.04), mat(0x101010));
      watch.position.set(0, 0.03, 0.03);
      left.add(watch);
      const face = new THREE.Mesh(box(0.04, 0.005, 0.03), new THREE.MeshBasicMaterial({ color: 0x55ffaa }));
      face.position.set(0, 0.048, 0.03);
      left.add(face);
      return { right, left };
    }

    buildKnife() {
      const g = new THREE.Group();
      const blade = new THREE.Mesh(box(0.012, 0.035, 0.22), mat(0xcfd4d8, { metal: 0.9, rough: 0.25 }));
      blade.position.z = -0.13;
      g.add(blade);
      const tip = new THREE.Mesh(box(0.012, 0.02, 0.04), mat(0xcfd4d8, { metal: 0.9, rough: 0.25 }));
      tip.position.set(0, 0.008, -0.25);
      g.add(tip);
      g.add(new THREE.Mesh(box(0.03, 0.04, 0.11), mat(0x222222, { metal: 0.1 })));
      const guard = new THREE.Mesh(box(0.05, 0.06, 0.015), mat(0x444444));
      guard.position.z = -0.02;
      g.add(guard);
      return g;
    }

    setWeapon(stats) {
      if (this.gun) this.root.remove(this.gun);
      this.gun = G.buildGun(stats);
      this.gun.scale.setScalar(0.82);
      this.stats = stats;
      this.root.add(this.gun);
      this.gun.add(this.flash);
      const ud = this.gun.userData;
      this.flash.position.copy(ud.parts.muzzle.position);
      this.sightY = ud.sightY * 0.82;
      const pistol = stats.look && stats.look.pistol;
      this.hipPos = pistol ? new THREE.Vector3(0.14, -0.15, -0.36) : new THREE.Vector3(0.15, -0.165, -0.42);
      // ADS: nişan hattı kamera merkezine
      const eye = stats.scope ? 0.24 : stats.att && stats.att.optic === 'durbun' ? 0.2 : pistol ? 0.33 : 0.27;
      this.adsPos = new THREE.Vector3(0, -this.sightY, -eye);
      this.anim = { type: 'raise', t: 0, dur: Math.max(0.25, stats.swap * 0.7) };
      this.magBase = ud.parts.mag ? ud.parts.mag.position.clone() : null;
      this.magRot = ud.parts.mag ? ud.parts.mag.rotation.x : 0;
      this.guardBase = ud.parts.guard ? ud.parts.guard.position.z : 0;
    }

    play(type, dur) {
      this.anim = { type, t: 0, dur };
    }

    fire(recV) {
      this.kick += 0.035 + recV * 0.01;
      this.kickRot += 0.03 + recV * 0.02;
      this.kickSide = (Math.random() - 0.5) * 0.02;
      if (!this.stats.flashHidden) {
        this.flash.visible = true;
        this.flash.material.rotation = Math.random() * 6.28;
        const s = this.stats.suppressed ? 0.08 : 0.16 + Math.random() * 0.06;
        this.flash.scale.set(s, s, s);
        this.flashLife = 0.035;
      }
    }

    // ana güncelleme: p = oyuncu durumu
    update(dt, p) {
      if (!this.gun) return;
      const ads = p.adsT;
      this.adsAmount = ads;
      // salınım (fare hareketine gecikme)
      this.sway.x = U.damp(this.sway.x, U.clamp(-p.lookDX * 0.0009, -0.05, 0.05), 10, dt);
      this.sway.y = U.damp(this.sway.y, U.clamp(p.lookDY * 0.0009, -0.05, 0.05), 10, dt);
      // yürüme sallantısı
      const spd = p.hSpeed;
      if (p.grounded && spd > 0.5) this.bobT += dt * (p.sprinting ? 12 : 8.5) * Math.min(1.2, spd / 4.5);
      const bobAmt = (p.sprinting ? 0.022 : 0.009) * Math.min(1, spd / 4.5) * (1 - ads * 0.85);
      const bx = Math.sin(this.bobT) * bobAmt;
      const by = -Math.abs(Math.cos(this.bobT)) * bobAmt;
      // geri tepme toparlanması
      this.kick = U.damp(this.kick, 0, 16, dt);
      this.kickRot = U.damp(this.kickRot, 0, 12, dt);
      this.kickSide = U.damp(this.kickSide, 0, 14, dt);

      const pos = new THREE.Vector3().lerpVectors(this.hipPos, this.adsPos, ads);
      let rx = 0, ry = 0, rz = 0;
      pos.x += bx + this.sway.x * (1 - ads * 0.7) + this.kickSide;
      pos.y += by + this.sway.y * (1 - ads * 0.7);
      pos.z += this.kick * (ads > 0.5 ? 0.6 : 1);
      rx += this.kickRot * (ads > 0.5 ? 0.35 : 1);
      ry += (1 - ads) * 0.04;
      // koşu duruşu
      const sp = p.sprintT;
      if (sp > 0) {
        const tac = p.tacSprint ? 1 : 0;
        pos.x += sp * (tac ? -0.02 : -0.06);
        pos.y += sp * (tac ? -0.02 : -0.04);
        rx += sp * (tac ? 0.9 : 0.25);
        ry += sp * (tac ? 0.2 : 0.65);
        rz += sp * (tac ? -0.3 : 0.15);
        if (tac) pos.y += sp * 0.05;
      }
      // kayma / dalış eğimi
      if (p.slideT > 0) rz += p.slideT * 0.25;
      // eğilme yan yatırma (yüzüstü)
      if (p.prone) rz += 0.08 * (1 - ads);

      // animasyonlar
      let magOff = 0, magVis = true, gunDown = 0, knife = false, itemVis = false, boltT = 0, pumpT = 0;
      const A = this.anim;
      if (A) {
        A.t += dt;
        const k = U.clamp(A.t / A.dur, 0, 1);
        if (A.type === 'raise') {
          gunDown = 1 - k;
        } else if (A.type === 'lower') {
          gunDown = k;
        } else if (A.type === 'reload' || A.type === 'reloadEmpty') {
          const e = A.type === 'reloadEmpty';
          // eğ, şarjörü çıkar, tak, (boşsa) sürgüyü çek, toparla
          const tilt = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
          rz += tilt * 0.55;
          rx += tilt * 0.18;
          pos.y -= tilt * 0.05;
          pos.x -= tilt * 0.03;
          if (k > 0.18 && k < 0.42) magOff = (k - 0.18) / 0.24;
          else if (k >= 0.42 && k < 0.55) { magOff = 1; magVis = false; }
          else if (k >= 0.55 && k < 0.7) magOff = 1 - (k - 0.55) / 0.15;
          if (e && k > 0.72 && k < 0.85) boltT = Math.sin(((k - 0.72) / 0.13) * Math.PI);
        } else if (A.type === 'shell') {
          const s = Math.sin(k * Math.PI);
          rz += s * 0.3;
          rx += s * 0.12;
          pos.y -= s * 0.03;
          itemVis = k < 0.6;
        } else if (A.type === 'pump') {
          pumpT = Math.sin(k * Math.PI);
          rx += pumpT * 0.06;
        } else if (A.type === 'bolt') {
          boltT = Math.sin(k * Math.PI);
          rz += boltT * 0.2;
          rx += boltT * 0.05;
        } else if (A.type === 'melee') {
          knife = true;
          gunDown = Math.min(1, k * 5) * (k < 0.8 ? 1 : (1 - k) * 5);
        } else if (A.type === 'throw') {
          gunDown = Math.sin(k * Math.PI) * 0.9;
          itemVis = k < 0.55;
        } else if (A.type === 'drink' || A.type === 'eat') {
          gunDown = k < 0.85 ? Math.min(1, k * 6) : (1 - k) / 0.15;
          itemVis = true;
        }
        if (A.t >= A.dur) {
          if (A.type === 'lower') this.anim = { type: 'held-down', t: 0, dur: 1e9 };
          else this.anim = null;
        }
        if (A && A.type === 'held-down') gunDown = 1;
      }

      this.gun.position.copy(pos);
      this.gun.position.y -= gunDown * 0.35;
      this.gun.rotation.set(rx - gunDown * 0.6, ry, rz);
      this.gun.visible = !this.hidden && !(this.stats.scope && ads > 0.92);
      const parts = this.gun.userData.parts;
      if (parts.mag && this.magBase) {
        parts.mag.position.copy(this.magBase);
        parts.mag.position.y -= magOff * 0.25;
        parts.mag.position.z += magOff * 0.05;
        parts.mag.visible = magVis && !(this.stats.look && this.stats.look.mag === 'tube');
      }
      if (parts.bolt) parts.bolt.position.z = -0.05 + boltT * 0.08;
      if (parts.slide) parts.slide.position.z = -0.07 + (this.kick > 0.03 ? 0.03 : 0);
      if (parts.guard) parts.guard.position.z = this.guardBase + pumpT * 0.08;

      // eller: sağ kabzada, sol el kundakta (şarjör değişiminde şarjörde)
      const gp = this.gun.position, gr = this.gun.rotation;
      const R = this.arms.right, Lh = this.arms.left;
      const m = new THREE.Matrix4().makeRotationFromEuler(gr);
      const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m).add(gp);
      const pistol = this.stats.look && this.stats.look.pistol;
      R.position.copy(toWorld(0.0, -0.06, 0.06));
      R.rotation.set(gr.x + 0.35, gr.y - 0.25, gr.z);
      let lh;
      if (magOff > 0 && parts.mag) lh = toWorld(-0.02, -0.12 - magOff * 0.2, -0.05);
      else if (pistol) lh = toWorld(-0.03, -0.07, 0.04);
      else lh = toWorld(-0.02, -0.0, -0.24 + pumpT * 0.08);
      Lh.position.copy(lh);
      Lh.rotation.set(gr.x + 0.25, gr.y + 0.45, gr.z);
      R.visible = Lh.visible = this.gun.visible || knife;
      // bıçak
      this.knife.visible = knife && !this.hidden;
      if (knife) {
        const k = U.clamp(A.t / A.dur, 0, 1);
        const sw = Math.sin(U.clamp(k * 1.4, 0, 1) * Math.PI);
        this.knife.position.set(0.12 - sw * 0.22, -0.12 + sw * 0.05, -0.34 - sw * 0.12);
        this.knife.rotation.set(-0.2 - sw * 0.4, 0.6 - sw * 1.4, -0.4 + sw * 0.6);
        R.position.copy(this.knife.position).add(new THREE.Vector3(0.02, -0.03, 0.08));
        R.rotation.copy(this.knife.rotation);
      }
      // el bombası / çay / simit eşyası
      this.item.visible = itemVis && !this.hidden;
      if (itemVis && A) {
        const k = U.clamp(A.t / A.dur, 0, 1);
        if (A.type === 'drink' || A.type === 'eat') {
          const up = Math.sin(U.clamp(k * 1.25, 0, 1) * Math.PI);
          this.item.position.set(-0.02 + up * 0.04, -0.2 + up * 0.14, -0.3 + up * 0.08);
          this.item.rotation.set(A.type === 'drink' ? up * 0.9 : up * 0.3, 0, up * 0.2);
        } else {
          this.item.position.set(-0.12 + k * 0.1, -0.15 + k * 0.1, -0.35);
          this.item.rotation.set(k * 2, 0, 0);
        }
        Lh.position.copy(this.item.position).add(new THREE.Vector3(0.0, -0.05, 0.08));
        Lh.visible = true;
      }
      // namlu alevi
      if (this.flash.visible) {
        this.flashLife -= dt;
        if (this.flashLife <= 0) this.flash.visible = false;
      }
    }

    setItem(kind) {
      while (this.item.children.length) this.item.remove(this.item.children[0]);
      if (kind === 'cay') {
        // ince belli çay bardağı + tabak
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xb2341a, transparent: true, opacity: 0.85, emissive: 0x3a0a00, roughness: 0.15 }));
        glass.position.y = 0.04;
        this.item.add(glass);
        const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x8a2410, transparent: true, opacity: 0.9 }));
        waist.position.y = 0.035;
        this.item.add(waist);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 14), mat(0xe8e2d6, { metal: 0.1, rough: 0.3 }));
        this.item.add(plate);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 4, 16), mat(0xb8862e, { metal: 0.8 }));
        rim.rotation.x = Math.PI / 2;
        this.item.add(rim);
      } else if (kind === 'simit') {
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 14), mat(0xb5722e, { metal: 0, rough: 0.9 }));
        s.rotation.x = Math.PI / 2;
        this.item.add(s);
        const sesame = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0235, 4, 14), new THREE.MeshStandardMaterial({ color: 0xe8cf8a, wireframe: true }));
        sesame.rotation.x = Math.PI / 2;
        this.item.add(sesame);
      } else {
        const gren = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(kind === 'smoke' ? 0x606a60 : kind === 'stun' ? 0x3a5a7a : 0x3d4a2a));
        this.item.add(gren);
        const lever = new THREE.Mesh(box(0.012, 0.05, 0.02), mat(0x777777));
        lever.position.set(0.03, 0.02, 0);
        this.item.add(lever);
      }
    }
  }
  G.ViewModel = ViewModel;
})();
