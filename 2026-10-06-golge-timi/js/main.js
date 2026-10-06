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
          ' float b = (bayer(gl_FragCoord.xy) / 16.0 - 0.5) * dither;',
          ' c = floor(clamp(c, 0.0, 1.0) * levels + 0.5 + b) / levels;',
          ' gl_FragColor = vec4(c, 1.0);',
          '}',
        ].join('\n'),
        depthTest: false,
        depthWrite: false,
      }),
    };
    post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat));
    let rtWorld = null, rtVM = null;
    let W = 0, H = 0;

    function makeTargets() {
      if (rtWorld) {
        rtWorld.dispose();
        rtWorld.depthTexture.dispose();
        rtVM.dispose();
      }
      const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
      rtWorld = new THREE.WebGLRenderTarget(W, H, opts);
      rtWorld.depthTexture = new THREE.DepthTexture(W, H);
      rtWorld.depthTexture.type = THREE.UnsignedIntType;
      rtVM = new THREE.WebGLRenderTarget(W, H, opts);
      post.mat.uniforms.tColor.value = rtWorld.texture;
      post.mat.uniforms.tDepth.value = rtWorld.depthTexture;
      post.mat.uniforms.tVM.value = rtVM.texture;
      post.mat.uniforms.res.value.set(W, H);
    }

    G.onResize = function () {
      const px = Math.max(1, Math.round(G.settings.pixel || 3));
      const w = window.innerWidth, h = window.innerHeight;
      const nw = Math.max(160, Math.floor(w / px)), nh = Math.max(90, Math.floor(h / px));
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
      post.mat.uniforms.levels.value = G.settings.levels || 24;
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
      renderer.setRenderTarget(null);
      renderer.render(post.scene, post.cam);
    }

    // ---------------- Menü arka planı ----------------
    const menu = {};
    function buildMenu() {
      menu.scene = new THREE.Scene();
      menu.world = new G.World(G.MAPS.liman);
      menu.world.build(menu.scene);
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
      menu.op = G.makeHumanoid({ kind: 'soldier', look: 0, weapon: G.computeStats(cls.primary, cls.pAtt), photoTex });
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

    // ---------------- Döngü ----------------
    G.state = 'menu';
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
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
        updateMenu(dt);
        G.fx.update(dt, camera, H);
        render(menu.scene, false);
        G.ui.updatePreview(dt);
      }
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
