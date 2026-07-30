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
    profile: 'cronos:profile',
    requests: 'cronos:wholesale-requests',
    config: 'cronos:config',
    brandsMeta: 'cronos:brands-meta',
    discounts: 'cronos:discounts',
    accessoryMeta: 'cronos:accessory-meta',
    counters: 'cronos:counters',
    meta: 'cronos:meta',
    cart: 'cronos:cart',
    orders: 'cronos:orders'
  };

  // ---------- Supabase (backend compartido) ----------
  // Llave "anon public": segura de exponer en el navegador, todo el acceso
  // real lo controla RLS del lado del servidor (ver backend/02-security.sql).
  var SUPABASE_URL = 'https://bikmwxucsbbjouoqwknc.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpa213eHVjc2Jiam91b3F3a25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NjY5NjAsImV4cCI6MjEwMDM0Mjk2MH0.nfylTZ6pJoY15unrQVCgdiqma_dn9OXcBXiDjWLWIRQ';
  var sb = (global.supabase && global.supabase.createClient)
    ? global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
  if (!sb) console.warn('[Store] Supabase no cargó (¿falta el script @supabase/supabase-js antes de cronos-store.js?)');

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

  // Igual que write() pero solo escribe/notifica si el dato realmente cambió.
  // Clave para el sondeo de subastas: re-consultar cada pocos segundos NO debe
  // provocar un re-render (que borraría, por ejemplo, la puja a medio escribir)
  // cuando no hubo cambios; solo re-renderiza cuando llega una puja nueva.
  function writeIfChanged(key, value) {
    var next = JSON.stringify(value);
    var cur;
    try { cur = localStorage.getItem(key); } catch (e) { cur = null; }
    if (cur === next) return false;
    try { localStorage.setItem(key, next); } catch (e) { console.error('[Store] fallo escribiendo', key, e); }
    scheduleEmit();
    return true;
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

  // ============================================================
  // ---------- Supabase: mapeos fila (snake_case) <-> JS ----------
  // ============================================================
  function mapProductFromDb(r) {
    return {
      id: r.id, category: r.category || 'reloj', accessoryType: r.accessory_type,
      brand: r.brand || '', brandSlug: r.brand_slug, model: r.model, ref: r.ref || '',
      price: r.price, wasPrice: r.was_price || 0, off: r.off || 0, wholesalePrice: r.wholesale_price,
      tone: r.tone || 'ink', tag: r.tag, stock: r.stock, stockStatus: r.stock_status || 'in',
      variants: r.variants || [], gender: r.gender, mechanism: r.mechanism, crystal: r.crystal,
      strap: r.strap, caseSize: r.case_size, caseMaterial: r.case_material,
      waterResistance: r.water_resistance, description: r.description, image: r.image,
      createdAt: r.created_at
    };
  }
  function mapProductToDb(p) {
    return {
      category: p.category || 'reloj', accessory_type: p.accessoryType || null,
      brand: p.brand || '', brand_slug: p.brandSlug || null, model: p.model, ref: p.ref || '',
      price: p.price, was_price: p.wasPrice || 0, off: p.off || 0,
      wholesale_price: p.wholesalePrice || null, tone: p.tone || 'ink', tag: p.tag || null,
      stock: p.stock || 'Disponible', stock_status: p.stockStatus || 'in', variants: p.variants || [],
      gender: p.gender || null, mechanism: p.mechanism || null, crystal: p.crystal || null,
      strap: p.strap || null, case_size: p.caseSize || null, case_material: p.caseMaterial || null,
      water_resistance: p.waterResistance || null, description: p.description || null,
      image: p.image || null
    };
  }
  function mapAuctionFromDb(r) {
    return {
      id: r.id, productId: r.product_id, startPrice: r.start_price, currentBid: r.current_bid,
      currentBidderId: r.current_bidder_id, reservePrice: r.reserve_price,
      minIncrementPct: r.min_increment_pct, antiSnipeSeconds: r.anti_snipe_seconds,
      extensionSeconds: r.extension_seconds, startsAt: r.starts_at, endsAt: r.ends_at,
      status: r.status, closedAt: r.closed_at, winnerId: r.winner_id, winnerName: r.winner_name,
      reserveMet: r.reserve_met, createdAt: r.created_at
    };
  }
  function mapBidFromDb(r) {
    return { id: r.id, auctionId: r.auction_id, userId: r.user_id, bidderName: r.bidder_name, amount: r.amount, at: r.created_at };
  }
  function mapProfileFromDb(r) {
    return {
      id: r.id, name: r.name, email: r.email, role: r.role, status: r.status,
      company: r.company, taxId: r.tax_id, phone: r.phone, city: r.city, createdAt: r.created_at
    };
  }
  function mapWholesaleFromDb(r) {
    return {
      id: r.id, userId: r.user_id, reference: r.reference, businessData: r.business_data,
      status: r.status, rejectReason: r.reject_reason, createdAt: r.created_at, reviewedAt: r.reviewed_at
    };
  }
  function mapOrderFromDb(r) {
    return {
      id: r.id, reference: r.reference, userId: r.user_id, customer: r.customer, items: r.items,
      total: r.total, status: r.status, paymentMethod: r.payment_method,
      wompiTransactionId: r.wompi_transaction_id, createdAt: r.created_at, updatedAt: r.updated_at
    };
  }
  function mapOrderToDb(o) {
    return {
      reference: o.reference, user_id: o.userId || null, customer: o.customer || {},
      items: o.items || [], total: o.total || 0, status: o.status || 'pendiente',
      payment_method: o.paymentMethod || null, wompi_transaction_id: o.wompiTransactionId || null
    };
  }

  // Traduce los mensajes en inglés de Supabase Auth a algo que un cliente entienda.
  function mapAuthError(err) {
    var m = (err && err.message) || '';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos';
    if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese correo';
    if (/Password should be/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres';
    if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera un momento e intenta de nuevo';
    return m || 'No se pudo completar la operación';
  }

  // ============================================================
  // ---------- Supabase: hidratación (llena la caché local) ----------
  // ============================================================
  // Todas las páginas siguen leyendo de forma síncrona (getProducts(),
  // getAuctions()...) desde localStorage; estas funciones lo mantienen al
  // día trayendo la verdad compartida de Supabase y avisando a los
  // suscriptores (Store.subscribe) para que la UI se vuelva a pintar.
  function hydrateProducts() {
    if (!sb) return Promise.resolve();
    // Orden base alfabético (marca y luego modelo): así los productos que
    // Cristian agrega manualmente caen en su lugar, no al final. Las vistas
    // que necesiten otro orden (precio, descuento) igual pueden re-ordenar.
    return sb.from('products').select('*').order('brand').order('model').then(function (res) {
      if (res.error) { console.error('[Store] hidratando products', res.error); return; }
      write(NS.products, res.data.map(mapProductFromDb));
    });
  }
  function hydrateAuctions() {
    if (!sb) return Promise.resolve();
    return sb.from('auctions').select('*').then(function (res) {
      if (res.error) { console.error('[Store] hidratando auctions', res.error); return; }
      writeIfChanged(NS.auctions, res.data.map(mapAuctionFromDb));
    });
  }
  function hydrateBids() {
    if (!sb) return Promise.resolve();
    return sb.from('bids').select('*').then(function (res) {
      if (res.error) { console.error('[Store] hidratando bids', res.error); return; }
      writeIfChanged(NS.bids, res.data.map(mapBidFromDb));
    });
  }
  // Re-consulta subastas + pujas (para el sondeo en vivo de la página de
  // subastas). Solo dispara re-render si algo cambió (writeIfChanged).
  function syncAuctions() { return Promise.all([hydrateAuctions(), hydrateBids()]); }
  function hydrateConfig() {
    if (!sb) return Promise.resolve();
    return sb.from('config').select('data').eq('id', 1).single().then(function (res) {
      if (res.error) { console.error('[Store] hidratando config', res.error); return; }
      write(NS.config, (res.data && res.data.data) || {});
    });
  }
  // Solicitudes mayoristas y pedidos: RLS solo deja ver "las mías" (cliente) o
  // "todas" (admin). Sin sesión, ambas quedan vacías — no hay nada que ocultar
  // a propósito, simplemente no aplica a un visitante anónimo.
  function hydrateWholesale() {
    if (!sb) return Promise.resolve();
    return sb.from('wholesale_requests').select('*').then(function (res) {
      if (res.error) return;
      write(NS.requests, res.data.map(mapWholesaleFromDb));
    });
  }
  function hydrateOrders() {
    if (!sb) return Promise.resolve();
    return sb.from('orders').select('*').then(function (res) {
      if (res.error) return;
      write(NS.orders, res.data.map(mapOrderFromDb));
    });
  }
  // Solo funciona para el admin (is_admin() en la política de profiles deja
  // ver todas las filas); para cualquier otro, RLS solo devuelve la propia.
  function hydrateUsers() {
    if (!sb) return Promise.resolve();
    return sb.from('profiles').select('*').then(function (res) {
      if (res.error) return;
      write(NS.users, res.data.map(mapProfileFromDb));
    });
  }

  function hydrateAll() {
    return Promise.all([
      hydrateProducts(), hydrateAuctions(), hydrateBids(), hydrateConfig(),
      hydrateWholesale(), hydrateOrders(), hydrateUsers()
    ]);
  }

  // ============================================================
  // ---------- Supabase: sesión (perfil actual, síncrono) ----------
  // ============================================================
  function applyProfile(profile) {
    if (profile) write(NS.profile, profile);
    else {
      try { localStorage.removeItem(NS.profile); } catch (e) {}
      scheduleEmit();
    }
  }

  // Confirma contra Supabase quién tiene la sesión activa y actualiza la
  // caché síncrona (NS.profile). Se llama al cargar la página y cada vez que
  // Supabase avisa un cambio de sesión (login/logout/refresh de token).
  function refreshProfile() {
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) { applyProfile(null); return null; }
      return sb.from('profiles').select('*').eq('id', session.user.id).single().then(function (r) {
        if (r.error || !r.data) { applyProfile(null); return null; }
        var profile = mapProfileFromDb(r.data);
        applyProfile(profile);
        if (profile.role === 'admin') hydrateUsers();
        return profile;
      });
    });
  }

  // ============================================================
  // ---------- Supabase: tiempo real ----------
  // ============================================================
  // Para no reconstruir el estado a mano por cada evento, ante cualquier
  // cambio simplemente se vuelve a pedir la tabla completa: con el tamaño de
  // catálogo/subastas de Cronosfera el costo es insignificante y el código
  // queda mucho más simple y confiable que ir parchando fila por fila.
  function initRealtime() {
    if (!sb) return;
    sb.channel('cronos-public-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, hydrateProducts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, hydrateAuctions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, hydrateBids)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, hydrateConfig)
      .subscribe();
    // Canal aparte: solo se entera de sus propios cambios vía RLS (pedidos y
    // solicitudes mayoristas no son públicos), así que re-hidratar aquí no
    // filtra datos de otros usuarios.
    sb.channel('cronos-private-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, hydrateOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_requests' }, hydrateWholesale)
      .subscribe();
    sb.auth.onAuthStateChange(function () { refreshProfile(); });
  }

  // ---------- marcas y especificaciones ----------

  // Marcas oficiales del marketplace (definidas por el cliente).
  // "Multimarca" agrupa marcas económicas que rotan en menor cantidad.
  // `image`: logotipo en blanco (franja inferior del tile). `photo`: foto de
  // estilo de vida/producto que ocupa todo el tile. Bulova no tiene logo
  // blanco todavía (el tile usa el nombre como texto en su lugar).
  var BRANDS = [
    { slug: 'bulova', name: 'Bulova', image: 'productos/marcas/bulova-white.png', photo: 'productos/marcas/bulova-foto.jpg' },
    { slug: 'casio', name: 'Casio', image: 'productos/marcas/casio-white.png', photo: 'productos/marcas/casio-foto.jpg' },
    { slug: 'cat', name: 'CAT', image: 'productos/marcas/cat-white.png', photo: 'productos/marcas/cat-foto.jpg' },
    { slug: 'citizen', name: 'Citizen', image: 'productos/marcas/citizen-white.png', photo: 'productos/marcas/citizen-foto.jpg' },
    { slug: 'diesel', name: 'Diesel', image: 'productos/marcas/diesel-white.png', photo: 'productos/marcas/diesel-foto.jpg' },
    { slug: 'festina', name: 'Festina', image: 'productos/marcas/festina-white.png', photo: 'productos/marcas/festina-foto.jpg' },
    { slug: 'fossil', name: 'Fossil', image: 'productos/marcas/fossil-white.png', photo: 'productos/marcas/fossil-foto.jpg' },
    { slug: 'guess', name: 'Guess', image: 'productos/marcas/guess-white.png', photo: 'productos/marcas/guess-foto.jpg' },
    { slug: 'mount-royal', name: 'MountRoyal', image: 'productos/marcas/mount-royal-white.png', photo: 'productos/marcas/mount-royal-foto.jpg' },
    { slug: 'mulco', name: 'Mulco', image: 'productos/marcas/mulco-white.png', photo: 'productos/marcas/mulco-foto.jpg' },
    { slug: 'nautica', name: 'Náutica', image: 'productos/marcas/nautica-white.png', photo: 'productos/marcas/nautica-foto.jpg' },
    { slug: 'orient', name: 'Orient', image: 'productos/marcas/orient-white.png', photo: 'productos/marcas/orient-foto.jpg' },
    { slug: 'seiko', name: 'Seiko', image: 'productos/marcas/seiko-white.png', photo: 'productos/marcas/seiko-foto.jpg' },
    { slug: 'swatch', name: 'Swatch', image: 'productos/marcas/swatch-white.png', photo: 'productos/marcas/swatch-foto.jpg' },
    { slug: 'tissot', name: 'Tissot', image: 'productos/marcas/tissot-white.png', photo: 'productos/marcas/tissot-foto.jpg' },
    { slug: 'tommy-hilfiger', name: 'Tommy Hilfiger', image: 'productos/marcas/tommy-hilfiger-white.png', photo: 'productos/marcas/tommy-hilfiger-foto.jpg' },
    { slug: 'multimarca', name: 'Multimarca', image: '', photo: 'productos/marcas/multimarca-foto.jpg', note: 'Otras marcas seleccionadas' }
  ];

  // Categorías de accesorios que vende Cristian aparte de relojes. Fijas
  // (no se crean/borran desde el panel como las carpetas de marca): existen
  // siempre, aunque todavía no tengan productos, para que el panel las
  // muestre listas y él pueda ir subiendo fotos cuando las tenga.
  var ACCESSORY_CATEGORIES = [
    { slug: 'gorras', name: 'Gorras' },
    { slug: 'correas', name: 'Correas' },
    { slug: 'billeteras', name: 'Billeteras' },
    { slug: 'camisetas-buzos', name: 'Camisetas y buzos' },
    { slug: 'perfumes-joyas', name: 'Perfumes y joyas' }
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
    },
    // Datos de la pasarela de pago. Mientras estén vacíos, el checkout muestra
    // esas opciones como "pendientes de activación" en vez de simular que
    // funcionan. Se completan desde Admin → Configuración → Pagos.
    payments: {
      whatsappNumber: '573107764080',
      // Llave de PRUEBAS de Wompi activa mientras se verifica el flujo de pago
      // end-to-end. Cristian ya envió la de producción (pub_prod_...); se
      // cambia a esa solo cuando confirme que quiere empezar a cobrar de verdad.
      wompiPublicKey: 'pub_test_4vSzA3WLfIFWpXhyt0dxJXNVAhNue4F1',
      // "Secreto de integridad" del dashboard de Wompi (Desarrolladores → Llaves
      // API), distinto de la llave pública/privada. Sin esto, Wompi rechaza el
      // pago con "Firma de integridad requerida no enviada" si la cuenta lo exige.
      // Este es el de PRUEBAS (test_integrity_...), pareja de la llave pub_test_ de arriba.
      wompiIntegritySecret: 'test_integrity_VaVN7f1KujfqHp7u6Blp7Q0mVYNr2Z1N'
    }
  };

  // Solo se usa si Supabase no está disponible (p. ej. falla el CDN): deja el
  // sitio funcionando en modo local de un solo navegador, como antes de la
  // migración, en vez de mostrar una tienda completamente vacía.
  function ensureLocalFallbackSeed() {
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
  // Relojes: todo lo que no esté marcado como accesorio (los productos del
  // catálogo original no tienen `category`, así que siguen contando aquí).
  function getWatchProducts() { return getProducts().filter(function (p) { return p.category !== 'accesorio'; }); }
  function getAccessoryProducts(categorySlug) {
    return getProducts().filter(function (p) {
      return p.category === 'accesorio' && (!categorySlug || p.accessoryType === categorySlug);
    });
  }
  // Portada editable desde el panel por categoría de accesorio (independiente
  // de las fotos de producto): si Cristian no sube una, se usa la primera
  // foto de un producto de esa categoría, igual que en las carpetas de marca.
  // Igual que los descuentos: las portadas de categorías viven en la config
  // sincronizada, para que se vean en todos los navegadores.
  function getAccessoryMeta() { return getConfig().accessoryMeta || { covers: {} }; }
  function setAccessoryCover(slug, cover) {
    var covers = Object.assign({}, getAccessoryMeta().covers);
    covers[slug] = cover || '';
    saveConfig({ accessoryMeta: { covers: covers } }).catch(function (e) { console.error('[Store] guardando portada', e); });
  }

  function getAccessoryCategories() {
    var covers = getAccessoryMeta().covers || {};
    return ACCESSORY_CATEGORIES.map(function (c) {
      var items = getAccessoryProducts(c.slug);
      var withPhoto = find(items, function (p) { return !!p.image; });
      return Object.assign({}, c, { count: items.length, cover: covers[c.slug] || (withPhoto ? withPhoto.image : '') });
    });
  }

  // ---------- marcas ----------

  // ---------- marcas: personalización desde el panel ----------
  // Capa de overrides sobre BRANDS (fija, real): permite renombrar, poner
  // portada propia y agregar marcas nuevas sin tocar código. `order` guarda
  // el orden final de carpetas una vez que Daniela lo ajusta manualmente;
  // mientras no lo toque, se ordena alfabético.
  // La personalización de marcas (renombrar, portadas, orden, marcas nuevas)
  // vive en la config sincronizada, para que los clientes vean lo mismo que
  // configura el admin.
  function getBrandsMeta() {
    return getConfig().brandsMeta || { order: [], overrides: {}, custom: [] };
  }

  function saveBrandsMeta(patch) {
    var next = Object.assign({}, getBrandsMeta(), patch);
    saveConfig({ brandsMeta: next }).catch(function (e) { console.error('[Store] guardando marcas', e); });
    return next;
  }

  function getBrands() {
    var products = getProducts();
    var meta = getBrandsMeta();
    var overrides = meta.overrides || {};
    var all = BRANDS.concat(meta.custom || []);
    var list = all.map(function (b) {
      var ov = overrides[b.slug] || {};
      return Object.assign({}, b, {
        name: ov.name || b.name,
        photo: ov.cover || b.photo || '',
        custom: !!b.custom,
        count: products.filter(function (p) { return productBrandSlug(p) === b.slug; }).length
      });
    });
    var order = meta.order || [];
    list.sort(function (a, b) {
      var ia = order.indexOf(a.slug), ib = order.indexOf(b.slug);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'es');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return list;
  }

  function getBrand(slug) {
    return find(getBrands(), function (b) { return b.slug === slug; }) || null;
  }

  function productBrandSlug(p) {
    return p.brandSlug || slugifyBrand(p.brand);
  }

  // Crea una marca/carpeta nueva. El slug se genera del nombre y se
  // desambigua si ya existe (bulova, bulova-2, ...).
  function addBrand(data) {
    var name = String(data.name || '').trim();
    if (!name) throw new Error('El nombre de la carpeta es obligatorio');
    var base = slugifyBrand(name);
    var existing = getBrands().map(function (b) { return b.slug; });
    var slug = base, i = 2;
    while (existing.indexOf(slug) !== -1) { slug = base + '-' + i; i++; }
    var meta = getBrandsMeta();
    var custom = (meta.custom || []).concat([{ slug: slug, name: name, photo: data.cover || '', custom: true }]);
    var order = (meta.order && meta.order.length ? meta.order : getBrands().map(function (b) { return b.slug; })).concat([slug]);
    saveBrandsMeta({ custom: custom, order: order });
    return getBrand(slug);
  }

  // Renombra una carpeta (marca de fábrica o custom) y actualiza en cascada
  // el nombre visible en los productos que ya la usan, para que la vista de
  // carpetas (que agrupa por el texto de p.brand) quede consistente.
  function renameBrand(slug, newName) {
    var name = String(newName || '').trim();
    if (!name) throw new Error('El nombre no puede quedar vacío');
    var meta = getBrandsMeta();
    var overrides = Object.assign({}, meta.overrides);
    overrides[slug] = Object.assign({}, overrides[slug], { name: name });
    saveBrandsMeta({ overrides: overrides });
    var products = getProducts();
    var changed = false;
    products.forEach(function (p) {
      if (productBrandSlug(p) === slug && p.brand !== name) { p.brand = name; changed = true; }
    });
    if (changed) write(NS.products, products);
    return getBrand(slug);
  }

  function setBrandCover(slug, cover) {
    var meta = getBrandsMeta();
    var overrides = Object.assign({}, meta.overrides);
    overrides[slug] = Object.assign({}, overrides[slug], { cover: cover || '' });
    saveBrandsMeta({ overrides: overrides });
    return getBrand(slug);
  }

  // Mueve una carpeta un puesto arriba/abajo (dir: -1 / +1) dentro del orden
  // visible. La primera vez que se reordena, se fija el orden completo.
  function moveBrand(slug, dir) {
    var slugs = getBrands().map(function (b) { return b.slug; });
    var idx = slugs.indexOf(slug);
    var target = idx + dir;
    if (idx === -1 || target < 0 || target >= slugs.length) return;
    var tmp = slugs[idx]; slugs[idx] = slugs[target]; slugs[target] = tmp;
    saveBrandsMeta({ order: slugs });
  }

  // Solo se pueden borrar carpetas creadas desde el panel, y solo si ya no
  // tienen productos adentro (para no dejar productos huérfanos sin marca).
  function deleteBrand(slug) {
    var b = getBrand(slug);
    if (!b || !b.custom) throw new Error('Solo se pueden eliminar carpetas creadas desde el panel');
    if (b.count > 0) throw new Error('Esta carpeta todavía tiene productos adentro');
    var meta = getBrandsMeta();
    var custom = (meta.custom || []).filter(function (x) { return x.slug !== slug; });
    var order = (meta.order || []).filter(function (x) { return x !== slug; });
    var overrides = Object.assign({}, meta.overrides);
    delete overrides[slug];
    saveBrandsMeta({ custom: custom, order: order, overrides: overrides });
  }

  // Sube una foto a Supabase Storage y devuelve su URL pública. Si ya es una
  // URL (http…) o una ruta del sitio (productos/…), la deja igual — solo sube
  // las que llegan como data URL base64 (fotos nuevas elegidas en el panel).
  // Esto evita que las fotos vuelvan a guardarse como texto pesado en la base
  // o en el navegador, que fue lo que llenó el localStorage.
  function ensureImageStored(image) {
    if (!sb || !image || image.indexOf('data:') !== 0) return Promise.resolve(image || null);
    var m = image.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return Promise.resolve(image);
    var mime = m[1] || 'image/jpeg';
    var ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('webp') >= 0 ? 'webp' : 'jpg');
    var bstr = atob(m[2]);
    var len = bstr.length;
    var u8 = new Uint8Array(len);
    for (var i = 0; i < len; i++) u8[i] = bstr.charCodeAt(i);
    var blob = new Blob([u8], { type: mime });
    var id = (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
    var path = 'products/' + id + '.' + ext;
    return sb.storage.from('product-images').upload(path, blob, { contentType: mime, upsert: false }).then(function (res) {
      if (res.error) throw new Error('No se pudo subir la foto: ' + res.error.message);
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    });
  }

  function saveProduct(p) {
    if (p.brand && !p.brandSlug) p.brandSlug = slugifyBrand(p.brand);
    if (!sb) {
      // Solo se usa si Supabase no cargó (modo local de respaldo).
      var list = getProducts();
      if (!p.id) p.id = uid('P');
      var idx = list.findIndex(function (x) { return x.id === p.id; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], p);
      else { p.createdAt = nowIso(); list.push(p); }
      write(NS.products, list);
      return Promise.resolve(p);
    }
    return ensureImageStored(p.image).then(function (imageUrl) {
      var toSave = Object.assign({}, p, { image: imageUrl });
      var row = mapProductToDb(toSave);
      var query = toSave.id
        ? sb.from('products').update(row).eq('id', toSave.id).select().single()
        : sb.from('products').insert(row).select().single();
      return query.then(function (res) {
        if (res.error) throw new Error(mapAuthError(res.error));
        return hydrateProducts().then(function () { return mapProductFromDb(res.data); });
      });
    });
  }

  function deleteProduct(id) {
    if (!sb) { write(NS.products, getProducts().filter(function (p) { return p.id !== id; })); return Promise.resolve(); }
    return sb.from('products').delete().eq('id', id).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateProducts();
    });
  }

  function wholesalePriceFor(p) {
    var cfg = getConfig();
    if (p.wholesalePrice && p.wholesalePrice > 0) return p.wholesalePrice;
    var pct = (cfg.wholesaleDiscountPct || 0) / 100;
    return Math.round(p.price * (1 - pct));
  }

  // ---------- descuentos promocionales (general / categoría / producto) ----------
  // Tres niveles independientes, cada uno con su propio interruptor y su
  // propio %. Si más de uno aplica al mismo producto, gana el más
  // específico: producto > categoría (marca o accesorio) > general. No se
  // suman entre sí para no confundir con descuentos acumulados.
  // Los descuentos viven dentro de la configuración (tabla config de Supabase),
  // no en una clave local aparte: así los ve también el navegador de cada
  // cliente, no solo el del admin.
  function getDiscounts() {
    var d = getConfig().discounts;
    return (d && d.global) ? d : { global: { active: false, pct: 10 }, brands: {}, accessoryCategories: {} };
  }
  function saveDiscounts(next) {
    saveConfig({ discounts: next }).catch(function (e) { console.error('[Store] guardando descuentos', e); });
    return next;
  }

  function setGlobalDiscount(active, pct) {
    var d = getDiscounts();
    d.global = { active: !!active, pct: Math.max(0, Math.min(95, Number(pct) || 0)) };
    return saveDiscounts(d);
  }
  function setBrandDiscount(slug, active, pct) {
    var d = getDiscounts();
    d.brands = Object.assign({}, d.brands);
    d.brands[slug] = { active: !!active, pct: Math.max(0, Math.min(95, Number(pct) || 0)) };
    return saveDiscounts(d);
  }
  function setAccessoryCategoryDiscount(slug, active, pct) {
    var d = getDiscounts();
    d.accessoryCategories = Object.assign({}, d.accessoryCategories);
    d.accessoryCategories[slug] = { active: !!active, pct: Math.max(0, Math.min(95, Number(pct) || 0)) };
    return saveDiscounts(d);
  }
  function getBrandDiscount(slug) { return (getDiscounts().brands || {})[slug] || { active: false, pct: 0 }; }
  function getAccessoryCategoryDiscount(slug) { return (getDiscounts().accessoryCategories || {})[slug] || { active: false, pct: 0 }; }

  // % de descuento vigente para un producto puntual, o 0 si ninguno aplica.
  function resolveDiscountPct(p) {
    if (p.discountActive && p.discountPct > 0) return p.discountPct;
    var d = getDiscounts();
    if (p.category === 'accesorio') {
      var acc = (d.accessoryCategories || {})[p.accessoryType];
      if (acc && acc.active && acc.pct > 0) return acc.pct;
    } else {
      var brand = (d.brands || {})[productBrandSlug(p)];
      if (brand && brand.active && brand.pct > 0) return brand.pct;
    }
    if (d.global && d.global.active && d.global.pct > 0) return d.global.pct;
    return 0;
  }

  // Precio/etiquetas a mostrar: si hay un descuento promocional vigente,
  // reemplaza el "antes/ahora" manual del producto (no se suman). El precio
  // guardado en el producto (p.price) nunca se toca — esto es solo para
  // pintar la vitrina y cobrar en el carrito.
  function getPriceDisplay(p) {
    var pct = resolveDiscountPct(p);
    if (pct > 0) {
      return { price: Math.round(p.price * (1 - pct / 100)), wasPrice: p.price, off: pct };
    }
    return { price: p.price, wasPrice: p.wasPrice || 0, off: p.off || 0 };
  }
  function getEffectivePrice(p) { return getPriceDisplay(p).price; }

  // ---------- usuarios / auth ----------

  // getUsers()/getUser() leen de la caché local: para el admin trae TODOS los
  // perfiles (hydrateUsers, permitido por is_admin() en RLS); para cualquier
  // otra persona solo puede contener su propio perfil (currentUser()).
  function getUsers() { return read(NS.users, []); }
  function getUser(id) { return find(getUsers(), function (u) { return u.id === id; }) || null; }
  function getUserByEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    return find(getUsers(), function (u) { return (u.email || '').toLowerCase() === e; }) || null;
  }

  // register/login/logout hablan con Supabase Auth: son asíncronos y
  // devuelven una Promise (a diferencia del resto del Store, que sigue
  // siendo síncrono contra la caché local).
  function register(data) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    if (!data.email || !data.password) return Promise.reject(new Error('Faltan email o contraseña'));
    // Todos los datos del negocio viajan en la metadata del signUp: el trigger
    // handle_new_user() crea el perfil y —si es mayorista— la solicitud, en el
    // servidor. Así la solicitud existe aunque el correo aún no esté confirmado
    // (antes se creaba desde el cliente tras iniciar sesión, y con "confirmar
    // correo" activado esa sesión no llegaba, así que la solicitud se perdía).
    return sb.auth.signUp({
      email: String(data.email).trim().toLowerCase(),
      password: data.password,
      options: { data: {
        name: data.name || data.email.split('@')[0],
        role: data.role || 'retail',
        company: data.company || null,
        tax_id: data.taxId || null,
        phone: data.phone || null,
        city: data.city || null,
        channel: data.channel || null,
        message: data.message || null
      } }
    }).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      if (!res.data.session) {
        // El proyecto tiene "confirmar correo" activado: la cuenta queda
        // creada pero sin sesión hasta que confirme desde su email.
        throw new Error('Te enviamos un correo de confirmación. Confírmalo y luego inicia sesión.');
      }
      return refreshProfile();
    }).then(function (profile) {
      if (!profile) throw new Error('No se pudo cargar tu perfil');
      if (data.role === 'wholesale') return hydrateWholesale().then(function () { return profile; });
      return profile;
    });
  }

  function login(email, password) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: password
    }).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return refreshProfile();
    }).then(function (profile) {
      if (!profile) throw new Error('No se pudo cargar tu perfil');
      if (profile.status !== 'active') {
        var msg = profile.status === 'pending' ? 'Tu cuenta está pendiente de aprobación manual'
          : profile.status === 'rejected' ? 'Tu solicitud mayorista fue rechazada. Contáctanos para más información'
          : 'Tu cuenta está suspendida';
        return sb.auth.signOut().then(function () { applyProfile(null); throw new Error(msg); });
      }
      return profile;
    });
  }

  function logout() {
    applyProfile(null); // se limpia de inmediato; no hace falta esperar la red
    if (sb) sb.auth.signOut();
  }

  function currentUser() { return read(NS.profile, null); }

  function setUserRole(id, role) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.from('profiles').update({ role: role }).eq('id', id).then(function (r) {
      if (r.error) throw new Error(mapAuthError(r.error));
      return hydrateUsers();
    });
  }

  function setUserStatus(id, status) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.from('profiles').update({ status: status }).eq('id', id).then(function (r) {
      if (r.error) throw new Error(mapAuthError(r.error));
      return hydrateUsers();
    });
  }

  // ---------- solicitudes mayoristas ----------

  function getWholesaleRequests() { return read(NS.requests, []); }

  // No hace falta contraseña temporal: la cuenta ya es real (Supabase Auth) y
  // la persona ya eligió su propia contraseña al registrarse. Aprobar solo
  // activa el acceso; ya puede iniciar sesión con lo que registró.
  function approveWholesale(id) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    var r = find(getWholesaleRequests(), function (x) { return x.id === id; });
    if (!r) return Promise.reject(new Error('Solicitud no encontrada'));
    return sb.from('wholesale_requests')
      .update({ status: 'approved', reviewed_at: nowIso() })
      .eq('id', id)
      .then(function (res) {
        if (res.error) throw new Error(mapAuthError(res.error));
        return sb.from('profiles').update({ status: 'active', role: 'wholesale' }).eq('id', r.userId);
      })
      .then(function (res) {
        if (res.error) throw new Error(mapAuthError(res.error));
        return hydrateWholesale();
      });
  }

  function rejectWholesale(id, reason) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    var r = find(getWholesaleRequests(), function (x) { return x.id === id; });
    if (!r) return Promise.reject(new Error('Solicitud no encontrada'));
    return sb.from('wholesale_requests')
      .update({ status: 'rejected', reviewed_at: nowIso(), reject_reason: reason || null })
      .eq('id', id)
      .then(function (res) {
        if (res.error) throw new Error(mapAuthError(res.error));
        return sb.from('profiles').update({ status: 'rejected' }).eq('id', r.userId);
      })
      .then(function (res) {
        if (res.error) throw new Error(mapAuthError(res.error));
        return hydrateWholesale();
      });
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
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    var cfg = getConfig();
    var ad = cfg.auctionDefaults || {};
    var durationMs = (data.durationHours != null ? data.durationHours : ad.durationHours) * 3600 * 1000;
    var startsAt = data.startsAt || nowIso();
    var endsAt = new Date(new Date(startsAt).getTime() + durationMs).toISOString();
    var row = {
      product_id: data.productId,
      start_price: data.startPrice,
      current_bid: data.startPrice,
      reserve_price: data.reservePrice || data.startPrice,
      min_increment_pct: data.minIncrementPct || ad.minIncrementPct || 5,
      anti_snipe_seconds: data.antiSnipeSeconds != null ? data.antiSnipeSeconds : ad.antiSnipeSeconds,
      extension_seconds: data.extensionSeconds != null ? data.extensionSeconds : ad.extensionSeconds,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'scheduled'
    };
    return sb.from('auctions').insert(row).select().single().then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateAuctions().then(function () { return mapAuctionFromDb(res.data); });
    });
  }

  // Ediciones puntuales desde el panel (fechas, precios, parámetros); llega
  // en forma JS (camelCase) y se traduce campo a campo a columnas reales.
  function updateAuction(id, patch) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    var row = {};
    if (patch.startPrice != null) row.start_price = patch.startPrice;
    if (patch.reservePrice != null) row.reserve_price = patch.reservePrice;
    if (patch.minIncrementPct != null) row.min_increment_pct = patch.minIncrementPct;
    if (patch.antiSnipeSeconds != null) row.anti_snipe_seconds = patch.antiSnipeSeconds;
    if (patch.extensionSeconds != null) row.extension_seconds = patch.extensionSeconds;
    if (patch.startsAt != null) row.starts_at = patch.startsAt;
    if (patch.endsAt != null) row.ends_at = patch.endsAt;
    if (patch.status != null) row.status = patch.status;
    return sb.from('auctions').update(row).eq('id', id).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateAuctions();
    });
  }

  function deleteAuction(id) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.from('auctions').delete().eq('id', id).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateAuctions();
    });
  }

  function minNextBid(a) {
    var base = a.currentBid || a.startPrice;
    var inc = Math.max(1, Math.round(base * (a.minIncrementPct / 100)));
    return base + inc;
  }

  // Toda la validación (sesión, cuenta activa, puja mínima, anti-snipe) ahora
  // vive en el servidor (place_bid() en 02-security.sql), con bloqueo de fila
  // para que dos pujas simultáneas no se pisen entre sí.
  function placeBid(auctionId, amount) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.rpc('place_bid', { p_auction_id: auctionId, p_amount: Number(amount) }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return Promise.all([hydrateAuctions(), hydrateBids()]).then(function () {
        return mapAuctionFromDb(res.data);
      });
    });
  }

  // Cierre manual desde el panel ("Cerrar ahora"): mismo criterio de reserva
  // que el cierre automático, ejecutado en el servidor (close_auction()).
  function closeAuction(id) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    return sb.rpc('close_auction', { p_auction_id: id }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return hydrateAuctions().then(function () { return mapAuctionFromDb(res.data); });
    });
  }

  // Barre subastas vencidas y las cierra (close_expired_auctions() en el
  // servidor); cualquier visitante puede disparar el barrido de forma
  // inofensiva, por eso la función está otorgada a anon también.
  function autoCloseExpired() {
    if (!sb) return Promise.resolve();
    return sb.rpc('close_expired_auctions').then(function (res) {
      if (!res.error && res.data > 0) hydrateAuctions();
    });
  }

  // ---------- bids ----------

  function getBids() { return read(NS.bids, []); }
  function getBidsForAuction(auctionId) {
    return getBids()
      .filter(function (b) { return b.auctionId === auctionId; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  // ---------- carrito ----------

  function getCart() { return read(NS.cart, []); }

  function getCartItems() {
    return getCart().map(function (line) {
      var p = getProduct(line.productId);
      if (!p) return null;
      // Se cobra el precio efectivo (con descuento promocional si aplica),
      // no el precio de lista guardado en el producto.
      var price = getEffectivePrice(p);
      return Object.assign({}, p, { price: price, qty: line.qty, lineTotal: price * line.qty });
    }).filter(Boolean);
  }

  function getCartCount() {
    return getCart().reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function getCartTotal() {
    return getCartItems().reduce(function (sum, item) { return sum + item.lineTotal; }, 0);
  }

  function addToCart(productId, qty) {
    qty = Math.max(1, Number(qty) || 1);
    var cart = getCart();
    var line = find(cart, function (l) { return l.productId === productId; });
    if (line) line.qty += qty;
    else cart.push({ productId: productId, qty: qty });
    write(NS.cart, cart);
    return cart;
  }

  function setCartQty(productId, qty) {
    qty = Math.max(0, Number(qty) || 0);
    var cart = getCart();
    if (qty <= 0) {
      write(NS.cart, cart.filter(function (l) { return l.productId !== productId; }));
      return getCart();
    }
    var line = find(cart, function (l) { return l.productId === productId; });
    if (line) line.qty = qty;
    else cart.push({ productId: productId, qty: qty });
    write(NS.cart, cart);
    return getCart();
  }

  function removeFromCart(productId) {
    write(NS.cart, getCart().filter(function (l) { return l.productId !== productId; }));
  }

  function clearCart() { write(NS.cart, []); }

  // ---------- config ----------

  function getConfig() { return Object.assign({}, DEFAULT_CONFIG, read(NS.config, {})); }
  function saveConfig(partial) {
    var cur = read(NS.config, {});
    var next = Object.assign({}, cur, partial);
    if (partial.auctionDefaults) next.auctionDefaults = Object.assign({}, cur.auctionDefaults || {}, partial.auctionDefaults);
    if (partial.hero) next.hero = Object.assign({}, cur.hero || {}, partial.hero);
    if (partial.payments) next.payments = Object.assign({}, cur.payments || {}, partial.payments);
    // Escritura optimista: la caché local queda al día de inmediato (y notifica
    // a la UI vía scheduleEmit) para que descuentos/marcas se vean al instante,
    // sin esperar el viaje de ida y vuelta a Supabase. Realtime reconcilia luego.
    write(NS.config, next);
    if (!sb) return Promise.resolve(next);
    return sb.from('config').update({ data: next }).eq('id', 1).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return next;
    });
  }

  // ---------- pedidos ----------

  function getOrders() {
    return read(NS.orders, []).slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function getOrder(id) { return find(read(NS.orders, []), function (o) { return o.id === id; }) || null; }

  // Funciona sin sesión (compra como invitado): la política orders_insert
  // permite user_id = auth.uid() o user_id nulo.
  function createOrder(data) {
    var order = Object.assign({
      reference: 'CRONOS-' + Date.now().toString(36).toUpperCase(),
      status: 'pendiente', // pendiente | contactado | pagado | rechazado | cancelado
      paymentMethod: null, // 'wompi' | 'whatsapp'
      wompiTransactionId: null
    }, data);
    if (!sb) {
      var orders = read(NS.orders, []);
      order.id = uid('ORD'); order.createdAt = nowIso();
      orders.push(order); write(NS.orders, orders);
      return Promise.resolve(order);
    }
    return sb.from('orders').insert(mapOrderToDb(order)).select().single().then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateOrders().then(function () { return mapOrderFromDb(res.data); });
    });
  }

  function updateOrder(id, patch) {
    if (!sb) return Promise.reject(new Error('Backend no disponible'));
    var row = {};
    if (patch.status != null) row.status = patch.status;
    if (patch.paymentMethod != null) row.payment_method = patch.paymentMethod;
    if (patch.wompiTransactionId != null) row.wompi_transaction_id = patch.wompiTransactionId;
    return sb.from('orders').update(row).eq('id', id).then(function (res) {
      if (res.error) throw new Error(mapAuthError(res.error));
      return hydrateOrders();
    });
  }

  // ---------- pub/sub ----------

  function subscribe(fn) {
    subscribers.push(fn);
    return function unsubscribe() {
      subscribers = subscribers.filter(function (x) { return x !== fn; });
    };
  }

  // ---------- bootstrap ----------

  // Store.ready() resuelve cuando ya se confirmó contra Supabase si hay
  // sesión o no. Páginas que deciden algo importante con currentUser() antes
  // de pintar (ej. el guard de admin.html) deben esperar esto primero: sin
  // ello, en el primer instante currentUser() siempre da null (la promesa de
  // getSession() todavía no resuelve) y expulsarían a un admin real.
  var readyPromise;
  if (sb) {
    // La UI ya pinta con lo que haya en caché (localStorage de una visita
    // anterior, o vacío la primera vez); hydrateAll()/refreshProfile() traen
    // la verdad compartida y, junto con scheduleEmit(), hacen que todo lo que
    // esté suscrito a Store.subscribe() se vuelva a pintar solo.
    readyPromise = Promise.all([refreshProfile(), hydrateAll()]);
    initRealtime();
  } else {
    ensureLocalFallbackSeed();
    readyPromise = Promise.resolve();
  }
  function ready() { return readyPromise; }

  // ---------- API pública ----------

  global.Store = {
    // productos
    getProducts: getProducts,
    getWatchProducts: getWatchProducts,
    getProduct: getProduct,
    getProductByRef: getProductByRef,
    saveProduct: saveProduct,
    deleteProduct: deleteProduct,
    wholesalePriceFor: wholesalePriceFor,
    // descuentos promocionales
    getDiscounts: getDiscounts,
    setGlobalDiscount: setGlobalDiscount,
    setBrandDiscount: setBrandDiscount,
    setAccessoryCategoryDiscount: setAccessoryCategoryDiscount,
    getBrandDiscount: getBrandDiscount,
    getAccessoryCategoryDiscount: getAccessoryCategoryDiscount,
    getPriceDisplay: getPriceDisplay,
    getEffectivePrice: getEffectivePrice,
    // accesorios (gorras, correas, billeteras)
    ACCESSORY_CATEGORIES: ACCESSORY_CATEGORIES,
    getAccessoryCategories: getAccessoryCategories,
    getAccessoryProducts: getAccessoryProducts,
    setAccessoryCover: setAccessoryCover,
    // marcas y especificaciones
    getBrands: getBrands,
    getBrand: getBrand,
    addBrand: addBrand,
    renameBrand: renameBrand,
    setBrandCover: setBrandCover,
    moveBrand: moveBrand,
    deleteBrand: deleteBrand,
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
    deleteAuction: deleteAuction,
    minNextBid: minNextBid,
    placeBid: placeBid,
    closeAuction: closeAuction,
    autoCloseExpired: autoCloseExpired,
    syncAuctions: syncAuctions,
    // bids
    getBids: getBids,
    getBidsForAuction: getBidsForAuction,
    // carrito
    getCart: getCart,
    getCartItems: getCartItems,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    addToCart: addToCart,
    setCartQty: setCartQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    // pedidos
    getOrders: getOrders,
    getOrder: getOrder,
    createOrder: createOrder,
    updateOrder: updateOrder,
    // config
    getConfig: getConfig,
    saveConfig: saveConfig,
    // utilidades
    subscribe: subscribe,
    ready: ready,
    formatCOP: function (v) { return '$' + Number(v || 0).toLocaleString('es-CO'); },
    now: nowIso
  };
})(window);
