const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Use a filter so CRA does not serve index.html for these paths
  app.use(
    createProxyMiddleware(
      (pathname) => pathname.startsWith('/api') || pathname.startsWith('/accounts') || pathname.startsWith('/admin'),
      {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        logLevel: 'debug', // temporarily debug to verify forwarding
      }
    )
  );
};

