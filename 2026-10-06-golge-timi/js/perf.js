'use strict';
// Gölge Timi — performans yöneticisi: kare süresine göre çizim çözünürlüğünü
// ayarlar (telefonlarda akıcılık için). main.js her karede G.perf.update(dt) çağırır,
// G.onResize ise G.perf.scale çarpanını kullanır.
//  - Kare süresi zamana bağlı üstel ortalama ile yumuşatılır (G.perf.ft ms, G.perf.fps).
//  - Ölçek basamaklarla değişir; düşürme/yükseltme için ayrı eşikler (histerezis) ve
//    en az ~2 sn bekleme var. Düşürmeden sonra yükseltme bir süre (giderek uzayan) kilitlenir.
//  - Telefon en düşük ölçekte 10 sn boyunca ~24 FPS altında kalırsa grafik kalitesi
//    bir kez 'dusuk'e indirilir.
(function () {
  const G = window.G;

  const dpr = Math.max(0.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const mobile = !!G.isMobile;
  const MIN = 0.5;
  const MAX = mobile ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
  // izin verilen basamaklar (MAX her zaman son basamak)
  const STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2].filter((v) => v < MAX - 0.01);
  STEPS.push(MAX);

  // eşikler (ms): bunun üstü yavaş, altı rahat
  const SLOW_MS = mobile ? 1000 / 40 : 1000 / 48;
  const FAST_MS = mobile ? 1000 / 54 : 1000 / 57;
  const STEP_GAP = 2; // sn — iki değişiklik arası en az
  const SLOW_HOLD = 1.2; // sn — yavaşlık bu kadar sürerse düşür
  const FAST_HOLD = 4; // sn — rahatlık bu kadar sürerse yükselt
  const LOW_FPS = 24, LOW_HOLD = 10;

  function nearestStep(v) {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < STEPS.length; i++) {
      const d = Math.abs(STEPS[i] - v);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  const P = (G.perf = {
    scale: 1,
    min: MIN,
    max: MAX,
    ft: 16.7, // yumuşatılmış kare süresi (ms)
    fps: 60,
    step: 0,
    slowT: 0,
    fastT: 0,
    lowT: 0,
    sinceChange: 0,
    raiseLock: 0, // sn — düşürmeden sonra yükseltme yasağı
    lockLen: 8,
    warm: 1.5, // sn — başlangıç / sahne değişimi sonrası ölçüm yok
    lastState: null,
    autoLowered: !!(G.store && G.store.get('perfAutoLow', false)),
    enabled: true,

    setStep(i, why) {
      i = Math.max(0, Math.min(STEPS.length - 1, i));
      if (i === P.step && P.scale === STEPS[i]) return;
      P.step = i;
      P.scale = STEPS[i];
      P.sinceChange = 0;
      P.slowT = 0;
      P.fastT = 0;
      P.lastWhy = why || '';
      if (G.onResize) {
        try {
          G.onResize();
        } catch (e) { /* yoksay */ }
      }
    },

    update(dt) {
      if (!P.enabled || !(dt > 0)) return;
      // sekme değişimi / yükleme takılması: ölçüme katma
      if (dt > 1 || (typeof document !== 'undefined' && document.hidden)) {
        P.warm = Math.max(P.warm, 0.5);
        return;
      }
      if (dt > 0.25) dt = 0.25; // tek bir takılma ortalamayı bozmasın
      if (G.state !== P.lastState) {
        P.lastState = G.state;
        P.warm = Math.max(P.warm, 1.5);
        P.lowT = 0;
      }
      const ms = dt * 1000;
      // zamana bağlı yumuşatma (~0.5 sn)
      const a = 1 - Math.exp(-dt / 0.5);
      P.ft += (ms - P.ft) * a;
      P.fps = 1000 / Math.max(1, P.ft);
      if (P.warm > 0) {
        P.warm -= dt;
        return;
      }
      P.sinceChange += dt;
      if (P.raiseLock > 0) P.raiseLock -= dt;

      if (P.ft > SLOW_MS) {
        P.slowT += dt;
        P.fastT = 0;
      } else if (P.ft < FAST_MS) {
        P.fastT += dt;
        P.slowT = Math.max(0, P.slowT - dt);
      } else {
        P.slowT = Math.max(0, P.slowT - dt * 0.5);
        P.fastT = Math.max(0, P.fastT - dt * 0.5);
      }
      if (P.sinceChange >= STEP_GAP) {
        if (P.slowT >= SLOW_HOLD && P.step > 0) {
          // çok yavaşsa iki basamak birden in
          P.setStep(P.step - (P.ft > SLOW_MS * 1.6 && P.step > 1 ? 2 : 1), 'yavaş');
          P.raiseLock = P.lockLen;
          P.lockLen = Math.min(60, P.lockLen * 1.6);
          P.warm = 0.4;
        } else if (P.fastT >= FAST_HOLD && P.raiseLock <= 0 && P.step < STEPS.length - 1) {
          P.setStep(P.step + 1, 'rahat');
          P.warm = 0.4;
        }
      }

      // telefon en düşük ölçekte hâlâ çok yavaşsa: kaliteyi bir kez düşür
      if (mobile && !P.autoLowered && G.state === 'playing' && P.step === 0 && P.fps < LOW_FPS) {
        P.lowT += dt;
        if (P.lowT >= LOW_HOLD && G.settings.quality !== 'dusuk') {
          P.autoLowered = true;
          G.settings.quality = 'dusuk';
          if (G.saveSettings) G.saveSettings();
          if (G.store) G.store.set('perfAutoLow', true);
          if (G.onResize) {
            try {
              G.onResize();
            } catch (e) { /* yoksay */ }
          }
          if (G.ui && G.ui.toast) G.ui.toast('Akıcılık için grafik kalitesi düşürüldü');
        }
      } else {
        P.lowT = Math.max(0, P.lowT - dt * 2);
      }
    },

    // sahne değişiminde (maç başı vb.) ölçümleri sıfırla, ölçeği koru
    reset() {
      P.warm = 1.5;
      P.slowT = 0;
      P.fastT = 0;
      P.lowT = 0;
    },
  });

  // başlangıç: telefonda 1x (MAX küçükse MAX), masaüstünde 1x — sonra uyarlanır
  P.step = nearestStep(Math.min(1, MAX));
  P.scale = STEPS[P.step];
  P.steps = STEPS;
})();
