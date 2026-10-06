'use strict';
// Gölge Timi — insansı modeller (sürüm 3, "tatlı"): çibi askerler/operatörler
// (büyük kafa, parlak iri gözler, allık, kısa kollar, pati eller, yuvarlak botlar),
// sevimli düşman maskeleri, şapşal-tatlı zombiler, zombi yavru köpek ve ortak karakter sınıfı.
// Her kemik parçası köşe renkli tek ağa birleştirilir; tüm karakterler aynı toon
// malzemeyi paylaşır (insansı başına ~10–12 çizim çağrısı).
(function () {
  const G = window.G;
  const U = G.util;
  const T = G.toy;

  // ------------------------------------------------------------------
  // Ölçüler. HIP: mantıksal kalça yüksekliği (diğer dosyalar hips.position.y'yi
  // bu değere göre ayarlar); görsel bacak daha kısa olduğundan gövde ve bacaklar
  // kalçanın altındaki "pelvis" grubunda DROP kadar aşağıda durur.
  // ------------------------------------------------------------------
  const HIP = 0.95, LEG = 0.59, DROP = HIP - LEG;
  const HR = 0.3; // kafa yarıçapı (tasarım ölçüsü; kafa ağı HS ile büyütülür)
  const HS = 1.1;
  const HCY = HR * 0.93; // kafa merkezinin boyun üstündeki yüksekliği
  const TY = 1.34; // gövde boy çarpanı
  const NECK = 0.44 * TY; // gövde içinde boyun yüksekliği
  const SH = new THREE.Vector3(0.27, 0.36 * TY, 0); // omuz (gövde uzayı)
  const UA = 0.21, FA = 0.21; // üst kol / ön kol
  const GUN = { x: 0.07, y: 0.3, z: -0.24, s: 1.15 }; // oyuncak silah çibi gövdede biraz iri durur


  // Ayrıntı düzeyi: menüde (vitrin) tam, maç içinde hafif geometri (telefonlar için)
  let LQ = false;
  // büyük silüet parçaları (kafa, kask, gövde) daha az inceltilir: yüzler köşeli görünmesin
  const lq = (n, min) => (LQ ? Math.max(min || 4, Math.round(n * (n >= 16 ? 0.7 : 0.45))) : n);
  const lq2 = (n, min) => (LQ ? Math.max(min, Math.round(n * 0.7)) : n);
  const Q = {
    sphere: (a, b) => T.sphere(lq(a, 6), a >= 16 ? lq2(b, 6) : lq(b, 4)),
    hemi: (a, b) => T.hemi(lq(a, 8), a >= 16 ? lq2(b, 4) : lq(b, 3)),
    torus: (r, t, rs, ts, arc) => T.torus(r, t, lq(rs, 3), lq(ts, 6), arc),
    capsule: (r, len, seg) => T.capsule(r, len, lq(seg, 6), LQ ? 2 : 4),
    lathe: (k, pts, seg) => T.lathe(k, pts, lq(seg, 8)),
    cyl: (seg) => T.cyl(lq(seg, 6)),
    rbox: (w, h, d, r) => T.rbox(w, h, d, r, LQ ? 1 : 3),
  };

  // Yassı yuvarlak parçalar (göz, allık, ağız) için kutbu öne (Z) bakan küre:
  // önden bakınca dış çizgi düzgün bir çokgen olur; hafif modda da gözler yuvarlak kalır.
  const _disc = {};
  function D(ws) {
    const w = LQ ? Math.max(10, Math.round(ws * 0.75)) : ws, h = LQ ? 3 : 5;
    const k = w + ':' + h;
    return _disc[k] || (_disc[k] = new THREE.SphereGeometry(1, w, h).rotateX(Math.PI / 2));
  }

  const INK = 0x3b2a4a, BLUSH = 0xff9eb5, WHITE = 0xffffff;
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  function mix(a, b, t) {
    return _c1.set(a).lerp(_c2.set(b), t).getHex();
  }
  function shade(a, k) {
    return _c1.set(a).multiplyScalar(k).getHex();
  }

  const TEAM_LOOK = {
    // Gölge Timi: gök mavisi + güneş sarısı
    0: { uni: 0x5cc8ff, pants: 0x3d9be9, vest: 0x2f7fd6, vest2: 0x2a6fbf, accent: 0xffd23f, helmet: 0x4cc3ff, stripe: 0xffd23f, glove: 0xfffaf3, boot: 0x6a5a8a, cap: 0x2f7fd6, bala: 0x2f5fae, eye: 0x4a2f45 },
    // Kızıl Pençe: mercan + mor
    1: { uni: 0xff8b8b, pants: 0x9b5de5, vest: 0xff6b6b, vest2: 0xe8566a, accent: 0xc39bff, helmet: 0x9b5de5, stripe: 0xff8b94, glove: 0xfff1f8, boot: 0x5a3f7a, cap: 0x8a4fd8, bala: 0x7f62c9, eye: 0x3b2a4a, lens: 0xff9ee0 },
    // Sivil / doktor (hikâye)
    2: { uni: 0xffd99a, pants: 0x8fa8d8, vest: 0xfffaf3, vest2: 0xe8e4f7, accent: 0x4ecdc4, helmet: 0xffd99a, stripe: 0x4ecdc4, glove: 0xffd3b6, boot: 0x8a6a5a, cap: 0x4ecdc4, bala: 0x8fa8d8, eye: 0x4a2f45 },
  };
  G.TEAM_LOOK = TEAM_LOOK;
  G.TEAM_NAMES = ['Gölge Timi', 'Kızıl Pençe'];
  const SNOW = { uni: 0xf4f8ff, pants: 0xbfe0ff, vest: 0x9ad7ff, vest2: 0x7fc4f0, helmet: 0xf4f8ff, stripe: 0x4cc3ff, glove: 0xfffaf3, boot: 0x8fb0d8, bala: 0xb9dcff };

  // ------------------------------------------------------------------
  // Yüz ve yüzey yardımcıları
  // ------------------------------------------------------------------
  const FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);
  const _n = new THREE.Vector3(), _pt = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _ax = new THREE.Vector3();
  // Kafa küresi üzerinde (x, y) noktasına, yüzey normaline bakan bir parça koy.
  function onHead(B, geo, color, x, y, out, sx, sy, sz, roll, R) {
    R = R || HR;
    const zz = -Math.sqrt(Math.max(0.0001, R * R - x * x - y * y));
    _n.set(x, y, zz).normalize();
    _pt.set(0, HCY, 0).addScaledVector(_n, R + out);
    _qa.setFromUnitVectors(FWD, _n);
    if (roll) _qa.multiply(_qb.setFromAxisAngle(_ax.set(0, 0, 1), roll));
    B.addQ(geo, color, _pt.clone(), _qa.clone(), sx, sy, sz);
  }
  // Kafa çevresinde bir yöne (dx,dy,dz), eksenini (Y) o yöne çevirerek parça koy.
  function alongDir(B, geo, color, dx, dy, dz, dist, sx, sy, sz, cy) {
    _n.set(dx, dy, dz).normalize();
    _pt.set(0, cy != null ? cy : HCY, 0).addScaledVector(_n, dist);
    _qa.setFromUnitVectors(UP, _n);
    B.addQ(geo, color, _pt.clone(), _qa.clone(), sx, sy, sz);
  }
  let _smile = null;
  function smile() {
    if (!_smile) {
      _smile = new THREE.TorusGeometry(0.03, 0.0085, 4, 10, Math.PI);
      _smile.rotateZ(Math.PI);
    }
    return _smile;
  }
  let _bill = null;
  function billGeo() {
    if (!_bill) _bill = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, Math.PI / 2, Math.PI);
    return _bill;
  }
  let _arcBand = null;
  function arcBand() {
    if (!_arcBand) {
      _arcBand = new THREE.TorusGeometry(1, 0.07, 5, 14, Math.PI);
      _arcBand.rotateY(Math.PI / 2);
    }
    return _arcBand;
  }

  // Büyük parlak gözler
  function eyes(B, s, fo) {
    for (const side of [-1, 1]) {
      const ex = side * 0.112, ey = -0.012;
      onHead(B, D(20), WHITE, ex, ey, fo - 0.012, 0.068, 0.084, 0.03);
      onHead(B, D(18), s.eye, ex - side * 0.006, ey - 0.008, fo + 0.002, 0.055, 0.067, 0.024);
      onHead(B, D(16), shade(s.eye, 0.55), ex - side * 0.006, ey - 0.012, fo + 0.01, 0.03, 0.038, 0.015);
      onHead(B, D(12), WHITE, ex + 0.017, ey + 0.024, fo + 0.02, 0.018, 0.021, 0.01);
      onHead(B, D(10), WHITE, ex - 0.014, ey - 0.03, fo + 0.017, 0.009, 0.009, 0.006);
      if (s.lashes) onHead(B, Q.capsule(0.008, 0.026, 6), INK, ex + side * 0.06, ey + 0.05, fo + 0.002, 1, 1, 1, side * -0.9);
      // kaşlar (kararlı ama sevimli)
      if (s.brows !== false) onHead(B, Q.capsule(0.0105, 0.042, 6), s.browCol || INK, side * 0.108, 0.098, fo - 0.002, 1, 1, 0.8, Math.PI / 2 + side * (s.angry ? 0.42 : 0.18));
    }
  }
  function cheeks(B, fo) {
    for (const side of [-1, 1]) onHead(B, D(16), BLUSH, side * 0.172, -0.088, fo - 0.007, 0.048, 0.027, 0.014);
  }

  // ------------------------------------------------------------------
  // Kafa: yüz + başlık + aksesuarlar
  // ------------------------------------------------------------------
  function buildHead(B, Gl, s) {
    const skin = s.skin;
    B.add(Q.cyl(10), skin, 0, 0.03, 0, 0.09, 0.08, 0.09);
    B.add(Q.sphere(20, 16), skin, 0, HCY, 0, HR, HR * 0.95, HR * 0.97);
    const bala = s.face === 'balaclava';
    const fo = 0;
    // kulaklar
    if (!bala && s.head !== 'hazmat') for (const side of [-1, 1]) B.add(Q.sphere(10, 8), skin, side * HR * 0.96, HCY - 0.02, 0.01, 0.045, 0.065, 0.04);
    if (bala) {
      // kar maskesi: üst kubbe + alt yüz örtüsü, arada gözlerin göründüğü şerit
      B.add(Q.hemi(20, 8), s.bala, 0, HCY, 0, HR * 1.04, HR * 1.0, HR * 1.04, 0.3, 0, 0);
      B.add(Q.hemi(20, 8), s.bala, 0, HCY, 0, HR * 1.04, HR * 1.0, HR * 1.04, Math.PI - 0.33, 0, 0);
      B.add(Q.torus(1, 0.06, 5, 22), shade(s.bala, 0.85), 0, HCY, 0, HR * 1.03, HR * 1.03, HR * 1.03, Math.PI / 2 + 0.3, 0, 0);
      // örgü tepe ponponu
      if (s.head === 'none') B.add(Q.sphere(10, 8), s.bala, 0, HCY + HR * 1.02, 0.02, 0.05);
    }
    // ---- yüz ----
    if (s.zombie) zombieFace(B, Gl, s, s.head === 'hazmat' ? 0.065 : fo);
    else if (s.face === 'gasmask') gasmask(B, Gl, s);
    else {
      eyes(B, s, fo);
      cheeks(B, fo);
      if (!bala) {
        onHead(B, Q.sphere(8, 6), shade(skin, 0.9), 0, -0.058, 0.004, 0.022, 0.018, 0.016);
        if (!s.beard) onHead(B, smile(), INK, 0, -0.108, 0.002, 1, 1, 1);
      }
    }
    if (s.glasses) {
      for (const side of [-1, 1]) onHead(B, Q.torus(0.058, 0.009, 5, 16), 0xff6fa8, side * 0.112, -0.012, 0.03, 1, 1, 1);
      onHead(B, Q.capsule(0.007, 0.03, 6), 0xff6fa8, 0, 0.0, 0.03, 1, 1, 1, Math.PI / 2);
    }
    if (s.beard) {
      B.add(Q.sphere(16, 10), s.beard, 0, HCY - 0.17, -0.14, 0.21, 0.12, 0.16);
      B.add(Q.sphere(12, 8), s.beard, 0, HCY - 0.25, -0.15, 0.11, 0.07, 0.1);
      onHead(B, smile(), 0xfff1f0, 0, -0.118, 0.035, 0.9, 0.9, 1);
    }
    if (s.mustache) {
      for (const side of [-1, 1]) {
        onHead(B, Q.capsule(0.022, 0.05, 8), s.mustache, side * 0.038, -0.08, 0.012, 1, 1, 0.7, side * -1.2);
        onHead(B, Q.sphere(8, 6), s.mustache, side * 0.08, -0.07, 0.006, 0.022, 0.022, 0.018);
      }
      if (!s.beard) onHead(B, smile(), INK, 0, -0.12, 0.002, 0.8, 0.8, 1);
    }
    // ---- saç ----
    if (s.hair && !bala && s.head !== 'helmet' && s.head !== 'nvg' && s.head !== 'hazmat') {
      if (s.head !== 'cap' && s.head !== 'beanie') B.add(Q.hemi(18, 8), s.hair, 0, HCY + 0.005, 0.012, HR * 1.045, HR * 1.0, HR * 1.04, 0.62, 0, 0);
      if (s.head !== 'cap' || s.ponytail) for (let i = -2; i <= 2; i++) onHead(B, Q.sphere(10, 8), s.hair, i * 0.06, 0.17 - Math.abs(i) * 0.012, 0.004, 0.06, 0.045, 0.035);
      if (s.ponytail) {
        B.add(Q.sphere(12, 10), s.hair, 0, HCY + 0.02, HR * 0.95, 0.075);
        B.add(Q.capsule(0.06, 0.15, 10), s.hair, 0, HCY - 0.14, HR * 1.03, 1, 1, 1, 0.25, 0, 0);
        B.add(Q.torus(0.05, 0.016, 5, 12), 0xff6fa8, 0, HCY - 0.03, HR * 1.0, 1, 1, 1, Math.PI / 2 + 0.25, 0, 0);
      }
    }
    // ---- başlıklar ----
    const h = s.head;
    if (h === 'helmet' || h === 'nvg') {
      const r = HR * 1.13, tilt = 0.42;
      B.add(Q.hemi(20, 8), s.helmet, 0, HCY + 0.0, 0.0, r, r * 0.97, r, tilt, 0, 0);
      B.add(Q.torus(1, 0.075, 6, 22), shade(s.helmet, 0.9), 0, HCY + 0.0, 0.0, r * 1.0, r * 1.0, r * 1.0, Math.PI / 2 + tilt, 0, 0);
      B.add(arcBand(), s.stripe, 0, HCY, 0, r * 1.01, r * 0.98, r * 1.01, tilt, 0, 0);
      // ön rozet: yıldız/kalp gibi duran küçük top
      alongDir(B, Q.sphere(10, 8), s.stripe, -0.42, 0.72, -0.62, r * 1.0, 0.04, 0.02, 0.04);
      // çene kayışı
      for (const side of [-1, 1]) B.add(Q.capsule(0.012, 0.12, 6), shade(s.helmet, 0.75), side * HR * 0.95, HCY - 0.08, -0.02, 1, 1, 1, 0, 0, side * 0.1);
      if (h === 'nvg') {
        // yukarı kaldırılmış gece görüşü
        alongDir(B, Q.rbox(0.13, 0.06, 0.06, 0.02), 0x4a3a5c, 0, 0.62, -0.78, r * 1.02, 1, 1, 1);
        for (const side of [-1, 1]) {
          _pt.set(side * 0.045, HCY + 0.26, -0.27);
          _qa.setFromUnitVectors(UP, _n.set(0, 0.5, -0.86).normalize());
          B.addQ(Q.cyl(12), 0x4a3a5c, _pt.clone(), _qa.clone(), 0.034, 0.1, 0.034);
          _pt.set(side * 0.045, HCY + 0.26 + 0.5 * 0.05, -0.27 - 0.86 * 0.05);
          Gl.addQ(Q.cyl(12), 0x7dffb0, _pt.clone(), _qa.clone(), 0.028, 0.008, 0.028);
        }
      }
    } else if (h === 'cap') {
      const r = HR * 1.06, tilt = 0.45;
      B.add(Q.hemi(18, 8), s.cap, 0, HCY, 0, r, r * 0.92, r, tilt, 0, 0);
      B.add(Q.sphere(8, 6), s.capTop || s.stripe, 0, HCY + r * 0.86, 0.06, 0.03);
      const by = HCY + r * Math.sin(tilt) - 0.012, bz = -r * Math.cos(tilt) + 0.07;
      B.add(billGeo(), shade(s.cap, 0.88), 0, by, bz, 0.2, 0.022, 0.16, -0.12, 0, 0);
      alongDir(B, Q.sphere(10, 8), s.stripe, 0, 0.65, -0.76, r * 0.98, 0.045, 0.03, 0.045);
      if (s.goggles) {
        B.add(Q.torus(1, 0.04, 5, 22), 0xff6fa8, 0, HCY + 0.03, 0, r * 1.005, r * 1.005, r * 1.005, Math.PI / 2 + tilt + 0.12, 0, 0);
        for (const side of [-1, 1]) {
          _n.set(side * 0.3, 0.52, -0.8).normalize();
          _pt.set(0, HCY, 0).addScaledVector(_n, r * 1.02);
          _qa.setFromUnitVectors(UP, _n);
          B.addQ(Q.torus(1, 0.22, 6, 16), 0xff6fa8, _pt.clone(), _qa.clone().multiply(_qb.setFromAxisAngle(_ax.set(1, 0, 0), Math.PI / 2)), 0.06, 0.06, 0.06);
          B.addQ(Q.cyl(14), 0x9ad7ff, _pt.clone(), _qa.clone(), 0.055, 0.03, 0.055);
          _pt.addScaledVector(_n, 0.017);
          _pt.x += 0.015;
          _pt.y += 0.015;
          B.addQ(Q.sphere(6, 4), WHITE, _pt.clone(), _qa.clone(), 0.013, 0.006, 0.013);
        }
      }
    } else if (h === 'beanie') {
      const r = HR * 1.07, tilt = 0.32;
      B.add(Q.hemi(18, 8), s.beanie, 0, HCY + 0.01, 0, r, r * 1.18, r, tilt, 0, 0);
      B.add(Q.torus(1, 0.13, 6, 22), s.beanieCuff, 0, HCY + 0.012, 0, r * 1.0, r * 1.0, r * 1.0, Math.PI / 2 + tilt, 0, 0);
      B.add(Q.torus(1, 0.05, 5, 22), s.beanieCuff, 0, HCY + 0.012 + r * 0.55, r * 0.17, r * 0.86, r * 0.86, r * 0.86, Math.PI / 2 + tilt, 0, 0);
      alongDir(B, Q.sphere(12, 10), s.beanieCuff, 0, 1, 0.3, r * 1.18 + 0.04, 0.085, 0.08, 0.085, HCY + 0.01);
    } else if (h === 'beret') {
      B.add(Q.sphere(18, 10), s.beret, 0.05, HCY + HR * 0.72, 0.03, HR * 1.12, 0.085, HR * 1.08, 0.18, 0, -0.22);
      B.add(Q.torus(1, 0.09, 5, 22), shade(s.beret, 0.85), 0, HCY + HR * 0.55, 0.02, HR * 0.86, HR * 0.86, HR * 0.86, Math.PI / 2 + 0.2, 0, 0);
      B.add(Q.sphere(8, 6), shade(s.beret, 0.85), 0.1, HCY + HR * 0.78, 0.04, 0.025);
      alongDir(B, Q.sphere(10, 8), 0xffd23f, -0.42, 0.62, -0.66, HR * 1.06, 0.045, 0.014, 0.045);
      alongDir(B, Q.sphere(8, 6), 0xff6fa8, -0.42, 0.62, -0.66, HR * 1.075, 0.02, 0.01, 0.02);
    } else if (h === 'hazmat') {
      B.add(Q.sphere(20, 14), s.uni, 0, HCY + 0.01, 0.01, HR * 1.12, HR * 1.1, HR * 1.12);
      onHead(B, Q.sphere(18, 12), 0xbff0ff, 0, -0.03, 0.025, 0.22, 0.18, 0.03);
      onHead(B, Q.torus(1, 0.1, 5, 22), shade(s.uni, 0.85), 0, -0.03, 0.04, 0.22, 0.18, 0.2);
    } else if (h === 'zhat') {
      B.add(Q.hemi(14, 6), s.zhat, 0.02, HCY + 0.04, 0.0, HR * 0.95, HR * 0.6, HR * 0.95, 0.35, 0, 0.15);
    }
    if (s.earmuffs) for (const side of [-1, 1]) B.add(Q.sphere(12, 10), 0xffffff, side * HR * 1.02, HCY - 0.02, 0.0, 0.07, 0.08, 0.07);
  }

  // Sevimli gaz maskesi (Kızıl Pençe)
  function gasmask(B, Gl, s) {
    const mc = s.mask || 0x6b4fa0;
    onHead(B, Q.sphere(16, 12), mc, 0, -0.1, -0.03, 0.2, 0.15, 0.1);
    // burun filtresi
    onHead(B, Q.sphere(12, 10), shade(mc, 0.9), 0, -0.14, 0.06, 0.08, 0.065, 0.05);
    onHead(B, Q.sphere(10, 8), 0xff8b94, 0, -0.145, 0.1, 0.048, 0.038, 0.02);
    for (const side of [-1, 1]) {
      onHead(B, Q.sphere(12, 10), 0xff8b94, side * 0.16, -0.16, 0.0, 0.06, 0.06, 0.05);
      onHead(B, Q.sphere(8, 6), mix(0xff8b94, 0xffffff, 0.4), side * 0.16, -0.16, 0.035, 0.035, 0.035, 0.02);
      // iri yuvarlak camlar (parlayan), mürdüm çerçeve
      onHead(B, Q.torus(0.066, 0.017, 6, 18), INK, side * 0.112, 0.0, 0.05, 1, 1, 1);
      onHead(Gl, D(20), s.lens || 0xff9ee0, side * 0.112, 0.0, 0.04, 0.064, 0.064, 0.022);
      onHead(Gl, Q.sphere(6, 4), WHITE, side * 0.112 + 0.024, 0.025, 0.062, 0.016, 0.018, 0.01);
    }
    // kayış
    B.add(Q.torus(1, 0.05, 5, 22), INK, 0, HCY + 0.0, 0.0, HR * 1.0, HR * 1.0, HR * 1.0, Math.PI / 2 - 0.25, 0, 0);
  }

  // Şapşal zombi yüzü: spiral/X gözler, dikiş, sargı, dil
  function zombieFace(B, Gl, s, fo) {
    const kinds = s.zEyes;
    const glow = mix(s.eyeColor || 0xffa020, 0xffffff, 0.3);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const ex = side * 0.112, ey = -0.005 + (i ? 0.008 : -0.006);
      const big = i ? 1.08 : 0.94;
      onHead(B, D(20), 0xfffaf3, ex, ey, fo - 0.012, 0.066 * big, 0.074 * big, 0.03);
      if (kinds[i] === 'x') {
        for (const r of [0.78, -0.78]) onHead(Gl, Q.capsule(0.011, 0.06 * big, 6), glow, ex, ey, fo + 0.012, 1, 1, 0.8, r);
      } else {
        onHead(Gl, Q.torus(0.036 * big, 0.008, 4, 16), glow, ex, ey, fo + 0.01, 1, 1, 1);
        onHead(Gl, Q.torus(0.018 * big, 0.008, 4, 12), glow, ex + 0.004, ey + 0.003, fo + 0.012, 1, 1, 1);
        onHead(Gl, Q.sphere(6, 4), glow, ex + 0.007, ey + 0.005, fo + 0.014, 0.007, 0.007, 0.006);
      }
    }
    // ağız: açık oval + dil + diş
    onHead(B, D(16), 0x5d3a5a, 0.02, -0.12, fo - 0.006, 0.05, 0.032, 0.015);
    onHead(B, Q.capsule(0.022, 0.03, 8), 0xff7fa8, 0.035, -0.152, fo + 0.012, 1, 1, 0.6, 0.25);
    onHead(B, Q.rbox(0.018, 0.018, 0.012, 0.005), WHITE, -0.005, -0.1, fo + 0.006, 1, 1, 1);
    // allık (zombiler de tatlı)
    for (const side of [-1, 1]) onHead(B, D(16), 0xff9eb5, side * 0.172, -0.085, fo - 0.007, 0.042, 0.022, 0.012);
    // dikiş
    if (s.stitch) {
      onHead(B, Q.capsule(0.006, 0.12, 4), 0x5d4b7d, -0.13, 0.16, 0.004, 1, 1, 1, 1.25);
      for (let k = 0; k < 4; k++) onHead(B, Q.capsule(0.005, 0.02, 4), 0x5d4b7d, -0.18 + k * 0.035, 0.145 + k * 0.012, 0.006, 1, 1, 1, -0.3);
    }
    // sargı bandı
    if (s.bandage) B.add(Q.torus(1, 0.09, 6, 24), 0xfffaf3, 0, HCY + 0.08, 0.0, HR * 1.0, HR * 1.0, HR * 1.0, Math.PI / 2 + 0.3, 0, 0.25);
    // kaşlar (şaşkın)
    for (const side of [-1, 1]) onHead(B, Q.capsule(0.009, 0.034, 6), 0x5d4b7d, side * 0.11, 0.095 + (side > 0 ? 0.014 : 0), fo - 0.002, 1, 1, 0.8, Math.PI / 2 - side * 0.3);
  }

  // ------------------------------------------------------------------
  // Görünüm tanımı (operatör / takım / zombi)
  // ------------------------------------------------------------------
  function lookSpec(o) {
    const zombie = o.kind === 'zombie';
    const team = o.look != null ? o.look : 0;
    const TL = TEAM_LOOK[team] || TEAM_LOOK[0];
    const op = !zombie && team === 0 && o.operator && G.OPERATORS ? G.OPERATORS[o.operator] : null;
    const s = { zombie, team, op, eye: TL.eye };
    if (zombie) {
      const zv = o.variant || U.pick(['sivil', 'sivil', 'bilim', 'asker', 'hazmat']);
      s.zv = zv;
      s.skin = U.pick([0x86d6a4, 0xa6d85a, 0x7fcdb0, 0xb4e07a, 0x98d6be]);
      const shirt = U.pick([0xffb3c6, 0xa0c4ff, 0xffd6a5, 0xcdb4ff, 0xfdffb6]);
      s.uni = { sivil: shirt, bilim: 0xa0c4ff, asker: 0x9fbf6a, hazmat: 0xffe066 }[zv];
      s.pants = zv === 'hazmat' ? 0xffe066 : zv === 'asker' ? 0x7f9f55 : U.pick([0x7a86b8, 0x8a7aa0, 0x6f8fb0]);
      s.glove = zv === 'hazmat' ? 0x5d4b7d : s.skin;
      s.boot = zv === 'hazmat' ? 0x5d4b7d : U.pick([0x8a6a5a, 0x6a5a8a]);
      s.head = zv === 'asker' ? 'helmet' : zv === 'hazmat' ? 'hazmat' : Math.random() < 0.3 ? 'zhat' : 'none';
      s.helmet = 0x8ecf6a;
      s.stripe = 0xc4ee8a;
      s.zhat = U.pick([0xff8b94, 0x9ad7ff, 0xffb347]);
      s.face = 'none';
      s.hair = s.head === 'none' ? U.pick([0x8a6a5a, 0x5d4b7d, 0xb38a5a]) : null;
      s.coat = zv === 'bilim';
      s.glasses = zv === 'bilim' && Math.random() < 0.6;
      s.eyeColor = o.eyeColor;
      s.zEyes = [Math.random() < 0.5 ? 'x' : 'sp', Math.random() < 0.5 ? 'x' : 'sp'];
      s.stitch = Math.random() < 0.55;
      s.bandage = s.head === 'none' && Math.random() < 0.35;
      s.armBandage = Math.random() < 0.5;
      s.patches = zv === 'sivil';
      return s;
    }
    const snow = op && op.snow;
    const P = snow ? Object.assign({}, TL, SNOW) : TL;
    Object.assign(s, { uni: P.uni, pants: P.pants, vest: P.vest, vest2: P.vest2, accent: TL.accent, helmet: P.helmet, stripe: P.stripe, glove: P.glove, boot: P.boot, cap: TL.cap, bala: P.bala, lens: TL.lens });
    if (op) {
      s.skin = mix(op.skin, 0xffd3b6, 0.3);
      s.head = op.head;
      s.face = op.face;
      if (op.beard) s.beard = mix(op.beard, 0x8a5a44, 0.3);
      if (op.mustache) s.mustache = mix(op.mustache, 0x8a5a44, 0.3);
      if (op.hair) s.hair = mix(op.hair, 0x8a5a44, 0.25);
      if (op.female) {
        s.lashes = true;
        s.ponytail = true;
      }
      if (o.operator === 'asena') {
        s.goggles = true;
        s.cap = 0x2f7fd6;
        s.eye = 0x2f6f8f;
      }
      if (o.operator === 'riza') {
        s.beanie = 0xffb347;
        s.beanieCuff = 0xfffaf3;
        s.hair = 0x6a4a3a;
        s.thermos = true;
      }
      if (o.operator === 'arda') {
        s.beret = 0xd6336c;
        s.hair = 0x4a3a3a;
        s.epaulets = true;
      }
      if (o.operator === 'kurt') s.scarf = 0xffd23f;
      if (o.operator === 'bora') s.bala = 0x2f4f8e;
      if (snow) {
        s.scarf = 0x4cc3ff;
        s.puffy = true;
        s.earmuffs = false;
      }
    } else if (team === 2) {
      // Dr. Elif: önlüklü sivil
      s.skin = 0xffd3b6;
      s.head = 'none';
      s.face = 'none';
      s.hair = 0x6a4a3a;
      s.lashes = true;
      s.ponytail = true;
      s.glasses = true;
      s.coat = true;
      s.civil = true;
    } else {
      s.skin = U.pick([0xffd3b6, 0xf2b48c, 0xe0a07a, 0xffe0c4, 0xc98a62]);
      const ht = team === 1 ? U.pick(G.ENEMY_LOOKS || ['helmet']) : U.pick(['helmet', 'cap']);
      s.face = ht === 'gasmask' ? 'gasmask' : ht === 'balaclava' ? 'balaclava' : team === 1 && Math.random() < 0.35 ? 'balaclava' : 'none';
      s.head = ht === 'gasmask' ? 'cap' : ht === 'balaclava' ? (Math.random() < 0.5 ? 'cap' : 'none') : ht;
      s.angry = team === 1;
      s.hair = U.pick([0x5d4b4a, 0x8a5a44, 0x3b2a3a, 0xc08a5a]);
      if (team === 1 && Math.random() < 0.5) s.scarf = 0xb388ff;
      s.capTop = team === 1 ? 0xff6b6b : 0xffd23f;
    }
    return s;
  }

  // ------------------------------------------------------------------
  // Gövde
  // ------------------------------------------------------------------
  const TORSO_PTS = [[0.001, -0.03], [0.14, -0.02], [0.205, 0.04], [0.228, 0.14], [0.226, 0.26], [0.205, 0.35], [0.155, 0.415], [0.08, 0.445], [0.001, 0.455]];
  const VEST_PTS = [[0.236, 0.1], [0.244, 0.18], [0.24, 0.28], [0.222, 0.35], [0.19, 0.39]];
  const COAT_PTS = [[0.262, -0.09], [0.245, 0.0], [0.24, 0.14], [0.238, 0.26], [0.222, 0.34], [0.19, 0.39]];
  function buildTorso(B0, s) {
    // gövde uzunluğu TY ile ölçeklenir (yalnızca konum ve torna şekilleri)
    const B = {
      add(geo, c, x, y, z, sx, sy, sz, rx, ry, rz) {
        const lathe = geo.type === 'LatheGeometry';
        return B0.add(geo, c, x, y * TY, z, sx, lathe ? (sy != null ? sy : 1) * TY : sy, sz, rx, ry, rz);
      },
    };
    const DZ = 0.8; // gövde derinliği oranı
    B.add(Q.lathe('torso', TORSO_PTS, 16), s.uni, 0, 0, 0, 1, 1, DZ);
    B.add(Q.sphere(14, 10), s.pants, 0, 0.03, 0, 0.205, 0.1, 0.205 * DZ);
    if (s.coat) {
      B.add(Q.lathe('coat', COAT_PTS, 16), 0xfffaf3, 0, 0, 0, 1.0, 1, DZ * 1.02);
      for (let i = 0; i < 3; i++) B.add(Q.sphere(8, 6), s.zombie ? 0xa0c4ff : 0x4ecdc4, 0, 0.3 - i * 0.1, -0.198, 0.016, 0.016, 0.01);
      B.add(Q.rbox(0.07, 0.05, 0.02, 0.008), s.zombie ? 0xa0c4ff : 0xff8fab, 0.12, 0.2, -0.19);
    }
    if (!s.zombie && !s.civil) {
      // yelek + cepler
      B.add(Q.lathe('vest', VEST_PTS, 16), s.vest, 0, 0, 0, 1.02, 1, DZ * 1.04);
      if (s.puffy) for (const y of [0.16, 0.27]) B.add(Q.torus(0.236, 0.022, 5, 20), s.vest2, 0, y, 0, 1, 1, DZ * 1.06, Math.PI / 2, 0, 0);
      for (let i = 0; i < 2; i++) {
        B.add(Q.rbox(0.085, 0.085, 0.05, 0.02), s.vest2, 0.025 + i * 0.1, 0.17, -0.195);
        B.add(Q.rbox(0.088, 0.03, 0.054, 0.012), s.accent, 0.025 + i * 0.1, 0.205, -0.196);
      }
      // sırt çantası
      B.add(Q.rbox(0.3, 0.27, 0.12, 0.05), s.vest2, 0, 0.23, 0.2);
      B.add(Q.rbox(0.3, 0.08, 0.13, 0.03), s.accent, 0, 0.33, 0.205);
      // kemer + toka
      B.add(Q.torus(0.21, 0.026, 5, 20), 0x6a5a8a, 0, 0.065, 0, 1, 1, DZ * 1.04, Math.PI / 2, 0, 0);
      B.add(Q.rbox(0.06, 0.045, 0.02, 0.01), 0xffd23f, 0, 0.065, -0.175);
      // apolet (Arda)
      if (s.epaulets) for (const side of [-1, 1]) B.add(Q.rbox(0.1, 0.03, 0.12, 0.012), 0xffd23f, side * 0.2, 0.39, 0, 1, 1, 1, 0, 0, side * -0.4);
      // termos (Rıza): sırtta
      if (s.thermos) {
        B.add(Q.capsule(0.055, 0.2, 12), 0xb9b0e0, 0.17, 0.3, 0.23, 1, 1, 1, 0, 0, -0.35);
        B.add(Q.cyl(12), 0xff6b6b, 0.21, 0.43, 0.23, 0.06, 0.05, 0.06, 0, 0, -0.35);
        B.add(Q.torus(0.058, 0.01, 4, 14), 0xffd23f, 0.17, 0.3, 0.23, 1, 1, 1, Math.PI / 2, 0.35, 0);
        // göğüste askı
        B.add(Q.rbox(0.035, 0.42, 0.02, 0.01), 0xffb347, -0.02, 0.24, -0.198, 1, 1, 1, 0, 0, -0.75);
      }
    }
    // yaka / atkı
    const collar = s.scarf || (s.zombie ? shade(s.uni, 0.88) : s.civil ? 0xfffaf3 : s.accent);
    B0.add(Q.torus(0.125, s.scarf ? 0.05 : 0.038, 6, 18), collar, 0, NECK - 0.02, 0, 1, 1, 1, Math.PI / 2, 0, 0);
    if (s.scarf) B0.add(Q.capsule(0.035, 0.12, 8), collar, 0.08, NECK - 0.12, -0.17, 1, 1, 0.6, -0.2, 0, 0.3);
    // zombi: yamalar
    if (s.patches) {
      B.add(Q.rbox(0.08, 0.07, 0.02, 0.01), mix(s.uni, 0xffffff, 0.45), -0.09, 0.24, -0.188, 1, 1, 1, 0, 0, 0.2);
      for (let k = 0; k < 3; k++) B.add(Q.capsule(0.004, 0.018, 4), 0x5d4b7d, -0.12 + k * 0.03, 0.24 + k * 0.006, -0.2, 1, 1, 1, 0, 0, 0.2);
    }
  }

  function buildArm(B, s, side) {
    B.add(Q.capsule(0.068, 0.11, 12), s.uni, 0, -0.085, 0);
    if (!s.zombie) B.add(Q.sphere(12, 8), s.civil ? 0xfffaf3 : s.accent, 0, -0.02, 0, 0.082, 0.07, 0.082);
    else if (s.coat) B.add(Q.sphere(12, 8), 0xfffaf3, 0, -0.02, 0, 0.078, 0.07, 0.078);
  }
  function buildForearm(B, s, side) {
    const bare = s.zombie && s.zv !== 'hazmat' && s.zv !== 'bilim';
    B.add(Q.capsule(0.062, 0.1, 12), bare ? s.skin : s.coat ? 0xfffaf3 : s.uni, 0, -0.09, 0);
    if (!s.zombie) B.add(Q.torus(0.058, 0.018, 5, 14), s.civil ? 0xff8fab : s.accent, 0, -0.165, 0, 1, 1, 1, Math.PI / 2, 0, 0);
    if (s.zombie && s.armBandage && side < 0) B.add(Q.torus(0.062, 0.02, 5, 14), 0xfffaf3, 0, -0.1, 0, 1, 1, 1, Math.PI / 2 + 0.3, 0, 0);
    // pati el + başparmak
    B.add(Q.sphere(12, 10), s.glove, 0, -0.225, -0.005, 0.07, 0.068, 0.075);
    B.add(Q.sphere(8, 6), s.glove, -side * 0.05, -0.205, -0.03, 0.03, 0.032, 0.03);
  }
  function buildThigh(B, s) {
    B.add(Q.capsule(0.09, 0.11, 12), s.pants, 0, -0.115, 0);
    if (!s.zombie && !s.civil) B.add(Q.rbox(0.05, 0.07, 0.07, 0.02), s.vest2, -0.075 * s._side, -0.13, -0.01);
  }
  function buildShin(B, s) {
    B.add(Q.capsule(0.078, 0.11, 12), s.pants, 0, -0.1, 0);
    if (!s.zombie && !s.civil) B.add(Q.sphere(10, 8), s.vest2, 0, -0.02, -0.06, 0.065, 0.06, 0.04);
    // yuvarlak bot
    B.add(Q.rbox(0.17, 0.13, 0.25, 0.06), s.boot, 0, -0.29, -0.035);
    B.add(Q.rbox(0.18, 0.03, 0.26, 0.014), shade(s.boot, 0.7), 0, -0.345, -0.035);
    if (s.puffy) B.add(Q.torus(0.08, 0.025, 5, 14), 0xffffff, 0, -0.245, 0, 1, 1, 1, Math.PI / 2, 0, 0);
  }

  const DOWN = new THREE.Vector3(0, -1, 0);
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  // İki kemikli kol IK'sı (gövde uzayında)
  function solveArm(arm, elbow, S, Tg, side, a, b) {
    const D = _v1.copy(Tg).sub(S);
    let d = D.length();
    const dir = D.normalize();
    d = U.clamp(d, 0.05, a + b - 0.002);
    const cosA = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const hint = _v2.set(side * 0.55, -1, 0.4).normalize();
    const perp = hint.sub(_v3.copy(dir).multiplyScalar(hint.dot(dir))).normalize();
    const u = _v3.copy(dir).multiplyScalar(cosA).addScaledVector(perp, sinA).normalize();
    _q1.setFromUnitVectors(DOWN, u);
    arm.quaternion.copy(_q1);
    const E = _v2.copy(S).addScaledVector(u, a);
    const v = E.sub(Tg).multiplyScalar(-1).normalize();
    _q2.setFromUnitVectors(DOWN, v);
    elbow.quaternion.copy(_q1).invert().multiply(_q2);
  }
  // Hedef kol erimi dışındaysa, sağ el tarafına (silah boyunca) kaydır
  const _reach = new THREE.Vector3();
  function clampReach(target, toward, S, reach) {
    if (target.distanceTo(S) <= reach) return target;
    for (let i = 1; i <= 10; i++) {
      _reach.lerpVectors(target, toward, i / 10);
      if (_reach.distanceTo(S) <= reach) return target.copy(_reach);
    }
    return target.copy(toward);
  }

  function segMesh(B, name, parent, shadow) {
    const m = B.mesh(T.vcMat());
    if (!m) return null;
    m.name = name + '-mesh';
    m.castShadow = shadow;
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------
  // Asker / operatör / zombi modeli
  // ------------------------------------------------------------------
  G.makeHumanoid = function (o) {
    LQ = G.state !== 'menu' && G.state != null;
    const s = lookSpec(o);
    const zombie = s.zombie;
    const shadow = G.settings.quality === 'yuksek';
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = HIP;
    root.add(hips);
    const pelvis = new THREE.Group();
    pelvis.name = 'pelvis';
    pelvis.position.y = -DROP;
    hips.add(pelvis);

    // bacaklar
    const legs = [];
    for (const side of [-1, 1]) {
      s._side = side;
      const leg = new THREE.Group();
      leg.name = side < 0 ? 'legL' : 'legR';
      leg.position.set(side * 0.105, 0.02, 0);
      const bt = new T.Builder();
      buildThigh(bt, s);
      segMesh(bt, 'thigh', leg, shadow);
      const knee = new THREE.Group();
      knee.name = 'knee';
      knee.position.y = -0.25;
      const bs = new T.Builder();
      buildShin(bs, s);
      segMesh(bs, 'shin', knee, shadow);
      leg.add(knee);
      pelvis.add(leg);
      legs.push({ leg, knee });
    }
    // gövde
    const torso = new THREE.Group();
    torso.name = 'torso';
    pelvis.add(torso);
    const tb = new T.Builder();
    buildTorso(tb, s);
    // yaka fotoğrafı: altın çerçeveli yuvarlak rozet (göğüs sol üst)
    let photo = null;
    const BX = -0.105, BY = 0.315 * TY, BZ = -0.21;
    if (o.photoTex) {
      tb.add(Q.torus(0.074, 0.016, 8, 24), 0xf4c430, BX, BY, BZ, 1, 1, 1, 0, 0.4, 0);
      tb.add(Q.cyl(20), 0xfffaf3, BX - 0.004, BY, BZ + 0.01, 0.078, 0.016, 0.078, Math.PI / 2, 0, -0.4);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.3;
        tb.add(Q.sphere(6, 4), 0xffd23f, BX + Math.cos(a) * 0.094, BY + Math.sin(a) * 0.094, BZ + 0.004 + Math.cos(a) * 0.036, 0.011);
      }
    }
    segMesh(tb, 'torso', torso, shadow);
    if (o.photoTex) {
      if (!G._photoCircle) G._photoCircle = new THREE.CircleGeometry(0.066, 28);
      photo = new THREE.Mesh(G._photoCircle, new THREE.MeshBasicMaterial({ map: o.photoTex }));
      photo.name = 'photo';
      photo.position.set(BX - 0.002, BY, BZ - 0.007);
      photo.rotation.y = Math.PI + 0.4;
      torso.add(photo);
    }
    // baş
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = NECK;
    torso.add(head);
    const hb = new T.Builder();
    const gb = new T.Builder();
    buildHead(hb, gb, s);
    const hm = segMesh(hb, 'head', head, shadow);
    hm.scale.setScalar(HS);
    if (gb.items.length) {
      const gm = gb.mesh(T.vcBasic());
      gm.name = 'glow';
      gm.scale.setScalar(HS);
      head.add(gm);
    }
    // kollar
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = side < 0 ? 'armL' : 'armR';
      arm.position.set(side * SH.x, SH.y, SH.z);
      const ba = new T.Builder();
      buildArm(ba, s, side);
      segMesh(ba, 'upper', arm, shadow);
      const elbow = new THREE.Group();
      elbow.name = 'elbow';
      elbow.position.y = -UA;
      const be = new T.Builder();
      buildForearm(be, s, side);
      segMesh(be, 'fore', elbow, shadow);
      arm.add(elbow);
      torso.add(arm);
      arms.push({ arm, elbow, side, S: new THREE.Vector3(side * SH.x, SH.y, SH.z) });
    }
    // silah
    let gun = null;
    if (o.weapon) {
      gun = G.buildGun(o.weapon, { merge: true, shadow, lo: LQ });
      gun.name = 'gun';
      gun.scale.setScalar(GUN.s);
      gun.position.set(GUN.x, GUN.y, GUN.z);
      torso.add(gun);
    }
    if (o.tag) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.tag, depthTest: false, transparent: true }));
      sp.scale.set(o.tagW || 0.35, o.tagH || 0.35, 1);
      sp.position.y = 2.15;
      sp.renderOrder = 10;
      sp.name = 'tag';
      root.add(sp);
      root.userData.tag = sp;
    }

    const tmpT = new THREE.Vector3(), tmpR = new THREE.Vector3();
    const REACH = UA + FA - 0.01;
    return {
      root, hips, pelvis, torso, head, legs, arms, gun, zombie, photo,
      legL: legs[0].leg, legR: legs[1].leg, armL: arms[0].arm, armR: arms[1].arm,
      phase: Math.random() * 6,
      deathT: 0,
      deathDir: 1,
      deathType: Math.floor(Math.random() * 3),
      kick: 0,
      wob: Math.random() * 6,
      popHead() {
        if (!this.head.visible) return;
        this.head.visible = false;
        const p = this.head.getWorldPosition(new THREE.Vector3());
        p.y += 0.2;
        // kan yok: nane yeşili konfeti/pırıltı
        G.fx.blood(p.x, p.y, p.z, 0, 1, 0, 3.5, [0.62, 0.95, 0.72]);
      },
      animate(dt, st) {
        const L0 = this.legs[0], L1 = this.legs[1];
        const pel = this.pelvis;
        if (st.dead) {
          this.deathT += dt;
          const t = this.deathT;
          const k = U.clamp(t / 0.5, 0, 1);
          const e = 1 - Math.pow(1 - k, 3);
          // yere değince küçük sekme
          const bounce = t > 0.45 && t < 0.85 ? Math.sin(((t - 0.45) / 0.4) * Math.PI) * 0.07 : 0;
          this.torso.scale.set(1, 1, 1);
          if (this.deathType === 2) {
            const k1 = U.clamp(t / 0.25, 0, 1);
            pel.position.y = -DROP - k1 * 0.3 - e * 0.18 + bounce;
            L0.leg.rotation.x = L1.leg.rotation.x = k1 * 1.2;
            L0.knee.rotation.x = L1.knee.rotation.x = -k1 * 2.0;
            this.root.rotation.z = U.clamp((t - 0.2) / 0.4, 0, 1) * 1.4 * this.deathDir;
          } else {
            const dir = this.deathType === 0 ? 1 : -1;
            this.root.rotation.x = dir * (e * 1.45 - bounce * 1.2);
            pel.position.y = -DROP - e * 0.1;
            L0.knee.rotation.x = -e * 0.4;
            L1.leg.rotation.x = e * 0.5;
          }
          for (const a of this.arms) {
            a.arm.quaternion.identity();
            a.arm.rotation.x = -e * 2.4;
            a.arm.rotation.z = a.side * e * 0.7;
            a.elbow.quaternion.identity();
          }
          this.head.rotation.z = e * 0.3 * this.deathDir;
          if (this.gun) this.gun.rotation.z = e * 1.2;
          if (t > 3.2) this.root.position.y = -(t - 3.2) * 0.5;
          return;
        }
        this.root.rotation.x = 0;
        this.root.rotation.z = 0;
        const sp = st.speed || 0;
        this.phase += dt * (2.6 + sp * 1.55);
        const amp = Math.min(1, sp / 4.5) * (this.zombie ? 0.55 : 0.75);
        const s = Math.sin(this.phase);
        const hop = Math.abs(Math.cos(this.phase));
        const c = st.crouch || 0;
        // zıplayan yürüyüş: her adımda yukarı sekme + gövde esnemesi
        pel.position.y = -DROP - c * 0.24 + hop * amp * 0.07;
        const breath = Math.sin(G.time * 2.2 + this.wob) * 0.012 * (1 - Math.min(1, sp / 2));
        const sq = (hop - 0.6) * amp * 0.09 + breath;
        this.torso.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
        L0.leg.rotation.x = s * amp * 0.9 + c * 1.15;
        L1.leg.rotation.x = -s * amp * 0.9 + c * 0.75;
        L0.knee.rotation.x = -Math.max(0, -Math.cos(this.phase)) * amp * 1.3 - c * 1.85;
        L1.knee.rotation.x = -Math.max(0, Math.cos(this.phase)) * amp * 1.3 - c * 1.4;
        const run = sp > 5.5;
        this.kick = U.damp(this.kick, 0, 14, dt);
        this.torso.rotation.x = c * 0.2 + (run ? 0.16 : 0) + (this.zombie ? 0.3 : 0) - this.kick * 0.15;
        const pitch = st.pitch || 0;
        this.head.position.y = NECK + (1 - hop) * amp * 0.018;
        this.head.rotation.x = -pitch * 0.5 - (this.zombie ? 0.18 : 0) + s * amp * 0.05;
        if (this.zombie) {
          // şapşal sallanma
          this.wob += dt * (1.6 + sp * 0.5);
          this.torso.rotation.y = Math.sin(this.phase * 0.5) * 0.14;
          this.torso.rotation.z = Math.sin(this.wob) * 0.1;
          this.head.rotation.z = Math.sin(this.wob * 1.3 + 1) * 0.22;
          const atk = st.attack || 0;
          for (const a of this.arms) {
            const reach = tmpT.set(a.side * 0.16 + Math.sin(this.phase * 0.5 + a.side) * 0.05, 0.3 - atk * 0.16 + a.side * 0.03 + Math.sin(this.wob * 2 + a.side) * 0.03, -0.38 - atk * 0.06);
            solveArm(a.arm, a.elbow, a.S, reach, a.side, UA, FA);
          }
          if (st.rise != null) this.root.position.y = (st.rise - 1) * 1.7;
          return;
        }
        this.torso.rotation.y = 0;
        this.torso.rotation.z = Math.sin(this.phase) * amp * 0.05;
        this.head.rotation.z = -Math.sin(this.phase) * amp * 0.06;
        // silah tutuşu
        const g = this.gun;
        if (g) {
          const reloading = !!st.reload;
          g.position.set(GUN.x, run ? GUN.y - 0.06 : GUN.y, run ? GUN.z + 0.05 : GUN.z);
          g.rotation.set(run ? 0.7 : -pitch * 0.9 + this.kick * 0.3, run ? 0.5 : 0, reloading ? 0.5 : 0);
          this.torso.updateMatrixWorld(true);
          const P = g.userData.parts;
          P.rightHand.getWorldPosition(tmpR);
          this.torso.worldToLocal(tmpR);
          for (const a of this.arms) {
            if (a.side > 0) tmpT.copy(tmpR);
            else {
              const anchor = reloading && P.mag ? P.mag : P.leftHand;
              anchor.getWorldPosition(tmpT);
              this.torso.worldToLocal(tmpT);
              if (reloading) tmpT.y -= 0.05 + Math.sin(G.time * 8) * 0.03;
              clampReach(tmpT, tmpR, a.S, REACH);
            }
            solveArm(a.arm, a.elbow, a.S, tmpT, a.side, UA, FA);
          }
        } else {
          for (const a of this.arms) {
            a.arm.quaternion.identity();
            a.arm.rotation.x = -s * amp * 0.7 * a.side;
            a.arm.rotation.z = a.side * 0.18;
            a.elbow.quaternion.identity();
            a.elbow.rotation.x = -0.35;
          }
        }
      },
    };
  };

  // ------------------------------------------------------------------
  // Zombi yavru köpek
  // ------------------------------------------------------------------
  G.makeDog = function () {
    LQ = G.state !== 'menu' && G.state != null;
    const shadow = G.settings.quality === 'yuksek';
    const fur = U.pick([0xa898d0, 0xb7a0dc, 0x98b4dc]);
    const patch = U.pick([0x9ee6b8, 0xc4ee8a]);
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 0.5;
    root.add(body);
    const bb = new T.Builder();
    bb.add(Q.sphere(16, 12), fur, 0, 0.02, 0.02, 0.24, 0.22, 0.38);
    bb.add(Q.sphere(12, 8), patch, 0.1, 0.12, 0.1, 0.12, 0.08, 0.14);
    bb.add(Q.sphere(10, 8), fur, 0, 0.02, -0.22, 0.2, 0.18, 0.18);
    // tasma + kemik künye
    bb.add(Q.torus(0.14, 0.03, 5, 16), 0xff6fa8, 0, 0.1, -0.33, 1, 1, 1, 0.5, 0, 0);
    bb.add(Q.capsule(0.014, 0.04, 6), 0xffd23f, 0, 0.0, -0.43, 1, 1, 1, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) bb.add(Q.sphere(6, 4), 0xffd23f, sx * 0.03, 0.0, -0.43, 0.016);
    // dikiş
    for (let k = 0; k < 4; k++) bb.add(Q.capsule(0.005, 0.03, 4), 0x5d4b7d, -0.14 - k * 0.006, 0.12 - k * 0.04, 0.05 + k * 0.03, 1, 1, 1, 0.5, 0, 0.9);
    const bm = bb.mesh(T.vcMat());
    bm.castShadow = shadow;
    body.add(bm);
    const head = new THREE.Group();
    head.position.set(0, 0.24, -0.42);
    body.add(head);
    const hb = new T.Builder();
    const gb = new T.Builder();
    hb.add(Q.sphere(16, 12), fur, 0, 0.04, 0, 0.21, 0.19, 0.2);
    hb.add(Q.sphere(12, 10), 0xfffaf3, 0, -0.04, -0.17, 0.11, 0.08, 0.1);
    hb.add(Q.sphere(10, 8), 0x3b2a4a, 0, -0.01, -0.265, 0.035, 0.026, 0.024);
    hb.add(Q.capsule(0.03, 0.04, 8), 0xff7fa8, 0.02, -0.11, -0.22, 1, 1, 0.5, 0.4, 0, 0.15);
    // sarkık kulaklar
    for (const sx of [-1, 1]) hb.add(Q.sphere(12, 8), shade(fur, 0.85), sx * 0.19, 0.0, 0.02, 0.05, 0.13, 0.08, 0, 0, sx * 0.35);
    // gözler: biri iri parlak, biri X (zombi)
    hb.add(D(18), WHITE, -0.085, 0.07, -0.165, 0.055, 0.06, 0.03);
    hb.add(D(16), 0x4a2f45, -0.085, 0.065, -0.185, 0.04, 0.046, 0.02);
    hb.add(Q.sphere(6, 4), WHITE, -0.07, 0.085, -0.2, 0.013, 0.015, 0.008);
    hb.add(D(18), WHITE, 0.085, 0.07, -0.165, 0.05, 0.055, 0.03);
    for (const r of [0.78, -0.78]) gb.add(Q.capsule(0.01, 0.05, 6), 0xffb070, 0.085, 0.07, -0.19, 1, 1, 0.8, 0, 0, r);
    for (const sx of [-1, 1]) hb.add(Q.sphere(8, 6), BLUSH, sx * 0.13, -0.02, -0.15, 0.035, 0.02, 0.012);
    const hm = hb.mesh(T.vcMat());
    hm.castShadow = shadow;
    head.add(hm);
    head.add(gb.mesh(T.vcBasic()));
    const legs = [];
    for (const [x, z] of [[-0.12, -0.24], [0.12, -0.24], [-0.12, 0.26], [0.12, 0.26]]) {
      const l = new THREE.Group();
      l.position.set(x, -0.08, z);
      const lb = new T.Builder();
      lb.add(Q.capsule(0.06, 0.2, 10), fur, 0, -0.16, 0);
      lb.add(Q.sphere(10, 8), 0xfffaf3, 0, -0.31, -0.02, 0.07, 0.05, 0.08);
      const lm = lb.mesh(T.vcMat());
      lm.castShadow = shadow;
      l.add(lm);
      body.add(l);
      legs.push(l);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.14, 0.36);
    const tbb = new T.Builder();
    tbb.add(Q.capsule(0.035, 0.14, 8), fur, 0, 0.08, 0.03, 1, 1, 1, -0.5, 0, 0);
    tbb.add(Q.sphere(8, 6), patch, 0, 0.16, 0.07, 0.045);
    tail.add(tbb.mesh(T.vcMat()));
    body.add(tail);
    return {
      root, body, head, legs, tail, phase: Math.random() * 6, deathT: 0,
      animate(dt, st) {
        if (st.dead) {
          this.deathT += dt;
          const k = U.clamp(this.deathT / 0.35, 0, 1);
          const b = this.deathT > 0.3 && this.deathT < 0.6 ? Math.sin(((this.deathT - 0.3) / 0.3) * Math.PI) * 0.06 : 0;
          this.body.rotation.z = k * 1.5;
          this.body.position.y = 0.5 - k * 0.28 + b;
          for (const l of this.legs) l.rotation.x = k * 0.5;
          if (this.deathT > 2.5) this.root.position.y = -(this.deathT - 2.5) * 0.5;
          return;
        }
        const sp = st.speed || 0;
        this.phase += dt * (3 + sp * 1.8);
        const a = Math.min(1, sp / 5);
        const s = Math.sin(this.phase) * a * 0.85;
        this.legs[0].rotation.x = s;
        this.legs[3].rotation.x = s;
        this.legs[1].rotation.x = -s;
        this.legs[2].rotation.x = -s;
        this.body.position.y = 0.5 + Math.abs(Math.cos(this.phase)) * 0.07 * (0.3 + a);
        this.body.rotation.x = Math.sin(this.phase * 2) * 0.05 * a;
        this.head.rotation.x = (st.attack || 0) * -0.5 + Math.sin(this.phase * 2) * 0.06;
        this.head.rotation.z = Math.sin(this.phase * 0.7) * 0.12;
        this.tail.rotation.y = Math.sin(G.time * 14 + this.phase) * 0.6;
      },
    };
  };

  // ------------------------------------------------------------------
  // Ortak karakter
  // ------------------------------------------------------------------
  let nextId = 1;
  const tmpV = new THREE.Vector3();

  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const lx = cx - ox, ly = cy - oy, lz = cz - oz;
    const tc = lx * dx + ly * dy + lz * dz;
    if (tc < 0) return -1;
    const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
    if (d2 > r * r) return -1;
    return tc - Math.sqrt(r * r - d2);
  }
  function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = -Infinity, tmax = Infinity;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) return -1;
      } else {
        let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (tmax < 0) return -1;
    return tmin >= 0 ? tmin : 0;
  }
  G.raySphere = raySphere;
  G.rayBox = rayBox;

  class Character {
    constructor(o) {
      this.id = nextId++;
      this.team = o.team != null ? o.team : 0;
      this.name = o.name || 'Asker';
      this.kind = o.kind || 'soldier';
      this.isPlayer = !!o.isPlayer;
      this.pos = new THREE.Vector3();
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.radius = 0.35;
      this.height = 1.8;
      this.stance = 'stand';
      this.crouchT = 0;
      this.maxHealth = o.health || 150;
      this.health = this.maxHealth;
      this.alive = true;
      this.grounded = true;
      this.lastHurt = -99;
      this.damageLog = [];
      this.kills = 0;
      this.deaths = 0;
      this.assists = 0;
      this.score = 0;
      this.streak = 0;
      this.model = null;
      this.diedAt = 0;
      this.spotted = 0; // haritada görünür olduğu süre sonu
      this.stunUntil = 0;
    }
    get forwardX() {
      return -Math.sin(this.yaw);
    }
    get forwardZ() {
      return -Math.cos(this.yaw);
    }
    eyeHeight() {
      if (this.stance === 'prone') return 0.42;
      return U.lerp(1.62, 1.12, this.crouchT);
    }
    eye(out) {
      return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z);
    }
    chest(out) {
      const h = this.stance === 'prone' ? 0.3 : this.kind === 'dog' ? 0.6 : U.lerp(1.25, 0.85, this.crouchT);
      return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + h, this.pos.z);
    }
    headPos(out) {
      const o = out || new THREE.Vector3();
      if (this.kind === 'dog') return o.set(this.pos.x + this.forwardX * 0.6, this.pos.y + 0.78, this.pos.z + this.forwardZ * 0.6);
      if (this.stance === 'prone') return o.set(this.pos.x + this.forwardX * 0.7, this.pos.y + 0.33, this.pos.z + this.forwardZ * 0.7);
      const fwd = this.kind === 'zombie' ? 0.12 : 0;
      return o.set(this.pos.x + this.forwardX * fwd, this.pos.y + U.lerp(1.63, 1.13, this.crouchT), this.pos.z + this.forwardZ * fwd);
    }
    // Işın-karakter isabeti
    hitTest(ox, oy, oz, dx, dy, dz, maxT) {
      if (!this.alive) return null;
      const p = this.pos;
      // kaba eleme
      const lx = p.x - ox, lz = p.z - oz;
      const tc = lx * dx + lz * dz;
      if (tc < -1.5 || tc > maxT + 1.5) return null;
      const h = this.headPos(tmpV);
      const th = raySphere(ox, oy, oz, dx, dy, dz, h.x, h.y, h.z, this.kind === 'dog' ? 0.2 : 0.16);
      let best = th >= 0 && th < maxT ? th : Infinity;
      let part = best < Infinity ? 'head' : null;
      let tb;
      if (this.kind === 'dog') {
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.35, p.y + 0.3, p.z - 0.35, p.x + 0.35, p.y + 0.85, p.z + 0.35);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
      } else if (this.stance === 'prone') {
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.5, p.y, p.z - 0.5, p.x + 0.5, p.y + 0.45, p.z + 0.5);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
      } else {
        const c = this.crouchT;
        const by0 = U.lerp(0.85, 0.55, c), by1 = U.lerp(1.5, 1.0, c);
        tb = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.26, p.y + by0, p.z - 0.26, p.x + 0.26, p.y + by1, p.z + 0.26);
        if (tb >= 0 && tb < best && tb < maxT) {
          best = tb;
          part = 'body';
        }
        const tl = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.22, p.y, p.z - 0.22, p.x + 0.22, p.y + by0, p.z + 0.22);
        if (tl >= 0 && tl < best && tl < maxT) {
          best = tl;
          part = 'legs';
        }
      }
      if (!part) return null;
      return { t: best, part };
    }
    takeDamage(amount, attacker, info) {
      if (!this.alive || amount <= 0) return false;
      const game = G.game;
      if (game && game.modifyDamage) amount = game.modifyDamage(this, attacker, amount, info || {});
      if (amount <= 0) return false;
      this.health -= amount;
      this.lastHurt = G.time;
      if (attacker && attacker !== this) {
        this.damageLog.push({ by: attacker, t: G.time, amount });
        if (this.damageLog.length > 8) this.damageLog.shift();
      }
      if (this.onHurt) this.onHurt(amount, attacker, info || {});
      if (game && game.onDamage) game.onDamage(this, attacker, amount, info || {});
      if (this.health <= 0) {
        this.health = 0;
        this.die(attacker, info || {});
        return true;
      }
      return false;
    }
    die(attacker, info) {
      if (!this.alive) return;
      this.alive = false;
      this.diedAt = G.time;
      this.deaths++;
      if (this.model) this.model.deathDir = info && info.dirSign ? info.dirSign : Math.random() < 0.5 ? 1 : -1;
      if (this.onDeath) this.onDeath(attacker, info);
      if (G.game && G.game.onKill) G.game.onKill(this, attacker, info || {});
    }
    regen(dt, delay, rate) {
      if (this.alive && this.health < this.maxHealth && G.time - this.lastHurt > delay) {
        this.health = Math.min(this.maxHealth, this.health + rate * dt);
      }
    }
  }
  G.Character = Character;
})();
