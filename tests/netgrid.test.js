// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { close } from './helpers.js';
import { netGrid } from '../app/core/netgrid.js';
import { greatCircle } from '../app/core/stereonet.js';

test('Netzraster: 17 Meridiane und 17 Kleinkreise in 10°-Schritten', () => {
  const g = netGrid(1);
  assert.equal(g.meridians.length, 17);
  assert.equal(g.smallCircles.length, 17);
  assert.deepEqual(g.meridians.map((c) => c.angle), Array.from({ length: 17 }, (_, i) => 10 * (i + 1)));
  assert.deepEqual(g.smallCircles.map((c) => c.angle), g.meridians.map((c) => c.angle));
  assert.equal(netGrid(1, 30).meridians.length, 5);
});

test('Netzraster: alle Punkte innerhalb des Netzrands, Enden auf dem Rand', () => {
  const R = 37;
  const g = netGrid(R);
  for (const c of [...g.meridians, ...g.smallCircles]) {
    assert.equal(c.points.length, 91);
    for (const p of c.points) assert.ok(Math.hypot(p.x, p.y) <= R + 1e-9, `${c.angle}: ${p.x},${p.y}`);
    const a = c.points[0];
    const b = c.points[c.points.length - 1];
    close(Math.hypot(a.x, a.y), R);
    close(Math.hypot(b.x, b.y), R);
  }
});

test('Kleinkreis 90° ist der Ost-West-Durchmesser', () => {
  const R = 10;
  const c = netGrid(R).smallCircles.find((q) => q.angle === 90);
  assert.ok(c);
  for (const p of c.points) close(p.y, 0, 1e-9);
  close(c.points[0].x, R); close(c.points[c.points.length - 1].x, -R);
  close(c.points[45].x, 0, 1e-9); // Mitte
});

test('Meridian 90° ist der Nord-Süd-Durchmesser', () => {
  const R = 10;
  const c = netGrid(R).meridians.find((q) => q.angle === 90);
  assert.ok(c);
  for (const p of c.points) close(p.x, 0, 1e-9);
  close(c.points[0].y, R); close(c.points[c.points.length - 1].y, -R);
  close(c.points[45].y, 0, 1e-9);
});

test('Meridian ψ < 90° stimmt mit dem Grosskreis der Kluft «Fallrichtung 90°, Fallen ψ» überein', () => {
  const R = 5;
  const g = netGrid(R);
  for (const psi of [10, 30, 40, 80]) {
    const m = g.meridians.find((q) => q.angle === psi);
    assert.ok(m);
    const gc = greatCircle(90, psi, R, 90);
    m.points.forEach((p, i) => { close(p.x, gc[i].x, 1e-9); close(p.y, gc[i].y, 1e-9); });
  }
});

test('Meridiane und Kleinkreise sind symmetrisch (ψ und 180° − ψ spiegeln Ost/West, γ und 180° − γ Nord/Süd)', () => {
  const g = netGrid(1);
  for (let i = 0; i < 17; i++) {
    const a = g.meridians[i];
    const b = g.meridians[16 - i];
    a.points.forEach((p, k) => { close(p.x, -b.points[k].x, 1e-9); close(p.y, b.points[k].y, 1e-9); });
    const c = g.smallCircles[i];
    const d = g.smallCircles[16 - i];
    c.points.forEach((p, k) => { close(p.x, d.points[k].x, 1e-9); close(p.y, -d.points[k].y, 1e-9); });
  }
});

test('Kleinkreis: konstanter Winkel zur Nord-Süd-Achse', () => {
  // Rückprojektion Netzpunkt -> Vektor; y-Komponente = cos γ
  const g = netGrid(1);
  for (const c of g.smallCircles) {
    for (const p of c.points) {
      const rho2 = p.x * p.x + p.y * p.y;
      const vz = -(1 - rho2);
      const k = Math.sqrt(1 - vz);
      close(p.y * k, Math.cos((c.angle * Math.PI) / 180), 1e-9);
    }
  }
});
