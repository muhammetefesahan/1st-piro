'use strict';
// Gölge Timi — asker botları: algılama, yol bulma, çatışma, el bombası,
// bayrak ele geçirme, skor serisi çağırma.
(function () {
  const G = window.G;
  const U = G.util;

  const DIFF = {
    kolay: { react: [0.6, 1.0], sigma: 3.4, turn: 3.2, head: 0.06, dmg: 0.55, burst: [2, 4], pause: [0.45, 0.9], nade: 0.04 },
    normal: { react: [0.4, 0.7], sigma: 2.2, turn: 5.0, head: 0.12, dmg: 0.75, burst: [3, 6], pause: [0.3, 0.6], nade: 0.07 },
    zor: { react: [0.26, 0.46], sigma: 1.45, turn: 7.5, head: 0.2, dmg: 0.95, burst: [4, 8], pause: [0.2, 0.45], nade: 0.1 },
    veteran: { react: [0.17, 0.3], sigma: 0.95, turn: 10, head: 0.28, dmg: 1.1, burst: [5, 10], pause: [0.12, 0.3], nade: 0.13 },
  };
  G.BOT_DIFF = DIFF;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

  class Bot extends G.Character {
    constructor(o) {
      super({ team: o.team, name: o.name, health: o.health || 150 });
      this.isBot = true;
      this.diff = DIFF[o.difficulty] || DIFF.normal;
      this.diffName = o.difficulty;
      this.look = o.look != null ? o.look : o.team;
      this.setWeapon(o.weapon || G.weightedPick(G.BOT_WEAPONS));
      this.state = 'roam';
      this.target = null;
      this.lastKnown = null;
      this.lastSeenT = -99;
      this.reactAt = 0;
      this.aimErrYaw = 0;
      this.aimErrPitch = 0;
      this.path = null;
      this.pathI = 0;
      this.goal = null;
      this.repathAt = 0;
      this.thinkAt = Math.random() * 0.3;
      this.fireCD = 0;
      this.burstLeft = 0;
      this.reloadUntil = 0;
      this.strafeDir = 1;
      this.strafeUntil = 0;
      this.crouchUntil = 0;
      this.nadeCD = G.time + 8 + Math.random() * 10;
      this.stuckT = 0;
      this.lastPos = new THREE.Vector3();
      this.alertUntil = 0;
      this.objective = o.objective || null;
      this.holdUntil = 0;
      this.ally = !!o.ally;
      this.passive = !!o.passive;
      this.guard = o.guard || null; // hikâye: belirli noktayı bekle
    }

    setWeapon(id) {
      this.weaponId = id;
      this.wstats = G.computeStats(id, {});
      this.ammo = this.wstats.mag;
    }

    buildModel(scene) {
      const tag = this.ally ? G.spriteTex('chevron') : null;
      const ops = Object.keys(G.OPERATORS);
      const operator = this.look === 0 ? this.operator || (this.operator = ops[(this.id * 7) % ops.length]) : null;
      this.model = G.makeHumanoid({ kind: 'soldier', look: this.look, weapon: this.wstats, tag, operator });
      scene.add(this.model.root);
    }

    spawnAt(pos, yaw) {
      this.pos.copy(pos);
      this.vel.set(0, 0, 0);
      this.yaw = yaw || 0;
      this.alive = true;
      this.health = this.maxHealth;
      this.stance = 'stand';
      this.crouchT = 0;
      this.height = 1.8;
      this.state = 'roam';
      this.target = null;
      this.lastKnown = null;
      this.path = null;
      this.goal = null;
      this.ammo = this.wstats.mag;
      this.reloadUntil = 0;
      this.streak = 0;
      this.damageLog = [];
      this.stunUntil = 0;
      this.lastPos.copy(pos);
      if (this.model) {
        this.model.deathT = 0;
        this.model.root.position.y = 0;
        this.model.hips.rotation.set(0, 0, 0);
        this.model.root.visible = true;
      }
    }

    muzzlePos(out) {
      const o = out || new THREE.Vector3();
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const h = U.lerp(1.42, 0.98, this.crouchT);
      return o.set(this.pos.x + fx * 0.75 + rx * 0.12, this.pos.y + h, this.pos.z + fz * 0.75 + rz * 0.12);
    }

    onHurt(amount, attacker) {
      if (attacker && attacker.pos && attacker !== this) {
        this.alertUntil = G.time + 4;
        if (!this.target || !this.target.alive) {
          this.lastKnown = attacker.pos.clone();
          this.lastKnownT = G.time;
          // saldırgana dön
          const d = tmpA.subVectors(attacker.pos, this.pos);
          this.desiredYaw = Math.atan2(-d.x, -d.z);
        }
      }
    }

    hear(pos, loud) {
      if (!this.alive || (this.target && this.target.alive && G.time - this.lastSeenT < 1)) return;
      const d = this.pos.distanceTo(pos);
      if (d > (loud ? 48 : 12)) return;
      if (Math.random() < (loud ? 0.5 : 0.35)) {
        this.lastKnown = tmpA.set(pos.x + U.rand(-3, 3), 0, pos.z + U.rand(-3, 3)).clone();
        this.lastKnownT = G.time;
        if (this.state === 'roam') this.state = 'hunt';
        const dd = tmpB.subVectors(pos, this.pos);
        this.desiredYaw = Math.atan2(-dd.x, -dd.z);
      }
    }

    // ------------------------------------------------------------------
    update(dt) {
      const m = this.model;
      if (!this.alive) {
        if (m) m.animate(dt, { dead: true });
        return;
      }
      const game = G.game;
      const world = G.world;
      const stunned = G.time < this.stunUntil;

      // düşünme (algılama) aralıklı
      if (G.time >= this.thinkAt) {
        this.thinkAt = G.time + 0.16 + Math.random() * 0.08;
        this.perceive();
        this.decide();
      }

      // hedefe bakış
      let moveX = 0, moveZ = 0, speed = 0;
      const t = this.target;
      const engaging = t && t.alive && G.time - this.lastSeenT < 0.35;
      if (engaging) {
        const aim = this.aimPoint;
        const dx = aim.x - this.pos.x, dz = aim.z - this.pos.z;
        const ey = this.eyeHeight() + this.pos.y;
        const dist = Math.hypot(dx, dz);
        const wantYaw = Math.atan2(-dx, -dz) + this.aimErrYaw;
        const wantPitch = Math.atan2(aim.y - ey, dist) + this.aimErrPitch;
        const turn = this.diff.turn * (stunned ? 0.3 : 1);
        this.yaw += U.clamp(U.wrapAngle(wantYaw - this.yaw), -turn * dt, turn * dt);
        this.pitch = U.damp(this.pitch, wantPitch, 10, dt);
        // nişan hatası zamanla oturur
        const settle = Math.exp(-dt * 2.2);
        this.aimErrYaw *= settle;
        this.aimErrPitch *= settle;
        // çatışma hareketi: yana kayma, mesafe ayarı
        if (G.time > this.strafeUntil) {
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          if (Math.random() < 0.25) this.strafeDir = 0;
          this.strafeUntil = G.time + U.rand(0.5, 1.4);
          if (Math.random() < 0.18 && this.wstats.cls !== 'shotgun') this.crouchUntil = G.time + U.rand(1, 2.5);
        }
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        moveX = rx * this.strafeDir;
        moveZ = rz * this.strafeDir;
        const close = this.wstats.cls === 'shotgun' || this.wstats.cls === 'smg';
        if (close && dist > 9) {
          moveX += fx * 1.2;
          moveZ += fz * 1.2;
        } else if (!close && dist < 5) {
          moveX -= fx * 0.8;
          moveZ -= fz * 0.8;
        }
        speed = this.wstats.cls === 'sniper' ? 0.8 : 2.6;
        if (this.passive) speed = 0;
        this.tryFire(dt, dist);
      } else {
        if (this.desiredYaw != null) {
          this.yaw += U.clamp(U.wrapAngle(this.desiredYaw - this.yaw), -6 * dt, 6 * dt);
          if (Math.abs(U.wrapAngle(this.desiredYaw - this.yaw)) < 0.05) this.desiredYaw = null;
        }
        this.pitch = U.damp(this.pitch, 0, 5, dt);
        // yol takibi
        if (this.path && this.pathI < this.path.length) {
          const wp = this.path[this.pathI];
          const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.7) this.pathI++;
          else {
            moveX = dx / d;
            moveZ = dz / d;
            const far = this.state === 'roam' && G.time > this.alertUntil;
            speed = far ? 5.6 : 4.6;
            if (this.state === 'hunt') speed = 4.4;
            if (this.desiredYaw == null) {
              const wy = Math.atan2(-dx, -dz);
              this.yaw += U.clamp(U.wrapAngle(wy - this.yaw), -5 * dt, 5 * dt);
            }
          }
        }
        // eldeki şarjör az ise boşta doldur
        if (this.ammo < this.wstats.mag * 0.35 && G.time > this.reloadUntil && this.ammo < this.wstats.mag) this.startReload();
        if (this.passive) speed = 0;
      }
      if (stunned) speed *= 0.45;
      if (this.reloadUntil > G.time && engaging) speed = Math.min(speed, 2.2);

      // ayrışma (dost botlar üst üste binmesin)
      if (game) {
        for (const o of game.chars) {
          if (o === this || !o.alive) continue;
          const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 1.2 && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            moveX += (dx / d) * 0.8;
            moveZ += (dz / d) * 0.8;
          }
        }
      }
      const ml = Math.hypot(moveX, moveZ);
      if (ml > 1) {
        moveX /= ml;
        moveZ /= ml;
      }
      const tvx = moveX * speed, tvz = moveZ * speed;
      this.vel.x = U.damp(this.vel.x, tvx, 8, dt);
      this.vel.z = U.damp(this.vel.z, tvz, 8, dt);
      this.vel.y -= 20 * dt;
      // çömelme
      const wantCrouch = G.time < this.crouchUntil && engaging;
      this.crouchT = U.damp(this.crouchT, wantCrouch ? 1 : 0, 8, dt);
      this.height = wantCrouch ? 1.3 : 1.8;
      this.stance = wantCrouch ? 'crouch' : 'stand';
      const res = world.moveCharacter(this, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
      if (this.grounded) this.vel.y = 0;
      if (res.hitWall && !engaging) this.repathAt = Math.min(this.repathAt, G.time + 0.3);

      // takılma algısı
      this.stuckT += dt;
      if (this.stuckT > 1.5) {
        if (speed > 1 && this.pos.distanceTo(this.lastPos) < 0.6 && !engaging) {
          this.path = null;
          this.goal = null;
          this.repathAt = 0;
          const c = world.randomWalkable();
          if (c) this.goal = world.cellCenter(c[0], c[1]);
        }
        this.stuckT = 0;
        this.lastPos.copy(this.pos);
      }

      // ayak sesi (oyuncu duyabilsin)
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > 1.5) {
        this.stepAcc = (this.stepAcc || 0) + hs * dt;
        if (this.stepAcc > 2.6) {
          this.stepAcc = 0;
          G.audio.play('step', { pos: this.pos, vol: 0.6, ref: 6 });
        }
      }

      if (m) {
        m.root.position.set(this.pos.x, this.pos.y, this.pos.z);
        m.root.rotation.y = this.yaw;
        m.animate(dt, { speed: hs, crouch: this.crouchT, pitch: this.pitch, reload: this.reloadUntil > G.time });
      }
    }

    // ------------------------------------------------------------------
    perceive() {
      const game = G.game;
      const world = G.world;
      if (!game) return;
      const eye = this.eye(tmpA);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      let best = null, bestScore = Infinity, bestPoint = null;
      const alert = G.time < this.alertUntil;
      const fovCos = alert ? -0.2 : Math.cos(62 * U.DEG);
      const targets = game.targetsFor ? game.targetsFor(this) : game.hittables();
      for (const h of targets) {
        if (h === this || !h.alive || !game.canHurt(this, h)) continue;
        if (h.untargetable) continue;
        const c = h.chest ? h.chest(tmpB) : tmpB.copy(h.pos);
        const dx = c.x - eye.x, dz = c.z - eye.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 85) continue;
        const cos = (dx * fx + dz * fz) / (dist || 1);
        const isCurrent = h === this.target;
        if (cos < fovCos && dist > 5 && !isCurrent) continue;
        // görüş hattı: göğüs veya baş
        let pt = null;
        if (world.los(eye.x, eye.y, eye.z, c.x, c.y, c.z)) pt = c.clone();
        else if (h.headPos) {
          const hp = h.headPos(tmpC);
          if (world.los(eye.x, eye.y, eye.z, hp.x, hp.y, hp.z)) pt = hp.clone();
        }
        if (!pt) continue;
        // uzakta çömelmiş/yüzüstü hedefi fark etmek zor
        if (h.stance === 'prone' && dist > 25 && !isCurrent && Math.random() < 0.6) continue;
        let score = dist * (isCurrent ? 0.6 : 1) * (cos > 0.9 ? 0.8 : 1);
        if (h.isEnt) score *= 1.6;
        if (score < bestScore) {
          bestScore = score;
          best = h;
          bestPoint = pt;
        }
      }
      if (best) {
        if (best !== this.target || G.time - this.lastSeenT > 1.2) {
          // yeni hedef: tepki süresi + başlangıç nişan hatası
          this.reactAt = G.time + U.rand(this.diff.react[0], this.diff.react[1]) * (alert ? 0.7 : 1);
          const e = (this.diff.sigma * 2.2 + 3) * U.DEG;
          this.aimErrYaw = U.gauss() * e;
          this.aimErrPitch = U.gauss() * e * 0.5;
          this.burstLeft = 0;
        }
        this.target = best;
        this.lastSeenT = G.time;
        this.lastKnown = best.pos.clone();
        this.lastKnownT = G.time;
        this.aimPoint = bestPoint;
        this.state = 'engage';
        this.alertUntil = G.time + 3;
      } else if (this.target) {
        if (G.time - this.lastSeenT > 0.35) {
          this.state = 'hunt';
          if (!this.target.alive) {
            this.target = null;
            this.state = 'roam';
          }
        }
      }
    }

    decide() {
      const world = G.world;
      const game = G.game;
      if (this.state === 'engage' && G.time - this.lastSeenT < 0.35) {
        // görünmeyen bir yerdeysek el bombası
        return;
      }
      // el bombası: son bilinen konuma
      if (this.lastKnown && G.time - this.lastKnownT < 4 && G.time > this.nadeCD && !this.passive) {
        const d = this.pos.distanceTo(this.lastKnown);
        if (d > 7 && d < 28 && Math.random() < this.diff.nade * 3) {
          this.throwNade(this.lastKnown);
        }
      }
      if (this.passive || this.guard) {
        if (this.guard && this.state !== 'engage') {
          const gd = this.pos.distanceTo(this.guard);
          if (gd > 3 && (!this.path || G.time > this.repathAt)) {
            this.path = world.path(this.pos.x, this.pos.z, this.guard.x, this.guard.z);
            this.pathI = 0;
            this.repathAt = G.time + 3;
          }
          if (this.lastKnown && G.time - this.lastKnownT < 6 && this.pos.distanceTo(this.lastKnown) < 20 && G.time > this.repathAt) {
            this.path = world.path(this.pos.x, this.pos.z, this.lastKnown.x, this.lastKnown.z);
            this.pathI = 0;
            this.repathAt = G.time + 2.5;
          }
        }
        return;
      }
      if (this.state === 'hunt' && this.lastKnown && G.time - this.lastKnownT < 9) {
        if (!this.path || G.time > this.repathAt || this.goalKind !== 'hunt') {
          this.path = world.path(this.pos.x, this.pos.z, this.lastKnown.x, this.lastKnown.z);
          this.pathI = 0;
          this.goalKind = 'hunt';
          this.repathAt = G.time + 2.5;
        }
        if (this.pos.distanceTo(this.lastKnown) < 1.5) {
          this.lastKnown = null;
          this.state = 'roam';
        }
        return;
      }
      this.state = 'roam';
      if (!this.path || this.pathI >= this.path.length || G.time > this.repathAt || this.goalKind !== 'roam') {
        const goal = game && game.botGoal ? game.botGoal(this) : null;
        let g = goal;
        if (!g) {
          const c = world.randomWalkable();
          if (c) g = world.cellCenter(c[0], c[1]);
        }
        if (g) {
          this.path = world.path(this.pos.x, this.pos.z, g.x, g.z);
          this.pathI = 0;
          this.goal = g;
          this.goalKind = 'roam';
          this.repathAt = G.time + (goal && goal.hold ? 2 : 6 + Math.random() * 4);
        }
      }
    }

    startReload() {
      if (this.reloadUntil > G.time) return;
      this.reloadUntil = G.time + this.wstats.reload * 1.1;
      this.ammo = 0;
      this.pendingReload = true;
      G.audio.play('magOut', { pos: this.pos, vol: 0.6, ref: 5 });
    }

    tryFire(dt, dist) {
      this.fireCD -= dt;
      if (this.reloadUntil > G.time) return;
      if (this.pendingReload) {
        this.pendingReload = false;
        this.ammo = this.wstats.mag;
      }
      if (G.time < this.reactAt) return;
      if (this.ammo <= 0) {
        this.startReload();
        return;
      }
      const s = this.wstats;
      if (dist > 20 && s.cls === 'shotgun') return;
      // bakış hedefe yeterince yakın mı
      const aim = this.aimPoint;
      const want = Math.atan2(-(aim.x - this.pos.x), -(aim.z - this.pos.z));
      if (Math.abs(U.wrapAngle(want - this.yaw)) > 0.35) return;
      if (this.fireCD > 0) return;
      if (this.burstLeft <= 0) {
        const close = dist < 12;
        this.burstLeft = s.mode === 'auto' ? (close ? U.randInt(5, 10) : U.randInt(this.diff.burst[0], this.diff.burst[1])) : s.mode === 'burst' ? 3 : 1;
      }
      this.shoot(dist);
      this.burstLeft--;
      let cd = s.interval;
      if (s.bolt) cd = Math.max(cd, 1.4);
      if (s.mode === 'semi') cd = Math.max(cd, s.cls === 'pistol' ? 0.28 : s.cls === 'dmr' ? 0.38 : cd) * U.rand(1, 1.6);
      if (this.burstLeft <= 0) cd += U.rand(this.diff.pause[0], this.diff.pause[1]) * (dist < 12 ? 0.4 : 1);
      this.fireCD = cd;
    }

    shoot(dist) {
      const s = this.wstats;
      this.ammo--;
      const eye = this.eye(new THREE.Vector3());
      const t = this.target;
      // hedef noktası: göğüs ya da baş
      const aimP = t.headPos && Math.random() < this.diff.head ? t.headPos(new THREE.Vector3()) : this.aimPoint.clone();
      const dir = aimP.sub(eye).normalize();
      // hata: zorluk, mesafe, hedef hızı, sersemleme
      const tv = t.vel ? Math.hypot(t.vel.x, t.vel.z) : 0;
      let sigma = this.diff.sigma * (1 + dist / 45) * (1 + tv * 0.08) * (Math.hypot(this.vel.x, this.vel.z) > 1 ? 1.25 : 1);
      if (G.time < this.stunUntil) sigma *= 3;
      if (t.stance === 'prone') sigma *= 1.3;
      if (t.slideT > 0 || t.diving) sigma *= 1.5;
      if (G.game && G.game.botAccuracyMul) sigma *= G.game.botAccuracyMul(this, t);
      const yawErr = U.gauss() * sigma * U.DEG + this.aimErrYaw * 0.5;
      const pitchErr = U.gauss() * sigma * 0.6 * U.DEG + this.aimErrPitch * 0.5;
      const cosY = Math.cos(yawErr), sinY = Math.sin(yawErr);
      const dx = dir.x * cosY - dir.z * sinY;
      const dz = dir.x * sinY + dir.z * cosY;
      dir.set(dx, dir.y + pitchErr, dz).normalize();
      const muzzle = this.muzzlePos();
      G.combat.fire(this, eye, dir, s, {
        spread: 0,
        dmgMul: this.diff.dmg * (G.game && G.game.botDamageMul ? G.game.botDamageMul(this) : 1),
        tracerFrom: muzzle,
        tracerColor: this.team === 0 ? 0x9fdcff : 0xffb070,
      });
      G.audio.shot(s.sound, this.pos, { suppressed: s.suppressed });
      G.fx.muzzle(muzzle, dir, s.cls === 'shotgun' || s.cls === 'sniper');
      if (this.model) this.model.kick = 1;
      if (G.game && G.game.onShot) G.game.onShot(this, s);
    }

    throwNade(target) {
      this.nadeCD = G.time + 14 + Math.random() * 14;
      const from = this.eye(new THREE.Vector3());
      const to = target.clone();
      to.y = 0.3;
      const v = G.combat.ballistic(from, to, 15, 17);
      if (!v) return;
      G.combat.spawn(this, 'frag', from, v, { fuseAt: G.time + 2.6 });
      G.audio.play('pin', { pos: this.pos, vol: 0.6 });
    }

    onDeath() {
      this.path = null;
      this.target = null;
    }
  }
  G.Bot = Bot;
})();
