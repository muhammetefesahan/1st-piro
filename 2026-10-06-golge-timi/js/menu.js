'use strict';
// Gölge Timi — menüler: ana menü, hikâye, çok oyunculu, zombiler, online lobi,
// sınıflar & silah ustası, ayarlar (yaka fotoğrafı), duraklatma, bitiş.
(function () {
  const G = window.G;
  const U = G.util;
  const $ = (s) => document.getElementById(s);
  const esc = (s) => G.escapeHtml(s);

  const UI = (G.ui = { screen: null, paused: false, lo: { ci: 0, slot: 'primary' } });

  const TIPS = [
    'Koşarken C: kayma. Koşarken Z: dalış. Her yöne koşabilirsin.',
    'T ile çay iç: 30 saniye boyunca hasar +%25, daha hızlı şarjör ve yenilenme.',
    'H ile simit ye: anında +100 sağlık.',
    'G’yi basılı tutarak el bombasını pişir, sonra bırak.',
    'Susturucu takarsan ateş ettiğinde düşman haritasında görünmezsin.',
    'Zombilerde Çay Ocağı elektrik istemez; koridorda seni bekliyor.',
    'Engelin önünde Space: tırmanma. Sandıkların üstüne çıkabilirsin.',
    'Skor serileri 3-6 tuşlarıyla çağrılır: İHA, hava saldırısı, taret, helikopter.',
  ];

  UI.show = function (id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    UI.screen = id;
    const r = {
      's-main': renderMain,
      's-mp': renderMP,
      's-story': renderStory,
      's-zm': renderZM,
      's-online': renderOnline,
      's-loadout': renderLoadout,
      's-settings': renderSettings,
      's-help': renderHelp,
    }[id];
    if (r) r();
    if (id !== 's-online' && UI.lobbyTimer) {
      clearInterval(UI.lobbyTimer);
      UI.lobbyTimer = null;
    }
  };

  UI.hideAll = function () {
    for (const s of document.querySelectorAll('.screen')) s.hidden = true;
    UI.screen = null;
  };

  UI.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(() => (t.hidden = true), 2600);
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
      if (UI.inGameLoadout && id === 's-main') {
        UI.closeInGameLoadout();
        return;
      }
      if (UI.inGameSettings && id === 's-main') {
        UI.inGameSettings = false;
        UI.show('s-pause');
        return;
      }
      UI.show(id);
    });
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest('.menu-item, .btn')) G.audio.play('uiHover');
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
      if (G.state !== 'playing') return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && !G.input.locked) {
        if (UI.paused) UI.resume();
        else UI.pause();
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
  };

  // ------------------------------------------------------------------
  function renderMain() {
    const lv = G.levelFromXp(G.profile.xp);
    const rank = G.rankName(lv.level);
    $('main-rank').textContent = `${rank} · Sv ${lv.level}`;
    $('op-name').textContent = G.settings.callsign || 'Gölge-1';
    $('op-rank').textContent = `${rank} · Seviye ${lv.level}`;
    $('op-xp').style.width = lv.need ? (lv.cur / lv.need) * 100 + '%' : '100%';
    const pr = G.profile;
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
    $('mp-map').innerHTML = G.MP_MAPS.map((id) => `<button type="button" data-map="${id}" class="${c.map === id ? 'on' : ''}"><b>${G.MAPS[id].name}</b><span>${G.MAPS[id].desc}</span></button>`).join('');
    for (const b of $('mp-mode').querySelectorAll('button')) b.onclick = () => { c.mode = b.dataset.mode; renderMP(); };
    for (const b of $('mp-map').querySelectorAll('button')) b.onclick = () => { c.map = b.dataset.map; renderMP(); };
    const limits = c.mode === 'dom' ? [100, 150, 200] : c.mode === 'ffa' ? [15, 20, 30] : [30, 50, 75];
    $('mp-limit').innerHTML = limits.map((l, i) => `<option ${i === 1 ? 'selected' : ''}>${l}</option>`).join('');
    classOptions($('mp-class'));
  }

  // ------------------------------------------------------------------
  function renderStory() {
    $('story-prologue').innerHTML = '<h3>Önsöz</h3>' + G.STORY_PROLOGUE.map((p) => `<p>${esc(p)}</p>`).join('');
    const done = G.store.get('storyDone', {});
    let html = '';
    G.STORY_ORDER.forEach((id, i) => {
      const m = G.STORY[id];
      const unlocked = i === 0 || done[G.STORY_ORDER[i - 1]] || done[id];
      html += `<div class="mission ${unlocked ? '' : 'locked'} ${done[id] ? 'done' : ''}"><div class="num">${i + 1}</div><div><h4>${esc(m.title)}</h4><p>${esc(m.place)}</p></div>${unlocked ? `<button class="btn small" type="button" data-mission="${id}">Brifing</button>` : '<span class="muted small">Kilitli</span>'}</div>`;
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
    UI.show('s-brief');
  };

  function renderZM() {
    $('zm-best').textContent = G.profile.bestRound ? `Rekorun: ${G.profile.bestRound}. raunt · Toplam ${G.profile.zmKills} zombi` : 'Henüz rekorun yok.';
  }

  // ------------------------------------------------------------------
  // ONLINE
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
        return `<li class="${p.me ? 'me' : ''}">${isHost ? '<span class="crown" title="Ev sahibi">★</span>' : ''}<b>${esc(pr.n || 'Oyuncu')}</b><span class="muted small">Sv ${pr.lv || 1}${p.me ? ' · sen' : ''}${pr.ph === 'game' ? ' · maçta' : ''}${p.guest ? ' · misafir' : ''}</span></li>`;
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
  // SINIFLAR & SİLAH USTASI
  function renderLoadout() {
    const lo = UI.lo;
    lo.classes = G.getClasses();
    const cls = lo.classes[lo.ci];
    $('class-tabs').innerHTML = lo.classes.map((c, i) => `<button type="button" data-ci="${i}" class="${i === lo.ci ? 'on' : ''}">${i + 1}. ${esc(c.name)}</button>`).join('');
    for (const b of $('class-tabs').querySelectorAll('button')) b.onclick = () => { lo.ci = +b.dataset.ci; renderLoadout(); };
    const attSummary = (att) => {
      const n = Object.values(att || {}).filter((v) => v && v !== 'none').length;
      return n ? `${n} eklenti` : 'Eklentisiz';
    };
    const perkName = (id) => {
      for (const t of [1, 2, 3]) {
        const p = G.PERKS[t].find((x) => x.id === id);
        if (p) return p.name;
      }
      return '—';
    };
    const slot = (key, label, value, sub) => `<button type="button" class="slot ${lo.slot === key ? 'on' : ''}" data-slot="${key}"><small>${label}</small><b>${esc(value)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</button>`;
    $('class-slots').innerHTML = `
      <label class="field">Sınıf adı <input id="class-name" class="class-name" maxlength="18" value="${esc(cls.name)}"></label>
      ${slot('primary', 'Ana silah', G.WEAPONS[cls.primary].name, attSummary(cls.pAtt))}
      ${slot('secondary', 'Yan silah', G.WEAPONS[cls.secondary].name, attSummary(cls.sAtt))}
      ${slot('lethal', 'Öldürücü', G.LETHALS[cls.lethal].name)}
      ${slot('tactical', 'Taktik', G.TACTICALS[cls.tactical].name)}
      ${slot('perk1', 'Yetenek 1', perkName(cls.perks[0]))}
      ${slot('perk2', 'Yetenek 2', perkName(cls.perks[1]))}
      ${slot('perk3', 'Yetenek 3', perkName(cls.perks[2]))}
      ${UI.inGameLoadout ? '<button type="button" class="btn primary" id="lo-done">Oyuna dön</button>' : ''}`;
    $('class-name').oninput = (e) => {
      cls.name = e.target.value.slice(0, 18) || 'Sınıf';
      save();
      for (const b of $('class-tabs').querySelectorAll('button')) if (+b.dataset.ci === lo.ci) b.textContent = `${lo.ci + 1}. ${cls.name}`;
    };
    for (const b of $('class-slots').querySelectorAll('.slot')) b.onclick = () => { lo.slot = b.dataset.slot; renderLoadout(); };
    if ($('lo-done')) $('lo-done').onclick = () => UI.closeInGameLoadout();
    renderGunsmith(cls);
  }

  function save() {
    G.saveClasses(UI.lo.classes);
  }

  function renderGunsmith(cls) {
    const lo = UI.lo;
    const info = $('gun-info');
    const s = lo.slot;
    let html = '';
    if (s === 'primary' || s === 'secondary') {
      const cur = s === 'primary' ? cls.primary : cls.secondary;
      const attKey = s === 'primary' ? 'pAtt' : 'sAtt';
      const ids = Object.keys(G.WEAPONS).filter((id) => G.WEAPONS[id].slot === s && !G.WEAPONS[id].zmOnly);
      html += `<div class="pick-grid">${ids.map((id) => `<button type="button" data-w="${id}" class="${id === cur ? 'on' : ''}"><b>${esc(G.WEAPONS[id].name)}</b><span>${esc(G.WEAPONS[id].clsName)}</span></button>`).join('')}</div>`;
      const base = G.WEAPONS[cur];
      const att = cls[attKey] || {};
      for (const slotName of ['optic', 'muzzle', 'barrel', 'under', 'mag']) {
        if (!base.allowed.includes(slotName)) continue;
        let items = G.ATTACH[slotName].items;
        if (slotName === 'optic' && base.cls === 'shotgun') items = items.filter((i) => i.id !== 'durbun');
        if (slotName === 'optic' && base.cls === 'pistol') items = items.filter((i) => i.id === 'none' || i.id === 'kirmizi');
        const sel = att[slotName] || 'none';
        const item = items.find((i) => i.id === sel) || items[0];
        html += `<div class="att-row"><span>${G.ATTACH[slotName].label}</span><select data-att="${slotName}">${items.map((i) => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>${item.desc ? `<span class="att-desc">${esc(item.desc)}</span>` : ''}</div>`;
      }
      const st = G.computeStats(cur, att);
      const bars = G.statBars(st);
      html += `<div class="stat-bars">${Object.entries(bars).map(([k, v]) => `<div><span style="text-align:left;font-family:var(--ui);font-size:13px">${k}</span><i><b style="width:${v}%"></b></i><span>${v}</span></div>`).join('')}</div>`;
      html += `<p class="muted small">Şarjör ${st.mag} · Yedek ${st.reserve} · ${st.rpm} atış/dk · ${st.mode === 'auto' ? 'Otomatik' : st.mode === 'burst' ? '3’lü seri' : 'Tek atış'}</p>`;
      info.innerHTML = html;
      for (const b of info.querySelectorAll('[data-w]')) b.onclick = () => {
        if (s === 'primary') { cls.primary = b.dataset.w; cls.pAtt = {}; } else { cls.secondary = b.dataset.w; cls.sAtt = {}; }
        save();
        renderLoadout();
      };
      for (const sel of info.querySelectorAll('[data-att]')) sel.onchange = () => {
        cls[attKey] = Object.assign({}, cls[attKey], { [sel.dataset.att]: sel.value });
        save();
        renderLoadout();
      };
      UI.setPreview(st);
    } else if (s === 'lethal' || s === 'tactical') {
      const src = s === 'lethal' ? G.LETHALS : G.TACTICALS;
      html = `<div class="pick-grid">${Object.keys(src).map((id) => `<button type="button" data-e="${id}" class="${cls[s] === id ? 'on' : ''}"><b>${esc(src[id].name)}</b><span>${esc(src[id].desc)}</span></button>`).join('')}</div>`;
      info.innerHTML = html;
      for (const b of info.querySelectorAll('[data-e]')) b.onclick = () => { cls[s] = b.dataset.e; save(); renderLoadout(); };
      UI.setPreview(null);
    } else {
      const tier = +s.slice(4);
      html = `<div class="pick-grid">${G.PERKS[tier].map((p) => `<button type="button" data-p="${p.id}" class="${cls.perks[tier - 1] === p.id ? 'on' : ''}"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></button>`).join('')}</div>`;
      info.innerHTML = html;
      for (const b of info.querySelectorAll('[data-p]')) b.onclick = () => { cls.perks[tier - 1] = b.dataset.p; save(); renderLoadout(); };
      UI.setPreview(null);
    }
  }

  // Silah önizleme (ayrı küçük çizici)
  UI.setPreview = function (stats) {
    const cv = $('gun-preview');
    if (!stats) {
      cv.style.visibility = 'hidden';
      UI.prevGun = null;
      return;
    }
    cv.style.visibility = 'visible';
    if (!UI.prev) {
      try {
        const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
        r.setPixelRatio(1);
        r.setSize(240, 120, false);
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x303028, 1.1));
        const d = new THREE.DirectionalLight(0xffffff, 0.9);
        d.position.set(1, 2, 1);
        sc.add(d);
        const cam = new THREE.PerspectiveCamera(30, 2, 0.05, 20);
        cam.position.set(-1.6, 0.35, 0);
        cam.lookAt(0, 0.02, -0.08);
        UI.prev = { r, sc, cam };
      } catch (e) {
        UI.prev = null;
        return;
      }
    }
    if (UI.prevGun) UI.prev.sc.remove(UI.prevGun);
    const g = G.buildGun(stats);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const holder = new THREE.Group();
    g.position.sub(c);
    holder.add(g);
    holder.scale.setScalar(0.9 / size);
    UI.prev.sc.add(holder);
    UI.prevGun = holder;
  };
  UI.updatePreview = function (dt) {
    if (!UI.prev || !UI.prevGun || UI.screen !== 's-loadout') return;
    UI.prevGun.rotation.y += dt * 0.6;
    UI.prev.r.render(UI.prev.sc, UI.prev.cam);
  };

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
  // AYARLAR
  function renderSettings() {
    const s = G.settings;
    const slider = (key, label, min, max, step, fmt) => `<label class="field">${label} <span class="range-val" id="v-${key}">${fmt ? fmt(s[key]) : s[key]}</span><input type="range" id="set-${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const toggle = (key, label) => `<label class="toggle"><input type="checkbox" id="set-${key}" ${s[key] ? 'checked' : ''}> ${label}</label>`;
    const pct = (v) => Math.round(v * 100) + '%';
    $('settings-body').innerHTML = `
      <div class="panel"><h3>Görüntü</h3>
        ${slider('pixel', 'Piksel boyutu', 1, 5, 1, (v) => (v === 1 ? 'Kapalı' : v + 'x'))}
        ${toggle('outline', 'Piksel kontur çizgileri')}
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
    $('set-quality').value = s.quality;
    for (const key of ['pixel', 'levels', 'fov', 'sens', 'adsSens', 'touchSens', 'master', 'sfx', 'music']) {
      const el = $('set-' + key);
      el.oninput = () => {
        s[key] = +el.value;
        const fmt = { pixel: (v) => (v === 1 ? 'Kapalı' : v + 'x'), fov: (v) => v + '°', master: pct, sfx: pct, music: pct, sens: (v) => (+v).toFixed(2), adsSens: (v) => (+v).toFixed(2), touchSens: (v) => (+v).toFixed(2) }[key];
        $('v-' + key).textContent = fmt ? fmt(s[key]) : s[key];
        G.saveSettings();
        G.audio.applyVolumes();
        if (key === 'pixel' || key === 'levels') G.onResize && G.onResize();
      };
    }
    for (const key of ['outline', 'showFps', 'invertY', 'toggleAds', 'announcer']) {
      const el = $('set-' + key);
      el.onchange = () => {
        s[key] = el.checked;
        G.saveSettings();
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
      e.target.textContent = 'Sıfırlandı';
    };
  }

  // ------------------------------------------------------------------
  function renderHelp() {
    const k = (keys, what) => `<span>${keys.map((x) => `<kbd>${x}</kbd>`).join(' ')}</span><span>${what}</span>`;
    $('help-body').innerHTML = `
      <div class="panel"><h3>Hareket</h3><div class="keys">
        ${k(['W', 'A', 'S', 'D'], 'Hareket')}
        ${k(['Shift'], 'Koş (her yöne). İki kez bas: taktik koşu')}
        ${k(['Space'], 'Zıpla · engelin önünde tırman')}
        ${k(['C'], 'Çömel · koşarken: kayma')}
        ${k(['Z'], 'Yüzüstü yat · koşarken: dalış')}
      </div></div>
      <div class="panel"><h3>Savaş</h3><div class="keys">
        ${k(['Sol tık'], 'Ateş')}
        ${k(['Sağ tık'], 'Nişan al')}
        ${k(['R'], 'Şarjör değiştir')}
        ${k(['1', '2', 'Y', 'Tekerlek'], 'Silah değiştir')}
        ${k(['V'], 'Bıçak')}
        ${k(['G'], 'Öldürücü (basılı tut: pişir)')}
        ${k(['Q'], 'Taktik ekipman')}
        ${k(['3', '4', '5', '6'], 'Skor serileri')}
      </div></div>
      <div class="panel"><h3>Bizden</h3><div class="keys">
        ${k(['T'], 'Çay iç: 30 sn hasar +%25, hızlı şarjör, hızlı yenilenme')}
        ${k(['H'], 'Simit ye: +100 sağlık')}
        ${k(['F', 'E'], 'Etkileşim (kapı, kutu, makine, görev)')}
        ${k(['Tab'], 'Skor tablosu')}
        ${k(['Esc', 'P'], 'Duraklat')}
        ${k(['L'], 'Poligonda sınıf düzenle')}
      </div></div>
      <div class="panel"><h3>Modlar</h3>
        <p><b>Hikâye:</b> Kızıl Pençe’nin çaldığı virüsün peşinde beş görev. Telsizden Yüzbaşı Arda ve Çaycı Rıza konuşur.</p>
        <p><b>Online:</b> Aynı oda kodunu giren oyuncular gerçek zamanlı karşılaşır.</p>
        <p><b>Çok oyunculu:</b> Takım Ölüm Maçı, Bölge Kontrolü ve Herkes Tek; botlara karşı. Skor serileri açık.</p>
        <p><b>Zombiler:</b> Puan topla, kapıları aç, gücü aç, silahını Dönüştürücü’de güçlendir.</p>
      </div>`;
  }

  // ------------------------------------------------------------------
  // MAÇ AKIŞI
  UI.startMatch = function (cfg) {
    G.audio.init();
    if (!G.isTouch) G.requestLock();
    UI.cleanupMatch();
    UI.lastCfg = cfg;
    UI.hideAll();
    UI.paused = false;
    UI.ending = false;
    let m;
    try {
      m = new G.Match(cfg);
      m.start();
    } catch (e) {
      console.error(e);
      UI.toast('Maç başlatılamadı: ' + e.message);
      UI.show('s-main');
      return;
    }
    G.state = 'playing';
    G.input.captureGame = true;
    G.input.clear();
    G.touch.show(true);
    G.audio.music(cfg.mode === 'zm' || (cfg.mode === 'story' && G.STORY[cfg.mission].zombie) ? 'zm' : 'none');
  };

  UI.cleanupMatch = function () {
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
    G.input.captureGame = false;
    G.audio.setMuffle(0);
    G.audio.music('menu');
    UI.show('s-main');
  };

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
      $('end-xp').textContent = `+${res.xp} XP`;
      const lv = G.levelFromXp(G.profile.xp);
      $('end-xpbar').style.width = lv.need ? (lv.cur / lv.need) * 100 + '%' : '100%';
      $('end-level').textContent = res.levelUp ? `TERFİ! ${G.rankName(res.levelUp)} · Seviye ${res.levelUp}` : `${G.rankName(lv.level)} · Seviye ${lv.level}`;
      if (res.levelUp) G.audio.play('levelUp', { priority: true });
      const story = UI.lastCfg.mode === 'story';
      const hasNext = story && res.win && G.STORY_ORDER.indexOf(UI.lastCfg.mission) < G.STORY_ORDER.length - 1;
      $('end-next').hidden = !hasNext;
      $('end-again').textContent = story && res.win ? 'Görevi tekrar oyna' : 'Tekrar oyna';
      UI.show('s-end');
    }, res.zm ? 2200 : 1200);
  };
})();
