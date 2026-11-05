/* ==========================================================
   3D pick-and-place manipulator: an illustrative 5-axis arm,
   not a model of a specific commercial robot.
   J1 base yaw · J2 shoulder · J3 elbow · J4 wrist pitch · J5 wrist roll.
   IK is closed form: the base yaw points the arm at the target,
   the wrist point follows from the tool-down constraint, then
   shoulder and elbow are a planar 2R solution (elbow up).
   Motion uses minimum-jerk timing. Vertical moves are straight
   lines in Cartesian space; transfers interpolate in joint space.
   Three.js is loaded lazily, only when the model is near view.
   ========================================================== */
const stage = document.getElementById('armStage');
if (stage) {
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); boot().catch(fail); }
  }, { rootMargin: '300px' });
  io.observe(stage);
}

function fail(err) {
  console.warn('3D arm unavailable:', err);
  const fb = document.getElementById('armFallback');
  if (fb) fb.hidden = false;
}

async function boot() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');

  const $ = (id) => document.getElementById(id);
  const DEG = 180 / Math.PI;
  const ui = {
    q: [1, 2, 3, 4, 5].map((n) => $('qJ' + n)),
    v: [1, 2, 3, 4, 5].map((n) => $('vJ' + n)),
    tcp: $('armTcp'), reach: $('armReach'), mode: $('armMode'), msg: $('armMsg'),
    task: $('armTask'), pause: $('armPause'), speed: $('armSpeed'), reset: $('armReset'),
    steps: [...document.querySelectorAll('#armSteps [data-step]')]
  };

  // ---- geometry (metres)
  const D1 = 0.30, L1 = 0.42, L2 = 0.40, LT = 0.14; // shoulder height, links, wrist to grasp point
  const RMIN = 0.24, RMAX = 0.70, CLEAR = 0.48, BLOCK = 0.06;
  const MAX_BLOCKS = 7;
  const PADS = [{ x: -0.42, z: 0.30, stack: [] }, { x: 0.42, z: 0.30, stack: [] }];
  const COLORS = [0xF97316, 0x3B82F6, 0x10B981, 0xA855F7, 0xEAB308, 0xEC4899, 0x06B6D4];

  // ---- renderer / scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
  camera.position.set(0.95, 1.05, 1.8);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.26, 0.04);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false; // the wheel keeps scrolling the page
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.12;
  canvas.style.touchAction = 'pan-y'; // vertical swipes still scroll on phones

  scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x171b22, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(1.1, 2.3, 1.2); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 5 });
  key.shadow.bias = -0.0006; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c9cff, 0.8); rim.position.set(-2, 1.2, -1.6); scene.add(rim);

  // ---- workbench
  const bench = new THREE.Mesh(
    new RoundedBoxGeometry(2.0, 0.05, 1.5, 3, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.62, metalness: 0.25 })
  );
  bench.position.y = -0.025; bench.receiveShadow = true; scene.add(bench);
  const grid = new THREE.GridHelper(2.0, 20, 0x323b4a, 0x262d39);
  grid.scale.z = 0.75; grid.position.y = 0.001; scene.add(grid);

  const flat = (geo, color, opacity) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  };
  const zone = flat(new THREE.RingGeometry(RMIN, RMAX, 96), 0x4FB38A, 0.055); zone.position.y = 0.002; scene.add(zone);
  [RMIN, RMAX].forEach((r) => {
    const edge = flat(new THREE.RingGeometry(r - 0.002, r + 0.002, 128), 0x4FB38A, 0.35);
    edge.position.y = 0.003; scene.add(edge);
  });
  PADS.forEach((p, i) => {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.006, 0.12, 2, 0.002), new THREE.MeshStandardMaterial({ color: i ? 0x1e40af : 0x9a3412, roughness: 0.5, metalness: 0.3 }));
    plate.position.set(p.x, 0.003, p.z); plate.receiveShadow = true; scene.add(plate);
  });

  // pointer preview on the bench
  const cursor = flat(new THREE.RingGeometry(0.036, 0.046, 40), 0x4FB38A, 0.9);
  cursor.position.y = 0.006; cursor.visible = false; scene.add(cursor);

  // ---- robot
  const white = new THREE.MeshStandardMaterial({ color: 0xE9EDF3, roughness: 0.36, metalness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232B38, roughness: 0.55, metalness: 0.45 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xF97316, roughness: 0.4, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xA7B1BF, roughness: 0.3, metalness: 0.75 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0F1319, roughness: 0.85 });

  const cyl = (rt, rb, h, mat, axis) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 36), mat);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    return m;
  };
  const link = (r, len, mat) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), mat);
    m.rotation.z = Math.PI / 2; m.position.x = len / 2 + r; return m;
  };
  const cable = (a, b, h) => {
    const c = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3((a.x + b.x) / 2, h, (a.z + b.z) / 2), b);
    return new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.006, 8), rubber);
  };

  const robot = new THREE.Group(); scene.add(robot);
  const foot = cyl(0.135, 0.15, 0.03, dark); foot.position.y = 0.015; robot.add(foot);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), new THREE.MeshStandardMaterial({ color: 0x22C55E, emissive: 0x22C55E, emissiveIntensity: 1.6 }));
  led.position.set(0.1, 0.034, 0.1); robot.add(led);

  const j1 = new THREE.Group(); j1.position.y = 0.03; robot.add(j1);
  const turret = cyl(0.085, 0.112, 0.2, white); turret.position.y = 0.1; j1.add(turret);
  const collar = cyl(0.114, 0.114, 0.018, dark); collar.position.y = 0.01; j1.add(collar);

  const j2 = new THREE.Group(); j2.position.y = D1 - 0.03; j1.add(j2);
  const hub2 = cyl(0.086, 0.086, 0.19, white, 'z'); j2.add(hub2);
  [-1, 1].forEach((s) => { const c = cyl(0.058, 0.058, 0.008, accent, 'z'); c.position.z = 0.097 * s; j2.add(c); });
  j2.add(link(0.052, L1 - 0.104, white));
  j2.add(cable(new THREE.Vector3(0.02, 0.07, 0.05), new THREE.Vector3(L1 - 0.02, 0.055, 0.05), 0.105));

  const j3 = new THREE.Group(); j3.position.x = L1; j2.add(j3);
  const hub3 = cyl(0.066, 0.066, 0.145, white, 'z'); j3.add(hub3);
  [-1, 1].forEach((s) => { const c = cyl(0.044, 0.044, 0.007, accent, 'z'); c.position.z = 0.075 * s; j3.add(c); });
  j3.add(link(0.04, L2 - 0.08, white));
  j3.add(cable(new THREE.Vector3(0.02, 0.05, 0.04), new THREE.Vector3(L2 - 0.02, 0.04, 0.03), 0.08));

  const j4 = new THREE.Group(); j4.position.x = L2; j3.add(j4);
  const hub4 = cyl(0.046, 0.046, 0.105, dark, 'z'); j4.add(hub4);
  [-1, 1].forEach((s) => { const c = cyl(0.03, 0.03, 0.006, accent, 'z'); c.position.z = 0.055 * s; j4.add(c); });

  const j5 = new THREE.Group(); j4.add(j5);
  const flange = cyl(0.036, 0.036, 0.05, steel, 'x'); flange.position.x = 0.03; j5.add(flange);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.05, 0.14, 2, 0.006), dark); palm.position.x = 0.07; j5.add(palm);
  const finger = () => {
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.014, 2, 0.003), steel);
    f.position.x = 0.125; j5.add(f); return f;
  };
  const fingers = [finger(), finger()];
  const tcp = new THREE.Object3D(); tcp.position.x = LT; j5.add(tcp);

  robot.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // tool path
  const TRACE_N = 240;
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACE_N * 3), 3));
  traceGeo.setDrawRange(0, 0);
  scene.add(new THREE.Line(traceGeo, new THREE.LineBasicMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.55 })));
  let traceCount = 0;

  // ---- kinematics
  const q = [0, 0, 0, 0, 0]; // radians: yaw, shoulder, elbow, wrist pitch, wrist roll
  let gap = 0.1;
  const tcpWorld = new THREE.Vector3();

  function ik(p) {
    const yaw = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
    const dy = p.y + LT - D1;
    const c = (r * r + dy * dy - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    if (c > 1 || c < -1) return null;
    const elbow = Math.acos(c);
    const shoulder = Math.atan2(dy, r) + Math.atan2(L2 * Math.sin(elbow), L1 + L2 * Math.cos(elbow));
    return [yaw, shoulder, elbow, -Math.PI / 2 - shoulder + elbow, -yaw];
  }

  function apply() {
    j1.rotation.y = -q[0];
    j2.rotation.z = q[1];
    j3.rotation.z = -q[2];
    j4.rotation.z = q[3];
    j5.rotation.x = q[4];
    fingers[0].position.z = gap / 2 + 0.007;
    fingers[1].position.z = -gap / 2 - 0.007;
    tcp.updateWorldMatrix(true, false);
    tcp.getWorldPosition(tcpWorld);
    if (held) held.mesh.position.copy(tcpWorld);
  }

  function readouts() {
    q.forEach((a, i) => {
      const d = a * DEG;
      ui.v[i].textContent = d.toFixed(0) + '°';
      if (document.activeElement !== ui.q[i] || !dragging) ui.q[i].value = d;
    });
    ui.tcp.textContent = tcpWorld.x.toFixed(2) + ', ' + tcpWorld.y.toFixed(2) + ', ' + tcpWorld.z.toFixed(2);
    ui.reach.textContent = Math.hypot(tcpWorld.x, tcpWorld.z).toFixed(2) + ' m';
  }

  function pushTrace() {
    const pos = traceGeo.attributes.position;
    if (traceCount < TRACE_N) traceCount++;
    for (let i = traceCount - 1; i > 0; i--) pos.setXYZ(i, pos.getX(i - 1), pos.getY(i - 1), pos.getZ(i - 1));
    pos.setXYZ(0, tcpWorld.x, tcpWorld.y, tcpWorld.z);
    pos.needsUpdate = true;
    traceGeo.setDrawRange(0, traceCount);
  }

  // ---- blocks
  const blockGeo = new RoundedBoxGeometry(BLOCK, BLOCK, BLOCK, 3, 0.006);
  let blocks = [], loose = [], held = null, colorI = 0, serial = 0;

  function makeBlock(x, y, z) {
    const mesh = new THREE.Mesh(blockGeo, new THREE.MeshStandardMaterial({ color: COLORS[colorI++ % COLORS.length], roughness: 0.38, metalness: 0.08 }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(x, y, z); scene.add(mesh);
    const b = { mesh, vy: 0, falling: false, id: ++serial };
    blocks.push(b);
    return b;
  }
  const slotY = (pad) => BLOCK / 2 + 0.006 + pad.stack.length * BLOCK;

  // ---- motion queue
  const minJerk = (t) => t * t * t * (10 + t * (-15 + 6 * t));
  const seqOf = (kind, props) => ({ kind, t: 0, ...props });
  let queue = [], current = null, target = 1;
  let paused = false, dirty = false;
  const SPEEDS = [[1, 'Speed 1×'], [2, 'Speed 2×'], [0.5, 'Speed ½×']];
  let speedI = 0;

  const jointMove = (label, p) => seqOf('joint', { label, goal: p });
  const cartMove = (label, p) => seqOf('cart', { label, goal: p });
  const gripMove = (label, to, done) => seqOf('grip', { label, to, done });

  function setStep(label) {
    ui.steps.forEach((s) => s.classList.toggle('on', s.dataset.step === label));
  }

  function grasp(block, source) {
    held = block;
    if (source) source.stack.pop();
    const i = loose.indexOf(block); if (i >= 0) loose.splice(i, 1);
  }

  function placeTask(block, pad, fromHeld) {
    const y = slotY(pad);
    const above = { x: pad.x, y: CLEAR, z: pad.z }, slot = { x: pad.x, y, z: pad.z };
    const moves = [
      jointMove('Transfer', above),
      cartMove('Lower', slot),
      gripMove('Release', 0.1, () => {
        if (held) { held.mesh.position.set(pad.x, y, pad.z); pad.stack.push(held); held = null; }
      }),
      cartMove('Retract', above)
    ];
    if (fromHeld) moves.unshift(cartMove('Lift', { x: tcpWorld.x, y: CLEAR, z: tcpWorld.z }));
    return moves;
  }

  function pickTask(block, source, pad) {
    const p = block.mesh.position;
    const above = { x: p.x, y: CLEAR, z: p.z }, at = { x: p.x, y: p.y, z: p.z };
    return [
      jointMove('Approach', above),
      cartMove('Descend', at),
      gripMove('Grip', BLOCK, () => grasp(block, source)),
      cartMove('Lift', above),
      ...placeTask(block, pad, false)
    ];
  }

  function nextTask() {
    if (held) { queue = placeTask(held, PADS[target], true); describe(held, PADS[target]); return; }
    const ready = loose.find((b) => !b.falling);
    if (ready) {
      queue = pickTask(ready, null, PADS[target]);
      describe(ready, PADS[target]);
      return;
    }
    if (loose.length) return; // wait for a falling block to land
    let from = PADS[1 - target];
    if (!from.stack.length) { target = 1 - target; from = PADS[1 - target]; }
    if (!from.stack.length) { ui.task.textContent = 'Table empty · click to drop a block'; return; }
    const top = from.stack[from.stack.length - 1];
    queue = pickTask(top, from, PADS[target]);
    describe(top, PADS[target]);
  }
  function describe(b, pad) {
    ui.task.textContent = 'Block ' + b.id + ' → Pad ' + (pad === PADS[0] ? 'A' : 'B');
  }

  function startSeg(s) {
    if (s.kind === 'joint') {
      s.from = q.slice();
      s.to = ik(s.goal) || q.slice();
      const span = Math.max(...s.to.map((v, i) => Math.abs(v - s.from[i])));
      s.T = Math.max(0.75, span / 1.15);
    } else if (s.kind === 'cart') {
      s.from = tcpWorld.clone();
      s.T = Math.max(0.4, s.from.distanceTo(new THREE.Vector3(s.goal.x, s.goal.y, s.goal.z)) / 0.26);
    } else {
      s.from = gap; s.T = 0.4;
    }
    setStep(s.label);
  }

  function step(dt) {
    if (!current) {
      if (!queue.length) nextTask();
      current = queue.shift() || null;
      if (!current) { setStep(''); return; }
      startSeg(current);
    }
    const s = current;
    s.t = Math.min(s.T, s.t + dt);
    const e = minJerk(s.t / s.T);
    if (s.kind === 'joint') {
      s.to.forEach((v, i) => { q[i] = s.from[i] + (v - s.from[i]) * e; });
    } else if (s.kind === 'cart') {
      const sol = ik({ x: s.from.x + (s.goal.x - s.from.x) * e, y: s.from.y + (s.goal.y - s.from.y) * e, z: s.from.z + (s.goal.z - s.from.z) * e });
      if (sol) sol.forEach((v, i) => { q[i] = v; });
    } else {
      gap = s.from + (s.to - s.from) * e;
    }
    if (s.t >= s.T) { if (s.done) s.done(); current = null; }
  }

  function physics(dt) {
    blocks.forEach((b) => {
      if (!b.falling) return;
      b.vy -= 9.81 * dt;
      b.mesh.position.y += b.vy * dt;
      if (b.mesh.position.y <= BLOCK / 2) {
        b.mesh.position.y = BLOCK / 2;
        if (Math.abs(b.vy) < 0.5) { b.falling = false; b.vy = 0; }
        else b.vy *= -0.32;
      }
    });
  }

  // ---- modes
  function showMode() {
    const text = dirty ? 'MANUAL' : paused ? 'PAUSED' : 'AUTO';
    ui.mode.textContent = text;
    ui.mode.classList.toggle('manual', text !== 'AUTO');
    const lit = text === 'AUTO' ? 0x22C55E : 0xF59E0B;
    led.material.color.setHex(lit); led.material.emissive.setHex(lit);
    ui.pause.textContent = dirty ? 'Resume auto' : paused ? 'Resume' : 'Pause';
    ui.pause.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }
  const HINT = 'Click the table to drop a block';
  let sayTimer = 0;
  function say(text, bad) {
    ui.msg.textContent = text;
    ui.msg.classList.toggle('bad', !!bad);
    clearTimeout(sayTimer);
    if (text !== HINT) sayTimer = setTimeout(() => say(dirty ? 'Manual jog · press Resume auto' : HINT), 3500);
  }
  ui.pause.addEventListener('click', () => {
    if (paused) {
      if (dirty) { queue = []; current = null; dirty = false; setStep(''); say(HINT); }
      paused = false;
    } else paused = true;
    showMode();
  });
  ui.speed.addEventListener('click', () => {
    speedI = (speedI + 1) % SPEEDS.length;
    ui.speed.textContent = SPEEDS[speedI][1];
  });

  function reset() {
    blocks.forEach((b) => scene.remove(b.mesh));
    blocks = []; loose = []; held = null; colorI = 0; serial = 0;
    PADS.forEach((p) => { p.stack = []; });
    for (let i = 0; i < 3; i++) PADS[0].stack.push(makeBlock(PADS[0].x, slotY(PADS[0]), PADS[0].z));
    queue = []; current = null; target = 1; dirty = false; gap = 0.1;
    ik({ x: 0.45, y: CLEAR, z: 0.05 }).forEach((v, i) => { q[i] = v; });
    traceCount = 0; traceGeo.setDrawRange(0, 0);
    setStep(''); say(HINT);
    apply(); readouts();
  }
  ui.reset.addEventListener('click', () => { reset(); paused = false; showMode(); });

  // ---- manual joint sliders
  let dragging = false;
  ui.q.forEach((el, i) => {
    el.addEventListener('pointerdown', () => { dragging = true; });
    window.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('input', () => {
      const before = q[i];
      q[i] = +el.value / DEG;
      apply();
      if (tcpWorld.y < 0.03 + (held ? BLOCK / 2 : 0)) {
        q[i] = before; apply();
        say('Stopped: the tool would hit the table', true);
      } else say('Manual jog · press Resume auto');
      paused = true; dirty = true; showMode();
      ui.v[i].textContent = (q[i] * DEG).toFixed(0) + '°';
      readouts();
    });
  });

  // ---- click the bench to drop a block
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function pointOnBench(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(benchPlane, hit)) return null;
    return (Math.abs(hit.x) <= 1 && Math.abs(hit.z) <= 0.75) ? hit.clone() : null;
  }
  function whyNot(p) {
    const r = Math.hypot(p.x, p.z);
    if (r < RMIN) return 'Too close to the base';
    if (r > RMAX) return 'Out of reach';
    if (PADS.some((a) => Math.hypot(a.x - p.x, a.z - p.z) < 0.11)) return 'Too close to a pad';
    if (loose.some((b) => Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z) < 0.09)) return 'Another block is there';
    return '';
  }
  let downX = 0, downY = 0, downT = 0;
  canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 500) return;
    const p = pointOnBench(e);
    if (!p) return;
    const why = whyNot(p);
    if (why) { say(why, true); return; }
    if (blocks.length >= MAX_BLOCKS) { say('Table is full · press Reset', true); return; }
    const b = makeBlock(p.x, 0.62, p.z);
    b.falling = true;
    loose.push(b);
    say('Block ' + b.id + ' dropped · the arm will fetch it');
    if (dirty) say('Block dropped · press Resume auto to fetch it');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') { cursor.visible = false; return; }
    const p = pointOnBench(e);
    cursor.visible = !!p;
    if (p) {
      cursor.position.x = p.x; cursor.position.z = p.z;
      cursor.material.color.setHex(whyNot(p) ? 0xEF4444 : 0x4FB38A);
    }
  });
  canvas.addEventListener('pointerleave', () => { cursor.visible = false; });

  // ---- camera framing
  let userCamera = false;
  controls.addEventListener('start', () => { userCamera = true; });
  const strip = stage.querySelector('.arm-strip');
  const tanHalf = Math.tan((camera.fov / 2) / DEG);
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pad = strip ? strip.offsetHeight + 20 : 0, top = 40;
    camera.setViewOffset(w, h, 0, (pad - top) / 2, w, h);
    if (!userCamera) {
      const usable = Math.max(120, h - pad - top);
      const fitH = (1.2 * h) / (2 * tanHalf * usable);
      const fitW = 1.9 / (2 * tanHalf * (w / h));
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).setLength(Math.max(fitH, fitW));
      camera.position.copy(controls.target).add(dir);
    }
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  resize();

  // ---- loop
  let last = performance.now(), raf = 0, visible = true;
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1); // never jump after a stalled frame
    last = now;
    physics(dt);
    if (!paused) {
      step(dt * SPEEDS[speedI][0]);
      apply(); readouts(); pushTrace();
    }
    controls.update();
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    last = performance.now();
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(loop);
  }).observe(stage);

  reset();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) paused = true;
  showMode();
  stage.classList.add('ready');
  const fb = $('armFallback'); if (fb) fb.hidden = true;
  raf = requestAnimationFrame(loop);
}
