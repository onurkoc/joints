// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeLabels, estimateWidth, textBox, rotatedTextBox, LABEL_FONT } from '../app/plots/labels.js';
import { netLayout, stereonetContent } from '../app/plots/stereonet.js';
import { defaultState, validateState, newJoint } from '../app/state.js';
import { buildModel } from '../app/model.js';

/** @param {import('../app/state.js').State} s */
function modelOf(s) {
  return buildModel(s, validateState(s).errors);
}

/**
 * @param {import('../app/plots/labels.js').Box} a
 * @param {import('../app/plots/labels.js').Box} b
 */
function overlap(a, b) {
  return Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1e-9 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 1e-9;
}

/**
 * Prüft unabhängig von placeLabels: Kästen aus Platz und Text neu berechnet.
 * @param {Array<{id: number, x: number, y: number, text: string}>} reqs
 * @param {ReturnType<typeof placeLabels>} placed
 * @param {{cx: number, cy: number, R: number, obstacles?: import('../app/plots/labels.js').Box[]}} ctx
 */
function assertClean(reqs, placed, ctx) {
  assert.equal(placed.length, reqs.length);
  const boxes = placed.map((p, i) => textBox(p.x, p.y, estimateWidth(reqs[i].text), p.anchor));
  boxes.forEach((b, i) => {
    assert.ok(placed[i].ok, `Pol ${i}: kein freier Platz`);
    // im Netzkreis
    for (const [x, y] of [[b.x1, b.y1], [b.x2, b.y1], [b.x2, b.y2], [b.x1, b.y2]]) {
      assert.ok(Math.hypot(x - ctx.cx, y - ctx.cy) <= ctx.R, `Pol ${i}: Kasten ragt über den Netzrand`);
    }
    // keine Überdeckung mit anderen Beschriftungen, Hindernissen, Polen
    boxes.forEach((o, k) => { if (k !== i) assert.ok(!overlap(b, o), `Beschriftungen ${i} und ${k} überdecken sich`); });
    for (const o of ctx.obstacles ?? []) assert.ok(!overlap(b, o), `Pol ${i}: überdeckt ein Hindernis`);
    reqs.forEach((r, k) => {
      const marker = { x1: r.x - 5, y1: r.y - 5, x2: r.x + 5, y2: r.y + 5 };
      assert.ok(!overlap(b, marker), `Beschriftung ${i} überdeckt Pol ${k}`);
    });
  });
}

test('Textbreite aus Zeichenzahl, Kasten nach Anker', () => {
  assert.equal(estimateWidth(''), 0);
  assert.ok(estimateWidth('Kl 1b 295/85') > estimateWidth('SS 317/50'));
  assert.equal(estimateWidth('abcd', 10), 4 * 10 * 0.62);
  const w = 60;
  const s = textBox(100, 50, w, 'start');
  const e = textBox(100, 50, w, 'end');
  const m = textBox(100, 50, w, 'middle');
  assert.ok(s.x1 < 100 && s.x2 > 160 && e.x2 > 100 && e.x1 < 40 && m.x1 < 70 && m.x2 > 130);
  assert.ok(s.y1 < 50 - 0.85 * LABEL_FONT && s.y2 > 50);
});

test('Gedrehter Kasten: Drehung 0 und 90°', () => {
  const b0 = rotatedTextBox(100, 100, 0, -5, 80, 'start');
  assert.ok(b0.x1 < 100 && b0.x2 > 180 && b0.y2 < 100 + 1);
  const b90 = rotatedTextBox(100, 100, 90, -5, 80, 'start');
  assert.ok(b90.y2 > 180 && b90.x2 > 100 && b90.x1 <= 100);
});

test('Standardfall: Beschriftungen frei, überdeckungsfrei und im Netz, bei jeder Breite', () => {
  const m = modelOf(defaultState());
  for (const width of [300, 358, 420, 500, 560, 640, 720]) {
    const L = netLayout(m, width);
    assert.equal(L.placed.length, 3);
    const reqs = L.drawn.map((j, i) => ({ id: j.index, x: L.poles[i].x, y: L.poles[i].y, text: j.label }));
    assertClean(reqs, L.placed, { cx: L.cx, cy: L.cy, R: L.R, obstacles: L.tunnel ? [L.tunnel.box] : [] });
  }
});

test('Standardfall: der Pol bleibt an seiner Stelle', () => {
  const m = modelOf(defaultState());
  const L = netLayout(m, 500);
  L.drawn.forEach((j, i) => {
    const p = /** @type {{x: number, y: number}} */ (j.pole);
    assert.ok(Math.abs(L.poles[i].x - (L.cx + p.x * L.R)) < 1e-9);
    assert.ok(Math.abs(L.poles[i].y - (L.cy - p.y * L.R)) < 1e-9);
  });
});

test('Fünf Pole am selben Ort: fünf verschiedene freie Plätze', () => {
  const R = 220;
  const ctx = { cx: 250, cy: 250, R };
  const reqs = Array.from({ length: 5 }, (_, i) => ({ id: i, x: 280, y: 230, text: `Kl ${i + 1}a 295/85` }));
  const placed = placeLabels(reqs, ctx);
  assertClean(reqs, placed, ctx);
  // links und rechts belegen die Zeile des Pols; die übrigen weichen nach oben und unten aus
  assert.deepEqual(placed.slice(0, 2).map((p) => p.side), ['left', 'right']);
  assert.equal(new Set(placed.map((p) => `${p.x},${p.y}`)).size, 5);
});

