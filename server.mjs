import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { verifyStorageToken, saveStorageObject, safeStoragePath } = require('./lib/db.js');

import { handler as quotePdfHandler } from './netlify/functions/quote-pdf.mjs';
import { handler as proofPdfHandler } from './netlify/functions/proof-pdf.mjs';
import { handler as quoteSubmitHandler } from './netlify/functions/quote-submit.mjs';
import { handler as quoteUploadHandler } from './netlify/functions/quote-upload.mjs';

const { handler: apiHandler } = require('./netlify/functions/api.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function collectBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function headersObject(req) {
  const headers = { ...req.headers };
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      const canonical = key.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join('-');
      headers[canonical] = value;
    }
  }
  return headers;
}

async function runNetlifyHandler(handler, req, res, pathname, rawBody) {
  const result = await handler({
    path: pathname,
    httpMethod: req.method,
    headers: headersObject(req),
    body: rawBody || null,
    isBase64Encoded: false,
    queryStringParameters: Object.fromEntries(new URLSearchParams((req.url || '').split('?')[1] || '')),
  });

  res.statusCode = result.statusCode || 200;
  for (const [key, value] of Object.entries(result.headers || {})) {
    if (value !== undefined) res.setHeader(key, value);
  }

  if (result.isBase64Encoded) {
    res.end(Buffer.from(result.body || '', 'base64'));
  } else {
    res.end(result.body || '');
  }
}

function safePublicPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = '/';
  }

  if (decoded === '/') decoded = '/index.html';
  if (decoded === '/admin') decoded = '/admin/index.html';
  if (decoded.endsWith('/')) decoded += 'index.html';

  const candidate = path.normalize(path.join(publicDir, decoded));
  if (!candidate.startsWith(publicDir)) return null;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  // Static Netlify-style clean URL fallback: /work -> /work.html
  if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (existsSync(htmlCandidate) && statSync(htmlCandidate).isFile()) return htmlCandidate;
  }

  return null;
}

async function serveStatic(req, res, pathname) {
  const filePath = safePublicPath(pathname);
  if (!filePath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.end(await readFile(filePath));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/healthz') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, service: '11rprint-web' }));
      return;
    }

    if (req.method === 'PUT' && pathname === '/api/storage-upload') {
      const key = url.searchParams.get('key');
      const exp = url.searchParams.get('exp');
      const token = url.searchParams.get('token');
      if (!verifyStorageToken(key, exp, token)) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Invalid or expired upload token' }));
        return;
      }
      await saveStorageObject(key, await collectBuffer(req));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/storage/')) {
      const storageKey = decodeURIComponent(pathname.replace(/^\/storage\//, ''));
      const filePath = safeStoragePath(storageKey);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.end(await readFile(filePath));
      return;
    }

    if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
      const handler = pathname === '/api/quote-pdf'
        ? quotePdfHandler
        : pathname === '/api/proof-pdf'
          ? proofPdfHandler
          : pathname === '/api/quote-submit'
            ? quoteSubmitHandler
            : pathname === '/api/quote-upload'
              ? quoteUploadHandler
              : apiHandler;
      await runNetlifyHandler(handler, req, res, pathname, '');
      return;
    }

    if (pathname === '/api/quote-pdf') {
      await runNetlifyHandler(quotePdfHandler, req, res, pathname, await collectBody(req));
      return;
    }

    if (pathname === '/api/proof-pdf') {
      await runNetlifyHandler(proofPdfHandler, req, res, pathname, await collectBody(req));
      return;
    }

    if (pathname === '/api/quote-submit') {
      await runNetlifyHandler(quoteSubmitHandler, req, res, pathname, await collectBody(req));
      return;
    }

    if (pathname === '/api/quote-upload') {
      await runNetlifyHandler(quoteUploadHandler, req, res, pathname, await collectBody(req));
      return;
    }

    if (pathname.startsWith('/api/')) {
      await runNetlifyHandler(apiHandler, req, res, pathname, await collectBody(req));
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Method Not Allowed');
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error('server error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`11R Print web listening on :${port}`);
});
