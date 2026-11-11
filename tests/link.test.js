// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState } from '../app/link.js';
import { defaultState, newJoint, validateState } from '../app/state.js';

test('Hin- und Rückweg: Standardzustand', () => {
  const s = defaultState();
  assert.deepEqual(decodeState('#' + encodeState(s)), s);
  assert.deepEqual(decodeState(encodeState(s)), s); // auch ohne #
});

test('Hin- und Rückweg: geänderte Werte, Dezimalzahlen', () => {
  const s = defaultState();
  s.tunnelAzimuth = 33.5;
  s.profile = { width: 12.25, height: 9 };
  s.joints[0] = { name: 'Kl 1b', dipDirection: 7.5, dip: 5.25, spacing: 0.35 };
  s.joints[2].spacing = 12;
  assert.deepEqual(decodeState(encodeState(s)), s);
});

test('Hin- und Rückweg: Sonderzeichen im Namen', () => {
  const names = [
    'Kl 1b', 'a,b,c', 'x&y=z', '100 % sicher', '#1', 'Ä Ö Ü ß é', '日本語', '"quote" \'apos\'', '<b>&amp;</b>',
    '  führend und folgend  ', '+plus+', 'a/b\\c', '', ',,,',
  ];
  for (const name of names) {
    const s = defaultState();
    s.joints[1].name = name;
    const back = decodeState('#' + encodeState(s));
    assert.equal(back.joints[1].name, name, JSON.stringify(name));
    assert.deepEqual(back, s, JSON.stringify(name));
  }
});

test('Hin- und Rückweg: 0 Klüfte', () => {
  const s = defaultState();
  s.joints = [];
  const enc = encodeState(s);
  assert.match(enc, /n=0/);
  assert.deepEqual(decodeState(enc), s);
});

test('Hin- und Rückweg: 5 Klüfte', () => {
  const s = defaultState();
  while (s.joints.length < 5) s.joints.push(newJoint(s.joints.length));
  s.joints[4] = { name: 'letzte, mit Komma', dipDirection: 360, dip: 90, spacing: 0.01 };
  const back = decodeState(encodeState(s));
  assert.equal(back.joints.length, 5);
  assert.deepEqual(back, s);
});

test('Der Link ist ein gültiger URL-Teil (keine Zeilenumbrüche, keine Leerzeichen)', () => {
  const s = defaultState();
  s.joints[0].name = 'a b\nc';
  const enc = encodeState(s);
  assert.ok(!/\s/.test(enc));
  assert.equal(decodeState(enc).joints[0].name, 'a b\nc');
});

test('Kaputter Link: gültiger Zustand, kein Fehler', () => {
  const def = defaultState();
  const broken = [
    '', '#', '#abc', '#%', '#%E0%A4%A', '#A=&B=&H=&n=&j=', '#A=abc&B=x&H=y&n=z', '#{}', '#undefined',
    '#j=1,2,3,x', '#n=5', '#=&&&==', 'A', '#' + 'x'.repeat(10000),
  ];
  for (const b of broken) {
    const s = decodeState(b);
    assert.equal(validateState(s).valid, true, b.slice(0, 40));
    assert.deepEqual(s, def, b.slice(0, 40));
  }
  // Teilweise brauchbar: A bleibt, Rest Standard
  for (const b of ['#A=118', '#A=1&A=2&A=3']) assert.equal(validateState(decodeState(b)).valid, true);
  // nicht-Text darf auch nicht abstürzen
  assert.deepEqual(decodeState(/** @type {any} */ (undefined)), def);
  assert.deepEqual(decodeState(/** @type {any} */ (null)), def);
});

test('Unvollständiger Link: gültige Teile bleiben, fehlende werden Standard', () => {
  const def = defaultState();
  const s = decodeState('#A=45');
  assert.equal(s.tunnelAzimuth, 45);
  assert.deepEqual(s.profile, def.profile);
  assert.deepEqual(s.joints, def.joints);
  const t = decodeState('#B=14&H=9');
  assert.equal(t.tunnelAzimuth, 118);
  assert.deepEqual(t.profile, { width: 14, height: 9 });
});

test('Ungültige Werte im Link: nur die betroffene Gruppe wird Standard', () => {
  const s = defaultState();
  s.tunnelAzimuth = 45;
  s.joints[0].dip = 40;
  const enc = encodeState(s);
  // Fallen 95 statt 40: ungültig, Kluftliste fällt auf Standard, A bleibt
  const bad = enc.replace('295%2C40%2C', '295%2C95%2C');
  assert.notEqual(bad, enc);
  const r = decodeState(bad);
  assert.equal(r.tunnelAzimuth, 45);
  assert.deepEqual(r.joints, defaultState().joints);
  // H < B/2: Profil fällt auf Standard
  const p = decodeState('#' + encodeState({ ...s, profile: { width: 10, height: 4 } }));
  assert.deepEqual(p.profile, defaultState().profile);
  assert.equal(p.tunnelAzimuth, 45);
  // Azimut ausserhalb
  assert.equal(decodeState('#' + encodeState({ ...s, tunnelAzimuth: 400 })).tunnelAzimuth, 118);
  // Anzahl passt nicht zu den Klüften
  assert.deepEqual(decodeState(enc.replace('n=3', 'n=2')).joints, defaultState().joints);
  // mehr als 5 Klüfte
  const many = defaultState();
  while (many.joints.length < 6) many.joints.push(newJoint(many.joints.length));
  assert.deepEqual(decodeState('#' + encodeState(many)).joints, defaultState().joints);
});

test('Spacing 0 im Link: Kluftliste fällt auf Standard', () => {
  const s = defaultState();
  s.joints[1].spacing = 0;
  assert.deepEqual(decodeState(encodeState(s)).joints, defaultState().joints);
});
