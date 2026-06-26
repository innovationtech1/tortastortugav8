// auth.js — Lógica completa de autenticación Firebase para Tortas Tortuga
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    sendEmailVerification,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const googleProvider = new GoogleAuthProvider();

// ─── GUARD: Si ya tiene sesión, redirigir al menú ───────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = '../ordenar.html';
    }
});

// ─── GENERAR ID ÚNICO TT-XXXXXX ─────────────────────────────────
function generarIdUnico() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'TT-';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

async function generarIdSinDuplicados() {
    let intentos = 0;
    while (intentos < 10) {
        const id = generarIdUnico();
        const snap = await getDoc(doc(db, 'usuarios', id));
        if (!snap.exists()) return id;
        intentos++;
    }
    // Fallback con timestamp
    return 'TT-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// ─── VERIFICAR USERNAME ÚNICO ────────────────────────────────────
async function usernameDisponible(username) {
    const q = query(collection(db, 'usuarios'), where('username', '==', username.toLowerCase()));
    const snap = await getDocs(q);
    return snap.empty;
}

// ─── GUARDAR PERFIL EN FIRESTORE ─────────────────────────────────
async function guardarPerfil(uid, datos) {
    const id = await generarIdSinDuplicados();
    await setDoc(doc(db, 'usuarios', id), {
        uid,
        id,
        nombre: datos.nombre,
        username: datos.username.toLowerCase(),
        telefono: datos.telefono || '',
        email: datos.email,
        metodo: datos.metodo || 'email',
        creado: serverTimestamp(),
        pedidos: []
    });
    // También indexar por uid para búsquedas rápidas
    await setDoc(doc(db, 'uid_index', uid), { id });
    return id;
}

// ─── OBTENER PERFIL POR UID ──────────────────────────────────────
async function obtenerPerfil(uid) {
    const indexSnap = await getDoc(doc(db, 'uid_index', uid));
    if (!indexSnap.exists()) return null;
    const id = indexSnap.data().id;
    const perfilSnap = await getDoc(doc(db, 'usuarios', id));
    return perfilSnap.exists() ? { id, ...perfilSnap.data() } : null;
}

// ─── TABS ────────────────────────────────────────────────────────
window.switchTab = function(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`form-${tab}`).classList.add('active');
    if (tab !== 'forgot') document.getElementById(`tab-${tab}`)?.classList.add('active');
    clearMessages();
};

function clearMessages() {
    document.querySelectorAll('.auth-message').forEach(m => m.innerHTML = '');
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('.field-input').forEach(i => i.classList.remove('input-ok', 'input-error'));
}

function showMsg(id, msg, tipo = 'error') {
    const el = document.getElementById(id);
    el.innerHTML = msg;
    el.className = `auth-message msg-${tipo}`;
}

function setFieldError(inputId, errId, msg) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errId);
    input.classList.add('input-error');
    input.classList.remove('input-ok');
    if (err) err.textContent = msg;
}

function setFieldOk(inputId, errId) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errId);
    input.classList.remove('input-error');
    input.classList.add('input-ok');
    if (err) err.textContent = '';
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    btn.querySelector('.btn-spinner').style.display = loading ? 'inline' : 'none';
    btn.disabled = loading;
}

// ─── TOGGLE CONTRASEÑA ───────────────────────────────────────────
window.togglePass = function(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🙈';
};

// ─── FORTALEZA DE CONTRASEÑA ─────────────────────────────────────
document.getElementById('reg-password')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
    const colors = ['', '#ff4444', '#ff9944', '#ffcc00', '#25D366'];
    const pcts   = ['0%', '25%', '50%', '75%', '100%'];

    fill.style.width = pcts[score];
    fill.style.background = colors[score];
    label.textContent = levels[score];
    label.style.color = colors[score];
});

// ─── VALIDACIÓN USERNAME EN TIEMPO REAL ─────────────────────────
let usernameTimer;
document.getElementById('reg-username')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    const status = document.getElementById('username-status');
    const err = document.getElementById('err-reg-username');
    clearTimeout(usernameTimer);

    if (val.length < 4) {
        status.textContent = '';
        err.textContent = val.length > 0 ? 'Mínimo 4 caracteres' : '';
        setFieldError('reg-username', 'err-reg-username', val.length > 0 ? 'Mínimo 4 caracteres' : '');
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) {
        setFieldError('reg-username', 'err-reg-username', 'Solo letras, números y _');
        return;
    }

    status.textContent = '⏳';
    err.textContent = '';

    usernameTimer = setTimeout(async () => {
        const disponible = await usernameDisponible(val);
        if (disponible) {
            status.textContent = '✅';
            setFieldOk('reg-username', 'err-reg-username');
        } else {
            status.textContent = '❌';
            setFieldError('reg-username', 'err-reg-username', 'Ese nombre de usuario ya está tomado');
        }
    }, 600);
});

// ─── GOOGLE SIGN-IN (LOGIN Y REGISTRO) ───────────────────────────
async function loginConGoogle() {
    try {
        if (esMobil) {
            // En móvil usar redirect (más confiable en Safari/Chrome iOS)
            await signInWithRedirect(auth, googleProvider);
            return; // la página recarga — getRedirectResult() lo maneja
        }
        // En escritorio usar popup
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const perfil = await obtenerPerfil(user.uid);
        if (!perfil) {
            const username = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20) || 'usuario';
            await guardarPerfil(user.uid, {
                nombre: user.displayName || 'Usuario',
                username: username + Math.floor(Math.random() * 99),
                telefono: '',
                email: user.email,
                metodo: 'google'
            });
        }
        window.location.href = '../ordenar.html';
    } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
            // Popup bloqueado — intentar con redirect como fallback
            try {
                await signInWithRedirect(auth, googleProvider);
            } catch(e2) {
                showMsg('msg-login', '⚠️ No se pudo abrir Google. Verifica que los popups no estén bloqueados.');
            }
            return;
        }
        const msgTxt = err.code === 'auth/popup-closed-by-user'
            ? 'Cerraste la ventana de Google antes de completar el login.'
            : 'Error con Google Sign-In. Intenta de nuevo.';
        showMsg('msg-login', '⚠️ ' + msgTxt);
    }
}

