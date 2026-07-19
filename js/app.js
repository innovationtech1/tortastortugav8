// app.js v6 — Tortas Tortuga: Carrito + Firebase + POS
import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, serverTimestamp, query, where, getDocs, orderBy,
    doc, updateDoc, increment, getDoc, setDoc, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── CONFIG ─────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '12108678210';
const STRIPE_PK = 'pk_test_51TYeb5D50m9DLc4teUV79AZGoopwCp2qoblTAoZcMJsNmwCGzoGC1yJrEuK3I0JftMgomrZt6X3zBnn6hCLoc5QX00LOLbVstY';
let STRIPE_PAYMENT_LINK = ''; // Se llenará cuando el usuario cree su Payment Link
const APPS_SCRIPT_URL = 'TU_APPS_SCRIPT_URL';

// ─── ESTADO ─────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('tt_cart') || '[]');
// Exponer cart globalmente
Object.defineProperty(window, '_cart', {
    get: function() { return cart; },
    set: function(v) { cart = v; }
});

// ─── SPLIT SYSTEM ─────────────────────────────────────────────
let splitMode = false;
let cuentas = [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }];
let cuentaActiva = 1;
let cuentaCounter = 1;
const SPLIT_COLORES = ['#FF5A00','#25D366','#3B82F6','#A78BFA','#F59E0B','#EC4899'];
let pendingItem = null;
// Exponer pendingItem globalmente para confirmarMods en script no-modulo
Object.defineProperty(window, '_pendingItem', {
    get: function() { return pendingItem; },
    set: function(v) { pendingItem = v; }
});
let clientLocation = null;
let currentPaymentMethod = null;
let lastOrderId = null;

// ─── DOM ─────────────────────────────────────────────────────────
const cartModal     = document.getElementById('cart-modal');
const cartIcon      = document.getElementById('cart-icon');
const cartItemsEl   = document.getElementById('cart-items');
const cartCountEl   = document.getElementById('cart-count');
const cartTotalEl   = document.getElementById('cart-total');
const modsModal     = document.getElementById('mods-modal');
const posModal      = document.getElementById('pos-modal');
const clearCartBtn  = document.getElementById('clear-cart-btn');

// ─── ABRIR CARRITO ───────────────────────────────────────────────
cartIcon.addEventListener('click', () => {
    cartModal.classList.add('active');
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) window.renderCartItems();
});
document.getElementById('close-cart').addEventListener('click', () => cartModal.classList.remove('active'));
cartModal.addEventListener('click', e => { if (e.target === cartModal) cartModal.classList.remove('active'); });

// ─── AGREGAR TORTA ───────────────────────────────────────────────
window.addToCart = function(id, nombre, precioOverride, qty) {
    const sel = document.getElementById(`select-${id}`);
    const precio = precioOverride || parseFloat(sel?.value || 0);
    const cantidad = qty || 1;
    pendingItem = { id, nombre, precio, modificaciones: [], _qty: cantidad };
    // Sync with global _pendingItem for confirmarMods in global script
    window._pendingItem = pendingItem;
    document.querySelectorAll('.mod-chip').forEach(c => {
        c.classList.remove('selected');
        const inp = c.querySelector('input');
        if (inp) inp.checked = false;
    });
    const notesEl = document.getElementById('mods-notes');
    if (notesEl) notesEl.value = '';
    const titleEl = document.getElementById('mods-item-name');
    if (titleEl) titleEl.textContent = cantidad > 1 ? `${nombre} ×${cantidad}` : nombre;
    modsModal.classList.add('active');
};

// ─── AGREGAR BEBIDA DIRECTA ──────────────────────────────────────
window.addDrink = function(nombre, precio, detalle = '') {
    const modificaciones = detalle ? [detalle] : [];
    const item = { nombre, precio, modificaciones };
    if (splitMode) {
        const cActiva = cuentas.find(c => c.id === cuentaActiva);
        if (cActiva) cActiva.items.push(item);
        renderSplit();
        document.getElementById('split-panel').classList.add('open');
        document.getElementById('split-overlay').style.opacity = '1';
        document.getElementById('split-overlay').style.pointerEvents = 'all';
        return;
    }
    cart.push(item);
    updateCart();
    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => cartIcon.style.transform = 'scale(1)', 250);
    cartModal.classList.add('active');
};

// ─── MODAL MODS ──────────────────────────────────────────────────
document.getElementById('close-mods').addEventListener('click', () => {
    modsModal.classList.remove('active'); pendingItem = null;
});
modsModal.addEventListener('click', e => { if (e.target === modsModal) { modsModal.classList.remove('active'); pendingItem = null; } });

// Chips toggle — forzar estado visual con y sin click en label
document.querySelectorAll('.mod-chip').forEach(chip => {
    chip.addEventListener('click', function(e) {
        // No prevenir default — dejar que el label active el checkbox
        // Usar requestAnimationFrame para leer el estado después del toggle
        requestAnimationFrame(() => {
            const input = chip.querySelector('input[type="checkbox"]');
            if (input) {
                if (input.checked) {
                    chip.classList.add('selected');
                } else {
                    chip.classList.remove('selected');
                }
            }
        });
    });
});

window._confirmarMods = window.confirmarMods = function confirmarMods(conMods) {
    // Recolectar modificaciones seleccionadas
    function getMods() {
        const mods = [];
        let extra = 0;
        document.querySelectorAll('.mod-chip.selected input').forEach(cb => {
            if (cb.value) mods.push(cb.value);
            extra += parseFloat(cb.getAttribute('data-price') || 0);
        });
        const nota = (document.getElementById('mods-notes')?.value || '').trim();
        if (nota) mods.push('📝 ' + nota);
        return { mods, extra };
    }

    function cerrarModal() {
        document.getElementById('mods-modal')?.classList.remove('active');
        const confirmBtn = document.getElementById('mods-confirm');
        if (confirmBtn) confirmBtn.textContent = 'Agregar al Pedido';
        const skipBtn = document.getElementById('mods-skip');
        if (skipBtn) skipBtn.textContent = 'Sin cambios';
    }

    // ── MODO EDICIÓN ─────────────────────────────────────────────
    if (window._editingItem) {
        const { cuentaId, itemIdx, precioBase } = window._editingItem;
        const CS = window._cuentasSys;

// Inicializar vista del carrito cuando DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) window.renderCartItems();
});

        const c = CS ? CS.cuentas.find(c => c.id === cuentaId) : null;
        if (c && c.items[itemIdx] !== undefined && conMods) {
            const { mods, extra } = getMods();
            c.items[itemIdx].modificaciones = mods;
            c.items[itemIdx].precio = precioBase + extra;
        }
        window._editingItem = null;
        cerrarModal();
        if (window.renderCuentasTabs) window.renderCuentasTabs();
        if (window.renderCartItems) window.renderCartItems();
        return;
    }

    // ── MODO AGREGAR ─────────────────────────────────────────────
    if (!pendingItem) { cerrarModal(); return; }

    if (conMods) {
        const { mods, extra } = getMods();
        pendingItem.modificaciones = mods;
        pendingItem.precio += extra;
    }

    const qty = pendingItem._qty || 1;
    const itemBase = { ...pendingItem };
    delete itemBase._qty;
    delete itemBase._splitMode;

    // Agregar a cuenta activa
    const CS = window._cuentasSys;
    if (CS) {
        const cActiva = CS.cuentas.find(c => c.id === CS.activa);
        if (cActiva) {
            for (let i = 0; i < qty; i++) cActiva.items.push({...itemBase});
        }
    } else {
        for (let i = 0; i < qty; i++) cart.push({...itemBase});
    }

    pendingItem = null;
    cerrarModal();

    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) window.renderCartItems();

    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => cartIcon.style.transform = 'scale(1)', 250);
    cartModal.classList.add('active');
}

// mods buttons now use onclick in HTML



// ─── ACTUALIZAR CARRITO ──────────────────────────────────────────
function updateCart() {
    // Always use cuenta system
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) {
        window.renderCartItems();
        return;
    }
    const total = cart.reduce((s, i) => s + i.precio, 0);
    cartCountEl.textContent = cart.length;
    cartTotalEl.textContent = `$${total.toFixed(2)}`;
    document.getElementById('pos-total-amount').textContent = `$${total.toFixed(2)}`;
    clearCartBtn.style.display = cart.length ? 'inline-flex' : 'none';

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="empty-cart">Tu carrito está vacío 🥺</p>';
        return;
    }
    cartItemsEl.innerHTML = cart.map((item, i) => `
        <div class="cart-item">
            <div class="item-info">
                <div class="item-name">${item.nombre}</div>
                ${item.modificaciones?.length ? `<div class="item-mods">${item.modificaciones.join(' · ')}</div>` : ''}
            </div>
            <div class="item-right">
                <span class="item-price">$${item.precio.toFixed(2)}</span>
                <button class="item-remove" onclick="removeItem(${i})">✕</button>
            </div>
        </div>
    `).join('');
}

window.removeItem = function(i) { cart.splice(i, 1); updateCart(); };
window._limpiarCarrito = window.limpiarCarrito = function() {
    if (!cart.length) return;
    if (confirm(`¿Vaciar el carrito? (${cart.length} artículo${cart.length > 1 ? 's' : ''})`)) {
        cart = []; updateCart(); location.reload();
    }
};

// ─── VALIDACIONES ────────────────────────────────────────────────
function validarFormulario() {
    const nombre = document.getElementById('customer-name').value.trim();
    const telefono = document.getElementById('customer-phone').value.replace(/\D/g, '');
    const esPresencial = document.getElementById('no-phone-checkbox').checked;
    if (!nombre) { alert('⚠️ Por favor ingresa tu nombre.'); return false; }
    if (!esPresencial && telefono.length < 10) { alert('⚠️ El teléfono es obligatorio (10 dígitos).'); return false; }
    if (cart.length === 0) { alert('⚠️ Agrega al menos un artículo.'); return false; }
    return true;
}

function buildOrderData() {
    const nombre = document.getElementById('customer-name').value.trim();
    const telefono = document.getElementById('customer-phone').value.trim();
    const tipo = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    const total = cart.reduce((s, i) => s + i.precio, 0);
    const items = cart.map(i => `${i.nombre} ($${i.precio})${i.modificaciones?.length ? ' [' + i.modificaciones.join(', ') + ']' : ''}`).join('\n');
    const ubicacion = clientLocation
        ? `📍 GPS: ${clientLocation.lat.toFixed(5)}, ${clientLocation.lon.toFixed(5)}`
        : obtenerDireccionTexto();
    return { nombre, telefono, tipo, items, total: `$${total.toFixed(2)}`, ubicacion, totalNum: total };
}

function obtenerDireccionTexto() {
    const calle = document.getElementById('addr-street')?.value.trim() || '';
    const ciudad = document.getElementById('addr-city')?.value.trim() || '';
    const zip = document.getElementById('addr-zip')?.value.trim() || '';
    return calle ? `${calle}, ${ciudad} ${zip}` : 'No especificada';
}

// ─── GUARDAR EN FIREBASE ─────────────────────────────────────────

// ═══════════════ FOLIO SECUENCIAL DIARIO ═══════════════
// Genera número de orden #001, #002... que se reinicia cada día
async function obtenerFolioDiario() {
    const hoy = new Date();
    const fechaKey = hoy.getFullYear() + '-' +
                     String(hoy.getMonth()+1).padStart(2,'0') + '-' +
                     String(hoy.getDate()).padStart(2,'0');

    // ── Intento 1: contador en Firestore (compartido entre dispositivos) ──
    try {
        const contadorRef = doc(db, 'contadores', 'folio_' + fechaKey);
        const nuevoFolio = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(contadorRef);
            const actual = snap.exists() ? (snap.data().valor || 0) : 0;
            const siguiente = actual + 1;
            transaction.set(contadorRef, { valor: siguiente, fecha: fechaKey }, { merge: true });
            return siguiente;
        });
        // Sincronizar el respaldo local
        try { localStorage.setItem('folio_' + fechaKey, String(nuevoFolio)); } catch(_) {}
        return nuevoFolio;
    } catch (e) {
        // Firestore no disponible o sin permisos en 'contadores'
        console.info('Folio: usando contador local (Firestore no disponible para contadores)');
    }

    // ── Intento 2: contador local del navegador ──
    try {
        const key = 'folio_' + fechaKey;
        const actual = parseInt(localStorage.getItem(key) || '0') || 0;
        const siguiente = actual + 1;
        localStorage.setItem(key, String(siguiente));
        // Limpiar contadores de días anteriores
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('folio_') && k !== key) localStorage.removeItem(k);
        }
        return siguiente;
    } catch (e2) {
        // ── Último recurso: número basado en la hora ──
        return parseInt(String(Date.now()).slice(-3)) || 1;
    }
}

// Formatea el folio como #001
function formatearFolio(n) {
    return '#' + String(n).padStart(3, '0');
}

