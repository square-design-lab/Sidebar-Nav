// Local dev server for testing SDL Sidebar Nav against the live Squarespace site.
// Serves this folder with permissive CORS so https://test-site-sdl.squarespace.com
// can load http://localhost:7793/sidebarNav.js — localhost is a trustworthy
// origin, so mixed-content blocking does not apply.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 7793;
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'config-generator.html';
  const file = path.join(ROOT, rel);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  // Chrome's Private Network Access check: a public https:// page pulling a
  // subresource off localhost preflights first and drops it without these.
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('SDL Sidebar Nav dev server on http://localhost:' + PORT));
