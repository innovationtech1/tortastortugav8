// ══════════════════════════════════════════════════════════
// Helper GLOBAL para agrupar productos iguales por cantidad
// Ej: 12 "Miche Tortuga" iguales → { nombre, cantidad:12, precio }
// Agrupa por: nombre + precio + modificaciones (mismas = se juntan)
// ══════════════════════════════════════════════════════════
window.agruparItems = function(items) {
    if (!Array.isArray(items) || !items.length) return [];
    var grupos = {};
    var orden = [];
    items.forEach(function(it){
        var nombre = it.nombre || it.producto || it.name || 'Producto';
        var precio = Number(it.precio) || Number(it.precioBase) || 0;
        var variante = it.variante || '';
        var mods = '';
        if (it.modificaciones && it.modificaciones.length) {
            mods = it.modificaciones.slice().sort().join('|');
        }
        // Cantidad que ya trae el item (por si viene pre-agrupado)
        var cantItem = Number(it.cantidad) || Number(it.qty) || 1;
        // Clave única: nombre + precio + variante + modificaciones
        var clave = nombre + '||' + precio + '||' + variante + '||' + mods;
        if (!grupos[clave]) {
            grupos[clave] = {
                nombre: nombre,
                precio: precio,
                variante: variante,
                modificaciones: it.modificaciones || [],
                cantidad: 0,
                categoria: it.categoria || '',
                _original: it
            };
            orden.push(clave);
        }
        grupos[clave].cantidad += cantItem;
    });
    return orden.map(function(k){ return grupos[k]; });
};

// Formatea un grupo como texto legible: "12× Miche Tortuga — $15.00"
window.textoItemAgrupado = function(g, opts) {
    opts = opts || {};
    var linea = g.cantidad + '× ' + g.nombre;
    if (g.variante) linea += ' (' + g.variante + ')';
    if (opts.conPrecio && g.precio) {
        // Precio unitario × cantidad
        linea += ' — $' + (g.precio).toFixed(2);
        if (g.cantidad > 1 && opts.mostrarTotalLinea) {
            linea += ' c/u ($' + (g.precio * g.cantidad).toFixed(2) + ')';
        }
    }
    return linea;
};

// ═══════════════════════════════════════════════════════════
//  BARRA DE PERFIL — Tortas Tortuga
//  Muestra quien esta logueado (cliente o empleado) en tiempo real.
//  Se auto-inserta en cualquier pagina que incluya este script.
// ═══════════════════════════════════════════════════════════