async function guardarPedidoFirebase(data, metodoPago) {
    try {
        // Obtener folio secuencial del día
        const folio = await obtenerFolioDiario();

        const ref = await addDoc(collection(db, 'pedidos'), {
            ...data,
            folio: folio,
            folioStr: formatearFolio(folio),
            metodoPago: metodoPago || 'pendiente',
            estadoPago: 'Por pagar',
            estado: 'Nuevo 🆕',
            // Timestamps de trazabilidad (cuándo pasó a cada estado)
            tiempos: {
                recibida: Date.now(),
                enCocina: null,
                lista:    null,
                entregada: null,
            },
            uid: window._firebaseUser?.uid || 'anonimo',
            creado: serverTimestamp()
        });

        const ticketId = formatearFolio(folio);
        console.log('✅ Pedido guardado:', ref.id);

        // ── SUMAR PUNTOS AL CLIENTE REGISTRADO ──────────────
        const uid = window._firebaseUser?.uid;
        if(uid && uid !== 'anonimo' && data.totalNum > 0){
            try{
                // Regla de puntos: <$25=15pts, $25-$39.99=30pts, $40+=50pts
                let pts = 15;
                if(data.totalNum >= 40)   pts = 50;
                else if(data.totalNum >= 25) pts = 30;

                await updateDoc(doc(db, 'usuarios', uid), {
                    puntos:        increment(pts),
                    puntosGanados: increment(pts),
                    totalPedidos:  increment(1),
                    totalGastado:  increment(data.totalNum)
                });
                console.log(`⭐ +${pts} puntos para cliente ${uid}`);
                // Guardar en sesión para mostrar en confirmación
                window._ultimosPuntos = pts;
            } catch(e){ console.warn('Puntos no actualizados:', e.message); }
        }

        return { id: ref.id, ticket: ticketId };
    } catch(e) {
        console.warn('Firebase save error:', e);
        return null;
    }
}
window.guardarPedidoFirebase = guardarPedidoFirebase;

// ─── GUARDAR EN GOOGLE SHEETS ────────────────────────────────────
async function guardarEnSheets(data) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('TU_')) return;
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch(e) {}
}

// ─── ENVIAR POR WHATSAPP ─────────────────────────────────────────
window.generarWhatsApp = async function() {
    if (!validarFormulario()) return;
    const data = buildOrderData();
    const result = await guardarPedidoFirebase(data, 'whatsapp');
    await guardarEnSheets({ ...data, metodoPago: 'whatsapp' });

    const ticketStr = result ? result.ticket : 'N/A';

    const msg = [
        `🐢 *TORTAS TORTUGA — NUEVO PEDIDO*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `👤 *Cliente:* ${data.nombre}`,
        `📱 *Teléfono:* ${data.telefono || 'En tienda'}`,
        `🚗 *Tipo:* ${data.tipo === 'delivery' ? '🛵 Domicilio' : '🏪 Recoger'}`,
        ``,
        `📋 *Orden:*`,
        data.items,
        ``,
        `💰 *Total: ${data.total}*`,
        data.ubicacion !== 'No especificada' ? `📍 *Ubicación:* ${data.ubicacion}` : '',
        `🔖 *TICKET: #${ticketStr}*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `✅ Pedido enviado desde TortasTortuga.com`
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    cartModal.classList.remove('active');
};

// ─── BOTONES PRINCIPALES ─────────────────────────────────────────
// checkout-btn y pay-now-btn ahora son por cuenta (modal de orden)
const _checkoutBtn = document.getElementById('checkout-btn');
if (_checkoutBtn) _checkoutBtn.addEventListener('click', () => window.generarWhatsApp());
const _payNowBtn = document.getElementById('pay-now-btn');
if (_payNowBtn) _payNowBtn.addEventListener('click', () => {
    if (!validarFormulario()) return;
    cartModal.classList.remove('active');
    posModal.classList.add('active');
});

// ─── MODAL POS ───────────────────────────────────────────────────
document.getElementById('close-pos').addEventListener('click', () => {
    posModal.classList.remove('active');
    ocultarInfoPago();
});
posModal.addEventListener('click', e => {
    if (e.target === posModal) { posModal.classList.remove('active'); ocultarInfoPago(); }
});

const infoContent = {
    cashapp: {
        icon: '📱', titulo: 'Cash App',
        instrucciones: `Envía el pago a:<br><strong class="pay-handle">$danielgomez580</strong><br><br>Incluye en el memo tu nombre y número de pedido.`
    },
    zelle: {
        icon: '📲', titulo: 'Zelle',
        instrucciones: `Envía a:<br><strong class="pay-handle">210-771-3679</strong><br>Nombre: <strong>Daniel Mata</strong><br><br>Incluye tu nombre en el comentario.`
    },
    venmo: {
        icon: '💸', titulo: 'Venmo',
        instrucciones: `Envía a:<br><strong class="pay-handle">@danielgomez580</strong><br><br>Pon tu nombre y pedido en la nota.`
    },
    cash: {
        icon: '💵', titulo: 'Efectivo',
        instrucciones: `Paga en efectivo al momento de recibir tu orden.<br><br>Prepara el monto exacto si es posible: <strong id="cash-total"></strong>`
    }
};

window.mostrarInfoPago = function(metodo) {
    currentPaymentMethod = metodo;
    const info = infoContent[metodo];
    const total = cart.reduce((s, i) => s + i.precio, 0);
    document.getElementById('pos-info-content').innerHTML = `
        <div class="pay-info-card">
            <div class="pay-info-icon">${info.icon}</div>
            <h3 class="pay-info-title">${info.titulo}</h3>
            <p class="pay-info-text">${info.instrucciones.replace('</strong>', ` $${total.toFixed(2)}</strong>`)}</p>
        </div>`;
    document.getElementById('pos-info-panel').style.display = 'block';
    document.querySelector('.pos-body').style.display = 'none';
};

window.ocultarInfoPago = function() {
    document.getElementById('pos-info-panel').style.display = 'none';
    document.querySelector('.pos-body').style.display = 'block';
    currentPaymentMethod = null;
};

window.confirmarPago = async function() {
    const data = buildOrderData();
    const result = await guardarPedidoFirebase(data, currentPaymentMethod);
    await guardarEnSheets({ ...data, metodoPago: currentPaymentMethod });
    posModal.classList.remove('active');
    ocultarInfoPago();
    cart = []; updateCart();
    const metodoNombre = infoContent[currentPaymentMethod]?.titulo || currentPaymentMethod;
    alert(`✅ ¡Orden confirmada!\n\nMétodo: ${metodoNombre}\nTICKET: #${result ? result.ticket : 'N/A'}\n\nCon este número de Ticket puedes rastrear tu orden en el carrito.`);
};

window.pagarConStripe = async function() {
    if (!validarFormulario()) return;
    const data = buildOrderData();
    const result = await guardarPedidoFirebase(data, 'stripe-pending');
    await guardarEnSheets({ ...data, metodoPago: 'stripe' });

    if (!STRIPE_PAYMENT_LINK) {
        // Sin Payment Link aún — mostrar instrucciones
        alert(`⚙️ Los pagos con tarjeta están en configuración.\n\nPor favor usa Efectivo, Zelle o Cash App.\n\nTICKET: #${result ? result.ticket : 'N/A'}`);
        return;
    }

    // Redirigir a Stripe con prefill del nombre
    const nombre = encodeURIComponent(data.nombre);
    const url = `${STRIPE_PAYMENT_LINK}?prefilled_name=${nombre}&client_reference_id=${result ? result.id : 'TT'}`;
    window.open(url, '_blank');
    posModal.classList.remove('active');
    cart = []; updateCart();
};

// ─── TIPO DE ENTREGA ────────────────────────────────────────────
document.querySelectorAll('input[name="order-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const loc = document.getElementById('location-section');
        if (loc) loc.style.display = radio.value === 'delivery' ? 'block' : 'none';
    });
});

// ─── GPS AUTOMÁTICO ──────────────────────────────────────────────
document.getElementById('get-location-btn')?.addEventListener('click', () => obtenerUbicacion());
document.getElementById('locate-by-phone-btn')?.addEventListener('click', () => obtenerUbicacion());

