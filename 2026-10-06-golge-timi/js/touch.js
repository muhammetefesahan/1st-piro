'use strict';
// Gölge Timi — dokunmatik kontroller: sol analog çubuk, sağda bakış alanı,
// ateş (sürükleyerek nişan), nişan alma ve eylem tuşları.
(function () {
  const G = window.G;
  const IN = G.input;
  const T = (G.touch = { built: false });

  function btn(label, action, cls, mode) {
    const b = document.createElement('div');
    b.className = 't-btn ' + (cls || '');
    b.textContent = label;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', label);
    let lastX = 0, lastY = 0, pid = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pid = e.pointerId;
      try { b.setPointerCapture(pid); } catch (er) { /* yoksay */ }
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === 'toggle') {
        IN.touch[action] = !IN.touch[action];
        b.classList.toggle('on', !!IN.touch[action]);
        IN.touchHits[action] = true;
      } else {
        IN.touch[action] = true;
        IN.touchHits[action] = true;
        b.classList.add('on');
      }
      G.audio.init();
    });
    b.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid || action !== 'fire') return;
      IN.dx += (e.clientX - lastX) * 1.5 * G.settings.touchSens;
      IN.dy += (e.clientY - lastY) * 1.5 * G.settings.touchSens;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (mode !== 'toggle') {
        IN.touch[action] = false;
        b.classList.remove('on');
      }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  }

  T.build = function () {
    if (T.built) return;
    T.built = true;
    const root = document.getElementById('touch');
    // bakış alanı
    const look = document.createElement('div');
    look.className = 't-look';
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', (e) => {
      lid = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      try { look.setPointerCapture(lid); } catch (er) { /* yoksay */ }
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      IN.dx += (e.clientX - lx) * 1.5 * G.settings.touchSens;
      IN.dy += (e.clientY - ly) * 1.5 * G.settings.touchSens;
      lx = e.clientX;
      ly = e.clientY;
    });
    const lup = (e) => { if (e.pointerId === lid) lid = null; };
    look.addEventListener('pointerup', lup);
    look.addEventListener('pointercancel', lup);
    root.appendChild(look);
    // analog çubuk
    const stick = document.createElement('div');
    stick.className = 't-stick';
    const knob = document.createElement('div');
    knob.className = 't-knob';
    stick.appendChild(knob);
    let sid = null;
    const setStick = (e) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      knob.style.transform = `translate(${dx * r.width * 0.35}px, ${dy * r.height * 0.35}px)`;
      IN.touch.moveX = dx;
      IN.touch.moveY = -dy;
      IN.touch.sprint = l > 0.95 && -dy > 0.5;
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sid = e.pointerId;
      try { stick.setPointerCapture(sid); } catch (er) { /* yoksay */ }
      setStick(e);
      G.audio.init();
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
    const sup = (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      knob.style.transform = '';
      IN.touch.moveX = null;
      IN.touch.moveY = null;
      IN.touch.sprint = false;
    };
    stick.addEventListener('pointerup', sup);
    stick.addEventListener('pointercancel', sup);
    root.appendChild(stick);
    // tuşlar
    root.appendChild(btn('ATEŞ', 'fire', 'fire'));
    const grid = document.createElement('div');
    grid.className = 't-btns';
    const list = [
      ['NİŞAN', 'ads', '', 'toggle'],
      ['ZIPLA', 'jump'],
      ['ÇÖMEL\nKAY', 'crouch'],
      ['YAT\nDAL', 'prone'],
      ['ŞARJÖR', 'reload'],
      ['SİLAH', 'swap'],
      ['BOMBA', 'lethal'],
      ['TAKTİK', 'tactical'],
      ['BIÇAK', 'melee'],
      ['ÇAY', 'cay'],
      ['SİMİT', 'simit'],
      ['ETKİ-\nLEŞİM', 'use'],
    ];
    for (const [l, a, c, m] of list) grid.appendChild(btn(l, a, c, m));
    root.appendChild(grid);
    const top = document.createElement('div');
    top.className = 't-top';
    top.appendChild(btn('SKOR', 'score'));
    const menu = btn('MENÜ', 'pausebtn');
    menu.addEventListener('pointerdown', () => G.ui && G.ui.pause());
    top.appendChild(menu);
    root.appendChild(top);
  };

  T.show = function (on) {
    if (!G.isTouch) return;
    T.build();
    document.getElementById('touch').hidden = !on;
    if (!on) {
      for (const k in IN.touch) IN.touch[k] = k === 'moveX' || k === 'moveY' ? null : false;
    }
  };
})();
