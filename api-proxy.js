// API proxy: el ingress de la plataforma enruta /api/* al puerto 8001.
// Esta app es Next.js fullstack (API en :3000), así que reenviamos todo a Next.
const http = require('http');

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 3000;
const LISTEN_PORT = parseInt(process.env.PROXY_PORT || '8001', 10);

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy_error', detail: err.message }));
  });
  req.pipe(proxyReq, { end: true });
});

server.on('clientError', (err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {}
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`api-proxy listening on 0.0.0.0:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});
