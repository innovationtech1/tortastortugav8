import { db } from './firebase-config.js';
import {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const COL = 'productos';

const PRODUCTOS_INICIALES = [
    {
        productId: 'double-t', nombre: 'NEW! La Special Double T',
        descripcion: '1 Whole BIG avocado with 15 slices of mix meats (ham, pork head cheese & turkey) with tomato, onions, mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-original.png',
        badge: { texto: '🆕 NEW!', clase: 'badge-special' },
        incluye: '✅ 2 Can Sodas + Chips incluidos', tipo: 'torta',
        variantes: [{ label: 'COMBO · 15 Slices — $20', precio: 20 }],
        disponible: true, orden: 0
    },
    {
        productId: 'original', nombre: '1. Original Torta Tortuga',
        descripcion: '1 whole BIG avocado, 3 mix meat slices (ham, pork head cheese & turkey) with tomato, onions, mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-original.png',
        badge: { texto: '⭐ Best Seller', clase: 'badge-bestseller' },
        incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [
            { label: 'A COMBO TRIPLE MEAT · 9 Slices — $17', precio: 17 },
            { label: 'B COMBO DOUBLE MEAT · 6 Slices — $16', precio: 16 },
            { label: 'C COMBO SINGLE MEAT · 3 Slices — $14', precio: 14 }
        ],
        disponible: true, orden: 1
    },
    {
        productId: 'turkey', nombre: '2. Turkey or Ham Tortuga',
        descripcion: '1 whole BIG avocado, turkey, ham or mix meat slices with tomato, onions, mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-turkey.png',
        badge: null, incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [
            { label: 'A COMBO TRIPLE MEAT · 9 Slices — $17', precio: 17 },
            { label: 'B COMBO DOUBLE MEAT · 6 Slices — $16', precio: 16 },
            { label: 'C COMBO SINGLE MEAT · 3 Slices — $14', precio: 14 }
        ],
        disponible: true, orden: 2
    },
    {
        productId: 'pork', nombre: '3. Pork Head Chz Tortuga',
        descripcion: '1 whole BIG avocado, pork head cheese meat slices, with tomato, onions, mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-pork.png',
        badge: null, incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [
            { label: 'A COMBO TRIPLE MEAT · 12 Slices — $17', precio: 17 },
            { label: 'B COMBO DOUBLE MEAT · 8 Slices — $16', precio: 16 },
            { label: 'C COMBO SINGLE MEAT · 4 Slices — $14', precio: 14 }
        ],
        disponible: true, orden: 3
    },
    {
        productId: 'shrimp', nombre: '4. Shrimp Tortuga',
        descripcion: '1 whole BIG avocado, shrimp with 3 mix meat slices (ham, turkey and pork head cheese), tomato, red onions, mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-shrimp.png',
        badge: { texto: '🍤 Especial', clase: 'badge-special' },
        incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [
            { label: 'A COMBO DOUBLE SHRIMP · 10 Shrimps — $20', precio: 20 },
            { label: 'B COMBO SINGLE · 5 Shrimps — $17', precio: 17 }
        ],
        disponible: true, orden: 4
    },
    {
        productId: 'allmeat', nombre: '5. Only Meat No Veggies',
        descripcion: '3 mix meat slices (turkey, ham and pork head cheese) with mayo and queso fresco.',
        categoria: 'tortas', imagen: 'img/torta-allmeat.png',
        badge: { texto: '🥩 All Meat', clase: 'badge-meat' },
        incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [
            { label: 'A COMBO TRIPLE MEAT · 15 Slices — $16', precio: 16 },
            { label: 'B COMBO DOUBLE MEAT · 12 Slices — $15', precio: 15 },
            { label: 'C COMBO SINGLE MEAT · 9 Slices — $13', precio: 13 }
        ],
        disponible: true, orden: 5
    },
    {
        productId: 'vegan', nombre: '6. Vegan Tortuga',
        descripcion: '2 whole BIG avocados, double tomatoes, double onions and double red onions w/ mayo.',
        categoria: 'tortas', imagen: 'img/torta-vegan.png',
        badge: { texto: '🌱 Vegan', clase: 'badge-veg' },
        incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [{ label: 'COMBO A — $13', precio: 13 }],
        disponible: true, orden: 6
    },
    {
        productId: 'kids', nombre: '7. Kids Tortuga',
        descripcion: '8 ham slices, cheese and mayo.',
        categoria: 'tortas', imagen: 'img/torta-kids.png',
        badge: { texto: '👧 Kids', clase: 'badge-kids' },
        incluye: '✅ Can Soda + Chips incluidos', tipo: 'torta',
        variantes: [{ label: 'COMBO — $9', precio: 9 }],
        disponible: true, orden: 7
    },
    {
        productId: 'miche', nombre: 'Miche Tortuga',
        descripcion: 'Clamato juice, fresh lime, Tajin, sauces. Squirt/Monster/Topo Chico.',
        categoria: 'drinks', imagen: 'img/michelada.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'w/ 6 shrimp — $15', precio: 15 },
            { label: 'w/ 3 shrimp — $13', precio: 13 },
            { label: 'w/ japanese nuts & red onions — $12', precio: 12 },
            { label: 'w/ cucumber & japanese nuts — $11', precio: 11 },
            { label: 'Plain — $10', precio: 10 },
            { label: 'Cup, Ice and Michelada Mix — $8', precio: 8 }
        ],
        disponible: true, orden: 10
    },
    {
        productId: 'topochico', nombre: 'TopoChico Preparado',
        descripcion: 'NEW. Refreshing TopoChico with chamoy and Tajin on top.',
        categoria: 'drinks', imagen: 'img/topochico.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'w/ 6 shrimp & botana — $12', precio: 12 },
            { label: 'w/ 3 shrimps & top — $10', precio: 10 },
            { label: 'Plain — $7', precio: 7 }
        ],
        disponible: true, orden: 11
    },
    {
        productId: 'squirt', nombre: 'El Squirt Ruso',
        descripcion: 'Clamato juice, fresh lime, Tajin, Cucumber, japanese nuts, chamoy on top.',
        categoria: 'drinks', imagen: 'img/squirt-ruso.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'w/ 3 shrimps & red onions — $12', precio: 12 },
            { label: 'Plain — $10', precio: 10 }
        ],
        disponible: true, orden: 12
    },
    {
        productId: 'hangover', nombre: 'The Hangover Monster',
        descripcion: 'Clamato juice, fresh lime, sauces, with japanese nuts and red onions on top.',
        categoria: 'drinks', imagen: 'img/hangover-monster.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'w/ 3 shrimps — $13', precio: 13 },
            { label: 'Plain — $11', precio: 11 }
        ],
        disponible: true, orden: 13
    },
    {
        productId: 'bottle', nombre: 'Bottle Drinks',
        descripcion: null,
        categoria: 'drinks', imagen: 'img/bottle-drinks.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'Topo Chico 600 ml — $5', precio: 5 },
            { label: 'Monster — $4', precio: 4 },
            { label: 'Mexican Coke — $4', precio: 4 },
            { label: 'Gatorade — $3', precio: 3 },
            { label: 'Can Soda — $2', precio: 2 },
            { label: 'Water Bottle — $2', precio: 2 }
        ],
        disponible: true, orden: 14
    },
    {
        productId: 'shrimp-botana', nombre: 'Shrimp Botana',
        descripcion: 'Shrimps with Fresh cucumber, red onions, japanese nuts and Clamato juice.',
        categoria: 'botanas', imagen: 'img/shrimp-botana.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'LG (15 shrimps) — $20', precio: 20 },
            { label: 'MD (10 shrimps) — $14', precio: 14 }
        ],
        disponible: true, orden: 20
    },
    {
        productId: 'botana-platter', nombre: 'Botana Platter',
        descripcion: 'Choice of chips, japanese nuts, cucumbers, red onions with chamoy, Tajin.',
        categoria: 'botanas', imagen: 'img/botana-platter.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'LG — $12', precio: 12 },
            { label: 'SM — $8', precio: 8 }
        ],
        disponible: true, orden: 21
    },
    {
        productId: 'botana-japonesa', nombre: 'Botana Japonesa',
        descripcion: 'Choice of chips and japanese nuts, with chamoy, Tajin and Valentina sauce.',
        categoria: 'botanas', imagen: 'img/botanacacahuates.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'LG — $10', precio: 10 },
            { label: 'SM — $6', precio: 6 }
        ],
        disponible: true, orden: 22
    },
    {
        productId: 'cucumbersitos', nombre: 'Cucumbersitos',
        descripcion: 'Cucumber slices with chamoy, Tajin and Valentina sauce on top.',
        categoria: 'botanas', imagen: 'img/cucumbersitos.png',
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: 'LG — $8', precio: 8 },
            { label: 'SM — $4', precio: 4 }
        ],
        disponible: true, orden: 23
    },
    {
        productId: 'sides', nombre: 'Sides & Extras',
        descripcion: null,
        categoria: 'botanas', imagen: null,
        badge: null, incluye: null, tipo: 'drink',
        variantes: [
            { label: '6 Shrimp — $5', precio: 5 },
            { label: 'Torta Bun — $3.50', precio: 3.5 },
            { label: 'Chips — $2.00', precio: 2 },
            { label: '1 Shrimp — $1.00', precio: 1 },
            { label: '1 Extra Slice of Meat — $1.00', precio: 1 },
            { label: 'Add Cup with Ice — $1.00', precio: 1 },
            { label: 'Extra Salsa or Jalapeno — $0.50', precio: 0.5 }
        ],
        disponible: true, orden: 24
    }
];

