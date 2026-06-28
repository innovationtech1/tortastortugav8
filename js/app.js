// app.js v6 — Tortas Tortuga: Carrito + Firebase + POS
import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, serverTimestamp, query, where, getDocs, orderBy,
    doc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── CONFIG ─────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '12108678210';
const STRIPE_PK = 'pk_test_51TYeb5D50m9DLc4teUV79AZGoopwCp2qoblTAoZcMJsNmwCGzoGC1yJrEuK3I0JftMgomrZt6X3zBnn6hCLoc5QX00LOLbVstY';
let STRIPE_PAYMENT_LINK = ''; // Se llenará cuando el usuario cree su Payment Link
const APPS_SCRIPT_URL = 'TU_APPS_SCRIPT_URL';

// ─── ESTADO ─────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('tt_cart') || '[]');

// ─── SPLIT SYSTEM ─────────────────────────────────────────────
let splitMode = false;
let cuentas = [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }];
let cuentaActiva = 1;
let cuentaCounter = 1;
const SPLIT_COLORES = ['#FF5A00','#25D366','#3B82F6','#A78BFA','#F59E0B','#EC4899'];
let pendingItem = null;
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
cartIcon.addEventListener('click', () => cartModal.classList.add('active'));
document.getElementById('close-cart').addEventListener('click', () => cartModal.classList.remove('active'));
cartModal.addEventListener('click', e => { if (e.target === cartModal) cartModal.classList.remove('active'); });

// ─── AGREGAR TORTA ───────────────────────────────────────────────
window.addToCart = function(id, nombre, precioOverride, qty) {
    const sel = document.getElementById(`select-${id}`);
    const precio = precioOverride || parseFloat(sel?.value || 0);
    const cantidad = qty || 1;

    // Si qty > 1, agregar directamente sin modal (solo primer item abre modal)
    if (cantidad > 1) {
        // Abrir modal una sola vez con nota de cantidad
        pendingItem = { id, nombre, precio, modificaciones: [], _qty: cantidad, _splitMode: splitMode };
        document.querySelectorAll('.mod-chip input').forEach(c => c.checked = false);
        document.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('selected'));
        document.getElementById('mods-notes').value = '';
        document.getElementById('mods-item-name').textContent = `${nombre} ×${cantidad}`;
        modsModal.classList.add('active');
    } else {
        pendingItem = { id, nombre, precio, modificaciones: [], _qty: 1, _splitMode: splitMode };
        document.querySelectorAll('.mod-chip input').forEach(c => c.checked = false);
        document.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('selected'));
        document.getElementById('mods-notes').value = '';
        document.getElementById('mods-item-name').textContent = nombre;
        modsModal.classList.add('active');
    }
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

document.querySelectorAll('.mod-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        chip.querySelector('input').checked = !chip.querySelector('input').checked;
    });
});

function confirmarMods(conMods) {
    if (!pendingItem) return;
    if (conMods) {
        const mods = [];
        let extra = 0;
        document.querySelectorAll('.mod-chip input:checked').forEach(cb => {
            mods.push(cb.value);
            extra += parseFloat(cb.getAttribute('data-price') || 0);
        });
        const nota = document.getElementById('mods-notes').value.trim();
        if (nota) mods.push(`📝 ${nota}`);
        pendingItem.modificaciones = mods;
        pendingItem.precio += extra;
    }
    const qty = pendingItem._qty || 1;
    const itemBase = { ...pendingItem };
    delete itemBase._qty;
    delete itemBase._splitMode;

    // Agregar a cuenta activa del nuevo sistema
    if (window._cuentasSys) {
        const cActiva = window._cuentasSys.cuentas.find(c => c.id === window._cuentasSys.activa);
        if (cActiva) {
            for (let i = 0; i < qty; i++) cActiva.items.push({...itemBase});
        }
    } else {
        for (let i = 0; i < qty; i++) cart.push({...itemBase});
    }

    pendingItem = null;
    modsModal.classList.remove('active');

    // Render y abrir carrito
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems) window.renderCartItems();

    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => cartIcon.style.transform = 'scale(1)', 250);
    cartModal.classList.add('active');
}

document.getElementById('mods-skip').addEventListener('click', () => confirmarMods(false));
document.getElementById('mods-confirm').addEventListener('click', () => confirmarMods(true));

