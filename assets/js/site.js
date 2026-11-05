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

  /* ==========================================================
     HOMEPAGE: video hero, counters, story, work cards, tabs
     ========================================================== */
  var saveData = navigator.connection && navigator.connection.saveData;

  // nav turns solid once you leave the hero
  var navOver = $('.nav-over');
  if (navOver) {
    var navUpd = function () { navOver.classList.toggle('solid', window.scrollY > window.innerHeight * 0.5); };
    window.addEventListener('scroll', navUpd, { passive: true }); navUpd();
  }

  // hero speedrun: live "now playing" chapter + progress ticks + pause
  var hv = $('#heroVideo'), chapters = window.HERO_CHAPTERS && window.HERO_CHAPTERS.chapters;
  if (hv && chapters) {
    var ticks = $('#heroTicks'), nowA = $('#nowLink'), nowBox = $('#nowBox') || nowA, nowT = $('#nowTitle'), nowS = $('#nowSub'), pauseBtn = $('#heroPause');
    var total = window.HERO_CHAPTERS.duration, cur = -1;
    chapters.forEach(function () { var i = document.createElement('i'); i.appendChild(document.createElement('b')); ticks.appendChild(i); });
    var tickEls = $$('i', ticks);
    var setChapter = function (k) {
      if (k === cur) return; cur = k;
      nowBox.classList.add('swap');
      setTimeout(function () {
        nowT.textContent = chapters[k].title; nowS.textContent = chapters[k].sub; nowA.href = chapters[k].href;
        nowBox.classList.remove('swap');
      }, 220);
    };
    var heroLoop = function () {
      var t = hv.currentTime, k = 0;
      for (var i = 0; i < chapters.length; i++) if (t >= chapters[i].t) k = i;
      setChapter(k);
      tickEls.forEach(function (el, i) {
        var a = chapters[i].t, b = i + 1 < chapters.length ? chapters[i + 1].t : total;
        var p = Math.max(0, Math.min(1, (t - a) / (b - a)));
        el.firstChild.style.transform = 'scaleX(' + p + ')';
      });
      if (!hv.paused) requestAnimationFrame(heroLoop);
    };
    hv.addEventListener('play', function () { requestAnimationFrame(heroLoop); });
    hv.addEventListener('seeked', heroLoop);
    var userPaused = false;
    var tryPlay = function () { var pr = hv.play(); if (pr && pr.catch) pr.catch(function () {}); };
    // the button always mirrors the video's real state
    var sync = function () {
      var p = hv.paused;
      pauseBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
      pauseBtn.textContent = p ? '▶' : '❚❚';
      pauseBtn.setAttribute('aria-label', p ? 'Play background video' : 'Pause background video');
    };
    hv.addEventListener('play', sync); hv.addEventListener('pause', sync);
    pauseBtn.addEventListener('click', function () {
      if (hv.paused) { userPaused = false; tryPlay(); } else { userPaused = true; hv.pause(); }
    });
    if (reduce || saveData) { userPaused = true; hv.pause(); }
    else {
      if (!hv.paused) requestAnimationFrame(heroLoop);
      // if the browser blocked autoplay, start on the first interaction
      var kick = function () { if (hv.paused && !userPaused) tryPlay(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
      window.addEventListener('pointerdown', kick); window.addEventListener('keydown', kick);
    }
    sync();
    // stop decoding when the hero is off screen
    new IntersectionObserver(function (es) {
      if (userPaused) return;
      if (es[0].isIntersecting) tryPlay(); else hv.pause();
    }, { threshold: 0.05 }).observe(hv);
  }

  // showcase pages: videos play only while visible
  var inview = $$('video[data-inview]');
  if (inview.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !reduce && !saveData) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else if (!e.isIntersecting) v.pause();
      });
    }, { threshold: 0.35 });
    inview.forEach(function (v) { if (reduce) { v.removeAttribute('autoplay'); v.pause(); } vio.observe(v); });
  }

  // showcase rail: arrows, drag-to-scroll, keyboard
  var rail = $('#rail');
  if (rail) {
    var stepW = function () { var c = $('.sx-card', rail); return c ? c.getBoundingClientRect().width + 18 : 400; };
    $$('[data-rail]').forEach(function (b) {
      b.addEventListener('click', function () { rail.scrollBy({ left: stepW() * +b.getAttribute('data-rail'), behavior: reduce ? 'auto' : 'smooth' }); });
    });
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); rail.scrollBy({ left: stepW(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); rail.scrollBy({ left: -stepW(), behavior: 'smooth' }); }
    });
    var down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add('drag'); });
    window.addEventListener('pointermove', function (e) { if (!down) return; var d = e.clientX - sx; moved = Math.max(moved, Math.abs(d)); rail.scrollLeft = sl - d; });
    window.addEventListener('pointerup', function () { if (!down) return; down = false; rail.classList.remove('drag'); });
    // a drag shouldn't open the lightbox
    rail.addEventListener('click', function (e) { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // rotating headline: what the robots do, one phrase at a time
  var rot = $('#rotator');
  if (rot) {
    var words = $$('.rot-word', rot), wi = 0;
    var sizeLine = function () {
      var w = words[wi], r = document.createRange(); r.selectNodeContents(w);
      var rects = r.getClientRects(), last = rects[rects.length - 1];
      rot.style.setProperty('--uw', Math.round(last ? last.right - rot.getBoundingClientRect().left : w.offsetWidth) + 'px');
    };
    var sweep = function () { rot.classList.remove('sweep'); void rot.offsetWidth; rot.classList.add('sweep'); };
    sizeLine(); if (!reduce) sweep(); else rot.classList.add('sweep');
    rot.addEventListener('click', function () { var h = words[wi].getAttribute('data-href'); if (h) location.href = h; });
    window.addEventListener('resize', sizeLine);
    if (!reduce) setInterval(function () {
      if (document.hidden) return;
      var cur = words[wi]; cur.classList.remove('on'); cur.classList.add('out');
      setTimeout(function () { cur.classList.remove('out'); }, 700);
      wi = (wi + 1) % words.length; words[wi].classList.add('on');
      sizeLine(); sweep();
    }, 2800);
    // the three beats light up in sequence
    $$('.beat').forEach(function (b, i) { setTimeout(function () { b.classList.add('lit'); }, reduce ? 0 : 900 + i * 450); });
  }

  // journey timeline: the line fills and chapters light up as you scroll
  var journey = $('#journey');
  if (journey) {
    var jFill = $('.fill', journey), chaps = $$('.chap', journey), jTick = false;
    var jUpd = function () {
      var r = journey.getBoundingClientRect(), mark = window.innerHeight * 0.6;
      var p = Math.max(0, Math.min(1, (mark - r.top) / r.height));
      jFill.style.height = 'calc(' + (p * 100) + '% - 16px)';
      chaps.forEach(function (c) { c.classList.toggle('lit', c.getBoundingClientRect().top < mark); });
      jTick = false;
    };
    window.addEventListener('scroll', function () { if (!jTick) { jTick = true; requestAnimationFrame(jUpd); } }, { passive: true });
    window.addEventListener('resize', jUpd); jUpd();
  }

  // counters
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; cio.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-count'), t0 = performance.now(), dur = 1400;
        if (reduce) { el.textContent = to; return; }
        (function f(now) {
          var k = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
          el.textContent = v; if (k < 1) requestAnimationFrame(f);
        })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { if (!reduce) el.textContent = '0'; cio.observe(el); });
  }

  // story: sticky media follows the active chapter
  var steps = $$('.step'), stageMedia = $$('.stage-frame .sm');
  if (steps.length) {
    var sIdx = $('#stageIdx'), sBar = $('#stageBar');
    var activate = function (n) {
      steps.forEach(function (s) { s.classList.toggle('on', +s.getAttribute('data-step') === n); });
      stageMedia.forEach(function (m) {
        var on = +m.getAttribute('data-step') === n;
        m.classList.toggle('on', on);
        if (m.tagName === 'VIDEO') {
          if (on && !reduce && !saveData && window.innerWidth > 900) { var pr = m.play(); if (pr && pr.catch) pr.catch(function () {}); } else m.pause();
        }
      });
      if (sIdx) sIdx.textContent = String(n + 1).padStart(2, '0');
      if (sBar) sBar.style.width = ((n + 1) / steps.length * 100) + '%';
    };
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activate(+e.target.getAttribute('data-step')); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { sio.observe(s); });
    activate(0);
  }

  // work cards: play a preview on hover (desktop), filter by type
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  $$('.wcard').forEach(function (card) {
    var v = $('video', card); if (!v || !fine || reduce) return;
    card.addEventListener('mouseenter', function () {
      if (!v.src) v.src = v.getAttribute('data-src');
      var pr = v.play(); if (pr && pr.then) pr.then(function () { card.classList.add('playing'); }).catch(function () {});
    });
    card.addEventListener('mouseleave', function () { v.pause(); card.classList.remove('playing'); });
  });
  var wf = $$('.wfilter button');
  wf.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f');
      wf.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      $$('.wcard').forEach(function (c) { c.classList.toggle('hide', !(f === 'all' || (c.getAttribute('data-tags') || '').split(' ').indexOf(f) !== -1)); });
    });
  });

  // playground tabs
  var tabs = $$('[role=tab]');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        var on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      window.dispatchEvent(new Event('resize'));
    });
    tab.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click(); }
    });
  });

  /* ---------- contact form (Vercel /api/contact → Gmail, with mailto fallback) ---------- */
  var form = $('#contactForm');
  if (form) {
    var status = $('#cfStatus'), send = $('#cfSend');
    var say = function (msg, cls) { status.textContent = msg; status.className = 'cf-status' + (cls ? ' ' + cls : ''); };
    var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    var fName = $('#cfName'), fEmail = $('#cfEmail'), fMsg = $('#cfMsg'), fSubj = $('#cfSubject'), fRole = $('#cfRole'), fHp = $('#cfHp');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = fName.value.trim(), email = fEmail.value.trim(), msg = fMsg.value.trim();
      [fName, fEmail, fMsg].forEach(function (f) { f.removeAttribute('aria-invalid'); });
      var bad = !name ? fName : !emailOk(email) ? fEmail : !msg ? fMsg : null;
      if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); say(bad === fEmail ? 'Please enter a valid email address.' : 'Please fill in your name, email and message.', 'err'); return; }
      if (fHp.value) return; // bot

      var endpoint = form.getAttribute('data-endpoint') || '/api/contact';
      var subject = fSubj.value.trim() || ('Portfolio enquiry from ' + name);
      var mailto = function () {
        // Backend unavailable (e.g. local preview) or not set up: hand over to the visitor's email client
        var body = msg + '\n\n— ' + name + ' (' + email + ')\nReaching out as: ' + fRole.value;
        window.location.href = 'mailto:' + form.getAttribute('data-fallback') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        say('Opening your email app…');
      };
      var payload = { name: name, email: email, role: fRole.value, subject: subject, message: msg, _gotcha: fHp.value };
      send.disabled = true; say('Sending…');
      fetch(endpoint, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.success) { form.reset(); say('Thanks, your message has been sent. I\'ll reply by email.', 'ok'); }
          else if (!res.j || res.status === 404 || res.status === 405 || res.j.notConfigured) { mailto(); }
          else { say(res.j.error || 'Something went wrong. Please email me directly.', 'err'); }
        })
        .catch(function () { say('Network error. Please email me directly at ' + form.getAttribute('data-fallback') + '.', 'err'); })
        .then(function () { send.disabled = false; });
    });
  }

  /* ---------- only one *user-controlled* video plays at a time ----------
     Ambient videos (no controls: hero backgrounds, hover previews, portrait
     tiles) are never paused by this; they manage themselves on visibility. */
  var userVids = $$('video[controls]');
  userVids.forEach(function (v) {
    v.addEventListener('play', function () { userVids.forEach(function (o) { if (o !== v) o.pause(); }); });
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
})();
