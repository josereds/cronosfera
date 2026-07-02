/* ============================================================
   Cronosfera · Capa de datos abstracta
   ------------------------------------------------------------
   Hoy: persistencia en localStorage (demo single-navegador).
   Mañana: misma API respaldada por Supabase. Los componentes
   y los scripts inline no se tocan en la migración.
   ============================================================ */
(function (global) {
  'use strict';

  var NS = {
    products: 'cronos:products',
    auctions: 'cronos:auctions',
    bids: 'cronos:bids',
    users: 'cronos:users',
    session: 'cronos:session',
    requests: 'cronos:wholesale-requests',
    config: 'cronos:config',
    counters: 'cronos:counters'
  };

  var subscribers = [];
  var emitScheduled = false;

  // ---------- utilidades internas ----------

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[Store] fallo leyendo', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[Store] fallo escribiendo', key, e);
    }
    scheduleEmit();
  }

  function scheduleEmit() {
    if (emitScheduled) return;
    emitScheduled = true;
    setTimeout(function () {
      emitScheduled = false;
      subscribers.forEach(function (fn) {
        try { fn(); } catch (e) { console.error('[Store] subscriber error', e); }
      });
    }, 0);
  }

  function uid(prefix) {
    var c = read(NS.counters, {});
    c[prefix] = (c[prefix] || 0) + 1;
    write(NS.counters, c);
    var n = String(c[prefix]).padStart(4, '0');
    return prefix + '-' + n + '-' + Date.now().toString(36).slice(-4);
  }

  function hash(s) {
    // Hash no criptográfico (demo). Reemplazar por Supabase Auth en producción.
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }

  function nowIso() { return new Date().toISOString(); }

  function find(arr, pred) {
    for (var i = 0; i < arr.length; i++) if (pred(arr[i], i)) return arr[i];
    return null;
  }

  // ---------- seed inicial ----------

  var SEED_PRODUCTS = [
    { brand: 'Cronosfera', model: 'Aurora 39 · Acero', ref: 'CR-AU-39-ABL', price: 1299000, wasPrice: 1599000, off: 19, tone: 'ink', tag: { kind: 'best', label: 'Más vendido' }, stock: 'Disponible', stockStatus: 'in', variants: ['#1d2026', '#c9a86a', '#7a7468'] },
    { brand: 'Cronosfera', model: 'Atlas Sport · 42mm', ref: 'CR-AT-42-SBL', price: 1840000, wasPrice: 0, off: 0, tone: 'cool', tag: { kind: 'new', label: 'Nuevo' }, stock: 'Disponible', stockStatus: 'in', variants: ['#323a42', '#2c261c'] },
    { brand: 'Cronosfera', model: 'Heritage Bronze', ref: 'CR-HE-40-BNL', price: 2690000, wasPrice: 2990000, off: 10, tone: 'bronze', tag: { kind: 'special', label: 'Edición especial' }, stock: 'Bajo inventario · 4 un.', stockStatus: 'low', variants: ['#6a5340', '#3a342a'] },
    { brand: 'Cronosfera', model: 'Lumen Oro', ref: 'CR-LU-39-GBL', price: 3450000, wasPrice: 0, off: 0, tone: 'bronze', tag: { kind: 'new', label: 'Nuevo' }, stock: 'Disponible', stockStatus: 'in', variants: ['#c9a86a', '#1d2026', '#5a4632'] },
    { brand: 'Cronosfera', model: 'Nimbus Smart', ref: 'CR-NI-44-KBL', price: 949000, wasPrice: 1099000, off: 14, tone: 'ink', tag: null, stock: 'Disponible', stockStatus: 'in', variants: ['#1c1e22', '#7a7468'] },
    { brand: 'Cronosfera', model: 'Meridian Clásico', ref: 'CR-ME-40-SCL', price: 1499000, wasPrice: 0, off: 0, tone: 'steel', tag: { kind: 'best', label: 'Más vendido' }, stock: 'Disponible', stockStatus: 'in', variants: ['#a8a298', '#1d2026', '#c9a86a'] },
    { brand: 'Cronosfera', model: 'Selva Verde 39', ref: 'CR-SV-39-GSL', price: 1990000, wasPrice: 2299000, off: 13, tone: 'green', tag: { kind: 'special', label: 'Edición especial' }, stock: 'Bajo inventario · 2 un.', stockStatus: 'low', variants: ['#344a3a', '#1d2026'] },
    { brand: 'Cronosfera', model: 'Aurora Mujer 33', ref: 'CR-AM-33-RSL', price: 1149000, wasPrice: 0, off: 0, tone: 'fog', tag: { kind: 'new', label: 'Nuevo' }, stock: 'Disponible', stockStatus: 'in', variants: ['#dcd6cc', '#c9a86a', '#5a544a'] },
    { brand: 'Cronosfera', model: 'Eclipse Negro', ref: 'CR-EC-41-KBL', price: 2199000, wasPrice: 0, off: 0, tone: 'ink', tag: null, stock: 'Disponible', stockStatus: 'in', variants: ['#1d2026', '#5a5853'] },
    { brand: 'Cronosfera', model: 'Cumbre Andes 45', ref: 'CR-CU-45-BBL', price: 2890000, wasPrice: 3290000, off: 12, tone: 'cool', tag: { kind: 'best', label: 'Más vendido' }, stock: 'Disponible', stockStatus: 'in', variants: ['#323a42', '#1d2026'] },
    { brand: 'Cronosfera', model: 'Aurora Oro Rosa', ref: 'CR-AU-39-RGL', price: 2349000, wasPrice: 0, off: 0, tone: 'bronze', tag: null, stock: 'Disponible', stockStatus: 'in', variants: ['#c9a86a', '#1d2026'] },
    { brand: 'Cronosfera', model: 'Vega Smart Active', ref: 'CR-VG-44-KSL', price: 1290000, wasPrice: 1499000, off: 14, tone: 'ink', tag: { kind: 'new', label: 'Nuevo' }, stock: 'Agotado', stockStatus: 'out', variants: ['#1c1e22', '#7a7468'] }
  ];

  var DEFAULT_CONFIG = {
    siteName: 'Cronosfera',
    tagline: 'El tiempo también define quién eres.',
    wholesaleDiscountPct: 22,
    wholesaleMinQty: 6,
    auctionDefaults: {
      durationHours: 24,
      minIncrementPct: 5,
      antiSnipeSeconds: 60,
      extensionSeconds: 120
    },
    hero: {
      eyebrow: 'Marketplace de relojería · Colombia',
      title: 'El tiempo también<br>define <em>quién eres.</em>',
      lead: 'Descubre relojes originales seleccionados por su diseño, precisión y carácter. Piezas verificadas, envíos a toda Colombia y atención antes y después de la compra.',
      ctaPrimary: { label: 'Explorar relojes', href: 'catalogo.html' },
      ctaSecondary: { label: 'Ver subastas en vivo', href: 'subastas.html' }
    }
  };

  function ensureSeed() {
    if (!read(NS.products, null)) {
      write(NS.products, SEED_PRODUCTS.map(function (p) {
        return Object.assign({ id: uid('P') }, p, { createdAt: nowIso() });
      }));
    }
    if (!read(NS.users, null)) {
      write(NS.users, [{
        id: uid('U'),
        name: 'Daniela Restrepo',
        email: 'admin@cronosfera.co',
        passwordHash: hash('admin'),
        role: 'admin',
        status: 'active',
        createdAt: nowIso()
      }]);
    }
    if (!read(NS.config, null)) write(NS.config, DEFAULT_CONFIG);
    if (!read(NS.auctions, null)) write(NS.auctions, []);
    if (!read(NS.bids, null)) write(NS.bids, []);
    if (!read(NS.requests, null)) write(NS.requests, []);
  }

  // ---------- productos ----------

  function getProducts() { return read(NS.products, []); }
  function getProduct(id) { return find(getProducts(), function (p) { return p.id === id; }) || null; }
  function getProductByRef(ref) { return find(getProducts(), function (p) { return p.ref === ref; }) || null; }

  function saveProduct(p) {
    var list = getProducts();
    if (!p.id) p.id = uid('P');
    var idx = list.findIndex(function (x) { return x.id === p.id; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], p);
    else { p.createdAt = nowIso(); list.push(p); }
    write(NS.products, list);
    return p;
  }

  function deleteProduct(id) {
    write(NS.products, getProducts().filter(function (p) { return p.id !== id; }));
  }

  function wholesalePriceFor(p) {
    var cfg = getConfig();
    if (p.wholesalePrice && p.wholesalePrice > 0) return p.wholesalePrice;
    var pct = (cfg.wholesaleDiscountPct || 0) / 100;
    return Math.round(p.price * (1 - pct));
  }

  // ---------- usuarios / auth ----------

  function getUsers() { return read(NS.users, []); }
  function getUser(id) { return find(getUsers(), function (u) { return u.id === id; }) || null; }
  function getUserByEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    return find(getUsers(), function (u) { return (u.email || '').toLowerCase() === e; }) || null;
  }

  function register(data) {
    if (!data.email || !data.password) throw new Error('Faltan email o contraseña');
    if (getUserByEmail(data.email)) throw new Error('Ya existe una cuenta con ese correo');
    var user = {
      id: uid('U'),
      name: data.name || data.email.split('@')[0],
      email: data.email.trim().toLowerCase(),
      passwordHash: hash(data.password),
      role: data.role || 'retail',
      status: data.status || (data.role === 'wholesale' ? 'pending' : 'active'),
      company: data.company || null,
      taxId: data.taxId || null,
      phone: data.phone || null,
      city: data.city || null,
      createdAt: nowIso()
    };
    var list = getUsers();
    list.push(user);
    write(NS.users, list);

    if (data.role === 'wholesale') {
      var reqs = getWholesaleRequests();
      reqs.push({
        id: uid('WR'),
        userId: user.id,
        reference: 'CR-MA-' + new Date().getFullYear() + '-' + String(reqs.length + 1).padStart(4, '0'),
        businessData: {
          company: data.company,
          taxId: data.taxId,
          phone: data.phone,
          city: data.city,
          channel: data.channel,
          message: data.message
        },
        status: 'pending',
        createdAt: nowIso()
      });
      write(NS.requests, reqs);
    }
    return user;
  }

  function login(email, password) {
    var user = getUserByEmail(email);
    if (!user) throw new Error('No existe cuenta con ese correo');
    if (user.passwordHash !== hash(password)) throw new Error('Contraseña incorrecta');
    if (user.status === 'pending') throw new Error('Tu cuenta está pendiente de aprobación manual');
    if (user.status === 'rejected') throw new Error('Tu solicitud mayorista fue rechazada. Contáctanos para más información');
    if (user.status === 'suspended') throw new Error('Tu cuenta está suspendida');
    write(NS.session, { userId: user.id, at: nowIso() });
    return user;
  }

  function logout() { localStorage.removeItem(NS.session); scheduleEmit(); }

  function currentUser() {
    var s = read(NS.session, null);
    if (!s) return null;
    return getUser(s.userId) || null;
  }

  function setUserRole(id, role) {
    var list = getUsers();
    var u = find(list, function (x) { return x.id === id; });
    if (!u) return;
    u.role = role;
    write(NS.users, list);
  }

  function setUserStatus(id, status) {
    var list = getUsers();
    var u = find(list, function (x) { return x.id === id; });
    if (!u) return;
    u.status = status;
    write(NS.users, list);
  }

  // ---------- solicitudes mayoristas ----------

  function getWholesaleRequests() { return read(NS.requests, []); }

  function approveWholesale(id, tempPassword) {
    var reqs = getWholesaleRequests();
    var r = find(reqs, function (x) { return x.id === id; });
    if (!r) return null;
    r.status = 'approved';
    r.reviewedAt = nowIso();
    write(NS.requests, reqs);
    setUserStatus(r.userId, 'active');
    setUserRole(r.userId, 'wholesale');
    if (tempPassword) {
      var list = getUsers();
      var u = find(list, function (x) { return x.id === r.userId; });
      if (u) { u.passwordHash = hash(tempPassword); write(NS.users, list); }
    }
    return r;
  }

  function rejectWholesale(id, reason) {
    var reqs = getWholesaleRequests();
    var r = find(reqs, function (x) { return x.id === id; });
    if (!r) return null;
    r.status = 'rejected';
    r.reviewedAt = nowIso();
    r.rejectReason = reason || null;
    write(NS.requests, reqs);
    setUserStatus(r.userId, 'rejected');
    return r;
  }

  // ---------- subastas ----------

  function getAuctions() { return read(NS.auctions, []); }
  function getAuction(id) { return find(getAuctions(), function (a) { return a.id === id; }) || null; }

  function getAuctionStatus(a) {
    if (!a) return 'closed';
    var now = Date.now();
    if (a.status === 'closed' || a.closedAt) return 'closed';
    if (now < new Date(a.startsAt).getTime()) return 'scheduled';
    if (now >= new Date(a.endsAt).getTime()) return 'closed';
    return 'live';
  }

  function createAuction(data) {
    var cfg = getConfig();
    var ad = cfg.auctionDefaults || {};
    var durationMs = (data.durationHours != null ? data.durationHours : ad.durationHours) * 3600 * 1000;
    var startsAt = data.startsAt || nowIso();
    var endsAt = new Date(new Date(startsAt).getTime() + durationMs).toISOString();
    var auction = {
      id: uid('A'),
      productId: data.productId,
      startPrice: data.startPrice,
      currentBid: data.startPrice,
      currentBidderId: null,
      reservePrice: data.reservePrice || data.startPrice,
      minIncrementPct: data.minIncrementPct || ad.minIncrementPct || 5,
      antiSnipeSeconds: data.antiSnipeSeconds != null ? data.antiSnipeSeconds : ad.antiSnipeSeconds,
      extensionSeconds: data.extensionSeconds != null ? data.extensionSeconds : ad.extensionSeconds,
      startsAt: startsAt,
      endsAt: endsAt,
      status: 'scheduled',
      createdAt: nowIso(),
      closedAt: null,
      winnerId: null
    };
    var list = getAuctions();
    list.push(auction);
    write(NS.auctions, list);
    return auction;
  }

  function updateAuction(id, patch) {
    var list = getAuctions();
    var a = find(list, function (x) { return x.id === id; });
    if (!a) return null;
    Object.assign(a, patch);
    write(NS.auctions, list);
    return a;
  }

  function minNextBid(a) {
    var base = a.currentBid || a.startPrice;
    var inc = Math.max(1, Math.round(base * (a.minIncrementPct / 100)));
    return base + inc;
  }

  function placeBid(auctionId, userId, amount) {
    var a = getAuction(auctionId);
    if (!a) throw new Error('Subasta no encontrada');
    if (getAuctionStatus(a) !== 'live') throw new Error('La subasta no está abierta');
    amount = Number(amount);
    if (!amount || amount <= 0) throw new Error('Puja inválida');
    var min = minNextBid(a);
    if (amount < min) throw new Error('Tu puja debe ser al menos ' + min.toLocaleString('es-CO'));

    var bids = getBids();
    bids.push({
      id: uid('B'),
      auctionId: auctionId,
      userId: userId,
      amount: amount,
      at: nowIso()
    });
    write(NS.bids, bids);

    a.currentBid = amount;
    a.currentBidderId = userId;

    // anti-snipe
    var remainingMs = new Date(a.endsAt).getTime() - Date.now();
    if (remainingMs < (a.antiSnipeSeconds || 0) * 1000) {
      a.endsAt = new Date(Date.now() + (a.extensionSeconds || 0) * 1000).toISOString();
    }
    write(NS.auctions, getAuctions().map(function (x) { return x.id === a.id ? a : x; }));
    return a;
  }

  function closeAuction(id) {
    var a = getAuction(id);
    if (!a) return null;
    a.status = 'closed';
    a.closedAt = nowIso();
    a.winnerId = a.currentBidderId;
    return updateAuction(id, a);
  }

  function autoCloseExpired() {
    var list = getAuctions();
    var changed = false;
    list.forEach(function (a) {
      if (a.status !== 'closed' && getAuctionStatus(a) === 'closed') {
        a.status = 'closed';
        a.closedAt = nowIso();
        a.winnerId = a.currentBidderId;
        changed = true;
      }
    });
    if (changed) write(NS.auctions, list);
  }

  // ---------- bids ----------

  function getBids() { return read(NS.bids, []); }
  function getBidsForAuction(auctionId) {
    return getBids()
      .filter(function (b) { return b.auctionId === auctionId; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  // ---------- config ----------

  function getConfig() { return Object.assign({}, DEFAULT_CONFIG, read(NS.config, {})); }
  function saveConfig(partial) {
    var cur = read(NS.config, {});
    var next = Object.assign({}, cur, partial);
    if (partial.auctionDefaults) next.auctionDefaults = Object.assign({}, cur.auctionDefaults || {}, partial.auctionDefaults);
    if (partial.hero) next.hero = Object.assign({}, cur.hero || {}, partial.hero);
    write(NS.config, next);
    return next;
  }

  // ---------- pub/sub ----------

  function subscribe(fn) {
    subscribers.push(fn);
    return function unsubscribe() {
      subscribers = subscribers.filter(function (x) { return x !== fn; });
    };
  }

  // ---------- bootstrap ----------

  ensureSeed();

  // ---------- API pública ----------

  global.Store = {
    // productos
    getProducts: getProducts,
    getProduct: getProduct,
    getProductByRef: getProductByRef,
    saveProduct: saveProduct,
    deleteProduct: deleteProduct,
    wholesalePriceFor: wholesalePriceFor,
    // usuarios / auth
    getUsers: getUsers,
    getUser: getUser,
    getUserByEmail: getUserByEmail,
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    setUserRole: setUserRole,
    setUserStatus: setUserStatus,
    // solicitudes mayoristas
    getWholesaleRequests: getWholesaleRequests,
    approveWholesale: approveWholesale,
    rejectWholesale: rejectWholesale,
    // subastas
    getAuctions: getAuctions,
    getAuction: getAuction,
    getAuctionStatus: getAuctionStatus,
    createAuction: createAuction,
    updateAuction: updateAuction,
    minNextBid: minNextBid,
    placeBid: placeBid,
    closeAuction: closeAuction,
    autoCloseExpired: autoCloseExpired,
    // bids
    getBids: getBids,
    getBidsForAuction: getBidsForAuction,
    // config
    getConfig: getConfig,
    saveConfig: saveConfig,
    // utilidades
    subscribe: subscribe,
    formatCOP: function (v) { return '$' + Number(v || 0).toLocaleString('es-CO'); },
    now: nowIso
  };
})(window);
