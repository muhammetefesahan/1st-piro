'use strict';
// Gölge Timi — Zombi modu: zombiler, köpekler, rauntlar, kapılar, duvar
// silahları, gizem kutusu, yetenek makineleri (Çay Ocağı dahil), dönüştürücü.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const FACE_N = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // ------------------------------------------------------------------
  class Zombie extends G.Character {
    constructor(kind, health, tier) {
      super({ team: 9, name: kind === 'dog' ? 'Cehennem Köpeği' : 'Zombi', kind, health });
      this.tier = tier;
      this.speed = kind === 'dog' ? U.rand(6.2, 7.2) : [U.rand(1.3, 1.8), U.rand(3.4, 4.0), U.rand(5.0, 5.8)][tier];
      this.radius = kind === 'dog' ? 0.4 : 0.32;
      this.height = kind === 'dog' ? 1.0 : 1.8;
      this.riseT = kind === 'dog' ? 1 : 0;
      this.attackT = 0;
      this.attackCD = 0;
      this.groanAt = G.time + U.rand(1, 6);
      this.stuckT = 0;
      this.lastPos = new THREE.Vector3();
      this.lastProgress = G.time;
    }
    buildModel(scene) {
      this.model = this.kind === 'dog' ? G.makeDog() : G.makeHumanoid({ kind: 'zombie', eyeColor: this.tier === 2 ? 0x40c0ff : 0xffa020 });
      scene.add(this.model.root);
    }
    update(dt, dir) {
      const m = this.model;
      if (!this.alive) {
        if (m) m.animate(dt, { dead: true });
        return;
      }
      const p = dir.player;
      const world = G.world;
      if (this.riseT < 1) {
        this.riseT = Math.min(1, this.riseT + dt / 1.2);
        if (m) {
          m.root.position.set(this.pos.x, 0, this.pos.z);
          m.root.rotation.y = this.yaw;
          m.animate(dt, { speed: 0, rise: this.riseT });
        }
        return;
      }
      if (m && m.root.position.y < 0) m.root.position.y = 0;
      const frozen = G.time < dir.teaBreakUntil;
      let mx = 0, mz = 0;
      const dxp = p.pos.x - this.pos.x, dzp = p.pos.z - this.pos.z;
      const distP = Math.hypot(dxp, dzp);
      // saldırı
      this.attackCD -= dt;
      if (this.attackT > 0) {
        this.attackT -= dt;
        if (this.attackT <= 0 && p.alive) {
          if (distP < (this.kind === 'dog' ? 1.8 : 1.7) && Math.abs(p.pos.y - this.pos.y) < 1.5) {
            p.takeDamage(this.kind === 'dog' ? 40 : 50, this, { weapon: this.name, melee: true, from: this.pos.clone() });
            G.audio.play('stab', { vol: 0.7 });
          }
        }
      } else if (!frozen && p.alive && distP < (this.kind === 'dog' ? 1.4 : 1.3) && this.attackCD <= 0 && Math.abs(p.pos.y - this.pos.y) < 1.5) {
        this.attackT = this.kind === 'dog' ? 0.3 : 0.45;
        this.attackCD = 1.1;
        G.audio.play(this.kind === 'dog' ? 'bark' : 'zattack', { pos: this.pos });
      } else if (!frozen && p.alive) {
        // yön: yakında ve görüşte ise doğrudan, değilse akış alanı
        const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
        let tx = p.pos.x, tz = p.pos.z;
        const direct = distP < 7 && G.gridLine(world.walk, world.w, world.h, this.pos.x / CELL, this.pos.z / CELL, p.pos.x / CELL, p.pos.z / CELL, 0.18);
        if (!direct && dir.field) {
          let best = dir.field[cx + cz * world.w], bx = -1, bz = -1;
          for (let ddz = -1; ddz <= 1; ddz++)
            for (let ddx = -1; ddx <= 1; ddx++) {
              if (!ddx && !ddz) continue;
              if (!G.canStep(world.walk, world.w, world.h, cx, cz, ddx, ddz)) continue;
              const v = dir.field[cx + ddx + (cz + ddz) * world.w];
              if (v < best) {
                best = v;
                bx = cx + ddx;
                bz = cz + ddz;
              }
            }
          if (bx >= 0) {
            tx = bx * CELL + CELL / 2;
            tz = bz * CELL + CELL / 2;
          } else if (!isFinite(dir.field[cx + cz * world.w])) {
            // ulaşılamaz hücrede: en yakın yürünebilire doğru
            const n = world.nearestWalkable(cx, cz);
            if (n) {
              tx = n[0] * CELL + 1;
              tz = n[1] * CELL + 1;
            }
          }
        }
        const dx = tx - this.pos.x, dz = tz - this.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        mx = dx / d;
        mz = dz / d;
      }
      // ayrışma
      for (const o of dir.zombies) {
        if (o === this || !o.alive) continue;
        const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.55 && d2 > 1e-5) {
          const d = Math.sqrt(d2);
          mx += (dx / d) * 0.7;
          mz += (dz / d) * 0.7;
        }
      }
      const l = Math.hypot(mx, mz);
      if (l > 1) {
        mx /= l;
        mz /= l;
      }
      let sp = this.attackT > 0 ? 0.3 : this.speed;
      if (G.time < this.stunUntil) sp *= 0.4;
      this.vel.x = U.damp(this.vel.x, mx * sp, 10, dt);
      this.vel.z = U.damp(this.vel.z, mz * sp, 10, dt);
      this.vel.y -= 20 * dt;
      world.moveCharacter(this, this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
      if (this.grounded) this.vel.y = 0;
      // oyuncunun içine girme
      const ddx = this.pos.x - p.pos.x, ddz = this.pos.z - p.pos.z;
      const dd = Math.hypot(ddx, ddz);
      if (dd < 0.62 && dd > 1e-4 && p.alive) {
        this.pos.x = p.pos.x + (ddx / dd) * 0.62;
        this.pos.z = p.pos.z + (ddz / dd) * 0.62;
      }
      if (l > 0.1 && !frozen) {
        const wy = Math.atan2(-this.vel.x, -this.vel.z);
        this.yaw += U.clamp(U.wrapAngle(wy - this.yaw), -8 * dt, 8 * dt);
      }
      // takılma
      if (this.pos.distanceTo(this.lastPos) > 1.5) {
        this.lastPos.copy(this.pos);
        this.lastProgress = G.time;
      } else if (G.time - this.lastProgress > 12 && distP > 12 && !frozen) {
        dir.respawnStuck(this);
        return;
      }
      if (G.time > this.groanAt) {
        this.groanAt = G.time + U.rand(3, 8);
        G.audio.play(this.kind === 'dog' ? 'bark' : 'groan', { pos: this.pos, vol: 0.8, ref: 8 });
      }
      if (m) {
        m.root.position.set(this.pos.x, this.pos.y, this.pos.z);
        m.root.rotation.y = this.yaw;
        m.animate(dt, { speed: frozen ? 0 : Math.hypot(this.vel.x, this.vel.z), attack: this.attackT > 0 ? 1 : 0 });
      }
    }
  }
  G.Zombie = Zombie;

  // ------------------------------------------------------------------
  // Etiketli tabela sprite
  function signSprite(text, sub, color, w, h) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,8,12,0.75)';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = color || '#ffd23a';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 92);
    ctx.fillStyle = color || '#ffd23a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Pixelify Sans", sans-serif';
    ctx.fillText(text, 128, 40);
    if (sub) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px "Pixelify Sans", sans-serif';
      ctx.fillText(sub, 128, 76);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(w || 1.6, h || 0.6, 1);
    return sp;
  }
  G.signSprite = signSprite;

  function powerTex(type) {
    const def = G.POWERUPS[type];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const col = '#' + def.color.toString(16).padStart(6, '0');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 30px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sym = { cephane: 'C', tekvurus: '☠', ciftpuan: 'x2', nukleer: '☢', caymolasi: '☕' }[type] || '?';
    ctx.fillText(sym, 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  // ------------------------------------------------------------------
  class ZombieDirector {
    constructor(match) {
      this.match = match;
      this.world = G.world;
      this.player = match.player;
      this.scene = match.scene;
      this.zombies = [];
      this.round = 0;
      this.toSpawn = 0;
      this.spawnCD = 0;
      this.nextRoundAt = G.time + 3;
      this.betweenRounds = true;
      this.dropsThisRound = 0;
      this.power = false;
      this.doubleUntil = 0;
      this.instakillUntil = 0;
      this.teaBreakUntil = 0;
      this.powerups = [];
      this.kills = 0;
      this.headshots = 0;
      this.field = null;
      this.fieldCell = -1;
      this.openZones = new Set();
      this.buildEntities();
    }

    get instakill() {
      return G.time < this.instakillUntil;
    }

    addMachineBox(cx, cz, w, h, d) {
      const x = cx * CELL + 1, z = cz * CELL + 1;
      this.world.addBox(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { kind: 'machine', metal: true });
      this.world.blockCell(cx, cz);
    }

    facePos(p, dist) {
      const f = FACE_N[p.face] || [0, 1];
      return new THREE.Vector3(p.x * CELL + 1 + f[0] * dist, 0, p.z * CELL + 1 + f[1] * dist);
    }

    buildEntities() {
      const pts = this.world.points;
      const scene = this.world.group;
      // başlangıç bölgesi
      const st = pts.start[0];
      this.openZones.add(this.world.zoneAt(st.x * CELL + 1, st.z * CELL + 1));
      // yetenek makineleri
      this.perks = [];
      for (const p of pts.perk || []) {
        const def = G.ZM_PERKS[p.perk];
        const grp = new THREE.Group();
        const yaw = Math.atan2(FACE_N[p.face][0], FACE_N[p.face][1]);
        let glow;
        if (p.perk === 'demlicay') {
          // Çay ocağı: bakır semaver
          const copper = new THREE.MeshStandardMaterial({ color: 0xb8692e, metalness: 0.8, roughness: 0.35 });
          const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), G.mat('wood', { map: 'ahsap' }));
          table.position.y = 0.45;
          grp.add(table);
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 12), copper);
          body.position.y = 1.2;
          grp.add(body);
          const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.18, 12), copper);
          top.position.y = 1.59;
          grp.add(top);
          const pot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.3 }));
          pot.position.y = 1.78;
          grp.add(pot);
          const tap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), copper);
          tap.position.set(0, 1.05, 0.3);
          grp.add(tap);
          for (let i = 0; i < 3; i++) {
            const g = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.026, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xb2341a, transparent: true, opacity: 0.85, emissive: 0x3a0a00 }));
            g.position.set(-0.4 + i * 0.12, 0.95, 0.15);
            grp.add(g);
          }
          glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0xff7020 }));
          glow.position.y = 0.92;
          grp.add(glow);
        } else {
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.85), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.4, metalness: 0.3 }));
          body.position.y = 1.1;
          grp.add(body);
          glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: 0x222222 }));
          glow.position.set(0, 1.45, 0.44);
          grp.add(glow);
          const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111 }));
          slot.position.set(0, 0.5, 0.44);
          grp.add(slot);
        }
        const sign = signSprite(def.name, def.price + ' PUAN', '#' + def.color.toString(16).padStart(6, '0'));
        sign.position.y = 2.6;
        grp.add(sign);
        grp.position.set(p.x * CELL + 1, 0, p.z * CELL + 1);
        grp.rotation.y = yaw;
        scene.add(grp);
        this.addMachineBox(p.x, p.z, 1.1, 2.2, 1.1);
        this.perks.push({ perk: p.perk, def, pos: this.facePos(p, 1.3), center: grp.position.clone(), glow, color: def.color });
      }
      // duvar silahları
      this.wallbuys = [];
      for (const p of pts.wallbuy || []) {
        const ws = G.WEAPONS[p.weapon];
        const f = FACE_N[p.face];
        const sign = signSprite(ws.name, ws.zm.price + ' PUAN', '#e8e8e8', 1.8, 0.68);
        // duvara yakın yerleştir
        sign.position.set(p.x * CELL + 1 + f[0] * 0.9, 1.6, p.z * CELL + 1 + f[1] * 0.9);
        scene.add(sign);
        const gun = G.buildGun(G.computeStats(p.weapon, {}));
        gun.scale.setScalar(1.6);
        gun.position.set(p.x * CELL + 1 + f[0] * 0.92, 1.05, p.z * CELL + 1 + f[1] * 0.92);
        gun.rotation.y = Math.atan2(f[1], -f[0]) + Math.PI / 2;
        scene.add(gun);
        this.wallbuys.push({ weapon: p.weapon, price: ws.zm.price, pos: new THREE.Vector3(p.x * CELL + 1, 0, p.z * CELL + 1) });
      }
      // gizem kutusu
      this.boxLocs = (pts.box || []).map((p) => p);
      this.box = { loc: 0, uses: 0, state: 'idle', t: 0, weapon: null, group: null, models: {} };
      this.buildBoxAt(0);
      // dönüştürücü
      const up = (pts.upgrade || [])[0];
      if (up) {
        const grp = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a2440, metalness: 0.6, roughness: 0.4 }));
        base.position.y = 0.65;
        grp.add(base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 16), new THREE.MeshBasicMaterial({ color: 0x8040ff }));
        ring.position.set(0, 1.75, 0);
        grp.add(ring);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a3060, metalness: 0.6 }));
        top.position.y = 2.35;
        grp.add(top);
        for (const x of [-0.55, 0.55]) {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), new THREE.MeshStandardMaterial({ color: 0x3a3060 }));
          pil.position.set(x, 1.8, 0);
          grp.add(pil);
        }
        const sign = signSprite('Dönüştürücü', '5000 PUAN', '#b47bff');
        sign.position.y = 3;
        grp.add(sign);
        grp.position.set(up.x * CELL + 1, 0, up.z * CELL + 1);
        grp.rotation.y = Math.atan2(FACE_N[up.face][0], FACE_N[up.face][1]);
        scene.add(grp);
        this.addMachineBox(up.x, up.z, 1.6, 2.5, 1.2);
        this.upgrade = { pos: this.facePos(up, 1.4), center: grp.position.clone(), ring, state: 'idle', t: 0, inst: null, gunMesh: null, grp };
      }
      // güç şalteri
      const pw = (pts.power || [])[0];
      if (pw) {
        const grp = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x5a5a50, metalness: 0.5 }));
        panel.position.y = 1.3;
        grp.add(panel);
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xc02020 }));
        lever.position.set(0, 1.3, 0.2);
        lever.rotation.x = 0.6;
        grp.add(lever);
        const sign = signSprite('GÜÇ', 'Şalteri indir', '#ffd23a', 1.2, 0.45);
        sign.position.y = 2.4;
        grp.add(sign);
        grp.position.set(pw.x * CELL + 1, 0, pw.z * CELL + 1);
        grp.rotation.y = Math.atan2(FACE_N[pw.face][0], FACE_N[pw.face][1]);
        scene.add(grp);
        this.addMachineBox(pw.x, pw.z, 0.9, 2, 0.6);
        this.powerSwitch = { pos: this.facePos(pw, 1.2), lever };
      }
      this.recomputeField(true);
    }

    buildBoxAt(i) {
      const p = this.boxLocs[i];
      if (!p) return;
      const b = this.box;
      if (b.group) {
        this.world.group.remove(b.group);
        if (b.boxRef) b.boxRef.disabled = true;
        if (b.cell) this.world.walk[b.cell[0] + b.cell[1] * this.world.w] = 1;
      }
      const grp = new THREE.Group();
      const wood = G.mat('crate', { map: 'sandik' });
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.9), wood);
      base.position.y = 0.425;
      grp.add(base);
      const lid = new THREE.Group();
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.9), wood);
      lidMesh.position.set(0, 0, 0.45);
      lid.add(lidMesh);
      lid.position.set(0, 0.9, -0.45);
      grp.add(lid);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fb7ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 15;
      grp.add(beam);
      const sign = signSprite('Gizem Kutusu', '950 PUAN', '#6fb7ff');
      sign.position.y = 1.9;
      grp.add(sign);
      grp.position.set(p.x * CELL + 1, 0, p.z * CELL + 1);
      grp.rotation.y = Math.atan2(FACE_N[p.face][0], FACE_N[p.face][1]);
      this.world.group.add(grp);
      const x = p.x * CELL + 1, z = p.z * CELL + 1;
      b.boxRef = this.world.addBox(x - 0.85, 0, z - 0.85, x + 0.85, 0.95, z + 0.85, { kind: 'machine' });
      this.world.blockCell(p.x, p.z);
      b.cell = [p.x, p.z];
      b.group = grp;
      b.lid = lid;
      b.loc = i;
      b.pos = this.facePos(p, 1.4);
      b.center = new THREE.Vector3(x, 0, z);
      b.state = 'idle';
      this.field = null;
      this.fieldCell = -1;
    }

    // ------------------------------------------------------------------
    addPoints(n) {
      const p = this.player;
      const v = Math.round(n * (G.time < this.doubleUntil ? 2 : 1));
      p.points += v;
      G.hud && G.hud.pointsPop(v);
    }
    spend(n) {
      const p = this.player;
      if (p.points < n) {
        G.audio.play('deny');
        G.hud && G.hud.medal('Yetersiz puan');
        return false;
      }
      p.points -= n;
      G.hud && G.hud.pointsPop(-n);
      G.audio.play('buy');
      return true;
    }

    giveWeapon(id, upgraded) {
      const p = this.player;
      const ws = p.weapons;
      for (let i = 0; i < 2; i++) {
        if (ws[i] && ws[i].id === id && !!ws[i].upgraded === !!upgraded) {
          ws[i].reserve = ws[i].stats.reserve;
          ws[i].ammo = ws[i].stats.mag;
          p.equip(i);
          return;
        }
      }
      const inst = G.makeWeaponInst(id, {}, { upgraded });
      let slot = ws[0] == null ? 0 : ws[1] == null ? 1 : p.cur;
      ws[slot] = inst;
      p.equip(slot);
    }

    findInteraction(p) {
      if (!p.alive) return null;
      const near = (pos, r) => {
        const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
        if (d > (r || 2)) return false;
        return true;
      };
      // kapılar
      for (const id in this.world.doors) {
        const d = this.world.doors[id];
        if (d.open) continue;
        if (near(d.center, 2.6)) {
          return { text: `Kapıyı aç (${d.name})`, cost: d.cost, action: () => this.openDoor(id) };
        }
      }
      // duvar silahları
      for (const wb of this.wallbuys) {
        if (!near(wb.pos, 1.6)) continue;
        const has = p.weapons.find((w) => w && w.id === wb.weapon);
        const name = G.WEAPONS[wb.weapon].name;
        if (has) {
          const cost = has.upgraded ? 2500 : Math.round(wb.price / 2);
          return { text: `${name} cephanesi al`, cost, action: () => { if (this.spend(cost)) { has.reserve = has.stats.reserve; has.ammo = has.stats.mag; } } };
        }
        return { text: `${name} satın al`, cost: wb.price, action: () => { if (this.spend(wb.price)) this.giveWeapon(wb.weapon); } };
      }
      // gizem kutusu
      const b = this.box;
      if (b.group && near(b.pos, 1.8)) {
        if (b.state === 'idle') return { text: 'Gizem Kutusu', cost: 950, action: () => { if (this.spend(950)) this.rollBox(); } };
        if (b.state === 'offer') return { text: `${G.WEAPONS[b.weapon].name} al`, cost: 0, action: () => this.takeBox() };
      }
      // yetenekler
      for (const pk of this.perks) {
        if (!near(pk.pos, 1.6)) continue;
        if (p.zmPerks.has(pk.perk)) return { text: `${pk.def.name} (sende var)`, cost: 0, action: () => {} };
        if (!this.power && !pk.def.noPower) return { text: `${pk.def.name}: önce gücü aç`, cost: 0, action: () => G.audio.play('deny') };
        return { text: `${pk.def.name} iç`, cost: pk.def.price, desc: pk.def.desc, action: () => { if (this.spend(pk.def.price)) this.givePerk(pk.perk); } };
      }
      // güç
      if (this.powerSwitch && !this.power && near(this.powerSwitch.pos, 1.6)) {
        return { text: 'Gücü aç', cost: 0, action: () => this.turnOnPower() };
      }
      // dönüştürücü
      const u = this.upgrade;
      if (u && near(u.pos, 1.8)) {
        if (!this.power) return { text: 'Dönüştürücü: önce gücü aç', cost: 0, action: () => G.audio.play('deny') };
        if (u.state === 'idle') {
          const w = p.weapon;
          if (!w || w.upgraded) return { text: 'Dönüştürücü (bu silah olmaz)', cost: 0, action: () => G.audio.play('deny') };
          return { text: `${w.stats.name} dönüştür`, cost: 5000, action: () => { if (this.spend(5000)) this.startUpgrade(); } };
        }
        if (u.state === 'ready') return { text: `${u.inst.stats.name} al`, cost: 0, action: () => this.takeUpgrade() };
      }
      return null;
    }

    openDoor(id) {
      const d = this.world.doors[id];
      if (!this.spend(d.cost)) return;
      this.world.openDoor(id);
      for (const z of d.zones) this.openZones.add(z);
      G.audio.play('door', { pos: d.center, priority: true });
      G.hud && G.hud.medal(`${d.name} açıldı`);
      this.field = null;
      this.fieldCell = -1;
    }

    givePerk(id) {
      const p = this.player;
      p.zmPerks.add(id);
      G.audio.play('perk', { priority: true });
      G.audio.play('drink', { delay: 0.2 });
      if (id === 'demirderi') {
        p.maxHealth = 300;
        p.health = 300;
      }
      if (id === 'demlicay') {
        p.cay = Math.max(p.cay, 1);
        if (p.vm) {
          p.vm.setItem('cay');
          p.vm.play('drink', 1.3);
        }
      }
      G.hud && G.hud.medal(G.ZM_PERKS[id].name + ' alındı!');
    }

    turnOnPower() {
      this.power = true;
      G.audio.play('power', { priority: true });
      G.hud && G.hud.bigMessage('GÜÇ AÇILDI', 'Yetenek makineleri ve Dönüştürücü çalışıyor');
      if (this.powerSwitch) this.powerSwitch.lever.rotation.x = -0.6;
      for (const pk of this.perks) if (pk.perk !== 'demlicay') pk.glow.material.color.setHex(pk.color);
      for (const l of this.world.lampLights) l.intensity *= 1.8;
      if (this.world.hemi) this.world.hemi.intensity *= 1.35;
    }

    rollBox() {
      const b = this.box;
      b.state = 'rolling';
      b.t = 0;
      b.uses++;
      G.audio.play('box', { pos: b.center, priority: true });
      const pool = Object.keys(G.WEAPONS).filter((id) => G.WEAPONS[id].zm && G.WEAPONS[id].zm.box > 0 && !this.player.weapons.find((w) => w && w.id === id));
      b.pool = pool.map((id) => [id, G.WEAPONS[id].zm.box]);
      b.teddy = b.uses > 3 && this.boxLocs.length > 1 && Math.random() < 0.14;
      b.weapon = G.weightedPick(b.pool);
    }

    boxModel(id) {
      const b = this.box;
      if (!b.models[id]) {
        const g = G.buildGun(G.computeStats(id, {}));
        g.scale.setScalar(1.5);
        b.models[id] = g;
      }
      return b.models[id];
    }

    takeBox() {
      const b = this.box;
      this.giveWeapon(b.weapon);
      G.audio.play('buy');
      this.closeBox();
    }

    closeBox() {
      const b = this.box;
      if (b.shown) b.group.remove(b.shown);
      b.shown = null;
      b.state = 'idle';
      b.lid.rotation.x = 0;
    }

    startUpgrade() {
      const p = this.player;
      const u = this.upgrade;
      u.inst = p.weapon;
      p.weapons[p.cur] = null;
      const other = p.cur === 0 ? 1 : 0;
      if (p.weapons[other]) p.equip(other);
      else if (p.vm) p.vm.hidden = true;
      u.state = 'working';
      u.t = 0;
      G.audio.play('upgrade', { pos: u.center, priority: true });
      const g = G.buildGun(u.inst.stats);
      g.scale.setScalar(1.4);
      g.position.set(0, 1.75, 0);
      u.grp.add(g);
      u.gunMesh = g;
    }

    takeUpgrade() {
      const u = this.upgrade;
      const p = this.player;
      const id = u.inst.id;
      if (u.gunMesh) u.grp.remove(u.gunMesh);
      u.gunMesh = null;
      u.state = 'idle';
      if (p.vm) p.vm.hidden = false;
      const inst = G.makeWeaponInst(id, u.inst.att, { upgraded: true });
      const slot = p.weapons[0] == null ? 0 : p.weapons[1] == null ? 1 : p.cur;
      p.weapons[slot] = inst;
      p.equip(slot);
      u.inst = null;
      G.audio.play('powerup');
      G.hud && G.hud.medal(inst.stats.name + '!');
    }

    // ------------------------------------------------------------------
    recomputeField(force) {
      const p = this.player;
      const cx = Math.floor(p.pos.x / CELL), cz = Math.floor(p.pos.z / CELL);
      const idx = cx + cz * this.world.w;
      if (!force && idx === this.fieldCell && this.field) return;
      this.fieldCell = idx;
      const n = this.world.nearestWalkable(cx, cz) || [cx, cz];
      this.field = G.distanceField(this.world.walk, this.world.w, this.world.h, n[0], n[1], this.field);
    }

    spawnPoint(forDog) {
      const p = this.player;
      const world = this.world;
      if (forDog) {
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2, r = U.rand(7, 13);
          const x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
          const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
          if (world.isWalkable(cx, cz) && this.openZones.has(world.zoneOf[cx + cz * world.w]) && this.field && isFinite(this.field[cx + cz * world.w])) return world.cellCenter(cx, cz);
        }
      }
      const cands = [];
      for (const z of world.points.Z || []) {
        const c = world.cellCenter(z.x, z.z);
        const zone = world.zoneAt(c.x, c.z);
        if (!this.openZones.has(zone)) continue;
        const d = c.distanceTo(p.pos);
        if (d < 7) continue;
        cands.push([c, d < 40 ? 3 : 1]);
      }
      if (!cands.length) {
        const c = world.randomWalkable((x, z) => this.openZones.has(world.zoneOf[x + z * world.w]) && Math.hypot(x * CELL - p.pos.x, z * CELL - p.pos.z) > 8);
        return c ? world.cellCenter(c[0], c[1]) : null;
      }
      return G.weightedPick(cands).clone();
    }

    spawnZombie() {
      const dog = this.dogRound;
      const pos = this.spawnPoint(dog);
      if (!pos) return false;
      const hp = dog ? Math.round(G.zombieHealth(this.round) * 0.6) : G.zombieHealth(this.round);
      const z = new Zombie(dog ? 'dog' : 'zombie', hp, G.zombieSpeedTier(this.round, Math.random()));
      z.pos.copy(pos);
      z.pos.x += U.rand(-0.4, 0.4);
      z.pos.z += U.rand(-0.4, 0.4);
      z.yaw = Math.atan2(-(this.player.pos.x - pos.x), -(this.player.pos.z - pos.z));
      z.buildModel(this.world.group);
      z.model.root.position.copy(z.pos);
      if (dog) {
        G.fx.explosion(new THREE.Vector3(pos.x, 0.5, pos.z), 2, { plasma: false, small: true });
        G.audio.play('lightning', { pos });
      } else G.fx.dirt(pos);
      this.zombies.push(z);
      this.match.chars.push(z);
      return true;
    }

    respawnStuck(z) {
      z.alive = false;
      this.removeZombie(z);
      this.toSpawn++;
    }

    removeZombie(z) {
      const i = this.zombies.indexOf(z);
      if (i >= 0) this.zombies.splice(i, 1);
      const j = this.match.chars.indexOf(z);
      if (j >= 0) this.match.chars.splice(j, 1);
      if (z.model && z.model.root.parent) z.model.root.parent.remove(z.model.root);
    }

    startRound() {
      this.round++;
      this.dogRound = G.isDogRound(this.round);
      this.toSpawn = this.dogRound ? Math.min(24, 6 + Math.floor(this.round / 2)) : G.zombieCount(this.round);
      this.betweenRounds = false;
      this.dropsThisRound = 0;
      this.spawnCD = 1.5;
      G.audio.play('roundStart', { priority: true });
      G.hud && G.hud.roundChange(this.round, this.dogRound);
      if (this.dogRound) G.hud && G.hud.bigMessage('KÖPEK RAUNDU', 'Cehennem köpekleri geliyor!');
      if (this.player.zmPerks.has('demlicay')) this.player.cay = Math.min(3, this.player.cay + 1);
    }

    onZombieKilled(z, killer, info) {
      this.kills++;
      if (info.headshot) this.headshots++;
      if (killer === this.player) {
        let pts = info.melee ? 130 : info.headshot ? 100 : 60;
        this.addPoints(pts);
      }
      // güçlendirme düşür
      const lastOne = this.toSpawn === 0 && this.zombies.filter((x) => x.alive).length === 0;
      if (this.dogRound && lastOne) this.dropPowerup(z.pos, 'cephane');
      else if (!info.nuke && this.dropsThisRound < 4 && Math.random() < 0.03) {
        this.dropPowerup(z.pos, U.pick(Object.keys(G.POWERUPS)));
        this.dropsThisRound++;
      }
      setTimeout(() => this.removeZombie(z), 4000);
    }

    dropPowerup(pos, type) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerTex(type), transparent: true, depthWrite: false }));
      sp.scale.set(0.9, 0.9, 1);
      sp.position.set(pos.x, 1.1, pos.z);
      this.world.group.add(sp);
      const light = { sp, type, until: G.time + 26, base: pos.clone() };
      this.powerups.push(light);
      G.audio.play('powerupSpawn', { pos });
    }

    collectPowerup(pu) {
      const p = this.player;
      const def = G.POWERUPS[pu.type];
      G.audio.play('powerup', { priority: true });
      G.hud && G.hud.bigMessage(def.name.toUpperCase(), '');
      G.audio.announce(def.name);
      if (pu.type === 'cephane') {
        for (const w of p.weapons) if (w) w.reserve = w.stats.reserve;
        p.lethalCount = Math.max(p.lethalCount, 2);
      } else if (pu.type === 'tekvurus') this.instakillUntil = G.time + 30;
      else if (pu.type === 'ciftpuan') this.doubleUntil = G.time + 30;
      else if (pu.type === 'caymolasi') {
        this.teaBreakUntil = G.time + 7;
        p.cay++;
      } else if (pu.type === 'nukleer') {
        G.audio.play('nuke', { priority: true });
        G.fx.shake(0.6);
        for (const z of this.zombies.slice()) if (z.alive) z.takeDamage(1e9, null, { weapon: 'Nükleer', nuke: true, explosive: true });
        this.addPoints(400);
      }
    }

    // ------------------------------------------------------------------
    update(dt) {
      const p = this.player;
      this.recomputeField(false);
      // rauntlar
      const alive = this.zombies.filter((z) => z.alive).length;
      if (this.betweenRounds) {
        if (G.time >= this.nextRoundAt) this.startRound();
      } else {
        this.spawnCD -= dt;
        const maxAlive = this.dogRound ? 8 : Math.min(24, 10 + this.round * 2);
        if (this.toSpawn > 0 && alive < maxAlive && this.spawnCD <= 0) {
          if (this.spawnZombie()) this.toSpawn--;
          this.spawnCD = this.dogRound ? 1.2 : Math.max(0.35, 2.0 - this.round * 0.12);
        }
        if (this.toSpawn === 0 && alive === 0) {
          this.betweenRounds = true;
          this.nextRoundAt = G.time + 9;
          G.audio.play('roundEnd', { priority: true });
          G.hud && G.hud.medal(`${this.round}. raunt tamamlandı`);
        }
      }
      for (const z of this.zombies) z.update(dt, this);
      // güçlendirmeler
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        pu.sp.position.y = 1.1 + Math.sin(G.time * 3) * 0.15;
        const left = pu.until - G.time;
        pu.sp.visible = left > 6 || Math.floor(G.time * 6) % 2 === 0;
        if (p.alive && Math.hypot(pu.base.x - p.pos.x, pu.base.z - p.pos.z) < 1.6) {
          this.collectPowerup(pu);
          this.world.group.remove(pu.sp);
          this.powerups.splice(i, 1);
        } else if (left <= 0) {
          this.world.group.remove(pu.sp);
          this.powerups.splice(i, 1);
        }
      }
      // kutu animasyonu
      const b = this.box;
      if (b.state === 'rolling') {
        b.t += dt;
        b.lid.rotation.x = -Math.min(1.2, b.t * 3);
        if (b.shown) b.group.remove(b.shown);
        const ids = b.pool.map((x) => x[0]);
        const showId = b.t < 2.9 ? ids[Math.floor(b.t * 7) % ids.length] : b.weapon;
        b.shown = this.boxModel(showId);
        b.shown.position.set(0, 1.0 + Math.min(1, b.t / 2.9) * 0.6, 0);
        b.shown.rotation.y = Math.PI / 2;
        b.group.add(b.shown);
        if (b.t >= 3.2) {
          if (b.teddy) {
            b.state = 'moving';
            b.t = 0;
            if (b.shown) b.group.remove(b.shown);
            b.shown = null;
            this.player.points += 950;
            G.hud && G.hud.bigMessage('KUTU TAŞINIYOR', '950 puan iade edildi');
            G.audio.play('groan', { pos: b.center, priority: true });
          } else {
            b.state = 'offer';
            b.t = 0;
          }
        }
      } else if (b.state === 'offer') {
        b.t += dt;
        if (b.shown) b.shown.position.y = 1.6 - (b.t / 9) * 0.6;
        if (b.t > 9) this.closeBox();
      } else if (b.state === 'moving') {
        b.t += dt;
        b.group.position.y = b.t * 3;
        b.group.rotation.y += dt * 4;
        if (b.t > 2.5) {
          let ni = b.loc;
          while (ni === b.loc) ni = U.randInt(0, this.boxLocs.length - 1);
          b.uses = 0;
          this.buildBoxAt(ni);
          G.hud && G.hud.medal('Gizem Kutusu yeni yerinde');
        }
      }
      // dönüştürücü
      const u = this.upgrade;
      if (u) {
        u.ring.rotation.z += dt * (this.power ? 2 : 0.2);
        if (u.state === 'working') {
          u.t += dt;
          if (u.gunMesh) u.gunMesh.rotation.y += dt * 6;
          if (u.t > 3.4) {
            u.state = 'ready';
            u.t = 0;
          }
        } else if (u.state === 'ready') {
          u.t += dt;
          if (u.gunMesh) u.gunMesh.rotation.y += dt * 1.5;
          if (u.t > 12) {
            if (u.gunMesh) u.grp.remove(u.gunMesh);
            u.gunMesh = null;
            u.state = 'idle';
            u.inst = null;
            if (p.vm) p.vm.hidden = false;
          }
        }
      }
    }

    modifyDamage(target, attacker, amount, info) {
      const p = this.player;
      if (target.kind === 'zombie' || target.kind === 'dog') {
        if (attacker !== p && !info.nuke && attacker !== null) return 0;
        if (this.instakill) return 1e9;
        return amount;
      }
      if (target === p) {
        if (G.time < (p.invulnUntil || 0)) return 0;
        if (p.health - amount <= 0 && p.zmPerks.has('ikincisans')) {
          p.zmPerks.delete('ikincisans');
          p.health = p.maxHealth * 0.6;
          p.invulnUntil = G.time + 3;
          G.hud && G.hud.bigMessage('İKİNCİ ŞANS', 'Ayağa kalktın!');
          G.audio.play('perk', { priority: true });
          for (const z of this.zombies) {
            if (!z.alive) continue;
            const d = z.pos.distanceTo(p.pos);
            if (d < 4) z.stunUntil = G.time + 2.5;
          }
          return 0;
        }
        return amount;
      }
      return amount;
    }

    onDamage(target, attacker, amount, info) {
      if ((target.kind === 'zombie' || target.kind === 'dog') && attacker === this.player && target.alive && !info.nuke) this.addPoints(10);
    }
  }
  G.ZombieDirector = ZombieDirector;
})();
