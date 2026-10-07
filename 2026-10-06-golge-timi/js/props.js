'use strict';
// Gölge Timi — harita giydirme (v3 "tatlı" oyuncak kutusu görünümü): yuvarlak
// ağaçlar, çalılar, çiçek tarhları, beyaz çitler, balonlar, pastel flamalar,
// çizgili tenteler, banklar, sevimli lambalar, uzak pastel silüetler ve yuvarlak
// Türkçe tabelalar. Hepsi çarpışmasızdır; oynanışı değiştirmez. Telefonlarda
// çizim çağrısı az olsun diye her şey birkaç kovada (G.Bucket) birleştirilir.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const FACE = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // ---------------- Palet ----------------
  const C = {
    ink: 0x3b2a4a, cream: 0xfffaf3, white: 0xffffff,
    mint: 0xa8e6cf, peach: 0xffd3b6, pink: 0xffaaa5, butter: 0xfff1a8, lilac: 0xcdb4ff, sky: 0x9ad7ff,
    coral: 0xff8b94, tang: 0xffb347, teal: 0x4ecdc4,
    bubble: 0xff6fa8, sun: 0xffd23f, mintUI: 0x3ddc97, skyUI: 0x4cc3ff, red: 0xff6b6b, purple: 0x9b5de5,
    grass: 0x7ed957, grassD: 0x5bbf3a, sand: 0xffd99a, wood: 0xe8a970, woodD: 0xc07f52,
    leaf: 0x6fd35a, leafD: 0x4cb84a, rose: 0xff9ad5,
  };
  const CANDY = [C.coral, C.sun, C.mintUI, C.skyUI, C.lilac, C.bubble, C.tang, C.teal];
  const PASTEL = [C.mint, C.peach, C.pink, C.butter, C.lilac, C.sky];
  const FLOWERS = [C.bubble, C.sun, C.white, C.lilac, C.coral, C.skyUI, C.rose];

  // Rengi beyaza (k>0) ya da mürekkebe (k<0) doğru kaydır
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function tint(hex, k) {
    _ca.setHex(hex);
    _cb.setHex(k > 0 ? 0xffffff : C.ink);
    return _ca.lerp(_cb, Math.abs(k)).getHex();
  }
  const css = (hex) => '#' + (hex >>> 0).toString(16).padStart(6, '0');

  // ---------------- Matris yardımcıları ----------------
  // Sıra YXZ: önce yerel yuvarlanma (rz), sonra eğim (rx), en son yön (ry).
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function mtx(x, y, z, ry, sx, sy, sz, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx == null ? 1 : sx, sy == null ? sx == null ? 1 : sx : sy, sz == null ? sx == null ? 1 : sx : sz));
  }
  // a → b doğrusu boyunca uzanan kutu (ip, tel, çubuk)
  const _up = new THREE.Vector3(0, 1, 0), _side = new THREE.Vector3(1, 0, 0), _d = new THREE.Vector3();
  function segMtx(a, b, t) {
    const m = new THREE.Matrix4();
    const len = _d.copy(b).sub(a).length() || 1e-4;
    m.lookAt(a, b, Math.abs(_d.y) > len * 0.98 ? _side : _up);
    m.scale(_s.set(t, t, len));
    m.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return m;
  }

  // ---------------- Geometri şablonları (bir kez kurulur) ----------------
  let TP = null;
  function tpl() {
    if (TP) return TP;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3));
    tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    // dik üçgen yelken: direk kenarı x=0 boyunca
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0.06, 0, 0, 1, 0], 3));
    sail.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    TP = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sph: new THREE.IcosahedronGeometry(1, 1), // yumuşak top (80 üçgen)
      blob: new THREE.SphereGeometry(1, 7, 5), // küçük yumuşak top (56 üçgen)
      ball: new THREE.SphereGeometry(1, 10, 7),
      dot: new THREE.IcosahedronGeometry(1, 0), // küçük meyve / çakıl
      cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
      cyl8: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
      cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
      petal: new THREE.CylinderGeometry(1, 1, 1, 5),
      cone: new THREE.ConeGeometry(1, 1, 10),
      cone4: new THREE.ConeGeometry(1, 1, 4),
      stem: new THREE.CylinderGeometry(1, 1, 1, 3, 1, true),
      quad: new THREE.PlaneGeometry(1, 1),
      rope: new THREE.CylinderGeometry(1, 1, 1, 3, 1, true).rotateX(Math.PI / 2), // segMtx için z ekseni boyunca
      dome: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      cap: new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      torus: new THREE.TorusGeometry(1, 0.3, 6, 14),
      tri,
      sail,
    };
    return TP;
  }

  // Normal ortalaması: aynı konumdaki köşeleri yumuşat (pahlı kutular yastık gibi dursun)
  function smoothNormals(geo) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const acc = new Map();
    const key = (i) => Math.round(pos.getX(i) * 1000) + ',' + Math.round(pos.getY(i) * 1000) + ',' + Math.round(pos.getZ(i) * 1000);
    for (let i = 0; i < pos.count; i++) {
      const k = key(i);
      const a = acc.get(k) || [0, 0, 0];
      a[0] += nor.getX(i);
      a[1] += nor.getY(i);
      a[2] += nor.getZ(i);
      acc.set(k, a);
    }
    for (let i = 0; i < pos.count; i++) {
      const a = acc.get(key(i));
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
    }
    nor.needsUpdate = true;
    return geo;
  }
  function rrShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // Yuvarlak köşeli, pahlı kutu (merkezli). Ölçüye göre önbelleklenir.
  const rbCache = {};
  function roundBox(w, h, d, r) {
    const k = [w, h, d, r].map((v) => v.toFixed(3)).join('|');
    if (rbCache[k]) return rbCache[k];
    const bev = Math.max(0.004, Math.min(r * 0.55, d * 0.3, w * 0.2, h * 0.2));
    const rr = Math.max(0.002, Math.min(r, w / 2 - bev - 0.001, h / 2 - bev - 0.001));
    const depth = Math.max(0.002, d - bev * 2);
    const g = new THREE.ExtrudeGeometry(rrShape(w - bev * 2, h - bev * 2, rr), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    smoothNormals(g);
    return (rbCache[k] = g);
  }
  // Alt yarım daire (tente fistosu), kalınlıklı
  const scCache = {};
  function scallop(r, d) {
    const k = r.toFixed(3) + '|' + d.toFixed(3);
    if (scCache[k]) return scCache[k];
    const s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.absarc(0, 0, r, Math.PI, Math.PI * 2, false);
    s.lineTo(-r, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 5 });
    g.translate(0, 0, -d / 2);
    smoothNormals(g);
    return (scCache[k] = g);
  }
  // Yıldız (düz, kalınlıklı)
  const stCache = {};
  function starGeo(r, d) {
    const k = r.toFixed(3) + '|' + d.toFixed(3);
    if (stCache[k]) return stCache[k];
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.48 : r;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    const bev = d * 0.35;
    const g = new THREE.ExtrudeGeometry(s, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 1 });
    g.translate(0, 0, -(d - bev * 2) / 2);
    return (stCache[k] = g);
  }

  // ---------------- Malzemeler ----------------
  const toon = (key, p) => (G.toonMat ? G.toonMat(key, p) : new THREE.MeshLambertMaterial(p));
  let glowMat = null, glowFogMat = null;
  function mats() {
    if (!glowMat) {
      glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      glowFogMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    }
    return {
      solid: toon('pr-solid', { vertexColors: true }),
      soft: toon('pr-soft', { vertexColors: true, side: THREE.DoubleSide }),
      far: toon('pr-far', { vertexColors: true }),
      balloon: toon('pr-balloon', { vertexColors: true, emissive: 0x1c1428 }),
      glow: glowMat,
      glowNear: glowFogMat,
    };
  }

  // ---------------- Yazı tipi hazır olunca yeniden çiz ----------------
  const FONT = '"Baloo 2", "Nunito", sans-serif';
  function onFonts(fn) {
    try {
      if (!document.fonts || !document.fonts.load) return;
      Promise.all([document.fonts.load('800 40px "Baloo 2"'), document.fonts.load('800 40px "Nunito"')]).then(
        () => {
          try {
            if (document.fonts.check('800 40px "Baloo 2"') || document.fonts.check('800 40px "Nunito"')) fn();
          } catch (e) { /* yoksay */ }
        },
        () => {}
      );
    } catch (e) { /* yoksay */ }
  }
  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fitFont(ctx, text, maxW, size, weight) {
    let s = Math.max(10, Math.floor(size));
    ctx.font = `${weight || 800} ${s}px ${FONT}`;
    while (s > 10 && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = `${weight || 800} ${s}px ${FONT}`;
    }
    return s;
  }
  function starPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function heartPath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
    ctx.closePath();
  }
  // Sevimli tabela yüzü: yuvarlak pano, dikiş çizgisi, beyaz yazı + mürekkep kontur
  function drawBoard(ctx, x, y, w, h, o) {
    const bg = o.bg;
    const r = Math.min(h * 0.42, 46);
    ctx.save();
    ctx.fillStyle = css(tint(bg, -0.35));
    rrPath(ctx, x + 2, y + 2, w - 4, h - 4, r);
    ctx.fill();
    ctx.fillStyle = css(bg);
    rrPath(ctx, x + 2, y + 2, w - 4, h - 4 - Math.max(4, h * 0.07), r);
    ctx.fill();
    if (o.stripes) {
      ctx.save();
      rrPath(ctx, x + 2, y + 2, w - 4, h - 4 - Math.max(4, h * 0.07), r);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let sx = x - h; sx < x + w + h; sx += h * 0.5) {
        ctx.beginPath();
        ctx.moveTo(sx, y + h);
        ctx.lineTo(sx + h * 0.25, y + h);
        ctx.lineTo(sx + h * 1.25, y);
        ctx.lineTo(sx + h, y);
        ctx.fill();
      }
      ctx.fillStyle = css(bg);
      rrPath(ctx, x + h * 0.16, y + h * 0.16, w - h * 0.32, h - h * 0.4, r * 0.6);
      ctx.fill();
      ctx.restore();
    }
    // üst parlama
    const g = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.38)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    rrPath(ctx, x + 8, y + 6, w - 16, h * 0.5, r * 0.8);
    ctx.fill();
    // dikiş çizgisi
    const inset = Math.max(7, h * 0.11);
    ctx.setLineDash([Math.max(6, h * 0.1), Math.max(5, h * 0.08)]);
    ctx.lineWidth = Math.max(2.5, h * 0.035);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    rrPath(ctx, x + inset, y + inset * 0.9, w - inset * 2, h - inset * 1.9 - Math.max(4, h * 0.07), r * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
    // yanlarda küçük yıldız / kalp
    const deco = h * 0.13;
    const cy = y + (h - Math.max(4, h * 0.07)) / 2;
    const room = w > h * 2.6;
    if (room) {
      ctx.fillStyle = o.deco || '#ffffff';
      (o.heart ? heartPath : starPath)(ctx, x + inset + deco * 1.7, cy, deco);
      ctx.fill();
      (o.heart ? heartPath : starPath)(ctx, x + w - inset - deco * 1.7, cy, deco);
      ctx.fill();
    }
    // yazı
    const pad = room ? inset + deco * 3.0 : inset * 1.4;
    const size = fitFont(ctx, o.text, w - pad * 2, Math.min(h * 0.6, 120));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.24);
    ctx.strokeStyle = css(C.ink);
    ctx.strokeText(o.text, x + w / 2, cy + size * 0.06);
    ctx.fillStyle = o.color || '#ffffff';
    ctx.fillText(o.text, x + w / 2, cy + size * 0.06);
    ctx.restore();
  }

  // ---------------- Harita tabelaları ----------------
  const SIGNS = {
    liman: [
      { t: 'LİMAN İŞLETMESİ', x: 16, z: 0, f: 'S', y: 3.6, w: 6, h: 1.1, bg: C.skyUI },
      { t: 'DEPO 3', x: 15, z: 10, f: 'N', y: 3.6, w: 2.4, h: 0.8, bg: C.sun },
      { t: 'DİKKAT! FORKLİFT', x: 11, z: 15, f: 'W', y: 2.6, w: 2.6, h: 0.7, bg: C.tang, stripes: true },
      { t: 'ÇAY OCAĞI →', x: 14, z: 19, f: 'S', y: 2.4, w: 2.2, h: 0.6, bg: 0xff9a62, heart: true },
      { t: 'RIHTIM B', x: 1, z: 28, f: 'E', y: 0.9, w: 1.6, h: 0.5, bg: C.teal },
      { t: 'GÜMRÜK', x: 22, z: 18, f: 'E', y: 3.0, w: 2.0, h: 0.6, bg: C.red },
    ],
    col: [
      { t: 'BAKKAL', x: 4, z: 7, f: 'S', y: 3.2, w: 2.2, h: 0.7, bg: C.mintUI },
      { t: 'KAHVEHANE', x: 29, z: 7, f: 'S', y: 3.2, w: 2.6, h: 0.7, bg: 0xe58a5a, heart: true },
      { t: 'ECZANE', x: 8, z: 14, f: 'E', y: 3.0, w: 2.0, h: 0.7, bg: C.red },
      { t: 'KONAK', x: 14, z: 17, f: 'N', y: 3.6, w: 2.2, h: 0.7, bg: C.purple },
      { t: 'ÇAY BAHÇESİ', x: 12, z: 25, f: 'S', y: 3.0, w: 2.8, h: 0.7, bg: 0xff9a62, heart: true },
      { t: 'BERBER', x: 25, z: 12, f: 'W', y: 3.0, w: 2.0, h: 0.6, bg: C.skyUI, stripes: true },
      { t: 'PTT', x: 2, z: 24, f: 'E', y: 3.0, w: 1.4, h: 0.6, bg: C.sun },
    ],
    us: [
      { t: 'HANGAR 2', x: 17, z: 3, f: 'N', y: 3.8, w: 3.0, h: 0.9, bg: C.purple },
      { t: 'KIŞLA A', x: 9, z: 22, f: 'N', y: 3.4, w: 2.2, h: 0.7, bg: C.teal },
      { t: 'KIŞLA B', x: 25, z: 22, f: 'N', y: 3.4, w: 2.2, h: 0.7, bg: C.bubble },
      { t: 'YÜKSEK GERİLİM', x: 3, z: 6, f: 'W', y: 2.4, w: 2.4, h: 0.6, bg: C.sun, stripes: true },
      { t: 'GÜVENLİK NOKTASI', x: 32, z: 6, f: 'E', y: 2.6, w: 2.8, h: 0.6, bg: C.red },
    ],
    tesis: [
      { t: 'BİYOLOJİK TEHLİKE', x: 18, z: 20, f: 'S', y: 3.6, w: 3.4, h: 0.7, bg: 0x8fd14f, stripes: true },
      { t: 'LAB-B2', x: 25, z: 30, f: 'N', y: 3.2, w: 1.8, h: 0.6, bg: C.skyUI },
      { t: 'ÇAY OCAĞI', x: 12, z: 17, f: 'E', y: 3.75, w: 2.0, h: 0.6, bg: 0xff9a62, heart: true },
      { t: 'GİRİŞ SALONU', x: 7, z: 21, f: 'N', y: 3.4, w: 3.0, h: 0.6, bg: C.purple },
      { t: 'ACİL ÇIKIŞ', x: 17, z: 13, f: 'S', y: 3.2, w: 2.0, h: 0.5, bg: C.mintUI },
      { t: 'KARANTİNA', x: 33, z: 25, f: 'W', y: 3.0, w: 2.4, h: 0.6, bg: C.bubble, stripes: true },
    ],
    poligon: [
      { t: 'ATIŞ POLİGONU', x: 12, z: 51, f: 'N', y: 3.8, w: 5, h: 1.0, bg: C.mintUI },
      { t: 'GÖZ-KULAK KORUYUCU TAKINIZ', x: 0, z: 46, f: 'E', y: 2.6, w: 4.4, h: 0.6, bg: C.sun },
    ],
  };

  // Her haritanın tabelaları tek bir doku atlasında: tek çizim çağrısı
  const atlasCache = {};
  function signAtlas(id, list) {
    if (atlasCache[id]) return atlasCache[id];
    // raf paketleme: her tabela 112 px yüksekliğinde, en-boy oranı korunur
    const AW = 1024, PH = 112, GAP = 6;
    const items = list.map((s) => {
      let pw = Math.round((PH * s.w) / s.h), ph = PH;
      if (pw > AW) {
        ph = Math.round((PH * AW) / pw);
        pw = AW;
      }
      return { s, pw, ph };
    });
    let x = 0, y = 0, rowH = 0;
    for (const it of items) {
      if (x + it.pw > AW) {
        x = 0;
        y += rowH + GAP;
        rowH = 0;
      }
      it.x = x;
      it.y = y;
      x += it.pw + GAP;
      rowH = Math.max(rowH, it.ph);
    }
    let AH = 64;
    while (AH < y + rowH) AH *= 2;
    const c = document.createElement('canvas');
    c.width = AW;
    c.height = AH;
    const ctx = c.getContext('2d');
    const draw = () => {
      ctx.clearRect(0, 0, AW, AH);
      for (const it of items) drawBoard(ctx, it.x, it.y, it.pw, it.ph, { bg: it.s.bg, text: it.s.t, stripes: it.s.stripes, heart: it.s.heart });
    };
    draw();
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    onFonts(() => {
      draw();
      tex.needsUpdate = true;
    });
    return (atlasCache[id] = { tex, items, AW, AH });
  }

  function placeSigns(world, B) {
    const list = SIGNS[world.def.id] || [];
    if (!list.length) return null;
    const A = signAtlas(world.def.id, list);
    const night = !!world.theme.night;
    list.forEach((s, i) => {
      const it = A.items[i];
      const f = FACE[s.f];
      const yaw = Math.atan2(f[0], f[1]);
      const cx = s.x * CELL + 1, cz = s.z * CELL + 1;
      // arka pano (koyu ton, biraz taşkın)
      const back = roundBox(s.w + 0.12, s.h + 0.12, 0.08, Math.min(s.h * 0.4, 0.3));
      B.solid.addGeo(back, mtx(cx + f[0] * 1.045, s.y, cz + f[1] * 1.045, yaw), tint(s.bg, -0.45));
      // yüz: atlas bölgesine göre UV
      const plane = new THREE.PlaneGeometry(s.w, s.h);
      const uv = plane.attributes.uv;
      const u0 = it.x / A.AW, u1 = (it.x + it.pw) / A.AW;
      const v0 = 1 - (it.y + it.ph) / A.AH, v1 = 1 - it.y / A.AH;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      B.sign.addGeo(plane, mtx(cx + f[0] * 1.092, s.y, cz + f[1] * 1.092, yaw), 0xffffff);
      plane.dispose();
    });
    const key = 'pr-sign-' + world.def.id + (night ? '-n' : '');
    return toon(key, { map: A.tex, vertexColors: true, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: night ? 0.55 : 0.12 });
  }

  // ---------------- Küçük parça kurucular ----------------
  function flower(Bk, x, y, z, s, col, rnd) {
    const t = tpl();
    const tilt = (rnd() - 0.5) * 0.5, roll = (rnd() - 0.5) * 0.5;
    Bk.addGeo(t.stem, mtx(x, y + 0.1 * s, z, 0, 0.03 * s, 0.2 * s, 0.03 * s), C.leafD);
    Bk.addGeo(t.petal, mtx(x, y + 0.21 * s, z, rnd() * 6, 0.12 * s, 0.03 * s, 0.12 * s, tilt, roll), col);
    Bk.addGeo(t.dot, mtx(x, y + 0.228 * s, z, 0, 0.05 * s, 0.025 * s, 0.05 * s, tilt, roll), col === C.sun ? C.coral : C.sun);
  }
  function flowerPatch(Bk, x, z, s, rnd, cols) {
    const t = tpl();
    Bk.addGeo(t.blob, mtx(x, 0, z, rnd() * 6, 0.42 * s, 0.04 * s, 0.32 * s), rnd() < 0.5 ? C.grassD : C.leafD);
    const n = 3 + Math.floor(rnd() * 3);
    const cl = cols || FLOWERS;
    const col = cl[Math.floor(rnd() * cl.length)];
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, r = rnd() * 0.32 * s;
      flower(Bk, x + Math.cos(a) * r, 0.02, z + Math.sin(a) * r * 0.8, s * (0.8 + rnd() * 0.5), rnd() < 0.7 ? col : cl[Math.floor(rnd() * cl.length)], rnd);
    }
  }
  function bush(Bk, x, z, s, rnd, berries, y0) {
    const t = tpl();
    const y = y0 || 0;
    const g0 = rnd() < 0.5 ? C.leaf : C.leafD;
    Bk.addGeo(t.sph, mtx(x, y + 0.32 * s, z, 0, 0.45 * s, 0.4 * s, 0.42 * s), g0);
    Bk.addGeo(t.blob, mtx(x + 0.32 * s, y + 0.24 * s, z + 0.08 * s, 0, 0.32 * s, 0.3 * s, 0.32 * s), tint(g0, 0.12));
    Bk.addGeo(t.blob, mtx(x - 0.3 * s, y + 0.22 * s, z - 0.06 * s, 0, 0.3 * s, 0.28 * s, 0.3 * s), tint(g0, -0.08));
    if (berries) {
      const bc = berries === true ? (rnd() < 0.5 ? C.bubble : C.coral) : berries;
      for (let i = 0; i < 3; i++) {
        const a = rnd() * 6.28;
        Bk.addGeo(t.dot, mtx(x + Math.cos(a) * 0.36 * s, y + (0.3 + rnd() * 0.25) * s, z + Math.sin(a) * 0.34 * s, 0, 0.06 * s), bc);
      }
    }
  }
  // Lolipop ağaç: gövde + yuvarlak taç + şeker renkli meyveler
  function lollipopTree(Bk, x, z, s, rnd, crown) {
    const t = tpl();
    const h = 2.6 * s;
    Bk.addGeo(t.cyl, mtx(x, h / 2, z, 0, 0.17 * s, h, 0.17 * s), C.woodD);
    const cc = crown || (rnd() < 0.5 ? C.leaf : C.leafD);
    const r = 1.25 * s;
    Bk.addGeo(t.sph, mtx(x, h + r * 0.75, z, rnd() * 6, r, r * 0.92, r), cc);
    Bk.addGeo(t.blob, mtx(x + r * 0.6, h + r * 0.45, z + r * 0.2, 0, r * 0.6), tint(cc, 0.1));
    Bk.addGeo(t.blob, mtx(x - r * 0.55, h + r * 0.5, z - r * 0.25, 0, r * 0.55), tint(cc, -0.06));
    const fc = [C.coral, C.bubble, C.sun, C.tang][Math.floor(rnd() * 4)];
    for (let i = 0; i < 5; i++) {
      const a = rnd() * 6.28, b = rnd() * 1.1 - 0.2;
      Bk.addGeo(t.dot, mtx(x + Math.cos(a) * Math.cos(b) * r * 0.98, h + r * 0.75 + Math.sin(b) * r * 0.9, z + Math.sin(a) * Math.cos(b) * r * 0.98, 0, 0.13 * s), fc);
    }
  }
  function pineTree(Bk, x, z, s, rnd, col) {
    const t = tpl();
    const c0 = col || 0x3fae7a;
    Bk.addGeo(t.cyl, mtx(x, 0.6 * s, z, 0, 0.16 * s, 1.2 * s, 0.16 * s), C.woodD);
    for (let i = 0; i < 3; i++) {
      const r = (1.5 - i * 0.38) * s;
      Bk.addGeo(t.cone, mtx(x, (1.6 + i * 1.05) * s, z, rnd() * 6, r, 1.7 * s, r), tint(c0, i * 0.08));
    }
    Bk.addGeo(t.dot, mtx(x, 4.25 * s, z, 0, 0.18 * s), C.sun);
  }
  function palmTree(Bk, x, z, s, rnd) {
    const t = tpl();
    const lean = (rnd() - 0.5) * 0.5, dir = rnd() * 6.28;
    let px = x, py = 0, pz = z;
    for (let i = 0; i < 6; i++) {
      const r = (0.24 - i * 0.015) * s;
      Bk.addGeo(t.cyl, mtx(px, py + 0.42 * s, pz, 0, r, 0.86 * s, r), i % 2 ? C.wood : C.woodD);
      py += 0.82 * s;
      px += Math.cos(dir) * lean * 0.18 * s * i * 0.4;
      pz += Math.sin(dir) * lean * 0.18 * s * i * 0.4;
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
      const L = 1.5 * s;
      Bk.addGeo(t.sph, mtx(px + Math.cos(a) * L * 0.75, py - 0.25 * s, pz + Math.sin(a) * L * 0.75, -a, L, 0.1 * s, 0.38 * s, 0, -0.45), i % 2 ? C.leaf : C.leafD);
    }
    Bk.addGeo(t.sph, mtx(px, py + 0.05 * s, pz, 0, 0.35 * s, 0.22 * s, 0.35 * s), C.leaf);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28;
      Bk.addGeo(t.dot, mtx(px + Math.cos(a) * 0.2 * s, py - 0.18 * s, pz + Math.sin(a) * 0.2 * s, 0, 0.14 * s), 0xa0663a);
    }
  }
  function cactus(Bk, x, z, s, rnd) {
    const t = tpl();
    const g = rnd() < 0.5 ? C.grassD : 0x55c48a;
    const h = 1.3 * s;
    Bk.addGeo(t.cyl, mtx(x, h / 2, z, 0, 0.26 * s, h, 0.26 * s), g);
    Bk.addGeo(t.sph, mtx(x, h, z, 0, 0.26 * s), g);
    const ry = rnd() * 6;
    for (const side of [-1, 1]) {
      const ay = (side < 0 ? 0.5 : 0.75) * h;
      const ox = Math.cos(ry) * side, oz = -Math.sin(ry) * side;
      Bk.addGeo(t.cyl, mtx(x + ox * 0.32 * s, ay, z + oz * 0.32 * s, ry, 0.12 * s, 0.34 * s, 0.12 * s, 0, Math.PI / 2), g);
      Bk.addGeo(t.cyl, mtx(x + ox * 0.48 * s, ay + 0.2 * s, z + oz * 0.48 * s, 0, 0.12 * s, 0.42 * s, 0.12 * s), g);
      Bk.addGeo(t.sph, mtx(x + ox * 0.48 * s, ay + 0.41 * s, z + oz * 0.48 * s, 0, 0.12 * s), g);
    }
    flower(Bk, x, h + 0.12 * s, z, s * 1.1, rnd() < 0.5 ? C.bubble : C.sun, rnd);
  }
  function mushroom(Bk, x, z, s, capB, capCol) {
    const t = tpl();
    Bk.addGeo(t.cyl6, mtx(x, 0.1 * s, z, 0, 0.06 * s, 0.2 * s, 0.06 * s), C.cream);
    capB.addGeo(t.cap, mtx(x, 0.18 * s, z, 0, 0.17 * s, 0.13 * s, 0.17 * s), capCol);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + s;
      capB.addGeo(t.dot, mtx(x + Math.cos(a) * 0.09 * s, 0.27 * s, z + Math.sin(a) * 0.09 * s, 0, 0.028 * s), C.white);
    }
  }
  function giftBox(Bk, x, y, z, s, col, rib, ry) {
    const t = tpl();
    Bk.addGeo(t.box, mtx(x, y + s / 2, z, ry, s, s * 0.9, s), col);
    Bk.addGeo(t.box, mtx(x, y + s / 2, z, ry, s * 1.02, s * 0.92, s * 0.2), rib);
    Bk.addGeo(t.box, mtx(x, y + s / 2, z, ry, s * 0.2, s * 0.92, s * 1.02), rib);
    Bk.addGeo(t.dot, mtx(x - s * 0.13, y + s * 0.98, z, ry, s * 0.14, s * 0.1, s * 0.08, 0, 0.5), rib);
    Bk.addGeo(t.dot, mtx(x + s * 0.13, y + s * 0.98, z, ry, s * 0.14, s * 0.1, s * 0.08, 0, -0.5), rib);
  }
  function pottedPlant(Bk, x, z, s, rnd) {
    const t = tpl();
    const pc = [C.coral, C.skyUI, C.sun, C.lilac, 0xe58a5a][Math.floor(rnd() * 5)];
    Bk.addGeo(t.cyl, mtx(x, 0.2 * s, z, 0, 0.22 * s, 0.4 * s, 0.22 * s), pc);
    Bk.addGeo(t.cyl, mtx(x, 0.41 * s, z, 0, 0.25 * s, 0.07 * s, 0.25 * s), tint(pc, 0.3));
    Bk.addGeo(t.blob, mtx(x, 0.66 * s, z, 0, 0.3 * s, 0.32 * s, 0.3 * s), C.leaf);
    Bk.addGeo(t.blob, mtx(x + 0.12 * s, 0.86 * s, z, 0, 0.18 * s), C.leafD);
    if (rnd() < 0.6) for (let i = 0; i < 3; i++) Bk.addGeo(t.dot, mtx(x + Math.cos(i * 2.1) * 0.24 * s, 0.75 * s, z + Math.sin(i * 2.1) * 0.24 * s, 0, 0.06 * s), C.bubble);
  }
  function bench(Bk, x, z, yaw, col) {
    const t = tpl();
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    for (const lx of [-0.6, 0.6]) {
      for (const lz of [-0.15, 0.15]) {
        const [px, pz] = at(lx, lz);
        Bk.addGeo(t.box, mtx(px, 0.2, pz, yaw, 0.08, 0.4, 0.08), C.ink);
      }
      const [px, pz] = at(lx, -0.22);
      Bk.addGeo(t.box, mtx(px, 0.6, pz, yaw, 0.08, 0.5, 0.06), C.ink);
    }
    for (let i = 0; i < 3; i++) {
      const [px, pz] = at(0, -0.15 + i * 0.15);
      Bk.addGeo(t.box, mtx(px, 0.43, pz, yaw, 1.5, 0.06, 0.13), i % 2 ? tint(col, 0.2) : col);
    }
    for (let i = 0; i < 2; i++) {
      const [px, pz] = at(0, -0.24);
      Bk.addGeo(t.box, mtx(px, 0.62 + i * 0.18, pz, yaw, 1.5, 0.13, 0.05), i % 2 ? tint(col, 0.2) : col);
    }
  }
  function lampPost(Bk, G2, x, z, col, lit) {
    const t = tpl();
    Bk.addGeo(t.cyl, mtx(x, 0.1, z, 0, 0.16, 0.2, 0.16), C.ink);
    Bk.addGeo(t.cyl6, mtx(x, 1.35, z, 0, 0.06, 2.5, 0.06), col);
    Bk.addGeo(t.torus, mtx(x, 2.45, z, 0, 0.1, 0.1, 0.1, Math.PI / 2), col);
    Bk.addGeo(t.cone, mtx(x, 2.92, z, 0, 0.24, 0.18, 0.24), col);
    Bk.addGeo(t.dot, mtx(x, 3.05, z, 0, 0.06), C.sun);
    (lit ? G2 : Bk).addGeo(t.sph, mtx(x, 2.7, z, 0, 0.17, 0.2, 0.17), lit ? 0xfff0b8 : C.cream);
  }
  // İp üzerinde flama: a → b sarkarak
  function bunting(B, a, b, sag, cols, size) {
    const t = tpl();
    const n = Math.max(2, Math.round(a.distanceTo(b) / 0.55));
    const dx = b.x - a.x, dz = b.z - a.z;
    const yaw = Math.atan2(-dz, dx);
    const s = size || 1;
    let prev = a.clone(), last = a.clone();
    for (let i = 1; i <= n; i++) {
      const tt = i / n;
      const p = a.clone().lerp(b, tt);
      p.y -= Math.sin(tt * Math.PI) * sag;
      if (i % 3 === 0 || i === n) {
        B.solid.addGeo(t.rope, segMtx(last, p, 0.02), C.ink);
        last = p.clone();
      }
      const m = prev.clone().add(p).multiplyScalar(0.5);
      B.soft.addGeo(t.tri, mtx(m.x, m.y - 0.01, m.z, yaw, 0.34 * s, 0.42 * s, 1), cols[i % cols.length]);
      prev = p;
    }
  }
  // Balon demeti: çapa (ax, az) yerde küçük hediye kutusu
  function balloons(B, ax, az, rnd, n, h) {
    const t = tpl();
    const hh = h || 2.4;
    const anchor = new THREE.Vector3(ax, 0.24, az);
    giftBox(B.solid, ax, 0, az, 0.24, CANDY[Math.floor(rnd() * CANDY.length)], C.white, rnd() * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + rnd() * 0.6;
      const r = 0.22 + rnd() * 0.18;
      const x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r, y = hh + rnd() * 0.7;
      const col = CANDY[Math.floor(rnd() * CANDY.length)];
      B.balloon.addGeo(t.sph, mtx(x, y, z, 0, 0.26, 0.31, 0.26), col);
      B.balloon.addGeo(t.dot, mtx(x - 0.09, y + 0.12, z + 0.17, 0, 0.055), C.white);
      B.balloon.addGeo(t.cone4, mtx(x, y - 0.32, z, 0, 0.05, 0.07, 0.05), col);
      B.balloon.addGeo(t.rope, segMtx(new THREE.Vector3(x, y - 0.35, z), anchor, 0.012), C.ink);
    }
  }
  // Çizgili tente: yüz noktası (fx, fz), dış normal (nx, nz), genişlik, üst yükseklik, derinlik
  function awning(B, fx, fz, nx, nz, w, ytop, depth, col, n) {
    const t = tpl();
    const N = n || Math.max(4, Math.round(w / 0.36));
    const yaw = Math.atan2(nx, nz);
    const tilt = 0.42;
    const tx = -nz, tz = nx;
    const cd = Math.cos(tilt) * depth, sd = Math.sin(tilt) * depth;
    for (let i = 0; i < N; i++) {
      const u = -w / 2 + ((i + 0.5) * w) / N;
      const c = i % 2 ? C.white : col;
      B.solid.addGeo(t.box, mtx(fx + tx * u + nx * cd * 0.5, ytop - sd * 0.5, fz + tz * u + nz * cd * 0.5, yaw, w / N + 0.004, 0.05, depth, tilt), c);
      B.solid.addGeo(scallop(w / N / 2, 0.05), mtx(fx + tx * u + nx * (cd + 0.01), ytop - sd + 0.01, fz + tz * u + nz * (cd + 0.01), yaw), c);
    }
    // yan kollar
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(fx + tx * s * w * 0.5, ytop - 0.5, fz + tz * s * w * 0.5);
      const b = new THREE.Vector3(fx + tx * s * w * 0.5 + nx * cd, ytop - sd, fz + tz * s * w * 0.5 + nz * cd);
      B.solid.addGeo(t.rope, segMtx(a, b, 0.035), C.ink);
    }
  }
  function picketFence(Bk, x0, z0, x1, z1, col) {
    const t = tpl();
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.3));
    for (let i = 0; i < n; i++) {
      const tt = (i + 0.5) / n;
      const x = U.lerp(x0, x1, tt), z = U.lerp(z0, z1, tt);
      Bk.addGeo(t.box, mtx(x, 0.36, z, yaw, 0.04, 0.72, 0.13), col);
      Bk.addGeo(t.cone4, mtx(x, 0.78, z, yaw + Math.PI / 4, 0.095, 0.13, 0.095), col);
    }
    for (const y of [0.24, 0.56]) Bk.addGeo(t.box, mtx((x0 + x1) / 2, y, (z0 + z1) / 2, yaw, 0.035, 0.06, len), tint(col, -0.12));
  }

  // ---------------- Hücre yardımcıları ----------------
  function maskRects(world, pred) {
    const saved = world.rows;
    world.rows = saved.map((row, z) => row.map((ch, x) => (pred(ch, x, z) ? '§' : ch === '§' ? '¤' : ch)));
    const out = world.mergeRects(new Set(['§']));
    world.rows = saved;
    return out;
  }
  const isBldWall = (ch) => ch === 'H' || ch === '=' || ch === 'd';
  const isOpenCh = (ch) => ch === '.' || ch === ',';
  // Duvar hücresinin dış (açık hava) yanı: +1/-1 (z veya x yönünde), 0: iki yan da iç mekân
  function wallInfo(world, x, z) {
    const at = (a, b) => world.at(a, b);
    const alongX = isBldWall(at(x - 1, z)) || isBldWall(at(x + 1, z)) || at(x - 1, z) === '#' || at(x + 1, z) === '#';
    const [ax, az, bx, bz] = alongX ? [x, z - 1, x, z + 1] : [x - 1, z, x + 1, z];
    const outA = isOpenCh(at(ax, az)) && !world.indoor[ax + az * world.w];
    const outB = isOpenCh(at(bx, bz)) && !world.indoor[bx + bz * world.w];
    const side = outA && !outB ? -1 : outB && !outA ? 1 : 0;
    return { alongX, side };
  }

  // ---------------- Cephe ve çatı ----------------
  // Bu yüzdeki bir tabelayla çakışır mı? (tente/çerçeve tabelayı örtmesin)
  function signNear(world, fx, fz, nx, nz, halfW, y0, y1) {
    const list = SIGNS[world.def.id] || [];
    for (const sg of list) {
      const f = FACE[sg.f];
      if (f[0] !== nx || f[1] !== nz) continue;
      const dx = sg.x * CELL + 1 + f[0] - fx, dz = sg.z * CELL + 1 + f[1] - fz;
      if (Math.abs(dx * nx + dz * nz) > 0.4) continue;
      if (Math.abs(-dx * nz + dz * nx) > sg.w / 2 + halfW) continue;
      if (sg.y + sg.h / 2 < y0 || sg.y - sg.h / 2 > y1) continue;
      return true;
    }
    return false;
  }
  function facades(world, B, rnd) {
    const t = tpl();
    const id = world.def.id;
    const accent = { liman: [C.coral, C.skyUI, C.mintUI], col: [C.teal, C.coral, C.tang], us: [C.lilac, C.skyUI, C.mintUI], tesis: [C.mintUI, C.lilac, C.skyUI], poligon: [C.mintUI, C.skyUI, C.coral] }[id] || CANDY;
    // korniş (krema "şekerleme" bandı) ve süpürgelik
    for (const r of maskRects(world, (ch) => isBldWall(ch))) {
      const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
      const ac = accent[(r.x + r.z) % accent.length];
      B.solid.addGeo(t.box, mtx(cxm, 4.71, czm, 0, x1 - x0 + 0.2, 0.2, z1 - z0 + 0.2), C.cream);
      B.solid.addGeo(t.box, mtx(cxm, 4.53, czm, 0, x1 - x0 + 0.12, 0.14, z1 - z0 + 0.12), ac);
      B.solid.addGeo(t.box, mtx(cxm, 0.15, czm, 0, x1 - x0 + 0.08, 0.3, z1 - z0 + 0.08), tint(ac, -0.25));
    }
    // pencereler: beyaz çerçeve, panjur, çiçek saksısı
    for (let z = 0; z < world.h; z++)
      for (let x = 0; x < world.w; x++) {
        const ch = world.rows[z][x];
        if (ch !== '=' && ch !== 'd') continue;
        const wi = wallInfo(world, x, z);
        const cx = x * CELL + 1, cz = z * CELL + 1;
        const ac = accent[(x * 3 + z) % accent.length];
        // her iki yüzde çerçeve
        for (const sd of [-1, 1]) {
          const out = sd === wi.side;
          const fx = wi.alongX ? cx : cx + sd * 1.0, fz = wi.alongX ? cz + sd * 1.0 : cz;
          const nx = wi.alongX ? 0 : sd, nz = wi.alongX ? sd : 0;
          const tx = -nz, tz = nx;
          const yaw = Math.atan2(nx, nz);
          const P = (u, y, o) => [fx + tx * u + nx * o, y, fz + tz * u + nz * o];
          if (ch === '=') {
            let p = P(0, 2.27, 0.04);
            B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 2.24, 0.14, 0.1), C.white);
            p = P(0, 0.95, 0.07);
            B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 2.3, 0.1, 0.16), C.white);
            for (const s of [-1, 1]) {
              p = P(s * 1.06, 1.6, 0.04);
              B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 0.12, 1.3, 0.1), C.white);
            }
            if (!out) continue;
            // panjurlar: yanında duvar varsa
            for (const s of [-1, 1]) {
              const neigh = wi.alongX ? world.at(x + s, z) : world.at(x, z + s);
              if (neigh !== 'H') continue;
              // komşu hücre yönünü teğet eksenine çevir
              const u = s * (wi.alongX ? tx : tz);
              p = P(u * 1.42, 1.6, 0.05);
              B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 0.56, 1.2, 0.06), ac);
              for (const yy of [1.3, 1.6, 1.9]) {
                p = P(u * 1.42, yy, 0.085);
                B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 0.46, 0.035, 0.03), tint(ac, -0.2));
              }
            }
            // çiçek saksısı
            p = P(0, 0.78, 0.2);
            B.solid.addGeo(roundBox(1.7, 0.26, 0.32, 0.08), mtx(p[0], p[1], p[2], yaw), tint(ac, -0.15));
            const fcol = FLOWERS[(x * 5 + z * 3) % FLOWERS.length];
            for (let i = 0; i < 4; i++) {
              const u = -0.6 + i * 0.4;
              p = P(u, 0.9, 0.2 + (i % 2) * 0.05);
              B.soft.addGeo(t.blob, mtx(p[0], p[1], p[2], 0, 0.16, 0.1, 0.13), i % 2 ? C.leaf : C.leafD);
              p = P(u + 0.12, 0.98, 0.24);
              flower(B.soft, p[0], p[1] - 0.12, p[2], 1.0, i % 3 ? fcol : C.white, rnd);
            }
          } else {
            // kapı: beyaz kasa + dışarıda çizgili tente
            for (const s of [-1, 1]) {
              const p = P(s * 1.02, 1.3, 0.04);
              B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 0.12, 2.6, 0.1), C.white);
            }
            const p = P(0, 2.66, 0.04);
            B.solid.addGeo(t.box, mtx(p[0], p[1], p[2], yaw, 2.2, 0.14, 0.1), C.white);
            if (out && id !== 'tesis' && !signNear(world, fx, fz, nx, nz, 1.3, 2.6, 3.25)) awning(B, fx, fz, nx, nz, 2.5, 3.18, 1.0, ac);
          }
        }
      }
    // çatılar: renkli parapet + sevimli çatı süsleri
    const roofs = maskRects(world, (ch, x, z) => !!world.indoor[x + z * world.w]);
    for (const r of roofs) {
      const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
      const ac = accent[(r.x * 7 + r.z) % accent.length];
      for (const [px, pz, sx, sz] of [[(x0 + x1) / 2, z0 - 0.05, x1 - x0 + 0.3, 0.2], [(x0 + x1) / 2, z1 + 0.05, x1 - x0 + 0.3, 0.2], [x0 - 0.05, (z0 + z1) / 2, 0.2, z1 - z0], [x1 + 0.05, (z0 + z1) / 2, 0.2, z1 - z0]]) {
        B.solid.addGeo(t.box, mtx(px, 4.95, pz, 0, sx, 0.3, sz), ac);
      }
      const n = Math.max(1, Math.floor((r.w * r.h) / 12));
      for (let i = 0; i < n; i++) {
        const x = U.lerp(x0 + 1.2, x1 - 1.2, rnd()), z = U.lerp(z0 + 1.2, z1 - 1.2, rnd());
        const k = rnd();
        if (k < 0.3) {
          // baca + bulut puf
          B.solid.addGeo(t.box, mtx(x, 5.3, z, 0, 0.55, 1.0, 0.55), C.coral);
          B.solid.addGeo(t.box, mtx(x, 5.85, z, 0, 0.7, 0.14, 0.7), C.cream);
          if (!world.theme.night) {
            // çizgi film bulutçukları
            for (let j = 0; j < 2; j++) {
              const cx2 = x + 0.25 + j * 0.55, cy2 = 6.35 + j * 0.6, sc = 0.7 + j * 0.35;
              B.soft.addGeo(t.blob, mtx(cx2, cy2, z, 0, 0.2 * sc), C.white);
              B.soft.addGeo(t.blob, mtx(cx2 - 0.2 * sc, cy2 - 0.05, z, 0, 0.14 * sc), C.white);
              B.soft.addGeo(t.blob, mtx(cx2 + 0.2 * sc, cy2 - 0.05, z, 0, 0.15 * sc), C.white);
            }
          }
        } else if (k < 0.6) {
          // çizgili su deposu
          for (let j = 0; j < 4; j++) B.solid.addGeo(t.cyl, mtx(x, 5.35 + j * 0.25, z, 0, 0.55, 0.25, 0.55), j % 2 ? C.white : ac);
          B.solid.addGeo(t.cone, mtx(x, 6.55, z, 0, 0.62, 0.4, 0.62), C.coral);
          B.solid.addGeo(t.dot, mtx(x, 6.8, z, 0, 0.08), C.sun);
          for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) B.solid.addGeo(t.box, mtx(x + dx, 5.05, z + dz, 0, 0.08, 0.5, 0.08), C.ink);
        } else if (k < 0.85) {
          // nane yeşili klima, yuvarlak pervane
          B.solid.addGeo(roundBox(1.1, 0.7, 0.8, 0.14), mtx(x, 5.17, z, 0), C.mint);
          B.solid.addGeo(t.cyl, mtx(x, 5.53, z, 0, 0.3, 0.04, 0.3), C.cream);
          B.solid.addGeo(t.cyl, mtx(x, 5.56, z, 0, 0.07, 0.04, 0.07), C.coral);
        } else {
          // çatı bahçesi
          B.solid.addGeo(roundBox(1.3, 0.3, 1.0, 0.1), mtx(x, 4.95, z, 0), C.woodD);
          bush(B.solid, x, z, 0.8, rnd, true, 5.05);
        }
      }
    }
  }

  // ---------------- Çevre duvarı boyunca: çit, çiçek tarhı, çalı, bank, lamba ----------------
  function perimeter(world, B, rnd, busy) {
    const t = tpl();
    const T = world.theme;
    const id = world.def.id;
    const night = !!T.night;
    const desert = !!T.palms;
    const kinds = desert ? ['bed', 'cactus', 'bench', 'none', 'bed', 'pots'] : id === 'tesis' ? ['bed', 'shroom', 'none', 'bush', 'lamp'] : ['fence', 'bed', 'bush', 'bench', 'none', 'lamp', 'fence'];
    const hash = (a, b) => {
      let h = (a * 374761393 + b * 668265263) >>> 0;
      h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
      return (h ^ (h >>> 16)) / 4294967296;
    };
    const benchCol = [C.coral, C.skyUI, C.sun, C.mintUI];
    let lamps = 0;
    for (let z = 1; z < world.h - 1; z++)
      for (let x = 1; x < world.w - 1; x++) {
        const ch = world.rows[z][x];
        if (ch !== '.' || world.indoor[x + z * world.w] || busy.has(x + ',' + z)) continue;
        // hangi yanda çevre duvarı var?
        let dir = null;
        for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (world.at(x + dx, z + dz) === '#') { dir = [dx, dz]; break; }
        if (!dir) continue;
        const alongX = dir[1] !== 0;
        const sAlong = alongX ? x : z;
        const run = Math.floor(sAlong / 3);
        const kind = kinds[Math.floor(hash(run + dir[0] * 7, dir[1] * 11 + (alongX ? z : x) * 3) * kinds.length)];
        if (kind === 'none') continue;
        // duvar yüzü ve içe bakan normal
        const nx = -dir[0], nz = -dir[1];
        const fx = x * CELL + 1 + dir[0] * 1.0, fz = z * CELL + 1 + dir[1] * 1.0;
        const tx = -nz, tz = nx;
        const P = (u, o) => [fx + tx * u + nx * o, fz + tz * u + nz * o];
        busy.add(x + ',' + z);
        if (kind === 'fence') {
          const a = P(-1, 0.32), b = P(1, 0.32);
          picketFence(B.solid, a[0], a[1], b[0], b[1], C.white);
          for (let i = 0; i < 3; i++) {
            const p = P(-0.65 + i * 0.65 + (rnd() - 0.5) * 0.2, 0.62);
            flower(B.soft, p[0], 0, p[1], 1.2, FLOWERS[Math.floor(rnd() * FLOWERS.length)], rnd);
          }
        } else if (kind === 'bed') {
          const p = P(0, 0.35);
          B.soft.addGeo(t.blob, mtx(p[0], 0, p[1], Math.atan2(tx, tz), 0.36, 0.14, 1.0), desert ? 0xf2c27a : C.grassD);
          const fc = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
          for (let i = 0; i < 4; i++) {
            const q = P(-0.66 + i * 0.44, 0.3 + (rnd() - 0.5) * 0.25);
            flower(B.soft, q[0], 0.06, q[1], 1.1 + rnd() * 0.4, i % 2 ? fc : FLOWERS[Math.floor(rnd() * FLOWERS.length)], rnd);
          }
          if (!desert) {
            const q = P((rnd() - 0.5) * 1.2, 0.3);
            B.soft.addGeo(t.blob, mtx(q[0], 0.12, q[1], 0, 0.22, 0.16, 0.22), C.leaf);
          }
        } else if (kind === 'bush') {
          const p = P((rnd() - 0.5) * 0.6, 0.45);
          bush(B.solid, p[0], p[1], 1.0 + rnd() * 0.3, rnd, rnd() < 0.5);
        } else if (kind === 'bench') {
          if (rnd() < 0.5) {
            const p = P(0, 0.4);
            bench(B.solid, p[0], p[1], Math.atan2(nx, nz), benchCol[Math.floor(rnd() * benchCol.length)]);
          } else {
            const p = P(0.3, 0.45);
            if (desert) cactus(B.solid, p[0], p[1], 0.7, rnd);
            else bush(B.solid, p[0], p[1], 0.9, rnd, true);
          }
        } else if (kind === 'lamp') {
          if (lamps++ % 2) continue;
          const p = P(0, 0.3);
          lampPost(B.solid, B.glow, p[0], p[1], night ? C.lilac : C.teal, night || id === 'tesis');
          const q = P(0.6, 0.35);
          flowerPatch(B.soft, q[0], q[1], 0.8, rnd);
        } else if (kind === 'cactus') {
          const p = P((rnd() - 0.5) * 0.8, 0.5);
          cactus(B.solid, p[0], p[1], 0.65 + rnd() * 0.35, rnd);
        } else if (kind === 'pots') {
          for (let i = 0; i < 2; i++) {
            const p = P(-0.5 + i * 1.0, 0.3);
            pottedPlant(B.solid, p[0], p[1], 0.9 + rnd() * 0.3, rnd);
          }
        } else if (kind === 'shroom') {
          for (let i = 0; i < 4; i++) {
            const p = P(-0.7 + i * 0.45 + rnd() * 0.1, 0.25 + rnd() * 0.3);
            mushroom(B.solid, p[0], p[1], 1.2 + rnd() * 1.2, B.glowNear, [0x7ef9ff, C.rose, 0xc79bff][i % 3]);
          }
        }
      }
  }

  // ---------------- Dağınık dekor ----------------
  function scatter(world, B, rnd, busy) {
    const t = tpl();
    const T = world.theme;
    const id = world.def.id;
    const free = [];
    for (let z = 1; z < world.h - 1; z++)
      for (let x = 1; x < world.w - 1; x++) {
        const ch = world.rows[z][x];
        if ((ch === '.' || ch === ',') && !busy.has(x + ',' + z)) free.push([x, z, ch === ',' || !!world.indoor[x + z * world.w]]);
      }
    const count = Math.min(free.length, Math.round(free.length * (id === 'tesis' ? 0.12 : 0.085)));
    const used = new Set();
    for (let i = 0; i < count; i++) {
      const [cx, cz, indoor] = free[Math.floor(rnd() * free.length)];
      if (used.has(cx + ',' + cz)) continue;
      used.add(cx + ',' + cz);
      const x = cx * CELL + 0.4 + rnd() * 1.2, z = cz * CELL + 0.4 + rnd() * 1.2;
      const nearWall = ['H', '=', '#'].some((c) => world.at(cx - 1, cz) === c || world.at(cx + 1, cz) === c || world.at(cx, cz - 1) === c || world.at(cx, cz + 1) === c);
      const k = rnd();
      if (indoor) {
        if (id === 'tesis') {
          if (k < 0.3) {
            // nane yeşili yapışkan su birikintisi (kan yok!)
            for (let j = 0; j < 3; j++) B.soft.addGeo(t.cyl, mtx(x + (rnd() - 0.5) * 0.6, 0.03, z + (rnd() - 0.5) * 0.6, 0, 0.25 + rnd() * 0.25, 0.02, 0.22 + rnd() * 0.2), j ? 0x9be86a : 0xb8f58a);
            B.glowNear.addGeo(t.dot, mtx(x, 0.07, z, 0, 0.05), 0xd8ffb0);
          } else if (k < 0.48) {
            // ışıldayan şişeler
            for (let j = 0; j < 3; j++) {
              const fx = x + (j - 1) * 0.16, fc = [0x7ef9ff, C.rose, 0xb8f58a][j];
              B.solid.addGeo(t.cyl, mtx(fx, 0.16, z, 0, 0.06, 0.32, 0.06), C.cream);
              B.glowNear.addGeo(t.sph, mtx(fx, 0.13, z, 0, 0.1, 0.11, 0.1), fc);
              B.solid.addGeo(t.cyl, mtx(fx, 0.34, z, 0, 0.035, 0.06, 0.035), C.coral);
            }
          } else if (k < 0.64 && nearWall) pottedPlant(B.solid, x, z, 1.1, rnd);
          else if (k < 0.78) {
            // "ıslak zemin" konisi
            B.solid.addGeo(t.cone4, mtx(x, 0.3, z, rnd(), 0.22, 0.6, 0.22), C.sun);
            B.solid.addGeo(t.box, mtx(x, 0.03, z, 0, 0.42, 0.06, 0.42), C.ink);
          } else giftBox(B.solid, x, 0, z, 0.3 + rnd() * 0.15, PASTEL[Math.floor(rnd() * PASTEL.length)], C.bubble, rnd() * 6);
        } else {
          if (k < 0.35) {
            // yuvarlak kilim
            const rc = [C.coral, C.lilac, C.teal, C.sun][Math.floor(rnd() * 4)];
            B.soft.addGeo(t.cyl, mtx(cx * CELL + 1, 0.03, cz * CELL + 1, 0, 0.85, 0.02, 0.85), rc);
            B.soft.addGeo(t.cyl, mtx(cx * CELL + 1, 0.035, cz * CELL + 1, 0, 0.62, 0.02, 0.62), C.cream);
            B.soft.addGeo(t.cyl, mtx(cx * CELL + 1, 0.04, cz * CELL + 1, 0, 0.36, 0.02, 0.36), tint(rc, 0.3));
          } else if (k < 0.55 && nearWall) pottedPlant(B.solid, x, z, 1.0 + rnd() * 0.3, rnd);
          else if (k < 0.75) {
            giftBox(B.solid, x, 0, z, 0.36 + rnd() * 0.2, CANDY[Math.floor(rnd() * CANDY.length)], C.white, rnd() * 6);
            if (rnd() < 0.5) giftBox(B.solid, x + 0.05, 0.4, z, 0.26, PASTEL[Math.floor(rnd() * PASTEL.length)], C.bubble, rnd() * 6);
          } else {
            // kitap yığını
            for (let j = 0; j < 3; j++) B.solid.addGeo(t.box, mtx(x, 0.04 + j * 0.08, z, rnd() * 0.6, 0.36 - j * 0.04, 0.07, 0.26), CANDY[(cx + j) % CANDY.length]);
          }
        }
        continue;
      }
      // dışarısı
      if (id === 'tesis') {
        if (k < 0.3) for (let j = 0; j < 3; j++) mushroom(B.solid, x + (rnd() - 0.5) * 0.7, z + (rnd() - 0.5) * 0.7, 1.4 + rnd(), B.glowNear, [0x7ef9ff, C.rose, 0xc79bff][j]);
        else if (k < 0.5) {
          // balkabağı
          B.solid.addGeo(t.sph, mtx(x, 0.2, z, rnd(), 0.3, 0.22, 0.3), C.tang);
          B.solid.addGeo(t.sph, mtx(x + 0.12, 0.2, z, 0, 0.2, 0.2, 0.22), tint(C.tang, -0.08));
          B.solid.addGeo(t.cyl, mtx(x, 0.45, z, 0, 0.04, 0.12, 0.04), C.leafD);
        } else if (k < 0.75) flowerPatch(B.soft, x, z, 1.1, rnd, [C.lilac, C.rose, C.skyUI]);
        else bush(B.solid, x, z, 0.8, rnd, 0xc79bff);
      } else if (T.palms) {
        if (k < 0.3) cactus(B.solid, x, z, 0.45 + rnd() * 0.3, rnd);
        else if (k < 0.55) for (let j = 0; j < 3; j++) B.solid.addGeo(t.dot, mtx(x + (rnd() - 0.5) * 0.7, 0.06, z + (rnd() - 0.5) * 0.7, rnd() * 6, 0.12 + rnd() * 0.1, 0.08, 0.12), [0xf7c8a0, C.peach, 0xe8d0ff][j]);
        else if (k < 0.8) pottedPlant(B.solid, x, z, 0.9, rnd);
        else flowerPatch(B.soft, x, z, 1.0, rnd);
      } else if (id === 'poligon') {
        if (k < 0.5) flowerPatch(B.soft, x, z, 1.1, rnd);
        else if (k < 0.75) bush(B.solid, x, z, 0.7 + rnd() * 0.3, rnd, rnd() < 0.4);
        else mushroom(B.solid, x, z, 1.3, B.solid, C.coral);
      } else {
        if (k < 0.22) {
          // şeker çizgili trafik konisi
          B.solid.addGeo(t.cone, mtx(x, 0.3, z, 0, 0.19, 0.56, 0.19), C.tang);
          B.solid.addGeo(t.cyl8, mtx(x, 0.3, z, 0, 0.128, 0.09, 0.128), C.white);
          B.solid.addGeo(t.dot, mtx(x, 0.58, z, 0, 0.05), C.white);
          B.solid.addGeo(t.box, mtx(x, 0.025, z, 0, 0.42, 0.05, 0.42), C.tang);
        } else if (k < 0.42) flowerPatch(B.soft, x, z, 1.0, rnd);
        else if (k < 0.55) {
          // oyuncak top
          const bc = CANDY[Math.floor(rnd() * CANDY.length)];
          B.solid.addGeo(t.sph, mtx(x, 0.22, z, rnd() * 6, 0.22), bc);
          B.solid.addGeo(t.cyl8, mtx(x, 0.22, z, rnd() * 6, 0.224, 0.07, 0.224, 0.4), C.white);
        } else if (k < 0.72 && (T.rain || T.night)) {
          // gökyüzü mavisi su birikintisi
          B.soft.addGeo(t.cyl6, mtx(x, 0.02, z, rnd() * 3, 0.55 + rnd() * 0.4, 0.015, 0.4 + rnd() * 0.3), 0x9ad7ff);
        } else if (k < 0.85) bush(B.solid, x, z, 0.65 + rnd() * 0.3, rnd, rnd() < 0.5);
        else giftBox(B.solid, x, 0, z, 0.4, CANDY[Math.floor(rnd() * CANDY.length)], C.white, rnd() * 6);
      }
    }
  }

  // ---------------- Duvarların ötesinde ağaç halkası ----------------
  function treeRing(world, B, rnd) {
    const T = world.theme;
    const id = world.def.id;
    const sea = T.sea === 'south';
    const X = world.sizeX, Z = world.sizeZ;
    const crowns = id === 'tesis' ? [0x9b7fe0, 0x7a6cc4, 0x4ecdc4] : T.night ? [0x3fae7a, 0x2f9a8a, 0x6a8fd8] : [C.leaf, C.leafD, 0x8fe060];
    const pts = [];
    for (let x = -4; x <= X + 4; x += 8.5) {
      if (id !== 'liman') pts.push([x + (rnd() - 0.5) * 3, -6 - rnd() * 6]);
      if (!sea && id !== 'tesis') pts.push([x + (rnd() - 0.5) * 3, Z + 6 + rnd() * 6]);
    }
    // tesis: yalnızca avludan görünen kuzey sırası
    for (let z = 4; z <= Z - 4 && id !== 'tesis'; z += 8.5) {
      pts.push([-6 - rnd() * 6, z + (rnd() - 0.5) * 3]);
      pts.push([X + 6 + rnd() * 6, z + (rnd() - 0.5) * 3]);
    }
    for (const [xx, z] of pts) {
      const s = 1.7 + rnd() * 0.9;
      const k = rnd();
      if (T.palms) {
        if (k < 0.65) palmTree(B.far, xx, z, s * 0.95, rnd);
        else cactus(B.far, xx, z, s * 2.6, rnd);
      } else if (T.night || k < 0.3) pineTree(B.far, xx, z, s * 1.05, rnd, crowns[Math.floor(rnd() * crowns.length)]);
      else lollipopTree(B.far, xx, z, s, rnd, crowns[Math.floor(rnd() * crowns.length)]);
    }
  }

  // ---------------- Uzak pastel şehir silüeti ----------------
  function skyline(world, B) {
    const t = tpl();
    const night = !!world.theme.night;
    const rnd = U.seeded(99);
    const cols = night ? [0x5a4f9a, 0x4a4590, 0x6a5acd, 0x52508f] : [C.peach, C.pink, C.butter, C.lilac, C.mint, C.sky];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI - Math.PI;
      const r = Math.max(world.sizeX, world.sizeZ) * 1.6;
      const x = world.sizeX / 2 + Math.cos(a) * r, z = world.sizeZ / 2 + Math.sin(a) * r * 0.6 - 40;
      const h = 16 + rnd() * 34, w = 10 + rnd() * 9;
      const col = cols[Math.floor(rnd() * cols.length)];
      const ry = rnd() * 0.4 - 0.2;
      B.far.addGeo(t.box, mtx(x, h / 2, z, ry, w, h, w), col);
      const k = rnd();
      if (k < 0.35) B.far.addGeo(t.dome, mtx(x, h, z, 0, w * 0.45, w * 0.35, w * 0.45), night ? 0x8a7fe0 : C.coral);
      else if (k < 0.7) B.far.addGeo(t.cone4, mtx(x, h + w * 0.3, z, ry + Math.PI / 4, w * 0.74, w * 0.6, w * 0.74), night ? 0x7a6cc4 : [C.coral, C.teal, C.tang][i % 3]);
      else B.far.addGeo(t.box, mtx(x, h + 0.6, z, ry, w + 0.8, 1.2, w + 0.8), C.cream);
      // ışıklı pencereler (haritaya bakan yüz)
      const fcz = Math.cos(ry), fcx = Math.sin(ry);
      const rows = Math.floor((h - 4) / 3.2), colsN = Math.floor(w / 2.6);
      for (let ry2 = 0; ry2 < rows; ry2++)
        for (let cx2 = 0; cx2 < colsN; cx2++) {
          if (rnd() < (night ? 0.35 : 0.55)) continue;
          const u = -w / 2 + 1.3 + cx2 * 2.6 + (w - colsN * 2.6) / 2;
          const yy = 3 + ry2 * 3.2;
          const lit = night || rnd() < 0.6;
          B.glow.addGeo(t.quad, mtx(x + fcz * u + fcx * (w / 2 + 0.05), yy, z - fcx * u + fcz * (w / 2 + 0.05), ry, 1.2, 1.5, 1), lit ? (rnd() < 0.8 ? 0xffe08a : 0xffb3d9) : tint(col, -0.15));
        }
    }
  }

  // ---------------- Haritaya özel süsler ----------------
  function specials(world, B, rnd, busy) {
    const t = tpl();
    const id = world.def.id;
    const X = world.sizeX, Z = world.sizeZ;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const freeOut = (x, z) => world.at(x, z) === '.' && !world.indoor[x + z * world.w];
    if (id === 'col') {
      // pazar tenteleri: çatılı, çizgili, fistolu; tezgâhta meyveler
      const stalls = [[12.5, 3, C.coral], [20.5, 3, C.teal]];
      for (const [sx, sz, col] of stalls) {
        const x = sx * CELL + 1, z = sz * CELL + 1;
        const N = 8, W = 4.4, D = 1.5;
        for (let i = 0; i < N; i++) {
          const u = -W / 2 + ((i + 0.5) * W) / N;
          const c = i % 2 ? C.white : col;
          for (const s of [-1, 1]) {
            B.solid.addGeo(t.box, mtx(x + u, 2.9 - 0.28, z + s * D * 0.48, 0, W / N + 0.004, 0.06, D, -s * 0.36), c);
            B.solid.addGeo(scallop(W / N / 2, 0.05), mtx(x + u, 2.36, z + s * (D * 0.93 + 0.01), s > 0 ? 0 : Math.PI), c);
          }
        }
        B.solid.addGeo(t.cyl, mtx(x, 2.92, z, 0, 0.06, W + 0.2, 0.06, 0, Math.PI / 2), C.sun);
        for (const [dx, dz] of [[-2.1, -1.35], [2.1, -1.35], [-2.1, 1.35], [2.1, 1.35]]) {
          for (let j = 0; j < 5; j++) B.solid.addGeo(t.cyl6, mtx(x + dx, 0.25 + j * 0.5, z + dz, 0, 0.06, 0.5, 0.06), j % 2 ? C.white : col);
          B.solid.addGeo(t.dot, mtx(x + dx, 2.55, z + dz, 0, 0.09), C.sun);
        }
        // meyve yığınları (sandıkların üstü 1.1 m)
        for (const ox of [-0.95, 0.95]) {
          const fruit = [C.tang, C.red, C.sun, 0x8fe060][Math.floor(rnd() * 4)];
          for (let j = 0; j < 12; j++) {
            const a = rnd() * 6.28, r = rnd() * 0.5;
            const ht = (0.5 - r) * 0.5;
            B.solid.addGeo(t.dot, mtx(x + ox + Math.cos(a) * r, 1.22 + ht, z + Math.sin(a) * r * 0.9, rnd() * 6, 0.12), j % 5 === 0 ? C.leaf : fruit);
          }
        }
        B.solid.addGeo(t.ball, mtx(x + 1.6, 1.3, z - 0.4, 0.3, 0.32, 0.22, 0.22), 0x56c26a);
      }
      // sokaklar boyunca flamalar
      const lines = [[[10.5, 4.6, 8], [23, 4.6, 8]], [[8.5, 4.6, 15], [25, 4.6, 15]], [[11, 4.6, 26], [22, 4.6, 26]]];
      for (const [a, b] of lines) bunting(B, V(a[0] * CELL, a[1], a[2] * CELL), V(b[0] * CELL, b[1], b[2] * CELL), 0.8, [C.coral, C.sun, C.mintUI, C.skyUI, C.bubble, C.lilac]);
      // çamaşır ipleri: evler arası sokaklarda
      const laundry = [[12, 16, 22], [56, 16, 22], [13, 34, 42], [58, 34, 42]];
      for (const [lx, za, zb] of laundry) {
        const a = V(lx, 3.75, za + 0.05), b = V(lx, 3.75, zb - 0.05);
        let prev = a.clone();
        const n = 10;
        for (let i = 1; i <= n; i++) {
          const p = a.clone().lerp(b, i / n);
          p.y -= Math.sin((i / n) * Math.PI) * 0.35;
          B.solid.addGeo(t.rope, segMtx(prev, p, 0.02), C.cream);
          if (i < n && i % 2) {
            const kind = (i + lx) % 3;
            const col = CANDY[(i * 3 + lx) % CANDY.length];
            if (kind === 0) {
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.32, p.z, 0, 0.03, 0.55, 0.48), col);
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.12, p.z, 0, 0.03, 0.18, 0.78), col);
            } else if (kind === 1) {
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.42, p.z, 0, 0.03, 0.8, 0.5), col);
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.72, p.z, 0, 0.032, 0.08, 0.5), C.white);
            } else {
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.2, p.z - 0.12, 0, 0.03, 0.34, 0.12), col);
              B.soft.addGeo(t.box, mtx(p.x, p.y - 0.2, p.z + 0.12, 0, 0.03, 0.34, 0.12), tint(col, 0.3));
            }
            B.solid.addGeo(t.box, mtx(p.x, p.y + 0.02, p.z, 0, 0.05, 0.1, 0.04), C.woodD);
          }
          prev = p;
        }
      }
      // meydanda balonlar (ağaçların dibinde)
      balloons(B, 13 * CELL + 1.5, 8 * CELL + 1.4, rnd, 4);
      balloons(B, 20 * CELL + 0.5, 13 * CELL + 0.6, rnd, 3);
      // uzakta pastel minare ve kubbe
      const mx = X / 2 + 80, mz = -60;
      for (let i = 0; i < 4; i++) B.far.addGeo(t.cyl, mtx(mx, 4.25 + i * 8.5, mz, 0, 2.4 - i * 0.1, 8.5, 2.4 - i * 0.1), i % 2 ? C.cream : 0xfff0f5);
      B.far.addGeo(t.cyl, mtx(mx, 24, mz, 0, 3.0, 1.0, 3.0), C.teal);
      B.far.addGeo(t.cyl, mtx(mx, 31, mz, 0, 2.7, 0.8, 2.7), C.coral);
      B.far.addGeo(t.cone, mtx(mx, 38, mz, 0, 2.3, 7, 2.3), C.teal);
      B.far.addGeo(t.sph, mtx(mx, 42, mz, 0, 0.6), C.sun);
      B.far.addGeo(t.dome, mtx(mx - 22, 10, mz - 6, 0, 12, 10, 12), 0x7fd8c8);
      B.far.addGeo(t.box, mtx(mx - 22, 5, mz - 6, 0, 26, 10, 26), C.peach);
      B.far.addGeo(t.sph, mtx(mx - 22, 20.5, mz - 6, 0, 1.0), C.sun);
      for (const s of [-1, 1]) B.far.addGeo(t.dome, mtx(mx - 22 + s * 10, 10, mz + 8, 0, 4, 4, 4), C.pink);
    }
    if (id === 'liman') {
      // kuzeyde direkler arasında pastel flamalar
      let prev = null;
      for (let x = -10; x <= X + 10; x += 14) {
        B.solid.addGeo(t.cyl6, mtx(x, 4.5, -8, 0, 0.16, 9, 0.16), C.wood);
        B.solid.addGeo(t.sph, mtx(x, 9.1, -8, 0, 0.26), C.coral);
        const top = V(x, 8.9, -8);
        if (prev) bunting(B, prev, top, 1.2, [C.coral, C.sun, C.skyUI, C.mintUI, C.bubble], 1.6);
        prev = top;
      }
      // rıhtım lambaları arasında flamalar
      const L = (cx, cz) => V(cx * CELL + 1.8, 5.1, cz * CELL + 1);
      bunting(B, L(5, 27), L(16, 21), 0.9, [C.sun, C.bubble, C.skyUI, C.mintUI]);
      bunting(B, L(16, 21), L(28, 27), 0.9, [C.coral, C.lilac, C.sun, C.teal]);
      // korkuluklarda can simitleri
      for (let x = 3; x < world.w - 2; x += 5) {
        if (world.at(x, 29) !== 'r') continue;
        const px = x * CELL + 1, pz = 29 * CELL + 0.72;
        B.solid.addGeo(t.torus, mtx(px, 0.72, pz, 0, 0.3, 0.3, 0.42), C.coral);
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * Math.PI * 2 + Math.PI / 4;
          B.solid.addGeo(t.box, mtx(px + Math.cos(a) * 0.3, 0.72 + Math.sin(a) * 0.3, pz, 0, 0.1, 0.1, 0.14, 0, a), C.white);
        }
      }
      // babalar (bağlama direkleri)
      for (let x = 2; x < world.w - 2; x += 4) {
        if (world.at(x, 29) !== 'r') continue;
        const px = x * CELL + 0.4, pz = Z + 0.2;
        B.solid.addGeo(t.cyl, mtx(px, 0.25, pz, 0, 0.18, 0.5, 0.18), C.skyUI);
        B.solid.addGeo(t.sph, mtx(px, 0.5, pz, 0, 0.2, 0.12, 0.2), C.cream);
      }
      // denizde şamandıralar, yelkenliler ve şeker çizgili deniz feneri
      for (let i = 0; i < 5; i++) {
        const bx = 8 + i * (X - 16) / 4 + (rnd() - 0.5) * 4, bz = Z + 7 + rnd() * 6;
        B.far.addGeo(t.ball, mtx(bx, -0.6, bz, 0, 0.55), i % 2 ? C.coral : C.sun);
        B.far.addGeo(t.cyl, mtx(bx, -0.4, bz, 0, 0.57, 0.18, 0.57), C.white);
        B.far.addGeo(t.cone, mtx(bx, 0.2, bz, 0, 0.18, 0.5, 0.18), C.ink);
        B.glow.addGeo(t.dot, mtx(bx, 0.5, bz, 0, 0.1), 0xfff0a0);
      }
      const boats = [[X * 0.18, Z + 22, C.skyUI, C.white], [X * 0.72, Z + 27, C.coral, C.butter], [X + 22, Z + 40, C.mintUI, C.pink]];
      for (const [bx, bz, hc, sc] of boats) {
        B.far.addGeo(t.dome, mtx(bx, -0.4, bz, 0, 3.4, 1.4, 1.3, Math.PI), hc);
        B.far.addGeo(t.box, mtx(bx, -0.35, bz, 0, 6.4, 0.18, 2.3), C.cream);
        B.far.addGeo(t.cyl, mtx(bx + 0.4, 2.6, bz, 0, 0.1, 6, 0.1), C.wood);
        B.soft.addGeo(t.sail, mtx(bx + 0.55, 0.1, bz, 0, 2.8, 5.2, 1), sc);
        B.soft.addGeo(t.sail, mtx(bx + 0.25, 0.1, bz, Math.PI, 1.9, 4.6, 1), tint(sc, -0.08));
        B.soft.addGeo(t.tri, mtx(bx + 0.4, 5.85, bz, 0, 0.5, 0.8, 1, 0, Math.PI / 2), C.bubble);
      }
      const lx = X + 34, lz = Z + 30;
      B.far.addGeo(t.cyl, mtx(lx, 0, lz, 0, 6, 3, 6), 0xd8cfc4);
      for (let i = 0; i < 6; i++) B.far.addGeo(t.cyl, mtx(lx, 2.6 + i * 3, lz, 0, 2.6 - i * 0.18, 3.0, 2.6 - i * 0.18), i % 2 ? C.white : C.red);
      B.far.addGeo(t.cyl, mtx(lx, 19.6, lz, 0, 2.6, 0.5, 2.6), C.ink);
      B.glow.addGeo(t.cyl, mtx(lx, 21, lz, 0, 1.3, 2.4, 1.3), 0xfff0a0);
      B.far.addGeo(t.dome, mtx(lx, 22.2, lz, 0, 1.7, 1.6, 1.7), C.red);
      B.far.addGeo(t.sph, mtx(lx, 24, lz, 0, 0.35), C.sun);
      // balonlar: dolu olmayan birkaç açık hücreye
      let placed = 0;
      for (const [cx, cz] of [[12, 22], [21, 23], [7, 19], [26, 19], [16, 8]]) {
        if (placed >= 3 || !freeOut(cx, cz)) continue;
        balloons(B, cx * CELL + 1, cz * CELL + 1, rnd, 3 + (placed % 2));
        placed++;
      }
    }
    if (id === 'us') {
      // avluda peri ışıkları (gece çok tatlı)
      const strings = [[V(26, 4.4, 24.2), V(18, 4.0, 43.8)], [V(46, 4.4, 24.2), V(54, 4.0, 43.8)], [V(30, 4.3, 24.2), V(46, 4.3, 24.2)], [V(14, 3.9, 43.8), V(26, 3.9, 43.8)], [V(46, 3.9, 43.8), V(58, 3.9, 43.8)]];
      const bulbs = [0xffe08a, 0xff9ad5, 0x9ff5d0, 0x9ad7ff, 0xffc08a];
      for (const [a, b] of strings) {
        const n = Math.round(a.distanceTo(b) / 0.8);
        let prev = a.clone();
        for (let i = 1; i <= n; i++) {
          const p = a.clone().lerp(b, i / n);
          p.y -= Math.sin((i / n) * Math.PI) * 0.7;
          B.solid.addGeo(t.rope, segMtx(prev, p, 0.02), C.ink);
          if (i < n) B.glow.addGeo(t.dot, mtx(p.x, p.y - 0.1, p.z, 0, 0.09, 0.12, 0.09), bulbs[i % bulbs.length]);
          prev = p;
        }
      }
      // rüzgâr çorabı
      const wx = 33 * CELL + 1, wz = 2 * CELL + 1;
      B.solid.addGeo(t.cyl6, mtx(wx, 2.6, wz, 0, 0.07, 5.2, 0.07), C.cream);
      B.solid.addGeo(t.sph, mtx(wx, 5.25, wz, 0, 0.12), C.sun);
      for (let i = 0; i < 4; i++) B.solid.addGeo(t.cyl, mtx(wx - 0.3 - i * 0.42, 4.95 - i * 0.08, wz, 0, 0.3 - i * 0.04, 0.42, 0.3 - i * 0.04, 0, Math.PI / 2 + 0.12), i % 2 ? C.white : C.coral);
      // hangar çatısında sevimli radar çanağı
      const rx = 17.5 * CELL + 1, rz = 7 * CELL + 1;
      B.solid.addGeo(t.cyl, mtx(rx, 5.2, rz, 0, 0.3, 0.8, 0.3), C.lilac);
      B.solid.addGeo(t.dome, mtx(rx, 5.9, rz, 0.6, 1.3, 0.55, 1.3, -0.9), C.cream);
      B.solid.addGeo(t.cyl6, mtx(rx, 6.2, rz + 0.3, 0, 0.04, 1.0, 0.04, -0.9), C.bubble);
      B.glow.addGeo(t.dot, mtx(rx, 6.6, rz + 0.75, 0, 0.12), 0xff7ab0);
      // projektör kulelerinin yerine yıldızlı gece: kenarlarda balonlar
      balloons(B, 17 * CELL + 1, 24 * CELL + 1, rnd, 3);
    }
    if (us_or_liman(id)) skyline(world, B);
    if (id === 'tesis') {
      // tavan lambaları: pastel şeritler (hiçbiri bozuk değil)
      const lampCols = [0xeefff4, 0xeefff4, 0xfff0d8, 0xd8f0ff, 0xffe0f0];
      for (let z = 0; z < world.h; z++)
        for (let x = 0; x < world.w; x++) {
          if (!world.indoor[x + z * world.w] || (x + z) % 5) continue;
          B.glowNear.addGeo(t.box, mtx(x * CELL + 1, 4.46, z * CELL + 1, 0, 1.2, 0.07, 0.3), lampCols[(x * 3 + z) % lampCols.length]);
        }
      // avluda sevimli mezar taşları (kuzey duvarı boyunca)
      let tomb = 0;
      for (const cx of [15, 17, 19, 26, 28, 30]) {
        if (tomb >= 4 || !freeOut(cx, 2) || busy.has(cx + ',2')) continue;
        tomb++;
        busy.add(cx + ',2');
        const x = cx * CELL + 1, z = 2 * CELL + 0.45;
        B.solid.addGeo(roundBox(0.7, 0.9, 0.2, 0.3), mtx(x, 0.42, z, 0), 0xc4bce0);
        B.solid.addGeo(t.box, mtx(x, 0.55, z + 0.11, 0, 0.08, 0.36, 0.04), C.white);
        B.solid.addGeo(t.box, mtx(x, 0.62, z + 0.11, 0, 0.26, 0.08, 0.04), C.white);
        flowerPatch(B.soft, x, z + 0.55, 0.9, rnd, [C.rose, C.lilac, C.white]);
      }
    }
    if (id === 'poligon') {
      // atış hattı üstünde flama, iki direk arasında
      const pz = 45 * CELL + 1;
      for (const px of [2.6, X - 2.6]) {
        for (let j = 0; j < 7; j++) B.solid.addGeo(t.cyl6, mtx(px, 0.25 + j * 0.5, pz, 0, 0.08, 0.5, 0.08), j % 2 ? C.white : C.coral);
        B.solid.addGeo(t.sph, mtx(px, 3.6, pz, 0, 0.16), C.sun);
      }
      bunting(B, V(2.6, 3.4, pz), V(X - 2.6, 3.4, pz), 0.5, [C.coral, C.sun, C.mintUI, C.skyUI, C.bubble, C.lilac]);
      balloons(B, 9 * CELL + 1, 49 * CELL + 1.2, rnd, 4);
      balloons(B, 16 * CELL + 1, 48 * CELL + 1, rnd, 3);
      const sx = 22 * CELL + 0.6, sz = 47 * CELL + 1;
      bench(B.solid, sx, sz, -Math.PI / 2, C.skyUI);
    }
  }
  const us_or_liman = (id) => id === 'us' || id === 'liman';

  // ---------------- Zombi kapıları: şeker çizgili barikat ----------------
  function dressDoors(world) {
    if (!world.doors) return;
    const t = tpl();
    for (const id in world.doors) {
      const d = world.doors[id];
      const grp = d.group, b = d.box;
      if (!grp || !b || (grp.userData && grp.userData.cute)) continue;
      grp.userData.cute = true;
      const Bk = new G.Bucket();
      const thinX = b.x1 - b.x0 > b.z1 - b.z0;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const W = thinX ? b.x1 - b.x0 : b.z1 - b.z0;
      const Hh = b.y1 - b.y0 || 3;
      // pano
      Bk.addGeo(roundBox(W - 0.02, Hh - 0.02, thinX ? b.z1 - b.z0 : b.x1 - b.x0, 0.22), mtx(cx, Hh / 2, cz, thinX ? 0 : Math.PI / 2), 0xa98be8);
      const half = (thinX ? b.z1 - b.z0 : b.x1 - b.x0) / 2;
      for (const sd of [-1, 1]) {
        const nx = thinX ? 0 : sd, nz = thinX ? sd : 0;
        const yaw = Math.atan2(nx, nz);
        const fx = cx + nx * half, fz = cz + nz * half;
        const tx = nz, tz = -nx; // yerel +x
        const P = (u, o) => [fx + tx * u + nx * o, fz + tz * u + nz * o];
        // krema çerçeve
        let p = P(0, 0.03);
        Bk.addGeo(t.box, mtx(p[0], Hh - 0.12, p[1], yaw, W - 0.1, 0.14, 0.06), C.cream);
        Bk.addGeo(t.box, mtx(p[0], 0.14, p[1], yaw, W - 0.1, 0.14, 0.06), C.cream);
        // çapraz şeker çizgili tahtalar
        const L = Math.hypot(W - 0.6, Hh - 0.7);
        const ang = Math.atan2(Hh - 0.7, W - 0.6);
        const N = 9;
        for (const s of [-1, 1]) {
          for (let i = 0; i < N; i++) {
            const tt = (i + 0.5) / N - 0.5;
            const u = Math.cos(ang) * L * tt * s, y = Hh / 2 + Math.sin(ang) * L * tt;
            p = P(u, 0.06 + (s > 0 ? 0.02 : 0));
            Bk.addGeo(t.box, mtx(p[0], y, p[1], yaw, L / N + 0.005, 0.3, 0.07, 0, ang * s), i % 2 ? C.butter : C.bubble);
          }
        }
        // ortada kalpli asma kilit
        p = P(0, 0.16);
        Bk.addGeo(roundBox(0.5, 0.42, 0.12, 0.12), mtx(p[0], 1.45, p[1], yaw), C.sun);
        Bk.addGeo(t.torus, mtx(p[0], 1.7, p[1], yaw, 0.15, 0.17, 0.2), C.cream);
        p = P(0, 0.23);
        Bk.addGeo(t.sph, mtx(p[0] + tx * -0.05, 1.47, p[1] + tz * -0.05, yaw, 0.07, 0.07, 0.03), C.coral);
        Bk.addGeo(t.sph, mtx(p[0] + tx * 0.05, 1.47, p[1] + tz * 0.05, yaw, 0.07, 0.07, 0.03), C.coral);
        Bk.addGeo(t.cone, mtx(p[0], 1.39, p[1], yaw, 0.1, 0.09, 0.03, 0, Math.PI), C.coral);
      }
      // eski parçaları kaldır
      for (const ch of grp.children.slice()) {
        grp.remove(ch);
        if (ch.geometry) ch.geometry.dispose();
        if (ch.isSprite && ch.material) ch.material.dispose();
      }
      const m = Bk.mesh(toon('pr-door', { vertexColors: true }), true);
      if (m) grp.add(m);
      // fiyat balonu (iki yüzde)
      for (const sd of [-1, 1]) {
        const sp = G.signSprite ? G.signSprite(d.name, d.cost + ' PUAN', '#ff6fa8', 2.0, 0.75) : null;
        if (!sp) continue;
        sp.position.set(cx + (thinX ? 0 : sd * (half + 0.5)), 2.55, cz + (thinX ? sd * (half + 0.5) : 0));
        grp.add(sp);
      }
    }
  }

  // ---------------- Dışa açık yardımcılar (zombies.js / story.js kullanır) ----------------
  G.cuteKit = { C, CANDY, PASTEL, tint, css, mtx, segMtx, roundBox, starGeo, scallop, tpl, rrPath, fitFont, starPath, heartPath, onFonts, FONT, toon, giftBox, flower, bush };

  G.Props = {
    dress(world) {
      const B = {
        solid: new G.Bucket(),
        soft: new G.Bucket(),
        far: new G.Bucket(),
        glow: new G.Bucket(),
        glowNear: new G.Bucket(),
        sign: new G.Bucket(),
        balloon: new G.Bucket(),
      };
      const id = world.def.id;
      const rnd = U.seeded(id.length * 977 + 13);
      // boş kalması gereken hücreler: doğma, bayrak, makine ve diğer noktalar
      const busy = new Set();
      for (const k in world.points || {}) {
        for (const p of world.points[k] || []) {
          const r = k === 'A' || k === 'B' || k === 'flag' || k === 'start' ? 0 : 1;
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) busy.add(p.x + dx + ',' + (p.z + dz));
        }
      }
      facades(world, B, rnd);
      specials(world, B, rnd, busy);
      perimeter(world, B, rnd, busy);
      scatter(world, B, rnd, busy);
      treeRing(world, B, rnd);
      const signMat = placeSigns(world, B);
      const M = mats();
      const shadowOf = { solid: true, soft: false, far: false, glow: false, glowNear: false, sign: false, balloon: true };
      for (const k in B) {
        const mat = k === 'sign' ? signMat : M[k];
        if (!mat) continue;
        const m = B[k].mesh(mat, shadowOf[k]);
        if (!m) continue;
        if (k === 'soft' || k === 'sign') m.receiveShadow = true;
        m.userData.props = k;
        world.group.add(m);
        if (k === 'balloon' && world.updaters) {
          // balonlar hafifçe süzülür
          let tt = 0;
          m.matrixAutoUpdate = true;
          world.updaters.push((dt) => {
            tt += dt;
            m.position.y = Math.sin(tt * 1.3) * 0.07;
            return !!m.parent;
          });
        }
      }
      dressDoors(world);
    },
  };
})();
