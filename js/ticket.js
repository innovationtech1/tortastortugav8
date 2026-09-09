// ═══════════════════════════════════════════════════════════════
//  ticket.js — Ticket digital de Tortas Tortuga (texto WhatsApp + PDF)
//
//  API global (recibe un objeto "pedido"):
//    window.ttEnviarTicketWA(p)   → abre WhatsApp con el ticket en texto
//    window.ttEnviarTicketPDF(p)  → genera el PDF y lo comparte / descarga
//
//  Requiere jsPDF (window.jspdf) para el PDF; el texto no lo necesita.
//  Es autónomo: no depende de la lógica de ninguna página en particular.
// ═══════════════════════════════════════════════════════════════
(function () {
  var TT_NEGOCIO = {
    slogan: 'Pare de sufrir, no se castigue',
    tel: '210-TORTA-10  |  210-86782-10',
    horario: 'Lun - Sab  10:00 AM - 6:00 PM',
    extra: 'We cater!'
  };

  function money(n) { return '$' + (Number(n) || 0).toFixed(2); }

  // Quita emojis/símbolos que la fuente del PDF no puede dibujar
  function soloTexto(s) {
    return String(s == null ? '' : s)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '')
      .replace(/\s+/g, ' ').trim();
  }

  function fechaTicket(p) {
    var d = (p.creado && p.creado.seconds) ? new Date(p.creado.seconds * 1000)
          : (p.tomadaEn ? new Date(p.tomadaEn) : new Date());
    try { return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return d.toLocaleString(); }
  }

  // Canal de compra: Online (cliente) / Domicilio / Tortumovil (empleado)
  function canalCompra(p) {
    var cajero = (p.cajeroNombre || '').trim().toLowerCase();
    var creadoPorEmpleado = cajero && cajero !== 'sistema';
    var esDom = (p.tipo === 'domicilio' || p.tipoServicio === 'Domicilio' || !!p.repartidorNombre);
    if (p.ordenoEnTortumovil === true) return 'Tortumovil';
    if (!creadoPorEmpleado) return 'Online';
    return esDom ? 'Domicilio' : 'Tortumovil';
  }

  // Agrupa los artículos (usa agruparItems de la página si existe)
  function grupos(p) {
    var items = p.itemsData;
    if (Array.isArray(items) && items.length) {
      if (window.agruparItems) return window.agruparItems(items);
      var map = {}, order = [];
      items.forEach(function (it) {
        var nombre = it.nombre || it.name || '';
        var variante = it.variante || it.opcion || '';
        var key = nombre + '|' + variante;
        if (!map[key]) { map[key] = { cantidad: 0, nombre: nombre, variante: variante, precio: parseFloat(it.precio) || 0, modificaciones: it.modificaciones || [] }; order.push(key); }
        map[key].cantidad += (it.cantidad || 1);
      });
      return order.map(function (k) { return map[k]; });
    }
    if (typeof p.items === 'string' && p.items.indexOf('Pendiente') < 0) {
      return p.items.split(' | ').map(function (s) { var idx = s.lastIndexOf(' - $'); return { cantidad: 1, nombre: idx > 0 ? s.slice(0, idx) : s, precio: idx > 0 ? (parseFloat(s.slice(idx + 4)) || 0) : 0 }; });
    }
    return [];
  }

  // Método de pago legible (incluye pago dividido)
  function metodoTexto(p) {
    if (p.estadoPago !== 'Pagado') return null;
    if (p.pagoDividido && Array.isArray(p.pagosDivididos) && p.pagosDivididos.length)
      return p.pagosDivididos.map(function (x) { return x.metodo + ' ' + money(x.monto); }).join(' + ');
    return p.metodoPagoReal || p.metodoPago || '';
  }

  // ── TICKET EN TEXTO (WhatsApp) ─────────────────────────────────
  function armarTicketWA(p) {
    var L = [];
    L.push('🐢 *TORTAS TORTUGA*');
    L.push('_Ticket de compra_');
    L.push('━━━━━━━━━━━━━━');
    L.push('🧾 ' + (p.folioStr || ('#' + (p.folio || ''))) + '   ·   ' + fechaTicket(p));
    L.push('👤 Nombre: ' + (soloTexto(p.cliente || p.nombre) || 'Cliente'));
    var tel = p.telefono || p.telefonoCliente || '';
    if (tel) L.push('📞 ' + tel);
    var canal = canalCompra(p);
    L.push((canal === 'Online' ? '🌐 ' : canal === 'Domicilio' ? '🚗 ' : '🚚 ') + canal);
    L.push('━━━━━━━━━━━━━━');
    L.push('🛍️ *Tu orden:*');
    var gs = grupos(p);
    if (gs.length) {
      gs.forEach(function (g) {
        L.push('• ' + (g.cantidad || 1) + '× ' + soloTexto(g.nombre) + (g.variante ? ' (' + soloTexto(g.variante) + ')' : '') + (g.precio ? '  ' + money(g.precio) : ''));
      });
    } else { L.push('• (Orden por definir)'); }
    L.push('━━━━━━━━━━━━━━');
    var d = p.desglose || {};
    if (d.subtotal != null) L.push('Subtotal:   ' + money(d.subtotal));
    if (d.descuento) L.push('Descuento: -' + money(d.descuento));
    if (d.impuesto != null) L.push('Impuesto:   ' + money(d.impuesto));
    if (d.propina) L.push('Propina:    ' + money(d.propina));
    if (p.cargoServicio) L.push('Envio:      ' + money(p.cargoServicio));
    L.push('💵 *TOTAL: ' + (p.total || money(p.totalNum)) + '*');
    var met = metodoTexto(p);
    L.push(met != null ? ('✅ Pagado' + (met ? ' — ' + met : '')) : '⏳ Por pagar');
    L.push('━━━━━━━━━━━━━━');
    L.push('"' + TT_NEGOCIO.slogan + '"  ' + TT_NEGOCIO.extra);
    L.push('¡Gracias por tu compra! 🐢');
    return L.join('\n');
  }

  function telParaWA(p) {
    var tel = String(p.telefono || p.telefonoCliente || '').replace(/[^0-9]/g, '');
    if (tel.length === 10) tel = '1' + tel; // USA por defecto
    return tel;
  }

  window.ttEnviarTicketWA = function (p) {
    if (!p) { alert('No se encontró el pedido.'); return; }
    var tel = telParaWA(p);
    if (!tel) { alert('Este pedido no tiene teléfono del cliente.'); return; }
    var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(armarTicketWA(p));
    window.open(url, '_blank');
  };

  // ── DIBUJO DEL PDF ─────────────────────────────────────────────
  function dibujarTortuga(doc, cx, cy, s) {
    var crema = [255, 241, 222], seg = [214, 92, 24];
    doc.setFillColor(crema[0], crema[1], crema[2]);
    doc.ellipse(cx - s*1.05, cy + s*0.62, s*0.34, s*0.26, 'F');
    doc.ellipse(cx + s*1.05, cy + s*0.62, s*0.34, s*0.26, 'F');
    doc.ellipse(cx - s*1.00, cy - s*0.52, s*0.30, s*0.24, 'F');
    doc.ellipse(cx + s*1.00, cy - s*0.52, s*0.30, s*0.24, 'F');
    doc.ellipse(cx, cy + s*1.15, s*0.20, s*0.30, 'F');
    doc.circle(cx, cy - s*1.30, s*0.44, 'F');
    doc.ellipse(cx, cy, s*1.25, s*0.98, 'F');
    doc.setDrawColor(seg[0], seg[1], seg[2]); doc.setLineWidth(0.25);
    doc.line(cx - s*0.62, cy - s*0.45, cx - s*0.40, cy + s*0.62);
    doc.line(cx + s*0.62, cy - s*0.45, cx + s*0.40, cy + s*0.62);
    doc.line(cx - s*0.95, cy - s*0.02, cx + s*0.95, cy - s*0.02);
  }

  function construirPDF(p) {
    var jsPDF = window.jspdf.jsPDF;
    var W = 80, M = 8, innerW = W - M * 2;
    var ORANGE = [255, 90, 0], DARK = [35, 31, 28], GREY = [120, 120, 120], CREAM = [255, 246, 238], GREEN = [0, 150, 60];

    var folio = p.folioStr || ('#' + (p.folio || ''));
    var cliente = soloTexto(p.cliente || p.nombre) || 'Cliente';
    var tel = p.telefono || p.telefonoCliente || '';
    var canal = canalCompra(p);
    var gs = grupos(p);
    var d = p.desglose || {};

    var tmp = new jsPDF({ unit: 'mm', format: [W, 300] });
    tmp.setFont('helvetica', 'normal'); tmp.setFontSize(9);
    var itemLineas = gs.map(function (g) {
      var etq = (g.cantidad || 1) + 'x ' + soloTexto(g.nombre || '') + (g.variante ? ' (' + soloTexto(g.variante) + ')' : '');
      return tmp.splitTextToSize(etq, innerW - 16);
    });

    var filas = 0;
    if (d.subtotal != null) filas++; if (d.descuento) filas++; if (d.impuesto != null) filas++; if (d.propina) filas++; if (p.cargoServicio) filas++;
    var boxH = 6 + filas * 4.6 + 9;

    var y = 34 + 8 + 5 + (tel ? 4.5 : 0) + 4.5 + 6;
    itemLineas.forEach(function (ls) { y += ls.length * 4.2 + 1.5; });
    y += 3 + boxH + 4 + 8 + 22;
    var H = Math.max(124, y);

    var doc = new jsPDF({ unit: 'mm', format: [W, H] });
    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.setLineWidth(0.7);
    doc.roundedRect(2.5, 2.5, W - 5, H - 5, 3, 3, 'S');
    doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.roundedRect(2.5, 2.5, W - 5, 30, 3, 3, 'F');
    doc.rect(2.5, 20, W - 5, 12.5, 'F');
    dibujarTortuga(doc, W / 2, 10, 3.1);
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(14.5);
    doc.text('TORTAS TORTUGA', W/2, 24, { align: 'center' });
    doc.setFont('helvetica','italic'); doc.setFontSize(7);
    doc.text(TT_NEGOCIO.slogan, W/2, 29.5, { align: 'center' });

    var cy = 40;
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.setFont('helvetica','bold'); doc.setFontSize(12);
    doc.text(String(folio), M, cy);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.text(fechaTicket(p), W - M, cy, { align: 'right' });
    cy += 6.5;
    doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
    doc.text('Nombre: ' + cliente, M, cy); cy += 5;
    doc.setFont('helvetica','normal'); doc.setTextColor(90,90,90); doc.setFontSize(8);
    if (tel) { doc.text('Tel: ' + tel, M, cy); cy += 4.5; }
    doc.text('Compra: ' + canal, M, cy); cy += 4;

    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.setLineWidth(0.4);
    doc.line(M, cy, W - M, cy); cy += 5;
    doc.setFont('helvetica','bold'); doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.setFontSize(8.5);
    doc.text('TU ORDEN', M, cy); cy += 5;

    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    gs.forEach(function (g, i) {
      var ls = itemLineas[i];
      doc.setTextColor(45,45,45);
      ls.forEach(function (line, j) { doc.text(line, M, cy + j*4.2); });
      if (g.precio) { doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.setFont('helvetica','bold'); doc.text(money(g.precio), W - M, cy, { align: 'right' }); doc.setFont('helvetica','normal'); }
      cy += ls.length * 4.2 + 1.5;
    });
    cy += 3;

    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.roundedRect(M - 1.5, cy, innerW + 3, boxH, 2, 2, 'F');
    var ty = cy + 6;
    doc.setFontSize(8.5);
    function fila(label, val) { doc.setTextColor(95,95,95); doc.setFont('helvetica','normal'); doc.text(label, M + 1, ty); doc.text(val, W - M - 1, ty, { align: 'right' }); ty += 4.6; }
    if (d.subtotal != null) fila('Subtotal', money(d.subtotal));
    if (d.descuento) fila('Descuento', '-' + money(d.descuento));
    if (d.impuesto != null) fila('Impuesto', money(d.impuesto));
    if (d.propina) fila('Propina', money(d.propina));
    if (p.cargoServicio) fila('Envio', money(p.cargoServicio));
    ty += 1;
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text('TOTAL', M + 1, ty); doc.text(String(p.total || money(p.totalNum)), W - M - 1, ty, { align: 'right' });
    cy += boxH + 6;

    var met = metodoTexto(p);
    var pillTxt = (met != null) ? ('PAGADO' + (met ? ('  ·  ' + met) : '')) : 'POR PAGAR';
    var pillCol = (met != null) ? [37, 160, 90] : [230, 140, 0];
    doc.setFontSize(8.5); doc.setFont('helvetica','bold');
    var pw = doc.getTextWidth(pillTxt) + 8; if (pw > innerW) pw = innerW;
    var px = (W - pw) / 2;
    doc.setFillColor(pillCol[0], pillCol[1], pillCol[2]);
    doc.roundedRect(px, cy - 4, pw, 6.5, 3.2, 3.2, 'F');
    doc.setTextColor(255,255,255);
    doc.text(pillTxt, W/2, cy + 0.4, { align: 'center' });
    cy += 9;

    doc.setDrawColor(230, 200, 180); doc.setLineWidth(0.3);
    doc.line(M, cy, W - M, cy); cy += 4.5;
    doc.setFont('helvetica','bolditalic'); doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]); doc.setFontSize(7.5);
    doc.text('"' + TT_NEGOCIO.slogan + '"', W/2, cy, { align: 'center' }); cy += 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    doc.text(TT_NEGOCIO.extra, W/2, cy, { align: 'center' }); cy += 4.2;
    doc.setFont('helvetica','normal'); doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.setFontSize(7.5);
    doc.text(TT_NEGOCIO.tel, W/2, cy, { align: 'center' }); cy += 3.8;
    doc.text(TT_NEGOCIO.horario, W/2, cy, { align: 'center' }); cy += 4.2;
    doc.setFont('helvetica','bold'); doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.setFontSize(8);
    doc.text('Gracias por tu compra!', W/2, cy, { align: 'center' });

    return doc.output('blob');
  }

  window.ttEnviarTicketPDF = async function (p) {
    if (!p) { alert('No se encontró el pedido.'); return; }
    if (!(window.jspdf && window.jspdf.jsPDF)) { alert('El generador de PDF está cargando, intenta en 2 segundos.'); return; }
    try {
      var blob = construirPDF(p);
      var folio = String(p.folioStr || p.folio || '').replace(/[^\w-]/g, '') || 'ticket';
      var nombreArch = 'Ticket_TortasTortuga_' + folio + '.pdf';
      var file = new File([blob], nombreArch, { type: 'application/pdf' });
      var texto = 'Aquí está tu ticket de compra 🐢 ¡Gracias por tu preferencia!';
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Ticket Tortas Tortuga', text: texto });
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nombreArch; document.body.appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 2000);
      if (window.ttAlert) window.ttAlert('📄 Ticket PDF descargado. Compártelo en WhatsApp para enviarlo al cliente.');
      else alert('Ticket PDF descargado. Compártelo en WhatsApp para enviarlo al cliente.');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error('Error al generar el ticket PDF:', e);
      alert('No se pudo generar el PDF: ' + (e.message || e));
    }
  };
})();
