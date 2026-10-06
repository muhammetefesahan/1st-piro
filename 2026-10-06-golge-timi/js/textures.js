'use strict';
// Gölge Timi — tuval (canvas) ile üretilen dokular ve malzeme önbelleği.
(function () {
  const G = window.G;
  const U = G.util;
  const cache = {};

  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function noise(ctx, size, rnd, amount, alpha, dark) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * amount;
      d[i] = U.clamp(d[i] + n, 0, 255);
      d[i + 1] = U.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = U.clamp(d[i + 2] + n * (dark ? 0.8 : 1), 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  function blotches(ctx, size, rnd, count, color, rMin, rMax, alpha) {
    for (let i = 0; i < count; i++) {
      const x = rnd() * size, y = rnd() * size, r = rMin + rnd() * (rMax - rMin);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color.replace('A', alpha));
      g.addColorStop(1, color.replace('A', 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function crack(ctx, rnd, x, y, len, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    let a = rnd() * Math.PI * 2;
    for (let i = 0; i < len; i++) {
      a += (rnd() - 0.5) * 1.2;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const GEN = {
    beton(ctx, s, rnd) {
      ctx.fillStyle = '#85857f';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rnd, 40, 'rgba(60,60,58,A)', 10, 60, 0.18);
      blotches(ctx, s, rnd, 30, 'rgba(170,168,160,A)', 10, 50, 0.15);
      noise(ctx, s, rnd, 34);
      // panel derzleri
      ctx.strokeStyle = 'rgba(40,40,40,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, s, s);
      ctx.beginPath();
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.stroke();
      for (let i = 0; i < 5; i++) crack(ctx, rnd, rnd() * s, rnd() * s, 8, 'rgba(30,30,30,0.35)');
      // pas akıntısı
      for (let i = 0; i < 6; i++) {
        const x = rnd() * s;
        const g = ctx.createLinearGradient(0, s / 2, 0, s / 2 + 80);
        g.addColorStop(0, 'rgba(90,60,30,0.25)');
        g.addColorStop(1, 'rgba(90,60,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, s / 2, 3 + rnd() * 5, 80);
      }
    },
    tugla(ctx, s, rnd) {
      ctx.fillStyle = '#5f5650';
      ctx.fillRect(0, 0, s, s);
      const bh = s / 16, bw = s / 6;
      for (let r = 0; r < 16; r++) {
        const off = (r % 2) * bw * 0.5;
        for (let c = -1; c < 7; c++) {
          const v = 0.75 + rnd() * 0.35;
          const R = Math.round(132 * v), Gc = Math.round(70 * v), B = Math.round(52 * v);
          ctx.fillStyle = `rgb(${R},${Gc},${B})`;
          ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
        }
      }
      blotches(ctx, s, rnd, 25, 'rgba(30,25,22,A)', 20, 70, 0.22);
      noise(ctx, s, rnd, 26);
    },
    siva(ctx, s, rnd) {
      ctx.fillStyle = '#c8a77a';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rnd, 50, 'rgba(150,115,80,A)', 15, 70, 0.25);
      blotches(ctx, s, rnd, 30, 'rgba(235,215,180,A)', 10, 50, 0.3);
      noise(ctx, s, rnd, 22);
      for (let i = 0; i < 8; i++) crack(ctx, rnd, rnd() * s, rnd() * s, 10, 'rgba(90,65,40,0.4)');
      // dökülmüş sıva altından tuğla
      for (let i = 0; i < 3; i++) {
        const x = rnd() * s, y = rnd() * s;
        ctx.fillStyle = 'rgba(140,85,60,0.55)';
        for (let k = 0; k < 4; k++) ctx.fillRect(x + (k % 2) * 14, y + k * 8, 26, 6);
      }
    },
    metal(ctx, s, rnd) {
      ctx.fillStyle = '#4a4f55';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += s / 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, 0, s / 32, s);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + s / 32, 0, 2, s);
      }
      blotches(ctx, s, rnd, 30, 'rgba(110,70,40,A)', 8, 40, 0.3);
      noise(ctx, s, rnd, 20);
    },
    konteyner(ctx, s, rnd) {
      // gri tonlu: köşe renkleriyle çarpılır
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(0, 0, s, s);
      const n = 22;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * s;
        const g = ctx.createLinearGradient(x, 0, x + s / n, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.0)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
        g.addColorStop(1, 'rgba(255,255,255,0.15)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, s / n, s);
      }
      for (let i = 0; i < 14; i++) {
        const x = rnd() * s, y = rnd() * s * 0.6;
        const g = ctx.createLinearGradient(0, y, 0, y + 120);
        g.addColorStop(0, 'rgba(110,60,25,0.55)');
        g.addColorStop(1, 'rgba(110,60,25,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 3 + rnd() * 6, 120);
      }
      ctx.strokeStyle = 'rgba(40,40,40,0.5)';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, s, s);
      noise(ctx, s, rnd, 18);
    },
    sandik(ctx, s, rnd) {
      ctx.fillStyle = '#8a6239';
      ctx.fillRect(0, 0, s, s);
      const planks = 6;
      for (let i = 0; i < planks; i++) {
        const v = 0.85 + rnd() * 0.25;
        ctx.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(104 * v)},${Math.round(60 * v)})`;
        ctx.fillRect(0, (i * s) / planks + 2, s, s / planks - 4);
        for (let k = 0; k < 18; k++) {
          ctx.fillStyle = 'rgba(70,45,25,0.25)';
          ctx.fillRect(rnd() * s, (i * s) / planks + rnd() * (s / planks), 20 + rnd() * 60, 1.5);
        }
      }
      ctx.fillStyle = '#6b4826';
      const b = s * 0.1;
      ctx.fillRect(0, 0, s, b);
      ctx.fillRect(0, s - b, s, b);
      ctx.fillRect(0, 0, b, s);
      ctx.fillRect(s - b, 0, b, s);
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s * 0.7, -b / 2, s * 1.4, b);
      ctx.restore();
      ctx.fillStyle = 'rgba(30,30,30,0.7)';
      ctx.font = `bold ${s * 0.09}px monospace`;
      ctx.fillText('GT-' + Math.floor(rnd() * 900 + 100), b * 1.4, s - b * 1.5);
      noise(ctx, s, rnd, 20);
    },
    kumtorba(ctx, s, rnd) {
      ctx.fillStyle = '#7d6c4c';
      ctx.fillRect(0, 0, s, s);
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (s / 6);
        for (let c = -1; c < 4; c++) {
          const x = c * (s / 3) + off, y = r * (s / rows);
          const g = ctx.createRadialGradient(x + s / 6, y + s / rows / 2, 2, x + s / 6, y + s / rows / 2, s / 5);
          g.addColorStop(0, '#b5a07a');
          g.addColorStop(1, '#6c5c40');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + s / 6, y + s / rows / 2, s / 6.4, s / rows / 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      noise(ctx, s, rnd, 26);
    },
    asfalt(ctx, s, rnd) {
      ctx.fillStyle = '#3c3d3e';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, rnd, 40);
      blotches(ctx, s, rnd, 20, 'rgba(20,20,20,A)', 20, 90, 0.3);
      blotches(ctx, s, rnd, 15, 'rgba(110,110,105,A)', 10, 40, 0.15);
      for (let i = 0; i < 6; i++) crack(ctx, rnd, rnd() * s, rnd() * s, 14, 'rgba(15,15,15,0.5)');
      ctx.fillStyle = 'rgba(200,170,60,0.35)';
      ctx.fillRect(0, s * 0.48, s * 0.4, 6);
    },
    kum(ctx, s, rnd) {
      ctx.fillStyle = '#c9a874';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(150,120,80,${0.1 + rnd() * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const y = rnd() * s;
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 5);
        ctx.stroke();
      }
      blotches(ctx, s, rnd, 30, 'rgba(120,95,60,A)', 15, 60, 0.2);
      noise(ctx, s, rnd, 30);
    },
    cim(ctx, s, rnd) {
      ctx.fillStyle = '#5a6b3a';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rnd, 40, 'rgba(110,95,55,A)', 15, 70, 0.35);
      blotches(ctx, s, rnd, 30, 'rgba(70,95,40,A)', 15, 60, 0.35);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = `rgba(${60 + rnd() * 50},${80 + rnd() * 60},${30 + rnd() * 20},0.6)`;
        ctx.fillRect(rnd() * s, rnd() * s, 1.5, 4 + rnd() * 4);
      }
      noise(ctx, s, rnd, 20);
    },
    toprak(ctx, s, rnd) {
      ctx.fillStyle = '#3a3029';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rnd, 40, 'rgba(20,16,14,A)', 15, 60, 0.4);
      blotches(ctx, s, rnd, 20, 'rgba(70,60,50,A)', 10, 40, 0.3);
      noise(ctx, s, rnd, 36);
    },
    karo(ctx, s, rnd) {
      ctx.fillStyle = '#6f6a62';
      ctx.fillRect(0, 0, s, s);
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 0.85 + rnd() * 0.2;
          ctx.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(142 * v)},${Math.round(128 * v)})`;
          ctx.fillRect((i * s) / n + 2, (j * s) / n + 2, s / n - 4, s / n - 4);
        }
      blotches(ctx, s, rnd, 25, 'rgba(40,35,30,A)', 10, 60, 0.3);
      noise(ctx, s, rnd, 18);
    },
    labzemin(ctx, s, rnd) {
      ctx.fillStyle = '#2d3032';
      ctx.fillRect(0, 0, s, s);
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 0.8 + rnd() * 0.25;
          ctx.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(126 * v)},${Math.round(124 * v)})`;
          ctx.fillRect((i * s) / n + 2, (j * s) / n + 2, s / n - 4, s / n - 4);
        }
      blotches(ctx, s, rnd, 8, 'rgba(90,10,10,A)', 10, 50, 0.5);
      blotches(ctx, s, rnd, 30, 'rgba(20,20,20,A)', 10, 60, 0.35);
      noise(ctx, s, rnd, 18);
    },
    labduvar(ctx, s, rnd) {
      ctx.fillStyle = '#8d948f';
      ctx.fillRect(0, 0, s, s);
      const n = 8;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 0.85 + rnd() * 0.18;
          ctx.fillStyle = `rgb(${Math.round(170 * v)},${Math.round(178 * v)},${Math.round(170 * v)})`;
          ctx.fillRect((i * s) / n + 1, (j * s) / n + 1, s / n - 2, s / n - 2);
        }
      ctx.fillStyle = '#3d4a44';
      ctx.fillRect(0, s * 0.62, s, s * 0.06);
      blotches(ctx, s, rnd, 10, 'rgba(100,10,10,A)', 8, 40, 0.55);
      blotches(ctx, s, rnd, 30, 'rgba(40,45,35,A)', 10, 60, 0.35);
      for (let i = 0; i < 5; i++) {
        const x = rnd() * s;
        ctx.fillStyle = 'rgba(110,15,15,0.45)';
        ctx.fillRect(x, s * 0.2 + rnd() * s * 0.3, 2, 40 + rnd() * 70);
      }
      noise(ctx, s, rnd, 16);
    },
    cati(ctx, s, rnd) {
      ctx.fillStyle = '#3a3c3e';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += s / 12) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, 0, 3, s);
      }
      noise(ctx, s, rnd, 20);
    },
    ahsap(ctx, s, rnd) {
      ctx.fillStyle = '#5a3d24';
      ctx.fillRect(0, 0, s, s);
      const planks = 5;
      for (let i = 0; i < planks; i++) {
        const v = 0.8 + rnd() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(82 * v)},${Math.round(48 * v)})`;
        ctx.save();
        ctx.translate(s / 2, ((i + 0.5) * s) / planks);
        ctx.rotate((rnd() - 0.5) * 0.25);
        ctx.fillRect(-s * 0.6, -s / planks / 2 + 3, s * 1.2, s / planks - 8);
        ctx.restore();
      }
      noise(ctx, s, rnd, 22);
    },
    pas(ctx, s, rnd) {
      ctx.fillStyle = '#5b3a24';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rnd, 50, 'rgba(140,80,40,A)', 10, 50, 0.45);
      blotches(ctx, s, rnd, 30, 'rgba(40,30,25,A)', 10, 60, 0.45);
      noise(ctx, s, rnd, 40);
    },
  };

  function posterize(ctx, size, levels) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    const st = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / st) * st;
      d[i + 1] = Math.round(d[i + 1] / st) * st;
      d[i + 2] = Math.round(d[i + 2] / st) * st;
    }
    ctx.putImageData(img, 0, 0);
  }

  function texture(name, size) {
    const key = name + ':' + (size || 0);
    if (cache[key]) return cache[key];
    // Önce ayrıntılı üret, sonra piksel-art için küçült ve renkleri basamakla
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
    const rnd = U.seeded(seed + 7);
    (GEN[name] || GEN.beton)(ctx, s, rnd);
    const px = size || 64;
    const small = canvas(px);
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(c, 0, 0, px, px);
    posterize(sctx, px, 14);
    const tex = new THREE.CanvasTexture(small);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    cache[key] = tex;
    return tex;
  }
  G.texture = texture;

  const matCache = {};
  // Ortak malzeme fabrikası
  G.mat = function (key, opts) {
    const q = G.settings.quality;
    const ck = key + ':' + q;
    if (matCache[ck]) return matCache[ck];
    const o = opts || {};
    const params = {
      color: o.color != null ? o.color : 0xffffff,
      vertexColors: !!o.vertexColors,
    };
    if (o.map) params.map = texture(o.map);
    if (o.emissive != null) params.emissive = new THREE.Color(o.emissive);
    if (o.emissiveIntensity != null) params.emissiveIntensity = o.emissiveIntensity;
    if (o.transparent) {
      params.transparent = true;
      params.opacity = o.opacity != null ? o.opacity : 1;
    }
    if (o.side) params.side = o.side;
    let m;
    if (q === 'dusuk' || o.lambert) {
      m = new THREE.MeshLambertMaterial(params);
    } else {
      params.roughness = o.roughness != null ? o.roughness : 0.88;
      params.metalness = o.metalness != null ? o.metalness : 0.05;
      m = new THREE.MeshStandardMaterial(params);
    }
    matCache[ck] = m;
    return m;
  };

  // Parçacık / efekt dokuları
  G.spriteTex = function (kind) {
    const key = 'sprite:' + kind;
    if (cache[key]) return cache[key];
    const s = 128;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    if (kind === 'flash') {
      ctx.translate(s / 2, s / 2);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        const g = ctx.createLinearGradient(0, 0, s / 2, 0);
        g.addColorStop(0, 'rgba(255,240,200,1)');
        g.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(s / 2, 0);
        ctx.lineTo(0, 6);
        ctx.fill();
      }
      const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 4);
      g2.addColorStop(0, 'rgba(255,255,230,1)');
      g2.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(-s / 2, -s / 2, s, s);
    } else if (kind === 'hole') {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(10,10,10,1)');
      g.addColorStop(0.25, 'rgba(20,18,16,0.95)');
      g.addColorStop(0.45, 'rgba(60,55,50,0.5)');
      g.addColorStop(1, 'rgba(60,55,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    } else if (kind === 'scorch') {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.6, 'rgba(15,10,5,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    } else if (kind === 'chevron') {
      ctx.fillStyle = '#4cc3ff';
      ctx.beginPath();
      ctx.moveTo(s * 0.2, s * 0.3);
      ctx.lineTo(s * 0.5, s * 0.6);
      ctx.lineTo(s * 0.8, s * 0.3);
      ctx.lineTo(s * 0.8, s * 0.48);
      ctx.lineTo(s * 0.5, s * 0.78);
      ctx.lineTo(s * 0.2, s * 0.48);
      ctx.closePath();
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    cache[key] = tex;
    return tex;
  };

  // Metin etiketi dokusu (makine adları, hedef mesafeleri)
  G.labelTex = function (text, opts) {
    const o = opts || {};
    const w = o.w || 256, h = o.h || 64;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (o.bg) {
      ctx.fillStyle = o.bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.font = `${o.weight || 700} ${o.size || 34}px "Pixelify Sans", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = 14;
    }
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();
