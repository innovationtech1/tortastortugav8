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

        // ── Secciones del menu ──
        'menu.combos_incluyen': { es: 'Todos los combos incluyen soda en lata y papas (chips). $1 off Torta by self.',
                                  en: 'All combos include canned soda and chips. $1 off Torta by self.' },
        'menu.extras_sides':    { es: 'Extras & Sides', en: 'Extras & Sides' },
        'menu.bebidas_botanas': { es: 'Bebidas & Botanas', en: 'Drinks & Snacks' },

        // ── Descripciones de productos ──
        'prod.double_t.desc': {
            es: '1 aguacate GRANDE entero con 15 rebanadas de carnes mixtas (jamón, queso de puerco y pavo) con tomate, cebolla, mayonesa y queso fresco.',
            en: '1 whole BIG avocado with 15 slices of mix meats (ham, pork head cheese & turkey) with tomato, onions, mayo and queso fresco.' },
        'prod.original.desc': {
            es: '1 aguacate GRANDE entero, 3 rebanadas de carne mixta (jamón, queso de puerco y pavo) con tomate, cebolla, mayonesa y queso fresco.',
            en: '1 whole BIG avocado, 3 mix meat slices (ham, pork head cheese & turkey) with tomato, onions, mayo and queso fresco.' },
        'prod.turkey_ham.desc': {
            es: '1 aguacate GRANDE entero, pavo, jamón o rebanadas de carne mixta con tomate, cebolla, mayonesa y queso fresco.',
            en: '1 whole BIG avocado, turkey, ham or mix meat slices with tomato, onions, mayo and queso fresco.' },
        'prod.pork.desc': {
            es: '1 aguacate GRANDE entero, rebanadas de queso de puerco, con tomate, cebolla, mayonesa y queso fresco.',
            en: '1 whole BIG avocado, pork head cheese meat slices, with tomato, onions, mayo and queso fresco.' },
        'prod.shrimp.desc': {
            es: '1 aguacate GRANDE entero, camarón con 3 rebanadas de carne mixta (jamón, pavo y queso de puerco).',
            en: '1 whole BIG avocado, shrimp with 3 mix meat slices (ham, turkey & pork head cheese).' },
        'prod.only_meat.desc': {
            es: '3 rebanadas de carne mixta (pavo, jamón y queso de puerco) con mayonesa y queso fresco.',
            en: '3 mix meat slices (turkey, ham and pork head cheese) with mayo and queso fresco.' },
        'prod.vegan.desc': {
            es: '2 aguacates GRANDES enteros, doble tomate, doble cebolla y doble cebolla morada.',
            en: '2 whole BIG avocados, double tomatoes, double onions and double red onions.' },
        'prod.kids.desc': {
            es: '8 rebanadas de jamón, queso y mayonesa.',
            en: '8 ham slices, cheese and mayo.' },

        // ── Badges ──
        'badge.nuevo':       { es: 'NUEVO!', en: 'NEW!' },
        'badge.bestseller':  { es: 'MÁS VENDIDO', en: 'BEST SELLER' },
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
