// firebase-config.js — Configuración de Firebase para Tortas Tortuga
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
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
