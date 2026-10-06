'use strict';
// Gölge Timi — maç yönetimi: Takım Ölüm Maçı, Bölge Kontrolü, Herkes Tek,
// Zombiler, Atış Poligonu ve Hikâye görevlerinin ortak çatısı.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;

  const MODE_INFO = {
    tdm: { name: 'Takım Ölüm Maçı', short: 'TÖM', desc: 'Skor limitine ilk ulaşan takım kazanır.' },
    dom: { name: 'Bölge Kontrolü', short: 'BÖL', desc: 'A, B ve C bayraklarını ele geçir ve tut.' },
    ffa: { name: 'Herkes Tek', short: 'HT', desc: 'Herkes herkese karşı. Limite ilk ulaşan kazanır.' },
    zm: { name: 'Zombiler', short: 'ZMB', desc: 'Rauntlar boyunca hayatta kal.' },
    range: { name: 'Atış Poligonu', short: 'POL', desc: 'Silahları dene, hedef görevini tamamla.' },
    story: { name: 'Hikâye', short: 'HKY', desc: 'Gölge Timi harekâtı.' },
    online: { name: 'Online Kapışma', short: 'ONL', desc: 'Gerçek oyunculara karşı.' },
  };
  G.MODE_INFO = MODE_INFO;

  class Match {
    constructor(cfg) {
      this.cfg = cfg;
      this.mode = cfg.mode;
      this.chars = [];
      this.bots = [];
      this.teamScore = [0, 0];
      this.time = 0;
      this.state = 'loading';
      this.killfeedLog = [];
      this.streaksEnabled = cfg.mode === 'tdm' || cfg.mode === 'dom' || cfg.mode === 'ffa' || cfg.mode === 'story' || cfg.mode === 'online';
      this.respawns = [];
      this.firstBlood = false;
      this.multi = { n: 0, t: 0 };
      this.xp = 0;
      this.flags = [];
    }

    // ---------------- Kurulum ----------------
    start() {
      const cfg = this.cfg;
      G.game = this;
      const scene = (this.scene = new THREE.Scene());
      const def = G.MAPS[cfg.map];
      const world = (this.world = G.world = new G.World(def));
      world.build(scene);
      if (G.setGrade) G.setGrade(def.theme.grade);
      G.fx.init(scene);
      G.combat.reset();
      G.streaks.reset();
      // oyuncu
      const p = (this.player = new G.Player(G.settings.callsign || 'Gölge-1'));
      p.vm = G.vm;
      G.vm.setLighting(def.theme);
      G.vm.hidden = false;
      this.chars.push(p);
      if (cfg.mode === 'zm') {
        p.weapons = [G.makeWeaponInst('yaver', {}, {}), null];
        p.lethal = 'frag';
        p.lethalCount = 2;
        p.tactical = 'stun';
        p.tacticalCount = 0;
        p.points = 500;
        p.cay = 0;
        p.simit = 0;
        p.equip(0, true);
      } else {
        p.applyLoadout(G.getClass(cfg.classIdx || 0));
      }
      // fener
      if (def.theme.flashlight) {
        const spot = new THREE.SpotLight(0xfff2d8, 0.85, 26, 0.5, 0.65, 1.6);
        spot.position.set(0, 0, 0);
        const tgt = new THREE.Object3D();
        tgt.position.set(0, 0, -1);
        G.camera.add(spot);
        G.camera.add(tgt);
        spot.target = tgt;
        this.flashlight = spot;
        scene.add(G.camera);
      } else {
        scene.add(G.camera);
      }
      if (cfg.mode === 'ffa' && !cfg.ffaTeam) p.team = 0;
      // bölüme özel kurulum
      if (cfg.mode === 'zm') {
        this.zd = new G.ZombieDirector(this);
        const st = world.points.start[0];
        p.spawn(world.cellCenter(st.x, st.z), -Math.PI / 2);
        this.findInteraction = (pl) => this.zd.findInteraction(pl);
        this.instakillGetter = true;
        G.audio.music('zm');
      } else if (cfg.mode === 'range') {
        this.range = new G.RangeDirector(this);
        const st = world.points.start[0];
        p.spawn(world.cellCenter(st.x, st.z), 0);
        this.findInteraction = (pl) => this.range.findInteraction(pl);
        G.audio.music('none');
      } else if (cfg.mode === 'story') {
        this.mission = G.STORY[cfg.mission];
        this.findInteraction = (pl) => this.mission.findInteraction(this, pl);
        this.mission.setup(this);
        G.audio.music('none');
      } else if (cfg.mode === 'online') {
        this.net = cfg.net;
        this.net.attach(this);
        this.respawnPlayer();
        G.audio.music('none');
      } else {
        this.setupBots();
        if (cfg.mode === 'dom') this.setupFlags();
        this.respawnPlayer(true);
        for (const b of this.bots) this.respawnBot(b);
        G.audio.music('none');
      }
      this.state = 'playing';
      this.timeLimit = cfg.timeLimit || (cfg.mode === 'dom' ? 600 : cfg.mode === 'tdm' || cfg.mode === 'ffa' ? 600 : 0);
      this.scoreLimit = cfg.scoreLimit || (cfg.mode === 'dom' ? 150 : cfg.mode === 'ffa' ? 20 : 50);
      G.hud.startMatch(this);
      if (cfg.mode === 'tdm' || cfg.mode === 'dom' || cfg.mode === 'ffa') {
        G.hud.bigMessage(MODE_INFO[cfg.mode].name.toUpperCase(), def.name + ' · ' + (cfg.mode === 'ffa' ? 'Herkes tek başına' : 'Sen: Gölge Timi'));
        G.audio.play('roundStart', { priority: true });
      }
    }

    get instakill() {
      return this.zd ? this.zd.instakill : false;
    }

    setupBots() {
      const cfg = this.cfg;
      const n = cfg.botsPerTeam || 5;
      const names = { a: U.shuffle(G.BOT_NAMES.ally.slice()), e: U.shuffle(G.BOT_NAMES.enemy.slice()), f: U.shuffle(G.BOT_NAMES.ffa.slice()) };
      if (cfg.mode === 'ffa') {
        for (let i = 0; i < n + 2; i++) this.addBot({ team: 10 + i, name: names.f[i % names.f.length], look: 1 + (i % 2), difficulty: cfg.difficulty });
      } else {
        for (let i = 0; i < n - 1; i++) this.addBot({ team: 0, name: names.a[i], difficulty: cfg.difficulty, ally: true });
        for (let i = 0; i < n; i++) this.addBot({ team: 1, name: names.e[i], difficulty: cfg.difficulty });
      }
    }

    addBot(o) {
      const b = new G.Bot(o);
      b.buildModel(this.scene);
      this.bots.push(b);
      this.chars.push(b);
      return b;
    }

    setupFlags() {
      for (const f of this.world.points.flag || []) {
        const pos = this.world.cellCenter(f.x, f.z);
        const grp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), G.gunMat(0x999999));
        pole.position.y = 1.6;
        grp.add(pole);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color: 0xdddddd, side: THREE.DoubleSide }));
        cloth.position.set(0.58, 2.8, 0);
        grp.add(cloth);
        const ring = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.0, 32), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        grp.add(ring);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.labelTex(f.id, { size: 48, w: 64, h: 64, glow: '#000' }), depthTest: false, transparent: true }));
        label.scale.set(0.8, 0.8, 1);
        label.position.y = 3.8;
        label.renderOrder = 11;
        grp.add(label);
        grp.position.copy(pos);
        this.scene.add(grp);
        this.flags.push({ id: f.id, pos, owner: -1, prog: 0, cloth, ring, contested: false });
      }
      this.flagTick = 0;
    }

    // ---------------- Kurallar ----------------
    hittables() {
      const list = this.chars.filter((c) => c.alive);
      for (const e of G.streaks.hittables()) list.push(e);
      if (this.range) for (const t of this.range.targets) if (t.alive) list.push(t);
      if (this.extraHittables) for (const e of this.extraHittables) if (e.alive) list.push(e);
      return list;
    }

    canHurt(a, b) {
      if (!a || !b) return true;
      const aa = a.creditTo || a;
      const bb = b.creditTo || b;
      if (aa === bb) return false;
      if (b.isRangeTarget) return a.isPlayer;
      if (a.team == null || b.team == null) return true;
      return a.team !== b.team;
    }

    modifyDamage(target, attacker, amount, info) {
      if (this.zd) return this.zd.modifyDamage(target, attacker, amount, info);
      if (this.range && target.isPlayer) return 0;
      if (target.isPlayer) {
        if (G.time - (target.spawnedAt || 0) < 1.5 && !info.explosive) amount *= 0.3; // doğma koruması
        if (info.explosive && target.perks.has('celikyelek')) amount *= 0.55;
        if (this.mission && this.mission.playerDamageMul) amount *= this.mission.playerDamageMul;
      }
      if (this.net && target.isRemote) return this.net.sendHit(target, amount, info);
      if (this.mission && this.mission.modifyDamage) return this.mission.modifyDamage(target, attacker, amount, info);
      return amount;
    }

    onDamage(target, attacker, amount, info) {
      if (this.zd) this.zd.onDamage(target, attacker, amount, info);
      if (this.range && target.isRangeTarget) this.range.onHit(target, info);
    }

    playerDamageMul(stats) {
      if (this.zd) return 1.5;
      return 1;
    }

    targetsFor(bot) {
      const p = this.player;
      return this.hittables();
    }

    onShot(shooter, stats) {
      if (!stats.suppressed) shooter.spotted = Math.max(shooter.spotted || 0, G.time + 1.6);
      for (const b of this.bots) {
        if (b === shooter || !b.alive || !this.canHurt(b, shooter)) continue;
        b.hear(shooter.pos, !stats.suppressed);
      }
      if (this.net && shooter.isPlayer) this.net.onLocalShot(stats);
    }

    onFootstep(ch) {
      for (const b of this.bots) {
        if (!b.alive || !this.canHurt(b, ch)) continue;
        if (b.pos.distanceTo(ch.pos) < 11) b.hear(ch.pos, false);
      }
    }

    addScore(ch, pts, label) {
      ch.score += pts;
      if (ch.isPlayer) {
        this.xp += pts;
        if (label) G.hud.popup(label, pts);
        G.streaks.addPoints(ch, pts);
      }
    }

    // ---------------- Öldürme ----------------
    onKill(victim, killer, info) {
      const k = killer ? killer.creditTo || killer : null;
      if (this.zd) {
        if (victim.kind === 'zombie' || victim.kind === 'dog') {
          this.zd.onZombieKilled(victim, k, info);
          return;
        }
        if (victim.isPlayer && this.mode === 'zm') {
          this.gameOverZombies();
          return;
        }
      }
      if (this.net) {
        this.net.onKill(victim, k, info);
        if (victim.isPlayer) this.scheduleRespawn(victim, 3.5);
        return;
      }
      this.killfeed(k, victim, info);
      if (k && k !== victim) {
        k.kills++;
        k.streak = (k.streak || 0) + 1;
        if (this.mode === 'tdm' || this.mode === 'story') this.teamScore[k.team === 0 ? 0 : 1] += this.mode === 'tdm' ? 1 : 0;
        const base = 100;
        if (k.isPlayer) this.playerKill(victim, info);
        else this.addScore(k, base);
        if (k.isBot && !info.streak) this.botStreak(k);
      }
      // asistler
      for (const e of victim.damageLog) {
        const by = e.by.creditTo || e.by;
        if (by !== k && by !== victim && G.time - e.t < 6 && by.alive !== undefined) {
          if (by.isPlayer && !by._assistFor) {
            by.assists++;
            this.addScore(by, 25, 'Asist');
          } else if (!by.isPlayer) by.assists++;
        }
      }
      victim.streak = 0;
      if (victim.isPlayer) {
        this.lastKiller = k;
        this.scheduleRespawn(victim, 4);
        G.hud.playerDied(k, info);
      } else if (victim.isBot) this.scheduleRespawn(victim, 3.5 + Math.random());
      if (this.mission && this.mission.onKill) this.mission.onKill(this, victim, k, info);
      this.checkEnd();
    }

    playerKill(victim, info) {
      const p = this.player;
      p.killsLife++;
      const medals = [];
      let pts = 100;
      if (info.headshot) {
        medals.push(['Kafadan Vuruş', 50]);
      }
      if (!this.firstBlood) {
        this.firstBlood = true;
        medals.push(['İlk Kan', 100]);
      }
      if (G.time - this.multi.t < 4) this.multi.n++;
      else this.multi.n = 1;
      this.multi.t = G.time;
      if (this.multi.n === 2) medals.push(['Çifte Öldürme', 50]);
      else if (this.multi.n === 3) medals.push(['Üçlü Öldürme', 100]);
      else if (this.multi.n >= 4) medals.push(['Katliam', 150]);
      if (this.lastKiller && victim === this.lastKiller) {
        medals.push(['İntikam', 50]);
        this.lastKiller = null;
      }
      if (info.melee) medals.push(['Bıçakçı', 50]);
      if (info.dist > 40 && !info.explosive) medals.push(['Uzak Atış', 50]);
      if (info.explosive && !info.streak) medals.push(['Patlatıcı', 25]);
      if (p.slideT > 0) medals.push(['Kayarak Öldürme', 50]);
      if (p.diving) medals.push(['Uçan Ölüm', 75]);
      if (p.health < p.maxHealth * 0.2) medals.push(['Kıl Payı', 50]);
      if (G.time < p.cayUntil) medals.push(['Çay Gücü', 25]);
      if (p.killsLife === 5) medals.push(['Durdurulamaz', 100]);
      if (p.killsLife === 10) medals.push(['Efsane Seri', 250]);
      if (info.streak) {
        this.xp += pts;
        p.score += pts;
        G.hud.popup('Seri Öldürme', pts);
      } else this.addScore(p, pts, 'Düşman öldürüldü');
      for (const [name, v] of medals) {
        G.hud.medal(name, v);
        this.xp += v;
        p.score += v;
      }
      if (info.headshot) G.profile.headshots++;
      for (const [name] of medals) G.progress.medal(name);
      if (this.multi.n === 2) G.progress.stat('multiKill', 1);
      G.progress.kill(info.weaponId, info, { tea: G.time < p.cayUntil, slide: p.slideT > 0 || p.diving });
    }

    botStreak(k) {
      const S = G.streaks;
      if (k.streak === 4 && !S.uavActive(k.team) && (this.mode === 'tdm' || this.mode === 'dom')) S.callUAV(k.team, 'bot');
      if (k.streak === 7 && this.mode !== 'ffa') {
        // en kalabalık düşman kümesine
        const enemies = this.chars.filter((c) => c.alive && this.canHurt(k, c));
        if (enemies.length) {
          const t = enemies.find((e) => e.isPlayer) && Math.random() < 0.6 ? this.player : U.pick(enemies);
          S.callAirstrike(k, t.pos.clone(), Math.random() * Math.PI * 2);
        }
      }
    }

    killfeed(k, victim, info) {
      const entry = {
        killer: k ? k.name : '',
        kteam: k ? k.team : -1,
        victim: victim.name,
        vteam: victim.team,
        weapon: info.weapon || '',
        weaponId: info.weaponId || '',
        head: !!info.headshot,
        t: G.time,
      };
      G.hud.killfeed(entry, this.player);
    }

    scheduleRespawn(ch, delay) {
      this.respawns.push({ ch, at: G.time + delay });
    }

    // ---------------- Doğma ----------------
    pickSpawn(ch) {
      const pts = this.world.points;
      let cands;
      if (this.mode === 'ffa' || this.mode === 'online') cands = (pts.A || []).concat(pts.B || []);
      else cands = ch.team === 0 ? pts.A || [] : pts.B || [];
      if (this.mode === 'dom' || this.mode === 'tdm') {
        // ilerleyen maçta biraz karıştır
        if (this.time > 90 && Math.random() < 0.25) cands = cands.concat(ch.team === 0 ? pts.B || [] : pts.A || []);
      }
      let best = null, bestScore = -Infinity;
      const enemies = this.chars.filter((c) => c.alive && c !== ch && this.canHurt(ch, c));
      for (let i = 0; i < 14 && cands.length; i++) {
        const c = U.pick(cands);
        const pos = this.world.cellCenter(c.x, c.z);
        let minD = 999;
        let seen = false;
        for (const e of enemies) {
          const d = e.pos.distanceTo(pos);
          if (d < minD) minD = d;
          if (d < 40 && !seen) seen = this.world.los(pos.x, 1.6, pos.z, e.pos.x, e.pos.y + 1.6, e.pos.z);
        }
        const score = Math.min(minD, 30) - (seen ? 25 : 0) + Math.random() * 4;
        if (score > bestScore) {
          bestScore = score;
          best = pos;
        }
      }
      if (!best) {
        const c = this.world.randomWalkable();
        best = this.world.cellCenter(c[0], c[1]);
      }
      return best;
    }

    faceCenterYaw(pos) {
      return Math.atan2(-(this.world.sizeX / 2 - pos.x), -(this.world.sizeZ / 2 - pos.z));
    }

    respawnPlayer(first) {
      const p = this.player;
      const pos = this.pickSpawn(p);
      if (G.pendingClass != null) {
        p.loadout = G.getClass(G.pendingClass);
        G.pendingClass = null;
      }
      p.spawn(pos, this.faceCenterYaw(pos));
      if (!first) G.hud.playerRespawned();
      if (this.net) this.net.onLocalSpawn();
    }

    respawnBot(b) {
      const pos = this.pickSpawn(b);
      if (Math.random() < 0.25) b.setWeapon(G.weightedPick(G.BOT_WEAPONS));
      if (b.model) {
        this.scene.remove(b.model.root);
        b.model = null;
      }
      b.buildModel(this.scene);
      b.spawnAt(pos, this.faceCenterYaw(pos));
    }

    // ---------------- Bot hedefleri ----------------
    botGoal(bot) {
      if (this.mission && this.mission.botGoal) {
        const g = this.mission.botGoal(this, bot);
        if (g) return g;
      }
      if (this.mode === 'dom' && this.flags.length) {
        const mine = bot.team === 0 ? 1 : -1;
        let best = null, bestS = Infinity;
        for (const f of this.flags) {
          const owned = f.owner === bot.team;
          const d = bot.pos.distanceTo(f.pos);
          const s = d * (owned ? 2.8 : 1) + (f.contested ? -8 : 0) + Math.random() * 12;
          if (s < bestS) {
            bestS = s;
            best = f;
          }
        }
        if (best) {
          const g = best.pos.clone();
          g.x += U.rand(-2.5, 2.5);
          g.z += U.rand(-2.5, 2.5);
          g.hold = true;
          return g;
        }
      }
      // İHA varsa düşmanlara git
      if (G.streaks.uavActive(bot.team) && Math.random() < 0.6) {
        const enemies = this.chars.filter((c) => c.alive && this.canHurt(bot, c) && !(c.isPlayer && c.perks.has('hayalet')));
        if (enemies.length) return U.pick(enemies).pos.clone();
      }
      // karşı tarafa doğru it
      if (Math.random() < 0.45) {
        const enemies = this.chars.filter((c) => c.alive && this.canHurt(bot, c));
        if (enemies.length) {
          const e = U.pick(enemies);
          return new THREE.Vector3(e.pos.x + U.rand(-8, 8), 0, e.pos.z + U.rand(-8, 8));
        }
      }
      return null;
    }

    // ---------------- Bölge kontrolü ----------------
    updateFlags(dt) {
      for (const f of this.flags) {
        const count = [0, 0];
        for (const c of this.chars) {
          if (!c.alive) continue;
          if (Math.hypot(c.pos.x - f.pos.x, c.pos.z - f.pos.z) < 4 && Math.abs(c.pos.y - f.pos.y) < 3) count[c.team === 0 ? 0 : 1]++;
        }
        f.contested = count[0] > 0 && count[1] > 0;
        const prevOwner = f.owner;
        if (!f.contested && (count[0] || count[1])) {
          const team = count[0] ? 0 : 1;
          const dirv = team === 0 ? 1 : -1;
          const rate = 0.125 * Math.min(3, count[team]) * (f.owner === -1 ? 1.4 : 1);
          if (f.owner !== team) {
            f.prog = U.clamp(f.prog + dirv * rate * dt, -1, 1);
            if (f.owner !== -1 && Math.sign(f.prog) !== (f.owner === 0 ? 1 : -1) && Math.abs(f.prog) < 0.02) f.owner = -1;
            if ((team === 0 && f.prog >= 1) || (team === 1 && f.prog <= -1)) {
              f.owner = team;
              for (const c of this.chars) {
                if (c.alive && c.team === team && Math.hypot(c.pos.x - f.pos.x, c.pos.z - f.pos.z) < 4.5) {
                  if (c.isPlayer) {
                    this.addScore(c, 150, 'Bayrak ele geçirildi');
                    G.hud.medal('Bayrak ' + f.id + ' alındı');
                  } else c.score += 150;
                }
              }
            }
          }
        }
        if (f.owner !== prevOwner && f.owner !== -1) {
          const mine = f.owner === this.player.team;
          G.audio.play(mine ? 'flag' : 'flagLost', { priority: true });
          G.hud.warn(mine ? `${f.id} bayrağını ele geçirdik` : `${f.id} bayrağını kaybettik`, mine);
        }
        const col = f.owner === 0 ? 0x4cc3ff : f.owner === 1 ? 0xff4d3d : 0xdddddd;
        f.cloth.material.color.setHex(col);
        f.ring.material.color.setHex(f.contested ? 0xffd23a : col);
        f.cloth.position.y = 1.2 + Math.abs(f.prog) * 1.6;
        f.cloth.rotation.y = Math.sin(G.time * 2 + f.pos.x) * 0.2;
      }
      this.flagTick += dt;
      if (this.flagTick >= 2) {
        this.flagTick = 0;
        for (const f of this.flags) if (f.owner >= 0) this.teamScore[f.owner]++;
        this.checkEnd();
      }
    }

    // ---------------- Döngü ----------------
    update(dt) {
      if (this.state !== 'playing') return;
      this.time += dt;
      const p = this.player;
      p.update(dt);
      for (const b of this.bots) b.update(dt);
      if (this.zd) this.zd.update(dt);
      if (this.range) this.range.update(dt);
      if (this.mission) this.mission.update(this, dt);
      if (this.net) this.net.update(dt);
      if (this.flags.length) this.updateFlags(dt);
      G.streaks.update(dt);
      G.combat.update(dt);
      G.combat.updateBurns(dt, this.chars);
      // doğmalar
      for (let i = this.respawns.length - 1; i >= 0; i--) {
        const r = this.respawns[i];
        if (G.time < r.at) continue;
        if (r.ch.isPlayer) {
          if (!G.hud.readyToRespawn()) continue;
          this.respawns.splice(i, 1);
          if (this.mission && this.mission.respawnPlayer) this.mission.respawnPlayer(this);
          else this.respawnPlayer();
        } else {
          this.respawns.splice(i, 1);
          if (this.mission && this.mission.respawnBot) this.mission.respawnBot(this, r.ch);
          else this.respawnBot(r.ch);
        }
      }
      if (this.timeLimit && this.time >= this.timeLimit) this.end('time');
    }

    checkEnd() {
      if (this.state !== 'playing') return;
      if (this.mode === 'tdm' || this.mode === 'dom') {
        if (this.teamScore[0] >= this.scoreLimit || this.teamScore[1] >= this.scoreLimit) this.end('score');
      } else if (this.mode === 'ffa') {
        for (const c of this.chars) if (c.kills >= this.scoreLimit) return this.end('score');
      }
    }

    // ---------------- Bitiş ----------------
    end(reason, extra) {
      if (this.state === 'ended') return;
      this.state = 'ended';
      const p = this.player;
      let win = false, title = '', sub = '';
      if (this.mode === 'tdm' || this.mode === 'dom') {
        const [a, b] = this.teamScore;
        win = a > b;
        title = a === b ? 'BERABERE' : win ? 'ZAFER' : 'YENİLGİ';
        sub = `Gölge Timi ${a} — ${b} Kızıl Pençe`;
      } else if (this.mode === 'ffa') {
        const sorted = this.chars.slice().sort((x, y) => y.kills - x.kills);
        const place = sorted.indexOf(p) + 1;
        win = place === 1;
        title = win ? '1. OLDUN!' : place + '. OLDUN';
        sub = `${p.kills} öldürme · ${p.deaths} ölüm`;
      } else if (this.mode === 'story') {
        win = reason === 'success';
        title = win ? 'GÖREV TAMAMLANDI' : 'GÖREV BAŞARISIZ';
        sub = (extra && extra.sub) || '';
      } else if (this.mode === 'online') {
        win = extra && extra.win;
        title = (extra && extra.title) || 'MAÇ BİTTİ';
        sub = (extra && extra.sub) || '';
      }
      const xp = Math.round(this.xp + (win ? 500 : 150) + (this.mode === 'story' && win ? 1000 : 0));
      const before = G.levelFromXp(G.profile.xp);
      G.profile.xp += xp;
      G.profile.kills += p.kills;
      G.profile.deaths += p.deaths;
      G.profile.matches++;
      if (win) G.profile.wins++;
      if (win && this.mode !== 'story') G.progress.stat('win', 1);
      if (this.mode === 'story' && win) G.progress.stat('storyWin', 1);
      if (this.mode === 'story' && win) {
        const done = G.store.get('storyDone', {});
        done[this.cfg.mission] = true;
        G.store.set('storyDone', done);
      }
      G.saveProfile();
      const after = G.levelFromXp(G.profile.xp);
      if (reason === 'success' || win) G.audio.play('victory', { priority: true });
      else G.audio.play('defeat', { priority: true });
      G.audio.stopAllLoops();
      G.ui.showEnd({ title, sub, win, xp, levelUp: after.level > before.level ? after.level : 0, match: this, outro: extra && extra.outro });
    }

    gameOverZombies() {
      if (this.state === 'ended') return;
      this.state = 'ended';
      const zd = this.zd;
      const p = this.player;
      G.audio.play('gameOver', { priority: true });
      const best = Math.max(G.profile.bestRound, zd.round);
      const isRecord = zd.round > G.profile.bestRound;
      G.profile.bestRound = best;
      G.profile.zmKills += zd.kills;
      G.progress.stat('zmRound', zd.round, true);
      G.profile.matches++;
      const xp = zd.kills * 15 + zd.round * 100;
      const before = G.levelFromXp(G.profile.xp);
      G.profile.xp += xp;
      G.saveProfile();
      const after = G.levelFromXp(G.profile.xp);
      G.audio.music('none');
      G.audio.stopAllLoops();
      G.ui.showEnd({
        title: 'OYUN BİTTİ',
        sub: `${Math.max(1, zd.round)}. rauntta düştün${isRecord ? ' · YENİ REKOR!' : ''}`,
        win: false,
        xp,
        zm: { round: zd.round, kills: zd.kills, headshots: zd.headshots, points: p.points },
        levelUp: after.level > before.level ? after.level : 0,
        match: this,
      });
    }

    dispose() {
      this.state = 'disposed';
      if (this.net) this.net.detach();
      G.audio.stopAllLoops();
      G.combat.reset();
      G.streaks.reset();
      if (this.flashlight) {
        G.camera.remove(this.flashlight);
        G.camera.remove(this.flashlight.target);
      }
      this.scene.remove(G.camera);
      this.world.dispose(this.scene);
      G.world = null;
      if (G.game === this) G.game = null;
    }
  }
  G.Match = Match;

  // ------------------------------------------------------------------
  // ATIŞ POLİGONU
  // ------------------------------------------------------------------
  class RangeDirector {
    constructor(match) {
      this.match = match;
      this.targets = [];
      this.challenge = null;
      const w = match.world;
      const st = w.points.start[0];
      const startPos = w.cellCenter(st.x, st.z);
      for (const t of w.points.target || []) this.targets.push(this.makeTarget(w.cellCenter(t.x, t.z), startPos));
      for (const m of w.points.mover || []) {
        const tg = this.makeTarget(w.cellCenter(m.x, m.z), startPos);
        tg.mover = { x0: m.x * CELL + 1, x1: m.to * CELL + 1, speed: 3.5, dir: 1 };
        this.targets.push(tg);
      }
      const c = (w.points.console || [])[0];
      if (c) {
        const pos = w.cellCenter(c.x, c.z);
        const grp = new THREE.Group();
        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.6), G.gunMat(0x3a3f45));
        desk.position.y = 0.5;
        grp.add(desk);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x23ff9a }));
        screen.position.set(0, 1.25, 0);
        grp.add(screen);
        const sign = G.signSprite('Hedef Görevi', '[F] 60 saniye', '#23ff9a');
        sign.position.y = 2;
        grp.add(sign);
        grp.position.copy(pos);
        w.group.add(grp);
        w.addBox(pos.x - 0.6, 0, pos.z - 0.3, pos.x + 0.6, 1.5, pos.z + 0.3, { kind: 'machine' });
        this.console = pos;
      }
      // mesafe tabelaları
      for (const z of [41, 34, 26, 18, 9]) {
        const d = Math.round((st.z - z) * CELL);
        const s = G.signSprite(d + ' m', '', '#ffd23a', 1.2, 0.45);
        s.position.set(1.4, 2.2, z * CELL + 1);
        w.group.add(s);
      }
    }

    makeTarget(pos, from) {
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), G.gunMat(0x555555));
      pole.position.y = 0.3;
      grp.add(pole);
      const plate = new THREE.Group();
      plate.position.y = 0.6;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.04), new THREE.MeshStandardMaterial({ color: 0xb8b0a0 }));
      body.position.y = 0.45;
      plate.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.04), new THREE.MeshStandardMaterial({ color: 0xc8c0b0 }));
      head.position.y = 1.03;
      plate.add(head);
      const bull = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0xc02020 }));
      bull.position.set(0, 0.55, 0.025);
      plate.add(bull);
      grp.add(plate);
      grp.position.copy(pos);
      grp.rotation.y = Math.atan2(from.x - pos.x, from.z - pos.z);
      this.match.world.group.add(grp);
      const t = {
        isRangeTarget: true, isEnt: true, alive: true, team: 5, pos: grp.position, grp, plate, downUntil: 0, up: 1, active: true, spotted: 0, name: 'Hedef',
        chest(out) { return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + 1.05, this.pos.z); },
        hitTest(ox, oy, oz, dx, dy, dz, maxT) {
          if (this.up < 0.8 || !this.active) return null;
          const p = this.pos;
          const th = G.rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.14, p.y + 1.47, p.z - 0.14, p.x + 0.14, p.y + 1.77, p.z + 0.14);
          if (th >= 0 && th < maxT) return { t: th, part: 'head' };
          const tb = G.rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.3, p.y + 0.6, p.z - 0.3, p.x + 0.3, p.y + 1.47, p.z + 0.3);
          if (tb >= 0 && tb < maxT) return { t: tb, part: 'body' };
          return null;
        },
        takeDamage(amount, attacker, info) {
          if (!this.alive || this.up < 0.8) return false;
          G.game.onDamage(this, attacker, amount, info || {});
          return false;
        },
      };
      return t;
    }

    onHit(t, info) {
      t.downUntil = G.time + (this.challenge ? 99 : 2.5);
      t.up = 0.79;
      G.audio.play('target', { pos: t.pos });
      if (this.challenge) {
        this.challenge.score += info.headshot ? 150 : 100;
        this.challenge.hits++;
        G.hud.medal(info.headshot ? 'Kafadan! +150' : '+100');
        t.active = false;
        this.popRandom();
      }
      const p = this.match.player;
      if (p.onHitTarget) p.onHitTarget(t, info.headshot ? 'head' : 'body', false, info, 0);
    }

    popRandom() {
      const free = this.targets.filter((t) => !t.active);
      if (!free.length) return;
      const t = U.pick(free);
      t.active = true;
      t.downUntil = 0;
    }

    findInteraction(p) {
      if (this.console && p.pos.distanceTo(this.console) < 2.2) {
        if (this.challenge) return { text: 'Görev sürüyor', cost: 0, action: () => {} };
        return { text: '60 saniyelik hedef görevini başlat', cost: 0, action: () => this.startChallenge() };
      }
      return null;
    }

    startChallenge() {
      this.challenge = { until: G.time + 60, score: 0, hits: 0 };
      for (const t of this.targets) t.active = false;
      for (let i = 0; i < 4; i++) this.popRandom();
      G.hud.bigMessage('HEDEF GÖREVİ', '60 saniye! Hedefleri vur.');
      G.audio.play('roundStart', { priority: true });
    }

    update(dt) {
      const p = this.match.player;
      if (p.health < p.maxHealth) p.health = p.maxHealth;
      for (const w of p.weapons) if (w && w.reserve < w.stats.mag * 2) w.reserve = w.stats.reserve;
      p.lethalCount = Math.max(p.lethalCount, 1);
      p.tacticalCount = Math.max(p.tacticalCount, 1);
      for (const t of this.targets) {
        const want = t.active && G.time > t.downUntil ? 1 : 0;
        t.up = U.damp(t.up, want, 10, dt);
        t.plate.rotation.x = -(1 - t.up) * 1.55;
        if (t.mover) {
          t.pos.x += t.mover.speed * t.mover.dir * dt;
          if (t.pos.x > t.mover.x1) t.mover.dir = -1;
          if (t.pos.x < t.mover.x0) t.mover.dir = 1;
        }
      }
      if (this.challenge) {
        const left = this.challenge.until - G.time;
        G.hud.setTimer(left);
        if (left <= 0) {
          const sc = this.challenge.score;
          const rec = sc > G.profile.rangeBest;
          if (rec) G.profile.rangeBest = sc;
          G.progress.stat('rangeScore', sc, true);
          G.profile.xp += Math.round(sc / 10);
          G.saveProfile();
          G.hud.bigMessage('GÖREV BİTTİ', `${this.challenge.hits} isabet · ${sc} puan${rec ? ' · YENİ REKOR!' : ''}`);
          G.audio.play(rec ? 'victory' : 'roundEnd', { priority: true });
          this.challenge = null;
          for (const t of this.targets) {
            t.active = true;
            t.downUntil = 0;
          }
          G.hud.setTimer(null);
        }
      }
    }
  }
  G.RangeDirector = RangeDirector;

  // Sınıf erişimi (yerel kayıtlı veya varsayılan)
  G.getClasses = function () {
    const saved = G.store.get('classes', null);
    if (Array.isArray(saved) && saved.length === 3) {
      return saved.map((c, i) => Object.assign({}, G.DEFAULT_CLASSES[i], c));
    }
    return JSON.parse(JSON.stringify(G.DEFAULT_CLASSES));
  };
  G.getClass = function (i) {
    return G.getClasses()[i] || G.DEFAULT_CLASSES[0];
  };
  G.saveClasses = function (list) {
    G.store.set('classes', list);
  };
})();
