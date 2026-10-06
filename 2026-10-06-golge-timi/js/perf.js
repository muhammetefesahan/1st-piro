'use strict';
// Gölge Timi — performans yöneticisi: kare süresine göre çizim çözünürlüğünü
// ayarlar (telefonlarda akıcılık için). main.js her karede G.perf.update(dt) çağırır,
// G.onResize ise G.perf.scale çarpanını kullanır.
(function () {
  const G = window.G;
  G.perf = {
    scale: 1,
    update(dt) {},
    reset() {},
  };
})();
