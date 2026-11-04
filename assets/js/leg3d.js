/* ==========================================================
   Three-link sagittal leg model (thigh · shank · foot)
   - Segment masses / lengths / COM ratios: Winter (2009),
     Biomechanics and Motor Control of Human Movement.
   - Shows the static gravity term G(q) of the
     Euler–Lagrange equation M(q)q̈ + C(q,q̇)q̇ + G(q) = τ
     for a hip-fixed swing leg.
   - "Play gait" uses ILLUSTRATIVE, approximate normative
     sagittal joint-angle curves — not study data.
   Three.js is loaded lazily, only when the model is near view.
   ========================================================== */
const stage = document.getElementById('legStage');
if (stage) {
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); boot().catch(fail); }
  }, { rootMargin: '300px' });
  io.observe(stage);
}

function fail(err) {
  console.warn('3D model unavailable:', err);
  const fb = document.getElementById('legFallback');
  if (fb) fb.hidden = false;
}

async function boot() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const $ = (id) => document.getElementById(id);
  const ui = {
    hip: $('qHip'), knee: $('qKnee'), ankle: $('qAnkle'),
    hipV: $('qHipV'), kneeV: $('qKneeV'), ankleV: $('qAnkleV'),
    mass: $('bodyMass'), height: $('bodyHeight'),
    tH: $('tHip'), tK: $('tKnee'), tA: $('tAnkle'),
    play: $('legPlay'), reset: $('legReset'), phase: $('gaitPhase')
  };

  // ---- Winter (2009) segment parameters (fraction of body mass M / height H)
  const SEG = {
    thigh: { m: 0.100, L: 0.245, com: 0.433 },
    shank: { m: 0.0465, L: 0.246, com: 0.433 },
    foot:  { m: 0.0145, L: 0.120, com: 0.500 } // foot: simplified ankle→toe segment
  };
  const gAcc = 9.81;
  const D2R = Math.PI / 180;

  // ---- renderer / scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
  camera.position.set(1.15, 0.05, 1.55);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.05, -0.42, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.8; controls.maxDistance = 4;
  controls.enablePan = false;

  scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x1a1f27, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9694b, 0.6); rim.position.set(-2, 1, -2); scene.add(rim);

  const grid = new THREE.GridHelper(2.4, 24, 0x3a4350, 0x262c36);
  grid.position.y = -0.95; scene.add(grid);

  // sagittal plane (the model is planar)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.25),
    new THREE.MeshBasicMaterial({ color: 0x4fb38a, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })
  );
  plane.position.set(0.1, -0.35, 0); scene.add(plane);
  const planeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: 0x4fb38a, transparent: true, opacity: 0.25 }));
  planeEdge.position.copy(plane.position); scene.add(planeEdge);

  // pelvis (fixed)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a4350, roughness: 0.6, metalness: 0.2 }));
  pelvis.position.set(0, 0.04, 0); scene.add(pelvis);

  const segMat = new THREE.MeshStandardMaterial({ color: 0xe6ebf0, roughness: 0.45, metalness: 0.15 });
  const jointMat = new THREE.MeshStandardMaterial({ color: 0xd9694b, roughness: 0.4, metalness: 0.3 });
  const comMat = new THREE.MeshStandardMaterial({ color: 0x4fb38a, emissive: 0x1d4a37, roughness: 0.4 });

  const makeSeg = (r) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 1, 24), segMat);
    scene.add(m); return m;
  };
  const segs = { thigh: makeSeg(0.045), shank: makeSeg(0.034), foot: makeSeg(0.022) };
  const joints = ['hip', 'knee', 'ankle'].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), jointMat); scene.add(s); return s; });
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), segMat); scene.add(toe);
  const coms = ['thigh', 'shank', 'foot'].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), comMat); scene.add(s); return s; });
  const arrows = coms.map(() => { const a = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.1, 0x4fb38a, 0.03, 0.02); scene.add(a); return a; });

  // toe trajectory trace (gait playback)
  const TRACE_N = 120;
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACE_N * 3), 3));
  traceGeo.setDrawRange(0, 0);
  const trace = new THREE.Line(traceGeo, new THREE.LineBasicMaterial({ color: 0xd9694b, transparent: true, opacity: 0.8 }));
  scene.add(trace);
  let traceCount = 0;

  const up = new THREE.Vector3(0, 1, 0);
  const placeSeg = (mesh, a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    mesh.scale.set(1, len, 1);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
  };

  // ---- kinematics + gravity torque
  // Angles (deg): hip flexion (+ thigh forward), knee flexion (+ shank back), ankle dorsiflexion (+ toes up)
  function solve(hipDeg, kneeDeg, ankleDeg, M, H) {
    const Lt = SEG.thigh.L * H, Ls = SEG.shank.L * H, Lf = SEG.foot.L * H;
    const at = hipDeg * D2R, as = (hipDeg - kneeDeg) * D2R, af = as + ankleDeg * D2R;
    const Hp = { x: 0, y: 0 };
    const K = { x: Hp.x + Lt * Math.sin(at), y: Hp.y - Lt * Math.cos(at) };
    const A = { x: K.x + Ls * Math.sin(as), y: K.y - Ls * Math.cos(as) };
    const T = { x: A.x + Lf * Math.cos(af), y: A.y + Lf * Math.sin(af) };
    const lerp = (p, q, k) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
    const c = { thigh: lerp(Hp, K, SEG.thigh.com), shank: lerp(K, A, SEG.shank.com), foot: lerp(A, T, SEG.foot.com) };
    const m = { thigh: SEG.thigh.m * M, shank: SEG.shank.m * M, foot: SEG.foot.m * M };
    // Static joint torque needed to hold the pose against gravity: τ_j = Σ_distal m_i g (x_i − x_j)
    const tA = m.foot * gAcc * (c.foot.x - A.x);
    const tKnee = m.shank * gAcc * (c.shank.x - K.x) + m.foot * gAcc * (c.foot.x - K.x);
    const tHip = m.thigh * gAcc * (c.thigh.x - Hp.x) + m.shank * gAcc * (c.shank.x - Hp.x) + m.foot * gAcc * (c.foot.x - Hp.x);
    return { Hp, K, A, T, c, m, tau: { hip: tHip, knee: tKnee, ankle: tA }, L: { Lt, Ls, Lf } };
  }

  // Visual scale: render a leg of fixed size regardless of the entered height
  const v3 = (p, s) => new THREE.Vector3(p.x * s + 0.0, p.y * s + 0.0, 0);

  function update(h, k, a) {
    const M = Math.max(20, Math.min(200, parseFloat(ui.mass.value) || 70));
    const Hm = Math.max(1.2, Math.min(2.2, parseFloat(ui.height.value) || 1.75));
    const r = solve(h, k, a, M, Hm);
    const s = 0.9 / (r.L.Lt + r.L.Ls); // normalise drawing
    const P = { H: v3(r.Hp, s), K: v3(r.K, s), A: v3(r.A, s), T: v3(r.T, s) };
    placeSeg(segs.thigh, P.H, P.K); placeSeg(segs.shank, P.K, P.A); placeSeg(segs.foot, P.A, P.T);
    joints[0].position.copy(P.H); joints[1].position.copy(P.K); joints[2].position.copy(P.A); toe.position.copy(P.T);
    ['thigh', 'shank', 'foot'].forEach((n, i) => {
      const cp = v3(r.c[n], s); coms[i].position.copy(cp);
      arrows[i].position.copy(cp); arrows[i].setLength(0.05 + r.m[n] * 0.012, 0.025, 0.018);
    });
    const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1) + ' N·m';
    ui.tH.textContent = f(r.tau.hip); ui.tK.textContent = f(r.tau.knee); ui.tA.textContent = f(r.tau.ankle);
    return P.T;
  }

  // ---- illustrative gait curves (deg) at % cycle — approximate, for visualisation only
  const KF = {
    hip:   [[0, 30], [10, 25], [30, 8], [50, -10], [60, -5], [75, 20], [87, 32], [100, 30]],
    knee:  [[0, 5], [15, 18], [40, 5], [60, 40], [72, 60], [85, 30], [100, 5]],
    ankle: [[0, 0], [8, -5], [40, 10], [55, -2], [62, -18], [75, 0], [100, 0]]
  };
  const interp = (arr, p) => {
    for (let i = 1; i < arr.length; i++) {
      if (p <= arr[i][0]) {
        const [x0, y0] = arr[i - 1], [x1, y1] = arr[i];
        const t = (p - x0) / (x1 - x0), e = (1 - Math.cos(Math.PI * t)) / 2;
        return y0 + (y1 - y0) * e;
      }
    }
    return arr[arr.length - 1][1];
  };

  const setLabels = () => {
    ui.hipV.textContent = (+ui.hip.value).toFixed(0) + '°';
    ui.kneeV.textContent = (+ui.knee.value).toFixed(0) + '°';
    ui.ankleV.textContent = (+ui.ankle.value).toFixed(0) + '°';
  };

  let playing = false, t0 = 0, raf = 0, visible = true;
  const CYCLE_MS = 2400;

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const loop = (now) => {
    if (playing) {
      const p = ((now - t0) % CYCLE_MS) / CYCLE_MS * 100;
      const h = interp(KF.hip, p), k = interp(KF.knee, p), a = interp(KF.ankle, p);
      ui.hip.value = h; ui.knee.value = k; ui.ankle.value = a; setLabels();
      ui.phase.textContent = p.toFixed(0) + '% gait cycle · ' + (p < 60 ? 'stance (illustrative)' : 'swing (illustrative)');
      const tp = update(h, k, a);
      const pos = traceGeo.attributes.position;
      if (traceCount < TRACE_N) traceCount++;
      for (let i = traceCount - 1; i > 0; i--) { pos.setXYZ(i, pos.getX(i - 1), pos.getY(i - 1), pos.getZ(i - 1)); }
      pos.setXYZ(0, tp.x, tp.y, tp.z); pos.needsUpdate = true; traceGeo.setDrawRange(0, traceCount);
    }
    controls.update();
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(loop);
  };

  const fromSliders = () => { setLabels(); update(+ui.hip.value, +ui.knee.value, +ui.ankle.value); };
  [ui.hip, ui.knee, ui.ankle].forEach((s) => s.addEventListener('input', () => { if (playing) togglePlay(false); fromSliders(); }));
  [ui.mass, ui.height].forEach((s) => s.addEventListener('input', fromSliders));

  function togglePlay(force) {
    playing = typeof force === 'boolean' ? force : !playing;
    ui.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    ui.play.textContent = playing ? 'Pause gait playback' : 'Play gait cycle';
    if (playing) { t0 = performance.now(); traceCount = 0; }
    else { ui.phase.textContent = 'Static pose · drag the sliders'; }
  }
  ui.play.addEventListener('click', () => togglePlay());
  ui.reset.addEventListener('click', () => {
    togglePlay(false); ui.hip.value = 20; ui.knee.value = 30; ui.ankle.value = 0;
    traceCount = 0; traceGeo.setDrawRange(0, 0); fromSliders();
  });

  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }).observe(stage);

  fromSliders();
  stage.classList.add('ready');
  const fb = $('legFallback'); if (fb) fb.hidden = true;
}
