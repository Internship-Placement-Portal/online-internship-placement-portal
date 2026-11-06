
const http = require('http');
const httpProxy = require('../server/node_modules/http-proxy');

const targets = [5001, 5002, 5003, 5004, 5005];
let next = 0;

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  proxyTimeout: 10000,
  timeout: 10000,
});

const server = http.createServer((req, res) => {
  // Keep health checks local to the load balancer.
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  const port = targets[next++ % targets.length];
  proxy.web(req, res, { target: `http://127.0.0.1:${port}` });
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.code || err.message);
  if (res && !res.headersSent) res.writeHead(502);
  if (res && !res.writableEnded) res.end('Backend unavailable');
});

server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

server.listen(8080, '127.0.0.1', () => {
  console.log('Local load balancer listening on http://127.0.0.1:8080');
});
