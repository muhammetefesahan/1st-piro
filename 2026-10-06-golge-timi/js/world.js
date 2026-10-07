'use strict';
// Gölge Timi — dünya: harita geometrisi, çarpışma, ışın izleme, navigasyon.
// Görünüm "oyuncak kutusu": her bina ayrı pastel tonda (köşe renkleri), şeker
// renkli konteynerler, lolipop ağaçlar, kabarık çizgi film bulutları, köpüklü
// turkuaz deniz. Çarpışma kutuları ve yerleşim oynanış için birebir korunur;
// görseller malzemeye göre birleştirilir (az çizim çağrısı, telefon dostu).
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const WALKABLE = new Set(['.', ',', 'd']);
  const DOOR_CHARS = new Set(['1', '2', '3', '4']);
  const OBSTACLE = new Set(['c', 'C', 'x', 'h', 'b', 'v', 'K', 'w', 'T', 'L']);
  // Şeker renkleri (konteyner, araç, gemi yükü)
  const CONTAINER_COLORS = [0xff8b94, 0x9ad7ff, 0xa8e6cf, 0xfff1a8, 0xcdb4ff, 0xffb347, 0x4ecdc4, 0xffaaa5];
  const DEF_BLD = [0xa8e6cf, 0xffd3b6, 0xffaaa5, 0xfff1a8, 0xcdb4ff, 0x9ad7ff];
  const DEF_ROOF = [0xff8b94, 0xffb347, 0x4ecdc4];
  const DEF_WALL = [0xffd3b6, 0xfff1a8];
  const DEF_CAR = [0xff8b94, 0x9ad7ff, 0xffb347, 0xcdb4ff, 0x4ecdc4];

  // ---------------- Ortak geometriler ve dönüşüm yardımcıları ----------------
  const GEO = {};
  function geo(k) {
    if (GEO[k]) return GEO[k];
    let g;
    if (k === 'box') g = new THREE.BoxGeometry(1, 1, 1);
    else if (k === 'cyl') g = new THREE.CylinderGeometry(1, 1, 1, 14);
    else if (k === 'cyl8') g = new THREE.CylinderGeometry(1, 1, 1, 8);
    else if (k === 'sph') g = new THREE.SphereGeometry(1, 12, 8);
    else if (k === 'sphLo') g = new THREE.SphereGeometry(1, 8, 6);
    else if (k === 'sphMd') g = new THREE.SphereGeometry(1, 10, 7);
    else if (k === 'dome') g = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    else if (k === 'cone') g = new THREE.ConeGeometry(1, 1, 10);
    else if (k === 'plane') g = new THREE.PlaneGeometry(1, 1);
    return (GEO[k] = g);
  }
  const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  // konum, yalpa (ry), ölçek, eğim (rx), yuvarlanma (rz) — 'YXZ' sırası: önce eğ, sonra döndür
  function mtx(x, y, z, ry, sx, sy, sz, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
  }
  // Kutuyu merkez + boyutla ekle
  function cube(B, x, y, z, sx, sy, sz, color, ry) {
    B.addGeo(geo('box'), mtx(x, y, z, ry || 0, sx, sy, sz), color);
  }
  const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

  // ---------------- Geometri kovası ----------------
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  ];

  class Bucket {
    constructor() {
      this.p = [];
      this.n = [];
      this.uv = [];
      this.c = [];
    }
    // opts: {uv:'world'|'unit', scale, color, skip:{top,bottom}}
    box(x0, y0, z0, x1, y1, z1, opts) {
      const o = opts || {};
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      const hs = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
      const col = new THREE.Color(o.color != null ? o.color : 0xffffff);
      const scale = o.scale || 2;
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        if (f === 3 && o.skipBottom !== false) continue;
        if (f === 2 && o.skipTop) continue;
        const ax = F.n[0] ? 0 : F.n[1] ? 1 : 2;
        const sign = F.n[ax];
        const center = [cx, cy, cz];
        center[ax] += sign * hs[ax];
        const ua = F.u[0] ? 0 : F.u[1] ? 1 : 2;
        const va = F.v[0] ? 0 : F.v[1] ? 1 : 2;
        const hu = hs[ua], hv = hs[va];
        const corners = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ];
        const base = this.p.length / 3;
        for (let k = 0; k < 4; k++) {
          const su = corners[k][0], sv = corners[k][1];
          const px = center[0] + F.u[0] * hu * su + F.v[0] * hv * sv;
          const py = center[1] + F.u[1] * hu * su + F.v[1] * hv * sv;
          const pz = center[2] + F.u[2] * hu * su + F.v[2] * hv * sv;
          this.p.push(px, py, pz);
          this.n.push(F.n[0], F.n[1], F.n[2]);
          if (o.uv === 'unit') {
            this.uv.push((su + 1) / 2, (sv + 1) / 2);
          } else {
            const uu = (px * F.u[0] + py * F.u[1] + pz * F.u[2]) / scale;
            const vv = (px * F.v[0] + py * F.v[1] + pz * F.v[2]) / scale;
            this.uv.push(uu, vv);
          }
          this.c.push(col.r, col.g, col.b);
        }
        this._idx = this._idx || [];
        this._idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    quadTop(x0, z0, x1, z1, y, scale, color) {
      const col = new THREE.Color(color != null ? color : 0xffffff);
      const base = this.p.length / 3;
      const pts = [
        [x0, z1],
        [x1, z1],
        [x1, z0],
        [x0, z0],
      ];
      for (const [x, z] of pts) {
        this.p.push(x, y, z);
        this.n.push(0, 1, 0);
        this.uv.push(x / scale, -z / scale);
        this.c.push(col.r, col.g, col.b);
      }
      this._idx = this._idx || [];
      this._idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    // Aşağı bakan yatay dörtgen (tavanlar için)
    quadBottom(x0, z0, x1, z1, y, scale, color) {
      const col = new THREE.Color(color != null ? color : 0xffffff);
      const base = this.p.length / 3;
      const pts = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      for (const [x, z] of pts) {
        this.p.push(x, y, z);
        this.n.push(0, -1, 0);
        this.uv.push(x / scale, z / scale);
        this.c.push(col.r, col.g, col.b);
      }
      this._idx = this._idx || [];
      this._idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    // Herhangi bir geometriyi dönüştürüp kovaya ekle
    addGeo(geo, matrix, color, uvScale) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matrix);
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      const col = new THREE.Color(color != null ? color : 0xffffff);
      const base = this.p.length / 3;
      this._idx = this._idx || [];
      for (let i = 0; i < pos.count; i++) {
        this.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        this.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        if (uv) this.uv.push(uv.getX(i) * (uvScale || 1), uv.getY(i) * (uvScale || 1));
        else this.uv.push(0, 0);
        this.c.push(col.r, col.g, col.b);
        this._idx.push(base + i);
      }
      g.dispose();
    }
    mesh(material, shadows) {
      if (!this.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(this._idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      if (shadows !== false) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      return m;
    }
  }
  G.Bucket = Bucket;

  // ---------------- Dünya ----------------
  class World {
    constructor(def) {
      this.def = def;
      this.theme = def.theme;
      const grid = G.parseGrid(def.rows);
      this.w = grid.w;
      this.h = grid.h;
      this.at = grid.at;
      this.rows = def.rows.map((r) => r.split(''));
      this.sizeX = this.w * CELL;
      this.sizeZ = this.h * CELL;
      this.boxes = [];
      this.cellBoxes = [];
      for (let i = 0; i < this.w * this.h; i++) this.cellBoxes.push([]);
      this.walk = new Uint8Array(this.w * this.h);
      this.points = def.points || {};
      this.barrels = [];
      this.smokes = [];
      this.doors = {};
      this.lamps = [];
      this.group = new THREE.Group();
      this.stamp = 1;
      this.indoor = new Uint8Array(this.w * this.h);
      this.updaters = [];
    }

    cellCenter(cx, cz, out) {
      const o = out || new THREE.Vector3();
      return o.set(cx * CELL + CELL / 2, 0, cz * CELL + CELL / 2);
    }
    cellOf(x, z) {
      return [Math.floor(x / CELL), Math.floor(z / CELL)];
    }
    isWalkable(cx, cz) {
      if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return false;
      return this.walk[cx + cz * this.w] === 1;
    }
    pointPos(p, out) {
      return this.cellCenter(p.x, p.z, out);
    }

    addBox(x0, y0, z0, x1, y1, z1, info) {
      const b = { x0, y0, z0, x1, y1, z1, kind: (info && info.kind) || 'solid', clip: !!(info && info.clip), disabled: false, ent: (info && info.ent) || null, _s: 0, metal: !!(info && info.metal) };
      this.boxes.push(b);
      const cx0 = Math.max(0, Math.floor(x0 / CELL)), cx1 = Math.min(this.w - 1, Math.floor((x1 - 1e-4) / CELL));
      const cz0 = Math.max(0, Math.floor(z0 / CELL)), cz1 = Math.min(this.h - 1, Math.floor((z1 - 1e-4) / CELL));
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) this.cellBoxes[x + z * this.w].push(b);
      return b;
    }

    // Aynı karakterden oluşan dikdörtgenleri birleştir
    mergeRects(chars) {
      const used = new Uint8Array(this.w * this.h);
      const out = [];
      for (let z = 0; z < this.h; z++) {
        for (let x = 0; x < this.w; x++) {
          const ch = this.rows[z][x];
          if (used[x + z * this.w] || !chars.has(ch)) continue;
          let w = 1;
          while (x + w < this.w && this.rows[z][x + w] === ch && !used[x + w + z * this.w]) w++;
          let h = 1;
          outer: while (z + h < this.h) {
            for (let k = 0; k < w; k++) {
              if (this.rows[z + h][x + k] !== ch || used[x + k + (z + h) * this.w]) break outer;
            }
            h++;
          }
          for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) used[x + dx + (z + dz) * this.w] = 1;
          out.push({ x, z, w, h, ch });
        }
      }
      return out;
    }

    computeIndoor() {
      const q = [];
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++)
          if (this.rows[z][x] === ',') {
            this.indoor[x + z * this.w] = 1;
            q.push(x, z);
          }
      while (q.length) {
        const z = q.pop(), x = q.pop();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const i = nx + nz * this.w;
          if (this.indoor[i]) continue;
          const ch = this.rows[nz][nx];
          if (ch === ',' || OBSTACLE.has(ch)) {
            this.indoor[i] = 1;
            q.push(nx, nz);
          }
        }
      }
    }

    // Bitişik bina hücrelerini (duvar, pencere, kapı, iç zemin) tek "bina" say:
    // her bina kendi pastel rengini alır.
    computeBuildings() {
      const n = this.w * this.h;
      this.bld = new Int16Array(n).fill(-1);
      const isB = (x, z) => {
        const ch = this.rows[z][x];
        return ch === 'H' || ch === '=' || ch === 'd' || DOOR_CHARS.has(ch) || this.indoor[x + z * this.w] === 1;
      };
      let id = 0;
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          if (this.bld[x + z * this.w] >= 0 || !isB(x, z)) continue;
          const q = [x, z];
          this.bld[x + z * this.w] = id;
          while (q.length) {
            const cz = q.pop(), cx = q.pop();
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, nz = cz + dz;
              if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
              const ni = nx + nz * this.w;
              if (this.bld[ni] >= 0 || !isB(nx, nz)) continue;
              this.bld[ni] = id;
              q.push(nx, nz);
            }
          }
          id++;
        }
      this.bldCount = id;
    }
    // Hücrenin bina rengi (k: aynı binada duvar başına küçük çeşitleme)
    bldColor(x, z, arr, k) {
      const b = this.bld ? this.bld[x + z * this.w] : 0;
      const off = this.def.id.length;
      return pick(arr, Math.max(0, b) + off + (this.theme.tintPerRect ? k || 0 : 0));
    }

    build(scene) {
      const T = this.theme;
      this.scene = scene;
      this.computeIndoor();
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) this.walk[x + z * this.w] = WALKABLE.has(this.rows[z][x]) ? 1 : 0;
      this.computeBuildings();
      const pal = (this.pal = {
        bld: T.buildingColors || DEF_BLD,
        roof: T.roofColors || DEF_ROOF,
        wall: T.wallColors || DEF_WALL,
        cover: T.coverColor != null ? T.coverColor : 0xfff1a8,
        trim: T.trimColor != null ? T.trimColor : 0xfffaf3,
        ceil: T.ceilColor != null ? T.ceilColor : 0xfff6ec,
        cont: T.containerColors || CONTAINER_COLORS,
        car: T.carColors || DEF_CAR,
        pole: T.poleColor != null ? T.poleColor : 0x7a6aa8,
        rail: T.railColor != null ? T.railColor : 0x4ecdc4,
      });

      const B = {
        wall: new Bucket(),
        building: new Bucket(),
        roof: new Bucket(),
        indoor: new Bucket(),
        crate: new Bucket(),
        container: new Bucket(),
        sandbag: new Bucket(),
        concrete: new Bucket(),
        rust: new Bucket(),
        metal: new Bucket(),
        wood: new Bucket(),
        paint: new Bucket(),
        trunk: new Bucket(),
        leaf: new Bucket(),
        glow: new Bucket(),
      };
      const H_WALL = 6, H_BLD = 4.8;

      // Çevre duvarları: uzun duvarlar görsel olarak renkli bloklara bölünür (çarpışma tek kutu)
      let wi = 0;
      for (const r of this.mergeRects(new Set(['#']))) {
        const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        this.wallVisual(B, x0, z0, x1, z1, H_WALL, wi++);
        this.addBox(x0, 0, z0, x1, H_WALL, z1, { kind: 'wall' });
      }
      // Bina duvarları
      let bi = 0;
      for (const r of this.mergeRects(new Set(['H']))) {
        const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        // görsel üst yüz 2 cm aşağıda: üstteki korniş/parapetle aynı düzlemde titreşmesin (çarpışma kutusu aynı)
        B.building.box(x0, 0, z0, x1, H_BLD - 0.02, z1, { scale: 3, color: this.bldColor(r.x, r.z, pal.bld, bi++) });
        this.addBox(x0, 0, z0, x1, H_BLD, z1, { kind: 'wall' });
      }
      // Pencereler, kapı boşlukları
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const ch = this.rows[z][x];
          const x0 = x * CELL, z0 = z * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
          if (ch === '=') {
            const col = this.bldColor(x, z, pal.bld, x + z);
            B.building.box(x0, 0, z0, x1, 1.0, z1, { scale: 3, skipTop: false, color: col });
            B.building.box(x0, 2.2, z0, x1, H_BLD, z1, { scale: 3, skipBottom: false, color: col });
            this.addBox(x0, 0, z0, x1, 1.0, z1, { kind: 'wall' });
            this.addBox(x0, 2.2, z0, x1, H_BLD, z1, { kind: 'wall' });
            // pencere pervazı: krem rengi, biraz taşkın
            const alongX = this.at(x - 1, z) === 'H' || this.at(x + 1, z) === 'H' || this.at(x - 1, z) === '=' || this.at(x + 1, z) === '=';
            if (alongX) B.paint.box(x0, 0.98, (z0 + z1) / 2 - 0.58, x1, 1.08, (z0 + z1) / 2 + 0.58, { color: pal.trim, skipBottom: false });
            else B.paint.box((x0 + x1) / 2 - 0.58, 0.98, z0, (x0 + x1) / 2 + 0.58, 1.08, z1, { color: pal.trim, skipBottom: false });
          } else if (ch === 'd') {
            B.building.box(x0, 2.6, z0, x1, H_BLD, z1, { scale: 3, skipBottom: false, color: this.bldColor(x, z, pal.bld, x + z) });
            this.addBox(x0, 2.6, z0, x1, H_BLD, z1, { kind: 'wall' });
          }
        }
      // İç zemin ve çatı
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const i = x + z * this.w;
          const ch = this.rows[z][x];
          if (this.indoor[i] || ch === 'd') B.indoor.quadTop(x * CELL, z * CELL, (x + 1) * CELL, (z + 1) * CELL, 0.02, 2);
        }
      {
        // çatı: iç hücreler birleşik; üstü renkli kiremit, altı krem tavan
        const saved = this.rows;
        this.rows = saved.map((row, z) => row.map((ch, x) => (this.indoor[x + z * this.w] ? '§' : ch)));
        for (const r of this.mergeRects(new Set(['§']))) {
          const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
          B.roof.box(x0, 4.5, z0, x1, 4.8, z1, { scale: 3, color: this.bldColor(r.x, r.z, pal.roof, 0) });
          B.paint.quadBottom(x0, z0, x1, z1, 4.5, 2, pal.ceil);
          this.addBox(x0, 4.5, z0, x1, 4.8, z1, { kind: 'roof' });
        }
        this.rows = saved;
      }
      // Konteynerler
      let ci = 0;
      for (const r of this.mergeRects(new Set(['K']))) {
        const x0 = r.x * CELL + 0.06, z0 = r.z * CELL + 0.06, x1 = (r.x + r.w) * CELL - 0.06, z1 = (r.z + r.h) * CELL - 0.06;
        const col = pick(pal.cont, r.x * 7 + r.z * 13 + ci++);
        B.container.box(x0, 0, z0, x1, 2.6, z1, { scale: 2.6, color: col });
        this.addBox(x0, 0, z0, x1, 2.6, z1, { kind: 'container', metal: true });
      }
      // Kum torbaları
      for (const r of this.mergeRects(new Set(['w']))) {
        let x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        if (r.w >= r.h && r.h === 1) {
          const cz = (z0 + z1) / 2;
          z0 = cz - 0.5;
          z1 = cz + 0.5;
        } else if (r.w === 1) {
          const cx = (x0 + x1) / 2;
          x0 = cx - 0.5;
          x1 = cx + 0.5;
        }
        B.sandbag.box(x0, 0, z0, x1, 1.0, z1, { scale: 1.2 });
        this.addBox(x0, 0, z0, x1, 1.0, z1, { kind: 'cover' });
      }
      // Alçak beton duvar: pastel blok + krem kapak
      for (const r of this.mergeRects(new Set(['h']))) {
        let x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        if (r.h === 1 && r.w > 1) {
          const cz = (z0 + z1) / 2;
          z0 = cz - 0.35;
          z1 = cz + 0.35;
        } else if (r.w === 1 && r.h > 1) {
          const cx = (x0 + x1) / 2;
          x0 = cx - 0.35;
          x1 = cx + 0.35;
        }
        B.concrete.box(x0, 0, z0, x1, 1.2, z1, { scale: 2, color: pal.cover });
        B.paint.box(x0 - 0.05, 1.12, z0 - 0.05, x1 + 0.05, 1.22, z1 + 0.05, { color: pal.trim, skipBottom: false });
        this.addBox(x0, 0, z0, x1, 1.2, z1, { kind: 'cover' });
      }
      // Araçlar: şeker renkli oyuncak arabalar
      let vi = 0;
      for (const r of this.mergeRects(new Set(['v']))) {
        const x0 = r.x * CELL + 0.15, z0 = r.z * CELL + 0.25, x1 = (r.x + r.w) * CELL - 0.15, z1 = (r.z + r.h) * CELL - 0.25;
        const long = r.w >= r.h;
        this.carVisual(B, x0, z0, x1, z1, long, pick(pal.car, r.x * 3 + r.z * 5 + vi++));
        this.addBox(x0, 0, z0, x1, 1.6, z1, { kind: 'vehicle', metal: true });
      }
      // Tekil nesneler
      const crateTints = [0xffffff, 0xfff0f4, 0xf0fff8, 0xfffbea];
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const ch = this.rows[z][x];
          const cx = x * CELL + 1, cz = z * CELL + 1;
          if (ch === 'c') {
            const s = 0.78 + ((x * 31 + z * 17) % 7) * 0.012;
            B.crate.box(cx - s, 0, cz - s, cx + s, 1.1, cz + s, { uv: 'unit', color: pick(crateTints, x * 3 + z) });
            this.addBox(cx - s, 0, cz - s, cx + s, 1.1, cz + s, { kind: 'crate' });
          } else if (ch === 'C') {
            B.crate.box(cx - 0.85, 0, cz - 0.85, cx + 0.85, 1.1, cz + 0.85, { uv: 'unit', color: pick(crateTints, x + z * 3) });
            const o = ((x + z) % 2 ? 0.08 : -0.08);
            B.crate.box(cx - 0.7 + o, 1.1, cz - 0.7 - o, cx + 0.7 + o, 2.2, cz + 0.7 - o, { uv: 'unit', color: pick(crateTints, x + z * 3 + 1) });
            this.addBox(cx - 0.85, 0, cz - 0.85, cx + 0.85, 2.2, cz + 0.85, { kind: 'crate' });
          } else if (ch === 'x') {
            B.concrete.box(cx - 0.55, 0, cz - 0.55, cx + 0.55, 4.8, cz + 0.55, { scale: 2, color: pal.cover });
            B.paint.box(cx - 0.62, 0, cz - 0.62, cx + 0.62, 0.3, cz + 0.62, { color: pal.trim, skipTop: false });
            B.paint.box(cx - 0.62, 4.5, cz - 0.62, cx + 0.62, 4.8, cz + 0.62, { color: pal.trim, skipBottom: false });
            this.addBox(cx - 0.55, 0, cz - 0.55, cx + 0.55, 4.8, cz + 0.55, { kind: 'wall' });
          } else if (ch === 'b') {
            this.makeBarrel(cx, cz, x, z);
          } else if (ch === 'T') {
            this.makeTree(cx, cz, B);
          } else if (ch === 'L') {
            this.makeLamp(cx, cz, B);
          } else if (ch === 'r') {
            this.makeRailing(x, z, B);
          }
        }

      this.buildRails(B);
      // Zombi kapıları
      if (this.def.kind === 'zm') this.buildDoors(B);
      // Gece: binalarda sıcak ışıklı pencereler (yalnız görsel)
      if (T.windowGlow) this.buildWindowGlow(B);
      // Rıhtım kenarı
      if (T.sea === 'south') this.buildQuay(B);
      // Dekor, tabelalar, cephe ayrıntıları
      if (G.Props) G.Props.dress(this, B);

      // Malzemeler (hepsi çizgi film; dokular açık renk, renkleri köşe renklerinden)
      const mats = {
        wall: G.mat('w-wall-' + T.wall, { map: T.wall, vertexColors: true }),
        building: G.mat('w-bld-' + T.building, { map: T.building, vertexColors: true }),
        roof: G.mat('w-roof', { map: 'cati', vertexColors: true }),
        indoor: G.mat('w-indoor-' + T.indoor, { map: T.indoor, vertexColors: true }),
        crate: G.mat('w-crate', { map: 'sandik', vertexColors: true }),
        container: G.mat('w-container', { map: 'konteyner', vertexColors: true }),
        sandbag: G.mat('w-sandbag', { map: 'kumtorba', vertexColors: true }),
        concrete: G.mat('w-concrete', { map: 'beton', vertexColors: true }),
        rust: G.mat('w-car', { map: 'pas', vertexColors: true }),
        metal: G.mat('w-metal', { map: 'metal', vertexColors: true }),
        wood: G.mat('w-wood', { map: 'ahsap', vertexColors: true }),
        paint: G.mat('w-paint', { vertexColors: true }),
        trunk: G.mat('w-trunk', { vertexColors: true }),
        leaf: G.mat('w-leaf', { vertexColors: true }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
      };
      mats.glow.userData.gtOwn = true;
      for (const k in B) {
        const m = B[k].mesh(mats[k], k !== 'indoor' && k !== 'glow');
        if (m) {
          if (k === 'indoor') m.receiveShadow = true;
          this.group.add(m);
        }
      }

      this.buildGround();
      this.buildSky();
      this.buildLights();
      this.buildDecor();
      scene.add(this.group);
      scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
      if (G.renderer) G.renderer.toneMappingExposure = T.exposure || 1;
    }

    // Çevre duvarı görseli: uzun duvarı 8 m'lik pastel bloklara böl, üstüne krem harpuşta
    wallVisual(B, x0, z0, x1, z1, H, idx) {
      const pal = this.pal;
      const lx = x1 - x0, lz = z1 - z0;
      const SEG = 8;
      if (lx > lz && lz <= 4 && lx > SEG * 1.5) {
        const n = Math.max(1, Math.round(lx / SEG));
        for (let i = 0; i < n; i++) {
          const a = x0 + (lx * i) / n, b = x0 + (lx * (i + 1)) / n;
          B.wall.box(a, 0, z0, b, H, z1, { scale: 4, color: pick(pal.wall, i + idx) });
        }
      } else if (lz > lx && lx <= 4 && lz > SEG * 1.5) {
        const n = Math.max(1, Math.round(lz / SEG));
        for (let i = 0; i < n; i++) {
          const a = z0 + (lz * i) / n, b = z0 + (lz * (i + 1)) / n;
          B.wall.box(x0, 0, a, x1, H, b, { scale: 4, color: pick(pal.wall, i + idx) });
        }
      } else {
        B.wall.box(x0, 0, z0, x1, H, z1, { scale: 4, color: pick(pal.wall, idx) });
      }
      B.paint.box(x0 - 0.08, H - 0.16, z0 - 0.08, x1 + 0.08, H + 0.1, z1 + 0.08, { color: pal.trim, skipBottom: false });
    }

    // Oyuncak araba: gövde, cam bandı, tavan, yuvarlak tekerlekler, farlar (çarpışma kutusu ayrı)
    carVisual(B, x0, z0, x1, z1, long, col) {
      const glass = 0xbfe9ff, tire = 0x4a3a5a, hub = 0xfffaf3;
      B.rust.box(x0, 0.35, z0, x1, 1.05, z1, { scale: 1.5, color: col });
      let c0x, c0z, c1x, c1z;
      if (long) {
        c0x = x0 + (x1 - x0) * 0.25; c1x = x1 - (x1 - x0) * 0.3; c0z = z0 + 0.12; c1z = z1 - 0.12;
      } else {
        c0x = x0 + 0.12; c1x = x1 - 0.12; c0z = z0 + (z1 - z0) * 0.25; c1z = z1 - (z1 - z0) * 0.3;
      }
      B.paint.box(c0x, 1.05, c0z, c1x, 1.5, c1z, { color: glass });
      B.rust.box(c0x - 0.05, 1.48, c0z - 0.05, c1x + 0.05, 1.6, c1z + 0.05, { scale: 1.5, color: col, skipBottom: false });
      // tekerlekler
      const wheels = long
        ? [[x0 + 0.5, z0 - 0.02], [x1 - 0.5, z0 - 0.02], [x0 + 0.5, z1 + 0.02], [x1 - 0.5, z1 + 0.02]]
        : [[x0 - 0.02, z0 + 0.5], [x0 - 0.02, z1 - 0.5], [x1 + 0.02, z0 + 0.5], [x1 + 0.02, z1 - 0.5]];
      for (const [wx, wz] of wheels) {
        const rot = long ? [Math.PI / 2, 0] : [0, Math.PI / 2];
        B.paint.addGeo(geo('cyl'), mtx(wx, 0.32, wz, 0, 0.32, 0.3, 0.32, rot[0], rot[1]), tire);
        B.paint.addGeo(geo('cyl8'), mtx(wx, 0.32, wz, 0, 0.13, 0.34, 0.13, rot[0], rot[1]), hub);
      }
      // farlar
      const lamp = 0xfff1a8;
      if (long) {
        for (const zz of [z0 + 0.3, z1 - 0.3]) cube(B.glow, x1 + 0.02, 0.8, zz, 0.06, 0.16, 0.22, lamp);
      } else {
        for (const xx of [x0 + 0.3, x1 - 0.3]) cube(B.glow, xx, 0.8, z1 + 0.02, 0.22, 0.16, 0.06, lamp);
      }
    }

    buildDoors(B) {
      const doorDefs = this.def.doors || {};
      for (const r of this.mergeRects(DOOR_CHARS)) {
        const id = r.ch;
        const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        // komşu duvar yüksekliği
        let top = 4.8;
        for (let z = r.z - 1; z <= r.z + r.h; z++)
          for (let x = r.x - 1; x <= r.x + r.w; x++) if (this.at(x, z) === '#') top = 6;
        const thinX = r.w > r.h;
        const ex0 = thinX ? x0 : x0 + 0.55, ex1 = thinX ? x1 : x1 - 0.55;
        const ez0 = thinX ? z0 + 0.55 : z0, ez1 = thinX ? z1 - 0.55 : z1;
        // lento: bina kovasına (ayrı çizim çağrısı yok)
        B.building.box(x0, 3.0, z0, x1, top, z1, { scale: 3, skipBottom: false, color: this.bldColor(r.x, r.z, this.pal.bld, 0) });
        this.addBox(x0, 3.0, z0, x1, top, z1, { kind: 'wall' });
        const doorGroup = new THREE.Group();
        const plank = new Bucket();
        // bal rengi kapı + mercan çapraz kalaslar + krem çerçeve
        plank.box(ex0, 0, ez0, ex1, 3.0, ez1, { uv: 'unit', color: 0xffffff });
        for (let i = 0; i < 3; i++) {
          const y = 0.5 + i * 0.9;
          const pc = i === 1 ? 0xff9ec4 : 0xff8b94;
          if (thinX) plank.box(ex0 + 0.1, y, ez0 - 0.08, ex1 - 0.1, y + 0.28, ez0, { uv: 'unit', color: pc });
          else plank.box(ex0 - 0.08, y, ez0 + 0.1, ex0, y + 0.28, ez1 - 0.1, { uv: 'unit', color: pc });
          if (thinX) plank.box(ex0 + 0.1, y, ez1, ex1 - 0.1, y + 0.28, ez1 + 0.08, { uv: 'unit', color: pc });
          else plank.box(ex1, y, ez0 + 0.1, ex1 + 0.08, y + 0.28, ez1 - 0.1, { uv: 'unit', color: pc });
        }
        const pm = plank.mesh(G.mat('w-doorwood', { map: 'ahsap', vertexColors: true }));
        doorGroup.add(pm);
        const def = doorDefs[id] || { cost: 1000, name: 'Kapı' };
        const ltex = G.labelTex(def.cost + ' PUAN', { color: '#ffffff', glow: '#000', pill: '#ff6fa8', border: '#3b2a4a', size: 30, w: 256, h: 64 });
        const lmat = new THREE.SpriteMaterial({ map: ltex, depthWrite: false, transparent: true });
        lmat.toneMapped = false;
        lmat.userData.gtOwn = true;
        ltex.gtOwnTex = true;
        for (const side of [-1, 1]) {
          const label = new THREE.Sprite(lmat);
          label.scale.set(2.4, 0.6, 1);
          label.position.set((x0 + x1) / 2 + (thinX ? 0 : side * 0.9), 2.4, (z0 + z1) / 2 + (thinX ? side * 0.9 : 0));
          doorGroup.add(label);
        }
        this.group.add(doorGroup);
        const box = this.addBox(ex0, 0, ez0, ex1, 3.0, ez1, { kind: 'door' });
        const cells = [];
        for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) cells.push([x, z]);
        this.doors[id] = {
          id, cost: def.cost, name: def.name, cells, box, group: doorGroup, open: false,
          center: new THREE.Vector3((x0 + x1) / 2, 1.5, (z0 + z1) / 2),
          zones: [],
        };
      }
      this.computeZones();
    }

    computeZones() {
      this.zoneOf = new Int16Array(this.w * this.h).fill(-1);
      let zid = 0;
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const i = x + z * this.w;
          if (!this.walk[i] || this.zoneOf[i] >= 0) continue;
          const q = [x, z];
          this.zoneOf[i] = zid;
          while (q.length) {
            const cz = q.pop(), cx = q.pop();
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, nz = cz + dz;
              if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
              const ni = nx + nz * this.w;
              if (!this.walk[ni] || this.zoneOf[ni] >= 0) continue;
              this.zoneOf[ni] = zid;
              q.push(nx, nz);
            }
          }
          zid++;
        }
      this.zoneCount = zid;
      for (const id in this.doors) {
        const d = this.doors[id];
        const set = new Set();
        for (const [x, z] of d.cells)
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
            const zz = this.zoneOf[nx + nz * this.w];
            if (zz >= 0) set.add(zz);
          }
        d.zones = Array.from(set);
      }
    }

    zoneAt(x, z) {
      if (!this.zoneOf) return 0;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
      return this.zoneOf[cx + cz * this.w];
    }

    openDoor(id) {
      const d = this.doors[id];
      if (!d || d.open) return;
      d.open = true;
      d.box.disabled = true;
      for (const [x, z] of d.cells) this.walk[x + z * this.w] = 1;
      const grp = d.group;
      let t = 0;
      const fn = (dt) => {
        t += dt;
        grp.position.y = -t * 3;
        if (t > 1.2) {
          this.group.remove(grp);
          return false;
        }
        return true;
      };
      this.updaters.push(fn);
    }

    blockCell(cx, cz) {
      if (cx >= 0 && cz >= 0 && cx < this.w && cz < this.h) this.walk[cx + cz * this.w] = 0;
    }

    // Patlayıcı varil: mercan gövde, sarı şerit, beyaz yıldız — tek ağ (tek çizim çağrısı)
    makeBarrel(cx, cz, gx, gz) {
      const grp = new THREE.Group();
      const b = new Bucket();
      b.addGeo(geo('cyl'), mtx(0, 0.575, 0, 0, 0.38, 1.15, 0.38), 0xff6b6b);
      b.addGeo(geo('cyl'), mtx(0, 0.75, 0, 0, 0.395, 0.16, 0.395), 0xffd23f);
      b.addGeo(geo('cyl'), mtx(0, 0.3, 0, 0, 0.395, 0.08, 0.395), 0xffd23f);
      b.addGeo(geo('cyl'), mtx(0, 1.16, 0, 0, 0.3, 0.04, 0.3), 0xffa3a3);
      b.addGeo(geo('cyl8'), mtx(0.18, 1.2, 0.05, 0, 0.06, 0.06, 0.06), 0xfffaf3);
      const body = b.mesh(G.mat('w-barrel', { vertexColors: true }));
      body.matrixAutoUpdate = true;
      grp.add(body);
      grp.position.set(cx, 0, cz);
      this.group.add(grp);
      const ent = { type: 'barrel', hp: 35, exploded: false, mesh: grp, pos: new THREE.Vector3(cx, 0.6, cz), cell: [gx, gz] };
      ent.box = this.addBox(cx - 0.4, 0, cz - 0.4, cx + 0.4, 1.15, cz + 0.4, { kind: 'barrel', ent, metal: true });
      this.barrels.push(ent);
    }

    // Ağaçlar kovalarda birleşir: palmiye, lolipop ağaç veya (zombi) sevimli-ürkütücü çıplak ağaç
    makeTree(cx, cz, B) {
      const T = this.theme;
      const palm = !!T.palms;
      const h = (cx * 13 + cz * 7) % 5;
      if (palm) {
        // halkalı gövde
        const segs = 6;
        for (let i = 0; i < segs; i++) {
          const t = i / segs;
          const r = 0.26 - t * 0.1;
          B.trunk.addGeo(geo('cyl8'), mtx(cx + t * 0.7, 0.5 + i, cz, 0, r, 1.02, r, 0, -0.12), i % 2 ? 0xe8bf86 : 0xd9a86c);
        }
        const tx = cx + 0.72, ty = 6.0;
        const greens = [0x5bbf3a, 0x7ed957, 0x6fcf4f];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + h;
          B.leaf.addGeo(geo('sphLo'), mtx(tx + Math.cos(a) * 1.25, ty - 0.2, cz + Math.sin(a) * 1.25, Math.PI / 2 - a, 0.42, 0.12, 1.55, 0.42), pick(greens, i));
        }
        B.leaf.addGeo(geo('sphLo'), mtx(tx, ty + 0.05, cz, 0, 0.55, 0.32, 0.55), 0x6fcf4f);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          B.trunk.addGeo(geo('sphLo'), mtx(tx + Math.cos(a) * 0.3, ty - 0.35, cz + Math.sin(a) * 0.3, 0, 0.17, 0.17, 0.17), 0xa8744e);
        }
      } else if (this.def.kind === 'zm') {
        // tatlı-ürkütücü lolipop ağaç: lila gövde, eflatun/pembe/nane yuvarlak taçlar
        const bark = 0x9a88b0;
        const tufts = [0xcdb4ff, 0xff9ec4, 0xa8e6cf, 0xb48cff];
        B.trunk.addGeo(geo('cyl8'), mtx(cx, 2, cz, 0, 0.22, 4, 0.22), bark);
        B.trunk.addGeo(geo('cyl8'), mtx(cx, 0.15, cz, 0, 0.36, 0.3, 0.36), bark);
        B.leaf.addGeo(geo('sph'), mtx(cx, 4.4, cz, 0, 1.45, 1.35, 1.45), pick(tufts, h));
        B.leaf.addGeo(geo('sph'), mtx(cx + 0.7, 5.25, cz + 0.35, 0, 0.95, 0.9, 0.95), pick(tufts, h + 1));
        B.leaf.addGeo(geo('sph'), mtx(cx - 0.6, 5.45, cz - 0.35, 0, 0.75, 0.72, 0.75), pick(tufts, h + 2));
      } else {
        // lolipop ağaç: üç yuvarlak yeşil top
        const night = !!T.night;
        const trunk = night ? 0x9a7a8a : 0xb07a52;
        const greens = T.leafColors || (night ? [0x5fc9a0, 0x4eb894, 0x72d6ae] : [0x7ed957, 0x5bbf3a, 0x9be36f]);
        B.trunk.addGeo(geo('cyl8'), mtx(cx, 2, cz, 0, 0.22, 4, 0.22), trunk);
        B.leaf.addGeo(geo('sph'), mtx(cx, 4.4, cz, 0, 1.55, 1.4, 1.55), pick(greens, h));
        B.leaf.addGeo(geo('sph'), mtx(cx + 0.75, 5.3, cz + 0.3, 0, 1.05, 1.0, 1.05), pick(greens, h + 1));
        B.leaf.addGeo(geo('sph'), mtx(cx - 0.55, 5.55, cz - 0.4, 0, 0.85, 0.82, 0.85), pick(greens, h + 2));
      }
      this.addBox(cx - 0.3, 0, cz - 0.3, cx + 0.3, 4, cz + 0.3, { kind: 'tree' });
    }

    // Sokak lambası: lila direk, mercan şapka, tereyağı rengi parlak ampul
    makeLamp(cx, cz, B) {
      const pal = this.pal;
      B.paint.addGeo(geo('cyl8'), mtx(cx, 2.6, cz, 0, 0.1, 5.2, 0.1), pal.pole);
      B.paint.addGeo(geo('cyl8'), mtx(cx, 0.15, cz, 0, 0.2, 0.3, 0.2), pal.pole);
      B.paint.box(cx - 0.07, 5.1, cz - 0.07, cx + 0.85, 5.22, cz + 0.07, { color: pal.pole, skipBottom: false });
      // yuvarlak fener: mercan kubbe şapka, parlak top ampul, altta minik düğme
      B.paint.addGeo(geo('cyl8'), mtx(cx + 0.8, 5.12, cz, 0, 0.03, 0.12, 0.03), pal.pole);
      B.paint.addGeo(geo('dome'), mtx(cx + 0.8, 4.98, cz, 0, 0.34, 0.24, 0.34), 0xff8b94);
      B.paint.addGeo(geo('sphLo'), mtx(cx + 0.8, 5.24, cz, 0, 0.07, 0.07, 0.07), 0xffd23f);
      B.glow.addGeo(geo('sphMd'), mtx(cx + 0.8, 4.78, cz, 0, 0.27, 0.3, 0.27), 0xfff1a8);
      B.paint.addGeo(geo('sphLo'), mtx(cx + 0.8, 4.47, cz, 0, 0.08, 0.06, 0.08), 0xff8b94);
      this.addBox(cx - 0.15, 0, cz - 0.15, cx + 0.15, 5.2, cz + 0.15, { kind: 'pole', metal: true });
      this.lamps.push(new THREE.Vector3(cx + 0.8, 4.9, cz));
    }

    makeRailing(x, z, B) {
      const x0 = x * CELL, z0 = z * CELL;
      const pal = this.pal;
      // korkuluk hattı hücrenin kuzey kenarı boyunca; hücre başına yuvarlak direk,
      // borular ise tüm sıra boyunca tek parça (buildRails)
      const zz = z0 + 0.6;
      B.paint.addGeo(geo('cyl8'), mtx(x0 + 1, 0.55, zz, 0, 0.06, 1.1, 0.06), pal.trim);
      B.concrete.box(x0, 0, z0, x0 + CELL, 0.12, z0 + CELL, { scale: 2, color: pal.trim });
      this.addBox(x0, 0, z0, x0 + CELL, 1.1, zz + 0.05, { kind: 'rail', metal: true });
      this.addBox(x0, 1.1, z0, x0 + CELL, 8, z0 + CELL, { kind: 'clip', clip: true });
    }
    // Korkuluk boruları: bitişik 'r' hücreleri boyunca kesintisiz (az üçgen)
    buildRails(B) {
      const pal = this.pal;
      for (const r of this.mergeRects(new Set(['r']))) {
        const x0 = r.x * CELL, x1 = (r.x + r.w) * CELL;
        for (let k = 0; k < r.h; k++) {
          const zz = (r.z + k) * CELL + 0.6, len = x1 - x0, cx = (x0 + x1) / 2;
          B.paint.addGeo(geo('cyl8'), mtx(cx, 1.05, zz, 0, 0.07, len, 0.07, 0, Math.PI / 2), pal.rail);
          B.paint.addGeo(geo('cyl8'), mtx(cx, 0.55, zz, 0, 0.045, len, 0.045, 0, Math.PI / 2), pal.trim);
        }
      }
    }

    // Gece pencere ışıkları: dış cephelerde, kapı/pencere boşluklarından uzak, sıcak tonlarda
    buildWindowGlow(B) {
      const cols = [0xfff1a8, 0xffe0b0, 0xffd6e8];
      const glowAt = (x, z, nx, nz) => {
        const cx = x * CELL + 1 + nx * 1.03, cz = z * CELL + 1 + nz * 1.03;
        const ry = Math.atan2(nx, nz);
        const c = pick(cols, x * 7 + z * 3);
        B.glow.addGeo(geo('plane'), mtx(cx, 3.15, cz, ry, 0.9, 0.75, 1), c);
        B.paint.addGeo(geo('box'), mtx(cx - nz * 0.0, 2.72, cz, ry, 1.1, 0.08, 0.06), this.pal.trim);
      };
      for (let z = 1; z < this.h - 1; z++)
        for (let x = 1; x < this.w - 1; x++) {
          if (this.rows[z][x] !== 'H' || (x + z) % 2) continue;
          for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ox = x + nx, oz = z + nz;
            if (this.at(ox, oz) !== '.') continue;
            // yan komşular da duvar olmalı (köşe ve kapı yanı değil)
            const sx = nz, sz = nx;
            if (this.at(x + sx, z + sz) !== 'H' || this.at(x - sx, z - sz) !== 'H') continue;
            const ix = x - nx, iz = z - nz;
            if (!this.indoor[ix + iz * this.w]) continue;
            glowAt(x, z, nx, nz);
          }
        }
    }

    // Rıhtım: kenar taşı + kıyıda krem bordür
    buildQuay(B) {
      const pad = 120;
      const gx0 = -pad, gx1 = this.sizeX + pad;
      B.concrete.box(gx0, -3, this.sizeZ - 0.01, gx1, 0, this.sizeZ + 0.4, { scale: 3, color: 0xffe6cc });
      B.paint.box(gx0, -0.12, this.sizeZ - 0.01, gx1, 0.04, this.sizeZ + 0.48, { color: this.pal.trim, skipBottom: false });
    }

    buildGround() {
      const T = this.theme;
      const pad = 120;
      const sea = T.sea === 'south';
      const gx0 = -pad, gx1 = this.sizeX + pad, gz0 = -pad, gz1 = sea ? this.sizeZ : this.sizeZ + pad;
      const geoG = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0);
      const tex = G.texture(T.ground).clone();
      tex.gtOwnTex = true;
      tex.needsUpdate = true;
      tex.repeat.set((gx1 - gx0) / 5, (gz1 - gz0) / 5);
      const mat = G.toonMat(null, { map: tex, color: T.groundTint != null ? T.groundTint : 0xffffff });
      mat.userData.gtOwn = true;
      const m = new THREE.Mesh(geoG, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((gx0 + gx1) / 2, 0, (gz0 + gz1) / 2);
      m.receiveShadow = true;
      this.group.add(m);
      if (sea) {
        // Çizgi film suyu: turkuaz, rıhtım dibinde beyaz köpük şeritleri, düz parıltı lekeleri
        const water = new THREE.Mesh(
          new THREE.PlaneGeometry(gx1 - gx0, 400),
          new THREE.ShaderMaterial({
            uniforms: {
              time: { value: 0 },
              deep: { value: new THREE.Color(T.waterDeep != null ? T.waterDeep : 0x2fa9c9) },
              shallow: { value: new THREE.Color(T.waterShallow != null ? T.waterShallow : 0x5fe0d2) },
              foam: { value: new THREE.Color(0xffffff) },
              fogColor: { value: new THREE.Color(T.fog) },
              fogNear: { value: T.fogNear },
              fogFar: { value: T.fogFar },
              edgeZ: { value: this.sizeZ + 0.45 },
            },
            vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: [
              'uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float edgeZ; varying vec3 vW;',
              'void main(){',
              ' float e = vW.z - edgeZ;',
              ' vec3 c = mix(shallow, deep, smoothstep(1.0, 45.0, e));',
              ' float w = sin(vW.x * 0.21 + time * 0.7 + sin(vW.z * 0.13 + time * 0.3) * 2.2) * sin(vW.z * 0.37 - time * 0.9);',
              ' w += 0.22 * sin(vW.x * 1.1 - time * 1.6 + vW.z * 0.5);',
              ' float hl = step(0.74, w);',
              ' c = mix(c, mix(c, foam, 0.6), hl);',
              ' float sh = step(w, -0.82);',
              ' c = mix(c, c * vec3(0.86, 0.9, 1.0), sh);',
              ' float f0 = 1.0 - step(0.55 + 0.18 * sin(vW.x * 0.8 + time * 2.0), e);',
              ' float b1 = 1.3 + 0.35 * sin(time * 1.3 + vW.x * 0.33);',
              ' float f1 = step(abs(e - b1), 0.16 + 0.06 * sin(vW.x * 1.7 - time));',
              ' float b2 = 3.0 + 0.5 * sin(time * 0.9 + vW.x * 0.19 + 1.7);',
              ' float f2 = step(abs(e - b2), 0.11 + 0.05 * sin(vW.x * 2.3 + time * 1.4)) * step(0.0, sin(vW.x * 0.45 + time * 0.6));',
              ' c = mix(c, foam, max(f0, max(f1, f2 * 0.9)));',
              ' float d = length(vW - cameraPosition);',
              ' c = mix(c, fogColor, smoothstep(fogNear, fogFar * 1.1, d) * 0.92);',
              ' gl_FragColor = vec4(c, 1.0);',
              '}',
            ].join('\n'),
          })
        );
        water.material.userData.gtOwn = true;
        water.rotation.x = -Math.PI / 2;
        water.position.set((gx0 + gx1) / 2, -0.9, this.sizeZ + 200);
        this.group.add(water);
        this.water = water;
      }
    }

    buildSky() {
      const T = this.theme;
      const sd = new THREE.Vector3().fromArray(T.sunDir).normalize();
      const night = !!T.night;
      // Gökyüzü: yumuşak degrade + büyük yumuşak güneş diski (gece: kocaman ay + yıldızlar)
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color(T.skyTop) },
          horizon: { value: new THREE.Color(T.skyHorizon) },
          bottom: { value: new THREE.Color(T.skyBottom) },
          sunDir: { value: sd },
          sunCol: { value: new THREE.Color(T.sun) },
          diskCol: { value: new THREE.Color(T.sunDisk != null ? T.sunDisk : night ? 0xfff6e6 : 0xfffbea) },
          night: { value: night ? 1 : 0 },
          stars: { value: T.stars ? 1 : 0 },
          time: { value: 0 },
          size: { value: T.sunSize != null ? T.sunSize : night ? 0.085 : 0.075 },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: [
          'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 diskCol;',
          'uniform float night; uniform float stars; uniform float time; uniform float size;',
          'varying vec3 vDir;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'void main(){',
          ' vec3 d = normalize(vDir);',
          ' float y = d.y;',
          ' vec3 c = y > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.75, pow(y, 0.8))) : mix(horizon, bottom, smoothstep(0.0, 0.25, -y));',
          ' vec3 sd = normalize(sunDir);',
          ' float s = dot(d, sd);',
          ' float r = acos(clamp(s, -1.0, 1.0));',
          ' c += sunCol * pow(max(s, 0.0), 6.0) * (1.0 - smoothstep(0.0, 0.6, abs(y))) * (night > 0.5 ? 0.08 : 0.22);',
          ' if (stars > 0.5 && y > 0.0) {',
          '  vec2 uv = d.xz / (y + 0.35) * 13.0;',
          '  vec2 cell = floor(uv); vec2 f = fract(uv) - 0.5;',
          '  float h = hash(cell);',
          '  if (h > 0.86) {',
          '   vec2 o = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;',
          '   vec2 q = f - o;',
          '   float big = step(0.975, h);',
          '   float rad = mix(0.07, 0.13, hash(cell + 1.3)) + big * 0.04;',
          '   float tw = 0.65 + 0.35 * sin(time * (1.5 + h * 3.0) + h * 40.0);',
          '   float st = 1.0 - smoothstep(rad * 0.45, rad, length(q));',
          '   float cr = big * (1.0 - smoothstep(0.0, 0.035, min(abs(q.x), abs(q.y)))) * (1.0 - smoothstep(0.0, 0.36, length(q)));',
          '   vec3 sc = mix(vec3(1.0, 0.97, 0.86), vec3(0.86, 0.9, 1.0), hash(cell + 5.0));',
          '   c = mix(c, sc, clamp(st + cr, 0.0, 1.0) * tw * smoothstep(0.03, 0.25, y));',
          '  }',
          ' }',
          ' float disk = 1.0 - smoothstep(size * 0.9, size, r);',
          ' if (night > 0.5) {',
          '  vec3 t1 = normalize(cross(sd, vec3(0.0, 1.0, 0.0)));',
          '  vec3 t2 = cross(t1, sd);',
          '  vec2 p = vec2(dot(d, t1), dot(d, t2)) / size;',
          '  vec3 mc = diskCol * (1.0 - 0.08 * (p.x - p.y));',
          '  float cr = 0.0;',
          '  cr += 1.0 - smoothstep(0.2, 0.25, length(p - vec2(0.32, 0.25)));',
          '  cr += 1.0 - smoothstep(0.12, 0.16, length(p - vec2(-0.35, -0.15)));',
          '  cr += 1.0 - smoothstep(0.09, 0.12, length(p - vec2(0.12, -0.45)));',
          '  mc = mix(mc, mc * vec3(0.88, 0.86, 0.95), clamp(cr, 0.0, 1.0));',
          '  c += vec3(0.75, 0.7, 1.0) * (exp(-r * 14.0) * 0.35 + exp(-r * 40.0) * 0.25);',
          '  c = mix(c, mc, disk);',
          ' } else {',
          '  c += sunCol * (exp(-r * 10.0) * 0.32 + exp(-r * 32.0) * 0.35) * (1.0 - disk);',
          '  c = mix(c, diskCol, disk);',
          ' }',
          ' gl_FragColor = vec4(c, 1.0);',
          '}',
        ].join('\n'),
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
      mat.userData.gtOwn = true;
      const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 12), mat);
      sky.renderOrder = -10;
      sky.frustumCulled = false;
      this.sky = sky;
      this.group.add(sky);
      this.buildClouds();
    }

    // Kabarık çizgi film bulutları: harita çevresinde halka, tek ağ, yavaşça döner
    buildClouds() {
      const T = this.theme;
      const amt = T.clouds != null ? T.clouds : 0.5;
      const n = Math.round(3 + amt * 13);
      if (n <= 0) return;
      const b = new Bucket();
      const rnd = U.seeded(this.def.id.length * 131 + 7);
      const cg = G.settings.quality === 'dusuk' ? 'sphLo' : 'sphMd';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
        const r = 210 + rnd() * 110;
        const y = 48 + rnd() * 55;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const tx = -Math.sin(a), tz = Math.cos(a);
        const size = 9 + rnd() * 9;
        const m = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < m; k++) {
          const t = (k - (m - 1) / 2) * size * 0.78;
          const mid = 1 - Math.abs(k - (m - 1) / 2) / m;
          const rad = size * (0.62 + mid * 0.5) * (0.85 + rnd() * 0.3);
          b.addGeo(geo(cg), mtx(x + tx * t, y + rad * 0.25, z + tz * t, 0, rad, rad * 0.82, rad * 0.9), 0xffffff);
        }
        // düz taban
        b.addGeo(geo(cg), mtx(x, y - size * 0.05, z, -a, size * 0.75, size * 0.4, size * (m * 0.48)), 0xffffff);
      }
      const col = T.cloudColor != null ? T.cloudColor : 0xffffff;
      const mat = G.toonMat(null, { color: col, emissive: col, emissiveIntensity: T.night ? 0.14 : 0.24, fog: false });
      mat.userData.gtOwn = true;
      const mesh = b.mesh(mat, false);
      mesh.position.set(this.sizeX / 2, 0, this.sizeZ / 2);
      mesh.matrixAutoUpdate = true;
      this.clouds = mesh;
      this.group.add(mesh);
    }

    buildLights() {
      const T = this.theme;
      const q = G.settings.quality;
      const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiIntensity);
      this.group.add(hemi);
      if (T.ambient != null) {
        this.ambient = new THREE.AmbientLight(T.ambient, T.ambientIntensity != null ? T.ambientIntensity : 0.15);
        this.group.add(this.ambient);
      }
      const sun = new THREE.DirectionalLight(T.sun, T.sunIntensity);
      const sd = new THREE.Vector3().fromArray(T.sunDir).normalize();
      const center = new THREE.Vector3(this.sizeX / 2, 0, this.sizeZ / 2);
      sun.position.copy(center).addScaledVector(sd, 90);
      sun.target.position.copy(center);
      this.group.add(sun.target);
      if (q !== 'dusuk') {
        sun.castShadow = true;
        const size = q === 'yuksek' ? 2048 : 1024;
        sun.shadow.mapSize.set(size, size);
        // Gölge kamerayı izler (küçük kutu → keskin, yumuşak kenarlı gölge); harita küçükse tamamını kapsar
        const full = Math.hypot(this.sizeX, this.sizeZ) / 2 + 4;
        const R = Math.min(full, q === 'yuksek' ? 34 : 26);
        this.shadowFullR = full;
        this.shadowFollow = R < full ? { R, texel: (2 * R) / size, dir: sd.clone(), right: new THREE.Vector3(), up: new THREE.Vector3(), c: new THREE.Vector3() } : null;
        if (this.shadowFollow) {
          const f = this.shadowFollow;
          f.right.set(0, 1, 0).cross(sd);
          if (f.right.lengthSq() < 1e-6) f.right.set(1, 0, 0);
          f.right.normalize();
          f.up.copy(sd).cross(f.right).normalize();
        }
        const cam = sun.shadow.camera;
        cam.left = -R;
        cam.right = R;
        cam.top = R;
        cam.bottom = -R;
        cam.near = 1;
        cam.far = 220;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
        // yumuşak kenarlı gölge (PCF yarıçapı)
        sun.shadow.radius = q === 'yuksek' ? 2.2 : 1.6;
      }
      this.group.add(sun);
      this.sun = sun;
      this.hemi = hemi;
      // Sabit sayıda efekt ışığı (gölgelendirici yeniden derlenmesin diye)
      this.muzzleLight = new THREE.PointLight(0xffd88a, 0, 9, 2);
      this.boomLight = new THREE.PointLight(0xffa860, 0, 26, 2);
      this.group.add(this.muzzleLight, this.boomLight);
      // Lamba ışıkları (telefon kalitesinde daha az)
      this.lampLights = [];
      if (T.lampLights) {
        const max = q === 'yuksek' ? 5 : q === 'orta' ? 3 : 0;
        for (const p of this.lamps.slice(0, max)) {
          const l = new THREE.PointLight(T.lampColor != null ? T.lampColor : 0xffd9a8, 0.9, 16, 2);
          l.position.copy(p);
          this.group.add(l);
          this.lampLights.push(l);
        }
      }
      if (T.zombieLights) {
        const spots = [
          [7, 16, 0xff9ec4],
          [18, 15, 0xffd3b6],
          [22, 25, 0x9ad7ff],
          [22, 5, 0xcdb4ff],
        ];
        const bulbs = new Bucket();
        const cord = 0x6a5a8a, cap = 0xff8b94;
        for (const [x, z, c] of spots) {
          const l = new THREE.PointLight(c, 0.5, 18, 2);
          l.position.set(x * CELL + 1, 3.8, z * CELL + 1);
          this.group.add(l);
          this.lampLights.push(l);
          const px = l.position.x, py = l.position.y, pz = l.position.z;
          bulbs.addGeo(geo('sphLo'), mtx(px, py, pz, 0, 0.16, 0.16, 0.16), c);
          if (this.indoor[x + z * this.w]) {
            // tavandan sarkan sevimli ampul: kordon + mercan şapka
            bulbs.addGeo(geo('cyl8'), mtx(px, (py + 4.5) / 2, pz, 0, 0.015, 4.5 - py, 0.015), cord);
            bulbs.addGeo(geo('dome'), mtx(px, py + 0.1, pz, 0, 0.13, 0.1, 0.13), cap);
          } else {
            // avluda: ipli balon fener (ip yere minik bir ağırlığa bağlı)
            bulbs.addGeo(geo('sphLo'), mtx(px, py - 0.17, pz, 0, 0.035, 0.035, 0.035), c);
            bulbs.addGeo(geo('cyl8'), mtx(px, py / 2, pz, 0, 0.01, py - 0.18, 0.01), 0xfffaf3);
            bulbs.addGeo(geo('dome'), mtx(px, 0, pz, 0, 0.12, 0.1, 0.12), cap);
          }
        }
        const bm = new THREE.MeshBasicMaterial({ vertexColors: true });
        bm.userData.gtOwn = true;
        this.group.add(bulbs.mesh(bm, false));
      }
    }

    // Uzak dekor: tüm parçalar köşe renkli kovalarda birleşir (gölge yok, az çizim çağrısı)
    buildDecor() {
      const T = this.theme;
      const D = new Bucket(); // düz boya
      const DC = new Bucket(); // konteyner dokulu
      const DS = new Bucket(); // sıva / metal dokulu
      const dsMap = T.decor === 'dunes' ? 'siva' : 'metal';
      if (T.decor === 'cranes') {
        // Şeker renkli vinçler
        const mkCrane = (x, z, rot, col) => {
          const M = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(rot));
          const part = (px, py, pz, sx, sy, sz, c, Bk) => (Bk || D).addGeo(geo('box'), M.clone().multiply(mtx(px, py, pz, 0, sx, sy, sz)), c);
          for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
            part(lx, 13, lz, 0.9, 26, 0.9, col);
            part(lx, 0.4, lz, 1.6, 0.8, 1.6, 0xfffaf3);
          }
          for (const y of [8, 17]) {
            part(0, y, -4, 8, 0.5, 0.5, col);
            part(0, y, 4, 8, 0.5, 0.5, col);
            part(-4, y, 0, 0.5, 0.5, 8, col);
            part(4, y, 0, 0.5, 0.5, 8, col);
          }
          part(10, 27, 0, 46, 2.2, 3, col);
          for (let i = 0; i < 6; i++) part(-8 + i * 7, 27, 0, 1.2, 2.3, 3.1, 0xfffaf3);
          part(0, 24, 0, 4.2, 3.2, 4.2, 0xff8b94);
          part(0, 24.3, 0, 4.3, 1.1, 4.3, 0x9ad7ff);
          part(22, 20, 0, 0.12, 14, 0.12, 0x6a5a7a);
          part(22, 12.6, 0, 1.2, 0.9, 1.2, 0xff8b94);
        };
        mkCrane(this.sizeX * 0.25, -14, 0.2, 0xffb347);
        mkCrane(this.sizeX * 0.8, -16, -0.3, 0xffd23f);
        // Oyuncak gemi: turkuaz gövde, beyaz şerit, mercan omurga, köprü üstü ve baca
        const sx = this.sizeX / 2, sz = this.sizeZ + 45;
        cube(D, sx, 1, sz, 80, 9, 16, 0x4ecdc4);
        cube(D, sx, 4.1, sz, 80.3, 1.1, 16.3, 0xfffaf3);
        cube(D, sx, -2.6, sz, 80.2, 2.2, 16.2, 0xff8b94);
        cube(D, sx + 31, 9.5, sz, 10, 8, 12, 0xfffaf3);
        cube(D, sx + 31, 11, sz, 10.2, 1.4, 12.2, 0x9ad7ff);
        D.addGeo(geo('cyl'), mtx(sx + 33, 15.5, sz, 0, 1.6, 4, 1.6), 0xff8b94);
        D.addGeo(geo('cyl'), mtx(sx + 33, 16.2, sz, 0, 1.65, 0.8, 1.65), 0xfffaf3);
        for (let i = 0; i < 14; i++) {
          DC.addGeo(geo('box'), mtx(sx - 30 + (i % 7) * 7, 6.8 + Math.floor(i / 7) * 2.6, sz + ((i * 3) % 3) * 2.5 - 2.5, 0, 5.6, 2.6, 2.4), pick(CONTAINER_COLORS, i));
        }
        // Dış depolar: pastel oluklu sac, krem çatı
        const farCols = [0xcdb4ff, 0xffd3b6, 0x9ad7ff, 0xa8e6cf, 0xffaaa5, 0xfff1a8];
        for (let i = 0; i < 6; i++) {
          const h = 10 + (i % 3) * 4;
          const x = -20 + (i % 2) * (this.sizeX + 40), z = 10 + i * 9;
          DS.addGeo(geo('box'), mtx(x, h / 2 - 0.01, z, 0, 18, h, 14), farCols[i]);
          cube(D, x, h + 0.3, z, 18.6, 0.6, 14.6, 0xfffaf3);
        }
      } else if (T.decor === 'dunes') {
        const sands = [0xffd99a, 0xffe2b0, 0xffcf8a];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const r = Math.max(this.sizeX, this.sizeZ) * 0.9 + (i % 3) * 18;
          const s = 30 + (i % 4) * 10;
          D.addGeo(geo('dome'), mtx(this.sizeX / 2 + Math.cos(a) * r, -2, this.sizeZ / 2 + Math.sin(a) * r, 0, s, s * 0.35, s), pick(sands, i));
        }
        // Dış evler: şeftali/pembe kerpiç, bazılarında kubbe
        const adobe = T.buildingColors || [0xffd3b6, 0xffaaa5, 0xfff1a8];
        const domes = [0x4ecdc4, 0xff8b94, 0x9ad7ff];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + 0.3;
          const r = Math.max(this.sizeX, this.sizeZ) * 0.62;
          const h = 6 + (i % 3) * 3;
          const x = this.sizeX / 2 + Math.cos(a) * r, z = this.sizeZ / 2 + Math.sin(a) * r;
          DS.addGeo(geo('box'), mtx(x, h / 2, z, 0, 10, h, 10), pick(adobe, i));
          cube(D, x, h + 0.2, z, 10.5, 0.4, 10.5, 0xfffaf3);
          if (i % 3 === 0) D.addGeo(geo('dome'), mtx(x, h + 0.35, z, 0, 3.4, 3.2, 3.4), pick(domes, i));
        }
      } else if (T.decor === 'hills') {
        const greens = [0x7ed957, 0x6fcf4f, 0x8fe06a];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const r = 140 + (i % 3) * 30;
          const s = 50 + (i % 4) * 15;
          const x = this.sizeX / 2 + Math.cos(a) * r, z = this.sizeZ / 2 + Math.sin(a) * r;
          D.addGeo(geo('dome'), mtx(x, -3, z, 0, s, s * 0.4, s), pick(greens, i));
          // tepelerde minik lolipop ağaçlar
          for (let k = 0; k < 3; k++) {
            const ka = a + (k - 1) * 0.12, kr = r - s * 0.45 + k * 4;
            const tx = this.sizeX / 2 + Math.cos(ka) * kr, tz = this.sizeZ / 2 + Math.sin(ka) * kr;
            const ty = -3 + s * 0.4 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.hypot(tx - x, tz - z) / s, 2)));
            D.addGeo(geo('cyl8'), mtx(tx, ty + 1.5, tz, 0, 0.5, 3, 0.5), 0xb07a52);
            D.addGeo(geo('sphLo'), mtx(tx, ty + 4.2, tz, 0, 2.6, 2.4, 2.6), pick([0x5bbf3a, 0x9be36f, 0x6fcf4f], i + k));
          }
        }
      }
      if (T.night && this.def.kind === 'mp') {
        // Projektör kuleleri: lila direk + pastel ışık hüzmeleri
        const beamCols = [0xff9ec4, 0x9ad7ff, 0xcdb4ff, 0xa8e6cf];
        let bi = 0;
        for (const [x, z] of [[-6, -6], [this.sizeX + 6, -6], [-6, this.sizeZ + 6], [this.sizeX + 6, this.sizeZ + 6]]) {
          cube(D, x, 7, z, 1, 14, 1, 0x9b8ac8);
          cube(D, x, 14.2, z, 2, 1, 2, 0xfffaf3);
          const beamMat = new THREE.MeshBasicMaterial({ color: beamCols[bi++ % beamCols.length], transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
          beamMat.userData.gtOwn = true;
          const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 16, 1, true), beamMat);
          beam.position.set(x, 14, z);
          beam.userData.spin = Math.random() * 6;
          beam.geometry.translate(0, -20, 0);
          this.group.add(beam);
          this.updaters.push((dt) => {
            beam.userData.spin += dt * 0.4;
            beam.rotation.set(1.0 + Math.sin(beam.userData.spin) * 0.25, beam.userData.spin * 0.6, 0);
            return true;
          });
        }
      }
      const dm = D.mesh(G.mat('w-decor', { vertexColors: true }), false);
      if (dm) this.group.add(dm);
      const dcm = DC.mesh(G.mat('w-decor-c', { map: 'konteyner', vertexColors: true }), false);
      if (dcm) this.group.add(dcm);
      const dsm = DS.mesh(G.mat('w-decor-' + dsMap, { map: dsMap, vertexColors: true }), false);
      if (dsm) this.group.add(dsm);
      if (T.rain) {
        const n = G.settings.quality === 'dusuk' ? 500 : 1400;
        const pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
          const x = (Math.random() - 0.5) * 50, y = Math.random() * 25, z = (Math.random() - 0.5) * 50;
          pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.4 }));
        rain.frustumCulled = false;
        this.rain = rain;
        this.group.add(rain);
      }
    }

    update(dt, camPos) {
      if (this.sky && camPos) this.sky.position.copy(camPos);
      const sf = this.shadowFollow;
      if (sf && camPos) {
        // kutuyu bakış yönüne kaydır: gölgeler önümüzde, arkadaki boşa harcanmasın
        let fx = camPos.x, fz = camPos.z;
        const cam = G.camera;
        if (cam && cam.position === camPos) {
          const e = cam.matrixWorld.elements;
          const dx = -e[8], dz = -e[10], dl = Math.hypot(dx, dz);
          if (dl > 1e-4) {
            fx += (dx / dl) * sf.R * 0.4;
            fz += (dz / dl) * sf.R * 0.4;
          }
        }
        // ışık uzayında gölge dokusu ızgarasına kenetle (kayarken titreme olmasın)
        const r = sf.right.x * fx + sf.right.z * fz;
        const u = sf.up.x * fx + sf.up.z * fz;
        const rs = Math.round(r / sf.texel) * sf.texel, us = Math.round(u / sf.texel) * sf.texel;
        // yerdeki (y=0) noktayı geri kur: c = right*rs + up*us + dir*t, c.y = 0
        sf.c.copy(sf.right).multiplyScalar(rs).addScaledVector(sf.up, us);
        const t = sf.dir.y !== 0 ? -sf.c.y / sf.dir.y : 0;
        sf.c.addScaledVector(sf.dir, t);
        this.sun.target.position.copy(sf.c);
        this.sun.target.updateMatrixWorld();
        this.sun.position.copy(sf.c).addScaledVector(sf.dir, 90);
      }
      if (this.rain && camPos) {
        const p = this.rain.geometry.attributes.position;
        const a = p.array;
        for (let i = 0; i < a.length; i += 6) {
          a[i + 1] -= dt * 22;
          a[i + 4] -= dt * 22;
          if (a[i + 4] < 0) {
            const x = (Math.random() - 0.5) * 50, z = (Math.random() - 0.5) * 50, y = 20 + Math.random() * 5;
            a[i] = x; a[i + 1] = y; a[i + 2] = z;
            a[i + 3] = x + 0.05; a[i + 4] = y - 0.7; a[i + 5] = z;
          }
        }
        p.needsUpdate = true;
        this.rain.position.set(camPos.x, 0, camPos.z);
      }
      if (this.water) {
        this.water.position.y = -0.9 + Math.sin(G.time * 0.7) * 0.06;
        this.water.material.uniforms.time.value += dt;
      }
      if (this.clouds) this.clouds.rotation.y += dt * 0.004;
      if (this.sky) this.sky.material.uniforms.time.value += dt;
      if (this.muzzleLight.intensity > 0) this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
      if (this.boomLight.intensity > 0) this.boomLight.intensity = Math.max(0, this.boomLight.intensity - dt * 14);
      for (let i = this.updaters.length - 1; i >= 0; i--) if (!this.updaters[i](dt)) this.updaters.splice(i, 1);
      // duman bulutlarını temizle
      for (let i = this.smokes.length - 1; i >= 0; i--) if (G.time > this.smokes[i].t1) this.smokes.splice(i, 1);
    }

    // Gölge kutusunun yarı genişliği (menü yakın çekimde daha keskin gölge için küçültür)
    setShadowRange(R) {
      const sun = this.sun;
      if (!sun || !sun.castShadow) return;
      const f = this.shadowFollow;
      if (f) {
        f.R = R;
        f.texel = (2 * R) / sun.shadow.mapSize.x;
      }
      const c = sun.shadow.camera;
      c.left = c.bottom = -R;
      c.right = c.top = R;
      c.updateProjectionMatrix();
    }

    dispose(scene) {
      scene.remove(this.group);
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        // yalnızca bu dünyaya ait (önbelleksiz) malzemeleri bırak
        const m = o.material;
        if (m && m.userData && m.userData.gtOwn) {
          if (m.map && m.map.gtOwnTex) m.map.dispose();
          m.dispose();
        }
      });
    }

    // ---------------- Uzamsal sorgular ----------------
    forBoxesInRect(x0, z0, x1, z1, fn) {
      const s = ++this.stamp;
      const cx0 = Math.max(0, Math.floor(x0 / CELL)), cx1 = Math.min(this.w - 1, Math.floor(x1 / CELL));
      const cz0 = Math.max(0, Math.floor(z0 / CELL)), cz1 = Math.min(this.h - 1, Math.floor(z1 / CELL));
      for (let z = cz0; z <= cz1; z++)
        for (let x = cx0; x <= cx1; x++) {
          const list = this.cellBoxes[x + z * this.w];
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b._s === s || b.disabled) continue;
            b._s = s;
            if (fn(b) === false) return;
          }
        }
    }

    // AABB serbest mi?
    spaceFree(x, y, z, r, h) {
      let free = true;
      this.forBoxesInRect(x - r, z - r, x + r, z + r, (b) => {
        if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1 && y + h > b.y0 && y < b.y1) {
          free = false;
          return false;
        }
      });
      return free;
    }

    // Karakter hareketi (eksen eksen çözüm + basamak çıkma)
    moveCharacter(ch, dx, dy, dz) {
      const r = ch.radius, h = ch.height;
      const p = ch.pos;
      const STEP = ch.stepHeight != null ? ch.stepHeight : 0.55;
      let hitWall = false;
      const wasGrounded = ch.grounded;
      ch.grounded = false;
      // X
      if (dx) {
        p.x += dx;
        this.forBoxesInRect(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
          if (p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1 && p.y + h > b.y0 && p.y < b.y1) {
            const rise = b.y1 - p.y;
            if (wasGrounded && rise > 0 && rise <= STEP && this.spaceFree(p.x, b.y1 + 0.01, p.z, r, h)) {
              p.y = b.y1 + 0.001;
              return;
            }
            p.x = dx > 0 ? b.x0 - r - 1e-4 : b.x1 + r + 1e-4;
            hitWall = true;
          }
        });
      }
      // Z
      if (dz) {
        p.z += dz;
        this.forBoxesInRect(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
          if (p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1 && p.y + h > b.y0 && p.y < b.y1) {
            const rise = b.y1 - p.y;
            if (wasGrounded && rise > 0 && rise <= STEP && this.spaceFree(p.x, b.y1 + 0.01, p.z, r, h)) {
              p.y = b.y1 + 0.001;
              return;
            }
            p.z = dz > 0 ? b.z0 - r - 1e-4 : b.z1 + r + 1e-4;
            hitWall = true;
          }
        });
      }
      // Y
      p.y += dy;
      let hitCeil = false;
      this.forBoxesInRect(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
        if (p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1 && p.y + h > b.y0 && p.y < b.y1) {
          if (dy <= 0) {
            p.y = b.y1;
            ch.grounded = true;
          } else {
            p.y = b.y0 - h - 1e-4;
            hitCeil = true;
          }
        }
      });
      if (p.y <= 0) {
        p.y = 0;
        ch.grounded = true;
      }
      // Zemin yoklaması: yürürken küçük basamaklardan düşmemek için
      if (!ch.grounded && dy <= 0 && wasGrounded) {
        let below = 0;
        this.forBoxesInRect(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
          if (p.x + r > b.x0 && p.x - r < b.x1 && p.z + r > b.z0 && p.z - r < b.z1 && b.y1 <= p.y + 0.01 && b.y1 > below) below = b.y1;
        });
        if (p.y - below < 0.06) {
          p.y = below;
          ch.grounded = true;
        }
      }
      return { hitWall, hitCeil };
    }

    // ---------------- Işın izleme ----------------
    // Dönüş: {t, nx, ny, nz, box} veya null
    raycast(ox, oy, oz, dx, dy, dz, maxT, opts) {
      const len = Math.hypot(dx, dy, dz);
      if (len === 0) return null;
      dx /= len; dy /= len; dz /= len;
      const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
      let best = maxT, bn = null, bbox = null;
      const s = ++this.stamp;
      const ignoreBox = opts && opts.ignoreBox;
      // zemin
      if (dy < 0) {
        const tg = -oy / dy;
        if (tg >= 0 && tg < best) {
          best = tg;
          bn = [0, 1, 0];
        }
      }
      let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
      const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      let tMaxX = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL : cx * CELL) - ox) / dx : Infinity;
      let tMaxZ = dz !== 0 ? ((dz > 0 ? (cz + 1) * CELL : cz * CELL) - oz) / dz : Infinity;
      const tDX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
      const tDZ = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
      let tCell = 0;
      for (let iter = 0; iter < 400; iter++) {
        if (cx >= 0 && cz >= 0 && cx < this.w && cz < this.h) {
          const list = this.cellBoxes[cx + cz * this.w];
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b._s === s || b.disabled || b.clip || b === ignoreBox) continue;
            b._s = s;
            // slab
            let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
            let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
            t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
            let lo = Math.min(t1, t2), hi = Math.max(t1, t2);
            if (lo > tmin) { tmin = lo; ax = 1; }
            if (hi < tmax) tmax = hi;
            t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
            lo = Math.min(t1, t2); hi = Math.max(t1, t2);
            if (lo > tmin) { tmin = lo; ax = 2; }
            if (hi < tmax) tmax = hi;
            if (tmax < Math.max(tmin, 0)) continue;
            if (tmin < 0) continue; // içindeyiz
            if (tmin < best) {
              best = tmin;
              bn = ax === 0 ? [-Math.sign(dx), 0, 0] : ax === 1 ? [0, -Math.sign(dy), 0] : [0, 0, -Math.sign(dz)];
              bbox = b;
            }
          }
        } else if (tCell > 0) {
          break;
        }
        // sonraki hücre
        const next = Math.min(tMaxX, tMaxZ);
        if (next > best || next > maxT) break;
        tCell = next;
        if (tMaxX < tMaxZ) {
          cx += stepX;
          tMaxX += tDX;
        } else {
          cz += stepZ;
          tMaxZ += tDZ;
        }
      }
      if (!bn) return null;
      return { t: best, nx: bn[0], ny: bn[1], nz: bn[2], box: bbox, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best };
    }

    // İki nokta arası görüş (duman dahil)
    los(ax, ay, az, bx, by, bz, ignoreSmoke) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.01) return true;
      const hit = this.raycast(ax, ay, az, dx, dy, dz, d - 0.05);
      if (hit) return false;
      if (!ignoreSmoke && this.smokes.length && this.smokeBlocks(ax, ay, az, bx, by, bz)) return false;
      return true;
    }

    smokeBlocks(ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const L = Math.hypot(dx, dy, dz);
      const ux = dx / L, uy = dy / L, uz = dz / L;
      for (const s of this.smokes) {
        const life = G.time - s.t0;
        const r = s.r * U.clamp(life / 1.5, 0, 1) * U.clamp((s.t1 - G.time) / 2, 0, 1);
        if (r < 0.5) continue;
        const ox = s.x - ax, oy = s.y - ay, oz = s.z - az;
        const tc = ox * ux + oy * uy + oz * uz;
        const d2 = ox * ox + oy * oy + oz * oz - tc * tc;
        if (d2 > r * r) continue;
        const half = Math.sqrt(r * r - d2);
        const t0 = Math.max(0, tc - half), t1 = Math.min(L, tc + half);
        if (t1 - t0 > 1.2) return true;
      }
      return false;
    }

    // Rastgele yürünebilir hücre
    randomWalkable(filter) {
      for (let i = 0; i < 400; i++) {
        const x = U.randInt(1, this.w - 2), z = U.randInt(1, this.h - 2);
        if (this.walk[x + z * this.w] && (!filter || filter(x, z))) return [x, z];
      }
      return null;
    }

    // En yakın yürünebilir hücre
    nearestWalkable(cx, cz) {
      if (this.isWalkable(cx, cz)) return [cx, cz];
      for (let r = 1; r < 6; r++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            if (this.isWalkable(cx + dx, cz + dz)) return [cx + dx, cz + dz];
          }
      return null;
    }

    path(fromX, fromZ, toX, toZ) {
      const s = this.nearestWalkable(Math.floor(fromX / CELL), Math.floor(fromZ / CELL));
      const t = this.nearestWalkable(Math.floor(toX / CELL), Math.floor(toZ / CELL));
      if (!s || !t) return null;
      const cells = G.findPath(this.walk, this.w, this.h, s[0], s[1], t[0], t[1]);
      if (!cells) return null;
      // dize çekme ile sadeleştirme
      const out = [];
      let i = 0;
      while (i < cells.length - 1) {
        let j = cells.length - 1;
        while (j > i + 1 && !G.gridLine(this.walk, this.w, this.h, cells[i][0] + 0.5, cells[i][1] + 0.5, cells[j][0] + 0.5, cells[j][1] + 0.5, 0.3)) j--;
        out.push(cells[j]);
        i = j;
      }
      return out.map(([x, z]) => new THREE.Vector3(x * CELL + CELL / 2, 0, z * CELL + CELL / 2));
    }
  }

  G.World = World;
  G.CELL = CELL;
})();
