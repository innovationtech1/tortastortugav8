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

// ── LOGIN ANÓNIMO AUTOMÁTICO ──
// Si nadie ha iniciado sesión (ni empleado con PIN ni cliente), le damos
// al visitante un "pase" anónimo de Firebase. Es invisible para el usuario
// pero permite que las reglas de seguridad exijan estar autenticado.
// Si un empleado luego hace login con PIN, su sesión reemplaza a la anónima.
onAuthStateChanged(auth, function(user) {
    if (!user) {
        signInAnonymously(auth).catch(function(err) {
            console.warn('Login anónimo no disponible:', err && err.code);
        });
    }
});
