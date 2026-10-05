/* ============================================================
   Cronosfera · Banner de promociones del home
   ------------------------------------------------------------
   Pinta las promociones vigentes (activas y dentro de su rango de
   fechas) en <section id="promos">, entre el hero y "Compra por
   marca". Cristian las gestiona desde el panel; los cambios se ven
   sin redeploy porque los datos vienen de Supabase en cada visita.

   - 0 promociones: la seccion queda oculta y el hueco es el de antes.
   - 1 promocion: tarjeta sola, sin indicadores.
   - 2 o mas: carrusel con scroll-snap (se desliza con el dedo),
     auto-avance que se pausa al interactuar, e indicadores.
   Se pinta primero desde la cache local, asi en visitas repetidas no
   hay salto de layout.
   ============================================================ */
(function (global) {
  'use strict';

  var AUTO_MS = 6500;        // tiempo por promocion
  var RESUME_MS = 9000;      // tras tocar, cuanto esperar para volver a avanzar
  var RECHECK_MS = 60000;    // revisar vencimientos con la pagina abierta

  var section, track, dots;
  var lastSig = '';
  var current = 0;
  var timer = null, resumeTimer = null;
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Solo enlaces seguros: rutas del sitio, http(s) y WhatsApp. Cualquier otra
  // cosa (p. ej. "javascript:") se descarta.
  function safeHref(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u) || /^\/\//.test(u)) return ''; // otro esquema
    return u; // ruta relativa del sitio
  }
  function isExternal(href) { return /^https?:/i.test(href) && href.indexOf(location.host) === -1; }

  function slideHtml(pr, i) {
    var href = safeHref(pr.linkUrl);
    var cta = href ? (pr.ctaLabel || 'Ver promoción') : '';
    var ext = href && isExternal(href);
    var img = pr.imageUrl
      ? '<img src="' + esc(pr.imageUrl) + '" alt="" width="1200" height="900" decoding="async"'
        + (i === 0 ? '' : ' loading="lazy"') + '>'
      : '<div class="promo-noimg" aria-hidden="true"></div>';
    return ''
      + '<article class="promo-slide" role="group" aria-roledescription="promoción" aria-label="' + (i + 1) + '">'
      +   '<div class="promo-media">' + img + '</div>'
      +   '<div class="promo-body">'
      +     '<span class="eyebrow">Promoción</span>'
      +     '<h3 class="promo-title">' + esc(pr.title) + '</h3>'
      +     (pr.body ? '<p class="promo-text">' + esc(pr.body) + '</p>' : '')
      +     (cta ? '<a class="btn btn-primary promo-cta" href="' + esc(href) + '"'
            + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(cta)
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/><polyline points="13,6 19,12 13,18" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' : '')
      +   '</div>'
      + '</article>';
  }

  function slideWidth() { return track ? track.clientWidth : 0; }

  function goTo(i, smooth) {
    var n = track ? track.children.length : 0;
    if (!n) return;
    current = (i + n) % n;
    track.scrollTo({ left: current * slideWidth(), behavior: smooth === false || reduceMotion ? 'auto' : 'smooth' });
    paintDots();
  }

  function paintDots() {
    if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (d, k) {
      d.setAttribute('aria-current', k === current ? 'true' : 'false');
    });
  }

  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  function startAuto() {
    stopAuto();
    if (reduceMotion || !track || track.children.length < 2) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      goTo(current + 1);
    }, AUTO_MS);
  }
  // Cualquier interaccion pausa el avance y lo retoma un rato despues.
  function pauseThenResume() {
    stopAuto();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(startAuto, RESUME_MS);
  }

  function render() {
    if (!section || !global.Store || !Store.getActivePromotions) return;
    var list = Store.getActivePromotions();
    // Firma de lo que se ve: si no cambio, no se re-pinta (el Store emite por
    // cualquier cambio y no queremos reiniciar el carrusel cada vez).
    var sig = JSON.stringify(list.map(function (p) {
      return [p.id, p.title, p.body, p.imageUrl, p.linkUrl, p.ctaLabel, p.updatedAt];
    }));
    if (sig === lastSig) return;
    lastSig = sig;

    if (!list.length) {
      stopAuto();
      section.hidden = true;
      document.body.classList.remove('has-promos');
      track.innerHTML = '';
      dots.innerHTML = '';
      return;
    }

    track.innerHTML = list.map(slideHtml).join('');
    dots.innerHTML = list.length > 1
      ? list.map(function (p, k) {
          return '<button type="button" class="promo-dot" aria-label="Ver promoción ' + (k + 1) + '" data-i="' + k + '"></button>';
        }).join('')
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
    track = section.querySelector('.promo-track');
    dots = section.querySelector('.promo-dots');

    // Indicador activo segun el desplazamiento (cuando se desliza con el dedo).
    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var w = slideWidth();
        if (!w) return;
        var i = Math.round(track.scrollLeft / w);
        if (i !== current) { current = i; paintDots(); }
      });
    }, { passive: true });

    ['pointerdown', 'touchstart', 'wheel', 'focusin', 'mouseenter'].forEach(function (ev) {
      track.addEventListener(ev, pauseThenResume, { passive: true });
    });
    dots.addEventListener('click', function (e) {
      var b = e.target.closest('.promo-dot');
      if (!b) return;
      pauseThenResume();
      goTo(parseInt(b.getAttribute('data-i'), 10));
    });
    // Al girar el telefono o cambiar el ancho, recolocar en la promo actual.
    global.addEventListener('resize', function () { goTo(current, false); });

    render();                                   // primero desde la cache local
    if (Store.subscribe) Store.subscribe(render); // y de nuevo cuando llegue Supabase
    // Una promo puede vencer (o empezar) con la pagina abierta: como la lista
    // vigente se calcula con la hora actual, su firma cambia sola y render()
    // solo re-pinta en ese caso.
    setInterval(render, RECHECK_MS);
  }

  // El panel reutiliza el mismo marcado para la vista previa, asi lo que ve
  // Cristian antes de publicar es exactamente lo que sale en el home.
  global.CronosPromos = { slideHtml: slideHtml };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