test('Fünf Pole am selben Ort im Modell (fünf Klüfte, gleiche Lage) und bei schmalem Netz', () => {
  const s = defaultState();
  s.joints = Array.from({ length: 5 }, (_, i) => ({ ...newJoint(i), name: `K${i + 1}`, dipDirection: 120, dip: 40 }));
  const m = modelOf(s);
  for (const width of [358, 500, 640]) {
    const L = netLayout(m, width);
    const reqs = L.drawn.map((j, i) => ({ id: j.index, x: L.poles[i].x, y: L.poles[i].y, text: j.label }));
    assertClean(reqs, L.placed, { cx: L.cx, cy: L.cy, R: L.R, obstacles: L.tunnel ? [L.tunnel.box] : [] });
  }
});

test('Pol am Netzrand: Beschriftung bleibt im Netz', () => {
  const R = 250;
  const cx = 300;
  const cy = 300;
  const ctx = { cx, cy, R };
  const cases = /** @type {const} */ ([
    ['Nord', cx, cy - R, 'bottom'], ['Ost', cx + R, cy, 'left'], ['Süd', cx, cy + R, null], ['West', cx - R, cy, 'right'],
  ]);
  for (const [name, x, y, side] of cases) {
    const reqs = [{ id: 0, x, y, text: 'Kl 1b 295/85' }];
    const placed = placeLabels(reqs, ctx);
    assertClean(reqs, placed, ctx);
    if (side) assert.equal(placed[0].side, side, name);
  }
  // alle Himmelsrichtungen gleichzeitig plus Mitte, auch diagonal am Rand
  const reqs = [];
  for (let a = 0; a < 360; a += 30) {
    const t = (a * Math.PI) / 180;
    reqs.push({ id: a, x: cx + R * Math.sin(t), y: cy - R * Math.cos(t), text: `P${a} 295/85` });
  }
  reqs.push({ id: 999, x: cx, y: cy, text: 'Mitte 000/00' });
  assertClean(reqs, placeLabels(reqs, ctx), ctx);
});

test('Reihenfolge der Versuche: links, rechts, oben, unten', () => {
  const ctx = { cx: 400, cy: 400, R: 380 };
  const one = placeLabels([{ id: 0, x: 400, y: 400, text: 'A' }], ctx)[0];
  assert.equal(one.side, 'left');
  assert.equal(one.anchor, 'end');
  // links belegt -> rechts
  const hinder = [textBox(400 - 9, 404, estimateWidth('A'), 'end')];
  assert.equal(placeLabels([{ id: 0, x: 400, y: 400, text: 'A' }], { ...ctx, obstacles: hinder })[0].side, 'right');
  // links und rechts belegt -> oben
  hinder.push(textBox(400 + 9, 404, estimateWidth('A'), 'start'));
  assert.equal(placeLabels([{ id: 0, x: 400, y: 400, text: 'A' }], { ...ctx, obstacles: hinder })[0].side, 'top');
});

test('Hindernis (Tunnelbeschriftung) wird gemieden', () => {
  const ctx = { cx: 300, cy: 300, R: 250 };
  const tunnelBox = rotatedTextBox(210, 280, 30, -5, estimateWidth('Tunnel 118°'), 'start');
  const reqs = [{ id: 0, x: 300, y: 300, text: 'Kl 1b 295/85' }, { id: 1, x: 250, y: 290, text: 'SS 317/50' }];
  const placed = placeLabels(reqs, { ...ctx, obstacles: [tunnelBox] });
  assertClean(reqs, placed, { ...ctx, obstacles: [tunnelBox] });
});

test('Ohne Lösung: bester Platz mit ok = false, kein Absturz', () => {
  const ctx = { cx: 50, cy: 50, R: 20 };
  const placed = placeLabels([{ id: 0, x: 50, y: 50, text: 'Ein sehr langer Name 295/85' }], ctx);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].ok, false);
  assert.ok(Number.isFinite(placed[0].x) && Number.isFinite(placed[0].y));
  assert.deepEqual(placeLabels([], ctx), []);
});

test('Deterministisch', () => {
  const m = modelOf(defaultState());
  assert.deepEqual(netLayout(m, 500).placed, netLayout(m, 500).placed);
});

test('SVG: Beschriftungen liegen über allen Linien und haben einen Rand in Hintergrundfarbe', () => {
  const m = modelOf(defaultState());
  const screen = stereonetContent(m, 500, 'screen').body;
  assert.ok(screen.indexOf('<g class="labels">') > screen.lastIndexOf('class="gc"'));
  assert.ok(screen.indexOf('<g class="labels">') > screen.lastIndexOf('class="tunnel-line"'));
  assert.equal((screen.match(/class="plabel" /g) ?? []).length, 3);
  assert.ok(screen.includes('class="tunnel-label"'));
  const exp = stereonetContent(m, 500, 'export').body;
  assert.ok(!exp.includes('class='));
  // Export: je Beschriftung eine weisse Kopie (Rand) unter dem Text
  for (const l of ['Kl 1b 295/85', 'Kl 2b 207/86', 'SS 317/50', 'Tunnel 118°']) {
    const parts = exp.split(`>${l}</text>`);
    assert.equal(parts.length - 1, 2, l);
  }
  assert.equal((exp.match(/fill="#ffffff" stroke="#ffffff" stroke-width="4"/g) ?? []).length, 4);
  const lastLine = exp.lastIndexOf('stroke-width="2"/>'); // letzter Grosskreis
  assert.ok(exp.indexOf('fill="#ffffff" stroke="#ffffff"') > lastLine);
});
