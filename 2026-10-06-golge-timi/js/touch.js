'use strict';
// Gölge Timi — dokunmatik kontroller (sevimli baloncuk tuşlar):
//  - solda yüzen analog çubuk (başparmağın değdiği yerde belirir, kenara itince koşar)
//  - sağda sürükleyerek bakış alanı, büyük ATEŞ tuşu (basılıyken sürükleyerek nişan)
//  - nişan, şarjör, zıpla, çömel/kay, yat/dal, bomba (basılı tut = pişir), taktik,
//    silah değiştir, bıçak, çay, simit; yalnızca gerektiğinde ETKİLEŞİM ve seri tuşları
//  - üstte skor ve duraklatma; ayarlar paneli (boyut, opaklık, hassasiyet, otomatik ateş,
//    jiroskop, titreşim, solak düzen); tam ekran, yatay kilit, ekranı açık tutma.
// Tüm görünüm mobile.css içinde (body.touch …).
(function () {
  const G = window.G;
  const IN = G.input;
  const T = (G.touch = { built: false, shown: false });

  // ---------------- Simgeler (SVG, 48x48) ----------------
  const S = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;
  const ICON = {
    fire: S('<circle cx="24" cy="24" r="13"/><circle class="f" cx="24" cy="24" r="4"/><path d="M24 4v7M24 37v7M4 24h7M37 24h7"/>'),
    ads: S('<path d="M5 24c5-8 11.5-12 19-12s14 4 19 12c-5 8-11.5 12-19 12S10 32 5 24z"/><circle class="f" cx="24" cy="24" r="6"/><circle class="w" cx="26.5" cy="21.5" r="2"/>'),
    reload: S('<path d="M37 17a14 14 0 1 0 2 11"/><path class="f" d="M39 8v11H28z"/>'),
    jump: S('<path d="M13 25l11-11 11 11"/><path d="M13 36l11-11 11 11" opacity=".55"/>'),
    crouch: S('<path d="M13 13l11 11 11-11"/><path d="M12 35h24"/>'),
    prone: S('<circle class="f" cx="10" cy="30" r="4.5"/><path d="M17 31h20l5-4M18 37h22"/>'),
    lethal: S('<circle class="f" cx="22" cy="29" r="12"/><path d="M28 17l4-5"/><path class="w" d="M34 6l2 3 3-1-1 3 3 2-3 1 0 3-2-2-3 2 0-3-3-1 3-2z" stroke-width="1.5"/><circle class="w" cx="17" cy="25" r="3" stroke="none"/>'),
    tactical: S('<path class="f" d="M27 4L11 27h11l-3 17 18-25H25z"/>'),
    swap: S('<path d="M10 17h26M30 10l7 7-7 7"/><path d="M38 31H12M18 24l-7 7 7 7"/>'),
    melee: S('<path class="f" d="M33 6c4 1 7 4 8 8L21 32l-6-6z"/><path d="M15 26l6 6M12 37l4-4M9 40l3-3"/>'),
    cay: S('<path class="f" d="M15 12h18c0 4-3 6-3 11s4 7 3 13H15c-1-6 3-8 3-13s-3-7-3-11z"/><path d="M9 41h30"/><path class="st" d="M20 3c-2 2 2 3 0 6M28 3c-2 2 2 3 0 6" stroke-width="2.5"/>'),
    simit: S('<circle cx="24" cy="25" r="13" stroke-width="7"/><circle class="w" cx="15" cy="20" r="1.4" stroke="none"/><circle class="w" cx="24" cy="13.5" r="1.4" stroke="none"/><circle class="w" cx="33" cy="20" r="1.4" stroke="none"/><circle class="w" cx="34" cy="31" r="1.4" stroke="none"/><circle class="w" cx="24" cy="37" r="1.4" stroke="none"/><circle class="w" cx="14" cy="31" r="1.4" stroke="none"/>'),
    use: S('<path class="f" d="M19 23V9a3.5 3.5 0 0 1 7 0v11l8 1.5c3 .6 5 3.2 4.5 6.3L37 37c-.5 3-3 5-6 5H24c-2 0-3.8-1-5-2.6l-7-9.4a3.3 3.3 0 0 1 5-4.2z"/>'),
    score: S('<path d="M10 14h28M10 24h28M10 34h28"/><circle class="f" cx="6" cy="14" r="1.6"/><circle class="f" cx="6" cy="24" r="1.6"/><circle class="f" cx="6" cy="34" r="1.6"/>'),
    pause: S('<path d="M17 12v24M31 12v24" stroke-width="7"/>'),
    run: S('<circle class="f" cx="29" cy="9" r="4.5"/><path d="M20 19l8-3 4 9 7 3M27 17l-5 12-8 4M22 29l7 5-2 9"/>'),
  };

  const LABEL = {
    fire: 'ATEŞ', ads: 'NİŞAN', reload: 'ŞARJÖR', jump: 'ZIPLA', crouch: 'ÇÖMEL', prone: 'YAT',
    lethal: 'BOMBA', tactical: 'TAKTİK', swap: 'SİLAH', melee: 'BIÇAK', cay: 'ÇAY', simit: 'SİMİT',
    use: 'KULLAN', score: 'SKOR', pause: 'MENÜ',
  };

  const $ = (id) => document.getElementById(id);
  const sens = () => 1.5 * (G.settings.touchSens || 1);
  const audioInit = () => {
    try {
      G.audio.init();
    } catch (e) { /* yoksay */ }
  };

  // ---------------- Tuş ----------------
  // mode: 'hold' (basılıyken açık), 'toggle' (dokun aç/kapa), 'tap' (yalnızca dokunuş)
  function btn(action, cls, mode, onDown) {
    const b = document.createElement('div');
    b.className = 't-btn t-' + action + (cls ? ' ' + cls : '');
    b.dataset.a = action;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', LABEL[action] || action);
    b.innerHTML = `<i class="t-ico">${ICON[action] || ''}</i><span class="t-lbl">${LABEL[action] || ''}</span>`;
    let lastX = 0, lastY = 0, pid = null;
    const drag = action === 'fire';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pid != null) return;
      pid = e.pointerId;
      try {
        b.setPointerCapture(pid);
      } catch (er) { /* yoksay */ }
      lastX = e.clientX;
      lastY = e.clientY;
      const targeting = !!(G.streaks && G.streaks.targeting);
      if (mode === 'toggle' && !(targeting && action === 'ads')) {
        IN.touch[action] = !IN.touch[action];
        IN.touchHits[action] = true;
      } else if (mode === 'tap' || mode === 'toggle' || (action === 'fire' && targeting)) {
        // hava saldırısı hedeflemesinde ATEŞ yalnızca onaylar (silah taramasın),
        // NİŞAN yalnızca vazgeçer (nişan açık kalmasın)
        IN.touchHits[action] = true;
      } else {
        IN.touch[action] = true;
        IN.touchHits[action] = true;
      }
      b.classList.add('down');
      G.haptic && G.haptic(action === 'fire' ? 7 : 5);
      if (onDown) onDown(e);
      audioInit();
      T.sessionGesture();
    });
    b.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid || !drag) return;
      IN.dx += (e.clientX - lastX) * sens();
      IN.dy += (e.clientY - lastY) * sens();
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      b.classList.remove('down');
      if (mode !== 'toggle' && mode !== 'tap') IN.touch[action] = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b._release = () => {
      pid = null;
      b.classList.remove('down');
    };
    return b;
  }

  function badge(b) {
    const s = document.createElement('b');
    s.className = 't-badge';
    b.appendChild(s);
    return s;
  }

  // ---------------- Kurulum ----------------
  const el = {};
  T.build = function () {
    if (T.built) return;
    T.built = true;
    const root = $('touch');
    if (!root) return;
    root.innerHTML = '';
    root.classList.add('t-root');

    // --- bakış alanı (sağ) ---
    const look = document.createElement('div');
    look.className = 't-look';
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (lid != null) return;
      lid = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      try {
        look.setPointerCapture(lid);
      } catch (er) { /* yoksay */ }
      audioInit();
      T.sessionGesture();
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      IN.dx += (e.clientX - lx) * sens();
      IN.dy += (e.clientY - ly) * sens();
      lx = e.clientX;
      ly = e.clientY;
    });
    const lup = (e) => {
      if (e.pointerId === lid) lid = null;
    };
    look.addEventListener('pointerup', lup);
    look.addEventListener('pointercancel', lup);
    look.addEventListener('lostpointercapture', lup);
    root.appendChild(look);
    el.look = look;

    // --- yüzen analog çubuk (sol) ---
    const zone = document.createElement('div');
    zone.className = 't-zone';
    const stick = document.createElement('div');
    stick.className = 't-stick';
    stick.innerHTML = `<div class="t-ring"></div><div class="t-knob"><i class="t-run">${ICON.run}</i></div><i class="t-arrow"></i>`;
    const knob = stick.querySelector('.t-knob');
    zone.appendChild(stick);
    root.appendChild(zone);
    el.zone = zone;
    el.stick = stick;
    let sid = null, ox = 0, oy = 0, R = 60, zl = 0, zt = 0;
    // ox/oy: çubuk merkezi (ekran koordinatı); stil, bölgeye göre yerel konum ister
    const placeStick = (x, y) => {
      ox = x;
      oy = y;
      stick.style.left = x - zl + 'px';
      stick.style.top = y - zt + 'px';
    };
    const setStick = (e) => {
      let dx = (e.clientX - ox) / R, dy = (e.clientY - oy) / R;
      let l = Math.hypot(dx, dy);
      // parmak çok uzaklaşırsa çubuk tabanı peşinden gelir (yüzen çubuk)
      if (l > 1.35) {
        const k = (l - 1.35) / l;
        placeStick(ox + dx * k * R, oy + dy * k * R);
        dx = (e.clientX - ox) / R;
        dy = (e.clientY - oy) / R;
        l = Math.hypot(dx, dy);
      }
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      const m = Math.min(1, l);
      knob.style.transform = `translate(${dx * R * 0.62}px, ${dy * R * 0.62}px)`;
      // ölü bölge + yumuşak geçiş
      const dead = 0.12;
      const out = m < dead ? 0 : (m - dead) / (1 - dead);
      const n = m > 0 ? out / m : 0;
      IN.touch.moveX = dx * n;
      IN.touch.moveY = -dy * n;
      stick.style.setProperty('--ang', Math.atan2(dx, -dy) + 'rad');
      stick.classList.toggle('moving', m > dead);
      // kenara itilince (ileri yönde) otomatik koşu
      const sprint = l >= 0.97 && -dy > 0.45;
      if (sprint !== !!IN.touch.sprint) {
        IN.touch.sprint = sprint;
        stick.classList.toggle('sprint', sprint);
        if (sprint) G.haptic && G.haptic(10);
      }
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (sid != null) return;
      sid = e.pointerId;
      try {
        zone.setPointerCapture(sid);
      } catch (er) { /* yoksay */ }
      const zr = zone.getBoundingClientRect();
      zl = zr.left;
      zt = zr.top;
      stick.classList.add('active');
      R = Math.max(30, stick.getBoundingClientRect().width / 2);
      // tabanı başparmağın değdiği yere taşı (ekran kenarından taşmasın)
      const x = Math.min(zr.right - R * 0.9, Math.max(zr.left + R * 0.9, e.clientX));
      const y = Math.min(zr.bottom - R * 0.9, Math.max(zr.top + R * 0.9, e.clientY));
      placeStick(x, y);
      setStick(e);
      audioInit();
      T.sessionGesture();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === sid) setStick(e);
    });
    const sup = (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      resetStick();
    };
    const resetStick = () => {
      knob.style.transform = '';
      stick.classList.remove('active', 'sprint', 'moving');
      stick.style.left = '';
      stick.style.top = '';
      IN.touch.moveX = null;
      IN.touch.moveY = null;
      IN.touch.sprint = false;
    };
    T._resetStick = () => {
      sid = null;
      resetStick();
    };
    zone.addEventListener('pointerup', sup);
    zone.addEventListener('pointercancel', sup);
    zone.addEventListener('lostpointercapture', sup);

    // --- sağ küme ---
    const pad = document.createElement('div');
    pad.className = 't-pad';
    const add = (b) => {
      pad.appendChild(b);
      el[b.dataset.a] = b;
      return b;
    };
    add(btn('fire', 'big'));
    add(btn('ads', '', 'toggle'));
    add(btn('reload', '', 'tap'));
    add(btn('jump', '', 'hold'));
    add(btn('crouch', '', 'hold'));
    add(btn('prone', '', 'hold'));
    add(btn('lethal', '', 'hold'));
    add(btn('tactical', '', 'tap'));
    add(btn('swap', 'pill', 'tap'));
    add(btn('melee', '', 'tap'));
    add(btn('cay', 'mini', 'tap'));
    add(btn('simit', 'mini', 'tap'));
    add(btn('use', 'ctx', 'hold'));
    el.lethalN = badge(el.lethal);
    el.tacticalN = badge(el.tactical);
    el.cayN = badge(el.cay);
    el.simitN = badge(el.simit);
    el.useCost = badge(el.use);
    el.swapImg = document.createElement('img');
    el.swapImg.className = 't-wimg';
    el.swapImg.alt = '';
    el.swap.appendChild(el.swapImg);
    // bombayı pişirme halkası
    const cook = document.createElement('i');
    cook.className = 't-cook';
    el.lethal.appendChild(cook);
    root.appendChild(pad);
    el.pad = pad;

    // --- skor serileri (yalnızca hazır olanlar) ---
    const st = document.createElement('div');
    st.className = 't-streaks';
    root.appendChild(st);
    el.streaks = st;
    el.streakBtns = [];

    // --- üst: skor + menü ---
    const top = document.createElement('div');
    top.className = 't-top';
    const sc = btn('score', 'small', 'toggle');
    const menu = btn('pause', 'small', 'tap', () => {
      setTimeout(() => G.ui && G.ui.pause(), 0);
    });
    top.appendChild(sc);
    top.appendChild(menu);
    el.score = sc;
    root.appendChild(top);

    // --- hava saldırısı ipucu ---
    const hint = document.createElement('div');
    hint.className = 't-hint';
    hint.hidden = true;
    root.appendChild(hint);
    el.hint = hint;

    T.applyPrefs();
    hookHaptics();
  };

  // ---------------- Ayarları uygula ----------------
  T.applyPrefs = function () {
    const root = $('touch');
    if (!root) return;
    const s = G.settings;
    // --ts gövdeye yazılır: hem dokunmatik katman hem HUD yerleşimi aynı birimi kullanır
    document.body.style.setProperty('--ts', String(Math.max(0.6, Math.min(1.5, +s.touchSize || 1))));
    root.style.setProperty('--to', String(Math.max(0.25, Math.min(1, +s.touchOpacity || 0.9))));
    document.body.classList.toggle('touch-left', !!s.touchLeft);
    updateGyro();
  };

  // ---------------- Kare güncellemesi (yalnızca görünürken) ----------------
  const prev = {};
  function setCls(node, cls, on, key) {
    const k = key || cls + (node.dataset.a || '');
    if (prev[k] === on) return;
    prev[k] = on;
    node.classList.toggle(cls, on);
  }
  function setText(node, txt, key) {
    if (prev[key] === txt) return;
    prev[key] = txt;
    node.textContent = txt;
  }
  function tick() {
    if (!T.shown) {
      T.raf = 0;
      return;
    }
    T.raf = requestAnimationFrame(tick);
    const m = G.game;
    const p = m && m.player;
    const root = $('touch');
    if (!p || !root) return;
    const alive = !!p.alive;
    setCls(root, 'dead', !alive, 'dead');
    if (!alive) {
      // ölünce nişan / koşu bırakılır
      if (IN.touch.ads) IN.touch.ads = false;
      return;
    }
    // koşu başlarken nişan kapanır
    if (IN.touch.sprint && IN.touch.ads && p.adsT < 0.3) {
      IN.touch.ads = false;
      if (G.settings.toggleAds) IN.touchHits.ads = true;
    }
    setCls(el.ads, 'on', !!IN.touch.ads);
    setCls(el.score, 'on', !!IN.touch.score);
    setCls(el.crouch, 'on', !!p.crouching || p.slideT > 0);
    setCls(el.prone, 'on', !!p.prone);
    setCls(el.fire, 'auto', !!p.autoFireOn);
    // sayılar
    setText(el.lethalN, String(p.lethalCount | 0), 'ln');
    setText(el.tacticalN, String(p.tacticalCount | 0), 'tn');
    setText(el.cayN, String(p.cay | 0), 'cn');
    setText(el.simitN, String(p.simit | 0), 'sn');
    setCls(el.lethal, 'empty', !(p.lethalCount > 0));
    setCls(el.tactical, 'empty', !(p.tacticalCount > 0));
    setCls(el.cay, 'empty', !(p.cay > 0));
    setCls(el.simit, 'empty', !(p.simit > 0));
    // bomba pişirme
    const ck = p.cook ? Math.min(1, (G.time - p.cook.start) / 3.15) : 0;
    const ckr = Math.round(ck * 40) / 40;
    if (prev.cook !== ckr) {
      prev.cook = ckr;
      el.lethal.style.setProperty('--cook', String(ckr));
      setCls(el.lethal, 'cooking', ck > 0, 'cooking');
    }
    // şarjör: az mermi uyarısı
    const w = p.weapon;
    const lowAmmo = !!(w && w.stats && w.ammo <= Math.max(1, Math.floor(w.stats.mag * 0.25)) && w.reserve > 0);
    setCls(el.reload, 'alert', lowAmmo && !p.reload);
    setCls(el.reload, 'on', !!p.reload);
    // silah değiştir: diğer silahın silüeti
    const other = p.weapons[p.cur === 0 ? 1 : 0];
    const oid = other ? other.id : '';
    if (prev.swap !== oid) {
      prev.swap = oid;
      let src = '';
      if (oid && G.weaponImage) {
        try {
          src = G.weaponImage(oid, 'icon') || '';
        } catch (e) {
          src = '';
        }
      }
      if (src) el.swapImg.src = src;
      el.swap.classList.toggle('has-img', !!src);
      el.swap.classList.toggle('none', !oid);
    }
    // etkileşim tuşu: yalnızca bir şey varsa
    const it = p.interaction;
    setCls(el.use, 'show', !!it, 'use');
    if (it) {
      const cost = it.cost ? String(it.cost) : '';
      setText(el.useCost, cost, 'uc');
      setCls(el.useCost, 'none', !cost, 'ucn');
      setCls(el.use, 'hold', !!it.hold, 'uh');
    } else if (IN.touch.use) {
      IN.touch.use = false;
    }
    // skor serileri
    updateStreaks(m);
    // hava saldırısı hedefleme ipucu
    const tgt = !!(G.streaks && G.streaks.targeting);
    if (prev.tgt !== tgt) {
      prev.tgt = tgt;
      el.hint.hidden = !tgt;
      el.hint.innerHTML = tgt ? '<b>ATEŞ</b> ile hedefi onayla · <b>NİŞAN</b> ile vazgeç' : '';
      root.classList.toggle('targeting', tgt);
    }
  }

  function updateStreaks(m) {
    const box = el.streaks;
    const on = !!(m.streaksEnabled && G.STREAKS && G.streaks);
    let key = '';
    if (on) for (let i = 0; i < G.STREAKS.length; i++) key += (G.streaks.inventory[i] || 0) > 0 ? '1' : '0';
    if (prev.streaks === key) return;
    prev.streaks = key;
    box.innerHTML = '';
    if (!on) return;
    G.STREAKS.forEach((d, i) => {
      if (!((G.streaks.inventory[i] || 0) > 0)) return;
      const b = document.createElement('div');
      b.className = 't-btn t-streak';
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', d.name);
      let ic = '';
      try {
        ic = G.itemIcon ? G.itemIcon(d.id) : '';
      } catch (e) {
        ic = '';
      }
      b.innerHTML = `${ic ? `<img alt="" src="${ic}">` : `<i class="t-ico">${ICON.fire}</i>`}<span class="t-lbl">${d.name}</span>`;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        G.haptic && G.haptic([12, 30, 12]);
        G.streaks.activate(i);
      });
      box.appendChild(b);
    });
    if (key.indexOf('1') >= 0) G.haptic && G.haptic([10, 40, 10]);
  }

  // ---------------- Titreşim kancaları (hud.js'e dokunmadan sarmalar) ----------------
  function hookHaptics() {
    const H = G.hud;
    if (!H || H._hapticHooked) return;
    H._hapticHooked = true;
    if (typeof H.hitmarker === 'function') {
      const orig = H.hitmarker;
      H.hitmarker = function (kill, head, ent) {
        try {
          if (G.haptic) {
            if (kill) G.haptic([16, 40, 30], true);
            else if (head) G.haptic(14);
            else G.haptic(7);
          }
        } catch (e) { /* yoksay */ }
        return orig.apply(this, arguments);
      };
    }
    if (typeof H.damageFrom === 'function') {
      const orig = H.damageFrom;
      H.damageFrom = function () {
        try {
          if (G.haptic) G.haptic(28);
        } catch (e) { /* yoksay */ }
        return orig.apply(this, arguments);
      };
    }
  }

  // ---------------- Jiroskop ----------------
  const gyro = { on: false, last: 0, ux: 0, uy: 0, uz: 1 };
  function onMotion(e) {
    if (!T.shown || !G.game || !G.game.player) return;
    const mode = gyroMode();
    if (mode === 'off') return;
    const p = G.game.player;
    if (mode === 'ads' && !(p.adsT > 0.4)) {
      gyro.last = 0;
      return;
    }
    const rr = e.rotationRate;
    const ag = e.accelerationIncludingGravity;
    if (!rr) return;
    const now = performance.now();
    const dt = gyro.last ? Math.min(0.1, (now - gyro.last) / 1000) : 0;
    gyro.last = now;
    if (!dt) return;
    // yukarı vektörü (yerçekimi) yumuşatılmış; dönüş hızının dikey bileşeni = sağa/sola dönüş
    if (ag && ag.x != null) {
      const l = Math.hypot(ag.x, ag.y, ag.z) || 1;
      const k = 0.15;
      gyro.ux += (ag.x / l - gyro.ux) * k;
      gyro.uy += (ag.y / l - gyro.uy) * k;
      gyro.uz += (ag.z / l - gyro.uz) * k;
    }
    const wx = rr.beta || 0, wy = rr.gamma || 0, wz = rr.alpha || 0; // °/sn (cihaz x, y, z)
    const ul = Math.hypot(gyro.ux, gyro.uy, gyro.uz) || 1;
    const yawRate = (wx * gyro.ux + wy * gyro.uy + wz * gyro.uz) / ul;
    // ekranın sağ yönü (yönelime göre) etrafında dönüş = yukarı/aşağı bakış
    let ang = 0;
    try {
      ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    } catch (er) {
      ang = 0;
    }
    ang = ((ang % 360) + 360) % 360;
    const rx = ang === 90 ? 0 : ang === 270 ? 0 : ang === 180 ? -1 : 1;
    const ry = ang === 90 ? -1 : ang === 270 ? 1 : 0;
    const pitchRate = wx * rx + wy * ry;
    const DEG = Math.PI / 180;
    // küçük titremeleri yut
    const dz = (v) => (Math.abs(v) < 0.6 ? 0 : v);
    IN.gyroYaw += dz(yawRate) * dt * DEG;
    IN.gyroPitch += dz(pitchRate) * dt * DEG;
  }
  function gyroMode() {
    const g = G.settings.touchGyro;
    if (g === true) return 'on';
    return g === 'ads' || g === 'on' ? g : 'off';
  }
  function updateGyro() {
    const want = gyroMode() !== 'off' && T.shown;
    if (want === gyro.on) return;
    gyro.on = want;
    gyro.last = 0;
    try {
      if (want) window.addEventListener('devicemotion', onMotion);
      else window.removeEventListener('devicemotion', onMotion);
    } catch (e) { /* yoksay */ }
  }
  // iOS: izin yalnızca dokunuşla istenebilir
  T.requestGyro = function () {
    try {
      const DM = window.DeviceMotionEvent;
      if (DM && typeof DM.requestPermission === 'function') {
        return DM.requestPermission().then((r) => r === 'granted').catch(() => false);
      }
      return Promise.resolve(!!DM);
    } catch (e) {
      return Promise.resolve(false);
    }
  };

  // ---------------- Oturum: tam ekran, yatay kilit, ekranı açık tut ----------------
  let wakeLock = null, sessionTried = false;
  function tryFullscreen() {
    if (!G.isMobile) return;
    try {
      const d = document;
      const fs = d.fullscreenElement || d.webkitFullscreenElement;
      const lock = () => {
        try {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        } catch (e) { /* yoksay */ }
      };
      if (fs) {
        lock();
        return;
      }
      const el0 = d.documentElement;
      const req = el0.requestFullscreen || el0.webkitRequestFullscreen;
      if (!req) return;
      const r = req.call(el0, { navigationUI: 'hide' });
      if (r && r.then) r.then(lock).catch(() => {});
      else lock();
    } catch (e) { /* yoksay */ }
  }
  function wakeOn() {
    try {
      if (wakeLock || !navigator.wakeLock || document.hidden) return;
      navigator.wakeLock.request('screen').then((s) => {
        wakeLock = s;
        s.addEventListener && s.addEventListener('release', () => {
          if (wakeLock === s) wakeLock = null;
        });
      }).catch(() => {});
    } catch (e) { /* yoksay */ }
  }
  function wakeOff() {
    try {
      if (wakeLock) wakeLock.release().catch(() => {});
    } catch (e) { /* yoksay */ }
    wakeLock = null;
  }
  T.inMatch = () => !!(G.game && (G.state === 'playing' || G.state === 'ended'));
  // dokunmatik katmanda ilk dokunuş (kullanıcı hareketi): tam ekran yeniden denenebilir
  T.sessionGesture = function () {
    if (sessionTried) return;
    sessionTried = true;
    tryFullscreen();
    wakeOn();
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && T.inMatch()) wakeOn();
  });

  // ---------------- Göster / gizle ----------------
  T.show = function (on) {
    if (!G.isTouch) return;
    T.build();
    const root = $('touch');
    if (!root) return;
    root.hidden = !on;
    T.shown = !!on;
    if (IN.releaseTouch) IN.releaseTouch();
    if (T._resetStick) T._resetStick();
    for (const k in el) if (el[k] && el[k]._release) el[k]._release();
    for (const k in prev) delete prev[k];
    updateGyro();
    if (on) {
      hookHaptics();
      T.applyPrefs();
      if (!T.raf) T.raf = requestAnimationFrame(tick);
      // maç başı: tam ekran + yatay kilit (dokunuşla başladıysa izinli), ekran açık
      sessionTried = false;
      tryFullscreen();
      wakeOn();
      if (G.onResize) setTimeout(() => G.onResize && G.onResize(), 350);
    } else {
      // menüye dönülünce ekranı açık tutmayı bırak (duraklatmada sürer)
      setTimeout(() => {
        if (!T.shown && (!G.game || G.state !== 'playing')) wakeOff();
      }, 0);
    }
  };

  // ---------------- Ayarlar paneli ----------------
  T.settingsPanel = function () {
    if (!G.isTouch) return '';
    const s = G.settings;
    const pct = (v) => Math.round(v * 100) + '%';
    const slider = (key, label, min, max, step, fmt) => `<label class="field">${label} <span class="range-val" id="tv-${key}">${fmt(+s[key])}</span><input type="range" id="tset-${key}" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const toggle = (key, label) => `<label class="toggle"><input type="checkbox" id="tset-${key}" data-k="${key}" ${s[key] ? 'checked' : ''}> ${label}</label>`;
    const gm = gyroMode();
    const seg = (v, l) => `<button type="button" class="btn small${gm === v ? ' t-on' : ''}" data-gyro="${v}" aria-pressed="${gm === v}">${l}</button>`;
    return `<div class="panel t-settings"><h3>Dokunmatik</h3>
      ${slider('touchSize', 'Tuş boyutu', 0.7, 1.4, 0.05, pct)}
      ${slider('touchOpacity', 'Tuş opaklığı', 0.3, 1, 0.05, pct)}
      ${slider('touchSens', 'Bakış hassasiyeti', 0.3, 3, 0.05, (v) => v.toFixed(2))}
      ${toggle('touchAutoFire', 'Otomatik ateş (nişangâh düşmanın üstündeyken)')}
      <div class="field t-gyro">Jiroskopla nişan <div class="t-seg" role="group" aria-label="Jiroskop">${seg('off', 'Kapalı')}${seg('ads', 'Nişandayken')}${seg('on', 'Her zaman')}</div></div>
      ${slider('gyroSens', 'Jiroskop hassasiyeti', 0.3, 3, 0.05, (v) => v.toFixed(2))}
      ${toggle('haptics', 'Titreşim (vuruş, hasar, öldürme)')}
      ${toggle('touchLeft', 'Solak düzen (çubuk sağda, tuşlar solda)')}
      <p class="muted small t-set-note" id="tset-note"></p>
      <button type="button" class="btn small" id="tset-reset">Dokunmatik ayarları sıfırla</button>
    </div>`;
  };

  T.bindSettingsPanel = function (root) {
    if (!root || !G.isTouch) return;
    const s = G.settings;
    const fmts = { touchSize: (v) => Math.round(v * 100) + '%', touchOpacity: (v) => Math.round(v * 100) + '%', touchSens: (v) => v.toFixed(2), gyroSens: (v) => v.toFixed(2) };
    for (const inp of root.querySelectorAll('.t-settings input[type=range]')) {
      inp.oninput = () => {
        const k = inp.dataset.k;
        s[k] = +inp.value;
        const v = root.querySelector('#tv-' + k);
        if (v) v.textContent = fmts[k] ? fmts[k](s[k]) : s[k];
        // menüdeki eş kaydırıcı (Kontrol paneli) varsa onu da güncelle
        if (k === 'touchSens') {
          const o = document.getElementById('set-touchSens'), ov = document.getElementById('v-touchSens');
          if (o) o.value = s[k];
          if (ov) ov.textContent = s[k].toFixed(2);
        }
        G.saveSettings();
        T.applyPrefs();
      };
    }
    // Kontrol panelindeki eş kaydırıcı değişirse bizimkini de güncelle
    const twin = document.getElementById('set-touchSens');
    if (twin) {
      twin.addEventListener('input', () => {
        const o = root.querySelector('#tset-touchSens'), ov = root.querySelector('#tv-touchSens');
        if (o) o.value = s.touchSens;
        if (ov) ov.textContent = (+s.touchSens).toFixed(2);
      });
    }
    for (const inp of root.querySelectorAll('.t-settings input[type=checkbox]')) {
      inp.onchange = () => {
        s[inp.dataset.k] = inp.checked;
        G.saveSettings();
        T.applyPrefs();
        if (inp.dataset.k === 'haptics' && inp.checked && G.haptic) G.haptic([20, 40, 20], true);
      };
    }
    const note = root.querySelector('#tset-note');
    const segs = root.querySelectorAll('.t-settings [data-gyro]');
    const setSeg = (v) => {
      for (const b of segs) {
        const on = b.dataset.gyro === v;
        b.classList.toggle('t-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    };
    for (const b of segs) {
      b.onclick = () => {
        const v = b.dataset.gyro;
        if (v === 'off') {
          s.touchGyro = 'off';
          G.saveSettings();
          setSeg(v);
          T.applyPrefs();
          return;
        }
        // izin isteği doğrudan bu dokunuştan yapılmalı (iOS)
        T.requestGyro().then((ok) => {
          if (!ok || !('DeviceMotionEvent' in window)) {
            if (note) note.textContent = 'Bu cihaz jiroskop iznini vermedi ya da desteklemiyor.';
            s.touchGyro = 'off';
            setSeg('off');
          } else {
            if (note) note.textContent = '';
            s.touchGyro = v;
            setSeg(v);
          }
          G.saveSettings();
          T.applyPrefs();
        });
      };
    }
    const rs = root.querySelector('#tset-reset');
    if (rs) {
      rs.onclick = () => {
        const D = G.SETTINGS_DEFAULT || {};
        for (const k of ['touchSize', 'touchOpacity', 'touchSens', 'touchAutoFire', 'touchGyro', 'gyroSens', 'haptics', 'touchLeft']) if (k in D) s[k] = D[k];
        G.saveSettings();
        T.applyPrefs();
        for (const inp of root.querySelectorAll('.t-settings input')) {
          const k = inp.dataset.k;
          if (inp.type === 'checkbox') inp.checked = !!s[k];
          else {
            inp.value = s[k];
            const v = root.querySelector('#tv-' + k);
            if (v) v.textContent = fmts[k] ? fmts[k](+s[k]) : s[k];
          }
        }
        setSeg(gyroMode());
        if (G.ui && G.ui.toast) G.ui.toast('Dokunmatik ayarlar sıfırlandı');
      };
    }
  };

  // ---------------- Yakınlaştırma / uzun basma / yenileme engelleri ----------------
  if (G.isTouch) {
    const isField = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable]');
    // iki parmakla yakınlaştırma (iOS gesture* + çoklu dokunuş)
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    // çift dokunuşla yakınlaştırma
    let lastEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = e.timeStamp || performance.now();
      if (now - lastEnd < 300 && !isField(e.target) && e.target && e.target.closest && e.target.closest('#touch')) e.preventDefault();
      lastEnd = now;
    }, { passive: false });
    document.addEventListener('dblclick', (e) => {
      if (!isField(e.target)) e.preventDefault();
    });
    // uzun basma menüsü
    document.addEventListener('contextmenu', (e) => {
      if (!isField(e.target)) e.preventDefault();
    });
    document.addEventListener('selectstart', (e) => {
      if (!isField(e.target)) e.preventDefault();
    });
    // yön değişince düzeni hemen yenile (döndürme ipucu dahil)
    const reflow = () => setTimeout(() => G.onResize && G.onResize(), 120);
    window.addEventListener('orientationchange', reflow);
    try {
      if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', reflow);
    } catch (e) { /* yoksay */ }
    if (document.body) document.body.classList.add('touch');
    else document.addEventListener('DOMContentLoaded', () => document.body.classList.add('touch'));
  }
})();
