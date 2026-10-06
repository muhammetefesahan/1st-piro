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
    0: { uniform: 'orman', vest: 0x3a4430, vest2: 0x2e3626, accent: 0x4cc3ff, helmet: 0x3e4a34, pants: 'orman' },
    1: { uniform: 'gece', vest: 0x1e1f24, vest2: 0x2a2b30, accent: 0xff4d3d, helmet: 0x26272c, pants: 'gece' },
    2: { uniform: 'col', vest: 0x6a5a40, vest2: 0x58492f, accent: 0xffc23a, helmet: 0x7a6a4a, pants: 'col' },
  };
  G.TEAM_LOOK = TEAM_LOOK;
  G.TEAM_NAMES = ['Gölge Timi', 'Kızıl Pençe'];

  const tm = {};
  function tmat(camo, tint) {
    const k = camo + ':' + tint;
    if (tm[k]) return tm[k];
    const params = { color: tint != null ? tint : 0xffffff, roughness: 0.95, metalness: 0.0, map: G.camoTexture(camo) };
    return (tm[k] = G.settings.quality === 'dusuk' ? new THREE.MeshLambertMaterial(params) : new THREE.MeshStandardMaterial(params));
  }

  const DOWN = new THREE.Vector3(0, -1, 0);
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  // İki kemikli kol IK'sı (gövde uzayında)
  function solveArm(arm, elbow, S, T, side, a, b) {
    const D = _v1.copy(T).sub(S);
    let d = D.length();
    const dir = D.normalize();
    d = U.clamp(d, 0.05, a + b - 0.002);
    const cosA = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const hint = _v2.set(side * 0.55, -1, 0.4).normalize();
    const perp = hint.sub(_v3.copy(dir).multiplyScalar(hint.dot(dir))).normalize();
    const u = _v3.copy(dir).multiplyScalar(cosA).addScaledVector(perp, sinA).normalize();
    _q1.setFromUnitVectors(DOWN, u);
    arm.quaternion.copy(_q1);
    const E = _v2.copy(S).addScaledVector(u, a);
    const v = E.sub(T).multiplyScalar(-1).normalize();
    _q2.setFromUnitVectors(DOWN, v);
    elbow.quaternion.copy(_q1).invert().multiply(_q2);
  }

  // ------------------------------------------------------------------
  // Asker / operatör / zombi modeli
  // ------------------------------------------------------------------
  G.makeHumanoid = function (o) {
    const zombie = o.kind === 'zombie';
    const team = o.look != null ? o.look : 0;
    const TL = TEAM_LOOK[team] || TEAM_LOOK[0];
    const op = !zombie && team === 0 && o.operator ? G.OPERATORS[o.operator] : null;
    const zv = zombie ? o.variant || U.pick(['sivil', 'sivil', 'bilim', 'asker', 'hazmat']) : null;
    const skin = zombie ? U.pick([0x6f8a62, 0x7d8f6a, 0x667a5e, 0x8a8f72, 0x7a6e5a]) : op ? op.skin : U.pick([0xd8a47f, 0xc68a62, 0xa8714d, 0xe0b48f]);
    const skinM = mat(skin);
    const dark = mat(0x161718);
    const glove = mat(zombie ? skin : 0x1d1f1e);
    let uni, pants, vestM, vest2M;
    if (zombie) {
      const shirtCol = { sivil: U.pick([0x5a4a3a, 0x3e4a5a, 0x6a2e2a, 0x8a8a80]), bilim: 0xd8d8d0, asker: 0x4a5236, hazmat: 0xc8b020 }[zv];
      uni = zv === 'asker' ? tmat('orman', 0x9a9a90) : mat(shirtCol);
      pants = zv === 'hazmat' ? mat(0xc8b020) : zv === 'asker' ? tmat('orman', 0x9a9a90) : mat(U.pick([0x2e3442, 0x3d3a33, 0x4a4036]));
    } else {
      const camo = op && op.snow ? 'kis' : TL.uniform;
      uni = tmat(camo, team === 1 ? 0xb0b0b8 : 0xe0e0d8);
      pants = uni;
      vestM = mat(op && op.snow ? 0xd8dce0 : TL.vest);
      vest2M = mat(op && op.snow ? 0xb8bec4 : TL.vest2);
    }
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    root.add(hips);

    // bacaklar
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.name = side < 0 ? 'legL' : 'legR';
      leg.position.set(side * 0.105, 0, 0);
      add(leg, box(0.17, 0.48, 0.2), pants, 0, -0.24, 0);
      if (!zombie) add(leg, box(0.08, 0.12, 0.05), vest2M, side * 0.07, -0.2, -0.04);
      const knee = new THREE.Group();
      knee.name = 'knee';
      knee.position.y = -0.47;
      add(knee, box(0.15, 0.4, 0.17), pants, 0, -0.2, 0);
      if (!zombie) add(knee, box(0.14, 0.1, 0.05), mat(0x222420), 0, -0.04, -0.1);
      add(knee, box(0.17, 0.11, 0.27), mat(zombie ? 0x2a2420 : 0x24221e), 0, -0.42, -0.04);
      leg.add(knee);
      hips.add(leg);
      legs.push({ leg, knee });
    }
    // gövde
    const torso = new THREE.Group();
    torso.name = 'torso';
    hips.add(torso);
    add(torso, box(0.38, 0.28, 0.23), uni, 0, 0.14, 0);
    add(torso, box(0.44, 0.3, 0.26), uni, 0, 0.43, 0);
    if (!zombie) {
      add(torso, box(0.47, 0.34, 0.31), vestM, 0, 0.38, 0);
      for (let i = 0; i < 3; i++) add(torso, box(0.1, 0.12, 0.06), vest2M, -0.12 + i * 0.12, 0.27, -0.18);
      add(torso, box(0.42, 0.06, 0.27), dark, 0, 0.02, 0);
      add(torso, box(0.06, 0.12, 0.05), dark, -0.17, 0.5, -0.17);
      add(torso, box(0.012, 0.28, 0.012), dark, -0.19, 0.72, 0.1);
      add(torso, box(0.34, 0.36, 0.15), vest2M, 0, 0.38, 0.22);
      add(torso, box(0.12, 0.08, 0.06), vestM, 0.12, 0.08, 0.13);
      if (op && op.thermos) {
        add(torso, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), mat(0xb8862e, { emissive: 0x201000 }), 0.21, 0.38, 0.22);
        add(torso, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), mat(0x222222), 0.21, 0.52, 0.22);
      }
      if (team === 1 && Math.random() < 0.5) add(torso, box(0.32, 0.08, 0.3), mat(0x8a1a14), 0, 0.6, 0);
    } else {
      if (zv === 'bilim') add(torso, box(0.47, 0.8, 0.29), mat(0xdedcd4), 0, 0.2, 0);
      if (Math.random() < 0.45) {
        add(torso, box(0.18, 0.16, 0.02), mat(0x5a0f0f), 0.06, 0.38, -0.135);
        for (let i = 0; i < 3; i++) add(torso, box(0.16, 0.02, 0.022), mat(0xd8cfb8), 0.06, 0.33 + i * 0.045, -0.14);
      }
      if (zv === 'asker') add(torso, box(0.47, 0.3, 0.3), mat(0x3a4430), 0, 0.4, 0);
    }
    // yaka fotoğrafı
    if (o.photoTex) {
      const frame = add(torso, box(0.13, 0.15, 0.012), mat(0xc9a14a, { emissive: 0x2a1a00 }), 0.12, 0.47, -0.162);
      frame.castShadow = false;
      const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.13), new THREE.MeshBasicMaterial({ map: o.photoTex }));
      ph.name = 'photo';
      ph.position.set(0.12, 0.47, -0.17);
      ph.rotation.y = Math.PI;
      torso.add(ph);
    }
    // baş
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 0.58;
    torso.add(head);
    add(head, box(0.12, 0.08, 0.12), skinM, 0, 0.0, 0);
    add(head, box(0.22, 0.25, 0.23), skinM, 0, 0.15, 0);
    const headType = zombie ? (zv === 'asker' ? 'helmet' : zv === 'hazmat' ? 'hazmat' : 'none') : op ? op.head : U.pick(G.ENEMY_LOOKS);
    const face = zombie ? (zv === 'hazmat' ? 'gasmask' : 'none') : op ? op.face : headType === 'gasmask' ? 'gasmask' : Math.random() < 0.4 ? 'balaclava' : 'none';
    if (face === 'balaclava') {
      add(head, box(0.235, 0.265, 0.245), mat(team === 1 ? 0x141416 : 0x2a3024), 0, 0.15, 0);
      add(head, box(0.17, 0.045, 0.012), skinM, 0, 0.17, -0.122);
    }
    const eyeM = zombie ? new THREE.MeshBasicMaterial({ color: o.eyeColor || 0xffa020 }) : mat(0x1a1410);
    add(head, box(0.04, 0.022, 0.012), eyeM, -0.05, 0.17, -0.12);
    add(head, box(0.04, 0.022, 0.012), eyeM, 0.05, 0.17, -0.12);
    if (zombie) {
      add(head, box(0.12, 0.05, 0.03), mat(0x3a0a0a), 0, 0.05, -0.11);
      if (headType === 'none') add(head, box(0.2, 0.05, 0.2), mat(0x2a2a20), 0.02, 0.28, 0.02);
    } else if (face !== 'balaclava') {
      add(head, box(0.04, 0.05, 0.03), mat(skin - 0x101010 > 0 ? skin - 0x101010 : skin), 0, 0.13, -0.125);
    }
    if (op && op.beard) add(head, box(0.21, 0.1, 0.07), mat(op.beard), 0, 0.06, -0.09);
    if (op && op.mustache) add(head, box(0.11, 0.025, 0.02), mat(op.mustache), 0, 0.095, -0.12);
    if (op && op.female) {
      add(head, box(0.235, 0.06, 0.245), mat(op.hair), 0, 0.27, 0.0);
      add(head, box(0.08, 0.18, 0.07), mat(op.hair), 0, 0.12, 0.15);
    }
    if (face === 'goggles') {
      add(head, box(0.24, 0.03, 0.245), dark, 0, 0.2, 0);
      for (const x of [-0.05, 0.05]) add(head, box(0.08, 0.045, 0.02), mat(0x3a5a6a, { emissive: 0x0a1a20 }), x, 0.185, -0.127);
    }
    if (face === 'gasmask') {
      add(head, box(0.2, 0.15, 0.06), dark, 0, 0.12, -0.12);
      for (const x of [-0.075, 0.075]) add(head, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8).rotateX(Math.PI / 2), mat(0x2a2a2a), x, 0.07, -0.16);
      for (const x of [-0.05, 0.05]) add(head, box(0.05, 0.04, 0.012), new THREE.MeshBasicMaterial({ color: team === 1 ? 0xff3a20 : 0x60a0a0 }), x, 0.18, -0.152);
    }
    const helmetM = mat(op && op.snow ? 0xe0e4e8 : zombie ? 0x4a5236 : TL.helmet);
    if (headType === 'helmet' || headType === 'nvg') {
      add(head, box(0.27, 0.12, 0.29), helmetM, 0, 0.3, 0.01);
      add(head, box(0.29, 0.03, 0.31), helmetM, 0, 0.245, 0.01);
      add(head, box(0.06, 0.04, 0.03), dark, 0, 0.31, -0.15);
      add(head, box(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: TL.accent }), 0, 0.37, 0.12);
      add(head, box(0.04, 0.08, 0.09), dark, 0.14, 0.19, 0);
      if (headType === 'nvg') {
        for (const x of [-0.035, 0.035]) add(head, new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8).rotateX(Math.PI / 2), dark, x, 0.2, -0.16);
        for (const x of [-0.035, 0.035]) add(head, box(0.03, 0.03, 0.005), new THREE.MeshBasicMaterial({ color: 0x40ff60 }), x, 0.2, -0.197);
      }
    } else if (headType === 'cap') {
      const capM = mat(team === 1 ? 0x1a1a1e : 0x5a5a3a);
      add(head, box(0.24, 0.07, 0.25), capM, 0, 0.29, 0);
      add(head, box(0.2, 0.015, 0.1), capM, 0, 0.255, -0.16);
      for (const x of [-0.13, 0.13]) add(head, box(0.04, 0.08, 0.08), dark, x, 0.17, 0);
    } else if (headType === 'beanie') {
      add(head, box(0.245, 0.1, 0.25), mat(0x6a2a2a), 0, 0.3, 0);
      add(head, box(0.25, 0.035, 0.255), mat(0x5a2222), 0, 0.255, 0);
    } else if (headType === 'beret') {
      const b = add(head, box(0.26, 0.05, 0.27), mat(0x6a1a2a), 0.02, 0.3, 0);
      b.rotation.z = 0.15;
      add(head, box(0.03, 0.03, 0.01), mat(0xd4a52a, { emissive: 0x2a1a00 }), -0.08, 0.3, -0.136);
    } else if (headType === 'gasmask' && !zombie) {
      add(head, box(0.245, 0.08, 0.25), mat(0x1a1a1e), 0, 0.3, 0);
    } else if (headType === 'hazmat') {
      add(head, box(0.27, 0.32, 0.28), mat(0xc8b020), 0, 0.17, 0.01);
      add(head, box(0.18, 0.1, 0.02), mat(0x3a4a4a, { emissive: 0x0a1a1a }), 0, 0.18, -0.13);
    }
    // kollar
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = side < 0 ? 'armL' : 'armR';
      arm.position.set(side * 0.29, 0.52, 0);
      add(arm, box(0.13, 0.3, 0.14), uni, 0, -0.15, 0);
      if (!zombie) {
        const patch = add(arm, box(0.135, 0.07, 0.1), mat(TL.accent, { emissive: TL.accent, ei: 0.25 }), 0, -0.07, 0);
        patch.castShadow = false;
      }
      const elbow = new THREE.Group();
      elbow.name = 'elbow';
      elbow.position.y = -0.3;
      add(elbow, box(0.12, 0.27, 0.13), zombie && zv !== 'hazmat' && zv !== 'bilim' ? skinM : uni, 0, -0.135, 0);
      add(elbow, box(0.11, 0.1, 0.12), glove, 0, -0.3, 0);
      arm.add(elbow);
      torso.add(arm);
      arms.push({ arm, elbow, side, S: new THREE.Vector3(side * 0.29, 0.52, 0) });
      if (zombie && side < 0 && Math.random() < 0.15) elbow.visible = false;
    }
    // silah
    let gun = null;
    if (o.weapon) {
      gun = G.buildGun(o.weapon, { merge: true, shadow: G.settings.quality === 'yuksek' });
      gun.name = 'gun';
      gun.position.set(0.1, 0.38, -0.24);
      torso.add(gun);
    }
    if (o.tag) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.tag, depthTest: false, transparent: true }));
      sp.scale.set(o.tagW || 0.35, o.tagH || 0.35, 1);
      sp.position.y = 2.15;
      sp.renderOrder = 10;
      sp.name = 'tag';
      root.add(sp);
      root.userData.tag = sp;
    }
    // çizim çağrılarını azalt: her kemik grubunu malzemeye göre birleştir
    G.mergeGroup(torso, ['head', 'armL', 'armR', 'gun', 'tag', 'photo']);
    G.mergeGroup(head, []);
    for (const l of legs) {
      G.mergeGroup(l.leg, ['knee']);
      G.mergeGroup(l.knee, []);
    }
    for (const a of arms) {
      G.mergeGroup(a.arm, ['elbow']);
      G.mergeGroup(a.elbow, []);
    }
    if (G.settings.quality === 'yuksek') root.traverse((m) => { if (m.isMesh && !m.material.isMeshBasicMaterial) m.castShadow = true; });

    const tmpT = new THREE.Vector3();
    return {
      root, hips, torso, head, legs, arms, gun, zombie,
      legL: legs[0].leg, legR: legs[1].leg, armL: arms[0].arm, armR: arms[1].arm,
      phase: Math.random() * 6,
      deathT: 0,
      deathDir: 1,
      deathType: Math.floor(Math.random() * 3),
      kick: 0,
      popHead() {
        if (!this.head.visible) return;
        this.head.visible = false;
        const p = this.head.getWorldPosition(new THREE.Vector3());
        p.y += 0.15;
        G.fx.blood(p.x, p.y, p.z, 0, 1, 0, 3.5, [0.35, 0.08, 0.05]);
      },
      animate(dt, st) {
        const L0 = this.legs[0], L1 = this.legs[1];
        if (st.dead) {
          this.deathT += dt;
          const k = U.clamp(this.deathT / 0.5, 0, 1);
          const e = 1 - Math.pow(1 - k, 3);
          if (this.deathType === 2) {
            const k1 = U.clamp(this.deathT / 0.25, 0, 1);
            this.hips.position.y = 0.95 - k1 * 0.45 - e * 0.25;
            L0.leg.rotation.x = L1.leg.rotation.x = k1 * 1.2;
            L0.knee.rotation.x = L1.knee.rotation.x = -k1 * 2.0;
            this.root.rotation.z = U.clamp((this.deathT - 0.2) / 0.4, 0, 1) * 1.4 * this.deathDir;
          } else {
            const dir = this.deathType === 0 ? 1 : -1;
            this.root.rotation.x = dir * e * 1.45;
            this.hips.position.y = 0.95 - e * 0.15;
            L0.knee.rotation.x = -e * 0.4;
          }
          for (const a of this.arms) {
            a.arm.quaternion.identity();
            a.arm.rotation.x = -e * 2.2;
            a.arm.rotation.z = a.side * e * 0.4;
            a.elbow.quaternion.identity();
          }
          if (this.gun) this.gun.rotation.z = e * 1.2;
          if (this.deathT > 3.2) this.root.position.y = -(this.deathT - 3.2) * 0.5;
          return;
        }
        this.root.rotation.x = 0;
        this.root.rotation.z = 0;
        const sp = st.speed || 0;
        this.phase += dt * (2.6 + sp * 1.55);
        const amp = Math.min(1, sp / 4.5) * (this.zombie ? 0.55 : 0.75);
        const s = Math.sin(this.phase);
        const c = st.crouch || 0;
        this.hips.position.y = 0.95 - c * 0.36 - Math.abs(Math.cos(this.phase)) * amp * 0.05;
        L0.leg.rotation.x = s * amp * 0.85 + c * 1.15;
        L1.leg.rotation.x = -s * amp * 0.85 + c * 0.75;
        L0.knee.rotation.x = -Math.max(0, -Math.cos(this.phase)) * amp * 1.3 - c * 1.85;
        L1.knee.rotation.x = -Math.max(0, Math.cos(this.phase)) * amp * 1.3 - c * 1.4;
        const run = sp > 5.5;
        this.kick = U.damp(this.kick, 0, 14, dt);
        this.torso.rotation.x = c * 0.2 + (run ? 0.18 : 0) + (this.zombie ? 0.35 : 0) - this.kick * 0.15;
        this.torso.rotation.y = this.zombie ? Math.sin(this.phase * 0.5) * 0.12 : 0;
        const pitch = st.pitch || 0;
        this.head.rotation.x = -pitch * 0.5 - (this.zombie ? 0.25 : 0);
        if (this.zombie) {
          const atk = st.attack || 0;
          for (const a of this.arms) {
            const reach = tmpT.set(a.side * 0.18 + Math.sin(this.phase * 0.5 + a.side) * 0.05, 0.42 - atk * 0.25 + a.side * 0.03, -0.55 - atk * 0.1);
            solveArm(a.arm, a.elbow, a.S, reach, a.side, 0.3, 0.3);
          }
          if (st.rise != null) this.root.position.y = (st.rise - 1) * 1.7;
          return;
        }
        // silah tutuşu
        const g = this.gun;
        if (g) {
          const reloading = !!st.reload;
          g.position.set(0.1, run ? 0.28 : 0.38, run ? -0.18 : -0.24);
          g.rotation.set(run ? 0.7 : -pitch * 0.9 + this.kick * 0.3, run ? 0.5 : 0, reloading ? 0.5 : 0);
          this.torso.updateMatrixWorld(true);
          const P = g.userData.parts;
          for (const a of this.arms) {
            let anchor = a.side > 0 ? P.rightHand : P.leftHand;
            if (reloading && a.side < 0 && P.mag) anchor = P.mag;
            anchor.getWorldPosition(tmpT);
            this.torso.worldToLocal(tmpT);
            if (reloading && a.side < 0) tmpT.y -= 0.06 + Math.sin(G.time * 8) * 0.03;
            solveArm(a.arm, a.elbow, a.S, tmpT, a.side, 0.3, 0.3);
          }
        } else {
          for (const a of this.arms) {
            a.arm.quaternion.identity();
            a.arm.rotation.x = -s * amp * 0.6 * a.side;
            a.elbow.quaternion.identity();
            a.elbow.rotation.x = -0.3;
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
