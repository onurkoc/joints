// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, validateState } from '../app/state.js';
import { buildModel } from '../app/model.js';
import { exportStereonet, exportSection, exportBoth } from '../app/export.js';

/** @param {import('../app/state.js').State} s */
function modelOf(s) {
  return buildModel(s, validateState(s).errors);
}

/**
 * Gemeinsame Anforderungen: eigenständig, hell, feste Farben, weisser Grund.
 * @param {{svg: string, width: number, height: number}} img
 */
function assertStandalone(img) {
  const { svg, width, height } = img;
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(width > 0 && height > 0);
  assert.ok(svg.includes(`width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`));
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!svg.includes('var('), 'keine CSS-Variablen');
  assert.ok(!svg.includes('class='), 'keine Klassen');
  assert.ok(!svg.includes('style='), 'kein style-Attribut');
  assert.ok(!svg.includes('data-tip'), 'kein Hover-Text');
  assert.ok(!svg.includes('paint-order'), 'kein paint-order');
  assert.ok(!svg.includes('dominant-baseline'), 'kein dominant-baseline');
  assert.ok(!svg.includes('rgba'), 'kein rgba');
  assert.ok(!svg.includes('<style'), 'kein <style>');
  assert.ok(!/pointer-events/.test(svg));
  assert.ok(svg.includes('font-family="Arial, Helvetica, sans-serif"'));
  assert.ok(svg.includes(`<rect width="${width}" height="${height}" fill="#ffffff"/>`), 'weisser Grund');
  for (const c of ['#2f9e44', '#d9363e', '#2563eb']) assert.ok(svg.includes(c), c);
  // Tags ausgeglichen (grobe Wohlgeformtheit)
  const tags = svg.replace(/<\?[\s\S]*?\?>/, '').match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
  /** @type {(string|undefined)[]} */
  const stack = [];
  for (const t of tags) {
    const name = /^<\/?([a-zA-Z]+)/.exec(t)?.[1];
    if (t.startsWith('</')) assert.equal(stack.pop(), name, t);
    else if (!t.endsWith('/>')) stack.push(name);
  }
  assert.deepEqual(stack, []);
}

test('Export Netz: eigenständiges SVG mit Titel, Tunnelrichtung und Legende', () => {
  const img = exportStereonet(modelOf(defaultState()));
  assertStandalone(img);
  const { svg } = img;
  assert.ok(svg.includes('Stereonet – equal area, lower hemisphere'));
  assert.ok(svg.includes('Tunnel direction 118°'));
  assert.ok(svg.includes('Joint sets'));
  for (const l of ['Kl 1b 295/85', 'Kl 2b 207/86', 'SS 317/50']) {
    // im Netz (Halo und Text) und in der Legende
    assert.ok((svg.match(new RegExp(`>${l}</text>`, 'g')) ?? []).length >= 3, l);
  }
  assert.ok(svg.includes('>Tunnel 118°</text>'));
  assert.ok(svg.includes('#7c3aed'), 'Tunnel violett');
  assert.equal((svg.match(/<circle [^>]*r="5"/g) ?? []).length, 3);
  assert.ok(!svg.includes('<clipPath'), 'Netz braucht keinen Ausschnitt');
});

test('Export Querschnitt: B und H, apparent dip mit Seite, apparent spacing je Kluft', () => {
  const img = exportSection(modelOf(defaultState()));
  assert.ok(img);
  assertStandalone(img);
  const { svg } = img;
  assert.ok(svg.includes('Cross-section – looking in tunnel direction (118°)'));
  assert.ok(svg.includes('Horseshoe profile: B = 10 m, H = 8 m'));
  assert.ok(svg.includes('apparent dip 31° (right)') && svg.includes('apparent spacing 9.85 m'));
  assert.ok(svg.includes('apparent dip 86° (right)') && svg.includes('apparent spacing 1.00 m'));
  assert.ok(svg.includes('apparent dip 21° (left)') && svg.includes('apparent spacing 1.45 m'));
  assert.ok(svg.includes('left (028°)') && svg.includes('right (208°)'));
  assert.ok(svg.includes('tan β = tan α · sin(dip direction − A)'));
  assert.ok(svg.includes('clip-path="url(#section-window)"'));
  assert.equal((svg.match(/<clipPath /g) ?? []).length, 1);
});

test('Export beide: Netz links, Querschnitt rechts, ein Bild', () => {
  const m = modelOf(defaultState());
  const both = exportBoth(m);
  assert.ok(both);
  assertStandalone(both);
  const net = exportStereonet(m);
  const sec = exportSection(m);
  assert.ok(sec);
  assert.ok(both.width > net.width && both.width > sec.width);
  assert.ok(both.svg.indexOf('Stereonet – equal area') < both.svg.indexOf('Cross-section – looking'));
  assert.ok(both.svg.includes('Horseshoe profile') && both.svg.includes('Joint sets'));
  const tr = [...both.svg.matchAll(/<g transform="translate\(([\d.]+) 28\)">/g)].map((x) => Number(x[1]));
  assert.equal(tr.length, 2);
  assert.ok(tr[1] > tr[0]);
});

test('Export: Namen werden maskiert, Sonderzeichen brechen das SVG nicht', () => {
  const s = defaultState();
  s.joints[0].name = '<b>"A&B"</b>';
  const { svg } = exportStereonet(modelOf(s));
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt; 295/85'));
});

test('Export: parallele Kluft und zu viele Spuren stehen in der Legende', () => {
  const s = defaultState();
  s.joints[0] = { name: 'P', dipDirection: 118, dip: 90, spacing: 1 };
  s.joints[1].spacing = 0.001;
  const img = exportSection(modelOf(s));
  assert.ok(img);
  assert.ok(img.svg.includes('parallel to section – no traces'));
  assert.ok(img.svg.includes('too many traces – increase spacing'));
  assertStandalone(img);
});

test('Export: ohne Klüfte und mit 5 Klüften', () => {
  const s0 = defaultState();
  s0.joints = [];
  const a = exportStereonet(modelOf(s0));
  assert.ok(a.svg.includes('Tunnel 118°'));
  assert.ok(!a.svg.includes('rx="2"'), 'keine Legendenfelder für Klüfte');
  const s5 = defaultState();
  for (let i = 3; i < 5; i++) s5.joints.push({ name: `J${i}`, dipDirection: 30 * i, dip: 40 + i, spacing: 2 });
  const b = exportSection(modelOf(s5));
  assert.ok(b);
  assertStandalone(b);
  assert.ok(b.svg.includes('#e8730c') && b.svg.includes('#0d9488'));
});

test('Export Querschnitt bei ungültigem Profil: nicht möglich, Netz trotzdem', () => {
  const s = defaultState();
  s.profile.height = 3;
  const m = modelOf(s);
  assert.equal(exportSection(m), null);
  assert.equal(exportBoth(m), null);
  assert.ok(exportStereonet(m).svg.length > 0);
});

test('Export ist deterministisch (unabhängig vom Theme)', () => {
  const m = modelOf(defaultState());
  assert.equal(exportStereonet(m).svg, exportStereonet(m).svg);
});
