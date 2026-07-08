/* ============================================================
   Cronosfera · Carrito de compras
   ------------------------------------------------------------
   - Contador visible en el ícono de carrito (.cart-btn) de cada página
   - Panel flotante para ver, ajustar y quitar artículos
   - No hay pasarela de pago conectada todavía: el panel es honesto al
     respecto en vez de simular un botón de pago que no hace nada.
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
      +     '<p class="cart-panel-note">Precios de demostración · el pago en línea todavía no está activo.</p>'
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

  function init() {
    if (!global.Store) {
      console.warn('[Cart] Store no disponible — ¿falta cronos-store.js?');
      return;
    }
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

  global.CronosCart = { open: open, close: close, toggle: toggle };
})(window);
