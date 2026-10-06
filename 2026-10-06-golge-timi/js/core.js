'use strict';
// Gölge Timi — ortak yardımcılar, ayarlar, kalıcı profil ve girdi yönetimi.
(function () {
  const G = (window.G = window.G || {});

  const U = (G.util = {
    DEG: Math.PI / 180,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    gauss() {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    fmtTime(s) {
      s = Math.max(0, Math.ceil(s));
      const m = Math.floor(s / 60);
      return m + ':' + String(s % 60).padStart(2, '0');
    },
    $: (sel, root) => (root || document).querySelector(sel),
    $$: (sel, root) => Array.from((root || document).querySelectorAll(sel)),
    el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    },
    // Deterministik rastgele (doku üretimi için)
    seeded(seed) {
      let s = seed >>> 0 || 1;
      return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return (s >>> 0) / 4294967296;
      };
    },
  });

  // ---- Kalıcı depolama (her zaman try/catch ile) ----
  G.store = {
    get(k, def) {
      try {
        const v = localStorage.getItem('golgeTimi.' + k);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('golgeTimi.' + k, JSON.stringify(v));
      } catch (e) { /* depolama yoksa sessizce geç */ }
    },
  };

  const SETTINGS_DEFAULT = {
    sens: 1.0,
    adsSens: 0.8,
    fov: 78,
    master: 0.8,
    sfx: 0.9,
    music: 0.35,
    quality: 'yuksek',
    invertY: false,
    toggleAds: false,
    showFps: false,
    announcer: true,
    callsign: 'Gölge-1',
    touchSens: 1.0,
    pixel: 1,
    outline: true,
    levels: 64,
    bloom: true,
    photo: false,
    photoCaption: '',
    operator: 'kurt',
  };
  G.settings = Object.assign({}, SETTINGS_DEFAULT, G.store.get('settings', {}));
  if ((G.settings.v || 0) < 2) {
    // sürüm 2: daha keskin piksel varsayılanları
    G.settings.pixel = 2;
    G.settings.levels = 32;
    G.settings.v = 2;
  }
  G.saveSettings = () => G.store.set('settings', G.settings);
  G.SETTINGS_DEFAULT = SETTINGS_DEFAULT;

  const PROFILE_DEFAULT = {
    xp: 0, kills: 0, deaths: 0, wins: 0, matches: 0, headshots: 0,
    bestRound: 0, zmKills: 0, rangeBest: 0,
  };
  G.profile = Object.assign({}, PROFILE_DEFAULT, G.store.get('profile', {}));
  G.saveProfile = () => G.store.set('profile', G.profile);

  // ---- Girdi ----
  const BINDS = {
    fwd: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    crouch: ['KeyC'],
    prone: ['KeyZ'],
    reload: ['KeyR'],
    use: ['KeyF', 'KeyE'],
    melee: ['KeyV'],
    lethal: ['KeyG'],
    tactical: ['KeyQ'],
    w1: ['Digit1'],
    w2: ['Digit2'],
    swap: ['KeyY'],
    s1: ['Digit3'],
    s2: ['Digit4'],
    s3: ['Digit5'],
    s4: ['Digit6'],
    score: ['Tab'],
    pause: ['KeyP', 'Escape'],
    fire: ['mouse0'],
    ads: ['mouse2'],
    loadout: ['KeyL'],
    cay: ['KeyT'],
    inspect: ['KeyI'],
    simit: ['KeyH'],
  };
  const BINDS_DEFAULT = JSON.parse(JSON.stringify(BINDS));
  // Oyuncunun değiştirdiği tuşlar (yalnızca klavye eylemleri)
  if (G.settings.binds && typeof G.settings.binds === 'object') {
    for (const a in G.settings.binds) {
      const v = G.settings.binds[a];
      if (BINDS[a] && Array.isArray(v) && v.length && v.every((c) => typeof c === 'string')) BINDS[a] = v.slice(0, 2);
    }
  }
  // Bir eylemi yeni tuşa bağlar; aynı tuş başka eylemdeyse oradan alır ve o eylemin adını döndürür
  G.setBind = function (action, code) {
    if (!BINDS[action]) return null;
    let taken = null;
    for (const a in BINDS) {
      if (a === action) continue;
      const i = BINDS[a].indexOf(code);
      if (i >= 0) {
        BINDS[a] = BINDS[a].filter((c) => c !== code);
        taken = a;
      }
    }
    BINDS[action] = [code];
    const saved = {};
    for (const a in BINDS) if (JSON.stringify(BINDS[a]) !== JSON.stringify(BINDS_DEFAULT[a])) saved[a] = BINDS[a];
    G.settings.binds = saved;
    G.saveSettings();
    return taken && !BINDS[taken].length ? taken : null;
  };
  G.resetBinds = function () {
    for (const a in BINDS_DEFAULT) BINDS[a] = BINDS_DEFAULT[a].slice();
    G.settings.binds = {};
    G.saveSettings();
  };

  const Input = (G.input = {
    binds: BINDS,
    keys: Object.create(null),
    hits: Object.create(null),
    touch: Object.create(null),
    touchHits: Object.create(null),
    dx: 0,
    dy: 0,
    wheel: 0,
    locked: false,
    captureGame: false, // oyun sırasında tuşları yut
    down(action) {
      if (this.touch[action]) return true;
      const codes = BINDS[action];
      if (!codes) return false;
      for (let i = 0; i < codes.length; i++) if (this.keys[codes[i]]) return true;
      return false;
    },
    hit(action) {
      if (this.touchHits[action]) return true;
      const codes = BINDS[action];
      if (!codes) return false;
      for (let i = 0; i < codes.length; i++) if (this.hits[codes[i]]) return true;
      return false;
    },
    tapTouch(action) {
      this.touchHits[action] = true;
    },
    endFrame() {
      for (const k in this.hits) delete this.hits[k];
      for (const k in this.touchHits) delete this.touchHits[k];
      this.dx = 0;
      this.dy = 0;
      this.wheel = 0;
    },
    clear() {
      for (const k in this.keys) delete this.keys[k];
      for (const k in this.touch) delete this.touch[k];
      this.endFrame();
    },
  });

  const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF']);

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (!Input.keys[e.code]) Input.hits[e.code] = true;
    Input.keys[e.code] = true;
    if (Input.captureGame && GAME_KEYS.has(e.code)) e.preventDefault();
    if (G.onKey) G.onKey(e);
  });
  window.addEventListener('keyup', (e) => {
    Input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => Input.clear());

  document.addEventListener('mousedown', (e) => {
    const code = 'mouse' + e.button;
    if (!Input.keys[code]) Input.hits[code] = true;
    Input.keys[code] = true;
  });
  document.addEventListener('mouseup', (e) => {
    Input.keys['mouse' + e.button] = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!Input.captureGame) return;
    if (Input.locked || G.mouseFallback) {
      const mx = e.movementX || 0;
      const my = e.movementY || 0;
      // Bazı tarayıcılar kilit anında devasa sıçrama verir
      if (Math.abs(mx) < 400 && Math.abs(my) < 400) {
        Input.dx += mx;
        Input.dy += my;
      }
    }
  });
  document.addEventListener(
    'wheel',
    (e) => {
      if (Input.captureGame) {
        Input.wheel += Math.sign(e.deltaY);
      }
    },
    { passive: true }
  );
  document.addEventListener('contextmenu', (e) => {
    if (Input.captureGame) e.preventDefault();
  });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = !!document.pointerLockElement;
    if (G.onPointerLockChange) G.onPointerLockChange(Input.locked);
  });

  G.requestLock = function () {
    const c = G.canvas;
    if (!c || !c.requestPointerLock) {
      G.mouseFallback = true;
      return;
    }
    try {
      const p = c.requestPointerLock();
      if (p && p.catch) p.catch(() => { G.mouseFallback = true; });
    } catch (e) {
      G.mouseFallback = true;
    }
  };
  G.releaseLock = function () {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (e) { /* yoksay */ }
  };

  G.isTouch = (() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    } catch (e) {
      return false;
    }
  })();
  // Telefon / tablet (dokunmatik ve küçük ekran): kalite ve düzen varsayılanları buna göre
  G.isMobile = (() => {
    try {
      return G.isTouch && Math.min(screen.width, screen.height) < 900;
    } catch (e) {
      return G.isTouch;
    }
  })();

  // Sürüm 3: sevimli (tatlı) görünüm varsayılanları — piksel efekti kapalı, telefonda orta kalite
  if ((G.settings.v || 0) < 3) {
    G.settings.pixel = 1;
    G.settings.levels = 64;
    G.settings.outline = true;
    G.settings.bloom = true;
    if (G.isMobile) G.settings.quality = 'orta';
    G.settings.v = 3;
    G.saveSettings();
  }

  // Basit olay yayıcı
  const listeners = {};
  G.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  G.emit = (name, a, b, c) => {
    const l = listeners[name];
    if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c);
  };

  G.time = 0; // oyun zamanı (sn)
})();