function obtenerUbicacion() {
    if (!navigator.geolocation) { alert('GPS no disponible.'); return; }
    const btn = document.getElementById('get-location-btn');
    const status = document.getElementById('location-status');
    if (btn) { btn.textContent = '⏳ Obteniendo...'; btn.disabled = true; }
    navigator.geolocation.getCurrentPosition(async pos => {
        clientLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (status) {
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${clientLocation.lat}&lon=${clientLocation.lon}&format=json`);
                const d = await r.json();
                status.innerHTML = `✅ <strong>${d.display_name?.split(',').slice(0,3).join(',')||'Ubicación obtenida'}</strong>`;
            } catch { status.innerHTML = `✅ GPS: ${clientLocation.lat.toFixed(4)}, ${clientLocation.lon.toFixed(4)}`; }
        }
        if (btn) { btn.textContent = '✅ Ubicación obtenida'; btn.disabled = false; }
    }, () => {
        if (btn) { btn.textContent = '❌ No se pudo obtener GPS'; btn.disabled = false; }
    });
}

// ─── TABS UBICACIÓN ──────────────────────────────────────────────
document.getElementById('tab-gps')?.addEventListener('click', () => {
    document.getElementById('panel-gps').style.display = 'block';
    document.getElementById('panel-address').style.display = 'none';
    document.getElementById('tab-gps').classList.add('active');
    document.getElementById('tab-address').classList.remove('active');
});
document.getElementById('tab-address')?.addEventListener('click', () => {
    document.getElementById('panel-address').style.display = 'block';
    document.getElementById('panel-gps').style.display = 'none';
    document.getElementById('tab-address').classList.add('active');
    document.getElementById('tab-gps').classList.remove('active');
});

// ─── CHECKBOX PRESENCIAL ─────────────────────────────────────────
document.getElementById('no-phone-checkbox')?.addEventListener('change', e => {
    const phoneInput = document.getElementById('customer-phone');
    const hint = document.getElementById('phone-hint');
    if (e.target.checked) {
        phoneInput.disabled = true;
        phoneInput.style.opacity = '0.4';
        hint.textContent = '🏪 Modo presencial activado.';
    } else {
        phoneInput.disabled = false;
        phoneInput.style.opacity = '1';
        hint.textContent = '⚠️ Requerido para identificar tu pedido.';
    }
});

// ─── VALIDACIÓN TELÉFONO EN VIVO ────────────────────────────────
document.getElementById('customer-phone')?.addEventListener('input', e => {
    const val = e.target.value.replace(/\D/g, '');
    const hint = document.getElementById('phone-hint');
    e.target.classList.toggle('input-ok', val.length >= 10);
    e.target.classList.toggle('input-error', val.length > 0 && val.length < 10);
    if (val.length >= 10) hint.textContent = '✅ Teléfono válido.';
    else if (val.length > 0) hint.textContent = `⚠️ Faltan ${10 - val.length} dígitos.`;
});

// Buscar dirección manual
document.getElementById('search-address-btn')?.addEventListener('click', async () => {
    const calle = document.getElementById('addr-street').value.trim();
    const ciudad = document.getElementById('addr-city').value.trim();
    const zip = document.getElementById('addr-zip').value.trim();
    const status = document.getElementById('address-status');
    if (!calle) { status.innerHTML = '⚠️ Ingresa una calle'; return; }
    status.innerHTML = '⏳ Buscando...';
    try {
        const q = encodeURIComponent(`${calle}, ${ciudad}, TX ${zip}`);
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
        const d = await r.json();
        if (d[0]) {
            clientLocation = { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
            status.innerHTML = `✅ <strong>${d[0].display_name.split(',').slice(0,3).join(',')}</strong>`;
        } else status.innerHTML = '❌ Dirección no encontrada. Escríbela manualmente.';
    } catch { status.innerHTML = '❌ Error al buscar.'; }
});

// ─── BUSCADOR DE TICKETS (RASTREADOR) ─────────────────────────
window.buscarTicket = async function() {
    const input = document.getElementById('ticket-search-input');
    const resultDiv = document.getElementById('ticket-search-result');
    let ticket = input.value.trim().toUpperCase();
    if (ticket.startsWith('#')) ticket = ticket.substring(1);
    
    if (!ticket) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '⚠️ Ingresa un número de ticket válido.';
        return;
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '⏳ Buscando orden...';

    try {
        const q = query(collection(db, 'pedidos'), orderBy('creado', 'desc'));
        const snapshot = await getDocs(q);
        
        let found = null;
        snapshot.forEach(doc => {
            if (doc.id.toUpperCase().endsWith(ticket)) {
                found = { id: doc.id, ...doc.data() };
            }
        });

        if (found) {
            const pagoTxt = found.estadoPago === 'Pagado' ? '✅ Pagado' : '🔴 ' + (found.estadoPago || 'Por pagar');
            resultDiv.innerHTML = `
                <div style="margin-bottom:0.4rem;"><strong>Ticket #${ticket}</strong> — ${found.nombre}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; color:var(--primary);">
                    <span>Estado en cocina:</span>
                    <strong>${found.estado || 'Nuevo 🆕'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Estado del pago:</span>
                    <strong>${pagoTxt} (${found.total})</strong>
                </div>
            `;
        } else {
            resultDiv.innerHTML = '❌ No se encontró ningún pedido con este ticket hoy.';
        }
    } catch (e) {
        console.error(e);
        resultDiv.innerHTML = '⚠️ Hubo un error al buscar el ticket. Revisa tu conexión.';
    }
};

document.getElementById('ticket-search-btn')?.addEventListener('click', window.buscarTicket);
document.getElementById('ticket-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') window.buscarTicket();
});


// ═══════════════════════════════════════════════════════════════
// SISTEMA DE SPLIT DE CUENTAS — Tortas Tortuga
// ═══════════════════════════════════════════════════════════════

// Estado del split (vars declaradas al inicio del archivo)
const COLORES = ['#FF5A00','#25D366','#3B82F6','#A78BFA','#F59E0B','#EC4899'];

// ── ABRIR PANEL SPLIT ──────────────────────────────────────────
window.abrirSplit = function() {
    // Si hay items en el carrito normal, moverlos a Cuenta 1
    if (!splitMode && cart.length > 0) {
        cuentas[0].items = [...cart];
        cart = [];
        updateCart();
    }
    splitMode = true;
    renderSplit();
    document.getElementById('split-panel').classList.add('open');
};

window.cerrarSplit = function() {
    document.getElementById('split-panel').classList.remove('open');
};

// ── NUEVA CUENTA ───────────────────────────────────────────────
window.nuevaCuenta = function() {
    cuentaCounter++;
    const color = COLORES[(cuentas.length) % COLORES.length];
    cuentas.push({
        id: cuentaCounter,
        nombre: 'Cuenta ' + cuentaCounter,
        items: [],
        color: color
    });
    cuentaActiva = cuentaCounter;
    renderSplit();
    // Enfocar el nombre de la nueva cuenta
    setTimeout(() => {
        const inp = document.querySelector(`[data-cid="${cuentaCounter}"] .cuenta-nombre-input`);
        if (inp) { inp.focus(); inp.select(); }
    }, 100);
};

// ── ELIMINAR CUENTA ────────────────────────────────────────────
window.eliminarCuenta = function(cid) {
    const cs = window._cuentasSys;
    alert('eliminarCuenta\ncid=' + cid + ' tipo=' + typeof cid +
          '\ncs=' + (cs ? 'OK' : 'NULL') +
          '\ncuentas=' + (cs ? cs.cuentas.length : 0) +
          '\nactiva=' + (cs ? cs.activa : 'N/A') +
          '\nids=' + (cs ? cs.cuentas.map(function(x){return x.id;}).join(',') : ''));
    if (!cs || cs.cuentas.length <= 1) return;

    const c = cs.cuentas.find(x => x.id === cid);
    if (!c) return;

    // Guardar backup para deshacer
    const backup      = JSON.parse(JSON.stringify(cs.cuentas));
    const backupActiva = cs.activa;

    // Mover items a primera cuenta disponible
    const idx = cs.cuentas.findIndex(x => x.id === cid);
    if (idx >= 0) {
        if (cs.cuentas[idx].items.length) {
            const dest = idx === 0 ? cs.cuentas[1] : cs.cuentas[0];
            dest.items = dest.items.concat(cs.cuentas[idx].items);
        }
        cs.cuentas.splice(idx, 1);
    }
    if (cs.activa === cid) cs.activa = cs.cuentas[0].id;

    window.renderCuentasTabs();
    window.renderCartItems();

    // Toast de deshacer
    const toast = document.getElementById('undo-toast');
    const msg   = document.getElementById('undo-toast-msg');
    if (toast && msg) {
        msg.textContent = 'Cuenta "' + c.nombre + '" eliminada';
        toast.style.display = 'flex';
        clearTimeout(window._undoTimer);
        const btn = document.getElementById('undo-toast-btn');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                cs.cuentas = backup;
                cs.activa  = backupActiva;
                toast.style.display = 'none';
                window.renderCuentasTabs();
                window.renderCartItems();
            });
        }
        window._undoTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }
};

// ── ACTIVAR CUENTA ─────────────────────────────────────────────
window.activarCuenta = function(cid) {
    cuentaActiva = cid;
    renderSplit();
};

// ── EDITAR NOMBRE DE CUENTA ────────────────────────────────────
window.editarNombreCuenta = function(cid, valor) {
    const c = cuentas.find(c => c.id === cid);
    if (c) c.nombre = valor || ('Cuenta ' + cid);
};

// ── MOVER ITEM ENTRE CUENTAS ───────────────────────────────────
window.moverItem = function(fromCid, itemIdx, toCid) {
    const from = cuentas.find(c => c.id === fromCid);
    const to   = cuentas.find(c => c.id === toCid);
    if (!from || !to) return;
    const [item] = from.items.splice(itemIdx, 1);
    to.items.push(item);
    renderSplit();
};

// ── ELIMINAR ITEM DE CUENTA ────────────────────────────────────
window.eliminarItemCuenta = function(cid, itemIdx) {
    const c = cuentas.find(c => c.id === cid);
    if (c) c.splice ? null : c.items.splice(itemIdx, 1);
    renderSplit();
};

// ── DIVIDIR ITEM ENTRE TODAS LAS CUENTAS ──────────────────────
window.dividirItem = function(fromCid, itemIdx) {
    const from = cuentas.find(c => c.id === fromCid);
    if (!from || cuentas.length < 2) return;
    const item = from.items[itemIdx];
    const precioPorCuenta = item.precio / cuentas.length;
    // Crear item dividido en cada cuenta
    cuentas.forEach(c => {
        c.items.push({
            ...item,
            nombre: item.nombre + ' (split)',
            precio: parseFloat(precioPorCuenta.toFixed(2))
        });
    });
    // Eliminar el original
    from.items.splice(itemIdx, 1);
    renderSplit();
};

// ── RENDER PRINCIPAL DEL SPLIT ─────────────────────────────────
function renderSplit() {
    const panel = document.getElementById('split-content');
    if (!panel) return;

    const totalGeneral = cuentas.reduce((s, c) =>
        s + c.items.reduce((ss, i) => ss + i.precio, 0), 0);

    // Tabs de cuentas
    let tabsHTML = '<div class="split-tabs">';
    cuentas.forEach(c => {
        const tot = c.items.reduce((s, i) => s + i.precio, 0);
        const active = c.id === cuentaActiva ? 'active' : '';
        tabsHTML += `
        <div class="split-tab ${active}" onclick="activarCuenta(${c.id})" style="border-color:${c.color}">
            <input class="cuenta-nombre-input" value="${c.nombre}"
                onclick="event.stopPropagation()"
                onchange="editarNombreCuenta(${c.id}, this.value)"
                style="color:${c.color}">
            <div class="split-tab-total">$${tot.toFixed(2)}</div>
            ${cuentas.length > 1 ? `<button class="split-tab-del" onclick="event.stopPropagation();eliminarCuenta(${c.id})">✕</button>` : ''}
        </div>`;
    });
    tabsHTML += `<button class="split-add-btn" onclick="nuevaCuenta()">+ Cuenta</button>`;
    tabsHTML += '</div>';

    // Items de la cuenta activa
    const cuenta = cuentas.find(c => c.id === cuentaActiva);
    let itemsHTML = '';
    if (!cuenta || cuenta.items.length === 0) {
        itemsHTML = '<div class="split-empty">Agrega productos al pedido y aparecerán aquí</div>';
    } else {
        cuenta.items.forEach((item, idx) => {
            // Opciones de mover a otras cuentas
            const moveOpts = cuentas.filter(c => c.id !== cuentaActiva)
                .map(c => `<button class="split-move-btn" style="background:${c.color}22;color:${c.color};border-color:${c.color}44" onclick="moverItem(${cuentaActiva},${idx},${c.id})">→ ${c.nombre}</button>`)
                .join('');

            itemsHTML += `
            <div class="split-item">
                <div class="split-item-top">
                    <div class="split-item-info">
                        <div class="split-item-name">${item.nombre}</div>
                        ${item.modificaciones?.length ? `<div class="split-item-mods">${item.modificaciones.join(' · ')}</div>` : ''}
                    </div>
                    <div class="split-item-precio">$${item.precio.toFixed(2)}</div>
                    <button class="split-item-del" onclick="eliminarItemSplit(${cuentaActiva},${idx})">✕</button>
                </div>
                <div class="split-item-actions">
                    ${moveOpts}
                    ${cuentas.length > 1 ? `<button class="split-divide-btn" onclick="dividirItem(${cuentaActiva},${idx})">÷ Dividir</button>` : ''}
                </div>
            </div>`;
        });
    }

    // Resumen global
    let resumenHTML = '<div class="split-resumen">';
    cuentas.forEach(c => {
        const tot = c.items.reduce((s, i) => s + i.precio, 0);
        resumenHTML += `
        <div class="split-resumen-row">
            <div class="split-resumen-dot" style="background:${c.color}"></div>
            <div class="split-resumen-nom">${c.nombre}</div>
            <div class="split-resumen-items">${c.items.length} producto${c.items.length !== 1 ? 's' : ''}</div>
            <div class="split-resumen-tot" style="color:${c.color}">$${tot.toFixed(2)}</div>
            <button class="split-orden-btn" onclick="abrirOrdenModal(${c.id})"
                ${tot === 0 ? 'disabled' : ''}>Ordenar</button>
        </div>`;
    });
    resumenHTML += `
        <div class="split-total-row">
            <span>Total general</span>
            <span style="color:var(--primary);font-weight:800">$${totalGeneral.toFixed(2)}</span>
        </div>
        <button class="split-all-btn" onclick="ordenarTodas()">
            📱 Enviar todas las cuentas
        </button>
    </div>`;

    panel.innerHTML = tabsHTML + '<div class="split-items">' + itemsHTML + '</div>' + resumenHTML;
}

// ── ELIMINAR ITEM DE CUENTA (window) ──────────────────────────
window.eliminarItemSplit = function(cid, idx) {
    const c = cuentas.find(c => c.id === cid);
    if (c) c.items.splice(idx, 1);
    renderSplit();
};

// ── ORDENAR UNA CUENTA ─────────────────────────────────────────
window.ordenarCuenta = function(cid) {
    const c = cuentas.find(c => c.id === cid);
    if (!c || c.items.length === 0) return;

    const nombre    = document.getElementById('customer-name')?.value || c.nombre;
    const telefono  = document.getElementById('customer-phone')?.value || '';
    const total     = c.items.reduce((s, i) => s + i.precio, 0);
    const tipo      = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';

    let msg = `🐢 *TORTAS TORTUGA*\n`;
    msg += `📋 *${c.nombre}* — Pedido\n`;
    msg += `👤 ${nombre}`;
    if (telefono) msg += ` · 📞 ${telefono}`;
    msg += `\n${tipo === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Delivery'}\n\n`;

    c.items.forEach((item, i) => {
        msg += `${i + 1}. ${item.nombre}`;
        if (item.modificaciones?.length) msg += `\n   └ ${item.modificaciones.join(', ')}`;
        msg += ` — $${item.precio.toFixed(2)}\n`;
    });

    msg += `\n💰 *Total ${c.nombre}: $${total.toFixed(2)}*\n`;
    msg += `_Powered by TortasTortuga.app_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/12108678210?text=${encoded}`, '_blank');
};

// ── ORDENAR TODAS ─────────────────────────────────────────────
window.ordenarTodas = function() {
    const nombre   = document.getElementById('customer-name')?.value || 'Mesa';
    const telefono = document.getElementById('customer-phone')?.value || '';
    const tipo     = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    const total    = cuentas.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.precio, 0), 0);

    let msg = `🐢 *TORTAS TORTUGA — PEDIDO SPLIT*\n`;
    msg += `👤 ${nombre}`;
    if (telefono) msg += ` · 📞 ${telefono}`;
    msg += `\n${tipo === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Delivery'}\n\n`;

    cuentas.forEach(c => {
        if (c.items.length === 0) return;
        const tot = c.items.reduce((s, i) => s + i.precio, 0);
        msg += `━━ *${c.nombre}* ($${tot.toFixed(2)}) ━━\n`;
        c.items.forEach((item, i) => {
            msg += `${i + 1}. ${item.nombre}`;
            if (item.modificaciones?.length) msg += `\n   └ ${item.modificaciones.join(', ')}`;
            msg += ` — $${item.precio.toFixed(2)}\n`;
        });
        msg += '\n';
    });

    msg += `💰 *TOTAL GENERAL: $${total.toFixed(2)}*\n`;
    msg += `_Powered by TortasTortuga.app_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/12108678210?text=${encoded}`, '_blank');
};

// ── SINCRONIZAR CARRITO CON SPLIT ─────────────────────────────
// Cuando se agrega al carrito en modo split, va a la cuenta activa
const _origUpdateCart = window._updateCartOriginal || function() {};

function addToActiveCuenta(item) {
    if (!splitMode) return false;
    const c = cuentas.find(c => c.id === cuentaActiva);
    if (c) { c.items.push(item); renderSplit(); }
    return true;
}

window._addToActiveCuenta = addToActiveCuenta;



window.resetSplit = function() {
    if (!confirm('¿Limpiar todas las cuentas?')) return;
    splitMode = false;
    cuentas = [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }];
    cuentaActiva = 1;
    cuentaCounter = 1;
    renderSplit();
};



