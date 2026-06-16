// app.js v6 — Tortas Tortuga: Carrito + Firebase + POS
import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, serverTimestamp, query, where, getDocs, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── CONFIG ─────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '12108678210';
const STRIPE_PK = 'pk_test_51TYeb5D50m9DLc4teUV79AZGoopwCp2qoblTAoZcMJsNmwCGzoGC1yJrEuK3I0JftMgomrZt6X3zBnn6hCLoc5QX00LOLbVstY';
let STRIPE_PAYMENT_LINK = ''; // Se llenará cuando el usuario cree su Payment Link
const APPS_SCRIPT_URL = 'TU_APPS_SCRIPT_URL';

// ─── ESTADO ─────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('tt_cart') || '[]');
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
window.addToCart = function(id, nombre) {
    const sel = document.getElementById(`select-${id}`);
    const precio = parseFloat(sel.value);
    pendingItem = { id, nombre, precio, modificaciones: [] };
    // Resetear chips
    document.querySelectorAll('.mod-chip input').forEach(c => c.checked = false);
    document.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('mods-notes').value = '';
    document.getElementById('mods-item-name').textContent = nombre;
    modsModal.classList.add('active');
};

// ─── AGREGAR BEBIDA DIRECTA ──────────────────────────────────────
window.addDrink = function(nombre, precio, detalle = '') {
    const modificaciones = detalle ? [detalle] : [];
    cart.push({ nombre, precio, modificaciones });
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
    cart.push(pendingItem);
    pendingItem = null;
    modsModal.classList.remove('active');
    updateCart();
    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => cartIcon.style.transform = 'scale(1)', 250);
    cartModal.classList.add('active');
}

document.getElementById('mods-skip').addEventListener('click', () => confirmarMods(false));
document.getElementById('mods-confirm').addEventListener('click', () => confirmarMods(true));

// ─── ACTUALIZAR CARRITO ──────────────────────────────────────────
function updateCart() {
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
        
        // El ticket son los últimos 4 caracteres del ID de Firebase
        const ticketId = ref.id.slice(-4).toUpperCase();
        
        console.log('✅ Pedido guardado:', ref.id);
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
