'use strict';
// Gölge Timi — silah modeli üreticisi (sürüm 2). Yan profil çizimlerinden
// ekstrüzyonla gerçekçi silüetler, kamuflaj dokuları, eklentiler, el tutma
// noktaları ve menü/öldürme akışı için silah simgeleri.
(function () {
  const G = window.G;
  const U = G.util;

  // ---------------- Geometri yardımcıları ----------------
  const gcache = {};
  function box(w, h, d) {
    const k = 'b' + w + ':' + h + ':' + d;
    return gcache[k] || (gcache[k] = new THREE.BoxGeometry(w, h, d));
  }
  function cylZ(r, len, seg, r2) {
    const k = 'c' + r + ':' + len + ':' + seg + ':' + r2;
    if (!gcache[k]) {
      const g = new THREE.CylinderGeometry(r2 != null ? r2 : r, r, len, seg || 10);
      g.rotateX(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  function cylX(r, len, seg) {
    const k = 'x' + r + ':' + len + ':' + seg;
    if (!gcache[k]) {
      const g = new THREE.CylinderGeometry(r, r, len, seg || 12);
      g.rotateZ(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  // pts: [ileri, yukarı] çiftleri (ileri = namlu yönü). Kalınlık X ekseninde.
  function ext(pts, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
    g.rotateY(Math.PI / 2);
    g.translate(-depth / 2, 0, 0);
    return g;
  }
  function add(parent, geo, mat, f, y, x, name) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, -(f || 0));
    if (name) m.name = name;
    parent.add(m);
    return m;
  }

  // ---------------- Dokular ----------------
  const tcache = {};
  function pixTex(key, size, draw, repeat) {
    if (tcache[key]) return tcache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const rnd = U.seeded(key.length * 7919 + key.charCodeAt(0) * 31);
    draw(ctx, size, rnd);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.repeat.set(repeat || 8, repeat || 8);
    tcache[key] = t;
    return t;
  }
  function blobs(ctx, s, rnd, cols, n, rmin, rmax) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const x = rnd() * s, y = rnd() * s, r = rmin + rnd() * (rmax - rmin);
      for (let k = 0; k < 5; k++) {
        const ox = (rnd() - 0.5) * r, oy = (rnd() - 0.5) * r;
        for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) ctx.fillRect(Math.round(x + ox + dx - r / 2), Math.round(y + oy + dy - r / 3), Math.round(r), Math.round(r * 0.66));
      }
    }
  }
  function digital(ctx, s, rnd, cols, cell) {
    for (let y = 0; y < s; y += cell)
      for (let x = 0; x < s; x += cell) {
        ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
        ctx.fillRect(x, y, cell, cell);
      }
  }
  const CAMO_DRAW = {
    orman(ctx, s, rnd) {
      ctx.fillStyle = '#4b5a32';
      ctx.fillRect(0, 0, s, s);
      blobs(ctx, s, rnd, ['#2e3a1e', '#6b5a38', '#1b1d16', '#5f7240'], 22, 5, 11);
    },
    col(ctx, s, rnd) {
      ctx.fillStyle = '#c2a676';
      ctx.fillRect(0, 0, s, s);
      blobs(ctx, s, rnd, ['#9a7a4e', '#d9c39a', '#7e6440'], 26, 3, 7);
    },
    kent(ctx, s, rnd) {
      digital(ctx, s, rnd, ['#5a5e62', '#7d8287', '#3a3d40', '#9aa0a4', '#5a5e62'], 2);
    },
    kis(ctx, s, rnd) {
      ctx.fillStyle = '#e4e8ec';
      ctx.fillRect(0, 0, s, s);
      blobs(ctx, s, rnd, ['#b8bec4', '#8e969c', '#ffffff'], 20, 4, 10);
    },
    kaplan(ctx, s, rnd) {
      ctx.fillStyle = '#d2581e';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#1a0e08';
      for (let i = 0; i < 9; i++) {
        let x = rnd() * s, y = 0;
        while (y < s) {
          ctx.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(rnd() * 2), 2);
          x += (rnd() - 0.5) * 3;
          y += 2;
        }
      }
    },
    gece(ctx, s, rnd) {
      digital(ctx, s, rnd, ['#151a26', '#232a3c', '#0b0d12', '#2e3850'], 2);
    },
    lale(ctx, s, rnd) {
      ctx.fillStyle = '#7a1018';
      ctx.fillRect(0, 0, s, s);
      const tulip = (x, y) => {
        ctx.fillStyle = '#f2d27a';
        ctx.fillRect(x + 2, y + 6, 1, 4);
        ctx.fillRect(x + 1, y + 7, 1, 1);
        ctx.fillRect(x + 3, y + 8, 1, 1);
        ctx.fillStyle = '#f4f0e8';
        ctx.fillRect(x + 1, y + 2, 3, 4);
        ctx.fillRect(x, y + 1, 1, 3);
        ctx.fillRect(x + 4, y + 1, 1, 3);
        ctx.fillRect(x + 2, y, 1, 2);
      };
      for (let y = 0; y < s; y += 12) for (let x = (y / 12) % 2 ? 0 : 6; x < s; x += 12) tulip(x, y);
    },
    altin(ctx, s, rnd) {
      digital(ctx, s, rnd, ['#d4a52a', '#e8c454', '#b08420', '#f4dc80'], 4);
      ctx.fillStyle = 'rgba(255,255,220,0.6)';
      for (let i = 0; i < s; i += 8) ctx.fillRect(i, 0, 1, s);
    },
    elmas(ctx, s, rnd) {
      const cols = ['#9fefff', '#d8faff', '#6fd8f0', '#ffffff', '#b6c8ff'];
      for (let y = 0; y < s; y += 4)
        for (let x = 0; x < s; x += 4) {
          ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 4, y);
          ctx.lineTo(x + (rnd() < 0.5 ? 0 : 4), y + 4);
          ctx.fill();
          ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
          ctx.fillRect(x + 1, y + 2, 2, 2);
        }
    },
    donusum(ctx, s, rnd) {
      digital(ctx, s, rnd, ['#2a1048', '#4a1f8a', '#6a2fc0', '#1a0a30', '#2fa0ff'], 2);
    },
    ahsap(ctx, s, rnd) {
      ctx.fillStyle = '#6b4426';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        const v = Math.sin(y * 0.9 + rnd() * 0.4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(${40 + v * 40},${20 + v * 20},${8},0.35)`;
        ctx.fillRect(0, y, s, 1);
      }
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(40,20,8,0.5)';
        ctx.fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 3, 1);
      }
    },
    polimer(ctx, s, rnd) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < s * s * 0.3; i++) {
        const v = 110 + Math.floor(rnd() * 40);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 1, 1);
      }
    },
  };
  G.camoTexture = function (id) {
    return pixTex('camo-' + id, 32, CAMO_DRAW[id] || CAMO_DRAW.orman, id === 'lale' ? 5 : 7);
  };
  G.camoSwatch = function (id) {
    const k = 'sw-' + id;
    if (tcache[k]) return tcache[k];
    if (id === 'yok') return (tcache[k] = 'linear-gradient(135deg,#2a2d30,#45494d)');
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    CAMO_DRAW[id](c.getContext('2d'), 32, U.seeded(id.length * 7919 + id.charCodeAt(0) * 31));
    return (tcache[k] = `url(${c.toDataURL()})`);
  };

  // ---------------- Malzemeler ----------------
  const mcache = {};
  function std(key, o) {
    if (mcache[key]) return mcache[key];
    const params = { color: o.color != null ? o.color : 0xffffff, roughness: o.rough != null ? o.rough : 0.6, metalness: o.metal != null ? o.metal : 0.3 };
    if (o.map) params.map = o.map;
    if (o.emissive != null) {
      params.emissive = new THREE.Color(o.emissive);
      params.emissiveIntensity = o.ei != null ? o.ei : 1;
    }
    if (o.basic) return (mcache[key] = new THREE.MeshBasicMaterial({ color: o.color }));
    return (mcache[key] = new THREE.MeshStandardMaterial(params));
  }
  G.gunMat = function (color, o) {
    o = o || {};
    return std('gm' + color + JSON.stringify(o), { color, rough: o.rough, metal: o.metal, emissive: o.emissive, ei: o.ei });
  };
  function gunMats(stats) {
    const L = stats.look || {};
    const camo = stats.upgraded ? 'donusum' : stats.camo && stats.camo !== 'yok' ? stats.camo : null;
    const M = {};
    const special = camo === 'altin' || camo === 'elmas';
    if (camo) {
      const tex = G.camoTexture(camo);
      const o = { map: tex, rough: special ? 0.25 : 0.65, metal: special ? 0.8 : 0.15 };
      if (camo === 'donusum') Object.assign(o, { emissive: 0x6a2fff, ei: 0.35 });
      if (camo === 'elmas') Object.assign(o, { emissive: 0x2a6070, ei: 0.4 });
      M.body = std('camo-body-' + camo, o);
      M.furn = std('camo-furn-' + camo, Object.assign({}, o, { rough: special ? 0.3 : 0.75 }));
    } else {
      M.body = std('body' + L.body, { color: L.body || 0x2a2d30, rough: 0.5, metal: 0.45, map: pixTex('polimer', 16, CAMO_DRAW.polimer, 10) });
      M.furn = L.wood
        ? std('wood' + L.furn, { color: 0xffffff, map: pixTex('ahsap', 16, CAMO_DRAW.ahsap, 6), rough: 0.8, metal: 0.05 })
        : std('furn' + L.furn, { color: L.furn || 0x3a3d40, rough: 0.8, metal: 0.1, map: pixTex('polimer', 16, CAMO_DRAW.polimer, 10) });
    }
    M.metal = std('metal', { color: 0x1c1d20, rough: 0.35, metal: 0.75 });
    M.steel = std('steel', { color: 0x8a8e92, rough: 0.3, metal: 0.9 });
    M.dark = std('dark', { color: 0x0e0f10, rough: 0.6, metal: 0.4 });
    M.rubber = std('rubber', { color: 0x161616, rough: 0.95, metal: 0 });
    M.lens = std('lens', { color: 0x2a4a70, rough: 0.05, metal: 0.95, emissive: 0x0a1830 });
    M.brass = std('brass', { color: 0xc8962e, rough: 0.35, metal: 0.85 });
    M.red = std('red', { color: 0xff2a20, basic: true });
    M.glow = std('glow' + (L.furn || 0), { color: L.furn || 0x39ff9a, basic: true });
    M.orange = std('orange', { color: 0xd9541e, rough: 0.6, metal: 0.1 });
    return M;
  }

  // ---------------- Parça kurucular ----------------
  // Uzun silah (tüfek / makineli / av tüfeği / keskin nişancı)
  function longGun(g, s, M, P) {
    const L = s.look;
    const len = L.len || 0.36;
    const back = len * 0.42, front = len * 0.58;
    const H = L.h || 0.085;
    const top = H * 0.62, bot = -H * 0.38;
    // üst gövde
    add(g, ext([[-back, 0.0], [front, 0.0], [front, top - 0.008], [front - 0.012, top], [-back + 0.01, top], [-back, top - 0.012]], 0.052), M.body, 0, 0, 0);
    // alt gövde + şarjör yuvası
    const mf = L.kind === 'bullpup' ? -0.14 : 0.07; // şarjör konumu (ileri)
    add(g, ext([[-back + 0.03, 0.001], [front - 0.03, 0.001], [front - 0.05, bot], [mf + 0.045, bot], [mf + 0.04, bot - 0.012], [mf - 0.045, bot - 0.012], [mf - 0.05, bot], [-back + 0.05, bot]], 0.048), M.body, 0, 0, 0);
    // tetik korkuluğu
    const tg = L.kind === 'bullpup' ? 0.02 : -0.01;
    add(g, ext([[tg - 0.02, bot], [tg + 0.05, bot], [tg + 0.05, bot - 0.035], [tg - 0.025, bot - 0.035], [tg - 0.025, bot - 0.03], [tg + 0.044, bot - 0.03], [tg + 0.044, bot - 0.004], [tg - 0.02, bot - 0.004]], 0.012), M.dark, 0, 0, 0);
    add(g, box(0.008, 0.02, 0.008), M.steel, tg + 0.02, bot - 0.012, 0);
    // fişek atma penceresi ve kurma kolu
    add(g, box(0.004, 0.022, 0.06), M.dark, front * 0.25, top * 0.55, 0.027);
    P.eject = new THREE.Object3D();
    P.eject.position.set(0.03, top * 0.55, -front * 0.25);
    g.add(P.eject);
    P.bolt = add(g, box(0.03, 0.012, 0.016), M.steel, -back + 0.03, top - 0.01, 0.028, 'bolt');
    // ray (üst)
    const railFrom = -back + 0.02, railTo = front + (L.guard || 0) * (L.gs === 'rail' || L.gs === 'mlok' ? 0.95 : 0);
    if (L.sight !== 'post' || L.scope) {
      add(g, box(0.024, 0.008, railTo - railFrom), M.metal, (railFrom + railTo) / 2, top + 0.004, 0);
      for (let f = railFrom + 0.01; f < railTo - 0.005; f += 0.018) add(g, box(0.03, 0.006, 0.006), M.metal, f, top + 0.009, 0);
    }
    // kabza
    const gf = L.kind === 'bullpup' ? 0.03 : -0.045;
    const gp = add(g, ext([[gf - 0.02, 0], [gf + 0.025, 0], [gf + 0.005, -0.1], [gf - 0.035, -0.105], [gf - 0.035, -0.095]], 0.036), L.wood && L.kind !== 'bullpup' ? M.furn : M.furn, 0, bot + 0.005, 0);
    gp.rotation.x = 0;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, bot - 0.045, -(gf - 0.005));
    g.add(P.rightHand);
    // şarjör
    buildMag(g, s, M, P, mf, bot);
    // el kundağı
    const guard = L.guard || 0;
    const gs = L.gs || 'rail';
    let gEnd = front;
    if (guard > 0) {
      const gc = front + guard / 2;
      if (gs === 'wood') {
        add(g, ext([[front, top - 0.006], [front + guard, top - 0.012], [front + guard, -0.02], [front + guard - 0.02, -0.03], [front + 0.01, -0.032], [front, -0.022]], 0.054), M.furn, 0, 0, 0);
      } else if (gs === 'pump') {
        P.guard = add(g, ext([[0, 0.0], [guard, 0.0], [guard, -0.032], [0, -0.032]], 0.05), M.furn, front + 0.06, -0.006, 0, 'pump');
        for (let i = 0; i < 5; i++) add(P.guard, box(0.052, 0.004, 0.006), M.dark, 0.02 + i * (guard - 0.04) / 4, -0.016, 0).position.z = -(0.02 + i * (guard - 0.04) / 4);
      } else if (gs === 'slim') {
        add(g, box(0.042, 0.045, guard), M.furn, gc, 0.012, 0);
      } else if (gs === 'heat') {
        add(g, box(0.05, 0.05, guard), M.metal, gc, 0.01, 0);
        for (let i = 0; i < 6; i++) add(g, box(0.052, 0.012, 0.012), M.dark, front + 0.02 + i * (guard - 0.04) / 5, 0.03, 0);
      } else {
        // ray / mlok / delikli
        add(g, box(0.05, 0.052, guard), gs === 'mlok' ? M.furn : M.body, gc, 0.012, 0);
        const n = Math.max(2, Math.floor(guard / 0.045));
        for (let i = 0; i < n; i++) {
          const f = front + 0.02 + (i * (guard - 0.04)) / Math.max(1, n - 1);
          if (gs === 'mlok') {
            add(g, box(0.052, 0.012, 0.022), M.dark, f, 0.012, 0);
          } else if (gs === 'vented') {
            add(g, box(0.052, 0.014, 0.014), M.dark, f, 0.02, 0);
            add(g, box(0.052, 0.014, 0.014), M.dark, f, 0.0, 0);
          } else {
            add(g, box(0.06, 0.008, 0.012), M.metal, f, 0.012, 0);
            add(g, box(0.012, 0.008, 0.012), M.metal, f, -0.015, 0);
          }
        }
      }
      gEnd = front + guard;
    }
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.03, -(front + Math.max(0.06, guard * 0.55) + (gs === 'pump' ? 0.05 : 0)));
    g.add(P.leftHand);
    // namlu
    const barrel = L.barrel || 0.25;
    const br = L.kind === 'sniper' ? 0.015 : L.kind === 'shotgun' || L.kind === 'auto-shotgun' ? 0.016 : 0.012;
    add(g, cylZ(br, barrel + guard * 0.6, 10), M.metal, gEnd - guard * 0.6 + (barrel + guard * 0.6) / 2, 0.02, 0);
    let muzzleF = gEnd + barrel;
    if (gs !== 'pump' && guard > 0) add(g, box(0.03, 0.03, 0.03), M.metal, gEnd + 0.02, 0.02, 0);
    // pompalı alt tüp
    if (L.mag === 'tube') add(g, cylZ(0.013, Math.max(0.1, guard + barrel * 0.55), 8), M.metal, front + (guard + barrel * 0.55) / 2, -0.012, 0);
    // namlu ağzı
    if (!s.att.muzzle) muzzleF = muzzleDevice(g, M, L.muzzle, muzzleF, br);
    // arpacık / gez
    if (!L.scope) {
      if (L.sight === 'post') {
        add(g, ext([[0, 0], [0.02, 0], [0.012, 0.045], [0.006, 0.045]], 0.01), M.metal, gEnd + barrel - 0.05, 0.02, 0);
        add(g, box(0.03, 0.018, 0.04), M.metal, front - 0.02, top + 0.009, 0);
        P.sightY = top + 0.03;
      } else if (L.sight === 'carry') {
        add(g, box(0.03, 0.03, 0.12), M.body, -back + 0.1, top + 0.02, 0);
        add(g, box(0.012, 0.012, 0.012), M.dark, -back + 0.06, top + 0.04, 0);
        add(g, ext([[0, 0], [0.03, 0], [0.02, 0.06], [0.01, 0.06]], 0.012), M.body, gEnd - 0.03, 0.035, 0);
        P.sightY = top + 0.04;
      } else if (L.sight === 'rail') {
        add(g, box(0.026, 0.024, 0.012), M.dark, -back + 0.04, top + 0.02, 0);
        add(g, box(0.02, 0.026, 0.012), M.dark, railTo - 0.02, top + 0.02, 0);
        P.sightY = top + 0.028;
      } else P.sightY = top + 0.02;
    }
    // dipçik
    if (!s.noStock) buildStock(g, s, M, L.kind === 'bullpup' ? 'bullpup' : L.stock, -back, top, bot);
    // çatal ayak
    if (L.bipod || s.att.under === 'ayak') {
      for (const x of [-0.018, 0.018]) {
        const leg = add(g, box(0.008, 0.008, 0.16), M.metal, gEnd - 0.1, -0.02, x);
        leg.rotation.x = 0.05;
      }
    }
    if (L.mag === 'belt') {
      add(g, box(0.045, 0.012, 0.03), M.metal, front * 0.5, top + 0.012, 0);
    }
    return muzzleF;
  }

  function muzzleDevice(g, M, kind, f, br) {
    if (kind === 'flash') {
      add(g, cylZ(br + 0.004, 0.05, 8), M.metal, f + 0.025, 0.02, 0);
      for (let i = 0; i < 3; i++) add(g, box(0.004, 0.03, 0.03), M.dark, f + 0.03, 0.02, (i - 1) * 0.008);
      return f + 0.05;
    }
    if (kind === 'brake') {
      add(g, box(br * 2 + 0.012, br * 2 + 0.01, 0.05), M.metal, f + 0.025, 0.02, 0);
      for (let i = 0; i < 3; i++) add(g, box(br * 2 + 0.016, 0.006, 0.008), M.dark, f + 0.01 + i * 0.014, 0.02, 0);
      return f + 0.05;
    }
    if (kind === 'big') {
      add(g, box(0.06, 0.04, 0.08), M.metal, f + 0.04, 0.02, 0);
      for (let i = 0; i < 3; i++) add(g, box(0.064, 0.026, 0.01), M.dark, f + 0.015 + i * 0.022, 0.02, 0);
      return f + 0.08;
    }
    return f;
  }

  function buildMag(g, s, M, P, f, bot) {
    const L = s.look;
    let kind = L.mag;
    if (s.drumMag && ['curved', 'straight', 'box'].includes(kind)) kind = 'drum';
    const ml = (L.magLen || (kind === 'curved' ? 0.17 : 0.15)) * (s.att.mag === 'genis' ? 1.35 : 1);
    let m = null;
    if (kind === 'curved') {
      const pts = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([0.032 + t * 0.03, -t * ml]);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        pts.push([-0.032 + t * 0.045, -t * ml]);
      }
      m = add(g, ext(pts, 0.03), M.dark, f, bot, 0, 'mag');
    } else if (kind === 'straight') {
      m = add(g, ext([[-0.03, 0], [0.032, 0], [0.034, -ml], [-0.028, -ml]], 0.028), M.dark, f, bot, 0, 'mag');
    } else if (kind === 'box') {
      m = add(g, ext([[-0.035, 0], [0.035, 0], [0.035, -ml * 0.6], [-0.035, -ml * 0.6]], 0.036), M.dark, f, bot, 0, 'mag');
    } else if (kind === 'drum') {
      m = new THREE.Group();
      m.name = 'mag';
      add(m, box(0.03, 0.04, 0.05), M.dark, 0, -0.02, 0);
      add(m, cylX(0.07, 0.07, 14), M.dark, 0, -0.1, 0);
      add(m, cylX(0.03, 0.074, 10), M.metal, 0, -0.1, 0);
      m.position.set(0, bot, -f);
      g.add(m);
    } else if (kind === 'belt') {
      m = new THREE.Group();
      m.name = 'mag';
      add(m, box(0.07, 0.09, 0.11), M.furn, 0, -0.05, 0.02);
      for (let i = 0; i < 4; i++) add(m, box(0.012, 0.012, 0.02), M.brass, 0, 0.004 + i * 0.01, -0.035 + i * 0.006).position.x = 0.03 - i * 0.01;
      m.position.set(-0.01, bot, -f);
      g.add(m);
    } else if (kind === 'pdw') {
      m = add(g, box(0.04, 0.03, 0.24), std('pdwmag', { color: 0x30322a, rough: 0.3, metal: 0.2 }), 0.04, 0.075, 0, 'mag');
    }
    P.mag = m;
  }

  function buildStock(g, s, M, kind, b, top, bot) {
    const F = M.furn;
    if (kind === 'collapsible') {
      add(g, cylZ(0.014, 0.16, 8), M.metal, b - 0.08, 0.025, 0);
      add(g, ext([[0, 0.045], [0.07, 0.04], [0.06, -0.02], [0.0, -0.06], [-0.012, -0.06], [-0.012, 0.045]], 0.04), F, b - 0.2, 0.0, 0);
      add(g, box(0.042, 0.11, 0.014), M.rubber, b - 0.21, -0.008, 0);
    } else if (kind === 'full' || kind === 'wood') {
      add(g, ext([[0, top - 0.005], [-0.25, top - 0.015], [-0.27, top - 0.01], [-0.27, bot - 0.075], [-0.24, bot - 0.075], [0, bot + 0.01]], 0.044), F, b, 0, 0);
      add(g, box(0.046, 0.13, 0.014), M.rubber, b - 0.272, (top + bot - 0.075) / 2 - 0.005, 0);
    } else if (kind === 'skeleton') {
      add(g, ext([[0, 0.04], [-0.24, 0.035], [-0.24, 0.02], [0, 0.025]], 0.02), F, b, 0, 0);
      add(g, ext([[0, -0.01], [-0.24, -0.05], [-0.24, -0.065], [0, -0.025]], 0.02), F, b, 0, 0);
      add(g, box(0.03, 0.12, 0.014), M.rubber, b - 0.24, -0.012, 0);
    } else if (kind === 'folding') {
      for (const y of [0.03, -0.015]) add(g, box(0.008, 0.008, 0.22), M.metal, b - 0.11 + 0.02, y, 0.032);
      add(g, box(0.008, 0.06, 0.012), M.metal, b - 0.2, 0.008, 0.032);
    } else if (kind === 'sniper') {
      add(g, ext([[0, top - 0.005], [-0.06, top + 0.012], [-0.2, top + 0.012], [-0.29, top], [-0.29, bot - 0.08], [-0.2, bot - 0.08], [-0.12, bot - 0.02], [-0.06, bot - 0.06], [0, bot]], 0.046), F, b, 0, 0);
      add(g, box(0.05, 0.14, 0.016), M.rubber, b - 0.29, (top + bot - 0.08) / 2, 0);
      add(g, box(0.03, 0.012, 0.09), M.metal, b - 0.18, top + 0.02, 0);
    } else if (kind === 'bullpup') {
      add(g, box(0.05, 0.12, 0.02), M.rubber, b - 0.01, -0.01, 0);
    } else {
      add(g, box(0.04, 0.05, 0.02), M.dark, b - 0.01, 0.02, 0);
    }
  }

  function pistol(g, s, M, P) {
    const L = s.look;
    const big = L.big ? 1.12 : 1;
    const len = 0.2 * big;
    P.slide = add(g, ext([[-0.04, 0.045], [len - 0.03, 0.045], [len - 0.03, 0.08], [len - 0.04, 0.09], [-0.03, 0.09], [-0.04, 0.08]], 0.032 * big), M.body, 0, 0, 0, 'slide');
    for (let i = 0; i < 5; i++) add(P.slide, box(0.034 * big, 0.03, 0.004), M.dark, 0, 0, 0).position.set(0, 0.067, 0.03 - i * 0.008);
    add(g, ext([[-0.03, 0.045], [len - 0.05, 0.045], [len - 0.05, 0.03], [0.06, 0.02], [0.03, 0.02], [-0.03, 0.03]], 0.028 * big), M.furn, 0, 0, 0);
    add(g, ext([[-0.035, 0.03], [0.02, 0.03], [0.0, -0.075], [-0.045, -0.08], [-0.05, -0.07]], 0.03 * big), M.furn, 0, 0, 0);
    add(g, ext([[0.0, 0.02], [0.05, 0.02], [0.05, -0.008], [0.004, -0.008], [0.004, -0.004], [0.044, -0.004], [0.044, 0.016], [0.0, 0.016]], 0.01), M.dark, 0, 0, 0);
    add(g, box(0.006, 0.012, 0.006), M.dark, len - 0.04, 0.096, 0);
    add(g, box(0.018, 0.01, 0.006), M.dark, -0.025, 0.096, 0);
    add(g, cylZ(0.008, 0.02, 8), M.dark, len - 0.03, 0.07, 0);
    P.mag = add(g, box(0.024, 0.05, 0.03), M.dark, -0.025, -0.07, 0, 'mag');
    if (L.kind === 'mpistol') {
      P.mag.scale.y = 1.8;
      P.mag.position.y = -0.09;
      add(g, box(0.034, 0.03, 0.04), M.metal, len - 0.01, 0.07, 0);
    }
    P.sightY = 0.1;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.03, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(-0.012, -0.045, 0.01);
    g.add(P.leftHand);
    return len - 0.02;
  }

  function revolver(g, s, M, P) {
    add(g, cylZ(0.014, 0.17, 8), M.body, 0.13, 0.07, 0);
    add(g, box(0.014, 0.014, 0.17), M.body, 0.13, 0.087, 0);
    add(g, ext([[-0.03, 0.04], [0.06, 0.04], [0.06, 0.095], [-0.02, 0.095], [-0.04, 0.08]], 0.03), M.body, 0, 0, 0);
    const cyl = new THREE.Group();
    cyl.name = 'cylinder';
    add(cyl, cylZ(0.03, 0.05, 12), M.body, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(cyl, cylZ(0.006, 0.052, 6), M.dark, 0, Math.sin(a) * 0.018, Math.cos(a) * 0.018);
    }
    cyl.position.set(0, 0.068, -0.02);
    g.add(cyl);
    P.mag = cyl;
    add(g, ext([[-0.035, 0.045], [0.0, 0.045], [-0.012, -0.07], [-0.06, -0.075], [-0.065, -0.06]], 0.034), M.furn, 0, 0, 0);
    add(g, box(0.01, 0.02, 0.02), M.metal, -0.045, 0.09, 0);
    add(g, box(0.006, 0.012, 0.006), M.dark, 0.2, 0.1, 0);
    P.sightY = 0.104;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.025, 0.03);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(-0.012, -0.04, 0.02);
    g.add(P.leftHand);
    return 0.22;
  }

  function flareGun(g, s, M, P) {
    add(g, cylZ(0.022, 0.16, 10), M.orange, 0.08, 0.06, 0);
    add(g, cylZ(0.026, 0.02, 10), M.orange, 0.155, 0.06, 0);
    add(g, ext([[-0.03, 0.035], [0.02, 0.035], [0.0, -0.07], [-0.045, -0.075], [-0.05, -0.065]], 0.034), M.orange, 0, 0, 0);
    add(g, box(0.02, 0.02, 0.03), M.dark, -0.025, 0.07, 0);
    P.mag = add(g, cylZ(0.016, 0.03, 8), std('flareShell', { color: 0xd02020, rough: 0.5 }), 0.0, 0.06, 0, 'mag');
    P.sightY = 0.09;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.025, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(-0.012, -0.04, 0.01);
    g.add(P.leftHand);
    return 0.17;
  }

  function launcher(g, s, M, P) {
    add(g, cylZ(0.055, 0.95, 12), M.body, 0.25, 0.09, 0);
    add(g, cylZ(0.066, 0.08, 12, 0.058), M.body, 0.74, 0.09, 0);
    add(g, cylZ(0.07, 0.1, 12, 0.056), M.body, -0.22, 0.09, 0);
    add(g, ext([[-0.02, 0.035], [0.025, 0.035], [0.005, -0.07], [-0.035, -0.075]], 0.034), M.furn, 0, 0, 0);
    add(g, ext([[0.28, 0.035], [0.32, 0.035], [0.305, -0.06], [0.27, -0.06]], 0.032), M.furn, 0, 0, 0);
    add(g, box(0.02, 0.05, 0.06), M.dark, 0.18, 0.16, -0.06);
    add(g, box(0.05, 0.03, 0.03), M.metal, 0.05, 0.03, 0);
    P.mag = new THREE.Group();
    P.mag.name = 'mag';
    const war = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10).rotateX(-Math.PI / 2), std('warhead', { color: 0x5d6b45, rough: 0.6, metal: 0.2 }));
    P.mag.add(war);
    P.mag.position.set(0, 0.09, -0.82);
    g.add(P.mag);
    P.sightY = 0.19;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.03, 0);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.03, -0.3);
    g.add(P.leftHand);
    return 0.72;
  }

  function grenadeLauncher(g, s, M, P) {
    add(g, cylZ(0.024, 0.2, 10), M.body, 0.22, 0.05, 0);
    add(g, cylZ(0.03, 0.04, 10), M.metal, 0.33, 0.05, 0);
    const cyl = new THREE.Group();
    cyl.name = 'mag';
    add(cyl, cylZ(0.065, 0.12, 12), M.body, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(cyl, cylZ(0.016, 0.124, 8), M.dark, 0, Math.sin(a) * 0.04, Math.cos(a) * 0.04);
    }
    cyl.position.set(0, 0.03, -0.07);
    g.add(cyl);
    P.mag = cyl;
    add(g, box(0.03, 0.03, 0.3), M.metal, 0.05, 0.1, 0);
    add(g, ext([[-0.02, 0.0], [0.025, 0.0], [0.005, -0.09], [-0.035, -0.095]], 0.034), M.furn, 0, -0.02, 0);
    add(g, ext([[0.17, -0.01], [0.21, -0.01], [0.19, -0.1], [0.16, -0.1]], 0.03), M.furn, 0, 0, 0);
    buildStock(g, s, M, 'folding', -0.06, 0.06, -0.03);
    P.sightY = 0.13;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.06, 0);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.06, -0.19);
    g.add(P.leftHand);
    return 0.35;
  }

  function doubleBarrel(g, s, M, P) {
    add(g, ext([[-0.06, -0.02], [0.08, -0.02], [0.08, 0.04], [-0.04, 0.04], [-0.06, 0.02]], 0.05), M.body, 0, 0, 0);
    for (const x of [-0.014, 0.014]) add(g, cylZ(0.014, 0.55, 10), M.metal, 0.08 + 0.275, 0.02, x);
    add(g, box(0.012, 0.006, 0.55), M.metal, 0.355, 0.036, 0);
    P.guard = add(g, ext([[0.09, 0.005], [0.33, 0.0], [0.33, -0.02], [0.1, -0.028]], 0.046), M.furn, 0, 0, 0, 'fore');
    buildStock(g, s, M, 'wood', -0.06, 0.04, -0.02);
    add(g, ext([[-0.02, -0.02], [0.04, -0.02], [0.04, -0.045], [-0.02, -0.045]], 0.01), M.dark, 0, 0, 0);
    P.mag = new THREE.Group();
    P.mag.name = 'mag';
    for (const x of [-0.014, 0.014]) add(P.mag, cylZ(0.013, 0.06, 8), std('shellRed', { color: 0xb02020, rough: 0.6 }), 0, 0, x);
    P.mag.position.set(0, 0.02, -0.11);
    P.mag.visible = false;
    g.add(P.mag);
    P.sightY = 0.045;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.06, 0.03);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.03, -0.22);
    g.add(P.leftHand);
    return 0.63;
  }

  function crossbow(g, s, M, P) {
    add(g, ext([[-0.05, 0.0], [0.42, 0.0], [0.42, 0.03], [-0.05, 0.035]], 0.04), M.body, 0, 0, 0);
    add(g, box(0.02, 0.01, 0.4), M.metal, 0.2, 0.04, 0);
    for (const side of [-1, 1]) {
      const limb = add(g, box(0.25, 0.02, 0.025), M.furn, 0.4, 0.03, side * 0.13);
      limb.rotation.y = side * 0.35;
    }
    const string = add(g, box(0.46, 0.003, 0.003), M.dark, 0.32, 0.04, 0, 'string');
    P.string = string;
    P.mag = add(g, cylZ(0.006, 0.42, 6), M.steel, 0.2, 0.05, 0, 'mag');
    add(g, new THREE.ConeGeometry(0.012, 0.04, 6).rotateX(-Math.PI / 2), M.steel, 0.43, 0.05, 0);
    add(g, ext([[-0.035, 0.0], [0.01, 0.0], [-0.01, -0.09], [-0.05, -0.095]], 0.034), M.furn, 0, 0, 0);
    buildStock(g, s, M, 'skeleton', -0.05, 0.035, -0.02);
    P.sightY = 0.07;
    add(g, box(0.02, 0.025, 0.012), M.dark, 0.02, 0.06, 0);
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.05, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.02, -0.25);
    g.add(P.leftHand);
    return 0.45;
  }

  function wonder(g, s, M, P) {
    const frost = s.look.kind === 'frost';
    const glow = std('wglow' + frost, { color: frost ? 0x8fe8ff : 0x39ff9a, basic: true });
    add(g, ext([[-0.05, 0.03], [0.2, 0.03], [0.22, 0.06], [0.2, 0.095], [-0.04, 0.095]], 0.05), M.body, 0, 0, 0);
    for (let i = 0; i < 3; i++) add(g, new THREE.TorusGeometry(0.035, 0.008, 6, 12), glow, 0.08 + i * 0.05, 0.062, 0);
    add(g, cylZ(0.016, 0.08, 8), glow, 0.25, 0.062, 0);
    if (frost) for (let i = 0; i < 3; i++) add(g, new THREE.OctahedronGeometry(0.02), glow, 0.05 + i * 0.06, 0.11, 0);
    add(g, ext([[-0.035, 0.03], [0.01, 0.03], [-0.01, -0.07], [-0.05, -0.075]], 0.034), M.body, 0, 0, 0);
    P.mag = add(g, box(0.03, 0.04, 0.07), glow, -0.02, 0.11, 0, 'mag');
    P.sightY = 0.12;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.025, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(-0.012, -0.04, 0.0);
    g.add(P.leftHand);
    return 0.28;
  }

  function pdw(g, s, M, P) {
    add(g, ext([[-0.2, 0.0], [0.24, 0.0], [0.26, 0.04], [0.24, 0.07], [-0.2, 0.07], [-0.22, 0.03]], 0.054), M.body, 0, -0.01, 0);
    add(g, ext([[-0.2, -0.01], [0.02, -0.01], [0.04, -0.08], [-0.06, -0.085], [-0.08, -0.03], [-0.12, -0.03], [-0.14, -0.09], [-0.2, -0.09]], 0.05), M.furn, 0, 0, 0);
    add(g, cylZ(0.012, 0.08, 8), M.metal, 0.29, 0.02, 0);
    add(g, box(0.03, 0.02, 0.06), M.dark, -0.04, 0.09, 0);
    P.sightY = 0.11;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.06, 0.05);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.05, -0.12);
    g.add(P.leftHand);
    P.mag = add(g, box(0.04, 0.025, 0.24), std('pdwmag', { color: 0x30322a, rough: 0.3, metal: 0.2 }), 0.03, 0.072, 0, 'mag');
    return 0.33;
  }

  function vector(g, s, M, P) {
    add(g, ext([[-0.1, 0.0], [0.2, 0.0], [0.2, 0.06], [-0.1, 0.06]], 0.05), M.body, 0, 0, 0);
    add(g, ext([[0.02, 0.0], [0.2, 0.0], [0.16, -0.08], [0.08, -0.12], [0.02, -0.06]], 0.048), M.furn, 0, 0, 0);
    add(g, ext([[-0.035, 0.0], [0.015, 0.0], [-0.005, -0.1], [-0.045, -0.105]], 0.034), M.furn, 0, 0, 0);
    add(g, cylZ(0.012, 0.12, 8), M.metal, 0.26, 0.03, 0);
    add(g, box(0.024, 0.008, 0.26), M.metal, 0.05, 0.064, 0);
    buildStock(g, s, M, s.noStock ? 'none' : 'skeleton', -0.1, 0.05, -0.01);
    P.sightY = 0.08;
    add(g, box(0.02, 0.022, 0.01), M.dark, -0.08, 0.075, 0);
    add(g, box(0.016, 0.024, 0.01), M.dark, 0.18, 0.075, 0);
    P.mag = add(g, ext([[-0.025, 0], [0.025, 0], [0.028, -0.16], [-0.022, -0.16]], 0.026), M.dark, 0.12, -0.06, 0, 'mag');
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.06, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.06, -0.16);
    g.add(P.leftHand);
    return 0.32;
  }

  // ---------------- Nişangahlar ----------------
  function optic(g, s, M, P, railY, f) {
    const kind = s.att.optic;
    if (!kind) return;
    const o = new THREE.Group();
    let h = 0.03;
    if (kind === 'refleks') {
      add(o, box(0.026, 0.012, 0.035), M.dark, 0, 0.006, 0);
      add(o, box(0.024, 0.024, 0.004), std('reflexglass', { color: 0x3a6a5a, rough: 0.1, metal: 0.6 }), 0.012, 0.024, 0);
      add(o, box(0.003, 0.003, 0.001), M.red, 0.012, 0.022, 0);
      h = 0.022;
    } else if (kind === 'kirmizi') {
      add(o, box(0.028, 0.016, 0.05), M.dark, 0, 0.008, 0);
      add(o, cylZ(0.019, 0.055, 12), M.dark, 0, 0.03, 0);
      add(o, cylZ(0.016, 0.057, 12), M.lens, 0, 0.03, 0);
      add(o, box(0.004, 0.004, 0.001), M.red, -0.02, 0.03, 0);
      h = 0.03;
    } else if (kind === 'holo') {
      add(o, box(0.05, 0.014, 0.08), M.dark, 0, 0.007, 0);
      add(o, box(0.006, 0.05, 0.08), M.dark, 0, 0.03, -0.022);
      add(o, box(0.006, 0.05, 0.08), M.dark, 0, 0.03, 0.022);
      add(o, box(0.05, 0.008, 0.08), M.dark, 0, 0.056, 0);
      add(o, box(0.036, 0.036, 0.003), std('hologlass', { color: 0x406a80, rough: 0.05, metal: 0.7 }), 0.03, 0.03, 0);
      add(o, box(0.004, 0.004, 0.001), M.red, -0.01, 0.03, 0);
      h = 0.03;
    } else if (kind === 'durbun' || kind === 'prizma') {
      const big = kind === 'prizma';
      add(o, box(0.028, 0.02, 0.06), M.dark, 0, 0.01, 0);
      add(o, cylZ(big ? 0.022 : 0.02, big ? 0.13 : 0.16, 12), M.dark, 0, 0.042, 0);
      add(o, cylZ(0.027, 0.03, 12, 0.022), M.dark, big ? 0.07 : 0.085, 0.042, 0);
      if (big) add(o, box(0.04, 0.04, 0.06), M.dark, -0.01, 0.042, 0);
      add(o, box(0.012, 0.012, 0.012), M.dark, 0, 0.068, 0);
      h = 0.042;
    }
    o.position.set(0, railY, -f);
    g.add(o);
    P.sightY = railY + h;
    P.optic = o;
  }

  function sniperScope(g, M, P, railY) {
    const sc = new THREE.Group();
    add(sc, cylZ(0.022, 0.3, 12), M.dark, 0, 0, 0);
    add(sc, cylZ(0.034, 0.08, 12, 0.023), M.dark, 0.17, 0, 0);
    add(sc, cylZ(0.024, 0.06, 12, 0.03), M.dark, -0.15, 0, 0);
    add(sc, cylX(0.014, 0.06, 8), M.dark, 0.02, 0, 0);
    add(sc, box(0.016, 0.03, 0.016), M.dark, 0.02, 0.025, 0);
    for (const f of [-0.06, 0.08]) add(sc, box(0.024, 0.04, 0.02), M.metal, f, -0.03, 0);
    const lens = add(sc, cylZ(0.03, 0.003, 12), M.lens, 0.21, 0, 0);
    lens.name = 'lens';
    sc.position.set(0, railY + 0.05, -0.02);
    g.add(sc);
    P.sightY = railY + 0.05;
  }

  function attachments(g, s, M, P, muzzleF, isPistol) {
    const att = s.att;
    const L = s.look;
    const railY = isPistol ? 0.09 : (L.h || 0.085) * 0.62 + 0.009;
    if (L.scope && !att.optic) sniperScope(g, M, P, railY);
    else optic(g, s, M, P, railY, isPistol ? 0.04 : L.kind === 'bullpup' ? -0.05 : 0.02);
    const my = isPistol ? 0.07 : L.kind === 'launcher' ? 0.09 : 0.02;
    if (att.muzzle === 'susturucu') {
      add(g, cylZ(isPistol ? 0.016 : 0.022, isPistol ? 0.12 : 0.18, 10), M.dark, muzzleF + (isPistol ? 0.06 : 0.09), my, 0);
      muzzleF += isPistol ? 0.12 : 0.18;
    } else if (att.muzzle === 'kompansator') {
      add(g, box(0.034, 0.03, 0.06), M.metal, muzzleF + 0.03, my, 0);
      for (let i = 0; i < 3; i++) add(g, box(0.036, 0.006, 0.01), M.dark, muzzleF + 0.012 + i * 0.016, my + 0.012, 0);
      muzzleF += 0.06;
    } else if (att.muzzle === 'alev') {
      add(g, cylZ(0.016, 0.07, 6), M.dark, muzzleF + 0.035, my, 0);
      muzzleF += 0.07;
    } else if (att.muzzle === 'fren') {
      muzzleF = muzzleDevice(g, M, 'brake', muzzleF, 0.012);
    }
    if (!isPistol && L.guard) {
      const gf = (L.len || 0.36) * 0.58 + L.guard * 0.5;
      if (att.under === 'dikey') {
        add(g, cylZ(0.014, 0.08, 8), M.dark, gf, -0.065, 0).rotation.x = Math.PI / 2;
        if (P.leftHand) P.leftHand.position.set(0, -0.08, -gf);
      } else if (att.under === 'acili') {
        add(g, ext([[0, 0], [0.07, 0], [0.0, -0.045]], 0.03), M.dark, gf - 0.03, -0.02, 0);
      } else if (att.under === 'lazer') {
        add(g, box(0.024, 0.024, 0.06), M.dark, gf, 0.012, 0.038);
        add(g, box(0.006, 0.006, 0.002), M.red, gf + 0.031, 0.012, 0.038);
      }
    }
    if (att.barrel === 'uzun' && !isPistol) {
      add(g, cylZ(0.013, 0.1, 8), M.metal, muzzleF + 0.05, 0.02, 0);
      muzzleF += 0.1;
    }
    return muzzleF;
  }

  // ---------------- Ana kurucu ----------------
  G.buildGun = function (stats, opts) {
    const o = opts || {};
    const L = stats.look || {};
    const M = gunMats(stats);
    const g = new THREE.Group();
    const P = {};
    let muzzleF;
    const k = L.kind;
    const isPistol = k === 'pistol' || k === 'mpistol' || k === 'revolver' || k === 'flare' || k === 'wonder' || k === 'frost';
    if (k === 'pistol' || k === 'mpistol') muzzleF = pistol(g, stats, M, P);
    else if (k === 'revolver') muzzleF = revolver(g, stats, M, P);
    else if (k === 'flare') muzzleF = flareGun(g, stats, M, P);
    else if (k === 'launcher') muzzleF = launcher(g, stats, M, P);
    else if (k === 'gl') muzzleF = grenadeLauncher(g, stats, M, P);
    else if (k === 'double') muzzleF = doubleBarrel(g, stats, M, P);
    else if (k === 'crossbow') muzzleF = crossbow(g, stats, M, P);
    else if (k === 'wonder' || k === 'frost') muzzleF = wonder(g, stats, M, P);
    else if (k === 'pdw') muzzleF = pdw(g, stats, M, P);
    else if (k === 'vector') muzzleF = vector(g, stats, M, P);
    else muzzleF = longGun(g, stats, M, P);
    muzzleF = attachments(g, stats, M, P, muzzleF, isPistol);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, isPistol ? 0.07 : k === 'launcher' ? 0.09 : k === 'double' ? 0.02 : 0.02, -muzzleF - 0.01);
    g.add(muzzle);
    P.muzzle = muzzle;
    if (!P.rightHand) {
      P.rightHand = new THREE.Object3D();
      P.rightHand.position.set(0, -0.05, 0.03);
      g.add(P.rightHand);
    }
    if (!P.leftHand) {
      P.leftHand = new THREE.Object3D();
      P.leftHand.position.set(0, -0.03, -0.2);
      g.add(P.leftHand);
    }
    g.userData = { sightY: P.sightY || 0.1, parts: P, muzzleZ: -muzzleF, isPistol };
    if (o.merge) mergeGroup(g, ['mag', 'bolt', 'pump', 'slide', 'cylinder', 'string', 'fore']);
    if (o.shadow) g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return g;
  };

  // ---------------- Malzemeye göre birleştirme (çizim çağrısı azaltma) ----------------
  function mergeGroup(root, keepNames) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const remove = [];
    root.traverse((obj) => {
      if (!obj.isMesh || obj === root) return;
      // korunan parçaların altındakileri birleştirme
      let p = obj;
      while (p && p !== root) {
        if (keepNames.includes(p.name)) return;
        p = p.parent;
      }
      const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      const mtx = new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
      geo.applyMatrix4(mtx);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
      const key = obj.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat: obj.material, geos: [] });
      buckets.get(key).geos.push(geo);
      remove.push(obj);
    });
    for (const o of remove) o.parent.remove(o);
    for (const { mat, geos } of buckets.values()) {
      let n = 0;
      for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let off = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, off * 3);
        nor.set(g.attributes.normal.array, off * 3);
        uv.set(g.attributes.uv.array, off * 2);
        off += g.attributes.position.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      root.add(new THREE.Mesh(geo, mat));
    }
  }
  G.mergeGroup = mergeGroup;

  // ---------------- Silah simgeleri ve önizleme görüntüleri ----------------
  let iconR = null;
  // Metal yüzeyler için küçük stüdyo ortam haritası (önizleme ve simge çizicileri)
  G.studioEnv = function (renderer) {
    try {
      const sc = new THREE.Scene();
      const geo = new THREE.SphereGeometry(10, 16, 8);
      const cols = [];
      const pos = geo.attributes.position;
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 10;
        if (y > 0.55) c.setRGB(1.6, 1.55, 1.45);
        else if (y > 0) c.setRGB(0.32 + y * 0.6, 0.36 + y * 0.6, 0.4 + y * 0.6);
        else c.setRGB(0.12, 0.11, 0.1);
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.8), side: THREE.DoubleSide }));
      panel.position.set(4, 4, 3);
      panel.lookAt(0, 0, 0);
      sc.add(panel);
      const pm = new THREE.PMREMGenerator(renderer);
      const tex = pm.fromScene(sc, 0.03).texture;
      pm.dispose();
      return tex;
    } catch (e) {
      return null;
    }
  };
  // Saydam görüntünün çevresine 1 piksel koyu kontur (piksel-art görünüm)
  function outline2d(srcCanvas, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.drawImage(srcCanvas, 0, 0, w, h);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const i = xx + yy * w;
        if (a[i]) continue;
        if ((xx > 0 && a[i - 1]) || (xx < w - 1 && a[i + 1]) || (yy > 0 && a[i - w]) || (yy < h - 1 && a[i + w])) {
          d[i * 4] = 8;
          d[i * 4 + 1] = 11;
          d[i * 4 + 2] = 12;
          d[i * 4 + 3] = 255;
        }
      }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  function iconRenderer() {
    if (iconR) return iconR;
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    scene.environment = G.studioEnv(r);
    scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x404038, 1.2));
    const d = new THREE.DirectionalLight(0xfff4e6, 1.3);
    d.position.set(2, 3, 1);
    scene.add(d);
    const rim = new THREE.DirectionalLight(0x9fe8ff, 0.7);
    rim.position.set(-1, 2, -2);
    scene.add(rim);
    const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.01, 10);
    cam.position.set(3, 0, 0);
    cam.lookAt(0, 0, 0);
    iconR = { r, scene, cam };
    return iconR;
  }
  const iconCache = {};
  // mode: 'icon' (beyaz silüet) veya 'thumb' (renkli)
  G.weaponImage = function (id, mode, camo, att) {
    const key = id + ':' + mode + ':' + (camo || '') + ':' + JSON.stringify(att || {});
    if (iconCache[key]) return iconCache[key];
    let url = '';
    try {
      const R = iconRenderer();
      const w = mode === 'icon' ? 128 : 256, h = mode === 'icon' ? 48 : 112;
      R.r.setSize(w, h, false);
      const stats = G.computeStats(id, att || {}, { camo });
      const gun = G.buildGun(stats);
      const holder = new THREE.Group();
      holder.add(gun);
      const box = new THREE.Box3().setFromObject(gun);
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      gun.position.sub(c);
      R.scene.add(holder);
      const aspect = w / h;
      const span = Math.max(size.z, size.y * aspect) * 0.55;
      R.cam.left = -span;
      R.cam.right = span;
      R.cam.top = span / aspect;
      R.cam.bottom = -span / aspect;
      R.cam.updateProjectionMatrix();
      if (mode === 'icon') R.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      R.r.setClearColor(0x000000, 0);
      R.r.render(R.scene, R.cam);
      url = mode === 'icon' ? R.r.domElement.toDataURL('image/png') : outline2d(R.r.domElement, w, h);
      R.scene.overrideMaterial = null;
      R.scene.remove(holder);
    } catch (e) {
      url = '';
    }
    iconCache[key] = url;
    return url;
  };
})();
