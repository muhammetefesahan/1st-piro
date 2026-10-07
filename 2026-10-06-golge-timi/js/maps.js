'use strict';
// Gölge Timi — harita tanımları. Haritalar küçük bir "boyacı" ile çizilir:
// her hücre 2x2 metredir. Karakterler geometriyi, noktalar (doğma, bayrak,
// makine vb.) ayrı listede tutulur.
//
// Hücre sözlüğü:
//  '#' çevre duvarı 6m     'H' bina duvarı 4.8m   '=' pencereli duvar
//  'd' kapı boşluğu         ',' iç zemin (çatılı)  '.' açık zemin
//  'c' sandık 1.1m          'C' iki kat sandık     'K' konteyner 2.6m
//  'w' kum torbası 1m       'h' alçak beton 1.2m   'x' sütun
//  'b' patlayıcı varil      'v' araç enkazı        'T' ağaç
//  'L' sokak lambası        'r' korkuluk           '1'-'4' zombi kapıları
(function (root) {
  const G = (root.G = root.G || {});

  class Painter {
    constructor(w, h, fill) {
      this.w = w;
      this.h = h;
      this.g = [];
      for (let z = 0; z < h; z++) this.g.push(new Array(w).fill(fill));
      this.points = {};
    }
    put(x, z, ch) {
      if (x >= 0 && z >= 0 && x < this.w && z < this.h) this.g[z][x] = ch;
      return this;
    }
    rect(x0, z0, x1, z1, ch) {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.put(x, z, ch);
      return this;
    }
    border(ch) {
      for (let x = 0; x < this.w; x++) {
        this.put(x, 0, ch);
        this.put(x, this.h - 1, ch);
      }
      for (let z = 0; z < this.h; z++) {
        this.put(0, z, ch);
        this.put(this.w - 1, z, ch);
      }
      return this;
    }
    // Duvarları çevrede, içi zemin olan oda
    room(x0, z0, x1, z1, floor, wall) {
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          this.put(x, z, edge ? wall : floor);
        }
      return this;
    }
    mark(type, x, z, extra) {
      (this.points[type] = this.points[type] || []).push(Object.assign({ x, z }, extra || {}));
      return this;
    }
    rows() {
      return this.g.map((r) => r.join(''));
    }
  }
  G.Painter = Painter;

  // ------------------------------------------------------------------
  // LİMAN — gün batımında konteyner limanı
  // ------------------------------------------------------------------
  function liman() {
    const m = new Painter(34, 30, '.');
    m.border('#');
    m.rect(1, 29, 32, 29, 'r');
    // Kuzey konteyner sahası
    m.rect(7, 1, 10, 2, 'K');
    m.rect(23, 1, 26, 2, 'K');
    m.rect(10, 4, 11, 7, 'K');
    m.rect(22, 4, 23, 7, 'K');
    m.rect(14, 5, 15, 5, 'w');
    m.rect(18, 5, 19, 5, 'w');
    m.rect(4, 3, 5, 4, 'C');
    m.rect(28, 3, 29, 4, 'C');
    m.put(16, 2, 'c').put(17, 2, 'c');
    m.put(3, 7, 'w').put(30, 7, 'w');
    // Orta depo
    m.room(11, 10, 22, 19, ',', 'H');
    m.put(11, 13, 'd').put(11, 16, 'd').put(22, 13, 'd').put(22, 16, 'd');
    m.put(16, 10, 'd').put(17, 19, 'd');
    m.put(13, 10, '=').put(20, 10, '=').put(13, 19, '=').put(20, 19, '=');
    m.put(11, 14, '=').put(22, 15, '=');
    m.put(14, 13, 'C').put(19, 16, 'C').put(14, 16, 'c').put(19, 13, 'c');
    m.rect(16, 14, 17, 15, 'h');
    // Batı / doğu kanatlar
    m.rect(5, 11, 6, 13, 'K');
    m.rect(27, 16, 28, 18, 'K');
    m.put(3, 16, 'c').put(4, 16, 'c').put(30, 12, 'c').put(29, 12, 'c');
    m.put(7, 17, 'C').put(26, 11, 'C');
    m.rect(8, 15, 8, 16, 'w').rect(25, 13, 25, 14, 'w');
    m.put(8, 9, 'b').put(25, 9, 'b');
    // Güney rıhtım
    m.rect(6, 21, 7, 21, 'v');
    m.rect(26, 21, 27, 21, 'v');
    m.rect(3, 23, 4, 24, 'C');
    m.rect(29, 23, 30, 24, 'C');
    m.rect(9, 24, 11, 24, 'c');
    m.rect(22, 24, 24, 24, 'c');
    m.rect(13, 22, 14, 22, 'w').rect(19, 22, 20, 22, 'w');
    m.rect(14, 26, 19, 27, 'K');
    m.put(12, 21, 'b').put(21, 21, 'b').put(16, 24, 'b');
    m.put(5, 27, 'L').put(28, 27, 'L').put(16, 21, 'L');
    m.put(2, 20, 'T').put(31, 20, 'T');
    // Doğma noktaları
    for (const z of [3, 5, 7, 12, 14, 16, 18, 22, 24, 26]) {
      if (m.g[z][1] === '.') m.mark('A', 1, z);
      if (m.g[z][2] === '.') m.mark('A', 2, z);
      if (m.g[z][32] === '.') m.mark('B', 32, z);
      if (m.g[z][31] === '.') m.mark('B', 31, z);
    }
    m.mark('flag', 16, 3, { id: 'A' });
    m.mark('flag', 16, 12, { id: 'B' });
    m.mark('flag', 16, 23, { id: 'C' });
    return {
      id: 'liman',
      name: 'Liman',
      desc: 'Gün batımında konteyner limanı. Ortadaki depo kilit nokta.',
      kind: 'mp',
      rows: m.rows(),
      points: m.points,
      theme: {
        // şeker renkli gün batımı limanı: mor-mavi gök, şeftali ufuk, pembe-lila gölgeler
        skyTop: 0x7a7cff, skyHorizon: 0xffb38a, skyBottom: 0xffc9a8,
        fog: 0xffc4b0, fogNear: 45, fogFar: 200,
        sun: 0xffead2, sunIntensity: 0.28, sunDir: [-0.72, 0.5, 0.18], sunSize: 0.08, sunDisk: 0xfff4d6,
        hemiSky: 0xf0e8ff, hemiGround: 0xead8ea, hemiIntensity: 0.84,
        ground: 'asfalt', wall: 'beton', building: 'tugla', indoor: 'karo',
        wallColors: [0xffd3b6, 0xffe4c8], buildingColors: [0xffaaa5, 0xffd3b6, 0x9ad7ff, 0xcdb4ff], roofColors: [0xff8b94, 0x4ecdc4, 0xffb347],
        coverColor: 0xfff1a8, railColor: 0x4ecdc4, poleColor: 0x8a78c0,
        waterShallow: 0x6fe3d6, waterDeep: 0x3fb2d8, cloudColor: 0xfff0f4,
        exposure: 1.0, sea: 'south', decor: 'cranes', clouds: 0.6,
        grade: { sat: 1.12, con: 1.04, tint: 0xfff6f2, lift: 0x1e1030, bloom: 0.3, bloomThreshold: 0.88, vig: 0.26 },
      },
    };
  }

  // ------------------------------------------------------------------
  // ÇÖL KASABASI — öğle güneşi, dar sokaklar ve avlular
  // ------------------------------------------------------------------
  function col() {
    const m = new Painter(34, 32, '.');
    m.border('#');
    // Kuzeybatı ev
    m.room(3, 2, 10, 7, ',', 'H');
    m.put(6, 7, 'd').put(10, 4, 'd').put(3, 5, '=').put(8, 2, '=').put(8, 7, '=');
    m.put(4, 3, 'c');
    // Kuzeydoğu ev
    m.room(23, 2, 30, 7, ',', 'H');
    m.put(27, 7, 'd').put(23, 4, 'd').put(30, 5, '=').put(25, 2, '=').put(25, 7, '=');
    m.put(29, 3, 'c');
    // Merkez çeşme meydanı
    m.rect(15, 9, 18, 9, 'h').rect(15, 12, 18, 12, 'h');
    m.put(15, 10, 'h').put(15, 11, 'h').put(18, 10, 'h').put(18, 11, 'h');
    m.rect(16, 10, 17, 11, 'C');
    m.put(13, 8, 'T').put(20, 8, 'T').put(13, 13, 'T').put(20, 13, 'T');
    // Pazar tezgâhları
    m.put(12, 3, 'c').put(13, 3, 'c').put(20, 3, 'c').put(21, 3, 'c');
    m.put(16, 5, 'w').put(17, 5, 'w');
    // Batı ve doğu küçük evler
    m.room(2, 11, 8, 16, ',', 'H');
    m.put(8, 13, 'd').put(5, 16, 'd').put(2, 13, '=').put(5, 11, '=');
    m.room(25, 11, 31, 16, ',', 'H');
    m.put(25, 14, 'd').put(28, 16, 'd').put(31, 14, '=').put(28, 11, '=');
    // Güney büyük konak (orta)
    m.room(11, 17, 22, 25, ',', 'H');
    m.put(11, 20, 'd').put(22, 22, 'd').put(16, 17, 'd').put(17, 25, 'd');
    m.put(13, 17, '=').put(20, 17, '=').put(11, 23, '=').put(22, 19, '=').put(14, 25, '=').put(20, 25, '=');
    m.rect(15, 20, 18, 20, 'h');
    m.put(13, 23, 'c').put(20, 23, 'C').put(13, 19, 'x').put(20, 21, 'x');
    // Güneybatı / güneydoğu
    m.room(2, 21, 7, 28, ',', 'H');
    m.put(7, 24, 'd').put(4, 21, 'd').put(2, 25, '=').put(5, 28, '=');
    m.room(26, 21, 31, 28, ',', 'H');
    m.put(26, 25, 'd').put(29, 21, 'd').put(31, 24, '=').put(28, 28, '=');
    // Sokak siperleri
    m.rect(9, 9, 10, 9, 'v').rect(23, 9, 24, 9, 'v');
    m.put(10, 15, 'w').put(10, 16, 'w').put(23, 15, 'w').put(23, 16, 'w');
    m.put(9, 27, 'c').put(9, 28, 'C').put(24, 27, 'c').put(24, 28, 'C');
    m.put(12, 28, 'b').put(21, 28, 'b').put(12, 10, 'b').put(21, 11, 'b');
    m.rect(14, 28, 15, 29, 'w').rect(18, 28, 19, 29, 'w');
    m.put(1, 9, 'T').put(32, 9, 'T').put(1, 19, 'T').put(32, 19, 'T');
    // Doğma
    for (let x = 2; x <= 31; x++) {
      if (m.g[1][x] === '.' && (x < 12 || x > 21)) m.mark('A', x, 1);
      if (m.g[30][x] === '.' && (x < 12 || x > 21)) m.mark('B', x, 30);
    }
    m.mark('flag', 6, 9, { id: 'A' });
    m.mark('flag', 16, 14, { id: 'B' });
    m.mark('flag', 27, 9, { id: 'C' });
    return {
      id: 'col',
      name: 'Çöl Kasabası',
      desc: 'Dar sokaklar, avlular ve iç mekân çatışmaları.',
      kind: 'mp',
      rows: m.rows(),
      points: m.points,
      theme: {
        // güneşli çöl kasabası: gök mavisi, şeftali/pembe kerpiç evler, tereyağı kum
        skyTop: 0x5fb8ff, skyHorizon: 0xbfe9ff, skyBottom: 0xffe2b0,
        fog: 0xf4ecdc, fogNear: 55, fogFar: 230,
        sun: 0xfff3dc, sunIntensity: 0.28, sunDir: [0.35, 0.85, 0.3], sunSize: 0.07,
        hemiSky: 0xeeeeff, hemiGround: 0xf6dcd4, hemiIntensity: 0.84,
        ground: 'kum', wall: 'siva', building: 'siva', indoor: 'karo',
        wallColors: [0xffd9b8, 0xffe8cc], buildingColors: [0xffc8dd, 0xffd3b6, 0xa8e6cf, 0xffaaa5, 0x9ad7ff, 0xffe0c2], roofColors: [0xff8b94, 0xffb347, 0x4ecdc4],
        coverColor: 0xffe0c2, cloudColor: 0xffffff,
        exposure: 1.0, decor: 'dunes', palms: true, clouds: 0.4,
        grade: { sat: 1.1, con: 1.04, tint: 0xfffaf2, lift: 0x180c1a, bloom: 0.25, bloomThreshold: 0.9, vig: 0.24 },
      },
    };
  }

  // ------------------------------------------------------------------
  // GECE ÜSSÜ — yağmurlu askeri üs, gece
  // ------------------------------------------------------------------
  function us() {
    const m = new Painter(36, 30, '.');
    m.border('#');
    // Hangar (orta-kuzey)
    m.room(12, 3, 23, 11, ',', 'H');
    m.put(12, 6, 'd').put(12, 8, 'd').put(23, 6, 'd').put(23, 8, 'd');
    m.rect(16, 11, 19, 11, 'd');
    m.put(14, 3, '=').put(21, 3, '=');
    m.rect(15, 6, 16, 7, 'v');
    m.put(20, 5, 'C').put(20, 9, 'c').put(14, 9, 'c');
    // Kuleler / sığınaklar
    m.room(3, 3, 8, 8, ',', 'H');
    m.put(8, 5, 'd').put(5, 8, 'd').put(3, 5, '=').put(6, 3, '=');
    m.room(27, 3, 32, 8, ',', 'H');
    m.put(27, 6, 'd').put(30, 8, 'd').put(32, 5, '=').put(29, 3, '=');
    // Orta avlu siperleri
    m.rect(9, 14, 11, 14, 'h');
    m.rect(24, 14, 26, 14, 'h');
    m.rect(16, 15, 19, 15, 'w');
    m.rect(14, 18, 15, 19, 'K');
    m.rect(20, 18, 21, 19, 'K');
    m.put(17, 21, 'C').put(18, 21, 'c');
    m.put(5, 12, 'b').put(30, 12, 'b').put(17, 13, 'b');
    // Güney kışla
    m.room(4, 22, 13, 27, ',', 'H');
    m.put(8, 22, 'd').put(13, 25, 'd').put(4, 24, '=').put(11, 27, '=').put(6, 22, '=');
    m.put(6, 25, 'c').put(10, 24, 'x');
    m.room(22, 22, 31, 27, ',', 'H');
    m.put(27, 22, 'd').put(22, 25, 'd').put(31, 24, '=').put(24, 27, '=').put(29, 22, '=');
    m.put(29, 25, 'c').put(25, 24, 'x');
    m.rect(16, 25, 19, 26, 'K');
    // Lambalar ve araçlar
    m.put(10, 12, 'L').put(25, 12, 'L').put(17, 23, 'L').put(2, 17, 'L').put(33, 17, 'L');
    m.rect(2, 10, 2, 11, 'v').rect(33, 19, 33, 20, 'v');
    m.put(7, 17, 'c').put(7, 18, 'c').put(28, 17, 'c').put(28, 18, 'c');
    m.put(12, 17, 'w').put(23, 17, 'w');
    for (let z = 10; z <= 20; z++) {
      if (m.g[z][1] === '.') m.mark('A', 1, z);
      if (m.g[z][34] === '.') m.mark('B', 34, z);
    }
    m.mark('flag', 17, 7, { id: 'A' });
    m.mark('flag', 17, 17, { id: 'B' });
    m.mark('flag', 17, 28, { id: 'C' });
    return {
      id: 'us',
      name: 'Gece Üssü',
      desc: 'Projektörlerle aydınlanan askeri üs. Hangar kontrolü kritik.',
      kind: 'mp',
      rows: m.rows(),
      points: m.points,
      theme: {
        // sevimli gece üssü: mor gök, yıldızlar, kocaman ay, sıcak ışıklı pencereler
        skyTop: 0x2b2f6b, skyHorizon: 0x6a5acd, skyBottom: 0x3a2f6b,
        fog: 0x7464b4, fogNear: 50, fogFar: 200,
        sun: 0xe8e6ff, sunIntensity: 0.3, sunDir: [0.3, 0.62, -0.5], sunSize: 0.09, sunDisk: 0xfff8e8,
        hemiSky: 0xe2dcff, hemiGround: 0xd8b8c8, hemiIntensity: 0.76,
        ground: 'asfalt', wall: 'beton', building: 'metal', indoor: 'karo',
        wallColors: [0xb8d8f4, 0xc8ecdc], buildingColors: [0x9ad7ff, 0xa8e6cf, 0xffc8dd, 0xfff1a8, 0xcdb4ff], roofColors: [0xff8b94, 0x4ecdc4, 0xffb347],
        coverColor: 0xd8ccff, poleColor: 0x9b8ac8, lampColor: 0xffe2b0, cloudColor: 0x9a8ae0,
        leafColors: [0x5fc9a0, 0x4eb894, 0x72d6ae],
        exposure: 1.0, night: true, stars: true, lampLights: true, windowGlow: true, clouds: 0.4,
        grade: { sat: 1.16, con: 1.05, tint: 0xfff8fa, lift: 0x120a2a, bloom: 0.38, bloomThreshold: 0.88, vig: 0.3, vigCol: 0xb8a4e0 },
      },
    };
  }

  // ------------------------------------------------------------------
  // KAYIP TESİS — zombi haritası
  // ------------------------------------------------------------------
  function tesis() {
    const m = new Painter(36, 32, '#');
    // Bölge 0: Giriş salonu
    m.room(2, 11, 12, 21, ',', 'H');
    // Bölge 1: Koridor
    m.room(12, 13, 25, 18, ',', 'H');
    m.rect(12, 15, 12, 16, '1');
    // Bölge 2: Avlu (açık hava)
    m.room(12, 1, 33, 10, '.', '#');
    // Koridor → avlu geçidi
    m.rect(17, 11, 18, 12, ',');
    m.put(16, 11, 'H').put(16, 12, 'H').put(19, 11, 'H').put(19, 12, 'H');
    m.rect(17, 13, 18, 13, ',');
    m.rect(17, 10, 18, 10, '2');
    // Bölge 3: Laboratuvar
    m.room(12, 20, 33, 30, ',', 'H');
    m.rect(21, 18, 22, 18, ',');
    m.rect(21, 19, 22, 19, '3');
    m.put(20, 19, 'H').put(23, 19, 'H');
    m.rect(21, 20, 22, 20, ',');
    // Doğu geçidi (laboratuvara ait)
    m.rect(29, 11, 32, 19, 'H');
    m.rect(30, 11, 31, 19, ',');
    m.rect(30, 10, 31, 10, '4');
    m.rect(30, 20, 31, 20, ',');
    // İç mekân dekoru
    m.put(4, 13, 'c').put(10, 19, 'c').put(4, 19, 'x').put(10, 13, 'x');
    m.rect(15, 23, 17, 23, 'h').rect(15, 27, 17, 27, 'h');
    m.rect(24, 24, 26, 24, 'h');
    m.put(14, 25, 'x').put(28, 26, 'x').put(19, 25, 'c');
    m.put(14, 4, 'T').put(28, 5, 'T').put(22, 8, 'v').put(23, 8, 'v');
    m.rect(19, 4, 20, 4, 'w').put(25, 3, 'C').put(15, 8, 'c').put(16, 2, 'b');
    m.put(14, 14, 'c');
    // Noktalar
    m.mark('start', 7, 16);
    m.mark('start', 6, 15);
    m.mark('start', 8, 17);
    // Zombi doğma (kapı / pencere kenarları)
    m.mark('Z', 3, 12).mark('Z', 11, 12).mark('Z', 3, 20).mark('Z', 11, 20).mark('Z', 7, 12).mark('Z', 7, 20);
    m.mark('Z', 13, 14).mark('Z', 24, 14).mark('Z', 24, 17);
    m.mark('Z', 13, 2).mark('Z', 32, 2).mark('Z', 13, 9).mark('Z', 32, 9).mark('Z', 22, 2);
    m.mark('Z', 13, 21).mark('Z', 32, 21).mark('Z', 13, 29).mark('Z', 32, 29).mark('Z', 22, 29).mark('Z', 30, 13);
    // Duvar silahları (yüzey: duvarın yönü)
    m.mark('wallbuy', 3, 16, { face: 'W', weapon: 'atmaca' });
    m.mark('wallbuy', 11, 14, { face: 'E', weapon: 'gurz' });
    m.mark('wallbuy', 20, 14, { face: 'N', weapon: 'yaban' });
    m.mark('wallbuy', 24, 2, { face: 'N', weapon: 'simsek' });
    m.mark('wallbuy', 13, 25, { face: 'W', weapon: 'cakal' });
    m.mark('wallbuy', 32, 26, { face: 'E', weapon: 'kasirga' });
    // Gizem kutusu konumları
    m.mark('box', 21, 6, { face: 'S' });
    m.mark('box', 27, 29, { face: 'N' });
    m.mark('box', 6, 12, { face: 'S' });
    // Yetenek makineleri (ön yüz yönü)
    m.mark('perk', 32, 5, { face: 'W', perk: 'hizliel' });
    m.mark('perk', 13, 22, { face: 'E', perk: 'demirderi' });
    m.mark('perk', 18, 29, { face: 'N', perk: 'ciftatis' });
    m.mark('perk', 32, 23, { face: 'W', perk: 'ikincisans' });
    m.mark('perk', 23, 17, { face: 'N', perk: 'cevikbacak' });
    m.mark('perk', 13, 17, { face: 'E', perk: 'demlicay' });
    m.mark('upgrade', 25, 21, { face: 'S' });
    m.mark('power', 28, 29, { face: 'N' });
    return {
      id: 'tesis',
      name: 'Kayıp Tesis',
      desc: 'Terk edilmiş araştırma tesisi. Gücü aç, dönüştürücüyü çalıştır.',
      kind: 'zm',
      rows: m.rows(),
      points: m.points,
      doors: {
        1: { cost: 750, name: 'Koridor' },
        2: { cost: 1000, name: 'Avlu' },
        3: { cost: 1250, name: 'Laboratuvar' },
        4: { cost: 1000, name: 'Doğu Geçidi' },
      },
      theme: {
        // oyuncu nane/beyaz laboratuvar, pembe vurgular; alacakaranlık mor gök — hafif ürkütücü ama tatlı
        skyTop: 0x2e2563, skyHorizon: 0x8e6bd6, skyBottom: 0x2a2050,
        fog: 0x5e4e94, fogNear: 14, fogFar: 95,
        sun: 0xc8d4ff, sunIntensity: 0.2, sunDir: [0.4, 0.8, 0.2], sunSize: 0.08, sunDisk: 0xf6f0ff,
        hemiSky: 0xe4f0ff, hemiGround: 0xa898c8, hemiIntensity: 0.58,
        ground: 'toprak', wall: 'beton', building: 'labduvar', indoor: 'labzemin',
        wallColors: [0xb8e8d8, 0xc8dcf4], buildingColors: [0xd2f7e8, 0xeefff7, 0xffe2ef], roofColors: [0xff9ec4, 0xa8e6cf], tintPerRect: true,
        coverColor: 0xc8f0e0, ceilColor: 0xf4fff9, cloudColor: 0x8a7ad0,
        exposure: 0.95, night: true, stars: true, flashlight: true, zombieLights: true, clouds: 0.45,
        grade: { sat: 1.08, con: 1.05, tint: 0xf6f2ff, lift: 0x1e1034, bloom: 0.18, bloomThreshold: 0.94, vig: 0.32, vigCol: 0xb09ad8 },
      },
    };
  }

  // ------------------------------------------------------------------
  // ATIŞ POLİGONU
  // ------------------------------------------------------------------
  function poligon() {
    const m = new Painter(24, 52, '.');
    m.border('#');
    // Atış hattı
    m.rect(1, 45, 22, 45, 'h');
    m.rect(8, 45, 9, 45, '.');
    m.rect(14, 45, 15, 45, '.');
    m.put(3, 48, 'c').put(20, 48, 'C').put(12, 49, 'w').put(11, 49, 'w');
    // Kulvarlar arası tümsekler
    for (const z of [38, 28, 16]) {
      m.rect(1, z, 3, z, 'w');
      m.rect(20, z, 22, z, 'w');
    }
    m.put(6, 30, 'K').put(6, 31, 'K').put(17, 22, 'K').put(17, 23, 'K');
    m.put(11, 20, 'c').put(12, 20, 'c');
    m.put(5, 49, 'L').put(18, 49, 'L');
    m.mark('start', 12, 48);
    // Hedefler: mesafe metre cinsinden etiketlenir
    const targets = [
      [6, 41], [12, 41], [18, 41],
      [4, 34], [10, 34], [15, 34], [20, 34],
      [7, 26], [13, 26], [19, 26],
      [5, 18], [11, 14], [16, 18],
      [9, 6], [14, 6], [19, 9], [4, 9],
    ];
    for (const [x, z] of targets) m.mark('target', x, z);
    m.mark('mover', 2, 36, { to: 21 });
    m.mark('mover', 2, 22, { to: 21 });
    m.mark('console', 4, 47);
    return {
      id: 'poligon',
      name: 'Atış Poligonu',
      desc: 'Silahlarını dene, 60 saniyelik hedef görevinde rekor kır.',
      kind: 'range',
      rows: m.rows(),
      points: m.points,
      theme: {
        // pırıl pırıl eğitim parkı: masmavi gök, yemyeşil çim, şeker renkli bloklar
        skyTop: 0x5fb8ff, skyHorizon: 0xbfe9ff, skyBottom: 0xd8f0c0,
        fog: 0xd8f0ff, fogNear: 70, fogFar: 270,
        sun: 0xfff6e0, sunIntensity: 0.28, sunDir: [-0.3, 0.8, 0.4], sunSize: 0.07,
        hemiSky: 0xeef0ff, hemiGround: 0xdcefd0, hemiIntensity: 0.84,
        ground: 'cim', wall: 'beton', building: 'beton', indoor: 'karo',
        wallColors: [0x9ad7ff, 0xa8e6cf, 0xffaaa5, 0xcdb4ff], buildingColors: [0xffd3b6, 0x9ad7ff], roofColors: [0xff8b94, 0x4ecdc4],
        coverColor: 0xfff1a8, cloudColor: 0xffffff,
        exposure: 1.0, decor: 'hills', clouds: 0.55,
        grade: { sat: 1.1, con: 1.04, tint: 0xffffff, lift: 0x100a20, bloom: 0.24, bloomThreshold: 0.9, vig: 0.22 },
      },
    };
  }

  G.MAPS = {
    liman: liman(),
    col: col(),
    us: us(),
    tesis: tesis(),
    poligon: poligon(),
  };
  G.MP_MAPS = ['liman', 'col', 'us'];
})(typeof window !== 'undefined' ? window : globalThis);
