// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { close, angleDiff, rng } from './helpers.js';
import { jointNormal } from '../app/core/joint.js';
import {
  PARALLEL_LIMIT, apparentDip, apparentSpacing, traceDirection, traceSet,
} from '../app/core/section.js';

const DEG = Math.PI / 180;
const WIN = { xmin: -8, xmax: 8, ymin: -2, ymax: 10 };
const CENTER = { x: 0, y: 4 };

test('Horizontale Kluft (Fallen 0): Spur im Querschnitt horizontal, s\' = s', () => {
  for (const A of [0, 45, 200]) {
    const d = traceDirection(123, 0, A);
    assert.ok(d);
    close(d.x, 1); close(d.y, 0);
    close(apparentDip(123, 0, A).beta, 0);
    const ts = traceSet(123, 0, A, 2, CENTER, WIN);
    assert.equal(ts.parallel, false);
    close(/** @type {number} */ (ts.apparentSpacing), 2);
    assert.ok(ts.segments.length > 0);
    for (const s of ts.segments) {
      close(s.y1, s.y2);
      close(s.y1, CENTER.y + s.k * 2);
      close(s.x1, WIN.xmin); close(s.x2, WIN.xmax);
    }
  }
});

test('Fallrichtung = A + 90°: scheinbares Fallen = wahres Fallen, fällt nach rechts', () => {
  for (const A of [0, 33, 170, 300]) {
    for (const dip of [10, 45, 80]) {
      const r = apparentDip(A + 90, dip, A);
      close(r.beta, dip); close(r.magnitude, dip, 0.01 / 1e3);
      assert.equal(r.side, 'rechts');
    }
  }
});

test('Fallrichtung = A − 90°: scheinbares Fallen = wahres Fallen, fällt nach links', () => {
  for (const A of [0, 33, 170, 300]) {
    for (const dip of [10, 45, 80]) {
      const r = apparentDip(A - 90, dip, A);
      close(r.beta, -dip); close(r.magnitude, dip);
      assert.equal(r.side, 'links');
    }
  }
});

test('Bildlage: Spur bei Fallrichtung A + 90° fällt im Bild nach rechts (y nimmt mit x ab)', () => {
  const d = traceDirection(90 + 20, 40, 20);
  assert.ok(d);
  assert.ok(d.x > 0 && d.y < 0);
  close(Math.atan2(-d.y, d.x) / DEG, 40);
});

test('Fallrichtung = A oder A + 180°: Spur horizontal (β = 0), s\' = s / cos(Fallen)', () => {
  // Hinweis: Das Kluftnormale/Tunnelachse-Winkel θ = 90° − Fallen, also sin θ = cos(Fallen).
  // Die Auftragsvorgabe "s / sin(Fallen)" widerspricht der verbindlichen Formel s' = s / sin θ.
  for (const A of [0, 77, 250]) {
    for (const dip of [20, 45, 70]) {
      for (const dd of [A, A + 180]) {
        const r = apparentDip(dd, dip, A);
        close(r.beta, 0); assert.equal(r.side, null);
        const sp = apparentSpacing(dd, dip, A, 3);
        assert.equal(sp.parallel, false);
        close(/** @type {number} */ (sp.spacing), 3 / Math.cos(dip * DEG), 1e-9);
        close(sp.sinTheta, Math.cos(dip * DEG));
        // unabhängige Geometrie: lotrechter Abstand horizontaler Ebenen-Spuren = s / cos(Fallen)
        const ts = traceSet(dd, dip, A, 3, CENTER, WIN);
        const ys = ts.segments.map((s) => s.y1).sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i++) close(ys[i] - ys[i - 1], 3 / Math.cos(dip * DEG), 1e-9);
      }
    }
  }
  close(/** @type {number} */ (apparentSpacing(0, 45, 0, 1).spacing), Math.SQRT2);
});

test('Senkrechte Kluft mit Fallrichtung = A (oder A + 180°): parallel zum Schnitt, keine Spuren', () => {
  for (const A of [0, 90, 215]) {
    for (const dd of [A, A + 180]) {
      const sp = apparentSpacing(dd, 90, A, 2);
      assert.equal(sp.parallel, true);
      assert.equal(sp.spacing, null);
      const ts = traceSet(dd, 90, A, 2, CENTER, WIN);
      assert.equal(ts.parallel, true);
      assert.equal(ts.apparentSpacing, null);
      assert.deepEqual(ts.segments, []);
    }
  }
});

test('Grenze «parallel»: sin θ < 0.02', () => {
  assert.equal(PARALLEL_LIMIT, 0.02);
  // senkrechte Kluft, Fallrichtung um ε von A abweichend: sin θ = sin ε
  assert.equal(apparentSpacing(1.0, 90, 0, 1).parallel, true); // sin 1° = 0.01745
  assert.equal(apparentSpacing(1.2, 90, 0, 1).parallel, false); // sin 1.2° = 0.02094
  assert.equal(apparentSpacing(1.2, 90, 0, 1).spacing !== null, true);
});

test('Streichen parallel zur Achse: s\' = s', () => {
  for (const A of [0, 60, 310]) {
    for (const dip of [5, 45, 90]) {
      for (const dd of [A + 90, A - 90]) {
        const sp = apparentSpacing(dd, dip, A, 1.7);
        close(sp.sinTheta, 1);
        close(/** @type {number} */ (sp.spacing), 1.7);
        close(apparentDip(dd, dip, A).magnitude, dip);
      }
    }
  }
});

