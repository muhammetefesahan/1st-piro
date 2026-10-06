'use strict';
// Gölge Timi — saf oyun kuralları: silah verileri, eklentiler, yetenekler,
// zombi formülleri, rütbeler ve ızgara yol bulma. DOM/THREE kullanmaz,
// bu yüzden Node testlerinde doğrudan çalıştırılabilir.
(function (root) {
  const G = (root.G = root.G || {});

  // ------------------------------------------------------------------
  // SİLAHLAR (sağlık: 150)
  // dmg: [mesafe(m), hasar] basamakları. head: kafa çarpanı.
  // ------------------------------------------------------------------
  const ALL_SLOTS = ['optic', 'muzzle', 'barrel', 'under', 'mag'];
  const WEAPONS = {
    simsek: {
      name: 'AR-24 Şimşek', cls: 'ar', clsName: 'Taarruz Tüfeği', slot: 'primary',
      dmg: [[0, 31], [30, 26], [50, 22]], head: 1.35,
      rpm: 750, mode: 'auto', mag: 30, reserve: 150, reload: 2.0, reloadEmpty: 2.6,
      adsTime: 0.24, zoom: 1.25, move: 0.95, hip: 2.3, adsSpread: 0.12, moveSpread: 1.6,
      recV: 0.5, recH: 0.28, sprintFire: 0.22, swap: 0.55, sound: 'ar',
      allowed: ALL_SLOTS,
      look: { body: 0x2a2d30, accent: 0x5b5e57, rec: 0.36, barrel: 0.3, stock: 'full', mag: 'curved', guard: 0.22 },
      zm: { price: 1400, box: 3 },
    },
    kasirga: {
      name: 'KR-9 Kasırga', cls: 'ar', clsName: 'Taarruz Tüfeği', slot: 'primary',
      dmg: [[0, 38], [35, 32], [60, 27]], head: 1.3,
      rpm: 600, mode: 'auto', mag: 30, reserve: 150, reload: 2.2, reloadEmpty: 2.8,
      adsTime: 0.27, zoom: 1.25, move: 0.93, hip: 2.5, adsSpread: 0.14, moveSpread: 1.8,
      recV: 0.7, recH: 0.36, sprintFire: 0.24, swap: 0.6, sound: 'ar2',
      allowed: ALL_SLOTS,
      look: { body: 0x3a3226, accent: 0x6e5636, rec: 0.38, barrel: 0.32, stock: 'full', mag: 'curved', guard: 0.24, wood: true },
      zm: { price: 1600, box: 3 },
    },
    tufan: {
      name: 'TR-3 Tufan', cls: 'ar', clsName: 'Seri Atışlı Tüfek', slot: 'primary',
      dmg: [[0, 40], [40, 34], [65, 29]], head: 1.4,
      rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.3, mag: 30, reserve: 150, reload: 2.1, reloadEmpty: 2.7,
      adsTime: 0.25, zoom: 1.25, move: 0.95, hip: 2.3, adsSpread: 0.1, moveSpread: 1.6,
      recV: 0.45, recH: 0.2, sprintFire: 0.22, swap: 0.55, sound: 'ar3',
      allowed: ALL_SLOTS,
      look: { body: 0x44484a, accent: 0x2b2d2f, rec: 0.34, barrel: 0.34, stock: 'full', mag: 'straight', guard: 0.26 },
      zm: { price: 0, box: 2 },
    },
    yaban: {
      name: 'VX-45 Yaban', cls: 'smg', clsName: 'Hafif Makineli', slot: 'primary',
      dmg: [[0, 28], [12, 24], [25, 18]], head: 1.25,
      rpm: 880, mode: 'auto', mag: 32, reserve: 192, reload: 1.7, reloadEmpty: 2.2,
      adsTime: 0.19, zoom: 1.2, move: 1.0, hip: 1.5, adsSpread: 0.3, moveSpread: 1.0,
      recV: 0.36, recH: 0.34, sprintFire: 0.15, swap: 0.45, sound: 'smg',
      allowed: ALL_SLOTS,
      look: { body: 0x1f2124, accent: 0x3c4046, rec: 0.3, barrel: 0.12, stock: 'folding', mag: 'straight', guard: 0.12 },
      zm: { price: 1000, box: 3 },
    },
    cakal: {
      name: 'Çakal-9', cls: 'smg', clsName: 'Hafif Makineli', slot: 'primary',
      dmg: [[0, 23], [10, 20], [22, 15]], head: 1.3,
      rpm: 1050, mode: 'auto', mag: 40, reserve: 200, reload: 1.9, reloadEmpty: 2.3,
      adsTime: 0.18, zoom: 1.2, move: 1.03, hip: 2.0, adsSpread: 0.35, moveSpread: 1.0,
      recV: 0.3, recH: 0.42, sprintFire: 0.14, swap: 0.42, sound: 'smg2',
      allowed: ALL_SLOTS,
      look: { body: 0x2c3a2c, accent: 0x1c1f1c, rec: 0.26, barrel: 0.1, stock: 'none', mag: 'straight', guard: 0.1 },
      zm: { price: 1100, box: 3 },
    },
    gurz: {
      name: 'Gürz 12', cls: 'shotgun', clsName: 'Pompalı Tüfek', slot: 'primary',
      dmg: [[0, 26], [7, 18], [14, 9], [22, 4]], head: 1.1, pellets: 8, pelletSpread: 4.2,
      rpm: 70, mode: 'semi', pump: true, mag: 6, reserve: 30, reload: 0.5, reloadEmpty: 0.5, shellReload: true,
      adsTime: 0.2, zoom: 1.15, move: 0.97, hip: 4.0, adsSpread: 3.0, moveSpread: 0.6,
      recV: 3.0, recH: 1.0, sprintFire: 0.2, swap: 0.5, sound: 'shotgun',
      allowed: ['optic', 'barrel', 'under', 'mag'],
      look: { body: 0x2a2724, accent: 0x5a3d26, rec: 0.32, barrel: 0.42, stock: 'full', mag: 'tube', guard: 0.2, wood: true },
      zm: { price: 500, box: 2 },
    },
    dogan: {
      name: 'Doğan .338', cls: 'sniper', clsName: 'Keskin Nişancı', slot: 'primary',
      dmg: [[0, 160], [100, 150]], head: 2.0, legs: 0.7,
      rpm: 48, mode: 'semi', bolt: true, mag: 5, reserve: 25, reload: 3.0, reloadEmpty: 3.6,
      adsTime: 0.42, zoom: 5.5, scope: true, move: 0.88, hip: 8, adsSpread: 0, moveSpread: 3,
      recV: 3.5, recH: 0.6, sprintFire: 0.32, swap: 0.7, sound: 'sniper',
      allowed: ['muzzle', 'barrel', 'under', 'mag'],
      look: { body: 0x3b4034, accent: 0x23261f, rec: 0.42, barrel: 0.55, stock: 'full', mag: 'box', guard: 0.3, scope: true },
      zm: { price: 0, box: 2 },
    },
    atmaca: {
      name: 'Atmaca DMR', cls: 'dmr', clsName: 'Nişancı Tüfeği', slot: 'primary',
      dmg: [[0, 55], [40, 50], [80, 44]], head: 1.6,
      rpm: 300, mode: 'semi', mag: 15, reserve: 75, reload: 2.4, reloadEmpty: 2.9,
      adsTime: 0.32, zoom: 1.3, move: 0.9, hip: 4, adsSpread: 0.05, moveSpread: 2.2,
      recV: 1.2, recH: 0.4, sprintFire: 0.26, swap: 0.6, sound: 'dmr',
      allowed: ALL_SLOTS,
      look: { body: 0x2e2f2a, accent: 0x7a6a4a, rec: 0.4, barrel: 0.42, stock: 'full', mag: 'straight', guard: 0.3 },
      zm: { price: 500, box: 2 },
    },
    celik: {
      name: 'Çelik LMG-100', cls: 'lmg', clsName: 'Hafif Makineli Tüfek', slot: 'primary',
      dmg: [[0, 32], [40, 28], [70, 24]], head: 1.3,
      rpm: 650, mode: 'auto', mag: 100, reserve: 200, reload: 5.0, reloadEmpty: 5.5,
      adsTime: 0.38, zoom: 1.25, move: 0.84, hip: 3.5, adsSpread: 0.25, moveSpread: 2.4,
      recV: 0.55, recH: 0.4, sprintFire: 0.34, swap: 0.8, sound: 'lmg',
      allowed: ALL_SLOTS,
      look: { body: 0x32352f, accent: 0x1e201c, rec: 0.46, barrel: 0.4, stock: 'full', mag: 'drum', guard: 0.3 },
      zm: { price: 0, box: 2 },
    },
    yaver: {
      name: 'P-9 Yaver', cls: 'pistol', clsName: 'Tabanca', slot: 'secondary',
      dmg: [[0, 34], [10, 28], [22, 20]], head: 1.4,
      rpm: 400, mode: 'semi', mag: 12, reserve: 72, reload: 1.4, reloadEmpty: 1.8,
      adsTime: 0.14, zoom: 1.15, move: 1.05, hip: 1.8, adsSpread: 0.3, moveSpread: 0.8,
      recV: 1.0, recH: 0.4, sprintFire: 0.1, swap: 0.3, sound: 'pistol',
      allowed: ['optic', 'muzzle', 'mag'],
      look: { body: 0x1d1e20, accent: 0x3a3c40, pistol: true },
      zm: { price: 0, box: 0 },
    },
    kobra: {
      name: 'Kobra .50', cls: 'pistol', clsName: 'Ağır Tabanca', slot: 'secondary',
      dmg: [[0, 75], [15, 60], [30, 45]], head: 1.5,
      rpm: 150, mode: 'semi', mag: 6, reserve: 36, reload: 2.6, reloadEmpty: 2.6,
      adsTime: 0.18, zoom: 1.15, move: 1.02, hip: 2.4, adsSpread: 0.4, moveSpread: 1.0,
      recV: 3.0, recH: 0.8, sprintFire: 0.12, swap: 0.35, sound: 'magnum',
      allowed: ['optic', 'mag'],
      look: { body: 0x8a8d90, accent: 0x2a2a2a, pistol: true, revolver: true },
      zm: { price: 0, box: 2 },
    },
    yildirim: {
      name: 'Yıldırım Roketatar', cls: 'launcher', clsName: 'Roketatar', slot: 'secondary',
      dmg: [[0, 220]], head: 1,
      rpm: 40, mode: 'semi', mag: 1, reserve: 3, reload: 3.2, reloadEmpty: 3.2,
      adsTime: 0.4, zoom: 1.3, move: 0.9, hip: 4, adsSpread: 0.2, moveSpread: 1,
      recV: 4, recH: 1, sprintFire: 0.35, swap: 0.8, sound: 'rocket',
      projectile: { type: 'rocket', speed: 48, radius: 5.5, dmg: 220 },
      allowed: [],
      look: { body: 0x3d4a33, accent: 0x222622, launcher: true },
      zm: { price: 0, box: 1 },
    },
    plazma: {
      name: 'Plazma Tabancası', cls: 'wonder', clsName: 'Deneysel', slot: 'secondary',
      dmg: [[0, 600]], head: 1,
      rpm: 260, mode: 'semi', mag: 20, reserve: 160, reload: 2.6, reloadEmpty: 2.6,
      adsTime: 0.2, zoom: 1.2, move: 1.0, hip: 1.5, adsSpread: 0.2, moveSpread: 0.5,
      recV: 1.2, recH: 0.4, sprintFire: 0.12, swap: 0.4, sound: 'plasma',
      projectile: { type: 'plasma', speed: 70, radius: 2.4, dmg: 600 },
      allowed: [],
      look: { body: 0x3a3f4a, accent: 0x39ff9a, wonder: true, pistol: true },
      zm: { price: 0, box: 0.6 },
      zmOnly: true,
    },
  };
  for (const id in WEAPONS) WEAPONS[id].id = id;
  G.WEAPONS = WEAPONS;

  const UPGRADE_NAMES = {
    simsek: 'Fırtına Çağıran', kasirga: 'Kara Kasırga', tufan: 'Üçlü Hüküm', yaban: 'Vahşi Sürü',
    cakal: 'Çakal Kralı', gurz: 'Yıkım Gürzü', dogan: 'Ölüm Doğanı', atmaca: 'Altın Atmaca',
    celik: 'Demir Yağmur', yaver: 'Sadık Yaver', kobra: 'Kral Kobra', yildirim: 'Gök Gürültüsü',
    plazma: 'Plazma Fırtınası',
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
        { id: 'kirmizi', name: 'Kırmızı Nokta', desc: 'Net nokta, hafif yakınlaştırma.', zoom: 1.35, adsTime: 0.02 },
        { id: 'holo', name: 'Holografik', desc: 'Geniş görüş halkası.', zoom: 1.3, adsTime: 0.02 },
        { id: 'durbun', name: '3x Taktik Dürbün', desc: 'Uzun menzil için 3 kat büyütme.', zoom: 2.6, adsTime: 0.07 },
      ],
    },
    muzzle: {
      label: 'Namlu Ağzı',
      items: [
        { id: 'none', name: 'Yok' },
        { id: 'susturucu', name: 'Susturucu', desc: 'Atışlar haritada görünmez, menzil -%10.', suppressed: true, rangeMul: 0.9, adsTime: 0.01 },
        { id: 'kompansator', name: 'Kompansatör', desc: 'Dikey tepme -%20.', recV: 0.8, recH: 0.92 },
        { id: 'alev', name: 'Alev Gizleyici', desc: 'Namlu alevi gizlenir, yatay tepme -%15.', flashHidden: true, recH: 0.85 },
      ],
    },
    barrel: {
      label: 'Namlu',
      items: [
        { id: 'none', name: 'Standart Namlu' },
        { id: 'uzun', name: 'Uzun Namlu', desc: 'Menzil +%25, nişan alma biraz yavaşlar.', rangeMul: 1.25, adsTime: 0.03, move: -0.02 },
        { id: 'kisa', name: 'Kısa Namlu', desc: 'Hızlı nişan, kalçadan daha isabetli, menzil -%15.', rangeMul: 0.85, adsTime: -0.03, hip: 0.85, move: 0.02 },
      ],
    },
    under: {
      label: 'Alt Bağlantı',
      items: [
        { id: 'none', name: 'Yok' },
        { id: 'dikey', name: 'Dikey Kabza', desc: 'Dikey tepme -%18.', recV: 0.82 },
        { id: 'acili', name: 'Açılı Kabza', desc: 'Nişan alma hızlanır, yatay tepme -%10.', adsTime: -0.04, recH: 0.9 },
        { id: 'lazer', name: 'Taktik Lazer', desc: 'Kalçadan atış sapması -%30.', hip: 0.7 },
      ],
    },
    mag: {
      label: 'Şarjör',
      items: [
        { id: 'none', name: 'Standart Şarjör' },
        { id: 'genis', name: 'Geniş Şarjör', desc: 'Kapasite +%50, doldurma yavaşlar.', magMul: 1.5, reloadMul: 1.15, adsTime: 0.02, move: -0.01 },
        { id: 'hizli', name: 'Hızlı Şarjör', desc: 'Doldurma süresi -%28.', reloadMul: 0.72 },
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

  // Silahın eklentilerle hesaplanmış son değerleri
  function computeStats(id, att, opts) {
    const base = WEAPONS[id];
    if (!base) throw new Error('Bilinmeyen silah: ' + id);
    const s = JSON.parse(JSON.stringify(base));
    s.id = id;
    s.att = {};
    s.suppressed = false;
    s.flashHidden = false;
    s.adsMove = s.cls === 'sniper' || s.cls === 'lmg' ? 0.55 : 0.65;
    s.legs = s.legs || 0.9;
    let rangeMul = 1, recV = 1, recH = 1, hip = 1, magMul = 1, reloadMul = 1, adsAdd = 0, moveAdd = 0;
    const a = att || {};
    for (const slot of ALL_SLOTS) {
      if (!base.allowed.includes(slot)) continue;
      const item = findAttach(slot, a[slot] || 'none');
      if (!item || item.id === 'none') continue;
      if (slot === 'optic' && base.cls === 'shotgun' && item.id === 'durbun') continue;
      if (slot === 'optic' && base.cls === 'pistol' && item.id !== 'kirmizi') continue;
      s.att[slot] = item.id;
      if (item.zoom) s.zoom = item.zoom;
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
    }
    s.dmg = s.dmg.map(([d, v]) => [d * rangeMul, v]);
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
    if (opts && opts.upgraded) {
      s.upgraded = true;
      s.name = UPGRADE_NAMES[id] || s.name + ' II';
      s.dmg = s.dmg.map(([d, v]) => [d * 1.2, Math.round(v * 2.5)]);
      if (s.projectile) s.projectile = Object.assign({}, s.projectile, { dmg: s.projectile.dmg * 2.5, radius: s.projectile.radius * 1.3 });
      if (!s.shellReload) s.mag = Math.round(s.mag * 1.5);
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
    const maxDmg = s.dmg[0][1] * (s.pellets || 1);
    const firstDrop = s.dmg.length > 1 ? s.dmg[1][0] : 120;
    return {
      Hasar: Math.min(100, Math.round((maxDmg / 160) * 100)),
      Menzil: Math.min(100, Math.round((firstDrop / 50) * 100)),
      'Atış Hızı': Math.min(100, Math.round((s.rpm / 1050) * 100)),
      Kontrol: Math.max(4, Math.min(100, Math.round(100 - (s.recV * 40 + s.recH * 30)))),
      Hareket: Math.min(100, Math.round(((s.move - 0.8) / 0.25) * 100)),
      'Nişan Hızı': Math.max(5, Math.min(100, Math.round(((0.45 - s.adsTime) / 0.33) * 100))),
    };
  }
  G.statBars = statBars;

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
    { name: 'Hücum', primary: 'simsek', pAtt: { optic: 'kirmizi', under: 'dikey' }, secondary: 'yaver', sAtt: {}, lethal: 'frag', tactical: 'stun', perks: ['toparlanma', 'hizlieller', 'ceviklik'] },
    { name: 'Yakın Mesafe', primary: 'yaban', pAtt: { barrel: 'kisa', under: 'lazer', mag: 'genis' }, secondary: 'kobra', sAtt: {}, lethal: 'semtex', tactical: 'smoke', perks: ['ninja', 'hizlieller', 'ceviklik'] },
    { name: 'Keskin Nişancı', primary: 'dogan', pAtt: { muzzle: 'susturucu' }, secondary: 'yaver', sAtt: { muzzle: 'susturucu' }, lethal: 'knife', tactical: 'smoke', perks: ['hayalet', 'cephane', 'sogukkanli'] },
  ];

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
    ['simsek', 4], ['kasirga', 3], ['tufan', 2], ['yaban', 3], ['cakal', 2], ['gurz', 1.5], ['atmaca', 1.2], ['dogan', 1], ['celik', 1.2],
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
