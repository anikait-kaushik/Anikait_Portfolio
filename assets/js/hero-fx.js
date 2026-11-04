/* ==========================================================
   Hero background: a live rover that plans with A* and maps
   its surroundings with a simulated 2D LiDAR.
   - Move the cursor (or tap) to set the goal; idle → explores.
   - Obstacles are faint until a LiDAR ray hits them, then they
     light up and slowly fade (a toy occupancy-mapping effect).
   Pure canvas, no dependencies. Pauses off-screen; static
   frame for prefers-reduced-motion.
   ========================================================== */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  var cv = document.getElementById('heroFx');
  if (!hero || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var CELL = 30, RAYS = 56, RANGE = 210, SPEED = 135;
  var W = 0, H = 0, cols = 0, rows = 0, grid = null, seen = null, nogo = null;
  // keep the rover in visible space: never plan behind the reel, text or metric cards
  var KEEP_OUT = ['.reel', '.hero-grid > div:first-child', '.metrics'];
  var blocked = function (k) { return grid[k] || nogo[k]; };
  var robot = { x: 0, y: 0, a: 0 }, path = [], goal = null, trail = [];
  var lastPlan = 0, pendingGoal = null, idleT = 0, userActive = false, lastUser = 0;
  var hud = { nodes: 0, len: 0, hits: 0 };
  var running = false, raf = 0, last = 0;

  // deterministic RNG so the map is stable between visits
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // fade the scene towards the text column on the left
  var fade = function (x) {
    var t = Math.max(0, Math.min(1, (x / W - 0.18) / 0.42));
    return 0.18 + 0.82 * t * t * (3 - 2 * t);
  };

  function build() {
    var r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    grid = new Uint8Array(cols * rows); seen = new Float32Array(cols * rows);
    seed = 7;
    var blocks = Math.round(cols * rows / 26);
    for (var b = 0; b < blocks; b++) {
      var cx = Math.floor(rnd() * cols), cy = Math.floor(rnd() * rows);
      if (rnd() > (cx / cols) * 1.4) continue;           // sparser near the text
      var w = 1 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 3);
      if (rnd() < 0.35) { if (rnd() < 0.5) w = 4 + Math.floor(rnd() * 3); else h = 4 + Math.floor(rnd() * 3); }
      for (var y = cy; y < Math.min(rows, cy + h); y++)
        for (var x = cx; x < Math.min(cols, cx + w); x++) grid[y * cols + x] = 1;
    }
    nogo = new Uint8Array(cols * rows);
    var hr = hero.getBoundingClientRect();
    KEEP_OUT.forEach(function (sel) {
      var el = hero.querySelector(sel); if (!el) return;
      var r = el.getBoundingClientRect(), pad = CELL * 0.5;
      var x0 = Math.max(0, Math.floor((r.left - hr.left - pad) / CELL)), x1 = Math.min(cols - 1, Math.floor((r.right - hr.left + pad) / CELL));
      var y0 = Math.max(0, Math.floor((r.top - hr.top - pad) / CELL)), y1 = Math.min(rows - 1, Math.floor((r.bottom - hr.top + pad) / CELL));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) nogo[y * cols + x] = 1;
    });
    var start = freeNear(Math.floor(cols * 0.97), Math.floor(rows * 0.12));
    robot.x = (start % cols + 0.5) * CELL; robot.y = (Math.floor(start / cols) + 0.5) * CELL; robot.a = 0;
    path = []; trail = []; goal = null;
  }

  function freeNear(cx, cy) {
    cx = Math.max(0, Math.min(cols - 1, cx)); cy = Math.max(0, Math.min(rows - 1, cy));
    for (var r = 0; r < Math.max(cols, rows); r++)
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < cols && y < rows && !blocked(y * cols + x)) return y * cols + x;
      }
    return 0;
  }

  // A* on an 8-connected grid (no corner cutting), octile heuristic
  function astar(s, g) {
    var N = cols * rows, gS = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var open = [s]; gS[s] = 0; var nodes = 0;
    var h = function (i) { var dx = Math.abs(i % cols - g % cols), dy = Math.abs(Math.floor(i / cols) - Math.floor(g / cols)); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    var f = new Float32Array(N).fill(Infinity); f[s] = h(s);
    while (open.length) {
      var bi = 0; for (var k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      var c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (c === g) break;
      if (closed[c]) continue; closed[c] = 1; nodes++;
      var cx = c % cols, cy = Math.floor(c / cols);
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var n = ny * cols + nx; if (blocked(n) || closed[n]) continue;
        if (dx && dy && (blocked(cy * cols + nx) || blocked(ny * cols + cx))) continue;
        var t = gS[c] + (dx && dy ? Math.SQRT2 : 1);
        if (t < gS[n]) { gS[n] = t; came[n] = c; f[n] = t + h(n); open.push(n); }
      }
    }
    hud.nodes = nodes;
    if (came[g] === -1 && s !== g) return [];
    var out = [], cur = g; while (cur !== -1) { out.push(cur); cur = came[cur]; }
    out.reverse(); hud.len = out.length;
    return out.map(function (i) { return { x: (i % cols + 0.5) * CELL, y: (Math.floor(i / cols) + 0.5) * CELL }; });
  }

  function plan(px, py) {
    var s = freeNear(Math.floor(robot.x / CELL), Math.floor(robot.y / CELL));
    var g = freeNear(Math.floor(px / CELL), Math.floor(py / CELL));
    goal = { x: (g % cols + 0.5) * CELL, y: (Math.floor(g / cols) + 0.5) * CELL };
    path = astar(s, g); if (path.length) path.shift();
  }

  function lidar() {
    var hits = [], cnt = 0;
    for (var i = 0; i < RAYS; i++) {
      var ang = robot.a + (i / RAYS) * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang), d = 0, hit = false;
      for (d = 6; d < RANGE; d += 4) {
        var x = robot.x + dx * d, y = robot.y + dy * d, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) break;
        if (grid[cy * cols + cx]) { seen[cy * cols + cx] = 1; hit = true; cnt++; break; }
      }
      hits.push({ x: robot.x + dx * d, y: robot.y + dy * d, hit: hit });
    }
    hud.hits = cnt;
    return hits;
  }

  function step(dt) {
    // goal source: user cursor, or autonomous exploration when idle
    if (pendingGoal && performance.now() - lastPlan > 140) { plan(pendingGoal.x, pendingGoal.y); pendingGoal = null; lastPlan = performance.now(); }
    userActive = performance.now() - lastUser < 4000;
    if (!userActive && !path.length) {
      idleT += dt;
      if (idleT > 0.6) { idleT = 0; plan(W * (0.5 + rnd() * 0.5), H * (0.05 + rnd() * 0.9)); }
    }
    if (path.length) {
      var p = path[0], dx = p.x - robot.x, dy = p.y - robot.y, dist = Math.hypot(dx, dy);
      var target = Math.atan2(dy, dx), da = Math.atan2(Math.sin(target - robot.a), Math.cos(target - robot.a));
      robot.a += da * Math.min(1, dt * 9);
      var v = SPEED * dt * (1 - Math.min(0.7, Math.abs(da) / Math.PI));
      if (dist <= v) { robot.x = p.x; robot.y = p.y; path.shift(); } else { robot.x += dx / dist * v; robot.y += dy / dist * v; }
      trail.push({ x: robot.x, y: robot.y }); if (trail.length > 160) trail.shift();
    }
    for (var i = 0; i < seen.length; i++) if (seen[i] > 0) seen[i] = Math.max(0, seen[i] - dt * 0.18);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var x, y, i;
    // grid dots
    for (y = 0; y <= rows; y++) for (x = 0; x <= cols; x++) {
      var px = x * CELL, py = y * CELL, a = fade(px);
      ctx.fillStyle = 'rgba(15,23,42,' + (0.10 * a).toFixed(3) + ')';
      ctx.fillRect(px - 0.75, py - 0.75, 1.5, 1.5);
    }
    // obstacles: faint until scanned
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      var k = y * cols + x; if (!grid[k]) continue;
      var fa = fade(x * CELL), s = seen[k];
      ctx.fillStyle = 'rgba(15,23,42,' + ((0.035 + 0.02 * (1 - s)) * fa).toFixed(3) + ')';
      ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
      if (s > 0.01) {
        ctx.fillStyle = 'rgba(37,99,235,' + (0.22 * s * fa).toFixed(3) + ')';
        ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = 'rgba(37,99,235,' + (0.55 * s * fa).toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.strokeRect(x * CELL + 2.5, y * CELL + 2.5, CELL - 5, CELL - 5);
      }
    }
    // trail
    for (i = 1; i < trail.length; i++) {
      ctx.strokeStyle = 'rgba(234,88,12,' + (0.35 * i / trail.length * fade(trail[i].x)).toFixed(3) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
    }
    // lidar
    var hits = lidar(), ra = fade(robot.x);
    ctx.fillStyle = 'rgba(37,99,235,' + (0.05 * ra).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(hits[0].x, hits[0].y); for (i = 1; i < hits.length; i++) ctx.lineTo(hits[i].x, hits[i].y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(37,99,235,' + (0.09 * ra).toFixed(3) + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); for (i = 0; i < hits.length; i++) { ctx.moveTo(robot.x, robot.y); ctx.lineTo(hits[i].x, hits[i].y); } ctx.stroke();
    for (i = 0; i < hits.length; i++) if (hits[i].hit) {
      ctx.fillStyle = 'rgba(37,99,235,' + (0.85 * fade(hits[i].x)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(hits[i].x, hits[i].y, 2, 0, Math.PI * 2); ctx.fill();
    }
    // planned path
    if (path.length) {
      ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(124,58,237,' + (0.7 * ra).toFixed(3) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(robot.x, robot.y); for (i = 0; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y); ctx.stroke(); ctx.restore();
    }
    // goal
    if (goal) {
      var ga = fade(goal.x), t = performance.now() / 1000;
      ctx.strokeStyle = 'rgba(234,88,12,' + (0.9 * ga).toFixed(3) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(goal.x, goal.y, 9 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goal.x - 15, goal.y); ctx.lineTo(goal.x - 5, goal.y); ctx.moveTo(goal.x + 5, goal.y); ctx.lineTo(goal.x + 15, goal.y);
      ctx.moveTo(goal.x, goal.y - 15); ctx.lineTo(goal.x, goal.y - 5); ctx.moveTo(goal.x, goal.y + 5); ctx.lineTo(goal.x, goal.y + 15); ctx.stroke();
    }
    // rover
    ctx.save(); ctx.translate(robot.x, robot.y); ctx.rotate(robot.a); ctx.globalAlpha = Math.max(0.35, ra);
    ctx.fillStyle = '#0B1220'; ctx.fillRect(-7, -9, 4, 4); ctx.fillRect(3, -9, 4, 4); ctx.fillRect(-7, 5, 4, 4); ctx.fillRect(3, 5, 4, 4);
    ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9, -6, 18, 12, 3) : ctx.rect(-9, -6, 18, 12); ctx.fill();
    ctx.fillStyle = '#EA580C'; ctx.fillRect(5, -3, 4, 6);
    ctx.fillStyle = '#60A5FA'; ctx.beginPath(); ctx.arc(-1, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // telemetry
    ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(91,102,120,.75)';
    ctx.fillText((userActive ? 'GOAL: CURSOR' : 'GOAL: EXPLORE') + ' · A* NODES ' + hud.nodes + ' · PATH ' + hud.len + ' · LIDAR HITS ' + hud.hits + '/' + RAYS, W - 24, H - 14);
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    step(dt); draw();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (!running && !reduce) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = hero.getBoundingClientRect(); pendingGoal = { x: e.clientX - r.left, y: e.clientY - r.top }; lastUser = performance.now();
  });
  hero.addEventListener('pointerdown', function (e) {
    var r = hero.getBoundingClientRect(); pendingGoal = { x: e.clientX - r.left, y: e.clientY - r.top }; lastUser = performance.now();
  });

  build();
  // re-measure keep-out zones once the hero's entrance animation has settled
  setTimeout(function () { var rx = robot.x, ry = robot.y; build(); if (!nogo[Math.floor(ry / CELL) * cols + Math.floor(rx / CELL)]) { robot.x = rx; robot.y = ry; } }, 1300);
  if (reduce) { plan(W * 0.8, H * 0.3); lidar(); for (var i = 0; i < seen.length; i++) seen[i] = seen[i] ? 0.6 : 0; draw(); return; }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); if (!running) draw(); }, 200); });
  new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }).observe(hero);
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
