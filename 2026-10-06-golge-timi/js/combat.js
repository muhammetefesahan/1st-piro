'use strict';
// Gölge Timi — mermi izleme, patlamalar, el bombaları ve mermili mühimmat.
(function () {
  const G = window.G;
  const U = G.util;
  const C = (G.combat = { projectiles: [] });
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  C.reset = function () {
    for (const p of C.projectiles) if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    C.projectiles.length = 0;
    C.pending = [];
  };
  C.pending = [];

  function hittables() {
    return G.game ? G.game.hittables() : [];
  }
  function canHurt(a, b) {
    if (!G.game) return true;
    return G.game.canHurt(a, b);
  }

  // Tek mermi izi. Dönüş: {target, part, killed, point, dist}
  C.trace = function (shooter, ox, oy, oz, dx, dy, dz, stats, opts) {
    const o = opts || {};
    const world = G.world;
    const range = o.range || 400;
    const hit = world.raycast(ox, oy, oz, dx, dy, dz, range);
    let maxT = hit ? hit.t : range;
    let best = null, bestT = maxT, bestPart = null;
    const list = hittables();
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (h === shooter || !h.alive) continue;
      if (!canHurt(shooter, h)) continue;
      const r = h.hitTest(ox, oy, oz, dx, dy, dz, bestT);
      if (r && r.t < bestT) {
        bestT = r.t;
        best = h;
        bestPart = r.part;
      }
    }
    const px = ox + dx * bestT, py = oy + dy * bestT, pz = oz + dz * bestT;
    const point = new THREE.Vector3(px, py, pz);
    let killed = false;
    if (best) {
      let dmg = o.fixedDamage != null ? o.fixedDamage : G.damageAt(stats, bestT);
      if (bestPart === 'head') dmg *= o.headMult || stats.head || 1.3;
      else if (bestPart === 'legs') dmg *= stats.legs || 0.9;
      dmg *= o.dmgMul || 1;
      const info = {
        weapon: o.weaponName || stats.name,
        weaponId: stats.id,
        headshot: bestPart === 'head',
        part: bestPart,
        dist: bestT,
        dir: new THREE.Vector3(dx, dy, dz),
        point,
        from: new THREE.Vector3(ox, oy, oz),
        pellet: !!o.pellet,
        suppressed: !!stats.suppressed,
      };
      killed = best.takeDamage(dmg, shooter, info);
      if (best.isEnt) {
        G.fx.impact(px, py, pz, -dx, -dy, -dz, true);
      } else if (G.fx.blood) {
        const col = best.kind === 'zombie' || best.kind === 'dog' ? [0.35, 0.08, 0.05] : null;
        G.fx.blood(px, py, pz, dx, dy, dz, bestPart === 'head' ? 1.6 : 1, col);
      }
      if (shooter && shooter.onHitTarget) shooter.onHitTarget(best, bestPart, killed, info, dmg);
    } else if (hit) {
      G.fx.impact(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.box && hit.box.metal);
      if (hit.box && hit.box.ent && hit.box.ent.type === 'barrel') C.damageBarrel(hit.box.ent, G.damageAt(stats, bestT), shooter);
      if (o.isPlayer && Math.random() < 0.15) G.audio.play('ricochet', { pos: point, vol: 0.6 });
    }
    return { target: best, part: bestPart, killed, point, dist: bestT, world: !best && !!hit };
  };

  // Atış: saçılım + saçma + iz
  C.fire = function (shooter, origin, dir, stats, opts) {
    const o = opts || {};
    const spread = (o.spread || 0) * U.DEG;
    const pellets = stats.pellets || 1;
    const results = [];
    // yön tabanı
    const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const upv = new THREE.Vector3().crossVectors(right, dir).normalize();
    for (let i = 0; i < pellets; i++) {
      let s = spread;
      if (pellets > 1) s = Math.max(spread, 0) + (stats.pelletSpread || 4) * U.DEG * (o.ads ? 0.75 : 1);
      const a = Math.random() * Math.PI * 2;
      const r = pellets > 1 ? Math.sqrt(Math.random()) * s : Math.min(s, Math.abs(U.gauss()) * s * 0.5);
      const d = tmp.copy(dir).addScaledVector(right, Math.cos(a) * Math.tan(r)).addScaledVector(upv, Math.sin(a) * Math.tan(r)).normalize();
      const res = C.trace(shooter, origin.x, origin.y, origin.z, d.x, d.y, d.z, stats, Object.assign({}, o, { pellet: pellets > 1 }));
      results.push(res);
      if (o.tracerFrom && (pellets === 1 || i % 3 === 0) && (o.tracerAlways || Math.random() < 0.55)) {
        G.fx.tracer(o.tracerFrom, res.point, o.tracerColor);
      }
    }
    return results;
  };

  C.damageBarrel = function (ent, dmg, by) {
    if (ent.exploded) return;
    ent.hp -= dmg;
    ent.lastBy = by;
    if (ent.hp <= 0) {
      ent.exploded = true;
      C.pending.push({
        at: G.time + 0.12,
        fn: () => {
          ent.box.disabled = true;
          if (ent.mesh.parent) ent.mesh.parent.remove(ent.mesh);
          if (G.world) G.world.walk[ent.cell[0] + ent.cell[1] * G.world.w] = 1;
          C.explode(ent.pos, 5.5, 210, ent.lastBy || null, { weaponName: 'Patlayıcı Varil' });
          G.fx.fireEmitter(new THREE.Vector3(ent.pos.x, 0.2, ent.pos.z), 6);
        },
      });
    }
  };

  // Patlama hasarı (siper kontrollü)
  C.explode = function (pos, radius, maxDmg, owner, opts) {
    const o = opts || {};
    G.fx.explosion(pos, radius, { plasma: o.plasma });
    if (G.game && G.game.net && owner && (owner.isPlayer || (owner.creditTo && owner.creditTo.isPlayer))) G.game.net.explosionVisual(pos);
    if (!o.silent) G.audio.play(o.plasma ? 'impact' : o.stun ? 'stunBang' : 'explosion', { pos, ref: 22, priority: true, vol: o.plasma ? 0.8 : 1 });
    const list = hittables();
    const origin = tmp2.set(pos.x, pos.y + 0.35, pos.z);
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h.alive) continue;
      const self = h === owner;
      if (self && o.noSelf) continue;
      if (!self && owner && !canHurt(owner, h)) continue;
      const c = h.chest ? h.chest(tmp) : tmp.copy(h.pos);
      const d = c.distanceTo(pos);
      if (d > radius) continue;
      let visible = G.world.los(origin.x, origin.y, origin.z, c.x, c.y, c.z, true);
      if (!visible && h.headPos) {
        const hp = h.headPos(new THREE.Vector3());
        visible = G.world.los(origin.x, origin.y, origin.z, hp.x, hp.y, hp.z, true);
      }
      if (!visible) continue;
      if (o.stun) {
        h.stunUntil = Math.max(h.stunUntil || 0, G.time + 1.5 + 3 * (1 - d / radius));
        if (h.onStun) h.onStun(1 - d / radius);
        h.takeDamage(4, owner, { weapon: o.weaponName, explosive: true, stun: true });
        continue;
      }
      let dmg = maxDmg * U.clamp(1.12 - d / radius, 0, 1);
      if (self) dmg *= 0.55;
      h.takeDamage(dmg, owner, {
        weapon: o.weaponName || 'Patlama',
        weaponId: o.weaponId,
        explosive: true,
        dir: new THREE.Vector3().subVectors(c, pos).normalize(),
        point: c.clone(),
        from: pos.clone(),
        streak: o.streak,
      });
    }
    // zincirleme variller
    if (!o.stun && G.world) {
      for (const b of G.world.barrels) {
        if (b.exploded) continue;
        if (b.pos.distanceTo(pos) < radius * 0.9) C.damageBarrel(b, 999, owner);
      }
    }
  };

  // ------------------------------------------------------------------
  // Mermiler: el bombaları, roket, plazma, fırlatma bıçağı
  // ------------------------------------------------------------------
  const projGeo = {};
  function projMesh(kind) {
    let m;
    if (kind === 'rocket') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateX(Math.PI / 2), G.gunMat(0x5d6b45));
    } else if (kind === 'plasma') {
      m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x70ffb0 }));
    } else if (kind === 'knife') {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), G.gunMat(0xcfd4d8, { metal: 0.9, rough: 0.2 }));
    } else {
      const col = kind === 'smoke' ? 0x606a60 : kind === 'stun' ? 0x3a5a7a : kind === 'semtex' ? 0x8a8f50 : 0x3d4a2a;
      if (!projGeo.g) projGeo.g = new THREE.SphereGeometry(0.07, 8, 6);
      m = new THREE.Mesh(projGeo.g, G.gunMat(col));
    }
    m.castShadow = true;
    return m;
  }

  C.spawn = function (owner, kind, pos, vel, opts) {
    const o = opts || {};
    const p = {
      kind,
      owner,
      pos: pos.clone(),
      vel: vel.clone(),
      born: G.time,
      fuseAt: o.fuseAt || (kind === 'frag' ? G.time + 3.2 : kind === 'stun' ? G.time + 1.6 : kind === 'smoke' ? G.time + 1.4 : Infinity),
      stuck: null,
      rest: false,
      mesh: projMesh(kind),
      stats: o.stats || null,
      lastBounce: 0,
      beepAt: G.time + 0.5,
    };
    p.mesh.position.copy(p.pos);
    if (G.fx.scene) G.fx.scene.add(p.mesh);
    C.projectiles.push(p);
    return p;
  };

  function detonate(p) {
    const k = p.kind;
    const pos = p.pos;
    if (k === 'frag' || k === 'semtex') {
      C.explode(pos, 6.5, 210, p.owner, { weaponName: k === 'frag' ? 'Parçalı El Bombası' : 'Yapışkan Bomba', weaponId: k });
    } else if (k === 'rocket') {
      const s = p.stats;
      C.explode(pos, s.projectile.radius, s.projectile.dmg, p.owner, { weaponName: s.name, weaponId: s.id });
    } else if (k === 'plasma') {
      const s = p.stats;
      C.explode(pos, s.projectile.radius, s.projectile.dmg, p.owner, { weaponName: s.name, weaponId: s.id, plasma: true, noSelf: true });
    } else if (k === 'stun') {
      C.explode(pos, 9, 0, p.owner, { weaponName: 'Sersemletici', stun: true });
    } else if (k === 'smoke') {
      G.world.smokes.push({ x: pos.x, y: 1.2, z: pos.z, r: 5.5, t0: G.time, t1: G.time + 14 });
      G.fx.smokeCloud(new THREE.Vector3(pos.x, 0.2, pos.z), 14);
      G.audio.play('smoke', { pos });
    }
  }

  C.update = function (dt) {
    for (let i = C.pending.length - 1; i >= 0; i--) {
      if (G.time >= C.pending[i].at) {
        const f = C.pending[i].fn;
        C.pending.splice(i, 1);
        f();
      }
    }
    const world = G.world;
    if (!world) return;
    for (let i = C.projectiles.length - 1; i >= 0; i--) {
      const p = C.projectiles[i];
      let remove = false;
      if (p.stuck) {
        if (p.stuck.pos) p.pos.copy(p.stuck.pos).add(p.stuck.off);
      } else if (!p.rest) {
        const g = p.kind === 'knife' ? 5 : p.kind === 'rocket' || p.kind === 'plasma' ? 0 : 17;
        const steps = 2;
        const h = dt / steps;
        for (let s = 0; s < steps && !remove && !p.stuck; s++) {
          p.vel.y -= g * h;
          const step = p.vel.length() * h;
          if (step <= 0) break;
          const dx = p.vel.x / (step / h), dy = p.vel.y / (step / h), dz = p.vel.z / (step / h);
          const hit = world.raycast(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, step + 0.08);
          // karakter isabeti (roket, plazma, bıçak, yapışkan)
          if (p.kind !== 'frag' && p.kind !== 'smoke' && p.kind !== 'stun' && G.time - p.born > 0.04) {
            const list = hittables();
            for (const ch of list) {
              if (ch === p.owner || !ch.alive || !canHurt(p.owner, ch)) continue;
              const r = ch.hitTest(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, step + 0.1);
              if (r && (!hit || r.t < hit.t)) {
                if (p.kind === 'knife') {
                  ch.takeDamage(250, p.owner, { weapon: 'Fırlatma Bıçağı', weaponId: 'knife', headshot: r.part === 'head', dir: new THREE.Vector3(dx, dy, dz), point: p.pos.clone() });
                  G.fx.blood(p.pos.x, p.pos.y, p.pos.z, dx, dy, dz, 1);
                  remove = true;
                } else if (p.kind === 'semtex') {
                  p.stuck = { pos: ch.pos, off: new THREE.Vector3(0, 1.1, 0) };
                  p.fuseAt = Math.min(p.fuseAt, G.time + 2.4);
                  if (p.owner && p.owner.isPlayer) G.hud && G.hud.medal('Yapıştı!');
                } else {
                  p.pos.addScaledVector(new THREE.Vector3(dx, dy, dz), r.t);
                  detonate(p);
                  remove = true;
                }
                break;
              }
            }
            if (remove || p.stuck) break;
          }
          if (hit) {
            p.pos.set(hit.x + hit.nx * 0.06, hit.y + hit.ny * 0.06, hit.z + hit.nz * 0.06);
            if (p.kind === 'rocket' || p.kind === 'plasma') {
              detonate(p);
              remove = true;
            } else if (p.kind === 'knife') {
              p.rest = true;
              p.vel.set(0, 0, 0);
              p.removeAt = G.time + 4;
              G.audio.play('bounce', { pos: p.pos });
            } else if (p.kind === 'semtex') {
              p.stuck = { pos: null };
              p.vel.set(0, 0, 0);
              p.fuseAt = Math.min(p.fuseAt, G.time + 2.4);
              G.audio.play('bounce', { pos: p.pos });
            } else {
              // sekme
              const vn = p.vel.x * hit.nx + p.vel.y * hit.ny + p.vel.z * hit.nz;
              p.vel.x -= 1.6 * vn * hit.nx;
              p.vel.y -= 1.6 * vn * hit.ny;
              p.vel.z -= 1.6 * vn * hit.nz;
              p.vel.multiplyScalar(0.55);
              if (G.time - p.lastBounce > 0.08) {
                G.audio.play('bounce', { pos: p.pos, vol: 0.7 });
                p.lastBounce = G.time;
              }
              if (hit.ny > 0.7 && p.vel.length() < 1.2) {
                p.rest = true;
                p.vel.set(0, 0, 0);
              }
            }
            break;
          } else {
            p.pos.x += p.vel.x * h;
            p.pos.y += p.vel.y * h;
            p.pos.z += p.vel.z * h;
          }
        }
        if (p.kind === 'rocket' && !remove) G.fx.rocketTrail(p.pos);
        if (p.kind === 'plasma' && !remove) G.fx.plasmaTrail(p.pos);
        if (p.kind === 'knife') p.mesh.rotation.x += dt * 20;
        else if (!p.rest) {
          p.mesh.rotation.x += dt * 8;
          p.mesh.rotation.z += dt * 5;
        }
      }
      if (!remove && p.kind === 'rocket' && p.vel.lengthSq() > 0) p.mesh.lookAt(tmp.copy(p.pos).add(p.vel));
      if (!remove && (p.kind === 'frag' || p.kind === 'semtex') && G.time > p.beepAt) {
        p.beepAt = G.time + (p.fuseAt - G.time < 1 ? 0.25 : 0.6);
        if (p.kind === 'semtex') G.audio.play('beep', { pos: p.pos, vol: 0.6 });
      }
      if (!remove && G.time >= p.fuseAt) {
        detonate(p);
        remove = true;
      }
      if (!remove && (p.kind === 'rocket' || p.kind === 'plasma') && G.time - p.born > 4) {
        detonate(p);
        remove = true;
      }
      if (!remove && p.removeAt && G.time > p.removeAt) remove = true;
      if (remove) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        C.projectiles.splice(i, 1);
      } else {
        p.mesh.position.copy(p.pos);
      }
    }
  };

  // Hedefe atış için balistik hız (bot el bombası)
  C.ballistic = function (from, to, speed, g) {
    const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
    const d = Math.hypot(dx, dz);
    const v2 = speed * speed;
    const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
    if (disc < 0) return null;
    const ang = Math.atan((v2 + Math.sqrt(disc)) / (g * d)) > 1.2 ? Math.atan((v2 - Math.sqrt(disc)) / (g * d)) : Math.atan((v2 - Math.sqrt(disc)) / (g * d));
    const vx = (dx / d) * Math.cos(ang) * speed, vz = (dz / d) * Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
    return new THREE.Vector3(vx, vy, vz);
  };
})();
