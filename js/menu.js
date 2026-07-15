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



/* ── CREAR TARJETA DE PRODUCTO (POS) ──────────────── */
function crearCard(p) {
    if (!window._cardCounter) window._cardCounter = 0;
    window._cardCounter++;
    const _slug = (p.nombre||'prod').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12);
    const pid   = (p.productId || p._docId || _slug) + '_' + window._cardCounter;
    const vars  = p.variantes || [];

    const card = document.createElement('div');
    card.style.cssText = 'background:#1E1E1E;border-radius:18px;border:1px solid rgba(255,255,255,.07);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 20px rgba(0,0,0,.45);';

    // Badge
    const badgeTxt = p.badge ? p.badge.texto : '';
    const badgeEl = badgeTxt
        ? '<span style="position:absolute;top:.55rem;left:.55rem;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);color:#FBB724;font-size:.68rem;font-weight:900;letter-spacing:.05em;padding:.22rem .65rem;border-radius:20px;pointer-events:none;">' + badgeTxt + '</span>'
        : '';

    // Incluye
    const incluyeRaw = (p.incluye || '').replace(/^[✅ ]+/, '').trim();
    const incluyeEl = incluyeRaw
        ? '<div style="font-size:.7rem;color:#25D366;font-weight:600;margin:.2rem 0;">✅ ' + incluyeRaw + '</div>'
        : '';

    // Variantes
    let varEl = '';
    if (vars.length > 1) {
        const opts = vars.map(function(v,i){
            var lbl = (v.label || '').trim() || ('Opción ' + String.fromCharCode(65+i));
            var pr  = parseFloat(v.precio) || 0;
            // Si el label ya trae precio, no duplicarlo
            var txt = /\$\s*\d/.test(lbl) ? lbl : (lbl + ' — $' + pr.toFixed(2));
            return '<option value="'+i+'">'+txt+'</option>';
        }).join('');
        varEl = '<select id="var-'+pid+'" class="var-select" style="width:100%;background:#0d0d0d;border:1.5px solid rgba(255,90,0,.5);color:#fff;border-radius:10px;padding:.42rem .65rem;font-family:inherit;font-size:.78rem;margin:.3rem 0;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;">'+opts+'</select>';
    } else if (vars.length === 1) {
        // Una sola variante: mostrar SIEMPRE el precio.
        // Si el label es genérico ("Precio base"), mostrar solo el precio.
        var _v   = vars[0];
        var _pr  = parseFloat(_v.precio) || parseFloat(p.precio) || 0;
        var _lbl = (_v.label || '').trim();
        var _generico = !_lbl || /^precio base$/i.test(_lbl);
        // Si el label ya trae el precio (ej "COMBO A — $17"), no duplicarlo
        var _labelTraePrecio = /\$\s*\d/.test(_lbl);
        var _texto;
        if (_generico) {
            _texto = '$' + _pr.toFixed(2);
        } else if (_labelTraePrecio) {
            _texto = _lbl;
        } else {
            _texto = _lbl + ' — $' + _pr.toFixed(2);
        }
        varEl = '<div style="font-size:.88rem;color:#FF5A00;font-weight:800;margin:.2rem 0;">'+_texto+'</div>';
    } else if (p.precio) {
        varEl = '<div style="font-size:.88rem;color:#FF5A00;font-weight:800;margin:.2rem 0;">$'+(parseFloat(p.precio)||0).toFixed(2)+'</div>';
    }

    const imgSrc = p.imagen || 'img/torta-original.png';

    card.innerHTML =
        '<div style="position:relative;width:100%;height:170px;overflow:hidden;flex-shrink:0;">' +
            '<img src="'+imgSrc+'" alt="'+(p.nombre||'')+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">' +
            badgeEl +
        '</div>' +
        '<div style="padding:.75rem .9rem .9rem;display:flex;flex-direction:column;flex:1;gap:.15rem;">' +
            '<h3 style="font-size:.9rem;font-weight:800;color:#fff;margin:0;line-height:1.25;">'+(p.nombre||'')+'</h3>' +
            '<p style="font-size:.7rem;color:#888;margin:0;line-height:1.4;">'+(p.descripcion||'')+'</p>' +
            incluyeEl +
            varEl +
            '<div style="display:flex;align-items:center;gap:.4rem;margin-top:auto;padding-top:.5rem;">' +
                '<button class="btn-agregar-card" style="flex:1;padding:.6rem;background:linear-gradient(135deg,#FF5A00,#FF8C00);border:none;color:#fff;border-radius:10px;font-family:inherit;font-size:.82rem;font-weight:800;cursor:pointer;box-shadow:0 3px 8px rgba(255,90,0,.35);">🛒 Agregar</button>' +
                '<div style="display:flex;align-items:center;flex-shrink:0;">' +
                    '<button class="qty-btn qty-minus" type="button" style="width:30px;height:30px;border-radius:8px 0 0 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,90,0,.3);color:#FF5A00;font-size:1.1rem;font-weight:800;cursor:pointer;">−</button>' +
                    '<span class="qty-num" style="min-width:30px;height:30px;line-height:30px;text-align:center;font-weight:800;font-size:.9rem;color:#fff;background:rgba(255,255,255,.06);">0</span>' +
                    '<button class="qty-btn qty-plus" type="button" style="width:30px;height:30px;border-radius:0 8px 8px 0;background:rgba(255,255,255,.08);border:1px solid rgba(255,90,0,.3);color:#FF5A00;font-size:1.1rem;font-weight:800;cursor:pointer;">+</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    // ── ELEMENTOS ──
    const qtyEl    = card.querySelector('.qty-num');
    const btnAgr   = card.querySelector('.btn-agregar-card');
    const btnPlus  = card.querySelector('.qty-plus');
    const btnMinus = card.querySelector('.qty-minus');

    // Helper: obtener variante seleccionada
    function getVariante() {
        const sel = card.querySelector('.var-select');
        if (sel && vars.length > 1) return vars[parseInt(sel.value)] || vars[0];
        return vars[0] || { label: p.nombre, precio: p.precio || 0 };
    }

    // ── + incrementa contador ──
    btnPlus.onclick = function() {
        qtyEl.textContent = (parseInt(qtyEl.textContent)||0) + 1;
    };

    // ── − decrementa contador ──
    btnMinus.onclick = function() {
        qtyEl.textContent = Math.max(0, (parseInt(qtyEl.textContent)||0) - 1);
    };

    // ── AGREGAR: mete al carrito directamente + abre modal para editar ──
    btnAgr.onclick = function() {
        const cantidad = parseInt(qtyEl.textContent) || 0;

        if (cantidad < 1) {
            qtyEl.style.background = 'rgba(244,67,54,.4)';
            setTimeout(function(){ qtyEl.style.background = 'rgba(255,255,255,.06)'; }, 600);
            alert('⚠️ Primero presiona + para elegir la cantidad');
            return;
        }

        const variante = getVariante();
        const precio   = parseFloat(variante.precio) || parseFloat(p.precio) || 0;

        // Garantizar _cuentasSys
        if (!window._cuentasSys) {
            window._cuentasSys = {
                cuentas: [{ id: 1, nombre: 'Cuenta 1', items: [], color: '#FF5A00' }],
                activa: 1, counter: 1
            };
        }
        var CS = window._cuentasSys;
        var ca = CS.cuentas.find(function(x){ return x.id === CS.activa; });
        if (!ca) { ca = CS.cuentas[0]; CS.activa = ca.id; }

        // Agregar los items DIRECTAMENTE al carrito
        for (var i = 0; i < cantidad; i++) {
            ca.items.push({
                id:             pid,
                nombre:         p.nombre || 'Producto',
                precio:         precio,
                precioBase:     precio,
                variante:       variante.label || '',
                categoria:      p.categoria || 'tortas',
                tipo:           p.tipo || 'torta',
                modificaciones: [],
            });
        }
        

        // Guardar referencia al último item para editar desde el modal
        window._lastAddedIndices = [];
        for (var j = ca.items.length - cantidad; j < ca.items.length; j++) {
            window._lastAddedIndices.push(j);
        }
        window._lastAddedCuenta = ca.id;

        // Resetear contador
        qtyEl.textContent = '0';

        // Renderizar carrito
        if (window.renderCuentasTabs) window.renderCuentasTabs();
        if (window.renderCartItems)   window.renderCartItems();

        // Abrir carrito
        var cm = document.getElementById('cart-modal');
        if (cm) cm.classList.add('active');
        var ci = document.getElementById('cart-icon');
        if (ci) { ci.style.transform = 'scale(1.3)'; setTimeout(function(){ ci.style.transform = ''; }, 250); }
    };

    // Callback cuando el modal confirma
    card._onItemAdded = function(){ qtyEl.textContent = '0'; };
    card._pid = pid;
    card._productoData = p;
    card._getQty = function(){ return parseInt(qtyEl.textContent)||0; };
    card._getVariante = getVariante;

    if (!window._menuCards) window._menuCards = {};
    window._menuCards[pid] = card;
    return card;
}