export async function seedProductos() {
    const snap = await getDocs(collection(db, COL));
    if (!snap.empty) return;
    for (const p of PRODUCTOS_INICIALES) {
        await addDoc(collection(db, COL), p);
    }
}

export async function getProductos() {
    const q = query(collection(db, COL), orderBy('orden'));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
}

export async function crearProducto(data) {
    return await addDoc(collection(db, COL), data);
}

export async function actualizarProducto(id, data) {
    await updateDoc(doc(db, COL, id), data);
}

export async function eliminarProducto(id) {
    await deleteDoc(doc(db, COL, id));
}

// ── MENÚ EN TIEMPO REAL ──────────────────────────────────────────────────────
let _menuUnsub = null;

function _limpiarMenuContainers() {
    ['menu-container','drinks-container','botanas-container'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function _renderProductos(productos) {
    _limpiarMenuContainers();

    const containers = {
        tortas:     document.getElementById('menu-container'),
        drinks:     document.getElementById('drinks-container'),
        botanas:    document.getElementById('botanas-container'),
        bebidas:    document.getElementById('drinks-container'),
        extras:     document.getElementById('botanas-container'),
        combos:     document.getElementById('botanas-container'),
        especiales: document.getElementById('botanas-container'),
    };

    // Deduplicar por nombre
    const seen = new Set();
    const uniq = productos.filter(function(p) {
        const key = (p.nombre || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    uniq.sort(function(a, b) { return (a.orden||99) - (b.orden||99); });

    uniq.forEach(function(p) {
        if (!p.disponible && p.disponible !== undefined) return;
        const card = crearCard(p);
        const cat  = (p.categoria || 'tortas').toLowerCase();
        const cont = containers[cat] || containers.tortas;
        if (cont) cont.appendChild(card);
    });
}

export function renderMenu() {
    // Solo inicializar una vez
    if (_menuUnsub) return;

    _limpiarMenuContainers();
    // Mostrar loading
    const mc = document.getElementById('menu-container');
    if (mc) mc.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">Cargando menú...</div>';

    try {
        _menuUnsub = onSnapshot(
            collection(db, 'productos'),
            function(snapshot) {
                if (snapshot.empty) {
                    // Firestore vacío — usar datos estáticos
                    _renderProductos([...PRODUCTOS_INICIALES]);
                    return;
                }

                const fsProds = snapshot.docs.map(function(d) {
                    const data = d.data();
                    let pr = parseFloat(data.precio || data._precio || 0);
                    if (!pr && data.variantes && data.variantes.length) {
                        pr = parseFloat(data.variantes[0].precio || 0);
                    }
                    // Buscar base estático para imagen y badge
                    const base = PRODUCTOS_INICIALES.find(function(p) {
                        return p.nombre.toLowerCase().slice(0,8) ===
                               (data.nombre||'').toLowerCase().slice(0,8);
                    }) || {};
                    return {
                        productId:   d.id,
                        nombre:      data.nombre      || base.nombre      || '',
                        descripcion: data.descripcion || base.descripcion || '',
                        categoria:   data.categoria   || base.categoria   || 'tortas',
                        precio:      pr,
                        variantes:   (data.variantes && data.variantes.length)
                                        ? data.variantes
                                        : (base.variantes || [{ label:'Precio base', precio: pr }]),
                        imagen:      base.imagen  || 'img/torta-original.png',
                        badge:       base.badge   || null,
                        incluye:     base.incluye || null,
                        tipo:        base.tipo    || 'torta',
                        disponible:  data.activo  !== false,
                        orden:       data.orden   || base.orden || 99,
                    };
                });
                _renderProductos(fsProds);
            },
            function(err) {
                console.warn('Menu Firestore error:', err.code);
                // Mantener datos estáticos ya renderizados
            }
        );
    } catch(e) {
        console.warn('Menu listener error:', e);
    }
}


export function actualizarBotonAgregarTodo() {
    let totalItems = 0;
    let totalProductos = 0;
    document.querySelectorAll('.qty-num').forEach(el => {
        const q = parseInt(el.textContent) || 0;
        if (q > 0) { totalItems += q; totalProductos++; }
    });
    const fab = document.getElementById('fab-agregar-todo');
    const fabCount = document.getElementById('fab-count');
    if (!fab) return;
    if (totalItems > 0) {
        fab.style.display = 'flex';
        if (fabCount) fabCount.textContent = totalItems + ' producto' + (totalItems > 1 ? 's' : '');
    } else {
        fab.style.display = 'none';
    }
}

window.agregarTodoAlCarrito = function() {
    const cs = window._cuentasSys;
    if (!cs) return;
    const cActiva = cs.cuentas.find(x => x.id === cs.activa);
    if (!cActiva) return;

    let totalAgregados = 0;

    document.querySelectorAll('.qty-num').forEach(qtyEl => {
        const qty = parseInt(qtyEl.textContent) || 0;
        if (qty === 0) return;

        // Extraer pid del id del elemento
        const pid = qtyEl.id.replace('qty-', '');
        if (!pid) return;

        // Obtener select y precio
        const sel    = document.getElementById('select-' + pid);
        const precio = sel ? (parseFloat(sel.value) || 0) : 0;
        const label  = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : '';

        // Obtener nombre de la card padre
        const card   = qtyEl.closest('.product-card');
        const nombre = card ? (card.querySelector('.product-title')?.textContent || pid) : pid;

        // Agregar qty veces al carrito activo
        for (let i = 0; i < qty; i++) {
            cActiva.items.push({
                id: pid,
                nombre: nombre,
                precio: precio,
                modificaciones: label ? [label] : []
            });
            totalAgregados++;
        }
    });

    if (totalAgregados === 0) return;

    // Render y abrir carrito
    if (window.renderCuentasTabs) window.renderCuentasTabs();
    if (window.renderCartItems)   window.renderCartItems();
    const cm = document.getElementById('cart-modal');
    if (cm) cm.classList.add('active');

    // Reset todas las cantidades a 0
    document.querySelectorAll('.qty-num').forEach(el => el.textContent = '0');
    document.querySelectorAll('.add-to-cart').forEach(b => b.style.display = 'none');
    actualizarBotonAgregarTodo();

    // Feedback FAB
    const fab = document.getElementById('fab-agregar-todo');
    if (fab) {
        fab.style.background = '#25D366';
        setTimeout(() => { fab.style.background = ''; }, 1000);
    }
    console.log('✅ Agregados', totalAgregados, 'productos al carrito');
};
