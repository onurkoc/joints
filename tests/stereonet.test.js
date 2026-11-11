// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { close, angleDiff, rng, TOL } from './helpers.js';
import { jointNormal, jointPole } from '../app/core/joint.js';
import { projectLine, projectVector, greatCircle, tunnelLine } from '../app/core/stereonet.js';

const R0 = Math.SQRT2 * Math.sin((22.5 * Math.PI) / 180); // 0.5412…

test('Normale und Pol: Beispiel 090/45', () => {
  const n = jointNormal(90, 45);
  close(n.x, Math.SQRT1_2);
  close(n.y, 0);
  close(n.z, Math.SQRT1_2);
  const p = jointPole(90, 45);
  close(p.trend, 270);
  close(p.plunge, 45);
});

test('Normale ist Einheitsvektor, zeigt nach oben, steht senkrecht auf Fallinie und Streichen', () => {
  const rand = rng(1);
  for (let i = 0; i < 100; i++) {
    const dd = rand() * 360;
    const dip = rand() * 90;
    const n = jointNormal(dd, dip);
    close(Math.hypot(n.x, n.y, n.z), 1);
    assert.ok(n.z >= 0);
    const d = (dd * Math.PI) / 180;
    const a = (dip * Math.PI) / 180;
    const dipVec = [Math.sin(d) * Math.cos(a), Math.cos(d) * Math.cos(a), -Math.sin(a)];
    close(n.x * dipVec[0] + n.y * dipVec[1] + n.z * dipVec[2], 0);
    close(n.x * -Math.cos(d) + n.y * Math.sin(d), 0);
  }
});

test('Pol: Richtung = Fallrichtung + 180°, Eintauchen = 90° − Fallen', () => {
  const p = jointPole(200, 30);
  close(p.trend, 20);
  close(p.plunge, 60);
  close(jointPole(10, 80).trend, 190);
});

test('Projektion: Netzmitte, Rand, Himmelsrichtungen', () => {
  const c = projectLine(123, 90);
  close(c.x, 0); close(c.y, 0);
  const e = projectLine(90, 0, 5);
  close(e.x, 5); close(e.y, 0);
  const n = projectLine(0, 0, 5);
  close(n.x, 0); close(n.y, 5);
  const sw = projectLine(225, 0);
  close(sw.x, -Math.SQRT1_2); close(sw.y, -Math.SQRT1_2);
});

test('Projektion Linie und Vektor liefern dasselbe (flächentreu)', () => {
  const rand = rng(7);
  for (let i = 0; i < 100; i++) {
    const t = rand() * 360;
    const p = rand() * 90;
    const tr = (t * Math.PI) / 180;
    const pl = (p * Math.PI) / 180;
    const v = { x: Math.sin(tr) * Math.cos(pl), y: Math.cos(tr) * Math.cos(pl), z: -Math.sin(pl) };
    const a = projectLine(t, p, 3);
    const b = projectVector(v, 3);
    close(a.x, b.x); close(a.y, b.y);
    // Linie im Obergeschoss wird gespiegelt
    const c = projectVector({ x: -v.x, y: -v.y, z: -v.z }, 3);
    close(a.x, c.x); close(a.y, c.y);
  }
});

test('Horizontale Kluft (Fallen 0): Pol im Netzmittelpunkt', () => {
  const pole = jointPole(137, 0);
  const pt = projectLine(pole.trend, pole.plunge, 100);
  close(pt.x, 0); close(pt.y, 0);
});

test('Kluft 090/45: Pol im Westen bei r = 0.5412·R', () => {
  for (const R of [1, 100]) {
    const pole = jointPole(90, 45);
    const pt = projectLine(pole.trend, pole.plunge, R);
    close(pt.x, -R0 * R);
    close(pt.y, 0);
    assert.ok(Math.abs(Math.hypot(pt.x, pt.y) - 0.5412 * R) < 5e-5 * R);
  }
});

