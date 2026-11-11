// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { close } from './helpers.js';
import { horseshoe } from '../app/core/profile.js';

test('Hufeisen B = 10, H = 8: geschlossen, Sohle bei z = 0, Breite, Höhe', () => {
  const pts = horseshoe(10, 8);
  const first = pts[0];
  const last = pts[pts.length - 1];
  assert.deepEqual(first, last);
  close(first.x, -5); close(first.y, 0);
  const ys = pts.map((p) => p.y);
  const xs = pts.map((p) => p.x);
  close(Math.min(...ys), 0);
  close(Math.max(...ys), 8);
  close(Math.min(...xs), -5);
  close(Math.max(...xs), 5);
  // Sohle: Punkt (5, 0) folgt auf (−5, 0)
  close(pts[1].x, 5); close(pts[1].y, 0);
});

test('Hufeisen: Ulmen senkrecht bis H − B/2, Kalotte ist Halbkreis mit Radius B/2', () => {
  const B = 10;
  const H = 8;
  const pts = horseshoe(B, H);
  const w = H - B / 2;
  // Ulme rechts: (5, 0) -> (5, 3)
  close(pts[2].x, 5); close(pts[2].y, w);
  // Ulme links endet in (−5, 3) und schliesst über (−5, 0)
  close(pts[pts.length - 2].x, -5); close(pts[pts.length - 2].y, w);
  // alle übrigen Punkte liegen auf dem Kreis um (0, w) mit Radius 5 und y ≥ w
  for (const p of pts.slice(2, -1)) {
    close(Math.hypot(p.x, p.y - w), B / 2, 1e-9);
    assert.ok(p.y >= w - 1e-9);
  }
  // Scheitel
  assert.ok(pts.some((p) => Math.abs(p.x) < 1e-9 && Math.abs(p.y - H) < 1e-9));
});

test('Hufeisen: Grenzfall H = B/2 (reiner Halbkreis über der Sohle), geschlossen, ohne doppelte Punkte', () => {
  const pts = horseshoe(10, 5);
  assert.deepEqual(pts[0], pts[pts.length - 1]);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > 1e-12, `Punkt ${i} doppelt`);
  }
  close(Math.min(...pts.map((p) => p.y)), 0);
  close(Math.max(...pts.map((p) => p.y)), 5);
});

test('Hufeisen: Standardfeinheit und Parameter arcSteps', () => {
  assert.equal(horseshoe(10, 8, 8).length, 2 + 9 + 1);
});

test('Hufeisen: ungültige Masse werfen', () => {
  assert.throws(() => horseshoe(10, 4.9), RangeError);
  assert.throws(() => horseshoe(0, 8), RangeError);
  assert.throws(() => horseshoe(-1, 8), RangeError);
});
