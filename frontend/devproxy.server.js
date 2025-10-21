// Minimal static + proxy dev server for local integration testing
// Serves the CRA build and proxies /api and /accounts to Django

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const BACKEND = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8000';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

// Normalize legacy aliases before proxying (fix browser hitting /login → /accounts/login)
app.use((req, res, next) => {
  if (req.url === '/login' || req.url === '/login/') {
    req.url = '/accounts/login/';
  } else if (req.url === '/logout' || req.url === '/logout/') {
    req.url = '/accounts/logout/';
  }
  next();
});

// Proxy API and auth/allauth endpoints to Django
app.use(['/api', '/accounts', '/admin'], createProxyMiddleware({
  target: BACKEND,
  changeOrigin: true,
  logLevel: 'silent',
}));

// Serve the built SPA
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`SPA + proxy running at http://${HOST}:${PORT} -> backend ${BACKEND}`);
});



