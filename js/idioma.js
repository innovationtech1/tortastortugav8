// ═══════════════════════════════════════════════════════════
//  SISTEMA DE IDIOMA — Tortas Tortuga (Español / Inglés)
//  Uso: agregar data-i18n="clave" a cualquier elemento.
//  El texto se traduce automaticamente al cambiar idioma.
// ═══════════════════════════════════════════════════════════

(function() {
    // Diccionario de traducciones. Clave -> { es, en }
    var TRADUCCIONES = {
        // ── Navegación ──
        'nav.inicio':   { es: '🏠 Inicio',  en: '🏠 Home' },
        'nav.menu':     { es: '📋 Menú',    en: '📋 Menu' },
        'nav.extras':   { es: '🍟 Extras',  en: '🍟 Sides' },
        'nav.ordenar':  { es: '🛒 Ordenar', en: '🛒 Order' },
        'nav.admin':    { es: 'Admin',      en: 'Admin' },
        'nav.cocina':   { es: '🧑‍🍳 Cocina', en: '🧑‍🍳 Kitchen' },
        'nav.login':    { es: 'Iniciar sesión', en: 'Sign in' },
        'nav.panel':    { es: 'Tortas Tortuga', en: 'Tortas Tortuga' },

        // ── Hero ──
        'hero.titulo':   { es: 'Sabor a paso firme', en: 'Flavor with a firm step' },
        'hero.eslogan':  { es: '¡Para de sufrir, no se castigue! 🌶️', en: "Stop suffering, don't punish yourself! 🌶️" },
        'hero.desc':     { es: 'Las mejores tortas, hechas con ingredientes frescos y porciones gigantes. We cater!',
                           en: 'The best tortas, made with fresh ingredients and giant portions. We cater!' },
        'hero.horario':  { es: 'Lun - Sab: 10:00 AM - 6:00 PM', en: 'Mon - Sat: 10:00 AM - 6:00 PM' },
        'hero.ordenar':  { es: 'Ordenar', en: 'Order Now' },

        // ── Secciones ──
        'sec.tortugas':  { es: 'Las Tortugas', en: 'The Tortugas' },
        'sec.combos':    { es: 'Todos los combos incluyen soda en lata y papas (chips). $1 off Torta bowl',
                           en: 'All combos include canned soda and chips. $1 off Torta bowl' },

        // ── Botones comunes (para otras paginas) ──
        'btn.ordenar':   { es: 'Ordenar', en: 'Order' },
        'btn.cobrar':    { es: 'Cobrar', en: 'Charge' },
        'btn.pagar':     { es: 'Pagar', en: 'Pay' },
        'btn.enviar':    { es: 'Enviar', en: 'Send' },
        'btn.cancelar':  { es: 'Cancelar', en: 'Cancel' },
        'btn.guardar':   { es: 'Guardar', en: 'Save' },
        'btn.cerrar':    { es: 'Cerrar', en: 'Close' },
        'btn.salir':     { es: 'Salir', en: 'Log out' },
        'btn.volver':    { es: 'Volver', en: 'Back' },

        // ── Estados ──
        'estado.nuevo':        { es: 'Nuevo', en: 'New' },
        'estado.preparacion':  { es: 'En preparación', en: 'In preparation' },
        'estado.listo':        { es: 'Listo', en: 'Ready' },
        'estado.entregado':    { es: 'Entregado', en: 'Delivered' },
        'estado.pagado':       { es: 'Pagado', en: 'Paid' },
    };

    // Idioma actual (guardado en localStorage, default español)
    function getIdioma() {
        return localStorage.getItem('tt_idioma') || 'es';
    }
    function setIdioma(lang) {
        localStorage.setItem('tt_idioma', lang);
        aplicarIdioma();
        actualizarBotonIdioma();
    }

    // Aplicar traducciones a todos los elementos con data-i18n
    function aplicarIdioma() {
        var lang = getIdioma();
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var clave = el.getAttribute('data-i18n');
            var t = TRADUCCIONES[clave];
            if (t && t[lang]) {
                el.textContent = t[lang];
            }
        });
        // Placeholders (inputs)
        document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
            var clave = el.getAttribute('data-i18n-ph');
            var t = TRADUCCIONES[clave];
            if (t && t[lang]) el.setAttribute('placeholder', t[lang]);
        });
        // Actualizar atributo lang del documento
        document.documentElement.setAttribute('lang', lang);
    }

    // Traducir una clave manualmente (para textos en JS)
    window.t = function(clave, fallback) {
        var lang = getIdioma();
        var tr = TRADUCCIONES[clave];
        return (tr && tr[lang]) ? tr[lang] : (fallback || clave);
    };

    // Boton flotante ES/EN en la esquina
    function crearBotonIdioma() {
        if (document.getElementById('btn-idioma')) return;
        var btn = document.createElement('button');
        btn.id = 'btn-idioma';
        btn.onclick = function() {
            setIdioma(getIdioma() === 'es' ? 'en' : 'es');
        };
        btn.style.cssText =
            'position:fixed;top:12px;right:12px;z-index:99998;' +
            'background:rgba(26,26,26,.92);border:1.5px solid rgba(255,90,0,.4);' +
            'color:#fff;border-radius:22px;padding:.4rem .75rem;font-size:.8rem;' +
            'font-weight:800;cursor:pointer;font-family:system-ui,sans-serif;' +
            'box-shadow:0 3px 12px rgba(0,0,0,.35);display:flex;align-items:center;gap:.35rem;' +
            'backdrop-filter:blur(6px);transition:all .18s;';
        document.body.appendChild(btn);
        actualizarBotonIdioma();
    }

    function actualizarBotonIdioma() {
        var btn = document.getElementById('btn-idioma');
        if (!btn) return;
        var lang = getIdioma();
        // Muestra el idioma al que se cambiara
        if (lang === 'es') {
            btn.innerHTML = '<span>🇺🇸</span> EN';
        } else {
            btn.innerHTML = '<span>🇲🇽</span> ES';
        }
    }

    // Exponer para uso externo
    window.ttIdioma = { get: getIdioma, set: setIdioma, aplicar: aplicarIdioma };

    // Inicializar
    function init() {
        crearBotonIdioma();
        aplicarIdioma();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