window.cerrarSplit = function() {
    document.getElementById('split-panel').classList.remove('open');
    setTimeout(() => {
        document.getElementById('split-overlay').style.opacity = '0';
        document.getElementById('split-overlay').style.pointerEvents = 'none';
    }, 300);
};



/* ═══════════════════════════════════════════════════════════════
   SISTEMA DE CUENTAS (Orders Screen)
   ═══════════════════════════════════════════════════════════════ */

const CUENTA_COLORS = ['#FF5A00','#25D366','#3B82F6','#A78BFA','#F59E0B','#EC4899'];

// Estado de cuentas
if(!window._cuentasSys) {
    window._cuentasSys = {
        cuentas: [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }],
        activa: 1,
        counter: 1
    };
}
const CS = window._cuentasSys;

// ── Agregar item a cuenta activa ──────────────────────────────
function addItemToCuentaActiva(item) {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    if (c) {
        c.items.push({...item});
        renderCuentasTabs();
        renderCartItems();
    }
}

// ── Render tabs de cuentas ────────────────────────────────────
window.renderCuentasTabs = function() {
    const CS = window._cuentasSys;
    if (!CS) return;
    const tabs = document.getElementById('cuentas-tabs');
    if (!tabs) return;

    let html = '';
    CS.cuentas.forEach(c => {
        const tot    = c.items.reduce((s, i) => s + i.precio, 0);
        const active = c.id === CS.activa ? 'active' : '';
        html += '<div class="ctab ' + active + '" onclick="switchCuenta(' + c.id + ')" ' +
            'style="border-color:' + (active ? c.color : 'rgba(255,255,255,.12)') + ';">' +
            '<span class="ctab-nom" style="color:' + (active ? c.color : '#fff') + ';display:block;">' + c.nombre + '</span>' +
            '<span class="ctab-tot" style="display:block;">$' + tot.toFixed(2) + '</span>' +
        '</div>';
    });
    html += '<button onclick="agregarNuevaCuenta()" class="ctab-add">+ Nueva cuenta</button>';
    tabs.innerHTML = html;

    // Mostrar/ocultar botón eliminar en actions bar
    const btnDel = document.getElementById('btn-eliminar-cuenta');
    if (btnDel) btnDel.style.display = CS.cuentas.length > 1 ? 'block' : 'none';

    const lbl = document.getElementById('cuenta-label-active');
    const cActiva = CS.cuentas.find(c => c.id === CS.activa);
    if (lbl && cActiva) {
        lbl.textContent = cActiva.nombre.toUpperCase();
        lbl.style.color = cActiva.color;
    }
};

// ── Render items de cuenta activa ─────────────────────────────
window.renderCartItems = function() {
    const CS = window._cuentasSys;
    if (!CS) return;
    const cActiva = CS.cuentas.find(c => c.id === CS.activa);
    const el = document.getElementById('cart-items');
    if (!el || !cActiva) return;
    const items = cActiva.items;

    // ── Sincronizar input nombre con cuenta activa
    const nomInp = document.getElementById('nombre-cuenta-input');
    if (nomInp && document.activeElement !== nomInp) {
        nomInp.value = cActiva.nombre === ('Cuenta ' + cActiva.id) ? '' : (cActiva.nombre || '');
        nomInp.placeholder = '✏️ ' + (cActiva.nombre || 'Nombre cliente...');
    }

    // ── Total
    const total = items.reduce((s, i) => s + (parseFloat(i.precio)||0), 0);
    const totalEl = document.getElementById('cart-total-amount');
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);

    // ── Tabs de cuentas
    const tabsEl = document.getElementById('cuentas-tabs');
    if (tabsEl) {
        tabsEl.innerHTML = CS.cuentas.map(c => {
            const tot = c.items.reduce((s,i) => s+(parseFloat(i.precio)||0), 0);
            const active = c.id === CS.activa ? 'active' : '';
            return `<div class="ctab ${active}" onclick="window.cambiarCuenta(${c.id})">
                <span class="ctab-nom">${c.nombre}</span>
                <span class="ctab-tot">$${tot.toFixed(2)}</span>
            </div>`;
        }).join('') +
        `<div class="ctab ctab-add" onclick="window.agregarNuevaCuenta()">+ Nueva cuenta</div>`;
    }

    // ── Lista de productos
    if (items.length === 0) {
        el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:3rem 1rem;gap:.75rem;color:#555;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,90,0,.3)"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <div style="font-size:.9rem;font-weight:700;color:#666;">${cActiva.nombre} está vacía</div>
            <div style="font-size:.78rem;color:#444;">Agrega productos desde el menú</div>
        </div>`;
        return;
    }

    el.innerHTML = items.map((item, idx) => {
        const precio  = parseFloat(item.precio) || 0;
        const modsArr = (item.modificaciones || []).filter(m => m && m.trim());

        // Variante en su propia linea
        const varHtml = item.variante
            ? `<div style="font-size:.78rem;color:#FF5A00;font-weight:600;margin-top:.15rem;">${item.variante}</div>`
            : '';

        // Modificaciones como chips (mas legibles que texto corrido)
        const modsHtml = modsArr.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.35rem;">` +
              modsArr.map(m => {
                  const esNota = m.indexOf('\u{1F4DD}') === 0;
                  return `<span style="font-size:.68rem;padding:.15rem .45rem;border-radius:6px;
                      background:${esNota ? 'rgba(251,183,36,.12)' : 'rgba(255,255,255,.06)'};
                      color:${esNota ? '#FBB724' : '#aaa'};
                      border:1px solid ${esNota ? 'rgba(251,183,36,.25)' : 'rgba(255,255,255,.1)'};
                      white-space:nowrap;">${m}</span>`;
              }).join('') +
              `</div>`
            : '';

        return `
        <div style="display:flex;align-items:flex-start;gap:.65rem;
                    padding:.85rem .9rem;border-bottom:1px solid rgba(255,255,255,.05);">
            <!-- Numero -->
            <div style="width:26px;height:26px;background:rgba(255,90,0,.15);border-radius:50%;
                        display:flex;align-items:center;justify-content:center;
                        font-size:.72rem;font-weight:800;color:#FF5A00;flex-shrink:0;margin-top:.1rem;">${idx+1}</div>

            <!-- Info: se expande, el nombre puede ocupar 2 lineas -->
            <div style="flex:1;min-width:0;">
                <div style="font-size:.92rem;font-weight:700;color:#fff;line-height:1.3;
                            word-break:break-word;">${item.nombre||'Producto'}</div>
                ${varHtml}${modsHtml}
            </div>

            <!-- Precio + acciones en columna -->
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;flex-shrink:0;">
                <div style="font-size:.95rem;font-weight:800;color:#25D366;">$${precio.toFixed(2)}</div>
                <div style="display:flex;gap:.3rem;">
                    ${CS.cuentas.length > 1 ? `<button onclick="window.abrirSplitItem(${idx})"
                        style="width:32px;height:32px;background:rgba(59,130,246,.15);
                               border:1px solid rgba(59,130,246,.35);color:#3B82F6;
                               border-radius:8px;font-size:.8rem;cursor:pointer;
                               display:flex;align-items:center;justify-content:center;"
                        title="Mover a otra cuenta">\u21C4</button>` : ''}
                    <button onclick="window.editarItemDelCarrito(${idx})"
                        style="width:32px;height:32px;background:rgba(167,139,250,.15);
                               border:1px solid rgba(167,139,250,.35);color:#A78BFA;
                               border-radius:8px;font-size:.8rem;cursor:pointer;
                               display:flex;align-items:center;justify-content:center;"
                        title="Editar modificaciones">\u270F\uFE0F</button>
                    <button onclick="window.removeItemCuenta(${idx})"
                        style="width:32px;height:32px;background:rgba(244,67,54,.12);
                               border:1px solid rgba(244,67,54,.25);color:#F44336;
                               border-radius:8px;font-size:.85rem;cursor:pointer;
                               display:flex;align-items:center;justify-content:center;"
                        title="Quitar del pedido">\u2715</button>
                </div>
            </div>
        </div>`;
    }).join('');


};

window.agregarNuevaCuenta = function() {
    CS.counter++;
    const color = CUENTA_COLORS[(CS.cuentas.length) % CUENTA_COLORS.length];
    CS.cuentas.push({ id: CS.counter, nombre: 'Cuenta ' + CS.counter, items: [], color });
    CS.activa = CS.counter;
    renderCuentasTabs();
    renderCartItems();
    // Abrir modal para poner nombre
    setTimeout(() => mostrarNombreCuenta(), 200);
};

window.moverItemCuenta = function(itemIdx, toCid) {
    const from = CS.cuentas.find(c => c.id === CS.activa);
    const to   = CS.cuentas.find(c => c.id === toCid);
    if (!from || !to) return;
    const [item] = from.items.splice(itemIdx, 1);
    to.items.push(item);
    renderCuentasTabs();
    renderCartItems();
};

window.removeItemCuenta = function(itemIdx) {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    if (c) c.items.splice(itemIdx, 1);
    renderCuentasTabs();
    renderCartItems();
};

window.splitItemEntreTodas = function(itemIdx) {
    const from = CS.cuentas.find(c => c.id === CS.activa);
    if (!from || CS.cuentas.length < 2) return;
    const item = from.items[itemIdx];
    const precioCada = parseFloat((item.precio / CS.cuentas.length).toFixed(2));
    CS.cuentas.forEach(c => {
        c.items.push({...item, nombre: item.nombre + ' ÷' + CS.cuentas.length, precio: precioCada});
    });
    from.items.splice(itemIdx, 1);
    renderCuentasTabs();
    renderCartItems();
};

window.dividirCuentaIgual = function() {
    const allItems = CS.cuentas.reduce((arr, c) => [...arr, ...c.items], []);
    if (allItems.length === 0 || CS.cuentas.length < 2) return;
    // Distribuir items equitativamente
    CS.cuentas.forEach(c => c.items = []);
    allItems.forEach((item, i) => {
        CS.cuentas[i % CS.cuentas.length].items.push(item);
    });
    renderCuentasTabs();
    renderCartItems();
};

window.limpiarCuentaActual = function() {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    if (c && confirm(`¿Limpiar ${c.nombre}?`)) {
        c.items = [];
        renderCuentasTabs();
        renderCartItems();
    }
};

window.limpiarCarrito = function() {
    if (confirm('¿Limpiar todas las cuentas?')) {
        CS.cuentas = [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }];
        CS.activa = 1; CS.counter = 1;
        cart = [];
        renderCuentasTabs();
        renderCartItems();
        updateCart();
    }
};

// ── Modal nombre de cuenta ────────────────────────────────────
window.mostrarNombreCuenta = function() {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    const inp = document.getElementById('nombre-cuenta-input');
    if (inp && c) { inp.value = c.nombre; inp.focus(); inp.select(); }
    const ov = document.getElementById('nombre-modal-overlay');
    if (ov) ov.classList.add('open');
};

window.cerrarNombreModal = function() {
    const ov = document.getElementById('nombre-modal-overlay');
    if (ov) ov.classList.remove('open');
};

window.guardarNombreCuenta = function() {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    const inp = document.getElementById('nombre-cuenta-input');
    if (c && inp && inp.value.trim()) {
        c.nombre = inp.value.trim();
        renderCuentasTabs();
        renderCartItems();
    }
    cerrarNombreModal();
};

// ── Enviar orden por WhatsApp (cuenta activa) ─────────────────
window._ordenCuentaId = null;

window.enviarCuentaActiva = function() {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    if (!c || c.items.length === 0) { alert('Esta cuenta está vacía'); return; }
    abrirOrdenModal(c.id);
};

