'use strict';
// Gölge Timi — birinci şahıs görünümü (sürüm 2): parmaklı eller, silahın tutma
// noktalarına oturan kollar, şarjör/sürgü/pompa/kırma animasyonları, silah
// inceleme, yakın dövüş silahları, çay ve simit.
(function () {
  const G = window.G;
  const U = G.util;

  const gc = {};
  function box(w, h, d) {
    const k = w + ':' + h + ':' + d;
    return gc[k] || (gc[k] = new THREE.BoxGeometry(w, h, d));
  }
  const mc = {};
  function mat(color, o) {
    const k = color + JSON.stringify(o || {});
    if (mc[k]) return mc[k];
    o = o || {};
    const p = { color, roughness: o.rough != null ? o.rough : 0.8, metalness: o.metal != null ? o.metal : 0.05 };
    if (o.map) p.map = o.map;
    return (mc[k] = new THREE.MeshStandardMaterial(p));
  }
  function addTo(parent, geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  const SHOULDER_R = new THREE.Vector3(0.3, -0.42, 0.3);
  const SHOULDER_L = new THREE.Vector3(-0.28, -0.46, 0.22);
  const tmp = new THREE.Vector3();

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
      this.flash = new THREE.Group();
      const fm = new THREE.MeshBasicMaterial({ map: G.spriteTex('flash'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm);
        pl.rotation.set(i === 2 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, 0);
        pl.position.z = i === 2 ? 0 : -0.25;
        if (i < 2) pl.scale.set(0.5, 1, 1);
        this.flash.add(pl);
      }
      this.flash.visible = false;
      this.flashLife = 0;
      this.melee = new THREE.Group();
      this.melee.visible = false;
      this.root.add(this.melee);
      this.meleeKind = null;
      this.setMelee('bicak');
      this.item = new THREE.Group();
      this.item.visible = false;
      this.root.add(this.item);
      this.anim = null;
      this.setSleeve(0);
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
      this.light.intensity = night ? 0.6 : 0.95;
      this.dirLight.intensity = night ? 0.4 : 0.8;
      this.light.color.setHex(theme ? theme.hemiSky : 0xffffff);
      this.dirLight.color.setHex(theme ? theme.sun : 0xffffff);
    }

    // kol: kumaş kol + manşet + parmaklı eldiven (+Z omuza doğru)
    setSleeve(team) {
      if (this.arms) {
        this.root.remove(this.arms.right, this.arms.left);
      }
      const camo = team === 1 ? 'gece' : G.settings && G.settings.operator === 'ayaz' ? 'kis' : 'orman';
      const sleeve = mat(0xffffff, { map: G.camoTexture ? G.camoTexture(camo) : null, rough: 0.95 });
      const cuffM = mat(team === 1 ? 0x1a1c20 : 0x2b3128, { rough: 0.9 });
      const glove = mat(0x1d1f1e, { rough: 0.85 });
      const knuckle = mat(0x2a2c2a, { rough: 0.7 });
      const mkArm = (left) => {
        const a = new THREE.Group();
        const s = addTo(a, box(0.082, 0.082, 0.44), sleeve, 0, 0, 0.27);
        s.castShadow = false;
        addTo(a, box(0.088, 0.088, 0.06), cuffM, 0, 0, 0.05);
        const palm = addTo(a, box(0.08, 0.045, 0.09), glove, 0, 0, -0.02);
        palm.name = 'palm';
        const fingers = new THREE.Group();
        fingers.position.set(0, 0.0, -0.065);
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Group();
          f.position.set(-0.03 + i * 0.02, 0, 0);
          addTo(f, box(0.017, 0.018, 0.04), glove, 0, 0, -0.02);
          addTo(f, box(0.018, 0.019, 0.006), knuckle, 0, 0.002, -0.002);
          const tip = new THREE.Group();
          tip.position.z = -0.04;
          addTo(tip, box(0.016, 0.017, 0.03), glove, 0, 0, -0.015);
          f.add(tip);
          f.userData.tip = tip;
          fingers.add(f);
        }
        a.add(fingers);
        const thumb = new THREE.Group();
        thumb.position.set(left ? 0.045 : -0.045, 0.0, -0.02);
        addTo(thumb, box(0.018, 0.018, 0.05), glove, 0, 0, -0.025);
        thumb.rotation.y = left ? 0.5 : -0.5;
        a.add(thumb);
        a.userData = { fingers, thumb };
        return a;
      };
      const right = mkArm(false);
      const left = mkArm(true);
      const watch = addTo(left, box(0.104, 0.03, 0.045), mat(0x101010), 0, 0.03, 0.09);
      watch.castShadow = false;
      addTo(left, box(0.045, 0.005, 0.034), new THREE.MeshBasicMaterial({ color: 0x55ffaa }), 0, 0.047, 0.09);
      this.root.add(right, left);
      this.arms = { right, left };
    }

    curl(arm, amount) {
      const fs = arm.userData.fingers.children;
      for (const f of fs) {
        f.rotation.x = -amount * 1.2;
        f.userData.tip.rotation.x = -amount * 1.3;
      }
      arm.userData.thumb.rotation.x = -amount * 0.6;
    }

    placeArm(arm, hand, shoulder, roll) {
      arm.position.copy(hand);
      arm.lookAt(shoulder);
      arm.rotateZ(roll || 0);
    }

    // ---------------- Yakın dövüş silahları ----------------
    setMelee(kind) {
      if (this.meleeKind === kind) return;
      this.meleeKind = kind;
      const g = this.melee;
      while (g.children.length) g.remove(g.children[0]);
      const steel = mat(0xcfd4d8, { metal: 0.9, rough: 0.25 });
      const dark = mat(0x222222, { metal: 0.2 });
      const wood = mat(0x7a5232, { rough: 0.8 });
      if (kind === 'pala') {
        addTo(g, box(0.008, 0.06, 0.42), steel, 0, 0.01, -0.25);
        addTo(g, box(0.03, 0.04, 0.13), wood, 0, 0, 0);
        addTo(g, box(0.05, 0.05, 0.012), dark, 0, 0, -0.07);
      } else if (kind === 'sopa') {
        const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.018, 0.75, 10).rotateX(Math.PI / 2), mat(0xc49a5a, { rough: 0.6 }));
        bat.position.z = -0.32;
        g.add(bat);
        addTo(g, box(0.04, 0.04, 0.12), dark, 0, 0, 0.02);
        for (let i = 0; i < 4; i++) addTo(g, box(0.006, 0.004, 0.004), mat(0x444444), 0.03, 0.01 * i, -0.45 - i * 0.04);
      } else if (kind === 'kurek') {
        addTo(g, box(0.03, 0.03, 0.6), wood, 0, 0, -0.22);
        addTo(g, box(0.16, 0.012, 0.18), mat(0x4a5a3a, { metal: 0.6, rough: 0.5 }), 0, 0, -0.6);
        addTo(g, box(0.08, 0.03, 0.03), dark, 0, 0, 0.1);
      } else if (kind === 'katana') {
        addTo(g, box(0.006, 0.03, 0.62), steel, 0, 0.005, -0.38);
        addTo(g, box(0.07, 0.07, 0.01), mat(0xb08a3a, { metal: 0.8, rough: 0.3 }), 0, 0, -0.06);
        addTo(g, box(0.03, 0.032, 0.2), mat(0x1a1a2a), 0, 0, 0.04);
        for (let i = 0; i < 5; i++) addTo(g, box(0.032, 0.034, 0.008), mat(0xb0b0c0), 0, 0, -0.03 + i * 0.035);
      } else {
        addTo(g, box(0.012, 0.035, 0.22), steel, 0, 0, -0.13);
        addTo(g, box(0.012, 0.02, 0.04), steel, 0, 0.008, -0.25);
        addTo(g, box(0.03, 0.04, 0.11), dark, 0, 0, 0);
        addTo(g, box(0.05, 0.06, 0.015), mat(0x444444), 0, 0, -0.02);
      }
    }

    setWeapon(stats) {
      if (this.gun) this.root.remove(this.gun);
      this.gun = G.buildGun(stats);
      this.gun.scale.setScalar(0.82);
      this.stats = stats;
      this.root.add(this.gun);
      const ud = this.gun.userData;
      ud.parts.muzzle.add(this.flash);
      this.flash.position.set(0, 0, 0);
      this.sightY = ud.sightY * 0.82;
      const pistol = ud.isPistol;
      const k = stats.look.kind;
      this.hipPos = pistol ? new THREE.Vector3(0.13, -0.15, -0.36) : k === 'launcher' ? new THREE.Vector3(0.16, -0.19, -0.34) : new THREE.Vector3(0.15, -0.165, -0.42);
      const scoped = stats.scope;
      const optic = stats.att && stats.att.optic;
      const eye = scoped ? 0.24 : optic === 'prizma' || optic === 'durbun' ? 0.2 : pistol ? 0.33 : 0.28;
      this.adsPos = new THREE.Vector3(0, -this.sightY, -eye);
      this.anim = { type: 'raise', t: 0, dur: Math.max(0.25, stats.swap * 0.7) };
      const P = ud.parts;
      this.magBase = P.mag ? P.mag.position.clone() : null;
      this.guardBase = P.guard ? P.guard.position.z : 0;
      this.slideBase = P.slide ? P.slide.position.z : 0;
      this.boltBase = P.bolt ? P.bolt.position.z : 0;
    }

    play(type, dur) {
      this.anim = { type, t: 0, dur };
    }

    fire(recV) {
      const k = this.stats.look.kind;
      const heavy = k === 'shotgun' || k === 'double' || k === 'auto-shotgun' || k === 'sniper' || k === 'launcher' || k === 'gl';
      this.kick += (heavy ? 0.06 : 0.03) + recV * 0.008;
      this.kickRot += (heavy ? 0.08 : 0.025) + recV * 0.015;
      this.kickSide = (Math.random() - 0.5) * 0.02;
      if (!this.stats.flashHidden && !this.stats.projectile) {
        this.flash.visible = true;
        this.flash.rotation.z = Math.random() * 6.28;
        const s = this.stats.suppressed ? 0.06 : (heavy ? 0.22 : 0.14) + Math.random() * 0.05;
        this.flash.scale.set(s, s, s * 1.4);
        this.flashLife = 0.04;
      }
      if (this.gun && this.gun.userData.parts.slide) this.slideKick = 1;
    }

    // ---------------- Ana güncelleme ----------------
    update(dt, p) {
      if (!this.gun) return;
      const ads = p.adsT;
      this.adsAmount = ads;
      this.sway.x = U.damp(this.sway.x, U.clamp(-p.lookDX * 0.0009, -0.05, 0.05), 10, dt);
      this.sway.y = U.damp(this.sway.y, U.clamp(p.lookDY * 0.0009, -0.05, 0.05), 10, dt);
      const spd = p.hSpeed;
      if (p.grounded && spd > 0.5) this.bobT += dt * (p.sprinting ? 12 : 8.5) * Math.min(1.2, spd / 4.5);
      const bobAmt = (p.sprinting ? 0.022 : 0.009) * Math.min(1, spd / 4.5) * (1 - ads * 0.85);
      const bx = Math.sin(this.bobT) * bobAmt;
      const by = -Math.abs(Math.cos(this.bobT)) * bobAmt;
      const breathe = Math.sin(G.time * 1.6) * 0.0025 * (1 - ads * 0.8);
      this.kick = U.damp(this.kick, 0, 16, dt);
      this.kickRot = U.damp(this.kickRot, 0, 12, dt);
      this.kickSide = U.damp(this.kickSide, 0, 14, dt);
      this.slideKick = U.damp(this.slideKick || 0, 0, 30, dt);

      const pos = new THREE.Vector3().lerpVectors(this.hipPos, this.adsPos, ads);
      let rx = 0, ry = 0, rz = 0;
      pos.x += bx + this.sway.x * (1 - ads * 0.7) + this.kickSide;
      pos.y += by + breathe + this.sway.y * (1 - ads * 0.7);
      pos.z += this.kick * (ads > 0.5 ? 0.6 : 1);
      rx += this.kickRot * (ads > 0.5 ? 0.35 : 1);
      ry += (1 - ads) * 0.05;
      const sp = p.sprintT;
      if (sp > 0) {
        const tac = p.tacSprint ? 1 : 0;
        pos.x += sp * (tac ? -0.02 : -0.06);
        pos.y += sp * (tac ? 0.03 : -0.04);
        rx += sp * (tac ? 0.95 : 0.25);
        ry += sp * (tac ? 0.2 : 0.65);
        rz += sp * (tac ? -0.35 : 0.15);
      }
      if (p.slideT > 0) rz += p.slideT * 0.25;
      if (p.prone) rz += 0.08 * (1 - ads);

      let magOff = 0, magVis = true, gunDown = 0, meleeOn = false, itemVis = false, boltT = 0, pumpT = 0, breakT = 0, leftOnMag = false;
      let rCurl = 0.85, lCurl = 0.7;
      const A = this.anim;
      if (A) {
        A.t += dt;
        const k = U.clamp(A.t / A.dur, 0, 1);
        if (A.type === 'raise') gunDown = 1 - k;
        else if (A.type === 'lower') gunDown = k;
        else if (A.type === 'reload' || A.type === 'reloadEmpty') {
          const e = A.type === 'reloadEmpty';
          const tilt = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
          const kind = this.stats.look.kind;
          if (kind === 'double') {
            breakT = tilt;
            rx -= tilt * 0.25;
            pos.y -= tilt * 0.04;
            magVis = k > 0.45 && k < 0.8;
            leftOnMag = k > 0.3 && k < 0.75;
          } else if (kind === 'revolver' || kind === 'gl') {
            rz += tilt * 0.7;
            pos.x -= tilt * 0.05;
            leftOnMag = k > 0.2 && k < 0.8;
          } else {
            rz += tilt * 0.55;
            rx += tilt * 0.18;
            pos.y -= tilt * 0.05;
            pos.x -= tilt * 0.03;
            if (k > 0.18 && k < 0.42) magOff = (k - 0.18) / 0.24;
            else if (k >= 0.42 && k < 0.55) {
              magOff = 1;
              magVis = false;
            } else if (k >= 0.55 && k < 0.7) magOff = 1 - (k - 0.55) / 0.15;
            leftOnMag = k > 0.15 && k < 0.72;
          }
          if (e && k > 0.72 && k < 0.85) boltT = Math.sin(((k - 0.72) / 0.13) * Math.PI);
        } else if (A.type === 'shell') {
          const s = Math.sin(k * Math.PI);
          rz += s * 0.3;
          rx += s * 0.12;
          pos.y -= s * 0.03;
          itemVis = k < 0.6;
          leftOnMag = true;
        } else if (A.type === 'pump') {
          pumpT = Math.sin(k * Math.PI);
          rx += pumpT * 0.06;
        } else if (A.type === 'bolt') {
          boltT = Math.sin(k * Math.PI);
          rz += boltT * 0.2;
          rx += boltT * 0.05;
        } else if (A.type === 'melee') {
          meleeOn = true;
          gunDown = Math.min(1, k * 5) * (k < 0.8 ? 1 : (1 - k) * 5);
        } else if (A.type === 'throw') {
          gunDown = Math.sin(k * Math.PI) * 0.9;
          itemVis = k < 0.55;
        } else if (A.type === 'drink' || A.type === 'eat') {
          gunDown = k < 0.85 ? Math.min(1, k * 6) : (1 - k) / 0.15;
          itemVis = true;
        } else if (A.type === 'inspect') {
          const a = Math.sin(Math.min(1, k * 1.15) * Math.PI);
          const side = k < 0.5 ? 1 : -1;
          ry += a * 0.9 * side;
          rz += a * 0.45 * side;
          rx -= a * 0.15;
          pos.x -= a * 0.08;
          pos.y += a * 0.04;
          pos.z += a * 0.06;
          if (k > 0.35 && k < 0.6) boltT = Math.sin(((k - 0.35) / 0.25) * Math.PI);
        }
        if (A.t >= A.dur) {
          if (A.type === 'lower') this.anim = { type: 'held-down', t: 0, dur: 1e9 };
          else this.anim = null;
        }
        if (A && A.type === 'held-down') gunDown = 1;
      }

      const gun = this.gun;
      gun.position.copy(pos);
      gun.position.y -= gunDown * 0.35;
      gun.rotation.set(rx - gunDown * 0.6, ry, rz);
      gun.visible = !this.hidden && !(this.stats.scope && ads > 0.92);
      const P = gun.userData.parts;
      const kind = this.stats.look.kind;
      const loaded = p.weapon ? p.weapon.ammo > 0 : true;
      if (P.mag && this.magBase) {
        P.mag.position.copy(this.magBase);
        P.mag.position.y -= magOff * 0.25;
        P.mag.position.z += magOff * 0.05;
        let vis = magVis;
        if (kind === 'crossbow' || kind === 'launcher') vis = (loaded && !(p.reload && p.reload.t < p.reload.dur * 0.5)) || (p.reload && p.reload.t > p.reload.dur * 0.5);
        if (kind === 'double') vis = !magVis ? false : breakT > 0.5;
        P.mag.visible = vis;
        if (kind === 'revolver' || kind === 'gl') P.mag.rotation.z += dt * (A && A.type === 'reload' ? 6 : 0);
      }
      if (P.bolt) P.bolt.position.z = this.boltBase + boltT * 0.08;
      if (P.slide) P.slide.position.z = this.slideBase + (this.slideKick || 0) * 0.03 + (loaded ? 0 : 0.03);
      if (P.guard) {
        if (kind === 'double') P.guard.rotation.x = 0;
        else P.guard.position.z = this.guardBase + pumpT * 0.08;
      }
      if (kind === 'double') gun.rotation.x -= breakT * 0.3;
      if (P.string) P.string.position.z = -(0.32 - (loaded ? 0.14 : 0));

      // eller: tutma noktalarına
      gun.updateMatrixWorld(true);
      const R = this.arms.right, Lh = this.arms.left;
      const rh = P.rightHand.getWorldPosition(new THREE.Vector3());
      let lh;
      if (leftOnMag && P.mag) lh = P.mag.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-0.02, -0.04 - magOff * 0.05, 0.02));
      else lh = P.leftHand.getWorldPosition(new THREE.Vector3());
      if (pumpT > 0) lh.z += pumpT * 0.06;
      this.placeArm(R, rh, SHOULDER_R, -0.2 + rz * 0.5);
      this.placeArm(Lh, lh, SHOULDER_L, 0.6 + rz * 0.3);
      this.curl(R, rCurl);
      this.curl(Lh, leftOnMag ? 0.5 : lCurl);
      R.visible = Lh.visible = !this.hidden && (gun.visible || meleeOn || itemVis);

      // yakın dövüş
      this.melee.visible = meleeOn && !this.hidden;
      if (meleeOn) {
        const k = U.clamp(A.t / A.dur, 0, 1);
        const sw = Math.sin(U.clamp(k * 1.4, 0, 1) * Math.PI);
        const m = this.melee;
        const mk = this.meleeKind;
        if (mk === 'bicak') {
          m.position.set(0.12 - sw * 0.2, -0.12 + sw * 0.05, -0.34 - sw * 0.14);
          m.rotation.set(-0.2 - sw * 0.4, 0.6 - sw * 1.4, -0.4 + sw * 0.6);
        } else if (mk === 'kurek') {
          m.position.set(0.1 - sw * 0.08, -0.05 + sw * 0.15 - (k > 0.5 ? sw * 0.3 : 0), -0.3 - sw * 0.1);
          m.rotation.set(0.6 - sw * 1.8, 0.2, -0.2);
        } else if (mk === 'sopa') {
          m.position.set(0.25 - sw * 0.45, -0.1 + sw * 0.05, -0.3);
          m.rotation.set(-0.2, 1.2 - sw * 2.6, -0.3 + sw * 0.4);
        } else {
          m.position.set(0.22 - sw * 0.42, -0.08 + sw * 0.06, -0.32 - sw * 0.05);
          m.rotation.set(-0.3, 1.0 - sw * 2.3, -0.8 + sw * 0.9);
        }
        m.updateMatrixWorld(true);
        const hand = m.getWorldPosition(new THREE.Vector3());
        this.placeArm(R, hand, SHOULDER_R, 0);
        this.curl(R, 1);
        R.visible = true;
      }
      // eşya
      this.item.visible = itemVis && !this.hidden;
      if (itemVis && A) {
        const k = U.clamp(A.t / A.dur, 0, 1);
        if (A.type === 'drink' || A.type === 'eat') {
          const up = Math.sin(U.clamp(k * 1.25, 0, 1) * Math.PI);
          this.item.position.set(-0.02 + up * 0.04, -0.2 + up * 0.14, -0.3 + up * 0.08);
          this.item.rotation.set(A.type === 'drink' ? up * 0.9 : up * 0.3, 0, up * 0.2);
        } else if (A.type === 'shell') {
          this.item.position.copy(lh);
        } else {
          this.item.position.set(-0.12 + k * 0.1, -0.15 + k * 0.1, -0.35);
          this.item.rotation.set(k * 2, 0, 0);
        }
        this.placeArm(Lh, this.item.position.clone().add(new THREE.Vector3(0.0, -0.04, 0.05)), SHOULDER_L, 0.4);
        this.curl(Lh, 0.8);
        Lh.visible = true;
      }
      if (this.flash.visible) {
        this.flashLife -= dt;
        if (this.flashLife <= 0) this.flash.visible = false;
      }
    }

    setItem(kind) {
      while (this.item.children.length) this.item.remove(this.item.children[0]);
      if (kind === 'cay') {
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
        const spoon = addTo(this.item, box(0.004, 0.09, 0.006), mat(0xc0c0c0, { metal: 0.9, rough: 0.2 }), 0.012, 0.07, 0);
        spoon.rotation.z = 0.25;
      } else if (kind === 'simit') {
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 14), mat(0xb5722e, { rough: 0.9 }));
        s.rotation.x = Math.PI / 2;
        this.item.add(s);
        const sesame = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0235, 4, 14), new THREE.MeshStandardMaterial({ color: 0xe8cf8a, wireframe: true }));
        sesame.rotation.x = Math.PI / 2;
        this.item.add(sesame);
      } else if (kind === 'shell') {
        addTo(this.item, new THREE.CylinderGeometry(0.011, 0.011, 0.06, 8).rotateX(Math.PI / 2), mat(0xb02020), 0, 0, 0);
      } else {
        const col = kind === 'smoke' ? 0x606a60 : kind === 'stun' ? 0x3a5a7a : kind === 'semtex' ? 0x8a8f50 : 0x3d4a2a;
        addTo(this.item, new THREE.SphereGeometry(0.04, 8, 6), mat(col, { metal: 0.3, rough: 0.6 }), 0, 0, 0);
        addTo(this.item, box(0.012, 0.05, 0.02), mat(0x777777, { metal: 0.7 }), 0.03, 0.02, 0);
        addTo(this.item, new THREE.TorusGeometry(0.012, 0.003, 4, 8), mat(0xaaaaaa, { metal: 0.9 }), 0.0, 0.05, 0);
      }
    }
  }
  G.ViewModel = ViewModel;
})();
