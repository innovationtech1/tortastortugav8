// ═══════════════════════════════════════════════════════════════
//  estados.js — FUENTE ÚNICA DE VERDAD para los estados del pedido
//
//  Antes, el estado se guardaba como texto ("Nuevo 🆕", "En camino 🛵")
//  y se comparaba por todos lados con .includes('camino'), .includes('Listo')…
//  Un cambio de emoji o de redacción rompía cocina/disponibles/reparto EN
//  SILENCIO. Este módulo centraliza todo eso.
//
//  Es un script CLÁSICO (no módulo) que expone window.TTEstados, para que
//  lo puedan usar TANTO las páginas con <script type="module"> COMO las
//  que usan <script> normal. Cárgalo ANTES de la lógica de cada página:
//      <script src="../js/estados.js"></script>   (dentro de /pages/)
//      <script src="js/estados.js"></script>       (en la raíz)
//
//  COMPATIBILIDAD: normalizar() reconoce el texto viejo Y el nuevo, así que
//  los pedidos que YA están en Firestore siguen funcionando sin migración.
//  Seguimos GUARDANDO la etiqueta legible (p.ej. "Nuevo 🆕") para que
//  cualquier lector que no use este módulo también la entienda.
// ═══════════════════════════════════════════════════════════════
(function (global) {
    if (global.TTEstados) return; // evitar doble carga

    // Estados canónicos, en orden de avance del pedido.
    //   clave    → identificador estable (nunca cambia)
    //   etiqueta → texto que se GUARDA en Firestore y se muestra (con emoji)
    //   corto    → texto sin emoji para espacios chicos
    //   rango    → posición en el flujo (para barras de progreso / orden)
    //   css      → clase CSS de la insignia de estado
    var ESTADOS = {
        PROGRAMADO: { clave: 'PROGRAMADO', etiqueta: 'Programado 🗓️',      corto: 'Programado',     emoji: '🗓️',  rango: 0, css: 'status-programado' },
        NUEVO:      { clave: 'NUEVO',      etiqueta: 'Nuevo 🆕',            corto: 'Nuevo',          emoji: '🆕',  rango: 1, css: 'status-nuevo' },
        EN_COCINA:  { clave: 'EN_COCINA',  etiqueta: 'En preparación 🧑‍🍳', corto: 'En preparación', emoji: '🧑‍🍳', rango: 2, css: 'status-prep' },
        LISTO:      { clave: 'LISTO',      etiqueta: 'Listo ✅',            corto: 'Listo',          emoji: '✅',  rango: 3, css: 'status-listo' },
        EN_CAMINO:  { clave: 'EN_CAMINO',  etiqueta: 'En camino 🛵',        corto: 'En camino',      emoji: '🛵',  rango: 4, css: 'status-camino' },
        ENTREGADO:  { clave: 'ENTREGADO',  etiqueta: 'Entregado 🎉',        corto: 'Entregado',      emoji: '🎉',  rango: 5, css: 'status-entregado' },
        CANCELADO:  { clave: 'CANCELADO',  etiqueta: 'Cancelado ❌',        corto: 'Cancelado',      emoji: '❌',  rango: 9, css: 'status-cancelado' }
    };

    // Flujo lineal de avance (excluye PROGRAMADO y CANCELADO, que son ramas).
    var FLUJO = ['NUEVO', 'EN_COCINA', 'LISTO', 'EN_CAMINO', 'ENTREGADO'];

    // ── Normaliza CUALQUIER valor (texto viejo, nuevo, o clave) a una clave ──
    function normalizar(valor) {
        if (valor && ESTADOS[valor]) return valor;      // ya es clave canónica
        var t = String(valor || '').toLowerCase();
        if (!t.trim()) return 'NUEVO';                  // sin estado → Nuevo
        if (t.indexOf('program') >= 0) return 'PROGRAMADO';
        if (t.indexOf('cancel')  >= 0) return 'CANCELADO';
        if (t.indexOf('entreg')  >= 0) return 'ENTREGADO';
        if (t.indexOf('camino')  >= 0) return 'EN_CAMINO';
        if (t.indexOf('listo')   >= 0) return 'LISTO';
        if (t.indexOf('prepar')  >= 0 || t.indexOf('cocina') >= 0) return 'EN_COCINA';
        if (t.indexOf('nuevo')   >= 0) return 'NUEVO';
        return 'NUEVO';
    }

    // ── Accesores ────────────────────────────────────────────────────────
    function info(valor)     { return ESTADOS[normalizar(valor)]; }
    function es(valor, clave) { return normalizar(valor) === clave; }
    function etiqueta(valor) { return info(valor).etiqueta; }
    function corto(valor)    { return info(valor).corto; }
    function css(valor)      { return info(valor).css; }
    function rango(valor)    { return info(valor).rango; }
    function emoji(valor)    { return info(valor).emoji; }

    // ── Avance: siguiente estado lógico (para el botón "avanzar pedido") ──
    function siguiente(valor) {
        var i = FLUJO.indexOf(normalizar(valor));
        return (i >= 0 && i < FLUJO.length - 1) ? FLUJO[i + 1] : null;
    }

    // ── Predicados de conveniencia ───────────────────────────────────────
    // Activo = todavía en juego (ni entregado ni cancelado).
    function estaActivo(valor)    { var k = normalizar(valor); return k !== 'ENTREGADO' && k !== 'CANCELADO'; }
    function estaEntregado(valor) { return normalizar(valor) === 'ENTREGADO'; }
    function estaCancelado(valor) { return normalizar(valor) === 'CANCELADO'; }
    function estaListo(valor)     { return normalizar(valor) === 'LISTO'; }
    function estaEnCamino(valor)  { return normalizar(valor) === 'EN_CAMINO'; }
    // En cola de cocina = aún debe cocinarse (Nuevo o En preparación).
    function enColaCocina(valor)  { var k = normalizar(valor); return k === 'NUEVO' || k === 'EN_COCINA'; }
    // Ya salió de cocina (Listo, En camino o Entregado): la cocina terminó.
    function fueraDeCocina(valor) { var k = normalizar(valor); return k === 'LISTO' || k === 'EN_CAMINO' || k === 'ENTREGADO' || k === 'CANCELADO'; }

    global.TTEstados = {
        ESTADOS: ESTADOS,
        FLUJO: FLUJO,
        normalizar: normalizar,
        info: info,
        es: es,
        etiqueta: etiqueta,
        corto: corto,
        css: css,
        rango: rango,
        emoji: emoji,
        siguiente: siguiente,
        estaActivo: estaActivo,
        estaEntregado: estaEntregado,
        estaCancelado: estaCancelado,
        estaListo: estaListo,
        estaEnCamino: estaEnCamino,
        enColaCocina: enColaCocina,
        fueraDeCocina: fueraDeCocina,
        // Lista de estados para poblar <select>/<option> en orden de flujo.
        opciones: function () {
            return ['NUEVO', 'EN_COCINA', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO']
                .map(function (k) { return ESTADOS[k]; });
        }
    };
})(typeof window !== 'undefined' ? window : this);