window.abrirOrdenModal = function(cid) {
    const c = CS.cuentas.find(c => c.id === cid);
    if (!c) return;
    window._ordenCuentaId = cid;

    // Llenar modal
    document.getElementById('orden-modal-titulo').textContent = '📋 ' + c.nombre;
    document.getElementById('orden-nombre').value = c.nombre !== ('Cuenta ' + c.id) ? c.nombre : '';
    document.getElementById('orden-telefono').value = c._telefono || '';

    // Resumen de items
    const total = c.items.reduce((s, i) => s + i.precio, 0);
    document.getElementById('orden-modal-total').textContent = '$' + total.toFixed(2);
    document.getElementById('orden-modal-items').textContent =
        c.items.length + ' producto' + (c.items.length !== 1 ? 's' : '');

    // Reset tipo entrega
    document.getElementById('orden-tipo-pickup').checked = true;
    document.getElementById('orden-tipo-pickup-lbl').style.borderColor = '#FF5A00';
    document.getElementById('orden-tipo-delivery-lbl').style.borderColor = 'rgba(255,255,255,.12)';

    // Abrir overlay
    const ov = document.getElementById('orden-cuenta-overlay');
    const modal = document.getElementById('orden-cuenta-modal');
    if (ov && modal) {
        ov.style.opacity = '1';
        ov.style.pointerEvents = 'all';
        modal.style.transform = 'translateY(0)';
    }
    setTimeout(() => document.getElementById('orden-nombre').focus(), 300);
};

window.cerrarOrdenModal = function() {
    const ov = document.getElementById('orden-cuenta-overlay');
    const modal = document.getElementById('orden-cuenta-modal');
    if (ov && modal) {
        ov.style.opacity = '0';
        ov.style.pointerEvents = 'none';
        modal.style.transform = 'translateY(100%)';
    }
    window._ordenCuentaId = null;
};

window.enviarOrdenModal = function() {
    const cid = window._ordenCuentaId;
    const CS = window._cuentasSys;
    const c = CS ? CS.cuentas.find(c => c.id === cid) : null;
    if (!c) return;

    const nombre   = (document.getElementById('orden-nombre')?.value || '').trim() || c.nombre;
    const telefono = (document.getElementById('orden-telefono')?.value || '').trim();
    const tipo     = document.querySelector('input[name="orden-tipo"]:checked')?.value || 'pickup';
    const total    = c.items.reduce((s, i) => s + i.precio, 0);
    c._telefono    = telefono;

    let lineas = [
        '🐢 *TORTAS TORTUGA*',
        '━━━━━━━━━━━━━━━━━━━━',
        '📋 *' + c.nombre + '*',
        '👤 ' + nombre + (telefono ? ' · 📞 ' + telefono : ''),
        (tipo === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Domicilio'),
        ''
    ];
    c.items.forEach((item, i) => {
        let linea = (i+1) + '. *' + item.nombre + '*';
        if (item.modificaciones && item.modificaciones.length) {
            linea += ' · ' + item.modificaciones.join(', ');
        }
        linea += ' — $' + item.precio.toFixed(2);
        lineas.push(linea);
    });
    lineas.push('');
    lineas.push('💰 *Total: $' + total.toFixed(2) + '*');

    const msg = lineas.join('\n');
    cerrarOrdenModal();
    window.open('https://wa.me/12108678210?text=' + encodeURIComponent(msg), '_blank');
};

window.enviarTodasLasCuentas = async function() {
    const CS = window._cuentasSys;
    if (!CS) return;

    // Tomar nombre, telefono y tipo de la PRIMERA cuenta con productos.
    // Cada cuenta guarda su propia info (nombre, telefono, tipoServicio).
    var cuentaPrincipal = CS.cuentas.find(function(c){ return c.items.length > 0; }) || CS.cuentas[0];
    var nombre   = (cuentaPrincipal && cuentaPrincipal.nombre) ? cuentaPrincipal.nombre : 'Cliente';
    var telefono = (cuentaPrincipal && cuentaPrincipal.telefono) ? cuentaPrincipal.telefono : '';
    // Mapear el tipo de servicio a pickup/domicilio
    var tipoServ = (cuentaPrincipal && cuentaPrincipal.tipoServicio) || 'Comer aquí';
    var tipo     = (tipoServ === 'Domicilio') ? 'domicilio' : 'pickup';

    // Validar que haya productos
    const hayProductos = CS.cuentas.some(c => c.items.length > 0);
    if (!hayProductos) {
        alert('⚠️ Agrega productos antes de enviar la orden');
        return;
    }

    // Calcular el total CON impuesto, descuento y propina de cada cuenta.
    // Antes solo se sumaban los precios (sin impuesto) — esto lo corrige.
    var subtotalGen = 0, descuentoGen = 0, impuestoGen = 0, propinaGen = 0, totalGen = 0;
    CS.cuentas.forEach(function(c) {
        if (!c.items.length) return;
        var aj = (window._ajustesDinero && window._ajustesDinero[c.id]) || {};
        if (window.calcularTotales) {
            var t = window.calcularTotales(c.items, {
                descuento: aj.descuento, descuentoTipo: aj.descuentoTipo,
                propina: aj.propina, propinaTipo: aj.propinaTipo,
            });
            subtotalGen  += t.subtotal;
            descuentoGen += t.descuento;
            impuestoGen  += t.impuesto;
            propinaGen   += t.propina;
            totalGen     += t.total;
        } else {
            // Respaldo si el modulo de dinero no cargo
            var sub = c.items.reduce(function(ss, i){ return ss + (parseFloat(i.precio)||0); }, 0);
            subtotalGen += sub;
            totalGen    += sub;
        }
    });

    // Construir itemsData (array) que cocina espera
    const itemsData = [];
    CS.cuentas.forEach(c => {
        c.items.forEach(item => {
            itemsData.push({
                nombre:         item.nombre + (item.variante ? ' (' + item.variante + ')' : ''),
                precio:         item.precio,
                modificaciones: item.modificaciones || [],
                cuenta:         c.nombre,
            });
        });
    });

    // String de respaldo (formato: "Nombre (mods) - $precio | ...")
    const itemsStr = itemsData.map(i =>
        i.nombre + (i.modificaciones && i.modificaciones.length ? ' (' + i.modificaciones.join(', ') + ')' : '') + ' - $' + (i.precio||0).toFixed(2)
    ).join(' | ');

    // Datos del pedido para Firebase (cocina lo lee)
    const data = {
        cliente:     nombre,
        telefono:    telefono,
        tipoServicio: tipoServ,
        tipoEntrega: tipo === 'pickup' ? 'Recoger' : 'Domicilio',
        itemsData:   itemsData,
        items:       itemsStr,
        total:       '$' + totalGen.toFixed(2),
        totalNum:    totalGen,
        // Desglose completo del dinero (para reportes y cobro correcto)
        desglose: {
            subtotal:  Math.round(subtotalGen*100)/100,
            descuento: Math.round(descuentoGen*100)/100,
            impuesto:  Math.round(impuestoGen*100)/100,
            impuestoTasa: (window._POS_CONFIG ? window._POS_CONFIG.impuestoTasa : 0),
            propina:   Math.round(propinaGen*100)/100,
            total:     Math.round(totalGen*100)/100,
        },
    };

    // Botón feedback
    const btn = document.querySelector('[onclick*="enviarTodasLasCuentas"]');
    const btnTxtOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '⏳ Enviando...'; btn.disabled = true; }

    try {
        const result = await guardarPedidoFirebase(data, 'cocina');
        const ticket = result && result.ticket ? result.ticket : (result && result.id ? result.id.slice(-4).toUpperCase() : '----');

        // Limpiar el carrito
        CS.cuentas = [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }];
        CS.activa = 1;
        CS.counter = 1;
        if (window.renderCuentasTabs) window.renderCuentasTabs();
        if (window.renderCartItems)   window.renderCartItems();

        // Cerrar carrito
        const cm = document.getElementById('cart-modal');
        if (cm) cm.classList.remove('active');

        alert('✅ ¡Orden enviada a cocina!\n\nTicket #' + ticket + '\nCliente: ' + nombre);
    } catch (e) {
        console.error('Error al enviar orden:', e);
        alert('❌ Error al enviar la orden:\n' + (e.message || e) + '\n\nRevisa que tengas conexión a internet.');
    } finally {
        if (btn) { btn.innerHTML = btnTxtOrig; btn.disabled = false; }
    }

    /* ── ENVÍO POR WHATSAPP DESACTIVADO (por implementar después) ──
    let lineas = [
        '🐢 TORTAS TORTUGA — ORDEN COMPLETA',
        '👤 ' + nombre + (telefono ? ' · 📞 ' + telefono : ''),
    ];
    const msg = lineas.join('\n');
    window.open('https://wa.me/12108678210?text=' + encodeURIComponent(msg), '_blank');
    ─────────────────────────────────────────────────────────── */
};

// ── Patch addToCart confirmarMods → nueva cuenta ───────────────
// Override confirmarMods to use new system
const _origConfirmarMods = window.confirmarMods;


/* ── EDITAR ITEM DE CUENTA ─────────────────────────────────── */
window.editarItemCuenta = function(itemIdx) {
    const cActiva = CS.cuentas.find(c => c.id === CS.activa);
    if (!cActiva) return;
    const item = cActiva.items[itemIdx];
    if (!item) return;

    // Guardar referencia al item que se está editando
    window._editingItem = { cuentaId: CS.activa, itemIdx, precioBase: item.precio };

    // Resetear modal de modificadores
    document.querySelectorAll('.mod-chip input').forEach(c => c.checked = false);
    document.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('mods-notes').value = '';

    // Pre-seleccionar modificaciones actuales
    const modsActuales = item.modificaciones || [];
    document.querySelectorAll('.mod-chip').forEach(chip => {
        const input = chip.querySelector('input');
        if (input && modsActuales.some(m => m.includes(input.value))) {
            chip.classList.add('selected');
            input.checked = true;
        }
    });

    // Pre-llenar nota si existe
    const nota = modsActuales.find(m => m.startsWith('📝 '));
    if (nota) document.getElementById('mods-notes').value = nota.replace('📝 ', '');

    // Cambiar título del modal
    const titleEl = document.getElementById('mods-item-name');
    if (titleEl) titleEl.textContent = `✏️ ${item.nombre}`;

    // Cambiar botón de confirmar para que use guardado en lugar de agregar
    const confirmBtn = document.getElementById('mods-confirm');
    if (confirmBtn) {
        confirmBtn.textContent = '💾 Guardar cambios';
        confirmBtn.dataset.editMode = 'true';
    }
    const skipBtn = document.getElementById('mods-skip');
    if (skipBtn) skipBtn.textContent = 'Sin cambios';

    // Abrir modal
    const modsModal = document.getElementById('mods-modal');
    if (modsModal) modsModal.classList.add('active');
};

// edit mode handled in original confirmarMods


// ── Guardar pedido en Firestore (llamado desde script global) ──
window._addPedidoToFirestore = async function(pedido) {
    pedido.creado = serverTimestamp();
    const ref = await addDoc(collection(db, 'pedidos'), pedido);
    console.log('Pedido guardado:', ref.id);
    return ref.id;
};


// ═══════════════════════════════════════════════════════════
// MÓDULO CAJERO — Firestore functions
// ═══════════════════════════════════════════════════════════

// Crear turno de caja
window._crearTurnoCaja = async function(turnoData) {
    const ref = await addDoc(collection(db, 'turnos_caja'), {
        ...turnoData,
        inicio: serverTimestamp()
    });
    return ref.id;
};

