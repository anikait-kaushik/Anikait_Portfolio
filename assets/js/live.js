/* ==========================================================
   LIVE LAYER — makes the portfolio dynamic & lively.
   Vanilla JS, no dependencies. Everything degrades gracefully:
   no JS / reduced-motion visitors still get the full content.
   ========================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  doc.classList.add('js-live');

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ------------------------------------------------------------
     1. Scroll progress bar, nav state, back-to-top ring
     ------------------------------------------------------------ */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  var toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.type = 'button';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML =
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-bg" cx="24" cy="24" r="22"/>' +
    '<circle class="ring" cx="24" cy="24" r="22"/></svg><span aria-hidden="true">↑</span>';
  document.body.appendChild(toTop);
  var ring = $('.ring', toTop);
  var CIRC = 2 * Math.PI * 22;
  ring.style.strokeDasharray = CIRC;
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  var nav = $('header.nav');
  var heroBg = $('.hero .bg');
  var hero = $('.hero');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, y / max) : 0;
    bar.style.transform = 'scaleX(' + p + ')';
    ring.style.strokeDashoffset = CIRC * (1 - p);
    toTop.classList.toggle('show', y > window.innerHeight * 0.8);
    if (nav) nav.classList.toggle('scrolled', y > 10);
    if (heroBg && !reduceMotion && hero && y < hero.offsetHeight) {
      heroBg.style.translate = '0 ' + (y * 0.25).toFixed(1) + 'px';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ------------------------------------------------------------
     2. Scroll-spy: highlight the nav link for the visible section
     ------------------------------------------------------------ */
  var links = $$('.navlinks a[href^="#"]');
  var linkFor = {};
  links.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove('active'); });
      var a = linkFor[e.target.id];
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('section[id]').forEach(function (s) { spy.observe(s); });

  /* ------------------------------------------------------------
     3. Hero: live IST clock chip + rotating "I build ___" text
     ------------------------------------------------------------ */
  var clockEl = $('#liveClock');
  if (clockEl) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    } catch (e) { fmt = null; }
    var tick = function () {
      if (fmt) clockEl.textContent = fmt.format(new Date()) + ' IST';
    };
    tick();
    setInterval(tick, 15000);
  }

  var greetEl = $('#liveGreeting');
  if (greetEl) {
    var h = new Date().getHours();
    greetEl.textContent = h < 5 ? 'Up late?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  var typed = $('.typed');
  if (typed && !reduceMotion) {
    var words = (typed.getAttribute('data-words') || '').split('|').filter(Boolean);
    if (words.length > 1) {
      var wi = 0, ci = words[0].length, deleting = true;
      var step = function () {
        var word = words[wi];
        if (deleting) {
          ci--;
          typed.textContent = word.slice(0, ci);
          if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; }
          setTimeout(step, 38);
        } else {
          var next = words[wi];
          ci++;
          typed.textContent = next.slice(0, ci);
          if (ci >= next.length) { deleting = true; setTimeout(step, 2200); }
          else setTimeout(step, 70);
        }
      };
      setTimeout(step, 2600);
    }
  }

  /* ------------------------------------------------------------
     4. Hero canvas: drifting "sensor network" that reacts to the cursor
     ------------------------------------------------------------ */
  var canvas = $('.hero-fx');
  if (canvas && hero && !reduceMotion && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, nodes = [], mouse = { x: -9999, y: -9999 }, running = false, raf = 0;

    var resize = function () {
      W = hero.offsetWidth; H = hero.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, Math.max(28, W * H / 16000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6, hot: Math.random() < 0.18
        });
      }
    };

    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      var LINK = 130, LINK2 = LINK * LINK;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var dxm = n.x - mouse.x, dym = n.y - mouse.y, dm2 = dxm * dxm + dym * dym;
        if (dm2 < 22000) { var f = (22000 - dm2) / 22000 * 0.6; n.x += dxm * f * 0.02; n.y += dym * f * 0.02; }
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        // fade nodes over the left text column so copy stays readable
        var fade = Math.min(1, Math.max(0.15, n.x / (W * 0.55)));
        for (var j = i + 1; j < nodes.length; j++) {
          var m = nodes[j], dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            ctx.strokeStyle = 'rgba(160,185,200,' + ((1 - d2 / LINK2) * 0.22 * fade).toFixed(3) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
          }
        }
        if (dm2 < LINK2 * 1.6) {
          ctx.strokeStyle = 'rgba(217,106,76,' + ((1 - dm2 / (LINK2 * 1.6)) * 0.5).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = n.hot ? 'rgba(217,106,76,' + (0.85 * fade) + ')' : 'rgba(220,230,238,' + (0.55 * fade) + ')';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    var start = function () { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    var stop = function () { running = false; cancelAnimationFrame(raf); };

    resize();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  }

  /* ------------------------------------------------------------
     5. Headings: word-by-word rise; eyebrow lines draw in
     ------------------------------------------------------------ */
  function splitWords(el) {
    var counter = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var outer = document.createElement('span');
            outer.className = 'split-word';
            var inner = document.createElement('span');
            inner.style.setProperty('--wi', counter++);
            inner.textContent = p;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    })(el);
  }

  var sections = $$('.section, .band');
  if (!reduceMotion) {
    $$('.section > .wrap > h2, .contact-grid h2, .band h2').forEach(function (h) {
      h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
      splitWords(h);
    });
  }
  var secObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('seen'); secObs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  sections.forEach(function (s) { secObs.observe(s); });

  /* ------------------------------------------------------------
     6. Staggered children inside existing .reveal containers
     ------------------------------------------------------------ */
  var staggerSel = ['.exp-list', '.cards', '.pub-list', '.skills-grid', '.mars-gallery', '.achievement-grid', '.statgrid', '.outreach', '.scholar'];
  if (!reduceMotion) {
    staggerSel.forEach(function (sel) {
      $$(sel).forEach(function (wrap) {
        Array.prototype.slice.call(wrap.children).forEach(function (c, i) {
          c.classList.add('reveal-child');
          c.style.setProperty('--ci', Math.min(i, 8));
        });
        if (!wrap.classList.contains('reveal')) wrap.classList.add('reveal');
        wrap.classList.add('stagger');
      });
    });
    // profile cards + facts that weren't previously animated
    $$('.profile-focus, .profile-facts, .mars-stats').forEach(function (wrap) {
      Array.prototype.slice.call(wrap.children).forEach(function (c, i) {
        c.classList.add('reveal-child');
        c.style.setProperty('--ci', i);
      });
      wrap.classList.add('reveal', 'stagger');
    });
    var revObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); }
      });
    }, { threshold: 0.06 });
    $$('.reveal').forEach(function (el) { revObs.observe(el); });
  }

  /* ------------------------------------------------------------
     7. Count-up numbers (stats, CGPA, scholarships)
     ------------------------------------------------------------ */
  var numRe = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;
  var counters = [];
  $$('.mars-stat .sv, .statgrid .sv, .profile-facts .fv strong, .scholar b, .metric b[data-count]').forEach(function (el) {
    var leaf = el.firstElementChild && el.children.length === 1 ? el.firstElementChild : el;
    if (leaf.children.length) return;
    var m = leaf.textContent.trim().match(numRe);
    if (!m) return;
    var raw = m[2];
    var target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    counters.push({
      el: leaf, pre: m[1], post: m[3], target: target,
      decimals: (raw.split('.')[1] || '').length,
      grouped: raw.indexOf(',') !== -1, final: leaf.textContent
    });
  });
  function fmtNum(c, v) {
    if (c.grouped) return Math.round(v).toLocaleString('en-IN');
    return v.toFixed(c.decimals);
  }
  if (!reduceMotion) {
    var cntObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cntObs.unobserve(e.target);
        var c = e.target.__counter, t0 = performance.now(), dur = 1500;
        (function frame(now) {
          var k = Math.min(1, (now - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 3);
          c.el.textContent = c.pre + fmtNum(c, c.target * eased) + c.post;
          if (k < 1) requestAnimationFrame(frame); else c.el.textContent = c.final;
        })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) {
      c.el.__counter = c;
      c.el.textContent = c.pre + fmtNum(c, 0) + c.post;
      cntObs.observe(c.el);
    });
  }

  /* ------------------------------------------------------------
     8. Cursor spotlight + gentle 3D tilt + magnetic buttons
     ------------------------------------------------------------ */
  if (finePointer && !reduceMotion) {
    $$('.card, .exp, .pf-card, .achievement-card, .mars-intro, .flag, .pub-list, .statgrid .st').forEach(function (el) {
      el.classList.add('spot');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    $$('.pf-card, .achievement-card, .mars-stat, .statgrid .st, .profile-facts .pfact').forEach(function (el) {
      el.classList.add('tilt');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        var amt = r.width > 360 ? 3 : 6;
        el.style.transition = 'transform .12s ease-out, box-shadow .25s ease, border-color .25s ease';
        el.style.transform = 'perspective(900px) rotateX(' + (-py * amt).toFixed(2) + 'deg) rotateY(' + (px * amt).toFixed(2) + 'deg) translateY(-3px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .45s cubic-bezier(.2,.7,.2,1), box-shadow .25s ease, border-color .25s ease';
        el.style.transform = '';
      });
    });

    $$('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------
     9. Lightbox for every content image (certificates, CAD, photos)
     ------------------------------------------------------------ */
  var zoomImgs = $$('main img, section img').filter(function (img) {
    return !img.closest('.hero') && !img.closest('.mars-flip-shell');
  });
  if (zoomImgs.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML =
      '<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Previous image">←</button>' +
      '<img alt="">' +
      '<button class="lb-btn lb-next" type="button" aria-label="Next image">→</button>' +
      '<div class="lb-cap"><span class="lb-count"></span><span class="lb-text"></span></div>';
    document.body.appendChild(lb);
    var lbImg = $('img', lb), lbText = $('.lb-text', lb), lbCount = $('.lb-count', lb);
    var current = 0, lastFocus = null;

    var show = function (i) {
      current = (i + zoomImgs.length) % zoomImgs.length;
      var src = zoomImgs[current];
      lbImg.src = src.currentSrc || src.src;
      lbImg.alt = src.alt || '';
      var fig = src.closest('figure');
      var cap = fig && fig.querySelector('figcaption');
      lbText.textContent = (cap && cap.textContent.trim()) || src.alt || '';
      lbCount.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(zoomImgs.length).padStart(2, '0');
    };
    var open = function (i) {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    };
    var close = function () {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    zoomImgs.forEach(function (img, i) {
      img.classList.add('zoomable');
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Enlarge image: ' + (img.alt || 'photo'));
      img.addEventListener('click', function () { open(i); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(current - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });
    var tx = null;
    lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      tx = null;
    });
  }

  /* ------------------------------------------------------------
     10. Autoplaying loop video only runs while on screen
     ------------------------------------------------------------ */
  var vidObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { if (!reduceMotion) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
      else v.pause();
    });
  }, { threshold: 0.25 });
  $$('video[autoplay]').forEach(function (v) { vidObs.observe(v); });
  // pause any other playing video when one starts
  $$('video').forEach(function (v) {
    v.addEventListener('play', function () {
      if (v.hasAttribute('autoplay')) return;
      $$('video').forEach(function (o) { if (o !== v && !o.hasAttribute('autoplay')) o.pause(); });
    });
  });

  /* ============================================================
     ROBOTICS / TECH LAYER (v2)
     ============================================================ */

  /* ------------------------------------------------------------
     11. Hero telemetry HUD: count-up, mission clock, link jitter
     ------------------------------------------------------------ */
  var hudNums = $$('.hud [data-hud]');
  if (hudNums.length && !reduceMotion) {
    var hT0 = performance.now() + 1100;
    hudNums.forEach(function (el) { el.textContent = '0'; });
    (function hudFrame(now) {
      var k = Math.max(0, Math.min(1, (now - hT0) / 1600));
      var e = 1 - Math.pow(1 - k, 3);
      hudNums.forEach(function (el) { el.textContent = Math.round(+el.getAttribute('data-hud') * e); });
      if (k < 1) requestAnimationFrame(hudFrame);
    })(performance.now());
  }
  var hudClock = $('#hudClock'), hudLink = $('#hudLink');
  if (hudClock) {
    var mStart = Date.now();
    setInterval(function () {
      var s = Math.floor((Date.now() - mStart) / 1000);
      var pad = function (n) { return String(n).padStart(2, '0'); };
      hudClock.textContent = 'T+' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
      if (hudLink && !reduceMotion && s % 2 === 0) hudLink.textContent = 'LINK ' + (95 + Math.floor(Math.random() * 5)) + '%';
    }, 1000);
  }

  /* ------------------------------------------------------------
     12. Section labels decode like a terminal when they appear
     ------------------------------------------------------------ */
  var GLYPHS = '01<>/\\[]{}#*+=-_ABCDEFXYZ';
  function scramble(node) {
    var finalText = node.textContent, len = finalText.length, start = performance.now(), dur = 700;
    (function f(now) {
      var k = Math.min(1, (now - start) / dur), out = '';
      for (var i = 0; i < len; i++) {
        var ch = finalText[i];
        if (ch === ' ' || i < k * len) out += ch;
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      node.textContent = out;
      if (k < 1) requestAnimationFrame(f); else node.textContent = finalText;
    })(start);
  }
  if (!reduceMotion) {
    var scrObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        scrObs.unobserve(e.target);
        var nodes = Array.prototype.slice.call(e.target.childNodes).filter(function (n) {
          return n.nodeType === 3 && n.textContent.trim();
        });
        nodes.forEach(scramble);
      });
    }, { threshold: 0.9 });
    $$('.section .eyebrow, .band .eyebrow').forEach(function (el) { scrObs.observe(el); });
  }

  /* ------------------------------------------------------------
     13. Viewfinder brackets on media
     ------------------------------------------------------------ */
  if (finePointer) {
    $$('.mars-gallery figure, .exp-media > div, .card figure, .ganga-image, .achievement-proof, .headshot-frame, .ganga-video, .lead-video')
      .forEach(function (el) { el.classList.add('vf'); });
  }

  /* ------------------------------------------------------------
     14. Live lab: planar 3-DOF arm with analytic inverse kinematics
     ------------------------------------------------------------ */
  var stage = $('#labStage'), armCv = $('#armCanvas');
  if (stage && armCv && armCv.getContext) {
    var ac = armCv.getContext('2d');
    var adpr = Math.min(window.devicePixelRatio || 1, 2);
    var AW = 0, AH = 0, U = 0, base = { x: 0, y: 0 }, L = [0, 0, 0];
    var q = [Math.PI / 2, -0.9, -0.6];            // current joint angles (rad)
    var qT = q.slice();                            // target joint angles
    var tgt = { x: 0, y: 0 }, reachable = true;
    var manual = false, lastPointer = 0, armRunning = false, armRaf = 0;
    var trail = [], frames = 0, hzT = performance.now();
    var pads = [], block = { pad: 0, held: false, x: 0, y: 0 };

    var el = function (id) { return document.getElementById(id); };
    var ui = {
      j: [el('j1'), el('j2'), el('j3')], jb: [el('j1b'), el('j2b'), el('j3b')],
      ee: el('eePos'), hz: el('armHz'), mode: el('armMode'), status: el('armStatus'),
      target: el('armTarget'), reach: el('armReach')
    };

    var armResize = function () {
      var r = stage.getBoundingClientRect();
      AW = r.width; AH = r.height;
      armCv.width = AW * adpr; armCv.height = AH * adpr;
      ac.setTransform(adpr, 0, 0, adpr, 0, 0);
      U = Math.min(AW * 0.52, AH * 0.95);
      L = [0.42 * U, 0.34 * U, 0.14 * U];
      base = { x: AW / 2, y: AH - 34 };
      pads = [{ x: base.x - 0.62 * U, y: base.y }, { x: base.x + 0.62 * U, y: base.y }];
      if (ui.reach) ui.reach.textContent = Math.round(L[0] + L[1] + L[2]);
      if (!tgt.x) { tgt.x = base.x + 0.3 * U; tgt.y = base.y - 0.55 * U; }
    };

    var wrapAng = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

    // Solve IK for a target in canvas coords; returns joint angles (y-up maths)
    var solveIK = function (tx, ty) {
      var x = tx - base.x, y = Math.max(4, base.y - ty);
      // gripper points along base→target, turning to point down near the ground
      var phi = Math.atan2(y, x);
      var down = Math.max(0, Math.min(1, 1 - y / (0.45 * U)));
      phi += wrapAng(-Math.PI / 2 - phi) * down;
      var wx = x - L[2] * Math.cos(phi), wy = y - L[2] * Math.sin(phi);
      var d = Math.hypot(wx, wy);
      var dMax = L[0] + L[1] - 0.5, dMin = Math.abs(L[0] - L[1]) + 0.5;
      reachable = d <= dMax && d >= dMin;
      if (d > dMax) { wx *= dMax / d; wy *= dMax / d; d = dMax; }
      if (d < dMin) { var s = dMin / Math.max(d, 1e-6); wx *= s; wy *= s; d = dMin; }
      var c2 = (d * d - L[0] * L[0] - L[1] * L[1]) / (2 * L[0] * L[1]);
      var t2 = -Math.acos(Math.max(-1, Math.min(1, c2)));          // elbow-up
      var t1 = Math.atan2(wy, wx) - Math.atan2(L[1] * Math.sin(t2), L[0] + L[1] * Math.cos(t2));
      var t3 = wrapAng(phi - t1 - t2);
      return [t1, t2, t3];
    };

    var fk = function (qq) {
      var pts = [{ x: base.x, y: base.y }], a = 0, x = 0, y = 0;
      for (var i = 0; i < 3; i++) {
        a += qq[i]; x += L[i] * Math.cos(a); y += L[i] * Math.sin(a);
        pts.push({ x: base.x + x, y: base.y - y, a: a });
      }
      return pts;
    };

    // ---- autonomous pick-and-place loop ----
    var seq = [], seqI = 0, seqT0 = 0;
    var buildSeq = function () {
      var from = pads[block.pad], to = pads[1 - block.pad], hover = 0.42 * U;
      seq = [
        { x: from.x, y: from.y - hover, t: 900 },
        { x: from.x, y: from.y - 18, t: 700, grab: true },
        { x: from.x, y: from.y - hover, t: 600 },
        { x: base.x, y: base.y - 0.78 * U, t: 900 },
        { x: to.x, y: to.y - hover, t: 900 },
        { x: to.x, y: to.y - 18, t: 700, drop: true },
        { x: to.x, y: to.y - hover, t: 600 }
      ];
      seqI = 0; seqT0 = performance.now();
    };
    var seqFrom = { x: 0, y: 0 };
    var autoStep = function (now) {
      if (!seq.length) { buildSeq(); seqFrom = { x: tgt.x, y: tgt.y }; }
      var w = seq[seqI], k = Math.min(1, (now - seqT0) / w.t);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      tgt.x = seqFrom.x + (w.x - seqFrom.x) * e;
      tgt.y = seqFrom.y + (w.y - seqFrom.y) * e;
      if (k >= 1) {
        if (w.grab) block.held = true;
        if (w.drop) { block.held = false; block.pad = 1 - block.pad; }
        seqFrom = { x: w.x, y: w.y };
        seqI++; seqT0 = now;
        if (seqI >= seq.length) { seq = []; }
      }
    };

    var drawArm = function (now) {
      if (!manual && !reduceMotion) autoStep(now);
      if (manual && now - lastPointer > 2500) {
        manual = false; seq = []; block.held = false;
        ui.mode.textContent = 'AUTO'; ui.mode.classList.remove('manual');
      }
      qT = solveIK(tgt.x, tgt.y);
      for (var i = 0; i < 3; i++) q[i] += wrapAng(qT[i] - q[i]) * (manual ? 0.22 : 0.35);

      var P = fk(q), ee = P[3];
      trail.push({ x: ee.x, y: ee.y }); if (trail.length > 46) trail.shift();
      if (block.held) { block.x = ee.x + Math.cos(ee.a) * 15; block.y = ee.y - Math.sin(ee.a) * 15 + 9; }

      ac.clearRect(0, 0, AW, AH);
      // workspace envelope
      ac.save();
      ac.setLineDash([4, 6]); ac.strokeStyle = 'rgba(127,227,196,.22)'; ac.lineWidth = 1;
      ac.beginPath(); ac.arc(base.x, base.y, L[0] + L[1] + L[2], Math.PI, 2 * Math.PI); ac.stroke();
      ac.beginPath(); ac.arc(base.x, base.y, Math.abs(L[0] - L[1]) + L[2], Math.PI, 2 * Math.PI); ac.stroke();
      ac.restore();
      // ground + pads
      ac.strokeStyle = 'rgba(255,255,255,.18)'; ac.lineWidth = 1;
      ac.beginPath(); ac.moveTo(0, base.y + 0.5); ac.lineTo(AW, base.y + 0.5); ac.stroke();
      pads.forEach(function (p, i) {
        ac.fillStyle = 'rgba(127,227,196,.12)'; ac.fillRect(p.x - 26, p.y - 3, 52, 6);
        ac.fillStyle = 'rgba(160,175,188,.8)'; ac.font = '10px "IBM Plex Mono", monospace'; ac.textAlign = 'center';
        ac.fillText(i ? 'PLACE' : 'PICK', p.x, p.y + 20);
      });
      // block
      var bx = block.held ? block.x : pads[block.pad].x, by = block.held ? block.y : pads[block.pad].y - 3;
      ac.fillStyle = '#D96A4C'; ac.fillRect(bx - 9, by - 18, 18, 18);
      ac.strokeStyle = 'rgba(255,255,255,.35)'; ac.strokeRect(bx - 9 + 0.5, by - 18 + 0.5, 17, 17);
      // trail
      for (var t = 1; t < trail.length; t++) {
        ac.strokeStyle = 'rgba(127,227,196,' + (t / trail.length * 0.5).toFixed(3) + ')';
        ac.lineWidth = 2;
        ac.beginPath(); ac.moveTo(trail[t - 1].x, trail[t - 1].y); ac.lineTo(trail[t].x, trail[t].y); ac.stroke();
      }
      // target crosshair
      ac.strokeStyle = reachable ? 'rgba(127,227,196,.9)' : 'rgba(255,122,92,.9)';
      ac.lineWidth = 1.2;
      ac.beginPath(); ac.arc(tgt.x, tgt.y, 9, 0, Math.PI * 2);
      ac.moveTo(tgt.x - 15, tgt.y); ac.lineTo(tgt.x - 5, tgt.y); ac.moveTo(tgt.x + 5, tgt.y); ac.lineTo(tgt.x + 15, tgt.y);
      ac.moveTo(tgt.x, tgt.y - 15); ac.lineTo(tgt.x, tgt.y - 5); ac.moveTo(tgt.x, tgt.y + 5); ac.lineTo(tgt.x, tgt.y + 15);
      ac.stroke();
      // base plate
      ac.fillStyle = '#2a313c'; ac.fillRect(base.x - 34, base.y - 6, 68, 12);
      ac.fillStyle = '#3a4350'; ac.fillRect(base.x - 22, base.y - 14, 44, 10);
      // links
      var widths = [16, 12, 8];
      for (var k2 = 0; k2 < 3; k2++) {
        ac.lineCap = 'round';
        ac.strokeStyle = k2 === 1 ? '#c9d3dc' : '#e8edf1'; ac.lineWidth = widths[k2];
        ac.beginPath(); ac.moveTo(P[k2].x, P[k2].y); ac.lineTo(P[k2 + 1].x, P[k2 + 1].y); ac.stroke();
        ac.strokeStyle = 'rgba(21,23,28,.35)'; ac.lineWidth = 2;
        ac.beginPath(); ac.moveTo(P[k2].x, P[k2].y); ac.lineTo(P[k2 + 1].x, P[k2 + 1].y); ac.stroke();
      }
      // joints
      [11, 9, 7].forEach(function (r, i) {
        ac.fillStyle = '#15171C'; ac.beginPath(); ac.arc(P[i].x, P[i].y, r, 0, Math.PI * 2); ac.fill();
        ac.strokeStyle = '#D96A4C'; ac.lineWidth = 2.5; ac.beginPath(); ac.arc(P[i].x, P[i].y, r, 0, Math.PI * 2); ac.stroke();
      });
      // gripper
      var ga = ee.a, open = block.held ? 6 : 11;
      var gx = Math.cos(-ga), gy = Math.sin(-ga), nx = -gy, ny = gx;
      ac.strokeStyle = '#e8edf1'; ac.lineWidth = 3;
      ac.beginPath();
      ac.moveTo(ee.x + nx * open, ee.y + ny * open); ac.lineTo(ee.x - nx * open, ee.y - ny * open);
      ac.moveTo(ee.x + nx * open, ee.y + ny * open); ac.lineTo(ee.x + nx * open + gx * 12, ee.y + ny * open + gy * 12);
      ac.moveTo(ee.x - nx * open, ee.y - ny * open); ac.lineTo(ee.x - nx * open + gx * 12, ee.y - ny * open + gy * 12);
      ac.stroke();

      // readouts
      frames++;
      for (var j = 0; j < 3; j++) {
        var deg = wrapAng(q[j]) * 180 / Math.PI;
        ui.j[j].textContent = (deg >= 0 ? '+' : '') + deg.toFixed(1) + '°';
        var pct = Math.abs(deg) / 180 * 50;
        ui.jb[j].style.width = pct + '%';
        ui.jb[j].style.left = deg >= 0 ? '50%' : (50 - pct) + '%';
      }
      var ex = (ee.x - base.x) / U, ey = (base.y - ee.y) / U;
      ui.ee.textContent = '(' + ex.toFixed(2) + ', ' + ey.toFixed(2) + ')';
      ui.target.textContent = 'x ' + String(Math.round(tgt.x - base.x)).padStart(4, ' ') + ' · y ' + String(Math.round(base.y - tgt.y)).padStart(3, '0');
      ui.status.textContent = reachable ? 'REACHABLE' : 'OUT OF REACH · CLAMPED';
      ui.status.classList.toggle('out', !reachable);
      if (now - hzT > 500) { ui.hz.textContent = Math.round(frames * 1000 / (now - hzT)) + ' Hz'; frames = 0; hzT = now; }

      armRaf = requestAnimationFrame(drawArm);
    };

    var pointerAt = function (e) {
      var r = stage.getBoundingClientRect();
      tgt.x = e.clientX - r.left; tgt.y = e.clientY - r.top;
      lastPointer = performance.now();
      if (!manual) {
        manual = true; block.held = false;
        ui.mode.textContent = 'MANUAL'; ui.mode.classList.add('manual');
      }
    };
    stage.addEventListener('pointermove', pointerAt);
    stage.addEventListener('pointerdown', pointerAt);

    armResize();
    var art;
    window.addEventListener('resize', function () { clearTimeout(art); art = setTimeout(function () { armResize(); seq = []; }, 150); });
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!armRunning) { armRunning = true; hzT = performance.now(); frames = 0; armRaf = requestAnimationFrame(drawArm); } }
      else { armRunning = false; cancelAnimationFrame(armRaf); }
    }).observe(stage);
  }

  /* ------------------------------------------------------------
     15. Sim2Real pipeline: a "packet" lights each stage in turn
     ------------------------------------------------------------ */
  var pipeNodes = $$('.pipe-node');
  if (pipeNodes.length && !reduceMotion) {
    var pi = 0;
    setInterval(function () {
      pipeNodes.forEach(function (n, i) { n.classList.toggle('hot', i === pi); });
      pi = (pi + 1) % pipeNodes.length;
    }, 1100);
  }

  /* ------------------------------------------------------------
     16. Publication filter
     ------------------------------------------------------------ */
  var pfBtns = $$('.pf-btn');
  pfBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      pfBtns.forEach(function (o) { o.classList.toggle('active', o === b); o.setAttribute('aria-pressed', o === b); });
      $$('.pub-item').forEach(function (it) {
        var show = f === 'all' || it.getAttribute('data-kind') === f;
        it.classList.toggle('hide', !show);
        it.classList.remove('flash');
        if (show && !reduceMotion) { void it.offsetWidth; it.classList.add('flash'); }
      });
    });
  });

  /* ------------------------------------------------------------
     17. Fixed system HUD: current section, cursor coords, progress
     ------------------------------------------------------------ */
  if (finePointer) {
    var sh = document.createElement('div');
    sh.className = 'sys-hud';
    sh.setAttribute('aria-hidden', 'true');
    sh.innerHTML = '<span class="dot"></span><span>SYS <b>ONLINE</b></span><span class="sep"></span>' +
      '<span id="shSec">SEC 00 · TOP</span><span class="sep"></span><span id="shXY">X 0000 Y 0000</span>' +
      '<span class="sep"></span><span id="shPct">000%</span>';
    document.body.appendChild(sh);
    var shSec = $('#shSec', sh), shXY = $('#shXY', sh), shPct = $('#shPct', sh);
    var pad4 = function (n) { return String(Math.max(0, Math.round(n))).padStart(4, '0'); };
    window.addEventListener('pointermove', function (e) {
      shXY.textContent = 'X ' + pad4(e.clientX) + ' Y ' + pad4(e.clientY + window.scrollY);
    }, { passive: true });
    var secLabel = new Map();
    $$('section[id]').forEach(function (s) {
      var eb = $(':scope > .wrap > .eyebrow', s) || $('.eyebrow', s), idx = eb && $('.idx', eb);
      var num = idx && /^\d+$/.test(idx.textContent.trim()) ? idx.textContent.trim() : '--';
      var name = s.id === 'top' ? 'TOP' : eb ? eb.textContent.replace(idx ? idx.textContent : '', '').split('·')[0].trim().toUpperCase() : s.id.toUpperCase();
      secLabel.set(s, 'SEC ' + (s.id === 'top' ? '00' : num) + ' · ' + name);
    });
    var secObs2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) shSec.textContent = secLabel.get(e.target); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secLabel.forEach(function (_, s) { secObs2.observe(s); });
    window.addEventListener('scroll', function () {
      var max = doc.scrollHeight - window.innerHeight;
      shPct.textContent = String(Math.round(max > 0 ? window.scrollY / max * 100 : 0)).padStart(3, '0') + '%';
      sh.classList.toggle('show', window.scrollY > window.innerHeight * 0.6);
    }, { passive: true });
  }
})();
