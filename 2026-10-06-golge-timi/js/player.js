'use strict';
// Gölge Timi — oyuncu: her yöne hareket (koşu, taktik koşu, kayma, dalış,
// tırmanma), silah kullanımı, el bombaları, çay/simit, etkileşim.
(function () {
  const G = window.G;
  const U = G.util;
  const IN = G.input;
  const v3 = () => new THREE.Vector3();
  // dokunmatik yardımcı nişan için tekrar kullanılan vektörler (karede ayırma yok)
  const _aFwd = new THREE.Vector3(), _aC = new THREE.Vector3(), _aD = new THREE.Vector3();

  const H_STAND = 1.8, H_CROUCH = 1.3, H_PRONE = 0.7, H_SLIDE = 1.1;

  G.makeWeaponInst = function (id, att, opts) {
    const o = opts || {};
    const stats = G.computeStats(id, att, { upgraded: o.upgraded, camo: o.camo });
    let reserve = stats.reserve;
    if (o.extraMags) reserve += stats.mag * o.extraMags;
    return { id, att: att || {}, stats, ammo: stats.mag, reserve, upgraded: !!o.upgraded };
  };

  class Player extends G.Character {
    constructor(name) {
      super({ team: 0, name, isPlayer: true, health: 150 });
      this.weapons = [null, null];
      this.cur = 0;
      this.perks = new Set();
      this.zmPerks = new Set();
      this.lethal = 'frag';
      this.tactical = 'stun';
      this.lethalCount = 1;
      this.tacticalCount = 1;
      this.cay = 1;
      this.simit = 1;
      this.cayUntil = 0;
      this.adsT = 0;
      this.fireCD = 0;
      this.burstLeft = 0;
      this.burstCD = 0;
      this.sprintFireT = 0;
      this.bloom = 0;
      this.reload = null;
      this.switching = 0;
      this.busy = 0; // bıçak / atış / içme
      this.busyType = null;
      this.cook = null;
      this.sprinting = false;
      this.tacSprint = false;
      this.stamina = 3;
      this.lastSprintTap = -9;
      this.slideT = 0;
      this.slideCD = 0;
      this.diving = false;
      this.mantle = null;
      this.eyeH = 1.62;
      this.stepAcc = 0;
      this.lookDX = 0;
      this.lookDY = 0;
      this.hSpeed = 0;
      this.sprintT = 0;
      this.roll = 0;
      this.landDip = 0;
      this.streakPts = 0;
      this.killsLife = 0;
      this.points = 0; // zombi puanı
      this.deathCam = null;
      this.prone = false;
      this.crouching = false;
      this.recoilVis = 0;
      this.interaction = null;
      this.flinch = 0;
      this.stunFx = 0;
      this.healthMax0 = 150;
      this.vm = null;
    }

    get weapon() {
      return this.weapons[this.cur];
    }

    applyLoadout(cls, opts) {
      const o = opts || {};
      this.loadout = cls;
      this.perks = new Set(cls.perks || []);
      const extra = this.perks.has('cephane') ? 2 : 0;
      this.weapons = [G.makeWeaponInst(cls.primary, cls.pAtt, { extraMags: extra, camo: cls.pCamo }), cls.secondary ? G.makeWeaponInst(cls.secondary, cls.sAtt, { extraMags: extra, camo: cls.sCamo }) : null];
      this.meleeId = G.MELEE[cls.melee] ? cls.melee : 'bicak';
      if (this.vm) this.vm.setMelee(this.meleeId);
      this.lethal = cls.lethal;
      this.tactical = cls.tactical;
      this.lethalCount = 1 + (this.perks.has('cephane') ? 1 : 0);
      this.tacticalCount = cls.tactical === 'smoke' ? 1 : 2;
      this.cur = 0;
      if (!o.keepView) this.equip(0, true);
    }

    equip(i, instant) {
      if (!this.weapons[i]) return;
      this.cur = i;
      this.reload = null;
      this.burstLeft = 0;
      const s = this.weapon.stats;
      this.switching = instant ? 0.2 : s.swap * this.handMult();
      if (this.vm) this.vm.setWeapon(s);
      if (!instant) G.audio.play('swap');
    }

    handMult() {
      let m = 1;
      if (this.perks.has('hizlieller')) m *= 0.65;
      if (this.zmPerks.has('hizliel')) m *= 0.5;
      if (G.time < this.cayUntil) m *= 0.75;
      return m;
    }

    spawn(pos, yaw) {
      this.pos.copy(pos);
      this.vel.set(0, 0, 0);
      this.yaw = yaw || 0;
      this.pitch = 0;
      this.alive = true;
      this.maxHealth = this.zmPerks.has('demirderi') ? 300 : this.healthMax0;
      this.health = this.maxHealth;
      this.stance = 'stand';
      this.crouchT = 0;
      this.height = H_STAND;
      this.prone = false;
      this.crouching = false;
      this.slideT = 0;
      this.diving = false;
      this.mantle = null;
      this.reload = null;
      this.cook = null;
      this.busy = 0;
      this.deathCam = null;
      this.streakPts = 0;
      this.killsLife = 0;
      this.damageLog = [];
      this.stunUntil = 0;
      this.lastHurt = -99;
      this.spawnedAt = G.time;
      if (this.loadout && G.game && G.game.mode !== 'zm') {
        this.applyLoadout(this.loadout, { keepView: true });
      }
      if (G.game && G.game.mode !== 'zm') {
        this.cay = 1;
        this.simit = 1;
      }
      if (this.weapon && this.vm) this.vm.setWeapon(this.weapon.stats);
      this.vm && (this.vm.hidden = false);
    }

    // ---------------- Hasar ----------------
    onHurt(amount, attacker, info) {
      G.audio.play('hurt', { priority: true });
      const resist = this.perks.has('sogukkanli') ? 0.35 : 1;
      this.flinch += (0.012 + amount * 0.0003) * resist;
      if (attacker && attacker.pos) G.hud && G.hud.damageFrom(attacker.pos);
      else if (info && info.from) G.hud && G.hud.damageFrom(info.from);
      G.fx.shake(info && info.explosive ? 0.5 : 0.12);
    }
    onStun(k) {
      this.stunFx = Math.max(this.stunFx, 2 + k * 2.5);
      G.audio.play('tinnitus', { priority: true });
    }
    onHitTarget(target, part, killed, info, dmg) {
      if (G.hud) G.hud.hitmarker(killed, part === 'head', target.isEnt);
      if (killed) G.audio.play(part === 'head' ? 'headshot' : 'kill', { priority: true });
      else G.audio.play(part === 'head' ? 'headshot' : 'hit', { priority: true, vol: 0.8 });
      if (this.perks.has('isaretci') && target.spotted != null) target.spotted = Math.max(target.spotted, G.time + 5);
    }
    onDeath(attacker, info) {
      if (G.isTouch && G.haptic) G.haptic([60, 40, 90], true);
      this.deathCam = { t: 0, killer: attacker && attacker.pos ? attacker : null, startPitch: this.pitch };
      this.reload = null;
      this.cook = null;
      if (this.vm) this.vm.hidden = true;
      if (this.cook) this.cook = null;
    }

    // ---------------- Ana döngü ----------------
    update(dt) {
      const cam = G.camera;
      if (!this.alive) {
        this.updateDeathCam(dt, cam);
        return;
      }
      const world = G.world;
      const s = this.weapon ? this.weapon.stats : null;
      const sens = G.settings.sens * (G.isTouch ? G.settings.touchSens : 1);
      const zoom = s ? 1 + (s.zoom - 1) * this.adsT : 1;
      const adsMul = this.adsT > 0.5 ? G.settings.adsSens / zoom : 1;
      const stunned = G.time < this.stunUntil;
      const lookMul = 0.0022 * sens * adsMul * (stunned ? 0.35 : 1);
      this.lookDX = IN.dx;
      this.lookDY = IN.dy;
      if (G.isTouch) {
        // dokunmatik: hedef üzerindeyken bakış yavaşlar (sürtünme), jiroskop farkı eklenir
        const fr = this.assistFr || 1;
        this.yaw -= IN.dx * lookMul * fr;
        this.pitch -= IN.dy * lookMul * fr * (G.settings.invertY ? -1 : 1);
        if (IN.gyroYaw || IN.gyroPitch) {
          const gm = (G.settings.gyroSens || 1) * (this.adsT > 0.5 ? 0.6 / zoom : 1) * (stunned ? 0.35 : 1);
          this.yaw += IN.gyroYaw * gm;
          this.pitch += IN.gyroPitch * gm * (G.settings.invertY ? -1 : 1);
        }
      } else {
        this.yaw -= IN.dx * lookMul;
        this.pitch -= IN.dy * lookMul * (G.settings.invertY ? -1 : 1);
      }
      // sarsılma
      if (this.flinch > 0) {
        this.pitch += this.flinch * (Math.random() * 0.8 + 0.2);
        this.yaw += this.flinch * (Math.random() - 0.5);
        this.flinch = 0;
      }
      this.pitch = U.clamp(this.pitch, -1.5, 1.5);
      this.aimAssist(dt);

      this.updateMovement(dt, s);
      this.updateWeapon(dt, s);
      this.updateItems(dt);
      this.regen(dt, this.regenDelay(), G.time < this.cayUntil ? 90 : 60);

      // etkileşim
      this.interaction = G.game && G.game.findInteraction ? G.game.findInteraction(this) : null;
      if (this.interaction && this.interaction.hold) {
        if (IN.down('use')) this.interaction.holdUpdate(dt);
        else if (G.game.interactProg) G.game.interactProg = Math.max(0, G.game.interactProg - dt * 0.5);
      } else if (this.interaction && IN.hit('use')) this.interaction.action();

      // skor serileri
      if (G.streaks) {
        if (IN.hit('s1')) G.streaks.activate(0);
        if (IN.hit('s2')) G.streaks.activate(1);
        if (IN.hit('s3')) G.streaks.activate(2);
        if (IN.hit('s4')) G.streaks.activate(3);
      }
      this.updateCamera(dt, cam, s);
      if (this.vm) this.vm.update(dt, this);
      // ses dinleyicisi
      const L = G.audio.listener;
      L.x = cam.position.x;
      L.y = cam.position.y;
      L.z = cam.position.z;
      L.yaw = this.yaw;
      // düşük sağlıkta boğuk ses + kalp atışı
      const hp = this.health / this.maxHealth;
      G.audio.setMuffle(hp < 0.35 ? (0.35 - hp) * 2 : stunned ? 0.6 : 0);
      if (hp < 0.3 && G.time > (this.nextBeat || 0)) {
        this.nextBeat = G.time + 0.85;
        G.audio.play('heartbeat', { priority: true, vol: 0.8 });
      }
      this.stunFx = Math.max(0, this.stunFx - dt);
    }

    regenDelay() {
      let d = 4.5;
      if (this.perks.has('toparlanma')) d = 2.5;
      if (G.time < this.cayUntil) d = Math.min(d, 2);
      return d;
    }

    // Dokunmatik yardımcı nişan (yalnızca dokunmatik): hedef yakınında bakış yavaşlar,
    // nişangâh hafifçe hedefe çekilir; otomatik ateş için "nişangâh hedefte" bilgisini üretir.
    aimAssist(dt) {
      this.assistFr = 1;
      this.autoFireOn = false;
      if (!G.isTouch || !G.game || !this.alive) return;
      const cam = G.camera;
      const fwd = _aFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const ads = this.adsT > 0.5;
      const cone = (ads ? 10 : 7.5) * U.DEG;
      let best = null, bestS = 1, bestA = 0, bestDist = 0, bx = 0, by = 0, bz = 0;
      const list = G.game.hittables();
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        // atış poligonu hedefleri dahil (yalnızca kalkıkken); seri araçları hariç
        if (!h.alive || h === this || !h.chest || !G.game.canHurt(this, h)) continue;
        if (h.isEnt && !(h.isRangeTarget && h.active && h.up >= 0.8)) continue;
        const c = h.chest(_aC);
        const d = _aD.copy(c).sub(cam.position);
        const dist = d.length();
        if (dist > 65 || dist < 0.3) continue;
        d.multiplyScalar(1 / dist);
        // hedefin açısal yarıçapını düş: yakındaki hedefler daha geniş yakalanır
        const a = Math.max(0, Math.acos(U.clamp(d.dot(fwd), -1, 1)) - Math.atan(0.3 / dist));
        const sc = a / cone;
        if (sc < bestS && G.world.los(cam.position.x, cam.position.y, cam.position.z, c.x, c.y, c.z)) {
          bestS = sc;
          best = h;
          bestA = a;
          bestDist = dist;
          bx = d.x;
          by = d.y;
          bz = d.z;
        }
      }
      if (!best) return;
      const close = 1 - bestS; // 0..1
      // sürtünme: hedefin üstünde parmak hareketi daha az döndürür
      this.assistFr = 1 - close * (ads ? 0.6 : 0.45);
      // mıknatıs: yumuşak çekim (nişanda ve ateş ederken biraz daha güçlü)
      const firing = IN.down('fire');
      // mıknatıs yalnızca oyuncu bir şey yaparken (bakış, yürüme, ateş, nişan) çalışır:
      // parmaklar ekrandan kalkınca kamera kendi kendine düşmana dönmez
      if (ads || firing || IN.dx || IN.dy || this.hSpeed > 0.5) {
        const rate = (ads ? 3.2 : 1.1) * close + (firing ? 0.8 : 0) + (ads ? 0.6 : 0);
        const pull = Math.min(1, dt * rate);
        const ty = Math.atan2(-bx, -bz);
        const tp = Math.asin(U.clamp(by, -1, 1));
        this.yaw += U.wrapAngle(ty - this.yaw) * pull;
        this.pitch += (tp - this.pitch) * pull;
      }
      // otomatik ateş: nişangâh gövdenin üzerinde mi?
      if (G.settings.touchAutoFire && bestA < 1.2 * U.DEG + Math.atan(0.12 / bestDist)) {
        const s = this.weapon && this.weapon.stats;
        const needAds = s && s.cls === 'sniper' && this.adsT < 0.8;
        if (s && !needAds && s.cls !== 'launcher' && !(G.streaks && G.streaks.targeting)) this.autoFireOn = true;
      }
    }

    // ---------------- Hareket ----------------
    updateMovement(dt, s) {
      const world = G.world;
      let ix = 0, iz = 0;
      if (IN.down('fwd')) iz += 1;
      if (IN.down('back')) iz -= 1;
      if (IN.down('left')) ix -= 1;
      if (IN.down('right')) ix += 1;
      if (IN.touch.moveX != null) {
        ix += IN.touch.moveX;
        iz += IN.touch.moveY;
      }
      const ilen = Math.hypot(ix, iz);
      if (ilen > 1) {
        ix /= ilen;
        iz /= ilen;
      }
      const moving = ilen > 0.1;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const wx = fx * iz + rx * ix, wz = fz * iz + rz * ix;

      // koşu: her yöne (omni-hareket); çift basış = taktik koşu
      if (IN.hit('sprint')) {
        if (G.time - this.lastSprintTap < 0.32 && this.stamina > 0.5) this.tacSprint = true;
        this.lastSprintTap = G.time;
        if (this.prone) this.setStance('crouch');
      }
      const wantSprint = (IN.down('sprint') || IN.touch.sprint) && moving && !this.prone && this.slideT <= 0;
      const blockSprint = this.adsT > 0.3 || IN.down('fire') || this.autoFireOn || this.cook || this.busyType === 'drink';
      const wasSprinting = this.sprinting;
      this.sprinting = wantSprint && !blockSprint && this.grounded !== false;
      if (this.sprinting && this.crouching) this.setStance('stand');
      if (!this.sprinting) this.tacSprint = false;
      const tacDur = this.perks.has('ceviklik') || this.zmPerks.has('cevikbacak') ? 6 : 3;
      if (this.tacSprint) {
        if (!this.zmPerks.has('cevikbacak')) this.stamina -= dt;
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.tacSprint = false;
        }
      } else if (G.time - this.lastSprintTap > 1.5) {
        this.stamina = Math.min(tacDur, this.stamina + dt * 0.6);
      }
      if (wasSprinting && !this.sprinting) this.sprintFireT = s ? s.sprintFire * (this.tacSprint ? 1.6 : 1) * (this.perks.has('ceviklik') ? 0.7 : 1) : 0.2;
      this.sprintT = U.damp(this.sprintT, this.sprinting ? 1 : 0, 12, dt);

      // duruş tuşları
      if (IN.hit('crouch')) {
        if (this.sprinting && this.grounded && this.hSpeed > 4.5 && this.slideCD <= 0) this.startSlide();
        else if (this.slideT > 0) this.endSlide();
        else if (this.prone) this.setStance('crouch');
        else this.setStance(this.crouching ? 'stand' : 'crouch');
      }
      if (IN.hit('prone')) {
        if (this.sprinting && this.grounded) this.startDive(wx, wz);
        else if (this.prone) this.setStance('stand');
        else if (this.grounded) this.setStance('prone');
      }
      // zıplama / tırmanma
      if (IN.hit('jump')) {
        if (this.prone) this.setStance('crouch');
        else if (this.tryMantle(true)) {
          /* tırmanıyor */
        } else if (this.grounded) {
          if (this.crouching && this.slideT <= 0) this.setStance('stand');
          if (this.slideT > 0) this.endSlide();
          this.vel.y = 7.1;
          this.grounded = false;
        }
      }
      if (this.mantle) {
        this.mantle.t += dt;
        const k = U.clamp(this.mantle.t / this.mantle.dur, 0, 1);
        const e = k * k * (3 - 2 * k);
        this.pos.lerpVectors(this.mantle.from, this.mantle.to, e);
        this.pos.y = U.lerp(this.mantle.from.y, this.mantle.to.y, Math.min(1, e * 1.6));
        this.vel.set(0, 0, 0);
        if (k >= 1) {
          this.mantle = null;
          this.grounded = true;
        }
        this.hSpeed = 0;
        return;
      }
      if (!this.grounded && !this.diving && moving && iz > 0.3 && this.vel.y < 4) this.tryMantle(false);

      // hız hedefi
      let speed = 4.7 * (s ? s.move : 1);
      if (this.prone) speed = 1.15;
      else if (this.crouching) speed = 2.6;
      if (this.sprinting) speed = (this.tacSprint ? 7.8 : 6.5) * (s ? Math.min(1.02, s.move + 0.05) : 1);
      if (this.adsT > 0.1) speed *= U.lerp(1, s ? s.adsMove : 0.65, this.adsT);
      if (iz < -0.2 && !this.sprinting) speed *= 0.88;
      if (G.time < this.cayUntil) speed *= 1.08;
      if (this.zmPerks.has('cevikbacak')) speed *= 1.07;
      if (G.time < this.stunUntil) speed *= 0.5;
      if (this.busyType === 'drink' || this.busyType === 'eat') speed *= 0.75;

      if (this.slideT > 0) {
        this.slideT -= dt;
        const k = Math.exp(-1.7 * dt);
        this.vel.x *= k;
        this.vel.z *= k;
        // hafif yönlendirme
        this.vel.x += wx * dt * 3;
        this.vel.z += wz * dt * 3;
        if (this.slideT <= 0) this.endSlide();
      } else if (this.diving) {
        // havada süzül
      } else {
        const tx = wx * speed, tz = wz * speed;
        const rate = this.grounded ? 12 : 2.2;
        this.vel.x = U.damp(this.vel.x, tx, rate, dt);
        this.vel.z = U.damp(this.vel.z, tz, rate, dt);
      }
      this.slideCD -= dt;
      this.vel.y -= (this.diving ? 16 : 20) * dt;
      const wasGrounded = this.grounded;
      const vy = this.vel.y;
      world.moveCharacter(this, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
      if (this.grounded) {
        if (!wasGrounded) {
          if (vy < -6) {
            G.audio.play('land', { vol: U.clamp(-vy / 12, 0.3, 1) });
            this.landDip = Math.min(0.25, -vy * 0.015);
          }
          if (this.diving) {
            this.diving = false;
            this.setStance('prone', true);
            G.fx.shake(0.15);
          }
        }
        this.vel.y = Math.max(this.vel.y, 0);
      }
      this.hSpeed = Math.hypot(this.vel.x, this.vel.z);

      // ayak sesleri
      if (this.grounded && this.hSpeed > 1 && this.slideT <= 0) {
        this.stepAcc += this.hSpeed * dt;
        const stride = this.sprinting ? 2.9 : this.crouching ? 1.7 : 2.3;
        if (this.stepAcc > stride) {
          this.stepAcc = 0;
          const vol = this.crouching || this.prone ? 0.25 : this.sprinting ? 0.75 : 0.5;
          G.audio.play('step', { vol });
          if (G.game && G.game.onFootstep && !this.perks.has('ninja') && !this.crouching) G.game.onFootstep(this);
        }
      }

      // duruş yüksekliği
      const targetCrouch = this.crouching || this.slideT > 0 ? 1 : 0;
      this.crouchT = U.damp(this.crouchT, targetCrouch, 14, dt);
      let eye = 1.62;
      if (this.prone) eye = 0.45;
      else if (this.slideT > 0) eye = 0.85;
      else if (this.diving) eye = 1.05;
      else if (this.crouching) eye = 1.12;
      this.eyeH = U.damp(this.eyeH, eye, 12, dt);
    }

    setStance(st, force) {
      const world = G.world;
      const target = st === 'prone' ? H_PRONE : st === 'crouch' ? H_CROUCH : H_STAND;
      if (!force && target > this.height && !world.spaceFree(this.pos.x, this.pos.y + 0.02, this.pos.z, this.radius - 0.02, target)) {
        // ayağa kalkamıyor: bir kademe dene
        if (st === 'stand' && world.spaceFree(this.pos.x, this.pos.y + 0.02, this.pos.z, this.radius - 0.02, H_CROUCH)) st = 'crouch';
        else return;
      }
      this.prone = st === 'prone';
      this.crouching = st === 'crouch';
      this.stance = st;
      this.height = st === 'prone' ? H_PRONE : st === 'crouch' ? H_CROUCH : H_STAND;
      if (this.prone) this.sprinting = false;
    }

    startSlide() {
      const sp = Math.max(this.hSpeed, 8.4) + 0.6;
      const d = Math.hypot(this.vel.x, this.vel.z) || 1;
      this.vel.x = (this.vel.x / d) * sp;
      this.vel.z = (this.vel.z / d) * sp;
      this.slideT = 0.75;
      this.slideCD = 1.0;
      this.sprinting = false;
      this.tacSprint = false;
      this.height = H_SLIDE;
      this.stance = 'crouch';
      this.crouching = false;
      G.audio.play('slide');
    }
    endSlide() {
      this.slideT = 0;
      this.setStance('crouch', true);
    }
    startDive(wx, wz) {
      let dx = wx, dz = wz;
      const l = Math.hypot(dx, dz);
      if (l < 0.1) {
        dx = -Math.sin(this.yaw);
        dz = -Math.cos(this.yaw);
      } else {
        dx /= l;
        dz /= l;
      }
      this.vel.set(dx * 8.4, 3.8, dz * 8.4);
      this.grounded = false;
      this.diving = true;
      this.sprinting = false;
      this.tacSprint = false;
      this.height = 1.0;
      this.stance = 'crouch';
      G.audio.play('whoosh');
    }

    tryMantle(fromJump) {
      const world = G.world;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const px = this.pos.x + fx * 0.7, pz = this.pos.z + fz * 0.7;
      let top = -1;
      world.forBoxesInRect(px - 0.05, pz - 0.05, px + 0.05, pz + 0.05, (b) => {
        if (b.clip) return;
        if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1 && b.y0 <= this.pos.y + 0.6) {
          if (b.y1 > top) top = b.y1;
        }
      });
      if (top < 0) return false;
      const rise = top - this.pos.y;
      const minRise = fromJump ? 0.75 : 0.4;
      if (rise < minRise || rise > 2.05) return false;
      const tx = this.pos.x + fx * 0.9, tz = this.pos.z + fz * 0.9;
      if (!world.spaceFree(tx, top + 0.02, tz, this.radius - 0.05, H_CROUCH)) return false;
      const standFree = world.spaceFree(tx, top + 0.02, tz, this.radius - 0.05, H_STAND);
      this.mantle = { t: 0, dur: 0.22 + rise * 0.12, from: this.pos.clone(), to: new THREE.Vector3(tx, top + 0.01, tz) };
      if (!standFree) this.setStance('crouch', true);
      else if (this.crouching) this.setStance('stand', true);
      this.slideT = 0;
      this.diving = false;
      G.audio.play('swap', { vol: 0.8 });
      return true;
    }

    // ---------------- Silah ----------------
    updateWeapon(dt, s) {
      if (!s) return;
      const w = this.weapon;
      this.fireCD -= dt;
      this.burstCD -= dt;
      this.sprintFireT -= dt;
      this.switching -= dt;
      this.bloom = Math.max(0, this.bloom - dt * 6);
      if (this.busy > 0) {
        this.busy -= dt;
        if (this.busy <= 0) this.finishBusy();
      }

      // silah değiştirme
      const other = this.cur === 0 ? 1 : 0;
      if (this.weapons[other] && this.busy <= 0) {
        if (IN.hit('swap') || IN.wheel !== 0 || (IN.hit('w1') && this.cur !== 0) || (IN.hit('w2') && this.cur !== 1)) {
          this.equip(other);
          return;
        }
      }

      // nişan
      const adsInput = G.settings.toggleAds ? (this._adsToggle = IN.hit('ads') ? !this._adsToggle : this._adsToggle) : IN.down('ads');
      const wantAds = adsInput && !this.sprinting && this.busy <= 0 && !(this.reload && !s.shellReload && this.reload.t > 0.05 && false);
      const adsSpeed = 1 / (s.adsTime * (this.perks.has('ceviklik') ? 0.75 : 1));
      this.adsT = U.clamp(this.adsT + (wantAds ? 1 : -1) * dt * adsSpeed, 0, 1);

      // şarjör
      if (this.reload) {
        const r = this.reload;
        r.t += dt;
        if (s.shellReload) {
          if (r.t >= r.dur) {
            if (w.reserve > 0 && w.ammo < s.mag) {
              w.ammo++;
              w.reserve--;
              G.audio.play('shell');
            }
            if (w.ammo >= s.mag || w.reserve <= 0) {
              this.reload = null;
              if (this.vm) this.vm.play('pump', 0.45);
              G.audio.play('pump');
            } else {
              r.t = 0;
              if (this.vm) this.vm.play('shell', r.dur);
            }
          }
          if (IN.hit('fire') && w.ammo > 0) this.reload = null;
        } else {
          if (!r.outPlayed && r.t > r.dur * 0.18) {
            r.outPlayed = true;
            G.audio.play('magOut');
          }
          if (!r.inPlayed && r.t > r.dur * 0.55) {
            r.inPlayed = true;
            G.audio.play('magIn');
            const need = s.mag - w.ammo;
            const take = Math.min(need, w.reserve);
            w.ammo += take;
            w.reserve -= take;
            r.filled = true;
          }
          if (r.empty && !r.boltPlayed && r.t > r.dur * 0.75) {
            r.boltPlayed = true;
            G.audio.play('bolt');
          }
          if (r.t >= r.dur) this.reload = null;
        }
      } else if (IN.hit('reload') && w.ammo < s.mag && w.reserve > 0 && this.busy <= 0) {
        this.startReload();
      }

      // silahı incele
      if (IN.hit('inspect') && this.busy <= 0 && !this.reload && this.adsT < 0.1 && this.vm) this.vm.play('inspect', 2.6);
      // bıçak
      if (IN.hit('melee') && this.busy <= 0) {
        this.startMelee();
        return;
      }
      // el bombası (pişirme)
      if (this.cook) {
        const held = G.time - this.cook.start;
        if (held > 3.15) {
          this.throwLethal(true);
        } else if (!IN.down('lethal')) {
          this.throwLethal(false);
        }
      } else if (IN.hit('lethal') && this.lethalCount > 0 && this.busy <= 0) {
        if (this.lethal === 'frag') {
          this.cook = { start: G.time };
          this.reload = null;
          G.audio.play('pin');
          if (this.vm) {
            this.vm.setItem('frag');
            this.vm.play('lower', 0.2);
          }
        } else {
          this.throwLethal(false);
        }
      }
      if (IN.hit('tactical') && this.tacticalCount > 0 && this.busy <= 0 && !this.cook) this.throwTactical();
      if (this.cook) return;

      // ateş
      const canFire = this.busy <= 0 && this.switching <= 0 && this.sprintFireT <= 0 && this.fireCD <= 0 && (!this.reload || (s.shellReload && w.ammo > 0));
      let trigger = s.mode === 'auto' ? IN.down('fire') : IN.hit('fire');
      // dokunmatik otomatik ateş (aimAssist belirler; masaüstünde hep kapalı)
      if (this.autoFireOn && w.ammo > 0) trigger = true;
      else if (this.autoFireOn && w.ammo === 0 && !this.reload && this.busy <= 0) this.startReload();
      if (this.sprinting && (IN.down('fire') || this.autoFireOn)) {
        this.sprinting = false;
      }
      if (s.mode === 'burst') {
        if (this.burstLeft > 0 && this.fireCD <= 0 && w.ammo > 0) {
          this.shoot(s, w);
          this.burstLeft--;
          this.fireCD = 60 / s.rpm;
          if (this.burstLeft === 0) this.fireCD = s.burstDelay;
        } else if (trigger && canFire) {
          if (w.ammo > 0) {
            this.burstLeft = s.burst;
            this.reload = null;
          } else this.dryFire(w);
        }
        if (w.ammo === 0) this.burstLeft = 0;
      } else if (trigger && canFire) {
        if (w.ammo > 0) {
          if (this.reload) this.reload = null;
          this.shoot(s, w);
          let interval = s.interval;
          if (this.zmPerks.has('ciftatis')) interval *= 0.75;
          this.fireCD = interval;
        } else {
          this.dryFire(w);
        }
      } else if (IN.hit('fire') && w.ammo === 0 && !this.reload && this.fireCD <= 0) {
        this.dryFire(w);
      }
    }

    dryFire(w) {
      G.audio.play('empty');
      this.fireCD = 0.2;
      if (w.reserve > 0) this.startReload();
    }

    startReload() {
      const w = this.weapon;
      const s = w.stats;
      if (this.reload || w.reserve <= 0 || w.ammo >= s.mag) return;
      this.burstLeft = 0;
      const m = this.handMult();
      if (s.shellReload) {
        const dur = s.reload * m;
        this.reload = { t: 0, dur, empty: false };
        if (this.vm) this.vm.play('shell', dur);
        return;
      }
      const empty = w.ammo === 0;
      const dur = (empty ? s.reloadEmpty : s.reload) * m;
      this.reload = { t: 0, dur, empty };
      if (this.vm) this.vm.play(empty ? 'reloadEmpty' : 'reload', dur);
    }

    damageMul() {
      let m = 1;
      if (G.time < this.cayUntil) m *= 1.25;
      if (this.zmPerks.has('ciftatis')) m *= 1.25;
      if (this.zmPerks.has('demlicay')) m *= 1.15;
      return m;
    }

    shoot(s, w) {
      const cam = G.camera;
      w.ammo--;
      // dokunmatik titreşim: tek atışlık silahlarda küçük bir tık
      if (G.isTouch && G.haptic && s.mode !== 'auto') G.haptic(s.cls === 'sniper' || s.cls === 'shotgun' ? 22 : 9);
      const moving = this.hSpeed > 1;
      let spread;
      if (this.adsT > 0.85) spread = s.adsSpread + this.bloom * 0.15;
      else {
        spread = s.hip * (this.crouching ? 0.8 : this.prone ? 0.65 : 1) + (moving ? s.moveSpread * Math.min(1, this.hSpeed / 5) : 0) + this.bloom;
        spread = U.lerp(spread, s.adsSpread, this.adsT);
      }
      if (!this.grounded) spread *= 1.8;
      if (s.cls === 'sniper' && this.adsT < 0.9) spread = Math.max(spread, s.hip);
      this.bloom = Math.min(3, this.bloom + (s.cls === 'smg' ? 0.25 : 0.3));
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const origin = cam.position.clone();
      // namlu konumu (iz için)
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const muzzle = origin.clone().addScaledVector(dir, 0.75).addScaledVector(right, 0.17 * (1 - this.adsT)).addScaledVector(up, -0.12 * (1 - this.adsT) - 0.04);
      if (s.projectile) {
        const pdir = dir.clone();
        if (spread > 0.1) {
          pdir.x += (Math.random() - 0.5) * spread * U.DEG;
          pdir.y += (Math.random() - 0.5) * spread * U.DEG;
          pdir.normalize();
        }
        const p = G.combat.spawn(this, s.projectile.type, origin.clone().addScaledVector(pdir, 0.6), pdir.multiplyScalar(s.projectile.speed), { stats: Object.assign({}, s, { projectile: Object.assign({}, s.projectile, { dmg: s.projectile.dmg * this.damageMul() }) }) });
        p.vel.add(new THREE.Vector3(this.vel.x, 0, this.vel.z).multiplyScalar(0.3));
      } else {
        const dmul = this.damageMul() * (G.game && G.game.playerDamageMul ? G.game.playerDamageMul(s) : 1);
        G.combat.fire(this, origin, dir, s, {
          spread,
          isPlayer: true,
          ads: this.adsT > 0.85,
          tracerFrom: muzzle,
          tracerColor: s.upgraded ? 0xb47bff : 0xffe08a,
          dmgMul: dmul,
          headMult: G.game && G.game.mode === 'zm' ? 2.0 : null,
        });
      }
      G.audio.shot(s.sound, null, { player: true, suppressed: s.suppressed });
      if (!s.suppressed && !s.flashHidden) G.fx.flashLight(muzzle, 2.5);
      if (s.cls !== 'shotgun' && s.cls !== 'launcher' && !s.projectile) {
        const ev = right.clone().multiplyScalar(2.5).add(up.clone().multiplyScalar(2)).add(this.vel);
        G.fx.brass(muzzle.clone().addScaledVector(dir, -0.45), ev);
      }
      // geri tepme
      let vmul = (this.adsT > 0.5 ? 1 : 0.85) * (this.crouching ? 0.85 : this.prone ? 0.6 : 1);
      if (s.bipod && (this.crouching || this.prone)) vmul *= 0.65;
      this.pitch += s.recV * U.DEG * vmul * (0.8 + Math.random() * 0.4);
      this.yaw += (Math.random() - 0.5) * 2 * s.recH * U.DEG * vmul;
      this.recoilVis += s.recV * 0.01;
      if (this.vm) this.vm.fire(s.recV);
      if (s.bolt && w.ammo > 0 && this.vm) {
        this.vm.play('bolt', 0.9);
        G.audio.play('bolt', { delay: 0.3 });
      }
      if (s.pump && w.ammo > 0 && this.vm) {
        this.vm.play('pump', 0.5);
        G.audio.play('pump', { delay: 0.15 });
      }
      if (G.game && G.game.onShot) G.game.onShot(this, s);
    }

    startMelee() {
      const M = G.MELEE[this.meleeId || 'bicak'];
      this.reload = null;
      this.busy = M.speed + 0.05;
      this.busyType = 'melee';
      this.meleeHit = false;
      if (this.vm) {
        this.vm.setMelee(this.meleeId || 'bicak');
        this.vm.play('melee', M.speed + 0.05);
      }
      G.audio.play('melee');
      // hamle
      const target = this.meleeTarget(M.lunge, 18);
      if (target) {
        const d = target.pos.clone().sub(this.pos);
        d.y = 0;
        const dist = d.length();
        if (dist > 1.4) {
          d.normalize();
          this.vel.x = d.x * dist * 5;
          this.vel.z = d.z * dist * 5;
        }
      }
    }

    meleeTarget(range, angDeg) {
      if (!G.game) return null;
      let best = null, bestD = range;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      for (const h of G.game.hittables()) {
        if (!h.alive || h === this || !G.game.canHurt(this, h) || h.isEnt) continue;
        const dx = h.pos.x - this.pos.x, dz = h.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > bestD || Math.abs(h.pos.y - this.pos.y) > 1.6) continue;
        const a = Math.acos(U.clamp((dx * fx + dz * fz) / (d || 1), -1, 1)) / U.DEG;
        if (a > angDeg && d > 0.9) continue;
        best = h;
        bestD = d;
      }
      return best;
    }

    finishBusy() {
      const t = this.busyType;
      this.busyType = null;
      if (t === 'drink') {
        this.cayUntil = G.time + 30;
        this.health = Math.min(this.maxHealth, this.health + 30);
        G.hud && G.hud.medal('Çay içildi: Güç arttı!');
        G.audio.play('powerup');
      } else if (t === 'eat') {
        this.health = Math.min(this.maxHealth, this.health + 100);
        G.hud && G.hud.medal('Simit yendi: +100 sağlık');
      }
    }

    updateItems(dt) {
      const MW = G.MELEE[this.meleeId || 'bicak'];
      if (this.busyType === 'melee' && !this.meleeHit && this.busy < MW.speed * 0.7) {
        this.meleeHit = true;
        const t = this.meleeTarget(MW.range, 40);
        if (t) {
          const zmode = G.game && (G.game.mode === 'zm' || G.game.zd);
          const dmg = zmode ? MW.zm * (this.zmPerks.has('ciftatis') ? 1.25 : 1) * (G.game.instakill ? 99 : 1) * (1 + (G.game.zd ? G.game.zd.round * 0.05 : 0)) : 150;
          const c = t.chest(v3());
          t.takeDamage(dmg, this, { weapon: MW.name, weaponId: 'melee', melee: true, dir: c.clone().sub(this.pos).normalize(), point: c });
          G.fx.blood(c.x, c.y, c.z, -Math.sin(this.yaw), 0, -Math.cos(this.yaw), 1.5, t.kind === 'zombie' ? [0.62, 0.95, 0.72] : null);
          G.audio.play('stab');
          G.hud && G.hud.hitmarker(!t.alive, false);
        }
      }
      // çay & simit
      if (this.busy <= 0 && !this.cook) {
        if (IN.hit('cay') && this.cay > 0 && G.time > this.cayUntil - 25) {
          this.cay--;
          this.busy = 1.3;
          this.busyType = 'drink';
          this.reload = null;
          if (this.vm) {
            this.vm.setItem('cay');
            this.vm.play('drink', 1.3);
          }
          G.audio.play('drink');
        } else if (IN.hit('simit') && this.simit > 0) {
          this.simit--;
          this.busy = 1.0;
          this.busyType = 'eat';
          this.reload = null;
          if (this.vm) {
            this.vm.setItem('simit');
            this.vm.play('eat', 1.0);
          }
          G.audio.play('stab', { vol: 0.4 });
        }
      }
    }

    throwLethal(inHand) {
      const cam = G.camera;
      const kind = this.lethal;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const pos = cam.position.clone().addScaledVector(dir, 0.5);
      let vel;
      if (kind === 'knife') vel = dir.clone().multiplyScalar(32);
      else vel = dir.clone().multiplyScalar(inHand ? 0 : 17).add(new THREE.Vector3(0, inHand ? 0 : 3.2, 0)).add(this.vel.clone().multiplyScalar(0.5));
      const opts = {};
      if (kind === 'frag') opts.fuseAt = (this.cook ? this.cook.start : G.time) + 3.2;
      if (kind === 'semtex') opts.fuseAt = G.time + 6;
      G.combat.spawn(this, kind, pos, vel, opts);
      this.lethalCount--;
      this.cook = null;
      this.busy = 0.45;
      this.busyType = 'throw';
      if (this.vm) {
        this.vm.setItem(kind === 'knife' ? 'frag' : kind);
        this.vm.play('throw', 0.45);
      }
      G.audio.play('whoosh');
    }

    throwTactical() {
      const cam = G.camera;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const pos = cam.position.clone().addScaledVector(dir, 0.5);
      const vel = dir.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3, 0)).add(this.vel.clone().multiplyScalar(0.5));
      G.combat.spawn(this, this.tactical, pos, vel, {});
      this.tacticalCount--;
      this.busy = 0.45;
      this.busyType = 'throw';
      if (this.vm) {
        this.vm.setItem(this.tactical);
        this.vm.play('throw', 0.45);
      }
      G.audio.play('whoosh');
    }

    // ---------------- Kamera ----------------
    updateCamera(dt, cam, s) {
      const shake = G.fx.trauma * G.fx.trauma;
      this.landDip = U.damp(this.landDip, 0, 8, dt);
      const bob = this.grounded && this.hSpeed > 1 && this.slideT <= 0 ? Math.sin(G.time * (this.sprinting ? 13 : 9)) * 0.025 * Math.min(1, this.hSpeed / 5) * (1 - this.adsT * 0.8) : 0;
      cam.position.set(
        this.pos.x + (Math.random() - 0.5) * shake * 0.2,
        this.pos.y + this.eyeH - this.landDip + bob + (Math.random() - 0.5) * shake * 0.2,
        this.pos.z + (Math.random() - 0.5) * shake * 0.2
      );
      const rollTarget = this.slideT > 0 ? 0.08 : this.diving ? -0.06 : 0;
      this.roll = U.damp(this.roll, rollTarget, 8, dt);
      const stunWobble = this.stunFx > 0 ? Math.sin(G.time * 3) * 0.03 * Math.min(1, this.stunFx) : 0;
      cam.rotation.set(this.pitch + (Math.random() - 0.5) * shake * 0.04, this.yaw + stunWobble, this.roll + (Math.random() - 0.5) * shake * 0.03, 'YXZ');
      // görüş alanı
      const aspect = cam.aspect;
      const hfov = G.settings.fov * U.DEG;
      const baseV = 2 * Math.atan(Math.tan(hfov / 2) / aspect) / U.DEG;
      const zoom = s ? 1 + (s.zoom - 1) * this.adsT : 1;
      let target = baseV / zoom;
      if (this.sprinting) target *= this.tacSprint ? 1.1 : 1.05;
      const f = U.damp(cam.fov, target, 18, dt);
      if (Math.abs(f - cam.fov) > 0.01) {
        cam.fov = f;
        cam.updateProjectionMatrix();
      }
    }

    updateDeathCam(dt, cam) {
      const d = this.deathCam;
      if (!d) return;
      d.t += dt;
      const k = U.clamp(d.t / 0.8, 0, 1);
      cam.position.set(this.pos.x, this.pos.y + U.lerp(this.eyeH, 0.35, k), this.pos.z);
      if (d.killer && d.killer.pos && d.t > 0.6) {
        const kp = d.killer.pos;
        const ty = Math.atan2(-(kp.x - this.pos.x), -(kp.z - this.pos.z));
        this.yaw += U.wrapAngle(ty - this.yaw) * Math.min(1, dt * 3);
        const dy = kp.y + 1.4 - cam.position.y;
        const dh = Math.hypot(kp.x - this.pos.x, kp.z - this.pos.z);
        const tp = Math.atan2(dy, dh);
        this.pitch += (tp - this.pitch) * Math.min(1, dt * 3);
      }
      cam.rotation.set(this.pitch, this.yaw, U.lerp(0, 0.5, k), 'YXZ');
      G.audio.setMuffle(0.7);
    }
  }
  G.Player = Player;
})();