// Obtener turno de caja por ID
window._getTurnoCaja = async function(turnoId) {
    const { getDoc, doc: docFn } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(docFn(db, 'turnos_caja', turnoId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Cerrar turno de caja
window._cerrarTurnoCaja = async function(turnoId, data) {
    await updateDoc(doc(db, 'turnos_caja', turnoId), {
        ...data,
        fin: serverTimestamp(),
        estado: 'cerrado'
    });
};

// Registrar cobro en turno (cuando se confirma un pago)
window._registrarCobro = async function(turnoId, metodo, monto) {
    const campo = metodo === 'efectivo' ? 'totalEfectivo' : 'totalTarjeta';
    await updateDoc(doc(db, 'turnos_caja', turnoId), {
        [campo]:      increment(monto),
        totalOrdenes: increment(1)
    });
};

// Obtener órdenes del cajero de hoy
// Sin where ni orderBy — todo se filtra en JS para evitar índices compuestos
window._getOrdenesCajero = async function(cajeroId) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    // Solo traer pedidos — sin filtros de Firestore
    const snap = await getDocs(collection(db, 'pedidos'));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => {
            const ts = p.creado?.seconds ? new Date(p.creado.seconds * 1000) : null;
            return ts && ts >= hoy && p.cajeroId === cajeroId;
        })
        .sort((a, b) => (b.creado?.seconds || 0) - (a.creado?.seconds || 0));
};



// ── Seleccionar variante: aplica el cambio AL INSTANTE ──
// Igual que el <select> de las tarjetas del menu: eliges y se guarda solo.
window.seleccionarVarianteItem = function(idx) {
    window._varianteSeleccionada = idx;

    var ei = window._editingItem;
    if (!ei) return;

    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === ei.cuentaId; });
    if (!c || !c.items[ei.itemIdx]) return;

    var it = c.items[ei.itemIdx];
    var vars = it.variantesDisp || [];
    if (!vars[idx]) return;

    // Aplicar la variante nueva al item
    var nueva = vars[idx];
    var precioBase = parseFloat(nueva.precio) || 0;
    it.variante    = nueva.label || '';
    it.varianteIdx = idx;
    it.precioBase  = precioBase;

    // Recalcular el precio: base + extras de las modificaciones ya elegidas
    var extra = 0;
    document.querySelectorAll('.mod-chip.selected input').forEach(function(cb) {
        extra += parseFloat(cb.getAttribute('data-price') || 0);
    });
    it.precio = precioBase + extra;

    // Actualizar la referencia de edicion para que confirmarMods no lo revierta
    ei.precioBase = precioBase;

    // ── Refrescar TODO en tiempo real ──
    // 1. Titulo del modal
    var nameEl = document.getElementById('mods-item-name');
    if (nameEl) nameEl.textContent = (it.nombre||'') + (it.variante ? ' \u00b7 ' + it.variante : '');

    // 2. Resaltado de los botones
    var botones = document.querySelectorAll('.var-opt');
    for (var i = 0; i < botones.length; i++) {
        var btn = botones[i];
        var bIdx = parseInt(btn.getAttribute('data-idx'));
        var activa = (bIdx === idx);
        btn.style.background  = activa ? 'rgba(255,90,0,.15)' : 'rgba(255,255,255,.04)';
        btn.style.borderColor = activa ? '#FF5A00' : 'rgba(255,255,255,.1)';
        btn.style.color       = activa ? '#FF5A00' : '#ddd';
        var span = btn.querySelector('span');
        if (span) {
            span.style.fontWeight = activa ? '800' : '600';
            var txt = span.textContent.replace(/^[\u25CF\u25CB]\s*/, '');
            span.textContent = (activa ? '\u25CF ' : '\u25CB ') + txt;
        }
    }

    // 3. Carrito, tabs y lista completa — en tiempo real
    if (window.renderCartItems)     window.renderCartItems();
    if (window.renderCuentasTabs)   window.renderCuentasTabs();
    if (window.renderListaCompleta) window.renderListaCompleta();
    if (window.actualizarDesglose)  window.actualizarDesglose();
};

// ══════════════ EDITAR ITEM DEL CARRITO ══════════════
window.editarItemDelCarrito = function(idx) {
    var CS = window._cuentasSys;
    if (!CS) { console.warn('No _cuentasSys'); return; }
    var ca = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!ca || !ca.items[idx]) { console.warn('Item no encontrado', idx); return; }

    var item = ca.items[idx];

    // Guardar referencia del item que se edita
    window._editingItem = {
        cuentaId:   CS.activa,
        itemIdx:    idx,
        precioBase: item.precioBase || item.precio || 0,
    };

    // Título del modal
    var nameEl = document.getElementById('mods-item-name');
    if (nameEl) nameEl.textContent = (item.nombre||'') + (item.variante ? ' \u00b7 ' + item.variante : '');

    // ── VARIANTES: mostrar opciones si el producto tiene mas de una ──
    window._varianteSeleccionada = null;
    var vSec   = document.getElementById('mods-variantes-section');
    var vLista = document.getElementById('mods-variantes-lista');
    var vars   = item.variantesDisp || [];

    if (vSec && vLista && vars.length > 1) {
        var idxActual = (typeof item.varianteIdx === 'number') ? item.varianteIdx : 0;
        window._varianteSeleccionada = idxActual;

        vLista.innerHTML = vars.map(function(v, i) {
            var activa = i === idxActual;
            var lbl = v.label || ('Opción ' + String.fromCharCode(65+i));
            var pr  = parseFloat(v.precio) || 0;
            // Si el label ya trae el precio, no duplicarlo
            var traePrecio = /\$\s*\d/.test(lbl);
            return '<button type="button" class="var-opt" data-idx="' + i + '" ' +
                'onclick="window.seleccionarVarianteItem(' + i + ')" ' +
                'style="display:flex;justify-content:space-between;align-items:center;' +
                'padding:.7rem .85rem;border-radius:10px;cursor:pointer;font-family:inherit;' +
                'background:' + (activa ? 'rgba(255,90,0,.15)' : 'rgba(255,255,255,.04)') + ';' +
                'border:1.5px solid ' + (activa ? '#FF5A00' : 'rgba(255,255,255,.1)') + ';' +
                'color:' + (activa ? '#FF5A00' : '#ddd') + ';">' +
                '<span style="font-size:.85rem;font-weight:' + (activa ? '800' : '600') + ';text-align:left;">' +
                    (activa ? '\u25CF ' : '\u25CB ') + lbl + '</span>' +
                (traePrecio ? '' : '<span style="font-size:.85rem;font-weight:800;">$' + pr.toFixed(2) + '</span>') +
            '</button>';
        }).join('');
        vSec.style.display = 'block';
    } else if (vSec) {
        vSec.style.display = 'none';
    }

    // Determinar tipo de producto
    var cat = (item.categoria || '').toLowerCase();
    var isTorta  = item.tipo === 'torta' || cat === 'tortas' || cat === '';
    var isDrink  = cat.indexOf('drink') >= 0 || cat.indexOf('bebida') >= 0;
    var isBotana = cat.indexOf('botana') >= 0 || cat.indexOf('extra') >= 0;

    // Mostrar/ocultar secciones
    document.querySelectorAll('.mods-torta').forEach(function(s){ s.style.display = isTorta?'block':'none'; });
    document.querySelectorAll('.mods-drink').forEach(function(s){ s.style.display = isDrink?'block':'none'; });
    document.querySelectorAll('.mods-botana').forEach(function(s){ s.style.display = isBotana?'block':'none'; });
    if (!isTorta && !isDrink && !isBotana) {
        document.querySelectorAll('.mods-torta,.mods-drink,.mods-botana').forEach(function(s){ s.style.display='block'; });
    }

    // Pre-seleccionar modificaciones actuales
    document.querySelectorAll('.mod-chip').forEach(function(chip){
        var cb = chip.querySelector('input');
        var val = cb ? cb.value : '';
        var yaTiene = (item.modificaciones || []).indexOf(val) >= 0;
        chip.classList.toggle('selected', yaTiene);
        if (cb) cb.checked = yaTiene;
    });

    // Cargar nota especial
    var notaExistente = (item.modificaciones || []).find(function(m){ return m.indexOf('\ud83d\udcdd') === 0; });
    var notasEl = document.getElementById('mods-notes');
    if (notasEl) notasEl.value = notaExistente ? notaExistente.replace('\ud83d\udcdd ', '') : '';

    // Abrir modal
    var modal = document.getElementById('mods-modal');
    if (modal) {
        modal.classList.add('active');
    }
};


// ═══════════════════════════════════════════════════════════
//  GESTIÓN COMPLETA DE CUENTAS (nombrar, eliminar, split)
// ═══════════════════════════════════════════════════════════

function _CS() {
    if (!window._cuentasSys) {
        window._cuentasSys = {
            cuentas: [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }],
            activa: 1, counter: 1
        };
    }
    return window._cuentasSys;
}

const _CUENTA_COLORS = ['#FF5A00','#25D366','#3B82F6','#A78BFA','#F59E0B','#EC4899','#14B8A6','#EF4444'];

// ── Cambiar de cuenta activa ──
window.switchCuenta = function(id) {
    var CS = _CS();
    var existe = CS.cuentas.find(function(c){ return c.id === id; });
    if (!existe) return;
    CS.activa = id;
    window.renderCuentasTabs();
    window.renderCartItems();
};
window.cambiarCuenta = window.switchCuenta;

// ── Nueva cuenta ──
window.agregarNuevaCuenta = function() {
    var CS = _CS();
    if (CS.cuentas.length >= 8) {
        alert('⚠️ Máximo 8 cuentas por orden');
        return;
    }
    CS.counter++;
    var color = _CUENTA_COLORS[(CS.cuentas.length) % _CUENTA_COLORS.length];
    CS.cuentas.push({ id: CS.counter, nombre: 'Cuenta ' + CS.counter, items: [], color: color });
    CS.activa = CS.counter;
    window.renderCuentasTabs();
    window.renderCartItems();
};

// ── Poner nombre a la cuenta activa (desde el input) ──
window.guardarNombreCuenta = function(valor) {
    var CS = _CS();
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) return;
    var nombre = (valor || '').trim();
    c.nombre = nombre || ('Cuenta ' + c.id);
    window.renderCuentasTabs();
};

// ── Eliminar la cuenta activa (con validación) ──
window.eliminarCuentaActiva = function() {
    var CS = _CS();
    if (CS.cuentas.length <= 1) {
        alert('⚠️ Debe existir al menos una cuenta');
        return;
    }
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) return;

    var msg = c.items.length > 0
        ? '¿Eliminar "' + c.nombre + '" con ' + c.items.length + ' producto(s)?'
        : '¿Eliminar "' + c.nombre + '"?';
    if (!confirm(msg)) return;

    CS.cuentas = CS.cuentas.filter(function(x){ return x.id !== CS.activa; });
    CS.activa = CS.cuentas[0].id;
    window.renderCuentasTabs();
    window.renderCartItems();
};
window.eliminarCuenta = window.eliminarCuentaActiva;

// ── Limpiar la cuenta activa (vaciar productos) ──
window.limpiarCuentaActiva = function() {
    var CS = _CS();
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c || !c.items.length) return;
    if (!confirm('¿Vaciar todos los productos de "' + c.nombre + '"?')) return;
    c.items = [];
    window.renderCuentasTabs();
    window.renderCartItems();
};

// ── SPLIT: mover un item a otra cuenta ──
window.moverItemACuenta = function(itemIdx, destinoCuentaId) {
    var CS = _CS();
    var origen = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    var destino = CS.cuentas.find(function(x){ return x.id === destinoCuentaId; });
    if (!origen || !destino || !origen.items[itemIdx]) return;

    var item = origen.items.splice(itemIdx, 1)[0];
    destino.items.push(item);
    window.renderCuentasTabs();
    window.renderCartItems();
};

// ── Mostrar selector de cuenta destino para un item ──
// Estado del modal mover/duplicar
window._moverEstado = { itemIdx: null, modo: 'mover' };

window.abrirSplitItem = function(itemIdx) {
    var CS = _CS();
    if (CS.cuentas.length < 2) {
        alert('Crea otra cuenta primero con "+ Nueva cuenta" para poder mover o duplicar productos');
        return;
    }
    var origen = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!origen || !origen.items[itemIdx]) return;

    var item = origen.items[itemIdx];
    window._moverEstado = { itemIdx: itemIdx, modo: 'mover' };

    // Mostrar info del producto
    var info = document.getElementById('mover-item-info');
    if (info) info.textContent = item.nombre + (item.variante ? ' \u00b7 ' + item.variante : '') + ' \u2014 $' + (parseFloat(item.precio)||0).toFixed(2);

    // Resetear a modo mover
    window.setModoMover('mover');

    // Llenar las cuentas destino
    window.renderCuentasDestino();

    var modal = document.getElementById('mover-item-modal');
    if (modal) modal.classList.add('active');
};

window.cerrarMoverItem = function() {
    var modal = document.getElementById('mover-item-modal');
    if (modal) modal.classList.remove('active');
};

window.setModoMover = function(modo) {
    window._moverEstado.modo = modo;
    var btnM = document.getElementById('mover-modo-mover');
    var btnD = document.getElementById('mover-modo-duplicar');
    var hint = document.getElementById('mover-modo-hint');

    if (modo === 'mover') {
        if (btnM) { btnM.style.background='rgba(59,130,246,.15)'; btnM.style.borderColor='#3B82F6'; btnM.style.color='#3B82F6'; }
        if (btnD) { btnD.style.background='rgba(255,255,255,.04)'; btnD.style.borderColor='rgba(255,255,255,.12)'; btnD.style.color='#aaa'; }
        if (hint) hint.innerHTML = '<strong style="color:#3B82F6;">Mover:</strong> el producto se quita de esta cuenta y pasa a la otra.';
    } else {
        if (btnD) { btnD.style.background='rgba(167,139,250,.15)'; btnD.style.borderColor='#A78BFA'; btnD.style.color='#A78BFA'; }
        if (btnM) { btnM.style.background='rgba(255,255,255,.04)'; btnM.style.borderColor='rgba(255,255,255,.12)'; btnM.style.color='#aaa'; }
        if (hint) hint.innerHTML = '<strong style="color:#A78BFA;">Duplicar:</strong> se crea una copia en la otra cuenta y el original se queda aquí.';
    }
};

