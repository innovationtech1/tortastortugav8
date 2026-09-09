// ═══════════════════════════════════════════════════════════════
//  rastreo-ubicacion.js — Ubicación EN VIVO del tortumóvil
//
//  Comparte la posición GPS del empleado (repartidor) mientras la app
//  está abierta, en CUALQUIER pantalla de staff (no solo Mi Ruta), con
//  un "latido" que reenvía la última posición aunque no se mueva, para
//  que en el Mapa de Despacho siga apareciendo EN LÍNEA.
//
//  Límite real (no evitable en web): el navegador deja de leer el GPS
//  cuando la pantalla se apaga o se cambia de app. Rastreo 100% en
//  segundo plano requeriría una app nativa.
//
//  NOTA: Mi Ruta ya tiene su propio compartir (con interruptor ON/OFF y
//  cálculo de distancia), así que aquí NO corremos en esa página para no
//  duplicar. El interruptor de Mi Ruta guarda tt_compartir_ubi = '0'/'1'
//  y esta lógica lo respeta (si está en '0', no comparte).
// ═══════════════════════════════════════════════════════════════
import { db } from './firebase-config.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

(function () {
  // Mi Ruta comparte por su cuenta → evitar duplicar
  if (/mi-ruta\.html/i.test(location.pathname)) return;
  if (!navigator.geolocation) return;

  function leer(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } }

  const empId = (leer('tt_emp_id') || leer('tt_cajero_id') || '').trim();
  if (!empId) return; // solo empleados con sesión

  // Si el repartidor apagó el compartir (desde el interruptor de Mi Ruta), respetarlo
  let pref = null; try { pref = localStorage.getItem('tt_compartir_ubi'); } catch (e) {}
  if (pref === '0') return;

  const nombre = (leer('tt_emp_nombre') || leer('tt_cajero_nombre') || empId).trim();
  const uid = leer('tt_emp_docid');
  const ids = [String(empId)];
  if (uid && ids.indexOf(uid) < 0) ids.push(uid);

  let ultimaPos = null;      // {lat,lng,acc}
  let ultimoGuardado = 0;
  let watchId = null;
  let heartbeat = null;

  async function guardar(lat, lng, acc) {
    const datos = {
      repartidorId: String(empId),
      nombre: nombre || empId,
      lat: lat,
      lng: lng,
      precision: (acc != null ? acc : null),
      actualizado: Date.now()
    };
    try {
      await Promise.all(ids.map(function (id) { return setDoc(doc(db, 'ubicaciones', id), datos); }));
      ultimoGuardado = Date.now();
    } catch (e) { /* sin conexión: reintenta en el próximo movimiento o latido */ }
  }

  function onPos(pos) {
    ultimaPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
    // Guardar como máximo cada 5 s por movimiento (el latido cubre lo demás)
    if (Date.now() - ultimoGuardado < 5000) return;
    guardar(ultimaPos.lat, ultimaPos.lng, ultimaPos.acc);
  }
  function onErr(err) { /* sin permiso o sin señal: no bloquea nada */ }

  // 1) Posición ahora mismo
  navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  // 2) Seguir el movimiento
  watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  // 3) Latido: reenviar la última posición cada 45 s aunque esté parado
  heartbeat = setInterval(function () {
    if (ultimaPos) guardar(ultimaPos.lat, ultimaPos.lng, ultimaPos.acc);
  }, 45000);

  // Al volver a la app (cambiar de pestaña/app), refrescar de inmediato
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && ultimaPos) guardar(ultimaPos.lat, ultimaPos.lng, ultimaPos.acc);
  });
  // Limpiar al salir de la página
  window.addEventListener('pagehide', function () {
    if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} }
    if (heartbeat) clearInterval(heartbeat);
  });
})();
