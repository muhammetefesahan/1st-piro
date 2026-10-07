'use strict';
// Gölge Timi — saf oyun kuralları: silah verileri, eklentiler, yetenekler,
// zombi formülleri, rütbeler ve ızgara yol bulma. DOM/THREE kullanmaz,
// bu yüzden Node testlerinde doğrudan çalıştırılabilir.
(function (root) {
  const G = (root.G = root.G || {});

  // ------------------------------------------------------------------
  // SİLAHLAR (sağlık: 150)
  // dmg: [mesafe(m), hasar] basamakları. head: kafa çarpanı.
  // Her silah, sınıf şablonunun üstüne yalnızca farklarını yazar.
  // ------------------------------------------------------------------
  const LONG = ['optic', 'muzzle', 'barrel', 'under', 'mag', 'stock', 'ammo'];
  const ALL_SLOTS = LONG;
  const TEMPLATES = {
    ar: { cls: 'ar', clsName: 'Taarruz Tüfeği', slot: 'primary', head: 1.35, mode: 'auto', mag: 30, reserve: 150, reload: 2.0, reloadEmpty: 2.6, adsTime: 0.25, zoom: 1.25, move: 0.95, hip: 2.3, adsSpread: 0.12, moveSpread: 1.6, recV: 0.5, recH: 0.28, sprintFire: 0.22, swap: 0.55, sound: 'ar', allowed: LONG },
    smg: { cls: 'smg', clsName: 'Hafif Makineli', slot: 'primary', head: 1.25, mode: 'auto', mag: 32, reserve: 192, reload: 1.7, reloadEmpty: 2.2, adsTime: 0.19, zoom: 1.2, move: 1.0, hip: 1.8, adsSpread: 0.3, moveSpread: 1.0, recV: 0.36, recH: 0.34, sprintFire: 0.15, swap: 0.45, sound: 'smg', allowed: LONG },
    shotgun: { cls: 'shotgun', clsName: 'Pompalı Tüfek', slot: 'primary', head: 1.1, mode: 'semi', pellets: 8, pelletSpread: 4.2, mag: 6, reserve: 30, reload: 0.5, reloadEmpty: 0.5, adsTime: 0.2, zoom: 1.15, move: 0.97, hip: 4.0, adsSpread: 3.0, moveSpread: 0.6, recV: 3.0, recH: 1.0, sprintFire: 0.2, swap: 0.5, sound: 'shotgun', allowed: ['optic', 'barrel', 'under', 'mag', 'stock', 'ammo'] },
    dmr: { cls: 'dmr', clsName: 'Nişancı Tüfeği', slot: 'primary', head: 1.6, mode: 'semi', mag: 15, reserve: 75, reload: 2.4, reloadEmpty: 2.9, adsTime: 0.32, zoom: 1.3, move: 0.9, hip: 4, adsSpread: 0.05, moveSpread: 2.2, recV: 1.2, recH: 0.4, sprintFire: 0.26, swap: 0.6, sound: 'dmr', allowed: LONG },
    sniper: { cls: 'sniper', clsName: 'Keskin Nişancı', slot: 'primary', head: 2.0, legs: 0.7, mode: 'semi', bolt: true, mag: 5, reserve: 25, reload: 3.0, reloadEmpty: 3.6, adsTime: 0.42, zoom: 5.5, scope: true, move: 0.88, hip: 8, adsSpread: 0, moveSpread: 3, recV: 3.5, recH: 0.6, sprintFire: 0.32, swap: 0.7, sound: 'sniper', allowed: ['optic', 'muzzle', 'barrel', 'under', 'mag', 'stock', 'ammo'] },
    lmg: { cls: 'lmg', clsName: 'Hafif Makineli Tüfek', slot: 'primary', head: 1.3, mode: 'auto', mag: 100, reserve: 200, reload: 5.0, reloadEmpty: 5.5, adsTime: 0.38, zoom: 1.25, move: 0.84, hip: 3.5, adsSpread: 0.25, moveSpread: 2.4, recV: 0.55, recH: 0.4, sprintFire: 0.34, swap: 0.8, sound: 'lmg', allowed: LONG },
    special: { cls: 'special', clsName: 'Özel', slot: 'primary', head: 1.0, mode: 'semi', rpm: 50, mag: 1, reserve: 12, reload: 1.5, reloadEmpty: 1.5, adsTime: 0.26, zoom: 1.4, move: 0.95, hip: 3, adsSpread: 0.1, moveSpread: 1.5, recV: 1.5, recH: 0.3, sprintFire: 0.22, swap: 0.55, sound: 'crossbow', allowed: ['optic', 'stock'] },
    pistol: { cls: 'pistol', clsName: 'Tabanca', slot: 'secondary', head: 1.4, mode: 'semi', mag: 12, reserve: 72, reload: 1.4, reloadEmpty: 1.8, adsTime: 0.14, zoom: 1.15, move: 1.05, hip: 1.5, adsSpread: 0.3, moveSpread: 0.8, recV: 1.0, recH: 0.4, sprintFire: 0.1, swap: 0.3, sound: 'pistol', allowed: ['optic', 'muzzle', 'mag', 'ammo'] },
    launcher: { cls: 'launcher', clsName: 'Fırlatıcı', slot: 'secondary', head: 1, mode: 'semi', rpm: 40, mag: 1, reserve: 3, reload: 3.2, reloadEmpty: 3.2, adsTime: 0.4, zoom: 1.3, move: 0.9, hip: 4, adsSpread: 0.2, moveSpread: 1, recV: 4, recH: 1, sprintFire: 0.35, swap: 0.8, sound: 'rocket', allowed: [] },
    wonder: { cls: 'wonder', clsName: 'Deneysel', slot: 'secondary', head: 1, mode: 'semi', mag: 20, reserve: 160, reload: 2.6, reloadEmpty: 2.6, adsTime: 0.2, zoom: 1.2, move: 1.0, hip: 1.5, adsSpread: 0.2, moveSpread: 0.5, recV: 1.2, recH: 0.4, sprintFire: 0.12, swap: 0.4, sound: 'plasma', allowed: [], zmOnly: true },
  };
  function W(tpl, o) {
    const t = TEMPLATES[tpl];
    const w = Object.assign({}, t, o);
    w.look = Object.assign({}, o.look || {});
    w.zm = Object.assign({ price: 0, box: 2 }, o.zm || {});
    return w;
  }

  const WEAPONS = {
    // ---------------- Taarruz tüfekleri ----------------
    simsek: W('ar', {
      name: 'AR-24 Şimşek', dmg: [[0, 31], [30, 26], [50, 22]], rpm: 750,
      desc: 'Dengeli, güvenilir standart tüfek. Her duruma uyar.',
      look: { kind: 'rifle', len: 0.36, barrel: 0.24, guard: 0.26, gs: 'rail', stock: 'collapsible', mag: 'curved', body: 0x26292c, furn: 0x3a3d39, sight: 'carry', muzzle: 'flash' },
      zm: { price: 1400, box: 3 },
    }),
    kasirga: W('ar', {
      name: 'KR-9 Kasırga', dmg: [[0, 38], [35, 32], [60, 27]], rpm: 600, reload: 2.2, reloadEmpty: 2.8, adsTime: 0.27, move: 0.93, hip: 2.5, adsSpread: 0.14, moveSpread: 1.8, recV: 0.7, recH: 0.36, sprintFire: 0.24, swap: 0.6, sound: 'ar2',
      desc: 'Ağır mermili ahşap tüfek. Az atışta öldürür, tepmesi serttir.',
      look: { kind: 'rifle', len: 0.38, barrel: 0.3, guard: 0.22, gs: 'wood', stock: 'wood', mag: 'curved', body: 0x2c2a26, furn: 0x6b4426, wood: true, sight: 'post', muzzle: 'brake' },
      zm: { price: 1600, box: 3 },
    }),
    tufan: W('ar', {
      name: 'TR-3 Tufan', clsName: 'Seri Atışlı Tüfek', dmg: [[0, 40], [40, 34], [65, 29]], head: 1.4, rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.3, reload: 2.1, reloadEmpty: 2.7, adsSpread: 0.1, recV: 0.45, recH: 0.2, sound: 'ar3',
      desc: 'Üçlü seri atış. İki seriyle düşmanı indirir.',
      look: { kind: 'rifle', len: 0.34, barrel: 0.3, guard: 0.28, gs: 'vented', stock: 'skeleton', mag: 'straight', body: 0x44484a, furn: 0x2b2d2f, sight: 'rail', muzzle: 'flash' },
    }),
    bora: W('ar', {
      name: 'BRA-556 Bora', dmg: [[0, 27], [32, 23], [55, 20]], rpm: 830, move: 0.97, recV: 0.38, recH: 0.22, sound: 'ar4',
      desc: 'Hızlı ve kontrolü kolay. Uzun seriler için ideal.',
      look: { kind: 'rifle', len: 0.35, barrel: 0.2, guard: 0.3, gs: 'mlok', stock: 'collapsible', mag: 'curved', body: 0x2a2b2c, furn: 0x8a7a5a, sight: 'rail', muzzle: 'flash' },
      zm: { box: 3 },
    }),
    yildiz: W('ar', {
      name: 'YLD Bullpup', dmg: [[0, 33], [30, 28], [52, 24]], rpm: 700, adsTime: 0.22, move: 0.97, recV: 0.55, recH: 0.3, sound: 'bullpup',
      desc: 'Kısa gövdede uzun namlu. Çevik ve isabetli.',
      look: { kind: 'bullpup', len: 0.52, barrel: 0.16, guard: 0.18, gs: 'slim', stock: 'none', mag: 'straight', body: 0x3b4034, furn: 0x24271f, sight: 'rail', muzzle: 'flash' },
    }),
    kilic: W('ar', {
      name: 'KLÇ-47', dmg: [[0, 42], [32, 36], [55, 30]], rpm: 560, reload: 2.3, reloadEmpty: 2.9, adsTime: 0.28, move: 0.92, hip: 2.7, recV: 0.85, recH: 0.5, sound: 'ak',
      desc: 'Efsanevi 7.62. Dört mermide öldürür ama zapt etmek ister.',
      look: { kind: 'rifle', len: 0.4, barrel: 0.3, guard: 0.24, gs: 'wood', stock: 'wood', mag: 'curved', magLen: 0.19, body: 0x1e1f21, furn: 0x7a4a26, wood: true, sight: 'post', muzzle: 'brake' },
    }),
    // ---------------- Hafif makineliler ----------------
    yaban: W('smg', {
      name: 'VX-45 Yaban', dmg: [[0, 31], [12, 26], [25, 19]], rpm: 880,
      desc: 'Yakın mesafenin kralı. Hızlı nişan, yüksek hareket.',
      look: { kind: 'smg', len: 0.3, barrel: 0.08, guard: 0.14, gs: 'rail', stock: 'folding', mag: 'straight', body: 0x1f2124, furn: 0x3c4046, sight: 'rail', muzzle: 'none' },
      zm: { price: 1000, box: 3 },
    }),
    cakal: W('smg', {
      name: 'Çakal-9', dmg: [[0, 25], [10, 21], [22, 16]], head: 1.3, rpm: 1050, mag: 40, reserve: 200, reload: 1.9, reloadEmpty: 2.3, adsTime: 0.18, move: 1.03, hip: 2.0, adsSpread: 0.35, recV: 0.3, recH: 0.42, sprintFire: 0.14, swap: 0.42, sound: 'smg2',
      desc: 'Saniyede on yedi mermi. Kısa ama ölümcül.',
      look: { kind: 'smg', len: 0.26, barrel: 0.06, guard: 0.1, gs: 'slim', stock: 'none', mag: 'straight', magLen: 0.2, body: 0x2c3a2c, furn: 0x1c1f1c, sight: 'post', muzzle: 'none' },
      zm: { price: 1100, box: 3 },
    }),
    ari: W('smg', {
      name: 'ARI-90 PDW', dmg: [[0, 26], [14, 22], [28, 17]], rpm: 900, mag: 50, reserve: 200, reload: 2.4, reloadEmpty: 2.9, adsTime: 0.2, sound: 'smg3',
      desc: 'Üstten beslemeli 50’lik şarjör. Kesintisiz baskı.',
      look: { kind: 'pdw', len: 0.46, barrel: 0.05, body: 0x3a3e36, furn: 0x24261f, mag: 'pdw', stock: 'none', sight: 'rail', muzzle: 'flash' },
    }),
    sahin: W('smg', {
      name: 'ŞHN-5', dmg: [[0, 30], [13, 26], [27, 20]], rpm: 800, mag: 30, recV: 0.28, recH: 0.22, sound: 'smg4',
      desc: 'Kontrollü ve isabetli. Orta mesafeye de uzanır.',
      look: { kind: 'smg', len: 0.32, barrel: 0.1, guard: 0.16, gs: 'vented', stock: 'collapsible', mag: 'curved', magLen: 0.15, body: 0x202224, furn: 0x2e3135, sight: 'carry', muzzle: 'none' },
    }),
    firtina: W('smg', {
      name: 'FRT Vektör', dmg: [[0, 22], [10, 19], [20, 14]], rpm: 1150, mag: 25, reserve: 175, reload: 1.8, reloadEmpty: 2.1, adsTime: 0.16, move: 1.03, recV: 0.25, recH: 0.3, sound: 'smg5',
      desc: 'Neredeyse tepmesiz, akıl almaz atış hızı.',
      look: { kind: 'vector', len: 0.38, barrel: 0.1, body: 0x1a1b1d, furn: 0x5a5d60, mag: 'straight', magLen: 0.16, stock: 'skeleton', sight: 'rail', muzzle: 'none' },
    }),
    // ---------------- Av tüfekleri ----------------
    gurz: W('shotgun', {
      name: 'Gürz 12', dmg: [[0, 26], [7, 18], [14, 9], [22, 4]], rpm: 70, pump: true, shellReload: true,
      desc: 'Pompalı klasik. Yedi metre içinde tek atış.',
      look: { kind: 'shotgun', len: 0.32, barrel: 0.42, guard: 0.2, gs: 'pump', stock: 'wood', mag: 'tube', body: 0x2a2724, furn: 0x5a3d26, wood: true, sight: 'post', muzzle: 'none' },
      zm: { price: 500, box: 2 },
    }),
    balyoz: W('shotgun', {
      name: 'Balyoz Oto-12', clsName: 'Yarı Otomatik Av Tüfeği', dmg: [[0, 20], [7, 14], [13, 8], [20, 3]], rpm: 220, mag: 8, reserve: 40, reload: 2.4, reloadEmpty: 2.9, recV: 2.2, sound: 'shotgun2',
      desc: 'Şarjörlü, yarı otomatik. Seri atışla temizler.',
      look: { kind: 'auto-shotgun', len: 0.38, barrel: 0.3, guard: 0.24, gs: 'rail', stock: 'collapsible', mag: 'box', body: 0x262829, furn: 0x2f3233, sight: 'rail', muzzle: 'brake' },
    }),
    cifte: W('shotgun', {
      name: 'Çifte', clsName: 'Çift Namlu', dmg: [[0, 28], [8, 20], [15, 10], [22, 4]], pellets: 10, rpm: 360, mag: 2, reserve: 24, reload: 2.0, reloadEmpty: 2.0, move: 1.0, recV: 4.2, sound: 'shotgun3',
      desc: 'İki namlu, iki şans. Köy usulü adalet.',
      look: { kind: 'double', len: 0.3, barrel: 0.5, stock: 'wood', mag: 'none', body: 0x3a3a3a, furn: 0x6e4224, wood: true, sight: 'none', muzzle: 'none' },
      zm: { box: 2 },
    }),
    tokmak: W('shotgun', {
      name: 'Tokmak Tambur', clsName: 'Otomatik Av Tüfeği', dmg: [[0, 16], [6, 11], [12, 6], [18, 2]], pellets: 7, mode: 'auto', rpm: 260, mag: 20, reserve: 60, reload: 3.2, reloadEmpty: 3.6, move: 0.92, recV: 1.8, sound: 'shotgun2',
      desc: 'Tamburlu otomatik av tüfeği. Koridorlar onun.',
      look: { kind: 'auto-shotgun', len: 0.36, barrel: 0.24, guard: 0.2, gs: 'vented', stock: 'full', mag: 'drum', body: 0x2a2c26, furn: 0x40452f, sight: 'rail', muzzle: 'brake' },
    }),
    // ---------------- Nişancı tüfekleri ----------------
    atmaca: W('dmr', {
      name: 'Atmaca DMR', dmg: [[0, 55], [40, 50], [80, 44]], rpm: 300,
      desc: 'Yarı otomatik nişancı tüfeği. Üç vuruşta indirir.',
      look: { kind: 'rifle', len: 0.4, barrel: 0.34, guard: 0.3, gs: 'mlok', stock: 'collapsible', mag: 'straight', magLen: 0.12, body: 0x2e2f2a, furn: 0x7a6a4a, sight: 'rail', muzzle: 'brake' },
      zm: { price: 500, box: 2 },
    }),
    kartal: W('dmr', {
      name: 'KRT-14 Kartal', dmg: [[0, 62], [45, 56], [90, 50]], rpm: 280, mag: 20, reserve: 80, adsTime: 0.34, move: 0.89, recV: 1.4, sound: 'dmr2',
      desc: 'Ahşap gövdeli emektar. Uzun menzilde hasar kaybetmez.',
      look: { kind: 'rifle', len: 0.42, barrel: 0.38, guard: 0.3, gs: 'wood', stock: 'wood', mag: 'straight', magLen: 0.12, body: 0x26272a, furn: 0x7e522c, wood: true, sight: 'post', muzzle: 'flash' },
    }),
    arbalet: W('special', {
      name: 'Gölge Arbaleti', clsName: 'Arbalet', dmg: [[0, 200]], suppressedNative: true,
      projectile: { type: 'bolt', speed: 78, dmg: 200, gravity: 4 },
      desc: 'Sessiz, tek atışta öldüren ok. Düşmeye dikkat.',
      look: { kind: 'crossbow', len: 0.62, body: 0x2a2c27, furn: 0x3b3f35, stock: 'skeleton', mag: 'none', sight: 'rail' },
    }),
    // ---------------- Keskin nişancılar ----------------
    dogan: W('sniper', {
      name: 'Doğan .338', dmg: [[0, 160], [100, 150]], rpm: 48,
      desc: 'Sürgülü klasik. Gövdeye tek atış.',
      look: { kind: 'sniper', len: 0.42, barrel: 0.5, guard: 0.3, gs: 'slim', stock: 'sniper', mag: 'box', body: 0x3b4034, furn: 0x23261f, scope: true, muzzle: 'brake' },
    }),
    karasahin: W('sniper', {
      name: 'Kara Şahin .50', dmg: [[0, 220]], legs: 0.75, rpm: 38, reload: 3.6, reloadEmpty: 4.2, adsTime: 0.55, move: 0.82, recV: 5, recH: 1, sound: 'sniper50', pen: 2,
      desc: '.50 kalibre. Sandık, konteyner, araç: hiçbiri saklamaz.',
      look: { kind: 'sniper', len: 0.5, barrel: 0.6, guard: 0.36, gs: 'vented', stock: 'sniper', mag: 'box', magLen: 0.12, body: 0x2b2d2e, furn: 0x1d1e1f, scope: true, muzzle: 'big', bipod: true },
    }),
    akdogan: W('sniper', {
      name: 'Akdoğan SR', dmg: [[0, 90], [60, 84]], rpm: 170, bolt: false, mag: 10, reserve: 40, reload: 2.6, reloadEmpty: 3.1, adsTime: 0.4, zoom: 4.5, recV: 2.2, sound: 'sniper2',
      desc: 'Yarı otomatik keskin nişancı. Çabuk ikinci atış.',
      look: { kind: 'sniper', len: 0.42, barrel: 0.44, guard: 0.32, gs: 'mlok', stock: 'collapsible', mag: 'box', body: 0x5a5444, furn: 0x2e2c25, scope: true, muzzle: 'brake' },
    }),
    // ---------------- Hafif makineli tüfekler ----------------
    celik: W('lmg', {
      name: 'Çelik LMG-100', dmg: [[0, 32], [40, 28], [70, 24]], rpm: 650,
      desc: 'Yüz mermilik tambur. Bastırma ateşinin ustası.',
      look: { kind: 'lmg', len: 0.46, barrel: 0.34, guard: 0.3, gs: 'heat', stock: 'full', mag: 'drum', body: 0x32352f, furn: 0x1e201c, sight: 'carry', muzzle: 'flash', bipod: true },
    }),
    pala: W('lmg', {
      name: 'PL-7 Pala', dmg: [[0, 40], [40, 35], [70, 30]], rpm: 600, mag: 75, reserve: 150, reload: 5.4, reloadEmpty: 6.0, adsTime: 0.45, move: 0.8, recV: 0.65, recH: 0.45, sound: 'lmg2',
      desc: 'Şeritli 7.62. Duvarı da düşmanı da deler geçer.',
      look: { kind: 'lmg', len: 0.48, barrel: 0.38, guard: 0.26, gs: 'vented', stock: 'skeleton', mag: 'belt', body: 0x26282a, furn: 0x4a3a2a, sight: 'post', muzzle: 'flash', bipod: true },
    }),
    gurgen: W('lmg', {
      name: 'Gürgen Hafif', dmg: [[0, 30], [38, 26], [65, 22]], rpm: 760, mag: 60, reserve: 180, reload: 3.6, reloadEmpty: 4.2, adsTime: 0.32, move: 0.87, recV: 0.5, sound: 'lmg3',
      desc: 'Taarruz tüfeği kadar çevik bir makineli.',
      look: { kind: 'rifle', len: 0.4, barrel: 0.34, guard: 0.28, gs: 'rail', stock: 'full', mag: 'box', magLen: 0.16, body: 0x343832, furn: 0x262923, sight: 'carry', muzzle: 'flash', bipod: true },
    }),
    // ---------------- Tabancalar ----------------
    yaver: W('pistol', {
      name: 'P-9 Yaver', dmg: [[0, 34], [10, 28], [22, 20]], rpm: 400,
      desc: 'Güvenilir yan silah.',
      look: { kind: 'pistol', body: 0x1d1e20, furn: 0x3a3c40 },
    }),
    kobra: W('pistol', {
      name: 'Kobra .50', clsName: 'Ağır Revolver', dmg: [[0, 75], [15, 60], [30, 45]], head: 1.5, rpm: 150, mag: 6, reserve: 36, reload: 2.6, reloadEmpty: 2.6, adsTime: 0.18, move: 1.02, hip: 2.4, adsSpread: 0.4, moveSpread: 1.0, recV: 3.0, recH: 0.8, sprintFire: 0.12, swap: 0.35, sound: 'magnum', allowed: ['optic', 'ammo'],
      desc: 'İki atış, bir sonuç.',
      look: { kind: 'revolver', body: 0x8a8d90, furn: 0x5a3820, wood: true },
    }),
    zipkin: W('pistol', {
      name: 'Zıpkın MP', clsName: 'Makineli Tabanca', dmg: [[0, 23], [9, 19], [18, 14]], mode: 'auto', rpm: 1000, mag: 20, reserve: 100, recV: 0.45, recH: 0.5, sound: 'mpistol',
      desc: 'Tam otomatik tabanca. Panik anlarının dostu.',
      look: { kind: 'mpistol', body: 0x232528, furn: 0x101112 },
    }),
    sarp: W('pistol', {
      name: 'Sarp .45', dmg: [[0, 48], [12, 40], [24, 30]], rpm: 340, mag: 8, reserve: 48, recV: 1.5, sound: 'pistol45',
      desc: 'Ağır mermili otomatik tabanca.',
      look: { kind: 'pistol', body: 0x6a5a40, furn: 0x2a2520, big: true },
    }),
    fisek: W('pistol', {
      name: 'İşaret Fişeği', clsName: 'Fişek Tabancası', dmg: [[0, 130]], rpm: 60, mag: 1, reserve: 8, reload: 1.8, reloadEmpty: 1.8, recV: 3, sound: 'flare', allowed: [],
      projectile: { type: 'flare', speed: 42, dmg: 130, gravity: 7 },
      desc: 'Vurduğunu tutuşturur. Gece haritalarında yolu aydınlatır.',
      look: { kind: 'flare', body: 0xd9541e, furn: 0x2a2a2a },
      zm: { box: 1.5 },
    }),
    // ---------------- Fırlatıcılar ----------------
    yildirim: W('launcher', {
      name: 'Yıldırım Roketatar', clsName: 'Roketatar', dmg: [[0, 220]],
      projectile: { type: 'rocket', speed: 48, radius: 5.5, dmg: 220 },
      desc: 'Araçlar, taretler, kalabalıklar.',
      look: { kind: 'launcher', body: 0x3d4a33, furn: 0x222622 },
      zm: { box: 1 },
    }),
    gokgurultusu: W('launcher', {
      name: 'Gök Gürültüsü GL', clsName: 'Bombaatar', dmg: [[0, 150]], rpm: 110, mag: 6, reserve: 12, reload: 4.0, reloadEmpty: 4.0, adsTime: 0.3, recV: 2.2, sound: 'gl',
      projectile: { type: 'gl', speed: 36, radius: 4.2, dmg: 150, gravity: 9 },
      desc: 'Altı atımlık tamburlu bombaatar.',
      look: { kind: 'gl', body: 0x3a3d33, furn: 0x1f201c },
      zm: { box: 1.2 },
    }),
    // ---------------- Deneysel (zombi) ----------------
    plazma: W('wonder', {
      name: 'Plazma Tabancası', dmg: [[0, 600]], rpm: 260,
      projectile: { type: 'plasma', speed: 70, radius: 2.4, dmg: 600 },
      desc: 'Kızıl Sis laboratuvarının harikası.',
      look: { kind: 'wonder', body: 0x3a3f4a, furn: 0x39ff9a },
      zm: { box: 0.6 },
    }),
    ayaz: W('wonder', {
      name: 'Ayaz Topu', dmg: [[0, 900]], rpm: 150, mag: 12, reserve: 96, sound: 'frost',
      projectile: { type: 'frost', speed: 55, radius: 3.2, dmg: 900 },
      desc: 'Zombileri dondurur, sonra paramparça eder.',
      look: { kind: 'frost', body: 0x2a3a4a, furn: 0x8fe8ff },
      zm: { box: 0.5 },
    }),
  };
  for (const id in WEAPONS) WEAPONS[id].id = id;
  G.WEAPONS = WEAPONS;
  G.WEAPON_CATEGORIES = [
    ['ar', 'Taarruz Tüfekleri'],
    ['smg', 'Hafif Makineliler'],
    ['shotgun', 'Av Tüfekleri'],
    ['dmr', 'Nişancı Tüfekleri'],
    ['sniper', 'Keskin Nişancılar'],
    ['lmg', 'Makineli Tüfekler'],
    ['special', 'Özel'],
    ['pistol', 'Tabancalar'],
    ['launcher', 'Fırlatıcılar'],
  ];

  const UPGRADE_NAMES = {
    simsek: 'Fırtına Çağıran', kasirga: 'Kara Kasırga', tufan: 'Üçlü Hüküm', bora: 'Bora Fırtınası', yildiz: 'Kuyruklu Yıldız', kilic: 'Zülfikâr',
    yaban: 'Vahşi Sürü', cakal: 'Çakal Kralı', ari: 'Eşek Arısı', sahin: 'Gök Şahin', firtina: 'Kasırga Gözü',
    gurz: 'Yıkım Gürzü', balyoz: 'Demir Balyoz', cifte: 'Çifte Kumrular', tokmak: 'Cehennem Tokmağı',
    atmaca: 'Altın Atmaca', kartal: 'Tepedeki Kartal', arbalet: 'Gölge Okçusu',
    dogan: 'Ölüm Doğanı', karasahin: 'Kıyamet Şahini', akdogan: 'Ak Ölüm',
    celik: 'Demir Yağmur', pala: 'Kanlı Pala', gurgen: 'Yaşlı Gürgen',
    yaver: 'Sadık Yaver', kobra: 'Kral Kobra', zipkin: 'Kılıç Balığı', sarp: 'Sarp Kaya', fisek: 'Gün Doğumu',
    yildirim: 'Gök Gürültüsü', gokgurultusu: 'Yer Sarsıntısı', plazma: 'Plazma Fırtınası', ayaz: 'Sonsuz Kış',
  };
  G.UPGRADE_NAMES = UPGRADE_NAMES;

  // ------------------------------------------------------------------
  // EKLENTİLER (Silah Ustası)
  // ------------------------------------------------------------------
  const ATTACH = {
    optic: {
      label: 'Nişangah',
      items: [
        { id: 'none', name: 'Demir Nişangah', desc: 'Varsayılan gez-arpacık.' },
        { id: 'refleks', name: 'Mini Refleks', desc: 'Küçük, hızlı, açık görüş.', zoom: 1.25, adsTime: 0 },
        { id: 'kirmizi', name: 'Kırmızı Nokta', desc: 'Net nokta, hafif yakınlaştırma.', zoom: 1.35, adsTime: 0.02 },
        { id: 'holo', name: 'Holografik', desc: 'Geniş görüş halkası.', zoom: 1.3, adsTime: 0.02 },
        { id: 'durbun', name: '3x Taktik Dürbün', desc: 'Orta menzil için 3 kat büyütme.', zoom: 2.6, adsTime: 0.07 },
        { id: 'prizma', name: '4x Prizmatik', desc: 'Uzun menzil, belirgin nişan işareti.', zoom: 3.4, adsTime: 0.09, move: -0.01 },
      ],
    },
    muzzle: {
      label: 'Namlu Ağzı',
      items: [
        { id: 'none', name: 'Yok' },
        { id: 'susturucu', name: 'Susturucu', desc: 'Atışlar haritada görünmez, menzil -%10.', suppressed: true, rangeMul: 0.9, adsTime: 0.01 },
        { id: 'kompansator', name: 'Kompansatör', desc: 'Dikey tepme -%20.', recV: 0.8, recH: 0.92 },
        { id: 'alev', name: 'Alev Gizleyici', desc: 'Namlu alevi gizlenir, yatay tepme -%15.', flashHidden: true, recH: 0.85 },
        { id: 'fren', name: 'Namlu Freni', desc: 'Tepme -%12, menzil +%5.', recV: 0.88, recH: 0.88, rangeMul: 1.05 },
      ],
    },
    barrel: {
      label: 'Namlu',
      items: [
        { id: 'none', name: 'Standart Namlu' },
        { id: 'uzun', name: 'Uzun Namlu', desc: 'Menzil +%25, nişan alma biraz yavaşlar.', rangeMul: 1.25, adsTime: 0.03, move: -0.02 },
        { id: 'kisa', name: 'Kısa Namlu', desc: 'Hızlı nişan, kalçadan daha isabetli, menzil -%15.', rangeMul: 0.85, adsTime: -0.03, hip: 0.85, move: 0.02 },
        { id: 'agir', name: 'Ağır Namlu', desc: 'Menzil +%15, tepme -%10, hareket yavaşlar.', rangeMul: 1.15, recV: 0.9, move: -0.03, adsTime: 0.02 },
      ],
    },
    under: {
      label: 'Alt Bağlantı',
      items: [
        { id: 'none', name: 'Yok' },
        { id: 'dikey', name: 'Dikey Kabza', desc: 'Dikey tepme -%18.', recV: 0.82 },
        { id: 'acili', name: 'Açılı Kabza', desc: 'Nişan alma hızlanır, yatay tepme -%10.', adsTime: -0.04, recH: 0.9 },
        { id: 'lazer', name: 'Taktik Lazer', desc: 'Kalçadan atış sapması -%30.', hip: 0.7 },
        { id: 'ayak', name: 'Çatal Ayak', desc: 'Çömelik/yüzüstü tepme -%35.', bipod: true },
      ],
    },
    mag: {
      label: 'Şarjör',
      items: [
        { id: 'none', name: 'Standart Şarjör' },
        { id: 'genis', name: 'Geniş Şarjör', desc: 'Kapasite +%50, doldurma yavaşlar.', magMul: 1.5, reloadMul: 1.15, adsTime: 0.02, move: -0.01 },
        { id: 'hizli', name: 'Hızlı Şarjör', desc: 'Doldurma süresi -%28.', reloadMul: 0.72 },
        { id: 'tambur', name: 'Tambur Şarjör', desc: 'Kapasite 2 kat; ağır ve yavaş.', magMul: 2, reloadMul: 1.4, adsTime: 0.05, move: -0.03, drum: true },
      ],
    },
    stock: {
      label: 'Dipçik',
      items: [
        { id: 'none', name: 'Standart Dipçik' },
        { id: 'hafif', name: 'Hafif Dipçik', desc: 'Hareket ve nişan hızlı, tepme +%10.', move: 0.03, adsTime: -0.02, recV: 1.1 },
        { id: 'agir', name: 'Ağır Dipçik', desc: 'Tepme -%15, nişan alma yavaşlar.', recV: 0.85, recH: 0.9, adsTime: 0.03, move: -0.02 },
        { id: 'yok', name: 'Dipçiksiz', desc: 'En hızlı hareket ve nişan, tepme +%25.', move: 0.05, adsTime: -0.04, recV: 1.25, recH: 1.15, noStock: true },
      ],
    },
    ammo: {
      label: 'Mühimmat',
      items: [
        { id: 'none', name: 'Standart Mermi' },
        { id: 'zirhdelici', name: 'Zırh Delici', desc: 'Sandık, konteyner ve araçları deler.', pen: 1, dmgMul: 0.95 },
        { id: 'yakici', name: 'Yakıcı Mermi', desc: 'Vurduğunu 3 sn yakar, hasar -%10.', burn: true, dmgMul: 0.9 },
        { id: 'oyuk', name: 'Oyuk Uçlu', desc: 'Gövdeye +%12 hasar, menzil -%10.', hollow: true, rangeMul: 0.9 },
      ],
    },
  };
  G.ATTACH = ATTACH;

  function findAttach(slot, id) {
    const s = ATTACH[slot];
    if (!s) return null;
    return s.items.find((i) => i.id === id) || s.items[0];
  }
  G.findAttach = findAttach;

  // Bir silaha takılabilecek seçenekler
  G.attachOptions = function (weaponId, slot) {
    const w = WEAPONS[weaponId];
    if (!w || !w.allowed.includes(slot)) return [];
    let items = ATTACH[slot].items;
    const c = w.cls;
    if (slot === 'optic') {
      if (c === 'pistol') items = items.filter((i) => ['none', 'refleks', 'kirmizi'].includes(i.id));
      else if (c === 'shotgun') items = items.filter((i) => !['durbun', 'prizma'].includes(i.id));
      else if (c === 'sniper') items = items.filter((i) => ['none', 'durbun', 'prizma'].includes(i.id));
    }
    if (slot === 'mag') {
      if (w.shellReload || w.look.mag === 'drum' || w.look.mag === 'belt' || w.look.mag === 'none') items = items.filter((i) => i.id === 'none' || i.id === 'hizli');
      else if (!['ar', 'smg', 'lmg'].includes(c)) items = items.filter((i) => i.id !== 'tambur');
    }
    if (slot === 'ammo' && c === 'shotgun') items = items.filter((i) => i.id !== 'oyuk');
    return items;
  };

  // Silahın eklentilerle hesaplanmış son değerleri
  function computeStats(id, att, opts) {
    const base = WEAPONS[id];
    if (!base) throw new Error('Bilinmeyen silah: ' + id);
    const s = JSON.parse(JSON.stringify(base));
    s.id = id;
    s.att = {};
    s.suppressed = !!base.suppressedNative;
    s.flashHidden = !!base.suppressedNative;
    s.adsMove = s.cls === 'sniper' || s.cls === 'lmg' ? 0.55 : 0.65;
    s.legs = s.legs || 0.9;
    s.pen = s.pen || 0;
    s.dmgMul = 1;
    let rangeMul = 1, recV = 1, recH = 1, hip = 1, magMul = 1, reloadMul = 1, adsAdd = 0, moveAdd = 0;
    const a = att || {};
    for (const slot of ALL_SLOTS) {
      const want = a[slot];
      if (!want || want === 'none') continue;
      const options = G.attachOptions(id, slot);
      const item = options.find((i) => i.id === want);
      if (!item) continue;
      s.att[slot] = item.id;
      if (item.zoom) {
        s.zoom = item.zoom;
        if (s.cls === 'sniper') s.scope = false;
      }
      if (item.suppressed) s.suppressed = true;
      if (item.flashHidden) s.flashHidden = true;
      if (item.rangeMul) rangeMul *= item.rangeMul;
      if (item.recV) recV *= item.recV;
      if (item.recH) recH *= item.recH;
      if (item.hip) hip *= item.hip;
      if (item.magMul) magMul *= item.magMul;
      if (item.reloadMul) reloadMul *= item.reloadMul;
      if (item.adsTime) adsAdd += item.adsTime;
      if (item.move) moveAdd += item.move;
      if (item.pen) s.pen = Math.max(s.pen, item.pen);
      if (item.burn) s.burn = true;
      if (item.hollow) s.hollow = true;
      if (item.dmgMul) s.dmgMul *= item.dmgMul;
      if (item.bipod) s.bipod = true;
      if (item.drum) s.drumMag = true;
      if (item.noStock) s.noStock = true;
    }
    s.dmg = s.dmg.map(([d, v]) => [d * rangeMul, Math.round(v * s.dmgMul * 10) / 10]);
    s.recV *= recV;
    s.recH *= recH;
    s.hip *= hip;
    if (magMul !== 1) {
      const mags = s.reserve / s.mag;
      s.mag = Math.round(s.mag * magMul);
      s.reserve = Math.round(s.mag * mags);
    }
    s.reload *= reloadMul;
    s.reloadEmpty *= reloadMul;
    s.adsTime = Math.max(0.1, s.adsTime + adsAdd);
    s.move = s.move + moveAdd;
    s.interval = 60 / s.rpm;
    s.camo = (opts && opts.camo) || 'yok';
    if (opts && opts.upgraded) {
      s.upgraded = true;
      s.name = UPGRADE_NAMES[id] || s.name + ' II';
      s.dmg = s.dmg.map(([d, v]) => [d * 1.2, Math.round(v * 2.5)]);
      if (s.projectile) s.projectile = Object.assign({}, s.projectile, { dmg: s.projectile.dmg * 2.5, radius: (s.projectile.radius || 0) * 1.3 });
      if (!s.shellReload && s.mag > 2) s.mag = Math.round(s.mag * 1.5);
      else s.mag = s.mag + 2;
      s.reserve = Math.round(s.reserve * 1.6);
      s.recV *= 0.8;
      s.rpm = Math.round(s.rpm * 1.1);
      s.interval = 60 / s.rpm;
    }
    return s;
  }
  G.computeStats = computeStats;

  function damageAt(stats, dist) {
    const t = stats.dmg;
    let v = t[0][1];
    for (let i = 0; i < t.length; i++) if (dist >= t[i][0]) v = t[i][1];
    return v;
  }
  G.damageAt = damageAt;

  // Silah Ustası çubukları için 0-100 değerleri
  function statBars(s) {
    const maxDmg = (s.projectile ? s.projectile.dmg : s.dmg[0][1]) * (s.pellets || 1);
    const firstDrop = s.dmg.length > 1 ? s.dmg[1][0] : s.projectile ? 60 : 120;
    return {
      Hasar: Math.min(100, Math.round((maxDmg / 160) * 100)),
      Menzil: Math.min(100, Math.round((firstDrop / 50) * 100)),
      'Atış Hızı': Math.min(100, Math.round((s.rpm / 1150) * 100)),
      Kontrol: Math.max(4, Math.min(100, Math.round(100 - (s.recV * 40 + s.recH * 30)))),
      Hareket: Math.max(4, Math.min(100, Math.round(((s.move - 0.78) / 0.28) * 100))),
      'Nişan Hızı': Math.max(5, Math.min(100, Math.round(((0.55 - s.adsTime) / 0.42) * 100))),
    };
  }
  G.statBars = statBars;

  // Öldürme süresi (yakın mesafe, gövde) — kartlarda gösterilir
  G.timeToKill = function (s, dist) {
    if (s.projectile) return s.projectile.dmg >= 150 ? 0 : Infinity;
    const per = G.damageAt(s, dist || 5) * (s.pellets || 1);
    const shots = Math.ceil(150 / Math.max(1, per));
    if (s.mode === 'burst') {
      const bursts = Math.ceil(shots / s.burst);
      return Math.round(((shots - bursts) * (60 / s.rpm) + (bursts - 1) * s.burstDelay) * 1000);
    }
    return Math.round((shots - 1) * (60 / s.rpm) * 1000);
  };

  // ------------------------------------------------------------------
  // KAMUFLAJLAR ve SİLAH SEVİYESİ
  // ------------------------------------------------------------------
  G.CAMOS = [
    { id: 'yok', name: 'Standart', need: 0 },
    { id: 'orman', name: 'Orman', need: 3 },
    { id: 'col', name: 'Çöl', need: 8 },
    { id: 'kent', name: 'Kentsel', need: 15 },
    { id: 'kis', name: 'Kış', need: 25 },
    { id: 'kaplan', name: 'Kızıl Kaplan', need: 40 },
    { id: 'gece', name: 'Gece Dijital', need: 60 },
    { id: 'lale', name: 'Lale', need: 80 },
    { id: 'altin', name: 'Altın', need: 120 },
    { id: 'elmas', name: 'Elmas', need: 200 },
  ];
  G.camoUnlocked = function (camoId, kills) {
    const c = G.CAMOS.find((x) => x.id === camoId);
    return !!c && (kills || 0) >= c.need;
  };
  G.weaponLevel = function (xp) {
    const lv = Math.min(30, Math.floor(Math.sqrt(Math.max(0, xp) / 250)) + 1);
    const cur = Math.pow(lv - 1, 2) * 250, next = Math.pow(lv, 2) * 250;
    return { level: lv, cur: xp - cur, need: lv >= 30 ? 0 : next - cur };
  };

  // ------------------------------------------------------------------
  // YAKIN DÖVÜŞ
  // ------------------------------------------------------------------
  G.MELEE = {
    bicak: { name: 'Savaş Bıçağı', speed: 0.45, range: 2.3, lunge: 3.8, zm: 150, unlock: 1, desc: 'Hızlı ve sessiz.' },
    pala: { name: 'Pala', speed: 0.55, range: 2.6, lunge: 4.0, zm: 300, unlock: 4, desc: 'Geniş yay, güçlü kesik.' },
    sopa: { name: 'Beyzbol Sopası', speed: 0.62, range: 2.7, lunge: 3.6, zm: 350, unlock: 8, desc: 'Ses getirir, iz bırakır.' },
    kurek: { name: 'Askerî Kürek', speed: 0.68, range: 2.8, lunge: 4.2, zm: 420, unlock: 12, desc: 'Siper de kazar, kafa da.' },
    katana: { name: 'Katana', speed: 0.5, range: 2.9, lunge: 4.6, zm: 650, unlock: 20, desc: 'Ustasının elinde rüzgâr gibi.' },
  };

  // ------------------------------------------------------------------
  // EKİPMAN, YETENEKLER, SKOR SERİLERİ
  // ------------------------------------------------------------------
  G.LETHALS = {
    frag: { name: 'Parçalı El Bombası', desc: 'G basılı tut: pimi çekip pişir. 3.2 sn sonra patlar.' },
    semtex: { name: 'Yapışkan Bomba', desc: 'Değdiği yüzeye ve düşmana yapışır, 2.4 sn sonra patlar.' },
    knife: { name: 'Fırlatma Bıçağı', desc: 'Tek vuruşta öldürür, yerçekiminden az etkilenir.' },
  };
  G.TACTICALS = {
    stun: { name: 'Sersemletici', desc: 'Yakındaki düşmanları yavaşlatır, nişanlarını bozar.' },
    smoke: { name: 'Sis Bombası', desc: '14 sn boyunca görüşü engelleyen sis bulutu.' },
  };
  G.PERKS = {
    1: [
      { id: 'hayalet', name: 'Hayalet', desc: 'Düşman İHA’sında görünmezsin.' },
      { id: 'toparlanma', name: 'Hızlı Toparlanma', desc: 'Sağlık yenilenmesi 2 sn erken başlar.' },
      { id: 'ninja', name: 'Ninja', desc: 'Ayak seslerin düşmanlar tarafından duyulmaz.' },
    ],
    2: [
      { id: 'hizlieller', name: 'Hızlı Eller', desc: 'Şarjör ve silah değiştirme %35 hızlı.' },
      { id: 'celikyelek', name: 'Çelik Yelek', desc: 'Patlayıcı hasarı %45 azalır.' },
      { id: 'cephane', name: 'Fazla Cephane', desc: '+2 şarjör ve +1 öldürücü ekipman.' },
    ],
    3: [
      { id: 'ceviklik', name: 'Çeviklik', desc: 'Nişan %25 hızlı, taktik koşu 2 kat uzun.' },
      { id: 'sogukkanli', name: 'Soğukkanlı', desc: 'Vurulunca sarsılma azalır, dürbün salınımı yok.' },
      { id: 'isaretci', name: 'İşaretçi', desc: 'Vurduğun düşmanlar 5 sn haritada görünür.' },
    ],
  };
  G.STREAKS = [
    { id: 'uav', name: 'İHA', cost: 400, desc: '30 sn boyunca düşmanları haritada gösterir.' },
    { id: 'airstrike', name: 'Hava Saldırısı', cost: 750, desc: 'İşaretlediğin hatta 7 bomba bırakır.' },
    { id: 'sentry', name: 'Nöbetçi Taret', cost: 900, desc: '60 sn boyunca bölgeyi savunan otomatik taret.' },
    { id: 'heli', name: 'Saldırı Helikopteri', cost: 1300, desc: '45 sn boyunca düşmanları avlar.' },
  ];

  G.DEFAULT_CLASSES = [
    { name: 'Hücum', primary: 'simsek', pAtt: { optic: 'kirmizi', under: 'dikey', muzzle: 'kompansator' }, pCamo: 'yok', secondary: 'yaver', sAtt: {}, sCamo: 'yok', lethal: 'frag', tactical: 'stun', melee: 'bicak', perks: ['toparlanma', 'hizlieller', 'ceviklik'] },
    { name: 'Yakın Mesafe', primary: 'yaban', pAtt: { barrel: 'kisa', under: 'lazer', mag: 'genis', stock: 'hafif' }, pCamo: 'yok', secondary: 'kobra', sAtt: {}, sCamo: 'yok', lethal: 'semtex', tactical: 'smoke', melee: 'bicak', perks: ['ninja', 'hizlieller', 'ceviklik'] },
    { name: 'Keskin Nişancı', primary: 'dogan', pAtt: { muzzle: 'susturucu', stock: 'agir' }, pCamo: 'yok', secondary: 'yaver', sAtt: { muzzle: 'susturucu' }, sCamo: 'yok', lethal: 'knife', tactical: 'smoke', melee: 'bicak', perks: ['hayalet', 'cephane', 'sogukkanli'] },
  ];

  // ------------------------------------------------------------------
  // GÜNLÜK GÖREVLER
  // ------------------------------------------------------------------
  G.CHALLENGES = [
    { id: 'hs', text: 'Kafadan vuruşla 10 düşman öldür', stat: 'headshot', goal: 10, xp: 1500 },
    { id: 'kill', text: 'Herhangi bir modda 25 düşman öldür', stat: 'kill', goal: 25, xp: 1200 },
    { id: 'tea', text: 'Çay gücü aktifken 5 düşman öldür', stat: 'teaKill', goal: 5, xp: 1000 },
    { id: 'slide', text: 'Kayarken veya dalarken 3 düşman öldür', stat: 'slideKill', goal: 3, xp: 1000 },
    { id: 'zmround', text: 'Zombilerde 5. raunda ulaş', stat: 'zmRound', goal: 5, max: true, xp: 1500 },
    { id: 'zmkill', text: '50 zombi öldür', stat: 'zmKill', goal: 50, xp: 1200 },
    { id: 'melee', text: 'Yakın dövüşle 5 düşman öldür', stat: 'meleeKill', goal: 5, xp: 1200 },
    { id: 'win', text: '2 maç kazan', stat: 'win', goal: 2, xp: 1500 },
    { id: 'range', text: 'Poligon görevinde 1500 puan topla', stat: 'rangeScore', goal: 1500, max: true, xp: 1000 },
    { id: 'streak', text: '3 skor serisi kullan', stat: 'streakUse', goal: 3, xp: 1000 },
    { id: 'story', text: 'Bir hikâye görevini tamamla', stat: 'storyWin', goal: 1, xp: 1500 },
    { id: 'boom', text: 'Patlayıcıyla 5 düşman öldür', stat: 'explosiveKill', goal: 5, xp: 1000 },
    { id: 'long', text: '40 metreden uzaktan 5 düşman öldür', stat: 'longKill', goal: 5, xp: 1200 },
    { id: 'multi', text: '3 kez çifte öldürme yap', stat: 'multiKill', goal: 3, xp: 1200 },
  ];
  G.dailyChallenges = function (dateKey) {
    let seed = 7;
    for (let i = 0; i < dateKey.length; i++) seed = (seed * 131 + dateKey.charCodeAt(i)) >>> 0;
    const pool = G.CHALLENGES.slice();
    const out = [];
    while (out.length < 3 && pool.length) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      out.push(pool.splice(seed % pool.length, 1)[0]);
    }
    return out;
  };

  // ------------------------------------------------------------------
  // OPERATÖRLER
  // ------------------------------------------------------------------
  G.OPERATORS = {
    kurt: { name: 'Kurt', team: 0, role: 'Tim Lideri', bio: 'Sakallı, sessiz, ölümcül. Gölge Timi’nin ilk adamı.', skin: 0xc68a62, beard: 0x3a2a1e, head: 'helmet', face: 'none', unlock: 1 },
    asena: { name: 'Asena', team: 0, role: 'Keskin Nişancı', bio: 'Tim’in gözü. Bir kilometreden çay bardağını vurur.', skin: 0xd8a47f, hair: 0x2a1a12, female: true, head: 'cap', face: 'goggles', unlock: 1 },
    riza: { name: 'Çaycı Rıza', team: 0, role: 'Teknisyen', bio: 'Demlediği çay efsane. Termosu sırtından eksik olmaz.', skin: 0xb8784e, mustache: 0x2a1a10, head: 'beanie', face: 'none', thermos: true, unlock: 3 },
    arda: { name: 'Yüzbaşı Arda', team: 0, role: 'Komutan', bio: 'Harekâtın beyni. Bereyi çıkardığı görülmemiştir.', skin: 0xd09a72, mustache: 0x1e1612, head: 'beret', face: 'none', unlock: 6 },
    bora: { name: 'Bora', team: 0, role: 'Hücumcu', bio: 'Kapıyı ilk o kırar. Gece görüşü hep takılı.', skin: 0xa8714d, head: 'nvg', face: 'balaclava', unlock: 10 },
    ayaz: { name: 'Ayaz', team: 0, role: 'Kış Harekâtı', bio: 'Karlı dağlarda yetişti. Soğukkanlılığı buradan.', skin: 0xe0b48f, head: 'helmet', face: 'balaclava', snow: true, unlock: 15 },
  };
  G.ENEMY_LOOKS = ['gasmask', 'balaclava', 'helmet', 'cap'];

  // ------------------------------------------------------------------
  // ZOMBİ KURALLARI
  // ------------------------------------------------------------------
  G.zombieHealth = function (round) {
    if (round < 10) return 150 + 100 * (round - 1);
    return Math.round(950 * Math.pow(1.1, round - 9));
  };
  G.zombieCount = function (round) {
    const early = [6, 8, 13, 18, 24];
    if (round <= 5) return early[round - 1];
    const r = round - 5;
    return Math.min(24 + r * 5 + Math.floor(r * r * 0.4), 200);
  };
  // 0: yürüyen, 1: koşan, 2: depar atan
  G.zombieSpeedTier = function (round, rnd) {
    const sprint = Math.max(0, Math.min(0.55, (round - 7) * 0.08));
    const run = Math.max(0, Math.min(0.85, (round - 2) * 0.17));
    if (rnd < sprint) return 2;
    if (rnd < sprint + run) return 1;
    return 0;
  };
  G.isDogRound = function (round) {
    return round >= 6 && (round - 6) % 5 === 0;
  };
  G.ZM_PERKS = {
    demirderi: { name: 'Demir Deri', price: 2500, color: 0xd13b2f, desc: 'Sağlık 150 → 300.' },
    hizliel: { name: 'Hızlı El', price: 3000, color: 0x37c26b, desc: 'Şarjör değiştirme %50 hızlı.' },
    ciftatis: { name: 'Çift Atış', price: 2000, color: 0xf2b134, desc: 'Atış hızı +%33, hasar +%25.' },
    cevikbacak: { name: 'Çevik Bacak', price: 2000, color: 0xf07a2a, desc: 'Sınırsız taktik koşu, hızlı hareket.' },
    ikincisans: { name: 'İkinci Şans', price: 1500, color: 0x4aa3ff, desc: 'Yere düşünce bir kez kalkarsın.' },
    demlicay: { name: 'Demli Çay', price: 1500, color: 0xb5541c, desc: 'Çay Ocağı: hasar +%15, her raunt başında 1 bardak çay. Elektrik istemez.', noPower: true },
  };
  G.POWERUPS = {
    cephane: { name: 'Tam Cephane', color: 0x6cff6c },
    tekvurus: { name: 'Tek Vuruş', color: 0xff5050 },
    ciftpuan: { name: 'Çift Puan', color: 0xffd23a },
    nukleer: { name: 'Nükleer', color: 0xffa040 },
    caymolasi: { name: 'Çay Molası', color: 0xd0602a },
  };

  // ------------------------------------------------------------------
  // RÜTBE / XP
  // ------------------------------------------------------------------
  const RANKS = [
    [1, 'Er'], [3, 'Onbaşı'], [6, 'Çavuş'], [10, 'Üstçavuş'], [14, 'Astsubay'],
    [18, 'Asteğmen'], [22, 'Teğmen'], [27, 'Üsteğmen'], [33, 'Yüzbaşı'],
    [40, 'Binbaşı'], [47, 'Yarbay'], [54, 'Albay'], [60, 'Efsane'],
  ];
  G.RANKS = RANKS;
  G.MAX_LEVEL = 60;
  G.xpToNext = (level) => 600 + 120 * level;
  G.levelFromXp = function (xp) {
    let level = 1;
    let rest = Math.max(0, xp);
    while (level < G.MAX_LEVEL && rest >= G.xpToNext(level)) {
      rest -= G.xpToNext(level);
      level++;
    }
    return { level, cur: rest, need: level >= G.MAX_LEVEL ? 0 : G.xpToNext(level) };
  };
  G.rankName = function (level) {
    let name = RANKS[0][1];
    for (const [l, n] of RANKS) if (level >= l) name = n;
    return name;
  };

  // ------------------------------------------------------------------
  // IZGARA YOL BULMA (8 yön, köşe kesmek yok)
  // ------------------------------------------------------------------
  const DIRS = [
    [1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10],
    [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14],
  ];

  function canStep(walk, w, h, x, z, dx, dz) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= w || nz >= h) return false;
    if (!walk[nx + nz * w]) return false;
    if (dx && dz) {
      if (!walk[x + dx + z * w] || !walk[x + (z + dz) * w]) return false;
    }
    return true;
  }
  G.canStep = canStep;

  // Basit ikili yığın
  function Heap() {
    this.k = [];
    this.v = [];
  }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= v[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v;
    const top = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < n && v[l] < v[m]) m = l;
        if (r < n && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.size = function () {
    return this.k.length;
  };

  G.findPath = function (walk, w, h, sx, sz, tx, tz, maxIter) {
    if (sx < 0 || sz < 0 || sx >= w || sz >= h || tx < 0 || tz < 0 || tx >= w || tz >= h) return null;
    if (!walk[tx + tz * w]) return null;
    const N = w * h;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const start = sx + sz * w, goal = tx + tz * w;
    gScore[start] = 0;
    const heap = new Heap();
    const hfn = (x, z) => {
      const dx = Math.abs(x - tx), dz = Math.abs(z - tz);
      return 10 * (dx + dz) - 6 * Math.min(dx, dz);
    };
    heap.push(start, hfn(sx, sz));
    let iter = 0;
    const limit = maxIter || N * 4;
    while (heap.size()) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++iter > limit) return null;
      const cx = cur % w, cz = (cur / w) | 0;
      for (let d = 0; d < 8; d++) {
        const [dx, dz, cost] = DIRS[d];
        if (!canStep(walk, w, h, cx, cz, dx, dz)) continue;
        const n = cx + dx + (cz + dz) * w;
        if (closed[n]) continue;
        const g = gScore[cur] + cost;
        if (g < gScore[n]) {
          gScore[n] = g;
          came[n] = cur;
          heap.push(n, g + hfn(cx + dx, cz + dz));
        }
      }
    }
    if (start !== goal && came[goal] < 0) return null;
    const path = [];
    let c = goal;
    while (c !== -1 && c !== start) {
      path.push([c % w, (c / w) | 0]);
      c = came[c];
    }
    path.push([sx, sz]);
    path.reverse();
    return path;
  };

  // Hedefe olan maliyet alanı (zombi akış alanı için Dijkstra)
  G.distanceField = function (walk, w, h, tx, tz, out) {
    const N = w * h;
    const dist = out && out.length === N ? out : new Float32Array(N);
    dist.fill(Infinity);
    if (tx < 0 || tz < 0 || tx >= w || tz >= h) return dist;
    const heap = new Heap();
    const t = tx + tz * w;
    dist[t] = 0;
    heap.push(t, 0);
    while (heap.size()) {
      const cur = heap.pop();
      const cx = cur % w, cz = (cur / w) | 0;
      const base = dist[cur];
      for (let d = 0; d < 8; d++) {
        const [dx, dz, cost] = DIRS[d];
        if (!canStep(walk, w, h, cx, cz, dx, dz)) continue;
        const n = cx + dx + (cz + dz) * w;
        const nd = base + cost;
        if (nd < dist[n]) {
          dist[n] = nd;
          heap.push(n, nd);
        }
      }
    }
    return dist;
  };

  // Izgara üzerinde düz çizgi geçişi (hücre birimleriyle, ajan yarıçapı payıyla)
  G.gridLine = function (walk, w, h, x0, z0, x1, z1, pad) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 0.2));
    const p = pad == null ? 0.22 : pad;
    const nx = len > 0 ? -dz / len : 0, nz = len > 0 ? dx / len : 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, z = z0 + dz * t;
      for (let o = -1; o <= 1; o++) {
        const cx = Math.floor(x + nx * p * o), cz = Math.floor(z + nz * p * o);
        if (cx < 0 || cz < 0 || cx >= w || cz >= h || !walk[cx + cz * w]) return false;
      }
    }
    return true;
  };

  // ASCII harita → hücre okuma
  G.parseGrid = function (rows) {
    const h = rows.length;
    const w = rows[0].length;
    for (let i = 0; i < h; i++) {
      if (rows[i].length !== w) throw new Error('Harita satır uzunluğu farklı: satır ' + i + ' (' + rows[i].length + ' != ' + w + ')');
    }
    return { w, h, at: (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? '#' : rows[z][x]) };
  };

  // Bot isimleri
  G.BOT_NAMES = {
    ally: ['Atmaca', 'Bora', 'Poyraz', 'Tayfun', 'Doruk', 'Alaz', 'Kaya', 'Ayaz', 'Volkan', 'Toprak', 'Kartal', 'Serhat'],
    enemy: ['Kızıl Tilki', 'Karabasan', 'Sürgün', 'Zehir', 'Kuzgun', 'Akrep', 'Hayalet-7', 'Kemik', 'Duman', 'Pençe', 'Gölgesiz', 'Yılan'],
    ffa: ['Kurt', 'Şahin', 'Bozok', 'Yel', 'Çelik', 'Kor', 'Tolga', 'Kıvılcım', 'Sarp', 'Alp', 'Taş', 'Buz'],
  };
  G.BOT_WEAPONS = [
    ['simsek', 4], ['kasirga', 3], ['tufan', 2], ['bora', 3], ['yildiz', 2], ['kilic', 2.5],
    ['yaban', 3], ['cakal', 2], ['ari', 1.5], ['sahin', 2], ['firtina', 1.5],
    ['gurz', 1.2], ['balyoz', 1], ['tokmak', 0.8],
    ['atmaca', 1.2], ['kartal', 1], ['dogan', 1], ['akdogan', 0.8],
    ['celik', 1.2], ['pala', 0.8], ['gurgen', 1],
  ];
  G.weightedPick = function (pairs, rnd) {
    let total = 0;
    for (const p of pairs) total += p[1];
    let r = (rnd == null ? Math.random() : rnd) * total;
    for (const p of pairs) {
      r -= p[1];
      if (r <= 0) return p[0];
    }
    return pairs[pairs.length - 1][0];
  };
})(typeof window !== 'undefined' ? window : globalThis);