window.renderCuentasDestino = function() {
    var CS = _CS();
    var cont = document.getElementById('mover-cuentas-lista');
    if (!cont) return;

    var otras = CS.cuentas.filter(function(c){ return c.id !== CS.activa; });
    cont.innerHTML = otras.map(function(c) {
        var total = c.items.reduce(function(s,i){ return s + (parseFloat(i.precio)||0); }, 0);
        return '<button onclick="window.ejecutarMoverItem(\'' + c.id + '\')" ' +
            'style="display:flex;justify-content:space-between;align-items:center;' +
            'padding:.85rem 1rem;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);' +
            'border-radius:12px;cursor:pointer;font-family:inherit;color:#fff;text-align:left;" ' +
            'onmouseover="this.style.borderColor=\'#FF5A00\'" ' +
            'onmouseout="this.style.borderColor=\'rgba(255,255,255,.12)\'">' +
            '<span style="font-weight:700;font-size:.9rem;">' + c.nombre + '</span>' +
            '<span style="font-size:.8rem;color:#25D366;font-weight:700;">$' + total.toFixed(2) + ' \u00b7 ' + c.items.length + '</span>' +
            '</button>';
    }).join('');
};

window.ejecutarMoverItem = function(destinoCuentaId) {
    var CS = _CS();
    var estado = window._moverEstado;
    if (estado.itemIdx === null) return;

    var origen = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    var destino = CS.cuentas.find(function(x){ return x.id === destinoCuentaId; });
    if (!origen || !destino || !origen.items[estado.itemIdx]) return;

    var item = origen.items[estado.itemIdx];

    if (estado.modo === 'duplicar') {
        // DUPLICAR: copia profunda a destino, original se queda
        var copia = JSON.parse(JSON.stringify(item));
        destino.items.push(copia);
    } else {
        // MOVER: quitar del origen, agregar a destino (sin duplicar)
        var movido = origen.items.splice(estado.itemIdx, 1)[0];
        destino.items.push(movido);
    }

    window.cerrarMoverItem();

    // Refrescar todo
    if (window.renderCartItems)      window.renderCartItems();
    if (window.renderCuentasTabs)    window.renderCuentasTabs();
    if (window.renderListaCompleta)  window.renderListaCompleta();
    if (window.actualizarDesglose)   window.actualizarDesglose();
};


// ── Render de tabs de cuentas (con botón eliminar visible) ──
window.renderCuentasTabs = function() {
    var CS = _CS();
    var tabs = document.getElementById('cuentas-tabs');
    if (!tabs) return;

    var html = '';
    CS.cuentas.forEach(function(c) {
        var tot = c.items.reduce(function(s, i){ return s + (parseFloat(i.precio)||0); }, 0);
        var active = c.id === CS.activa;
        html += '<div class="ctab ' + (active?'active':'') + '" onclick="window.switchCuenta(' + c.id + ')" ' +
            'style="border-color:' + (active ? c.color : 'rgba(255,255,255,.12)') + ';cursor:pointer;">' +
            '<span class="ctab-nom" style="color:' + (active ? c.color : '#fff') + ';display:block;">' + c.nombre + '</span>' +
            '<span class="ctab-tot" style="display:block;">$' + tot.toFixed(2) + ' · ' + c.items.length + ' item(s)</span>' +
        '</div>';
    });
    html += '<button onclick="window.agregarNuevaCuenta()" class="ctab-add">+ Nueva cuenta</button>';
    tabs.innerHTML = html;

    // Mostrar botón eliminar solo si hay más de 1 cuenta
    var btnDel = document.getElementById('btn-eliminar-cuenta');
    if (btnDel) btnDel.style.display = CS.cuentas.length > 1 ? 'block' : 'none';

    // Actualizar label de cuenta activa
    var lbl = document.getElementById('cuenta-label-active');
    var cActiva = CS.cuentas.find(function(c){ return c.id === CS.activa; });
    if (lbl && cActiva) {
        lbl.textContent = cActiva.nombre.toUpperCase();
        lbl.style.color = cActiva.color;
    }

    // Sincronizar input de nombre
    var inp = document.getElementById('nombre-cuenta-input');
    if (inp && cActiva && document.activeElement !== inp) {
        var esDefault = cActiva.nombre === ('Cuenta ' + cActiva.id);
        inp.value = esDefault ? '' : cActiva.nombre;
    }
};

console.log('✅ Gestión de cuentas cargada');


// ═══════════════════════════════════════════════════════════
//  MODULO DE DINERO — impuestos, propinas, descuentos
//  IMPORTANTE: la tasa de impuesto debe validarla un contador.
//  8.25% es la tasa combinada tipica en San Antonio TX (2024),
//  pero puede variar por direccion y tipo de producto.
// ═══════════════════════════════════════════════════════════

window._POS_CONFIG = {
    impuestoTasa:    0.0825,   // 8.25% — CONFIGURABLE, validar con contador
    impuestoActivo:  true,
    impuestoNombre:  'Sales Tax',
    propinasSugeridas: [0.15, 0.18, 0.20],
    moneda: '$',
};

// Calcula el desglose completo de una cuenta
window.calcularTotales = function(items, opciones) {
    opciones = opciones || {};
    var cfg = window._POS_CONFIG;

    // Subtotal: suma de los productos
    var subtotal = (items || []).reduce(function(s, i) {
        return s + (parseFloat(i.precio) || 0);
    }, 0);

    // Descuento (monto fijo o porcentaje)
    var descuento = 0;
    if (opciones.descuento) {
        if (opciones.descuentoTipo === 'porcentaje') {
            descuento = subtotal * (parseFloat(opciones.descuento) / 100);
        } else {
            descuento = parseFloat(opciones.descuento) || 0;
        }
        descuento = Math.min(descuento, subtotal); // nunca mas que el subtotal
    }

    var baseGravable = subtotal - descuento;

    // Impuesto sobre la base ya con descuento
    var impuesto = 0;
    if (cfg.impuestoActivo && opciones.aplicarImpuesto !== false) {
        impuesto = baseGravable * cfg.impuestoTasa;
    }

    // Propina (se calcula sobre el subtotal sin impuesto — practica comun)
    var propina = 0;
    if (opciones.propina) {
        if (opciones.propinaTipo === 'porcentaje') {
            propina = baseGravable * (parseFloat(opciones.propina) / 100);
        } else {
            propina = parseFloat(opciones.propina) || 0;
        }
    }

    var total = baseGravable + impuesto + propina;

    return {
        subtotal:     round2(subtotal),
        descuento:    round2(descuento),
        baseGravable: round2(baseGravable),
        impuesto:     round2(impuesto),
        impuestoTasa: cfg.impuestoTasa,
        propina:      round2(propina),
        total:        round2(total),
    };
};

function round2(n) {
    return Math.round((parseFloat(n) || 0) * 100) / 100;
}

// Formatea un monto como moneda
window.fmtMoneda = function(n) {
    return window._POS_CONFIG.moneda + (parseFloat(n) || 0).toFixed(2);
};

console.log('Modulo de dinero cargado — impuesto:', (window._POS_CONFIG.impuestoTasa*100).toFixed(2) + '%');


// ═══════════════ UI: DESCUENTOS Y PROPINAS ═══════════════

// Cada cuenta guarda sus ajustes de dinero
function _ajustesCuenta(cuentaId) {
    if (!window._ajustesDinero) window._ajustesDinero = {};
    if (!window._ajustesDinero[cuentaId]) {
        window._ajustesDinero[cuentaId] = {
            descuento: 0, descuentoTipo: 'porcentaje', descuentoMotivo: '',
            propina: 0, propinaTipo: 'porcentaje',
        };
    }
    return window._ajustesDinero[cuentaId];
}

// ── Actualiza el desglose visible en el carrito ──
window.actualizarDesglose = function() {
    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) return;

    var aj = _ajustesCuenta(c.id);
    var t = window.calcularTotales(c.items, {
        descuento:     aj.descuento,
        descuentoTipo: aj.descuentoTipo,
        propina:       aj.propina,
        propinaTipo:   aj.propinaTipo,
    });

    function set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
    function show(id, visible) { var e = document.getElementById(id); if (e) e.style.display = visible ? 'flex' : 'none'; }

    set('dsg-subtotal', window.fmtMoneda(t.subtotal));
    set('dsg-impuesto', window.fmtMoneda(t.impuesto));
    set('dsg-impuesto-label', window._POS_CONFIG.impuestoNombre + ' (' + (t.impuestoTasa*100).toFixed(2) + '%)');
    set('cart-total-amount', window.fmtMoneda(t.total));

    show('dsg-row-descuento', t.descuento > 0);
    if (t.descuento > 0) {
        set('dsg-descuento', '-' + window.fmtMoneda(t.descuento));
        var lbl = 'Descuento';
        if (aj.descuentoTipo === 'porcentaje') lbl += ' (' + aj.descuento + '%)';
        if (aj.descuentoMotivo) lbl += ' · ' + aj.descuentoMotivo;
        set('dsg-descuento-label', lbl);
    }

    show('dsg-row-propina', t.propina > 0);
    if (t.propina > 0) {
        set('dsg-propina', window.fmtMoneda(t.propina));
        set('dsg-propina-label', 'Propina' + (aj.propinaTipo === 'porcentaje' ? ' (' + aj.propina + '%)' : ''));
    }
};

// ── Modal descuento ──
window.abrirModalDescuento = function() {
    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c || !c.items.length) { alert('Agrega productos antes de aplicar un descuento'); return; }

    var aj = _ajustesCuenta(c.id);
    var v = document.getElementById('desc-valor');
    var t = document.getElementById('desc-tipo');
    var m = document.getElementById('desc-motivo');
    if (v) v.value = aj.descuento || '';
    if (t) t.value = aj.descuentoTipo || 'porcentaje';
    if (m) m.value = aj.descuentoMotivo || '';

    var modal = document.getElementById('modal-descuento');
    if (modal) modal.classList.add('active');
};
window.cerrarModalDescuento = function() {
    var m = document.getElementById('modal-descuento');
    if (m) m.classList.remove('active');
};
window.setDescuentoRapido = function(pct) {
    var v = document.getElementById('desc-valor');
    var t = document.getElementById('desc-tipo');
    if (t) t.value = 'porcentaje';
    if (v) v.value = pct;
    if (pct === 100) {
        var m = document.getElementById('desc-motivo');
        if (m && !m.value) m.value = 'Cortesia';
    }
};
window.aplicarDescuento = function() {
    var CS = window._cuentasSys;
    var c = CS ? CS.cuentas.find(function(x){ return x.id === CS.activa; }) : null;
    if (!c) return;

    var valor  = parseFloat((document.getElementById('desc-valor')||{}).value || 0) || 0;
    var tipo   = (document.getElementById('desc-tipo')||{}).value || 'porcentaje';
    var motivo = ((document.getElementById('desc-motivo')||{}).value || '').trim();

    if (valor <= 0) { alert('Ingresa un valor mayor a 0'); return; }
    if (tipo === 'porcentaje' && valor > 100) { alert('El descuento no puede ser mayor a 100%'); return; }
    if (!motivo) { alert('El motivo del descuento es requerido para el registro'); return; }

    var aj = _ajustesCuenta(c.id);
    aj.descuento = valor;
    aj.descuentoTipo = tipo;
    aj.descuentoMotivo = motivo;

    window.actualizarDesglose();
    window.cerrarModalDescuento();
};
window.quitarDescuento = function() {
    var CS = window._cuentasSys;
    var c = CS ? CS.cuentas.find(function(x){ return x.id === CS.activa; }) : null;
    if (!c) return;
    var aj = _ajustesCuenta(c.id);
    aj.descuento = 0; aj.descuentoMotivo = '';
    window.actualizarDesglose();
    window.cerrarModalDescuento();
};

// ── Modal propina ──
window.abrirModalPropina = function() {
    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c || !c.items.length) { alert('Agrega productos antes de agregar propina'); return; }

    // Generar botones de sugerencia con el monto calculado
    var aj = _ajustesCuenta(c.id);
    var base = window.calcularTotales(c.items, { descuento: aj.descuento, descuentoTipo: aj.descuentoTipo });
    var cont = document.getElementById('propina-sugerencias');
    if (cont) {
        cont.innerHTML = window._POS_CONFIG.propinasSugeridas.map(function(p) {
            var monto = base.baseGravable * p;
            return '<button onclick="window.setPropinaRapida(' + (p*100) + ')" ' +
                'style="padding:.7rem .4rem;background:rgba(37,211,102,.1);border:1.5px solid rgba(37,211,102,.3);' +
                'color:#25D366;border-radius:10px;font-family:inherit;cursor:pointer;">' +
                '<div style="font-weight:800;font-size:1rem;">' + (p*100).toFixed(0) + '%</div>' +
                '<div style="font-size:.7rem;opacity:.8;">' + window.fmtMoneda(monto) + '</div></button>';
        }).join('');
    }

    var v = document.getElementById('prop-valor');
    var t = document.getElementById('prop-tipo');
    if (v) v.value = aj.propina || '';
    if (t) t.value = aj.propinaTipo || 'porcentaje';

    var modal = document.getElementById('modal-propina');
    if (modal) modal.classList.add('active');
};
window.cerrarModalPropina = function() {
    var m = document.getElementById('modal-propina');
    if (m) m.classList.remove('active');
};
window.setPropinaRapida = function(pct) {
    var v = document.getElementById('prop-valor');
    var t = document.getElementById('prop-tipo');
    if (t) t.value = 'porcentaje';
    if (v) v.value = pct;
};
window.aplicarPropina = function() {
    var CS = window._cuentasSys;
    var c = CS ? CS.cuentas.find(function(x){ return x.id === CS.activa; }) : null;
    if (!c) return;

    var valor = parseFloat((document.getElementById('prop-valor')||{}).value || 0) || 0;
    var tipo  = (document.getElementById('prop-tipo')||{}).value || 'porcentaje';
    if (valor < 0) { alert('El valor no puede ser negativo'); return; }

    var aj = _ajustesCuenta(c.id);
    aj.propina = valor;
    aj.propinaTipo = tipo;

    window.actualizarDesglose();
    window.cerrarModalPropina();
};
window.quitarPropina = function() {
    var CS = window._cuentasSys;
    var c = CS ? CS.cuentas.find(function(x){ return x.id === CS.activa; }) : null;
    if (!c) return;
    _ajustesCuenta(c.id).propina = 0;
    window.actualizarDesglose();
    window.cerrarModalPropina();
};

