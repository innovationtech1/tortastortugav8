// ═══════════════════════════════════════════════════════════════
//  guard-staff.js — Portón de acceso para páginas de EQUIPO
//
//  Si alguien abre una página de staff (cocina, admin, disponibles, etc.)
//  SIN una sesión de empleado/cajero, lo mandamos al login. Es una capa
//  de UX (no de seguridad: la seguridad real la dan las reglas de
//  Firestore). Por eso solo revisa que EXISTA una sesión — no su
//  vigencia, que la renueva perfil-barra.js — para no sacar a nadie a
//  media jornada.
//
//  Cárgalo TEMPRANO en el <head> de cada página de staff:
//    <script src="../js/guard-staff.js"></script>
//  NO lo pongas en empleados.html (es el login) ni en páginas de cliente.
// ═══════════════════════════════════════════════════════════════
(function () {
    function leer(k) {
        try { return sessionStorage.getItem(k) || localStorage.getItem(k); }
        catch (e) { return null; }
    }

    // ¿Hay una sesión de empleado o de cajero?
    var haySesion = !!(leer('tt_emp_id') || leer('tt_cajero_id') || leer('tt_cajero_nombre'));
    if (haySesion) return; // todo bien, dejar cargar la página

    // Sin sesión → guardar a dónde quería ir y mandar al login.
    try { sessionStorage.setItem('tt_post_login', location.pathname.split('/').pop() || ''); } catch (e) {}
    var login = (location.pathname.indexOf('/pages/') >= 0) ? 'empleados.html' : 'pages/empleados.html';
    location.replace(login);
})();
