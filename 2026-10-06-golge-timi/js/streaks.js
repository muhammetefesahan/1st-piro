'use strict';
// Gölge Timi — skor serileri: İHA, hava saldırısı, nöbetçi taret, helikopter.
(function () {
  const G = window.G;
  const U = G.util;

  const S = (G.streaks = {
    ents: [],
    uav: { 0: 0, 1: 0 },
    inventory: [],
    targeting: null,
    marker: null,
    strikes: [],
  });

  // ---------------- Oyuncak model yardımcıları ----------------
  // toon malzemeler önbellekli; parçalar G.mergeGroup ile malzeme başına tek çizime iner.
  function tm(key, color, o) {
    if (G.toonMat) return G.toonMat('streak-' + key, Object.assign({ color }, o || {}));
    return G.gunMat(color);
  }
  function teamCols(team) {
    if (team === 0) return { main: 0x4cc3ff, acc: 0xf5c02e };
    if (team === 1) return { main: 0xff6b6b, acc: 0x9b5de5 };
    return { main: 0xff6fa8, acc: 0x4ecdc4 };
  }
  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function merge(grp, keep) {
    if (G.mergeGroup) G.mergeGroup(grp, keep || []);
    return grp;
  }
  // kocaman sevimli göz (beyaz + plum bebek + parıltı)
  function cuteEye(r) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(r, 12, 10), tm('eye-w', 0xffffff, { emissive: 0x555555, emissiveIntensity: 0.4 })));
    const pupil = mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), tm('eye-p', 0x3b2a4a), 0, 0, -r * 0.62);
    pupil.scale.z = 0.5;
    g.add(pupil);
    g.add(mesh(new THREE.SphereGeometry(r * 0.18, 6, 5), tm('eye-hl', 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), r * 0.22, r * 0.22, -r * 0.92));
    return g;
  }
  function shadowOn(grp) {
    if (G.settings.quality === 'dusuk') return;
    grp.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  }

  // İHA: pervaneleri dönen sevimli dron
  function buildDrone(team) {
    const c = teamCols(team);
    const grp = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(0.9, 14, 10), tm('dr-body' + team, c.main));
    body.scale.set(1, 0.62, 1);
    grp.add(body);
    grp.add(mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), tm('dr-dome', 0xf4ece2), 0, 0.42, 0));
    const eye = cuteEye(0.32);
    eye.position.set(0, -0.12, -0.78);
    grp.add(eye);
    grp.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), tm('dr-ant', 0x3b2a4a), 0, 1.05, 0));
    grp.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), tm('dr-acc' + team, c.acc), 0, 1.32, 0));
    const props = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const ax = Math.cos(a) * 1.35, az = Math.sin(a) * 1.35;
      const arm = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), tm('dr-arm', 0xf4ece2), Math.cos(a) * 0.75, 0.05, Math.sin(a) * 0.75);
      arm.rotation.set(0, -a, Math.PI / 2, 'YXZ');
      grp.add(arm);
      grp.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 10), tm('dr-acc' + team, c.acc), ax, 0.1, az));
      const prop = new THREE.Group();
      prop.name = 'prop' + i;
      prop.position.set(ax, 0.26, az);
      const blade = mesh(new THREE.BoxGeometry(1.1, 0.04, 0.18), tm('dr-blade', 0xffffff));
      prop.add(blade);
      const blade2 = blade.clone();
      blade2.rotation.y = Math.PI / 2;
      prop.add(blade2);
      prop.add(mesh(new THREE.SphereGeometry(0.08, 6, 5), tm('dr-hub', 0xff6fa8)));
      grp.add(prop);
      merge(prop, []);
      props.push(prop);
    }
    merge(grp, ['prop0', 'prop1', 'prop2', 'prop3']);
    grp.scale.setScalar(1.6);
    return { grp, props };
  }

  // Hava saldırısı uçağı: tombul pervaneli oyuncak uçak
  function buildPlane(team) {
    const c = teamCols(team);
    const grp = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(1, 14, 10), tm('pl-body' + team, c.main));
    body.scale.set(1.15, 1.1, 3.4);
    grp.add(body);
    grp.add(mesh(new THREE.SphereGeometry(0.75, 12, 8), tm('pl-glass', 0x9ad7ff, { emissive: 0x2a5a80, emissiveIntensity: 0.4 }), 0, 0.75, 0.9));
    grp.add(mesh(new THREE.BoxGeometry(9, 0.32, 1.9), tm('pl-acc' + team, c.acc), 0, -0.1, 0.2));
    for (const sx of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.42, 10, 8), tm('pl-acc' + team, c.acc), sx * 4.5, -0.1, 0.2));
    grp.add(mesh(new THREE.BoxGeometry(3.4, 0.22, 1), tm('pl-acc' + team, c.acc), 0, 0.2, -3.0));
    grp.add(mesh(new THREE.BoxGeometry(0.22, 1.5, 1.1), tm('pl-body' + team, c.main), 0, 1.0, -3.0));
    grp.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.4, 12).rotateX(Math.PI / 2), tm('pl-nose', 0xf4ece2), 0, 0, 3.45));
    const prop = new THREE.Group();
    prop.name = 'prop';
    prop.position.set(0, 0, 3.75);
    const pb = mesh(new THREE.BoxGeometry(2.6, 0.26, 0.08), tm('pl-blade', 0x3b2a4a));
    prop.add(pb);
    const pb2 = pb.clone();
    pb2.rotation.z = Math.PI / 2;
    prop.add(pb2);
    prop.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), tm('pl-hub', 0xff6fa8)));
    grp.add(prop);
    merge(prop, []);
    merge(grp, ['prop']);
    return { grp, prop };
  }

  // yuvarlak çizgi film bombası (paylaşılan geometri/malzeme)
  const bombKit = {};
  function buildBomb() {
    if (!bombKit.ball) {
      bombKit.ball = new THREE.SphereGeometry(0.42, 12, 10);
      bombKit.cap = new THREE.CylinderGeometry(0.14, 0.16, 0.22, 8);
      bombKit.cap.translate(0, 0.46, 0);
      bombKit.fin = new THREE.BoxGeometry(0.5, 0.36, 0.06);
      bombKit.fin.translate(0, 0.62, 0);
      bombKit.hl = new THREE.SphereGeometry(0.09, 6, 5);
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bombKit.ball, tm('bomb', 0x6a5a8a)));
    g.add(new THREE.Mesh(bombKit.cap, tm('bomb-cap', 0xffd23f)));
    const f1 = new THREE.Mesh(bombKit.fin, tm('bomb-fin', 0xff6fa8));
    g.add(f1);
    const f2 = f1.clone();
    f2.rotation.y = Math.PI / 2;
    g.add(f2);
    // parıltı noktası
    const hl = new THREE.Mesh(bombKit.hl, tm('eye-hl', 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }));
    hl.position.set(-0.2, -0.16, 0.3);
    g.add(hl);
    g.scale.setScalar(1.4);
    return g;
  }

  S.reset = function () {
    for (const e of S.ents) {
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      if (e.jet && e.jet.parent) e.jet.parent.remove(e.jet);
    }
    S.ents.length = 0;
    S.uav = { 0: 0, 1: 0 };
    S.inventory = [0, 0, 0, 0];
    S.targeting = null;
    for (const s of S.strikes) if (s.bomb && s.bomb.parent) s.bomb.parent.remove(s.bomb);
    S.strikes.length = 0;
    if (S.marker && S.marker.parent) S.marker.parent.remove(S.marker);
    S.marker = null;
    G.audio.stopLoop('heli');
  };

  // oyuncu puan kazandığında çağrılır
  S.addPoints = function (player, pts) {
    if (!G.game || !G.game.streaksEnabled) return;
    const before = player.streakPts;
    player.streakPts += pts;
    G.STREAKS.forEach((def, i) => {
      if (before < def.cost && player.streakPts >= def.cost) {
        S.inventory[i]++;
        G.hud && G.hud.medal(def.name + ' hazır! [' + (i + 3) + ']');
        G.audio.play('uav', { priority: true });
        G.audio.announce(def.name + ' hazır');
      }
    });
  };

  S.activate = function (i) {
    const p = G.game && G.game.player;
    if (!p || !p.alive || !G.game.streaksEnabled) return;
    if (!S.inventory[i]) return;
    const def = G.STREAKS[i];
    if (def.id !== 'airstrike') G.progress.stat('streakUse', 1);
    if (def.id === 'uav') {
      S.inventory[i]--;
      S.callUAV(p.team, 'player');
    } else if (def.id === 'airstrike') {
      S.targeting = { i };
      G.hud && G.hud.medal('Hedefi işaretle: Sol tık onayla, sağ tık iptal');
    } else if (def.id === 'sentry') {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const x = p.pos.x + fx * 1.8, z = p.pos.z + fz * 1.8;
      if (!G.world.spaceFree(x, 0.05, z, 0.4, 1.2)) {
        G.hud && G.hud.medal('Taret buraya kurulamaz');
        return;
      }
      S.inventory[i]--;
      S.spawnSentry(p, new THREE.Vector3(x, p.pos.y, z));
    } else if (def.id === 'heli') {
      S.inventory[i]--;
      S.spawnHeli(p);
    }
  };

  S.callUAV = function (team, who) {
    S.uav[team] = Math.max(S.uav[team], G.time) + 30;
    spawnDrone(team);
    const pt = G.game.player ? G.game.player.team : 0;
    if (team === pt) {
      G.hud && G.hud.medal(who === 'player' ? 'İHA çevrimiçi' : 'Dost İHA çevrimiçi');
      G.audio.announce('İHA çevrimiçi');
    } else {
      G.hud && G.hud.warn('Düşman İHA’sı havada!');
      G.audio.announce('Düşman İHA tespit edildi');
    }
    G.audio.play('uav', { priority: true });
  };

  // gökyüzünde daire çizen oyuncak dron (yalnızca görsel)
  function spawnDrone(team) {
    const w = G.world;
    if (!w || !w.group || (team !== 0 && team !== 1)) return;
    for (const e of S.ents) if (e.isDrone && e.team === team) return;
    const d = buildDrone(team);
    w.group.add(d.grp);
    const sx = w.sizeX || 60, sz = w.sizeZ || 60;
    S.ents.push({ isDrone: true, team, mesh: d.grp, props: d.props, cx: sx / 2, cz: sz / 2, rad: Math.min(sx, sz) * 0.28, ang: team === 0 ? 0 : Math.PI, born: G.time });
    d.grp.position.set(sx / 2, 40, sz / 2);
  }
  function updateDrone(e, dt) {
    const left = (S.uav[e.team] || 0) - G.time;
    e.ang += dt * 0.25;
    const m = e.mesh;
    const x = e.cx + Math.cos(e.ang) * e.rad, z = e.cz + Math.sin(e.ang) * e.rad;
    // giriş/çıkışta yükselip alçalır
    const k = Math.min(1, (G.time - e.born) / 2, Math.max(0, left) / 2);
    m.position.set(x, 22 + (1 - k) * 18 + Math.sin(G.time * 2) * 0.4, z);
    // uçuş yönüne bak (yörünge teğeti)
    m.rotation.set(0, Math.PI - e.ang, Math.sin(G.time * 1.7) * 0.08);
    for (const p of e.props) p.rotation.y += dt * 30;
    if (left <= -2) {
      if (m.parent) m.parent.remove(m);
      return false;
    }
    return true;
  }

  S.uavActive = function (team) {
    return G.time < (S.uav[team] || 0);
  };

  // ---------------- Hava saldırısı ----------------
  S.updateTargeting = function () {
    const p = G.game.player;
    if (!S.targeting || !p.alive) {
      if (S.marker) S.marker.visible = false;
      return;
    }
    const cam = G.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const hit = G.world.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 120);
    if (!S.marker) {
      S.marker = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 24), new THREE.MeshBasicMaterial({ color: 0xff6fa8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
      S.marker.rotation.x = -Math.PI / 2;
      S.marker.renderOrder = 20;
      G.world.group.add(S.marker);
    }
    S.marker.visible = !!hit;
    if (hit) S.marker.position.set(hit.x, 0.1, hit.z);
    if (G.input.hit('fire') && hit) {
      S.inventory[S.targeting.i]--;
      G.progress.stat('streakUse', 1);
      S.callAirstrike(p, new THREE.Vector3(hit.x, 0, hit.z), p.yaw);
      S.targeting = null;
      S.marker.visible = false;
      G.input.hits.mouse0 = false;
    } else if (G.input.hit('ads') || G.input.hit('pause')) {
      S.targeting = null;
      S.marker.visible = false;
    }
  };

  S.callAirstrike = function (owner, target, yaw) {
    const credit = { team: owner.team, creditTo: owner, name: 'Hava Saldırısı', isStreak: true };
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const t0 = G.time + 2.4;
    for (let i = 0; i < 7; i++) {
      const o = (i - 3) * 3.6;
      S.strikes.push({ at: t0 + i * 0.11, pos: new THREE.Vector3(target.x + fx * o + U.rand(-0.6, 0.6), 0.3, target.z + fz * o + U.rand(-0.6, 0.6)), credit, fx, fz });
    }
    // tombul oyuncak uçak
    const pl = buildPlane(owner.team);
    const jet = pl.grp;
    const start = new THREE.Vector3(target.x - fx * 160, 30, target.z - fz * 160);
    const end = new THREE.Vector3(target.x + fx * 160, 30, target.z + fz * 160);
    jet.position.copy(start);
    jet.lookAt(end);
    G.world.group.add(jet);
    const ent = { jet, prop: pl.prop, start, end, t0: G.time, dur: 4.4, isJet: true };
    S.ents.push(ent);
    setTimeout(() => G.audio.play('jet', { priority: true }), 900);
    const enemyOfPlayer = G.game.player && G.game.canHurt(owner, G.game.player) && owner !== G.game.player;
    if (enemyOfPlayer) {
      G.hud && G.hud.warn('Düşman hava saldırısı geliyor!');
      G.audio.play('warning', { priority: true });
      G.hud && G.hud.strikeMarker(target, 4);
    } else G.audio.announce('Hava saldırısı yolda');
  };

  // ---------------- Nöbetçi taret ----------------
  S.spawnSentry = function (owner, pos) {
    const c = teamCols(owner.team);
    const grp = new THREE.Group();
    // tombul üç ayak + yuvarlak taban
    const legM = tm('se-leg', 0xf4ece2);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const l = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), legM, Math.cos(a) * 0.24, 0.28, Math.sin(a) * 0.24);
      l.rotation.z = Math.cos(a) * 0.4;
      l.rotation.x = -Math.sin(a) * 0.4;
      grp.add(l);
      grp.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), tm('se-foot', 0x3b2a4a), Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36));
    }
    grp.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 14), tm('se-acc' + owner.team, c.acc), 0, 0.6, 0));
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 0.92;
    const ball = mesh(new THREE.SphereGeometry(0.3, 16, 12), tm('se-body' + owner.team, c.main));
    ball.scale.set(1, 0.9, 1.1);
    head.add(ball);
    // şeker çizgili namlu + yuvarlak ağız
    head.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10).rotateX(Math.PI / 2), tm('se-barrel', 0xf4ece2), 0, -0.04, -0.48));
    for (const z of [-0.36, -0.56]) head.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10).rotateX(Math.PI / 2), tm('se-stripe', 0xff6fa8), 0, -0.04, z));
    head.add(mesh(new THREE.TorusGeometry(0.08, 0.035, 6, 12), tm('se-acc' + owner.team, c.acc), 0, -0.04, -0.74));
    // sevimli göz
    const eye = cuteEye(0.12);
    eye.position.set(0, 0.12, -0.26);
    head.add(eye);
    // anten + yan "kulaklar"
    head.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 5), tm('dr-ant', 0x3b2a4a), 0.12, 0.38, 0.06));
    head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), tm('se-acc' + owner.team, c.acc), 0.12, 0.54, 0.06));
    for (const sx of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), tm('se-acc' + owner.team, c.acc), sx * 0.3, 0.05, 0));
    grp.add(head);
    merge(head, []);
    merge(grp, ['head']);
    shadowOn(grp);
    grp.position.copy(pos);
    G.world.group.add(grp);
    const ent = {
      isEnt: true, kind: 'sentry', name: 'Nöbetçi Taret', team: owner.team, creditTo: owner, alive: true,
      pos: pos.clone(), health: 320, mesh: grp, head, until: G.time + 60, fireCD: 0, yaw: owner.yaw, target: null, spotted: 0,
      chest(out) { return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + 0.85, this.pos.z); },
      hitTest(ox, oy, oz, dx, dy, dz, maxT) {
        const p = this.pos;
        const t = G.rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.35, p.y, p.z - 0.35, p.x + 0.35, p.y + 1.1, p.z + 0.35);
        return t >= 0 && t < maxT ? { t, part: 'body' } : null;
      },
      takeDamage(amount, attacker, info) {
        if (!this.alive) return false;
        if (G.game && attacker && !G.game.canHurt(attacker, this)) return false;
        this.health -= info && info.explosive ? amount * 2 : amount;
        if (this.health <= 0) {
          this.destroy(attacker);
          return true;
        }
        return false;
      },
      destroy(by) {
        this.alive = false;
        G.combat.explode(new THREE.Vector3(this.pos.x, this.pos.y + 0.6, this.pos.z), 3, 40, null, { weaponName: 'Taret' });
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        if (by && by.isPlayer && G.hud) G.hud.medal('Taret imha edildi +150');
        if (by && by.isPlayer && G.game.addScore) G.game.addScore(by, 150);
      },
    };
    S.ents.push(ent);
    G.audio.play('swap', { pos });
    if (owner.isPlayer) G.hud && G.hud.medal('Taret kuruldu');
    return ent;
  };

  function updateSentry(e, dt) {
    if (G.time > e.until) {
      e.alive = false;
      if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
      return false;
    }
    const eye = new THREE.Vector3(e.pos.x, e.pos.y + 0.95, e.pos.z);
    e.scanT = (e.scanT || 0) - dt;
    if (e.scanT <= 0) {
      e.scanT = 0.2;
      e.target = null;
      let bestD = 42;
      for (const h of G.game.hittables()) {
        if (!h.alive || h.isEnt || !G.game.canHurt(e, h)) continue;
        const c = h.chest(new THREE.Vector3());
        const d = c.distanceTo(eye);
        if (d < bestD && G.world.los(eye.x, eye.y, eye.z, c.x, c.y, c.z)) {
          bestD = d;
          e.target = h;
        }
      }
    }
    if (e.target && e.target.alive) {
      const c = e.target.chest(new THREE.Vector3());
      const want = Math.atan2(-(c.x - e.pos.x), -(c.z - e.pos.z));
      e.yaw += U.clamp(U.wrapAngle(want - e.yaw), -4 * dt, 4 * dt);
      e.fireCD -= dt;
      if (e.fireCD <= 0 && Math.abs(U.wrapAngle(want - e.yaw)) < 0.12) {
        e.fireCD = 0.11;
        const dir = c.clone().sub(eye).normalize();
        dir.x += U.gauss() * 0.02;
        dir.y += U.gauss() * 0.015;
        dir.z += U.gauss() * 0.02;
        dir.normalize();
        const muzzle = eye.clone().addScaledVector(dir, 0.8);
        G.combat.fire(e, eye, dir, TURRET_STATS, { tracerFrom: muzzle, tracerColor: 0xfff0a0, tracerAlways: true, weaponName: 'Nöbetçi Taret' });
        G.audio.shot('turret', e.pos);
        G.fx.muzzle(muzzle, dir, false);
      }
    } else {
      e.yaw += dt * 0.6;
    }
    e.head.rotation.y = e.yaw;
    return true;
  }
  const TURRET_STATS = { id: 'sentry', name: 'Nöbetçi Taret', dmg: [[0, 20], [30, 16]], head: 1.2, legs: 1 };

  // ---------------- Saldırı helikopteri ----------------
  S.spawnHeli = function (owner) {
    const c = teamCols(owner.team);
    const grp = new THREE.Group();
    // yuvarlak kabin
    const body = mesh(new THREE.SphereGeometry(1.2, 16, 12), tm('he-body' + owner.team, c.main));
    body.scale.set(1, 0.95, 1.6);
    grp.add(body);
    const glass = mesh(new THREE.SphereGeometry(0.95, 14, 10), tm('pl-glass', 0x9ad7ff, { emissive: 0x2a5a80, emissiveIntensity: 0.4 }), 0, 0.28, -0.95);
    glass.scale.set(0.95, 0.8, 0.8);
    grp.add(glass);
    // kuyruk
    grp.add(mesh(new THREE.CylinderGeometry(0.16, 0.34, 3.4, 10).rotateX(Math.PI / 2), tm('he-body' + owner.team, c.main), 0, 0.35, 3.2));
    grp.add(mesh(new THREE.BoxGeometry(0.16, 1.0, 0.6), tm('he-acc' + owner.team, c.acc), 0, 0.75, 4.8));
    grp.add(mesh(new THREE.BoxGeometry(1.4, 0.12, 0.45), tm('he-acc' + owner.team, c.acc), 0, 0.35, 4.6));
    // kızaklar
    const skidM = tm('se-leg', 0xf4ece2);
    for (const sx of [-1, 1]) {
      grp.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8).rotateX(Math.PI / 2), skidM, sx * 0.9, -1.4, 0));
      for (const z of [-0.7, 0.7]) grp.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), skidM, sx * 0.75, -1.15, z));
    }
    // rotor direği + göbek
    grp.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), tm('dr-ant', 0x3b2a4a), 0, 1.2, 0));
    grp.add(mesh(new THREE.SphereGeometry(0.26, 10, 8), tm('he-acc' + owner.team, c.acc), 0, 1.48, 0));
    // burun silahı (oyuncak)
    grp.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8).rotateX(Math.PI / 2), tm('se-barrel', 0xf4ece2), 0, -0.9, -1.6));
    grp.add(mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 12), tm('se-stripe', 0xff6fa8), 0, -0.9, -2.0));
    // ana rotor: yuvarlak uçlu kanatlar
    const bladeM = tm('he-blade', 0x3b2a4a);
    const mkRotor = (name, ry) => {
      const r = new THREE.Group();
      r.name = name;
      r.position.y = 1.55;
      r.rotation.y = ry;
      r.add(mesh(new THREE.BoxGeometry(8, 0.07, 0.42), bladeM));
      for (const sx of [-1, 1]) r.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10), tm('he-acc' + owner.team, c.acc), sx * 4, 0, 0));
      grp.add(r);
      merge(r, []);
      return r;
    };
    const rotor = mkRotor('rotor', 0);
    const rotor2 = mkRotor('rotor2', Math.PI / 2);
    // kuyruk rotoru
    const tr = new THREE.Group();
    tr.name = 'tailRotor';
    tr.position.set(0.18, 0.75, 4.8);
    tr.add(mesh(new THREE.BoxGeometry(0.05, 1.3, 0.2), bladeM));
    grp.add(tr);
    merge(grp, ['rotor', 'rotor2', 'tailRotor']);
    shadowOn(grp);
    const w = G.world;
    const center = new THREE.Vector3(w.sizeX / 2, 22, w.sizeZ / 2);
    grp.position.set(center.x + 120, 30, center.z);
    w.group.add(grp);
    const ent = {
      isEnt: true, kind: 'heli', name: 'Saldırı Helikopteri', team: owner.team, creditTo: owner, alive: true,
      pos: grp.position, health: 1300, mesh: grp, rotor, rotor2, tailRotor: tr, until: G.time + 45, center, ang: 0,
      radius: Math.min(w.sizeX, w.sizeZ) * 0.3, fireCD: 0, burst: 0, target: null, entering: true, spotted: 0,
      chest(out) { return (out || new THREE.Vector3()).copy(this.pos); },
      hitTest(ox, oy, oz, dx, dy, dz, maxT) {
        const p = this.pos;
        const t = G.rayBox(ox, oy, oz, dx, dy, dz, p.x - 1.4, p.y - 1, p.z - 1.4, p.x + 1.4, p.y + 1, p.z + 1.4);
        return t >= 0 && t < maxT ? { t, part: 'body' } : null;
      },
      takeDamage(amount, attacker, info) {
        if (!this.alive) return false;
        if (G.game && attacker && !G.game.canHurt(attacker, this)) return false;
        this.health -= info && info.explosive ? amount * 3 : amount;
        if (this.health <= 0) {
          this.alive = false;
          G.combat.explode(this.pos.clone(), 6, 0, null, { weaponName: 'Helikopter' });
          if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
          G.audio.stopLoop('heli');
          if (attacker && attacker.isPlayer && G.game.addScore) {
            G.game.addScore(attacker, 400);
            G.hud && G.hud.medal('Helikopter düşürüldü +400');
          }
          return true;
        }
        return false;
      },
    };
    S.ents.push(ent);
    G.audio.startLoop('heli', 'heli', grp.position);
    if (owner.isPlayer) G.audio.announce('Helikopter yolda');
    else G.hud && G.hud.warn('Düşman helikopteri!');
  };

  function updateHeli(e, dt) {
    e.rotor.rotation.y += dt * 25;
    e.rotor2.rotation.y += dt * 25;
    if (e.tailRotor) e.tailRotor.rotation.x += dt * 30;
    G.audio.updateLoop('heli', e.pos);
    if (G.time > e.until) {
      // ayrıl
      e.pos.x += dt * 30;
      e.pos.y += dt * 6;
      if (G.time > e.until + 5) {
        e.alive = false;
        if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
        G.audio.stopLoop('heli');
        return false;
      }
      return true;
    }
    e.ang += dt * 0.22;
    const tx = e.center.x + Math.cos(e.ang) * e.radius, tz = e.center.z + Math.sin(e.ang) * e.radius;
    e.pos.x = U.damp(e.pos.x, tx, 1.2, dt);
    e.pos.z = U.damp(e.pos.z, tz, 1.2, dt);
    e.pos.y = U.damp(e.pos.y, 22, 1, dt);
    e.scanT = (e.scanT || 0) - dt;
    if (e.scanT <= 0) {
      e.scanT = 0.4;
      e.target = null;
      let bestD = 90;
      for (const h of G.game.hittables()) {
        if (!h.alive || h.isEnt || !G.game.canHurt(e, h)) continue;
        const c = h.chest(new THREE.Vector3());
        const d = c.distanceTo(e.pos);
        if (d < bestD && G.world.los(e.pos.x, e.pos.y - 1.2, e.pos.z, c.x, c.y, c.z)) {
          bestD = d;
          e.target = h;
        }
      }
    }
    const look = e.target && e.target.alive ? e.target.pos : e.center;
    const want = Math.atan2(-(look.x - e.pos.x), -(look.z - e.pos.z));
    e.mesh.rotation.y += U.clamp(U.wrapAngle(want - e.mesh.rotation.y), -2 * dt, 2 * dt);
    e.mesh.rotation.x = -0.12;
    if (e.target && e.target.alive) {
      e.fireCD -= dt;
      if (e.fireCD <= 0) {
        if (e.burst <= 0) {
          e.burst = 10;
        }
        e.burst--;
        e.fireCD = e.burst <= 0 ? 1.2 : 0.09;
        const from = new THREE.Vector3(e.pos.x, e.pos.y - 1.2, e.pos.z);
        const c = e.target.chest(new THREE.Vector3());
        const dir = c.sub(from).normalize();
        dir.x += U.gauss() * 0.028;
        dir.y += U.gauss() * 0.02;
        dir.z += U.gauss() * 0.028;
        dir.normalize();
        G.combat.fire(e, from, dir, HELI_STATS, { tracerFrom: from.clone().addScaledVector(dir, 1.5), tracerColor: 0xffd070, tracerAlways: true, weaponName: 'Saldırı Helikopteri' });
        G.audio.shot('heli', e.pos);
      }
    }
    return true;
  }
  const HELI_STATS = { id: 'heli', name: 'Saldırı Helikopteri', dmg: [[0, 30]], head: 1, legs: 1 };

  S.update = function (dt) {
    if (!G.game) return;
    S.updateTargeting();
    for (let i = S.strikes.length - 1; i >= 0; i--) {
      const s = S.strikes[i];
      // yuvarlak bomba patlamadan ~0.7 sn önce düşmeye başlar (yalnızca görsel)
      if (!s.bomb && G.time >= s.at - 0.7 && G.world && G.world.group) {
        s.bomb = buildBomb();
        G.world.group.add(s.bomb);
      }
      if (s.bomb) {
        const k = U.clamp(1 - (s.at - G.time) / 0.7, 0, 1);
        s.bomb.position.set(s.pos.x - (s.fx || 0) * (1 - k) * 6, s.pos.y + 0.3 + 28 * (1 - k * k), s.pos.z - (s.fz || 0) * (1 - k) * 6);
        // top aşağıda, kanatçıklar yukarıda; düşerken hafifçe öne yatar
        s.bomb.rotation.set(0, Math.atan2(s.fx || 0, s.fz || 1), 0.35 * (1 - k));
      }
      if (G.time >= s.at) {
        S.strikes.splice(i, 1);
        if (s.bomb && s.bomb.parent) s.bomb.parent.remove(s.bomb);
        G.combat.explode(s.pos, 6.5, 260, s.credit, { weaponName: 'Hava Saldırısı', streak: true });
      }
    }
    for (let i = S.ents.length - 1; i >= 0; i--) {
      const e = S.ents[i];
      let keep = true;
      if (e.isJet) {
        const k = (G.time - e.t0) / e.dur;
        e.jet.position.lerpVectors(e.start, e.end, k);
        if (e.prop) e.prop.rotation.z += dt * 40;
        if (k >= 1) {
          if (e.jet.parent) e.jet.parent.remove(e.jet);
          keep = false;
        }
      } else if (e.isDrone) keep = updateDrone(e, dt);
      else if (!e.alive) keep = false;
      else if (e.kind === 'sentry') keep = updateSentry(e, dt);
      else if (e.kind === 'heli') keep = updateHeli(e, dt);
      if (!keep) S.ents.splice(i, 1);
    }
  };

  // vurulabilir varlıklar (taret, helikopter)
  S.hittables = function () {
    return S.ents.filter((e) => e.isEnt && e.alive);
  };
})();
