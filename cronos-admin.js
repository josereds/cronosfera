/* ============================================================
   Cronosfera · Lógica del panel de administración
   ------------------------------------------------------------
   - Tab switching
   - Dashboard con métricas reales
   - CRUD productos
   - Crear y gestionar subastas
   - Aprobar solicitudes mayoristas
   - Listar y editar usuarios
   - Editar configuración
   ============================================================ */
(function (global) {
  'use strict';

  var Store = global.Store;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
      else node.setAttribute(k, attrs[k]);
    });
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function toast(msg, type) {
    type = type || 'info';
    var t = el('div', { class: 'toast ' + type, text: msg });
    var mount = document.getElementById('toastMount') || document.body;
    mount.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 3000);
  }

  function confirmDialog(msg) { return window.confirm(msg); }

  // ---------- Descuentos: campo reutilizable (general / categoría / producto) ----------
  // Un pill que activa/desactiva + un % al lado. Va dentro de un <form> ya
  // existente y se lee con FormData en el submit, igual que cualquier otro
  // campo — no tiene guardado propio.
  function discountFieldHtml(name, label, current) {
    var active = !!(current && current.active);
    var pct = (current && current.pct) || 10;
    return '<div class="discount-field">'
      + '<span>' + escapeHtml(label) + '</span>'
      + '<div class="discount-row">'
      +   '<label class="discount-toggle-wrap">'
      +     '<input type="checkbox" name="' + name + 'Active" class="discount-checkbox" hidden' + (active ? ' checked' : '') + '>'
      +     '<span class="discount-toggle' + (active ? ' active' : '') + '">' + (active ? 'Descuento activo' : 'Activar descuento') + '</span>'
      +   '</label>'
      +   '<label class="discount-pct-field' + (active ? ' enabled' : '') + '"><input type="number" name="' + name + 'Pct" min="0" max="95" step="1" value="' + pct + '"><span>%</span></label>'
      + '</div>'
      + '</div>';
  }

  function bindDiscountFields(container) {
    container.querySelectorAll('.discount-checkbox').forEach(function (checkbox) {
      var pill = checkbox.nextElementSibling;
      var row = checkbox.closest('.discount-row');
      var pctField = row ? row.querySelector('.discount-pct-field') : null;
      checkbox.addEventListener('change', function () {
        pill.classList.toggle('active', checkbox.checked);
        pill.textContent = checkbox.checked ? 'Descuento activo' : 'Activar descuento';
        if (pctField) pctField.classList.toggle('enabled', checkbox.checked);
      });
    });
  }

  function readDiscountField(fd, name) {
    return { active: !!fd.get(name + 'Active'), pct: Number(fd.get(name + 'Pct')) || 0 };
  }

  // Redimensiona/comprime una foto elegida desde el input file antes de
  // guardarla como data URL en localStorage (no hay servidor todavía: sin
  // esto, fotos de celular de varios MB llenan la cuota del navegador rápido).
  function resizeImageFile(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Archivo de imagen inválido')); };
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var cw = Math.max(1, Math.round(img.width * scale));
          var ch = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ============== TAB ROUTER ==============
  var currentTab = null;
  function go(tab) {
    if (currentTab === tab) return;
    currentTab = tab;
    document.querySelectorAll('.nav-item[data-tab], .mobile-admin-tab[data-tab]').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
    var pane = document.getElementById('tab-' + tab);
    if (pane) { pane.classList.add('active'); renderTab(tab, pane); }
    document.getElementById('pageTitle').textContent = TAB_LABELS[tab] || tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  var TAB_LABELS = {
    dashboard: 'Dashboard',
    catalogo: 'Catálogo',
    accesorios: 'Accesorios',
    subastas: 'Subastas',
    pedidos: 'Pedidos',
    mayoristas: 'Solicitudes mayoristas',
    usuarios: 'Usuarios',
    config: 'Configuración'
  };

  function renderTab(tab, pane) {
    pane.innerHTML = '';
    ({ dashboard: renderDashboardV2, catalogo: renderCatalogo, accesorios: renderAccesorios, subastas: renderSubastas, pedidos: renderPedidos, mayoristas: renderMayoristas, usuarios: renderUsuarios, config: renderConfig })[tab](pane);
  }

  // ============== DASHBOARD ==============
  function renderDashboard(pane) {
    var products = Store.getProducts();
    var auctions = Store.getAuctions();
    Store.autoCloseExpired();
    var requests = Store.getWholesaleRequests();
    var users = Store.getUsers();
    var pendingRequests = requests.filter(function (r) { return r.status === 'pending'; });
    var liveAuctions = auctions.filter(function (a) { return Store.getAuctionStatus(a) === 'live'; });
    var scheduledAuctions = auctions.filter(function (a) { return Store.getAuctionStatus(a) === 'scheduled'; });

    var stats = [
      { label: 'Productos en catálogo', value: products.length, hint: products.length + ' referencias activas', tone: 'accent' },
      { label: 'Subastas en vivo', value: liveAuctions.length, hint: scheduledAuctions.length + ' programadas', tone: 'danger' },
      { label: 'Solicitudes mayoristas', value: pendingRequests.length, hint: 'Pendientes de aprobación', tone: 'info' },
      { label: 'Usuarios totales', value: users.length, hint: users.filter(function (u) { return u.role === 'wholesale'; }).length + ' mayoristas', tone: 'success' }
    ];

    pane.innerHTML = ''
      + '<div class="stat-grid">' + stats.map(function (s) {
          return ''
            + '<div class="stat-card ' + s.tone + '">'
            +   '<div class="stat-label">' + s.label + '</div>'
            +   '<div class="stat-value">' + s.value + '</div>'
            +   '<div class="stat-hint">' + s.hint + '</div>'
            + '</div>';
        }).join('') + '</div>'
      + '<div class="dash-cols">'
      +   '<div class="dash-panel">'
      +     '<h3>Subastas activas</h3>'
      +     (liveAuctions.length === 0
            ? '<p class="empty-inline">No hay subastas en vivo ahora mismo.</p>'
            : '<table class="admin-table"><thead><tr><th>Producto</th><th>Puja actual</th><th>Termina en</th></tr></thead><tbody>'
              + liveAuctions.map(function (a) {
                  var p = Store.getProduct(a.productId);
                  var remaining = new Date(a.endsAt).getTime() - Date.now();
                  return '<tr>'
                    + '<td><strong>' + escapeHtml(p ? p.model : '—') + '</strong><span class="row-meta">' + escapeHtml(p ? p.ref : '') + '</span></td>'
                    + '<td class="mono accent">' + Store.formatCOP(a.currentBid) + '</td>'
                    + '<td><span class="mono countdown-inline" data-ends="' + a.endsAt + '">' + formatCountdownInline(remaining) + '</span></td>'
                  + '</tr>';
                }).join('')
              + '</tbody></table>')
      +   '</div>'
      +   '<div class="dash-panel">'
      +     '<h3>Solicitudes recientes</h3>'
      +     (pendingRequests.length === 0
            ? '<p class="empty-inline">No hay solicitudes pendientes.</p>'
            : '<ul class="req-list">' + pendingRequests.slice(0, 5).map(function (r) {
                var u = Store.getUser(r.userId);
                return '<li><div><strong>' + escapeHtml(u ? u.name : '—') + '</strong><span class="row-meta">' + escapeHtml(u ? u.email : '') + '</span></div><span class="badge pending">Pendiente</span></li>';
              }).join('') + '</ul>')
      +     '<button class="btn-ghost" data-goto="mayoristas">Ver todas →</button>'
      +   '</div>'
      + '</div>';

    pane.querySelector('[data-goto="mayoristas"]') && pane.querySelector('[data-goto="mayoristas"]').addEventListener('click', function () { go('mayoristas'); });
    startInlineCountdowns();
  }

  function renderDashboardV2(pane) {
    var products = Store.getProducts();
    var auctions = Store.getAuctions();
    Store.autoCloseExpired();
    var requests = Store.getWholesaleRequests();
    var users = Store.getUsers();
    var bids = Store.getBids();
    var cfg = Store.getConfig();
    var pendingRequests = requests.filter(function (r) { return r.status === 'pending'; });
    var liveAuctions = auctions.filter(function (a) { return Store.getAuctionStatus(a) === 'live'; });
    var scheduledAuctions = auctions.filter(function (a) { return Store.getAuctionStatus(a) === 'scheduled'; });
    var closedAuctions = auctions.filter(function (a) { return Store.getAuctionStatus(a) === 'closed'; });
    var lowInventory = products.filter(function (p) { return p.stockStatus === 'low' || /bajo/i.test(p.stock || ''); });
    var outInventory = products.filter(function (p) { return p.stockStatus === 'out' || /agotado/i.test(p.stock || ''); });
    var wholesaleUsers = users.filter(function (u) { return u.role === 'wholesale'; });
    var activeWholesaleUsers = wholesaleUsers.filter(function (u) { return u.status === 'active'; });
    var retailUsers = users.filter(function (u) { return u.role === 'retail'; });
    var totalCatalogValue = products.reduce(function (sum, p) { return sum + Number(p.price || 0); }, 0);
    var bidVolume = bids.reduce(function (sum, b) { return sum + Number(b.amount || 0); }, 0);

    var stats = [
      { label: 'Productos', value: products.length, hint: Store.formatCOP(totalCatalogValue) + ' en catalogo', tone: 'accent' },
      { label: 'Subastas live', value: liveAuctions.length, hint: scheduledAuctions.length + ' programadas / ' + closedAuctions.length + ' cerradas', tone: 'danger' },
      { label: 'Mayoristas pendientes', value: pendingRequests.length, hint: activeWholesaleUsers.length + ' cuentas activas', tone: 'info' },
      { label: 'Usuarios', value: users.length, hint: wholesaleUsers.length + ' mayoristas / ' + retailUsers.length + ' retail', tone: 'success' }
    ];

    var ops = [
      { icon: 'MK', title: 'Tienda publica', sub: 'Landing, catalogo, producto y subastas visibles.', value: 'Online' },
      { icon: 'AD', title: 'Admin editable', sub: 'Productos, subastas, usuarios y configuracion.', value: '5/5' },
      { icon: 'AU', title: 'Motor de subastas', sub: 'Pujas, countdown y cierre automatico local.', value: bids.length + ' pujas' },
      { icon: 'DB', title: 'Persistencia', sub: 'Datos locales listos para migrar a Supabase.', value: 'localStorage' }
    ];

    var health = [
      { title: 'Inventario bajo', sub: 'Referencias que requieren reposicion.', value: lowInventory.length },
      { title: 'Agotados', sub: 'Productos sin disponibilidad.', value: outInventory.length },
      { title: 'Volumen en pujas', sub: 'Suma historica de pujas registradas.', value: Store.formatCOP(bidVolume) },
      { title: 'Descuento mayorista', sub: 'Configuracion global activa.', value: (cfg.wholesaleDiscountPct || 0) + '%' }
    ];

    pane.innerHTML = ''
      + '<section class="admin-hero">'
      +   '<div class="hero-panel">'
      +     '<span class="eyebrow">Centro de control - Cronosfera</span>'
      +     '<h2>Operacion comercial, catalogo y subastas en un solo panel.</h2>'
      +     '<p>Administra la version local del marketplace: productos, precios mayoristas, subastas, usuarios, solicitudes y configuracion. La capa de datos queda lista para migrar a Supabase sin rehacer la interfaz.</p>'
      +     '<div class="hero-actions">'
      +       '<button class="btn-primary" data-goto="catalogo">Gestionar catalogo</button>'
      +       '<button class="btn-ghost" data-goto="subastas">Crear subasta</button>'
      +       '<button class="btn-ghost" data-open-store>Ver tienda</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ops-panel">'
      +     '<h3>Estado de modulos</h3>'
      +     '<div class="ops-list">' + ops.map(function (o) {
              return '<div class="ops-item">'
                + '<div class="ops-icon">' + escapeHtml(o.icon) + '</div>'
                + '<div><div class="ops-title">' + escapeHtml(o.title) + '</div><div class="ops-sub">' + escapeHtml(o.sub) + '</div></div>'
                + '<div class="ops-value">' + escapeHtml(o.value) + '</div>'
              + '</div>';
            }).join('') + '</div>'
      +   '</div>'
      + '</section>'
      + '<div class="stat-grid">' + stats.map(function (s) {
          return '<div class="stat-card ' + s.tone + '">'
            + '<div class="stat-label">' + escapeHtml(s.label) + '</div>'
            + '<div class="stat-value">' + escapeHtml(s.value) + '</div>'
            + '<div class="stat-hint">' + escapeHtml(s.hint) + '</div>'
            + '</div>';
        }).join('') + '</div>'
      + '<section class="action-grid">'
      +   '<button class="action-card" data-goto="catalogo"><span class="icon">01</span><h3>Catalogo</h3><p>Crear, editar, eliminar productos y revisar precios mayoristas calculados.</p></button>'
      +   '<button class="action-card" data-goto="subastas"><span class="icon">02</span><h3>Subastas</h3><p>Programar subastas, cerrar piezas en vivo y revisar el historial de pujas.</p></button>'
      +   '<button class="action-card" data-goto="mayoristas"><span class="icon">03</span><h3>Mayoristas</h3><p>Aprobar solicitudes y activar cuentas con acceso a precio especial.</p></button>'
      +   '<button class="action-card" data-goto="config"><span class="icon">04</span><h3>Configuracion</h3><p>Ajustar descuento, reglas de subasta, minimos y copy de la landing.</p></button>'
      + '</section>'
      + '<div class="dash-cols">'
      +   '<div class="dash-panel">'
      +     '<h3>Subastas activas</h3>'
      +     (liveAuctions.length === 0
            ? '<p class="empty-inline">No hay subastas en vivo ahora mismo.</p>'
            : '<table class="admin-table"><thead><tr><th>Producto</th><th>Puja actual</th><th>Termina en</th></tr></thead><tbody>'
              + liveAuctions.map(function (a) {
                  var p = Store.getProduct(a.productId);
                  var remaining = new Date(a.endsAt).getTime() - Date.now();
                  return '<tr>'
                    + '<td><strong>' + escapeHtml(p ? p.model : '-') + '</strong><span class="row-meta">' + escapeHtml(p ? p.ref : '') + '</span></td>'
                    + '<td class="mono accent">' + Store.formatCOP(a.currentBid) + '</td>'
                    + '<td><span class="mono countdown-inline" data-ends="' + a.endsAt + '">' + formatCountdownInline(remaining) + '</span></td>'
                  + '</tr>';
                }).join('')
              + '</tbody></table>')
      +   '</div>'
      +   '<div class="dash-panel">'
      +     '<h3>Solicitudes recientes</h3>'
      +     (pendingRequests.length === 0
            ? '<p class="empty-inline">No hay solicitudes pendientes.</p>'
            : '<ul class="req-list">' + pendingRequests.slice(0, 5).map(function (r) {
                var u = Store.getUser(r.userId);
                return '<li><div><strong>' + escapeHtml(u ? u.name : '-') + '</strong><span class="row-meta">' + escapeHtml(u ? u.email : '') + '</span></div><span class="status-pill pending">Pendiente</span></li>';
              }).join('') + '</ul>')
      +     '<button class="btn-ghost" data-goto="mayoristas">Ver todas -></button>'
      +   '</div>'
      + '</div>'
      + '<section class="health-grid">'
      +   '<div class="health-card">'
      +     '<h3>Salud comercial</h3>'
      +     '<div class="metric-list">' + health.map(function (h) {
              return '<div class="metric-row"><div><strong>' + escapeHtml(h.title) + '</strong><span>' + escapeHtml(h.sub) + '</span></div><div class="metric-value">' + escapeHtml(h.value) + '</div></div>';
            }).join('') + '</div>'
      +     '<div class="admin-mini-chart" aria-label="Actividad de la semana">' + [45,62,38,74,56,82,67,92].map(function (v) { return '<span style="height:' + v + '%"></span>'; }).join('') + '</div>'
      +   '</div>'
      +   '<div class="health-card">'
      +     '<h3>Inventario critico</h3>'
      +     (lowInventory.length === 0 && outInventory.length === 0
            ? '<p class="empty-inline">No hay alertas de inventario.</p>'
            : '<div class="inventory-list">' + lowInventory.concat(outInventory).slice(0, 6).map(function (p) {
                return '<div class="inventory-item"><div><div class="name">' + escapeHtml(p.model) + '</div><div class="ref">' + escapeHtml(p.ref) + '</div></div><span class="stock-pill ' + (p.stockStatus || 'low') + '">' + escapeHtml(p.stock || 'Revisar') + '</span></div>';
              }).join('') + '</div>')
      +   '</div>'
      + '</section>';

    pane.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(btn.getAttribute('data-goto')); });
    });
    var storeBtn = pane.querySelector('[data-open-store]');
    if (storeBtn) storeBtn.addEventListener('click', function () { window.open('index.html', '_blank'); });
    startInlineCountdowns();
  }

  function formatCountdownInline(ms) {
    if (ms <= 0) return 'Finalizada';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  var inlineTicker = null;
  function startInlineCountdowns() {
    if (inlineTicker) return;
    inlineTicker = setInterval(function () {
      document.querySelectorAll('.countdown-inline[data-ends]').forEach(function (n) {
        var ms = new Date(n.getAttribute('data-ends')).getTime() - Date.now();
        n.textContent = formatCountdownInline(ms);
      });
    }, 1000);
  }

  // ============== CATÁLOGO CRUD ==============
  // Estado de navegación del catálogo: qué marca está abierta, o si se está
  // viendo el listado plano de "todos" (persiste entre re-render dentro de
  // la misma sesión del panel).
  var catalogOpenBrand = null;
  var catalogViewAll = false;

  function renderCatalogo(pane) {
    pane.innerHTML = ''
      + '<div class="catalogo-head">'
      +   '<div class="catalogo-search">'
      +     '<input type="search" id="prodSearch" placeholder="Buscar en todo el catálogo…">'
      +   '</div>'
      +   '<div class="catalogo-head-actions">'
      +     '<button class="btn-ghost" id="viewAllProducts">Ver todos los productos</button>'
      +     '<button class="btn-ghost" id="newBrand">+ Carpeta</button>'
      +     '<button class="btn-primary" id="newProduct">+ Nuevo producto</button>'
      +   '</div>'
      + '</div>'
      + '<div id="catalogBody"></div>';

    var body = pane.querySelector('#catalogBody');
    var search = pane.querySelector('#prodSearch');

    function coverImg(items) {
      var withImg = items.filter(function (p) { return p.image; });
      return withImg.length ? withImg[0].image : null;
    }

    function prodCard(p) {
      var w = Store.wholesalePriceFor(p);
      var disc = Store.getPriceDisplay(p);
      var cover = p.image
        ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">'
        : '<span class="admin-prod-ph">◷</span>';
      return '<div class="admin-prod-card" data-id="' + p.id + '">'
        + '<div class="admin-prod-cover">' + cover + '<span class="stock-pill ' + (p.stockStatus || 'in') + '">' + escapeHtml(p.stock || '—') + '</span>' + (disc.off > 0 ? '<span class="discount-badge">-' + disc.off + '%</span>' : '') + '</div>'
        + '<div class="admin-prod-body">'
        +   '<div class="admin-prod-model">' + escapeHtml(p.model) + '</div>'
        +   '<div class="admin-prod-ref mono">' + escapeHtml(p.ref) + '</div>'
        +   '<div class="admin-prod-prices"><span class="pr">' + Store.formatCOP(p.price) + '</span><span class="wpr">May. ' + Store.formatCOP(w) + '</span></div>'
        + '</div>'
        + '<div class="admin-prod-actions"><button class="btn-ghost edit">Editar</button><button class="icon-action delete" title="Eliminar">×</button></div>'
        + '</div>';
    }

    function groupByBrand(products) {
      var groups = {};
      products.forEach(function (p) { var k = p.brand || 'Sin marca'; (groups[k] = groups[k] || []).push(p); });
      return groups;
    }

    var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke-linejoin="round"/></svg>';
    var editSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20h9" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linejoin="round"/></svg>';

    // Las carpetas visibles son las marcas conocidas (Store.getBrands(),
    // fijas + creadas desde el panel, con su orden). Si hay productos con un
    // p.brand suelto que no matchea ninguna marca conocida (dato viejo/atípico),
    // igual se muestra su carpeta al final para no esconder productos.
    function drawBrandGrid() {
      var groups = groupByBrand(Store.getWatchProducts());
      var known = Store.getBrands();
      var seen = {};
      var tiles = known.map(function (b) {
        seen[b.slug] = true;
        var items = groups[b.name] || [];
        return { slug: b.slug, name: b.name, items: items, cover: b.photo || coverImg(items), custom: b.custom, movable: true };
      });
      Object.keys(groups).forEach(function (name) {
        var slug = Store.productBrandSlug({ brand: name });
        if (seen[slug]) return;
        tiles.push({ slug: slug, name: name, items: groups[name], cover: coverImg(groups[name]), custom: false, movable: false });
      });
      if (tiles.length === 0) {
        body.innerHTML = '<div class="empty-state"><h3>Sin productos todavía</h3><p>Crea el primero con “+ Nuevo producto”.</p></div>';
        return;
      }
      body.innerHTML = '<div class="brand-folder-grid">' + tiles.map(function (t, i) {
        return '<div class="brand-folder">'
          + '<button class="brand-folder-cover" data-brand="' + escapeHtml(t.name) + '">'
          +   (t.cover ? '<img src="' + escapeHtml(t.cover) + '" alt="" loading="lazy">' : '<span class="brand-folder-ph">◷</span>')
          +   '<span class="brand-folder-count">' + t.items.length + '</span>'
          + '</button>'
          + '<div class="brand-folder-body">'
          +   '<button class="brand-folder-name-btn" data-brand="' + escapeHtml(t.name) + '">' + folderSvg + '<span class="brand-folder-name">' + escapeHtml(t.name) + '</span></button>'
          +   (t.movable ? ''
                + '<button class="icon-action move-up" data-slug="' + t.slug + '" title="Mover antes"' + (i === 0 ? ' disabled' : '') + '>↑</button>'
                + '<button class="icon-action move-down" data-slug="' + t.slug + '" title="Mover después"' + (i === tiles.length - 1 ? ' disabled' : '') + '>↓</button>'
                + '<button class="icon-action edit-brand" data-slug="' + t.slug + '" title="Editar carpeta">' + editSvg + '</button>'
              : '')
          + '</div>'
          + '</div>';
      }).join('') + '</div>';
    }

    function drawBrandView(brand) {
      var items = Store.getWatchProducts()
        .filter(function (p) { return (p.brand || 'Sin marca') === brand; })
        .sort(function (a, b) { return (a.model || '').localeCompare(b.model || '', 'es'); });
      body.innerHTML = ''
        + '<div class="folder-bar">'
        +   '<button class="folder-back" id="folderBack">← Todas las marcas</button>'
        +   '<span class="folder-title">' + escapeHtml(brand) + '<span class="count">' + items.length + (items.length === 1 ? ' referencia' : ' referencias') + '</span></span>'
        + '</div>'
        + '<div class="admin-prod-grid">' + items.map(prodCard).join('') + '</div>';
    }

    function drawSearch(filter) {
      var list = Store.getWatchProducts().filter(function (p) {
        return (p.model + ' ' + p.brand + ' ' + p.ref).toLowerCase().indexOf(filter) >= 0;
      }).sort(function (a, b) {
        return (a.model || '').localeCompare(b.model || '', 'es');
      });
      if (list.length === 0) {
        body.innerHTML = '<div class="empty-state"><h3>Sin resultados</h3><p>No hay productos que coincidan con “' + escapeHtml(filter) + '”.</p></div>';
        return;
      }
      body.innerHTML = '<div class="catalog-count">' + list.length + (list.length === 1 ? ' resultado' : ' resultados') + ' para “' + escapeHtml(filter) + '”</div>'
        + '<div class="admin-prod-grid">' + list.map(prodCard).join('') + '</div>';
    }

    function drawAll() {
      var list = Store.getWatchProducts().slice().sort(function (a, b) {
        return (a.model || '').localeCompare(b.model || '', 'es');
      });
      body.innerHTML = ''
        + '<div class="folder-bar">'
        +   '<button class="folder-back" id="folderBack">← Volver a carpetas</button>'
        +   '<span class="folder-title">Todos los productos<span class="count">' + list.length + (list.length === 1 ? ' referencia' : ' referencias') + '</span></span>'
        + '</div>'
        + (list.length === 0
              ? '<div class="empty-state"><h3>Sin productos todavía</h3><p>Crea el primero con “+ Nuevo producto”.</p></div>'
              : '<div class="admin-prod-grid">' + list.map(prodCard).join('') + '</div>');
    }

    function drawBody() {
      var filter = (search.value || '').toLowerCase().trim();
      if (filter) { drawSearch(filter); return; }
      if (catalogViewAll) { drawAll(); return; }
      if (catalogOpenBrand && groupByBrand(Store.getWatchProducts())[catalogOpenBrand]) drawBrandView(catalogOpenBrand);
      else { catalogOpenBrand = null; drawBrandGrid(); }
    }

    body.addEventListener('click', function (e) {
      var opener = e.target.closest('.brand-folder-cover, .brand-folder-name-btn');
      if (opener) { catalogOpenBrand = opener.getAttribute('data-brand'); catalogViewAll = false; drawBody(); return; }
      if (e.target.closest('#folderBack')) { catalogOpenBrand = null; catalogViewAll = false; search.value = ''; drawBody(); return; }
      var moveUp = e.target.closest('.move-up');
      if (moveUp) { Store.moveBrand(moveUp.getAttribute('data-slug'), -1); drawBody(); return; }
      var moveDown = e.target.closest('.move-down');
      if (moveDown) { Store.moveBrand(moveDown.getAttribute('data-slug'), 1); drawBody(); return; }
      var editBrand = e.target.closest('.edit-brand');
      if (editBrand) { openBrandModal(editBrand.getAttribute('data-slug'), drawBody); return; }
      var card = e.target.closest('.admin-prod-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      if (e.target.closest('.edit')) { openProductModal(id, drawBody); return; }
      if (e.target.closest('.delete')) {
        var p = Store.getProduct(id);
        if (confirmDialog('¿Eliminar "' + (p ? p.model : '') + '"? Esta acción no se puede deshacer.')) {
          Store.deleteProduct(id);
          toast('Producto eliminado', 'success');
          drawBody();
        }
      }
    });

    search.addEventListener('input', function () { drawBody(); });
    pane.querySelector('#newProduct').addEventListener('click', function () { openProductModal(null, drawBody); });
    pane.querySelector('#newBrand').addEventListener('click', function () { openBrandModal(null, drawBody); });
    pane.querySelector('#viewAllProducts').addEventListener('click', function () {
      catalogViewAll = true; catalogOpenBrand = null; search.value = ''; drawBody();
    });

    drawBody();
  }

  function openBrandModal(slug, onDone) {
    var isNew = !slug;
    var b = isNew ? { name: '', photo: '', custom: true, count: 0 } : Store.getBrand(slug);
    if (!isNew && !b) return;
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal' });

    modal.innerHTML = ''
      + '<div class="modal-head"><h3>' + (isNew ? 'Nueva carpeta' : 'Editar carpeta') + '</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<form id="brandForm">'
      +   '<label class="block"><span>Nombre</span><input name="name" value="' + escapeHtml(b.name) + '" required placeholder="Ej. Michael Kors"></label>'
      +   '<label class="block photo-field"><span>Foto de portada (opcional)</span>'
      +     '<div class="photo-row">'
      +       '<div class="photo-preview" id="brandPhotoPreview">' + (b.photo ? '<img src="' + escapeHtml(b.photo) + '" alt="">' : '<span class="admin-prod-ph">◷</span>') + '</div>'
      +       '<div class="photo-actions">'
      +         '<label class="btn-ghost photo-pick">Elegir foto<input type="file" accept="image/*" id="brandPhotoInput" hidden></label>'
      +       '</div>'
      +     '</div>'
      +     '<p class="form-hint">Si no pones foto, se usa la primera foto de un producto de esta carpeta (o el nombre solo).</p>'
      +   '</label>'
      +   (!isNew ? discountFieldHtml('discount', 'Descuento para toda la marca "' + b.name + '"', Store.getBrandDiscount(slug)) : '')
      +   (!isNew && b.custom
            ? '<p class="form-hint">' + (b.count > 0 ? 'Esta carpeta tiene ' + b.count + ' producto(s), así que no se puede eliminar.' : 'Esta carpeta está vacía, se puede eliminar.') + '</p>'
            : '')
      +   '<div class="modal-actions">'
      +     (!isNew && b.custom && b.count === 0 ? '<button type="button" class="btn-ghost delete-brand" style="margin-right:auto">Eliminar carpeta</button>' : '')
      +     '<button type="button" class="btn-ghost cancel">Cancelar</button>'
      +     '<button type="submit" class="btn-primary">' + (isNew ? 'Crear carpeta' : 'Guardar cambios') + '</button>'
      +   '</div>'
      + '</form>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var pendingCover;
    var preview = modal.querySelector('#brandPhotoPreview');
    modal.querySelector('#brandPhotoInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      resizeImageFile(file, 1000, 0.82).then(function (dataUrl) {
        pendingCover = dataUrl;
        preview.innerHTML = '<img src="' + dataUrl + '" alt="">';
      }).catch(function () { toast('No se pudo procesar la foto', 'danger'); });
    });

    var deleteBtn = modal.querySelector('.delete-brand');
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      if (!confirmDialog('¿Eliminar la carpeta "' + b.name + '"?')) return;
      try {
        Store.deleteBrand(slug);
        toast('Carpeta eliminada', 'success');
        close();
        if (typeof onDone === 'function') onDone();
      } catch (err) { toast(err.message, 'danger'); }
    });

    modal.querySelector('#brandForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var name = fd.get('name');
      try {
        if (isNew) {
          Store.addBrand({ name: name, cover: pendingCover || '' });
          toast('Carpeta creada', 'success');
        } else {
          Store.renameBrand(slug, name);
          if (pendingCover !== undefined) Store.setBrandCover(slug, pendingCover);
          var d = readDiscountField(fd, 'discount');
          Store.setBrandDiscount(slug, d.active, d.pct);
          toast('Carpeta actualizada', 'success');
        }
        close();
        if (typeof onDone === 'function') onDone();
      } catch (err) { toast(err.message, 'danger'); }
    });
    bindDiscountFields(modal);
  }

  // ============== ACCESORIOS (gorras, correas, billeteras) ==============
  // Categorías fijas (no son marcas de reloj): mismo patrón visual de
  // carpetas que el catálogo, pero sin ficha técnica de reloj y sin poder
  // crear/borrar categorías desde aquí (ya vienen definidas en el Store).
  var accessoryOpenCategory = null;
  var accessoryViewAll = false;

  function renderAccesorios(pane) {
    pane.innerHTML = ''
      + '<div class="catalogo-head">'
      +   '<p class="form-hint" style="margin:0">Gorras, correas y billeteras: categorías fijas para que Cristian suba fotos y precios cuando las tenga.</p>'
      +   '<div class="catalogo-head-actions">'
      +     '<button class="btn-ghost" id="viewAllAcc">Ver todos los accesorios</button>'
      +   '</div>'
      + '</div>'
      + '<div id="accBody"></div>';

    var body = pane.querySelector('#accBody');
    var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke-linejoin="round"/></svg>';
    var editSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20h9" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linejoin="round"/></svg>';

    function accProdCard(p) {
      var w = Store.wholesalePriceFor(p);
      var disc = Store.getPriceDisplay(p);
      var cover = p.image
        ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">'
        : '<span class="admin-prod-ph">◷</span>';
      return '<div class="admin-prod-card" data-id="' + p.id + '">'
        + '<div class="admin-prod-cover">' + cover + '<span class="stock-pill ' + (p.stockStatus || 'in') + '">' + escapeHtml(p.stock || '—') + '</span>' + (disc.off > 0 ? '<span class="discount-badge">-' + disc.off + '%</span>' : '') + '</div>'
        + '<div class="admin-prod-body">'
        +   '<div class="admin-prod-model">' + escapeHtml(p.model) + '</div>'
        +   (p.ref ? '<div class="admin-prod-ref mono">' + escapeHtml(p.ref) + '</div>' : '')
        +   '<div class="admin-prod-prices"><span class="pr">' + Store.formatCOP(p.price) + '</span><span class="wpr">May. ' + Store.formatCOP(w) + '</span></div>'
        + '</div>'
        + '<div class="admin-prod-actions"><button class="btn-ghost edit">Editar</button><button class="icon-action delete" title="Eliminar">×</button></div>'
        + '</div>';
    }

    function drawGrid() {
      var cats = Store.getAccessoryCategories();
      body.innerHTML = '<div class="brand-folder-grid">' + cats.map(function (c) {
        return '<div class="brand-folder">'
          + '<button class="brand-folder-cover" data-acc="' + c.slug + '">'
          +   (c.cover ? '<img src="' + escapeHtml(c.cover) + '" alt="" loading="lazy">' : '<span class="brand-folder-ph">◷</span>')
          +   '<span class="brand-folder-count">' + c.count + '</span>'
          + '</button>'
          + '<div class="brand-folder-body">'
          +   '<button class="brand-folder-name-btn" data-acc="' + c.slug + '">' + folderSvg + '<span class="brand-folder-name">' + escapeHtml(c.name) + '</span></button>'
          +   '<button class="icon-action edit-acc-cover" data-acc-cover="' + c.slug + '" title="Cambiar foto de categoría">' + editSvg + '</button>'
          + '</div>'
          + '</div>';
      }).join('') + '</div>';
    }

    function drawCategory(slug) {
      var cat = Store.getAccessoryCategories().filter(function (c) { return c.slug === slug; })[0];
      if (!cat) { accessoryOpenCategory = null; drawGrid(); return; }
      var items = Store.getAccessoryProducts(slug).sort(function (a, b) { return (a.model || '').localeCompare(b.model || '', 'es'); });
      body.innerHTML = ''
        + '<div class="folder-bar">'
        +   '<button class="folder-back" id="accBack">← Todas las categorías</button>'
        +   '<span class="folder-title">' + escapeHtml(cat.name) + '<span class="count">' + items.length + (items.length === 1 ? ' producto' : ' productos') + '</span></span>'
        +   '<button class="btn-primary" id="accNewProduct" style="margin-left:auto">+ Nuevo producto</button>'
        + '</div>'
        + (items.length === 0
              ? '<div class="empty-state"><h3>Todavía no hay productos aquí</h3><p>Crea el primero con “+ Nuevo producto”.</p></div>'
              : '<div class="admin-prod-grid">' + items.map(accProdCard).join('') + '</div>');
    }

    function drawAll() {
      var list = Store.getAccessoryProducts().slice().sort(function (a, b) {
        return (a.model || '').localeCompare(b.model || '', 'es');
      });
      body.innerHTML = ''
        + '<div class="folder-bar">'
        +   '<button class="folder-back" id="accBack">← Volver a categorías</button>'
        +   '<span class="folder-title">Todos los accesorios<span class="count">' + list.length + (list.length === 1 ? ' producto' : ' productos') + '</span></span>'
        + '</div>'
        + (list.length === 0
              ? '<div class="empty-state"><h3>Sin accesorios todavía</h3><p>Entra a una categoría y crea el primero.</p></div>'
              : '<div class="admin-prod-grid">' + list.map(accProdCard).join('') + '</div>');
    }

    function drawBody() {
      if (accessoryViewAll) { drawAll(); return; }
      if (accessoryOpenCategory) drawCategory(accessoryOpenCategory);
      else drawGrid();
    }

    body.addEventListener('click', function (e) {
      var coverEdit = e.target.closest('.edit-acc-cover');
      if (coverEdit) { openAccessoryCoverModal(coverEdit.getAttribute('data-acc-cover'), drawBody); return; }
      var opener = e.target.closest('.brand-folder-cover, .brand-folder-name-btn');
      if (opener) { accessoryOpenCategory = opener.getAttribute('data-acc'); accessoryViewAll = false; drawBody(); return; }
      if (e.target.closest('#accBack')) { accessoryOpenCategory = null; accessoryViewAll = false; drawBody(); return; }
      if (e.target.closest('#accNewProduct')) { openAccessoryModal(null, accessoryOpenCategory, drawBody); return; }
      var card = e.target.closest('.admin-prod-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      if (e.target.closest('.edit')) { openAccessoryModal(id, Store.getProduct(id).accessoryType, drawBody); return; }
      if (e.target.closest('.delete')) {
        var p = Store.getProduct(id);
        if (confirmDialog('¿Eliminar "' + (p ? p.model : '') + '"? Esta acción no se puede deshacer.')) {
          Store.deleteProduct(id);
          toast('Producto eliminado', 'success');
          drawBody();
        }
      }
    });

    pane.querySelector('#viewAllAcc').addEventListener('click', function () {
      accessoryViewAll = true; accessoryOpenCategory = null; drawBody();
    });

    drawBody();
  }

  function openAccessoryCoverModal(slug, onDone) {
    var cat = Store.getAccessoryCategories().filter(function (c) { return c.slug === slug; })[0];
    if (!cat) return;
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal' });
    modal.innerHTML = ''
      + '<div class="modal-head"><h3>Foto de "' + escapeHtml(cat.name) + '"</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<div class="photo-row">'
      +   '<div class="photo-preview" id="accCoverPreview">' + (cat.cover ? '<img src="' + escapeHtml(cat.cover) + '" alt="">' : '<span class="admin-prod-ph">◷</span>') + '</div>'
      +   '<div class="photo-actions">'
      +     '<label class="btn-ghost photo-pick">Elegir foto<input type="file" accept="image/*" id="accCoverInput" hidden></label>'
      +     (cat.cover ? '<button type="button" class="btn-ghost photo-remove">Quitar</button>' : '')
      +   '</div>'
      + '</div>'
      + '<p class="form-hint">Si no pones foto, se usa la primera foto de un producto de esta categoría (o el nombre solo).</p>'
      + discountFieldHtml('discount', 'Descuento para toda la categoría "' + escapeHtml(cat.name) + '"', Store.getAccessoryCategoryDiscount(slug))
      + '<div class="modal-actions"><button type="button" class="btn-ghost cancel">Cancelar</button></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var preview = modal.querySelector('#accCoverPreview');
    modal.querySelector('#accCoverInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      resizeImageFile(file, 1000, 0.82).then(function (dataUrl) {
        Store.setAccessoryCover(slug, dataUrl);
        toast('Foto actualizada', 'success');
        close();
        if (typeof onDone === 'function') onDone();
      }).catch(function () { toast('No se pudo procesar la foto', 'danger'); });
    });
    var removeBtn = modal.querySelector('.photo-remove');
    if (removeBtn) removeBtn.addEventListener('click', function () {
      Store.setAccessoryCover(slug, '');
      toast('Foto quitada', 'success');
      close();
      if (typeof onDone === 'function') onDone();
    });

    // Este modal no tiene botón "Guardar": todo se guarda al instante, así
    // que el descuento también se aplica apenas se toca el interruptor o el %.
    bindDiscountFields(modal);
    var discCheckbox = modal.querySelector('.discount-checkbox');
    var discPctInput = modal.querySelector('.discount-pct-field input');
    function saveDiscount() {
      Store.setAccessoryCategoryDiscount(slug, discCheckbox.checked, discPctInput.value);
    }
    discCheckbox.addEventListener('change', function () {
      saveDiscount();
      toast(discCheckbox.checked ? 'Descuento activado' : 'Descuento desactivado', 'success');
    });
    discPctInput.addEventListener('change', saveDiscount);
  }

  function openAccessoryModal(id, categorySlug, onDone) {
    var p = id ? Store.getProduct(id) : {
      category: 'accesorio', accessoryType: categorySlug,
      model: '', ref: '', price: 0, wasPrice: 0, wholesalePrice: 0,
      stock: 'Disponible', stockStatus: 'in', description: ''
    };
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal product-modal' });

    modal.innerHTML = ''
      + '<div class="modal-head"><h3>' + (id ? 'Editar producto' : 'Nuevo producto') + '</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<form id="accProductForm">'
      +   '<label class="block photo-field"><span>Foto</span>'
      +     '<div class="photo-row">'
      +       '<div class="photo-preview" id="accPhotoPreview">' + (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '<span class="admin-prod-ph">◷</span>') + '</div>'
      +       '<div class="photo-actions">'
      +         '<label class="btn-ghost photo-pick">Elegir foto<input type="file" accept="image/*" id="accPhotoInput" hidden></label>'
      +         (p.image ? '<button type="button" class="btn-ghost photo-remove">Quitar</button>' : '')
      +       '</div>'
      +     '</div>'
      +     '<p class="form-hint">Se guarda en este navegador. Se ajusta el tamaño automáticamente.</p>'
      +   '</label>'
      +   '<div class="form-grid">'
      +     '<label><span>Nombre</span><input name="model" value="' + escapeHtml(p.model) + '" required placeholder="Ej. Gorra clásica negra"></label>'
      +     '<label><span>Referencia (opcional)</span><input name="ref" value="' + escapeHtml(p.ref || '') + '"></label>'
      +     '<label><span>Precio (COP)</span><input type="number" name="price" value="' + (p.price || 0) + '" required min="0" step="1000"></label>'
      +     '<label><span>Precio antes (0 = sin descuento)</span><input type="number" name="wasPrice" value="' + (p.wasPrice || 0) + '" min="0" step="1000"></label>'
      +     '<label><span>Precio mayorista (COP, vacío = usa el % general)</span><input type="number" name="wholesalePrice" value="' + (p.wholesalePrice || 0) + '" min="0" step="1000"></label>'
      +     '<label><span>Stock (texto)</span><input name="stock" value="' + escapeHtml(p.stock || '') + '"></label>'
      +     '<label><span>Estado stock</span><select name="stockStatus">'
      +       '<option value="in"' + ((p.stockStatus || 'in') === 'in' ? ' selected' : '') + '>Disponible</option>'
      +       '<option value="low"' + (p.stockStatus === 'low' ? ' selected' : '') + '>Bajo inventario</option>'
      +       '<option value="out"' + (p.stockStatus === 'out' ? ' selected' : '') + '>Agotado</option>'
      +     '</select></label>'
      +   '</div>'
      +   '<label class="block"><span>Descripción (opcional)</span><textarea name="description" rows="3">' + escapeHtml(p.description || '') + '</textarea></label>'
      +   discountFieldHtml('discount', 'Descuento solo para este producto', { active: p.discountActive, pct: p.discountPct })
      +   '<div class="modal-actions"><button type="button" class="btn-ghost cancel">Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div>'
      + '</form>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    bindDiscountFields(modal);

    var pendingImage;
    var photoInput = modal.querySelector('#accPhotoInput');
    var photoPreview = modal.querySelector('#accPhotoPreview');
    photoInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      resizeImageFile(file, 900, 0.82).then(function (dataUrl) {
        pendingImage = dataUrl;
        photoPreview.innerHTML = '<img src="' + dataUrl + '" alt="">';
      }).catch(function () { toast('No se pudo procesar la foto', 'danger'); });
    });
    var photoRemove = modal.querySelector('.photo-remove');
    if (photoRemove) photoRemove.addEventListener('click', function () {
      pendingImage = null;
      photoPreview.innerHTML = '<span class="admin-prod-ph">◷</span>';
    });

    modal.querySelector('#accProductForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var accCat = Store.getAccessoryCategories().filter(function (c) { return c.slug === (p.accessoryType || categorySlug); })[0];
      var next = Object.assign({}, p, {
        category: 'accesorio',
        accessoryType: p.accessoryType || categorySlug,
        // Se guarda también como `brand` (nombre de la categoría) para que el
        // carrito y los mensajes de WhatsApp, que leen p.brand, se vean bien
        // sin tener que tocar ese código para accesorios.
        brand: accCat ? accCat.name : '',
        model: fd.get('model'),
        ref: (fd.get('ref') || '').trim(),
        price: Number(fd.get('price')) || 0,
        wasPrice: Number(fd.get('wasPrice')) || 0,
        wholesalePrice: Number(fd.get('wholesalePrice')) || 0,
        stock: fd.get('stock'),
        stockStatus: fd.get('stockStatus'),
        description: fd.get('description')
      });
      var pd = readDiscountField(fd, 'discount');
      next.discountActive = pd.active;
      next.discountPct = pd.pct;
      if (pendingImage !== undefined) next.image = pendingImage;
      try {
        Store.saveProduct(next);
        toast(id ? 'Producto actualizado' : 'Producto creado', 'success');
        close();
        if (typeof onDone === 'function') onDone();
      } catch (err) { toast(err.message, 'danger'); }
    });
  }

  function openProductModal(id, onDone) {
    var p = id ? Store.getProduct(id) : { brand: '', brandSlug: '', model: '', ref: '', price: 0, wasPrice: 0, off: 0, wholesalePrice: 0, tone: 'ink', tag: null, stock: 'Disponible', stockStatus: 'in', variants: ['#1d2026'], gender: '', mechanism: '', crystal: '', strap: '' };
    if (p.brand && !p.brandSlug) p.brandSlug = Store.productBrandSlug(p);
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal product-modal' });

    function specSelect(name, label, options, current) {
      return '<label><span>' + label + '</span><select name="' + name + '" required>'
        + '<option value=""' + (current ? '' : ' selected') + ' disabled>Selecciona…</option>'
        + options.map(function (o) {
            return '<option value="' + escapeHtml(o) + '"' + (current === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>';
          }).join('')
        + '</select></label>';
    }

    modal.innerHTML = ''
      + '<div class="modal-head"><h3>' + (id ? 'Editar producto' : 'Nuevo producto') + '</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<form id="productForm">'
      +   '<label class="block photo-field"><span>Foto</span>'
      +     '<div class="photo-row">'
      +       '<div class="photo-preview" id="photoPreview">' + (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '<span class="admin-prod-ph">◷</span>') + '</div>'
      +       '<div class="photo-actions">'
      +         '<label class="btn-ghost photo-pick">Elegir foto<input type="file" accept="image/*" id="photoInput" hidden></label>'
      +         (p.image ? '<button type="button" class="btn-ghost photo-remove">Quitar</button>' : '')
      +       '</div>'
      +     '</div>'
      +     '<p class="form-hint">Se guarda en este navegador. Se ajusta el tamaño automáticamente.</p>'
      +   '</label>'
      +   '<div class="form-grid">'
      +     '<label><span>Marca</span><select name="brandSlug" required>'
      +       '<option value=""' + (p.brandSlug ? '' : ' selected') + ' disabled>Selecciona…</option>'
      +       Store.getBrands().map(function (b) {
            return '<option value="' + b.slug + '"' + ((p.brandSlug || '') === b.slug ? ' selected' : '') + '>' + escapeHtml(b.name) + '</option>';
          }).join('')
      +     '</select></label>'
      +     '<label><span>Modelo</span><input name="model" value="' + escapeHtml(p.model) + '" required></label>'
      +     '<label><span>Referencia (SKU)</span><input name="ref" value="' + escapeHtml(p.ref) + '" required></label>'
      +     '<label><span>Tono</span><select name="tone">'
      +       ['ink','cool','bronze','fog','steel','green'].map(function (t) {
            return '<option value="' + t + '"' + (p.tone === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('')
      +     '</select></label>'
      +     specSelect('mechanism', 'Mecanismo', Store.SPECS.mechanism, p.mechanism)
      +     specSelect('crystal', 'Cristal', Store.SPECS.crystal, p.crystal)
      +     specSelect('strap', 'Pulso', Store.SPECS.strap, p.strap)
      +     specSelect('gender', 'Género', Store.SPECS.gender, p.gender)
      +     '<label><span>Precio (COP)</span><input type="number" name="price" value="' + (p.price || 0) + '" required min="0" step="1000"></label>'
      +     '<label><span>Precio antes (0 = sin descuento)</span><input type="number" name="wasPrice" value="' + (p.wasPrice || 0) + '" min="0" step="1000"></label>'
      +     '<label><span>Precio mayorista (COP, vacío = usa el % general)</span><input type="number" name="wholesalePrice" value="' + (p.wholesalePrice || 0) + '" min="0" step="1000"></label>'
      +     '<label><span>Stock (texto)</span><input name="stock" value="' + escapeHtml(p.stock || '') + '"></label>'
      +     '<label><span>Estado stock</span><select name="stockStatus">'
      +       '<option value="in"' + ((p.stockStatus || 'in') === 'in' ? ' selected' : '') + '>Disponible</option>'
      +       '<option value="low"' + (p.stockStatus === 'low' ? ' selected' : '') + '>Bajo inventario</option>'
      +       '<option value="out"' + (p.stockStatus === 'out' ? ' selected' : '') + '>Agotado</option>'
      +     '</select></label>'
      +     '<label><span>Etiqueta (opcional)</span><input name="tagLabel" value="' + escapeHtml(p.tag ? p.tag.label : '') + '" placeholder="ej. Más vendido"></label>'
      +     '<label><span>Variants (colores hex separados por coma)</span><input name="variants" value="' + escapeHtml((p.variants || []).join(',')) + '" placeholder="#1d2026,#c9a86a"></label>'
      +   '</div>'
      +   discountFieldHtml('discount', 'Descuento solo para este producto', { active: p.discountActive, pct: p.discountPct })
      +   '<div class="modal-actions"><button type="button" class="btn-ghost cancel">Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div>'
      + '</form>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    bindDiscountFields(modal);

    // pendingImage: undefined = sin cambios (conserva la foto actual),
    // null = se quitó, string = foto nueva (data URL ya comprimida).
    var pendingImage;
    var photoInput = modal.querySelector('#photoInput');
    var photoPreview = modal.querySelector('#photoPreview');
    photoInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      resizeImageFile(file, 900, 0.82).then(function (dataUrl) {
        pendingImage = dataUrl;
        photoPreview.innerHTML = '<img src="' + dataUrl + '" alt="">';
      }).catch(function () { toast('No se pudo procesar la foto', 'danger'); });
    });
    var photoRemove = modal.querySelector('.photo-remove');
    if (photoRemove) photoRemove.addEventListener('click', function () {
      pendingImage = null;
      photoPreview.innerHTML = '<span class="admin-prod-ph">◷</span>';
      photoRemove.remove();
    });

    modal.querySelector('#productForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var selectedBrand = Store.getBrand(fd.get('brandSlug'));
      var data = {
        id: id || undefined,
        image: pendingImage !== undefined ? pendingImage : (p.image || null),
        brand: selectedBrand ? selectedBrand.name : fd.get('brandSlug'),
        brandSlug: fd.get('brandSlug'),
        model: fd.get('model'),
        ref: fd.get('ref'),
        tone: fd.get('tone'),
        mechanism: fd.get('mechanism'),
        crystal: fd.get('crystal'),
        strap: fd.get('strap'),
        gender: fd.get('gender'),
        price: Number(fd.get('price')),
        wasPrice: Number(fd.get('wasPrice')),
        wholesalePrice: Number(fd.get('wholesalePrice')) || 0,
        off: Number(fd.get('wasPrice')) > 0 ? Math.round((1 - Number(fd.get('price')) / Number(fd.get('wasPrice'))) * 100) : 0,
        stock: fd.get('stock'),
        stockStatus: fd.get('stockStatus'),
        tag: fd.get('tagLabel') ? { kind: 'special', label: fd.get('tagLabel') } : null,
        variants: String(fd.get('variants') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      };
      var pd = readDiscountField(fd, 'discount');
      data.discountActive = pd.active;
      data.discountPct = pd.pct;
      Store.saveProduct(Object.assign({}, p, data));
      toast(id ? 'Producto actualizado' : 'Producto creado', 'success');
      close();
      // Tras guardar, aterrizar en la carpeta de la marca del producto para ver el cambio.
      if (data.brand) catalogOpenBrand = data.brand;
      if (typeof onDone === 'function') onDone();
      else renderTab('catalogo', document.getElementById('tab-catalogo'));
    });
  }

  // ============== SUBASTAS ==============
  function renderSubastas(pane) {
    Store.autoCloseExpired();
    var auctions = Store.getAuctions();
    var sorted = auctions.slice().sort(function (a, b) {
      var order = { live: 0, scheduled: 1, closed: 2 };
      var oa = order[Store.getAuctionStatus(a)];
      var ob = order[Store.getAuctionStatus(b)];
      if (oa !== ob) return oa - ob;
      return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime();
    });

    pane.innerHTML = ''
      + '<div class="catalogo-head">'
      +   '<p class="page-desc">Crea subastas sobre productos del catálogo. Define precio inicial, reserva, duración y reglas de puja.</p>'
      +   '<button class="btn-primary" id="newAuction">+ Nueva subasta</button>'
      + '</div>'
      + '<div class="admin-table-wrap">'
      +   '<table class="admin-table" id="aucTable">'
      +     '<thead><tr><th></th><th>Producto</th><th>Puja actual</th><th>Pujas</th><th>Estado</th><th>Termina</th><th></th></tr></thead>'
      +     '<tbody></tbody>'
      +   '</table>'
      + '</div>';

    var tbody = pane.querySelector('#aucTable tbody');

    function aucThumb(p) {
      if (p && p.image) return '<td class="thumb-cell"><img class="admin-thumb" src="' + escapeHtml(p.image) + '" alt="" loading="lazy"></td>';
      return '<td class="thumb-cell"><span class="admin-thumb placeholder">◷</span></td>';
    }

    function draw() {
      if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Aún no has creado subastas.</td></tr>';
        return;
      }
      tbody.innerHTML = sorted.map(function (a) {
        var p = Store.getProduct(a.productId);
        var status = Store.getAuctionStatus(a);
        var bids = Store.getBidsForAuction(a.id).length;
        var ends = new Date(a.endsAt);
        var leader = a.currentBidderId ? Store.getUser(a.currentBidderId) : null;
        var leaderMeta = bids > 0
          ? '<div class="row-meta">Va ganando: ' + escapeHtml(leader ? leader.name : 'Postor') + '</div>'
          : '<div class="row-meta">Sin pujas aún</div>';
        return '<tr data-id="' + a.id + '">'
          + aucThumb(p)
          + '<td><strong>' + escapeHtml(p ? p.brand + ' · ' + p.model : '— producto eliminado') + '</strong><div class="row-meta">' + escapeHtml(p ? p.ref : '') + '</div></td>'
          + '<td class="mono accent">' + Store.formatCOP(a.currentBid) + leaderMeta + '</td>'
          + '<td class="mono">' + bids + '</td>'
          + '<td><span class="status-pill ' + status + '">' + status + '</span></td>'
          + '<td class="mono small">' + ends.toLocaleString('es-CO') + '</td>'
          + '<td class="actions">'
          +    '<button class="icon-action bids" title="Ver pujas">☰</button>'
          +    (status === 'live' ? '<button class="icon-action close" title="Cerrar ahora">■</button>' : '')
          +    '<button class="icon-action delete" title="Eliminar">×</button>'
          + '</td>'
          + '</tr>';
      }).join('');
    }
    draw();

    pane.querySelector('#newAuction').addEventListener('click', openAuctionModal);

    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      var id = tr.getAttribute('data-id');
      var a = Store.getAuction(id);
      if (!a) return;
      if (e.target.matches('.bids') || (!e.target.closest('.actions') && !e.target.closest('.thumb-cell'))) {
        openAuctionBidsModal(id);
        return;
      }
      if (e.target.matches('.close')) {
        if (confirmDialog('¿Cerrar la subasta ahora? El ganador será el último postor.')) {
          Store.closeAuction(id);
          toast('Subasta cerrada', 'success');
          renderTab('subastas', pane);
        }
      }
      if (e.target.matches('.delete')) {
        if (confirmDialog('¿Eliminar esta subasta? Se perderá el historial de pujas.')) {
          Store.updateAuction(id, { status: 'closed', closedAt: Store.now(), winnerId: null, _deleted: true });
          // soft delete: quitamos de la lista
          var all = Store.getAuctions().filter(function (x) { return x.id !== id; });
          localStorage.setItem('cronos:auctions', JSON.stringify(all));
          toast('Subasta eliminada', 'success');
          renderTab('subastas', pane);
        }
      }
    });
  }

  function openAuctionBidsModal(auctionId) {
    var a = Store.getAuction(auctionId);
    if (!a) return;
    var p = Store.getProduct(a.productId);
    var status = Store.getAuctionStatus(a);
    var bids = Store.getBidsForAuction(auctionId); // ya ordenadas por monto desc
    // Historial cronológico (más reciente primero) para "quién pujó y cuándo".
    var chrono = bids.slice().sort(function (x, y) { return new Date(y.at) - new Date(x.at); });

    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal' });

    var rowsHtml = chrono.length === 0
      ? '<tr><td colspan="4" class="empty-row">Aún no hay pujas en esta subasta.</td></tr>'
      : chrono.map(function (b, i) {
          var u = Store.getUser(b.userId);
          var isLeader = b.userId === a.currentBidderId && b.amount === a.currentBid;
          return '<tr>'
            + '<td class="mono">' + Store.formatCOP(b.amount) + (isLeader ? ' <span class="status-pill approved" style="margin-left:6px">líder</span>' : '') + '</td>'
            + '<td><strong>' + escapeHtml(u ? u.name : 'Postor') + '</strong><div class="row-meta">' + escapeHtml(u ? u.email : b.userId) + '</div></td>'
            + '<td class="mono small">' + new Date(b.at).toLocaleString('es-CO') + '</td>'
            + '</tr>';
        }).join('');

    modal.innerHTML = ''
      + '<div class="modal-head"><h3>Pujas · ' + escapeHtml(p ? p.brand + ' · ' + p.model : 'Subasta') + '</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<div class="req-card-meta" style="border:0;padding:0 0 16px">'
      +   '<div><span>Estado</span><strong><span class="status-pill ' + status + '">' + status + '</span></strong></div>'
      +   '<div><span>Puja actual</span><strong class="mono accent">' + Store.formatCOP(a.currentBid) + '</strong></div>'
      +   '<div><span>Total de pujas</span><strong>' + bids.length + '</strong></div>'
      +   '<div><span>Termina</span><strong class="mono small">' + new Date(a.endsAt).toLocaleString('es-CO') + '</strong></div>'
      + '</div>'
      + '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Puja</th><th>Postor</th><th>Cuándo</th></tr></thead>'
      +   '<tbody>' + rowsHtml + '</tbody></table></div>'
      + '<p class="form-hint" style="margin-top:14px">El postor debe tener cuenta para pujar, así que cada puja queda asociada a un nombre y correo verificables.</p>'
      + '<div class="modal-actions"><button type="button" class="btn-primary close-modal">Cerrar</button></div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);
    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.close-modal').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  function openAuctionModal() {
    var products = Store.getWatchProducts();
    var cfg = Store.getConfig();
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal auction-modal' });
    modal.innerHTML = ''
      + '<div class="modal-head"><h3>Nueva subasta</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<form id="auctionForm">'
      +   '<label class="block"><span>Producto</span>'
      +     '<select name="productId" required>'
      +       '<option value="">Selecciona un producto…</option>'
      +       products.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.brand + ' · ' + p.model + ' (' + p.ref + ')') + ' — ' + Store.formatCOP(p.price) + '</option>'; }).join('')
      +     '</select>'
      +   '</label>'
      +   '<div class="form-grid three">'
      +     '<label><span>Precio inicial (COP)</span><input type="number" name="startPrice" required min="1000" step="1000"></label>'
      +     '<label><span>Reserva (COP)</span><input type="number" name="reservePrice" min="0" step="1000"></label>'
      +     '<label><span>Duración (horas)</span><input type="number" name="durationHours" value="' + cfg.auctionDefaults.durationHours + '" required min="0.1" step="0.1"></label>'
      +     '<label><span>Incremento mín. (%)</span><input type="number" name="minIncrementPct" value="' + cfg.auctionDefaults.minIncrementPct + '" min="1" step="1"></label>'
      +     '<label><span>Anti-snipe (seg.)</span><input type="number" name="antiSnipeSeconds" value="' + cfg.auctionDefaults.antiSnipeSeconds + '" min="0" step="10"></label>'
      +     '<label><span>Extensión (seg.)</span><input type="number" name="extensionSeconds" value="' + cfg.auctionDefaults.extensionSeconds + '" min="0" step="10"></label>'
      +   '</div>'
      +   '<label class="block"><span>Inicia en (deja vacío para ahora)</span><input type="datetime-local" name="startsAt"></label>'
      +   '<p class="form-hint">Si configuras duración = 0 y fecha inicio en futuro, la subasta queda "programada" hasta esa fecha.</p>'
      +   '<div class="modal-actions"><button type="button" class="btn-ghost cancel">Cancelar</button><button type="submit" class="btn-primary">Crear subasta</button></div>'
      + '</form>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    // prefill precio inicial cuando se elige producto
    modal.querySelector('[name=productId]').addEventListener('change', function (e) {
      var p = Store.getProduct(e.target.value);
      if (p && !modal.querySelector('[name=startPrice]').value) modal.querySelector('[name=startPrice]').value = Math.round(p.price * 0.7 / 1000) * 1000;
    });

    modal.querySelector('#auctionForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var startsAt = fd.get('startsAt');
      Store.createAuction({
        productId: fd.get('productId'),
        startPrice: Number(fd.get('startPrice')),
        reservePrice: Number(fd.get('reservePrice')) || Number(fd.get('startPrice')),
        durationHours: Number(fd.get('durationHours')),
        minIncrementPct: Number(fd.get('minIncrementPct')),
        antiSnipeSeconds: Number(fd.get('antiSnipeSeconds')),
        extensionSeconds: Number(fd.get('extensionSeconds')),
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined
      });
      toast('Subasta creada', 'success');
      close();
      renderTab('subastas', document.getElementById('tab-subastas'));
    });
  }

  // ============== PEDIDOS ==============
  var ORDER_STATUS_CLASS = { pendiente: 'pending', contactado: 'scheduled', pagado: 'approved', rechazado: 'rejected', cancelado: 'closed' };
  var ORDER_STATUS_LABEL = { pendiente: 'Pendiente', contactado: 'Contactado', pagado: 'Pagado', rechazado: 'Rechazado', cancelado: 'Cancelado' };
  var PAYMENT_METHOD_LABEL = { wompi: 'Tarjeta / PSE (Wompi)', whatsapp: 'WhatsApp' };

  function renderPedidos(pane) {
    var orders = Store.getOrders();

    pane.innerHTML = ''
      + '<div class="catalogo-head"><p class="page-desc">Pedidos creados desde el checkout de la tienda. Los pagos con Wompi actualizan el estado automáticamente; los coordinados por WhatsApp hay que confirmarlos acá manualmente cuando se cierre el pago.</p></div>'
      + (orders.length === 0
        ? '<div class="empty-state"><h3>Sin pedidos todavía</h3><p>Cuando un cliente complete el checkout en la tienda, el pedido aparecerá acá.</p></div>'
        : '<div class="req-grid">' + orders.map(function (o) {
            var c = o.customer || {};
            return '<div class="req-card ' + (ORDER_STATUS_CLASS[o.status] || '') + '">'
              + '<div class="req-card-head">'
              +   '<div><strong>' + escapeHtml(c.name || 'Cliente sin nombre') + '</strong><span class="row-meta">' + escapeHtml(c.phone || '') + '</span></div>'
              +   '<span class="status-pill ' + (ORDER_STATUS_CLASS[o.status] || '') + '">' + (ORDER_STATUS_LABEL[o.status] || o.status) + '</span>'
              + '</div>'
              + '<div class="req-card-meta">'
              +   '<div><span>Referencia</span><strong class="mono">' + escapeHtml(o.reference) + '</strong></div>'
              +   '<div><span>Total</span><strong>' + Store.formatCOP(o.total) + '</strong></div>'
              +   '<div><span>Método</span><strong>' + (PAYMENT_METHOD_LABEL[o.paymentMethod] || '—') + '</strong></div>'
              +   '<div><span>Fecha</span><strong>' + new Date(o.createdAt).toLocaleString('es-CO') + '</strong></div>'
              + '</div>'
              + '<div class="req-card-meta">'
              +   '<div><span>Dirección</span><strong>' + escapeHtml((c.address || '—') + (c.city ? ' · ' + c.city : '')) + '</strong></div>'
              +   '<div><span>Artículos</span><strong>' + (o.items || []).map(function (it) { return escapeHtml(it.brand + ' ' + it.model + ' ×' + it.qty); }).join(', ') + '</strong></div>'
              + '</div>'
              + (c.notes ? '<div class="req-card-foot" style="background:var(--surface-2); color:var(--muted);">Notas del cliente: ' + escapeHtml(c.notes) + '</div>' : '')
              + '<div class="req-card-actions">'
              +   (o.status !== 'pagado' ? '<button class="btn-primary mark-paid" data-id="' + o.id + '">Marcar pagado</button>' : '')
              +   (o.status !== 'contactado' && o.status !== 'pagado' ? '<button class="btn-ghost mark-contacted" data-id="' + o.id + '">Marcar contactado</button>' : '')
              +   (o.status !== 'cancelado' && o.status !== 'pagado' ? '<button class="btn-ghost cancel-order" data-id="' + o.id + '">Cancelar</button>' : '')
              + '</div>'
              + '</div>';
          }).join('') + '</div>');

    pane.querySelectorAll('.mark-paid').forEach(function (b) {
      b.addEventListener('click', function () {
        Store.updateOrder(b.getAttribute('data-id'), { status: 'pagado' });
        toast('Pedido marcado como pagado', 'success');
        renderTab('pedidos', pane);
      });
    });
    pane.querySelectorAll('.mark-contacted').forEach(function (b) {
      b.addEventListener('click', function () {
        Store.updateOrder(b.getAttribute('data-id'), { status: 'contactado' });
        toast('Pedido marcado como contactado', 'info');
        renderTab('pedidos', pane);
      });
    });
    pane.querySelectorAll('.cancel-order').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirmDialog('¿Cancelar este pedido?')) return;
        Store.updateOrder(b.getAttribute('data-id'), { status: 'cancelado' });
        toast('Pedido cancelado', 'info');
        renderTab('pedidos', pane);
      });
    });
  }

  // ============== MAYORISTAS ==============
  function renderMayoristas(pane) {
    var reqs = Store.getWholesaleRequests().slice().sort(function (a, b) {
      var order = { pending: 0, approved: 1, rejected: 2 };
      var oa = order[a.status] || 9;
      var ob = order[b.status] || 9;
      if (oa !== ob) return oa - ob;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    pane.innerHTML = ''
      + '<div class="catalogo-head"><p class="page-desc">Revisa y aprueba las solicitudes de cuenta mayorista. Al aprobar, el usuario pasa a ver precios especiales en el catálogo.</p></div>'
      + (reqs.length === 0
        ? '<div class="empty-state"><h3>Sin solicitudes aún</h3><p>Cuando alguien llene el formulario en <a href="mayorista.html">mayorista.html</a>, aparecerá acá.</p></div>'
        : '<div class="req-grid">' + reqs.map(function (r) {
            var u = Store.getUser(r.userId);
            var bd = r.businessData || {};
            return '<div class="req-card ' + r.status + '">'
              + '<div class="req-card-head">'
              +   '<div><strong>' + escapeHtml(u ? u.name : '—') + '</strong><span class="row-meta">' + escapeHtml(u ? u.email : '') + '</span></div>'
              +   '<span class="status-pill ' + r.status + '">' + r.status + '</span>'
              + '</div>'
              + '<div class="req-card-meta">'
              +   '<div><span>Empresa</span><strong>' + escapeHtml(bd.company || '—') + '</strong></div>'
              +   '<div><span>NIT</span><strong class="mono">' + escapeHtml(bd.taxId || '—') + '</strong></div>'
              +   '<div><span>Ciudad</span><strong>' + escapeHtml(bd.city || '—') + '</strong></div>'
              +   '<div><span>Ref</span><strong class="mono">' + escapeHtml(r.reference) + '</strong></div>'
              + '</div>'
              + (r.status === 'pending'
                  ? '<div class="req-card-actions">'
                  +     '<label class="temp-pwd"><span>Contraseña temporal</span><input type="text" class="temp-pwd-input" placeholder="ej. cronos2024" data-id="' + r.id + '"></label>'
                  +     '<button class="btn-primary approve" data-id="' + r.id + '">Aprobar</button>'
                  +     '<button class="btn-ghost reject" data-id="' + r.id + '">Rechazar</button>'
                  +   '</div>'
                  : (r.status === 'approved' ? '<div class="req-card-foot success">Aprobada · ' + new Date(r.reviewedAt).toLocaleDateString('es-CO') + '</div>'
                                            : '<div class="req-card-foot danger">Rechazada' + (r.rejectReason ? ' · ' + escapeHtml(r.rejectReason) : '') + '</div>')
                )
              + '</div>';
          }).join('') + '</div>');

    pane.querySelectorAll('.approve').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        var pwdInput = pane.querySelector('.temp-pwd-input[data-id="' + id + '"]');
        var pwd = pwdInput && pwdInput.value ? pwdInput.value.trim() : null;
        if (!pwd || pwd.length < 6) { toast('Define una contraseña temporal (mín. 6 caracteres)', 'danger'); return; }
        Store.approveWholesale(id, pwd);
        toast('Solicitud aprobada · contraseña: ' + pwd, 'success');
        renderTab('mayoristas', pane);
      });
    });
    pane.querySelectorAll('.reject').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        var reason = prompt('Motivo del rechazo (opcional):') || '';
        Store.rejectWholesale(id, reason);
        toast('Solicitud rechazada', 'info');
        renderTab('mayoristas', pane);
      });
    });
  }

  // ============== USUARIOS ==============
  function renderUsuarios(pane) {
    var users = Store.getUsers();
    pane.innerHTML = ''
      + '<div class="admin-table-wrap">'
      +   '<table class="admin-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th></tr></thead><tbody>'
      +     users.map(function (u) {
          return '<tr data-id="' + u.id + '">'
            + '<td><strong>' + escapeHtml(u.name) + '</strong></td>'
            + '<td class="mono small">' + escapeHtml(u.email) + '</td>'
            + '<td><select class="role-select" data-id="' + u.id + '">'
            +   ['admin', 'wholesale', 'retail'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('')
            + '</select></td>'
            + '<td><span class="status-pill ' + u.status + '">' + u.status + '</span></td>'
            + '<td class="mono small">' + new Date(u.createdAt).toLocaleDateString('es-CO') + '</td>'
            + '</tr>';
        }).join('')
      +   '</tbody></table>'
      + '</div>';

    pane.querySelectorAll('.role-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        Store.setUserRole(sel.getAttribute('data-id'), sel.value);
        toast('Rol actualizado', 'success');
      });
    });
  }

  // ============== CONFIGURACIÓN ==============
  function renderConfig(pane) {
    var cfg = Store.getConfig();
    var discounts = Store.getDiscounts();
    pane.innerHTML = ''
      + '<form id="configForm" class="config-form">'
      +   '<fieldset><legend>General</legend>'
      +     '<label><span>Nombre del sitio</span><input name="siteName" value="' + escapeHtml(cfg.siteName) + '"></label>'
      +     '<label><span>Tagline</span><input name="tagline" value="' + escapeHtml(cfg.tagline) + '"></label>'
      +   '</fieldset>'
      +   '<fieldset><legend>Descuento general</legend>'
      +     '<p class="form-hint">Aplica a todo el catálogo (relojes y accesorios). Si un producto o su categoría ya tienen su propio descuento activo, ese gana sobre este.</p>'
      +     discountFieldHtml('discount', 'Descuento sobre toda la página', discounts.global)
      +   '</fieldset>'
      +   '<fieldset><legend>Mayorista</legend>'
      +     '<label><span>Descuento mayorista (%)</span><input type="number" name="wholesaleDiscountPct" value="' + cfg.wholesaleDiscountPct + '" min="0" max="80" step="1"></label>'
      +     '<label><span>Cantidad mínima por orden</span><input type="number" name="wholesaleMinQty" value="' + cfg.wholesaleMinQty + '" min="1" step="1"></label>'
      +   '</fieldset>'
      +   '<fieldset><legend>Pagos (checkout)</legend>'
      +     '<label class="block"><span>Número de WhatsApp para pedidos</span><input name="whatsappNumber" placeholder="Ej. 573001234567 (con indicativo de país, sin + ni espacios)" value="' + escapeHtml(cfg.payments.whatsappNumber) + '"></label>'
      +     '<label class="block"><span>Llave pública de Wompi</span><input name="wompiPublicKey" placeholder="pub_test_xxxxxxxxxxxx o pub_prod_xxxxxxxxxxxx" value="' + escapeHtml(cfg.payments.wompiPublicKey) + '"></label>'
      +     '<label class="block"><span>Secreto de integridad de Wompi (opcional)</span><input name="wompiIntegritySecret" placeholder="Solo si tu cuenta de Wompi exige firma de integridad" value="' + escapeHtml(cfg.payments.wompiIntegritySecret || '') + '"></label>'
      +     '<p class="form-hint">Mientras estos campos estén vacíos, el checkout muestra esas opciones de pago como "pendientes de activación" en vez de simular que funcionan. La llave pública y el secreto de integridad están juntos en el panel de comercio de Wompi (Desarrolladores → Llaves API); usa la llave que empieza en <code>pub_test_</code> para probar y la de <code>pub_prod_</code> cuando esté lista para cobrar de verdad. Si al pagar Wompi muestra el error "Firma de integridad requerida no enviada", pega aquí el secreto de integridad (no la llave privada).</p>'
      +   '</fieldset>'
      +   '<fieldset><legend>Subastas (valores por defecto)</legend>'
      +     '<div class="form-grid">'
      +       '<label><span>Duración (horas)</span><input type="number" name="durationHours" value="' + cfg.auctionDefaults.durationHours + '" min="0.1" step="0.1"></label>'
      +       '<label><span>Incremento mín. (%)</span><input type="number" name="minIncrementPct" value="' + cfg.auctionDefaults.minIncrementPct + '" min="1" step="1"></label>'
      +       '<label><span>Anti-snipe (seg.)</span><input type="number" name="antiSnipeSeconds" value="' + cfg.auctionDefaults.antiSnipeSeconds + '" min="0" step="10"></label>'
      +       '<label><span>Extensión (seg.)</span><input type="number" name="extensionSeconds" value="' + cfg.auctionDefaults.extensionSeconds + '" min="0" step="10"></label>'
      +     '</div>'
      +   '</fieldset>'
      +   '<fieldset><legend>Hero (landing)</legend>'
      +     '<label class="block"><span>Título (admite HTML)</span><textarea name="heroTitle" rows="2">' + escapeHtml(cfg.hero.title) + '</textarea></label>'
      +     '<label class="block"><span>Lead</span><textarea name="heroLead" rows="3">' + escapeHtml(cfg.hero.lead) + '</textarea></label>'
      +     '<div class="form-grid">'
      +       '<label><span>CTA primario · texto</span><input name="heroCtaPrimaryLabel" value="' + escapeHtml(cfg.hero.ctaPrimary.label) + '"></label>'
      +       '<label><span>CTA primario · URL</span><input name="heroCtaPrimaryHref" value="' + escapeHtml(cfg.hero.ctaPrimary.href) + '"></label>'
      +       '<label><span>CTA secundario · texto</span><input name="heroCtaSecondaryLabel" value="' + escapeHtml(cfg.hero.ctaSecondary.label) + '"></label>'
      +       '<label><span>CTA secundario · URL</span><input name="heroCtaSecondaryHref" value="' + escapeHtml(cfg.hero.ctaSecondary.href) + '"></label>'
      +     '</div>'
      +   '</fieldset>'
      +   '<div class="form-actions"><button type="submit" class="btn-primary">Guardar configuración</button></div>'
      + '</form>';

    pane.querySelector('#configForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      Store.saveConfig({
        siteName: fd.get('siteName'),
        tagline: fd.get('tagline'),
        wholesaleDiscountPct: Number(fd.get('wholesaleDiscountPct')),
        wholesaleMinQty: Number(fd.get('wholesaleMinQty')),
        payments: {
          whatsappNumber: (fd.get('whatsappNumber') || '').trim(),
          wompiPublicKey: (fd.get('wompiPublicKey') || '').trim(),
          wompiIntegritySecret: (fd.get('wompiIntegritySecret') || '').trim()
        },
        auctionDefaults: {
          durationHours: Number(fd.get('durationHours')),
          minIncrementPct: Number(fd.get('minIncrementPct')),
          antiSnipeSeconds: Number(fd.get('antiSnipeSeconds')),
          extensionSeconds: Number(fd.get('extensionSeconds'))
        },
        hero: {
          title: fd.get('heroTitle'),
          lead: fd.get('heroLead'),
          ctaPrimary: { label: fd.get('heroCtaPrimaryLabel'), href: fd.get('heroCtaPrimaryHref') },
          ctaSecondary: { label: fd.get('heroCtaSecondaryLabel'), href: fd.get('heroCtaSecondaryHref') }
        }
      });
      var gd = readDiscountField(fd, 'discount');
      Store.setGlobalDiscount(gd.active, gd.pct);
      toast('Configuración guardada', 'success');
    });
    bindDiscountFields(pane);
  }

  // ============== INIT ==============
  function init() {
    if (!Auth.requireAdmin()) return;
    document.querySelectorAll('.nav-item[data-tab], .mobile-admin-tab[data-tab]').forEach(function (n) {
      n.addEventListener('click', function (e) { e.preventDefault(); go(n.getAttribute('data-tab')); });
    });
    var viewSite = document.getElementById('viewSite');
    if (viewSite) viewSite.addEventListener('click', function (e) { e.preventDefault(); window.open('index.html', '_blank'); });
    go('dashboard');
    // refrescar dashboard cada 30s
    setInterval(function () {
      if (currentTab === 'dashboard') {
        Store.autoCloseExpired();
        renderTab('dashboard', document.getElementById('tab-dashboard'));
      }
    }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
