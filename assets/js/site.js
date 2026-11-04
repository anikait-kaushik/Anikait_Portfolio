/* ==========================================================
   Site behaviour — kept deliberately small and purposeful.
   Everything degrades gracefully without JavaScript.
   ========================================================== */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- footer year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- mobile nav ---------- */
  var toggle = $('.navtoggle'), links = $('.navlinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    $$('a', links).forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* ---------- reading progress ---------- */
  var bar = $('.progress');
  if (bar) {
    var tick = false;
    var upd = function () {
      var max = doc.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      tick = false;
    };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ---------- scroll-spy (nav + case-study TOC) ---------- */
  var spyLinks = $$('.navlinks a[href^="#"], .toc a[href^="#"]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    spyLinks.forEach(function (a) { (byId[a.getAttribute('href').slice(1)] = byId[a.getAttribute('href').slice(1)] || []).push(a); });
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        spyLinks.forEach(function (a) { a.classList.remove('active'); });
        (byId[e.target.id] || []).forEach(function (a) { a.classList.add('active'); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) { var t = document.getElementById(id); if (t) spy.observe(t); });
  }

  /* ---------- subtle reveal ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var rv = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } });
    }, { threshold: 0.08 });
    $$('.reveal').forEach(function (el) { rv.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- publication filter ---------- */
  var pfb = $$('.pfilter button');
  pfb.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f');
      pfb.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      $$('.pub').forEach(function (p) {
        var kinds = (p.getAttribute('data-kind') || '').split(' ');
        p.hidden = !(f === 'all' || kinds.indexOf(f) !== -1);
      });
    });
  });

  /* ---------- only one video plays at a time ---------- */
  $$('video').forEach(function (v) {
    v.addEventListener('play', function () { $$('video').forEach(function (o) { if (o !== v) o.pause(); }); });
  });

  /* ---------- lightbox for evidence images ---------- */
  var zi = $$('img.zoom');
  if (zi.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Previous image">←</button><img alt="">' +
      '<button class="lb-btn lb-next" type="button" aria-label="Next image">→</button><div class="lb-cap"></div>';
    document.body.appendChild(lb);
    var li = $('img', lb), lc = $('.lb-cap', lb), cur = 0, back = null;
    var show = function (i) {
      cur = (i + zi.length) % zi.length;
      var s = zi[cur]; li.src = s.currentSrc || s.src; li.alt = s.alt;
      var fc = s.closest('figure') && s.closest('figure').querySelector('figcaption');
      lc.textContent = (cur + 1) + ' / ' + zi.length + ' — ' + ((fc && fc.textContent.trim()) || s.alt);
    };
    var open = function (i) { back = document.activeElement; show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; $('.lb-close', lb).focus(); };
    var close = function () { lb.classList.remove('open'); document.body.style.overflow = ''; if (back) back.focus(); };
    zi.forEach(function (img, i) {
      img.tabIndex = 0; img.setAttribute('role', 'button');
      img.addEventListener('click', function (e) { e.preventDefault(); open(i); });
      img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(cur - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* ==========================================================
     Interactive lab: planar 3-DOF manipulator, analytic IK
     ========================================================== */
  var stage = $('#labStage'), cv = $('#armCanvas');
  if (stage && cv && cv.getContext) {
    var c = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, U = 0, base = { x: 0, y: 0 }, L = [0, 0, 0];
    var q = [Math.PI / 2, -0.9, -0.6], tgt = { x: 0, y: 0 }, reachable = true;
    var manual = false, lastP = 0, running = false, raf = 0, trail = [];
    var pads = [], block = { pad: 0, held: false, x: 0, y: 0 };
    var g = function (id) { return document.getElementById(id); };
    var ui = { j: [g('j1'), g('j2'), g('j3')], jb: [g('j1b'), g('j2b'), g('j3b')], ee: g('eePos'), mode: g('armMode'), st: g('armStatus'), tg: g('armTarget') };
    var wrapA = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

    var resize = function () {
      var r = stage.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      U = Math.min(W * 0.52, H * 0.95); L = [0.42 * U, 0.34 * U, 0.14 * U];
      base = { x: W / 2, y: H - 34 };
      pads = [{ x: base.x - 0.62 * U, y: base.y }, { x: base.x + 0.62 * U, y: base.y }];
      if (!tgt.x) { tgt.x = base.x + 0.3 * U; tgt.y = base.y - 0.55 * U; }
    };
    // Analytic IK: wrist point from desired tool angle, then closed-form 2R (elbow-up)
    var ik = function (tx, ty) {
      var x = tx - base.x, y = Math.max(4, base.y - ty);
      var phi = Math.atan2(y, x), down = Math.max(0, Math.min(1, 1 - y / (0.45 * U)));
      phi += wrapA(-Math.PI / 2 - phi) * down;
      var wx = x - L[2] * Math.cos(phi), wy = y - L[2] * Math.sin(phi), d = Math.hypot(wx, wy);
      var dMax = L[0] + L[1] - 0.5, dMin = Math.abs(L[0] - L[1]) + 0.5;
      reachable = d <= dMax && d >= dMin;
      if (d > dMax) { wx *= dMax / d; wy *= dMax / d; d = dMax; }
      if (d < dMin) { var s = dMin / Math.max(d, 1e-6); wx *= s; wy *= s; d = dMin; }
      var c2 = (d * d - L[0] * L[0] - L[1] * L[1]) / (2 * L[0] * L[1]);
      var t2 = -Math.acos(Math.max(-1, Math.min(1, c2)));
      var t1 = Math.atan2(wy, wx) - Math.atan2(L[1] * Math.sin(t2), L[0] + L[1] * Math.cos(t2));
      return [t1, t2, wrapA(phi - t1 - t2)];
    };
    var fk = function (qq) {
      var P = [{ x: base.x, y: base.y }], a = 0, x = 0, y = 0;
      for (var i = 0; i < 3; i++) { a += qq[i]; x += L[i] * Math.cos(a); y += L[i] * Math.sin(a); P.push({ x: base.x + x, y: base.y - y, a: a }); }
      return P;
    };
    var seq = [], si = 0, st0 = 0, from = { x: 0, y: 0 };
    var build = function () {
      var a = pads[block.pad], b = pads[1 - block.pad], h = 0.42 * U;
      seq = [{ x: a.x, y: a.y - h, t: 900 }, { x: a.x, y: a.y - 18, t: 700, grab: 1 }, { x: a.x, y: a.y - h, t: 600 },
        { x: base.x, y: base.y - 0.78 * U, t: 900 }, { x: b.x, y: b.y - h, t: 900 }, { x: b.x, y: b.y - 18, t: 700, drop: 1 }, { x: b.x, y: b.y - h, t: 600 }];
      si = 0; st0 = performance.now(); from = { x: tgt.x, y: tgt.y };
    };
    var auto = function (now) {
      if (!seq.length) build();
      var w = seq[si], k = Math.min(1, (now - st0) / w.t), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      tgt.x = from.x + (w.x - from.x) * e; tgt.y = from.y + (w.y - from.y) * e;
      if (k >= 1) {
        if (w.grab) block.held = true;
        if (w.drop) { block.held = false; block.pad = 1 - block.pad; }
        from = { x: w.x, y: w.y }; si++; st0 = now; if (si >= seq.length) seq = [];
      }
    };
    var draw = function (now) {
      if (!manual && !reduce) auto(now);
      if (manual && now - lastP > 2500) { manual = false; seq = []; block.held = false; ui.mode.textContent = 'AUTO'; ui.mode.classList.remove('manual'); }
      var qt = ik(tgt.x, tgt.y);
      for (var i = 0; i < 3; i++) q[i] += wrapA(qt[i] - q[i]) * (manual ? .22 : .35);
      var P = fk(q), ee = P[3];
      trail.push({ x: ee.x, y: ee.y }); if (trail.length > 46) trail.shift();
      if (block.held) { block.x = ee.x + Math.cos(ee.a) * 15; block.y = ee.y - Math.sin(ee.a) * 15 + 9; }
      c.clearRect(0, 0, W, H);
      c.save(); c.setLineDash([4, 6]); c.strokeStyle = 'rgba(79,179,138,.25)'; c.lineWidth = 1;
      c.beginPath(); c.arc(base.x, base.y, L[0] + L[1] + L[2], Math.PI, 2 * Math.PI); c.stroke();
      c.beginPath(); c.arc(base.x, base.y, Math.abs(L[0] - L[1]) + L[2], Math.PI, 2 * Math.PI); c.stroke(); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(0, base.y + .5); c.lineTo(W, base.y + .5); c.stroke();
      pads.forEach(function (p, i) {
        c.fillStyle = 'rgba(79,179,138,.15)'; c.fillRect(p.x - 26, p.y - 3, 52, 6);
        c.fillStyle = 'rgba(160,175,188,.85)'; c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillText(i ? 'PLACE' : 'PICK', p.x, p.y + 20);
      });
      var bx = block.held ? block.x : pads[block.pad].x, by = block.held ? block.y : pads[block.pad].y - 3;
      c.fillStyle = '#D9694B'; c.fillRect(bx - 9, by - 18, 18, 18);
      for (var t = 1; t < trail.length; t++) {
        c.strokeStyle = 'rgba(79,179,138,' + (t / trail.length * .55).toFixed(3) + ')'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(trail[t - 1].x, trail[t - 1].y); c.lineTo(trail[t].x, trail[t].y); c.stroke();
      }
      c.strokeStyle = reachable ? 'rgba(79,179,138,.95)' : 'rgba(255,122,92,.95)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(tgt.x, tgt.y, 9, 0, 2 * Math.PI);
      c.moveTo(tgt.x - 15, tgt.y); c.lineTo(tgt.x - 5, tgt.y); c.moveTo(tgt.x + 5, tgt.y); c.lineTo(tgt.x + 15, tgt.y);
      c.moveTo(tgt.x, tgt.y - 15); c.lineTo(tgt.x, tgt.y - 5); c.moveTo(tgt.x, tgt.y + 5); c.lineTo(tgt.x, tgt.y + 15); c.stroke();
      c.fillStyle = '#2A313C'; c.fillRect(base.x - 34, base.y - 6, 68, 12); c.fillStyle = '#3A4350'; c.fillRect(base.x - 22, base.y - 14, 44, 10);
      [16, 12, 8].forEach(function (w, k) {
        c.lineCap = 'round'; c.strokeStyle = k === 1 ? '#C9D3DC' : '#E8EDF1'; c.lineWidth = w;
        c.beginPath(); c.moveTo(P[k].x, P[k].y); c.lineTo(P[k + 1].x, P[k + 1].y); c.stroke();
      });
      [11, 9, 7].forEach(function (r, i) {
        c.fillStyle = '#14161B'; c.beginPath(); c.arc(P[i].x, P[i].y, r, 0, 2 * Math.PI); c.fill();
        c.strokeStyle = '#D9694B'; c.lineWidth = 2.5; c.stroke();
      });
      var ga = ee.a, op = block.held ? 6 : 11, gx = Math.cos(ga), gy = -Math.sin(ga), nx = -gy, ny = gx;
      c.strokeStyle = '#E8EDF1'; c.lineWidth = 3; c.beginPath();
      c.moveTo(ee.x + nx * op, ee.y + ny * op); c.lineTo(ee.x - nx * op, ee.y - ny * op);
      c.moveTo(ee.x + nx * op, ee.y + ny * op); c.lineTo(ee.x + nx * op + gx * 12, ee.y + ny * op + gy * 12);
      c.moveTo(ee.x - nx * op, ee.y - ny * op); c.lineTo(ee.x - nx * op + gx * 12, ee.y - ny * op + gy * 12); c.stroke();
      for (var j = 0; j < 3; j++) {
        var deg = wrapA(q[j]) * 180 / Math.PI, pc = Math.abs(deg) / 180 * 50;
        ui.j[j].textContent = (deg >= 0 ? '+' : '') + deg.toFixed(1) + '°';
        ui.jb[j].style.width = pc + '%'; ui.jb[j].style.left = deg >= 0 ? '50%' : (50 - pc) + '%';
      }
      ui.ee.textContent = '(' + ((ee.x - base.x) / U).toFixed(2) + ', ' + ((base.y - ee.y) / U).toFixed(2) + ')';
      ui.tg.textContent = 'x ' + Math.round(tgt.x - base.x) + ' · y ' + Math.round(base.y - tgt.y);
      ui.st.textContent = reachable ? 'REACHABLE' : 'OUT OF REACH · CLAMPED'; ui.st.classList.toggle('out', !reachable);
      raf = requestAnimationFrame(draw);
    };
    var pt = function (e) {
      var r = stage.getBoundingClientRect(); tgt.x = e.clientX - r.left; tgt.y = e.clientY - r.top; lastP = performance.now();
      if (!manual) { manual = true; block.held = false; ui.mode.textContent = 'MANUAL'; ui.mode.classList.add('manual'); }
    };
    stage.addEventListener('pointermove', pt); stage.addEventListener('pointerdown', pt);
    resize();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); seq = []; }, 150); });
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!running) { running = true; raf = requestAnimationFrame(draw); } }
      else { running = false; cancelAnimationFrame(raf); }
    }).observe(stage);
  }
})();
