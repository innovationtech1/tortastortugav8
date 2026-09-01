// ═══════════════════════════════════════════════════════════
//  Contador en tiempo real de PEDIDOS DISPONIBLES
//  Actualiza la insignia del botón "Disponibles" en la barra
// ═══════════════════════════════════════════════════════════
import { db, authReady } from './firebase-config.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Misma lógica que disponibles.html para contar igual
function esDisponible(p) {
    const esDomicilio = (p.tipoEntrega === 'Domicilio') || (p.tipo === 'domicilio') || !!p.zonaEntregaNombre;
    return esDomicilio && !p.repartidorId && p.archivado !== true;
}

// Solo escuchar si hay sesión de empleado (los clientes no ven este contador)
function haySesionEmpleado() {
    function leer(k){ return sessionStorage.getItem(k) || localStorage.getItem(k); }
    return !!(leer('tt_emp_id') || leer('tt_cajero_id') || leer('tt_cajero_nombre'));
}

function actualizarBadge(n) {
    // Actualiza TODAS las insignias de pendientes (menú superior + barra inferior).
    var badges = document.querySelectorAll('.tt-badge-disp');
    if (!badges.length) return;
    badges.forEach(function(badge) {
        if (n > 0) {
            badge.textContent = n;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

async function iniciar() {
    if (!haySesionEmpleado()) return;
    await authReady;   // Fase 2b: esperar sesión antes de listar pedidos
    try {
        onSnapshot(collection(db, 'pedidos'), function(snap) {
            var count = 0;
            snap.forEach(function(d) {
                if (esDisponible(d.data())) count++;
            });
            actualizarBadge(count);
        });
    } catch(e) {
        // Silencioso: si falla, simplemente no hay badge
    }
}

// Esperar a que la barra de perfil se haya renderizado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(iniciar, 600); });
} else {
    setTimeout(iniciar, 600);
}
