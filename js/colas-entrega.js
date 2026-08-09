// ═══════════════════════════════════════════════════════════════
//  colas-entrega.js — Motor de colas de entrega para Tortas Tortuga
//
//  Gestiona horarios de entrega por zona en intervalos de 30 min
//  (10:00 AM – 6:00 PM), con capacidad limitada por horario y sin
//  superposiciones, usando transacciones atómicas de Firestore.
//
//  Modelo de datos (colección "slots_entrega"):
//    ID del documento: "{fecha}_{zona}_{hora}"  ej "2026-07-27_west_1430"
//    {
//      fecha: "2026-07-27",       // YYYY-MM-DD
//      zona:  "west",             // west | norte | sur | 211
//      hora:  "14:30",            // HH:MM (24h)
//      capacidad: 3,              // cuántas entregas caben
//      ocupados: 0,               // cuántas ya se reservaron
//      pedidos: [],               // IDs de pedidos asignados
//      bloqueado: false,          // el gerente puede bloquear un slot
//      creado: <timestamp>
//    }
//
//  Los slots se crean BAJO DEMANDA: la primera vez que se consulta o
//  reserva un horario, se materializa su documento. No se pre-generan
//  miles de slots vacíos.
// ═══════════════════════════════════════════════════════════════

import { db } from './firebase-config.js';
import {
    doc, getDoc, getDocs, setDoc, collection, query, where,
    runTransaction, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Configuración ────────────────────────────────────────────────
export const CONFIG_COLAS = {
    horaInicio: 10,       // 10:00 AM
    horaFin: 18,          // 6:00 PM (exclusivo: el último slot es 17:30)
    intervaloMin: 30,     // minutos por slot
    capacidadPorSlot: 3,  // entregas por horario/zona
    zonas: [
        { id: '211',         nombre: 'Zona 211' },
        { id: 'san-antonio', nombre: 'San Antonio' },
        { id: 'converse',    nombre: 'Converse' },
        { id: 'seguin',      nombre: 'Seguin' },
        { id: 'culebra',     nombre: 'Culebra' },
        { id: 'castroville', nombre: 'Castroville' },
    ],
};

// ── Utilidades de fecha/hora ─────────────────────────────────────
export function fechaHoy() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
}

// Genera la lista de horas "HH:MM" del día según la configuración.
export function generarHorarios() {
    const horarios = [];
    for (let h = CONFIG_COLAS.horaInicio; h < CONFIG_COLAS.horaFin; h++) {
        for (let m = 0; m < 60; m += CONFIG_COLAS.intervaloMin) {
            horarios.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
        }
    }
    return horarios;
}

// Convierte "14:30" a etiqueta amigable "2:30 PM"
export function horaBonita(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

// ID de documento del slot
function slotId(fecha, zona, hora) {
    return fecha + '_' + zona + '_' + hora.replace(':', '');
}

// Si el horario ya pasó respecto a la hora actual (para hoy).
function horarioYaPaso(fecha, hora) {
    if (fecha !== fechaHoy()) return false; // solo aplica a hoy
    const [h, m] = hora.split(':').map(Number);
    const ahora = new Date();
    const slotDate = new Date();
    slotDate.setHours(h, m, 0, 0);
    return slotDate <= ahora;
}

// Genera las fechas seleccionables para entrega: hoy + próximos días,
// saltando domingos (cerrado). Devuelve [{fecha, etiqueta, esHoy}].
export function fechasDisponibles(diasAdelante) {
    diasAdelante = diasAdelante || 7;
    const dias = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nombresDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const nombresMes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    for (let i = 0; i <= diasAdelante; i++) {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() + i);
        if (d.getDay() === 0) continue; // domingo cerrado
        const fecha = d.getFullYear() + '-' +
                      String(d.getMonth() + 1).padStart(2, '0') + '-' +
                      String(d.getDate()).padStart(2, '0');
        let etiqueta;
        if (i === 0) etiqueta = 'Hoy';
        else if (i === 1) etiqueta = 'Mañana';
        else etiqueta = nombresDia[d.getDay()] + ' ' + d.getDate() + ' ' + nombresMes[d.getMonth()];
        dias.push({ fecha, etiqueta, esHoy: i === 0 });
    }
    return dias;
}