document.getElementById('btn-google-login')?.addEventListener('click', loginConGoogle);
document.getElementById('btn-google-register')?.addEventListener('click', loginConGoogle);

// ─── LOGIN CON EMAIL ─────────────────────────────────────────────
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    let ok = true;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setFieldError('login-email', 'err-login-email', 'Ingresa un correo válido');
        ok = false;
    }
    if (!password) {
        setFieldError('login-password', 'err-login-password', 'Ingresa tu contraseña');
        ok = false;
    }
    if (!ok) return;

    setLoading('btn-login', true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = '../ordenar.html';
    } catch (err) {
        const mensajes = {
            'auth/user-not-found': 'No existe una cuenta con ese correo.',
            'auth/wrong-password': 'Contraseña incorrecta.',
            'auth/invalid-credential': 'Correo o contraseña incorrectos.',
            'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
            'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.'
        };
        showMsg('msg-login', '❌ ' + (mensajes[err.code] || 'Error al iniciar sesión. Intenta de nuevo.'));
    } finally {
        setLoading('btn-login', false);
    }
});

// ─── REGISTRO CON EMAIL ──────────────────────────────────────────
document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const nombre    = document.getElementById('reg-nombre').value.trim();
    const username  = document.getElementById('reg-username').value.trim();
    const telefono  = document.getElementById('reg-telefono').value.trim().replace(/\D/g, '');
    const email     = document.getElementById('reg-email').value.trim();
    const password  = document.getElementById('reg-password').value;
    const confirm   = document.getElementById('reg-confirm').value;
    let ok = true;

    // Validar nombre
    if (nombre.length < 2) {
        setFieldError('reg-nombre', 'err-reg-nombre', 'Ingresa tu nombre completo');
        ok = false;
    } else setFieldOk('reg-nombre', 'err-reg-nombre');

    // Validar username
    if (username.length < 4 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        setFieldError('reg-username', 'err-reg-username', 'Username inválido (min 4 chars, solo letras/números/_)');
        ok = false;
    }

    // Validar teléfono
    if (telefono.length !== 10) {
        setFieldError('reg-telefono', 'err-reg-telefono', 'Ingresa 10 dígitos');
        ok = false;
    } else setFieldOk('reg-telefono', 'err-reg-telefono');

    // Validar email
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setFieldError('reg-email', 'err-reg-email', 'Ingresa un correo válido');
        ok = false;
    } else setFieldOk('reg-email', 'err-reg-email');

    // Validar contraseña
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setFieldError('reg-password', 'err-reg-password', 'Mínimo 8 caracteres, 1 mayúscula y 1 número');
        ok = false;
    } else setFieldOk('reg-password', 'err-reg-password');

    // Confirmar contraseña
    if (password !== confirm) {
        setFieldError('reg-confirm', 'err-reg-confirm', 'Las contraseñas no coinciden');
        ok = false;
    } else if (confirm) setFieldOk('reg-confirm', 'err-reg-confirm');

    if (!ok) return;

    setLoading('btn-register', true);
    try {
        // Verificar username único antes de crear cuenta
        const libre = await usernameDisponible(username);
        if (!libre) {
            setFieldError('reg-username', 'err-reg-username', 'Ese nombre de usuario ya está tomado');
            setLoading('btn-register', false);
            return;
        }

        // Crear usuario en Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Guardar perfil en Firestore
        const id = await guardarPerfil(cred.user.uid, { nombre, username, telefono, email, metodo: 'email' });

        // Enviar verificación de email
        await sendEmailVerification(cred.user);

        showMsg('msg-register',
            `✅ ¡Cuenta creada! Tu ID es <strong>${id}</strong>.<br>
             Revisa tu correo para verificar tu cuenta.`,
            'success'
        );

        setTimeout(() => window.location.href = 'index.html', 3000);

    } catch (err) {
        const mensajes = {
            'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
            'auth/weak-password': 'La contraseña es muy débil.',
            'auth/invalid-email': 'El correo no es válido.'
        };
        showMsg('msg-register', '❌ ' + (mensajes[err.code] || err.message));
    } finally {
        setLoading('btn-register', false);
    }
});

// ─── RECUPERAR CONTRASEÑA ────────────────────────────────────────
document.getElementById('form-forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    const email = document.getElementById('forgot-email').value.trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setFieldError('forgot-email', 'err-forgot-email', 'Ingresa un correo válido');
        return;
    }

    setLoading('btn-forgot', true);
    try {
        await sendPasswordResetEmail(auth, email);
        showMsg('msg-forgot',
            '📧 Te enviamos un correo de recuperación. Revisa tu bandeja (y spam).',
            'success'
        );
        document.getElementById('forgot-email').value = '';
    } catch (err) {
        const mensajes = {
            'auth/user-not-found': 'No hay cuenta registrada con ese correo.',
            'auth/invalid-email': 'El correo no es válido.'
        };
        showMsg('msg-forgot', '❌ ' + (mensajes[err.code] || 'Error. Intenta de nuevo.'));
    } finally {
        setLoading('btn-forgot', false);
    }
});
