// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

/**
 * Regeln aus _headers: Pfad -> Köpfe.
 * @returns {Array<{path: string, headers: string[]}>}
 */
function readRules() {
  const rules = [];
  for (const line of readFileSync(join(APP, '_headers'), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) rules.at(-1)?.headers.push(line.trim());
    else rules.push({ path: line.trim(), headers: [] });
  }
  return rules;
}

/**
 * Cloudflare-Muster als regulärer Ausdruck: ":name" = ein Name ohne "/", "*" = beliebig.
 * @param {string} pattern
 */
function toRegExp(pattern) {
  const src = pattern
    .split(/(:[A-Za-z]+|\*)/)
    .map((p) => (p === '*' ? '.*' : /^:[A-Za-z]+$/.test(p) ? '[^/]+' : p.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')))
    .join('');
  return new RegExp(`^${src}$`);
}

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test('_headers: jede Datei der App wird von genau einer Regel getroffen', () => {
  const rules = readRules();
  assert.ok(rules.length >= 5);
  const served = files(APP).map((f) => `/${relative(APP, f).split(sep).join('/')}`).filter((u) => u !== '/_headers');
  assert.ok(served.length > 20);
  for (const url of served) {
    const hit = rules.filter((r) => toRegExp(r.path).test(url));
    assert.equal(hit.length, 1, `${url}: ${hit.length} Regeln (${hit.map((h) => h.path).join(', ')})`);
  }
  // die Startseite unter "/" auch
  assert.equal(rules.filter((r) => toRegExp(r.path).test('/')).length, 1);
});

test('_headers: alle Regeln setzen Cache-Control: no-cache', () => {
  for (const r of readRules()) assert.deepEqual(r.headers, ['Cache-Control: no-cache'], r.path);
});
