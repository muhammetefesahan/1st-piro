'use strict';
// Gölge Timi — dünya: harita geometrisi, çarpışma, ışın izleme, navigasyon.
(function () {
  const G = window.G;
  const U = G.util;
  const CELL = 2;
  const WALKABLE = new Set(['.', ',', 'd']);
  const DOOR_CHARS = new Set(['1', '2', '3', '4']);
  const OBSTACLE = new Set(['c', 'C', 'x', 'h', 'b', 'v', 'K', 'w', 'T', 'L']);
  const CONTAINER_COLORS = [0x2f6e9e, 0xb33a2c, 0x2f7d4a, 0xc9822b, 0x6b6f75, 0x7a3f8f, 0x1f4e6e, 0x9c6b2e];

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
          let shade = 1;
          if (o.ao && F.n[1] === 0) shade = 1; // yer tutucu
          this.c.push(col.r * shade, col.g * shade, col.b * shade);
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

    build(scene) {
      const T = this.theme;
      this.scene = scene;
      this.computeIndoor();
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) this.walk[x + z * this.w] = WALKABLE.has(this.rows[z][x]) ? 1 : 0;

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
      };
      const H_WALL = 6, H_BLD = 4.8;

      // Çevre duvarları
      for (const r of this.mergeRects(new Set(['#']))) {
        const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        B.wall.box(x0, 0, z0, x1, H_WALL, z1, { scale: 4 });
        this.addBox(x0, 0, z0, x1, H_WALL, z1, { kind: 'wall' });
      }
      // Bina duvarları
      for (const r of this.mergeRects(new Set(['H']))) {
        const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
        B.building.box(x0, 0, z0, x1, H_BLD, z1, { scale: 3 });
        this.addBox(x0, 0, z0, x1, H_BLD, z1, { kind: 'wall' });
      }
      // Pencereler, kapı boşlukları
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const ch = this.rows[z][x];
          const x0 = x * CELL, z0 = z * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
          if (ch === '=') {
            B.building.box(x0, 0, z0, x1, 1.0, z1, { scale: 3, skipTop: false });
            B.building.box(x0, 2.2, z0, x1, H_BLD, z1, { scale: 3, skipBottom: false });
            this.addBox(x0, 0, z0, x1, 1.0, z1, { kind: 'wall' });
            this.addBox(x0, 2.2, z0, x1, H_BLD, z1, { kind: 'wall' });
            // pencere pervazı
            const alongX = this.at(x - 1, z) === 'H' || this.at(x + 1, z) === 'H' || this.at(x - 1, z) === '=' || this.at(x + 1, z) === '=';
            if (alongX) B.wood.box(x0, 0.98, (z0 + z1) / 2 - 0.55, x1, 1.06, (z0 + z1) / 2 + 0.55, { uv: 'unit' });
            else B.wood.box((x0 + x1) / 2 - 0.55, 0.98, z0, (x0 + x1) / 2 + 0.55, 1.06, z1, { uv: 'unit' });
          } else if (ch === 'd') {
            B.building.box(x0, 2.6, z0, x1, H_BLD, z1, { scale: 3, skipBottom: false });
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
        // çatı: iç hücreler birleşik
        const saved = this.rows;
        this.rows = saved.map((row, z) => row.map((ch, x) => (this.indoor[x + z * this.w] ? '§' : ch)));
        for (const r of this.mergeRects(new Set(['§']))) {
          const x0 = r.x * CELL, z0 = r.z * CELL, x1 = (r.x + r.w) * CELL, z1 = (r.z + r.h) * CELL;
          B.roof.box(x0, 4.5, z0, x1, 4.8, z1, { scale: 3, skipBottom: false });
          this.addBox(x0, 4.5, z0, x1, 4.8, z1, { kind: 'roof' });
        }
        this.rows = saved;
      }
      // Konteynerler
      let ci = 0;
      for (const r of this.mergeRects(new Set(['K']))) {
        const x0 = r.x * CELL + 0.06, z0 = r.z * CELL + 0.06, x1 = (r.x + r.w) * CELL - 0.06, z1 = (r.z + r.h) * CELL - 0.06;
        const col = CONTAINER_COLORS[(r.x * 7 + r.z * 13 + ci++) % CONTAINER_COLORS.length];
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
      // Alçak beton duvar
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
        B.concrete.box(x0, 0, z0, x1, 1.2, z1, { scale: 2 });
        this.addBox(x0, 0, z0, x1, 1.2, z1, { kind: 'cover' });
      }
      // Araç enkazları
      for (const r of this.mergeRects(new Set(['v']))) {
        const x0 = r.x * CELL + 0.15, z0 = r.z * CELL + 0.25, x1 = (r.x + r.w) * CELL - 0.15, z1 = (r.z + r.h) * CELL - 0.25;
        const long = r.w >= r.h;
        B.rust.box(x0, 0.35, z0, x1, 1.05, z1, { scale: 1.5 });
        if (long) B.rust.box(x0 + (x1 - x0) * 0.25, 1.05, z0 + 0.12, x1 - (x1 - x0) * 0.3, 1.6, z1 - 0.12, { scale: 1.5 });
        else B.rust.box(x0 + 0.12, 1.05, z0 + (z1 - z0) * 0.25, x1 - 0.12, 1.6, z1 - (z1 - z0) * 0.3, { scale: 1.5 });
        // tekerlekler
        const wheels = long
          ? [[x0 + 0.5, z0 - 0.02], [x1 - 0.5, z0 - 0.02], [x0 + 0.5, z1 + 0.02], [x1 - 0.5, z1 + 0.02]]
          : [[x0 - 0.02, z0 + 0.5], [x0 - 0.02, z1 - 0.5], [x1 + 0.02, z0 + 0.5], [x1 + 0.02, z1 - 0.5]];
        for (const [wx, wz] of wheels) B.metal.box(wx - 0.3, 0, wz - 0.15, wx + 0.3, 0.6, wz + 0.15, { scale: 1, color: 0x222222 });
        this.addBox(x0, 0, z0, x1, 1.6, z1, { kind: 'vehicle', metal: true });
      }
      // Tekil nesneler
      for (let z = 0; z < this.h; z++)
        for (let x = 0; x < this.w; x++) {
          const ch = this.rows[z][x];
          const cx = x * CELL + 1, cz = z * CELL + 1;
          if (ch === 'c') {
            const s = 0.78 + ((x * 31 + z * 17) % 7) * 0.012;
            B.crate.box(cx - s, 0, cz - s, cx + s, 1.1, cz + s, { uv: 'unit' });
            this.addBox(cx - s, 0, cz - s, cx + s, 1.1, cz + s, { kind: 'crate' });
          } else if (ch === 'C') {
            B.crate.box(cx - 0.85, 0, cz - 0.85, cx + 0.85, 1.1, cz + 0.85, { uv: 'unit' });
            const o = ((x + z) % 2 ? 0.08 : -0.08);
            B.crate.box(cx - 0.7 + o, 1.1, cz - 0.7 - o, cx + 0.7 + o, 2.2, cz + 0.7 - o, { uv: 'unit' });
            this.addBox(cx - 0.85, 0, cz - 0.85, cx + 0.85, 2.2, cz + 0.85, { kind: 'crate' });
          } else if (ch === 'x') {
            B.concrete.box(cx - 0.55, 0, cz - 0.55, cx + 0.55, 4.8, cz + 0.55, { scale: 2 });
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

      // Zombi kapıları
      if (this.def.kind === 'zm') this.buildDoors(B);
      // Dekor, tabelalar, cephe ayrıntıları
      if (G.Props) G.Props.dress(this, B);

      // Malzemeler
      const mats = {
        wall: G.mat('wall-' + T.wall, { map: T.wall }),
        building: G.mat('bld-' + T.building, { map: T.building }),
        roof: G.mat('roof', { map: 'cati', color: 0x9a9a9a }),
        indoor: G.mat('indoor-' + T.indoor, { map: T.indoor }),
        crate: G.mat('crate', { map: 'sandik' }),
        container: G.mat('container', { map: 'konteyner', vertexColors: true, metalness: 0.25, roughness: 0.7 }),
        sandbag: G.mat('sandbag', { map: 'kumtorba' }),
        concrete: G.mat('concrete', { map: 'beton', color: 0xb8b8b0 }),
        rust: G.mat('rust', { map: 'pas', metalness: 0.3, roughness: 0.8 }),
        metal: G.mat('metalv', { map: 'metal', vertexColors: true, metalness: 0.4, roughness: 0.6 }),
        wood: G.mat('wood', { map: 'ahsap' }),
      };
      for (const k in B) {
        const m = B[k].mesh(mats[k], k !== 'indoor');
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
        const lintel = new Bucket();
        lintel.box(x0, 3.0, z0, x1, top, z1, { scale: 3 });
        const lm = lintel.mesh(G.mat('bld-' + this.theme.building, { map: this.theme.building }));
        this.group.add(lm);
        this.addBox(x0, 3.0, z0, x1, top, z1, { kind: 'wall' });
        const doorGroup = new THREE.Group();
        const plank = new Bucket();
        plank.box(ex0, 0, ez0, ex1, 3.0, ez1, { uv: 'unit' });
        // çapraz tahtalar
        for (let i = 0; i < 3; i++) {
          const y = 0.5 + i * 0.9;
          if (thinX) plank.box(ex0 + 0.1, y, ez0 - 0.08, ex1 - 0.1, y + 0.28, ez0, { uv: 'unit', color: 0x9a7a55 });
          else plank.box(ex0 - 0.08, y, ez0 + 0.1, ex0, y + 0.28, ez1 - 0.1, { uv: 'unit', color: 0x9a7a55 });
          if (thinX) plank.box(ex0 + 0.1, y, ez1, ex1 - 0.1, y + 0.28, ez1 + 0.08, { uv: 'unit', color: 0x9a7a55 });
          else plank.box(ex1, y, ez0 + 0.1, ex1 + 0.08, y + 0.28, ez1 - 0.1, { uv: 'unit', color: 0x9a7a55 });
        }
        doorGroup.add(plank.mesh(G.mat('doorwood', { map: 'ahsap', vertexColors: true })));
        const def = doorDefs[id] || { cost: 1000, name: 'Kapı' };
        const ltex = G.labelTex(def.cost + ' PUAN', { color: '#ffd23a', glow: '#000', size: 30 });
        for (const side of [-1, 1]) {
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, depthWrite: false, transparent: true }));
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

    makeBarrel(cx, cz, gx, gz) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 1.15, 14),
        G.mat('barrel', { color: 0xa3261c, metalness: 0.35, roughness: 0.55, map: 'metal' })
      );
      body.position.y = 0.575;
      body.castShadow = true;
      body.receiveShadow = true;
      grp.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.16, 14), G.mat('barrelband', { color: 0xf0c020, emissive: 0x3a2a00 }));
      band.position.y = 0.75;
      grp.add(band);
      grp.position.set(cx, 0, cz);
      this.group.add(grp);
      const ent = { type: 'barrel', hp: 35, exploded: false, mesh: grp, pos: new THREE.Vector3(cx, 0.6, cz), cell: [gx, gz] };
      ent.box = this.addBox(cx - 0.4, 0, cz - 0.4, cx + 0.4, 1.15, cz + 0.4, { kind: 'barrel', ent, metal: true });
      this.barrels.push(ent);
    }

    makeTree(cx, cz, B) {
      const palm = !!this.theme.palms;
      const grp = new THREE.Group();
      const trunkMat = G.mat('trunk', { color: palm ? 0x7a5d3e : 0x4a3a2c });
      if (palm) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 6, 7), trunkMat);
        trunk.position.y = 3;
        trunk.rotation.z = 0.12;
        trunk.castShadow = true;
        grp.add(trunk);
        const leafMat = G.mat('palmleaf', { color: 0x4f7a2e, side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), leafMat);
          leaf.position.set(0.35, 6, 0);
          leaf.rotation.set(-1.0, (i / 7) * Math.PI * 2, 0, 'YXZ');
          leaf.translateY(1.4);
          leaf.castShadow = true;
          grp.add(leaf);
        }
      } else {
        const dead = this.def.kind === 'zm' || this.theme.night;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 4, 7), trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        grp.add(trunk);
        if (dead) {
          for (let i = 0; i < 5; i++) {
            const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 1.8, 5), trunkMat);
            br.position.set(0, 2.6 + i * 0.35, 0);
            br.rotation.set(0.9, i * 1.3, 0, 'YXZ');
            br.translateY(0.8);
            grp.add(br);
          }
        } else {
          const leafMat = G.mat('leaf', { color: 0x3d6b2a });
          for (let i = 0; i < 3; i++) {
            const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 - i * 0.35, 0), leafMat);
            f.position.set((i - 1) * 0.3, 4 + i * 1.0, (i % 2) * 0.3);
            f.castShadow = true;
            grp.add(f);
          }
        }
      }
      grp.position.set(cx, 0, cz);
      this.group.add(grp);
      this.addBox(cx - 0.3, 0, cz - 0.3, cx + 0.3, 4, cz + 0.3, { kind: 'tree' });
    }

    makeLamp(cx, cz, B) {
      B.metal.box(cx - 0.09, 0, cz - 0.09, cx + 0.09, 5.2, cz + 0.09, { scale: 1, color: 0x55595e });
      B.metal.box(cx - 0.09, 5.1, cz - 0.09, cx + 0.9, 5.22, cz + 0.09, { scale: 1, color: 0x55595e });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.32), G.mat('lamphead', { color: 0xfff0c0, emissive: 0xffd890, emissiveIntensity: 1.4 }));
      head.position.set(cx + 0.8, 5.1, cz);
      this.group.add(head);
      this.addBox(cx - 0.15, 0, cz - 0.15, cx + 0.15, 5.2, cz + 0.15, { kind: 'pole', metal: true });
      this.lamps.push(new THREE.Vector3(cx + 0.8, 4.9, cz));
    }

    makeRailing(x, z, B) {
      const x0 = x * CELL, z0 = z * CELL;
      // korkuluk hattı hücrenin kuzey kenarı boyunca
      const zz = z0 + 0.6;
      B.metal.box(x0, 1.0, zz - 0.04, x0 + CELL, 1.1, zz + 0.04, { scale: 1, color: 0xd9b23a });
      B.metal.box(x0, 0.5, zz - 0.03, x0 + CELL, 0.57, zz + 0.03, { scale: 1, color: 0xd9b23a });
      B.metal.box(x0 + 0.95, 0, zz - 0.05, x0 + 1.05, 1.1, zz + 0.05, { scale: 1, color: 0xd9b23a });
      B.concrete.box(x0, 0, z0, x0 + CELL, 0.12, z0 + CELL, { scale: 2 });
      this.addBox(x0, 0, z0, x0 + CELL, 1.1, zz + 0.05, { kind: 'rail', metal: true });
      this.addBox(x0, 1.1, z0, x0 + CELL, 8, z0 + CELL, { kind: 'clip', clip: true });
    }

    buildGround() {
      const T = this.theme;
      const pad = 120;
      const sea = T.sea === 'south';
      const gx0 = -pad, gx1 = this.sizeX + pad, gz0 = -pad, gz1 = sea ? this.sizeZ : this.sizeZ + pad;
      const geo = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0);
      const tex = G.texture(T.ground).clone();
      tex.needsUpdate = true;
      tex.repeat.set((gx1 - gx0) / 5, (gz1 - gz0) / 5);
      const mat = G.mat('ground-' + T.ground, { map: T.ground });
      const m = new THREE.Mesh(geo, mat.clone());
      m.material.map = tex;
      m.rotation.x = -Math.PI / 2;
      m.position.set((gx0 + gx1) / 2, 0, (gz0 + gz1) / 2);
      m.receiveShadow = true;
      this.group.add(m);
      if (sea) {
        const water = new THREE.Mesh(
          new THREE.PlaneGeometry(gx1 - gx0, 400),
          new THREE.ShaderMaterial({
            uniforms: {
              time: { value: 0 },
              deep: { value: new THREE.Color(0x14303f) },
              shallow: { value: new THREE.Color(0x2e6a7a) },
              glint: { value: new THREE.Color(T.sun) },
              fogColor: { value: new THREE.Color(T.fog) },
              fogFar: { value: T.fogFar },
            },
            vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: [
              'uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 glint; uniform vec3 fogColor; uniform float fogFar; varying vec3 vW;',
              'void main(){',
              ' float w = sin(vW.x * 0.35 + time * 1.3) * 0.5 + sin(vW.z * 0.6 - time * 1.7 + vW.x * 0.2) * 0.5 + sin((vW.x + vW.z) * 1.3 + time * 2.4) * 0.25;',
              ' vec3 c = mix(deep, shallow, 0.5 + 0.3 * w);',
              ' float g = step(1.05, w + sin(vW.x * 2.7 - time * 3.0) * 0.4);',
              ' c += glint * g * 0.35;',
              ' float d = length(vW - cameraPosition);',
              ' c = mix(c, fogColor, clamp(d / fogFar, 0.0, 1.0) * 0.85);',
              ' gl_FragColor = vec4(c, 1.0);',
              '}',
            ].join('\n'),
          })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.set((gx0 + gx1) / 2, -0.9, this.sizeZ + 200);
        this.group.add(water);
        this.water = water;
        const edge = new Bucket();
        edge.box(gx0, -3, this.sizeZ - 0.01, gx1, 0, this.sizeZ + 0.4, { scale: 3 });
        this.group.add(edge.mesh(G.mat('concrete', { map: 'beton', color: 0xb8b8b0 })));
      }
    }

    buildSky() {
      const T = this.theme;
      const sd = new THREE.Vector3().fromArray(T.sunDir).normalize();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color(T.skyTop) },
          horizon: { value: new THREE.Color(T.skyHorizon) },
          bottom: { value: new THREE.Color(T.skyBottom) },
          sunDir: { value: sd },
          sunCol: { value: new THREE.Color(T.sun) },
          night: { value: T.night ? 1 : 0 },
          time: { value: 0 },
          cloudCol: { value: new THREE.Color(T.night ? 0x2a3040 : T.sunIntensity < 1.4 && !T.night && T.skyHorizon === 0xf2a65a ? 0xf0b8a0 : 0xf4f6fa) },
          cloudAmt: { value: T.clouds != null ? T.clouds : 0.5 },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: [
          'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;',
          'uniform float time; uniform vec3 cloudCol; uniform float cloudAmt;',
          'varying vec3 vDir;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
          ' return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
          'float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }',
          'void main(){',
          ' vec3 d = normalize(vDir);',
          ' float y = d.y;',
          ' vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-y,0.0,1.0), 0.4));',
          ' float s = max(dot(d, normalize(sunDir)), 0.0);',
          ' c += sunCol * (pow(s, 600.0) * (night > 0.5 ? 0.9 : 2.5) + pow(s, 12.0) * (night > 0.5 ? 0.05 : 0.35));',
          ' if (y > 0.0) {',
          '  vec2 uv = d.xz / (y + 0.12) * 1.4 + vec2(time * 0.012, time * 0.005);',
          '  float n = fbm(uv);',
          '  float cl = smoothstep(0.62 - cloudAmt * 0.3, 0.9, n) * smoothstep(0.0, 0.22, y);',
          '  float shade = fbm(uv * 2.3 + 4.0);',
          '  vec3 cc = mix(cloudCol, cloudCol * 0.55, shade) + sunCol * pow(s, 6.0) * 0.35;',
          '  c = mix(c, cc, cl * 0.9);',
          ' }',
          ' gl_FragColor = vec4(c, 1.0);',
          '}',
        ].join('\n'),
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat);
      sky.renderOrder = -10;
      sky.frustumCulled = false;
      this.sky = sky;
      this.group.add(sky);
      if (T.stars) {
        const n = 900;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, y = 0.12 + Math.random() * 0.88;
          const r = Math.sqrt(1 - y * y);
          pos[i * 3] = Math.cos(a) * r * 420;
          pos[i * 3 + 1] = y * 420;
          pos[i * 3 + 2] = Math.sin(a) * r * 420;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
        stars.frustumCulled = false;
        sky.add(stars);
      }
    }

    buildLights() {
      const T = this.theme;
      const q = G.settings.quality;
      const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiIntensity);
      this.group.add(hemi);
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
        const R = Math.hypot(this.sizeX, this.sizeZ) / 2 + 4;
        const cam = sun.shadow.camera;
        cam.left = -R;
        cam.right = R;
        cam.top = R;
        cam.bottom = -R;
        cam.near = 1;
        cam.far = 220;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.03;
      }
      this.group.add(sun);
      this.sun = sun;
      this.hemi = hemi;
      // Sabit sayıda efekt ışığı (gölgelendirici yeniden derlenmesin diye)
      this.muzzleLight = new THREE.PointLight(0xffc070, 0, 9, 2);
      this.boomLight = new THREE.PointLight(0xff8a30, 0, 26, 2);
      this.group.add(this.muzzleLight, this.boomLight);
      // Lamba ışıkları
      this.lampLights = [];
      if (T.lampLights) {
        for (const p of this.lamps.slice(0, 5)) {
          const l = new THREE.PointLight(0xffd9a0, 1.3, 20, 2);
          l.position.copy(p);
          this.group.add(l);
          this.lampLights.push(l);
        }
      }
      if (T.zombieLights) {
        const spots = [
          [7, 16, 0xff9a50],
          [18, 15, 0xffb070],
          [22, 25, 0x88aaff],
          [22, 5, 0xff6040],
        ];
        for (const [x, z, c] of spots) {
          const l = new THREE.PointLight(c, 0.9, 22, 2);
          l.position.set(x * CELL + 1, 3.8, z * CELL + 1);
          this.group.add(l);
          this.lampLights.push(l);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: c }));
          bulb.position.copy(l.position);
          this.group.add(bulb);
        }
      }
    }

    buildDecor() {
      const T = this.theme;
      const decor = new THREE.Group();
      if (T.decor === 'cranes') {
        const yellow = G.mat('crane', { color: 0xd8a220, metalness: 0.4, roughness: 0.6 });
        const mkCrane = (x, z, rot) => {
          const g = new THREE.Group();
          const leg = new THREE.BoxGeometry(0.8, 26, 0.8);
          for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
            const m = new THREE.Mesh(leg, yellow);
            m.position.set(lx, 13, lz);
            g.add(m);
          }
          const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 2.2, 3), yellow);
          beam.position.set(10, 27, 0);
          g.add(beam);
          const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), G.mat('cab', { color: 0x30353a }));
          cab.position.set(0, 24, 0);
          g.add(cab);
          const cable = new THREE.Mesh(new THREE.BoxGeometry(0.1, 14, 0.1), G.mat('cable', { color: 0x111111 }));
          cable.position.set(22, 20, 0);
          g.add(cable);
          g.position.set(x, 0, z);
          g.rotation.y = rot;
          g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
          decor.add(g);
        };
        mkCrane(this.sizeX * 0.25, -14, 0.2);
        mkCrane(this.sizeX * 0.8, -16, -0.3);
        // Gemi
        const hull = new THREE.Mesh(new THREE.BoxGeometry(80, 9, 16), G.mat('hull', { color: 0x2a3640, metalness: 0.3 }));
        hull.position.set(this.sizeX / 2, 1, this.sizeZ + 45);
        decor.add(hull);
        for (let i = 0; i < 14; i++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.6, 2.4), G.mat('shipc' + (i % 5), { color: CONTAINER_COLORS[i % CONTAINER_COLORS.length], map: 'konteyner' }));
          c.position.set(this.sizeX / 2 - 30 + (i % 7) * 7, 6.8 + Math.floor(i / 7) * 2.6, this.sizeZ + 45 + ((i * 3) % 3) * 2.5 - 2.5);
          decor.add(c);
        }
        // Dış depolar
        for (let i = 0; i < 6; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(18, 10 + (i % 3) * 4, 14), G.mat('farbld', { color: 0x4d4844, map: 'metal' }));
          b.position.set(-20 + (i % 2) * (this.sizeX + 40), 5, 10 + i * 9);
          decor.add(b);
        }
      } else if (T.decor === 'dunes') {
        const mat = G.mat('dune', { color: 0xd2b07c });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const r = Math.max(this.sizeX, this.sizeZ) * 0.9 + (i % 3) * 18;
          const d = new THREE.Mesh(new THREE.SphereGeometry(30 + (i % 4) * 10, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
          d.scale.y = 0.35;
          d.position.set(this.sizeX / 2 + Math.cos(a) * r, -2, this.sizeZ / 2 + Math.sin(a) * r);
          decor.add(d);
        }
        // Dış evler
        const hm = G.mat('farhouse', { map: 'siva' });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + 0.3;
          const r = Math.max(this.sizeX, this.sizeZ) * 0.62;
          const h = new THREE.Mesh(new THREE.BoxGeometry(10, 6 + (i % 3) * 3, 10), hm);
          h.position.set(this.sizeX / 2 + Math.cos(a) * r, 3, this.sizeZ / 2 + Math.sin(a) * r);
          decor.add(h);
        }
      } else if (T.decor === 'hills') {
        const mat = G.mat('hill', { color: 0x5d6e3e });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const r = 140 + (i % 3) * 30;
          const d = new THREE.Mesh(new THREE.SphereGeometry(50 + (i % 4) * 15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
          d.scale.y = 0.4;
          d.position.set(this.sizeX / 2 + Math.cos(a) * r, -3, this.sizeZ / 2 + Math.sin(a) * r);
          decor.add(d);
        }
      }
      if (T.night && this.def.kind === 'mp') {
        // Projektör kuleleri
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        for (const [x, z] of [[-6, -6], [this.sizeX + 6, -6], [-6, this.sizeZ + 6], [this.sizeX + 6, this.sizeZ + 6]]) {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 1), G.mat('tower', { color: 0x2b2f35 }));
          tower.position.set(x, 7, z);
          decor.add(tower);
          const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 16, 1, true), beamMat);
          beam.position.set(x, 14, z);
          beam.userData.spin = Math.random() * 6;
          beam.geometry.translate(0, -20, 0);
          decor.add(beam);
          this.updaters.push((dt) => {
            beam.userData.spin += dt * 0.4;
            beam.rotation.set(1.0 + Math.sin(beam.userData.spin) * 0.25, beam.userData.spin * 0.6, 0);
            return true;
          });
        }
      }
      if (T.rain) {
        const n = G.settings.quality === 'dusuk' ? 500 : 1400;
        const pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
          const x = (Math.random() - 0.5) * 50, y = Math.random() * 25, z = (Math.random() - 0.5) * 50;
          pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb3cc, transparent: true, opacity: 0.35 }));
        rain.frustumCulled = false;
        this.rain = rain;
        this.group.add(rain);
      }
      this.group.add(decor);
    }

    update(dt, camPos) {
      if (this.sky && camPos) this.sky.position.copy(camPos);
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
      if (this.sky) this.sky.material.uniforms.time.value += dt;
      if (this.muzzleLight.intensity > 0) this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
      if (this.boomLight.intensity > 0) this.boomLight.intensity = Math.max(0, this.boomLight.intensity - dt * 14);
      for (let i = this.updaters.length - 1; i >= 0; i--) if (!this.updaters[i](dt)) this.updaters.splice(i, 1);
      // duman bulutlarını temizle
      for (let i = this.smokes.length - 1; i >= 0; i--) if (G.time > this.smokes[i].t1) this.smokes.splice(i, 1);
    }

    dispose(scene) {
      scene.remove(this.group);
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
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
