// Lokaler Webserver für den Ordner app/ (nur Node-Standardbibliothek).
// ES-Module laufen nicht über file://, darum braucht die App beim lokalen Öffnen einen Server.
//
//     npm start                  auf http://localhost:8000/ bereitstellen
//     node serve.mjs --port 8080 anderer Port
//
// .js immer als text/javascript, Cache-Control: no-store, nur von diesem Rechner erreichbar.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), 'app');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

/**
 * Server für app/ starten.
 * @param {number} port 0 = freier Port
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(APP, rel));
      if (file !== APP && !file.startsWith(APP + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (!(await stat(file)).isFile()) throw new Error('not a file');
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 8000;
  try {
    await startServer(port);
    console.log(`Joints: http://localhost:${port}/  (stop with Ctrl+C)`);
  } catch (e) {
    console.error(`Port ${port} cannot be used: ${/** @type {Error} */ (e).message}`);
    process.exitCode = 1;
  }
}
