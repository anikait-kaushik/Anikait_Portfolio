/* ==========================================================
   Bipedal lower-body gait model: pelvis + two three-link legs
   (thigh · shank · foot), each planar in its own sagittal plane.
   - Segment masses / lengths / COM ratios: Winter (2009),
     Biomechanics and Motor Control of Human Movement.
   - Shows the static gravity term G(q) of the
     Euler–Lagrange equation M(q)q̈ + C(q,q̇)q̇ + G(q) = τ,
     treating each leg as hip-fixed. Ground reaction forces
     are not modelled.
   - Walking uses ILLUSTRATIVE, approximate normative sagittal
     joint-angle curves, not study data. The left leg runs the
     same curves half a cycle behind the right.
   - The pelvis height follows the lowest point of the feet, and
     the ground moves with the planted foot so it does not slide.
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
    play: $('legPlay'), speed: $('legSpeed'), reset: $('legReset'),
    phase: $('gaitPhase'), scrub: $('gaitScrub'), head: $('gaitHead'),
    pickR: $('legPickR'), pickL: $('legPickL'),
    tq: {
      R: { hip: $('tHipR'), knee: $('tKneeR'), ankle: $('tAnkleR') },
      L: { hip: $('tHipL'), knee: $('tKneeL'), ankle: $('tAnkleL') }
    }
  };

  // ---- Winter (2009) segment parameters (fraction of body mass M / height H)
  const SEG = {
    thigh: { m: 0.100, L: 0.245, com: 0.433 },
    shank: { m: 0.0465, L: 0.246, com: 0.433 },
    foot:  { m: 0.0145, L: 0.120, com: 0.500 } // foot: simplified ankle→toe segment
  };
  const ANKLE_H = 0.039, HEEL_BACK = 0.032; // ankle height and heel offset (fraction of H)
  const PELVIC_TILT = 10; // deg, typical forward tilt: hip flexion is measured from the pelvis
  const gAcc = 9.81;
  const D2R = Math.PI / 180;

  // Drawing scale: thigh + shank always draw 0.9 units long, whatever height is entered
  const DRAW = 0.9 / (SEG.thigh.L + SEG.shank.L);
  const HIP_Z = 0.1;
  const GROUND_Y = -1.0;

  // ---- renderer / scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
  camera.position.set(1.05, -0.05, 2.25);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.05, -0.42, 0);
  controls.enableDamping = true;
  controls.minDistance = 1; controls.maxDistance = 9;
  controls.enablePan = false;
  renderer.domElement.style.touchAction = 'pan-y'; // vertical swipes still scroll the page on phones
  controls.maxPolarAngle = Math.PI * 0.62; // stay above the floor

  scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x1a1f27, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c9cff, 0.7); rim.position.set(-2, 1, -2); scene.add(rim);

  // ground: the grid scrolls to stay locked to the planted foot
  const CELL = 0.2;
  const grid = new THREE.GridHelper(4.8, 24, 0x46505f, 0x2a313c);
  grid.position.y = GROUND_Y; scene.add(grid);

  const body = new THREE.Group(); scene.add(body);

  // pelvis and a short lumbar stub, so it reads as a lower body
  const pelvisMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.55, metalness: 0.2 });
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, HIP_Z * 2, 8, 20), pelvisMat);
  pelvis.rotation.x = Math.PI / 2; pelvis.position.y = 0.012;
  const lumbar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.15, 24), pelvisMat);
  lumbar.position.y = 0.1;
  const pelvisGroup = new THREE.Group(); pelvisGroup.add(pelvis, lumbar);
  pelvisGroup.rotation.z = -PELVIC_TILT * D2R; body.add(pelvisGroup);

  const comMat = new THREE.MeshStandardMaterial({ color: 0x4fb38a, emissive: 0x1d4a37, roughness: 0.4 });
  const up = new THREE.Vector3(0, 1, 0);
  const FOOT = { heel: HEEL_BACK * DRAW, toe: SEG.foot.L * DRAW, down: ANKLE_H * DRAW };

  function footGeometry() {
    const { heel, toe, down } = FOOT;
    const s = new THREE.Shape();
    s.moveTo(-heel, -down);
    s.lineTo(toe, -down);
    s.quadraticCurveTo(toe + 0.012, -down + 0.022, toe - 0.03, -down + 0.032);
    s.quadraticCurveTo(toe * 0.4, -down + 0.05, 0.03, 0.012);
    s.lineTo(-0.028, 0.012);
    s.quadraticCurveTo(-heel - 0.006, -down * 0.4, -heel, -down);
    const width = 0.062;
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.005, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -width / 2);
    return g;
  }
  const footGeo = footGeometry();

  function makeLeg(sign, segColor, jointColor) {
    const z = HIP_Z * sign;
    const segMat = new THREE.MeshStandardMaterial({ color: segColor, roughness: 0.45, metalness: 0.15 });
    const jointMat = new THREE.MeshStandardMaterial({ color: jointColor, roughness: 0.4, metalness: 0.3 });
    const add = (m) => { body.add(m); return m; };
    // radiusTop is the distal end: placeSeg points +y from proximal to distal
    const thigh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.058, 1, 24), segMat));
    const shank = add(new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.042, 1, 24), segMat));
    const foot = add(new THREE.Mesh(footGeo, segMat));
    const joints = [0.052, 0.045, 0.032].map((r) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), jointMat)));
    const coms = [0, 1, 2].map(() => add(new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 10), comMat)));
    const arrows = coms.map(() => add(new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.1, 0x4fb38a, 0.022, 0.014)));

    // footprint: lights up while this foot carries load
    const contact = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1, 40),
      new THREE.MeshBasicMaterial({ color: jointColor, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2; contact.scale.set(0.15, 0.07, 1);
    scene.add(contact);

    // toe path relative to the pelvis
    const TRACE_N = 140;
    const traceGeo = new THREE.BufferGeometry();
    traceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACE_N * 3), 3));
    traceGeo.setDrawRange(0, 0);
    add(new THREE.Line(traceGeo, new THREE.LineBasicMaterial({ color: jointColor, transparent: true, opacity: 0.75 })));

    return { z, thigh, shank, foot, joints, coms, arrows, contact, traceGeo, TRACE_N, traceCount: 0 };
  }
  const legs = {
    R: makeLeg(1, 0xe6ebf0, 0xf97316),
    L: makeLeg(-1, 0x93a4bd, 0x3b82f6)
  };

  const placeSeg = (mesh, a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    mesh.scale.set(1, len, 1);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
  };

  // ---- kinematics + gravity torque
  // Angles (deg): hip flexion (+ thigh forward), knee flexion (+ shank back), ankle dorsiflexion (+ toes up)
  function solve(q, M, H) {
    const Lt = SEG.thigh.L * H, Ls = SEG.shank.L * H, Lf = SEG.foot.L * H;
    const at = (q.hip - PELVIC_TILT) * D2R, as = at - q.knee * D2R, af = as + q.ankle * D2R;
    const Hp = { x: 0, y: 0 };
    const K = { x: Hp.x + Lt * Math.sin(at), y: Hp.y - Lt * Math.cos(at) };
    const A = { x: K.x + Ls * Math.sin(as), y: K.y - Ls * Math.cos(as) };
    const T = { x: A.x + Lf * Math.cos(af), y: A.y + Lf * Math.sin(af) };
    const lerp = (p, r, k) => ({ x: p.x + (r.x - p.x) * k, y: p.y + (r.y - p.y) * k });
    const c = { thigh: lerp(Hp, K, SEG.thigh.com), shank: lerp(K, A, SEG.shank.com), foot: lerp(A, T, SEG.foot.com) };
    const m = { thigh: SEG.thigh.m * M, shank: SEG.shank.m * M, foot: SEG.foot.m * M };
    // Static joint torque needed to hold the pose against gravity: τ_j = Σ_distal m_i g (x_i − x_j)
    const tA = m.foot * gAcc * (c.foot.x - A.x);
    const tKnee = m.shank * gAcc * (c.shank.x - K.x) + m.foot * gAcc * (c.foot.x - K.x);
    const tHip = m.thigh * gAcc * (c.thigh.x - Hp.x) + m.shank * gAcc * (c.shank.x - Hp.x) + m.foot * gAcc * (c.foot.x - Hp.x);
    return { Hp, K, A, T, c, m, af, tau: { hip: tHip, knee: tKnee, ankle: tA }, L: { Lt, Ls, Lf } };
  }

  // ---- pose state
  const STAND = { hip: PELVIC_TILT, knee: 4, ankle: 2 };
  const state = { R: { ...STAND }, L: { ...STAND } };
  let selected = 'R';
  let groundX = 0, lastContact = null;
  const GRF = 0.016; // a sole point this close to the floor counts as loaded

  const fmtTq = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1);

  function pose() {
    const M = Math.max(20, Math.min(200, parseFloat(ui.mass.value) || 70));
    const Hm = Math.max(1.2, Math.min(2.2, parseFloat(ui.height.value) || 1.75));
    const s = DRAW / Hm;
    const out = {};
    let low = { y: Infinity };

    Object.keys(legs).forEach((side) => {
      const r = solve(state[side], M, Hm);
      const leg = legs[side];
      const v = (p) => new THREE.Vector3(p.x * s, p.y * s, leg.z);
      const P = { H: v(r.Hp), K: v(r.K), A: v(r.A) };
      placeSeg(leg.thigh, P.H, P.K);
      placeSeg(leg.shank, P.K, P.A);
      leg.foot.position.copy(P.A);
      leg.foot.rotation.z = r.af;
      leg.joints[0].position.copy(P.H); leg.joints[1].position.copy(P.K); leg.joints[2].position.copy(P.A);
      ['thigh', 'shank', 'foot'].forEach((n, i) => {
        const cp = v(r.c[n]);
        leg.coms[i].position.copy(cp);
        leg.arrows[i].position.copy(cp);
        leg.arrows[i].setLength(0.04 + r.m[n] * 0.008, 0.022, 0.014);
      });
      ui.tq[side].hip.textContent = fmtTq(r.tau.hip);
      ui.tq[side].knee.textContent = fmtTq(r.tau.knee);
      ui.tq[side].ankle.textContent = fmtTq(r.tau.ankle);

      // sole points in pelvis coordinates
      const cf = Math.cos(r.af), sf = Math.sin(r.af);
      const point = (along) => ({ x: P.A.x + along * cf + FOOT.down * sf, y: P.A.y + along * sf - FOOT.down * cf });
      const heel = point(-FOOT.heel), toe = point(FOOT.toe);
      out[side] = { heel, toe, A: P.A };
      if (heel.y < low.y) low = { y: heel.y, x: heel.x, id: side + 'h' };
      if (toe.y < low.y) low = { y: toe.y, x: toe.x, id: side + 't' };
    });

    // the body rests on whichever sole point is lowest
    const lift = GROUND_Y - low.y;
    body.position.y = lift;

    // move the ground with the planted point so that foot never slides
    if (lastContact && lastContact.id === low.id) groundX += low.x - lastContact.x;
    lastContact = { id: low.id, x: low.x };
    grid.position.x = groundX % CELL;

    Object.keys(legs).forEach((side) => {
      const f = out[side], leg = legs[side];
      const height = Math.min(f.heel.y, f.toe.y) + lift - GROUND_Y;
      const load = Math.max(0, 1 - height / GRF);
      leg.contact.material.opacity = 0.85 * load;
      leg.contact.position.set((f.heel.x + f.toe.x) / 2, GROUND_Y + 0.003, leg.z);
    });
    return out;
  }

  function pushTrace(feet) {
    Object.keys(legs).forEach((side) => {
      const leg = legs[side], pos = leg.traceGeo.attributes.position;
      if (leg.traceCount < leg.TRACE_N) leg.traceCount++;
      for (let i = leg.traceCount - 1; i > 0; i--) pos.setXYZ(i, pos.getX(i - 1), pos.getY(i - 1), pos.getZ(i - 1));
      pos.setXYZ(0, feet[side].toe.x, feet[side].toe.y, leg.z);
      pos.needsUpdate = true;
      leg.traceGeo.setDrawRange(0, leg.traceCount);
    });
  }
  function clearTrace() {
    Object.values(legs).forEach((leg) => { leg.traceCount = 0; leg.traceGeo.setDrawRange(0, 0); });
  }

  // ---- illustrative gait curves (deg) at % cycle: approximate, for visualisation only.
  // Periodic cubic Hermite, so the motion has no pauses at the keyframes.
  function curve(pts) {
    const n = pts.length - 1; // the last point repeats the first at 100 %
    const tan = pts.map((_, i) => {
      const a = i === 0 ? pts[n - 1] : pts[i - 1];
      const b = i === n ? pts[1] : pts[i + 1];
      const xa = i === 0 ? a[0] - 100 : a[0];
      const xb = i === n ? b[0] + 100 : b[0];
      return (b[1] - a[1]) / (xb - xa);
    });
    return (p) => {
      for (let i = 1; i <= n; i++) {
        if (p <= pts[i][0]) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const h = x1 - x0, t = (p - x0) / h, t2 = t * t, t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * tan[i - 1] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * tan[i];
        }
      }
      return pts[n][1];
    };
  }
  const GAIT = {
    hip:   curve([[0, 30], [10, 25], [30, 8], [50, -10], [60, -5], [75, 20], [87, 32], [100, 30]]),
    knee:  curve([[0, 5], [15, 18], [40, 8], [60, 40], [73, 66], [88, 40], [100, 5]]),
    ankle: curve([[0, 0], [8, -5], [40, 10], [55, -2], [62, -18], [75, 8], [92, 8], [100, 0]])
  };
  const atPhase = (p) => ({ hip: GAIT.hip(p), knee: GAIT.knee(p), ankle: GAIT.ankle(p) });

  // Standard gait-phase names for one leg (Perry & Burnfield)
  const PHASES = [[10, 'loading response'], [30, 'mid-stance'], [50, 'terminal stance'], [60, 'pre-swing'], [73, 'initial swing'], [87, 'mid-swing'], [100, 'terminal swing']];
  const phaseName = (p) => PHASES.find(([end]) => p < end || end === 100)[1];

  let cycle = 0; // % of the right leg's gait cycle

  function setCycle(p) {
    cycle = ((p % 100) + 100) % 100;
    state.R = atPhase(cycle);
    state.L = atPhase((cycle + 50) % 100);
    if (ui.scrub) ui.scrub.value = cycle;
    if (ui.head) ui.head.style.setProperty('--p', cycle / 100);
    const l = (cycle + 50) % 100;
    const support = (cycle < 10 || (cycle >= 50 && cycle < 60)) ? 'double support' : 'single support';
    ui.phase.textContent = cycle.toFixed(0) + '% · ' + support + ' · R ' + phaseName(cycle) + ' · L ' + phaseName(l);
  }

  // ---- sliders show the selected leg
  const setLabels = () => {
    const q = state[selected];
    ui.hipV.textContent = q.hip.toFixed(0) + '°';
    ui.kneeV.textContent = Math.max(0, q.knee).toFixed(0) + '°';
    ui.ankleV.textContent = q.ankle.toFixed(0) + '°';
  };
  const syncSliders = () => {
    const q = state[selected];
    ui.hip.value = q.hip; ui.knee.value = q.knee; ui.ankle.value = q.ankle;
    setLabels();
  };
  function pickLeg(side) {
    selected = side;
    ui.pickR.setAttribute('aria-pressed', side === 'R' ? 'true' : 'false');
    ui.pickL.setAttribute('aria-pressed', side === 'L' ? 'true' : 'false');
    syncSliders();
  }
  ui.pickR.addEventListener('click', () => pickLeg('R'));
  ui.pickL.addEventListener('click', () => pickLeg('L'));

  // ---- playback
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CYCLE_MS = 1900;
  const SPEEDS = [[1, 'Speed 1×'], [0.5, 'Speed ½×'], [0.25, 'Speed ¼×']];
  let speedI = 0, playing = false, last = 0, raf = 0, visible = true;

  function togglePlay(force) {
    playing = typeof force === 'boolean' ? force : !playing;
    ui.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    ui.play.textContent = playing ? 'Pause walking' : 'Play walking';
    if (playing) { last = performance.now(); clearTrace(); }
  }
  ui.play.addEventListener('click', () => togglePlay());
  ui.speed.addEventListener('click', () => {
    speedI = (speedI + 1) % SPEEDS.length;
    ui.speed.textContent = SPEEDS[speedI][1];
  });
  ui.reset.addEventListener('click', () => {
    togglePlay(false);
    state.R = { ...STAND }; state.L = { ...STAND };
    clearTrace(); pickLeg('R'); pose();
    ui.phase.textContent = 'Standing · drag the sliders or the timeline';
  });

  [ui.hip, ui.knee, ui.ankle].forEach((el) => el.addEventListener('input', () => {
    if (playing) togglePlay(false);
    state[selected] = { hip: +ui.hip.value, knee: +ui.knee.value, ankle: +ui.ankle.value };
    setLabels(); pose();
    ui.phase.textContent = 'Custom pose · ' + (selected === 'R' ? 'right' : 'left') + ' leg';
  }));
  [ui.mass, ui.height].forEach((el) => el.addEventListener('input', () => { pose(); }));
  if (ui.scrub) ui.scrub.addEventListener('input', () => {
    if (playing) togglePlay(false);
    setCycle(+ui.scrub.value); syncSliders(); pose();
  });

  // Frame the whole body in the space above the timeline, at any stage size,
  // until the viewer takes over the camera.
  let userCamera = false;
  controls.addEventListener('start', () => { userCamera = true; });
  const timeline = stage.querySelector('.gait-tl');
  const tanHalf = Math.tan((camera.fov / 2) * D2R);
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pad = timeline ? timeline.offsetHeight + 24 : 0;
    const top = 44; // room for the labels
    camera.setViewOffset(w, h, 0, (pad - top) / 2, w, h); // lift the scene clear of the timeline
    if (!userCamera) {
      const usable = Math.max(120, h - pad - top);
      const fitH = (1.32 * h) / (2 * tanHalf * usable);
      const fitW = (1.45 * h) / (2 * tanHalf * w * 0.96);
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).setLength(Math.max(fitH, fitW));
      camera.position.copy(controls.target).add(dir);
    }
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  resize();

  const loop = (now) => {
    if (playing) {
      const dt = Math.min(now - last, 100); // never jump after a stalled frame
      last = now;
      setCycle(cycle + dt / CYCLE_MS * 100 * SPEEDS[speedI][0]);
      syncSliders();
      pushTrace(pose());
    }
    controls.update();
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(loop);
  };

  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    last = performance.now();
    if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }).observe(stage);

  setCycle(0); syncSliders(); pose();
  if (!reduce) togglePlay(true);
  stage.classList.add('ready');
  const fb = $('legFallback'); if (fb) fb.hidden = true;
  raf = requestAnimationFrame(loop);
}
