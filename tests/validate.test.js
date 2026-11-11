// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, MAX_JOINTS } from '../app/core/validate.js';

const joint = (over = {}) => ({ name: 'K1', dipDirection: 90, dip: 45, spacing: 0.5, ...over });
const base = (over = {}) => ({
  tunnelAzimuth: 30,
  joints: [joint()],
  profile: { width: 10, height: 8 },
  ...over,
});

/** @param {any} input @param {string} field @param {string} code */
function expectError(input, field, code) {
  const r = validateInput(input);
  assert.equal(r.valid, false);
  assert.ok(
    r.errors.some((e) => e.field === field && e.code === code),
    `erwartet ${field}/${code}, erhalten ${JSON.stringify(r.errors)}`,
  );
}

test('gültige Eingabe, Randwerte und leere Kluftliste', () => {
  assert.deepEqual(validateInput(base()), { valid: true, errors: [] });
  assert.equal(validateInput(base({ tunnelAzimuth: 0 })).valid, true);
  assert.equal(validateInput(base({ tunnelAzimuth: 360 })).valid, true);
  assert.equal(validateInput(base({ joints: [joint({ dipDirection: 0, dip: 0 }), joint({ dipDirection: 360, dip: 90 })] })).valid, true);
  assert.equal(validateInput(base({ joints: [] })).valid, true);
  assert.equal(validateInput(base({ profile: { width: 10, height: 5 } })).valid, true); // H = B/2
});

test('Regel: Tunnelrichtung 0…360', () => {
  expectError(base({ tunnelAzimuth: -0.1 }), 'tunnelAzimuth', 'RANGE');
  expectError(base({ tunnelAzimuth: 360.1 }), 'tunnelAzimuth', 'RANGE');
  expectError(base({ tunnelAzimuth: NaN }), 'tunnelAzimuth', 'TYPE');
});

test('Regel: Fallrichtung 0…360', () => {
  expectError(base({ joints: [joint({ dipDirection: 361 })] }), 'joints[0].dipDirection', 'RANGE');
  expectError(base({ joints: [joint({ dipDirection: -1 })] }), 'joints[0].dipDirection', 'RANGE');
});

test('Regel: Fallen 0…90', () => {
  expectError(base({ joints: [joint(), joint({ dip: 90.5 })] }), 'joints[1].dip', 'RANGE');
  expectError(base({ joints: [joint({ dip: -5 })] }), 'joints[0].dip', 'RANGE');
});

test('Regel: Abstand > 0', () => {
  expectError(base({ joints: [joint({ spacing: 0 })] }), 'joints[0].spacing', 'MIN_EXCLUSIVE');
  expectError(base({ joints: [joint({ spacing: -1 })] }), 'joints[0].spacing', 'MIN_EXCLUSIVE');
  expectError(base({ joints: [joint({ spacing: '1' })] }), 'joints[0].spacing', 'TYPE');
});

test('Regel: maximal 5 Klüfte', () => {
  assert.equal(MAX_JOINTS, 5);
  const five = Array.from({ length: 5 }, () => joint());
  assert.equal(validateInput(base({ joints: five })).valid, true);
  expectError(base({ joints: [...five, joint()] }), 'joints', 'MAX_COUNT');
});

test('Regel: H ≥ B/2', () => {
  expectError(base({ profile: { width: 10, height: 4.99 } }), 'profile.height', 'H_LT_HALF_B');
});

test('Breite und Höhe müssen positive Zahlen sein; Name muss Text sein', () => {
  expectError(base({ profile: { width: 0, height: 8 } }), 'profile.width', 'MIN_EXCLUSIVE');
  expectError(base({ profile: { width: 10 } }), 'profile.height', 'TYPE');
  expectError(base({ joints: [joint({ name: 5 })] }), 'joints[0].name', 'TYPE');
});

test('Fehlende Eingabe wirft nicht, sondern meldet Fehler; mehrere Fehler werden gesammelt', () => {
  assert.equal(validateInput(undefined).valid, false);
  assert.equal(validateInput({}).valid, false);
  const r = validateInput(base({ tunnelAzimuth: 400, joints: [joint({ dip: 100, spacing: 0 })] }));
  assert.equal(r.errors.length, 3);
});
