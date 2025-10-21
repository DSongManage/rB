const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Use a filter instead of a mount path so Express does NOT strip prefixes
  app.use(
    createProxyMiddleware(
      (pathname) => pathname.startsWith('/api') || pathname.startsWith('/accounts') || pathname.startsWith('/admin'),
      {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        logLevel: 'debug',
        xfwd: true,
        credentials: 'include',
        // No pathRewrite needed; full path (with /api) is preserved
      }
    )
  );
};

