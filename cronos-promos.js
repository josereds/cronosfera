/* ============================================================
   Cronosfera · Banner promocional del home
   ------------------------------------------------------------
   Imagen a todo el ancho entre el hero y "Compra por marca". La
   imagen ya trae el texto ("Halloween", "Promoción"...); Cristian
   la sube y la cambia desde el panel (pestaña Promociones).

   - Sin banners activos la sección queda oculta y el home se ve
     como antes.
   - Uno: imagen fija. Varios: rotan solos, se deslizan con el dedo
     y tienen indicadores.
   - Versión para celular opcional (<picture>): si no hay, se usa la
     de computador.
   - El alto se reserva con las medidas guardadas de la imagen y se
     pinta primero desde la caché: sin saltos de layout.
   ============================================================ */
(function (global) {
  'use strict';

  var AUTO_MS = 6000;
  var RESUME_MS = 9000;

  var section, track, dots;
  var lastSig = '';
  var current = 0, timer = null, resumeTimer = null;
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Solo rutas del sitio y enlaces http(s); cualquier otro esquema se descarta.
  function safeHref(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u) || /^\/\//.test(u)) return '';
    return u;
  }

  function slideHtml(b, i) {
    var href = safeHref(b.link);
    var ext = /^https?:/i.test(href) && href.indexOf(location.host) === -1;
    var w = b.w || 1920, h = b.h || 400;
    var pic = '<picture>'
      + (b.imageMobile ? '<source media="(max-width: 700px)" srcset="' + esc(b.imageMobile) + '"'
          + (b.mw && b.mh ? ' width="' + b.mw + '" height="' + b.mh + '"' : '') + '>' : '')
      + '<img src="' + esc(b.image) + '" width="' + w + '" height="' + h + '" alt="Promoción Cronosfera" decoding="async"'
      + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + '>'
      + '</picture>';
    return href
      ? '<a class="hb-slide" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + pic + '</a>'
      : '<div class="hb-slide">' + pic + '</div>';
  }

  function goTo(i, smooth) {
    var n = track ? track.children.length : 0;
    if (!n) return;
    current = (i + n) % n;
    track.scrollTo({ left: current * track.clientWidth, behavior: smooth === false || reduceMotion ? 'auto' : 'smooth' });
    paintDots();
  }
  function paintDots() {
    Array.prototype.forEach.call(dots.children, function (d, k) {
      d.setAttribute('aria-current', k === current ? 'true' : 'false');
    });
  }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  function startAuto() {
    stopAuto();
    if (reduceMotion || !track || track.children.length < 2) return;
    timer = setInterval(function () { if (!document.hidden) goTo(current + 1); }, AUTO_MS);
  }
  function pauseThenResume() {
    stopAuto();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startAuto, RESUME_MS);
  }

  function render() {
    if (!section || !global.Store || !Store.getActiveHomeBanners) return;
    var list = Store.getActiveHomeBanners();
    var sig = JSON.stringify(list.map(function (b) { return [b.id, b.image, b.imageMobile, b.link, b.w, b.h, b.mw, b.mh]; }));
    if (sig === lastSig) return;
    lastSig = sig;

    if (!list.length) {
      stopAuto();
      section.hidden = true;
      document.body.classList.remove('has-promos');
      track.innerHTML = ''; dots.innerHTML = '';
      return;
    }
    // Proporcion del primer banner: reserva el alto exacto antes de que
    // llegue la imagen (y el resto de banners se ajusta a ese marco).
    var f = list[0];
    section.style.setProperty('--hb-ratio', (f.w || 1920) + ' / ' + (f.h || 400));
    section.style.setProperty('--hb-ratio-m', f.imageMobile && f.mw && f.mh
      ? f.mw + ' / ' + f.mh
      : (f.w || 1920) + ' / ' + (f.h || 400));

    track.innerHTML = list.map(slideHtml).join('');
    dots.innerHTML = list.length > 1
      ? list.map(function (b, k) { return '<button type="button" class="hb-dot" data-i="' + k + '" aria-label="Ver promoción ' + (k + 1) + '"></button>'; }).join('')
      : '';
    section.classList.toggle('is-single', list.length === 1);
    section.hidden = false;
    document.body.classList.add('has-promos');
    current = Math.min(current, list.length - 1);
    goTo(current, false);
    startAuto();
  }

  function init() {
    section = document.getElementById('promos');
    if (!section) return;
    track = section.querySelector('.hb-track');
    dots = section.querySelector('.hb-dots');

    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var w = track.clientWidth; if (!w) return;
        var i = Math.round(track.scrollLeft / w);
        if (i !== current) { current = i; paintDots(); }
      });
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel', 'focusin', 'mouseenter'].forEach(function (ev) {
      track.addEventListener(ev, pauseThenResume, { passive: true });
    });
    dots.addEventListener('click', function (e) {
      var b = e.target.closest('.hb-dot'); if (!b) return;
      pauseThenResume();
      goTo(parseInt(b.getAttribute('data-i'), 10));
    });
    global.addEventListener('resize', function () { goTo(current, false); });

    render();                                       // primero desde la caché
    if (Store.subscribe) Store.subscribe(render);   // y otra vez al llegar Supabase
  }

  global.CronosBanner = { slideHtml: slideHtml };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
