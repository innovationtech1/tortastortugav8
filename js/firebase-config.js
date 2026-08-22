// firebase-config.js — Configuración de Firebase para Tortas Tortuga
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAQPpVvqUJ_F8-zZiCNfg77vFbu5UKPz5k",
    authDomain: "tortas-tortuga.firebaseapp.com",
    projectId: "tortas-tortuga",
    storageBucket: "tortas-tortuga.firebasestorage.app",
    messagingSenderId: "828578668114",
    appId: "1:828578668114:web:747331efe534341d97098b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ── LOGIN ANÓNIMO AUTOMÁTICO (para clientes) ──
// Le damos un "pase" anónimo al visitante SOLO si:
//  - No hay ya una sesión de Firebase
//  - No es una página de login de empleado (auth/empleados)
//  - No hay un empleado iniciando sesión en este momento
// Esto evita chocar con el login por PIN (que usa email+contraseña).
function _esPaginaLoginEmpleado() {
    var p = (location.pathname || '').toLowerCase();
    return p.indexOf('auth.html') >= 0 || p.indexOf('empleados.html') >= 0;
}
function _empleadoIniciandoSesion() {
    try {
        return sessionStorage.getItem('tt_cajero_logging_in') === 'true'
            || !!sessionStorage.getItem('tt_cajero_id')
            || !!sessionStorage.getItem('tt_emp_id');
    } catch(e) { return false; }
}

onAuthStateChanged(auth, function(user) {
    if (user) return; // ya hay sesión (empleado o anónimo)
    // Esperar un momento para no interferir con un login por PIN en curso
    setTimeout(function() {
        if (auth.currentUser) return; // alguien ya inició sesión mientras esperábamos
        if (_esPaginaLoginEmpleado()) return; // no dar pase anónimo en login de empleado
        if (_empleadoIniciandoSesion()) return; // hay un empleado autenticándose
        signInAnonymously(auth).catch(function(err) {
            console.warn('Login anónimo no disponible:', err && err.code);
        });
    }, 800);
});