// Hook UNICO: tras renderizar el carrito, actualizar desglose y contador.
// Se hace en un solo lugar para evitar cadenas de overrides fragiles.
(function() {
    var _origRender = window.renderCartItems;
    window.renderCartItems = function() {
        if (_origRender) _origRender.apply(this, arguments);
        if (window.actualizarDesglose)        window.actualizarDesglose();
        if (window.actualizarContadorVerTodo) window.actualizarContadorVerTodo();
    };
})();


// ═══════════════════════════════════════════════════════════
//  PANTALLA COMPLETA: LISTA DE PRODUCTOS DEL PEDIDO
//  Reutiliza las funciones existentes (editar, quitar, mover)
//  No duplica logica — solo cambia la presentacion.
// ═══════════════════════════════════════════════════════════

window.abrirListaCompleta = function() {
    console.log('abrirListaCompleta llamado');
    var CS = window._cuentasSys;
    if (!CS) { console.warn('No hay _cuentasSys'); return; }
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) return;

    if (!c.items.length) {
        alert('No hay productos en esta cuenta');
        return;
    }

    window.renderListaCompleta();
    var modal = document.getElementById('lista-completa-modal');
    if (modal) {
        modal.classList.add('active');
        console.log('Modal abierto, clases:', modal.className);
    } else {
        console.error('No existe #lista-completa-modal en el DOM');
    }
};

window.cerrarListaCompleta = function() {
    var modal = document.getElementById('lista-completa-modal');
    if (modal) modal.classList.remove('active');
    // Refrescar el carrito por si hubo cambios
    if (window.renderCartItems) window.renderCartItems();
    if (window.renderCuentasTabs) window.renderCuentasTabs();
};

window.renderListaCompleta = function() {
    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) return;

    var cont = document.getElementById('lc-items');
    if (!cont) return;

    // Badge de cuenta y resumen
    var badge = document.getElementById('lc-cuenta-badge');
    if (badge) badge.textContent = c.nombre;

    var resumen = document.getElementById('lc-resumen');
    if (resumen) {
        resumen.textContent = c.items.length + (c.items.length === 1 ? ' producto' : ' productos');
    }

    // Si esta vacio
    if (!c.items.length) {
        cont.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#666;">' +
            '<div style="font-size:2rem;margin-bottom:.5rem;">🛒</div>' +
            '<div style="font-size:.9rem;">No hay productos en esta cuenta</div></div>';
        var totEl = document.getElementById('lc-total');
        if (totEl) totEl.textContent = window.fmtMoneda ? window.fmtMoneda(0) : '$0.00';
        return;
    }

    // Render de cada producto — filas grandes y comodas
    cont.innerHTML = c.items.map(function(item, idx) {
        var precio  = parseFloat(item.precio) || 0;
        var modsArr = (item.modificaciones || []).filter(function(m){ return m && m.trim(); });

        var varHtml = item.variante
            ? '<div style="font-size:.85rem;color:#FF5A00;font-weight:600;margin-top:.25rem;">' + item.variante + '</div>'
            : '';

        var modsHtml = '';
        if (modsArr.length) {
            modsHtml = '<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem;">' +
                modsArr.map(function(m) {
                    var esNota = m.indexOf('\u{1F4DD}') === 0;
                    return '<span style="font-size:.75rem;padding:.25rem .6rem;border-radius:8px;' +
                        'background:' + (esNota ? 'rgba(251,183,36,.12)' : 'rgba(255,255,255,.06)') + ';' +
                        'color:' + (esNota ? '#FBB724' : '#bbb') + ';' +
                        'border:1px solid ' + (esNota ? 'rgba(251,183,36,.25)' : 'rgba(255,255,255,.1)') + ';">' +
                        m + '</span>';
                }).join('') + '</div>';
        }

        var btnMover = CS.cuentas.length > 1
            ? '<button onclick="window.lcMoverItem(' + idx + ')" ' +
              'style="padding:.5rem .8rem;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.35);' +
              'color:#3B82F6;border-radius:8px;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;">' +
              '\u21C4 Mover</button>'
            : '';

        return '<div style="display:flex;align-items:flex-start;gap:1rem;padding:1rem 1.2rem;' +
            'border-bottom:1px solid rgba(255,255,255,.05);">' +

            '<div style="width:32px;height:32px;background:rgba(255,90,0,.15);border-radius:50%;' +
            'display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:800;' +
            'color:#FF5A00;flex-shrink:0;">' + (idx+1) + '</div>' +

            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:1rem;font-weight:700;color:#fff;line-height:1.35;">' +
                    (item.nombre || 'Producto') + '</div>' +
                varHtml + modsHtml +
            '</div>' +

            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:.6rem;flex-shrink:0;">' +
                '<div style="font-size:1.05rem;font-weight:800;color:#25D366;">$' + precio.toFixed(2) + '</div>' +
                '<div style="display:flex;gap:.4rem;">' +
                    btnMover +
                    '<button onclick="window.lcEditarItem(' + idx + ')" ' +
                    'style="padding:.5rem .8rem;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.35);' +
                    'color:#A78BFA;border-radius:8px;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;">' +
                    '\u270F\uFE0F Editar</button>' +
                    '<button onclick="window.lcQuitarItem(' + idx + ')" ' +
                    'style="padding:.5rem .8rem;background:rgba(244,67,54,.12);border:1px solid rgba(244,67,54,.3);' +
                    'color:#F44336;border-radius:8px;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;">' +
                    '\u2715 Quitar</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Total con desglose
    var totEl = document.getElementById('lc-total');
    if (totEl && window.calcularTotales) {
        var aj = (window._ajustesDinero && window._ajustesDinero[c.id]) || {};
        var t = window.calcularTotales(c.items, {
            descuento: aj.descuento, descuentoTipo: aj.descuentoTipo,
            propina: aj.propina, propinaTipo: aj.propinaTipo,
        });
        totEl.textContent = window.fmtMoneda(t.total);
    }
};

// ── Acciones dentro del panel (reutilizan las funciones existentes) ──
window.lcEditarItem = function(idx) {
    window.cerrarListaCompleta();
    setTimeout(function(){ window.editarItemDelCarrito(idx); }, 150);
};

window.lcQuitarItem = function(idx) {
    if (window.removeItemCuenta) window.removeItemCuenta(idx);
    window.renderListaCompleta();
};

window.lcMoverItem = function(idx) {
    window.cerrarListaCompleta();
    setTimeout(function(){ window.abrirSplitItem(idx); }, 150);
};

// ── Contador del boton "Ver todo" ──
// El boton SIEMPRE es visible (si no hay productos, avisa al presionarlo).
// No se oculta para evitar que desaparezca por errores de timing.
window.actualizarContadorVerTodo = function() {
    var CS = window._cuentasSys;
    var c = CS ? CS.cuentas.find(function(x){ return x.id === CS.activa; }) : null;
    var btn = document.getElementById('btn-expandir-count');
    if (btn) {
        var n = c ? c.items.length : 0;
        btn.textContent = n > 0 ? ('Ver ' + n) : 'Ver todo';
    }
};




// ═══════════════════════════════════════════════════════════
//  SLIDER DE BEBIDAS en la pantalla "Ver todo"
//  Agrega bebidas rapido sin salir de la lista del pedido.
// ═══════════════════════════════════════════════════════════

window.renderBebidasSlider = function() {
    var slider = document.getElementById('lc-bebidas-slider');
    if (!slider) return;

    var productos = window._menuProductos || [];
    // Filtrar solo bebidas (categoria drinks/bebidas o tipo drink)
    var bebidas = productos.filter(function(p) {
        var cat = (p.categoria || '').toLowerCase();
        var tipo = (p.tipo || '').toLowerCase();
        return cat === 'drinks' || cat === 'bebidas' || tipo === 'drink';
    });

    if (!bebidas.length) {
        slider.innerHTML = '<div style="font-size:.78rem;color:#666;padding:.5rem;">No hay bebidas en el menú</div>';
        return;
    }

    slider.innerHTML = bebidas.map(function(b) {
        // Precio: primera variante o precio base
        var vars = b.variantes || [];
        var precio = vars.length ? (parseFloat(vars[0].precio) || 0) : (parseFloat(b.precio) || 0);
        var img = b.imagen || 'img/michelada.png';
        var pid = b.productId || b.id || '';

        return '<button onclick="window.agregarBebidaRapida(\'' + pid + '\')" ' +
            'style="flex-shrink:0;width:110px;background:rgba(255,255,255,.04);' +
            'border:1px solid rgba(37,211,102,.25);border-radius:12px;padding:.5rem;' +
            'cursor:pointer;font-family:inherit;text-align:center;transition:.15s;" ' +
            'onmouseover="this.style.borderColor=\'#25D366\'" ' +
            'onmouseout="this.style.borderColor=\'rgba(37,211,102,.25)\'">' +
            '<img src="' + img + '" style="width:100%;height:60px;object-fit:contain;border-radius:8px;margin-bottom:.35rem;" ' +
            'onerror="this.style.display=\'none\'">' +
            '<div style="font-size:.72rem;font-weight:700;color:#fff;line-height:1.2;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (b.nombre || 'Bebida') + '</div>' +
            '<div style="font-size:.75rem;font-weight:800;color:#25D366;margin-top:.2rem;">$' + precio.toFixed(2) + '</div>' +
            '</button>';
    }).join('');
};

window.agregarBebidaRapida = function(pid) {
    var productos = window._menuProductos || [];
    var b = productos.find(function(p){ return (p.productId || p.id) === pid; });
    if (!b) return;

    var CS = window._cuentasSys;
    if (!CS) return;
    var c = CS.cuentas.find(function(x){ return x.id === CS.activa; });
    if (!c) { c = CS.cuentas[0]; CS.activa = c.id; }

    // Precio y variante (primera por defecto)
    var vars = b.variantes || [];
    var variante = vars.length ? vars[0] : { label: '', precio: b.precio || 0 };
    var precio = parseFloat(variante.precio) || 0;

    // Agregar al carrito con el mismo formato que el menu
    c.items.push({
        id:             b.productId || b.id,
        nombre:         b.nombre || 'Bebida',
        precio:         precio,
        precioBase:     precio,
        variante:       variante.label || '',
        varianteIdx:    0,
        variantesDisp:  vars.map(function(v){ return { label: v.label||'', precio: parseFloat(v.precio)||0 }; }),
        categoria:      b.categoria || 'drinks',
        tipo:           b.tipo || 'drink',
        modificaciones: [],
    });

    // Feedback visual rapido
    var slider = document.getElementById('lc-bebidas-slider');
    if (slider) {
        var toast = document.createElement('div');
        toast.textContent = '\u2705 ' + (b.nombre || 'Bebida') + ' agregada';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
            'background:#25D366;color:#fff;padding:.6rem 1.2rem;border-radius:20px;font-weight:700;' +
            'font-size:.85rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.4);';
        document.body.appendChild(toast);
        setTimeout(function(){ toast.remove(); }, 1500);
    }

    // Refrescar todo en tiempo real
    if (window.renderListaCompleta)  window.renderListaCompleta();
    if (window.renderCartItems)      window.renderCartItems();
    if (window.renderCuentasTabs)    window.renderCuentasTabs();
    if (window.actualizarDesglose)   window.actualizarDesglose();
};

// Hook: cuando se abre "Ver todo", llenar el slider
(function() {
    var _origAbrir = window.abrirListaCompleta;
    window.abrirListaCompleta = function() {
        if (_origAbrir) _origAbrir.apply(this, arguments);
        if (window.renderBebidasSlider) window.renderBebidasSlider();
    };
})();
