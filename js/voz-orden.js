/* ═══════════════════════════════════════════════════════════════
   TORTAS TORTUGA · Ordenar por voz (Web Speech API)
   - Botón de micrófono flotante en la pantalla de Ordenar.
   - Dicta la orden → interpreta contra el menú → muestra panel de
     confirmación → al confirmar, agrega al carrito (_cuentasSys).
   - Reconocimiento gratuito del navegador (Chrome/Android, Safari/iOS).
   - Autónomo: no modifica la lógica existente del menú/carrito.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Soporte del navegador ──────────────────────────────────────
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ── Utilidades de texto ────────────────────────────────────────
  function normalizar(txt) {
    return (txt || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^a-z0-9ñ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Números hablados en español → dígito
  var NUMEROS = {
    'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
    'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
    'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19, 'veinte': 20
  };

  function palabraANumero(w) {
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    if (NUMEROS[w] != null) return NUMEROS[w];
    return null;
  }

  // Palabras de TAMAÑO/VARIANTE → la palabra clave que aparece en el label
  // (los labels del menú usan SINGLE / DOUBLE / TRIPLE en inglés).
  var TAMANOS = {
    'single': 'single', 'sencilla': 'single', 'sencillo': 'single',
    'simple': 'single', 'chica': 'single', 'chico': 'single', 'individual': 'single',
    'double': 'double', 'doble': 'double', 'mediana': 'double', 'mediano': 'double',
    'triple': 'triple', 'grande': 'triple'
  };

  // Detectar si el texto menciona un tamaño; devuelve 'single'|'double'|'triple' o null
  function detectarTamano(texto) {
    var palabras = (texto || '').split(' ');
    for (var i = 0; i < palabras.length; i++) {
      if (TAMANOS[palabras[i]]) return TAMANOS[palabras[i]];
    }
    return null;
  }

  // Elegir la variante de un producto según el tamaño pedido.
  // Devuelve { label, precio, idx } o null si el producto no tiene variantes.
  function elegirVariante(prodRef, tamano) {
    var vars = (prodRef && prodRef.variantes) || [];
    if (!vars.length) return null;
    // Si pidió un tamaño, buscar la variante cuyo label lo contenga
    if (tamano) {
      for (var i = 0; i < vars.length; i++) {
        var lblNorm = normalizar(vars[i].label || '');
        if (lblNorm.indexOf(tamano) >= 0) {
          return { label: vars[i].label || '', precio: parseFloat(vars[i].precio) || 0, idx: i };
        }
      }
    }
    // Si no pidió tamaño (o no se encontró): usar la primera variante por defecto
    return { label: vars[0].label || '', precio: parseFloat(vars[0].precio) || 0, idx: 0 };
  }

  // Distancia simple para tolerar errores de dictado (Levenshtein acotado)
  function similitud(a, b) {
    a = a || ''; b = b || '';
    if (a === b) return 1;
    var la = a.length, lb = b.length;
    if (!la || !lb) return 0;
    var d = [];
    for (var i = 0; i <= la; i++) d[i] = [i];
    for (var j = 0; j <= lb; j++) d[0][j] = j;
    for (i = 1; i <= la; i++) {
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    var dist = d[la][lb];
    return 1 - dist / Math.max(la, lb);
  }

  // ── Lista de productos del menú (de window._menuProductos) ──────
  function obtenerProductos() {
    var prods = window._menuProductos || [];
    return prods.map(function (p) {
      return {
        ref: p,
        nombre: p.nombre || 'Producto',
        nombreNorm: normalizar(p.nombre || ''),
        precio: parseFloat(p.precio) || 0,
        categoria: p.categoria || 'tortas',
        tipo: p.tipo || 'torta'
      };
    });
  }

  // Encontrar el mejor producto para un fragmento de texto dictado
  function emparejar(fragmento, productos) {
    var fn = normalizar(fragmento);
    if (!fn) return null;
    var mejor = null, mejorScore = 0;
    productos.forEach(function (p) {
      var score = 0;
      // 1) Coincidencia por contención de palabras clave
      var palabras = p.nombreNorm.split(' ').filter(function (w) { return w.length > 2; });
      var hits = palabras.filter(function (w) { return fn.indexOf(w) >= 0; }).length;
      if (palabras.length) score = hits / palabras.length;
      // 2) Reforzar con similitud global
      var sim = similitud(fn, p.nombreNorm);
      score = Math.max(score, sim);
      // 3) Si el nombre del producto está contenido literal, es casi seguro
      if (fn.indexOf(p.nombreNorm) >= 0 && p.nombreNorm.length > 3) score = 1;
      if (score > mejorScore) { mejorScore = score; mejor = p; }
    });
    // Umbral mínimo para considerar que sí lo reconoció
    return mejorScore >= 0.45 ? { producto: mejor, score: mejorScore } : null;
  }

  // ── Interpretar la frase completa en una lista de items ─────────
  // Separa por conectores ("y", "más", comas) y por cada producto
  // detecta la cantidad que lo precede.
  function interpretar(texto) {
    var productos = obtenerProductos();
    if (!productos.length) return { items: [], noMenu: true };

    var limpio = normalizar(texto)
      .replace(/\bmas\b/g, ' , ')
      .replace(/\btambien\b/g, ' , ')
      .replace(/\by\b/g, ' , ')
      .replace(/\bademas\b/g, ' , ');

    var trozos = limpio.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var items = [];

    trozos.forEach(function (trozo) {
      // Detectar cantidad al inicio del trozo
      var palabras = trozo.split(' ');
      var cantidad = 1;
      var resto = trozo;
      var num = palabraANumero(palabras[0]);
      if (num != null) {
        cantidad = num;
        resto = palabras.slice(1).join(' ');
      }
      // Detectar tamaño (sencilla/doble/triple) en este trozo
      var tamano = detectarTamano(trozo);
      var match = emparejar(resto, productos);
      if (match) {
        var variante = elegirVariante(match.producto.ref, tamano);
        items.push({
          producto: match.producto,
          cantidad: cantidad,
          confianza: match.score,
          tamano: tamano,
          variante: variante // { label, precio, idx } o null
        });
      }
    });

    return { items: items, noMenu: false };
  }

  // ── Agregar los items confirmados al carrito ────────────────────
  function agregarAlCarrito(items) {
    if (!window._cuentasSys) {
      window._cuentasSys = {
        cuentas: [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }],
        activa: 1, counter: 1
      };
    }
    var CS = window._cuentasSys;
    var ca = CS.cuentas.find(function (x) { return x.id === CS.activa; });
    if (!ca) { ca = CS.cuentas[0]; CS.activa = ca.id; }

    items.forEach(function (it) {
      var p = it.producto;
      var v = it.variante; // { label, precio, idx } o null
      var precio = v ? v.precio : p.precio;
      var varLabel = v ? v.label : '';
      var varIdx = v ? v.idx : 0;
      // Lista completa de variantes (para poder cambiarla desde el carrito)
      var variantesDisp = ((p.ref && p.ref.variantes) || []).map(function (vv) {
        return { label: vv.label || '', precio: parseFloat(vv.precio) || 0 };
      });
      for (var i = 0; i < it.cantidad; i++) {
        ca.items.push({
          id: (p.ref && (p.ref.productId || p.ref.id)) || ('voz_' + Date.now() + '_' + i),
          nombre: p.nombre,
          precio: precio,
          precioBase: precio,
          variante: varLabel,
          varianteIdx: varIdx,
          variantesDisp: variantesDisp,
          categoria: p.categoria,
          tipo: p.tipo,
          modificaciones: []
        });
      }
    });

    // Refrescar el carrito con las funciones que ya existen
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) window.renderCartItems();
    if (window.renderCarrito) window.renderCarrito();
    if (window.actualizarBadgeCarrito) window.actualizarBadgeCarrito();
  }

  // ── UI: panel de confirmación ───────────────────────────────────
  function mostrarConfirmacion(resultado, textoDictado) {
    cerrarPanel();
    var ov = document.createElement('div');
    ov.id = 'voz-panel';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.3rem;';

    var items = resultado.items;
    var cuerpo;

    if (resultado.noMenu) {
      cuerpo = '<div style="text-align:center;color:#FBB724;font-size:.9rem;padding:1rem;">El menú todavía no termina de cargar. Intenta de nuevo en un momento.</div>';
    } else if (!items.length) {
      cuerpo = '<div style="text-align:center;color:#ddd;font-size:.9rem;line-height:1.5;">No entendí ningún producto del menú.<br><span style="color:#888;font-size:.82rem;">Dijiste: "' + (textoDictado || '') + '"</span><br><br>Intenta de nuevo, por ejemplo:<br><span style="color:#FF7A33;">"dos original torta tortuga y un shrimp tortuga"</span></div>';
    } else {
      var total = 0;
      var filas = items.map(function (it, idx) {
        var precioU = it.variante ? it.variante.precio : it.producto.precio;
        var sub = precioU * it.cantidad;
        total += sub;
        var dudoso = it.confianza < 0.65;
        // Etiqueta corta del tamaño elegido (Sencilla/Doble/Triple)
        var tamTxt = '';
        if (it.tamano === 'single') tamTxt = 'Sencilla';
        else if (it.tamano === 'double') tamTxt = 'Doble';
        else if (it.tamano === 'triple') tamTxt = 'Triple';
        // Si el producto tiene variantes pero no se dijo tamaño, avisar que va por defecto
        var tieneVars = it.producto.ref && it.producto.ref.variantes && it.producto.ref.variantes.length > 1;
        var subtitulo = '';
        if (tamTxt) subtitulo = '<div style="font-size:.72rem;color:#FF9D5C;font-weight:600;">🍴 ' + tamTxt + '</div>';
        else if (tieneVars) subtitulo = '<div style="font-size:.68rem;color:#888;">tamaño por defecto · di "sencilla/doble/triple"</div>';
        return '<div style="display:flex;align-items:center;gap:.6rem;background:rgba(255,255,255,.04);border:1px solid ' + (dudoso ? 'rgba(251,183,36,.4)' : 'rgba(37,211,102,.3)') + ';border-radius:10px;padding:.6rem .7rem;margin-bottom:.5rem;">' +
          '<span style="font-size:1rem;font-weight:900;color:#FF7A33;min-width:2rem;">' + it.cantidad + '×</span>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:.9rem;font-weight:700;color:#fff;line-height:1.2;">' + it.producto.nombre + '</div>' +
          subtitulo +
          (dudoso ? '<div style="font-size:.68rem;color:#FBB724;">⚠️ ¿es correcto?</div>' : '') + '</div>' +
          '<span style="font-size:.85rem;font-weight:800;color:#25D366;">$' + sub.toFixed(2) + '</span>' +
          '<button onclick="window._vozQuitar(' + idx + ')" style="background:rgba(255,68,68,.15);border:1px solid rgba(255,68,68,.4);color:#FF6B6B;width:28px;height:28px;border-radius:7px;cursor:pointer;font-family:inherit;">✕</button>' +
          '</div>';
      }).join('');
      cuerpo = '<div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem;">🎤 Entendí tu orden</div>' +
        filas +
        '<div style="display:flex;justify-content:space-between;font-weight:900;font-size:1rem;color:#25D366;border-top:1px solid rgba(255,255,255,.1);margin-top:.5rem;padding-top:.5rem;"><span>Total</span><span>$' + total.toFixed(2) + '</span></div>';
    }

    var botones;
    if (items.length) {
      botones = '<button onclick="window._vozConfirmar()" style="flex:2;padding:.85rem;background:linear-gradient(135deg,#25D366,#18a849);border:none;color:#fff;border-radius:12px;font-family:inherit;font-weight:800;font-size:.92rem;cursor:pointer;">✅ Agregar al carrito</button>' +
        '<button onclick="window._vozReintentar()" style="flex:1;padding:.85rem;background:rgba(255,90,0,.15);border:1px solid rgba(255,90,0,.4);color:#FF7A33;border-radius:12px;font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;">🎤 Otra vez</button>';
    } else {
      botones = '<button onclick="window._vozReintentar()" style="flex:2;padding:.85rem;background:linear-gradient(135deg,#FF7A33,#FF5A00);border:none;color:#fff;border-radius:12px;font-family:inherit;font-weight:800;font-size:.9rem;cursor:pointer;">🎤 Intentar de nuevo</button>';
    }

    ov.innerHTML =
      '<div style="background:#1C1C1C;border:1px solid rgba(255,90,0,.3);border-radius:20px;padding:1.4rem 1.2rem;max-width:380px;width:100%;max-height:80vh;overflow-y:auto;">' +
        cuerpo +
        '<div style="display:flex;gap:.6rem;margin-top:1rem;">' + botones +
          '<button onclick="window._vozCerrar()" style="flex:1;padding:.85rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#ccc;border-radius:12px;font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;">Cerrar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrarPanel(); });

    // Guardar el resultado actual para los botones
    window._vozResultadoActual = resultado;
  }

  function cerrarPanel() {
    var p = document.getElementById('voz-panel');
    if (p) p.remove();
  }

  // ── Panel "escuchando..." ───────────────────────────────────────
  function mostrarEscuchando() {
    cerrarPanel();
    var ov = document.createElement('div');
    ov.id = 'voz-panel';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.3rem;';
    ov.innerHTML =
      '<div style="background:#1C1C1C;border:1px solid rgba(255,90,0,.3);border-radius:20px;padding:2rem 1.5rem;max-width:340px;width:100%;text-align:center;">' +
        '<div style="font-size:3.5rem;margin-bottom:.6rem;animation:vozPulse 1s ease-in-out infinite;">🎤</div>' +
        '<div style="font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:.4rem;">Escuchando…</div>' +
        '<div id="voz-parcial" style="font-size:.85rem;color:#FF7A33;min-height:1.2rem;margin-bottom:1rem;">Di tu orden en voz alta</div>' +
        '<div style="font-size:.72rem;color:#888;line-height:1.5;margin-bottom:1.2rem;">Ejemplo: "dos original torta <b>triple</b> y una <b>doble</b> turkey"<br>Di <b>sencilla</b>, <b>doble</b> o <b>triple</b> para el tamaño.</div>' +
        '<button onclick="window._vozCancelarEscucha()" style="width:100%;padding:.75rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#ccc;border-radius:12px;font-family:inherit;font-weight:700;font-size:.85rem;cursor:pointer;">Cancelar</button>' +
      '</div>';
    document.body.appendChild(ov);
    // Animación de pulso
    if (!document.getElementById('voz-anim')) {
      var st = document.createElement('style');
      st.id = 'voz-anim';
      st.textContent = '@keyframes vozPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.7}}';
      document.head.appendChild(st);
    }
  }

  // ── Reconocimiento de voz ───────────────────────────────────────
  var _recon = null;

  function iniciarEscucha() {
    if (!SR) {
      alert('Tu navegador no permite dictado por voz. Usa Chrome o Safari actualizado.');
      return;
    }
    mostrarEscuchando();
    var r = new SR();
    _recon = r;
    r.lang = 'es-MX';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    var textoFinal = '';

    r.onresult = function (e) {
      var parcial = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) textoFinal += t;
        else parcial += t;
      }
      var el = document.getElementById('voz-parcial');
      if (el) el.textContent = (textoFinal + ' ' + parcial).trim() || 'Escuchando…';
    };

    r.onerror = function (e) {
      _recon = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        mostrarErrorPermiso();
      } else if (e.error === 'no-speech') {
        mostrarConfirmacion({ items: [], noMenu: false }, '');
      } else {
        cerrarPanel();
      }
    };

    r.onend = function () {
      _recon = null;
      if (textoFinal.trim()) {
        var resultado = interpretar(textoFinal);
        mostrarConfirmacion(resultado, textoFinal.trim());
      } else {
        // Si no quedó nada (y no fue error de permiso), mostrar "no entendí"
        if (document.getElementById('voz-panel')) {
          mostrarConfirmacion({ items: [], noMenu: false }, '');
        }
      }
    };

    try { r.start(); } catch (err) { cerrarPanel(); }
  }

  function mostrarErrorPermiso() {
    cerrarPanel();
    var esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    var pasos = esIOS
      ? '1. Abre <b>Ajustes</b> del iPhone<br>2. Busca tu navegador (Safari/Chrome)<br>3. Activa <b>Micrófono</b><br>4. Vuelve y toca el micrófono otra vez'
      : '1. Toca el 🔒 junto a la dirección web<br>2. Permisos → <b>Micrófono</b> → Permitir<br>3. Vuelve y toca el micrófono otra vez';
    var ov = document.createElement('div');
    ov.id = 'voz-panel';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:1.3rem;';
    ov.innerHTML = '<div style="background:#1C1C1C;border:1px solid rgba(255,90,0,.3);border-radius:20px;padding:1.5rem;max-width:360px;width:100%;">' +
      '<div style="font-size:1rem;font-weight:800;color:#F44336;margin-bottom:.6rem;text-align:center;">🎤 Activa el micrófono</div>' +
      '<div style="font-size:.85rem;color:#ddd;line-height:1.7;text-align:left;">' + pasos + '</div>' +
      '<button onclick="window._vozCerrar()" style="width:100%;margin-top:1rem;padding:.75rem;background:rgba(255,90,0,.15);border:1px solid rgba(255,90,0,.4);color:#FF7A33;border-radius:12px;font-family:inherit;font-weight:700;cursor:pointer;">Entendido</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  // ── Handlers globales para los botones del panel ────────────────
  window._vozConfirmar = function () {
    var res = window._vozResultadoActual;
    if (res && res.items && res.items.length) {
      agregarAlCarrito(res.items);
      cerrarPanel();
      _toast('✅ Agregado al carrito');
    }
  };
  window._vozReintentar = function () { iniciarEscucha(); };
  window._vozCerrar = function () { cerrarPanel(); };
  window._vozCancelarEscucha = function () {
    if (_recon) { try { _recon.abort(); } catch (e) {} _recon = null; }
    cerrarPanel();
  };
  window._vozQuitar = function (idx) {
    var res = window._vozResultadoActual;
    if (res && res.items) {
      res.items.splice(idx, 1);
      mostrarConfirmacion(res, '');
    }
  };

  function _toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#25D366;color:#fff;padding:.7rem 1.3rem;border-radius:22px;font-size:.88rem;font-weight:700;z-index:100002;box-shadow:0 4px 14px rgba(0,0,0,.4);';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 1400);
    setTimeout(function () { t.remove(); }, 1800);
  }

  // ── Botón flotante de micrófono ─────────────────────────────────
  function crearBoton() {
    if (document.getElementById('voz-fab')) return;
    if (!SR) return; // navegador sin soporte → no mostramos el botón

    var btn = document.createElement('button');
    btn.id = 'voz-fab';
    btn.setAttribute('aria-label', 'Ordenar por voz');
    btn.innerHTML = '🎤';
    btn.style.cssText = [
      'position:fixed', 'z-index:9000', 'right:16px', 'bottom:88px',
      'width:56px', 'height:56px', 'border-radius:50%', 'border:none',
      'background:linear-gradient(135deg,#FF7A33,#FF5A00)', 'color:#fff',
      'font-size:1.5rem', 'cursor:pointer', 'box-shadow:0 4px 14px rgba(255,90,0,.5)',
      'display:flex', 'align-items:center', 'justify-content:center'
    ].join(';');
    btn.onclick = iniciarEscucha;
    document.body.appendChild(btn);
  }

  // Crear el botón cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crearBoton);
  } else {
    crearBoton();
  }
})();