// ── Consultar disponibilidad de una zona ─────────────────────────
// Devuelve la lista de horarios con su estado (disponible, ocupados,
// capacidad, bloqueado, yaPaso). Los slots que no existen todavía se
// reportan como totalmente disponibles (se crearán al reservar).
export async function consultarDisponibilidad(zona, fecha) {
    fecha = fecha || fechaHoy();
    const horarios = generarHorarios();

    // Traer los slots existentes de esa zona/fecha en una sola consulta
    const q = query(
        collection(db, 'slots_entrega'),
        where('fecha', '==', fecha),
        where('zona', '==', zona)
    );
    const snap = await getDocs(q);
    const existentes = {};
    snap.forEach(d => { existentes[d.data().hora] = d.data(); });

    return horarios.map(hora => {
        const ex = existentes[hora];
        const cap = ex ? (ex.capacidad ?? CONFIG_COLAS.capacidadPorSlot) : CONFIG_COLAS.capacidadPorSlot;
        const ocup = ex ? (ex.ocupados || 0) : 0;
        const bloqueado = ex ? !!ex.bloqueado : false;
        const yaPaso = horarioYaPaso(fecha, hora);
        return {
            hora,
            etiqueta: horaBonita(hora),
            capacidad: cap,
            ocupados: ocup,
            restantes: Math.max(0, cap - ocup),
            bloqueado,
            yaPaso,
            disponible: !bloqueado && !yaPaso && ocup < cap,
        };
    });
}

// ── Reservar un slot (ATÓMICO) ───────────────────────────────────
// Garantiza que dos clientes no tomen el último lugar al mismo tiempo.
// Devuelve { ok:true } o { ok:false, motivo:'...' }.
export async function reservarSlot(zona, hora, pedidoId, fecha) {
    fecha = fecha || fechaHoy();
    const id = slotId(fecha, zona, hora);
    const ref = doc(db, 'slots_entrega', id);

    if (horarioYaPaso(fecha, hora)) {
        return { ok: false, motivo: 'Ese horario ya pasó. Elige uno más tarde.' };
    }

    try {
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                // Crear el slot ya con esta reserva (bajo demanda)
                tx.set(ref, {
                    fecha, zona, hora,
                    capacidad: CONFIG_COLAS.capacidadPorSlot,
                    ocupados: 1,
                    pedidos: pedidoId ? [pedidoId] : [],
                    bloqueado: false,
                    creado: new Date().toISOString(),
                });
                return;
            }
            const d = snap.data();
            if (d.bloqueado) throw new Error('BLOQUEADO');
            const cap = d.capacidad ?? CONFIG_COLAS.capacidadPorSlot;
            if ((d.ocupados || 0) >= cap) throw new Error('LLENO');
            tx.update(ref, {
                ocupados: (d.ocupados || 0) + 1,
                pedidos: pedidoId ? [...(d.pedidos || []), pedidoId] : (d.pedidos || []),
            });
        });
        return { ok: true, slotId: id };
    } catch (e) {
        if (e.message === 'LLENO')     return { ok: false, motivo: 'Ese horario se acaba de llenar. Elige otro disponible.' };
        if (e.message === 'BLOQUEADO') return { ok: false, motivo: 'Ese horario no está disponible. Elige otro.' };
        return { ok: false, motivo: 'No se pudo reservar. Intenta de nuevo.' };
    }
}

// ── Liberar un slot (cancelación) ────────────────────────────────
export async function liberarSlot(zona, hora, pedidoId, fecha) {
    fecha = fecha || fechaHoy();
    const id = slotId(fecha, zona, hora);
    const ref = doc(db, 'slots_entrega', id);
    try {
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const d = snap.data();
            tx.update(ref, {
                ocupados: Math.max(0, (d.ocupados || 0) - 1),
                pedidos: (d.pedidos || []).filter(x => x !== pedidoId),
            });
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, motivo: 'No se pudo liberar el horario.' };
    }
}

// ── Gerente: bloquear / desbloquear un horario ───────────────────
export async function fijarBloqueoSlot(zona, hora, bloquear, fecha) {
    fecha = fecha || fechaHoy();
    const id = slotId(fecha, zona, hora);
    const ref = doc(db, 'slots_entrega', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        // Crear el slot para poder bloquearlo
        await setDoc(ref, {
            fecha, zona, hora,
            capacidad: CONFIG_COLAS.capacidadPorSlot,
            ocupados: 0,
            pedidos: [],
            bloqueado: !!bloquear,
            creado: new Date().toISOString(),
        });
    } else {
        await updateDoc(ref, { bloqueado: !!bloquear });
    }
    return { ok: true };
}
