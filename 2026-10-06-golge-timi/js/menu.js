'use strict';
// Gölge Timi — menüler (sürüm 2): sekmeli üst menü (Oyna, Silahlar, Operatörler,
// İlerleme, Ayarlar), cephanelik ve döndürülebilir 3D silah ustası, mod
// kurulumları, online lobi, yükleme ekranı, duraklatma ve bitiş.
(function () {
  const G = window.G;
  const U = G.util;
  const $ = (s) => document.getElementById(s);
  const esc = (s) => G.escapeHtml(s);
  const pctOf = (lv) => (lv.need ? (lv.cur / lv.need) * 100 : 100) + '%';

  const UI = (G.ui = { screen: null, paused: false, lo: { ci: 0, slot: 'primary', view: 'smith' } });
  const TABBED = new Set(['s-main', 's-loadout', 's-operators', 's-progress', 's-settings']);

  const TIPS = [
    'Koşarken C: kayma. Koşarken Z: dalış. Her yöne koşabilirsin.',
    'T ile çay iç: 30 saniye boyunca hasar +%25, daha hızlı şarjör ve yenilenme.',
    'H ile simit ye: anında +100 sağlık.',
    'G’yi basılı tutarak el bombasını pişir, sonra bırak.',
    'Susturucu takarsan ateş ettiğinde düşman haritasında görünmezsin.',
    'Zombilerde Çay Ocağı elektrik istemez; koridorda seni bekliyor.',
    'Engelin önünde Space: tırmanma. Sandıkların üstüne çıkabilirsin.',
    'Skor serileri 3-6 tuşlarıyla çağrılır: İHA, hava saldırısı, taret, helikopter.',
    'Bir silahla öldürdükçe yeni kamuflajlar açılır. Elmas için 200 öldürme gerekir.',
    'I tuşu silahını inceler. Kamuflajını göstermenin en havalı yolu.',
    'Hafif makine tüfeğiyle çömelince ya da yatınca ayak açılır: tepme azalır.',
    'Zırh delici mermi sandıkları ve konteynerleri deler.',
    'Günlük görevler her gece yenilenir; ekstra XP için bitir.',
  ];

  UI.show = function (id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    UI.screen = id;
    const inMatch = G.state === 'playing' || G.state === 'ended';
    document.body.classList.toggle('in-match', inMatch);
    const nav = $('navbar');
    nav.hidden = !TABBED.has(id) || inMatch;
    for (const t of nav.querySelectorAll('.nav-tab')) t.classList.toggle('on', t.dataset.go === id);
    if (!nav.hidden) renderNav();
    const r = {
      's-main': renderMain,
      's-mp': renderMP,
      's-story': renderStory,
      's-zm': renderZM,
      's-online': renderOnline,
      's-loadout': renderLoadout,
      's-operators': renderOperators,
      's-progress': renderProgress,
      's-settings': renderSettings,
      's-help': renderHelp,
    }[id];
    if (r) r();
    applyShots(document);
    if (id !== 's-online' && UI.lobbyTimer) {
      clearInterval(UI.lobbyTimer);
      UI.lobbyTimer = null;
    }
  };

  UI.hideAll = function () {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    $('navbar').hidden = true;
    UI.screen = null;
  };

  UI.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(() => (t.hidden = true), 2600);
  };

  // Harita görüntüleri (main.js üretir) — data-shot taşıyan öğelere uygulanır
  function applyShots(root) {
    const shots = G.mapShots || {};
    for (const el of root.querySelectorAll('[data-shot]')) {
      const url = shots[el.dataset.shot];
      if (url && el.dataset.shotOn !== '1') {
        el.style.backgroundImage = `url("${url}")`;
        el.dataset.shotOn = '1';
      }
    }
  }
  G.on('mapshot', () => applyShots(document));

  // ------------------------------------------------------------------
  // RÜTBE ROZETİ (piksel nişan)
  // ------------------------------------------------------------------
  const badgeCache = {};
  G.rankIndex = function (level) {
    let ri = 0;
    G.RANKS.forEach(([l], i) => {
      if (level >= l) ri = i;
    });
    return ri;
  };
  G.rankBadge = function (level) {
    const ri = G.rankIndex(level);
    if (badgeCache[ri]) return badgeCache[ri];
    const N = 20, S = 3;
    const c = document.createElement('canvas');
    c.width = c.height = N * S;
    const x = c.getContext('2d');
    const px = (i, j, col) => {
      x.fillStyle = col;
      x.fillRect(i * S, j * S, S, S);
    };
    const tier = ri >= 12 ? 3 : ri >= 9 ? 2 : ri >= 5 ? 1 : 0;
    const metal = ['#d19352', '#dfe7ea', '#ffcc4d', '#ffd864'][tier];
    const shade = ['#7a4e26', '#7c878c', '#a3721a', '#9c6c12'][tier];
    const bg = tier === 3 ? '#5c1210' : tier === 2 ? '#1d1a12' : '#152020';
    const inside = (i, j) => {
      if (j < 1 || j > 18) return false;
      const k = j > 11 ? j - 11 : 0;
      return i >= 2 + k && i <= 17 - k;
    };
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (!inside(i, j)) continue;
        const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
        px(i, j, edge ? metal : j < 4 ? '#ffffff12' : bg);
        if (!edge && j >= 4) px(i, j, bg);
      }
    const sym = (cells) => {
      for (const [i, j] of cells) px(i + 1, j + 1, shade);
      for (const [i, j] of cells) px(i, j, metal);
    };
    const chevron = (y0) => {
      const cells = [];
      for (let i = 5; i <= 14; i++) {
        const d = Math.min(i - 5, 14 - i);
        const y = y0 + Math.floor(d / 1.5);
        cells.push([i, y], [i, y + 1]);
      }
      return cells;
    };
    const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
    const star = (sx, sy) => {
      const cells = [];
      STAR.forEach((row, j) => row.split('').forEach((ch, i) => ch === '#' && cells.push([sx + i, sy + j])));
      return cells;
    };
    const wreath = () => {
      const cells = [];
      for (let i = 5; i <= 14; i++) if (i % 2 === 1) cells.push([i, 15]);
      for (let i = 6; i <= 13; i++) if (i % 2 === 0) cells.push([i, 14]);
      cells.push([9, 16], [10, 16]);
      return cells;
    };
    let cells = [];
    if (ri === 0) for (let i = 6; i <= 13; i++) cells.push([i, 9], [i, 10]);
    else if (ri <= 4) {
      const n = Math.min(3, ri);
      const top = ri === 4 ? 6 : 9 - n * 2;
      for (let k = 0; k < n; k++) cells = cells.concat(chevron(top + k * 3));
      if (ri === 4) for (let i = 7; i <= 12; i++) cells.push([i, 3]);
    } else if (ri <= 8) {
      const n = ri - 5;
      if (ri === 5) {
        cells = star(7, 7).filter(([i, j]) => !(i === 9 && j === 9));
      } else if (n === 1) cells = star(7, 7);
      else if (n === 2) cells = star(4, 7).concat(star(11, 7));
      else cells = star(7, 3).concat(star(4, 9), star(11, 9));
    } else if (ri <= 11) {
      const n = ri - 8;
      if (n === 1) cells = star(7, 5);
      else if (n === 2) cells = star(4, 6).concat(star(11, 6));
      else cells = star(7, 2).concat(star(4, 7), star(11, 7));
      cells = cells.concat(wreath());
    } else {
      // Efsane: hilal ve yıldız
      for (let j = 3; j < 16; j++)
        for (let i = 3; i < 16; i++) {
          const a = Math.hypot(i - 8, j - 9) <= 5.2;
          const b = Math.hypot(i - 9.6, j - 9) <= 4.2;
          if (a && !b) cells.push([i, j]);
        }
      cells.push([13, 8], [12, 9], [13, 9], [14, 9], [13, 10]);
    }
    sym(cells);
    return (badgeCache[ri] = c.toDataURL('image/png'));
  };

  // ------------------------------------------------------------------
  UI.init = function () {
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (!go) return;
      G.audio.play('uiClick');
      const id = go.dataset.go;
      if (id === 'range') {
        UI.startMatch({ mode: 'range', map: 'poligon', classIdx: UI.lo.ci });
        return;
      }
      UI.show(id);
    });
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest('.btn, .mode-card, .nav-tab, .wcard, .slot')) G.audio.play('uiHover');
    });
    $('boot-start').addEventListener('click', () => {
      G.audio.init();
      G.audio.music('menu');
      if (G.isTouch) {
        try {
          const el = document.documentElement;
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        } catch (e) { /* yoksay */ }
      }
      UI.show('s-main');
    });
    $('mp-start').addEventListener('click', () => {
      const c = UI.mpCfg;
      UI.startMatch({ mode: c.mode, map: c.map, difficulty: $('mp-diff').value, botsPerTeam: +$('mp-bots').value, scoreLimit: +$('mp-limit').value, classIdx: +$('mp-class').value });
    });
    $('zm-start').addEventListener('click', () => UI.startMatch({ mode: 'zm', map: 'tesis' }));
    $('brief-go').addEventListener('click', () => {
      const mi = UI.briefMission;
      UI.startMatch({ mode: 'story', mission: mi, map: G.STORY[mi].map, difficulty: $('story-diff').value, classIdx: +$('story-class').value });
    });
    $('p-resume').addEventListener('click', () => UI.resume());
    $('p-quit').addEventListener('click', () => {
      if ($('p-confirm').hidden) {
        $('p-confirm').hidden = false;
        return;
      }
      UI.quitToMenu();
    });
    $('p-class').addEventListener('click', () => {
      UI.inGameLoadout = true;
      UI.show('s-loadout');
    });
    $('p-settings').addEventListener('click', () => {
      UI.inGameSettings = true;
      UI.show('s-settings');
    });
    $('end-menu').addEventListener('click', () => UI.quitToMenu());
    $('end-again').addEventListener('click', () => {
      const cfg = UI.lastCfg;
      if (cfg.mode === 'online') {
        UI.quitToMenu();
        UI.show('s-online');
        return;
      }
      UI.startMatch(cfg);
    });
    $('end-next').addEventListener('click', () => {
      const i = G.STORY_ORDER.indexOf(UI.lastCfg.mission);
      const next = G.STORY_ORDER[i + 1];
      if (!next) return UI.quitToMenu();
      UI.cleanupMatch();
      G.state = 'menu';
      UI.openBrief(next);
    });
    // online
    $('on-join').addEventListener('click', onJoin);
    $('on-leave').addEventListener('click', onLeave);
    $('on-start').addEventListener('click', () => {
      if (!UI.net) return;
      const go = UI.net.startGame({ map: $('on-map').value, mode: $('on-mode').value, limit: +$('on-limit').value });
      UI.joinOnline(go);
    });
    $('on-enter').addEventListener('click', () => {
      const go = UI.net && UI.net.currentGo();
      if (go) UI.joinOnline(go);
    });
    G.onKey = (e) => {
      if (UI.rebinding) return;
      if (G.state !== 'playing') return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && !G.input.locked) {
        if (UI.paused) {
          if (UI.inGameLoadout) UI.closeInGameLoadout();
          else if (UI.inGameSettings) {
            UI.inGameSettings = false;
            UI.show('s-pause');
          } else UI.resume();
        } else UI.pause();
      }
      if (e.code === 'KeyL' && G.game && G.game.mode === 'range' && !UI.paused) {
        UI.pause(true);
        UI.inGameLoadout = true;
        UI.show('s-loadout');
      }
    };
    G.onPointerLockChange = (locked) => {
      if (!locked && G.state === 'playing' && !UI.paused && !UI.ending && !G.isTouch && !UI.releasing) UI.pause();
    };
    G.canvas.addEventListener('click', () => {
      if (G.state === 'playing' && !UI.paused && !G.input.locked && !G.isTouch) G.requestLock();
    });
    // Harita görüntülerini arka planda hazırla
    if (G.queueMapShots) G.queueMapShots(['liman', 'col', 'us', 'tesis', 'poligon']);
  };

  // ------------------------------------------------------------------
  // ÜST MENÜ ve OYNA
  // ------------------------------------------------------------------
  function renderNav() {
    const lv = G.levelFromXp(G.profile.xp);
    $('nav-badge').src = G.rankBadge(lv.level);
    $('nav-rank-name').textContent = G.rankName(lv.level);
    $('nav-rank-lv').textContent = 'Seviye ' + lv.level;
    $('nav-xp').style.width = pctOf(lv);
  }

  function storyDoneCount() {
    const done = G.store.get('storyDone', {});
    return G.STORY_ORDER.filter((id) => done[id]).length;
  }

  function renderMain() {
    const pr = G.profile;
    const nDone = storyDoneCount();
    const cards = [
      { go: 's-story', cls: 'hero', shot: 'liman', tag: `HİKÂYE · ${nDone}/${G.STORY_ORDER.length} GÖREV`, title: 'KIZIL SİS', desc: 'Kızıl Pençe’nin çaldığı virüsün peşinde: limandan çöle, gece üssünden kayıp tesise. Telsizde Yüzbaşı Arda ve Çaycı Rıza.' },
      { go: 's-online', shot: 'us', tag: 'GERÇEK OYUNCULAR', title: 'ONLINE', desc: 'Oda kodunu paylaş, arkadaşınla kapış.' },
      { go: 's-mp', shot: 'col', tag: 'BOTLARA KARŞI', title: 'ÇOK OYUNCULU', desc: 'Takım Ölüm Maçı · Bölge Kontrolü · Herkes Tek' },
      { go: 's-zm', cls: 'wide', shot: 'tesis', tag: 'RAUNT TABANLI', title: 'ZOMBİLER', desc: pr.bestRound ? `Kayıp Tesis · Rekorun ${pr.bestRound}. raunt` : 'Kayıp Tesis · Gizem Kutusu, Çay Ocağı, Dönüştürücü' },
      { go: 'range', cls: 'wide', shot: 'poligon', tag: 'ANTRENMAN', title: 'ATIŞ POLİGONU', desc: pr.rangeBest ? `Tüm silahları dene · Rekor ${pr.rangeBest} puan` : 'Tüm silahları dene, hedef görevinde rekor kır.' },
    ];
    $('mode-cards').innerHTML = cards
      .map((c) => `<button type="button" class="mode-card ${c.cls || ''}" data-go="${c.go}" data-shot="${c.shot}"><div class="mc-body"><span class="mc-tag">${c.tag}</span><span class="mc-title">${c.title}</span><span class="mc-desc">${esc(c.desc)}</span></div></button>`)
      .join('');
    const lv = G.levelFromXp(pr.xp);
    const rank = G.rankName(lv.level);
    $('op-name').textContent = G.settings.callsign || 'Gölge-1';
    const op = G.OPERATORS[G.settings.operator] || G.OPERATORS.kurt;
    $('op-rank').innerHTML = `<img class="mini-badge" alt="" src="${G.rankBadge(lv.level)}"> ${esc(rank)} · Seviye ${lv.level} · ${esc(op.name)}`;
    $('op-xp').style.width = pctOf(lv);
    const kd = pr.deaths ? (pr.kills / pr.deaths).toFixed(2) : pr.kills.toFixed(2);
    const stats = [
      ['Öldürme', pr.kills],
      ['Ö/Ö', kd],
      ['Galibiyet', pr.wins],
      ['Kafadan', pr.headshots],
      ['En iyi raunt', pr.bestRound],
      ['Poligon', pr.rangeBest],
    ];
    $('op-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('op-tip').textContent = 'İpucu: ' + U.pick(TIPS);
    renderPhoto($('op-photo'));
    $('op-cap').textContent = G.settings.photo ? G.settings.photoCaption || '' : 'Ayarlar’dan yaka fotoğrafı ekleyebilirsin.';
    $('daily-panel').innerHTML = dailyHtml();
  }

  function dailyHtml() {
    const list = G.progress.daily();
    const now = new Date();
    const mid = new Date(now);
    mid.setHours(24, 0, 0, 0);
    const left = Math.max(1, Math.ceil((mid - now) / 60000));
    return `<h3>GÜNLÜK GÖREVLER</h3><p class="muted small" style="margin:-4px 0 4px">Yenilenmesine ${Math.floor(left / 60)} sa ${left % 60} dk</p>` + list.map(chHtml).join('');
  }
  function chHtml(c) {
    const p = Math.min(c.goal, c.prog);
    return `<div class="ch ${c.done ? 'done' : ''}"><div class="ch-top"><span>${esc(c.text)}</span><em>+${c.xp} XP</em></div><div class="xpbar"><i style="width:${(p / c.goal) * 100}%"></i></div><div class="ch-prog">${c.done ? 'TAMAMLANDI' : p + ' / ' + c.goal}</div></div>`;
  }

  function renderPhoto(el) {
    const photo = G.settings.photo ? G.store.get('photo', null) : null;
    if (photo) {
      el.style.backgroundImage = `url("${photo}")`;
      el.innerHTML = '';
    } else {
      el.style.backgroundImage = '';
      el.innerHTML = '<span>YAKA<br>FOTOĞRAFI</span>';
    }
  }

  // ------------------------------------------------------------------
  // MOD KURULUMLARI
  // ------------------------------------------------------------------
  UI.mpCfg = { mode: 'tdm', map: 'liman' };
  function classOptions(sel) {
    const cls = G.getClasses();
    sel.innerHTML = cls.map((c, i) => `<option value="${i}">${i + 1}. ${esc(c.name)}</option>`).join('');
    sel.value = String(UI.lo.ci || 0);
  }
  function renderMP() {
    const c = UI.mpCfg;
    const modes = ['tdm', 'dom', 'ffa'];
    $('mp-mode').innerHTML = modes.map((m) => `<button type="button" data-mode="${m}" class="${c.mode === m ? 'on' : ''}"><b>${G.MODE_INFO[m].name}</b><span>${G.MODE_INFO[m].desc}</span></button>`).join('');
    $('mp-map').innerHTML = G.MP_MAPS.map((id) => `<button type="button" data-map="${id}" class="${c.map === id ? 'on' : ''}"><i class="map-shot" data-shot="${id}"></i><b>${G.MAPS[id].name}</b><span>${G.MAPS[id].desc}</span></button>`).join('');
    for (const b of $('mp-mode').querySelectorAll('button')) b.onclick = () => { c.mode = b.dataset.mode; renderMP(); applyShots($('s-mp')); };
    for (const b of $('mp-map').querySelectorAll('button')) b.onclick = () => { c.map = b.dataset.map; renderMP(); applyShots($('s-mp')); };
    const limits = c.mode === 'dom' ? [100, 150, 200] : c.mode === 'ffa' ? [15, 20, 30] : [30, 50, 75];
    $('mp-limit').innerHTML = limits.map((l, i) => `<option ${i === 1 ? 'selected' : ''}>${l}</option>`).join('');
    classOptions($('mp-class'));
  }

  function renderStory() {
    $('story-prologue').innerHTML = '<h3>Önsöz</h3>' + G.STORY_PROLOGUE.map((p) => `<p>${esc(p)}</p>`).join('');
    const done = G.store.get('storyDone', {});
    let html = '';
    G.STORY_ORDER.forEach((id, i) => {
      const m = G.STORY[id];
      const unlocked = i === 0 || done[G.STORY_ORDER[i - 1]] || done[id];
      html += `<div class="mission ${unlocked ? '' : 'locked'} ${done[id] ? 'done' : ''}"><div class="num">${i + 1}</div><div class="m-shot" data-shot="${m.map}"></div><div><h4>${esc(m.title)}</h4><p>${esc(m.place)}</p></div>${unlocked ? `<button class="btn small" type="button" data-mission="${id}">Brifing</button>` : '<span class="muted small">Kilitli</span>'}</div>`;
    });
    $('mission-list').innerHTML = html;
    for (const b of $('mission-list').querySelectorAll('[data-mission]')) b.onclick = () => UI.openBrief(b.dataset.mission);
    classOptions($('story-class'));
  }

  UI.openBrief = function (id) {
    const m = G.STORY[id];
    UI.briefMission = id;
    $('brief-place').textContent = 'GÖREV ' + (G.STORY_ORDER.indexOf(id) + 1) + ' · ' + m.place;
    $('brief-title').textContent = m.title;
    $('brief-text').textContent = m.brief;
    const art = $('brief-art');
    art.dataset.shot = m.map;
    art.dataset.shotOn = '';
    UI.show('s-brief');
  };

  function renderZM() {
    $('zm-art').dataset.shot = 'tesis';
    $('zm-best').textContent = G.profile.bestRound ? `Rekorun: ${G.profile.bestRound}. raunt · Toplam ${G.profile.zmKills} zombi` : 'Henüz rekorun yok.';
  }

  // ------------------------------------------------------------------
  // ONLINE
  // ------------------------------------------------------------------
  function renderOnline() {
    $('on-name').value = G.settings.callsign || 'Gölge-1';
    if (!$('on-code').value) $('on-code').value = G.store.get('lastRoom', '') || Math.random().toString(36).slice(2, 6);
    $('on-map').innerHTML = G.MP_MAPS.map((id) => `<option value="${id}">${G.MAPS[id].name}</option>`).join('');
    updateLobby();
    if (!UI.lobbyTimer) UI.lobbyTimer = setInterval(updateLobby, 400);
  }

  async function onJoin() {
    const name = $('on-name').value.trim().slice(0, 16) || 'Oyuncu';
    G.settings.callsign = name;
    G.saveSettings();
    const code = $('on-code').value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 12);
    if (!code) {
      $('on-status').textContent = 'Geçerli bir oda kodu yaz (harf ve rakam).';
      return;
    }
    $('on-code').value = code;
    G.store.set('lastRoom', code);
    $('on-status').textContent = 'Bağlanılıyor…';
    $('on-join').disabled = true;
    if (UI.net) UI.net.leave();
    try {
      UI.net = await G.Net.connect(code);
    } catch (e) {
      UI.net = null;
    }
    $('on-join').disabled = false;
    if (!UI.net) {
      $('on-status').textContent = 'Bağlantı kurulamadı.';
      return;
    }
    $('on-status').textContent = UI.net.t.kind === 'room' ? `“${code}” odasına bağlandın. Arkadaşların aynı kodu girsin.` : `Yerel deneme modu: “${code}” odası yalnızca bu tarayıcının sekmeleri arasında çalışır.`;
    $('on-join').hidden = true;
    $('on-leave').hidden = false;
    updateLobby();
  }

  function onLeave() {
    if (UI.net) UI.net.leave();
    UI.net = null;
    $('on-join').hidden = false;
    $('on-leave').hidden = true;
    $('on-status').textContent = 'Odadan çıktın.';
    updateLobby();
  }

  function updateLobby() {
    if (UI.screen !== 's-online') return;
    const net = UI.net;
    if (!net) {
      $('on-peers').innerHTML = '<li class="muted">Henüz bağlanmadın.</li>';
      $('on-host').hidden = true;
      $('on-enter').hidden = true;
      $('on-wait').hidden = true;
      return;
    }
    const host = net.host();
    const peers = net.peers();
    $('on-peers').innerHTML = peers
      .map((p) => {
        const pr = p.presence || {};
        const isHost = host && host.peer === p.peer;
        return `<li class="${p.me ? 'me' : ''}"><img class="mini-badge" alt="" src="${G.rankBadge(pr.lv || 1)}">${isHost ? '<span class="crown" title="Ev sahibi">★</span>' : ''}<b>${esc(pr.n || 'Oyuncu')}</b><span class="muted small">Sv ${pr.lv || 1}${p.me ? ' · sen' : ''}${pr.ph === 'game' ? ' · maçta' : ''}${p.guest ? ' · misafir' : ''}</span></li>`;
      })
      .join('');
    const iAmHost = net.isHost();
    const go = net.currentGo();
    $('on-host').hidden = !iAmHost;
    $('on-wait').hidden = iAmHost || !!go;
    $('on-enter').hidden = !go || iAmHost;
    if (go && !iAmHost && UI.autoJoinGo !== go.id && UI.screen === 's-online') {
      UI.autoJoinGo = go.id;
      UI.joinOnline(go);
    }
  }

  UI.joinOnline = function (go) {
    if (!UI.net) return;
    UI.startMatch({ mode: 'online', map: go.map, net: UI.net, go, classIdx: UI.lo.ci || 0 });
  };

  // ------------------------------------------------------------------
  // 3D ÖNİZLEME (silah ustası ve operatörler için tek çizici)
  // ------------------------------------------------------------------
  const PV = { r: undefined };
  function pvInit() {
    if (PV.r !== undefined) return PV.r;
    try {
      const cv = document.createElement('canvas');
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
      r.setPixelRatio(1);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.3;
      const sc = new THREE.Scene();
      PV.env = G.studioEnv ? G.studioEnv(r) : null;
      const hemi = new THREE.HemisphereLight(0xe4ecff, 0x2c2620, 1.1);
      sc.add(hemi);
      const key = new THREE.DirectionalLight(0xfff0dc, 1.6);
      key.position.set(-2, 3, 2.5);
      sc.add(key);
      const rim = new THREE.DirectionalLight(0x7be0c3, 0.9);
      rim.position.set(2.5, 1.2, -2.5);
      sc.add(rim);
      const fill = new THREE.DirectionalLight(0xffb238, 0.35);
      fill.position.set(2, -1, 2);
      sc.add(fill);
      const cam = new THREE.PerspectiveCamera(26, 16 / 7, 0.05, 50);
      const holder = new THREE.Group();
      sc.add(holder);
      Object.assign(PV, { r, sc, cam, cv, holder, hemi, keyLight: key, yaw: 0, pitch: 0, spin: true, kind: null, obj: null });
      cv.style.touchAction = 'pan-y';
      let drag = null;
      cv.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, yaw: PV.yaw, pitch: PV.pitch };
        PV.spin = false;
        clearTimeout(PV.spinT);
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* yoksay */ }
        cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        PV.yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
        if (PV.kind === 'gun') PV.pitch = U.clamp(drag.pitch + (e.clientY - drag.y) * 0.008, -0.7, 0.7);
      });
      const end = () => {
        if (drag) PV.baseYaw = PV.yaw;
        PV.t = 0;
        drag = null;
        cv.style.cursor = '';
        clearTimeout(PV.spinT);
        PV.spinT = setTimeout(() => (PV.spin = true), 3000);
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('dblclick', () => {
        PV.baseYaw = PV.yaw = PV.kind === 'gun' ? -Math.PI / 2 + 0.3 : 0;
        PV.pitch = 0;
      });
    } catch (e) {
      PV.r = null;
    }
    return PV.r;
  }
  function pvLight(kind) {
    const gun = kind === 'gun';
    PV.sc.environment = gun ? PV.env || null : null;
    PV.r.toneMappingExposure = gun ? 1.3 : 1.0;
    PV.hemi.intensity = gun ? 1.1 : 0.8;
    PV.keyLight.intensity = gun ? 1.6 : 1.1;
  }
  function pvClear() {
    for (const ch of PV.holder.children.slice()) {
      PV.holder.remove(ch);
      ch.traverse((o) => o.geometry && o.geometry.dispose());
    }
    PV.obj = null;
    PV.humanoid = null;
  }
  function pvMount(wrap, w, h) {
    if (!pvInit()) {
      wrap.classList.add('no3d');
      return false;
    }
    wrap.prepend(PV.cv);
    PV.r.setSize(w, h, false);
    PV.cam.aspect = w / h;
    PV.cam.updateProjectionMatrix();
    return true;
  }
  function pvGun(stats, key) {
    if (!PV.r) return;
    if (PV.key === key && PV.obj) return;
    const sameWeapon = PV.kind === 'gun' && PV.weapon === stats.id;
    pvClear();
    const gun = G.buildGun(stats);
    const box = new THREE.Box3().setFromObject(gun);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    gun.position.sub(c);
    const pivot = new THREE.Group();
    pivot.add(gun);
    pivot.scale.setScalar(1 / Math.max(size.z, size.y * 2.2, 0.05));
    PV.holder.add(pivot);
    PV.obj = pivot;
    PV.kind = 'gun';
    PV.key = key;
    PV.weapon = stats.id;
    if (!sameWeapon) {
      PV.baseYaw = PV.yaw = -Math.PI / 2 + 0.3;
      PV.pitch = 0.1;
      PV.t = 0;
    }
    pvLight('gun');
    PV.cam.fov = 26;
    PV.cam.position.set(0, 0.04, 1.4);
    PV.cam.lookAt(0, 0, 0);
    PV.cam.updateProjectionMatrix();
  }
  function opPhotoTex() {
    const photo = G.settings.photo ? G.store.get('photo', null) : null;
    if (!photo) return null;
    const img = new Image();
    const tex = new THREE.Texture(img);
    img.onload = () => (tex.needsUpdate = true);
    img.src = photo;
    return tex;
  }
  function makeOp(id, withGun) {
    const cls = G.getClass(UI.lo.ci || 0);
    return G.makeHumanoid({ kind: 'soldier', look: 0, operator: id, photoTex: withGun ? opPhotoTex() : null, weapon: withGun ? G.computeStats(cls.primary, cls.pAtt, { camo: cls.pCamo }) : null });
  }
  function pvOperator(id) {
    if (!PV.r) return;
    const key = 'op:' + id + ':' + (G.settings.photo ? 1 : 0);
    if (PV.key === key && PV.obj) return;
    pvClear();
    const h = makeOp(id, true);
    PV.holder.add(h.root);
    PV.obj = h.root;
    PV.humanoid = h;
    PV.kind = 'op';
    PV.key = key;
    PV.yaw = -0.35;
    PV.pitch = 0;
    pvLight('op');
    PV.cam.fov = 26;
    PV.cam.position.set(0, 1.05, 4.7);
    PV.cam.lookAt(0, 0.92, 0);
    PV.cam.updateProjectionMatrix();
  }
  // Operatör yüzü (liste küçük resmi)
  const faceCache = {};
  function opFace(id) {
    if (faceCache[id] != null) return faceCache[id];
    if (!pvInit()) return (faceCache[id] = '');
    pvClear();
    PV.key = null;
    let url = '';
    try {
      const h = makeOp(id, false);
      pvLight('op');
      PV.holder.rotation.set(0, 0, 0);
      PV.holder.add(h.root);
      h.animate(0.016, { speed: 0, crouch: 0, pitch: 0 });
      PV.holder.updateMatrixWorld(true);
      const hp = h.head.getWorldPosition(new THREE.Vector3());
      PV.r.setSize(64, 64, false);
      PV.cam.aspect = 1;
      PV.cam.fov = 24;
      PV.cam.position.set(hp.x + 0.25, hp.y + 0.12, hp.z + 0.95);
      PV.cam.lookAt(hp.x, hp.y + 0.1, hp.z);
      PV.cam.updateProjectionMatrix();
      PV.r.setClearColor(0x000000, 0);
      PV.r.render(PV.sc, PV.cam);
      url = PV.cv.toDataURL('image/png');
    } catch (e) {
      url = '';
    }
    pvClear();
    PV.key = null;
    return (faceCache[id] = url);
  }
  UI.updatePreview = function (dt) {
    if (!PV.r || !PV.obj || !PV.cv.isConnected) return;
    if (UI.screen !== 's-loadout' && UI.screen !== 's-operators') return;
    PV.t = (PV.t || 0) + dt;
    if (PV.spin) {
      // silah: yandan görünüm çevresinde salınım; operatör: tam dönüş
      if (PV.kind === 'gun') PV.yaw = U.damp(PV.yaw, PV.baseYaw + Math.sin(PV.t * 0.6) * 0.55, 3, dt);
      else PV.yaw += dt * 0.35;
    }
    PV.holder.rotation.set(PV.pitch, PV.yaw, 0);
    if (PV.humanoid) PV.humanoid.animate(dt, { speed: 0, crouch: 0, pitch: -0.05 });
    PV.r.render(PV.sc, PV.cam);
  };

  // Silah görsellerini parça parça üret (menü takılmasın)
  const imgQueue = [];
  function lazyImages(root) {
    for (const img of root.querySelectorAll('img[data-wimg]')) if (!img.src) imgQueue.push(img);
    if (!UI.imgPump) pump();
  }
  function pump() {
    UI.imgPump = true;
    const t0 = performance.now();
    while (imgQueue.length && performance.now() - t0 < 14) {
      const img = imgQueue.shift();
      if (!img.isConnected) continue;
      const [id, mode, camo, att] = img.dataset.wimg.split('|');
      const url = G.weaponImage(id, mode || 'thumb', camo || '', att ? JSON.parse(att) : {});
      if (url) img.src = url;
    }
    if (imgQueue.length) requestAnimationFrame(pump);
    else UI.imgPump = false;
  }
  const wimg = (id, mode, camo, att) => `<img alt="" data-wimg="${esc([id, mode || 'thumb', camo || '', att && Object.keys(att).length ? JSON.stringify(att) : ''].join('|'))}">`;

  // ------------------------------------------------------------------
  // SİLAHLAR: sınıflar, cephanelik, silah ustası
  // ------------------------------------------------------------------
  const perkName = (id) => {
    for (const t of [1, 2, 3]) {
      const p = G.PERKS[t].find((x) => x.id === id);
      if (p) return p.name;
    }
    return '—';
  };
  const attCount = (att) => Object.values(att || {}).filter((v) => v && v !== 'none').length;
  function save() {
    G.saveClasses(UI.lo.classes);
  }

  function renderLoadout() {
    const lo = UI.lo;
    lo.classes = G.getClasses();
    const cls = lo.classes[lo.ci];
    if (!cls.melee) cls.melee = 'bicak';
    $('class-tabs').innerHTML = lo.classes.map((c, i) => `<button type="button" data-ci="${i}" class="${i === lo.ci ? 'on' : ''}">${i + 1}. ${esc(c.name)}</button>`).join('');
    for (const b of $('class-tabs').querySelectorAll('button')) b.onclick = () => { lo.ci = +b.dataset.ci; renderLoadout(); };
    const wslot = (key, label, id, att, camo) => {
      const w = G.WEAPONS[id];
      const n = attCount(att);
      const cm = G.CAMOS.find((c) => c.id === camo);
      return `<button type="button" class="slot ${lo.slot === key ? 'on' : ''}" data-slot="${key}">${wimg(id, 'thumb', camo, att)}<small>${label}</small><b>${esc(w.name)}</b><em>${n ? n + ' eklenti' : 'Eklentisiz'}${cm && cm.id !== 'yok' ? ' · ' + esc(cm.name) : ''}</em></button>`;
    };
    const islot = (key, label, value, icon) => `<button type="button" class="slot ${lo.slot === key ? 'on' : ''}" data-slot="${key}"><span class="slot-icon">${icon ? `<img alt="" src="${icon}">` : ''}</span><small>${label}</small><b>${esc(value)}</b></button>`;
    $('class-slots').innerHTML = `
      <label class="field">Sınıf adı <input id="class-name" class="class-name" maxlength="18" value="${esc(cls.name)}"></label>
      ${wslot('primary', 'Ana silah', cls.primary, cls.pAtt, cls.pCamo)}
      ${wslot('secondary', 'Yan silah', cls.secondary, cls.sAtt, cls.sCamo)}
      ${islot('melee', 'Yakın dövüş', (G.MELEE[cls.melee] || G.MELEE.bicak).name, G.itemIcon && G.itemIcon('melee'))}
      ${islot('lethal', 'Öldürücü', G.LETHALS[cls.lethal].name, G.itemIcon && G.itemIcon(cls.lethal))}
      ${islot('tactical', 'Taktik', G.TACTICALS[cls.tactical].name, G.itemIcon && G.itemIcon(cls.tactical))}
      ${islot('perk1', 'Yetenek 1', perkName(cls.perks[0]), G.itemIcon && G.itemIcon('perk1'))}
      ${islot('perk2', 'Yetenek 2', perkName(cls.perks[1]), G.itemIcon && G.itemIcon('perk2'))}
      ${islot('perk3', 'Yetenek 3', perkName(cls.perks[2]), G.itemIcon && G.itemIcon('perk3'))}
      ${UI.inGameLoadout ? '<button type="button" class="btn primary" id="lo-done" style="width:100%">Oyuna dön</button>' : ''}`;
    $('class-name').oninput = (e) => {
      cls.name = e.target.value.slice(0, 18) || 'Sınıf';
      save();
      for (const b of $('class-tabs').querySelectorAll('button')) if (+b.dataset.ci === lo.ci) b.textContent = `${lo.ci + 1}. ${cls.name}`;
    };
    for (const b of $('class-slots').querySelectorAll('.slot')) b.onclick = () => {
      if (lo.slot === b.dataset.slot && (lo.slot === 'primary' || lo.slot === 'secondary')) lo.view = lo.view === 'smith' ? 'armory' : 'smith';
      else lo.view = 'smith';
      lo.slot = b.dataset.slot;
      G.audio.play('uiClick');
      renderLoadout();
      if (window.innerWidth <= 1000) {
        try {
          $('lo-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { /* yoksay */ }
      }
    };
    if ($('lo-done')) $('lo-done').onclick = () => UI.closeInGameLoadout();
    renderLoMain(cls);
    lazyImages($('s-loadout'));
  }

  function renderLoMain(cls) {
    const lo = UI.lo;
    const s = lo.slot;
    const main = $('lo-main');
    if (s === 'primary' || s === 'secondary') {
      if (lo.view === 'armory') renderArmory(cls, main);
      else renderSmith(cls, main);
      return;
    }
    const lv = G.levelFromXp(G.profile.xp).level;
    let head = '', html = '';
    if (s === 'melee') {
      head = 'YAKIN DÖVÜŞ';
      html = Object.keys(G.MELEE)
        .map((id) => {
          const m = G.MELEE[id];
          const locked = lv < m.unlock;
          return `<button type="button" data-melee="${id}" class="${cls.melee === id ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''}><b>${esc(m.name)}</b><span>${esc(m.desc)}</span><span>${locked ? `Seviye ${m.unlock}’de açılır` : `Zombilerde ${m.zm} hasar`}</span></button>`;
        })
        .join('');
    } else if (s === 'lethal' || s === 'tactical') {
      head = s === 'lethal' ? 'ÖLDÜRÜCÜ EKİPMAN' : 'TAKTİK EKİPMAN';
      const src = s === 'lethal' ? G.LETHALS : G.TACTICALS;
      html = Object.keys(src).map((id) => `<button type="button" data-e="${id}" class="${cls[s] === id ? 'on' : ''}">${G.itemIcon ? `<img class="pick-icon" alt="" src="${G.itemIcon(id)}">` : ''}<b>${esc(src[id].name)}</b><span>${esc(src[id].desc)}</span></button>`).join('');
    } else {
      const tier = +s.slice(4);
      head = 'YETENEK ' + tier;
      html = G.PERKS[tier].map((p) => `<button type="button" data-p="${p.id}" class="${cls.perks[tier - 1] === p.id ? 'on' : ''}"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></button>`).join('');
    }
    main.innerHTML = `<div class="lo-head"><h3>${head}</h3></div><div class="pick-grid big">${html}</div>`;
    for (const b of main.querySelectorAll('[data-melee]')) b.onclick = () => { cls.melee = b.dataset.melee; save(); renderLoadout(); };
    for (const b of main.querySelectorAll('[data-e]')) b.onclick = () => { cls[s] = b.dataset.e; save(); renderLoadout(); };
    for (const b of main.querySelectorAll('[data-p]')) b.onclick = () => { cls.perks[+s.slice(4) - 1] = b.dataset.p; save(); renderLoadout(); };
  }

  function weaponMeta(id) {
    const p = G.progress.weapon(id);
    const wl = G.weaponLevel(p.xp);
    return { kills: p.kills, level: wl.level, wl };
  }

  function renderArmory(cls, main) {
    const s = UI.lo.slot;
    const cur = s === 'primary' ? cls.primary : cls.secondary;
    let html = `<div class="lo-head"><h3>CEPHANELİK · ${s === 'primary' ? 'ANA SİLAH' : 'YAN SİLAH'}</h3><span class="muted">Bir silah seç; ardından Silah Ustası’nda özelleştir.</span><button type="button" class="btn small" id="lo-tosmith" style="margin-left:auto">Silah Ustası →</button></div>`;
    for (const [cat, label] of G.WEAPON_CATEGORIES) {
      const ids = Object.keys(G.WEAPONS).filter((id) => {
        const w = G.WEAPONS[id];
        return w.cls === cat && w.slot === s && !w.zmOnly;
      });
      if (!ids.length) continue;
      html += `<div class="cat-title">${esc(label.toUpperCase())}</div><div class="armory">`;
      for (const id of ids) {
        const w = G.WEAPONS[id];
        const m = weaponMeta(id);
        html += `<button type="button" class="wcard ${id === cur ? 'on' : ''}" data-w="${id}">${wimg(id, 'thumb', '', null)}<b>${esc(w.name)}</b><div class="wmeta"><span>${esc(w.clsName)}</span><span class="wlv">Sv ${m.level}</span></div><div class="wmeta"><span>${m.kills} öldürme</span><span>${esc(G.CAMOS.filter((c) => m.kills >= c.need).length + '/' + G.CAMOS.length)} kamuflaj</span></div></button>`;
      }
      html += '</div>';
    }
    main.innerHTML = html;
    $('lo-tosmith').onclick = () => { UI.lo.view = 'smith'; renderLoadout(); };
    for (const b of main.querySelectorAll('[data-w]')) b.onclick = () => {
      const id = b.dataset.w;
      if (s === 'primary') {
        if (cls.primary !== id) { cls.primary = id; cls.pAtt = {}; cls.pCamo = 'yok'; }
      } else if (cls.secondary !== id) {
        cls.secondary = id;
        cls.sAtt = {};
        cls.sCamo = 'yok';
      }
      save();
      UI.lo.view = 'smith';
      G.audio.play('reloadEnd');
      renderLoadout();
    };
  }

  function statDeltaBars(base, cur) {
    return Object.keys(cur)
      .map((k) => {
        const b = base[k], v = cur[k];
        let bar;
        if (v > b) bar = `<b style="width:${b}%"></b><s style="left:${b}%;width:${v - b}%"></s>`;
        else if (v < b) bar = `<b style="width:${v}%"></b><s class="neg" style="left:${v}%;width:${b - v}%"></s>`;
        else bar = `<b style="width:${v}%"></b>`;
        const d = v - b;
        return `<div><span style="text-align:left;font-family:var(--ui);font-size:13px">${k}</span><i>${bar}</i><span>${v}${d ? `<sup class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</sup>` : ''}</span></div>`;
      })
      .join('');
  }

  function renderSmith(cls, main) {
    const s = UI.lo.slot;
    const id = s === 'primary' ? cls.primary : cls.secondary;
    const attKey = s === 'primary' ? 'pAtt' : 'sAtt';
    const camoKey = s === 'primary' ? 'pCamo' : 'sCamo';
    const w = G.WEAPONS[id];
    const att = cls[attKey] || {};
    const camo = cls[camoKey] || 'yok';
    const st = G.computeStats(id, att, { camo });
    const baseSt = G.computeStats(id, {}, {});
    const m = weaponMeta(id);
    const modeName = st.mode === 'auto' ? 'Otomatik' : st.mode === 'burst' ? `${st.burst || 3}’lü seri` : st.bolt ? 'Sürgülü' : 'Tek atış';
    const ttk = G.timeToKill(st, 8);
    const slotsHtml = Object.keys(G.ATTACH)
      .map((slot) => {
        const opts = G.attachOptions(id, slot);
        if (!opts.length) return '';
        const sel = att[slot] || 'none';
        const item = opts.find((i) => i.id === sel) || opts[0];
        return `<div class="att-slot"><b>${esc(G.ATTACH[slot].label.toUpperCase())}</b><div class="chips">${opts.map((o) => `<button type="button" class="chip ${o.id === item.id ? 'on' : ''}" data-att="${slot}" data-v="${o.id}" title="${esc(o.desc || '')}">${esc(o.name)}</button>`).join('')}</div><div class="att-desc2">${esc(item.desc || 'Standart parça.')}</div></div>`;
      })
      .join('');
    const camoHtml = G.CAMOS.map((c) => {
      const ok = m.kills >= c.need;
      const sw = G.camoSwatch ? G.camoSwatch(c.id) : '';
      return `<button type="button" class="camo ${c.id === camo ? 'on' : ''} ${ok ? '' : 'locked'}" data-camo="${c.id}" title="${esc(c.name)}${ok ? '' : ' · ' + c.need + ' öldürme'}" style="${sw ? `background-image:${sw}` : ''}"><span>${ok ? esc(c.name) : c.need + ' ö.'}</span></button>`;
    }).join('');
    main.innerHTML = `
      <div class="lo-head"><h3>SİLAH USTASI</h3><span class="muted">${s === 'primary' ? 'Ana silah' : 'Yan silah'}</span><button type="button" class="btn small" id="lo-toarmory" style="margin-left:auto">← Cephanelik</button></div>
      <div class="smith">
        <div class="smith-view">
          <div class="smith-name">${esc(w.name)}<small>${esc(w.clsName)} · Silah seviyesi ${m.level} · ${m.kills} öldürme</small></div>
          <div class="preview-wrap" id="pv-wrap"><span class="hint">Sürükle: döndür · Çift tık: sıfırla</span></div>
          <p class="muted small" style="margin:0">${esc(w.desc || '')}</p>
          <div class="stat-bars">${statDeltaBars(G.statBars(baseSt), G.statBars(st))}</div>
          <div class="wstat-line"><span>Şarjör <b>${st.mag}</b></span><span>Yedek <b>${st.reserve}</b></span><span>Atış/dk <b>${st.rpm}</b></span><span>Doldurma <b>${st.reload.toFixed(1)} sn</b></span><span>${modeName}</span>${isFinite(ttk) ? `<span>Öldürme süresi <b>${ttk} ms</b></span>` : ''}</div>
          <div class="xpbar" title="Silah seviyesi"><i style="width:${pctOf(m.wl)}"></i></div>
          <h3 style="margin-bottom:6px">KAMUFLAJ</h3>
          <div class="camo-grid">${camoHtml}</div>
        </div>
        <div class="att-slots">${slotsHtml || '<p class="muted">Bu silaha eklenti takılamaz.</p>'}</div>
      </div>`;
    $('lo-toarmory').onclick = () => { UI.lo.view = 'armory'; renderLoadout(); };
    for (const b of main.querySelectorAll('[data-att]')) b.onclick = () => {
      const next = Object.assign({}, cls[attKey], { [b.dataset.att]: b.dataset.v });
      if (b.dataset.v === 'none') delete next[b.dataset.att];
      cls[attKey] = next;
      save();
      G.audio.play('uiClick');
      renderLoadout();
    };
    for (const b of main.querySelectorAll('[data-camo]')) b.onclick = () => {
      if (b.classList.contains('locked')) {
        UI.toast(`${G.CAMOS.find((c) => c.id === b.dataset.camo).need} öldürmede açılır`);
        return;
      }
      cls[camoKey] = b.dataset.camo;
      save();
      renderLoadout();
    };
    const wrap = $('pv-wrap');
    const pw = Math.max(240, Math.min(420, Math.round(wrap.clientWidth / 2) || 360));
    if (pvMount(wrap, pw, Math.round(pw * 0.44))) pvGun(st, id + JSON.stringify(att) + camo);
    if (s === 'primary' && UI.lo.ci === 0 && G.refreshOperator && UI.lastOpKey !== id + camo + JSON.stringify(att)) {
      UI.lastOpKey = id + camo + JSON.stringify(att);
      G.refreshOperator();
    }
  }

  UI.closeInGameLoadout = function () {
    UI.inGameLoadout = false;
    const m = G.game;
    if (m && m.mode === 'range') {
      m.player.applyLoadout(G.getClass(UI.lo.ci));
      UI.resume();
    } else if (m) {
      G.pendingClass = UI.lo.ci;
      m.cfg.classIdx = UI.lo.ci;
      UI.toast('Sınıf bir sonraki doğuşta değişecek');
      UI.show('s-pause');
    } else UI.show('s-main');
  };

  // ------------------------------------------------------------------
  // OPERATÖRLER
  // ------------------------------------------------------------------
  function renderOperators() {
    const lv = G.levelFromXp(G.profile.xp).level;
    const cur = G.settings.operator || 'kurt';
    if (!UI.opSel || !G.OPERATORS[UI.opSel]) UI.opSel = cur;
    const ids = Object.keys(G.OPERATORS);
    $('ops-list').innerHTML = ids
      .map((id) => {
        const o = G.OPERATORS[id];
        const locked = lv < o.unlock;
        return `<button type="button" class="op-item ${id === UI.opSel ? 'on' : ''} ${locked ? 'locked' : ''}" data-op="${id}"><img class="op-face" alt="" src="${opFace(id)}"><div><b>${esc(o.name)}</b><span>${esc(o.role)}${locked ? ' · Seviye ' + o.unlock + '’de açılır' : ''}</span></div>${id === cur ? '<em class="op-eq">SEÇİLİ</em>' : ''}</button>`;
      })
      .join('');
    for (const b of $('ops-list').querySelectorAll('[data-op]')) b.onclick = () => { UI.opSel = b.dataset.op; renderOperators(); };
    const o = G.OPERATORS[UI.opSel];
    const locked = lv < o.unlock;
    $('ops-detail').innerHTML = `
      <div class="preview-wrap op-view" id="op-wrap"><span class="hint">Sürükle: döndür</span></div>
      <div class="mc-tag">${esc(o.role.toUpperCase())}</div>
      <h2>${esc(o.name)}</h2>
      <p>${esc(o.bio)}</p>
      <p class="muted small">${G.settings.photo ? 'Yaka fotoğrafın bu operatörün yakasında taşınır.' : 'Ayarlar’dan yaka fotoğrafı eklersen operatörünün yakasında taşınır.'}</p>
      <div class="btn-row">${locked ? `<span class="muted">Seviye ${o.unlock}’de açılır.</span>` : UI.opSel === cur ? '<span class="tag">SEÇİLİ OPERATÖR</span>' : '<button type="button" class="btn primary" id="op-pick">OPERATÖRÜ SEÇ</button>'}</div>`;
    if ($('op-pick')) $('op-pick').onclick = () => {
      G.settings.operator = UI.opSel;
      G.saveSettings();
      if (G.refreshOperator) G.refreshOperator();
      G.audio.play('levelUp');
      UI.toast(`${o.name} seçildi`);
      renderOperators();
    };
    const wrap = $('op-wrap');
    const pw = Math.max(240, Math.min(360, Math.round(wrap.clientWidth / 2) || 300));
    if (pvMount(wrap, pw, Math.round(pw * 0.62))) pvOperator(UI.opSel);
  }

  // ------------------------------------------------------------------
  // İLERLEME
  // ------------------------------------------------------------------
  function renderProgress() {
    const pr = G.profile;
    const lv = G.levelFromXp(pr.xp);
    const ri = G.rankIndex(lv.level);
    const next = G.RANKS[ri + 1];
    const ladder = G.RANKS.map(([l, n], i) => `<div class="rank-step ${i < ri ? 'got' : i === ri ? 'cur' : 'lock'}"><img alt="" src="${G.rankBadge(l)}"><b>${esc(n)}</b><span class="muted">Sv ${l}</span></div>`).join('');
    const wlist = Object.keys(G.progress.data.weapons)
      .filter((id) => G.WEAPONS[id])
      .map((id) => Object.assign({ id }, G.progress.weapon(id)))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);
    const mastery = wlist.length
      ? wlist
          .map((w) => {
            const wl = G.weaponLevel(w.xp);
            return `<div>${wimg(w.id, 'thumb', '', null)}<div><b style="font-size:13px">${esc(G.WEAPONS[w.id].name)}</b><div class="xpbar"><i style="width:${pctOf(wl)}"></i></div></div><span>Sv ${wl.level}<br>${w.kills} ö.</span></div>`;
          })
          .join('')
      : '<p class="muted">Henüz silah ustalığın yok. Maçlarda öldürdükçe silah seviyen ve kamuflajların açılır.</p>';
    const medals = Object.entries(G.progress.data.medals || {}).sort((a, b) => b[1] - a[1]);
    const unlocks = [];
    for (const id in G.OPERATORS) if (G.OPERATORS[id].unlock > lv.level) unlocks.push([G.OPERATORS[id].unlock, 'Operatör: ' + G.OPERATORS[id].name]);
    for (const id in G.MELEE) if (G.MELEE[id].unlock > lv.level) unlocks.push([G.MELEE[id].unlock, 'Yakın dövüş: ' + G.MELEE[id].name]);
    unlocks.sort((a, b) => a[0] - b[0]);
    const kd = pr.deaths ? (pr.kills / pr.deaths).toFixed(2) : pr.kills.toFixed(2);
    const career = [
      ['Maç', pr.matches], ['Galibiyet', pr.wins], ['Öldürme', pr.kills], ['Ölüm', pr.deaths], ['Ö/Ö', kd], ['Kafadan', pr.headshots],
      ['Zombi', pr.zmKills], ['En iyi raunt', pr.bestRound], ['Poligon rekoru', pr.rangeBest], ['Hikâye', storyDoneCount() + '/' + G.STORY_ORDER.length],
    ];
    $('prog-body').innerHTML = `
      <div class="panel rank-panel">
        <h3>RÜTBE</h3>
        <div class="rank-now"><img alt="" src="${G.rankBadge(lv.level)}"><div><b>${esc(G.rankName(lv.level))}</b><span>Seviye ${lv.level}${lv.need ? ` · ${lv.cur} / ${lv.need} XP` : ' · EN YÜKSEK'}</span><div class="xpbar"><i style="width:${pctOf(lv)}"></i></div><span class="muted small">${next ? `Sonraki rütbe: ${esc(next[1])} (Seviye ${next[0]})` : 'Efsane oldun.'}</span></div></div>
        <div class="rank-ladder">${ladder}</div>
      </div>
      <div class="panel daily">${dailyHtml()}</div>
      <div class="panel"><h3>SİLAH USTALIĞI</h3><div class="mastery">${mastery}</div></div>
      <div class="panel"><h3>KARİYER</h3><dl class="op-stats">${career.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <h3 style="margin-top:16px">MADALYALAR</h3>${medals.length ? `<div class="medal-grid">${medals.map(([n, c]) => `<div><span>${esc(n)}</span><em>×${c}</em></div>`).join('')}</div>` : '<p class="muted">Maçlarda madalya kazandıkça burada birikir.</p>'}
      </div>
      <div class="panel"><h3>SIRADAKİ KİLİTLER</h3>${unlocks.length ? `<ul class="ticks">${unlocks.slice(0, 8).map(([l, t]) => `<li><b>Seviye ${l}</b> · ${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">Tüm operatörler ve yakın dövüş silahları açık.</p>'}<p class="muted small">Kamuflajlar her silahta öldürme sayısıyla açılır: ${G.CAMOS.filter((c) => c.need).map((c) => `${esc(c.name)} ${c.need}`).join(' · ')}.</p></div>`;
    lazyImages($('prog-body'));
  }

  // ------------------------------------------------------------------
  // AYARLAR
  // ------------------------------------------------------------------
  const BIND_LABELS = [
    ['fwd', 'İleri'], ['back', 'Geri'], ['left', 'Sol'], ['right', 'Sağ'], ['jump', 'Zıpla / tırman'], ['sprint', 'Koş'],
    ['crouch', 'Çömel / kay'], ['prone', 'Yat / dal'], ['reload', 'Şarjör değiştir'], ['use', 'Etkileşim'], ['melee', 'Yakın dövüş'],
    ['lethal', 'Öldürücü'], ['tactical', 'Taktik'], ['swap', 'Silah değiştir'], ['cay', 'Çay iç'], ['simit', 'Simit ye'],
    ['inspect', 'Silahı incele'], ['score', 'Skor tablosu'],
  ];
  G.keyLabel = function (code) {
    if (!code) return '—';
    const map = { Space: 'Boşluk', ShiftLeft: 'Shift', ShiftRight: 'Sağ Shift', ControlLeft: 'Ctrl', ControlRight: 'Sağ Ctrl', AltLeft: 'Alt', Tab: 'Tab', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', mouse0: 'Sol tık', mouse1: 'Orta tık', mouse2: 'Sağ tık', CapsLock: 'Caps', Backquote: '`' };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
    return code;
  };

  function renderSettings() {
    const s = G.settings;
    const slider = (key, label, min, max, step, fmt) => `<label class="field">${label} <span class="range-val" id="v-${key}">${fmt ? fmt(s[key]) : s[key]}</span><input type="range" id="set-${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const toggle = (key, label) => `<label class="toggle"><input type="checkbox" id="set-${key}" ${s[key] ? 'checked' : ''}> ${label}</label>`;
    const pct = (v) => Math.round(v * 100) + '%';
    const binds = BIND_LABELS.map(([a, l]) => `<span>${l}</span><button type="button" class="bind" data-bind="${a}">${(G.input.binds[a] || []).slice(0, 2).map((c) => `<kbd>${esc(G.keyLabel(c))}</kbd>`).join(' ')}</button>`).join('');
    $('settings-body').innerHTML = `
      ${UI.inGameSettings ? '<div class="set-back"><button type="button" class="btn primary" id="set-back">← Oyuna dön</button></div>' : ''}
      <div class="panel"><h3>Görüntü</h3>
        ${slider('pixel', 'Piksel boyutu', 1, 5, 1, (v) => (+v === 1 ? 'Kapalı' : v + 'x'))}
        ${toggle('outline', 'Piksel kontur çizgileri')}
        ${toggle('bloom', 'Işık parlaması (bloom)')}
        ${slider('levels', 'Renk paleti (ton sayısı)', 6, 48, 1)}
        <label class="field">Grafik kalitesi <select id="set-quality"><option value="yuksek">Yüksek (gölgeler)</option><option value="orta">Orta</option><option value="dusuk">Düşük (zayıf cihaz)</option></select></label>
        ${slider('fov', 'Görüş alanı', 60, 105, 1, (v) => v + '°')}
        ${toggle('showFps', 'FPS göster')}
      </div>
      <div class="panel"><h3>Kontrol</h3>
        ${slider('sens', 'Fare hassasiyeti', 0.2, 3, 0.05, (v) => (+v).toFixed(2))}
        ${slider('adsSens', 'Nişan hassasiyeti', 0.3, 1.5, 0.05, (v) => (+v).toFixed(2))}
        ${slider('touchSens', 'Dokunmatik hassasiyet', 0.3, 3, 0.05, (v) => (+v).toFixed(2))}
        ${toggle('invertY', 'Dikey ekseni ters çevir')}
        ${toggle('toggleAds', 'Nişan alma: aç/kapa (basılı tutmak yerine)')}
      </div>
      <div class="panel"><h3>Tuşlar</h3>
        <p class="muted small" style="margin-top:0">Değiştirmek için bir tuşa tıkla, sonra yeni tuşa bas. Esc: vazgeç.</p>
        <div class="keys binds">${binds}</div>
        <button type="button" class="btn small" id="set-binds-reset">Varsayılan tuşlar</button>
      </div>
      <div class="panel"><h3>Ses</h3>
        ${slider('master', 'Ana ses', 0, 1, 0.05, pct)}
        ${slider('sfx', 'Efektler', 0, 1, 0.05, pct)}
        ${slider('music', 'Müzik', 0, 1, 0.05, pct)}
        ${toggle('announcer', 'Sesli anons (tarayıcı destekliyorsa)')}
      </div>
      <div class="panel"><h3>Profil · Yaka fotoğrafı</h3>
        <label class="field">Çağrı adı <input id="set-callsign" maxlength="16" value="${esc(s.callsign || '')}"></label>
        <div class="photo-box">
          <div class="op-photo" id="set-photo-prev"><span>YAKA<br>FOTOĞRAFI</span></div>
          <div>
            <p class="small">Karakterinin yakasında taşıyacağın fotoğrafı seç. Fotoğraf yalnızca bu cihazda saklanır, hiçbir yere gönderilmez.</p>
            <label class="btn small" for="set-photo-file">Fotoğraf seç</label>
            <input type="file" id="set-photo-file" accept="image/*" hidden>
            <button type="button" class="btn small danger" id="set-photo-del">Kaldır</button>
            <label class="field" style="margin-top:10px">Fotoğraf notu (isteğe bağlı) <input id="set-photoCaption" maxlength="40" value="${esc(s.photoCaption || '')}" placeholder="Örn. bir isim veya dua"></label>
          </div>
        </div>
        <button type="button" class="btn small danger" id="set-reset">İlerlemeyi sıfırla</button>
      </div>`;
    if ($('set-back')) $('set-back').onclick = () => {
      UI.inGameSettings = false;
      UI.show('s-pause');
    };
    $('set-quality').value = s.quality;
    const fmts = { pixel: (v) => (+v === 1 ? 'Kapalı' : v + 'x'), fov: (v) => v + '°', master: pct, sfx: pct, music: pct, sens: (v) => (+v).toFixed(2), adsSens: (v) => (+v).toFixed(2), touchSens: (v) => (+v).toFixed(2) };
    for (const key of ['pixel', 'levels', 'fov', 'sens', 'adsSens', 'touchSens', 'master', 'sfx', 'music']) {
      const el = $('set-' + key);
      el.oninput = () => {
        s[key] = +el.value;
        const fmt = fmts[key];
        $('v-' + key).textContent = fmt ? fmt(s[key]) : s[key];
        G.saveSettings();
        G.audio.applyVolumes();
        if (key === 'pixel' || key === 'levels') G.onResize && G.onResize();
      };
    }
    for (const key of ['outline', 'bloom', 'showFps', 'invertY', 'toggleAds', 'announcer']) {
      const el = $('set-' + key);
      el.onchange = () => {
        s[key] = el.checked;
        G.saveSettings();
        if (key === 'outline' || key === 'bloom') G.onResize && G.onResize();
      };
    }
    $('set-quality').onchange = (e) => {
      s.quality = e.target.value;
      G.saveSettings();
      UI.toast('Kalite bir sonraki maçta tam uygulanır');
      G.onResize && G.onResize();
    };
    $('set-callsign').oninput = (e) => {
      s.callsign = e.target.value.slice(0, 16);
      G.saveSettings();
    };
    $('set-photoCaption').oninput = (e) => {
      s.photoCaption = e.target.value.slice(0, 40);
      G.saveSettings();
    };
    for (const b of $('settings-body').querySelectorAll('[data-bind]')) b.onclick = () => startRebind(b);
    $('set-binds-reset').onclick = () => {
      G.resetBinds();
      renderSettings();
      UI.toast('Tuşlar varsayılana döndü');
    };
    renderPhoto($('set-photo-prev'));
    $('set-photo-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 96;
          c.height = 112;
          const ctx = c.getContext('2d');
          const r = Math.max(96 / img.width, 112 / img.height);
          const w = img.width * r, h = img.height * r;
          ctx.drawImage(img, (96 - w) / 2, (112 - h) / 2, w, h);
          let url;
          try {
            url = c.toDataURL('image/jpeg', 0.88);
          } catch (er) {
            UI.toast('Fotoğraf işlenemedi');
            return;
          }
          G.store.set('photo', url);
          s.photo = true;
          G.saveSettings();
          renderPhoto($('set-photo-prev'));
          G.refreshOperator && G.refreshOperator();
          UI.toast('Yaka fotoğrafı kaydedildi');
        };
        img.onerror = () => UI.toast('Bu dosya açılamadı. JPG veya PNG dene.');
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    };
    $('set-photo-del').onclick = () => {
      G.store.set('photo', null);
      s.photo = false;
      G.saveSettings();
      renderPhoto($('set-photo-prev'));
      G.refreshOperator && G.refreshOperator();
    };
    let resetArm = false;
    $('set-reset').onclick = (e) => {
      if (!resetArm) {
        resetArm = true;
        e.target.textContent = 'Emin misin? Tekrar bas';
        return;
      }
      G.profile = Object.assign({}, { xp: 0, kills: 0, deaths: 0, wins: 0, matches: 0, headshots: 0, bestRound: 0, zmKills: 0, rangeBest: 0 });
      G.saveProfile();
      G.store.set('storyDone', {});
      G.progress.data = { weapons: {}, medals: {}, daily: { key: '', prog: {}, done: {} } };
      G.progress.save();
      e.target.textContent = 'Sıfırlandı';
    };
  }

  function startRebind(btn) {
    const action = btn.dataset.bind;
    if (UI.rebinding) return;
    UI.rebinding = true;
    btn.classList.add('wait');
    btn.innerHTML = '<kbd>…</kbd> tuşa bas';
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.removeEventListener('keydown', onKey, true);
      UI.rebinding = false;
      if (e.code !== 'Escape') {
        const other = G.setBind(action, e.code);
        if (other) {
          const lab = BIND_LABELS.find((x) => x[0] === other);
          UI.toast(`${G.keyLabel(e.code)} artık “${BIND_LABELS.find((x) => x[0] === action)[1]}”. “${lab ? lab[1] : other}” boş kaldı.`);
        }
      }
      renderSettings();
    };
    window.addEventListener('keydown', onKey, true);
  }

  // ------------------------------------------------------------------
  function renderHelp() {
    const b = (a) => (G.input.binds[a] || []).slice(0, 1).map(G.keyLabel);
    const k = (keys, what) => `<span>${keys.map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</span><span>${what}</span>`;
    $('help-body').innerHTML = `
      <div class="panel"><h3>Hareket</h3><div class="keys">
        ${k([...b('fwd'), ...b('left'), ...b('back'), ...b('right')], 'Hareket')}
        ${k(b('sprint'), 'Koş (her yöne). İki kez bas: taktik koşu')}
        ${k(b('jump'), 'Zıpla · engelin önünde tırman')}
        ${k(b('crouch'), 'Çömel · koşarken: kayma')}
        ${k(b('prone'), 'Yüzüstü yat · koşarken: dalış')}
      </div></div>
      <div class="panel"><h3>Savaş</h3><div class="keys">
        ${k(['Sol tık'], 'Ateş')}
        ${k(['Sağ tık'], 'Nişan al')}
        ${k(b('reload'), 'Şarjör değiştir')}
        ${k(['1', '2', ...b('swap'), 'Tekerlek'], 'Silah değiştir')}
        ${k(b('melee'), 'Yakın dövüş (bıçak, pala, katana…)')}
        ${k(b('lethal'), 'Öldürücü (basılı tut: pişir)')}
        ${k(b('tactical'), 'Taktik ekipman')}
        ${k(['3', '4', '5', '6'], 'Skor serileri')}
        ${k(b('inspect'), 'Silahı incele')}
      </div></div>
      <div class="panel"><h3>Bizden</h3><div class="keys">
        ${k(b('cay'), 'Çay iç: 30 sn hasar +%25, hızlı şarjör, hızlı yenilenme')}
        ${k(b('simit'), 'Simit ye: +100 sağlık')}
        ${k(b('use'), 'Etkileşim (kapı, kutu, makine, görev)')}
        ${k(b('score'), 'Skor tablosu')}
        ${k(['Esc', 'P'], 'Duraklat')}
        ${k(['L'], 'Poligonda sınıf düzenle')}
      </div></div>
      <div class="panel"><h3>Modlar</h3>
        <p><b>Hikâye:</b> Kızıl Pençe’nin çaldığı virüsün peşinde beş görev. Telsizden Yüzbaşı Arda ve Çaycı Rıza konuşur.</p>
        <p><b>Online:</b> Aynı oda kodunu giren oyuncular gerçek zamanlı karşılaşır.</p>
        <p><b>Çok oyunculu:</b> Takım Ölüm Maçı, Bölge Kontrolü ve Herkes Tek; botlara karşı. Skor serileri açık.</p>
        <p><b>Zombiler:</b> Puan topla, kapıları aç, gücü aç, silahını Dönüştürücü’de güçlendir.</p>
        <p><b>İlerleme:</b> Her öldürme silah seviyesi kazandırır; öldürme sayısıyla 9 kamuflaj açılır. Rütbe atladıkça yeni operatörler ve yakın dövüş silahları gelir.</p>
      </div>`;
  }

  // ------------------------------------------------------------------
  // MAÇ AKIŞI
  // ------------------------------------------------------------------
  const MODE_LABEL = (cfg) => {
    if (cfg.mode === 'story') return 'HİKÂYE · GÖREV ' + (G.STORY_ORDER.indexOf(cfg.mission) + 1);
    const mi = G.MODE_INFO[cfg.mode];
    return (mi ? mi.name : cfg.mode).toUpperCase();
  };

  UI.startMatch = function (cfg) {
    G.audio.init();
    if (!G.isTouch) G.requestLock();
    UI.cleanupMatch();
    UI.lastCfg = cfg;
    UI.paused = false;
    UI.ending = false;
    UI.inGameLoadout = false;
    UI.inGameSettings = false;
    // yükleme ekranı
    UI.hideAll();
    const map = G.MAPS[cfg.map];
    $('load-mode').textContent = MODE_LABEL(cfg);
    $('load-map').textContent = cfg.mode === 'story' ? G.STORY[cfg.mission].title : map ? map.name : '';
    $('load-tip').textContent = cfg.mode === 'story' ? G.STORY[cfg.mission].place : 'İpucu: ' + U.pick(TIPS);
    const art = $('load-art');
    art.dataset.shot = cfg.map;
    art.dataset.shotOn = '';
    art.style.backgroundImage = '';
    $('s-loading').hidden = false;
    UI.screen = 's-loading';
    applyShots($('s-loading'));
    G.state = 'loading';
    const token = (UI.loadToken = (UI.loadToken || 0) + 1);
    setTimeout(() => {
      if (token !== UI.loadToken) return;
      buildMatch(cfg);
    }, 60);
  };

  function buildMatch(cfg) {
    let m;
    try {
      m = new G.Match(cfg);
      m.start();
    } catch (e) {
      console.error(e);
      if (G.game) G.game.dispose();
      G.game = null;
      G.state = 'menu';
      UI.toast('Maç başlatılamadı: ' + e.message);
      UI.show('s-main');
      return;
    }
    UI.weaponsAtStart = JSON.parse(JSON.stringify(G.progress.data.weapons || {}));
    $('s-loading').hidden = true;
    UI.screen = null;
    document.body.classList.add('in-match');
    G.state = 'playing';
    G.input.captureGame = true;
    G.input.clear();
    G.touch.show(true);
    G.audio.music(cfg.mode === 'zm' || (cfg.mode === 'story' && G.STORY[cfg.mission].zombie) ? 'zm' : 'none');
    if (G.onResize) G.onResize();
  }

  UI.cleanupMatch = function () {
    UI.loadToken = (UI.loadToken || 0) + 1;
    if (G.game) G.game.dispose();
    G.game = null;
    G.hud.hide();
    G.touch.show(false);
  };

  UI.pause = function (silent) {
    if (G.state !== 'playing' || UI.paused) return;
    UI.paused = true;
    G.input.captureGame = false;
    G.input.clear();
    UI.releasing = true;
    G.releaseLock();
    setTimeout(() => (UI.releasing = false), 100);
    $('p-confirm').hidden = true;
    $('p-class').hidden = G.game && (G.game.mode === 'zm' || G.game.mode === 'online');
    if (!silent) UI.show('s-pause');
    G.touch.show(false);
  };

  UI.resume = function () {
    UI.paused = false;
    UI.inGameSettings = false;
    UI.inGameLoadout = false;
    UI.hideAll();
    G.input.captureGame = true;
    G.input.clear();
    if (!G.isTouch) G.requestLock();
    G.touch.show(true);
  };

  UI.quitToMenu = function () {
    UI.releasing = true;
    G.releaseLock();
    setTimeout(() => (UI.releasing = false), 100);
    UI.cleanupMatch();
    G.state = 'menu';
    UI.paused = false;
    UI.ending = false;
    UI.inGameLoadout = false;
    UI.inGameSettings = false;
    G.input.captureGame = false;
    G.audio.setMuffle(0);
    G.audio.music('menu');
    if (G.setGrade) G.setGrade(G.MAPS.liman.theme.grade);
    if (G.renderer) G.renderer.toneMappingExposure = G.MAPS.liman.theme.exposure || 1;
    UI.show('s-main');
  };

  function weaponGains() {
    const before = UI.weaponsAtStart || {};
    const now = G.progress.data.weapons || {};
    const out = [];
    for (const id in now) {
      const k0 = before[id] ? before[id].kills : 0;
      const x0 = before[id] ? before[id].xp : 0;
      if (now[id].kills > k0 && G.WEAPONS[id]) out.push({ id, kills: now[id].kills - k0, lv0: G.weaponLevel(x0).level, wl: G.weaponLevel(now[id].xp), camo: G.CAMOS.filter((c) => c.need > 0 && k0 < c.need && now[id].kills >= c.need).map((c) => c.name) });
    }
    return out.sort((a, b) => b.kills - a.kills).slice(0, 3);
  }

  UI.showEnd = function (res) {
    UI.ending = true;
    UI.releasing = true;
    G.releaseLock();
    setTimeout(() => (UI.releasing = false), 100);
    G.input.captureGame = false;
    G.touch.show(false);
    setTimeout(() => {
      G.state = 'ended';
      document.getElementById('h-death').hidden = true;
      document.getElementById('h-big').hidden = true;
      const el = $('s-end');
      el.querySelector('.end').classList.toggle('lose', !res.win);
      $('end-title').textContent = res.title;
      $('end-sub').textContent = res.sub || '';
      $('end-outro').innerHTML = (res.outro || []).map((l) => `<p>${esc(l)}</p>`).join('');
      const m = res.match;
      const p = m.player;
      let stats;
      if (res.zm) stats = [['Raunt', res.zm.round], ['Öldürme', res.zm.kills], ['Kafadan', res.zm.headshots], ['Puan', res.zm.points]];
      else stats = [['Skor', p.score], ['Öldürme', p.kills], ['Ölüm', p.deaths], ['Asist', p.assists]];
      $('end-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      const gains = weaponGains();
      $('end-daily').innerHTML =
        (gains.length
          ? `<h3 class="end-h">SİLAH İLERLEMESİ</h3><div class="end-weapons">${gains
              .map((g) => `<div>${wimg(g.id, 'thumb', '', null)}<div><b>${esc(G.WEAPONS[g.id].name)}</b><span class="muted small">+${g.kills} öldürme · Sv ${g.wl.level}${g.wl.level > g.lv0 ? ' ▲' : ''}${g.camo.length ? ' · Yeni kamuflaj: ' + esc(g.camo.join(', ')) : ''}</span><div class="xpbar"><i style="width:${pctOf(g.wl)}"></i></div></div></div>`)
              .join('')}</div>`
          : '') +
        `<h3 class="end-h">GÜNLÜK GÖREVLER</h3>` +
        G.progress.daily().map(chHtml).join('');
      $('end-xp').textContent = `+${res.xp} XP`;
      const lv = G.levelFromXp(G.profile.xp);
      $('end-xpbar').style.width = pctOf(lv);
      $('end-level').innerHTML = `<img class="mini-badge" alt="" src="${G.rankBadge(res.levelUp || lv.level)}"> ` + esc(res.levelUp ? `TERFİ! ${G.rankName(res.levelUp)} · Seviye ${res.levelUp}` : `${G.rankName(lv.level)} · Seviye ${lv.level}`);
      if (res.levelUp) G.audio.play('levelUp', { priority: true });
      const story = UI.lastCfg.mode === 'story';
      const hasNext = story && res.win && G.STORY_ORDER.indexOf(UI.lastCfg.mission) < G.STORY_ORDER.length - 1;
      $('end-next').hidden = !hasNext;
      $('end-again').textContent = story && res.win ? 'Görevi tekrar oyna' : 'Tekrar oyna';
      UI.show('s-end');
      lazyImages($('s-end'));
    }, res.zm ? 2200 : 1200);
  };
})();
