// server.js — Servidor local simple para Tortas Tortuga
// Ejecutar con: node server.js
// Luego abre: http://localhost:3000

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
    // Limpiar query string antes de resolver la ruta
    const cleanUrl = req.url.split('?')[0];
    let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Archivo no encontrado: ' + req.url);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('🐢 Tortas Tortuga — Servidor corriendo');
    console.log(`👉  Abre en tu navegador: http://localhost:${PORT}`);
    console.log('');
    console.log('Presiona Ctrl+C para detener el servidor.');
});
