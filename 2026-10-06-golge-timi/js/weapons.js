'use strict';
// Gölge Timi — birinci şahıs görünümü (sürüm 3, "tatlı"): yuvarlak eldivenli
// (eldiven-pati) eller, takım renkli kollar, silahın tutma noktalarına oturan
// kollar, şarjör/sürgü/pompa/kırma animasyonları, silah inceleme, oyuncak yakın
// dövüş silahları, nefis görünümlü çay ve simit, sevimli bombalar.
(function () {
  const G = window.G;
  const U = G.util;
  const T = G.toy;

  function tmat(key, p) {
    return G.toonMat ? G.toonMat('vm-' + key, p) : new THREE.MeshLambertMaterial(p);
  }
  function vc() {
    return T.vcMat();
  }

  let batGeo = null;
  const _white = new THREE.Color(0xffffff);
  const SHOULDER_R = new THREE.Vector3(0.3, -0.42, 0.3);
  const SHOULDER_L = new THREE.Vector3(-0.28, -0.46, 0.22);
  // kare başına ayırma yapmamak için geçici vektörler
  const _pos = new THREE.Vector3(), _rh = new THREE.Vector3(), _lh = new THREE.Vector3(), _off = new THREE.Vector3(), _ip = new THREE.Vector3(), _hand = new THREE.Vector3();

  // Takım renkleri: [kol, manşet, eldiven]
  const SLEEVE = {
    0: [0x4cc3ff, 0xffd23f, 0xfffaf3],
    1: [0xff6b6b, 0x9b5de5, 0xfff1f8],
    snow: [0xf4f8ff, 0x4cc3ff, 0xfffaf3],
  };

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
      const light = new THREE.HemisphereLight(0xffffff, 0xcdb4ff, 0.5);
      const dir = new THREE.DirectionalLight(0xffffff, 0.72);
      dir.position.set(0.5, 1, 0.6);
      scene.add(light, dir);
      this.light = light;
      this.dirLight = dir;
      this.adsAmount = 0;
      this.hidden = false;
    }

    setLighting(theme) {
      const night = theme && theme.night;
      // toon kademeleri görünsün diye ortam ışığı düşük, güneş belirgin; renkler beyaza yakın tutulur
      this.light.intensity = night ? 0.45 : 0.5;
      this.dirLight.intensity = night ? 0.5 : 0.72;
      this.light.color.setHex(theme ? theme.hemiSky : 0xffffff).lerp(_white, 0.55);
      this.dirLight.color.setHex(theme ? theme.sun : 0xffffff).lerp(_white, 0.4);
    }

    // kol: takım renkli yuvarlak kol + manşet + eldiven-pati (+Z omuza doğru)
    setSleeve(team) {
      if (this.arms) this.root.remove(this.arms.right, this.arms.left);
      const snow = team !== 1 && G.settings && G.settings.operator === 'ayaz';
      const [sc, cc, gc] = SLEEVE[snow ? 'snow' : team === 1 ? 1 : 0];
      const gShade = new THREE.Color(gc).multiplyScalar(0.9).getHex();
      const mkArm = (left) => {
        const a = new THREE.Group();
        const b = new T.Builder();
        b.add(T.capsule(0.043, 0.42, 20), sc, 0, 0, 0.3, 1, 1, 1, Math.PI / 2, 0, 0);
        // şerit süsü ve manşet
        b.add(T.torus(0.044, 0.006, 5, 16), cc, 0, 0, 0.22);
        b.add(T.torus(0.042, 0.013, 6, 16), cc, 0, 0, 0.07);
        // avuç
        b.add(T.sphere(24, 16), gc, 0, 0, -0.005, 0.046, 0.033, 0.055);
        if (left) {
          // sevimli saat: pembe kayış, nane kadran
          b.add(T.torus(0.046, 0.009, 5, 16), 0xff6fa8, 0, 0, 0.115);
          b.add(T.cyl(14), 0xfffaf3, 0, 0.048, 0.115, 0.02, 0.01, 0.02);
          b.add(T.cyl(14), 0x3ddc97, 0, 0.054, 0.115, 0.016, 0.004, 0.016);
        }
        const body = b.mesh(vc());
        body.name = 'palm';
        a.add(body);
        // pati (dört parmak tek parça), iki boğumlu kıvrılır
        const fingers = new THREE.Group();
        fingers.position.set(0, 0.002, -0.045);
        const f = new THREE.Group();
        const fb = new T.Builder();
        fb.add(T.sphere(22, 14), gc, 0, 0, -0.02, 0.045, 0.028, 0.032);
        f.add(fb.mesh(vc()));
        const tip = new THREE.Group();
        tip.position.z = -0.035;
        const tb = new T.Builder();
        tb.add(T.sphere(22, 14), gShade, 0, -0.002, -0.014, 0.042, 0.026, 0.027);
        tip.add(tb.mesh(vc()));
        f.add(tip);
        f.userData.tip = tip;
        fingers.add(f);
        a.add(fingers);
        const thumb = new THREE.Group();
        thumb.position.set(left ? 0.042 : -0.042, 0.004, -0.012);
        const hb = new T.Builder();
        hb.add(T.capsule(0.015, 0.02, 14), gc, 0, 0, -0.02, 1, 1, 1, Math.PI / 2, 0, 0);
        thumb.add(hb.mesh(vc()));
        thumb.rotation.y = left ? 0.5 : -0.5;
        a.add(thumb);
        a.userData = { fingers, thumb };
        return a;
      };
      const right = mkArm(false);
      const left = mkArm(true);
      this.root.add(right, left);
      this.arms = { right, left };
    }

    curl(arm, amount) {
      const fs = arm.userData.fingers.children;
      for (const f of fs) {
        f.rotation.x = -amount * 1.0;
        f.userData.tip.rotation.x = -amount * 1.2;
      }
      arm.userData.thumb.rotation.x = -amount * 0.6;
    }

    placeArm(arm, hand, shoulder, roll) {
      arm.position.copy(hand);
      arm.lookAt(shoulder);
      arm.rotateZ(roll || 0);
    }

    // ---------------- Oyuncak yakın dövüş silahları ----------------
    setMelee(kind) {
      if (this.meleeKind === kind) return;
      this.meleeKind = kind;
      const g = this.melee;
      while (g.children.length) g.remove(g.children[0]);
      const b = new T.Builder();
      const R = Math.PI / 2;
      if (kind === 'pala') {
        b.add(T.rbox(0.014, 0.075, 0.42, 0.006), 0xeeeaff, 0, 0.012, -0.25);
        b.add(T.rbox(0.016, 0.018, 0.4, 0.006), 0x9ad7ff, 0, -0.022, -0.24);
        b.add(T.capsule(0.022, 0.1, 10), 0xe8a85c, 0, 0, 0.005, 1, 1, 1, R, 0, 0);
        b.add(T.torus(0.03, 0.01, 5, 12), 0xffd23f, 0, 0, -0.065);
        b.add(T.sphere(10, 8), 0xff6fa8, 0, 0, 0.07, 0.026);
      } else if (kind === 'sopa') {
        // konik sopa: birim koni-silindiri ölçekleyerek
        if (!batGeo) batGeo = new THREE.CylinderGeometry(0.042, 0.02, 0.66, 14);
        b.add(batGeo, 0xe8a85c, 0, 0, -0.34, 1, 1, 1, R, 0, 0);
        b.add(T.sphere(12, 8), 0xe8a85c, 0, 0, -0.67, 0.042, 0.042, 0.03);
        b.add(T.capsule(0.022, 0.12, 10), 0xff6fa8, 0, 0, 0.02, 1, 1, 1, R, 0, 0);
        b.add(T.sphere(10, 8), 0xffd23f, 0, 0, 0.1, 0.03);
        for (let i = 0; i < 3; i++) b.add(T.torus(0.032 + i * 0.002, 0.006, 5, 14), 0xff6fa8, 0, 0, -0.44 - i * 0.07);
        b.add(T.sphere(8, 6), 0xffd23f, 0.036, 0.012, -0.58, 0.01, 0.014, 0.014);
      } else if (kind === 'kurek') {
        b.add(T.capsule(0.017, 0.58, 10), 0xe8a85c, 0, 0, -0.22, 1, 1, 1, R, 0, 0);
        b.add(T.rbox(0.17, 0.02, 0.19, 0.008), 0x3ddc97, 0, 0, -0.6);
        b.add(T.sphere(12, 8), 0x3ddc97, 0, 0, -0.69, 0.085, 0.01, 0.05);
        b.add(T.rbox(0.1, 0.034, 0.034, 0.014), 0xff6fa8, 0, 0, 0.1);
      } else if (kind === 'katana') {
        b.add(T.rbox(0.008, 0.034, 0.6, 0.004), 0xeeeaff, 0, 0.005, -0.38);
        b.add(T.rbox(0.009, 0.01, 0.58, 0.003), 0xcdb4ff, 0, 0.022, -0.37);
        b.add(T.cyl(16), 0xffd23f, 0, 0, -0.065, 0.045, 0.012, 0.045, R, 0, 0);
        b.add(T.capsule(0.019, 0.18, 10), 0x9b5de5, 0, 0, 0.04, 1, 1, 1, R, 0, 0);
        for (let i = 0; i < 4; i++) b.add(T.sphere(8, 6), 0xff6fa8, 0, 0.016, -0.02 + i * 0.04, 0.012, 0.008, 0.012);
      } else {
        // bıçak
        b.add(T.rbox(0.012, 0.042, 0.2, 0.006), 0xeeeaff, 0, 0.002, -0.14);
        b.add(T.sphere(10, 8), 0xeeeaff, 0, 0.002, -0.24, 0.006, 0.021, 0.03);
        b.add(T.rbox(0.013, 0.008, 0.18, 0.003), 0x9ad7ff, 0, -0.016, -0.14);
        b.add(T.capsule(0.022, 0.08, 10), 0xff8b94, 0, 0, 0.005, 1, 1, 1, R, 0, 0);
        b.add(T.rbox(0.06, 0.06, 0.016, 0.007), 0xffd23f, 0, 0, -0.04);
        b.add(T.sphere(8, 6), 0xffd23f, 0, 0, 0.06, 0.022);
      }
      g.add(b.mesh(vc()));
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
      this.hipPos = pistol ? new THREE.Vector3(0.13, -0.145, -0.4) : k === 'launcher' ? new THREE.Vector3(0.16, -0.2, -0.34) : new THREE.Vector3(0.15, -0.175, -0.42);
      const scoped = stats.scope;
      const optic = stats.att && stats.att.optic;
      // tombul oyuncak gövde ekranı kapatmasın diye göz biraz geride (nişan çizgisi yine ekran ortasında)
      const eye = scoped ? 0.24 : optic === 'prizma' || optic === 'durbun' ? 0.2 : pistol ? 0.44 : k === 'launcher' ? 0.38 : 0.43;
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
      this.squash = 1;
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
      const bobAmt = (p.sprinting ? 0.024 : 0.011) * Math.min(1, spd / 4.5) * (1 - ads * 0.85);
      const bx = Math.sin(this.bobT) * bobAmt;
      // zıplayan (sekme) yürüyüş salınımı
      const by = (Math.abs(Math.sin(this.bobT)) - 0.5) * bobAmt * 1.4;
      const breathe = Math.sin(G.time * 1.6) * 0.003 * (1 - ads * 0.8);
      this.kick = U.damp(this.kick, 0, 16, dt);
      this.kickRot = U.damp(this.kickRot, 0, 12, dt);
      this.kickSide = U.damp(this.kickSide, 0, 14, dt);
      this.slideKick = U.damp(this.slideKick || 0, 0, 30, dt);
      this.squash = U.damp(this.squash || 0, 0, 18, dt);

      const pos = _pos.lerpVectors(this.hipPos, this.adsPos, ads);
      let rx = 0, ry = 0, rz = 0;
      pos.x += bx + this.sway.x * (1 - ads * 0.7) + this.kickSide;
      pos.y += by + breathe + this.sway.y * (1 - ads * 0.7);
      pos.z += this.kick * (ads > 0.5 ? 0.6 : 1);
      rx += this.kickRot * (ads > 0.5 ? 0.35 : 1);
      ry += (1 - ads) * 0.05;
      rz += Math.sin(this.bobT * 0.5) * bobAmt * 1.5;
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
      const rCurl = 0.85, lCurl = 0.7;
      const A = this.anim;
      if (A) {
        A.t += dt;
        const k = U.clamp(A.t / A.dur, 0, 1);
        if (A.type === 'raise') {
          // hafif esneyerek (geri sekmeli) yukarı kalkış
          const e = 1 - k;
          gunDown = e * e - Math.sin(k * Math.PI) * 0.06 * (1 - k);
        } else if (A.type === 'lower') gunDown = k;
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
            // şarjör takılınca küçük "tık" sekmesi
            if (k >= 0.7 && k < 0.8) pos.y += Math.sin(((k - 0.7) / 0.1) * Math.PI) * 0.012;
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
          pos.y += a * 0.04 + Math.abs(Math.sin(k * Math.PI * 4)) * a * 0.008;
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
      // atışta minik "boing" esnemesi
      const sq = this.squash * (ads > 0.5 ? 0.3 : 1);
      gun.scale.set(0.82 * (1 + sq * 0.03), 0.82 * (1 + sq * 0.03), 0.82 * (1 - sq * 0.04));
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
      const rh = P.rightHand.getWorldPosition(_rh);
      let lh;
      if (leftOnMag && P.mag) lh = P.mag.getWorldPosition(_lh).add(_off.set(-0.02, -0.04 - magOff * 0.05, 0.02));
      else lh = P.leftHand.getWorldPosition(_lh);
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
        // vuruşta küçük esneme
        const sqm = 1 + Math.sin(U.clamp(k * 2.2, 0, 1) * Math.PI) * 0.06;
        m.scale.set(sqm, sqm, 1 / sqm);
        m.updateMatrixWorld(true);
        const hand = m.getWorldPosition(_hand);
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
          this.item.position.set(-0.02 + up * 0.04, -0.175 + up * 0.12, -0.31 + up * 0.08);
          this.item.rotation.set(A.type === 'drink' ? up * 0.9 : up * 0.3, 0, up * 0.2);
          // simit yerken mutlu küçük sekme
          if (A.type === 'eat') this.item.position.y += Math.abs(Math.sin(k * Math.PI * 5)) * 0.01 * up;
        } else if (A.type === 'shell') {
          this.item.position.copy(lh);
        } else {
          this.item.position.set(-0.12 + k * 0.1, -0.15 + k * 0.1, -0.35);
          this.item.rotation.set(k * 2, 0, 0);
        }
        this.placeArm(Lh, _ip.copy(this.item.position).add(_off.set(0.0, -0.04, 0.05)), SHOULDER_L, 0.4);
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
      const b = new T.Builder();
      if (kind === 'cay') {
        // ince belli çay bardağı: koyu kehribar çay, beyaz tabak, kırmızı-altın kenar, şeker
        const tea = T.lathe('cay-tea', [[0.0, 0.004], [0.019, 0.004], [0.024, 0.02], [0.018, 0.038], [0.02, 0.05], [0.026, 0.07], [0.0, 0.07]], 16);
        b.add(tea, 0xc8361a, 0, 0, 0);
        b.add(T.cyl(16), 0xe0662a, 0, 0.0705, 0, 0.0255, 0.002, 0.0255);
        // bardak ağzı ve parlama çizgisi: cam olduğu belli olsun
        b.add(T.torus(0.0275, 0.0016, 4, 20), 0xf4fbff, 0, 0.0855, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        b.add(T.rbox(0.004, 0.026, 0.002, 0.0015), 0xffffff, -0.011, 0.062, 0.0225, 1, 1, 1, -0.12, -0.45, 0);
        b.add(T.rbox(0.003, 0.012, 0.002, 0.0012), 0xffffff, -0.009, 0.026, 0.0215, 1, 1, 1, 0, -0.45, 0);
        b.add(T.cyl(18), 0xfffaf3, 0, 0, 0, 0.056, 0.006, 0.056);
        b.add(T.torus(0.052, 0.004, 4, 20), 0xff4f79, 0, 0.003, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        b.add(T.torus(0.044, 0.002, 4, 20), 0xffd23f, 0, 0.0035, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        b.add(T.rbox(0.014, 0.014, 0.014, 0.004), 0xffffff, 0.038, 0.01, 0.012, 1, 1, 1, 0, 0.5, 0);
        b.add(T.rbox(0.004, 0.09, 0.006, 0.0018), 0xeeeaff, 0.012, 0.07, 0, 1, 1, 1, 0, 0, 0.25);
        b.add(T.sphere(8, 6), 0xeeeaff, 0.023, 0.025, 0, 0.007, 0.004, 0.009);
        this.item.add(b.mesh(vc()));
        const glass = new THREE.Mesh(
          T.lathe('cay-glass', [[0.0, 0.006], [0.021, 0.006], [0.026, 0.02], [0.02, 0.038], [0.022, 0.05], [0.029, 0.085], [0.027, 0.086]], 16),
          tmat('cay-glass', { color: 0xe6f8ff, transparent: true, opacity: 0.32, depthWrite: false })
        );
        this.item.add(glass);
        // buhar: iki küçük yumuşak bulut
        const steam = new THREE.Mesh(T.sphere(10, 8), tmat('cay-steam', { color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
        steam.scale.set(0.009, 0.008, 0.009);
        steam.position.set(-0.004, 0.1, 0);
        this.item.add(steam);
        const steam2 = steam.clone();
        steam2.scale.set(0.006, 0.0055, 0.006);
        steam2.position.set(0.007, 0.114, 0.002);
        this.item.add(steam2);
      } else if (kind === 'simit') {
        // altın kahverengi simit ve susamlar
        b.add(T.torus(0.05, 0.021, 10, 22), 0xd9883a, 0, 0, 0, 1, 1, 0.85, Math.PI / 2, 0, 0);
        b.add(T.torus(0.05, 0.018, 8, 22), 0xb8642a, 0, 0.006, 0, 1, 1, 0.7, Math.PI / 2, 0, 0);
        const rnd = U.seeded(77);
        for (let i = 0; i < 46; i++) {
          const a = rnd() * Math.PI * 2;
          const t = (rnd() - 0.5) * 1.9;
          const rr = 0.05 + Math.sin(t) * 0.02;
          const y = 0.005 + Math.cos(t) * 0.018;
          b.add(T.sphere(6, 4), i % 3 ? 0xfff1c9 : 0xffe2a0, Math.cos(a) * rr, y, Math.sin(a) * rr, 0.0045, 0.0022, 0.0028, 0, -a + rnd(), 0);
        }
        this.item.add(b.mesh(vc()));
      } else if (kind === 'shell') {
        b.add(T.capsule(0.011, 0.04, 10), 0xff6b6b, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        b.add(T.cyl(10), 0xffd23f, 0, 0, 0.024, 0.013, 0.014, 0.013, Math.PI / 2, 0, 0);
        this.item.add(b.mesh(vc()));
      } else {
        // sevimli bomba: yuvarlak gövde, kapak, pim halkası, minik yüz
        const col = kind === 'smoke' ? 0xcdb4ff : kind === 'stun' ? 0x9ad7ff : kind === 'semtex' ? 0xc4ee8a : 0x3ddc97;
        const dark = new THREE.Color(col).multiplyScalar(0.8).getHex();
        b.add(T.sphere(14, 10), col, 0, 0, 0, 0.042, 0.042, 0.042);
        b.add(T.torus(0.042, 0.006, 5, 18), dark, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0);
        b.add(T.cyl(12), 0xb9b0e0, 0, 0.044, 0, 0.016, 0.014, 0.016);
        b.add(T.rbox(0.012, 0.05, 0.018, 0.005), 0xb9b0e0, 0.026, 0.03, 0, 1, 1, 1, 0, 0, -0.35);
        b.add(T.torus(0.013, 0.003, 4, 10), 0xffd23f, -0.004, 0.058, 0, 1, 1, 1, 0, Math.PI / 2, 0);
        for (const sx of [-1, 1]) {
          b.add(T.sphere(8, 6), 0x3b2a4a, sx * 0.013, 0.006, -0.039, 0.006, 0.008, 0.004);
          b.add(T.sphere(6, 4), 0xffffff, sx * 0.013 + 0.002, 0.009, -0.042, 0.002);
          b.add(T.sphere(8, 6), 0xff9eb5, sx * 0.024, -0.006, -0.033, 0.007, 0.004, 0.003);
        }
        this.item.add(b.mesh(vc()));
      }
    }
  }
  G.ViewModel = ViewModel;
})();
