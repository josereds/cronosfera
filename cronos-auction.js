/* ============================================================
   Cronosfera · Subsistema de subastas
   ------------------------------------------------------------
   - Render de tarjetas de subasta
   - Countdown en vivo
   - Validación y colocación de pujas
   - Extensión anti-snipe
   ============================================================ */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function watchSVG(tone) {
    var bg = ({ ink: '#1a1c20', cool: '#323a42', bronze: '#6a5340', fog: '#dcd6cc', steel: '#a8a298', green: '#344a3a' })[tone] || '#1a1c20';
    var fg = (tone === 'fog' || tone === 'steel') ? '#3a342a' : '#e9e6df';
    var accent = '#c9a86a';
    return ''
      + '<svg viewBox="-110 -110 220 220">'
      +   '<circle r="105" fill="#5a5853"/>'
      +   '<circle r="94" fill="#3d3b37"/>'
      +   '<circle r="84" fill="' + bg + '"/>'
      +   '<g stroke="' + accent + '" stroke-width="1.6" stroke-linecap="round">'
      +     '<line x1="0" y1="-78" x2="0" y2="-68"/><line x1="78" y1="0" x2="68" y2="0"/><line x1="0" y1="78" x2="0" y2="68"/><line x1="-78" y1="0" x2="-68" y2="0"/>'
      +   '</g>'
      +   '<text y="-50" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="9" letter-spacing="3" fill="' + accent + '">CRONOSFERA</text>'
      +   '<line x1="0" y1="0" x2="0" y2="-50" stroke="' + fg + '" stroke-width="2.6" stroke-linecap="round"/>'
      +   '<line x1="0" y1="0" x2="36" y2="10" stroke="' + fg + '" stroke-width="2.6" stroke-linecap="round"/>'
      +   '<line x1="0" y1="0" x2="0" y2="58" stroke="' + accent + '" stroke-width="1" stroke-linecap="round"/>'
      +   '<circle r="3.4" fill="' + fg + '"/>'
      +   '<ellipse cx="-30" cy="-46" rx="48" ry="22" fill="#ffffff" opacity="0.05" transform="rotate(-25)"/>'
      + '</svg>';
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Finalizada';
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + 'd ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function statusBadge(status) {
    if (status === 'live') return '<span class="auc-badge live"><span class="pulse"></span>En vivo</span>';
    if (status === 'scheduled') return '<span class="auc-badge scheduled">Programada</span>';
    if (status === 'closed') return '<span class="auc-badge closed">Finalizada</span>';
    return '';
  }

  function findProduct(auction) {
    if (!auction || !auction.productId) return null;
    return global.Store.getProduct(auction.productId);
  }

  // ---------- Card render ----------

  function renderAuctionCard(auction, opts) {
    opts = opts || {};
    var p = findProduct(auction);
    var status = global.Store.getAuctionStatus(auction);
    var remaining = new Date(auction.endsAt).getTime() - Date.now();
    var href = 'subastas.html?id=' + encodeURIComponent(auction.id);
    var img = p ? watchSVG(p.tone) : watchSVG('ink');

    var productTitle = p ? (p.brand + ' · ' + p.model) : 'Subasta Cronosfera';
    var ref = p ? p.ref : '';

    var bids = global.Store.getBidsForAuction(auction.id);
    var bidsCount = bids.length;
    var currentDisplay = (auction.currentBid || auction.startPrice);

    var countdownHtml;
    if (status === 'live') {
      countdownHtml = '<div class="auc-countdown" data-ends="' + auction.endsAt + '">' + formatCountdown(remaining) + '</div>';
    } else if (status === 'scheduled') {
      countdownHtml = '<div class="auc-countdown scheduled">Inicia ' + new Date(auction.startsAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</div>';
    } else {
      countdownHtml = '<div class="auc-countdown closed">Finalizada</div>';
    }

    return ''
      + '<article class="auc-card ' + status + '"' + (opts.compact ? '' : ' data-aos') + '>'
      +   '<a href="' + href + '" class="auc-media">'
      +     '<div class="ph-img">' + img + '</div>'
      +     statusBadge(status)
      +   '</a>'
      +   '<div class="auc-body">'
      +     '<div class="auc-meta">'
      +       '<span class="auc-ref mono">' + escapeHtml(ref) + '</span>'
      +       '<span class="auc-bids">' + bidsCount + ' ' + (bidsCount === 1 ? 'puja' : 'pujas') + '</span>'
      +     '</div>'
      +     '<h3 class="auc-title"><a href="' + href + '">' + escapeHtml(productTitle) + '</a></h3>'
      +     '<div class="auc-price-row">'
      +       '<div class="auc-price-block">'
      +         '<span class="auc-price-lbl">' + (status === 'live' ? 'Puja actual' : 'Puja inicial') + '</span>'
      +         '<span class="auc-price">' + global.Store.formatCOP(currentDisplay) + '</span>'
      +       '</div>'
      +       countdownHtml
      +     '</div>'
      +     (opts.compact ? '' : '<a href="' + href + '" class="auc-cta">' + (status === 'live' ? 'Pujar ahora' : status === 'scheduled' ? 'Ver detalle' : 'Ver resultado') + ' →</a>')
      +   '</div>'
      + '</article>';
  }

  function renderAuctionDetail(auction, container) {
    var p = findProduct(auction);
    var status = global.Store.getAuctionStatus(auction);
    var bids = global.Store.getBidsForAuction(auction.id);
    var user = global.Store.currentUser();
    var minNext = global.Store.minNextBid(auction);

    var img = p ? watchSVG(p.tone) : watchSVG('ink');
    var title = p ? (p.brand + ' · ' + p.model) : 'Subasta Cronosfera';
    var ref = p ? p.ref : '';

    var bidFormHtml;
    if (status === 'live') {
      if (!user) {
        bidFormHtml = '<div class="bid-guest"><p>Para pujar necesitas una cuenta.</p><a href="login.html?next=subastas.html%3Fid%3D' + encodeURIComponent(auction.id) + '" class="btn-primary">Iniciar sesión</a></div>';
      } else {
        bidFormHtml = ''
          + '<form class="bid-form" data-auction="' + auction.id + '">'
          +   '<div class="bid-form-row">'
          +     '<label><span class="bid-form-lbl">Tu puja (COP)</span>'
          +       '<input type="number" name="amount" min="' + minNext + '" step="1000" value="' + minNext + '" required>'
          +     '</label>'
          +     '<button type="submit" class="btn-primary">Pujar</button>'
          +   '</div>'
          +   '<p class="bid-form-hint">Puja mínima: <strong>' + global.Store.formatCOP(minNext) + '</strong> · incremento mín. ' + auction.minIncrementPct + '%</p>'
          +   '<div class="bid-msg"></div>'
          + '</form>';
      }
    } else if (status === 'scheduled') {
      bidFormHtml = '<div class="bid-guest"><p>Esta subasta aún no comienza.</p><p class="muted">Empieza el ' + new Date(auction.startsAt).toLocaleString('es-CO') + '.</p></div>';
    } else {
      var winner = auction.winnerId ? global.Store.getUser(auction.winnerId) : null;
      bidFormHtml = '<div class="bid-guest ended"><p>Subasta finalizada.</p>' + (winner ? '<p class="muted">Ganador: <strong>' + escapeHtml(winner.name) + '</strong> · ' + global.Store.formatCOP(auction.currentBid) + '</p>' : '<p class="muted">No alcanzó el precio de reserva.</p>') + '</div>';
    }

    container.innerHTML = ''
      + '<div class="auc-detail">'
      +   '<div class="auc-detail-media">'
      +     '<div class="ph-img">' + img + '</div>'
      +     statusBadge(status)
      +   '</div>'
      +   '<div class="auc-detail-info">'
      +     '<div class="auc-detail-meta"><span class="mono">' + escapeHtml(ref) + '</span>' + statusBadge(status) + '</div>'
      +     '<h1 class="auc-detail-title">' + escapeHtml(title) + '</h1>'
      +     (p ? '<p class="auc-detail-lead">Reloj del catálogo Cronosfera. Pieza verificada, con garantía de originalidad y envío asegurado a toda Colombia.</p>' : '')
      +     '<div class="auc-price-row big">'
      +       '<div class="auc-price-block">'
      +         '<span class="auc-price-lbl">' + (status === 'live' ? 'Puja actual' : 'Puja inicial') + '</span>'
      +         '<span class="auc-price">' + global.Store.formatCOP(auction.currentBid || auction.startPrice) + '</span>'
      +       '</div>'
      +       '<div class="auc-countdown big" data-ends="' + auction.endsAt + '">' + (status === 'live' ? formatCountdown(new Date(auction.endsAt).getTime() - Date.now()) : status === 'scheduled' ? 'Programada' : 'Finalizada') + '</div>'
      +     '</div>'
      +     bidFormHtml
      +     '<div class="auc-detail-specs">'
      +       '<div><span>Precio inicial</span><strong>' + global.Store.formatCOP(auction.startPrice) + '</strong></div>'
      +       '<div><span>Precio de reserva</span><strong>' + global.Store.formatCOP(auction.reservePrice) + '</strong></div>'
      +       '<div><span>Incremento mínimo</span><strong>' + auction.minIncrementPct + '%</strong></div>'
      +       '<div><span>Finaliza</span><strong>' + new Date(auction.endsAt).toLocaleString('es-CO') + '</strong></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<section class="bid-history">'
      +   '<h3>Historial de pujas</h3>'
      +   (bids.length === 0 ? '<p class="empty">Aún no hay pujas. ¡Sé el primero!</p>'
            : '<table class="bid-table"><thead><tr><th>Puja</th><th>Pujador</th><th>Cuándo</th></tr></thead><tbody>'
      +       bids.map(function (b) {
                var u = global.Store.getUser(b.userId);
                var name = u ? u.name : 'Anónimo';
                // ocultar apellido completo por privacidad
                var parts = name.split(' ');
                var masked = parts.length > 1 ? parts[0] + ' ' + parts[1][0] + '.' : name;
                return '<tr><td class="mono">' + global.Store.formatCOP(b.amount) + '</td><td>' + escapeHtml(masked) + '</td><td class="muted">' + new Date(b.at).toLocaleString('es-CO') + '</td></tr>';
              }).join('')
      +     '</tbody></table>')
      + '</section>';

    bindBidForm(container, auction);
  }

  function bindBidForm(container, auction) {
    var form = container.querySelector('.bid-form');
    if (!form) return;
    var msg = form.querySelector('.bid-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = global.Store.currentUser();
      if (!user) { window.location.href = 'login.html?next=subastas.html%3Fid%3D' + encodeURIComponent(auction.id); return; }
      var amount = Number(new FormData(form).get('amount'));
      try {
        var updated = global.Store.placeBid(auction.id, user.id, amount);
        // Re-render para actualizar historial y minNext
        renderAuctionDetail(updated, container);
        var nextMsg = container.querySelector('.bid-msg');
        if (nextMsg) nextMsg.innerHTML = '<div class="bid-ok">✓ Puja registrada: ' + global.Store.formatCOP(amount) + '</div>';
      } catch (ex) {
        msg.innerHTML = '<div class="bid-err">' + escapeHtml(ex.message) + '</div>';
      }
    });
  }

  // ---------- Live countdown ticker ----------

  var tickerStarted = false;
  function startTicker() {
    if (tickerStarted) return;
    tickerStarted = true;
    setInterval(function () {
      global.Store.autoCloseExpired();
      var nodes = document.querySelectorAll('.auc-countdown[data-ends]');
      Array.prototype.forEach.call(nodes, function (n) {
        var ends = n.getAttribute('data-ends');
        var ms = new Date(ends).getTime() - Date.now();
        if (ms <= 0) {
          if (!n.classList.contains('closed')) {
            n.classList.add('closed');
            n.textContent = 'Finalizada';
          }
        } else {
          n.textContent = formatCountdown(ms);
          if (ms < 60000) n.classList.add('urgent');
          else n.classList.remove('urgent');
        }
      });
    }, 1000);
  }

  // ---------- Public API ----------

  global.Auction = {
    renderCard: renderAuctionCard,
    renderDetail: renderAuctionDetail,
    formatCountdown: formatCountdown,
    startTicker: startTicker,
    watchSVG: watchSVG
  };

  if (document.readyState !== 'loading') startTicker();
  else document.addEventListener('DOMContentLoaded', startTicker);
})(window);
