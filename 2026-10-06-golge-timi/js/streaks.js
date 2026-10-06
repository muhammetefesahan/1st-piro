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

  S.reset = function () {
    for (const e of S.ents) if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    S.ents.length = 0;
    S.uav = { 0: 0, 1: 0 };
    S.inventory = [0, 0, 0, 0];
    S.targeting = null;
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
      S.marker = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 24), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
      S.marker.rotation.x = -Math.PI / 2;
      S.marker.renderOrder = 20;
      G.world.group.add(S.marker);
    }
    S.marker.visible = !!hit;
    if (hit) S.marker.position.set(hit.x, 0.1, hit.z);
    if (G.input.hit('fire') && hit) {
      S.inventory[S.targeting.i]--;
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
      S.strikes.push({ at: t0 + i * 0.11, pos: new THREE.Vector3(target.x + fx * o + U.rand(-0.6, 0.6), 0.3, target.z + fz * o + U.rand(-0.6, 0.6)), credit });
    }
    // jet
    const jet = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.8, 7, 6).rotateX(-Math.PI / 2), G.gunMat(0x5a6068));
    jet.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 2), G.gunMat(0x4a5058));
    wing.position.z = 1;
    jet.add(wing);
    const start = new THREE.Vector3(target.x - fx * 160, 40, target.z - fz * 160);
    const end = new THREE.Vector3(target.x + fx * 160, 40, target.z + fz * 160);
    jet.position.copy(start);
    jet.lookAt(end);
    G.world.group.add(jet);
    const ent = { jet, start, end, t0: G.time, dur: 4.4, isJet: true };
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
    const grp = new THREE.Group();
    const leg = G.gunMat(0x3a3f35);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), leg);
      l.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.3, 0.35, Math.sin((i * Math.PI * 2) / 3) * 0.3);
      l.rotation.z = Math.cos((i * Math.PI * 2) / 3) * 0.35;
      l.rotation.x = -Math.sin((i * Math.PI * 2) / 3) * 0.35;
      grp.add(l);
    }
    const head = new THREE.Group();
    head.position.y = 0.85;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.6), G.gunMat(0x4a5040));
    head.add(box);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6).rotateX(Math.PI / 2), G.gunMat(0x111111));
    barrel.position.z = -0.55;
    head.add(barrel);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: owner.team === 0 ? 0x4cc3ff : 0xff4d3d }));
    eye.position.set(0, 0.08, -0.31);
    head.add(eye);
    grp.add(head);
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
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 4.2), G.gunMat(owner.team === 0 ? 0x3d4a3a : 0x3a3a40));
    grp.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4), G.gunMat(0x2d342b));
    tail.position.set(0, 0.3, 3.8);
    grp.add(tail);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.8, roughness: 0.1 }));
    glass.position.set(0, 0.2, -2.1);
    grp.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.06, 0.4), G.gunMat(0x111111));
    rotor.position.y = 1.05;
    grp.add(rotor);
    const rotor2 = rotor.clone();
    rotor2.rotation.y = Math.PI / 2;
    grp.add(rotor2);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1), G.gunMat(0x111111));
    gun.position.set(0, -0.9, -1.8);
    grp.add(gun);
    const w = G.world;
    const center = new THREE.Vector3(w.sizeX / 2, 22, w.sizeZ / 2);
    grp.position.set(center.x + 120, 30, center.z);
    w.group.add(grp);
    const ent = {
      isEnt: true, kind: 'heli', name: 'Saldırı Helikopteri', team: owner.team, creditTo: owner, alive: true,
      pos: grp.position, health: 1300, mesh: grp, rotor, rotor2, until: G.time + 45, center, ang: 0,
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
      if (G.time >= s.at) {
        S.strikes.splice(i, 1);
        G.combat.explode(s.pos, 6.5, 260, s.credit, { weaponName: 'Hava Saldırısı', streak: true });
      }
    }
    for (let i = S.ents.length - 1; i >= 0; i--) {
      const e = S.ents[i];
      let keep = true;
      if (e.isJet) {
        const k = (G.time - e.t0) / e.dur;
        e.jet.position.lerpVectors(e.start, e.end, k);
        if (k >= 1) {
          if (e.jet.parent) e.jet.parent.remove(e.jet);
          keep = false;
        }
      } else if (!e.alive) keep = false;
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