// ── MENÚ EN TIEMPO REAL ──────────────────────────────────────────────────────
let _menuUnsub = null;



function _limpiarMenuContainers() {
    window._cardCounter = 0; // Reset counter en cada re-render
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

export async function renderMenu() {
    // Solo cargar una vez
    if (window._menuCargado) return;
    window._menuCargado = true;

    _limpiarMenuContainers();
    const mc = document.getElementById('menu-container');
    if (mc) mc.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">Cargando menú...</div>';

    try {
        const snapshot = await getDocs(collection(db, 'productos'));

        if (snapshot.empty) {
            _renderProductos([...PRODUCTOS_INICIALES]);
            return;
        }

        // Deduplicar por nombre — preferir el documento MÁS COMPLETO
        const byNombre = {};
        const duplicados = {};
        snapshot.docs.forEach(function(d) {
            const data = d.data();
            const key = (data.nombre || '').toLowerCase().trim();
            if (!key) return;

            duplicados[key] = (duplicados[key] || 0) + 1;
            const existing = byNombre[key];

            if (!existing) {
                byNombre[key] = Object.assign({}, data, { _docId: d.id });
                return;
            }

            // Puntuar cada versión: gana la que tenga imagen propia y variantes
            function puntuar(p) {
                var pts = 0;
                if (p.imagen && p.imagen.indexOf('data:') === 0) pts += 10; // imagen subida
                else if (p.imagen) pts += 3;                                 // imagen por ruta
                if (p.variantes && p.variantes.length) pts += 2;
                if (p.descripcion) pts += 1;
                return pts;
            }
            const nuevo = Object.assign({}, data, { _docId: d.id });
            if (puntuar(nuevo) >= puntuar(existing)) {
                byNombre[key] = nuevo;
            }
        });

        // Avisar de duplicados en Firestore
        Object.keys(duplicados).forEach(function(k) {
            if (duplicados[k] > 1) {
                console.warn('⚠️ "' + k + '" tiene ' + duplicados[k] + ' documentos duplicados en Firestore');
            }
        });

        const fsProds = Object.values(byNombre).map(function(data) {
            let pr = parseFloat(data.precio || data._precio || 0);
            if (!pr && data.variantes && data.variantes.length) {
                pr = parseFloat(data.variantes[0].precio || 0);
            }
            const base = PRODUCTOS_INICIALES.find(function(p) {
                return (p.nombre||'').toLowerCase().slice(0,10) ===
                       (data.nombre||'').toLowerCase().slice(0,10);
            }) || {};
            return {
                productId:   data._docId,
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
    } catch(e) {
        console.warn('Menu Firestore error, usando estatico:', e);
        _renderProductos([...PRODUCTOS_INICIALES]);
    }
}


export function actualizarBotonAgregarTodo() {
    // FAB eliminado — no necesario
    return;
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

        // Obtener variante y precio desde la tarjeta
        const cardRef2 = window._menuCards && window._menuCards[pid];
        const variante = cardRef2 ? cardRef2._getVariante() : null;
        const precio   = variante ? (parseFloat(variante.precio) || 0) : 0;
        const label    = variante ? (variante.label || '') : '';

        // Obtener nombre — usar cache de tarjetas (_menuCards) o fallback
        const cardRef = window._menuCards && window._menuCards[pid];
        const nombre  = cardRef && cardRef._productoData
            ? cardRef._productoData.nombre
            : (qtyEl.closest('[data-nombre]')?.getAttribute('data-nombre') || pid);

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
};
