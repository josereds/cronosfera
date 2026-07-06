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
    subastas: 'Subastas',
    mayoristas: 'Solicitudes mayoristas',
    usuarios: 'Usuarios',
    config: 'Configuración'
  };

  function renderTab(tab, pane) {
    pane.innerHTML = '';
    ({ dashboard: renderDashboardV2, catalogo: renderCatalogo, subastas: renderSubastas, mayoristas: renderMayoristas, usuarios: renderUsuarios, config: renderConfig })[tab](pane);
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
  function renderCatalogo(pane) {
    pane.innerHTML = ''
      + '<div class="catalogo-head">'
      +   '<div class="catalogo-search">'
      +     '<input type="search" id="prodSearch" placeholder="Buscar por nombre, referencia…">'
      +   '</div>'
      +   '<button class="btn-primary" id="newProduct">+ Nuevo producto</button>'
      + '</div>'
      + '<div class="admin-table-wrap">'
      +   '<table class="admin-table" id="prodTable">'
      +     '<thead><tr><th>Ref</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Mayorista</th><th></th></tr></thead>'
      +     '<tbody></tbody>'
      +   '</table>'
      + '</div>';

    var tbody = pane.querySelector('#prodTable tbody');

    function draw(filter) {
      var products = Store.getProducts();
      filter = (filter || '').toLowerCase();
      var list = products.filter(function (p) {
        if (!filter) return true;
        return (p.model + ' ' + p.brand + ' ' + p.ref).toLowerCase().indexOf(filter) >= 0;
      });
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No se encontraron productos.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(function (p) {
        var w = Store.wholesalePriceFor(p);
        return '<tr data-id="' + p.id + '">'
          + '<td class="mono small">' + escapeHtml(p.ref) + '</td>'
          + '<td><strong>' + escapeHtml(p.model) + '</strong><div class="row-meta">' + escapeHtml(p.brand) + '</div></td>'
          + '<td class="mono">' + Store.formatCOP(p.price) + '</td>'
          + '<td><span class="stock-pill ' + (p.stockStatus || 'in') + '">' + escapeHtml(p.stock || '—') + '</span></td>'
          + '<td class="mono accent">' + Store.formatCOP(w) + '</td>'
          + '<td class="actions"><button class="icon-action edit" title="Editar">✎</button><button class="icon-action delete" title="Eliminar">×</button></td>'
          + '</tr>';
      }).join('');
    }

    draw('');
    pane.querySelector('#prodSearch').addEventListener('input', function (e) { draw(e.target.value); });
    pane.querySelector('#newProduct').addEventListener('click', function () { openProductModal(null); });

    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      var id = tr.getAttribute('data-id');
      if (e.target.matches('.edit')) openProductModal(id);
      if (e.target.matches('.delete')) {
        var p = Store.getProduct(id);
        if (confirmDialog('¿Eliminar "' + (p ? p.model : '') + '"? Esta acción no se puede deshacer.')) {
          Store.deleteProduct(id);
          toast('Producto eliminado', 'success');
          draw(pane.querySelector('#prodSearch').value);
        }
      }
    });
  }

  function openProductModal(id) {
    var p = id ? Store.getProduct(id) : { brand: 'Cronosfera', model: '', ref: '', price: 0, wasPrice: 0, off: 0, tone: 'ink', tag: null, stock: 'Disponible', stockStatus: 'in', variants: ['#1d2026'] };
    var overlay = el('div', { class: 'modal-overlay' });
    var modal = el('div', { class: 'modal product-modal' });
    modal.innerHTML = ''
      + '<div class="modal-head"><h3>' + (id ? 'Editar producto' : 'Nuevo producto') + '</h3><button class="modal-close" aria-label="Cerrar">×</button></div>'
      + '<form id="productForm">'
      +   '<div class="form-grid">'
      +     '<label><span>Marca</span><input name="brand" value="' + escapeHtml(p.brand) + '" required></label>'
      +     '<label><span>Modelo</span><input name="model" value="' + escapeHtml(p.model) + '" required></label>'
      +     '<label><span>Referencia (SKU)</span><input name="ref" value="' + escapeHtml(p.ref) + '" required></label>'
      +     '<label><span>Tono</span><select name="tone">'
      +       ['ink','cool','bronze','fog','steel','green'].map(function (t) {
            return '<option value="' + t + '"' + (p.tone === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('')
      +     '</select></label>'
      +     '<label><span>Precio (COP)</span><input type="number" name="price" value="' + (p.price || 0) + '" required min="0" step="1000"></label>'
      +     '<label><span>Precio antes (0 = sin descuento)</span><input type="number" name="wasPrice" value="' + (p.wasPrice || 0) + '" min="0" step="1000"></label>'
      +     '<label><span>Stock (texto)</span><input name="stock" value="' + escapeHtml(p.stock || '') + '"></label>'
      +     '<label><span>Estado stock</span><select name="stockStatus">'
      +       '<option value="in"' + ((p.stockStatus || 'in') === 'in' ? ' selected' : '') + '>Disponible</option>'
      +       '<option value="low"' + (p.stockStatus === 'low' ? ' selected' : '') + '>Bajo inventario</option>'
      +       '<option value="out"' + (p.stockStatus === 'out' ? ' selected' : '') + '>Agotado</option>'
      +     '</select></label>'
      +     '<label><span>Etiqueta (opcional)</span><input name="tagLabel" value="' + escapeHtml(p.tag ? p.tag.label : '') + '" placeholder="ej. Más vendido"></label>'
      +     '<label><span>Variants (colores hex separados por coma)</span><input name="variants" value="' + escapeHtml((p.variants || []).join(',')) + '" placeholder="#1d2026,#c9a86a"></label>'
      +   '</div>'
      +   '<div class="modal-actions"><button type="button" class="btn-ghost cancel">Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div>'
      + '</form>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('in'); }, 10);

    function close() { overlay.classList.remove('in'); setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    modal.querySelector('#productForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var data = {
        id: id || undefined,
        brand: fd.get('brand'),
        model: fd.get('model'),
        ref: fd.get('ref'),
        tone: fd.get('tone'),
        price: Number(fd.get('price')),
        wasPrice: Number(fd.get('wasPrice')),
        off: Number(fd.get('wasPrice')) > 0 ? Math.round((1 - Number(fd.get('price')) / Number(fd.get('wasPrice'))) * 100) : 0,
        stock: fd.get('stock'),
        stockStatus: fd.get('stockStatus'),
        tag: fd.get('tagLabel') ? { kind: 'special', label: fd.get('tagLabel') } : null,
        variants: String(fd.get('variants') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      };
      Store.saveProduct(Object.assign({}, p, data));
      toast(id ? 'Producto actualizado' : 'Producto creado', 'success');
      close();
      renderTab('catalogo', document.getElementById('tab-catalogo'));
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
      +     '<thead><tr><th>Producto</th><th>Puja actual</th><th>Pujas</th><th>Estado</th><th>Termina</th><th></th></tr></thead>'
      +     '<tbody></tbody>'
      +   '</table>'
      + '</div>';

    var tbody = pane.querySelector('#aucTable tbody');

    function draw() {
      if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Aún no has creado subastas.</td></tr>';
        return;
      }
      tbody.innerHTML = sorted.map(function (a) {
        var p = Store.getProduct(a.productId);
        var status = Store.getAuctionStatus(a);
        var bids = Store.getBidsForAuction(a.id).length;
        var ends = new Date(a.endsAt);
        return '<tr data-id="' + a.id + '">'
          + '<td><strong>' + escapeHtml(p ? p.model : '— producto eliminado') + '</strong><div class="row-meta">' + escapeHtml(p ? p.ref : '') + '</div></td>'
          + '<td class="mono accent">' + Store.formatCOP(a.currentBid) + '</td>'
          + '<td class="mono">' + bids + '</td>'
          + '<td><span class="status-pill ' + status + '">' + status + '</span></td>'
          + '<td class="mono small">' + ends.toLocaleString('es-CO') + '</td>'
          + '<td class="actions">'
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

  function openAuctionModal() {
    var products = Store.getProducts();
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
    pane.innerHTML = ''
      + '<form id="configForm" class="config-form">'
      +   '<fieldset><legend>General</legend>'
      +     '<label><span>Nombre del sitio</span><input name="siteName" value="' + escapeHtml(cfg.siteName) + '"></label>'
      +     '<label><span>Tagline</span><input name="tagline" value="' + escapeHtml(cfg.tagline) + '"></label>'
      +   '</fieldset>'
      +   '<fieldset><legend>Mayorista</legend>'
      +     '<label><span>Descuento mayorista (%)</span><input type="number" name="wholesaleDiscountPct" value="' + cfg.wholesaleDiscountPct + '" min="0" max="80" step="1"></label>'
      +     '<label><span>Cantidad mínima por orden</span><input type="number" name="wholesaleMinQty" value="' + cfg.wholesaleMinQty + '" min="1" step="1"></label>'
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
      toast('Configuración guardada', 'success');
    });
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
