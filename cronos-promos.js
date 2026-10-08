/* ============================================================
   Cronosfera · Productos en promoción (franja del home)
   ------------------------------------------------------------
   Franja compacta entre el hero y "Compra por marca" con los
   productos que Cristian marca como promoción en el panel
   (pestaña Promociones). Es distinta de "Productos destacados":
   aquí solo van ofertas puntuales, en tarjetas pequeñas.

   - La lista y el descuento de cada producto viven en config
     (Store.getPromoProducts / Store.getPriceDisplay), así que el
     precio de oferta es el mismo aquí, en el catálogo, en la ficha
     y en el carrito, y los cambios se ven sin redeploy.
   - Sin productos en promoción la sección queda oculta y el home
     se ve como antes.
   - Se pinta primero desde la caché local: sin saltos de layout en
     visitas repetidas.
   ============================================================ */
(function (global) {
  'use strict';

  var section, track, prevBtn, nextBtn;
  var lastSig = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function cop(v) { return '$' + Math.round(Number(v) || 0).toLocaleString('es-CO'); }

  function isWholesale() { return !!(global.Auth && Auth.isWholesale && Auth.isWholesale()); }

  // Precio que ve ESTE visitante: el mayorista ve su tarifa (es la que paga en
  // el carrito), el resto ve el precio con el descuento vigente.
  function priceFor(p) {
    if (isWholesale()) return { now: Store.wholesalePriceFor(p), was: 0, off: 0, wholesale: true };
    var d = Store.getPriceDisplay(p);
    return { now: d.price, was: d.wasPrice && d.wasPrice > d.price ? d.wasPrice : 0, off: d.off || 0, wholesale: false };
  }

  function cardHtml(p, i) {
    var pr = priceFor(p);
    var name = p.model || p.brand || 'Reloj';
    var img = p.image
      ? '<img src="' + esc(p.image) + '" alt="" width="160" height="160" decoding="async"' + (i < 4 ? '' : ' loading="lazy"') + '>'
      : '<span class="promo-noimg" aria-hidden="true"></span>';
    return ''
      + '<a class="promo-card" href="producto.html?id=' + encodeURIComponent(p.id) + '">'
      +   '<span class="promo-thumb">' + img
      +     (pr.off ? '<span class="promo-badge">-' + pr.off + '%</span>' : '')
      +   '</span>'
      +   '<span class="promo-info">'
      +     '<span class="promo-brand">' + esc(p.brand || '') + '</span>'
      +     '<span class="promo-name">' + esc(name) + '</span>'
      +     '<span class="promo-price">'
      +       '<span class="now">' + cop(pr.now) + '</span>'
      +       (pr.was ? '<span class="was">' + cop(pr.was) + '</span>' : '')
      +       (pr.wholesale ? '<span class="tag">Mayorista</span>' : '')
      +     '</span>'
      +   '</span>'
      + '</a>';
  }

  function syncArrows() {
    if (!track || !prevBtn) return;
    var max = track.scrollWidth - track.clientWidth;
    var scrollable = max > 4;
    section.classList.toggle('is-scrollable', scrollable);
    prevBtn.disabled = !scrollable || track.scrollLeft <= 4;
    nextBtn.disabled = !scrollable || track.scrollLeft >= max - 4;
  }

  function render() {
    if (!section || !global.Store || !Store.getPromoProducts) return;
    var list = Store.getPromoProducts();
    // Firma de lo que se ve (incluye precio): el Store emite por cualquier
    // cambio y no queremos re-pintar ni mover el scroll si nada cambió.
    var sig = (isWholesale() ? 'w|' : 'r|') + JSON.stringify(list.map(function (p) {
      var pr = priceFor(p);
      return [p.id, p.model, p.brand, p.image, pr.now, pr.was, pr.off];
    }));
    if (sig === lastSig) return;
    lastSig = sig;

    if (!list.length) {
      section.hidden = true;
      document.body.classList.remove('has-promos');
      track.innerHTML = '';
      return;
    }
    track.innerHTML = list.map(cardHtml).join('');
    section.hidden = false;
    document.body.classList.add('has-promos');
    requestAnimationFrame(syncArrows);
  }

  function step(dir) {
    var card = track.querySelector('.promo-card');
    var w = card ? card.getBoundingClientRect().width + 14 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * w * Math.max(1, Math.floor(track.clientWidth / w)), behavior: 'smooth' });
  }

  function init() {
    section = document.getElementById('promos');
    if (!section) return;
    track = section.querySelector('.promo-track');
    prevBtn = section.querySelector('.promo-nav.prev');
    nextBtn = section.querySelector('.promo-nav.next');
    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', syncArrows, { passive: true });
    global.addEventListener('resize', syncArrows);

    render();                                       // primero desde la caché
    if (Store.subscribe) Store.subscribe(render);   // y otra vez al llegar Supabase
  }

  // El panel usa el mismo marcado para su vista previa, así lo que ve Cristian
  // es exactamente lo que sale en el home.
  global.CronosPromos = { cardHtml: cardHtml };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
