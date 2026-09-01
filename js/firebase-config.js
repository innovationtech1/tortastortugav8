// firebase-config.js — Configuración de Firebase para Tortas Tortuga
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
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

// ── authReady ────────────────────────────────────────────────────
// Promesa que resuelve en cuanto Firebase determina el estado de sesión
// (usuario restaurado o null), tras el primer onAuthStateChanged. Los
// paneles de staff que LISTAN 'pedidos' deben esperar esto antes de
// consultar, para no pegarle a Firestore sin token y recibir
// permission-denied por una carrera de tiempos (Fase 2b: list = staff).
let _resolveAuthReady;
export const authReady = new Promise((resolve) => { _resolveAuthReady = resolve; });
let _authResuelto = false;
onAuthStateChanged(auth, (u) => {
    if (!_authResuelto) { _authResuelto = true; _resolveAuthReady(u || null); }
});
