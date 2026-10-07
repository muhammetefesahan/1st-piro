'use strict';
// Gölge Timi — başlatma, çizgi film görüntü hattı (mürdüm kontur + yumuşak ışıma +
// neşeli renk ayarı + FXAA kenar yumuşatma), isteğe bağlı retro piksel görünümü,
// menü arka planı ve ana döngü.
(function () {
  const G = window.G;
  const U = G.util;
  const INK = 0x3b2a4a; // kontur rengi: koyu mürdüm (asla saf siyah değil)

  // Pastel renkleri olduğu gibi koruyan yumuşak omuzlu ton eğrisi:
  // 0.76'ya kadar doğrusal, üstü beyaza doğru yumuşakça kıvrılır (ACES kadar soldurmaz).
  function setupToneMap() {
    try {
      const chunk = THREE.ShaderChunk && THREE.ShaderChunk.tonemapping_pars_fragment;
      const re = /vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/;
      if (THREE.CustomToneMapping != null && chunk && re.test(chunk)) {
        THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
          re,
          'vec3 CustomToneMapping( vec3 color ) { color *= toneMappingExposure; vec3 k = vec3( 0.76 ); vec3 hi = k + ( 1.0 - k ) * ( 1.0 - exp( -( color - k ) / ( 1.0 - k ) ) ); return mix( color, hi, step( k, color ) ); }'
        );
        return THREE.CustomToneMapping;
      }
    } catch (e) { /* eski motor: ACES ile devam */ }
    return THREE.ACESFilmicToneMapping;
  }

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
    renderer.toneMapping = setupToneMap();
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = G.settings.quality !== 'dusuk';
    // PCF + yarıçap: yumuşak kenarlı, lila tonlu gölgeler (yarıçapı world.js ayarlar)
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const camera = (G.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600));
    const vmScene = new THREE.Scene();
    const vmCam = new THREE.PerspectiveCamera(52, 16 / 9, 0.01, 10);
    G.vm = new G.ViewModel(vmScene);

    // ---------------- Son işlem ----------------
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    // 1) Kontur + silah görünümü birleştirme. Kontur derinlikten: siluet (derinlik sıçraması)
    //    ve kırışık (1/z'nin ikinci türevi → kutu kenarı, duvar dibi). Mürdüme doğru karışır.
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
          outline: { value: 1 },
          crease: { value: 0.55 },
          thick: { value: 1 },
          ink: { value: new THREE.Color(INK) },
          fade: { value: new THREE.Vector2(40, 160) },
        },
        vertexShader: VS,
        fragmentShader: [
          'uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tVM;',
          'uniform vec2 res; uniform float near; uniform float far; uniform float outline; uniform float crease; uniform float thick;',
          'uniform vec3 ink; uniform vec2 fade;',
          'varying vec2 vUv;',
          'float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }',
          'void main(){',
          ' vec2 px = thick / res;',
          ' vec3 c = texture2D(tColor, vUv).rgb;',
          ' if (outline > 0.0) {',
          '  float dr = texture2D(tDepth, vUv).r;',
          '  float r0 = texture2D(tDepth, vUv + vec2(px.x, 0.0)).r;',
          '  float l0 = texture2D(tDepth, vUv - vec2(px.x, 0.0)).r;',
          '  float u0 = texture2D(tDepth, vUv + vec2(0.0, px.y)).r;',
          '  float b0 = texture2D(tDepth, vUv - vec2(0.0, px.y)).r;',
          '  float d = lin(dr), dR = lin(r0), dL = lin(l0), dU = lin(u0), dB = lin(b0);',
          '  float m = max(max(dR, dL), max(dU, dB));',
          '  float e = (m - d) / max(d, 0.001);',
          '  float w = 1.0 / d;',
          '  float lap = max(abs(1.0 / dR + 1.0 / dL - 2.0 * w), abs(1.0 / dU + 1.0 / dB - 2.0 * w)) / w;',
          '  float sil = smoothstep(0.03, 0.1, e) * smoothstep(0.02, 0.06, lap);',
          '  float cr = smoothstep(0.004, 0.014, lap) * crease;',
          '  float sky = step(0.99999, max(max(r0, l0), max(u0, b0)));',
          '  float dist = 1.0 - smoothstep(fade.x, fade.y, d);',
          '  float a = max(sil, cr * 0.75) * dist;',
          '  a = max(a, sil * sky * 0.85);',
          '  if (dr > 0.99999) a = 0.0;',
          '  c = mix(c, ink, clamp(a, 0.0, 1.0) * outline);',
          ' }',
          ' vec4 vm = texture2D(tVM, vUv);',
          ' float op = step(0.98, vm.a);',
          ' if (outline > 0.0 && op < 0.5) {',
          '  float n = max(max(texture2D(tVM, vUv + vec2(px.x, 0.0)).a, texture2D(tVM, vUv - vec2(px.x, 0.0)).a), max(texture2D(tVM, vUv + vec2(0.0, px.y)).a, texture2D(tVM, vUv - vec2(0.0, px.y)).a));',
          '  if (n > 0.98) c = mix(c, ink, 0.9 * outline);',
          ' }',
          ' c = c * (1.0 - op) + vm.rgb;',
          ' gl_FragColor = vec4(c, 1.0);',
          '}',
        ].join('\n'),
        depthTest: false,
        depthWrite: false,
      }),
    };
    // 2) Işıma: parlaklık eşiği (yumuşak diz) + yarım ve çeyrek çözünürlükte bulanıklık
    post.bright = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, threshold: { value: 0.9 } },
      vertexShader: VS,
      // parlaklık (luminance) üzerinden eşik: pastel/beyaz yüzeyler renkli kalır, yalnız gerçekten parlayanlar ışır
      fragmentShader: 'uniform sampler2D tColor; uniform float threshold; varying vec2 vUv; void main(){ vec3 c = texture2D(tColor, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float k = smoothstep(threshold, threshold + 0.1, l); gl_FragColor = vec4(c * k * k, 1.0); }',
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
    // 3) Son geçiş: FXAA + ışıma + renk ayarı + lila vinyet (+ retro modda renk basamaklama)
    post.final = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tBloom: { value: null },
        tBloom2: { value: null },
        res: { value: new THREE.Vector2(1, 1) },
        aa: { value: 1 },
        bloom: { value: 0.5 },
        wide: { value: 1 },
        levels: { value: 64 },
        dither: { value: 0.55 },
        quant: { value: 0 },
        sat: { value: 1.1 },
        shSat: { value: 0.3 },
        con: { value: 1.04 },
        tint: { value: new THREE.Color(1, 1, 1) },
        lift: { value: new THREE.Color(0, 0, 0) },
        vig: { value: 0.28 },
        vigCol: { value: new THREE.Color(0xc8b4e0) },
      },
      vertexShader: VS,
      fragmentShader: [
        'uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform vec2 res; uniform float aa;',
        'uniform float bloom; uniform float wide; uniform float levels; uniform float dither; uniform float quant;',
        'uniform float sat; uniform float shSat; uniform float con; uniform vec3 tint; uniform vec3 lift; uniform float vig; uniform vec3 vigCol; varying vec2 vUv;',
        'float bayer(vec2 p){',
        ' vec2 q = mod(floor(p), 4.0);',
        ' float i = q.x + q.y * 4.0;',
        ' if (i < 1.0) return 0.0; if (i < 2.0) return 8.0; if (i < 3.0) return 2.0; if (i < 4.0) return 10.0;',
        ' if (i < 5.0) return 12.0; if (i < 6.0) return 4.0; if (i < 7.0) return 14.0; if (i < 8.0) return 6.0;',
        ' if (i < 9.0) return 3.0; if (i < 10.0) return 11.0; if (i < 11.0) return 1.0; if (i < 12.0) return 9.0;',
        ' if (i < 13.0) return 15.0; if (i < 14.0) return 7.0; if (i < 15.0) return 13.0; return 5.0;',
        '}',
        // Basit FXAA (Lottes'in hafif sürümü): 9 örnek, kenar yönünde yumuşatır
        'vec3 fxaa(vec2 uv){',
        ' vec2 r = 1.0 / res;',
        ' vec3 cNW = texture2D(tColor, uv + vec2(-1.0, -1.0) * r).rgb;',
        ' vec3 cNE = texture2D(tColor, uv + vec2(1.0, -1.0) * r).rgb;',
        ' vec3 cSW = texture2D(tColor, uv + vec2(-1.0, 1.0) * r).rgb;',
        ' vec3 cSE = texture2D(tColor, uv + vec2(1.0, 1.0) * r).rgb;',
        ' vec3 cM = texture2D(tColor, uv).rgb;',
        ' vec3 L = vec3(0.299, 0.587, 0.114);',
        ' float lNW = dot(cNW, L), lNE = dot(cNE, L), lSW = dot(cSW, L), lSE = dot(cSE, L), lM = dot(cM, L);',
        ' float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));',
        ' float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));',
        ' if (lMax - lMin < max(0.04, lMax * 0.1)) return cM;',
        ' vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));',
        ' float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);',
        ' float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);',
        ' dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * r;',
        ' vec3 a = 0.5 * (texture2D(tColor, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tColor, uv + dir * (2.0 / 3.0 - 0.5)).rgb);',
        ' vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);',
        ' float lB = dot(b, L);',
        ' return (lB < lMin || lB > lMax) ? a : b;',
        '}',
        'void main(){',
        ' vec3 c = aa > 0.5 ? fxaa(vUv) : texture2D(tColor, vUv).rgb;',
        ' if (bloom > 0.0) c += (texture2D(tBloom, vUv).rgb * 0.55 + texture2D(tBloom2, vUv).rgb * 0.75 * wide) * bloom;',
        ' float l = dot(c, vec3(0.299, 0.587, 0.114));',
        ' c = mix(vec3(l), c, sat + shSat * (1.0 - smoothstep(0.2, 0.8, l)));',
        ' c = (c - 0.5) * con + 0.5;',
        ' c = c * tint + lift * (1.0 - l);',
        ' vec2 q = vUv - 0.5;',
        ' c = mix(c, c * vigCol, clamp(dot(q, q) * vig * 2.2, 0.0, 1.0));',
        ' c = clamp(c, 0.0, 1.0);',
        ' if (quant > 0.5) {',
        '  float b = (bayer(gl_FragCoord.xy) / 16.0 - 0.5) * dither;',
        '  c = floor(c * levels + 0.5 + b) / levels;',
        ' }',
        ' gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });
    post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat);
    post.quad.frustumCulled = false;
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
      u.shSat.value = d.shadowSat != null ? d.shadowSat : 0.3;
      u.con.value = d.con != null ? d.con : 1.04;
      u.tint.value.setHex(d.tint != null ? d.tint : 0xffffff);
      u.lift.value.setHex(d.lift != null ? d.lift : 0x000000);
      u.vig.value = d.vig != null ? d.vig : 0.28;
      u.vigCol.value.setHex(d.vigCol != null ? d.vigCol : 0xc8b4e0);
      post.bright.uniforms.threshold.value = Math.max(0.86, d.bloomThreshold != null ? d.bloomThreshold : 0.9);
      const lowQ = G.settings.quality === 'dusuk';
      u.bloom.value = G.settings.bloom === false || lowQ ? 0 : Math.min(0.7, d.bloom != null ? d.bloom : 0.45);
    };
    let rtWorld = null, rtVM = null, rtComp = null, rtA = null, rtB = null, rtC = null, rtD = null;
    let W = 0, H = 0, tRetro = null;
    const isRetro = () => Math.max(1, Math.round(G.settings.pixel || 1)) > 1;

    function makeTargets() {
      if (rtWorld) {
        rtWorld.dispose();
        rtWorld.depthTexture.dispose();
        rtVM.dispose();
        rtComp.dispose();
        rtA.dispose();
        rtB.dispose();
        rtC.dispose();
        rtD.dispose();
      }
      const retro = (tRetro = isRetro());
      const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
      const linear = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      rtWorld = new THREE.WebGLRenderTarget(W, H, nearest);
      rtWorld.depthTexture = new THREE.DepthTexture(W, H);
      rtWorld.depthTexture.type = THREE.UnsignedIntType;
      rtVM = new THREE.WebGLRenderTarget(W, H, nearest);
      // FXAA için birleşik görüntü doğrusal süzgeçle örneklenir (retroda en yakın komşu)
      rtComp = new THREE.WebGLRenderTarget(W, H, retro ? nearest : linear);
      const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
      const qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
      rtA = new THREE.WebGLRenderTarget(hw, hh, linear);
      rtB = new THREE.WebGLRenderTarget(hw, hh, linear);
      rtC = new THREE.WebGLRenderTarget(qw, qh, linear);
      rtD = new THREE.WebGLRenderTarget(qw, qh, linear);
      post.bright.uniforms.tColor.value = rtComp.texture;
      post.final.uniforms.tColor.value = rtComp.texture;
      post.final.uniforms.tBloom.value = rtA.texture;
      post.final.uniforms.tBloom2.value = rtD.texture;
      post.final.uniforms.res.value.set(W, H);
      post.mat.uniforms.tColor.value = rtWorld.texture;
      post.mat.uniforms.tDepth.value = rtWorld.depthTexture;
      post.mat.uniforms.tVM.value = rtVM.texture;
      post.mat.uniforms.res.value.set(W, H);
    }

    let texRetro = isRetro();
    G.onResize = function () {
      const px = Math.max(1, Math.round(G.settings.pixel || 1));
      const rs = (G.perf && G.perf.scale) || 1; // uyarlanır çözünürlük (perf.js)
      const w = window.innerWidth, h = window.innerHeight;
      const nw = Math.max(160, Math.floor((w * rs) / px)), nh = Math.max(90, Math.floor((h * rs) / px));
      const retro = px > 1;
      document.body.classList.toggle('retro', retro);
      if (retro !== texRetro) {
        texRetro = retro;
        if (G.texFilter) G.texFilter(retro);
      }
      if (nw !== W || nh !== H || retro !== tRetro) {
        W = nw;
        H = nh;
        renderer.setSize(W, H, false);
        makeTargets();
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      vmCam.aspect = w / h;
      vmCam.updateProjectionMatrix();
      const levels = G.settings.levels || 64;
      const fu = post.final.uniforms;
      fu.levels.value = levels;
      fu.quant.value = retro || levels < 64 ? 1 : 0;
      fu.aa.value = retro ? 0 : 1;
      const q = G.settings.quality;
      fu.wide.value = q === 'yuksek' ? 1 : 0.8;
      if (G.setGrade) G.setGrade(curGrade);
      const mu = post.mat.uniforms;
      mu.outline.value = G.settings.outline ? 1 : 0;
      mu.crease.value = q === 'dusuk' ? 0 : 0.55;
      // kontur kalınlığı: çizim çözünürlüğüne göre (720p'de 1 piksel, 1080p'de 2)
      mu.thick.value = retro ? 1 : Math.max(1, Math.round(H / 650));
      renderer.shadowMap.enabled = q !== 'dusuk';
      G.renderH = H;
      const portrait = G.isTouch && h > w;
      document.getElementById('rotate-hint').hidden = !(portrait && G.state === 'playing');
    };
    window.addEventListener('resize', G.onResize);
    G.onResize();

    renderer.info.autoReset = false;
    const renderStats = (G.renderStats = { calls: 0, triangles: 0 });
    function render(scene, withVM) {
      const mu = post.mat.uniforms;
      mu.near.value = camera.near;
      mu.far.value = camera.far;
      if (scene.fog && scene.fog.far) mu.fade.value.set(Math.min(45, scene.fog.near + 15), Math.max(60, scene.fog.far * 0.8));
      else mu.fade.value.set(45, 160);
      // renderer.info elle sıfırlanır: son işlem geçişleri sayımı bozmasın (G.renderStats / G.perf okur)
      renderer.info.reset();
      renderer.setRenderTarget(rtWorld);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(rtVM);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      if (withVM) renderer.render(vmScene, vmCam);
      renderStats.calls = renderer.info.render.calls;
      renderStats.triangles = renderer.info.render.triangles;
      pass(post.mat, rtComp);
      if (post.final.uniforms.bloom.value > 0) {
        const bl = post.blur.uniforms;
        pass(post.bright, rtA);
        bl.tColor.value = rtA.texture;
        bl.dir.value.set(1 / rtA.width, 0);
        pass(post.blur, rtB);
        bl.tColor.value = rtB.texture;
        bl.dir.value.set(0, 1 / rtA.height);
        pass(post.blur, rtA);
        // geniş, yumuşak hale: çeyrek çözünürlükte iki kez daha
        bl.tColor.value = rtA.texture;
        bl.dir.value.set(1 / rtC.width, 0);
        pass(post.blur, rtC);
        bl.tColor.value = rtC.texture;
        bl.dir.value.set(0, 1 / rtC.height);
        pass(post.blur, rtD);
        if (G.settings.quality === 'yuksek') {
          bl.tColor.value = rtD.texture;
          bl.dir.value.set(2 / rtC.width, 0);
          pass(post.blur, rtC);
          bl.tColor.value = rtC.texture;
          bl.dir.value.set(0, 2 / rtC.height);
          pass(post.blur, rtD);
        }
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
      // yakın çekim: küçük gölge kutusu → keskin, yumuşak kenarlı gölgeler
      if (menu.world.shadowFollow && menu.world.setShadowRange) menu.world.setShadowRange(10);
      G.refreshOperator();
    }
    // Operatör rıhtımda, arkasında deniz ve gemi; kamera hafifçe salınır
    const MENU_OP = { x: 17, z: 53, yaw: -0.4 };
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
      menu.op.root.position.set(MENU_OP.x, 0, MENU_OP.z);
      menu.op.root.rotation.y = MENU_OP.yaw;
      menu.scene.add(menu.op.root);
    };
    let menuT = 0;
    const menuLook = new THREE.Vector3();
    function updateMenu(dt) {
      menuT += dt;
      const op = menu.op;
      if (op) {
        op.animate(dt, { speed: 0, crouch: 0, pitch: -0.2 + Math.sin(menuT * 0.8) * 0.02 });
        op.torso.rotation.z = Math.sin(menuT * 1.1) * 0.02;
      }
      // Kamera rıhtımdaki sandık sırasının (z≈48–50) önünde kalmalı: mesafe sabit, dar ekranda
      // operatör ortalanır ve görüş açısı biraz genişler (dikey telefonda tam boy görünsün)
      const asp = camera.aspect || 16 / 9;
      const dist = 3.7;
      const tx = MENU_OP.x, tz = MENU_OP.z;
      const a = 2.5 + Math.sin(menuT * 0.12) * 0.1;
      camera.position.set(tx + Math.sin(a) * dist, 1.25 + Math.sin(menuT * 0.3) * 0.04, tz + Math.cos(a) * dist);
      // bakış noktası operatörün biraz yanında: operatör ekranın sağ üçte birinde durur
      const side = asp < 1 ? 0 : asp < 1.5 ? 0.7 : 1.25;
      menuLook.set(tx - Math.cos(a) * side, 1.05, tz + Math.sin(a) * side);
      camera.lookAt(menuLook);
      const mfov = asp < 1 ? 58 : 50;
      if (camera.fov !== mfov) {
        camera.fov = mfov;
        camera.updateProjectionMatrix();
      }
      G.time += dt;
      menu.world.update(dt, camera.position);
    }

    // ---------------- Harita görüntüleri (menü kartları, yükleme ekranı) ----------------
    // Her harita bir kez kurulur, tam görüntü hattından geçirilip küçük bir resme çevrilir.
    const SHOT_VIEWS = {
      liman: { from: [0.06, 8.5, 0.94], to: [0.5, 1.5, 0.42] },
      col: { from: [0.3, 11, 0.97], to: [0.55, 0, 0.38] },
      us: { from: [0.5, 7.5, 0.97], to: [0.5, 1, 0.45] },
      tesis: { from: [0.5, 2.2, 0.55], to: [0.5, 1.6, 0.2] },
      poligon: { from: [0.5, 2.6, 0.97], to: [0.5, 1.2, 0.3] },
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
        // harita görüntüsünde gölge tüm haritayı kapsasın (oyunda kamerayı izler)
        if (world.shadowFollow && world.setShadowRange) {
          world.shadowFollow = null;
          world.setShadowRange(world.shadowFullR || 60);
        }
        const fx = v.from, tx = v.to;
        camera.position.set(fx[0] * world.sizeX, fx[1], fx[2] * world.sizeZ);
        camera.lookAt(tx[0] * world.sizeX, tx[1], tx[2] * world.sizeZ);
        camera.fov = 62;
        camera.updateProjectionMatrix();
        world.update(1 / 60, camera.position);
        G.setGrade(def.theme.grade);
        render(scene, false);
        const src = renderer.domElement;
        const cw = 640, ch = 360;
        const sw = Math.min(src.width, (src.height * 16) / 9), sh = (sw * 9) / 16;
        const c = document.createElement('canvas');
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = !isRetro();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, cw, ch);
        G.mapShots[id] = c.toDataURL('image/jpeg', 0.88);
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
