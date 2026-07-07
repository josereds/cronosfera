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
    counters: 'cronos:counters',
    meta: 'cronos:meta'
  };

  // Al subir SEED_VERSION se regenera el catálogo demo en navegadores que ya
  // tenían datos (se conservan usuarios y solicitudes; subastas/pujas se
  // limpian porque referencian productos que dejan de existir).
  var SEED_VERSION = 3;

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

  // ---------- marcas y especificaciones ----------

  // Marcas oficiales del marketplace (definidas por el cliente).
  // "Multimarca" agrupa marcas económicas que rotan en menor cantidad.
  // `image`: ruta a la foto de la marca (pendiente de que el cliente las
  // entregue; mientras esté vacía el tile muestra el wordmark tipográfico).
  var BRANDS = [
    { slug: 'bulova', name: 'Bulova', image: '' },
    { slug: 'casio', name: 'Casio', image: 'productos/marcas/casio.png' },
    { slug: 'cat', name: 'CAT', image: 'productos/marcas/cat.png' },
    { slug: 'citizen', name: 'Citizen', image: 'productos/marcas/citizen.png' },
    { slug: 'diesel', name: 'Diesel', image: 'productos/marcas/diesel.png' },
    { slug: 'festina', name: 'Festina', image: 'productos/marcas/festina.png' },
    { slug: 'fossil', name: 'Fossil', image: 'productos/marcas/fossil.png' },
    { slug: 'guess', name: 'Guess', image: 'productos/marcas/guess.png' },
    { slug: 'mount-royal', name: 'MountRoyal', image: 'productos/marcas/mount-royal.png' },
    { slug: 'mulco', name: 'Mulco', image: 'productos/marcas/mulco.png' },
    { slug: 'nautica', name: 'Náutica', image: 'productos/marcas/nautica.png' },
    { slug: 'orient', name: 'Orient', image: 'productos/marcas/orient.png' },
    { slug: 'seiko', name: 'Seiko', image: 'productos/marcas/seiko.png' },
    { slug: 'swatch', name: 'Swatch', image: 'productos/marcas/swatch.png' },
    { slug: 'tissot', name: 'Tissot', image: 'productos/marcas/tissot.png' },
    { slug: 'tommy-hilfiger', name: 'Tommy Hilfiger', image: 'productos/marcas/tommy-hilfiger.png' },
    { slug: 'multimarca', name: 'Multimarca', image: '', note: 'Otras marcas seleccionadas' }
  ];

  // Opciones cerradas para la ficha técnica (las usa el panel admin y los filtros).
  var SPECS = {
    mechanism: ['Cuarzo', 'Automático', 'Mecánico', 'Digital', 'Anadigi', 'Cuarzo de recarga solar'],
    crystal: ['Mineral', 'Zafiro', 'Hardlex', 'Plexiglás'],
    strap: ['Cuero', 'Acero', 'Silicona', 'Lona', 'Resina', 'Caucho'],
    gender: ['Femenino', 'Masculino', 'Unisex']
  };

  function slugifyBrand(name) {
    return String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ---------- seed inicial ----------

  // Catálogo real entregado por el cliente (WhatsApp, 2026-07-06): 26 relojes con
  // foto propia en /productos. Sin precios "antes" ni etiquetas de marketing —
  // esos datos no vinieron en el mensaje, así que no se inventan.
  var SEED_PRODUCTS_RAW = [
    { brandSlug: 'cat', model: 'Multifunción 44mm', ref: '1314926226', price: 978000, caseSize: '44mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Silicona', waterResistance: '100m', gender: 'Masculino', image: 'productos/cat-1314926226.jpg' },
    { brandSlug: 'bulova', model: 'Clásico 38mm', ref: '96B015', price: 987000, caseSize: '38mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Acero', waterResistance: '50m', gender: 'Unisex', image: 'productos/bulova-96b015.jpg' },
    { brandSlug: 'casio', model: 'Vintage A100', ref: 'A-100WE-1A', price: 336000, caseSize: '40.7mm', caseMaterial: 'Acero', mechanism: 'Digital', crystal: 'Plexiglás', strap: 'Acero', waterResistance: '50m', gender: 'Unisex', image: 'productos/casio-a100we1a.jpg' },
    { brandSlug: 'casio', model: 'World Time Illuminator', ref: 'AE-1200WHD-1A', price: 238000, caseSize: '42.1mm', caseMaterial: 'Resina', mechanism: 'Digital', crystal: 'Plexiglás', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/casio-ae1200whd1a.jpg' },
    { brandSlug: 'casio', model: 'Illuminator Anadigi', ref: 'AMW-870DA-2A1', price: 464000, caseSize: '44mm', caseMaterial: 'Acero', mechanism: 'Anadigi', crystal: 'Mineral', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/casio-amw870da2a1.jpg' },
    { brandSlug: 'citizen', model: 'Eco-Drive World Time', ref: 'BX1010-02E', price: 1315000, caseSize: '44mm', caseMaterial: 'Acero', mechanism: 'Cuarzo de recarga solar', crystal: 'Mineral', strap: 'Cuero', waterResistance: '200m', gender: 'Masculino', image: 'productos/citizen-bx101002e.jpg' },
    { brandSlug: 'diesel', model: 'Solar Powered', ref: 'DZ4621', price: 1343000, caseSize: '49mm', caseMaterial: 'Resina', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Lona', waterResistance: '50m', gender: 'Masculino', image: 'productos/diesel-dz4621.jpg' },
    { brandSlug: 'fossil', model: 'Bisel de Cristales', ref: 'ES5130', price: 959000, caseSize: '37mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Acero', waterResistance: '50m', gender: 'Femenino', image: 'productos/fossil-es5130.jpg' },
    { brandSlug: 'festina', model: 'Multifunción', ref: 'F16716-4', price: 522000, caseSize: '36mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Acero', waterResistance: null, gender: 'Femenino', image: 'productos/festina-f167164.jpg' },
    { brandSlug: 'fossil', model: 'Cronógrafo Cuero', ref: 'FS5020', price: 799000, caseSize: '46mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Cuero', waterResistance: '100m', gender: 'Masculino', image: 'productos/fossil-fs5020.jpg' },
    { brandSlug: 'casio', model: 'G-SHOCK Transparente', ref: 'GA-B001G-2A', price: 930000, caseSize: '46mm', caseMaterial: 'Resina', mechanism: 'Anadigi', crystal: 'Mineral', strap: 'Resina', waterResistance: '200m', gender: 'Unisex', image: 'productos/casio-gab001g2a.jpg' },
    { brandSlug: 'guess', model: 'Diamante', ref: 'GW0528L1', price: 848000, caseSize: '36mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Acero', waterResistance: '30m', gender: 'Femenino', image: 'productos/guess-gw0528l1.jpg' },
    { brandSlug: 'mulco', model: 'Lush Nácar', ref: 'MW317290223', price: 1330000, caseSize: '42mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Silicona', waterResistance: '100m', gender: 'Femenino', image: 'productos/mulco-mw317290223.jpg' },
    { brandSlug: 'nautica', model: 'Bayside Cronógrafo', ref: 'NAPBSS501', price: 984000, caseSize: '46mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Silicona', waterResistance: '100m', gender: 'Masculino', image: 'productos/nautica-napbss501.jpg' },
    { brandSlug: 'nautica', model: 'Cronógrafo + Correa Extra', ref: 'NAPWRS503', price: 933000, caseSize: '46mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Mineral', strap: 'Silicona', waterResistance: '100m', gender: 'Masculino', image: 'productos/nautica-napwrs503.jpg' },
    { brandSlug: 'orient', model: 'Kamasu', ref: 'RA-AA0004E', price: 1813000, caseSize: '41.8mm', caseMaterial: 'Acero', mechanism: 'Automático', crystal: 'Zafiro', strap: 'Acero', waterResistance: '200m', gender: 'Masculino', image: 'productos/orient-raaa0004e.jpg' },
    { brandSlug: 'orient', model: 'Chronograph', ref: 'RA-TX0306S', price: 1359000, caseSize: '40mm', caseMaterial: 'Acero', mechanism: 'Cuarzo de recarga solar', crystal: 'Zafiro', strap: 'Cuero', waterResistance: '50m', gender: 'Masculino', image: 'productos/orient-ratx0306s.jpg' },
    { brandSlug: 'swatch', model: 'Cronógrafo Transparente', ref: 'SB02K100', price: 952000, caseSize: '47mm', caseMaterial: 'Resina', mechanism: 'Cuarzo', crystal: 'Plexiglás', strap: 'Silicona', waterResistance: '30m', gender: 'Unisex', image: 'productos/swatch-sb02k100.jpg' },
    { brandSlug: 'seiko', model: '5 Sports GMT Negro', ref: 'SSK001K1', price: 2423000, caseSize: '42.5mm', caseMaterial: 'Acero', mechanism: 'Automático', crystal: 'Hardlex', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/seiko-ssk001k1.jpg' },
    { brandSlug: 'seiko', model: '5 Sports GMT Azul', ref: 'SSK003K1', price: 2423000, caseSize: '42.5mm', caseMaterial: 'Acero', mechanism: 'Automático', crystal: 'Hardlex', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/seiko-ssk003k1.jpg' },
    { brandSlug: 'seiko', model: '5 Sports GMT Naranja', ref: 'SSK005K1', price: 2423000, caseSize: '42.5mm', caseMaterial: 'Acero', mechanism: 'Automático', crystal: 'Hardlex', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/seiko-ssk005k1.jpg' },
    { brandSlug: 'tissot', model: 'Seastar Nácar', ref: 'T1202101711600', price: 3426000, caseSize: '36mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Zafiro', strap: 'Silicona', waterResistance: '30m', gender: 'Femenino', image: 'productos/tissot-t1202101711600.jpg' },
    { brandSlug: 'tissot', model: 'PRX Verde', ref: 'T1372101108100', price: 2639000, caseSize: '35mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Zafiro', strap: 'Acero', waterResistance: '100m', gender: 'Unisex', image: 'productos/tissot-t1372101108100.jpg' },
    { brandSlug: 'tissot', model: 'Cronógrafo Bicolor', ref: 'T1414171701100', price: 3616000, caseSize: '45mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Zafiro', strap: 'Silicona', waterResistance: '100m', gender: 'Masculino', image: 'productos/tissot-t1414171701100.jpg' },
    { brandSlug: 'tissot', model: 'T-Race Powermatic 80', ref: 'T1418071104100', price: 4749000, caseSize: '45mm', caseMaterial: 'Acero', mechanism: 'Automático', crystal: 'Zafiro', strap: 'Acero', waterResistance: '100m', gender: 'Masculino', image: 'productos/tissot-t1418071104100.jpg' },
    { brandSlug: 'tissot', model: 'Bisel Estriado Celeste', ref: 'T1562101135100', price: 2338000, caseSize: '36mm', caseMaterial: 'Acero', mechanism: 'Cuarzo', crystal: 'Zafiro', strap: 'Acero', waterResistance: '50m', gender: 'Femenino', image: 'productos/tissot-t1562101135100.jpg' }
  ];

  var TONE_BY_BRAND = {
    cat: 'ink', bulova: 'steel', casio: 'ink', citizen: 'cool', diesel: 'ink', fossil: 'fog',
    festina: 'cool', guess: 'fog', mulco: 'fog', nautica: 'cool', orient: 'green', swatch: 'ink',
    seiko: 'ink', tissot: 'cool'
  };

  var SEED_PRODUCTS = SEED_PRODUCTS_RAW.map(function (p) {
    var brand = find(BRANDS, function (b) { return b.slug === p.brandSlug; });
    var tone = TONE_BY_BRAND[p.brandSlug] || 'ink';
    return Object.assign({
      brand: brand ? brand.name : p.brandSlug,
      wasPrice: 0,
      off: 0,
      tone: tone,
      stockStatus: 'in',
      stock: 'Disponible',
      tag: null,
      variants: []
    }, p);
  });

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
    var meta = read(NS.meta, {});
    if (!read(NS.products, null) || (meta.seedVersion || 1) < SEED_VERSION) {
      write(NS.products, SEED_PRODUCTS.map(function (p) {
        return Object.assign({ id: uid('P') }, p, { createdAt: nowIso() });
      }));
      // Las subastas/pujas previas referencian productos del catálogo anterior.
      write(NS.auctions, []);
      write(NS.bids, []);
      meta.seedVersion = SEED_VERSION;
      write(NS.meta, meta);
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

  // ---------- marcas ----------

  function getBrands() {
    var products = getProducts();
    var images = getConfig().brandImages || {};
    return BRANDS.map(function (b) {
      return Object.assign({}, b, {
        image: images[b.slug] || b.image || '',
        count: products.filter(function (p) { return productBrandSlug(p) === b.slug; }).length
      });
    });
  }

  function getBrand(slug) {
    return find(BRANDS, function (b) { return b.slug === slug; }) || null;
  }

  function productBrandSlug(p) {
    return p.brandSlug || slugifyBrand(p.brand);
  }

  function saveProduct(p) {
    var list = getProducts();
    if (!p.id) p.id = uid('P');
    if (p.brand && !p.brandSlug) p.brandSlug = slugifyBrand(p.brand);
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
    // marcas y especificaciones
    getBrands: getBrands,
    getBrand: getBrand,
    productBrandSlug: productBrandSlug,
    SPECS: SPECS,
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
