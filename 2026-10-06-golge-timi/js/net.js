'use strict';
// Gölge Timi — Online kapışma. Claude "room" yeteneği ile aynı sayfayı açmış
// oyuncular gerçek zamanlı buluşur (her oyuncu kendi durumunu "presence"
// olarak yayınlar). Yetenek yoksa aynı tarayıcıdaki sekmeler arasında
// BroadcastChannel ile yerel deneme modu çalışır.
(function () {
  const G = window.G;
  const U = G.util;

  // ---------------- Taşıyıcılar ----------------
  class RoomTransport {
    constructor(named) {
      this.kind = 'room';
      this.named = named;
    }
    peers() {
      return this.named.peers().map((p) => ({ peer: p.peer, presence: p.presence || {}, me: p.isMe && p.sameTab, guest: p.guest }));
    }
    myPeer() {
      const me = this.named.peers().find((p) => p.isMe && p.sameTab);
      return me ? me.peer : null;
    }
    setPresence(o) {
      this.named.presence(o).catch(() => {});
    }
    connected() {
      return this.named.connected();
    }
    leave() {
      try {
        this.named.leave();
      } catch (e) { /* yoksay */ }
    }
  }

  class LocalTransport {
    constructor(code) {
      this.kind = 'local';
      this.id = 'p' + Math.random().toString(36).slice(2, 10);
      this.others = {};
      this.mine = {};
      try {
        this.ch = new BroadcastChannel('golge-timi-' + code);
        this.ch.onmessage = (e) => {
          const d = e.data;
          if (!d || d.peer === this.id) return;
          if (d.bye) delete this.others[d.peer];
          else this.others[d.peer] = { presence: d.presence, t: Date.now() };
        };
      } catch (e) {
        this.ch = null;
      }
      this.timer = setInterval(() => this.flush(), 60);
    }
    flush() {
      if (this.ch) this.ch.postMessage({ peer: this.id, presence: this.mine });
    }
    peers() {
      const now = Date.now();
      const out = [{ peer: this.id, presence: this.mine, me: true }];
      for (const k in this.others) {
        if (now - this.others[k].t > 4000) {
          delete this.others[k];
          continue;
        }
        out.push({ peer: k, presence: this.others[k].presence, me: false });
      }
      return out;
    }
    myPeer() {
      return this.id;
    }
    setPresence(o) {
      Object.assign(this.mine, o);
      for (const k in o) if (o[k] === null) delete this.mine[k];
    }
    connected() {
      return !!this.ch;
    }
    leave() {
      clearInterval(this.timer);
      if (this.ch) {
        this.ch.postMessage({ peer: this.id, bye: true });
        this.ch.close();
      }
    }
  }

  async function getRoom() {
    try {
      if (!window.claude || !window.claude.use) return null;
      return await window.claude.use('room');
    } catch (e) {
      return null;
    }
  }

  // ---------------- Uzak oyuncu ----------------
  class RemotePlayer extends G.Character {
    constructor(peer, pres, scene, ffa) {
      super({ team: pres.t != null ? pres.t : 1, name: String(pres.n || 'Oyuncu').slice(0, 16) });
      this.isRemote = true;
      this.peer = peer;
      this.ffa = ffa;
      if (ffa) this.team = 'r-' + peer;
      this.scene = scene;
      this.weaponId = pres.w || 'simsek';
      this.buildModel(pres);
      this.known = { fs: pres.fs || 0, ds: pres.ds || 0, ex: 0 };
      this.target = new THREE.Vector3();
      this.alive = pres.a !== 0;
      if (pres.p) this.pos.fromArray(pres.p);
    }
    buildModel(pres) {
      if (this.model) this.scene.remove(this.model.root);
      const look = this.ffa ? 1 : pres.t === 0 ? 0 : 1;
      const tag = G.labelTex(this.name, { color: look === 0 ? '#9fdcff' : '#ffb0a0', size: 26, w: 256, h: 48, glow: '#000' });
      let stats;
      try {
        stats = G.computeStats(this.weaponId, {});
      } catch (e) {
        stats = G.computeStats('simsek', {});
      }
      this.model = G.makeHumanoid({ kind: 'soldier', look, weapon: stats, tag, tagW: 1.6, tagH: 0.3, operator: look === 0 && G.OPERATORS[pres.op] ? pres.op : null });
      this.scene.add(this.model.root);
    }
    applyPresence(pres, dt) {
      if (pres.p) this.target.fromArray(pres.p);
      if (pres.w && pres.w !== this.weaponId && G.WEAPONS[pres.w]) {
        this.weaponId = pres.w;
        this.buildModel(pres);
      }
      const d = this.target.distanceTo(this.pos);
      if (d > 6) this.pos.copy(this.target);
      else {
        const prev = this.pos.clone();
        this.pos.x = U.damp(this.pos.x, this.target.x, 14, dt);
        this.pos.y = U.damp(this.pos.y, this.target.y, 14, dt);
        this.pos.z = U.damp(this.pos.z, this.target.z, 14, dt);
        this.vel.subVectors(this.pos, prev).divideScalar(Math.max(dt, 1e-3));
      }
      if (pres.y != null) this.yaw += U.wrapAngle(pres.y - this.yaw) * Math.min(1, dt * 14);
      this.pitch = pres.pi || 0;
      const st = pres.s || 0;
      this.stance = st === 2 ? 'prone' : st === 1 ? 'crouch' : 'stand';
      this.crouchT = U.damp(this.crouchT, st === 1 ? 1 : 0, 10, dt);
      this.height = st === 2 ? 0.7 : st === 1 ? 1.3 : 1.8;
      this.health = pres.hp != null ? pres.hp : this.health;
      const alive = pres.a !== 0;
      if (alive && !this.alive) {
        this.alive = true;
        this.buildModel(pres);
      }
      if (!alive && this.alive) {
        this.alive = false;
        this.diedAt = G.time;
      }
      this.kills = pres.k || 0;
      this.deaths = pres.d || 0;
      const m = this.model;
      if (m) {
        m.root.position.copy(this.pos);
        m.root.rotation.y = this.yaw;
        m.animate(dt, { dead: !this.alive, speed: Math.hypot(this.vel.x, this.vel.z), crouch: this.crouchT, pitch: this.pitch });
      }
    }
    dispose() {
      if (this.model) this.scene.remove(this.model.root);
    }
  }

  // ---------------- Ağ oturumu ----------------
  class Net {
    constructor(code, transport) {
      this.code = code;
      this.t = transport;
      this.remotes = {};
      this.hits = [];
      this.hitSeq = 0;
      this.lastSeq = {};
      this.ds = 0;
      this.fs = 0;
      this.exList = [];
      this.exSeq = 0;
      this.sendT = 0;
      this.joinedAt = Date.now();
      this.match = null;
      this.lobby({ ph: 'lobby' });
    }

    static async connect(code) {
      const room = await getRoom();
      if (room) {
        try {
          const named = await room.join('gt-' + code);
          return new Net(code, new RoomTransport(named));
        } catch (e) { /* yerel moda düş */ }
      }
      return new Net(code, new LocalTransport(code));
    }

    get myPeer() {
      return this.t.myPeer();
    }

    lobby(extra) {
      this.t.setPresence(Object.assign({ n: (G.settings.callsign || 'Oyuncu').slice(0, 16), jt: this.joinedAt, lv: G.levelFromXp(G.profile.xp).level }, extra || {}));
    }

    peers() {
      return this.t.peers();
    }

    host() {
      const ps = this.peers().filter((p) => p.presence && p.presence.jt);
      ps.sort((a, b) => a.presence.jt - b.presence.jt || (a.peer < b.peer ? -1 : 1));
      return ps[0] || null;
    }

    isHost() {
      const h = this.host();
      return !h || h.me;
    }

    startGame(cfg) {
      const go = { map: cfg.map, mode: cfg.mode, limit: cfg.limit, t0: Date.now(), id: Math.random().toString(36).slice(2, 8) };
      this.t.setPresence({ go, ph: 'game' });
      return go;
    }

    currentGo() {
      const h = this.host();
      return h && h.presence && h.presence.go ? h.presence.go : null;
    }

    leave() {
      this.t.leave();
    }

    // ---------------- Maç ----------------
    attach(match) {
      this.match = match;
      this.go = match.cfg.go;
      this.ffa = this.go.mode === 'ffa';
      match.streaksEnabled = false;
      match.timeLimit = 0;
      match.scoreLimit = this.go.limit || 25;
      const p = match.player;
      if (this.ffa) p.team = 'me';
      else {
        const ids = this.peers().map((x) => x.peer).sort();
        p.team = ids.indexOf(this.myPeer) % 2 === 0 ? 0 : 1;
      }
      this.t.setPresence({ ph: 'game', gid: this.go.id, t: this.ffa ? null : p.team, k: 0, d: 0, ds: 0, fs: 0, h: [], ex: [] });
    }

    detach() {
      for (const id in this.remotes) this.remotes[id].dispose();
      this.remotes = {};
      if (this.match) this.lobby({ ph: 'lobby', go: null, gid: null, p: null });
      this.match = null;
    }

    sendHit(target, amount, info) {
      this.hits.push([target.peer, Math.round(amount), info.headshot ? 1 : 0, ++this.hitSeq, info.weaponId || '']);
      if (this.hits.length > 10) this.hits.shift();
      return 0;
    }

    onLocalShot(stats) {
      this.fs++;
    }

    onLocalSpawn() {}

    onKill(victim, killer, info) {
      const m = this.match;
      if (victim.isPlayer) {
        this.ds++;
        this.deathBy = killer && killer.peer ? killer.peer : '';
        this.deathW = info.weapon || '';
        m.killfeed(killer, victim, info);
        G.hud.playerDied(killer, info);
      }
    }

    explosionVisual(pos) {
      this.exList.push([+pos.x.toFixed(1), +pos.y.toFixed(1), +pos.z.toFixed(1), ++this.exSeq]);
      if (this.exList.length > 3) this.exList.shift();
    }

    update(dt) {
      const m = this.match;
      if (!m) return;
      const p = m.player;
      const me = this.myPeer;
      // durumumu yayınla (~20 Hz)
      this.sendT -= dt;
      if (this.sendT <= 0) {
        this.sendT = 0.05;
        this.t.setPresence({
          ph: 'game',
          gid: this.go.id,
          n: (G.settings.callsign || 'Oyuncu').slice(0, 16),
          t: this.ffa ? null : p.team,
          p: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)],
          y: +p.yaw.toFixed(3),
          pi: +p.pitch.toFixed(3),
          s: p.prone ? 2 : p.crouching || p.slideT > 0 ? 1 : 0,
          hp: Math.round(p.health),
          a: p.alive ? 1 : 0,
          w: p.weapon ? p.weapon.id : 'simsek',
          op: G.settings.operator || 'kurt',
          fs: this.fs,
          k: p.kills,
          d: p.deaths,
          h: this.hits,
          ds: this.ds,
          db: this.deathBy || '',
          dw: this.deathW || '',
          ex: this.exList,
        });
      }
      // uzak oyuncular
      const seen = new Set();
      for (const peer of this.peers()) {
        if (peer.me) continue;
        const pr = peer.presence || {};
        if (pr.gid !== this.go.id || !pr.p) continue;
        seen.add(peer.peer);
        let r = this.remotes[peer.peer];
        if (!r) {
          r = this.remotes[peer.peer] = new RemotePlayer(peer.peer, pr, m.scene, this.ffa);
          m.chars.push(r);
          G.hud.medal(r.name + ' oyuna katıldı');
        }
        r.applyPresence(pr, dt);
        if (!this.ffa && pr.t != null) r.team = pr.t;
        // ateş sesleri
        if ((pr.fs || 0) > r.known.fs) {
          const n = Math.min(3, pr.fs - r.known.fs);
          r.known.fs = pr.fs;
          for (let i = 0; i < n; i++) this.remoteShot(r);
        }
        // bana gelen isabetler
        const last = this.lastSeq[peer.peer] || 0;
        let maxQ = last;
        for (const h of pr.h || []) {
          if (h[0] !== me || h[3] <= last) continue;
          maxQ = Math.max(maxQ, h[3]);
          if (p.alive) {
            const wname = G.WEAPONS[h[4]] ? G.WEAPONS[h[4]].name : h[4] || 'Silah';
            p.takeDamage(h[1], r, { weapon: wname, headshot: !!h[2], from: r.pos.clone(), online: true });
          }
        }
        this.lastSeq[peer.peer] = maxQ;
        // ölümler
        if ((pr.ds || 0) > r.known.ds) {
          r.known.ds = pr.ds;
          const killerPeer = pr.db;
          let killer = null;
          if (killerPeer === me) killer = p;
          else if (this.remotes[killerPeer]) killer = this.remotes[killerPeer];
          m.killfeed(killer, r, { weapon: pr.dw });
          if (killer === p) {
            p.kills++;
            p.killsLife++;
            G.hud.hitmarker(true, false);
            G.audio.play('kill', { priority: true });
            m.addScore(p, 100, r.name + ' öldürüldü');
            m.xp += 50;
            if (!this.ffa) m.teamScore[p.team === 0 ? 0 : 1]++;
          } else if (!this.ffa && killer) m.teamScore[killer.team === 0 ? 0 : 1]++;
        }
        // patlama görselleri
        for (const e of pr.ex || []) {
          if (e[3] > r.known.ex) {
            r.known.ex = e[3];
            G.fx.explosion(new THREE.Vector3(e[0], e[1], e[2]), 5);
            G.audio.play('explosion', { pos: new THREE.Vector3(e[0], e[1], e[2]), priority: true });
          }
        }
      }
      // ayrılanlar
      for (const id in this.remotes) {
        if (!seen.has(id)) {
          const r = this.remotes[id];
          G.hud.medal(r.name + ' ayrıldı');
          r.dispose();
          const i = m.chars.indexOf(r);
          if (i >= 0) m.chars.splice(i, 1);
          delete this.remotes[id];
        }
      }
      // takım skoru (TÖM) kendi öldürmelerimden + uzakların k toplamından
      if (!this.ffa) {
        const sc = [0, 0];
        sc[p.team === 0 ? 0 : 1] += p.kills;
        for (const id in this.remotes) {
          const r = this.remotes[id];
          sc[r.team === 0 ? 0 : 1] += r.kills;
        }
        m.teamScore = sc;
      }
      // bitiş
      const lim = m.scoreLimit;
      const all = [p].concat(Object.values(this.remotes));
      const leader = all.slice().sort((a, b) => b.kills - a.kills)[0];
      const timeLeft = 600 - (Date.now() - this.go.t0) / 1000;
      G.hud.setTimer(Math.max(0, timeLeft));
      if (this.ffa && leader && leader.kills >= lim) this.finish(leader === p, leader.name);
      else if (!this.ffa && (m.teamScore[0] >= lim || m.teamScore[1] >= lim)) this.finish(m.teamScore[p.team === 0 ? 0 : 1] >= lim, m.teamScore[0] >= lim ? 'Gölge Timi' : 'Kızıl Pençe');
      else if (timeLeft <= 0) this.finish(leader === p, leader ? leader.name : '');
    }

    finish(win, who) {
      const m = this.match;
      if (!m || m.state !== 'playing') return;
      m.end('online', { win, title: win ? 'KAZANDIN!' : 'MAÇ BİTTİ', sub: who ? `Kazanan: ${who}` : '' });
    }

    remoteShot(r) {
      const stats = G.WEAPONS[r.weaponId] || G.WEAPONS.simsek;
      G.audio.shot(stats.sound, r.pos, {});
      const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
      const muzzle = new THREE.Vector3(r.pos.x + fx * 0.7, r.pos.y + U.lerp(1.42, 0.98, r.crouchT), r.pos.z + fz * 0.7);
      const dir = new THREE.Vector3(fx * Math.cos(r.pitch), Math.sin(r.pitch), fz * Math.cos(r.pitch)).normalize();
      G.fx.muzzle(muzzle, dir, false);
      const hit = G.world.raycast(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, 80);
      const end = hit ? new THREE.Vector3(hit.x, hit.y, hit.z) : muzzle.clone().addScaledVector(dir, 80);
      G.fx.tracer(muzzle, end, 0xffb070);
      r.spotted = G.time + 1.5;
    }
  }
  G.Net = Net;
})();
