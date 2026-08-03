// ═══════════════════════════════════════════════════════════════
//  tt-alert.js — Diálogos con la marca Tortas Tortuga
//
//  Reemplaza los alert()/confirm() nativos del navegador (que muestran
//  "innovationtech1.github.io says") por diálogos propios con la marca.
// ═══════════════════════════════════════════════════════════════
(function() {
    // Evitar doble carga
    if (window._ttAlertListo) return;
    window._ttAlertListo = true;

    // Guardar los nativos por si se necesitan
    var _alertNativo = window.alert.bind(window);

    function inyectarEstilo() {
        if (document.getElementById('tt-alert-estilo')) return;
        var st = document.createElement('style');
        st.id = 'tt-alert-estilo';
        st.textContent =
            '#tt-alert-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
            'justify-content:center;padding:1.2rem;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);' +
            'font-family:inherit;animation:ttAlertFade .2s ease;}' +
            '@keyframes ttAlertFade{from{opacity:0}to{opacity:1}}' +
            '@keyframes ttAlertPop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}' +
            '#tt-alert-box{background:#1C1C1C;border:1.5px solid rgba(255,90,0,.4);border-radius:18px;' +
            'max-width:340px;width:100%;padding:1.4rem 1.3rem 1.2rem;text-align:center;' +
            'box-shadow:0 20px 60px rgba(0,0,0,.6);animation:ttAlertPop .22s ease;}' +
            '#tt-alert-box .tt-marca{display:flex;align-items:center;justify-content:center;gap:.4rem;' +
            'margin-bottom:.7rem;}' +
            '#tt-alert-box .tt-marca img{width:34px;height:34px;border-radius:50%;}' +
            '#tt-alert-box .tt-marca span{font-size:.95rem;font-weight:900;color:#FF5A00;}' +
            '#tt-alert-box .tt-msg{font-size:.9rem;color:#eee;line-height:1.45;margin-bottom:1.1rem;white-space:pre-wrap;}' +
            '#tt-alert-box .tt-btns{display:flex;gap:.5rem;}' +
            '#tt-alert-box button{flex:1;padding:.7rem;border-radius:10px;font-family:inherit;font-size:.85rem;' +
            'font-weight:800;cursor:pointer;border:none;}' +
            '#tt-alert-box .tt-ok{background:linear-gradient(135deg,#FF5A00,#FF8C00);color:#fff;}' +
            '#tt-alert-box .tt-cancel{background:rgba(255,255,255,.08);color:#ccc;border:1px solid rgba(255,255,255,.15);}';
        document.head.appendChild(st);
    }

    function rutaLogo() {
        // Ajustar la ruta del logo según si estamos en /pages/ o en la raíz
        return (location.pathname.indexOf('/pages/') >= 0 ? '../icons/icon-192.png' : 'icons/icon-192.png');
    }

    function construir(mensaje, conCancelar, onOk, onCancel) {
        inyectarEstilo();
        // Quitar cualquier diálogo previo
        var prev = document.getElementById('tt-alert-ov');
        if (prev) prev.remove();

        var ov = document.createElement('div');
        ov.id = 'tt-alert-ov';
        ov.innerHTML =
            '<div id="tt-alert-box" role="alertdialog" aria-modal="true">' +
            '<div class="tt-marca"><img src="' + rutaLogo() + '" alt=""onerror="this.style.display=\'none\'"><span>Tortas Tortuga</span></div>' +
            '<div class="tt-msg"></div>' +
            '<div class="tt-btns">' +
            (conCancelar ? '<button class="tt-cancel">Cancelar</button>' : '') +
            '<button class="tt-ok">' + (conCancelar ? 'Aceptar' : 'OK') + '</button>' +
            '</div></div>';
        // Insertar el mensaje como texto (seguro, sin HTML)
        ov.querySelector('.tt-msg').textContent = (mensaje == null ? '' : String(mensaje));
        document.body.appendChild(ov);

        function cerrar() { ov.remove(); }

        ov.querySelector('.tt-ok').addEventListener('click', function() {
            cerrar(); if (onOk) onOk();
        });
        var btnCancel = ov.querySelector('.tt-cancel');
        if (btnCancel) btnCancel.addEventListener('click', function() {
            cerrar(); if (onCancel) onCancel();
        });
        // Cerrar tocando el fondo (equivale a cancelar/OK)
        ov.addEventListener('click', function(e) {
            if (e.target === ov) { cerrar(); if (conCancelar && onCancel) onCancel(); else if (!conCancelar && onOk) onOk(); }
        });
    }

    // Alerta con marca (reemplaza alert nativo)
    window.ttAlert = function(mensaje, onOk) {
        construir(mensaje, false, onOk, null);
    };

    // Reemplazar el alert() nativo globalmente para que TODAS las alertas
    // existentes usen el diseño con marca sin cambiar cada llamada.
    window.alert = function(mensaje) { window.ttAlert(mensaje); };

    // Confirm con marca — devuelve una Promesa (por si se quiere usar async).
    // Nota: no puede ser 100% síncrono como confirm() nativo; para código
    // que usa confirm() de forma síncrona, se deja el nativo intacto.
    window.ttConfirm = function(mensaje) {
        return new Promise(function(resolve) {
            construir(mensaje, true, function(){ resolve(true); }, function(){ resolve(false); });
        });
    };
})();
