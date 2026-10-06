'use strict';
// Gölge Timi — harita giydirme: cephe ayrıntıları, çatı ekipmanları, Türkçe
// tabelalar, pazar tenteleri, bayrak süsleri, kilimler, dağınık dekor ve
// uzak silüetler. Hepsi çarpışmasızdır; oynanışı değiştirmez.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const FACE = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // ---------------- Doku üreticiler ----------------
  const tc = {};
  function canvasTex(key, w, h, draw, nearest) {
    if (tc[key]) return tc[key];
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (nearest !== false) t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (tc[key] = t);
  }
  function signTex(text, o) {
    const key = 'sign:' + text + ':' + JSON.stringify(o);
    return canvasTex(key, o.w || 256, o.h || 64, (ctx, w, h) => {
      ctx.fillStyle = o.bg || '#1d4f8a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = o.border || '#f4f0e0';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      if (o.stripes) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.fillStyle = '#111';
        for (let x = -h; x < w; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x + 12, h);
          ctx.lineTo(x + 12 + h, 0);
          ctx.lineTo(x + h, 0);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = o.bg || '#f2c21b';
        ctx.fillRect(10, 10, w - 20, h - 20);
      }
      ctx.fillStyle = o.color || '#f4f0e0';
      ctx.font = `bold ${o.size || Math.floor(h * 0.48)}px "Pixelify Sans", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 2);
    });
  }
  const kilimTex = () =>
    canvasTex('kilim', 32, 48, (ctx, w, h) => {
      ctx.fillStyle = '#8a1c1c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8c070';
      ctx.fillRect(0, 0, w, 3);
      ctx.fillRect(0, h - 3, w, 3);
      ctx.fillStyle = '#1e3a6a';
      ctx.fillRect(3, 5, w - 6, h - 10);
      ctx.fillStyle = '#c84a2a';
      for (let y = 9; y < h - 8; y += 10) {
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(w / 2 - i, y + i, i * 2 + 1, 1);
          ctx.fillRect(w / 2 - i, y + 10 - i, i * 2 + 1, 1);
        }
      }
      ctx.fillStyle = '#f0e0b0';
      for (let y = 7; y < h - 6; y += 6) {
        ctx.fillRect(5, y, 2, 2);
        ctx.fillRect(w - 7, y, 2, 2);
      }
    });
  const canvasStripeTex = (a, b) =>
    canvasTex('stripe' + a + b, 16, 16, (ctx, w, h) => {
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = (x / 4) % 2 ? a : b;
        ctx.fillRect(x, 0, 4, h);
      }
    });

  // ---------------- Malzemeler ----------------
  const mc = {};
  function vmat(key, o) {
    if (mc[key]) return mc[key];
    const p = Object.assign({ vertexColors: true, roughness: 0.8, metalness: 0.1 }, o || {});
    return (mc[key] = G.settings.quality === 'dusuk' ? new THREE.MeshLambertMaterial({ vertexColors: true, map: p.map || null, side: p.side }) : new THREE.MeshStandardMaterial(p));
  }

  // Basit geometriler
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 10);
  function mtx(x, y, z, ry, sx, sy, sz, rx, rz) {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    return m;
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  // ---------------- Harita tabelaları ----------------
  const SIGNS = {
    liman: [
      { t: 'LİMAN İŞLETMESİ', x: 16, z: 0, f: 'S', y: 3.6, w: 6, h: 1.1, bg: '#1d4f8a' },
      { t: 'DEPO 3', x: 15, z: 10, f: 'N', y: 3.6, w: 2.4, h: 0.8, bg: '#c8a020', color: '#1a1206' },
      { t: 'DİKKAT! FORKLİFT', x: 11, z: 15, f: 'W', y: 2.6, w: 2.6, h: 0.7, bg: '#f2c21b', color: '#111', stripes: true },
      { t: 'ÇAY OCAĞI →', x: 14, z: 19, f: 'S', y: 2.4, w: 2.2, h: 0.6, bg: '#7a2a14' },
      { t: 'RIHTIM B', x: 1, z: 28, f: 'E', y: 0.9, w: 1.6, h: 0.5, bg: '#2a2a2a' },
      { t: 'GÜMRÜK', x: 22, z: 18, f: 'E', y: 3.0, w: 2.0, h: 0.6, bg: '#8a1a1a' },
    ],
    col: [
      { t: 'BAKKAL', x: 4, z: 7, f: 'S', y: 3.2, w: 2.2, h: 0.7, bg: '#2a6a3a' },
      { t: 'KAHVEHANE', x: 29, z: 7, f: 'S', y: 3.2, w: 2.6, h: 0.7, bg: '#6a3a1a' },
      { t: 'ECZANE', x: 8, z: 14, f: 'E', y: 3.0, w: 2.0, h: 0.7, bg: '#b01a2a' },
      { t: 'KONAK', x: 14, z: 17, f: 'N', y: 3.6, w: 2.2, h: 0.7, bg: '#3a2a5a' },
      { t: 'ÇAY BAHÇESİ', x: 12, z: 25, f: 'S', y: 3.0, w: 2.8, h: 0.7, bg: '#7a2a14' },
      { t: 'BERBER', x: 25, z: 12, f: 'W', y: 3.0, w: 2.0, h: 0.6, bg: '#1d4f8a' },
      { t: 'PTT', x: 2, z: 24, f: 'E', y: 3.0, w: 1.4, h: 0.6, bg: '#f2c21b', color: '#1a3a8a' },
    ],
    us: [
      { t: 'HANGAR 2', x: 17, z: 3, f: 'N', y: 3.8, w: 3.0, h: 0.9, bg: '#2a2a2a', color: '#f2c21b' },
      { t: 'KIŞLA A', x: 9, z: 22, f: 'N', y: 3.4, w: 2.2, h: 0.7, bg: '#3a4430' },
      { t: 'KIŞLA B', x: 25, z: 22, f: 'N', y: 3.4, w: 2.2, h: 0.7, bg: '#3a4430' },
      { t: 'YÜKSEK GERİLİM', x: 3, z: 6, f: 'W', y: 2.4, w: 2.4, h: 0.6, bg: '#f2c21b', color: '#111', stripes: true },
      { t: 'GÜVENLİK NOKTASI', x: 32, z: 6, f: 'E', y: 2.6, w: 2.8, h: 0.6, bg: '#8a1a1a' },
    ],
    tesis: [
      { t: 'BİYOLOJİK TEHLİKE', x: 18, z: 20, f: 'S', y: 3.6, w: 3.4, h: 0.7, bg: '#f2c21b', color: '#111', stripes: true },
      { t: 'LAB-B2', x: 25, z: 30, f: 'N', y: 3.2, w: 1.8, h: 0.6, bg: '#e0e4e8', color: '#1a3a5a' },
      { t: 'ÇAY OCAĞI', x: 12, z: 17, f: 'E', y: 3.0, w: 2.0, h: 0.6, bg: '#7a2a14' },
      { t: 'GİRİŞ SALONU', x: 7, z: 21, f: 'N', y: 3.4, w: 3.0, h: 0.6, bg: '#2a3a4a' },
      { t: 'ACİL ÇIKIŞ', x: 17, z: 13, f: 'S', y: 3.2, w: 2.0, h: 0.5, bg: '#1a8a3a' },
      { t: 'KARANTİNA', x: 33, z: 25, f: 'W', y: 3.0, w: 2.4, h: 0.6, bg: '#8a1a1a' },
    ],
    poligon: [
      { t: 'ATIŞ POLİGONU', x: 12, z: 51, f: 'N', y: 3.8, w: 5, h: 1.0, bg: '#3a4430' },
      { t: 'GÖZ-KULAK KORUYUCU TAKINIZ', x: 0, z: 46, f: 'E', y: 2.6, w: 4.4, h: 0.6, bg: '#f2c21b', color: '#111' },
    ],
  };

  function placeSigns(world) {
    const list = SIGNS[world.def.id] || [];
    for (const s of list) {
      const f = FACE[s.f];
      const tex = signTex(s.t, { bg: s.bg, color: s.color, stripes: s.stripes, w: 256, h: Math.round((256 * s.h) / s.w) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: world.theme.night ? 0x222222 : 0x000000, emissiveMap: world.theme.night ? tex : null }));
      const cx = s.x * CELL + 1, cz = s.z * CELL + 1;
      m.position.set(cx + f[0] * 1.02, s.y, cz + f[1] * 1.02);
      m.rotation.y = Math.atan2(f[0], f[1]);
      world.group.add(m);
    }
  }

  // ---------------- Cephe ve çatı ----------------
  function facades(world, B) {
    const rnd = U.seeded(world.def.id.length * 977 + 13);
    // bina duvarlarının üstüne korniş, altına süpürgelik
    for (const r of world.mergeRects(new Set(['H']))) {
      const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
      B.trim.addGeo(BOX, mtx((x0 + x1) / 2, 4.72, (z0 + z1) / 2, 0, x1 - x0 + 0.16, 0.16, z1 - z0 + 0.16), 0x8a8478);
      B.trim.addGeo(BOX, mtx((x0 + x1) / 2, 0.14, (z0 + z1) / 2, 0, x1 - x0 + 0.06, 0.28, z1 - z0 + 0.06), 0x5a5650);
    }
    // pencere pervazları
    for (let z = 0; z < world.h; z++)
      for (let x = 0; x < world.w; x++) {
        if (world.rows[z][x] !== '=') continue;
        const cx = x * CELL + 1, cz = z * CELL + 1;
        const alongX = world.at(x - 1, z) !== '.' && world.at(x - 1, z) !== ',' ? world.at(x - 1, z) === 'H' || world.at(x + 1, z) === 'H' : world.at(x + 1, z) === 'H';
        const sx = alongX ? 2 : 2.12, sz = alongX ? 2.12 : 2;
        B.trim.addGeo(BOX, mtx(cx, 2.2, cz, 0, sx, 0.08, sz), 0x4a3a2a);
        B.trim.addGeo(BOX, mtx(cx, 1.0, cz, 0, sx, 0.08, sz), 0x4a3a2a);
        if (alongX) {
          B.trim.addGeo(BOX, mtx(x * CELL + 0.05, 1.6, cz, 0, 0.1, 1.2, 2.12), 0x4a3a2a);
          B.trim.addGeo(BOX, mtx(x * CELL + 1.95, 1.6, cz, 0, 0.1, 1.2, 2.12), 0x4a3a2a);
        } else {
          B.trim.addGeo(BOX, mtx(cx, 1.6, z * CELL + 0.05, 0, 2.12, 1.2, 0.1), 0x4a3a2a);
          B.trim.addGeo(BOX, mtx(cx, 1.6, z * CELL + 1.95, 0, 2.12, 1.2, 0.1), 0x4a3a2a);
        }
      }
    // çatılar: klima, su deposu, çanak anten
    const saved = world.rows;
    world.rows = saved.map((row, z) => row.map((ch, x) => (world.indoor[x + z * world.w] ? '§' : ch)));
    const roofs = world.mergeRects(new Set(['§']));
    world.rows = saved;
    for (const r of roofs) {
      const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
      for (const [px, pz, sx, sz] of [[(x0 + x1) / 2, z0 - 0.05, x1 - x0 + 0.2, 0.1], [(x0 + x1) / 2, z1 + 0.05, x1 - x0 + 0.2, 0.1], [x0 - 0.05, (z0 + z1) / 2, 0.1, z1 - z0], [x1 + 0.05, (z0 + z1) / 2, 0.1, z1 - z0]]) {
        B.trim.addGeo(BOX, mtx(px, 5.0, pz, 0, sx, 0.4, sz), 0x6a6458);
      }
      const n = Math.max(1, Math.floor((r.w * r.h) / 10));
      for (let i = 0; i < n; i++) {
        const x = U.lerp(x0 + 1, x1 - 1, rnd()), z = U.lerp(z0 + 1, z1 - 1, rnd());
        const k = rnd();
        if (k < 0.5) {
          B.metal.addGeo(BOX, mtx(x, 5.15, z, rnd() * 0.3, 1.1, 0.7, 0.8), 0x9aa0a4);
          B.metal.addGeo(cyl(0.25, 0.25, 0.04, 10), mtx(x, 5.51, z, 0), 0x3a3d40);
        } else if (k < 0.8) {
          B.metal.addGeo(cyl(0.5, 0.5, 1.1, 12), mtx(x, 5.6, z, 0), world.theme.palms ? 0xd8d4c8 : 0x8a9096);
          for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) B.metal.addGeo(BOX, mtx(x + dx, 5.0, z + dz, 0, 0.06, 0.5, 0.06), 0x3a3d40);
        } else {
          B.metal.addGeo(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), mtx(x, 5.3, z, rnd() * 6, 1, 1, 1, -1.0), 0xd8dce0);
          B.metal.addGeo(BOX, mtx(x, 5.05, z, 0, 0.06, 0.5, 0.06), 0x3a3d40);
        }
      }
    }
    // konteyner kapı çubukları
    for (const r of world.mergeRects(new Set(['K']))) {
      const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
      const long = r.w >= r.h;
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        if (long) B.metal.addGeo(BOX, mtx(x1 - 0.02, 1.3, U.lerp(z0 + 0.1, z1 - 0.1, t), 0, 0.06, 2.4, 0.05), 0x3a3d40);
        else B.metal.addGeo(BOX, mtx(U.lerp(x0 + 0.1, x1 - 0.1, t), 1.3, z1 - 0.02, 0, 0.05, 2.4, 0.06), 0x3a3d40);
      }
    }
  }

  // ---------------- Dağınık dekor ----------------
  function scatter(world, B) {
    const T = world.theme;
    const id = world.def.id;
    const rnd = U.seeded(id.length * 4111 + 3);
    const spawnCells = new Set();
    for (const t of ['A', 'B', 'start', 'flag']) for (const p of world.points[t] || []) spawnCells.add(p.x + ',' + p.z);
    const free = [];
    for (let z = 1; z < world.h - 1; z++)
      for (let x = 1; x < world.w - 1; x++) {
        const ch = world.rows[z][x];
        if ((ch === '.' || ch === ',') && !spawnCells.has(x + ',' + z)) free.push([x, z, ch === ',']);
      }
    const count = Math.min(free.length, Math.round(free.length * 0.12));
    for (let i = 0; i < count; i++) {
      const [cx, cz, indoor] = free[Math.floor(rnd() * free.length)];
      const x = cx * CELL + 0.3 + rnd() * 1.4, z = cz * CELL + 0.3 + rnd() * 1.4;
      const k = rnd();
      if (indoor) {
        if ((id === 'col' || id === 'liman') && k < 0.35) {
          B.kilim.addGeo(new THREE.PlaneGeometry(1.2, 1.8), mtx(cx * CELL + 1, 0.035, cz * CELL + 1, rnd() < 0.5 ? 0 : Math.PI / 2, 1, 1, 1, -Math.PI / 2), 0xffffff);
        } else if (id === 'tesis' && k < 0.4) {
          B.decal.addGeo(new THREE.PlaneGeometry(0.9, 0.9), mtx(x, 0.04, z, rnd() * 6, 1, 1, 1, -Math.PI / 2), 0x6a0a0a);
        } else if (k < 0.7) {
          B.plain.addGeo(new THREE.PlaneGeometry(0.3, 0.22), mtx(x, 0.035, z, rnd() * 6, 1, 1, 1, -Math.PI / 2), 0xd8d4c4);
        } else {
          B.plain.addGeo(BOX, mtx(x, 0.12, z, rnd() * 6, 0.35, 0.24, 0.28), 0x6a5a3a);
        }
        continue;
      }
      if (T.palms || id === 'poligon') {
        if (k < 0.45) {
          for (let j = 0; j < 3; j++) B.plain.addGeo(new THREE.PlaneGeometry(0.35, 0.3), mtx(x, 0.15, z, j * 1.05 + rnd(), 1, 1, 1), id === 'poligon' ? 0x6a8a3a : 0xa89a5a);
        } else if (k < 0.7) {
          B.plain.addGeo(new THREE.DodecahedronGeometry(0.22, 0), mtx(x, 0.1, z, rnd() * 6, 1, 0.6, 1), 0x8a7a62);
        } else if (k < 0.85 && id === 'col') {
          B.plain.addGeo(cyl(0.16, 0.12, 0.4, 8), mtx(x, 0.2, z, 0), 0xb0663a);
        } else {
          B.plain.addGeo(BOX, mtx(x, 0.06, z, rnd() * 6, 0.5, 0.12, 0.4), 0x7a6a52);
        }
      } else {
        if (k < 0.25) {
          B.rubber.addGeo(new THREE.TorusGeometry(0.32, 0.12, 6, 12), mtx(x, 0.12, z, 0, 1, 1, 1, Math.PI / 2), 0x1a1a1a);
          if (rnd() < 0.5) B.rubber.addGeo(new THREE.TorusGeometry(0.32, 0.12, 6, 12), mtx(x, 0.36, z, 0, 1, 1, 1, Math.PI / 2), 0x1a1a1a);
        } else if (k < 0.4) {
          B.plain.addGeo(new THREE.ConeGeometry(0.18, 0.55, 8), mtx(x, 0.28, z, 0), 0xe8601a);
          B.plain.addGeo(BOX, mtx(x, 0.02, z, 0, 0.36, 0.04, 0.36), 0x1a1a1a);
        } else if (k < 0.6) {
          for (let j = 0; j < 3; j++) B.wood.addGeo(BOX, mtx(x, 0.05 + j * 0.06, z, 0.1, 1.2, 0.04, 0.12 + (j % 2) * 0.9), 0x9a7a52);
        } else if (k < 0.85) {
          B.decal.addGeo(new THREE.CircleGeometry(0.6 + rnd() * 0.6, 10), mtx(x, 0.03, z, 0, 1.4, 1, 1, -Math.PI / 2), T.rain || T.night ? 0x10141a : 0x1a1814);
        } else {
          B.plain.addGeo(BOX, mtx(x, 0.18, z, rnd() * 6, 0.4, 0.36, 0.3), 0x2a3a2a);
        }
      }
    }
  }

  // ---------------- Haritaya özel süsler ----------------
  function specials(world, B) {
    const id = world.def.id;
    const group = world.group;
    if (id === 'col') {
      // pazar tenteleri
      const colors = [['#c83a2a', '#f0e0b0'], ['#2a6a9a', '#f0e0b0'], ['#e8a020', '#8a2a1a']];
      const stalls = [[12.5, 3], [20.5, 3]];
      stalls.forEach(([sx, sz], i) => {
        const tex = canvasStripeTex(colors[i % 3][0], colors[i % 3][1]);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
        m.position.set(sx * CELL + 1, 2.5, sz * CELL + 1);
        m.rotation.set(-Math.PI / 2 + 0.18, 0, 0);
        m.castShadow = true;
        group.add(m);
        for (const [dx, dz] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) B.wood.addGeo(BOX, mtx(sx * CELL + 1 + dx, 1.25, sz * CELL + 1 + dz, 0, 0.08, 2.5, 0.08), 0x7a5a32);
      });
      // sokak boyunca bayrak süsleri
      const lines = [[[10.5, 4.6, 8], [23, 4.6, 8]], [[8.5, 4.6, 15], [25, 4.6, 15]], [[11, 4.6, 26], [22, 4.6, 26]]];
      const fcols = [0xc83a2a, 0xf0e0b0, 0x2a6a9a, 0xe8a020, 0x3a8a3a];
      for (const [a, b] of lines) {
        const A = new THREE.Vector3(a[0] * CELL, a[1], a[2] * CELL), Bv = new THREE.Vector3(b[0] * CELL, b[1], b[2] * CELL);
        const n = Math.round(A.distanceTo(Bv) / 0.8);
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const p = A.clone().lerp(Bv, t);
          p.y -= Math.sin(t * Math.PI) * 0.8;
          B.plain.addGeo(BOX, mtx(p.x, p.y, p.z, Math.atan2(Bv.x - A.x, Bv.z - A.z), 0.02, 0.02, 0.82), 0x222222);
          if (i < n) B.cloth.addGeo(new THREE.ConeGeometry(0.18, 0.4, 3), mtx(p.x, p.y - 0.22, p.z, Math.atan2(Bv.x - A.x, Bv.z - A.z) + Math.PI / 2, 1, 1, 0.15, Math.PI), fcols[i % fcols.length]);
        }
      }
      // uzakta minare ve kubbe silüeti
      const mx = world.sizeX / 2 + 80, mz = -60;
      B.far.addGeo(cyl(2.2, 2.6, 34, 12), mtx(mx, 17, mz, 0), 0xd8c8a8);
      B.far.addGeo(cyl(2.8, 2.8, 1.2, 12), mtx(mx, 28, mz, 0), 0xc8b898);
      B.far.addGeo(new THREE.ConeGeometry(2.2, 7, 12), mtx(mx, 37.5, mz, 0), 0x6a8aa0);
      B.far.addGeo(new THREE.SphereGeometry(12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mtx(mx - 22, 10, mz - 6, 0), 0xd0c0a0);
      B.far.addGeo(BOX, mtx(mx - 22, 5, mz - 6, 0, 26, 10, 26), 0xd8c8a8);
    }
    if (id === 'liman' || id === 'us') {
      // elektrik direkleri ve teller (çevre dışı)
      const z = id === 'liman' ? -8 : world.sizeZ + 10;
      let prev = null;
      for (let x = -10; x <= world.sizeX + 10; x += 14) {
        B.wood.addGeo(cyl(0.14, 0.18, 9, 6), mtx(x, 4.5, z, 0), 0x5a4a3a);
        B.wood.addGeo(BOX, mtx(x, 8.4, z, 0, 2.2, 0.12, 0.12), 0x5a4a3a);
        const top = new THREE.Vector3(x, 8.4, z);
        if (prev) {
          for (const off of [-0.9, 0.9]) {
            for (let i = 0; i < 10; i++) {
              const t0 = i / 10, t1 = (i + 1) / 10;
              const p0 = prev.clone().lerp(top, t0), p1 = prev.clone().lerp(top, t1);
              p0.x += off;
              p1.x += off;
              p0.y -= Math.sin(t0 * Math.PI) * 0.9;
              p1.y -= Math.sin(t1 * Math.PI) * 0.9;
              const mid = p0.clone().add(p1).multiplyScalar(0.5);
              const len = p0.distanceTo(p1);
              const m = new THREE.Matrix4().lookAt(p0, p1, new THREE.Vector3(0, 1, 0));
              m.setPosition(mid);
              m.scale(new THREE.Vector3(0.03, 0.03, len));
              B.plain.addGeo(BOX, m, 0x111111);
            }
          }
        }
        prev = top;
      }
    }
    if (id === 'us' || id === 'liman') {
      // uzak şehir silüeti, ışıklı pencereler
      const night = world.theme.night;
      const rnd = U.seeded(99);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI - Math.PI;
        const r = Math.max(world.sizeX, world.sizeZ) * 1.6;
        const x = world.sizeX / 2 + Math.cos(a) * r, z = world.sizeZ / 2 + Math.sin(a) * r * 0.6 - 40;
        const h = 18 + rnd() * 40, w = 10 + rnd() * 10;
        B.far.addGeo(BOX, mtx(x, h / 2, z, rnd(), w, h, w), night ? 0x141820 : 0x6a6a70);
        if (night || id === 'liman') {
          for (let k = 0; k < 14; k++) {
            if (rnd() < 0.5) continue;
            B.glow.addGeo(new THREE.PlaneGeometry(0.9, 0.7), mtx(x, 2 + rnd() * (h - 4), z + w / 2 + 0.05, 0, 1, 1, 1), 0xffd890);
          }
        }
      }
    }
    if (id === 'tesis') {
      // tavan lambaları ve kan izleri duvarlarda
      const rnd = U.seeded(5);
      for (let z = 0; z < world.h; z++)
        for (let x = 0; x < world.w; x++) {
          if (!world.indoor[x + z * world.w] || (x + z) % 5) continue;
          B.glow.addGeo(BOX, mtx(x * CELL + 1, 4.46, z * CELL + 1, 0, 1.2, 0.06, 0.25), rnd() < 0.25 ? 0x3a3020 : 0xdfe8d8);
        }
    }
  }

  G.Props = {
    dress(world) {
      const B = {
        trim: new G.Bucket(),
        metal: new G.Bucket(),
        plain: new G.Bucket(),
        rubber: new G.Bucket(),
        wood: new G.Bucket(),
        decal: new G.Bucket(),
        kilim: new G.Bucket(),
        cloth: new G.Bucket(),
        far: new G.Bucket(),
        glow: new G.Bucket(),
      };
      facades(world, B);
      scatter(world, B);
      specials(world, B);
      const mats = {
        trim: vmat('p-trim', { map: G.texture(world.theme.building), roughness: 0.9 }),
        metal: vmat('p-metal', { metalness: 0.45, roughness: 0.55 }),
        plain: vmat('p-plain', { roughness: 0.85, side: THREE.DoubleSide }),
        rubber: vmat('p-rubber', { roughness: 0.95 }),
        wood: vmat('p-wood', { map: G.texture('ahsap'), roughness: 0.85 }),
        decal: vmat('p-decal', { transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }),
        kilim: vmat('p-kilim', { map: kilimTex(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }),
        cloth: vmat('p-cloth', { roughness: 0.9, side: THREE.DoubleSide }),
        far: vmat('p-far', { roughness: 1 }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
      };
      for (const k in B) {
        const m = B[k].mesh(mats[k], k !== 'decal' && k !== 'kilim' && k !== 'glow' && k !== 'far');
        if (m) world.group.add(m);
      }
      placeSigns(world);
    },
  };
})();
