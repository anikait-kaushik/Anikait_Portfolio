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
  $$('.mars-stat .sv, .statgrid .sv, .profile-facts .fv strong, .scholar b').forEach(function (el) {
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
})();
