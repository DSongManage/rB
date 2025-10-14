const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/api', '/accounts', '/admin'],
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      credentials: 'include',
    })
  );
};

