'use strict';
// Gölge Timi — Web Audio ile tamamen sentezlenen sesler (dosya yok).
(function () {
  const G = window.G;
  const U = G.util;

  const A = (G.audio = {
    ctx: null,
    voices: 0,
    listener: { x: 0, y: 0, z: 0, yaw: 0 },
    muffle: 0,
    loops: {},
  });

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
    } catch (e) {
      return;
    }
    const ctx = A.ctx;
    A.master = ctx.createGain();
    A.comp = ctx.createDynamicsCompressor();
    A.comp.threshold.value = -14;
    A.comp.ratio.value = 4;
    A.muffleFilter = ctx.createBiquadFilter();
    A.muffleFilter.type = 'lowpass';
    A.muffleFilter.frequency.value = 20000;
    A.sfx = ctx.createGain();
    A.musicBus = ctx.createGain();
    A.sfx.connect(A.muffleFilter);
    A.muffleFilter.connect(A.comp);
    A.musicBus.connect(A.comp);
    A.comp.connect(A.master);
    A.master.connect(ctx.destination);
    // gürültü tamponları
    const len = ctx.sampleRate * 2;
    A.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = A.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
    A.applyVolumes();
  };

  A.applyVolumes = function () {
    if (!A.ctx) return;
    const s = G.settings;
    A.master.gain.value = s.master;
    A.sfx.gain.value = s.sfx;
    A.musicBus.gain.value = s.music;
  };

  A.setMuffle = function (amount) {
    if (!A.ctx) return;
    if (Math.abs(amount - A.muffle) < 0.02) return;
    A.muffle = amount;
    A.muffleFilter.frequency.setTargetAtTime(20000 - amount * 18800, A.ctx.currentTime, 0.1);
  };

  // ---- Yapı taşları ----
  function out(opts) {
    // opts.pos varsa uzamsal zincir oluşturur
    const ctx = A.ctx;
    const g = ctx.createGain();
    let node = g;
    let vol = opts && opts.vol != null ? opts.vol : 1;
    if (opts && opts.pos) {
      const L = A.listener;
      const dx = opts.pos.x - L.x, dy = opts.pos.y - L.y, dz = opts.pos.z - L.z;
      const dist = Math.hypot(dx, dy, dz);
      const ref = opts.ref || 10;
      vol *= 1 / (1 + Math.pow(dist / ref, 1.3));
      if (vol < 0.012) return null;
      // dinleyici yönüne göre sağ/sol
      const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
      const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
      const side = dist > 0.01 ? (dx * rx + dz * rz) / dist : 0;
      const front = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = U.clamp(side * 0.85, -1, 1);
        g.connect(p);
        node = p;
      }
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = U.clamp(20000 / (1 + dist / 18) * (front < -0.3 ? 0.7 : 1), 500, 20000);
      node.connect(lp);
      node = lp;
    }
    g.gain.value = vol;
    node.connect(opts && opts.bus ? opts.bus : A.sfx);
    return g;
  }

  function track(src, dur) {
    A.voices++;
    src.onended = () => {
      A.voices--;
    };
  }

  function noiseHit(dest, t, o) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = o.brown ? A.brown : A.noise;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.sweep || o.dur));
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    const a = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.5, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    const total = a + o.dur + 0.05;
    const off = Math.random() * Math.max(0, 1.95 - total);
    src.start(t, off, total);
    track(src);
  }

  function tone(dest, t, o) {
    const ctx = A.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.wave || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t + (o.sweep || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + a);
    if (o.hold) g.gain.setValueAtTime(o.gain || 0.3, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (o.hold || 0) + o.dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.ff || 1000;
      f.Q.value = o.fq || 1;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + a + (o.hold || 0) + o.dur + 0.05);
    track(osc);
    return osc;
  }

  // ---- Silah sesleri ----
  const GUN = {
    ar: { lp: 3600, lp1: 700, dur: 0.14, thump: 150, tail: 0.5, crack: 0.25, gain: 0.85 },
    ar2: { lp: 3000, lp1: 500, dur: 0.17, thump: 115, tail: 0.6, crack: 0.22, gain: 0.95 },
    ar3: { lp: 4200, lp1: 800, dur: 0.12, thump: 170, tail: 0.45, crack: 0.25, gain: 0.8 },
    smg: { lp: 5200, lp1: 1200, dur: 0.08, thump: 210, tail: 0.3, crack: 0.2, gain: 0.7 },
    smg2: { lp: 6000, lp1: 1500, dur: 0.06, thump: 240, tail: 0.25, crack: 0.18, gain: 0.62 },
    shotgun: { lp: 2600, lp1: 300, dur: 0.32, thump: 85, tail: 0.9, crack: 0.3, gain: 1.15 },
    sniper: { lp: 3800, lp1: 260, dur: 0.3, thump: 70, tail: 1.4, crack: 0.5, gain: 1.15 },
    dmr: { lp: 3600, lp1: 400, dur: 0.2, thump: 95, tail: 0.9, crack: 0.35, gain: 1.0 },
    lmg: { lp: 3200, lp1: 600, dur: 0.15, thump: 120, tail: 0.6, crack: 0.25, gain: 0.95 },
    pistol: { lp: 5000, lp1: 1000, dur: 0.09, thump: 230, tail: 0.35, crack: 0.2, gain: 0.7 },
    magnum: { lp: 3400, lp1: 400, dur: 0.22, thump: 100, tail: 0.9, crack: 0.4, gain: 1.05 },
    turret: { lp: 4500, lp1: 900, dur: 0.07, thump: 190, tail: 0.25, crack: 0.15, gain: 0.6 },
    ar4: { lp: 4600, lp1: 900, dur: 0.11, thump: 175, tail: 0.42, crack: 0.22, gain: 0.78 },
    bullpup: { lp: 4000, lp1: 760, dur: 0.12, thump: 160, tail: 0.48, crack: 0.26, gain: 0.82 },
    ak: { lp: 2700, lp1: 420, dur: 0.18, thump: 105, tail: 0.7, crack: 0.3, gain: 1.0 },
    smg3: { lp: 5600, lp1: 1300, dur: 0.07, thump: 220, tail: 0.28, crack: 0.18, gain: 0.66 },
    smg4: { lp: 4800, lp1: 1100, dur: 0.08, thump: 200, tail: 0.3, crack: 0.2, gain: 0.68 },
    smg5: { lp: 6400, lp1: 1700, dur: 0.05, thump: 260, tail: 0.22, crack: 0.16, gain: 0.6 },
    shotgun2: { lp: 3000, lp1: 380, dur: 0.26, thump: 95, tail: 0.7, crack: 0.28, gain: 1.05 },
    shotgun3: { lp: 2200, lp1: 240, dur: 0.38, thump: 70, tail: 1.1, crack: 0.34, gain: 1.25 },
    dmr2: { lp: 3200, lp1: 340, dur: 0.22, thump: 88, tail: 1.0, crack: 0.38, gain: 1.05 },
    sniper50: { lp: 2600, lp1: 160, dur: 0.42, thump: 52, tail: 1.8, crack: 0.6, gain: 1.35 },
    sniper2: { lp: 3600, lp1: 300, dur: 0.26, thump: 80, tail: 1.2, crack: 0.45, gain: 1.1 },
    lmg2: { lp: 2900, lp1: 480, dur: 0.17, thump: 100, tail: 0.7, crack: 0.28, gain: 1.0 },
    lmg3: { lp: 3800, lp1: 700, dur: 0.13, thump: 140, tail: 0.5, crack: 0.24, gain: 0.88 },
    mpistol: { lp: 5800, lp1: 1500, dur: 0.06, thump: 250, tail: 0.24, crack: 0.16, gain: 0.6 },
    pistol45: { lp: 4200, lp1: 700, dur: 0.12, thump: 160, tail: 0.5, crack: 0.26, gain: 0.85 },
    heli: { lp: 3000, lp1: 600, dur: 0.1, thump: 120, tail: 0.4, crack: 0.2, gain: 0.8 },
  };

  A.shot = function (kind, pos, opts) {
    if (!A.ctx) return;
    const o = opts || {};
    const isPlayer = !!o.player;
    if (!isPlayer && A.voices > 60) return;
    const t = A.ctx.currentTime;
    if (kind === 'rocket') {
      const d = out({ pos: isPlayer ? null : pos, vol: 0.9, ref: 14 });
      if (!d) return;
      noiseHit(d, t, { type: 'bandpass', f0: 300, f1: 1800, dur: 0.7, gain: 0.8, q: 1.2 });
      tone(d, t, { f0: 120, f1: 40, dur: 0.3, gain: 0.7 });
      return;
    }
    if (kind === 'crossbow') {
      const d = out({ pos: isPlayer ? null : pos, vol: 0.7, ref: 6 });
      if (!d) return;
      tone(d, t, { wave: 'triangle', f0: 180, f1: 90, dur: 0.18, gain: 0.35 });
      noiseHit(d, t, { type: 'bandpass', f0: 1800, f1: 600, dur: 0.12, gain: 0.3, q: 2 });
      return;
    }
    if (kind === 'flare' || kind === 'gl') {
      const d = out({ pos: isPlayer ? null : pos, vol: 0.85, ref: 12 });
      if (!d) return;
      tone(d, t, { f0: kind === 'gl' ? 110 : 220, f1: 50, dur: 0.18, gain: 0.8 });
      noiseHit(d, t, { type: 'lowpass', f0: kind === 'gl' ? 900 : 2400, f1: 200, dur: 0.25, gain: 0.6 });
      if (kind === 'flare') noiseHit(d, t + 0.05, { type: 'highpass', f0: 3000, dur: 0.6, gain: 0.15, attack: 0.05 });
      return;
    }
    if (kind === 'frost') {
      const d = out({ pos: isPlayer ? null : pos, vol: 0.7 });
      if (!d) return;
      tone(d, t, { wave: 'sine', f0: 2600, f1: 700, dur: 0.3, gain: 0.2 });
      tone(d, t, { wave: 'triangle', f0: 3900, f1: 2200, dur: 0.2, gain: 0.12 });
      noiseHit(d, t, { type: 'highpass', f0: 5000, dur: 0.25, gain: 0.25 });
      return;
    }
    if (kind === 'plasma') {
      const d = out({ pos: isPlayer ? null : pos, vol: 0.7 });
      if (!d) return;
      tone(d, t, { wave: 'square', f0: 1400, f1: 180, dur: 0.22, gain: 0.25, filter: 'lowpass', ff: 3000 });
      tone(d, t, { wave: 'sine', f0: 600, f1: 2400, dur: 0.15, gain: 0.25 });
      noiseHit(d, t, { type: 'bandpass', f0: 2500, dur: 0.12, gain: 0.25, q: 3 });
      return;
    }
    const p = GUN[kind] || GUN.ar;
    if (o.suppressed) {
      const d = out({ pos: isPlayer ? null : pos, vol: isPlayer ? 0.7 : 0.45, ref: 4 });
      if (!d) return;
      noiseHit(d, t, { type: 'highpass', f0: 1400, dur: 0.06, gain: 0.5 });
      tone(d, t, { f0: p.thump * 1.6, f1: 60, dur: 0.06, gain: 0.35 });
      noiseHit(d, t + 0.01, { type: 'bandpass', f0: 3500, dur: 0.03, gain: 0.25, q: 4 });
      return;
    }
    const d = out({ pos: isPlayer ? null : pos, vol: (isPlayer ? 1 : 0.85) * p.gain, ref: 16 });
    if (!d) return;
    const pitch = 1 + (Math.random() - 0.5) * 0.08;
    noiseHit(d, t, { type: 'lowpass', f0: p.lp * pitch, f1: p.lp1, dur: p.dur, gain: 0.9 });
    tone(d, t, { f0: p.thump * pitch, f1: 38, dur: p.dur * 0.9, gain: 0.8 });
    if (isPlayer || !pos) noiseHit(d, t, { type: 'highpass', f0: 2600, dur: 0.035, gain: p.crack });
    noiseHit(d, t + 0.02, { type: 'lowpass', f0: 900, f1: 200, dur: p.tail, gain: 0.22, brown: true, attack: 0.02 });
  };

  // ---- Genel ses efektleri ----
  const FX = {
    hit(d, t) {
      tone(d, t, { wave: 'square', f0: 1900, dur: 0.035, gain: 0.12, filter: 'bandpass', ff: 2200, fq: 2 });
      noiseHit(d, t, { type: 'highpass', f0: 4000, dur: 0.02, gain: 0.15 });
    },
    headshot(d, t) {
      tone(d, t, { wave: 'triangle', f0: 3100, dur: 0.28, gain: 0.18 });
      tone(d, t, { wave: 'sine', f0: 4650, dur: 0.18, gain: 0.08 });
      noiseHit(d, t, { type: 'highpass', f0: 5000, dur: 0.03, gain: 0.2 });
    },
    kill(d, t) {
      tone(d, t, { wave: 'triangle', f0: 880, dur: 0.08, gain: 0.16 });
      tone(d, t + 0.07, { wave: 'triangle', f0: 1320, dur: 0.14, gain: 0.16 });
    },
    armor(d, t) {
      tone(d, t, { wave: 'square', f0: 700, dur: 0.05, gain: 0.08, filter: 'lowpass', ff: 1500 });
    },
    step(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 350 + Math.random() * 250, dur: 0.07, gain: 0.35, brown: true });
      noiseHit(d, t + 0.01, { type: 'bandpass', f0: 1800, dur: 0.03, gain: 0.05, q: 2 });
    },
    land(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 300, dur: 0.15, gain: 0.6, brown: true });
      tone(d, t, { f0: 90, f1: 40, dur: 0.12, gain: 0.35 });
    },
    slide(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 900, f1: 400, dur: 0.6, gain: 0.3, q: 0.8, attack: 0.04 });
    },
    magOut(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 1800, dur: 0.04, gain: 0.35, q: 3 });
      tone(d, t, { wave: 'square', f0: 520, dur: 0.03, gain: 0.08 });
    },
    magIn(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 1300, dur: 0.05, gain: 0.45, q: 3 });
      noiseHit(d, t + 0.06, { type: 'bandpass', f0: 2400, dur: 0.03, gain: 0.35, q: 4 });
    },
    bolt(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 3000, f1: 900, dur: 0.1, gain: 0.35, q: 2 });
      noiseHit(d, t + 0.14, { type: 'bandpass', f0: 1500, dur: 0.05, gain: 0.4, q: 3 });
    },
    pump(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 1100, f1: 700, dur: 0.08, gain: 0.45, q: 2 });
      noiseHit(d, t + 0.16, { type: 'bandpass', f0: 1600, dur: 0.06, gain: 0.45, q: 2 });
    },
    shell(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 2100, dur: 0.04, gain: 0.35, q: 3 });
    },
    empty(d, t) {
      noiseHit(d, t, { type: 'highpass', f0: 3000, dur: 0.02, gain: 0.3 });
    },
    swap(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 900, dur: 0.14, gain: 0.18, q: 0.6, attack: 0.03 });
      noiseHit(d, t + 0.12, { type: 'bandpass', f0: 2000, dur: 0.04, gain: 0.2, q: 3 });
    },
    melee(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 500, f1: 2400, dur: 0.18, gain: 0.35, q: 1.5, attack: 0.02 });
    },
    stab(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 600, dur: 0.1, gain: 0.6, brown: true });
      tone(d, t, { f0: 140, f1: 60, dur: 0.1, gain: 0.3 });
    },
    pin(d, t) {
      tone(d, t, { wave: 'triangle', f0: 2600, dur: 0.22, gain: 0.12 });
      noiseHit(d, t, { type: 'highpass', f0: 4000, dur: 0.03, gain: 0.15 });
    },
    bounce(d, t) {
      tone(d, t, { wave: 'triangle', f0: 900 + Math.random() * 300, dur: 0.07, gain: 0.15 });
      noiseHit(d, t, { type: 'bandpass', f0: 1600, dur: 0.04, gain: 0.2, q: 2 });
    },
    beep(d, t) {
      tone(d, t, { wave: 'square', f0: 1250, dur: 0.06, gain: 0.08, filter: 'lowpass', ff: 3000 });
    },
    explosion(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 2200, f1: 90, dur: 1.4, gain: 1.4, sweep: 1.2 });
      tone(d, t, { f0: 70, f1: 24, dur: 1.0, gain: 1.2 });
      noiseHit(d, t + 0.05, { type: 'lowpass', f0: 700, f1: 120, dur: 2.2, gain: 0.5, brown: true, attack: 0.05 });
      noiseHit(d, t, { type: 'highpass', f0: 3000, dur: 0.08, gain: 0.5 });
    },
    stunBang(d, t) {
      noiseHit(d, t, { type: 'highpass', f0: 1500, dur: 0.3, gain: 0.9 });
      tone(d, t, { f0: 110, f1: 40, dur: 0.4, gain: 0.7 });
    },
    tinnitus(d, t) {
      tone(d, t, { wave: 'sine', f0: 3600, dur: 2.6, gain: 0.08, attack: 0.05 });
    },
    smoke(d, t) {
      noiseHit(d, t, { type: 'highpass', f0: 2500, dur: 2.2, gain: 0.25, attack: 0.1 });
    },
    hurt(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 500, dur: 0.12, gain: 0.7, brown: true });
      tone(d, t, { wave: 'sawtooth', f0: 150, f1: 110, dur: 0.16, gain: 0.12, filter: 'bandpass', ff: 600, fq: 2 });
    },
    heartbeat(d, t) {
      tone(d, t, { f0: 60, f1: 40, dur: 0.12, gain: 0.5 });
      tone(d, t + 0.18, { f0: 55, f1: 38, dur: 0.14, gain: 0.4 });
    },
    jet(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 500, f1: 2600, dur: 1.8, gain: 0.9, q: 0.8, attack: 0.6, sweep: 1.6 });
      noiseHit(d, t + 0.8, { type: 'lowpass', f0: 1500, f1: 200, dur: 2.0, gain: 0.6, brown: true, attack: 0.2 });
    },
    uav(d, t) {
      tone(d, t, { wave: 'triangle', f0: 660, dur: 0.1, gain: 0.15 });
      tone(d, t + 0.12, { wave: 'triangle', f0: 990, dur: 0.18, gain: 0.15 });
    },
    warning(d, t) {
      for (let i = 0; i < 3; i++) {
        tone(d, t + i * 0.36, { wave: 'square', f0: 720, dur: 0.14, gain: 0.1, filter: 'lowpass', ff: 2000 });
        tone(d, t + i * 0.36 + 0.18, { wave: 'square', f0: 540, dur: 0.14, gain: 0.1, filter: 'lowpass', ff: 2000 });
      }
    },
    medal(d, t) {
      tone(d, t, { wave: 'triangle', f0: 1046, dur: 0.1, gain: 0.12 });
      tone(d, t + 0.08, { wave: 'triangle', f0: 1568, dur: 0.18, gain: 0.12 });
    },
    levelUp(d, t) {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((f, i) => tone(d, t + i * 0.09, { wave: 'triangle', f0: f, dur: 0.25, gain: 0.14 }));
    },
    flag(d, t) {
      [784, 988, 1175].forEach((f, i) => tone(d, t + i * 0.1, { wave: 'square', f0: f, dur: 0.12, gain: 0.06, filter: 'lowpass', ff: 2500 }));
    },
    flagLost(d, t) {
      [700, 560, 440].forEach((f, i) => tone(d, t + i * 0.12, { wave: 'square', f0: f, dur: 0.14, gain: 0.06, filter: 'lowpass', ff: 2000 }));
    },
    tick(d, t) {
      tone(d, t, { wave: 'square', f0: 1800, dur: 0.02, gain: 0.05 });
    },
    uiHover(d, t) {
      tone(d, t, { wave: 'sine', f0: 2200, dur: 0.025, gain: 0.04 });
    },
    uiClick(d, t) {
      tone(d, t, { wave: 'triangle', f0: 1200, f1: 700, dur: 0.06, gain: 0.1 });
      noiseHit(d, t, { type: 'highpass', f0: 3000, dur: 0.02, gain: 0.08 });
    },
    groan(d, t) {
      const f = 70 + Math.random() * 60;
      const ctx = A.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * (0.7 + Math.random() * 0.5), t + 1);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5 + Math.random() * 4;
      const vg = ctx.createGain();
      vg.gain.value = f * 0.06;
      vib.connect(vg);
      vg.connect(osc.frequency);
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 450 + Math.random() * 300;
      f1.Q.value = 5;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1100 + Math.random() * 400;
      f2.Q.value = 6;
      const g = ctx.createGain();
      const dur = 0.7 + Math.random() * 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f1);
      osc.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(d);
      osc.start(t);
      vib.start(t);
      osc.stop(t + dur + 0.05);
      vib.stop(t + dur + 0.05);
      track(osc);
    },
    zattack(d, t) {
      tone(d, t, { wave: 'sawtooth', f0: 260, f1: 120, dur: 0.35, gain: 0.25, filter: 'bandpass', ff: 900, fq: 3 });
      noiseHit(d, t, { type: 'bandpass', f0: 1200, dur: 0.25, gain: 0.25, q: 2 });
    },
    zdeath(d, t) {
      tone(d, t, { wave: 'sawtooth', f0: 140, f1: 50, dur: 0.6, gain: 0.25, filter: 'bandpass', ff: 600, fq: 3 });
    },
    bark(d, t) {
      tone(d, t, { wave: 'sawtooth', f0: 380, f1: 620, dur: 0.12, gain: 0.25, filter: 'bandpass', ff: 1200, fq: 2, sweep: 0.06 });
      tone(d, t + 0.12, { wave: 'sawtooth', f0: 600, f1: 260, dur: 0.18, gain: 0.2, filter: 'bandpass', ff: 1000, fq: 2 });
    },
    lightning(d, t) {
      noiseHit(d, t, { type: 'highpass', f0: 2000, dur: 0.25, gain: 0.6 });
      noiseHit(d, t + 0.05, { type: 'lowpass', f0: 400, dur: 1.2, gain: 0.7, brown: true });
    },
    buy(d, t) {
      tone(d, t, { wave: 'triangle', f0: 1568, dur: 0.08, gain: 0.15 });
      tone(d, t + 0.07, { wave: 'triangle', f0: 2093, dur: 0.22, gain: 0.15 });
      noiseHit(d, t, { type: 'highpass', f0: 6000, dur: 0.2, gain: 0.1 });
    },
    deny(d, t) {
      tone(d, t, { wave: 'square', f0: 140, dur: 0.22, gain: 0.12, filter: 'lowpass', ff: 800 });
    },
    door(d, t) {
      noiseHit(d, t, { type: 'lowpass', f0: 1200, f1: 200, dur: 0.6, gain: 0.9 });
      tone(d, t, { f0: 80, f1: 40, dur: 0.4, gain: 0.6 });
      for (let i = 0; i < 4; i++) noiseHit(d, t + 0.1 + i * 0.12, { type: 'bandpass', f0: 700 + Math.random() * 600, dur: 0.08, gain: 0.4, q: 2 });
    },
    box(d, t) {
      const scale = [523, 587, 659, 784, 880, 1046, 1174, 1318];
      for (let i = 0; i < 22; i++) tone(d, t + i * 0.14, { wave: 'triangle', f0: U.pick(scale) * 1.5, dur: 0.25, gain: 0.07 });
    },
    perk(d, t) {
      const mel = [392, 523, 659, 784, 659, 784, 1046];
      mel.forEach((f, i) => tone(d, t + i * 0.13, { wave: 'square', f0: f, dur: 0.12, gain: 0.05, filter: 'lowpass', ff: 2200 }));
      tone(d, t + 0.95, { wave: 'triangle', f0: 1046, dur: 0.5, gain: 0.08 });
    },
    drink(d, t) {
      for (let i = 0; i < 5; i++) noiseHit(d, t + i * 0.18, { type: 'bandpass', f0: 500, dur: 0.08, gain: 0.3, q: 4 });
      tone(d, t + 1, { wave: 'sine', f0: 200, f1: 120, dur: 0.2, gain: 0.2 });
    },
    powerup(d, t) {
      [523, 784, 1046, 1568].forEach((f, i) => tone(d, t + i * 0.07, { wave: 'triangle', f0: f, dur: 0.2, gain: 0.13 }));
    },
    powerupSpawn(d, t) {
      tone(d, t, { wave: 'sine', f0: 900, f1: 1800, dur: 0.5, gain: 0.1 });
    },
    nuke(d, t) {
      FX.explosion(d, t);
      tone(d, t, { wave: 'sawtooth', f0: 50, f1: 30, dur: 2.5, gain: 0.4, filter: 'lowpass', ff: 300 });
    },
    power(d, t) {
      tone(d, t, { f0: 60, f1: 30, dur: 0.6, gain: 0.8 });
      noiseHit(d, t, { type: 'lowpass', f0: 800, dur: 0.4, gain: 0.7 });
      tone(d, t + 0.4, { wave: 'sawtooth', f0: 50, f1: 120, dur: 2.5, gain: 0.12, filter: 'lowpass', ff: 600, sweep: 2.4 });
    },
    upgrade(d, t) {
      for (let i = 0; i < 12; i++) tone(d, t + i * 0.2, { wave: 'sawtooth', f0: 80 + i * 20, dur: 0.18, gain: 0.08, filter: 'lowpass', ff: 900 });
      tone(d, t + 2.6, { wave: 'triangle', f0: 1318, dur: 0.6, gain: 0.12 });
    },
    roundStart(d, t) {
      const ctx = A.ctx;
      [55, 82.4, 110, 164.8].forEach((f, i) => {
        tone(d, t + i * 0.05, { wave: 'sawtooth', f0: f, dur: 2.8, gain: 0.08, attack: 0.6, filter: 'lowpass', ff: 500 + i * 100 });
      });
      tone(d, t + 0.2, { wave: 'triangle', f0: 220, f1: 207, dur: 2.5, gain: 0.08, attack: 0.3 });
      noiseHit(d, t, { type: 'lowpass', f0: 200, dur: 2.5, gain: 0.3, brown: true, attack: 0.5 });
      return ctx;
    },
    roundEnd(d, t) {
      [330, 311, 247, 220].forEach((f, i) => tone(d, t + i * 0.45, { wave: 'triangle', f0: f, dur: 0.6, gain: 0.12, attack: 0.05 }));
    },
    gameOver(d, t) {
      [196, 185, 165, 147, 110].forEach((f, i) => tone(d, t + i * 0.5, { wave: 'sawtooth', f0: f, dur: 0.9, gain: 0.08, filter: 'lowpass', ff: 700 }));
    },
    victory(d, t) {
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(d, t + i * 0.15, { wave: 'triangle', f0: f, dur: 0.3, gain: 0.14 }));
    },
    defeat(d, t) {
      [440, 415, 392, 330].forEach((f, i) => tone(d, t + i * 0.3, { wave: 'triangle', f0: f, dur: 0.5, gain: 0.12 }));
    },
    target(d, t) {
      tone(d, t, { wave: 'triangle', f0: 1700, dur: 0.12, gain: 0.12 });
      noiseHit(d, t, { type: 'bandpass', f0: 3000, dur: 0.05, gain: 0.2, q: 3 });
    },
    whoosh(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 2000, f1: 500, dur: 0.18, gain: 0.25, q: 1.5 });
    },
    ricochet(d, t) {
      tone(d, t, { wave: 'sine', f0: 3500 + Math.random() * 1500, f1: 1200, dur: 0.18, gain: 0.05 });
    },
    impact(d, t) {
      noiseHit(d, t, { type: 'bandpass', f0: 1200 + Math.random() * 900, dur: 0.04, gain: 0.25, q: 1.5 });
    },
  };

  A.play = function (name, opts) {
    if (!A.ctx) return;
    const o = opts || {};
    if (!o.priority && A.voices > 70) return;
    const fn = FX[name];
    if (!fn) return;
    const d = out(o);
    if (!d) return;
    fn(d, A.ctx.currentTime + (o.delay || 0));
  };

  // ---- Döngüler: helikopter rotoru vb. ----
  A.startLoop = function (id, kind, pos) {
    if (!A.ctx || A.loops[id]) return;
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = A.brown;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'heli' ? 400 : 900;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = kind === 'heli' ? 17 : 0.3;
    const lg = ctx.createGain();
    lg.gain.value = kind === 'heli' ? 0.5 : 0.1;
    lfo.connect(lg);
    const amp = ctx.createGain();
    amp.gain.value = 0.6;
    lg.connect(amp.gain);
    src.connect(f);
    f.connect(amp);
    amp.connect(g);
    let pan = null;
    if (ctx.createStereoPanner) {
      pan = ctx.createStereoPanner();
      g.connect(pan);
      pan.connect(A.sfx);
    } else g.connect(A.sfx);
    src.start();
    lfo.start();
    A.loops[id] = { src, lfo, g, pan, pos: pos || null, base: kind === 'heli' ? 1.6 : 0.5 };
  };
  A.updateLoop = function (id, pos) {
    const L = A.loops[id];
    if (!L) return;
    if (pos) L.pos = pos;
    const p = L.pos;
    let vol = L.base;
    if (p) {
      const dx = p.x - A.listener.x, dy = p.y - A.listener.y, dz = p.z - A.listener.z;
      const dist = Math.hypot(dx, dy, dz);
      vol *= 1 / (1 + Math.pow(dist / 18, 1.3));
      if (L.pan) {
        const yaw = A.listener.yaw;
        const side = dist > 0.01 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / dist : 0;
        L.pan.pan.value = U.clamp(side * 0.8, -1, 1);
      }
    }
    L.g.gain.setTargetAtTime(vol, A.ctx.currentTime, 0.1);
  };
  A.stopLoop = function (id) {
    const L = A.loops[id];
    if (!L) return;
    try {
      L.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2);
      L.src.stop(A.ctx.currentTime + 1);
      L.lfo.stop(A.ctx.currentTime + 1);
    } catch (e) { /* yoksay */ }
    delete A.loops[id];
  };
  A.stopAllLoops = function () {
    for (const id in A.loops) A.stopLoop(id);
  };

  // ---- Müzik ----
  A.music = function (mode) {
    if (!A.ctx) return;
    if (A.musicState === mode) return;
    A.musicState = mode;
    if (A.musicNodes) {
      const now = A.ctx.currentTime;
      for (const n of A.musicNodes.gains) n.gain.setTargetAtTime(0, now, 0.6);
      const old = A.musicNodes;
      setTimeout(() => {
        for (const o of old.oscs) try { o.stop(); } catch (e) { /* yoksay */ }
        clearInterval(old.timer);
      }, 3000);
      A.musicNodes = null;
    }
    if (mode === 'none') return;
    const ctx = A.ctx;
    const oscs = [], gains = [];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'zm' ? 380 : 700;
    filter.Q.value = 3;
    filter.connect(A.musicBus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = mode === 'zm' ? 120 : 300;
    lfo.connect(lg);
    lg.connect(filter.frequency);
    lfo.start();
    oscs.push(lfo);
    const chords = mode === 'zm'
      ? [[55, 65.4, 82.4], [51.9, 61.7, 77.8], [49, 58.3, 73.4], [51.9, 65.4, 77.8]]
      : [[73.4, 110, 146.8, 174.6], [65.4, 98, 130.8, 164.8], [58.3, 87.3, 116.5, 146.8], [69.3, 103.8, 138.6, 164.8]];
    const voices = chords[0].length;
    for (let i = 0; i < voices; i++) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.detune.value = det;
        o.frequency.value = chords[0][i];
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
        o.connect(g);
        g.connect(filter);
        o.start();
        oscs.push(o);
        gains.push(g);
        o._voice = i;
      }
    }
    // nabız
    const pulse = ctx.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.value = mode === 'zm' ? 41 : 55;
    const pg = ctx.createGain();
    pg.gain.value = 0;
    pulse.connect(pg);
    pg.connect(A.musicBus);
    pulse.start();
    oscs.push(pulse);
    gains.push(pg);
    let ci = 0;
    const timer = setInterval(() => {
      if (!A.ctx) return;
      ci = (ci + 1) % chords.length;
      const now = A.ctx.currentTime;
      for (const o of oscs) if (o._voice != null) o.frequency.setTargetAtTime(chords[ci][o._voice], now, 0.4);
      for (let k = 0; k < 4; k++) {
        pg.gain.setValueAtTime(0.0001, now + k * 1.0);
        pg.gain.exponentialRampToValueAtTime(mode === 'zm' ? 0.12 : 0.08, now + k * 1.0 + 0.02);
        pg.gain.exponentialRampToValueAtTime(0.0001, now + k * 1.0 + 0.5);
      }
    }, 4000);
    A.musicNodes = { oscs, gains, timer };
  };

  // ---- Anons (konuşma sentezi, varsa) ----
  let trVoice = null;
  function findVoice() {
    try {
      const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      trVoice = vs.find((v) => /tr/i.test(v.lang)) || null;
    } catch (e) {
      trVoice = null;
    }
  }
  try {
    if (window.speechSynthesis) {
      findVoice();
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  } catch (e) { /* yoksay */ }
  A.announce = function (text) {
    if (!G.settings.announcer) return;
    try {
      if (!window.speechSynthesis || !trVoice) return;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = trVoice;
      u.lang = trVoice.lang;
      u.rate = 1.08;
      u.pitch = 0.8;
      u.volume = Math.min(1, G.settings.master * 0.9);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* yoksay */ }
  };
})();
