'use strict';
// Gölge Timi — oyun içi arayüz: nişangah, cephane, mini harita, öldürme
// akışı, madalyalar, telsiz konuşmaları, skor tablosu, ölüm ekranı.
(function () {
  const G = window.G;
  const U = G.util;
  const $ = (s) => document.getElementById(s);

  const H = (G.hud = { markers: [], feed: [], medalQ: [], deathAt: 0 });

  const TEMPLATE = `
  <div id="h-vignette"></div>
  <div id="h-stun"></div>
  <div id="h-scope" hidden><div class="scope-ring"></div><div class="scope-h"></div><div class="scope-v"></div></div>
  <div id="h-cross"><i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><b class="c-dot"></b></div>
  <div id="h-hit"><i></i><i></i><i></i><i></i></div>
  <div id="h-dmg"></div>
  <div id="h-markers"></div>
  <canvas id="h-compass" width="460" height="26"></canvas>
  <div id="h-lowammo" hidden></div>
  <div id="h-top">
    <div id="h-score" class="panel">
      <div class="sc sc-a"><span id="h-sa">0</span><em>GÖLGE</em></div>
      <div class="sc-mid"><div id="h-timer">10:00</div><div id="h-mode">TÖM</div></div>
      <div class="sc sc-b"><span id="h-sb">0</span><em>PENÇE</em></div>
    </div>
    <div id="h-flags"></div>
    <div id="h-warn" hidden></div>
    <div id="h-bigtimer" hidden></div>
    <div id="h-boss" hidden><div class="boss-name">KUZGUN</div><div class="boss-bar"><i id="h-bossfill"></i></div></div>
  </div>
  <canvas id="h-mini" width="200" height="200"></canvas>
  <div id="h-objective" hidden></div>
  <div id="h-feed"></div>
  <div id="h-center">
    <div id="h-big" hidden><div class="big-t"></div><div class="big-s"></div></div>
  </div>
  <div id="h-pops"></div>
  <div id="h-medals"></div>
  <div id="h-prompt" hidden></div>
  <div id="h-radio" hidden><b></b><span></span></div>
  <div id="h-zm" hidden><div id="h-round">1</div><div id="h-points">500</div><div id="h-zmbuffs"></div></div>
  <div id="h-left">
    <div id="h-photo" hidden><img id="h-photo-img" alt="Yaka fotoğrafı"><span id="h-photo-cap"></span></div>
    <div id="h-health"><i id="h-hpfill"></i><span id="h-hptext">150</span></div>
    <div id="h-buffs"></div>
  </div>
  <div id="h-right">
    <div id="h-streaks"></div>
    <div id="h-weapon">
      <img id="h-wicon" alt="">
      <div id="h-wname">AR-24</div>
      <div id="h-ammo"><span id="h-mag">30</span><span id="h-res">/ 150</span></div>
      <div id="h-pips"></div>
      <div id="h-equip"><span id="h-lethal"><img alt=""><b>1</b></span><span id="h-tac"><img alt=""><b>1</b></span><span id="h-cay"><img alt=""><b>1</b></span><span id="h-simit"><img alt=""><b>1</b></span></div>
    </div>
  </div>
  <div id="h-nade" hidden>!</div>
  <div id="h-fps" hidden></div>
  <div id="h-board" hidden></div>
  <div id="h-death" hidden>
    <div class="d-title">ETKİSİZ HALE GETİRİLDİN</div>
    <div class="d-by"></div>
    <div class="d-count"></div>
    <div class="d-classes"></div>
  </div>`;

  H.init = function () {
    const root = $('hud');
    root.innerHTML = TEMPLATE;
    H.mini = $('h-mini');
    H.miniCtx = H.mini.getContext('2d');
    H.cross = $('h-cross');
    H.hit = $('h-hit');
    H.hitT = 0;
    H.compass = $('h-compass');
    H.compassCtx = H.compass.getContext('2d');
    $('h-cay').querySelector('img').src = G.itemIcon('cay');
    $('h-simit').querySelector('img').src = G.itemIcon('simit');
  };

  // ---------------- Piksel ikonlar (ekipman, seriler, yetenekler) ----------------
  const PAL = {
    k: '#0a0d0e', g: '#6f8a42', G: '#3f5524', s: '#d2d9dc', S: '#7c868a', r: '#e8432f', y: '#ffcc4d', o: '#ff9a3d',
    b: '#9a6630', B: '#5c3a1a', w: '#f4f2ea', t: '#d0461c', T: '#7a2410', c: '#7be0c3', l: '#a6aeb0',
  };
  const ICONS = {
    frag: ['.....ss.....', '....s..s....', '....kkkk....', '...kSSSSk...', '..kgggggGk..', '.kgGgggGgGk.', '.kggggggggk.', '.kgGgggGgGk.', '.kggggggggk.', '..kGgggggk..', '...kkkkkk...', '............'],
    semtex: ['............', '............', '...kkkkkk...', '..kssssssk..', '..ksrrsssk..', '.kkkkkkkkkk.', '.kyyyyyyyyk.', '.kyBByyBByk.', '.kyyyyyyyyk.', '.kkkkkkkkkk.', '............', '............'],
    knife: ['..........ks', '.........ksk', '........kssk', '.......kssk.', '......kssk..', '.....kssk...', '....kSSk....', '...kbBk.....', '..kbBk......', '.kbBk.......', 'kbBk........', 'kk..........'],
    stun: ['....y..y....', '.....yy.....', '...kkkkkk...', '..kssssssk..', '..kSSSSSSk..', '..kssssssk..', '..kcccccck..', '..kssssssk..', '..kSSSSSSk..', '..kssssssk..', '...kkkkkk...', '............'],
    smoke: ['...ll.......', '..lwwl.ll...', '..lwwwlwwl..', '...llwwwl...', '....kkkk....', '...kSSSSk...', '...kllllk...', '...kSSSSk...', '...kllllk...', '...kSSSSk...', '....kkkk....', '............'],
    cay: ['............', '..kkkkkkkk..', '..kwttttwk..', '...kttttk...', '...kTttTk...', '....kttk....', '....kttk....', '...kttttk...', '..kTttttTk..', '..kkkkkkkk..', '.kssssssssk.', '..kkkkkkkk..'],
    simit: ['............', '....kkkk....', '..kkbybbkk..', '.kbbBkkBbbk.', '.kbyk..kbyk.', 'kbBk....kbBk', 'kbyk....kbbk', '.kbBk..kbyk.', '.kbbBkkbBbk.', '..kkbbybkk..', '....kkkk....', '............'],
    melee: ['.....kk.....', '....kssk....', '....kssk....', '....kssk....', '....kssk....', '....kSsk....', '...kkkkkk...', '..kSSSSSSk..', '....kbBk....', '....kbBk....', '....kbBk....', '.....kk.....'],
    perk1: ['....kkkk....', '...kwwwwk...', '..kwwwwwwk..', '..kwkwwkwk..', '..kwkwwkwk..', '..kwwwwwwk..', '..kwwwwwwk..', '..kwwwwwwk..', '..kwkwwkwk..', '..kk.kk.kk..', '............', '............'],
    perk2: ['.....kk.....', '....kyyk....', '....kyyk....', '...kyyyyk...', '...kyyyyk...', '...kkkkkk...', '...kooook...', '...kooook...', '...kooook...', '...kooook...', '...kkkkkk...', '............'],
    perk3: ['.......kkk..', '......kyyk..', '.....kyyk...', '....kyyk....', '...kyyyykk..', '..kkkyyyyk..', '.....kyyk...', '....kyyk....', '...kyyk.....', '...kyk......', '...kk.......', '............'],
    uav: ['.....kk.....', '.....kSk....', '.....kSk....', '.kkkkkSkkkk.', '.kSSSSsSSSk.', '.kkkkkSkkkk.', '.....kSk....', '.....kSk....', '....kkSkk...', '....kSSSk...', '....kkkkk...', '............'],
    airstrike: ['....kkkk....', '....kSSk....', '...kkkkkk...', '...kSSSSk...', '..kSssssSk..', '..kSssssSk..', '..kSSSSSSk..', '...kSSSSk...', '....kkkk....', '...r.r.r....', '..r.r.r.r...', '............'],
    sentry: ['............', '.......kkkkk', '...kkkkSSSSk', '..kSSSSkkkkk', '..kSssSk....', '..kSSSSk....', '...kkkk.....', '....kk......', '...kSSk.....', '..kS..Sk....', '.kS....Sk...', 'kk......kk..'],
    heli: ['kkkkkkkkkkkk', '.....kk.....', '...kkkkk....', '..kSSSSSk...', '.kSccSSSSkkk', '.kSccSSSSSSk', '.kSSSSSSkkkk', '..kSSSSSk...', '...kkkkk....', '...k...k....', '..kkkkkkk...', '............'],
  };
  const iconCache = {};
  G.itemIcon = function (kind) {
    if (iconCache[kind] != null) return iconCache[kind];
    const rows = ICONS[kind];
    if (!rows) return (iconCache[kind] = '');
    const S = 3;
    const c = document.createElement('canvas');
    c.width = c.height = 12 * S;
    const x = c.getContext('2d');
    rows.forEach((row, j) => {
      for (let i = 0; i < 12; i++) {
        const col = PAL[row[i]];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i * S, j * S, S, S);
      }
    });
    return (iconCache[kind] = c.toDataURL('image/png'));
  };
  // Öldürme akışı için silah simgesi: kimlik ya da adla bulunur
  const nameToId = {};
  function feedIcon(id, name) {
    if (!id && name) {
      if (!Object.keys(nameToId).length) for (const k in G.WEAPONS) nameToId[G.WEAPONS[k].name] = k;
      id = nameToId[name];
      if (!id) {
        const n = String(name);
        if (/Bomba/.test(n)) id = /Yapışkan/.test(n) ? 'semtex' : 'frag';
        else if (/Helikopter/.test(n)) id = 'heli';
        else if (/Taret/.test(n)) id = 'sentry';
        else if (/Hava Saldırısı/.test(n)) id = 'airstrike';
        else if (/Bıçak/.test(n)) id = 'knife';
      }
    }
    if (!id) return '';
    if (G.WEAPONS[id]) return G.weaponImage(id, 'icon');
    if (id === 'melee') return G.itemIcon('melee');
    return G.itemIcon(id);
  }

  // ---------------- Maç başlangıcı ----------------
  H.startMatch = function (m) {
    H.match = m;
    H.radioQ = [];
    H.radioBusy = false;
    clearTimeout(H._radioT);
    H.boss = null;
    $('hud').hidden = false;
    $('h-feed').innerHTML = '';
    $('h-medals').innerHTML = '';
    $('h-pops').innerHTML = '';
    $('h-markers').innerHTML = '';
    $('h-flags').innerHTML = '';
    H.markers = [];
    H.strikes = [];
    $('h-death').hidden = true;
    $('h-board').hidden = true;
    $('h-objective').hidden = true;
    $('h-radio').hidden = true;
    $('h-boss').hidden = true;
    $('h-bigtimer').hidden = true;
    const zm = m.mode === 'zm' || (m.mission && m.mission.zombie);
    $('h-zm').hidden = !zm;
    $('h-score').style.display = m.mode === 'tdm' || m.mode === 'dom' || m.mode === 'ffa' || m.mode === 'online' ? '' : 'none';
    $('h-mode').textContent = G.MODE_INFO[m.mode] ? G.MODE_INFO[m.mode].short : '';
    $('h-streaks').style.display = m.streaksEnabled ? '' : 'none';
    H.buildMiniMap(m.world);
    if (m.flags.length) {
      for (const f of m.flags) {
        const d = U.el('div', 'flag-chip', f.id);
        d.id = 'h-flag-' + f.id;
        $('h-flags').appendChild(d);
      }
    }
    // yaka fotoğrafı
    const photo = G.settings.photo ? G.store.get('photo', null) : null;
    $('h-photo').hidden = !photo;
    if (photo) {
      $('h-photo-img').src = photo;
      $('h-photo-cap').textContent = G.settings.photoCaption || '';
    }
    H.buildStreaks();
    $('h-fps').hidden = !G.settings.showFps;
    H.wid = null;
    H.pipKey = '';
    H.lethalKind = null;
    H.tacKind = null;
    // Öldürme akışındaki simgeleri maç başında hazırla (oyun sırasında takılma olmasın)
    const pre = new Set((G.BOT_WEAPONS || []).map((x) => (Array.isArray(x) ? x[0] : x)));
    const pl = m.player;
    if (pl && pl.weapons) for (const w of pl.weapons) if (w && w.stats) pre.add(w.stats.id);
    for (const id of pre) if (G.WEAPONS[id]) G.weaponImage(id, 'icon');
  };

  H.buildStreaks = function () {
    const el = $('h-streaks');
    el.innerHTML = '';
    G.STREAKS.forEach((s, i) => {
      const d = U.el('div', 'streak');
      d.innerHTML = `<b>${i + 3}</b><img alt="" src="${G.itemIcon(s.id)}"><span>${s.name}</span><em>${s.cost}</em><i></i>`;
      d.id = 'h-streak-' + i;
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        G.streaks.activate(i);
      });
      el.appendChild(d);
    });
  };

  H.hide = function () {
    $('hud').hidden = true;
  };

  // ---------------- Mini harita ----------------
  H.buildMiniMap = function (world) {
    const S = 6;
    const c = document.createElement('canvas');
    c.width = world.w * S;
    c.height = world.h * S;
    const ctx = c.getContext('2d');
    for (let z = 0; z < world.h; z++)
      for (let x = 0; x < world.w; x++) {
        const ch = world.rows[z][x];
        let col = null;
        if (ch === '#' || ch === 'H' || ch === '=' || ch === 'x') col = '#0b0f10';
        else if ('cCKwhvbTLr'.includes(ch)) col = '#2c3a3c';
        else if ('1234'.includes(ch)) col = '#6b4a20';
        else if (world.indoor[x + z * world.w] || ch === 'd') col = '#5a6a6c';
        else col = '#7c8c8a';
        ctx.fillStyle = col;
        ctx.fillRect(x * S, z * S, S, S);
      }
    H.miniMap = c;
    H.miniScale = S / G.CELL;
  };

  function drawMini(m) {
    const ctx = H.miniCtx;
    const W = H.mini.width;
    const p = m.player;
    const scale = H.miniScale * 1.25;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,14,16,0.75)';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(p.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-p.pos.x, -p.pos.z);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(H.miniMap, 0, 0, H.miniMap.width / H.miniScale, H.miniMap.height / H.miniScale);
    ctx.globalAlpha = 1;
    const dot = (x, z, r, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(x - r, z - r, r * 2, r * 2);
    };
    // bayraklar
    for (const f of m.flags) {
      dot(f.pos.x, f.pos.z, 2.6, f.owner === p.team ? '#4cc3ff' : f.owner === -1 ? '#dddddd' : '#ff4d3d');
    }
    // hava saldırısı işaretleri
    for (const s of H.strikes || []) {
      if (G.time > s.until) continue;
      ctx.strokeStyle = '#ff3020';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.z, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    const uav = G.streaks.uavActive(p.team === 0 || p.team === 1 ? p.team : 0) && m.streaksEnabled;
    for (const c of m.chars) {
      if (c === p || !c.alive) continue;
      if (c.kind === 'zombie' || c.kind === 'dog') {
        if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 14 && G.time - c.lastHurt < 2) dot(c.pos.x, c.pos.z, 1.2, '#ff4d3d');
        continue;
      }
      const friend = !m.canHurt(p, c);
      if (friend) {
        ctx.save();
        ctx.translate(c.pos.x, c.pos.z);
        ctx.rotate(-c.yaw);
        ctx.fillStyle = '#4cc3ff';
        ctx.beginPath();
        ctx.moveTo(0, -2.2);
        ctx.lineTo(1.6, 1.6);
        ctx.lineTo(-1.6, 1.6);
        ctx.fill();
        ctx.restore();
      } else if (uav || G.time < (c.spotted || 0)) {
        dot(c.pos.x, c.pos.z, 1.5, '#ff4d3d');
      }
    }
    for (const e of G.streaks.ents) {
      if (!e.isEnt || !e.alive) continue;
      dot(e.pos.x, e.pos.z, 1.6, m.canHurt(p, e) ? '#ff9a3d' : '#9fdcff');
    }
    for (const mk of H.markers) dot(mk.pos.x, mk.pos.z, 2.2, '#ffd23a');
    ctx.restore();
    // oyuncu oku
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(W / 2, W / 2 - 7);
    ctx.lineTo(W / 2 + 5, W / 2 + 5);
    ctx.lineTo(W / 2, W / 2 + 2);
    ctx.lineTo(W / 2 - 5, W / 2 + 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    if (uav) {
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 14px "Pixelify Sans", sans-serif';
      ctx.fillText('İHA', 10, 20);
    }
  }

  // ---------------- Pusula ----------------
  const DIRS8 = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  function bearing(p, x, z) {
    return ((Math.atan2(x - p.pos.x, -(z - p.pos.z)) * 180) / Math.PI + 360) % 360;
  }
  function drawCompass(m) {
    const ctx = H.compassCtx;
    const W = H.compass.width, Hh = H.compass.height;
    const p = m.player;
    const hdg = ((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360;
    const ppd = W / 180;
    ctx.clearRect(0, 0, W, Hh);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, Hh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const start = Math.ceil((hdg - 90) / 15) * 15;
    for (let a = start; a <= hdg + 90; a += 15) {
      const x = Math.round(W / 2 + (a - hdg) * ppd);
      const fade = 1 - Math.abs(a - hdg) / 92;
      const n = ((a % 360) + 360) % 360;
      if (n % 45 === 0) {
        ctx.fillStyle = n === 0 ? `rgba(255,178,56,${fade})` : `rgba(240,244,240,${fade})`;
        ctx.font = '12px "Silkscreen", monospace';
        ctx.fillText(DIRS8[n / 45], x, 14);
      } else {
        ctx.fillStyle = `rgba(240,244,240,${fade * 0.6})`;
        ctx.fillRect(x, 10, 1, 7);
      }
    }
    const mark = (b, col, label) => {
      let d = ((b - hdg + 540) % 360) - 180;
      const edge = Math.abs(d) > 88;
      d = U.clamp(d, -88, 88);
      const x = Math.round(W / 2 + d * ppd);
      ctx.fillStyle = col;
      if (label) {
        ctx.font = '10px "Silkscreen", monospace';
        ctx.fillText(label, x, 5);
      }
      ctx.fillRect(x - 2, edge ? 20 : 21, 4, 4);
    };
    for (const f of m.flags) mark(bearing(p, f.pos.x, f.pos.z), f.owner === p.team ? '#4cc3ff' : f.owner === -1 ? '#dddddd' : '#ff4d3d', f.id);
    for (const mk of H.markers) mark(bearing(p, mk.pos.x, mk.pos.z), '#ffd23a', '');
    ctx.fillStyle = '#ffb238';
    ctx.fillRect(W / 2 - 1, 20, 2, 6);
  }

  // ---------------- Olaylar ----------------
  H.hitmarker = function (kill, head, ent) {
    const el = H.hit;
    el.className = kill ? 'kill' : head ? 'head' : ent ? 'ent' : '';
    el.style.opacity = 1;
    H.hitT = kill ? 0.35 : 0.18;
  };

  H.damageFrom = function (pos) {
    const p = H.match && H.match.player;
    if (!p) return;
    const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const d = U.el('div', 'dmg-arc');
    d.style.transform = `rotate(${ang}rad)`;
    $('h-dmg').appendChild(d);
    setTimeout(() => d.remove(), 1400);
  };

  H.medal = function (text, pts) {
    const d = U.el('div', 'medal');
    d.innerHTML = `<b>${escapeHtml(text)}</b>${pts ? `<span>+${pts}</span>` : ''}`;
    const box = $('h-medals');
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 2600);
    if (pts) G.audio.play('medal', { priority: true });
  };

  H.popup = function (text, pts) {
    const d = U.el('div', 'pop');
    d.innerHTML = `<span>+${pts}</span> ${escapeHtml(text)}`;
    const box = $('h-pops');
    box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => d.remove(), 1800);
  };

  H.pointsPop = function (n) {
    const d = U.el('div', 'zpop ' + (n < 0 ? 'neg' : ''), (n > 0 ? '+' : '') + n);
    const box = $('h-zm');
    d.style.left = 70 + Math.random() * 40 + 'px';
    box.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  };

  H.bigMessage = function (title, sub) {
    const el = $('h-big');
    el.querySelector('.big-t').textContent = title;
    el.querySelector('.big-s').textContent = sub || '';
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(H._bigT);
    H._bigT = setTimeout(() => (el.hidden = true), 3200);
  };

  H.warn = function (text, good) {
    const el = $('h-warn');
    el.textContent = text;
    el.className = good ? 'good' : '';
    el.hidden = false;
    clearTimeout(H._warnT);
    H._warnT = setTimeout(() => (el.hidden = true), 3000);
  };

  H.roundChange = function (r, dog) {
    const el = $('h-round');
    el.textContent = r;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    el.classList.toggle('dog', !!dog);
  };

  H.strikeMarker = function (pos, dur) {
    H.strikes.push({ pos: pos.clone(), until: G.time + dur });
  };

  H.killfeed = function (e, player) {
    const box = $('h-feed');
    const d = U.el('div', 'kf');
    const isFriend = (team) => player && (team === player.team || (player.team === 'me' && false));
    const kc = e.killer === (player && player.name) ? 'me' : isFriend(e.kteam) ? 'fr' : 'en';
    const vc = e.victim === (player && player.name) ? 'me' : isFriend(e.vteam) ? 'fr' : 'en';
    const ic = feedIcon(e.weaponId, e.weapon);
    const wpn = ic ? `<img alt="${escapeHtml(e.weapon || '')}" title="${escapeHtml(e.weapon || '')}" src="${ic}">` : `<i>${escapeHtml(e.weapon || '')}</i>`;
    d.innerHTML = `${e.killer ? `<b class="${kc}">${escapeHtml(e.killer)}</b>` : ''}${wpn}${e.head ? '<span class="wb">⌖</span>' : ''}<b class="${vc}">${escapeHtml(e.victim)}</b>`;
    box.prepend(d);
    while (box.children.length > 6) box.lastChild.remove();
    setTimeout(() => d.remove(), 7000);
  };

  H.playerDied = function (killer, info) {
    const el = $('h-death');
    el.hidden = false;
    $('h-big').hidden = true;
    H.deathAt = G.time;
    el.querySelector('.d-by').textContent = killer && killer.name ? `${killer.name} · ${info.weapon || ''}${info.headshot ? ' · Kafadan' : ''}` : info.weapon || '';
    const cls = el.querySelector('.d-classes');
    cls.innerHTML = '';
    const m = H.match;
    if (m && m.mode !== 'zm' && !(m.mission && m.mission.zombie)) {
      G.getClasses().forEach((c, i) => {
        const b = U.el('button', 'btn small' + ((G.pendingClass != null ? G.pendingClass : m.cfg.classIdx || 0) === i ? ' on' : ''), `${i + 1} · ${c.name}`);
        b.type = 'button';
        b.addEventListener('click', () => {
          G.pendingClass = i;
          m.cfg.classIdx = i;
          for (const x of cls.children) x.classList.remove('on');
          b.classList.add('on');
        });
        cls.appendChild(b);
      });
      const hint = U.el('div', 'd-hint', 'Sınıf değişikliği bir sonraki doğuşta geçerli olur.');
      cls.appendChild(hint);
    }
  };

  H.readyToRespawn = function () {
    return true;
  };

  H.playerRespawned = function () {
    $('h-death').hidden = true;
  };

  // ---------------- Hikâye ----------------
  H.objective = function (text) {
    const el = $('h-objective');
    el.hidden = !text;
    el.innerHTML = `<em>GÖREV</em>${escapeHtml(text || '')}`;
  };

  H.radio = function (lines) {
    H.radioQ = (H.radioQ || []).concat(lines);
    if (!H.radioBusy) nextRadio();
  };
  function nextRadio() {
    const el = $('h-radio');
    const l = H.radioQ.shift();
    if (!l) {
      H.radioBusy = false;
      el.hidden = true;
      return;
    }
    H.radioBusy = true;
    el.hidden = false;
    el.querySelector('b').textContent = l[0];
    el.querySelector('span').textContent = l[1];
    G.audio.play('tick', { priority: true });
    H._radioT = setTimeout(nextRadio, Math.max(2600, l[1].length * 55));
  }

  H.worldMarker = function (pos, label) {
    const el = U.el('div', 'wmark');
    el.innerHTML = `<b>${escapeHtml(label)}</b><span></span>`;
    $('h-markers').appendChild(el);
    const mk = { pos: pos.clone(), el };
    H.markers.push(mk);
    return mk;
  };
  H.removeMarker = function (mk) {
    if (!mk) return;
    mk.el.remove();
    H.markers = H.markers.filter((x) => x !== mk);
  };

  H.setTimer = function (t) {
    const el = $('h-bigtimer');
    if (t == null) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = U.fmtTime(t);
  };

  H.bossBar = function (boss) {
    H.boss = boss;
    $('h-boss').hidden = !boss;
    if (boss) $('h-boss').querySelector('.boss-name').textContent = boss.name.toUpperCase();
  };

  // ---------------- Skor tablosu ----------------
  function renderBoard(m) {
    const el = $('h-board');
    const p = m.player;
    const row = (c) => `<tr class="${c === p ? 'me' : ''}"><td>${escapeHtml(c.name)}</td><td>${c.score || 0}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.assists || 0}</td></tr>`;
    const head = '<tr><th>Oyuncu</th><th>Skor</th><th>Ö</th><th>Ö</th><th>A</th></tr>';
    const people = m.chars.filter((c) => c.kind === 'soldier');
    let html = '';
    if (m.mode === 'ffa' || (m.net && m.net.ffa)) {
      const list = people.slice().sort((a, b) => b.kills - a.kills || (b.score || 0) - (a.score || 0));
      html = `<h3>HERKES TEK</h3><table>${head}${list.map(row).join('')}</table>`;
    } else if (m.mode === 'zm') {
      html = `<h3>ZOMBİLER · ${m.zd.round}. RAUNT</h3><table><tr><th>Oyuncu</th><th>Puan</th><th>Öldürme</th><th>Kafadan</th></tr><tr class="me"><td>${escapeHtml(p.name)}</td><td>${p.points}</td><td>${m.zd.kills}</td><td>${m.zd.headshots}</td></tr></table>`;
    } else {
      const a = people.filter((c) => c.team === 0).sort((x, y) => (y.score || 0) - (x.score || 0));
      const b = people.filter((c) => c.team !== 0).sort((x, y) => (y.score || 0) - (x.score || 0));
      html = `<h3 class="ta">GÖLGE TİMİ · ${m.teamScore[0]}</h3><table>${head}${a.map(row).join('')}</table><h3 class="tb">KIZIL PENÇE · ${m.teamScore[1]}</h3><table>${head}${b.map(row).join('')}</table>`;
    }
    html += '<p class="board-hint">Ö: öldürme · Ö: ölüm · A: asist</p>';
    el.innerHTML = html;
  }

  // ---------------- Kare güncelleme ----------------
  let fpsAcc = 0, fpsN = 0;
  H.update = function (dt) {
    const m = H.match;
    if (!m || !m.player) return;
    const p = m.player;
    const w = p.weapon;
    const s = w ? w.stats : null;
    // nişangah
    const showCross = p.alive && s && p.adsT < 0.5 && !p.sprinting && p.busy <= 0;
    H.cross.style.opacity = showCross ? 1 - p.adsT * 2 : 0;
    if (s) {
      const moving = p.hSpeed > 1;
      let spread = s.hip * (p.crouching ? 0.8 : p.prone ? 0.65 : 1) + (moving ? s.moveSpread * Math.min(1, p.hSpeed / 5) : 0) + p.bloom;
      if (!p.grounded) spread *= 1.8;
      const px = (Math.tan(spread * U.DEG) / Math.tan((G.camera.fov * U.DEG) / 2)) * (window.innerHeight / 2);
      H.cross.style.setProperty('--gap', Math.max(6, px) + 'px');
    }
    // vuruş işareti
    if (H.hitT > 0) {
      H.hitT -= dt;
      if (H.hitT <= 0) H.hit.style.opacity = 0;
    }
    // dürbün
    const scoped = s && s.scope && p.adsT > 0.92 && p.alive;
    $('h-scope').hidden = !scoped;
    // sağlık
    const hp = p.health / p.maxHealth;
    $('h-hpfill').style.width = hp * 100 + '%';
    $('h-hptext').textContent = Math.ceil(p.health);
    $('h-health').classList.toggle('low', hp < 0.35);
    $('h-vignette').style.opacity = p.alive ? Math.pow(1 - hp, 1.6) * 0.95 : 0.6;
    $('h-stun').style.opacity = G.time < p.stunUntil ? Math.min(0.7, (p.stunUntil - G.time) * 0.25) : 0;
    // silah
    const lowEl = $('h-lowammo');
    if (w) {
      const wid = s.id + (s.upgraded ? '+' : '');
      if (H.wid !== wid) {
        H.wid = wid;
        $('h-wname').textContent = s.name;
        $('h-wname').classList.toggle('pap', !!s.upgraded);
        const ic = G.WEAPONS[s.id] ? G.weaponImage(s.id, 'icon') : '';
        $('h-wicon').hidden = !ic;
        if (ic) $('h-wicon').src = ic;
      }
      $('h-mag').textContent = w.ammo;
      const low = w.ammo <= Math.ceil(s.mag * 0.25);
      $('h-mag').classList.toggle('low', low);
      $('h-res').textContent = '/ ' + w.reserve;
      // mermi çubukları
      const pk = s.mag + ':' + w.ammo;
      if (H.pipKey !== pk) {
        H.pipKey = pk;
        const pips = $('h-pips');
        if (s.mag > 1 && s.mag <= 60) {
          let html = '';
          for (let i = 0; i < s.mag; i++) html += i < w.ammo ? '<i></i>' : '<i class="off"></i>';
          pips.innerHTML = html;
          pips.hidden = false;
        } else pips.hidden = true;
      }
      const out = w.ammo === 0 && w.reserve === 0;
      const showLow = p.alive && !p.reload && (out || (low && w.reserve > 0 && s.mag > 1));
      lowEl.hidden = !showLow;
      if (showLow) {
        lowEl.className = out ? 'out' : '';
        lowEl.textContent = out ? 'CEPHANE YOK' : G.isTouch ? 'ŞARJÖR DEĞİŞTİR' : `ŞARJÖR DEĞİŞTİR [${G.keyLabel ? G.keyLabel(G.input.binds.reload[0]) : 'R'}]`;
      }
    } else {
      H.wid = null;
      $('h-wname').textContent = '—';
      $('h-mag').textContent = '';
      $('h-res').textContent = '';
      $('h-pips').hidden = true;
      $('h-wicon').hidden = true;
      lowEl.hidden = true;
    }
    if (H.lethalKind !== p.lethal) {
      H.lethalKind = p.lethal;
      $('h-lethal').querySelector('img').src = G.itemIcon(p.lethal) || '';
    }
    if (H.tacKind !== p.tactical) {
      H.tacKind = p.tactical;
      $('h-tac').querySelector('img').src = G.itemIcon(p.tactical) || '';
    }
    $('h-lethal').querySelector('b').textContent = p.lethalCount;
    $('h-tac').querySelector('b').textContent = p.tacticalCount;
    $('h-cay').querySelector('b').textContent = p.cay;
    $('h-simit').querySelector('b').textContent = p.simit;
    // tamponlar
    let buffs = '';
    if (G.time < p.cayUntil) buffs += `<span class="buff tea">ÇAY GÜCÜ ${Math.ceil(p.cayUntil - G.time)}</span>`;
    if (p.tacSprint) buffs += '<span class="buff">TAKTİK KOŞU</span>';
    if (G.time < p.stunUntil) buffs += '<span class="buff bad">SERSEM</span>';
    $('h-buffs').innerHTML = buffs;
    // etkileşim
    const it = p.interaction;
    const prompt = $('h-prompt');
    if (it && p.alive) {
      prompt.hidden = false;
      prompt.innerHTML = `<kbd>${G.isTouch ? 'ETKİLEŞİM' : 'F'}</kbd> ${escapeHtml(it.text)}${it.cost ? ` <b>${it.cost}</b>` : ''}${it.desc ? `<small>${escapeHtml(it.desc)}</small>` : ''}`;
    } else prompt.hidden = true;
    // zamanlayıcı & skor
    if (m.timeLimit) $('h-timer').textContent = U.fmtTime(m.timeLimit - m.time);
    else if (!m.net) $('h-timer').textContent = '';
    if (m.mode === 'ffa' || (m.net && m.net.ffa)) {
      const others = m.chars.filter((c) => c !== p && c.kind === 'soldier');
      const top = others.reduce((a, c) => Math.max(a, c.kills), 0);
      $('h-sa').textContent = p.kills;
      $('h-sb').textContent = top;
      document.querySelector('.sc-a em').textContent = 'SEN';
      document.querySelector('.sc-b em').textContent = 'LİDER';
    } else {
      $('h-sa').textContent = m.teamScore[0];
      $('h-sb').textContent = m.teamScore[1];
      document.querySelector('.sc-a em').textContent = 'GÖLGE';
      document.querySelector('.sc-b em').textContent = 'PENÇE';
    }
    for (const f of m.flags) {
      const el = $('h-flag-' + f.id);
      if (!el) continue;
      el.className = 'flag-chip ' + (f.owner === 0 ? 'a' : f.owner === 1 ? 'b' : '') + (f.contested ? ' contested' : '');
      el.style.setProperty('--prog', Math.abs(f.prog));
    }
    // zombi
    if (m.zd) {
      $('h-points').textContent = p.points;
      let zb = '';
      if (m.zd.instakill) zb += '<span class="buff bad">TEK VURUŞ</span>';
      if (G.time < m.zd.doubleUntil) zb += '<span class="buff">ÇİFT PUAN</span>';
      if (G.time < m.zd.teaBreakUntil) zb += '<span class="buff tea">ÇAY MOLASI</span>';
      zb += [...p.zmPerks].map((k) => `<i class="perk" style="background:#${G.ZM_PERKS[k].color.toString(16).padStart(6, '0')}" title="${G.ZM_PERKS[k].name}"></i>`).join('');
      $('h-zmbuffs').innerHTML = zb;
    }
    // seriler
    if (m.streaksEnabled) {
      G.STREAKS.forEach((d, i) => {
        const el = $('h-streak-' + i);
        if (!el) return;
        const n = G.streaks.inventory[i] || 0;
        el.classList.toggle('ready', n > 0);
        el.querySelector('i').style.width = Math.min(100, (p.streakPts / d.cost) * 100) + '%';
      });
    }
    // patron
    if (H.boss) $('h-bossfill').style.width = Math.max(0, (H.boss.health / H.boss.maxHealth) * 100) + '%';
    // el bombası uyarısı
    let danger = false;
    for (const pr of G.combat.projectiles) {
      if ((pr.kind === 'frag' || pr.kind === 'semtex') && pr.owner !== p && pr.pos.distanceTo(p.pos) < 7) danger = true;
    }
    $('h-nade').hidden = !danger;
    // ölüm ekranı sayacı
    if (!p.alive && !$('h-death').hidden) {
      const r = m.respawns.find((x) => x.ch === p);
      $('h-death').querySelector('.d-count').textContent = r ? `Yeniden doğuş: ${Math.max(0, r.at - G.time).toFixed(1)} sn` : '';
    }
    // dünya işaretleri
    const cam = G.camera;
    const W = window.innerWidth, Hh = window.innerHeight;
    for (const mk of H.markers) {
      const v = mk.pos.clone().setY(mk.pos.y + 2).project(cam);
      const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * Hh;
      if (behind) {
        x = W - x;
        y = Hh - 40;
      }
      x = U.clamp(x, 40, W - 40);
      y = U.clamp(y, 60, Hh - 60);
      mk.el.style.transform = `translate(${x}px, ${y}px)`;
      mk.el.querySelector('span').textContent = Math.round(mk.pos.distanceTo(p.pos)) + ' m';
    }
    // skor tablosu
    const showBoard = G.input.down('score') || G.input.touch.score;
    $('h-board').hidden = !showBoard;
    if (showBoard) renderBoard(m);
    drawMini(m);
    drawCompass(m);
    if (G.settings.showFps) {
      fpsAcc += dt;
      fpsN++;
      if (fpsAcc > 0.5) {
        $('h-fps').textContent = Math.round(fpsN / fpsAcc) + ' FPS';
        fpsAcc = 0;
        fpsN = 0;
      }
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  G.escapeHtml = escapeHtml;
})();