// ─── ACTUALIZAR CARRITO ──────────────────────────────────────────
function updateCart() {
    // Use new cuenta system if available
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
window.limpiarCarrito = function() {
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
async function guardarPedidoFirebase(data, metodoPago) {
    try {
        const ref = await addDoc(collection(db, 'pedidos'), {
            ...data,
            metodoPago: metodoPago || 'pendiente',
            estadoPago: 'Por pagar',
            estado: 'Nuevo 🆕',
            uid: window._firebaseUser?.uid || 'anonimo',
            creado: serverTimestamp()
        });
        
        const ticketId = ref.id.slice(-4).toUpperCase();
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
document.getElementById('checkout-btn').addEventListener('click', () => window.generarWhatsApp());
document.getElementById('pay-now-btn').addEventListener('click', () => {
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
    if (cuentas.length <= 1) return;
    const idx = cuentas.findIndex(c => c.id === cid);
    // Mover items de la cuenta eliminada a la primera
    if (cuentas[idx].items.length > 0) {
        cuentas[0].items.push(...cuentas[idx].items);
    }
    cuentas.splice(idx, 1);
    if (cuentaActiva === cid) cuentaActiva = cuentas[0].id;
    renderSplit();
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
            <button class="split-orden-btn" onclick="ordenarCuenta(${c.id})"
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
    const tabs = document.getElementById('cuentas-tabs');
    if (!tabs) return;

    let html = '';
    CS.cuentas.forEach(c => {
        const tot = c.items.reduce((s, i) => s + i.precio, 0);
        const active = c.id === CS.activa ? 'active' : '';
        html += `<div class="ctab ${active}" data-cid="${c.id}"
            onclick="switchCuenta(${c.id})"
            style="border-color:${active ? c.color : 'rgba(255,255,255,.12)'}">
            <span class="ctab-nom" style="color:${active ? c.color : '#fff'}">${c.nombre}</span>
            <span class="ctab-tot">$${tot.toFixed(2)}</span>
        </div>`;
    });
    html += `<button onclick="agregarNuevaCuenta()" class="ctab-add">+ Nueva cuenta</button>`;
    tabs.innerHTML = html;

    // Update label
    const lbl = document.getElementById('cuenta-label-active');
    const cActiva = CS.cuentas.find(c => c.id === CS.activa);
    if (lbl && cActiva) {
        lbl.textContent = cActiva.nombre.toUpperCase();
        lbl.style.color = cActiva.color;
    }
};

// ── Render items de cuenta activa ─────────────────────────────
window.renderCartItems = function() {
    const cActiva = CS.cuentas.find(c => c.id === CS.activa);
    const cartItemsEl = document.getElementById('cart-items');
    if (!cartItemsEl || !cActiva) return;

    const items = cActiva.items;

    if (items.length === 0) {
        cartItemsEl.innerHTML = '<p class="empty-cart">Esta cuenta está vacía 🥺</p>';
    } else {
        cartItemsEl.innerHTML = items.map((item, idx) => {
            const otherCuentas = CS.cuentas.filter(c => c.id !== CS.activa);
            const moveBtns = otherCuentas.map(c =>
                `<button class="item-move-btn"
                    style="color:${c.color};border-color:${c.color}44"
                    onclick="moverItemCuenta(${idx},${c.id})">
                    → ${c.nombre}
                </button>`
            ).join('');

            const splitBtn = CS.cuentas.length > 1
                ? `<button class="item-split-btn" onclick="splitItemEntreTodas(${idx})">÷ Split</button>`
                : '';

            // Solo mostrar botón editar si es torta (tiene id de producto)
            const editBtn = item.id
                ? `<button class="item-edit-btn" onclick="editarItemCuenta(${idx})">✏️ Editar</button>`
                : '';

            return `<div class="cart-item" id="cart-item-${idx}">
                <div class="item-info">
                    <div class="item-name">${item.nombre}</div>
                    ${item.modificaciones?.length
                        ? `<div class="item-mods">${item.modificaciones.join(' · ')}</div>`
                        : '<div class="item-mods" style="color:#555;font-size:.72rem;">Sin modificaciones</div>'}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;flex-shrink:0;">
                    <div class="item-price">$${item.precio.toFixed(2)}</div>
                    ${editBtn}
                </div>
                <button class="remove-item" onclick="removeItemCuenta(${idx})">✕</button>
                ${(moveBtns || splitBtn)
                    ? `<div class="item-move-row">${moveBtns}${splitBtn}</div>`
                    : ''}
            </div>`;
        }).join('');
    }

    // Update totals
    const total = items.reduce((s, i) => s + i.precio, 0);
    const cartTotalEl = document.getElementById('cart-total');
    if (cartTotalEl) cartTotalEl.textContent = `$${total.toFixed(2)}`;
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        const totalItems = CS.cuentas.reduce((s, c) => s + c.items.length, 0);
        cartCountEl.textContent = totalItems;
    }
    const clearBtn = document.getElementById('clear-cart-btn');
    if (clearBtn) clearBtn.style.display = total > 0 ? 'inline-flex' : 'none';

    // Sync POS total
    const posTotal = document.getElementById('pos-total-amount');
    if (posTotal) {
        const allTotal = CS.cuentas.reduce((s, c) =>
            s + c.items.reduce((ss, i) => ss + i.precio, 0), 0);
        posTotal.textContent = `$${allTotal.toFixed(2)}`;
    }
};

// ── Acciones de cuenta ────────────────────────────────────────
window.switchCuenta = function(cid) {
    CS.activa = cid;
    renderCuentasTabs();
    renderCartItems();
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
window.enviarCuentaActiva = function() {
    const c = CS.cuentas.find(c => c.id === CS.activa);
    if (!c || c.items.length === 0) { alert('Esta cuenta está vacía'); return; }
    const nombre   = document.getElementById('customer-name')?.value || c.nombre;
    const telefono = document.getElementById('customer-phone')?.value || '';
    const tipo     = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    const total    = c.items.reduce((s, i) => s + i.precio, 0);

    let msg = `🐢 *TORTAS TORTUGA*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 *${c.nombre}*\n`;
    msg += `👤 ${nombre}`;
    if (telefono) msg += ` · 📞 ${telefono}`;
    msg += `\n${tipo === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Domicilio'}\n\n`;
    c.items.forEach((item, i) => {
        msg += `${i+1}. *${item.nombre}*`;
        if (item.modificaciones?.length) msg += `\n   _${item.modificaciones.join(', ')}_`;
        msg += ` — $${item.precio.toFixed(2)}\n`;
    });
    msg += `\n💰 *Total: $${total.toFixed(2)}*`;
    window.open(`https://wa.me/12108678210?text=${encodeURIComponent(msg)}`, '_blank');
};

window.enviarTodasLasCuentas = function() {
    const nombre   = document.getElementById('customer-name')?.value || 'Cliente';
    const telefono = document.getElementById('customer-phone')?.value || '';
    const tipo     = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    const totalGen = CS.cuentas.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.precio, 0), 0);

    let msg = `🐢 *TORTAS TORTUGA — ORDEN COMPLETA*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 ${nombre}`;
    if (telefono) msg += ` · 📞 ${telefono}`;
    msg += `\n${tipo === 'pickup' ? '🏪 Recoger en tienda' : '🚗 Domicilio'}\n\n`;

    CS.cuentas.forEach(c => {
        if (!c.items.length) return;
        const tot = c.items.reduce((s, i) => s + i.precio, 0);
        msg += `━ *${c.nombre}* ($${tot.toFixed(2)}) ━\n`;
        c.items.forEach((item, i) => {
            msg += `${i+1}. *${item.nombre}*`;
            if (item.modificaciones?.length) msg += ` _${item.modificaciones.join(', ')}_`;
            msg += ` — $${item.precio.toFixed(2)}\n`;
        });
        msg += `\n`;
    });
    msg += `💰 *TOTAL GENERAL: $${totalGen.toFixed(2)}*`;
    window.open(`https://wa.me/12108678210?text=${encodeURIComponent(msg)}`, '_blank');
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

/* ── GUARDAR EDICIÓN DE ITEM ──────────────────────────────── */
// Patch confirmarMods to handle edit mode
const _origConfirmarModsV2 = window.confirmarMods ? window.confirmarMods.toString() : null;

// Override confirmarMods to check edit mode
const _baseConfirmarMods = window.confirmarMods;
window.confirmarMods = function(conMods) {
    const confirmBtn = document.getElementById('mods-confirm');
    const isEditMode = confirmBtn && confirmBtn.dataset.editMode === 'true';

    if (isEditMode && window._editingItem) {
        const { cuentaId, itemIdx, precioBase } = window._editingItem;
        const c = CS.cuentas.find(c => c.id === cuentaId);
        if (c && c.items[itemIdx]) {
            if (conMods) {
                const mods = [];
                let extra = 0;
                document.querySelectorAll('.mod-chip input:checked').forEach(cb => {
                    mods.push(cb.value);
                    extra += parseFloat(cb.getAttribute('data-price') || 0);
                });
                const nota = document.getElementById('mods-notes').value.trim();
                if (nota) mods.push(`📝 ${nota}`);
                c.items[itemIdx].modificaciones = mods;
                c.items[itemIdx].precio = precioBase + extra;
            }
            // Restaurar modal
            if (confirmBtn) {
                confirmBtn.textContent = 'Agregar al Pedido';
                delete confirmBtn.dataset.editMode;
            }
            const skipBtn = document.getElementById('mods-skip');
            if (skipBtn) skipBtn.textContent = 'Sin cambios';
            window._editingItem = null;
        }
        // Cerrar modal y re-render
        const modsModal = document.getElementById('mods-modal');
        if (modsModal) modsModal.classList.remove('active');
        renderCuentasTabs();
        renderCartItems();
        return;
    }

    // Comportamiento normal
    if (_baseConfirmarMods) _baseConfirmarMods(conMods);
};
