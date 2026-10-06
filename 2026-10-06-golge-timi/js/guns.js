'use strict';
// Gölge Timi — silah modeli üreticisi (sürüm 3, "oyuncak blaster"). Yan profil
// çizimlerinden yuvarlatılmış ekstrüzyonlar, şeker renkli gövdeler, zıt renkli
// kabza/şarjör/nişangah, turuncu oyuncak namlu ucu, tatlı kamuflaj desenleri,
// el tutma noktaları ve menü/öldürme akışı için silah simgeleri.
// Ayrıca karakter ve görünüm modelleri için ortak "oyuncak" geometri yardımcıları (G.toy).
(function () {
  const G = window.G;
  const U = G.util;

  // ==================================================================
  // ORTAK OYUNCAK GEOMETRİ YARDIMCILARI (G.toy)
  // ==================================================================
  const T = (G.toy = G.toy || {});
  const tg = {};
  // yuvarlatılmış kutu (w: x, h: y, d: z). Kenar yarıçapı r.
  // seg: 3 (yuvarlak) veya 1 (hafif: yalnızca yumuşak normaller)
  T.rbox = function (w, h, d, r, seg) {
    r = Math.max(0.0005, Math.min(r != null ? r : Math.min(w, h, d) * 0.35, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    seg = seg === 1 ? 1 : 3;
    const k = 'rb' + w + ':' + h + ':' + d + ':' + r + ':' + seg;
    if (tg[k]) return tg[k];
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
    const p = g.attributes.position, n = g.attributes.normal;
    const half = [w / 2, h / 2, d / 2];
    const v = [0, 0, 0], inner = [0, 0, 0], dl = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
      for (let a = 0; a < 3; a++) {
        const c = v[a];
        const s = Math.sign(c);
        const lv = Math.abs(c) > 0.4 ? half[a] : half[a] - r;
        v[a] = s * lv;
        inner[a] = U.clamp(v[a], -(half[a] - r), half[a] - r);
        dl[a] = v[a] - inner[a];
      }
      const L = Math.hypot(dl[0], dl[1], dl[2]) || 1;
      p.setXYZ(i, inner[0] + (dl[0] / L) * r, inner[1] + (dl[1] / L) * r, inner[2] + (dl[2] / L) * r);
      n.setXYZ(i, dl[0] / L, dl[1] / L, dl[2] / L);
    }
    return (tg[k] = g);
  };
  // kapsül (Y ekseni, ortada). len: düz kısım boyu
  T.capsule = function (r, len, seg, n) {
    seg = seg || 10;
    n = n || 4;
    const k = 'cp' + r + ':' + len + ':' + seg + ':' + n;
    if (tg[k]) return tg[k];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), -len / 2 + Math.sin(a) * r));
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), len / 2 + Math.sin(a) * r));
    }
    return (tg[k] = new THREE.LatheGeometry(pts, seg));
  };
  // birim küre / yarım küre (üst) / silindir / koni / torus
  T.sphere = function (ws, hs) {
    const k = 'sp' + ws + ':' + hs;
    return tg[k] || (tg[k] = new THREE.SphereGeometry(1, ws || 12, hs || 8));
  };
  T.hemi = function (ws, hs) {
    const k = 'hs' + ws + ':' + hs;
    return tg[k] || (tg[k] = new THREE.SphereGeometry(1, ws || 14, hs || 6, 0, Math.PI * 2, 0, Math.PI / 2));
  };
  T.cyl = function (seg, open) {
    const k = 'cy' + seg + ':' + !!open;
    return tg[k] || (tg[k] = new THREE.CylinderGeometry(1, 1, 1, seg || 10, 1, !!open));
  };
  T.cone = function (seg) {
    const k = 'co' + seg;
    return tg[k] || (tg[k] = new THREE.ConeGeometry(1, 1, seg || 10));
  };
  T.torus = function (r, t, rs, ts, arc) {
    const k = 'to' + r + ':' + t + ':' + rs + ':' + ts + ':' + arc;
    return tg[k] || (tg[k] = new THREE.TorusGeometry(r, t, rs || 6, ts || 14, arc || Math.PI * 2));
  };
  T.lathe = function (key, pts, seg) {
    const k = 'la' + key + ':' + seg;
    return tg[k] || (tg[k] = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 12));
  };

  // Geometri listesini tek bir köşe-renkli BufferGeometry'ye birleştirir.
  // items: [{ geo, m: Matrix4, r, g, b }]
  const _nm = new THREE.Matrix3(), _pv = new THREE.Vector3(), _nv = new THREE.Vector3();
  function bake(items) {
    let n = 0;
    for (const it of items) n += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count;
    if (!n) return null;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const it of items) {
      const g = it.geo;
      const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, I = g.index;
      // zaten köşe renkli (pişirilmiş) parçalar rengini korur
      const C = it.vc && g.attributes.color ? g.attributes.color : null;
      _nm.getNormalMatrix(it.m);
      const cnt = I ? I.count : P.count;
      for (let i = 0; i < cnt; i++) {
        const vi = I ? I.getX(i) : i;
        _pv.set(P.getX(vi), P.getY(vi), P.getZ(vi)).applyMatrix4(it.m);
        if (N) _nv.set(N.getX(vi), N.getY(vi), N.getZ(vi)).applyMatrix3(_nm).normalize();
        else _nv.set(0, 1, 0);
        pos[o * 3] = _pv.x; pos[o * 3 + 1] = _pv.y; pos[o * 3 + 2] = _pv.z;
        nor[o * 3] = _nv.x; nor[o * 3 + 1] = _nv.y; nor[o * 3 + 2] = _nv.z;
        if (C) {
          col[o * 3] = it.r * C.getX(vi); col[o * 3 + 1] = it.g * C.getY(vi); col[o * 3 + 2] = it.b * C.getZ(vi);
        } else {
          col[o * 3] = it.r; col[o * 3 + 1] = it.g; col[o * 3 + 2] = it.b;
        }
        if (UV) {
          uv[o * 2] = UV.getX(vi) * (it.uvs || 1);
          uv[o * 2 + 1] = UV.getY(vi) * (it.uvs || 1);
        }
        o++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    return geo;
  }
  T.bake = bake;
  T.vcMat = function () {
    return G.toonMat ? G.toonMat('toy-vc', { vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  };
  T.vcBasic = function () {
    return T._vcb || (T._vcb = new THREE.MeshBasicMaterial({ vertexColors: true }));
  };

  // Parça kurucu: renkli geometrileri biriktirir, tek ağ (tek çizim çağrısı) üretir.
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  class Builder {
    constructor() {
      this.items = [];
    }
    // geo, renk, konum, ölçek (sx,sy,sz), dönüş (rx,ry,rz)
    add(geo, color, x, y, z, sx, sy, sz, rx, ry, rz) {
      _c.set(color);
      _p.set(x || 0, y || 0, z || 0);
      _s.set(sx != null ? sx : 1, sy != null ? sy : sx != null ? sx : 1, sz != null ? sz : sx != null ? sx : 1);
      _e.set(rx || 0, ry || 0, rz || 0);
      _q.setFromEuler(_e);
      this.items.push({ geo, m: new THREE.Matrix4().compose(_p, _q, _s), r: _c.r, g: _c.g, b: _c.b });
      return this;
    }
    // dönüşü dördey olarak alan sürüm
    addQ(geo, color, pos, quat, sx, sy, sz) {
      _c.set(color);
      _s.set(sx, sy != null ? sy : sx, sz != null ? sz : sx);
      this.items.push({ geo, m: new THREE.Matrix4().compose(pos, quat, _s), r: _c.r, g: _c.g, b: _c.b });
      return this;
    }
    mesh(material) {
      const geo = bake(this.items);
      this.items.length = 0;
      if (!geo) return null;
      return new THREE.Mesh(geo, material || T.vcMat());
    }
  }
  T.Builder = Builder;

  // Bir grubun altındaki tüm ağları (korunan adlar hariç) köşe rengine gömerek
  // en az malzemeye indirger: toon, dokulu toon (kamuflaj) ve parlayan (basic).
  function mergeVC(root, keepNames) {
    keepNames = keepNames || [];
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const remove = [];
    root.traverse((obj) => {
      if (!obj.isMesh || obj === root) return;
      let p = obj;
      while (p && p !== root) {
        if (keepNames.includes(p.name)) return;
        p = p.parent;
      }
      const m = obj.material;
      const basic = !!m.isMeshBasicMaterial;
      const key = (basic ? 'b' : 't') + (m.map ? m.map.uuid : '');
      if (!buckets.has(key)) buckets.set(key, { basic, map: m.map || null, items: [] });
      const c = m.color || _c.set(0xffffff);
      let r = c.r, gg = c.g, b = c.b;
      if (!basic && m.emissive && m.emissiveIntensity) {
        const ei = m.emissiveIntensity * 0.6;
        r = Math.min(1, r + m.emissive.r * ei);
        gg = Math.min(1, gg + m.emissive.g * ei);
        b = Math.min(1, b + m.emissive.b * ei);
      }
      buckets.get(key).items.push({ geo: obj.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld), r, g: gg, b, uvs: obj.userData.uvs, vc: !!m.vertexColors });
      remove.push(obj);
    });
    for (const o of remove) o.parent.remove(o);
    for (const bk of buckets.values()) {
      const geo = bake(bk.items);
      if (!geo) continue;
      let mat;
      if (bk.basic) mat = T.vcBasic();
      else if (bk.map) mat = G.toonMat ? G.toonMat('toy-vc-' + bk.map.uuid, { vertexColors: true, map: bk.map }) : new THREE.MeshLambertMaterial({ vertexColors: true, map: bk.map });
      else mat = T.vcMat();
      root.add(new THREE.Mesh(geo, mat));
    }
  }
  G.mergeGroupVC = mergeVC;

  // ==================================================================
  // SİLAH GEOMETRİ YARDIMCILARI
  // ==================================================================
  const K = 1.45; // tombulluk: ekstrüzyon kalınlık çarpanı
  const HK = 1.3; // gövde yüksekliği çarpanı
  const BK = 0.64; // namlu boyu çarpanı (kısa, oyuncak namlular)
  const gcache = {};
  let LO = false; // hafif geometri (uzaktaki karakter silahları)
  const sg = (n) => (LO ? Math.max(6, Math.round(n * 0.6)) : n);
  function rb(w, h, d, r) {
    return T.rbox(w, h, d, r, LO ? 1 : 3);
  }
  function cylZ(r, len, seg, r2) {
    seg = sg(seg || 12);
    const k = 'c' + r + ':' + len + ':' + seg + ':' + r2;
    if (!gcache[k]) {
      const g = new THREE.CylinderGeometry(r2 != null ? r2 : r, r, len, seg || 12);
      g.rotateX(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  // uçları yuvarlak silindir (Z ekseni)
  function capZ(r, len, seg) {
    seg = sg(seg || 12);
    const k = 'cz' + r + ':' + len + ':' + seg + LO;
    if (!gcache[k]) {
      const g = T.capsule(r, Math.max(0.001, len - 2 * r), seg, LO ? 2 : 3).clone();
      g.rotateX(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  function cylX(r, len, seg) {
    seg = sg(seg || 14);
    const k = 'x' + r + ':' + len + ':' + seg;
    if (!gcache[k]) {
      const g = new THREE.CylinderGeometry(r, r, len, seg || 14);
      g.rotateZ(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  function ball(r) {
    const k = 'bl' + r + LO;
    if (!gcache[k]) {
      const g = LO ? new THREE.SphereGeometry(r, 6, 4) : new THREE.SphereGeometry(r, 10, 7);
      gcache[k] = g;
    }
    return gcache[k];
  }
  // Tetik korkuluğu: yarım halka (YZ düzleminde, aşağı doğru)
  function guardRing(r, t) {
    const k = 'gr' + r + ':' + t;
    if (!gcache[k]) {
      const g = new THREE.TorusGeometry(r, t, 5, 10, Math.PI);
      g.rotateZ(Math.PI);
      g.rotateY(Math.PI / 2);
      gcache[k] = g;
    }
    return gcache[k];
  }
  // pts: [ileri, yukarı] çiftleri (ileri = namlu yönü). Kalınlık X ekseninde; kenarlar yuvarlatılmış.
  function ext(pts, depth) {
    depth *= K;
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const bev = Math.min(0.009, depth * 0.22);
    const core = Math.max(0.002, depth - 2 * bev);
    const g = new THREE.ExtrudeGeometry(shape, { depth: core, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelOffset: -bev * 0.35, bevelSegments: LO ? 1 : 2, curveSegments: 4 });
    g.rotateY(Math.PI / 2);
    g.translate(-core / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }
  function add(parent, geo, mat, f, y, x, name) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, -(f || 0));
    if (name) m.name = name;
    parent.add(m);
    return m;
  }

  // ==================================================================
  // DOKULAR (tatlı kamuflaj desenleri)
  // ==================================================================
  const tcache = {};
  function canvasTex(key, size, draw, repeat) {
    if (tcache[key]) return tcache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const rnd = U.seeded(key.length * 7919 + key.charCodeAt(key.length - 1) * 31);
    draw(ctx, size, rnd);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const retro = G.settings && G.settings.pixel > 1;
    t.magFilter = retro ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = retro ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    t.repeat.set(repeat || 6, repeat || 6);
    tcache[key] = t;
    return t;
  }
  // Döşemeli çizim: şekli kenarlardan taşan kopyalarıyla birlikte çizer
  function tile(s, x, y, fn) {
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) fn(x + dx, y + dy);
  }
  function heart(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.9);
    ctx.fill();
  }
  function star(ctx, x, y, r, n, inner) {
    n = n || 5;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const rr = i % 2 ? r * (inner || 0.45) : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  function sparkle(ctx, x, y, r) {
    star(ctx, x, y, r, 4, 0.25);
  }
  function dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function stripes(ctx, s, cols, w) {
    // 45° şeritler (döşemeli)
    const n = cols.length;
    for (let i = -2 * s; i < 2 * s; i += w) {
      ctx.fillStyle = cols[((i / w) % n + n) % n];
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + w, 0);
      ctx.lineTo(i + w + s, s);
      ctx.lineTo(i + s, s);
      ctx.fill();
    }
  }
  const CAMO_DRAW = {
    // Orman: çimen yeşili, yapraklar ve minik papatyalar
    orman(ctx, s, rnd) {
      ctx.fillStyle = '#7ed957';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 14; i++) {
        const x = rnd() * s, y = rnd() * s, a = rnd() * 6.28, r = 4 + rnd() * 4;
        ctx.fillStyle = rnd() < 0.5 ? '#5bbf3a' : '#a8e98a';
        tile(s, x, y, (px, py) => {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.6, r * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
      for (let i = 0; i < 6; i++) {
        const x = rnd() * s, y = rnd() * s;
        tile(s, x, y, (px, py) => {
          ctx.fillStyle = '#fffaf3';
          for (let k = 0; k < 5; k++) dot(ctx, px + Math.cos(k * 1.256) * 2.6, py + Math.sin(k * 1.256) * 2.6, 1.8);
          ctx.fillStyle = '#ffd23f';
          dot(ctx, px, py, 1.6);
        });
      }
    },
    // Çöl: şeftali-kum şeker şeritleri
    col(ctx, s) {
      stripes(ctx, s, ['#ffd99a', '#ffc178', '#fff1c9', '#ffc178'], 8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 4; i++) tile(s, 8 + i * 16, 8 + i * 16, (x, y) => dot(ctx, x, y, 1.6));
    },
    // Kentsel: lila-gri zeminde pastel kalpler
    kent(ctx, s) {
      ctx.fillStyle = '#c9c4e0';
      ctx.fillRect(0, 0, s, s);
      const cols = ['#ff8fab', '#9ad7ff', '#fff1a8', '#a8e6cf'];
      let k = 0;
      for (let y = 8; y < s; y += 16)
        for (let x = (y / 16) % 2 < 1 ? 8 : 16; x < s + 8; x += 16) {
          ctx.fillStyle = cols[k++ % cols.length];
          tile(s, x, y, (px, py) => heart(ctx, px, py, 4.2));
        }
    },
    // Kış: buz mavisi, kar taneleri
    kis(ctx, s, rnd) {
      ctx.fillStyle = '#d8f1ff';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 7; i++) {
        const x = rnd() * s, y = rnd() * s, r = 3 + rnd() * 3;
        tile(s, x, y, (px, py) => {
          ctx.beginPath();
          for (let a = 0; a < 3; a++) {
            const an = (a * Math.PI) / 3;
            ctx.moveTo(px - Math.cos(an) * r, py - Math.sin(an) * r);
            ctx.lineTo(px + Math.cos(an) * r, py + Math.sin(an) * r);
          }
          ctx.stroke();
        });
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) tile(s, rnd() * s, rnd() * s, (x, y) => dot(ctx, x, y, 1.2));
    },
    // Kızıl Kaplan: mandalina zemin, yumuşak şeritler
    kaplan(ctx, s, rnd) {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#e8743b';
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * s + rnd() * 4;
        tile(s, x, 0, (px, py) => {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.quadraticCurveTo(px + 7, py + s * 0.25, px + 1, py + s * 0.5);
          ctx.quadraticCurveTo(px + 7, py + s * 0.75, px, py + s);
          ctx.lineTo(px + 3, py + s);
          ctx.quadraticCurveTo(px + 10, py + s * 0.75, px + 4, py + s * 0.5);
          ctx.quadraticCurveTo(px + 10, py + s * 0.25, px + 3, py);
          ctx.fill();
        });
      }
      ctx.fillStyle = '#fff1c9';
      for (let i = 0; i < 5; i++) tile(s, rnd() * s, rnd() * s, (x, y) => dot(ctx, x, y, 1.5));
    },
    // Gece: gece moru zemin, yıldızlar ve hilal
    gece(ctx, s, rnd) {
      ctx.fillStyle = '#3d3b8e';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 6; i++) tile(s, rnd() * s, rnd() * s, (x, y) => star(ctx, x, y, 3.2 + rnd() * 0.01));
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) tile(s, rnd() * s, rnd() * s, (x, y) => dot(ctx, x, y, 0.9));
      tile(s, s * 0.7, s * 0.3, (x, y) => {
        ctx.fillStyle = '#fff1a8';
        dot(ctx, x, y, 5);
        ctx.fillStyle = '#3d3b8e';
        dot(ctx, x + 2.4, y - 1.6, 4.4);
      });
    },
    // Lale: pembe zeminde laleler
    lale(ctx, s) {
      ctx.fillStyle = '#ffd3e0';
      ctx.fillRect(0, 0, s, s);
      const tulip = (x, y, c) => {
        ctx.fillStyle = '#5bbf3a';
        ctx.fillRect(x - 0.8, y, 1.6, 7);
        ctx.beginPath();
        ctx.ellipse(x + 2.2, y + 4.5, 2.4, 1.1, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x - 3.6, y - 5);
        ctx.lineTo(x - 1.8, y - 2.6);
        ctx.lineTo(x, y - 5.6);
        ctx.lineTo(x + 1.8, y - 2.6);
        ctx.lineTo(x + 3.6, y - 5);
        ctx.quadraticCurveTo(x + 3.8, y + 1, x, y + 1);
        ctx.quadraticCurveTo(x - 3.8, y + 1, x - 3.6, y - 5);
        ctx.fill();
      };
      const cols = ['#ff4f79', '#ff8fab', '#ffb347', '#e05ad6'];
      let k = 0;
      for (let y = 10; y < s + 4; y += 16) for (let x = (y / 16) % 2 < 1 ? 8 : 16; x < s + 8; x += 16) {
        const c = cols[k++ % cols.length];
        tile(s, x, y, (px, py) => tulip(px, py, c));
      }
    },
    // Altın: sıcak altın gradyan, beyaz pırıltılar
    altin(ctx, s, rnd) {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#ffd23f');
      g.addColorStop(0.5, '#ffe98a');
      g.addColorStop(1, '#ffd23f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,179,71,0.55)';
      for (let i = 0; i < 6; i++) tile(s, rnd() * s, rnd() * s, (x, y) => dot(ctx, x, y, 3 + rnd() * 0.01));
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) tile(s, rnd() * s, rnd() * s, (x, y) => sparkle(ctx, x, y, 3.5));
    },
    // Elmas: buz camgöbeği, eşkenar dörtgen ışıltılar
    elmas(ctx, s, rnd) {
      ctx.fillStyle = '#c9f4ff';
      ctx.fillRect(0, 0, s, s);
      const cols = ['#8fe3ff', '#ffffff', '#d6c8ff', '#a8f0ff'];
      let k = 0;
      for (let y = 0; y < s; y += 8)
        for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) {
          ctx.fillStyle = cols[k++ % cols.length];
          ctx.beginPath();
          ctx.moveTo(x + 4, y);
          ctx.lineTo(x + 8, y + 4);
          ctx.lineTo(x + 4, y + 8);
          ctx.lineTo(x, y + 4);
          ctx.fill();
        }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) tile(s, rnd() * s, rnd() * s, (x, y) => sparkle(ctx, x, y, 4));
    },
    // Dönüşüm (yükseltilmiş): gökkuşağı şeritleri ve yıldızlar
    donusum(ctx, s, rnd) {
      stripes(ctx, s, ['#ff8fab', '#ffb347', '#fff1a8', '#a8e6cf', '#9ad7ff', '#cdb4ff'], 8);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) tile(s, rnd() * s, rnd() * s, (x, y) => star(ctx, x, y, 3.4));
    },
    // Oyuncak ahşap: karamel tonlu yumuşak damarlar
    ahsap(ctx, s) {
      ctx.fillStyle = '#e8a85c';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(190,120,60,0.45)';
      ctx.lineWidth = 2;
      for (let y = 4; y < s; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y - 3, s * 0.6, y + 3, s, y);
        ctx.stroke();
      }
    },
  };
  G.camoTexture = function (id) {
    return canvasTex('camo-' + id, 64, CAMO_DRAW[id] || CAMO_DRAW.orman, 6);
  };
  G.camoSwatch = function (id) {
    const k = 'sw-' + id;
    if (tcache[k]) return tcache[k];
    if (!CAMO_DRAW[id]) return (tcache[k] = 'linear-gradient(135deg,#5cc8ff 0%,#5cc8ff 50%,#ffd23f 50%,#ffd23f 100%)');
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const key = 'camo-' + id;
    CAMO_DRAW[id](c.getContext('2d'), 64, U.seeded(key.length * 7919 + key.charCodeAt(key.length - 1) * 31));
    return (tcache[k] = `url(${c.toDataURL()})`);
  };

  // ==================================================================
  // MALZEMELER (toon, şeker renkleri)
  // ==================================================================
  const mcache = {};
  function toon(key, o) {
    if (mcache[key]) return mcache[key];
    if (o.basic) return (mcache[key] = new THREE.MeshBasicMaterial({ color: o.color, transparent: !!o.transparent, opacity: o.opacity != null ? o.opacity : 1 }));
    const p = { color: o.color != null ? o.color : 0xffffff };
    if (o.map) p.map = o.map;
    if (o.emissive != null) {
      p.emissive = o.emissive;
      p.emissiveIntensity = o.ei != null ? o.ei : 1;
    }
    if (o.transparent) {
      p.transparent = true;
      p.opacity = o.opacity != null ? o.opacity : 0.5;
      p.depthWrite = false;
    }
    const m = G.toonMat ? G.toonMat(null, p) : new THREE.MeshLambertMaterial(p);
    return (mcache[key] = m);
  }
  // Diğer dosyaların kullandığı genel silah/eşya malzemesi (geriye uyumlu imza)
  G.gunMat = function (color, o) {
    o = o || {};
    return toon('gm' + color + ':' + (o.emissive || 0) + ':' + (o.ei || 0), { color, emissive: o.emissive, ei: o.ei });
  };
  // Sınıfa göre şeker renkleri: [gövde, aksan (kabza/dipçik), şarjör]
  const CANDY = {
    // tüfekler takım kollarından (gök mavisi / mercan) ayrışsın: nane, lila, güneş
    ar: [[0x3ddc97, 0xffd23f, 0xff6fa8], [0xb39cff, 0xffb347, 0x4ecdc4], [0xffd23f, 0xff6fa8, 0x4cc3ff]],
    smg: [[0x3ddc97, 0xff6fa8, 0xfff1a8], [0x8ee6a8, 0xb39cff, 0xffb347], [0xffd23f, 0x4cc3ff, 0xff6fa8]],
    shotgun: [[0xff8b94, 0xffe08a, 0x4ecdc4], [0xffa36c, 0xfff1a8, 0x9b5de5]],
    dmr: [[0xb39cff, 0x3ddc97, 0xffd23f], [0x9ad7ff, 0xff8fab, 0xfff1a8]],
    sniper: [[0x4ecdc4, 0xffb347, 0xff6fa8], [0x7a8cff, 0xffd23f, 0x3ddc97], [0xa8e6cf, 0xff8b94, 0xb39cff]],
    lmg: [[0xffb347, 0x4cc3ff, 0xff6b6b], [0xff8b94, 0x9b5de5, 0xffd23f]],
    special: [[0xffaaa5, 0x4ecdc4, 0xfff1a8]],
    pistol: [[0xff7fb5, 0x4cc3ff, 0xfff1a8], [0x9ad7ff, 0xff8b94, 0xffd23f], [0xcdb4ff, 0xffd23f, 0x3ddc97], [0xffd23f, 0xff6fa8, 0x4cc3ff]],
    launcher: [[0x9be15d, 0xffb347, 0xff6b6b], [0x4cc3ff, 0xff6fa8, 0xffd23f]],
    wonder: [[0x9b5de5, 0x39ff9a, 0xfff1a8]],
  };
  function hashStr(s) {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function candyFor(stats) {
    const L = stats.look || {};
    if (L.kind === 'frost') return [0x7fd6ff, 0xb39cff, 0x8fe8ff];
    if (L.kind === 'flare') return [0xffb347, 0xff6b6b, 0xfff1a8];
    const list = CANDY[stats.cls] || CANDY.ar;
    return list[hashStr(stats.id || L.kind || 'x') % list.length];
  }
  const INK = 0x5d4b7d, TRIM = 0xb9b0e0, LIGHT = 0xeeeaff, PLUM = 0x4a3a5c, TIP = 0xff9f43;
  function gunMats(stats) {
    const L = stats.look || {};
    const camo = stats.upgraded ? 'donusum' : stats.camo && stats.camo !== 'yok' ? stats.camo : null;
    const [cb, cf, cm] = candyFor(stats);
    const M = {};
    if (camo) {
      const tex = G.camoTexture(camo);
      const o = { map: tex, color: 0xffffff };
      if (camo === 'donusum') Object.assign(o, { emissive: 0x9b5de5, ei: 0.22 });
      if (camo === 'elmas') Object.assign(o, { emissive: 0x4ecdc4, ei: 0.18 });
      if (camo === 'altin') Object.assign(o, { emissive: 0xffb347, ei: 0.12 });
      M.body = toon('camo-body-' + camo, o);
      M.furn = toon('camo-furn-' + camo, o);
    } else {
      M.body = toon('body' + cb, { color: cb });
      M.furn = L.wood ? toon('wood', { color: 0xffffff, map: canvasTex('ahsap', 32, CAMO_DRAW.ahsap, 6) }) : toon('furn' + cf, { color: cf });
    }
    M.mag = toon('mag' + cm, { color: cm });
    M.accent = toon('acc' + cf, { color: cf });
    M.metal = toon('trim', { color: TRIM });
    M.steel = toon('light', { color: LIGHT });
    M.dark = toon('ink', { color: INK });
    M.rubber = toon('plum', { color: PLUM });
    M.lens = toon('lens', { color: 0x7fe0ff, emissive: 0x2a6a90, ei: 0.5 });
    M.glass = toon('glass', { color: 0xbff0ff, transparent: true, opacity: 0.22 });
    M.brass = toon('brass', { color: 0xffd23f });
    M.red = toon('red', { color: 0xff3d7f, basic: true });
    M.glow = toon('glow' + (L.furn || 0), { color: L.furn || 0x39ff9a, basic: true });
    M.orange = toon('orange', { color: 0xffb347 });
    M.tip = toon('tip', { color: TIP });
    return M;
  }

  // ==================================================================
  // PARÇA KURUCULAR (oyuncak oranları; tutma noktaları ve nişan çizgisi korunur)
  // ==================================================================
  // Uzun silah (tüfek / makineli / av tüfeği / keskin nişancı)
  function longGun(g, s, M, P) {
    const L = s.look;
    const len = L.len || 0.36;
    const back = len * 0.42, front = len * 0.58;
    const H = (L.h || 0.085) * HK;
    const top = H * 0.62, bot = -H * 0.38;
    const hw = 0.052 * K * 0.5; // gövde yarı genişliği
    // üst gövde (yuvarlatılmış)
    add(g, ext([[-back, 0.0], [front, 0.0], [front, top - 0.012], [front - 0.02, top], [-back + 0.016, top], [-back, top - 0.016]], 0.052), M.body, 0, 0, 0);
    // alt gövde + şarjör yuvası
    const mf = L.kind === 'bullpup' ? -0.14 : 0.07;
    add(g, ext([[-back + 0.03, 0.001], [front - 0.03, 0.001], [front - 0.055, bot], [mf + 0.05, bot], [mf - 0.05, bot], [-back + 0.055, bot]], 0.048), M.body, 0, 0, 0);
    // tetik korkuluğu + tetik
    const tgf = L.kind === 'bullpup' ? 0.02 : -0.01;
    add(g, guardRing(0.026, 0.0065), M.dark, tgf + 0.012, bot + 0.002, 0);
    add(g, capZ(0.006, 0.026, 6), M.accent, tgf + 0.016, bot - 0.012, 0).rotation.x = 0.5;
    // fişek atma noktası ve kurma kolu (top başlı)
    P.eject = new THREE.Object3D();
    P.eject.position.set(0.03, top * 0.55, -front * 0.25);
    g.add(P.eject);
    P.bolt = new THREE.Group();
    P.bolt.name = 'bolt';
    add(P.bolt, rb(0.016, 0.014, 0.032), M.steel, 0, 0, 0);
    add(P.bolt, ball(0.011), M.accent, 0, 0, 0.012);
    P.bolt.position.set(hw + 0.006, top - 0.014, -(-back + 0.035));
    g.add(P.bolt);
    // ray (üst, tek parça yuvarlak çubuk)
    const railFrom = -back + 0.02, railTo = front + (L.guard || 0) * (L.gs === 'rail' || L.gs === 'mlok' ? 0.95 : 0);
    if (L.sight !== 'post' || L.scope) add(g, rb(0.03, 0.012, railTo - railFrom, 0.005), M.metal, (railFrom + railTo) / 2, top + 0.004, 0);
    // yan süs: küçük yıldız düğme
    add(g, ball(0.012), M.accent, front * 0.45, top * 0.45, hw + 0.002).scale.set(0.5, 1, 1);
    add(g, ball(0.012), M.accent, front * 0.45, top * 0.45, -hw - 0.002).scale.set(0.5, 1, 1);
    // kabza
    const gf = L.kind === 'bullpup' ? 0.03 : -0.045;
    add(g, ext([[gf - 0.022, 0], [gf + 0.028, 0], [gf + 0.008, -0.1], [gf - 0.038, -0.106], [gf - 0.04, -0.09]], 0.038), M.furn, 0, bot + 0.005, 0);
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
        add(g, ext([[front, top - 0.008], [front + guard, top - 0.014], [front + guard, -0.022], [front + guard - 0.02, -0.034], [front + 0.01, -0.036], [front, -0.024]], 0.054), M.furn, 0, 0, 0);
      } else if (gs === 'pump') {
        P.guard = new THREE.Group();
        P.guard.name = 'pump';
        add(P.guard, ext([[0, 0.0], [guard, 0.0], [guard, -0.036], [0, -0.036]], 0.052), M.furn, 0, 0, 0);
        for (let i = 0; i < 3; i++) add(P.guard, rb(0.052 * K + 0.006, 0.008, 0.012, 0.004), M.accent, 0.03 + (i * (guard - 0.06)) / 2, -0.018, 0);
        P.guard.position.set(0, -0.006, -(front + 0.06));
        g.add(P.guard);
      } else if (gs === 'slim') {
        add(g, rb(0.062, 0.05, guard), M.furn, gc, 0.012, 0);
      } else if (gs === 'heat') {
        add(g, rb(0.068, 0.056, guard), M.metal, gc, 0.01, 0);
        for (let i = 0; i < 3; i++) add(g, ball(0.011), M.dark, front + 0.03 + (i * (guard - 0.06)) / 2, 0.012, 0.034).scale.set(0.5, 1, 1);
      } else {
        // ray / mlok / delikli: tombul el kundağı + yuvarlak düğmeler
        add(g, rb(0.07, 0.056, guard), gs === 'mlok' ? M.furn : M.body, gc, 0.012, 0);
        const n = Math.max(2, Math.min(4, Math.floor(guard / 0.07)));
        for (let i = 0; i < n; i++) {
          const f = front + 0.03 + (i * (guard - 0.06)) / Math.max(1, n - 1);
          for (const sx of [-1, 1]) add(g, ball(0.01), gs === 'mlok' ? M.accent : M.dark, f, 0.014, sx * 0.035).scale.set(0.45, 1, 1);
        }
      }
      gEnd = front + guard;
    }
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.03, -(front + Math.max(0.06, guard * 0.55) + (gs === 'pump' ? 0.05 : 0)));
    g.add(P.leftHand);
    // namlu (kalın, oyuncak)
    const barrel = (L.barrel || 0.25) * BK;
    const br = (L.kind === 'sniper' ? 0.015 : L.kind === 'shotgun' || L.kind === 'auto-shotgun' ? 0.016 : 0.012) * 1.9;
    const bl = barrel + guard * 0.6;
    add(g, cylZ(br, bl, 12), M.metal, gEnd - guard * 0.6 + bl / 2, 0.02, 0);
    let muzzleF = gEnd + barrel;
    if (gs !== 'pump' && guard > 0) add(g, rb(0.04, 0.04, 0.03, 0.012), M.accent, gEnd + 0.015, 0.02, 0);
    // pompalı alt tüp
    if (L.mag === 'tube') add(g, capZ(0.016, Math.max(0.1, guard + barrel * 0.55), 10), M.metal, front + (guard + barrel * 0.55) / 2, -0.014, 0);
    // namlu ağzı + turuncu oyuncak ucu
    if (!s.att.muzzle) muzzleF = muzzleDevice(g, M, L.muzzle, muzzleF, br);
    // arpacık / gez
    if (!L.scope) {
      if (L.sight === 'post') {
        add(g, rb(0.012, 0.036, 0.02, 0.005), M.accent, gEnd + barrel - 0.05, 0.02 + br + 0.012, 0);
        add(g, rb(0.036, 0.018, 0.04, 0.007), M.metal, front - 0.02, top + 0.009, 0);
        P.sightY = top + 0.03;
      } else if (L.sight === 'carry') {
        add(g, rb(0.032, 0.03, 0.12, 0.01), M.body, -back + 0.1, top + 0.022, 0);
        // arka gez: ortası delik halka (nişan alırken içinden bakılır)
        add(g, T.torus(0.011, 0.0045, 5, 12), M.accent, -back + 0.06, top + 0.04, 0);
        add(g, ext([[0, 0], [0.03, 0], [0.02, 0.055], [0.01, 0.055]], 0.012), M.accent, gEnd - 0.03, 0.035, 0);
        P.sightY = top + 0.04;
      } else if (L.sight === 'rail') {
        add(g, rb(0.03, 0.022, 0.014, 0.005), M.accent, -back + 0.04, top + 0.018, 0);
        add(g, rb(0.022, 0.024, 0.014, 0.005), M.accent, railTo - 0.02, top + 0.018, 0);
        P.sightY = top + 0.028;
      } else P.sightY = top + 0.02;
    }
    // dipçik
    if (!s.noStock) buildStock(g, s, M, L.kind === 'bullpup' ? 'bullpup' : L.stock, -back, top, bot);
    // çatal ayak
    if (L.bipod || s.att.under === 'ayak') {
      for (const x of [-0.02, 0.02]) {
        const leg = add(g, capZ(0.007, 0.16, 6), M.dark, gEnd - 0.1, -0.022, x);
        leg.rotation.x = 0.05;
      }
    }
    if (L.mag === 'belt') add(g, rb(0.05, 0.014, 0.034), M.metal, front * 0.5, top + 0.012, 0);
    return muzzleF;
  }

  function toyTip(g, M, f, r, y) {
    add(g, cylZ(r, 0.024, 12), M.tip, f - 0.012, y, 0);
  }

  function muzzleDevice(g, M, kind, f, br) {
    if (kind === 'flash') {
      add(g, cylZ(br + 0.004, 0.04, 12), M.metal, f + 0.02, 0.02, 0);
      toyTip(g, M, f + 0.05, br + 0.006, 0.02);
      return f + 0.05;
    }
    if (kind === 'brake') {
      add(g, rb(br * 2 + 0.016, br * 2 + 0.014, 0.05, 0.01), M.metal, f + 0.025, 0.02, 0);
      toyTip(g, M, f + 0.05, br + 0.004, 0.02);
      return f + 0.05;
    }
    if (kind === 'big') {
      add(g, rb(0.07, 0.05, 0.08, 0.016), M.metal, f + 0.04, 0.02, 0);
      for (let i = 0; i < 2; i++) add(g, rb(0.074, 0.012, 0.012, 0.005), M.accent, f + 0.025 + i * 0.03, 0.02, 0);
      toyTip(g, M, f + 0.08, 0.028, 0.02);
      return f + 0.08;
    }
    toyTip(g, M, f, br + 0.004, 0.02);
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
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([0.032 + t * 0.03, -t * ml]);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        pts.push([-0.032 + t * 0.045, -t * ml]);
      }
      m = add(g, ext(pts, 0.03), M.mag, f, bot, 0, 'mag');
    } else if (kind === 'straight') {
      m = add(g, ext([[-0.03, 0], [0.032, 0], [0.034, -ml], [-0.028, -ml]], 0.028), M.mag, f, bot, 0, 'mag');
    } else if (kind === 'box') {
      m = add(g, ext([[-0.035, 0], [0.035, 0], [0.035, -ml * 0.6], [-0.035, -ml * 0.6]], 0.036), M.mag, f, bot, 0, 'mag');
    } else if (kind === 'drum') {
      m = new THREE.Group();
      m.name = 'mag';
      add(m, rb(0.034, 0.04, 0.05), M.dark, 0, -0.02, 0);
      add(m, cylX(0.075, 0.08, 16), M.mag, 0, -0.1, 0);
      add(m, cylX(0.034, 0.086, 12), M.steel, 0, -0.1, 0);
      m.position.set(0, bot, -f);
      g.add(m);
    } else if (kind === 'belt') {
      m = new THREE.Group();
      m.name = 'mag';
      add(m, rb(0.08, 0.09, 0.11, 0.02), M.mag, 0, -0.05, 0.02);
      for (let i = 0; i < 4; i++) add(m, ball(0.01), M.brass, 0, 0.006 + i * 0.01, -0.035 + i * 0.006).position.x = 0.032 - i * 0.012;
      m.position.set(-0.01, bot, -f);
      g.add(m);
    } else if (kind === 'pdw') {
      m = add(g, rb(0.046, 0.032, 0.24), M.mag, 0.04, 0.075, 0, 'mag');
    }
    P.mag = m;
  }

  function buildStock(g, s, M, kind, b, top, bot) {
    const F = M.furn;
    if (kind === 'collapsible') {
      add(g, capZ(0.016, 0.16, 8), M.metal, b - 0.08, 0.025, 0);
      add(g, ext([[0, 0.045], [0.07, 0.04], [0.06, -0.02], [0.0, -0.06], [-0.012, -0.06], [-0.012, 0.045]], 0.04), F, b - 0.2, 0.0, 0);
      add(g, rb(0.06, 0.112, 0.02, 0.009), M.rubber, b - 0.212, -0.008, 0);
    } else if (kind === 'full' || kind === 'wood') {
      add(g, ext([[0, top - 0.005], [-0.25, top - 0.015], [-0.27, top - 0.01], [-0.27, bot - 0.075], [-0.24, bot - 0.075], [0, bot + 0.01]], 0.044), F, b, 0, 0);
      add(g, rb(0.066, 0.13, 0.02, 0.009), M.rubber, b - 0.275, (top + bot - 0.075) / 2 - 0.005, 0);
    } else if (kind === 'skeleton') {
      add(g, ext([[0, 0.04], [-0.24, 0.035], [-0.24, 0.018], [0, 0.023]], 0.022), F, b, 0, 0);
      add(g, ext([[0, -0.008], [-0.24, -0.048], [-0.24, -0.066], [0, -0.026]], 0.022), F, b, 0, 0);
      add(g, rb(0.044, 0.124, 0.022, 0.009), M.rubber, b - 0.245, -0.012, 0);
    } else if (kind === 'folding') {
      for (const y of [0.03, -0.015]) add(g, capZ(0.006, 0.22, 6), M.metal, b - 0.09, y, 0.042);
      add(g, rb(0.012, 0.064, 0.016, 0.005), M.accent, b - 0.2, 0.008, 0.042);
    } else if (kind === 'sniper') {
      add(g, ext([[0, top - 0.005], [-0.06, top + 0.012], [-0.2, top + 0.012], [-0.29, top], [-0.29, bot - 0.08], [-0.2, bot - 0.08], [-0.12, bot - 0.02], [-0.06, bot - 0.06], [0, bot]], 0.046), F, b, 0, 0);
      add(g, rb(0.07, 0.14, 0.02, 0.009), M.rubber, b - 0.293, (top + bot - 0.08) / 2, 0);
      add(g, rb(0.04, 0.014, 0.09, 0.006), M.accent, b - 0.18, top + 0.02, 0);
    } else if (kind === 'bullpup') {
      add(g, rb(0.07, 0.12, 0.024, 0.01), M.rubber, b - 0.01, -0.01, 0);
    } else {
      add(g, rb(0.05, 0.05, 0.022, 0.01), M.rubber, b - 0.01, 0.02, 0);
    }
  }

  function pistol(g, s, M, P) {
    const L = s.look;
    const big = L.big ? 1.12 : 1;
    const len = 0.2 * big;
    P.slide = new THREE.Group();
    P.slide.name = 'slide';
    add(P.slide, ext([[-0.04, 0.045], [len - 0.03, 0.045], [len - 0.03, 0.078], [len - 0.045, 0.09], [-0.03, 0.09], [-0.04, 0.08]], 0.032 * big), M.body, 0, 0, 0);
    for (let i = 0; i < 2; i++) add(P.slide, rb(0.032 * big * K + 0.004, 0.026, 0.006, 0.003), M.accent, -0.022 + i * 0.012, 0.066, 0);
    add(P.slide, rb(0.008, 0.012, 0.008, 0.003), M.accent, len - 0.045, 0.096, 0);
    add(P.slide, rb(0.024, 0.012, 0.008, 0.004), M.accent, -0.025, 0.096, 0);
    g.add(P.slide);
    add(g, ext([[-0.03, 0.045], [len - 0.05, 0.045], [len - 0.05, 0.03], [0.06, 0.02], [0.03, 0.02], [-0.03, 0.03]], 0.028 * big), M.furn, 0, 0, 0);
    add(g, ext([[-0.035, 0.03], [0.02, 0.03], [0.0, -0.075], [-0.045, -0.08], [-0.05, -0.07]], 0.03 * big), M.furn, 0, 0, 0);
    add(g, guardRing(0.022, 0.0055), M.dark, 0.026, 0.024, 0);
    add(g, cylZ(0.013, 0.02, 10), M.tip, len - 0.025, 0.065, 0);
    P.mag = add(g, rb(0.03, 0.05, 0.034, 0.01), M.mag, -0.025, -0.07, 0, 'mag');
    if (L.kind === 'mpistol') {
      P.mag.scale.y = 1.8;
      P.mag.position.y = -0.09;
      add(g, rb(0.044, 0.034, 0.04, 0.012), M.metal, len - 0.01, 0.068, 0);
      toyTip(g, M, len + 0.012, 0.016, 0.068);
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
    add(g, cylZ(0.017, 0.17, 12), M.body, 0.13, 0.07, 0);
    add(g, rb(0.018, 0.016, 0.17, 0.006), M.accent, 0.13, 0.089, 0);
    toyTip(g, M, 0.215, 0.02, 0.07);
    add(g, ext([[-0.03, 0.04], [0.06, 0.04], [0.06, 0.095], [-0.02, 0.095], [-0.04, 0.08]], 0.03), M.body, 0, 0, 0);
    const cyl = new THREE.Group();
    cyl.name = 'cylinder';
    add(cyl, cylZ(0.034, 0.052, 14), M.mag, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(cyl, ball(0.008), M.dark, -0.026, Math.sin(a) * 0.02, Math.cos(a) * 0.02);
    }
    cyl.position.set(0, 0.068, -0.02);
    g.add(cyl);
    P.mag = cyl;
    add(g, ext([[-0.035, 0.045], [0.0, 0.045], [-0.012, -0.07], [-0.06, -0.075], [-0.065, -0.06]], 0.034), M.furn, 0, 0, 0);
    add(g, guardRing(0.02, 0.005), M.dark, 0.012, 0.038, 0);
    add(g, ball(0.012), M.accent, -0.046, 0.094, 0);
    add(g, rb(0.008, 0.012, 0.008, 0.003), M.accent, 0.2, 0.1, 0);
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
    add(g, cylZ(0.026, 0.16, 14), M.body, 0.08, 0.06, 0);
    add(g, cylZ(0.032, 0.022, 14), M.accent, 0.155, 0.06, 0);
    add(g, ext([[-0.03, 0.035], [0.02, 0.035], [0.0, -0.07], [-0.045, -0.075], [-0.05, -0.065]], 0.034), M.body, 0, 0, 0);
    add(g, guardRing(0.02, 0.005), M.dark, 0.016, 0.03, 0);
    add(g, rb(0.024, 0.022, 0.03, 0.008), M.rubber, -0.025, 0.07, 0);
    P.mag = add(g, cylZ(0.019, 0.03, 10), toon('flareShell', { color: 0xff6b6b }), 0.0, 0.06, 0, 'mag');
    P.sightY = 0.092;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.025, 0.02);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(-0.012, -0.04, 0.01);
    g.add(P.leftHand);
    return 0.17;
  }

  function launcher(g, s, M, P) {
    add(g, cylZ(0.06, 0.95, 16), M.body, 0.25, 0.09, 0);
    add(g, cylZ(0.072, 0.08, 16, 0.064), M.accent, 0.74, 0.09, 0);
    add(g, cylZ(0.076, 0.1, 16, 0.062), M.accent, -0.22, 0.09, 0);
    for (const f of [0.05, 0.45]) add(g, cylZ(0.064, 0.025, 16), M.mag, f, 0.09, 0);
    add(g, ext([[-0.02, 0.035], [0.025, 0.035], [0.005, -0.07], [-0.035, -0.075]], 0.034), M.furn, 0, 0, 0);
    add(g, ext([[0.28, 0.035], [0.32, 0.035], [0.305, -0.06], [0.27, -0.06]], 0.032), M.furn, 0, 0, 0);
    add(g, rb(0.026, 0.05, 0.06, 0.01), M.rubber, 0.18, 0.165, -0.065);
    add(g, ball(0.012), M.lens, 0.21, 0.175, -0.065);
    add(g, guardRing(0.02, 0.005), M.dark, 0.02, 0.03, 0);
    P.mag = new THREE.Group();
    P.mag.name = 'mag';
    const war = new THREE.Mesh(T.cone(12), toon('warhead', { color: 0xff6b6b }));
    war.scale.set(0.064, 0.2, 0.064);
    war.rotation.x = -Math.PI / 2;
    P.mag.add(war);
    const nose = new THREE.Mesh(ball(0.022), toon('warnose', { color: 0xfff1a8 }));
    nose.position.z = -0.1;
    P.mag.add(nose);
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
    add(g, cylZ(0.028, 0.2, 12), M.body, 0.22, 0.05, 0);
    add(g, cylZ(0.034, 0.04, 12), M.tip, 0.33, 0.05, 0);
    const cyl = new THREE.Group();
    cyl.name = 'mag';
    add(cyl, cylZ(0.07, 0.12, 16), M.mag, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(cyl, ball(0.016), M.steel, -0.056, Math.sin(a) * 0.042, Math.cos(a) * 0.042);
    }
    cyl.position.set(0, 0.03, -0.07);
    g.add(cyl);
    P.mag = cyl;
    add(g, rb(0.034, 0.03, 0.3, 0.01), M.metal, 0.05, 0.1, 0);
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
    for (const x of [-0.019, 0.019]) {
      add(g, cylZ(0.019, 0.55, 12), M.metal, 0.08 + 0.275, 0.02, x);
      toyTip(g, M, 0.63, 0.021, 0.02);
    }
    add(g, rb(0.012, 0.008, 0.55, 0.004), M.accent, 0.355, 0.042, 0);
    P.guard = add(g, ext([[0.09, 0.005], [0.33, 0.0], [0.33, -0.022], [0.1, -0.03]], 0.05), M.furn, 0, 0, 0, 'fore');
    buildStock(g, s, M, 'wood', -0.06, 0.04, -0.02);
    add(g, guardRing(0.022, 0.0055), M.dark, 0.012, -0.018, 0);
    P.mag = new THREE.Group();
    P.mag.name = 'mag';
    for (const x of [-0.019, 0.019]) add(P.mag, capZ(0.016, 0.06, 10), toon('shellRed', { color: 0xff6b6b }), 0, 0, x);
    P.mag.position.set(0, 0.02, -0.11);
    P.mag.visible = false;
    g.add(P.mag);
    P.sightY = 0.048;
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
    add(g, rb(0.024, 0.012, 0.4, 0.005), M.metal, 0.2, 0.04, 0);
    for (const side of [-1, 1]) {
      const limb = add(g, rb(0.25, 0.024, 0.03, 0.011), M.furn, 0.4, 0.03, side * 0.13);
      limb.rotation.y = side * 0.35;
      add(g, ball(0.016), M.accent, 0.36, 0.03, side * 0.245);
    }
    P.string = add(g, rb(0.46, 0.004, 0.004, 0.0015), M.rubber, 0.32, 0.04, 0, 'string');
    P.mag = new THREE.Group();
    P.mag.name = 'mag';
    add(P.mag, cylZ(0.007, 0.42, 6), M.steel, 0, 0, 0);
    const tip = new THREE.Mesh(ball(0.016), M.tip);
    tip.position.z = -0.22;
    P.mag.add(tip);
    for (const sx of [-1, 1]) add(P.mag, rb(0.002, 0.02, 0.03, 0.001), M.accent, -0.19, 0.008, sx * 0.004).rotation.z = sx * 0.6;
    P.mag.position.set(0, 0.05, -0.2);
    g.add(P.mag);
    add(g, ext([[-0.035, 0.0], [0.01, 0.0], [-0.01, -0.09], [-0.05, -0.095]], 0.034), M.furn, 0, 0, 0);
    add(g, guardRing(0.02, 0.005), M.dark, 0.0, -0.002, 0);
    buildStock(g, s, M, 'skeleton', -0.05, 0.035, -0.02);
    P.sightY = 0.07;
    add(g, rb(0.022, 0.025, 0.014, 0.005), M.accent, 0.02, 0.06, 0);
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
    const glow = toon('wglow' + frost, { color: frost ? 0x8fe8ff : 0x39ff9a, basic: true });
    add(g, ext([[-0.05, 0.03], [0.2, 0.03], [0.22, 0.06], [0.2, 0.095], [-0.04, 0.095]], 0.05), M.body, 0, 0, 0);
    for (let i = 0; i < 3; i++) add(g, T.torus(0.04, 0.01, 6, 14), glow, 0.08 + i * 0.05, 0.062, 0);
    add(g, ball(0.026), glow, 0.25, 0.062, 0);
    if (frost) for (let i = 0; i < 3; i++) add(g, new THREE.OctahedronGeometry(0.022), glow, 0.05 + i * 0.06, 0.112, 0);
    else for (let i = 0; i < 3; i++) add(g, ball(0.012), M.accent, 0.02 + i * 0.06, 0.1, 0);
    add(g, ext([[-0.035, 0.03], [0.01, 0.03], [-0.01, -0.07], [-0.05, -0.075]], 0.034), M.body, 0, 0, 0);
    add(g, guardRing(0.02, 0.005), M.dark, 0.012, 0.026, 0);
    P.mag = add(g, rb(0.034, 0.04, 0.07, 0.012), glow, -0.02, 0.11, 0, 'mag');
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
    add(g, cylZ(0.017, 0.08, 10), M.metal, 0.29, 0.02, 0);
    toyTip(g, M, 0.33, 0.02, 0.02);
    add(g, rb(0.034, 0.022, 0.06, 0.008), M.accent, -0.04, 0.09, 0);
    P.sightY = 0.11;
    P.rightHand = new THREE.Object3D();
    P.rightHand.position.set(0, -0.06, 0.05);
    g.add(P.rightHand);
    P.leftHand = new THREE.Object3D();
    P.leftHand.position.set(0, -0.05, -0.12);
    g.add(P.leftHand);
    P.mag = add(g, rb(0.046, 0.028, 0.24, 0.012), M.mag, 0.03, 0.072, 0, 'mag');
    return 0.33;
  }

  function vector(g, s, M, P) {
    add(g, ext([[-0.1, 0.0], [0.2, 0.0], [0.2, 0.06], [-0.1, 0.06]], 0.05), M.body, 0, 0, 0);
    add(g, ext([[0.02, 0.0], [0.2, 0.0], [0.16, -0.08], [0.08, -0.12], [0.02, -0.06]], 0.048), M.furn, 0, 0, 0);
    add(g, ext([[-0.035, 0.0], [0.015, 0.0], [-0.005, -0.1], [-0.045, -0.105]], 0.034), M.furn, 0, 0, 0);
    add(g, cylZ(0.017, 0.12, 10), M.metal, 0.26, 0.03, 0);
    toyTip(g, M, 0.32, 0.02, 0.03);
    add(g, rb(0.028, 0.01, 0.26, 0.004), M.metal, 0.05, 0.066, 0);
    buildStock(g, s, M, s.noStock ? 'none' : 'skeleton', -0.1, 0.05, -0.01);
    P.sightY = 0.08;
    add(g, rb(0.024, 0.022, 0.012, 0.005), M.accent, -0.08, 0.075, 0);
    add(g, rb(0.018, 0.024, 0.012, 0.005), M.accent, 0.18, 0.075, 0);
    P.mag = add(g, ext([[-0.025, 0], [0.025, 0], [0.028, -0.16], [-0.022, -0.16]], 0.026), M.mag, 0.12, -0.06, 0, 'mag');
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
    o.name = 'optic';
    let h = 0.03;
    if (kind === 'refleks') {
      add(o, rb(0.03, 0.012, 0.036, 0.005), M.dark, 0, 0.006, 0);
      add(o, rb(0.032, 0.03, 0.008, 0.004), M.accent, 0.016, 0.024, 0);
      add(o, rb(0.024, 0.022, 0.003, 0.001), M.glass, 0.012, 0.024, 0);
      add(o, ball(0.0018), M.red, 0.012, 0.022, 0);
      h = 0.022;
    } else if (kind === 'kirmizi') {
      add(o, rb(0.03, 0.016, 0.05, 0.006), M.dark, 0, 0.008, 0);
      add(o, openTube(0.021, 0.055), M.accent, 0, 0.03, 0);
      add(o, cylZ(0.017, 0.002, 14), M.glass, -0.02, 0.03, 0);
      add(o, ball(0.002), M.red, -0.02, 0.03, 0);
      h = 0.03;
    } else if (kind === 'holo') {
      add(o, rb(0.052, 0.016, 0.08, 0.006), M.dark, 0, 0.008, 0);
      add(o, rb(0.008, 0.05, 0.08, 0.003), M.accent, 0, 0.03, -0.024);
      add(o, rb(0.008, 0.05, 0.08, 0.003), M.accent, 0, 0.03, 0.024);
      add(o, rb(0.056, 0.01, 0.08, 0.004), M.accent, 0, 0.058, 0);
      add(o, rb(0.036, 0.036, 0.002, 0.001), M.glass, 0.03, 0.03, 0);
      add(o, ball(0.002), M.red, -0.01, 0.03, 0);
      h = 0.03;
    } else if (kind === 'durbun' || kind === 'prizma') {
      const big = kind === 'prizma';
      add(o, rb(0.03, 0.02, 0.06, 0.007), M.dark, 0, 0.01, 0);
      const tl = big ? 0.13 : 0.16;
      add(o, openTube(big ? 0.024 : 0.022, tl), M.accent, 0, 0.042, 0);
      add(o, openTube(0.03, 0.03, 0.024), M.accent, big ? 0.07 : 0.085, 0.042, 0);
      if (big) add(o, rb(0.044, 0.044, 0.06, 0.012), M.dark, -0.01, 0.042, 0).position.y = 0.052;
      add(o, ball(0.008), M.steel, 0, 0.068, 0);
      add(o, cylZ(0.02, 0.002, 14), M.glass, 0.06, 0.042, 0);
      h = 0.042;
    }
    o.position.set(0, railY, -f);
    g.add(o);
    P.sightY = railY + h;
    P.optic = o;
  }
  // iki ucu açık tüp (nişan alırken içinden bakılabilsin)
  function openTube(r, len, r2) {
    const k = 'ot' + r + ':' + len + ':' + r2;
    if (!gcache[k]) {
      const gg = new THREE.CylinderGeometry(r2 != null ? r2 : r, r, len, 14, 1, true);
      gg.rotateX(Math.PI / 2);
      gcache[k] = gg;
    }
    return gcache[k];
  }

  function sniperScope(g, M, P, railY) {
    const sc = new THREE.Group();
    sc.name = 'scope';
    add(sc, cylZ(0.026, 0.3, 14), M.accent, 0, 0, 0);
    add(sc, cylZ(0.038, 0.08, 14, 0.027), M.accent, 0.17, 0, 0);
    add(sc, cylZ(0.028, 0.06, 14, 0.034), M.accent, -0.15, 0, 0);
    for (const f of [0.03, -0.11]) add(sc, cylZ(0.03, 0.014, 14), M.dark, f, 0, 0);
    add(sc, rb(0.02, 0.034, 0.02, 0.007), M.steel, 0.02, 0.028, 0);
    add(sc, cylX(0.012, 0.074, 10), M.steel, 0.02, 0, 0);
    for (const f of [-0.06, 0.08]) add(sc, rb(0.03, 0.04, 0.024, 0.008), M.metal, f, -0.03, 0);
    const lens = add(sc, cylZ(0.034, 0.004, 14), M.lens, 0.21, 0, 0);
    lens.name = 'lens';
    add(sc, ball(0.006), M.steel, 0.212, 0.012, 0.012);
    sc.position.set(0, railY + 0.05, -0.02);
    g.add(sc);
    P.sightY = railY + 0.05;
  }

  function attachments(g, s, M, P, muzzleF, isPistol) {
    const att = s.att;
    const L = s.look;
    const railY = isPistol ? 0.09 : (L.h || 0.085) * HK * 0.62 + 0.009;
    if (L.scope && !att.optic) sniperScope(g, M, P, railY);
    else optic(g, s, M, P, railY, isPistol ? 0.04 : L.kind === 'bullpup' ? -0.05 : 0.02);
    const my = isPistol ? 0.07 : L.kind === 'launcher' ? 0.09 : 0.02;
    if (att.muzzle === 'susturucu') {
      const r = isPistol ? 0.019 : 0.026, l = isPistol ? 0.12 : 0.18;
      add(g, capZ(r, l, 12), M.accent, muzzleF + l / 2, my, 0);
      for (const t of [0.3, 0.7]) add(g, cylZ(r + 0.002, 0.01, 12), M.dark, muzzleF + l * t, my, 0);
      muzzleF += l;
    } else if (att.muzzle === 'kompansator') {
      add(g, rb(0.04, 0.036, 0.06, 0.012), M.metal, muzzleF + 0.03, my, 0);
      add(g, rb(0.042, 0.008, 0.012, 0.004), M.accent, muzzleF + 0.02, my + 0.014, 0);
      muzzleF += 0.06;
    } else if (att.muzzle === 'alev') {
      add(g, cylZ(0.02, 0.07, 12, 0.026), M.metal, muzzleF + 0.035, my, 0);
      toyTip(g, M, muzzleF + 0.07, 0.028, my);
      muzzleF += 0.07;
    } else if (att.muzzle === 'fren') {
      muzzleF = muzzleDevice(g, M, 'brake', muzzleF, 0.017);
    }
    if (!isPistol && L.guard) {
      const gf = (L.len || 0.36) * 0.58 + L.guard * 0.5;
      if (att.under === 'dikey') {
        add(g, T.capsule(0.017, 0.06, 10), M.accent, gf, -0.07, 0);
        if (P.leftHand) P.leftHand.position.set(0, -0.08, -gf);
      } else if (att.under === 'acili') {
        add(g, ext([[0, 0], [0.07, 0], [0.0, -0.045]], 0.03), M.accent, gf - 0.03, -0.02, 0);
      } else if (att.under === 'lazer') {
        add(g, rb(0.026, 0.026, 0.06, 0.009), M.dark, gf, 0.012, 0.05);
        add(g, ball(0.005), M.red, gf + 0.031, 0.012, 0.05);
      }
    }
    if (att.barrel === 'uzun' && !isPistol) {
      add(g, cylZ(0.018, 0.1, 10), M.metal, muzzleF + 0.05, 0.02, 0);
      toyTip(g, M, muzzleF + 0.1, 0.021, 0.02);
      muzzleF += 0.1;
    }
    return muzzleF;
  }

  // ---------------- Ana kurucu ----------------
  G.buildGun = function (stats, opts) {
    const o = opts || {};
    LO = !!o.lo;
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
    muzzle.position.set(0, isPistol ? 0.07 : k === 'launcher' ? 0.09 : 0.02, -muzzleF - 0.01);
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
    g.userData = { sightY: P.sightY || 0.1, parts: P, muzzleZ: -muzzleF - 0.01, isPistol };
    if (o.merge) {
      // karakter silahı: hareketli parçalar yerine boş tutma noktaları bırak, hepsini birleştir
      for (const key of ['mag', 'guard', 'slide', 'bolt', 'string', 'optic']) {
        const part = P[key];
        if (!part || !part.parent) continue;
        const a = new THREE.Object3D();
        a.name = key + '-anchor';
        a.position.copy(part.position);
        a.quaternion.copy(part.quaternion);
        part.parent.add(a);
        P[key] = a;
      }
      mergeVC(g, []);
    }
    if (o.shadow) g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    LO = false;
    return g;
  };

  // ---------------- Malzemeye göre birleştirme (geriye uyumluluk) ----------------
  function mergeGroup(root, keepNames) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const remove = [];
    root.traverse((obj) => {
      if (!obj.isMesh || obj === root) return;
      let p = obj;
      while (p && p !== root) {
        if (keepNames.includes(p.name)) return;
        p = p.parent;
      }
      const key = obj.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat: obj.material, items: [] });
      buckets.get(key).items.push({ geo: obj.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld), r: 1, g: 1, b: 1 });
      remove.push(obj);
    });
    for (const o of remove) o.parent.remove(o);
    for (const { mat, items } of buckets.values()) {
      const geo = bake(items);
      if (!geo) continue;
      if (!mat.vertexColors) geo.deleteAttribute('color');
      root.add(new THREE.Mesh(geo, mat));
    }
  }
  G.mergeGroup = mergeGroup;

  // ---------------- Silah simgeleri ve önizleme görüntüleri ----------------
  let iconR = null;
  // Stüdyo ortam haritası (önizleme ve simge çizicileri; toon malzemeler için gerekmez,
  // ama metalik görünüm isteyen diğer çiziciler için korunur)
  G.studioEnv = function (renderer) {
    try {
      const sc = new THREE.Scene();
      const geo = new THREE.SphereGeometry(10, 16, 8);
      const cols = [];
      const pos = geo.attributes.position;
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 10;
        if (y > 0.55) c.setRGB(1.6, 1.55, 1.5);
        else if (y > 0) c.setRGB(0.7 + y * 0.6, 0.72 + y * 0.6, 0.85 + y * 0.6);
        else c.setRGB(0.55, 0.48, 0.62);
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const pm = new THREE.PMREMGenerator(renderer);
      const tex = pm.fromScene(sc, 0.03).texture;
      pm.dispose();
      return tex;
    } catch (e) {
      return null;
    }
  };
  // Saydam görüntünün çevresine 2 piksel mürdüm konturu
  function outline2d(srcCanvas, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.drawImage(srcCanvas, 0, 0, w, h);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    let a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let pass = 0; pass < 2; pass++) {
      const nb = a.slice();
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const i = xx + yy * w;
          if (a[i]) continue;
          if ((xx > 0 && a[i - 1]) || (xx < w - 1 && a[i + 1]) || (yy > 0 && a[i - w]) || (yy < h - 1 && a[i + w])) {
            d[i * 4] = 59;
            d[i * 4 + 1] = 42;
            d[i * 4 + 2] = 74;
            d[i * 4 + 3] = 255;
            nb[i] = 1;
          }
        }
      a = nb;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  function iconRenderer() {
    if (iconR) return iconR;
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ee, 0xcdb4ff, 0.5));
    const d = new THREE.DirectionalLight(0xffffff, 0.55);
    d.position.set(2, 3, 1.5);
    scene.add(d);
    const rim = new THREE.DirectionalLight(0xbfe9ff, 0.2);
    rim.position.set(-1, 2, -2);
    scene.add(rim);
    const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.01, 10);
    cam.position.set(3, 0.35, 0.6);
    cam.lookAt(0, 0, 0);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    iconR = { r, scene, cam, white };
    return iconR;
  }
  const iconCache = {};
  const _box = new THREE.Box3(), _bc = new THREE.Vector3(), _bs = new THREE.Vector3();
  // mode: 'icon' (beyaz silüet) veya 'thumb' (renkli, mürdüm konturlu)
  G.weaponImage = function (id, mode, camo, att) {
    const key = id + ':' + mode + ':' + (camo || '') + ':' + JSON.stringify(att || {});
    if (iconCache[key]) return iconCache[key];
    let url = '';
    try {
      const R = iconRenderer();
      const icon = mode === 'icon';
      const w = icon ? 128 : 256, h = icon ? 48 : 112;
      R.r.setSize(w, h, false);
      const stats = G.computeStats(id, att || {}, { camo });
      const gun = G.buildGun(stats);
      const holder = new THREE.Group();
      holder.add(gun);
      // simge: tam yan profil; küçük resim: hafif üç çeyrek açı
      R.cam.position.set(3, icon ? 0 : 0.35, icon ? 0 : 0.6);
      R.cam.lookAt(0, 0, 0);
      R.cam.updateMatrixWorld(true);
      _box.setFromObject(gun);
      _box.getCenter(_bc);
      gun.position.sub(_bc);
      _box.getSize(_bs);
      R.scene.add(holder);
      const aspect = w / h;
      const span = Math.max(_bs.z, _bs.y * aspect) * (icon ? 0.53 : 0.56);
      R.cam.left = -span;
      R.cam.right = span;
      R.cam.top = span / aspect;
      R.cam.bottom = -span / aspect;
      R.cam.updateProjectionMatrix();
      if (icon) R.scene.overrideMaterial = R.white;
      R.r.setClearColor(0x000000, 0);
      R.r.render(R.scene, R.cam);
      url = icon ? R.r.domElement.toDataURL('image/png') : outline2d(R.r.domElement, w, h);
      R.scene.overrideMaterial = null;
      R.scene.remove(holder);
    } catch (e) {
      url = '';
    }
    iconCache[key] = url;
    return url;
  };
})();
