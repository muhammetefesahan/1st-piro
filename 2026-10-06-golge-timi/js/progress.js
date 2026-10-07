'use strict';
// Gölge Timi — ilerleme: silah başına öldürme/XP, kamuflaj kilitleri,
// madalya sayaçları ve günlük görevler. Veriler yalnızca bu cihazda saklanır.
(function () {
  const G = window.G;

  const P = (G.progress = {});
  const DEFAULT = { weapons: {}, medals: {}, daily: { key: '', prog: {}, done: {} } };
  P.data = Object.assign({}, DEFAULT, G.store.get('progress', {}));
  P.save = () => G.store.set('progress', P.data);

  P.weapon = function (id) {
    return P.data.weapons[id] || { kills: 0, hs: 0, xp: 0 };
  };

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  P.ensureDaily = function () {
    const key = todayKey();
    if (P.data.daily.key !== key) P.data.daily = { key, prog: {}, done: {} };
    return P.data.daily;
  };
  P.daily = function () {
    const d = P.ensureDaily();
    return G.dailyChallenges(d.key).map((c) => Object.assign({}, c, { prog: d.prog[c.id] || 0, done: !!d.done[c.id] }));
  };

  // stat: görev istatistiği; isMax: en yüksek değer olarak tut
  P.stat = function (stat, amount, isMax) {
    const d = P.ensureDaily();
    for (const c of G.dailyChallenges(d.key)) {
      if (c.stat !== stat || d.done[c.id]) continue;
      const cur = d.prog[c.id] || 0;
      d.prog[c.id] = isMax || c.max ? Math.max(cur, amount) : cur + amount;
      if (d.prog[c.id] >= c.goal) {
        d.done[c.id] = true;
        G.profile.xp += c.xp;
        G.saveProfile();
        if (G.hud && G.hud.medal) G.hud.medal('Günlük görev tamam: ' + c.text, c.xp);
        if (G.audio) G.audio.play('levelUp', { priority: true });
      }
    }
    P.save();
  };

  P.medal = function (name) {
    P.data.medals[name] = (P.data.medals[name] || 0) + 1;
  };

  // Oyuncunun her öldürmesinde
  P.kill = function (weaponId, info, flags) {
    const f = flags || {};
    if (weaponId && G.WEAPONS[weaponId]) {
      const w = (P.data.weapons[weaponId] = Object.assign({ kills: 0, hs: 0, xp: 0 }, P.data.weapons[weaponId]));
      const before = w.kills;
      w.kills++;
      if (info.headshot) w.hs++;
      w.xp += 100 + (info.headshot ? 50 : 0);
      for (const c of G.CAMOS) {
        if (c.need > 0 && before < c.need && w.kills >= c.need && G.hud) G.hud.medal(`Yeni kamuflaj: ${c.name} (${G.WEAPONS[weaponId].name})`);
      }
    }
    if (f.zombie) P.stat('zmKill', 1);
    else P.stat('kill', 1);
    if (info.headshot) P.stat('headshot', 1);
    if (f.tea) P.stat('teaKill', 1);
    if (f.slide) P.stat('slideKill', 1);
    if (info.melee) P.stat('meleeKill', 1);
    if (info.explosive && !info.streak) P.stat('explosiveKill', 1);
    if (info.dist > 40) P.stat('longKill', 1);
    P.save();
  };
})();