test('A und A + 180°: gleicher Betrag von β, Seite vertauscht', () => {
  const rand = rng(21);
  for (let i = 0; i < 50; i++) {
    const A = rand() * 360;
    const dd = rand() * 360;
    const dip = 1 + rand() * 80;
    const r1 = apparentDip(dd, dip, A);
    const r2 = apparentDip(dd, dip, A + 180);
    close(r1.magnitude, r2.magnitude);
    close(r1.beta, -r2.beta);
    assert.notEqual(r1.side, r2.side);
    assert.equal(r1.side === 'rechts' ? 'links' : 'rechts', r2.side);
    close(/** @type {number} */ (apparentSpacing(dd, dip, A, 1).spacing),
      /** @type {number} */ (apparentSpacing(dd, dip, A + 180, 1).spacing));
  }
});

test('Zwei unabhängige Wege (Kreuzprodukt vs. Formel) stimmen überein: 200 Zufallsfälle, fester Seed', () => {
  const rand = rng(20240611);
  for (let i = 0; i < 200; i++) {
    const A = rand() * 360;
    const dd = rand() * 360;
    const dip = rand() * 89.9;
    const s = 0.1 + rand() * 5;

    // Weg 1: Formel tan β = tan α · sin(δ − A)
    const f = apparentDip(dd, dip, A);
    // Weg 2: Spurrichtung aus Kreuzprodukt Normale × Schnittnormale; Bild: x rechts, y oben.
    const dir = traceDirection(dd, dip, A);
    assert.ok(dir, `Fall ${i}`);
    close(Math.hypot(dir.x, dir.y), 1);
    const betaCross = -Math.atan2(dir.y, dir.x) / DEG; // β > 0: fällt nach rechts (y nimmt ab)
    assert.ok(angleDiff(f.beta, betaCross) < 1e-7, `Fall ${i}: ${f.beta} vs ${betaCross}`);
    close(Math.abs(Math.tan(f.beta * DEG)), Math.tan(dip * DEG) * Math.abs(Math.sin((dd - A) * DEG)), 1e-6 * (1 + Math.tan(dip * DEG)));
    if (Math.abs(f.beta) > 1e-6) assert.equal(f.side, f.beta > 0 ? 'rechts' : 'links');

    // Abstand: Formel s/sin θ gegen Skalarprodukt Normale·Achse
    const n = jointNormal(dd, dip);
    const axis = { x: Math.sin(A * DEG), y: Math.cos(A * DEG), z: 0 };
    const cosTheta = n.x * axis.x + n.y * axis.y + n.z * axis.z;
    const sinThetaDot = Math.sqrt(1 - cosTheta * cosTheta);
    const sp = apparentSpacing(dd, dip, A, s);
    close(sp.sinTheta, sinThetaDot, 1e-7);

    // Spurenschar: Abstand zwischen benachbarten Spuren im Bild = s'; alle Spuren liegen in Ebenen k·s
    const ts = traceSet(dd, dip, A, s, CENTER, { xmin: -50, xmax: 50, ymin: -50, ymax: 50 });
    if (sp.parallel) {
      assert.equal(ts.parallel, true);
      continue;
    }
    assert.equal(ts.parallel, false);
    close(/** @type {number} */ (ts.apparentSpacing), s / sinThetaDot, 1e-6);
    // Implizite Ebenengleichung im Schnitt: n_u·u + n_v·v = c
    const right = { x: Math.cos(A * DEG), y: -Math.sin(A * DEG), z: 0 };
    const nu = n.x * right.x + n.y * right.y;
    const nv = n.z;
    for (const seg of ts.segments) {
      for (const [x, y] of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
        const dist = nu * x + nv * (y - CENTER.y); // Normalabstand zur Spur k = 0
        close(dist, seg.k * s, 1e-6, `Fall ${i} k=${seg.k}`);
      }
      // Segmentrichtung = Kreuzproduktrichtung
      const L = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      close(Math.abs((seg.x2 - seg.x1) * dir.y - (seg.y2 - seg.y1) * dir.x) / L, 0, 1e-9);
    }
    // eine Spur geht durch die Profilmitte
    assert.ok(ts.segments.some((seg) => seg.k === 0));
  }
});

test('Spurenschar: Zuschnitt auf Bildfenster und eine Spur durch die Profilmitte', () => {
  const ts = traceSet(90, 60, 0, 1.5, CENTER, WIN);
  assert.equal(ts.parallel, false);
  const k0 = ts.segments.find((s) => s.k === 0);
  assert.ok(k0);
  // Spur durch (0, 4): fällt mit 60° nach rechts -> y = 4 − tan60·x
  close(k0.y1 - (CENTER.y - Math.tan(60 * DEG) * k0.x1), 0, 1e-9);
  for (const s of ts.segments) {
    for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      assert.ok(x >= WIN.xmin - 1e-9 && x <= WIN.xmax + 1e-9);
      assert.ok(y >= WIN.ymin - 1e-9 && y <= WIN.ymax + 1e-9);
    }
  }
  // Senkrechte Spuren (Streichen ⟂ Achse? nein: Fallen 90, Streichen ∥ Achse) im Abstand s
  const v = traceSet(90, 90, 0, 1.5, CENTER, WIN);
  assert.equal(v.parallel, false);
  for (const s of v.segments) {
    close(s.x1, s.x2, 1e-9);
    close(Math.abs(s.x1), Math.abs(s.k) * 1.5, 1e-9); // Vorzeichen von k ist Konvention der Orientierung
    close(Math.min(s.y1, s.y2), WIN.ymin); close(Math.max(s.y1, s.y2), WIN.ymax);
  }
});

test('Spurenschar: Schutz bei winzigem Abstand', () => {
  const ts = traceSet(90, 45, 0, 0.0001, CENTER, WIN, 500);
  assert.equal(ts.truncated, true);
  assert.deepEqual(ts.segments, []);
});
