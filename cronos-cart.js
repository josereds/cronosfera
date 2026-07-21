/* ============================================================
   Cronosfera · Carrito de compras
   ------------------------------------------------------------
   - Contador visible en el ícono de carrito (.cart-btn) de cada página
   - Panel flotante para ver, ajustar y quitar artículos
   - "Finalizar compra" lleva a checkout.html, que arma el pedido y
     ofrece pago con Wompi o coordinación por WhatsApp (ver ese archivo).
   ============================================================ */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }

  function cop(v) { return '$' + Number(v || 0).toLocaleString('es-CO'); }

  var panel = null;

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'cart-panel';
    panel.id = 'cronosCartPanel';
    panel.innerHTML = ''
      + '<div class="cart-panel-backdrop"></div>'
      + '<div class="cart-panel-sheet" role="dialog" aria-label="Carrito de compras">'
      +   '<div class="cart-panel-head">'
      +     '<h3>Tu carrito</h3>'
      +     '<button type="button" class="cart-panel-close" aria-label="Cerrar carrito">'
      +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="5" x2="19" y2="19" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke-linecap="round"/></svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="cart-panel-body"></div>'
      +   '<div class="cart-panel-foot">'
      +     '<div class="cart-panel-total"><span>Subtotal</span><strong id="cartPanelTotal">$0</strong></div>'
      +     '<p class="cart-panel-note">Precios de demostración · COP.</p>'
      +     '<a href="checkout.html" class="cart-panel-checkout">Finalizar compra</a>'
      +     '<button type="button" class="btn cart-panel-continue">Seguir viendo el catálogo</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(panel);

    panel.querySelector('.cart-panel-backdrop').addEventListener('click', close);
    panel.querySelector('.cart-panel-close').addEventListener('click', close);
    panel.querySelector('.cart-panel-continue').addEventListener('click', close);

    panel.querySelector('.cart-panel-body').addEventListener('click', function (e) {
      var row = e.target.closest('.cart-item');
      if (!row) return;
      var id = row.getAttribute('data-id');
      if (e.target.closest('[data-action="inc"]')) {
        var incItem = global.Store.getCartItems().find(function (i) { return i.id === id; });
        global.Store.setCartQty(id, (incItem ? incItem.qty : 0) + 1);
      } else if (e.target.closest('[data-action="dec"]')) {
        var decItem = global.Store.getCartItems().find(function (i) { return i.id === id; });
        global.Store.setCartQty(id, (decItem ? decItem.qty : 1) - 1);
      } else if (e.target.closest('.cart-item-remove')) {
        global.Store.removeFromCart(id);
      }
    });

    return panel;
  }

  function renderBody() {
    var items = global.Store.getCartItems();
    var body = panel.querySelector('.cart-panel-body');
    if (!items.length) {
      body.innerHTML = '<div class="cart-panel-empty">'
        + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 7h14l-1.4 11.2a1.6 1.6 0 0 1-1.6 1.4H8a1.6 1.6 0 0 1-1.6-1.4L5 7z" stroke-linejoin="round"/><path d="M9 7V5a3 3 0 0 1 6 0v2" stroke-linecap="round"/></svg>'
        + '<p>Tu carrito está vacío.</p>'
        + '</div>';
    } else {
      body.innerHTML = items.map(function (p) {
        var media = p.image ? '<img src="' + p.image + '" alt="' + escapeHtml(p.brand + ' ' + p.model) + '">' : '';
        return '<div class="cart-item" data-id="' + p.id + '">'
          + '<div class="cart-item-media">' + media + '</div>'
          + '<div class="cart-item-info">'
          +   '<div class="cart-item-brand">' + escapeHtml(p.brand) + '</div>'
          +   '<div class="cart-item-model">' + escapeHtml(p.model) + '</div>'
          +   '<div class="cart-item-price">' + cop(p.price) + '</div>'
          + '</div>'
          + '<div class="cart-item-qty">'
          +   '<button type="button" data-action="dec" aria-label="Restar">−</button>'
          +   '<span>' + p.qty + '</span>'
          +   '<button type="button" data-action="inc" aria-label="Sumar">+</button>'
          + '</div>'
          + '<button type="button" class="cart-item-remove" aria-label="Quitar del carrito">'
          +   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="5" x2="19" y2="19" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke-linecap="round"/></svg>'
          + '</button>'
          + '</div>';
      }).join('');
    }
    var totalEl = panel.querySelector('#cartPanelTotal');
    if (totalEl) totalEl.textContent = cop(global.Store.getCartTotal());
  }

  function renderBadges() {
    var count = global.Store.getCartCount();
    var buttons = document.querySelectorAll('.cart-btn');
    Array.prototype.forEach.call(buttons, function (btn) {
      var badge = btn.querySelector('.cart-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        btn.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = count > 0 ? '' : 'none';
    });
  }

  function open() {
    buildPanel();
    renderBody();
    panel.classList.add('open');
    document.body.classList.add('cart-panel-locked');
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    document.body.classList.remove('cart-panel-locked');
  }

  function toggle() {
    if (panel && panel.classList.contains('open')) close();
    else open();
  }

  function bindTriggers() {
    var buttons = document.querySelectorAll('.cart-btn');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (btn.__cronosCartBound) return;
      btn.__cronosCartBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
    });
  }

  // ---- Dock flotante: carrito siempre visible + contacto por WhatsApp ----
  // El header no siempre muestra el carrito (en móvil desaparece del todo al
  // hacer scroll), así que el carrito vive también aquí, fijo en pantalla.
  // El botón lleva la clase .cart-btn para heredar el badge y el toggle.
  function buildDock() {
    if (document.querySelector('.cronos-dock')) return;
    var cfg = global.Store.getConfig ? global.Store.getConfig() : {};
    var num = (cfg.payments || {}).whatsappNumber;

    var dock = document.createElement('div');
    dock.className = 'cronos-dock';

    if (num) {
      var msg = 'Hola, quiero más información sobre los relojes de Cronosfera.';
      var wa = document.createElement('a');
      wa.className = 'dock-btn dock-wa';
      wa.href = 'https://api.whatsapp.com/send?phone=' + encodeURIComponent(num) + '&text=' + encodeURIComponent(msg);
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.setAttribute('aria-label', 'Escríbenos por WhatsApp');
      wa.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.7.8-.9 1c-.2.2-.3.2-.6.1s-1.2-.4-2.2-1.4c-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4.1-.1.1-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>'
        + '<span class="dock-tip">Escríbenos</span>';
      dock.appendChild(wa);
    }

    var cart = document.createElement('button');
    cart.type = 'button';
    cart.className = 'dock-btn dock-cart cart-btn';
    cart.setAttribute('aria-label', 'Ver carrito');
    cart.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14l-1.4 11.2a1.6 1.6 0 0 1-1.6 1.4H8a1.6 1.6 0 0 1-1.6-1.4L5 7z" stroke-linejoin="round"/><path d="M9 7V5a3 3 0 0 1 6 0v2" stroke-linecap="round"/></svg>'
      + '<span class="dock-tip">Carrito</span>';
    dock.appendChild(cart);

    document.body.appendChild(dock);
  }

  // Animación "volar al carrito": clona la foto del producto y la lleva
  // hasta el botón del carrito, que rebota al recibirla.
  function flyToCart(sourceEl) {
    var target = document.querySelector('.cronos-dock .dock-cart');
    if (!sourceEl || !target) { pulseCart(); return; }
    var from = sourceEl.getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!from.width || !to.width) { pulseCart(); return; }

    var ghost = document.createElement('div');
    ghost.className = 'cart-fly-ghost';
    var src = sourceEl.tagName === 'IMG' ? sourceEl.src : '';
    if (src) ghost.style.backgroundImage = 'url("' + src + '")';
    ghost.style.left = from.left + 'px';
    ghost.style.top = from.top + 'px';
    ghost.style.width = from.width + 'px';
    ghost.style.height = from.height + 'px';
    document.body.appendChild(ghost);

    // Forzar reflow para que la transición arranque desde la posición inicial.
    ghost.getBoundingClientRect();
    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.12)';
    ghost.style.opacity = '0.25';
    ghost.style.borderRadius = '50%';

    setTimeout(function () {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      pulseCart();
    }, 750);
  }

  function pulseCart() {
    var els = document.querySelectorAll('.cart-btn');
    Array.prototype.forEach.call(els, function (el) {
      el.classList.remove('cart-pop');
      void el.offsetWidth; // reinicia la animación
      el.classList.add('cart-pop');
      setTimeout(function () { el.classList.remove('cart-pop'); }, 700);
    });
  }

  function init() {
    if (!global.Store) {
      console.warn('[Cart] Store no disponible — ¿falta cronos-store.js?');
      return;
    }
    buildDock();
    bindTriggers();
    renderBadges();
    global.Store.subscribe(function () {
      renderBadges();
      if (panel && panel.classList.contains('open')) renderBody();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CronosCart = { open: open, close: close, toggle: toggle, flyToCart: flyToCart, pulse: pulseCart };
})(window);