test('Kluft 090/45: Scheitel des Grosskreises im Osten bei r = 0.5412·R', () => {
  const R = 100;
  const gc = greatCircle(90, 45, R); // Standard 90 Segmente: Fallinie ist Stützpunkt 45
  const apex = gc[45];
  close(apex.x, R0 * R);
  close(apex.y, 0);
  // Fallinie ist der Punkt mit dem kleinsten Radius
  const rmin = Math.min(...gc.map((q) => Math.hypot(q.x, q.y)));
  close(rmin, R0 * R, 1e-7);
});

test('Grosskreis: Endpunkte auf dem Netzrand, in Streichrichtung und Gegenrichtung', () => {
  const R = 50;
  const rand = rng(11);
  for (let i = 0; i < 50; i++) {
    const dd = rand() * 360;
    const dip = rand() * 90;
    const gc = greatCircle(dd, dip, R, 60);
    assert.equal(gc.length, 61);
    const [a, b] = [gc[0], gc[60]];
    close(Math.hypot(a.x, a.y), R);
    close(Math.hypot(b.x, b.y), R);
    // Streichrichtung = Fallrichtung − 90°
    const trend = (Math.atan2(a.x, a.y) * 180) / Math.PI;
    assert.ok(angleDiff(trend, dd - 90) < 1e-7, `Streichen ${trend} vs ${dd - 90}`);
    close(a.x, -b.x); close(a.y, -b.y);
    // alle Punkte innerhalb des Netzes
    for (const q of gc) assert.ok(Math.hypot(q.x, q.y) <= R + 1e-9);
  }
});

test('Grosskreis: jeder Punkt liegt in der Kluftfläche (Skalarprodukt mit Normale = 0)', () => {
  const rand = rng(13);
  for (let i = 0; i < 30; i++) {
    const dd = rand() * 360;
    const dip = rand() * 90;
    const n = jointNormal(dd, dip);
    for (const q of greatCircle(dd, dip, 1, 36)) {
      // Rückprojektion Punkt -> Vektor (Schmidt): ρ² = x²+y², vz = −(1 − ρ²), h = √(1 − vz²)
      const rho2 = q.x * q.x + q.y * q.y;
      const vz = -(1 - rho2);
      const k = Math.sqrt(1 - vz);
      const v = { x: q.x * k, y: q.y * k, z: vz };
      close(v.x * n.x + v.y * n.y + v.z * n.z, 0, 1e-9);
    }
  }
});

test('Senkrechte Kluft (Fallen 90): Grosskreis ist ein Durchmesser in Streichrichtung', () => {
  const R = 10;
  for (const dd of [0, 30, 90, 217]) {
    const gc = greatCircle(dd, 90, R);
    const sd = ((dd - 90) * Math.PI) / 180;
    const dirX = Math.sin(sd);
    const dirY = Math.cos(sd);
    for (const q of gc) {
      close(q.x * dirY - q.y * dirX, 0, 1e-9, 'liegt auf Gerade durch Mitte');
    }
    close(gc[0].x, R * dirX); close(gc[0].y, R * dirY);
    close(gc[90].x, -R * dirX); close(gc[90].y, -R * dirY);
    close(Math.hypot(gc[45].x, gc[45].y), 0, 1e-9); // Mitte
  }
});

test('Tunnellinie: zwei gegenüberliegende Randpunkte', () => {
  const R = 20;
  const [p, q] = tunnelLine(30, R);
  close(p.x, R * Math.sin(Math.PI / 6)); close(p.y, R * Math.cos(Math.PI / 6));
  close(q.x, -p.x); close(q.y, -p.y);
  close(Math.hypot(p.x, p.y), R);
  const [n, s] = tunnelLine(0, 1);
  close(n.x, 0, TOL); close(n.y, 1); close(s.y, -1);
  const [a, b] = tunnelLine(360, 1); // 360 = 0
  close(a.x, 0); close(a.y, 1); close(b.y, -1);
});
