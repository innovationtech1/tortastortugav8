// ═══════════════════════════════════════════════════════════
//  BARRA DE PERFIL — Tortas Tortuga
//  Muestra quien esta logueado (cliente o empleado) en tiempo real.
//  Se auto-inserta en cualquier pagina que incluya este script.
// ═══════════════════════════════════════════════════════════

(function() {
    var VEINTE_MIN = 20 * 60 * 1000;

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
                ['🛵', 'Mis Rutas', _base() + 'mi-ruta.html', false],
                ['🧾', 'Mis Pedidos', _base() + 'mis-pedidos.html', false],
                ['🍳', 'Cocina', _base() + 'cocina.html', false],
                ['🔔', 'Disponibles', _base() + 'disponibles.html', false],
                ['🏪', 'Ordenar', _raiz() + 'ordenar.html', false],
                ['📊', 'Reportes', _base() + 'reportes.html', true],
                ['⚙️', 'Admin', _base() + 'admin.html', true],
            ];
        } else {
            // Menú de CLIENTE — más simple
            items = [
                ['🏠', 'Inicio', _raiz() + 'index.html', false],
                ['🛒', 'Ordenar', _raiz() + 'ordenar.html', false],
                ['🧾', 'Mis Pedidos', _base() + 'mis-pedidos.html', false],
                ['⭐', 'Mis Puntos', _raiz() + 'perfil.html', false],
            ];
        }

        var html = '<div id="pb-menu" class="pb-menu">';
        items.forEach(function(it) {
            if (it[3] && !esGerente) return; // ocultar items de gerente a otros roles
            var claseGerente = it[3] ? ' pb-nav-gerente' : '';
            html += '<a href="' + it[2] + '" class="pb-nav-btn' + claseGerente + '">' +
                '<span class="pb-nav-ico">' + it[0] + '</span>' +
                '<span class="pb-nav-lbl">' + it[1] + '</span></a>';
        });
        html += '</div>';
        return html;
    }

    window._perfilToggleMenu = function() {
        var m = document.getElementById('pb-menu');
        if (m) m.classList.toggle('abierto');
    };

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
            contenido =
                '<div class="pb-avatar" style="background:#3B82F633;border:2px solid #3B82F6;">' +
                    '<span>🛒</span>' +
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
                (sesion.tipo === 'empleado'
                    ? '<button class="pb-menu-btn" onclick="window._perfilToggleMenu()" title="Menú" aria-label="Menú">☰</button>'
                    : '') +
                contenido +
                '<button class="pb-salir" onclick="window._perfilCerrarSesion()" title="Cerrar sesión">Salir</button>' +
            '</div>' +
            _menuNavegacion(sesion);

        document.body.insertBefore(barra, document.body.firstChild);

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
                '.pb-menu { display:flex; flex-direction:row; gap:.5rem; background:#141414;' +
                    'padding:.6rem .8rem; overflow-x:auto; -webkit-overflow-scrolling:touch;' +
                    'border-bottom:2px solid rgba(255,255,255,.08); box-shadow:0 4px 12px rgba(0,0,0,.4);' +
                    'scrollbar-width:none; }' +
                '.pb-menu::-webkit-scrollbar { display:none; }' +
                '.pb-nav-btn { display:flex; flex-direction:column; align-items:center; gap:.25rem;' +
                    'padding:.6rem .7rem; min-width:68px; border-radius:14px; text-decoration:none;' +
                    'background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);' +
                    'color:#eee; font-family:system-ui,sans-serif; transition:all .18s; flex-shrink:0; }' +
                '.pb-nav-btn:hover { background:rgba(255,90,0,.12); border-color:rgba(255,90,0,.3);' +
                    'transform:translateY(-2px); }' +
                '.pb-nav-btn:active { transform:scale(.94); }' +
                '.pb-nav-gerente { background:rgba(255,90,0,.1); border-color:rgba(255,90,0,.3); }' +
                '.pb-nav-lbl { font-size:.68rem; font-weight:700; white-space:nowrap; }' +
                '.pb-nav-ico { font-size:1.6rem; line-height:1; }' +
                '@media (max-width:480px){ .pb-badge{display:none;} .pb-nombre{font-size:.85rem;} }';
            document.head.appendChild(st);
        }
    }

    window._perfilCerrarSesion = function() {
        function _hacerLogout() {
            ['tt_cliente_nombre','tt_cliente_telefono','tt_cliente_ts','tt_cliente_uid',
             'tt_cajero_id','tt_cajero_nombre','tt_cajero_rol','tt_cajero_ts',
             'tt_emp_id','tt_emp_pin','tt_emp_ts','tt_emp_docid','tt_emp_nombre','tt_emp_rol'
            ].forEach(function(k){ sessionStorage.removeItem(k); localStorage.removeItem(k); });
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
