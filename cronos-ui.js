/* Cronosfera · navegación móvil pública */
(function () {
  'use strict';

  function icon(name) {
    var icons = {
      home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" stroke-linejoin="round"/>',
      shop: '<path d="M5 7h14l-1.3 11.2A2 2 0 0 1 15.7 20H8.3a2 2 0 0 1-2-1.8L5 7Z" stroke-linejoin="round"/><path d="M9 7a3 3 0 0 1 6 0" stroke-linecap="round"/>',
      auction: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/>',
      wholesale: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 12h18" stroke-linecap="round"/>',
      account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + icons[name] + '</svg>';
  }

  function normalize(path) {
    return (path || '').split('/').pop() || 'index.html';
  }

  function accountHref() {
    if (window.Store && Store.currentUser) {
      var u = Store.currentUser();
      if (u && u.role === 'admin') return 'admin.html';
      if (u && u.role === 'wholesale') return 'mayorista.html#estado';
    }
    return 'login.html';
  }

  function mount() {
    if (document.querySelector('.mobile-bottom-nav')) return;
    document.body.classList.add('has-mobile-nav');
    if (document.getElementById('wholesaleForm')) document.body.classList.add('is-wholesale-page');

    var current = normalize(location.pathname);
    var items = [
      { href: 'index.html', label: 'Inicio', icon: 'home', match: ['index.html', ''] },
      { href: 'catalogo.html', label: 'Tienda', icon: 'shop', match: ['catalogo.html', 'producto.html'] },
      { href: 'subastas.html', label: 'Subastas', icon: 'auction', match: ['subastas.html'] },
      { href: accountHref(), label: 'Cuenta', icon: 'account', match: ['login.html', 'admin.html'] }
    ];

    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Navegación móvil');
    nav.innerHTML = items.map(function (item) {
      var active = item.match.indexOf(current) !== -1 ? ' active' : '';
      return '<a class="' + active + '" href="' + item.href + '">' + icon(item.icon) + '<span>' + item.label + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
