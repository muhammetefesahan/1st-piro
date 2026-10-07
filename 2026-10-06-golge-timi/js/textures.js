'use strict';
// Gölge Timi — tuval (canvas) ile üretilen sevimli dokular ve malzeme önbelleği.
// "Oyuncak kutusu" görünümü: düz pastel zeminler, yumuşak geçişler, yuvarlak
// köşeli tuğlalar, karolar, kalaslar, puantiyeler ve çimende minik çiçekler.
// Kir, çatlak, pas yok. Duvar/bina dokuları neredeyse beyazdır; renklerini
// köşe renkleri (vertexColors) verir, böylece her bina ayrı bir pastel tonda durur.
(function () {
  const G = window.G;
  const U = G.util;
  const cache = {};
  const S = 256;
  const INK = '#3b2a4a';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }
  // Retro (piksel) görünüm açık mı? Açıkken dokular en yakın komşu süzgeciyle çizilir.
  const retro = () => Math.round((G.settings && G.settings.pixel) || 1) > 1;

  // ---- Çizim yardımcıları ----
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fill(ctx, s, col) {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, s, s);
  }
  // Döşenebilir çizim: kenara yakın şekli karşı kenarda da tekrarla
  function wrap(s, x, y, r, fn) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const px = x + dx * s, py = y + dy * s;
        if (px + r < 0 || py + r < 0 || px - r > s || py - r > s) continue;
        fn(px, py);
      }
  }
  function disc(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function softDisc(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', a));
    g.addColorStop(1, col.replace('A', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function starPath(ctx, x, y, ro, ri, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (rot || -Math.PI / 2) + (i * Math.PI) / n;
      const r = i % 2 ? ri : ro;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
    ctx.closePath();
  }
  function flower(ctx, x, y, r, petal, center) {
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    disc(ctx, x, y, r * 0.42, center);
  }
  // Izgara üzerinde yuvarlak köşeli karolar
  function tiles(ctx, s, nx, ny, gap, rad, colorFn, offsetRows) {
    const tw = s / nx, th = s / ny;
    for (let j = 0; j < ny; j++) {
      const off = offsetRows && j % 2 ? tw / 2 : 0;
      for (let i = -1; i <= nx; i++) {
        const x = i * tw + off, y = j * th;
        if (x + tw < 0 || x > s) continue;
        ctx.fillStyle = colorFn(i, j);
        rr(ctx, x + gap / 2, y + gap / 2, tw - gap, th - gap, rad);
        ctx.fill();
      }
    }
  }
  // Karonun üst kenarında ince parlak çizgi (oyuncak hissi)
  function tileShine(ctx, s, nx, ny, gap, offsetRows, col) {
    const tw = s / nx, th = s / ny;
    ctx.fillStyle = col;
    for (let j = 0; j < ny; j++) {
      const off = offsetRows && j % 2 ? tw / 2 : 0;
      for (let i = -1; i <= nx; i++) {
        const x = i * tw + off, y = j * th;
        rr(ctx, x + gap / 2 + th * 0.12, y + gap / 2 + th * 0.12, tw - gap - th * 0.24, Math.max(2, th * 0.12), th * 0.06);
        ctx.fill();
      }
    }
  }

  const GEN = {
    // Beton: açık panel, yumuşak derzler ve köşelerde minik perçinler (renk köşe renginden)
    beton(ctx, s, rnd) {
      fill(ctx, s, '#efe9f6');
      tiles(ctx, s, 2, 2, 6, 16, () => '#fbf9ff');
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x = i * (s / 2), y = j * (s / 2);
          const g = ctx.createLinearGradient(0, y, 0, y + s / 2);
          g.addColorStop(0, 'rgba(255,255,255,0.7)');
          g.addColorStop(1, 'rgba(236,230,246,0.0)');
          ctx.fillStyle = g;
          rr(ctx, x + 8, y + 8, s / 2 - 16, s / 2 - 16, 12);
          ctx.fill();
          for (const [px, py] of [[18, 18], [s / 2 - 18, 18], [18, s / 2 - 18], [s / 2 - 18, s / 2 - 18]]) {
            disc(ctx, x + px, y + py, 4.5, '#e8e1f1');
            disc(ctx, x + px - 1.5, y + py - 1.5, 2, '#ffffff');
          }
        }
    },
    // Tuğla: oyuncak tuğlalar, yuvarlak köşe ve üstte parlak şerit
    tugla(ctx, s, rnd) {
      fill(ctx, s, '#eee2ee');
      const cols = ['#ffffff', '#fff6f8', '#f8f1fa', '#ffffff'];
      tiles(ctx, s, 4, 8, 6, 7, (i, j) => cols[(i * 3 + j * 5 + 8) % 4], true);
      tileShine(ctx, s, 4, 8, 6, true, 'rgba(255,255,255,0.9)');
      // altta yumuşak gölge
      ctx.fillStyle = 'rgba(214,196,220,0.35)';
      for (let j = 0; j < 8; j++) ctx.fillRect(0, (j + 1) * (s / 8) - 6, s, 2);
    },
    // Sıva (kerpiç): pürüzsüz, çok hafif yumuşak lekeler ve minik yuvarlak süs noktaları
    siva(ctx, s, rnd) {
      fill(ctx, s, '#fffaf4');
      for (let i = 0; i < 10; i++) {
        const x = rnd() * s, y = rnd() * s, r = 40 + rnd() * 50;
        wrap(s, x, y, r, (px, py) => softDisc(ctx, px, py, r, 'rgba(244,230,226,A)', 0.4));
      }
      // koyu benek yerine (kir gibi duruyordu) seyrek, açık renkli minik yıldızlar
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const x = rnd() * s, y = rnd() * s, r = 5 + rnd() * 3;
        wrap(s, x, y, r, (px, py) => {
          starPath(ctx, px, py, r, r * 0.45, 4);
          ctx.fill();
        });
      }
    },
    // Metal: oluklu sac, yumuşak dikey kabartmalar
    metal(ctx, s, rnd) {
      fill(ctx, s, '#f4f1fa');
      const n = 8;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * s, w = s / n;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#e6e0f0');
        g.addColorStop(0.35, '#ffffff');
        g.addColorStop(0.6, '#fbf9ff');
        g.addColorStop(1, '#e6e0f0');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, w, s);
      }
      for (let i = 0; i < n; i++) disc(ctx, (i + 0.5) * (s / n), 12, 3.5, '#ddd5ea');
    },
    // Konteyner: oluklu yüzey, yuvarlak çerçeve; rengi köşe renginden gelir
    konteyner(ctx, s, rnd) {
      fill(ctx, s, '#f6f3fb');
      const n = 12;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * s, w = s / n;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#e9e4f2');
        g.addColorStop(0.45, '#ffffff');
        g.addColorStop(1, '#e9e4f2');
        ctx.fillStyle = g;
        ctx.fillRect(x, 14, w, s - 28);
      }
      ctx.strokeStyle = '#ddd6ea';
      ctx.lineWidth = 10;
      rr(ctx, 5, 5, s - 10, s - 10, 18);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(0, 0, s, 4);
    },
    // Sandık: bal rengi tahta, çerçeve, ortada yıldız çıkartması
    sandik(ctx, s, rnd) {
      fill(ctx, s, '#fbd398');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#fcd9a2' : '#f8cd8e';
        ctx.fillRect(0, (i * s) / 4, s, s / 4);
        ctx.fillStyle = 'rgba(226,160,96,0.5)';
        ctx.fillRect(0, (i * s) / 4, s, 3);
      }
      const b = s * 0.12;
      ctx.strokeStyle = '#eba862';
      ctx.lineWidth = b;
      rr(ctx, b / 2, b / 2, s - b, s - b, b * 0.8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,226,170,0.9)';
      ctx.lineWidth = 3;
      rr(ctx, b * 0.25, b * 0.25, s - b * 0.5, s - b * 0.5, b * 0.7);
      ctx.stroke();
      for (const [px, py] of [[b / 2, b / 2], [s - b / 2, b / 2], [b / 2, s - b / 2], [s - b / 2, s - b / 2]]) {
        disc(ctx, px, py, 6, '#c9803e');
        disc(ctx, px - 1.5, py - 1.5, 2.5, '#ffd9a0');
      }
      // ortada minik yıldız
      ctx.fillStyle = '#ff8b94';
      ctx.strokeStyle = '#ff8b94';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      starPath(ctx, s / 2, s / 2 + 3, s * 0.1, s * 0.045, 5);
      ctx.fill();
      ctx.stroke();
    },
    // Kum torbası: kabarık yastıklar, dikiş çizgileri
    kumtorba(ctx, s, rnd) {
      fill(ctx, s, '#d9bf8c');
      const rows = 4, cw = s / 3, rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cw / 2);
        for (let c = -1; c < 4; c++) {
          const x = c * cw + off + cw / 2, y = r * rh + rh / 2;
          const g = ctx.createRadialGradient(x - cw * 0.12, y - rh * 0.18, 2, x, y, cw * 0.55);
          g.addColorStop(0, '#fff2cf');
          g.addColorStop(0.6, '#f2dcab');
          g.addColorStop(1, '#e2c792');
          ctx.fillStyle = g;
          rr(ctx, x - cw / 2 + 3, y - rh / 2 + 3, cw - 6, rh - 6, rh * 0.42);
          ctx.fill();
          ctx.strokeStyle = 'rgba(196,160,104,0.7)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          rr(ctx, x - cw / 2 + 10, y - rh / 2 + 10, cw - 20, rh - 20, rh * 0.3);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },
    // Asfalt: yumuşak lavanta-gri, büyük yuvarlak karolar ve seyrek açık benekler
    asfalt(ctx, s, rnd) {
      fill(ctx, s, '#8f8bb0');
      tiles(ctx, s, 2, 2, 5, 22, (i, j) => ((i + j) % 2 ? '#9a96b8' : '#9d99bb'));
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) softDisc(ctx, i * (s / 2) + s / 4, j * (s / 2) + s / 4, s * 0.22, 'rgba(176,172,206,A)', 0.35);
      for (let i = 0; i < 30; i++) {
        const x = rnd() * s, y = rnd() * s, r = 1.5 + rnd() * 2;
        wrap(s, x, y, r, (px, py) => disc(ctx, px, py, r, rnd() < 0.5 ? 'rgba(180,176,210,0.9)' : 'rgba(136,132,170,0.8)'));
      }
    },
    // Kum: tereyağı sarısı, yumuşak dalgalar, minik pembe deniz kabukları
    kum(ctx, s, rnd) {
      fill(ctx, s, '#ffd99a');
      for (let i = 0; i < 7; i++) {
        const y0 = (i / 7) * s + rnd() * 10;
        ctx.strokeStyle = i % 2 ? 'rgba(255,236,196,0.9)' : 'rgba(240,196,128,0.55)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let x = 0; x <= s; x += 8) {
          const y = y0 + Math.sin((x / s) * Math.PI * 4 + i) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const x = rnd() * s, y = rnd() * s, r = 2 + rnd() * 2.5;
        wrap(s, x, y, r, (px, py) => disc(ctx, px, py, r, 'rgba(236,184,116,0.75)'));
      }
      for (let i = 0; i < 4; i++) {
        const x = rnd() * s, y = rnd() * s;
        wrap(s, x, y, 8, (px, py) => {
          ctx.fillStyle = '#ffc2b4';
          starPath(ctx, px, py, 6, 3, 5);
          ctx.fill();
        });
      }
    },
    // Çim: parlak yeşil, yuvarlak çim tutamları ve minik çiçekler
    cim(ctx, s, rnd) {
      fill(ctx, s, '#7ed957');
      for (let i = 0; i < 8; i++) {
        const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 40;
        wrap(s, x, y, r, (px, py) => softDisc(ctx, px, py, r, rnd() < 0.5 ? 'rgba(146,230,110,A)' : 'rgba(104,200,72,A)', 0.55));
      }
      ctx.strokeStyle = '#5bbf3a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 46; i++) {
        const x = rnd() * s, y = rnd() * s, h = 6 + rnd() * 5;
        wrap(s, x, y, 12, (px, py) => {
          ctx.beginPath();
          ctx.moveTo(px - h * 0.55, py - h);
          ctx.quadraticCurveTo(px - h * 0.2, py - h * 0.2, px, py);
          ctx.quadraticCurveTo(px + h * 0.2, py - h * 0.2, px + h * 0.55, py - h);
          ctx.stroke();
        });
      }
      const petals = ['#ffffff', '#ffaaa5', '#fff1a8', '#cdb4ff'];
      for (let i = 0; i < 9; i++) {
        const x = rnd() * s, y = rnd() * s, r = 4.5 + rnd() * 2;
        const p = petals[i % petals.length];
        wrap(s, x, y, r * 1.4, (px, py) => flower(ctx, px, py, r, p, '#ffd23f'));
      }
    },
    // Toprak (zombi haritası): yumuşak kakao-pembe, yuvarlak çakıllar, nane tutamları
    toprak(ctx, s, rnd) {
      fill(ctx, s, '#b8978e');
      for (let i = 0; i < 8; i++) {
        const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 40;
        wrap(s, x, y, r, (px, py) => softDisc(ctx, px, py, r, rnd() < 0.5 ? 'rgba(206,174,164,A)' : 'rgba(164,132,124,A)', 0.5));
      }
      for (let i = 0; i < 26; i++) {
        const x = rnd() * s, y = rnd() * s, r = 3 + rnd() * 4;
        wrap(s, x, y, r, (px, py) => {
          disc(ctx, px, py, r, '#cfb0a6');
          disc(ctx, px - r * 0.3, py - r * 0.3, r * 0.4, '#e2c8c0');
        });
      }
      ctx.strokeStyle = '#9fdcb0';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const x = rnd() * s, y = rnd() * s;
        wrap(s, x, y, 10, (px, py) => {
          ctx.beginPath();
          ctx.moveTo(px - 4, py - 7);
          ctx.lineTo(px, py);
          ctx.lineTo(px + 4, py - 7);
          ctx.stroke();
        });
      }
    },
    // Karo (iç zemin): krem/şeftali dama, yuvarlak köşeler
    karo(ctx, s, rnd) {
      fill(ctx, s, '#efd9cf');
      tiles(ctx, s, 4, 4, 4, 8, (i, j) => ((i + j) % 2 ? '#ffe3d3' : '#fff7ec'));
      tileShine(ctx, s, 4, 4, 4, false, 'rgba(255,255,255,0.55)');
    },
    // Laboratuvar zemini: nane/beyaz dama, derz kesişimlerinde minik pembe noktalar
    labzemin(ctx, s, rnd) {
      fill(ctx, s, '#d6eee4');
      tiles(ctx, s, 4, 4, 4, 8, (i, j) => ((i + j) % 2 ? '#c4f0dd' : '#f3fff9'));
      tileShine(ctx, s, 4, 4, 4, false, 'rgba(255,255,255,0.6)');
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) disc(ctx, (i * s) / 4, (j * s) / 4, 4, '#ffb3cf');
    },
    // Laboratuvar duvarı: küçük beyaz fayanslar, nane bant ve ince pembe şerit
    labduvar(ctx, s, rnd) {
      fill(ctx, s, '#e0efe9');
      tiles(ctx, s, 8, 8, 3, 5, () => '#ffffff');
      ctx.fillStyle = '#a8e6cf';
      ctx.fillRect(0, s * 0.62, s, s * 0.09);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, s * 0.62, s, 3);
      ctx.fillStyle = '#ff9ec4';
      ctx.fillRect(0, s * 0.575, s, s * 0.022);
    },
    // Çatı: yuvarlak kiremit sıraları (pul deseni)
    cati(ctx, s, rnd) {
      fill(ctx, s, '#e6d8e6');
      const n = 6, r = s / n / 2, rows = 8, sp = s / rows;
      for (let j = -1; j <= rows; j++) {
        const off = (j + 2) % 2 ? r : 0;
        for (let i = -1; i <= n; i++) {
          const x = i * r * 2 + off + r, y = j * sp;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y + r * 0.2, r - 1.5, 0, Math.PI);
          ctx.lineTo(x - r + 1.5, y - r * 0.6);
          ctx.lineTo(x + r - 1.5, y - r * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(232,218,232,0.9)';
          ctx.beginPath();
          ctx.arc(x, y + r * 0.2, r - 1.5, 0.15, Math.PI - 0.15);
          ctx.arc(x, y + r * 0.05, r - 6, Math.PI - 0.15, 0.15, true);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    // Ahşap: karamel kalaslar, yumuşak damarlar, uçlarda çivi noktaları
    ahsap(ctx, s, rnd) {
      fill(ctx, s, '#c98a4e');
      const planks = 4, ph = s / planks;
      const cols = ['#eaa968', '#f2b676', '#e5a160', '#efb06f'];
      for (let i = 0; i < planks; i++) {
        ctx.fillStyle = cols[i];
        rr(ctx, -6, i * ph + 2, s + 12, ph - 4, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(214,146,84,0.55)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          const y = i * ph + ph * (0.35 + k * 0.3);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(s * 0.3, y - 4, s * 0.6, y + 4, s, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,214,160,0.75)';
        ctx.fillRect(0, i * ph + 4, s, 3);
        disc(ctx, 14, i * ph + ph / 2, 3.5, '#b7763c');
        disc(ctx, s - 14, i * ph + ph / 2, 3.5, '#b7763c');
      }
    },
    // Boya (eski "pas"): araçlar için parlak boya; rengi köşe renginden gelir
    pas(ctx, s, rnd) {
      fill(ctx, s, '#ffffff');
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#fbf9ff');
      g.addColorStop(1, '#e8e2f2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(0, s * 0.22, s, s * 0.06);
      ctx.fillStyle = 'rgba(226,218,240,0.9)';
      ctx.fillRect(0, s * 0.62, s, s * 0.035);
      ctx.fillRect(0, s * 0.7, s, s * 0.035);
    },
  };

  function applyFilter(tex, isRetro, mips) {
    if (isRetro) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = mips === false ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
    } else {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = mips === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    }
  }
  function aniso() {
    const r = G.renderer;
    if (!r || !r.capabilities || !r.capabilities.getMaxAnisotropy) return 1;
    const q = G.settings.quality;
    return Math.min(r.capabilities.getMaxAnisotropy(), q === 'yuksek' ? 8 : q === 'orta' ? 4 : 1);
  }

  function texture(name, size) {
    const isRetro = retro();
    const key = name + ':' + (size || 0) + (isRetro ? ':r' : '');
    if (cache[key]) return cache[key];
    const c = canvas(S);
    const ctx = c.getContext('2d');
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
    const rnd = U.seeded(seed + 7);
    (GEN[name] || GEN.beton)(ctx, S, rnd);
    let src = c;
    // Retro modda küçük ve tıknaz pikseller; aksi halde temiz, tam boy doku
    const px = size || (isRetro ? 64 : S);
    if (px !== S) {
      src = canvas(px);
      const sctx = src.getContext('2d');
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(c, 0, 0, px, px);
    }
    const tex = new THREE.CanvasTexture(src);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    applyFilter(tex, isRetro);
    tex.anisotropy = isRetro ? 1 : aniso();
    tex.gtMips = true;
    cache[key] = tex;
    return tex;
  }
  G.texture = texture;

  // Retro modu değişince önbellekteki dokuların süzgecini güncelle (main.js çağırır)
  G.texFilter = function (isRetro) {
    for (const k in cache) {
      const t = cache[k];
      if (!t || !t.isTexture) continue;
      applyFilter(t, isRetro, !!t.gtMips);
      t.needsUpdate = true;
    }
  };

  // ---- Sevimli (toon) gölgelendirme yardımcıları ----
  // Tüm gruplar aynı basamak haritasını kullanır ki ışık her yerde aynı "çizgi film" tonunda dursun.
  let toonGrad = null;
  G.toonGradient = function () {
    if (toonGrad) return toonGrad;
    const steps = new Uint8Array([150, 205, 255]);
    toonGrad = new THREE.DataTexture(steps, steps.length, 1, THREE.LuminanceFormat);
    toonGrad.minFilter = THREE.NearestFilter;
    toonGrad.magFilter = THREE.NearestFilter;
    toonGrad.generateMipmaps = false;
    toonGrad.needsUpdate = true;
    return toonGrad;
  };
  const toonCache = {};
  // key: önbellek anahtarı (null → önbelleksiz). p: MeshToonMaterial parametreleri
  // (color, map, vertexColors, emissive, emissiveIntensity, transparent, opacity, side, alphaTest...)
  G.toonMat = function (key, p) {
    if (key && toonCache[key]) return toonCache[key];
    const params = Object.assign({ gradientMap: G.toonGradient() }, p || {});
    if (params.emissive != null && !(params.emissive instanceof THREE.Color)) params.emissive = new THREE.Color(params.emissive);
    const m = new THREE.MeshToonMaterial(params);
    if (key) toonCache[key] = m;
    return m;
  };

  const matCache = {};
  // Ortak malzeme fabrikası: her kalitede çizgi film (toon) malzemesi.
  // opts: {color, map (doku adı veya doku), vertexColors, emissive, emissiveIntensity,
  //        transparent, opacity, side, fog}. roughness/metalness/lambert artık yok sayılır.
  G.mat = function (key, opts) {
    const ck = key + ':' + G.settings.quality;
    if (matCache[ck]) return matCache[ck];
    const o = opts || {};
    const params = {
      color: o.color != null ? o.color : 0xffffff,
      vertexColors: !!o.vertexColors,
    };
    if (o.map) params.map = typeof o.map === 'string' ? texture(o.map) : o.map;
    if (o.emissive != null) params.emissive = o.emissive;
    if (o.emissiveIntensity != null) params.emissiveIntensity = o.emissiveIntensity;
    if (o.transparent) {
      params.transparent = true;
      params.opacity = o.opacity != null ? o.opacity : 1;
    }
    if (o.side) params.side = o.side;
    if (o.fog === false) params.fog = false;
    const m = G.toonMat(null, params);
    matCache[ck] = m;
    return m;
  };

  // ---- Parçacık / efekt dokuları ----
  // flash: yıldız patlaması, hole: minik sevimli iz, scorch: yumuşak lila leke, chevron: dost işareti
  G.spriteTex = function (kind) {
    const key = 'sprite:' + kind;
    if (cache[key]) return cache[key];
    const s = 128;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    const h = s / 2;
    if (kind === 'flash') {
      // yumuşak hale + 5 köşeli tombul yıldız + parlak çekirdek (toplamalı karışım için)
      const g0 = ctx.createRadialGradient(h, h, 0, h, h, h);
      g0.addColorStop(0, 'rgba(255,250,220,0.9)');
      g0.addColorStop(0.35, 'rgba(255,214,90,0.45)');
      g0.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, s, s);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(255,226,110,0.95)';
      ctx.strokeStyle = 'rgba(255,226,110,0.95)';
      ctx.lineWidth = 10;
      starPath(ctx, h, h, h * 0.86, h * 0.36, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,240,1)';
      ctx.strokeStyle = 'rgba(255,255,240,1)';
      ctx.lineWidth = 6;
      starPath(ctx, h, h, h * 0.5, h * 0.22, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // küçük ışıltılar
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (const [x, y, r] of [[h + 40, h - 38, 7], [h - 44, h + 30, 5], [h + 34, h + 40, 4]]) {
        starPath(ctx, x, y, r, r * 0.3, 4, 0);
        ctx.fill();
      }
    } else if (kind === 'hole') {
      // minik yumuşak mürdüm iz + parlak nokta (neredeyse "çıkartma" gibi)
      const g = ctx.createRadialGradient(h, h, 0, h, h, h);
      g.addColorStop(0, 'rgba(110,80,140,0.55)');
      g.addColorStop(0.32, 'rgba(110,80,140,0.42)');
      g.addColorStop(0.42, 'rgba(150,120,180,0.18)');
      g.addColorStop(1, 'rgba(150,120,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      starPath(ctx, h - 10, h - 10, 9, 3, 4, 0);
      ctx.fill();
    } else if (kind === 'scorch') {
      // yumuşak lila leke
      const g = ctx.createRadialGradient(h, h, 0, h, h, h);
      g.addColorStop(0, 'rgba(155,127,199,0.55)');
      g.addColorStop(0.55, 'rgba(170,140,210,0.3)');
      g.addColorStop(1, 'rgba(190,160,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,240,250,0.35)';
      for (const [x, y, r] of [[h - 20, h - 16, 6], [h + 18, h + 6, 4], [h - 4, h + 22, 3]]) disc(ctx, x, y, r, 'rgba(255,240,250,0.4)');
    } else if (kind === 'chevron') {
      // yuvarlak köşeli gök mavisi ok: mürdüm kontur + beyaz iç çizgi
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(s * 0.22, s * 0.32);
        ctx.lineTo(s * 0.5, s * 0.6);
        ctx.lineTo(s * 0.78, s * 0.32);
      };
      path();
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.26;
      ctx.stroke();
      path();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = s * 0.19;
      ctx.stroke();
      path();
      ctx.strokeStyle = '#4cc3ff';
      ctx.lineWidth = s * 0.12;
      ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(h, h, 0, h, h, h);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    const tex = new THREE.CanvasTexture(c);
    applyFilter(tex, retro());
    tex.gtMips = true;
    cache[key] = tex;
    return tex;
  };

  // Metin etiketi dokusu (makine adları, hedef mesafeleri, kapı fiyatları)
  // opts: {w, h, size, weight, color, glow (kontur rengi; '#000' → mürdüm), bg (yuvarlak hap zemin),
  //        pill (true veya renk: hap zemin), border (hap kenarı), square (köşeli zemin)}
  G.labelTex = function (text, opts) {
    const o = opts || {};
    const w = o.w || 256, h = o.h || 64;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const size = o.size || 34;
    const bg = o.bg || (o.pill ? (o.pill === true ? '#fffaf3' : o.pill) : null);
    if (bg) {
      ctx.fillStyle = bg;
      if (o.square) ctx.fillRect(0, 0, w, h);
      else {
        const ph = Math.min(h - 6, size * 1.5);
        ctx.font = `${o.weight || 800} ${size}px "Baloo 2", "Nunito", sans-serif`;
        const pw = Math.min(w - 6, ctx.measureText(text).width + size * 1.1);
        rr(ctx, (w - pw) / 2, (h - ph) / 2, pw, ph, ph / 2);
        ctx.fill();
        if (o.border !== false) {
          ctx.strokeStyle = o.border || INK;
          ctx.lineWidth = Math.max(2, size * 0.1);
          ctx.stroke();
        }
      }
    }
    ctx.font = `${o.weight || 800} ${size}px "Baloo 2", "Nunito", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = h / 2 + size * 0.06;
    if (o.glow) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.glow === '#000' || o.glow === '#000000' ? INK : o.glow;
      ctx.lineWidth = Math.max(3, size * 0.22);
      ctx.strokeText(text, w / 2, ty);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(text, w / 2, ty);
    const tex = new THREE.CanvasTexture(c);
    applyFilter(tex, retro(), false);
    tex.generateMipmaps = false;
    return tex;
  };
})();
