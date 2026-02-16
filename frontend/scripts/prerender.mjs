#!/usr/bin/env node
/**
 * Post-build prerender script for marketing pages.
 * Spins up a local server, loads each route with Puppeteer,
 * and writes the rendered HTML to dist/<route>/index.html.
 *
 * Usage: node scripts/prerender.mjs
 * Requires: npx puppeteer (installed as devDep)
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const ROUTES = ['/', '/how-it-works', '/pricing', '/about'];
const PORT = 4173;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Simple static file server
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);

      // SPA fallback: serve index.html for routes without file extensions
      if (!existsSync(filePath) || !extname(filePath)) {
        filePath = join(DIST, 'index.html');
      }

      try {
        const data = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`Static server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function prerender() {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('Puppeteer not available — skipping prerender. Install with: npm i -D puppeteer');
    return;
  }

  const server = await startServer();
  const browser = await puppeteer.default.launch({ headless: true });

  for (const route of ROUTES) {
    console.log(`Pre-rendering ${route}...`);
    const page = await browser.newPage();

    // Stub fetch to /api so it doesn't hang waiting for a backend
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        req.respond({ status: 200, contentType: 'application/json', body: '{"authenticated":false}' });
      } else {
        req.continue();
      }
    });

    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a bit for React hydration
    await new Promise(r => setTimeout(r, 1500));

    const html = await page.content();
    await page.close();

    // Write to dist/<route>/index.html
    const outDir = route === '/' ? DIST : join(DIST, route);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const outFile = route === '/' ? join(DIST, 'index.html') : join(outDir, 'index.html');
    writeFileSync(outFile, html, 'utf-8');
    console.log(`  -> ${outFile}`);
  }

  await browser.close();
  server.close();
  console.log('Pre-rendering complete!');
}

prerender().catch(console.error);
