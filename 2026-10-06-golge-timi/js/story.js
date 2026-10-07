'use strict';
// Gölge Timi — Hikâye modu: "Kızıl Sis" harekâtı. Beş görev.
// Karakterler: Yüzbaşı Arda (komuta), Çaycı Rıza (timin çaycısı ve
// teknisyeni), Dr. Elif Aydın (kaçırılan bilim insanı), Kuzgun (Kızıl Pençe lideri).
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;

  G.STORY_PROLOGUE = [
    'Kızıl Pençe adlı paralı asker örgütü, Kayıp Tesis’te geliştirilen deneysel "Kızıl Sis" virüsünü çaldı.',
    'Virüsü taşıyan konvoy limana ulaştı. Gece yarısı bir gemiye yüklenecek.',
    'Gölge Timi devrede. Sen Gölge-1’sin. Yanında Yüzbaşı Arda ve timin vazgeçilmezi Çaycı Rıza var.',
    'Rıza’nın demlediği çay efsanedir: bir bardak, bir timin moralini ve gücünü yerine getirir.',
  ];

  // Görev yardımcıları
  function say(lines) {
    G.hud.radio(lines);
  }
  function spawnEnemy(m, pos, opts) {
    const o = opts || {};
    const b = m.addBot({ team: 1, name: o.name || U.pick(G.BOT_NAMES.enemy), difficulty: m.cfg.difficulty, weapon: o.weapon, health: o.health, guard: o.guard ? pos.clone() : null, passive: o.passive });
    b.spawnAt(pos, o.yaw != null ? o.yaw : Math.random() * 6.28);
    b.storyNoRespawn = true;
    if (o.boss) b.isBoss = true;
    return b;
  }
  function spawnAlly(m, pos, name, weapon) {
    const b = m.addBot({ team: 0, name, difficulty: 'zor', ally: true, weapon });
    b.spawnAt(pos, 0);
    b.storyAlly = true;
    return b;
  }
  function cellPos(m, x, z) {
    return m.world.cellCenter(x, z);
  }
  function aliveEnemies(m) {
    return m.bots.filter((b) => b.team === 1 && b.alive).length;
  }

  // Sevimli görev nesneleri (yalnızca görsel; çarpışma yok). Biçim yardımcıları props.js'teki G.cuteKit'ten.
  let screenTex = null;
  function terminalScreen() {
    if (screenTex) return screenTex;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#9ff5d0');
      g.addColorStop(1, '#3ddc97');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#3b2a4a';
      // gülen ekran yüzü
      for (const x of [92, 164]) {
        ctx.beginPath();
        ctx.ellipse(x, 50, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3b2a4a';
      ctx.beginPath();
      ctx.arc(128, 62, 22, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,111,168,0.6)';
      for (const x of [70, 186]) {
        ctx.beginPath();
        ctx.ellipse(x, 72, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fffaf3';
      ctx.fillRect(40, 100, 176, 14);
      ctx.fillStyle = '#ff6fa8';
      ctx.fillRect(40, 100, 110, 14);
      ctx.font = '800 18px "Baloo 2", "Nunito", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#3b2a4a';
      ctx.fillText('VERİ', 236, 24);
    };
    draw();
    screenTex = new THREE.CanvasTexture(c);
    if (G.cuteKit && G.cuteKit.onFonts) G.cuteKit.onFonts(() => {
      draw();
      screenTex.needsUpdate = true;
    });
    return screenTex;
  }
  function cuteProp(kind) {
    const K = G.cuteKit;
    if (!K || !G.Bucket) return null;
    const t = K.tpl(), C = K.C, M = K.mtx;
    const g = new THREE.Group();
    const B = new G.Bucket();
    if (kind === 'terminal') {
      for (const [x, z] of [[-0.34, -0.2], [0.34, -0.2], [-0.34, 0.2], [0.34, 0.2]]) B.addGeo(t.blob, M(x, 0.05, z, 0, 0.09, 0.06, 0.09), C.ink);
      B.addGeo(K.roundBox(0.9, 1.45, 0.55, 0.16), M(0, 0.8, 0, 0), C.skyUI);
      B.addGeo(K.roundBox(0.76, 0.56, 0.06, 0.12), M(0, 1.18, 0.27, 0), C.cream);
      B.addGeo(K.roundBox(0.8, 0.08, 0.3, 0.04), M(0, 0.78, 0.38, 0, 1, 1, 1, 0.3), C.lilac);
      for (let i = 0; i < 4; i++) B.addGeo(t.box, M(-0.27 + i * 0.18, 0.83, 0.38, 0, 0.12, 0.03, 0.1, 0.3), [C.coral, C.sun, C.mintUI, C.bubble][i]);
      B.addGeo(t.cyl6, M(0.25, 1.72, 0, 0, 0.02, 0.3, 0.02), C.ink);
      B.addGeo(t.sph, M(0.25, 1.9, 0, 0, 0.07), C.bubble);
      B.addGeo(K.starGeo(0.1, 0.03), M(0.46, 0.6, 0, Math.PI / 2), C.sun);
      const mesh = B.mesh(K.toon('st-prop', { vertexColors: true }), true);
      mesh.receiveShadow = false;
      g.add(mesh);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.44), new THREE.MeshBasicMaterial({ map: terminalScreen() }));
      scr.position.set(0, 1.18, 0.305);
      g.add(scr);
      return g;
    }
    if (kind === 'case') {
      B.addGeo(K.roundBox(0.62, 1.12, 0.62, 0.12), M(0, 0.56, 0, 0), C.butter);
      B.addGeo(t.box, M(0, 1.1, 0, 0, 0.66, 0.05, 0.66), C.tang);
      B.addGeo(K.roundBox(0.7, 0.42, 0.26, 0.1), M(0, 1.34, 0, 0), C.bubble);
      B.addGeo(t.torus, M(0, 1.58, 0, 0, 0.11, 0.09, 0.14), C.ink);
      for (const s of [-1, 1]) B.addGeo(t.box, M(s * 0.2, 1.48, 0.13, 0, 0.08, 0.06, 0.03), C.sun);
      B.addGeo(K.starGeo(0.07, 0.02), M(-0.22, 1.3, 0.135, 0), C.white);
      const mesh = B.mesh(K.toon('st-prop', { vertexColors: true }), true);
      mesh.receiveShadow = false;
      g.add(mesh);
      const vial = new THREE.Mesh(t.sph, new THREE.MeshBasicMaterial({ color: 0xff7ab0 }));
      vial.scale.set(0.07, 0.09, 0.03);
      vial.position.set(0.1, 1.33, 0.135);
      g.add(vial);
      return g;
    }
    if (kind === 'bomb') {
      B.addGeo(t.sph, M(0, 0.26, 0, 0, 0.26), 0x6a5acd);
      B.addGeo(t.blob, M(-0.09, 0.36, 0.17, 0, 0.06, 0.04, 0.03), C.white);
      B.addGeo(t.cyl6, M(0, 0.53, 0, 0, 0.08, 0.08, 0.08), C.ink);
      B.addGeo(t.rope, K.segMtx(new THREE.Vector3(0, 0.56, 0), new THREE.Vector3(0.08, 0.7, 0.02), 0.018), C.cream);
      const mesh = B.mesh(K.toon('st-prop', { vertexColors: true }), true);
      mesh.receiveShadow = false;
      g.add(mesh);
      const spark = new THREE.Mesh(K.starGeo(0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      spark.position.set(0.09, 0.73, 0.02);
      g.add(spark);
      return g;
    }
    if (kind === 'docs') {
      B.addGeo(K.roundBox(0.9, 0.08, 0.6, 0.04), M(0, 0.7, 0, 0), C.wood);
      for (const [x, z] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]]) B.addGeo(t.box, M(x, 0.34, z, 0, 0.06, 0.68, 0.06), C.ink);
      B.addGeo(t.box, M(0.05, 0.76, 0.02, 0.15, 0.44, 0.03, 0.32), C.cream);
      B.addGeo(t.box, M(-0.02, 0.79, 0, -0.1, 0.42, 0.03, 0.3), C.coral);
      B.addGeo(t.box, M(-0.02, 0.805, 0.1, -0.1, 0.2, 0.01, 0.05), C.white);
      B.addGeo(K.starGeo(0.05, 0.01), M(0.12, 0.81, -0.06, 0, 1, 1, 1, -Math.PI / 2), C.sun);
      const mesh = B.mesh(K.toon('st-prop', { vertexColors: true }), true);
      mesh.receiveShadow = false;
      g.add(mesh);
      return g;
    }
    return null;
  }

  // Ortak görev çatısı
  function mission(def) {
    return Object.assign(
      {
        setup(m) {
          m.objectives = [];
          m.stage = 0;
          m.stageT = 0;
          m.checkpoint = null;
          m.interactProg = 0;
          m.storyDeaths = 0;
          m.player.applyLoadout(G.getClass(m.cfg.classIdx || 0));
          m.player.cay = 2;
          m.player.simit = 2;
          def.init(m);
          this.enterStage(m, 0);
        },
        enterStage(m, i) {
          m.stage = i;
          m.stageT = 0;
          const st = def.stages[i];
          if (!st) {
            m.end('success', { sub: def.successText, outro: def.outro });
            return;
          }
          m.objectiveText = st.text;
          G.hud.objective(st.text);
          if (st.radio) say(st.radio);
          if (st.enter) st.enter(m);
          m.checkpoint = m.player.pos.clone();
          m.checkpointYaw = m.player.yaw;
          m.interactProg = 0;
        },
        update(m, dt) {
          m.stageT += dt;
          const st = def.stages[m.stage];
          if (!st) return;
          if (st.update) st.update(m, dt);
          if (st.done && st.done(m)) {
            G.audio.play('flag', { priority: true });
            this.enterStage(m, m.stage + 1);
          }
        },
        findInteraction(m, p) {
          const st = def.stages[m.stage];
          if (!st || !st.interact) return null;
          const it = st.interact(m);
          if (!it) return null;
          if (p.pos.distanceTo(it.pos) > 2.4) return null;
          return {
            text: it.text + (m.interactProg > 0 ? ` (%${Math.round(m.interactProg * 100)})` : ' [basılı tut]'),
            cost: 0,
            hold: true,
            action: () => {},
            holdUpdate: (dt) => {
              m.interactProg += dt / (it.time || 2);
              if (m.interactProg >= 1) {
                m.interactProg = 0;
                it.onDone(m);
              }
            },
          };
        },
        onKill(m, victim, killer, info) {
          if (victim.isPlayer) m.storyDeaths++;
          const st = def.stages[m.stage];
          if (st && st.onKill) st.onKill(m, victim, killer, info);
        },
        respawnPlayer(m) {
          const p = m.player;
          p.spawn(m.checkpoint.clone(), m.checkpointYaw);
          p.cay = Math.max(p.cay, 1);
          G.hud.playerRespawned();
          G.hud.medal('Son kontrol noktasından devam');
        },
        respawnBot(m, b) {
          if (b.storyAlly) {
            const p = m.player;
            b.spawnAt(p.pos.clone().add(new THREE.Vector3(U.rand(-2, 2), 0, U.rand(-2, 2))), p.yaw);
            const nw = G.world.nearestWalkable(Math.floor(b.pos.x / CELL), Math.floor(b.pos.z / CELL));
            if (nw) b.pos.copy(G.world.cellCenter(nw[0], nw[1]));
            return;
          }
          if (!b.storyNoRespawn) m.respawnBot(b);
          else {
            const i = m.bots.indexOf(b);
            if (i >= 0) m.bots.splice(i, 1);
            const j = m.chars.indexOf(b);
            if (j >= 0) m.chars.splice(j, 1);
            setTimeout(() => b.model && b.model.root.parent && b.model.root.parent.remove(b.model.root), 3000);
          }
        },
        botGoal(m, bot) {
          if (bot.storyAlly) {
            const p = m.player;
            const g = p.pos.clone();
            g.x += U.rand(-4, 4);
            g.z += U.rand(-4, 4);
            return g;
          }
          if (def.enemyGoal) return def.enemyGoal(m, bot);
          return m.player.pos.clone();
        },
      },
      def
    );
  }

  const STORY = {};

  // ------------------------------------------------------------------
  // 1. SIFIR SAAT — Liman
  // ------------------------------------------------------------------
  STORY.m1 = mission({
    id: 'm1',
    title: 'Sıfır Saat',
    map: 'liman',
    place: 'Liman · 23:40',
    brief: 'Konvoy limana ulaştı. Rıhtımdaki muhafızları temizle, depodaki sevkiyat belgelerini ele geçir. Rıza ve Atmaca seninle.',
    successText: 'Sevkiyat belgeleri ele geçirildi. Virüs kasası gemiye değil, çölde bir kasabaya gitmiş.',
    outro: ['RIZA: Belgeler bende. Kasa Çöl Kasabası’na yola çıkmış. Dr. Elif Aydın da onlarla.', 'ARDA: Bir bardak çay iç, sonra yola çıkıyoruz.'],
    init(m) {
      const p = m.player;
      p.spawn(cellPos(m, 2, 14), -Math.PI / 2);
      spawnAlly(m, cellPos(m, 1, 12), 'Rıza', 'cakal');
      spawnAlly(m, cellPos(m, 1, 16), 'Atmaca', 'atmaca');
      const guards = [[8, 9], [10, 3], [14, 6], [20, 6], [25, 9], [16, 2], [24, 24], [12, 24], [6, 22], [28, 22], [30, 13], [26, 14]];
      for (const [x, z] of guards) {
        const nw = m.world.nearestWalkable(x, z);
        spawnEnemy(m, cellPos(m, nw[0], nw[1]), { guard: true });
      }
    },
    stages: [
      {
        text: 'Rıhtımdaki muhafızları etkisiz hale getir',
        radio: [['ARDA', 'Gölge-1, rıhtımda en az on iki muhafız var. Sessiz başla, sonra serbestsin.'], ['RIZA', 'Termosta çay var. Sıkışırsan [T] ile bir yudum al, kendine gelirsin.']],
        done: (m) => aliveEnemies(m) <= 2,
      },
      {
        text: 'Depoya gir ve sevkiyat belgelerini al',
        radio: [['ARDA', 'Rıhtım temiz. Belgeler ortadaki depoda, masanın üstünde.']],
        enter(m) {
          for (let i = 0; i < 4; i++) spawnEnemy(m, cellPos(m, 31, 12 + i * 2), { guard: false });
          m.docPos = cellPos(m, 15, 16);
          m.docMesh = cuteProp('docs');
          if (m.docMesh) {
            m.docMesh.position.copy(m.docPos);
            m.scene.add(m.docMesh);
          }
          m.marker = G.hud.worldMarker(m.docPos, 'BELGE');
        },
        interact: (m) => ({ pos: m.docPos, text: 'Belgeleri topla', time: 2.5, onDone: (mm) => (mm.gotDocs = true) }),
        done: (m) => m.gotDocs,
      },
      {
        text: 'Takviyeyi püskürt (kalan düşman yok olana kadar)',
        radio: [['RIZA', 'Belgeler bende! Dikkat, doğudan takviye geliyor!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
          if (m.docMesh) m.scene.remove(m.docMesh);
          for (let i = 0; i < 7; i++) spawnEnemy(m, cellPos(m, 31 + (i % 2), 3 + i * 3), {});
        },
        done: (m) => aliveEnemies(m) === 0,
      },
    ],
  });

  // ------------------------------------------------------------------
  // 2. KUM FIRTINASI — Çöl Kasabası
  // ------------------------------------------------------------------
  STORY.m2 = mission({
    id: 'm2',
    title: 'Kum Fırtınası',
    map: 'col',
    place: 'Çöl Kasabası · 12:15',
    brief: 'Dr. Elif Aydın güneydeki konakta tutuluyor. Kasabayı geç, onu kurtar ve tahliye helikopteri gelene kadar konağı savun.',
    successText: 'Dr. Elif Aydın kurtarıldı. Panzehir formülü onun aklında.',
    outro: ['ELİF: Kuzgun virüsü üste götürdü. Gece Üssü’nde laboratuvar kuruyorlar!', 'RIZA: Doktor hanım, buyurun bir çay. Yol uzun.'],
    init(m) {
      const p = m.player;
      p.spawn(cellPos(m, 16, 1), Math.PI);
      spawnAlly(m, cellPos(m, 14, 1), 'Rıza', 'gurz');
      spawnAlly(m, cellPos(m, 18, 1), 'Bora', 'simsek');
      const guards = [[6, 9], [27, 9], [16, 7], [12, 14], [21, 14], [5, 13], [28, 13], [16, 16], [13, 21], [20, 22], [8, 24], [25, 24]];
      for (const [x, z] of guards) {
        const nw = m.world.nearestWalkable(x, z);
        spawnEnemy(m, cellPos(m, nw[0], nw[1]), { guard: true });
      }
    },
    stages: [
      {
        text: 'Meydanı geçip güneydeki konağa ulaş',
        radio: [['ARDA', 'Konak kasabanın güneyinde. Sokaklarda keskin nişancılar olabilir.']],
        enter(m) {
          m.target = cellPos(m, 16, 21);
          m.marker = G.hud.worldMarker(m.target, 'KONAK');
        },
        done: (m) => m.player.pos.distanceTo(m.target) < 6,
      },
      {
        text: 'Dr. Elif Aydın’ın kelepçelerini çöz',
        radio: [['RIZA', 'İçerideyiz. Doktor hanım arka odada!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
          m.elifPos = cellPos(m, 17, 23);
          const elif = G.makeHumanoid({ kind: 'soldier', look: 2 });
          elif.root.position.copy(m.elifPos);
          elif.hips.position.y = 0.5;
          m.scene.add(elif.root);
          m.elif = elif;
          m.marker = G.hud.worldMarker(m.elifPos, 'DR. ELİF');
          for (let i = 0; i < 3; i++) spawnEnemy(m, cellPos(m, 13 + i * 3, 19), {});
        },
        interact: (m) => ({ pos: m.elifPos, text: 'Kelepçeleri çöz', time: 3, onDone: (mm) => (mm.freed = true) }),
        done: (m) => m.freed,
      },
      {
        text: 'Helikopter gelene kadar konağı savun (90 sn)',
        radio: [['ELİF', 'Teşekkürler! Kuzgun’un adamları geliyor, çok kalabalıklar!'], ['ARDA', 'Helikopter doksan saniyede orada. Dayanın!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
          m.elif.hips.position.y = 0.92;
          m.defendUntil = G.time + 90;
          m.waveAt = G.time + 3;
        },
        update(m) {
          G.hud.setTimer(m.defendUntil - G.time);
          if (G.time > m.waveAt && aliveEnemies(m) < 9) {
            m.waveAt = G.time + 7;
            const spots = [[3, 30], [30, 30], [16, 30], [1, 18], [32, 18], [10, 29], [24, 29]];
            for (let i = 0; i < 3; i++) {
              const s = U.pick(spots);
              const nw = m.world.nearestWalkable(s[0], s[1]);
              spawnEnemy(m, cellPos(m, nw[0], nw[1]), {});
            }
          }
        },
        done: (m) => {
          if (G.time >= m.defendUntil) {
            G.hud.setTimer(null);
            return true;
          }
          return false;
        },
      },
    ],
    enemyGoal(m) {
      if (m.stage === 2) return cellPos(m, 16, 21);
      return null;
    },
  });

  // ------------------------------------------------------------------
  // 3. KARANLIK ÜS — Gece Üssü
  // ------------------------------------------------------------------
  STORY.m3 = mission({
    id: 'm3',
    title: 'Karanlık Üs',
    map: 'us',
    place: 'Gece Üssü · 02:10',
    brief: 'Kızıl Pençe üste virüsü çoğaltıyor. Hangar, kışla ve jeneratöre patlayıcı yerleştir, sonra patlamaya kadar dayan.',
    successText: 'Üs havaya uçtu. Ama Kuzgun son anda kaçtı ve virüs örneğini Kayıp Tesis’e götürdü.',
    outro: ['ARDA: Kuzgun tesise kaçtı. Orada virüs çoktan sızmış olabilir.', 'RIZA: O zaman çayı demliyorum; uzun bir gece olacak.'],
    init(m) {
      const p = m.player;
      p.spawn(cellPos(m, 1, 15), -Math.PI / 2);
      spawnAlly(m, cellPos(m, 1, 13), 'Rıza', 'celik');
      spawnAlly(m, cellPos(m, 1, 17), 'Poyraz', 'kasirga');
      const guards = [[9, 6], [17, 7], [21, 9], [29, 6], [17, 15], [10, 18], [25, 18], [8, 25], [27, 25], [17, 28], [5, 12], [30, 12], [14, 9], [33, 15]];
      for (const [x, z] of guards) {
        const nw = m.world.nearestWalkable(x, z);
        spawnEnemy(m, cellPos(m, nw[0], nw[1]), { guard: true });
      }
      m.charges = [
        { pos: cellPos(m, 18, 8), name: 'Hangar', done: false },
        { pos: cellPos(m, 8, 25), name: 'Batı Kışlası', done: false },
        { pos: cellPos(m, 27, 25), name: 'Doğu Kışlası', done: false },
      ];
    },
    stages: [
      {
        text: 'Üç noktaya patlayıcı yerleştir (0/3)',
        radio: [['ARDA', 'Hangar ve iki kışla. Her birine birer kalıp. Yerleştirmek birkaç saniye sürer.'], ['RIZA', 'Ben arkanı kollarım. Termosu unutma!']],
        enter(m) {
          m.markers = m.charges.map((c) => G.hud.worldMarker(c.pos, c.name.toUpperCase()));
        },
        update(m) {
          const n = m.charges.filter((c) => c.done).length;
          G.hud.objective(`Üç noktaya patlayıcı yerleştir (${n}/3)`);
          if (!m.reinf && n >= 1) {
            m.reinf = true;
            for (let i = 0; i < 6; i++) spawnEnemy(m, cellPos(m, 34, 10 + i * 2), {});
            say([['ARDA', 'Fark ettiler! Doğudan takviye geliyor!']]);
          }
          if (!m.heliCalled && n >= 2) {
            m.heliCalled = true;
            const boss = m.bots.find((b) => b.team === 1 && b.alive) || { team: 1, pos: new THREE.Vector3() };
            G.streaks.spawnHeli(boss);
            say([['ARDA', 'Düşman helikopteri! Roketin varsa şimdi tam zamanı.']]);
          }
        },
        interact: (m) => {
          const p = m.player;
          let best = null;
          for (const c of m.charges) if (!c.done && p.pos.distanceTo(c.pos) < 2.4) best = c;
          if (!best) return null;
          return {
            pos: best.pos,
            text: best.name + ': patlayıcı yerleştir',
            time: 3,
            onDone: () => {
              best.done = true;
              const bomb = cuteProp('bomb');
              if (bomb) {
                bomb.position.copy(best.pos);
                m.scene.add(bomb);
              }
              G.audio.play('beep', { priority: true });
              G.hud.removeMarker(m.markers[m.charges.indexOf(best)]);
            },
          };
        },
        done: (m) => m.charges.every((c) => c.done),
      },
      {
        text: 'Patlamaya kadar hayatta kal (45 sn)',
        radio: [['ARDA', 'Fünyeler kuruldu! Kırk beş saniye. Batı çıkışına çekilin!']],
        enter(m) {
          m.boomAt = G.time + 45;
          m.waveAt = G.time + 2;
        },
        update(m) {
          G.hud.setTimer(m.boomAt - G.time);
          if (G.time > m.waveAt && aliveEnemies(m) < 10) {
            m.waveAt = G.time + 6;
            for (let i = 0; i < 3; i++) spawnEnemy(m, cellPos(m, 34, U.randInt(10, 20)), {});
          }
        },
        done: (m) => {
          if (G.time >= m.boomAt) {
            G.hud.setTimer(null);
            for (const c of m.charges) G.combat.explode(c.pos.clone().setY(1), 9, 999, m.player, { weaponName: 'Fünye' });
            return true;
          }
          return false;
        },
      },
    ],
  });

  // ------------------------------------------------------------------
  // 4. KIZIL SİS — Kayıp Tesis (zombiler)
  // ------------------------------------------------------------------
  STORY.m4 = mission({
    id: 'm4',
    title: 'Kızıl Sis',
    map: 'tesis',
    place: 'Kayıp Tesis · 04:30',
    brief: 'Virüs tesiste sızmış; çalışanlar dönüşmüş. Gücü aç, laboratuvardaki veri terminalinden panzehir formülünü indir ve hayatta kal.',
    successText: 'Panzehir formülü indirildi. Kuzgun’un son durağı belli: Liman.',
    outro: ['ELİF: Formül tamam! Panzehiri sentezleyebiliriz.', 'ARDA: Kuzgun limanda, gemiyle kaçmaya çalışıyor. Son perde.'],
    zombie: true,
    init(m) {
      // zombi yönetmeni + hikâye silahları
      m.zd = new G.ZombieDirector(m);
      m.streaksEnabled = false;
      m.findInteraction = (pl) => m.mission.findInteraction(m, pl) || m.zd.findInteraction(pl);
      const st = m.world.points.start[0];
      m.player.spawn(m.world.cellCenter(st.x, st.z), -Math.PI / 2);
      m.player.weapons = [G.makeWeaponInst('simsek', { optic: 'kirmizi' }), G.makeWeaponInst('gurz', {})];
      m.player.equip(0, true);
      m.player.points = 6000;
      m.zd.nextRoundAt = G.time + 4;
      G.audio.music('zm');
      for (const id in m.world.doors) {
        m.world.openDoor(id);
        for (const z of m.world.doors[id].zones) m.zd.openZones.add(z);
      }
    },
    stages: [
      {
        text: 'Laboratuvardaki güç şalterini indir',
        radio: [['ARDA', 'Tesis karanlık. Önce gücü aç; şalter laboratuvarın güney duvarında.'], ['RIZA', 'Sana 6000 puanlık kaynak bıraktım. Çay ocağı koridorda, elektrik istemez!']],
        enter(m) {
          m.marker = G.hud.worldMarker(m.zd.powerSwitch.pos, 'GÜÇ');
        },
        done: (m) => m.zd.power,
      },
      {
        text: 'Veri terminalinden formülü indir',
        radio: [['ELİF', 'Terminal avluda. İndirme biraz sürecek, onları uzak tut!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
          m.termPos = m.world.cellCenter(28, 3);
          let term = cuteProp('terminal');
          if (term) term.position.copy(m.termPos).setY(0);
          else {
            term = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x103050 }));
            term.position.copy(m.termPos).setY(0.8);
          }
          m.scene.add(term);
          m.marker = G.hud.worldMarker(m.termPos, 'TERMİNAL');
        },
        interact: (m) => ({ pos: m.termPos, text: 'Formülü indir', time: 12, onDone: (mm) => (mm.downloaded = true) }),
        done: (m) => m.downloaded,
      },
      {
        text: '5. raunda kadar hayatta kal',
        radio: [['ARDA', 'Formül geldi! Tahliye 5. rauntta. Dayan Gölge-1!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
        },
        done: (m) => m.zd.round >= 5,
      },
    ],
    modifyDamage(target, attacker, amount, info) {
      return G.game.zd.modifyDamage(target, attacker, amount, info);
    },
  });

  // ------------------------------------------------------------------
  // 5. SON ÇAY — Liman, Kuzgun ile yüzleşme
  // ------------------------------------------------------------------
  STORY.m5 = mission({
    id: 'm5',
    title: 'Son Çay',
    map: 'liman',
    place: 'Liman · 05:50 · Şafak',
    brief: 'Kuzgun gemiye binmek üzere. Korumalarını geç, Kuzgun’u durdur ve virüs kasasını geri al.',
    successText: 'Kuzgun etkisiz hale getirildi, virüs kasası güvende. Gölge Timi görevi tamamladı.',
    outro: [
      'ARDA: Kasa güvende. Panzehir üretimde. Hepinizle gurur duyuyorum.',
      'RIZA: Şafak söküyor... Çaylar benden! Bu sefer gerçekten demli.',
      'ELİF: Tarihe geçecek bir gece. Gölge Timi’ne şerefe — ve çaya!',
      'SON. Gölge Timi, Kızıl Sis harekâtını başarıyla tamamladı.',
    ],
    init(m) {
      const p = m.player;
      p.spawn(cellPos(m, 2, 3), Math.PI);
      spawnAlly(m, cellPos(m, 1, 5), 'Rıza', 'celik');
      spawnAlly(m, cellPos(m, 3, 5), 'Arda', 'tufan');
      spawnAlly(m, cellPos(m, 2, 7), 'Bora', 'simsek');
      const guards = [[10, 9], [16, 7], [22, 9], [14, 12], [19, 16], [8, 15], [26, 13], [30, 18], [12, 22], [21, 23]];
      for (const [x, z] of guards) {
        const nw = m.world.nearestWalkable(x, z);
        spawnEnemy(m, cellPos(m, nw[0], nw[1]), { guard: true });
      }
    },
    stages: [
      {
        text: 'Depoyu geçip rıhtıma ilerle',
        radio: [['ARDA', 'Kuzgun güney rıhtımda. Depoyu temizleyip ilerle.'], ['RIZA', 'Son termos sende. İki bardak koydum.']],
        enter(m) {
          m.target = cellPos(m, 16, 21);
          m.marker = G.hud.worldMarker(m.target, 'RIHTIM');
        },
        done: (m) => m.player.pos.distanceTo(m.target) < 8,
      },
      {
        text: 'Kuzgun’u etkisiz hale getir',
        radio: [['KUZGUN', 'Gölge Timi... Çayınızı soğutmadan gelmişsiniz. Burası son durağınız!'], ['ARDA', 'Zırhlı! Kafaya nişan al, patlayıcı kullan!']],
        enter(m) {
          G.hud.removeMarker(m.marker);
          const boss = spawnEnemy(m, cellPos(m, 16, 25), { name: 'Kuzgun', weapon: 'celik', health: 1600, boss: true });
          boss.diff = Object.assign({}, boss.diff, { dmg: boss.diff.dmg * 1.2 });
          m.boss = boss;
          G.hud.bossBar(boss);
          for (let i = 0; i < 6; i++) spawnEnemy(m, cellPos(m, 6 + i * 4, 27), {});
          m.waveAt = G.time + 20;
        },
        update(m) {
          if (G.time > m.waveAt && aliveEnemies(m) < 6 && m.boss.alive) {
            m.waveAt = G.time + 15;
            for (let i = 0; i < 3; i++) spawnEnemy(m, cellPos(m, U.pick([2, 31]), U.randInt(18, 26)), {});
            say([['KUZGUN', U.pick(['Adamlarım! Bitirin onları!', 'Kaçacak yeriniz yok!', 'Bu virüs dünyayı değiştirecek!'])]]);
          }
        },
        done: (m) => !m.boss.alive,
      },
      {
        text: 'Virüs kasasını güvenceye al',
        radio: [['ARDA', 'Kuzgun düştü! Kasa rıhtımda, al onu!']],
        enter(m) {
          G.hud.bossBar(null);
          m.casePos = cellPos(m, 16, 23);
          let c = cuteProp('case');
          if (c) c.position.copy(m.casePos).setY(0);
          else {
            c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.8, emissive: 0x401010 }));
            c.position.copy(m.casePos).setY(1.4);
          }
          m.scene.add(c);
          m.marker = G.hud.worldMarker(m.casePos, 'KASA');
        },
        interact: (m) => ({ pos: m.casePos, text: 'Kasayı al', time: 2, onDone: (mm) => (mm.gotCase = true) }),
        done: (m) => m.gotCase,
      },
    ],
    modifyDamage(target, attacker, amount, info) {
      if (target.isBoss && !info.headshot && !info.explosive) return amount * 0.5;
      return amount;
    },
  });

  G.STORY = STORY;
  G.STORY_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5'];
})();
