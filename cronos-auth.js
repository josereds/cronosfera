/* ============================================================
   Cronosfera · UI de sesión
   ------------------------------------------------------------
   - Renderiza el indicador de sesión en el header (.session-slot)
   - Expone guards por rol para páginas restringidas
   - Maneja logout desde cualquier página
   ============================================================ */
(function (global) {
  'use strict';

  var SLOT_SELECTOR = '[data-session-slot]';
  var NAV_SLOT_SELECTOR = '[data-nav-session]';

  function avatarText(name) {
    if (!name) return '··';
    var parts = String(name).trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildIndicator() {
    var u = global.Store.currentUser();
    if (!u) {
      return ''
        + '<a href="login.html" class="auth-link" data-action="login">'
        +   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        +   '<span>Iniciar sesión</span>'
        + '</a>';
    }

    var roleLabel = u.role === 'admin' ? 'Administrador' : (u.role === 'wholesale' ? 'Mayorista' : 'Cliente');
    var roleClass = 'role-' + u.role;
    var adminLink = u.role === 'admin' ? '<a href="admin.html" class="mini-link">Panel admin</a>' : '';
    var requestsLink = u.role === 'wholesale' ? '<a href="mayorista.html#estado" class="mini-link">Mi cuenta mayorista</a>' : '';

    return ''
      + '<div class="session-chip ' + roleClass + '">'
      +   '<div class="avatar">' + escapeHtml(avatarText(u.name)) + '</div>'
      +   '<div class="meta">'
      +     '<div class="name">' + escapeHtml(u.name) + '</div>'
      +     '<div class="role">' + roleLabel + '</div>'
      +   '</div>'
      +   '<div class="session-menu">'
      +     adminLink
      +     requestsLink
      +     '<button type="button" data-action="logout" class="mini-link danger">Cerrar sesión</button>'
      +   '</div>'
      + '</div>';
  }

  function renderAll() {
    var slots = document.querySelectorAll(SLOT_SELECTOR);
    Array.prototype.forEach.call(slots, function (slot) {
      slot.innerHTML = buildIndicator();
    });

    var navSlots = document.querySelectorAll(NAV_SLOT_SELECTOR);
    Array.prototype.forEach.call(navSlots, function (slot) {
      var u = global.Store.currentUser();
      if (u && u.role === 'wholesale') {
        slot.innerHTML = '<a href="mayorista.html" class="nav-wholesale">Mayorista · activo</a>';
      } else if (u && u.role === 'admin') {
        slot.innerHTML = '<a href="admin.html" class="nav-wholesale">Panel admin</a>';
      } else {
        slot.innerHTML = '<a href="mayorista.html" class="nav-wholesale">Programa mayorista</a>';
      }
    });

    bindActions();
  }

  function bindActions() {
    var logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn && !logoutBtn.__cronosBound) {
      logoutBtn.__cronosBound = true;
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        global.Store.logout();
        renderAll();
        if (typeof global.onCronosLogout === 'function') global.onCronosLogout();
      });
    }

    var chips = document.querySelectorAll('.session-chip');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener('mouseenter', function () { chip.classList.add('open'); });
      chip.addEventListener('mouseleave', function () { chip.classList.remove('open'); });
      chip.addEventListener('focusin', function () { chip.classList.add('open'); });
      chip.addEventListener('focusout', function () { chip.classList.remove('open'); });
    });
  }

  // ---------- guards ----------

  function requireAdmin(opts) {
    opts = opts || {};
    var u = global.Store.currentUser();
    if (!u) {
      window.location.href = 'login.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop() || 'admin.html');
      return false;
    }
    if (u.role !== 'admin') {
      document.body.innerHTML = ''
        + '<div style="min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:var(--font-body);padding:32px;text-align:center">'
        +   '<div>'
        +     '<h1 style="font-family:var(--font-display);font-size:32px;margin:0 0 12px">Acceso restringido</h1>'
        +     '<p style="color:var(--muted);margin:0 0 20px">Necesitas una cuenta de administrador para ver esta página.</p>'
        +     '<a href="login.html" style="display:inline-block;padding:12px 22px;background:var(--accent);color:#1a1c20;border-radius:8px;font-weight:600;text-decoration:none">Iniciar sesión</a>'
        +   '</div>'
        + '</div>';
      return false;
    }
    return true;
  }

  function isWholesale() {
    var u = global.Store.currentUser();
    return !!(u && u.role === 'wholesale' && u.status === 'active');
  }

  function isAdmin() {
    var u = global.Store.currentUser();
    return !!(u && u.role === 'admin');
  }

  // ---------- bootstrap ----------

  function init() {
    if (!global.Store) {
      console.warn('[Auth] Store no disponible — ¿falta cronos-store.js?');
      return;
    }
    renderAll();
    if (global.Store.subscribe) global.Store.subscribe(renderAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.Auth = {
    render: renderAll,
    requireAdmin: requireAdmin,
    isWholesale: isWholesale,
    isAdmin: isAdmin
  };
})(window);
