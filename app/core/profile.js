// @ts-check

/** @typedef {import('./types.js').Point} Point */

/**
 * Hufeisenprofil: flache Sohle bei z = 0, senkrechte Ulmen bis H − B/2,
 * Halbkreis-Kalotte mit Radius B/2. Bedingung H ≥ B/2 (sonst Fehler).
 * Umriss gegen den Uhrzeigersinn (Bild: x rechts, y oben), geschlossen:
 * letzter Punkt = erster Punkt = (−B/2, 0).
 * @param {number} B Breite in m
 * @param {number} H Höhe in m
 * @param {number} [arcSteps] Anzahl Segmente der Kalotte
 * @returns {Point[]}
 */
export function horseshoe(B, H, arcSteps = 64) {
  if (!(B > 0) || !(H >= B / 2)) {
    throw new RangeError('Hufeisenprofil: B > 0 und H >= B/2 erforderlich');
  }
  const a = B / 2;
  const w = H - a; // Höhe der Ulmen bis zum Kämpfer
  /** @type {Point[]} */
  const pts = [{ x: -a, y: 0 }, { x: a, y: 0 }];
  for (let i = 0; i <= arcSteps; i++) {
    /** @type {Point} */
    let p;
    if (i === 0) p = { x: a, y: w };
    else if (i === arcSteps) p = { x: -a, y: w };
    else {
      const th = (Math.PI * i) / arcSteps;
      p = { x: a * Math.cos(th), y: w + a * Math.sin(th) };
    }
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > 1e-12) pts.push(p);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-12) pts.push({ x: first.x, y: first.y });
  else pts[pts.length - 1] = { x: first.x, y: first.y };
  return pts;
}
