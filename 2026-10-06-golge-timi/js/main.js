'use strict';
// Gölge Timi — başlatma, piksel-art görüntü hattı (düşük çözünürlük + kontur +
// renk basamaklama), menü arka planı ve ana döngü.
(function () {
  const G = window.G;
  const U = G.util;

  function boot() {
    const msg = document.getElementById('boot-msg');
    if (!window.THREE) {
      msg.textContent = '3D motoru yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.';
      return;
    }
    const canvas = (G.canvas = document.getElementById('game'));
    if (G.isTouch) document.body.classList.add('touch');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (e) {
      msg.textContent = 'Bu cihaz WebGL desteklemiyor; oyun çalışamıyor.';
      return;
    }
    G.renderer = renderer;
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = G.settings.quality !== 'dusuk';
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const camera = (G.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600));
    const vmScene = new THREE.Scene();
    const vmCam = new THREE.PerspectiveCamera(52, 16 / 9, 0.01, 10);
    G.vm = new G.ViewModel(vmScene);

    // ---------------- Son işlem ----------------
    const post = {
      scene: new THREE.Scene(),
      cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      mat: new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: null },
          tDepth: { value: null },
          tVM: { value: null },
          res: { value: new THREE.Vector2(1, 1) },
          near: { value: 0.05 },
          far: { value: 600 },
          outline: { value: 0.55 },
          levels: { value: 24 },
          dither: { value: 0.6 },
          dmg: { value: 0 },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tVM;',
          'uniform vec2 res; uniform float near; uniform float far; uniform float outline; uniform float levels; uniform float dither;',
          'varying vec2 vUv;',
          'float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }',
          'float bayer(vec2 p){',
          ' vec2 q = mod(floor(p), 4.0);',
          ' float i = q.x + q.y * 4.0;',
          ' if (i < 1.0) return 0.0; if (i < 2.0) return 8.0; if (i < 3.0) return 2.0; if (i < 4.0) return 10.0;',
          ' if (i < 5.0) return 12.0; if (i < 6.0) return 4.0; if (i < 7.0) return 14.0; if (i < 8.0) return 6.0;',
          ' if (i < 9.0) return 3.0; if (i < 10.0) return 11.0; if (i < 11.0) return 1.0; if (i < 12.0) return 9.0;',
          ' if (i < 13.0) return 15.0; if (i < 14.0) return 7.0; if (i < 15.0) return 13.0; return 5.0;',
          '}',
          'void main(){',
          ' vec2 px = 1.0 / res;',
          ' vec3 c = texture2D(tColor, vUv).rgb;',
          ' if (outline > 0.0) {',
          '  float d = lin(texture2D(tDepth, vUv).r);',
          '  float m = max(max(lin(texture2D(tDepth, vUv + vec2(px.x, 0.0)).r), lin(texture2D(tDepth, vUv - vec2(px.x, 0.0)).r)),',
          '               max(lin(texture2D(tDepth, vUv + vec2(0.0, px.y)).r), lin(texture2D(tDepth, vUv - vec2(0.0, px.y)).r)));',
          '  float e = (m - d) / max(d, 0.001);',
          '  if (e > 0.18 && d < far * 0.5) c *= (1.0 - outline * clamp((e - 0.18) * 4.0, 0.0, 1.0));',
          ' }',
          ' vec4 vm = texture2D(tVM, vUv);',
          ' float op = step(0.98, vm.a);',
          ' if (outline > 0.0 && op < 0.5) {',
          '  float n = max(max(texture2D(tVM, vUv + vec2(px.x, 0.0)).a, texture2D(tVM, vUv - vec2(px.x, 0.0)).a), max(texture2D(tVM, vUv + vec2(0.0, px.y)).a, texture2D(tVM, vUv - vec2(0.0, px.y)).a));',
          '  if (n > 0.98) c *= 0.25;',
          ' }',
          ' c = c * (1.0 - op) + vm.rgb;',
          ' gl_FragColor = vec4(c, 1.0);',
          '}',
        ].join('\n'),
        depthTest: false,
        depthWrite: false,
      }),
    };
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    post.bright = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, threshold: { value: 0.72 } },
      vertexShader: VS,
      fragmentShader: 'uniform sampler2D tColor; uniform float threshold; varying vec2 vUv; void main(){ vec3 c = texture2D(tColor, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(threshold, 1.0, l), 1.0); }',
      depthTest: false,
      depthWrite: false,
    });
    post.blur = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, dir: { value: new THREE.Vector2(1, 0) } },
      vertexShader: VS,
      fragmentShader: [
        'uniform sampler2D tColor; uniform vec2 dir; varying vec2 vUv;',
        'void main(){',
        ' vec3 c = texture2D(tColor, vUv).rgb * 0.227;',
        ' c += texture2D(tColor, vUv + dir * 1.385).rgb * 0.316; c += texture2D(tColor, vUv - dir * 1.385).rgb * 0.316;',
        ' c += texture2D(tColor, vUv + dir * 3.23).rgb * 0.07; c += texture2D(tColor, vUv - dir * 3.23).rgb * 0.07;',
        ' gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });
    post.final = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tBloom: { value: null },
        bloom: { value: 0.6 },
        levels: { value: 32 },
        dither: { value: 0.55 },
        sat: { value: 1.1 },
        con: { value: 1.06 },
        tint: { value: new THREE.Color(1, 1, 1) },
        lift: { value: new THREE.Color(0, 0, 0) },
        vig: { value: 0.35 },
      },
      vertexShader: VS,
      fragmentShader: [
        'uniform sampler2D tColor; uniform sampler2D tBloom; uniform float bloom; uniform float levels; uniform float dither;',
        'uniform float sat; uniform float con; uniform vec3 tint; uniform vec3 lift; uniform float vig; varying vec2 vUv;',
        'float bayer(vec2 p){',
        ' vec2 q = mod(floor(p), 4.0);',
        ' float i = q.x + q.y * 4.0;',
        ' if (i < 1.0) return 0.0; if (i < 2.0) return 8.0; if (i < 3.0) return 2.0; if (i < 4.0) return 10.0;',
        ' if (i < 5.0) return 12.0; if (i < 6.0) return 4.0; if (i < 7.0) return 14.0; if (i < 8.0) return 6.0;',
        ' if (i < 9.0) return 3.0; if (i < 10.0) return 11.0; if (i < 11.0) return 1.0; if (i < 12.0) return 9.0;',
        ' if (i < 13.0) return 15.0; if (i < 14.0) return 7.0; if (i < 15.0) return 13.0; return 5.0;',
        '}',
        'void main(){',
        ' vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * bloom;',
        ' float l = dot(c, vec3(0.299, 0.587, 0.114));',
        ' c = mix(vec3(l), c, sat);',
        ' c = (c - 0.5) * con + 0.5;',
        ' c = c * tint + lift * (1.0 - l);',
        ' vec2 q = vUv - 0.5;',
        ' c *= 1.0 - dot(q, q) * vig * 1.6;',
        ' float b = (bayer(gl_FragCoord.xy) / 16.0 - 0.5) * dither;',
        ' c = floor(clamp(c, 0.0, 1.0) * levels + 0.5 + b) / levels;',
        ' gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });
    post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat);
    post.scene.add(post.quad);
    function pass(material, target) {
      post.quad.material = material;
      renderer.setRenderTarget(target);
      renderer.render(post.scene, post.cam);
    }
    let curGrade = null;
    G.setGrade = function (g) {
      const u = post.final.uniforms;
      const d = (curGrade = g || {});
      u.sat.value = d.sat != null ? d.sat : 1.1;
      u.con.value = d.con != null ? d.con : 1.06;
      u.tint.value.setHex(d.tint != null ? d.tint : 0xffffff);
      u.lift.value.setHex(d.lift != null ? d.lift : 0x000000);
      u.bloom.value = G.settings.bloom === false ? 0 : d.bloom != null ? d.bloom : 0.6;
    };
    let rtWorld = null, rtVM = null, rtComp = null, rtA = null, rtB = null;
    let W = 0, H = 0;

    function makeTargets() {
      if (rtWorld) {
        rtWorld.dispose();
        rtWorld.depthTexture.dispose();
        rtVM.dispose();
        rtComp.dispose();
        rtA.dispose();
        rtB.dispose();
      }
      const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
      rtWorld = new THREE.WebGLRenderTarget(W, H, opts);
      rtWorld.depthTexture = new THREE.DepthTexture(W, H);
      rtWorld.depthTexture.type = THREE.UnsignedIntType;
      rtVM = new THREE.WebGLRenderTarget(W, H, opts);
      rtComp = new THREE.WebGLRenderTarget(W, H, opts);
      const half = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      rtA = new THREE.WebGLRenderTarget(Math.max(1, W >> 1), Math.max(1, H >> 1), half);
      rtB = new THREE.WebGLRenderTarget(Math.max(1, W >> 1), Math.max(1, H >> 1), half);
      post.bright.uniforms.tColor.value = rtComp.texture;
      post.final.uniforms.tColor.value = rtComp.texture;
      post.final.uniforms.tBloom.value = rtA.texture;
      post.mat.uniforms.tColor.value = rtWorld.texture;
      post.mat.uniforms.tDepth.value = rtWorld.depthTexture;
      post.mat.uniforms.tVM.value = rtVM.texture;
      post.mat.uniforms.res.value.set(W, H);
    }

    G.onResize = function () {
      const px = Math.max(1, Math.round(G.settings.pixel || 1));
      const rs = (G.perf && G.perf.scale) || 1; // uyarlanır çözünürlük (perf.js)
      const w = window.innerWidth, h = window.innerHeight;
      const nw = Math.max(160, Math.floor((w * rs) / px)), nh = Math.max(90, Math.floor((h * rs) / px));
      document.body.classList.toggle('retro', px > 1);
      if (nw !== W || nh !== H) {
        W = nw;
        H = nh;
        renderer.setSize(W, H, false);
        makeTargets();
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      vmCam.aspect = w / h;
      vmCam.updateProjectionMatrix();
      post.final.uniforms.levels.value = G.settings.levels || 32;
      if (G.setGrade) G.setGrade(curGrade);
      post.mat.uniforms.outline.value = G.settings.outline ? 0.55 : 0;
      renderer.shadowMap.enabled = G.settings.quality !== 'dusuk';
      G.renderH = H;
      const portrait = G.isTouch && h > w;
      document.getElementById('rotate-hint').hidden = !(portrait && G.state === 'playing');
    };
    window.addEventListener('resize', G.onResize);
    G.onResize();

    function render(scene, withVM) {
      post.mat.uniforms.near.value = camera.near;
      post.mat.uniforms.far.value = camera.far;
      renderer.setRenderTarget(rtWorld);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(rtVM);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      if (withVM) renderer.render(vmScene, vmCam);
      pass(post.mat, rtComp);
      if (post.final.uniforms.bloom.value > 0) {
        pass(post.bright, rtA);
        post.blur.uniforms.tColor.value = rtA.texture;
        post.blur.uniforms.dir.value.set(1 / rtA.width, 0);
        pass(post.blur, rtB);
        post.blur.uniforms.tColor.value = rtB.texture;
        post.blur.uniforms.dir.value.set(0, 1 / rtA.height);
        pass(post.blur, rtA);
      }
      pass(post.final, null);
    }

    // ---------------- Menü arka planı ----------------
    const menu = {};
    function buildMenu() {
      menu.scene = new THREE.Scene();
      menu.world = new G.World(G.MAPS.liman);
      menu.world.build(menu.scene);
      G.setGrade(G.MAPS.liman.theme.grade);
      G.fx.init(menu.scene);
      G.refreshOperator();
    }
    G.refreshOperator = function () {
      if (!menu.scene) return;
      if (menu.op) menu.scene.remove(menu.op.root);
      let photoTex = null;
      const photo = G.settings.photo ? G.store.get('photo', null) : null;
      if (photo) {
        const img = new Image();
        photoTex = new THREE.Texture(img);
        img.onload = () => (photoTex.needsUpdate = true);
        img.src = photo;
      }
      const cls = G.getClass(0);
      menu.op = G.makeHumanoid({ kind: 'soldier', look: 0, weapon: G.computeStats(cls.primary, cls.pAtt, { camo: cls.pCamo }), photoTex, operator: G.settings.operator || 'kurt' });
      menu.op.root.position.set(17, 0, 53);
      menu.op.root.rotation.y = -0.55;
      menu.scene.add(menu.op.root);
    };
    let menuT = 0;
    function updateMenu(dt) {
      menuT += dt;
      const op = menu.op;
      if (op) {
        op.animate(dt, { speed: 0, crouch: 0, pitch: -0.25 + Math.sin(menuT * 0.8) * 0.02 });
        op.torso.rotation.z = Math.sin(menuT * 1.1) * 0.015;
      }
      const tx = 17, tz = 53;
      const a = 2.35 + Math.sin(menuT * 0.12) * 0.12;
      camera.position.set(tx + Math.sin(a) * 4.2, 1.55 + Math.sin(menuT * 0.3) * 0.05, tz + Math.cos(a) * 4.2);
      const look = new THREE.Vector3(tx - Math.cos(a) * 1.4, 1.25, tz + Math.sin(a) * 1.4);
      camera.lookAt(look);
      if (camera.fov !== 50) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
      G.time += dt;
      menu.world.update(dt, camera.position);
    }

    // ---------------- Harita görüntüleri (menü kartları, yükleme ekranı) ----------------
    // Her harita bir kez kurulur, tam görüntü hattından geçirilip küçük bir resme çevrilir.
    const SHOT_VIEWS = {
      liman: { from: [0.06, 7.5, 0.94], to: [0.5, 1.5, 0.42] },
      col: { from: [0.3, 10, 0.97], to: [0.55, 0, 0.38] },
      us: { from: [0.5, 6.5, 0.97], to: [0.5, 1, 0.45] },
      tesis: { from: [0.5, 2.2, 0.55], to: [0.5, 1.6, 0.2] },
      poligon: { from: [0.5, 2.4, 0.97], to: [0.5, 1.4, 0.3] },
    };
    G.mapShots = {};
    const shotQueue = [];
    let lastShot = 0;
    G.queueMapShots = function (ids) {
      for (const id of ids) if (G.MAPS[id] && !G.mapShots[id] && !shotQueue.includes(id)) shotQueue.push(id);
    };
    function takeShot(id) {
      const def = G.MAPS[id];
      const v = SHOT_VIEWS[id] || { from: [0.1, 7, 0.9], to: [0.5, 1.5, 0.5] };
      const scene = new THREE.Scene();
      let world = null;
      try {
        world = new G.World(def);
        world.build(scene);
        const fx = v.from, tx = v.to;
        camera.position.set(fx[0] * world.sizeX, fx[1], fx[2] * world.sizeZ);
        camera.lookAt(tx[0] * world.sizeX, tx[1], tx[2] * world.sizeZ);
        camera.fov = 62;
        camera.updateProjectionMatrix();
        world.update(1 / 60, camera.position);
        G.setGrade(def.theme.grade);
        render(scene, false);
        const src = renderer.domElement;
        const cw = 480, ch = 270;
        const sw = Math.min(src.width, (src.height * 16) / 9), sh = (sw * 9) / 16;
        const c = document.createElement('canvas');
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, cw, ch);
        G.mapShots[id] = c.toDataURL('image/jpeg', 0.86);
      } catch (e) {
        G.mapShots[id] = '';
      }
      if (world) {
        world.dispose(scene);
        if (world.sun && world.sun.shadow && world.sun.shadow.map) world.sun.shadow.map.dispose();
      }
      G.setGrade(G.MAPS.liman.theme.grade);
      renderer.toneMappingExposure = G.MAPS.liman.theme.exposure || 1;
      G.emit('mapshot', id);
    }

    // ---------------- Döngü ----------------
    G.state = 'menu';
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      if (G.perf) G.perf.update((now - last) / 1000);
      last = now;
      const m = G.game;
      if (m && (G.state === 'playing' || G.state === 'ended') && m.world) {
        const live = G.state === 'playing' && (!G.ui.paused || m.mode === 'online');
        if (live) {
          G.time += dt;
          m.update(dt);
        }
        m.world.update(live ? dt : 0, camera.position);
        G.fx.update(live ? dt : 0, camera, H);
        G.hud.update(dt);
        vmCam.fov = 52 - (m.player.adsT || 0) * 8;
        vmCam.updateProjectionMatrix();
        render(m.scene, m.player.alive);
      } else {
        if (!menu.scene) buildMenu();
        if (shotQueue.length && G.state === 'menu' && now - lastShot > 220) {
          takeShot(shotQueue.shift());
          lastShot = performance.now();
        }
        updateMenu(dt);
        G.fx.update(dt, camera, H);
        render(menu.scene, false);
      }
      G.ui.updatePreview(dt);
      G.input.endFrame();
    }

    G.hud.init();
    G.ui.init();
    msg.textContent = 'Hazır.';
    document.getElementById('boot-start').disabled = false;
    requestAnimationFrame(frame);
  }

  // Görüntüleyici canlı güncellemesi: kaybedilecek durum az, menüden başlar
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) {
    try {
      hot.snapshot(() => ({ screen: G.ui && G.ui.screen }));
    } catch (e) { /* yoksay */ }
  }
  if (hot && hot.ready) {
    try {
      hot.ready(() => boot());
    } catch (e) {
      boot();
    }
  } else boot();
})();