(function() {
    var VEINTE_MIN = 12 * 60 * 60 * 1000;  // 12 horas (turno de trabajo completo)

    // Renovar el timestamp de la sesión activa para que no expire mientras el empleado trabaja
    function renovarSesion() {
        var ahora = Date.now();
        function leer(k){ return sessionStorage.getItem(k) || localStorage.getItem(k); }
        try {
            if (leer('tt_emp_id')) {
                sessionStorage.setItem('tt_emp_ts', String(ahora));
                localStorage.setItem('tt_emp_ts', String(ahora));
            }
            if (leer('tt_cajero_nombre')) {
                sessionStorage.setItem('tt_cajero_ts', String(ahora));
                localStorage.setItem('tt_cajero_ts', String(ahora));
            }
        } catch(e) {}
    }

    // Detectar que tipo de sesion hay activa
    function detectarSesion() {
        var ahora = Date.now();
        function leer(k){ return sessionStorage.getItem(k) || localStorage.getItem(k); }

        // 1. Empleado (login por empleados.html)
        var empId = leer('tt_emp_id');
        var empTs = parseInt(leer('tt_emp_ts') || '0');
        if (empId && (ahora - empTs < VEINTE_MIN)) {
            return {
                tipo: 'empleado',
                id: empId,
                nombre: leer('tt_emp_nombre') || empId,
                rol: leer('tt_emp_rol') || 'empleado',
            };
        }

        // 2. Cajero (login por auth.html)
        var cajNombre = leer('tt_cajero_nombre');
        var cajTs = parseInt(leer('tt_cajero_ts') || '0');
        if (cajNombre && (ahora - cajTs < VEINTE_MIN)) {
            return {
                tipo: 'empleado',
                id: leer('tt_cajero_id') || '',
                nombre: cajNombre,
                rol: leer('tt_cajero_rol') || 'cajero',
            };
        }

        // 3. Cliente (login por entrar.html — telefono o cuenta con email)
        var cliNombre = leer('tt_cliente_nombre');
        var cliTs = parseInt(leer('tt_cliente_ts') || '0');
        if (cliNombre && (ahora - cliTs < VEINTE_MIN)) {
            return {
                tipo: 'cliente',
                nombre: cliNombre,
                telefono: leer('tt_cliente_telefono') || '',
                uid: leer('tt_cliente_uid') || null,
                foto: leer('tt_cliente_foto') || null,
            };
        }

        return null; // sin sesion
    }

    // ── Helper unico y compartido: cualquier pagina puede llamar a
    // window.TT_getSesion() en vez de reimplementar esta logica de
    // "revisa emp, si no hay revisa cajero, si no hay revisa cliente".
    window.TT_getSesion = detectarSesion;
    window.TT_SESION_VIGENCIA_MS = VEINTE_MIN;

    // Emoji e info segun el rol
    function estiloRol(rol) {
        var r = (rol || '').toLowerCase();
        if (r.indexOf('gerente') >= 0) return { emoji: '👔', color: '#A78BFA', label: 'Gerente' };
        if (r.indexOf('admin') >= 0)   return { emoji: '⚙️', color: '#FF5A00', label: 'Admin' };
        if (r.indexOf('cocinero') >= 0)return { emoji: '🧑‍🍳', color: '#FBB724', label: 'Cocinero' };
        if (r.indexOf('mesero') >= 0)  return { emoji: '🧑‍💼', color: '#25D366', label: 'Mesero' };
        if (r.indexOf('cajero') >= 0)  return { emoji: '🏪', color: '#25D366', label: 'Cajero' };
        return { emoji: '🧑‍💼', color: '#25D366', label: rol || 'Empleado' };
    }

    // Detecta la ruta base según si estamos en /pages/ o en la raíz
    function _base() {
        return (location.pathname.indexOf('/pages/') >= 0) ? '' : 'pages/';
    }
    function _raiz() {
        return (location.pathname.indexOf('/pages/') >= 0) ? '../' : '';
    }

    // Construye el menú de navegación del empleado según su rol
    function _menuNavegacion(sesion) {
        var rol = (sesion.rol || '').toLowerCase();
        var esGerente = rol.indexOf('gerente') >= 0 || rol.indexOf('supervisor') >= 0 || rol.indexOf('admin') >= 0 || rol.indexOf('dueñ') >= 0;

        var items;
        if (sesion.tipo === 'empleado') {
            // Menú de EMPLEADO — cada item: [icono, etiqueta, url, soloGerente]
            items = [
                ['📊', 'Dashboard', _base() + 'dashboard.html', true],
                ['🏬', 'Ordenar', _raiz() + 'ordenar.html', false],
                ['🧾', 'Mis Pedidos', _base() + 'mis-pedidos.html', false],
                ['🔔', 'Disponibles', _base() + 'disponibles.html', false],
                ['🛵', 'Mis Rutas', _base() + 'mi-ruta.html', false],
                ['🗓️', 'Programar', _base() + 'programar.html', true],
                ['🍳', 'Cocina', _base() + 'cocina.html', false],
                ['📊', 'Reportes', _base() + 'reportes.html', true],
                ['👥', 'Clientes', _base() + 'clientes.html', true],
                ['⚙️', 'Admin', _base() + 'admin.html', true],
                ['📋', 'Control', _base() + 'control.html', true],
                ['🗺️', 'Mapa', _base() + 'mapa.html', true],
            ];
        } else {
            // Menú de CLIENTE — más simple
            items = [
                ['🏠', 'Inicio', _raiz() + 'index.html', false],
                ['🐢', 'Menú', _raiz() + 'ordenar.html', false],
                ['🛍️', 'Mi Orden', _base() + 'mi-pedido.html', false],
                ['⭐', 'Mis Puntos', _raiz() + 'perfil.html', false],
            ];
        }

        var html = '<div id="pb-menu" class="pb-menu">';
        // Página actual (para no mostrar el botón que lleva a donde ya estamos)
        var pagActual = window.location.pathname.split('/').pop() || 'index.html';

        items.forEach(function(it) {
            if (it[3] && !esGerente) return; // ocultar items de gerente a otros roles
            // No mostrar el botón que apunta a la página en la que ya estás
            var destino = it[2].split('/').pop().split('?')[0];
            if (destino === pagActual) return;
            var claseGerente = it[3] ? ' pb-nav-gerente' : '';
            // Insignia de contador para "Disponibles"
            var esBadge = it[2].indexOf('disponibles.html') >= 0;
            var badgeHtml = esBadge
                ? '<span id="pb-badge-disponibles" class="tt-badge-disp" style="display:none;position:absolute;top:2px;right:8px;' +
                  'background:#F44336;color:#fff;font-size:.62rem;font-weight:900;min-width:17px;height:17px;' +
                  'border-radius:9px;align-items:center;justify-content:center;padding:0 4px;' +
                  'box-shadow:0 0 0 2px #141414;animation:pbBadgePulse 1.5s infinite;">0</span>'
                : '';
            html += '<a href="' + it[2] + '" class="pb-nav-btn' + claseGerente + '" style="position:relative;">' +
                badgeHtml +
                '<span class="pb-nav-ico">' + it[0] + '</span>' +
                '<span class="pb-nav-lbl">' + it[1] + '</span></a>';
        });
        // Carrito para el cliente (solo funciona en la pantalla de ordenar)
        if (sesion.tipo !== 'empleado') {
            var enOrdenar = /ordenar\.html/.test(window.location.pathname);
            if (enOrdenar) {
                html += '<a href="#" onclick="if(window.abrirCarrito){window.abrirCarrito();}return false;" ' +
                    'class="pb-nav-btn pb-nav-carrito" title="Ver mi carrito">' +
                    '<span class="pb-nav-ico" style="position:relative;">🛒' +
                    '<span id="pb-cart-count" style="position:absolute;top:-6px;right:-10px;background:#FF5A00;' +
                    'color:#fff;font-size:.6rem;font-weight:800;min-width:16px;height:16px;border-radius:8px;' +
                    'display:none;align-items:center;justify-content:center;padding:0 3px;">0</span></span>' +
                    '<span class="pb-nav-lbl">Carrito</span></a>';
            }
        }

        html += '</div>';
        return html;
    }

    window._perfilToggleMenu = function() {
        var m = document.getElementById('pb-menu');
        if (m) m.classList.toggle('abierto');
    };

    // ── BARRA INFERIOR FIJA (solo empleados) ─────────────────────────────
    // Acceso rápido y SIEMPRE visible a los paneles operativos clave, con la
    // página actual resaltada ("estás aquí") y la insignia de pendientes.
    // z-index bajo (150) a propósito: queda DEBAJO de los overlays a pantalla
    // completa (vista de entrega, modales POS/cocina) para no tapar sus botones.
    function crearBarraInferior(sesion) {
        var vieja = document.getElementById('tt-navbar');
        if (vieja) vieja.remove();
        if (!sesion || sesion.tipo !== 'empleado') return;

        var rol = (sesion.rol || '').toLowerCase();
        var esGerente = rol.indexOf('gerente') >= 0 || rol.indexOf('supervisor') >= 0 ||
                        rol.indexOf('admin') >= 0 || rol.indexOf('dueñ') >= 0;

        // [icono, etiqueta, url, esDisponibles]
        var items = [
            ['🏬', 'Tienda',      _raiz() + 'ordenar.html',      false],
            ['🍳', 'Cocina',      _base() + 'cocina.html',       false],
            ['🔔', 'Disponibles', _base() + 'disponibles.html',  true ],
            ['🛵', 'Mi Ruta',     _base() + 'mi-ruta.html',      false],
        ];
        if (esGerente) items.push(['⚙️', 'Admin', _base() + 'admin.html', false]);

        var pagActual = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';

        var html = '';
        items.forEach(function(it) {
            var destino = it[2].split('/').pop().split('?')[0];
            var activo = (destino === pagActual) ? ' activo' : '';
            var badge = it[3]
                ? '<span class="tt-badge-disp tt-navbar-badge" style="display:none;">0</span>'
                : '';
            html += '<a href="' + it[2] + '" class="tt-nav-item' + activo + '">' +
                        '<span class="tt-nav-i">' + it[0] + badge + '</span>' +
                        '<span class="tt-nav-t">' + it[1] + '</span>' +
                    '</a>';
        });

        var nav = document.createElement('nav');
        nav.id = 'tt-navbar';
        nav.setAttribute('aria-label', 'Navegación del equipo');
        nav.innerHTML = html;
        document.body.appendChild(nav);

        // Reservar espacio para que la barra no tape el contenido al final.
        try { document.body.style.paddingBottom = 'calc(62px + env(safe-area-inset-bottom, 0px))'; } catch(e) {}
    }

    function crearBarra(sesion) {
        // Quitar barra previa si existe
        var vieja = document.getElementById('perfil-barra');
        if (vieja) vieja.remove();

        var barra = document.createElement('div');
        barra.id = 'perfil-barra';

        var contenido, colorBorde, iniciales;

        if (sesion.tipo === 'empleado') {
            var est = estiloRol(sesion.rol);
            colorBorde = est.color;
            iniciales = (sesion.nombre || '?').trim().charAt(0).toUpperCase();
            contenido =
                '<div class="pb-avatar" style="background:' + est.color + '33;border:2px solid ' + est.color + ';">' +
                    '<span>' + est.emoji + '</span>' +
                '</div>' +
                '<div class="pb-info">' +
                    '<div class="pb-nombre">' + sesion.nombre + '</div>' +
                    '<div class="pb-rol" style="color:' + est.color + ';">' + est.label +
                        (sesion.id ? ' · ' + sesion.id : '') + '</div>' +
                '</div>' +
                '<div class="pb-badge" style="background:' + est.color + '22;color:' + est.color + ';border:1px solid ' + est.color + '55;">EMPLEADO</div>';
        } else {
            colorBorde = '#3B82F6';
            // Si entró con Google, mostramos su foto de perfil; si no, el carrito.
            var avatarInterno = sesion.foto
                ? '<img src="' + sesion.foto + '" alt="" referrerpolicy="no-referrer" ' +
                  'style="width:100%;height:100%;object-fit:cover;border-radius:50%;" ' +
                  'onerror="this.parentNode.innerHTML=\'<span>🛒</span>\';">'
                : '<span>🛒</span>';
            contenido =
                '<div class="pb-avatar" style="background:#3B82F633;border:2px solid #3B82F6;overflow:hidden;">' +
                    avatarInterno +
                '</div>' +
                '<div class="pb-info">' +
                    '<div class="pb-nombre">' + sesion.nombre + '</div>' +
                    '<div class="pb-rol" style="color:#3B82F6;">Cliente' +
                        (sesion.telefono ? ' · 📞 ' + sesion.telefono : '') + '</div>' +
                '</div>' +
                '<div class="pb-badge" style="background:#3B82F622;color:#3B82F6;border:1px solid #3B82F655;">CLIENTE</div>';
        }

        barra.innerHTML =
            '<div class="pb-wrap" style="border-bottom:2px solid ' + colorBorde + ';">' +
                contenido +
                '<button class="pb-salir" onclick="window._perfilCerrarSesion()" title="Cerrar sesión">Salir</button>' +
            '</div>' +
            _menuNavegacion(sesion);

        document.body.insertBefore(barra, document.body.firstChild);

        // Barra inferior fija de navegación del equipo (solo empleados)
        crearBarraInferior(sesion);

        // Empujar el contenido hacia abajo para que no lo tape la barra
        if (!document.getElementById('perfil-barra-estilo')) {
            var st = document.createElement('style');
            st.id = 'perfil-barra-estilo';
            st.textContent =
                '#perfil-barra { position:sticky; top:0; z-index:99999; width:100%; }' +
                '.pb-wrap { display:flex; align-items:center; gap:.7rem; padding:.55rem .9rem;' +
                    'background:linear-gradient(180deg,#1a1a1a,#141414); box-shadow:0 2px 12px rgba(0,0,0,.4); }' +
                '.pb-avatar { width:38px; height:38px; border-radius:50%; display:flex;' +
                    'align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }' +
                '.pb-info { flex:1; min-width:0; }' +
                '.pb-nombre { font-size:.92rem; font-weight:800; color:#fff; white-space:nowrap;' +
                    'overflow:hidden; text-overflow:ellipsis; font-family:system-ui,sans-serif; }' +
                '.pb-rol { font-size:.74rem; font-weight:600; white-space:nowrap;' +
                    'overflow:hidden; text-overflow:ellipsis; font-family:system-ui,sans-serif; }' +
                '.pb-badge { font-size:.62rem; font-weight:800; padding:.25rem .5rem; border-radius:20px;' +
                    'letter-spacing:.05em; flex-shrink:0; font-family:system-ui,sans-serif; }' +
                '.pb-salir { background:rgba(244,67,54,.12); border:1px solid rgba(244,67,54,.35);' +
                    'color:#F44336; border-radius:8px; padding:.4rem .7rem; font-size:.75rem; font-weight:700;' +
                    'cursor:pointer; flex-shrink:0; font-family:system-ui,sans-serif; }' +
                '.pb-salir:active { transform:scale(.95); }' +
                '.pb-menu-btn { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15);' +
                    'color:#fff; border-radius:8px; width:38px; height:38px; font-size:1.2rem; cursor:pointer;' +
                    'flex-shrink:0; font-family:system-ui,sans-serif; line-height:1; }' +
                '.pb-menu-btn:active { transform:scale(.95); }' +
                '.pb-menu { display:flex; flex-direction:row; gap:.35rem; background:#141414;' +
                    'padding:.6rem .8rem; overflow-x:auto; -webkit-overflow-scrolling:touch;' +
                    'border-bottom:2px solid rgba(255,255,255,.08); box-shadow:0 4px 12px rgba(0,0,0,.4);' +
                    'scrollbar-width:none; }' +
                '.pb-menu::-webkit-scrollbar { display:none; }' +
                '.pb-nav-btn { display:flex; flex-direction:column; align-items:center; gap:.25rem;' +
                    'padding:.45rem .4rem; min-width:52px; border-radius:12px; text-decoration:none;' +
                    'background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);' +
                    'color:#eee; font-family:system-ui,sans-serif; transition:all .18s; flex-shrink:0; }' +
                '.pb-nav-btn:hover { background:rgba(255,90,0,.12); border-color:rgba(255,90,0,.3);' +
                    'transform:translateY(-2px); }' +
                '.pb-nav-btn:active { transform:scale(.94); }' +
                '.pb-nav-gerente { background:rgba(255,90,0,.1); border-color:rgba(255,90,0,.3); }' +
                '.pb-nav-lbl { font-size:.6rem; font-weight:700; white-space:nowrap; }' +
                '@keyframes pbBadgePulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }' +
                '.pb-nav-ico { font-size:1.25rem; line-height:1; }' +
                '@media (max-width:480px){ .pb-badge{display:none;} .pb-nombre{font-size:.85rem;} .pb-nav-btn{min-width:46px; padding:.4rem .3rem;} .pb-nav-ico{font-size:1.15rem;} .pb-nav-lbl{font-size:.55rem;} .pb-menu{gap:.25rem; padding:.5rem .5rem;} }' +
                // ── Barra inferior de navegación del equipo ──
                '#tt-navbar{ position:fixed; left:0; right:0; bottom:0; z-index:150; display:flex;' +
                    'background:linear-gradient(0deg,#0f0f0f,#1a1a1a); border-top:1px solid rgba(255,255,255,.1);' +
                    'box-shadow:0 -4px 16px rgba(0,0,0,.45); padding-bottom:env(safe-area-inset-bottom,0px); }' +
                '.tt-nav-item{ flex:1; min-width:0; display:flex; flex-direction:column; align-items:center;' +
                    'justify-content:center; gap:.16rem; padding:.5rem .2rem .55rem; text-decoration:none;' +
                    'color:#9a9a9a; font-family:system-ui,sans-serif; position:relative; transition:color .15s; }' +
                '.tt-nav-item:active{ transform:scale(.93); }' +
                '.tt-nav-item.activo{ color:#FF5A00; }' +
                '.tt-nav-item.activo::before{ content:""; position:absolute; top:0; left:24%; right:24%;' +
                    'height:3px; background:#FF5A00; border-radius:0 0 4px 4px; }' +
                '.tt-nav-i{ font-size:1.4rem; line-height:1; position:relative; }' +
                '.tt-nav-t{ font-size:.62rem; font-weight:800; letter-spacing:.01em; white-space:nowrap; }' +
                '.tt-navbar-badge{ position:absolute; top:-6px; right:-11px; background:#F44336; color:#fff;' +
                    'font-size:.6rem; font-weight:900; min-width:16px; height:16px; border-radius:8px;' +
                    'align-items:center; justify-content:center; padding:0 4px; box-shadow:0 0 0 2px #141414;' +
                    'animation:pbBadgePulse 1.5s infinite; }';
            document.head.appendChild(st);
        }
    }

    window._perfilCerrarSesion = function() {
        function _hacerLogout() {
            ['tt_cliente_nombre','tt_cliente_telefono','tt_cliente_ts','tt_cliente_uid',
             'tt_cliente_foto','tt_cliente_email',
             'tt_cajero_id','tt_cajero_nombre','tt_cajero_rol','tt_cajero_ts',
             'tt_emp_id','tt_emp_pin','tt_emp_ts','tt_emp_docid','tt_emp_nombre','tt_emp_rol'
            ].forEach(function(k){ sessionStorage.removeItem(k); localStorage.removeItem(k); });
            // Cerrar también la sesión de Firebase (Google) si la app la expuso,
            // para que "Mis Puntos" no siga mostrando el perfil tras salir.
            try { if (window.TT_signOutGoogle) window.TT_signOutGoogle(); } catch(e){}
            var barra = document.getElementById('perfil-barra');
            if (barra) barra.remove();
            var base = location.pathname.indexOf('/pages/') >= 0 ? '../index.html' : 'index.html';
            location.href = base;
        }
        // Usar el diálogo con marca si está disponible; si no, el nativo.
        if (window.ttConfirm) {
            window.ttConfirm('¿Cerrar sesión?').then(function(ok){ if (ok) _hacerLogout(); });
        } else {
            if (confirm('¿Cerrar sesión?')) _hacerLogout();
        }
    };

    // Inicializar cuando el DOM este listo
    function init() {
        // Renovar la sesión del empleado en cada carga de página
        renovarSesion();
        var sesion = detectarSesion();
        if (sesion) crearBarra(sesion);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exponer para refrescar manualmente
    window._refrescarPerfil = init;
})();
