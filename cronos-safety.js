/* ============================================================
   Cronosfera · Red de seguridad del cliente
   ------------------------------------------------------------
   Este archivo se carga PRIMERO en cada página y es independiente
   del resto: si cualquier otro script falla, este sigue vivo.

   Resuelve el problema de la "pantalla negra": el contenido del
   sitio nace con opacity:0 y solo se ve cuando el JS de animación
   le agrega la clase .in. Si ese JS moría (navegador viejo, CDN
   caído, conexión lenta), el visitante quedaba mirando el fondo
   oscuro sin un solo mensaje.

   Hace cuatro cosas:
     1. Failsafe de visibilidad: pase lo que pase, el contenido se
        muestra (por tiempo y ante cualquier error).
     2. Captura errores globales y los manda a Supabase.
     3. Si un <script> crítico no carga, recarga UNA sola vez.
     4. Expone CronosSafety.showFallback() para mostrar una pantalla
        legible en vez de dejar al usuario en blanco/negro.
   ============================================================ */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://bikmwxucsbbjouoqwknc.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpa213eHVjc2Jiam91b3F3a25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NjY5NjAsImV4cCI6MjEwMDM0Mjk2MH0.nfylTZ6pJoY15unrQVCgdiqma_dn9OXcBXiDjWLWIRQ';

  var RELOAD_FLAG = 'cronos-recovery-reload';
  var REVEAL_MS = 2500;   // si a los 2.5s el JS no reveló, revelamos nosotros
  var reported = 0;       // tope de errores enviados por carga de página

  // ---------------------------------------------------------------
  // 1) Failsafe de visibilidad
  // ---------------------------------------------------------------
  // Marca el documento como "el JS está vivo". El CSS solo esconde el
  // contenido para animarlo cuando existe esta clase; sin ella, todo
  // se ve por defecto. Así, si este archivo tampoco cargara, el sitio
  // igual se vería (sin animación).
  try {
    var root = document.documentElement;
    if (root.className.indexOf('js') === -1) root.className += ' js';
  } catch (e) { /* nada que hacer */ }

  function revealAll() {
    try {
      var els = document.querySelectorAll('.reveal, [data-aos]');
      for (var i = 0; i < els.length; i++) {
        if (els[i].className.indexOf('in') === -1) els[i].className += ' in';
      }
    } catch (e) { /* si ni esto se puede, el CSS por defecto ya los muestra */ }
  }

  function armFailsafe() { global.setTimeout(revealAll, REVEAL_MS); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', armFailsafe);
  } else {
    armFailsafe();
  }
  // Y una segunda red después de load, por si la página tardó mucho.
  global.addEventListener('load', function () { global.setTimeout(revealAll, 1200); });

  // ---------------------------------------------------------------
  // 2) Registro de errores en Supabase
  // ---------------------------------------------------------------
  function logError(payload) {
    if (reported >= 5) return;            // no inundar la tabla
    reported++;
    try {
      var body = {
        kind: payload.kind || 'error',
        message: String(payload.message || '').slice(0, 1000),
        source: String(payload.source || '').slice(0, 500),
        lineno: payload.lineno || null,
        colno: payload.colno || null,
        stack: String(payload.stack || '').slice(0, 2000),
        url: String(global.location && global.location.href || '').slice(0, 500),
        user_agent: String(global.navigator && global.navigator.userAgent || '').slice(0, 500),
        screen_size: (global.screen ? global.screen.width + 'x' + global.screen.height : '') +
          ' @' + (global.devicePixelRatio || 1)
      };
      // fetch plano: no dependemos del cliente de Supabase, que puede ser
      // justamente lo que falló.
      if (global.fetch) {
        global.fetch(SUPABASE_URL + '/rest/v1/client_errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(body),
          keepalive: true
        })['catch'](function () { /* si no se puede reportar, seguimos */ });
      }
    } catch (e) { /* jamás romper por el logger */ }
  }

  // ---------------------------------------------------------------
  // 3) Errores globales + recuperación de scripts que no cargan
  // ---------------------------------------------------------------
  function isCriticalScript(src) {
    if (!src) return false;
    return /cronos-[a-z]+\.js/.test(src) || /supabase/.test(src);
  }

  // useCapture = true: así también llegan los errores de CARGA de recursos
  // (<script> o <link> que no bajaron), que no burbujean.
  global.addEventListener('error', function (ev) {
    var target = ev && ev.target;
    var isResource = target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK');

    if (isResource) {
      var src = target.src || target.href || '';
      logError({ kind: 'resource', message: 'No cargó el recurso: ' + src, source: src });
      // Equivalente al "chunk obsoleto": si no bajó un script esencial,
      // recargamos UNA vez por si fue un despliegue nuevo o un corte puntual.
      if (isCriticalScript(src)) {
        var already;
        try { already = global.sessionStorage.getItem(RELOAD_FLAG); } catch (e) { already = '1'; }
        if (!already) {
          try { global.sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) {}
          global.location.reload();
          return;
        }
        // Ya recargamos una vez y sigue fallando: mostramos algo legible.
        showFallback('No pudimos cargar el contenido del sitio.');
      }
      return;
    }

    // Error de JavaScript: revelamos el contenido de inmediato para que la
    // animación a medio camino no deje la página en negro.
    revealAll();
    logError({
      kind: 'error',
      message: ev.message,
      source: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error && ev.error.stack
    });
  }, true);

  global.addEventListener('unhandledrejection', function (ev) {
    revealAll();
    var r = ev && ev.reason;
    logError({
      kind: 'unhandledrejection',
      message: (r && r.message) || String(r),
      stack: r && r.stack
    });
  });

  // Si la recarga de recuperación funcionó, limpiamos la marca.
  global.addEventListener('load', function () {
    try { global.sessionStorage.removeItem(RELOAD_FLAG); } catch (e) {}
  });

  // ---------------------------------------------------------------
  // 4) Pantalla de respaldo legible (nunca dejar en negro)
  // ---------------------------------------------------------------
  function showFallback(message, detail) {
    if (document.getElementById('cronosFallback')) return;
    revealAll();
    var box = document.createElement('div');
    box.id = 'cronosFallback';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;'
      + 'justify-content:center;padding:24px;background:#14161c;color:#f2efe9;'
      + 'font-family:Inter,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center';
    box.innerHTML = ''
      + '<div style="max-width:420px">'
      +   '<img src="logo-cronosfera.svg" alt="Cronosfera" style="width:120px;margin:0 auto 22px;display:block"'
      +     ' onerror="this.style.display=\'none\'">'
      +   '<h1 style="font-size:22px;font-weight:600;margin:0 0 10px">' + esc(message || 'No pudimos cargar el contenido') + '</h1>'
      +   '<p style="font-size:15px;line-height:1.5;opacity:.8;margin:0 0 22px">'
      +     'Puede ser tu conexión o un problema temporal. Intenta de nuevo.'
      +   '</p>'
      +   '<button id="cronosRetry" style="background:#c9a86a;color:#1a1c20;border:0;border-radius:8px;'
      +     'padding:12px 24px;font-size:15px;font-weight:600;cursor:pointer">Reintentar</button>'
      +   (detail ? '<p style="font-size:12px;opacity:.45;margin-top:18px;word-break:break-word">' + esc(detail) + '</p>' : '')
      + '</div>';
    document.body.appendChild(box);
    var btn = document.getElementById('cronosRetry');
    if (btn) btn.onclick = function () {
      try { global.sessionStorage.removeItem(RELOAD_FLAG); } catch (e) {}
      global.location.reload();
    };
  }

  function hideFallback() {
    var el = document.getElementById('cronosFallback');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.CronosSafety = {
    revealAll: revealAll,
    showFallback: showFallback,
    hideFallback: hideFallback,
    logError: logError
  };
})(window);
