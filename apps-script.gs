// ═══════════════════════════════════════════════════════════════
// TORTAS TORTUGA — Google Apps Script (Base de Datos Gratuita)
// ---------------------------------------------------------------
// INSTRUCCIONES:
// 1. Ve a https://sheets.google.com y crea una nueva hoja
// 2. En el menú, haz clic en "Extensiones" → "Apps Script"
// 3. Borra el código que ya está y pega TODO este código
// 4. Haz clic en "Guardar" (ícono de disco)
// 5. Haz clic en "Implementar" → "Nueva implementación"
// 6. Tipo: "Aplicación web"
//    - Ejecutar como: "Yo"
//    - Quién tiene acceso: "Cualquier usuario"
// 7. Haz clic en "Implementar" y copia la URL que te da
// 8. Pega esa URL en app.js donde dice APPS_SCRIPT_URL
// ═══════════════════════════════════════════════════════════════

const HOJA_NOMBRE = 'Pedidos';

function obtenerHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_NOMBRE);
  
  // Si no existe la hoja, crearla con encabezados
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_NOMBRE);
    const encabezados = ['ID', 'Fecha/Hora', 'Cliente', 'Teléfono', 'Tipo', 'Orden', 'Total', 'Ubicación', 'Estado'];
    hoja.appendRow(encabezados);
    
    // Estilo a los encabezados
    const rango = hoja.getRange(1, 1, 1, 9);
    rango.setFontWeight('bold')
         .setBackground('#FF5722')
         .setFontColor('white')
         .setFontSize(11);
    
    // Anchos de columna
    hoja.setColumnWidth(1, 90);   // ID
    hoja.setColumnWidth(2, 160);  // Fecha
    hoja.setColumnWidth(3, 140);  // Cliente
    hoja.setColumnWidth(4, 120);  // Teléfono
    hoja.setColumnWidth(5, 120);  // Tipo
    hoja.setColumnWidth(6, 300);  // Orden
    hoja.setColumnWidth(7, 80);   // Total
    hoja.setColumnWidth(8, 200);  // Ubicación
    hoja.setColumnWidth(9, 100);  // Estado
  }
  
  return hoja;
}

// ── GUARDAR PEDIDO (POST) ────────────────────────────────────────
function doPost(e) {
  try {
    const hoja = obtenerHoja();
    const data = JSON.parse(e.postData.contents);
    
    // Generar ID único: TT-XXXXXX
    const id = 'TT-' + Date.now().toString().slice(-6);
    const ahora = Utilities.formatDate(
      new Date(), 'America/Chicago', 'MM/dd/yyyy HH:mm'
    );
    
    hoja.appendRow([
      id,
      ahora,
      data.nombre   || '',
      data.telefono || '',
      data.tipo     || '',
      data.items    || '',
      data.total    || '$0',
      data.ubicacion|| 'No especificada',
      'Nuevo 🆕'
    ]);
    
    // Colorear la fila nueva en verde claro
    const ultimaFila = hoja.getLastRow();
    hoja.getRange(ultimaFila, 1, 1, 9).setBackground('#E8F5E9');
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── LEER PEDIDOS (GET) ───────────────────────────────────────────
function doGet(e) {
  try {
    // Actualizar estado si se pasa por parámetro
    if (e.parameter.action === 'updateStatus') {
      return actualizarEstado(e.parameter.id, e.parameter.estado);
    }
    
    const hoja = obtenerHoja();
    const datos = hoja.getDataRange().getValues();
    
    if (datos.length <= 1) {
      return jsonResponse({ pedidos: [] });
    }
    
    const encabezados = datos[0];
    const pedidos = datos.slice(1).reverse().map(fila => {
      const obj = {};
      encabezados.forEach((enc, i) => { obj[enc] = fila[i] || ''; });
      return obj;
    });
    
    return jsonResponse({ pedidos: pedidos, total: pedidos.length });
    
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── ACTUALIZAR ESTADO ────────────────────────────────────────────
function actualizarEstado(id, nuevoEstado) {
  const hoja = obtenerHoja();
  const datos = hoja.getDataRange().getValues();
  
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === id) {
      hoja.getRange(i + 1, 9).setValue(nuevoEstado);
      
      // Cambiar color según estado
      const colores = {
        'Nuevo 🆕': '#E8F5E9',
        'En preparación 🧑‍🍳': '#FFF9C4',
        'Listo ✅': '#E3F2FD',
        'Entregado 🎉': '#F3E5F5',
        'Cancelado ❌': '#FFEBEE'
      };
      const color = colores[nuevoEstado] || '#FFFFFF';
      hoja.getRange(i + 1, 1, 1, 9).setBackground(color);
      
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'ID no encontrado' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
