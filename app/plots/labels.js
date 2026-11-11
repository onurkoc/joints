// @ts-check
/*
Platzierung der Pol-Beschriftungen im Netz: reine Funktion ohne DOM.
Der Pol bleibt an seiner Stelle, nur der Text wird verschoben. Versuchsreihenfolge je
Beschriftung: links vom Pol, rechts, oben, unten; danach (wenn nötig) Ecken und
verschobene Lagen. Ein Platz gilt, wenn der Textkasten
- ganz im Netzkreis liegt,
- keinen bereits platzierten Textkasten, keinen Pol (auch keinen späteren) und kein
  festes Hindernis (z. B. «Tunnel …») berührt.
Textbreite wird aus der Zeichenzahl geschätzt (etwas zu gross, damit der Kasten sicher reicht).
*/

/**
 * @typedef {Object} Box
 * @property {number} x1
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 */

/**
 * @typedef {Object} LabelRequest
 * @property {number} id
 * @property {number} x Pol im Bild (px)
 * @property {number} y
 * @property {string} text
 */

/**
 * @typedef {Object} LabelPlacement
 * @property {number} id
 * @property {number} x Textanker (px)
 * @property {number} y Grundlinie (px)
 * @property {'start'|'middle'|'end'} anchor
 * @property {'left'|'right'|'top'|'bottom'|'other'} side
 * @property {Box} box Kasten samt Rand (für Prüfungen)
 * @property {boolean} ok false, wenn kein freier Platz gefunden wurde (dann bestmöglicher Platz)
 */

/** Schriftgrösse der Beschriftungen in px. */
export const LABEL_FONT = 12;
/** Mittlere Zeichenbreite als Anteil der Schriftgrösse (fett, bewusst grosszügig). */
const CHAR_EM = 0.62;
/** Abstand des Textes vom Pol in px. */
const GAP = 9;
/** Rand um den Text (Halo) in px. */
const HALO = 2;
/** Halbe Kantenlänge des Polzeichens samt Rand (Radius 5 + Halo). */
const POLE_HALF = 7;
/** Abstand zum Netzrand, innerhalb dessen der Kasten bleiben muss. */
const RIM_INSET = 1;

/**
 * Geschätzte Textbreite in px.
 * @param {string} text
 * @param {number} [fontSize]
 * @returns {number}
 */
export function estimateWidth(text, fontSize = LABEL_FONT) {
  return [...text].length * fontSize * CHAR_EM;
}

/**
 * Kasten eines Textes mit Grundlinie `by` und Anker an `ax`, samt Halo.
 * Oberlänge 0.85 em, Unterlänge 0.25 em.
 * @param {number} ax
 * @param {number} by
 * @param {number} w
 * @param {'start'|'middle'|'end'} anchor
 * @param {number} [fontSize]
 * @returns {Box}
 */
export function textBox(ax, by, w, anchor, fontSize = LABEL_FONT) {
  const x1 = anchor === 'start' ? ax : anchor === 'end' ? ax - w : ax - w / 2;
  return { x1: x1 - HALO, y1: by - 0.85 * fontSize - HALO, x2: x1 + w + HALO, y2: by + 0.25 * fontSize + HALO };
}

/**
 * Umschliessender achsenparalleler Kasten eines gedrehten Textes (Tunnelbeschriftung).
 * Text wie im SVG: transform="translate(qx qy) rotate(rot)", y = baseline, Anker start/end.
 * @param {number} qx
 * @param {number} qy
 * @param {number} rot Drehung in Grad
 * @param {number} baseline y-Wert im gedrehten System (z. B. -5)
 * @param {number} w Textbreite
 * @param {'start'|'end'} anchor
 * @param {number} [fontSize]
 * @returns {Box}
 */
export function rotatedTextBox(qx, qy, rot, baseline, w, anchor, fontSize = LABEL_FONT) {
  const local = textBox(0, baseline, w, anchor, fontSize);
  const a = (rot * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const xs = [];
  const ys = [];
  for (const [lx, ly] of [[local.x1, local.y1], [local.x2, local.y1], [local.x2, local.y2], [local.x1, local.y2]]) {
    xs.push(qx + lx * c - ly * s);
    ys.push(qy + lx * s + ly * c);
  }
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/**
 * @param {Box} a
 * @param {Box} b
 * @returns {number} Überdeckungsfläche (0 = frei)
 */
function overlapArea(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Wie weit der Kasten über den Netzkreis ragt (px, 0 = ganz innen).
 * @param {Box} b
 * @param {number} cx
 * @param {number} cy
 * @param {number} R
 * @returns {number}
 */
function outside(b, cx, cy, R) {
  let worst = 0;
  for (const [x, y] of [[b.x1, b.y1], [b.x2, b.y1], [b.x2, b.y2], [b.x1, b.y2]]) {
    worst = Math.max(worst, Math.hypot(x - cx, y - cy) - (R - RIM_INSET));
  }
  return worst;
}

/**
 * Plätze für einen Pol in der Versuchsreihenfolge.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @returns {Array<{ax: number, by: number, anchor: 'start'|'middle'|'end', side: LabelPlacement['side']}>}
 */
function candidates(x, y, w) {
  const h = LABEL_FONT + 2 * HALO + 3; // Zeilenabstand für verschobene Lagen
  /** @type {Array<{ax: number, by: number, anchor: 'start'|'middle'|'end', side: LabelPlacement['side']}>} */
  const out = [];
  const left = (dy = 0) => ({ ax: x - GAP, by: y + 4 + dy, anchor: /** @type {const} */ ('end'), side: /** @type {const} */ (dy ? 'other' : 'left') });
  const right = (dy = 0) => ({ ax: x + GAP, by: y + 4 + dy, anchor: /** @type {const} */ ('start'), side: /** @type {const} */ (dy ? 'other' : 'right') });
  const up = POLE_HALF + HALO + 0.25 * LABEL_FONT; // Unterkante des Kastens knapp über dem Polzeichen
  const down = POLE_HALF + HALO + 0.85 * LABEL_FONT; // Oberkante knapp unter dem Polzeichen
  const top = (dx = 0, dy = 0) => ({ ax: x + dx, by: y - up + dy, anchor: /** @type {const} */ ('middle'), side: /** @type {const} */ (dx || dy ? 'other' : 'top') });
  const bottom = (dx = 0, dy = 0) => ({ ax: x + dx, by: y + down + dy, anchor: /** @type {const} */ ('middle'), side: /** @type {const} */ (dx || dy ? 'other' : 'bottom') });
  out.push(left(), right(), top(), bottom());
  // Ecken: Text neben dem Pol, nach oben oder unten versetzt
  for (let k = 1; k <= 6; k++) {
    for (const s of [-1, 1]) {
      out.push(left(s * k * h), right(s * k * h));
    }
    out.push(top(0, -k * h), bottom(0, k * h));
    for (const s of [-1, 1]) {
      out.push(top(s * (w / 2 + GAP), 0), bottom(s * (w / 2 + GAP), 0));
    }
  }
  return out;
}

/**
 * Plätze für alle Pol-Beschriftungen bestimmen.
 * @param {LabelRequest[]} poles in der Reihenfolge der Vorrang
 * @param {{cx: number, cy: number, R: number, obstacles?: Box[], fontSize?: number}} ctx
 *   Netzmitte und -radius in px; feste Hindernisse (Kästen), z. B. die Tunnelbeschriftung
 * @returns {LabelPlacement[]} je Pol ein Platz, gleiche Reihenfolge
 */
export function placeLabels(poles, ctx) {
  const { cx, cy, R } = ctx;
  const fontSize = ctx.fontSize ?? LABEL_FONT;
  const fixed = ctx.obstacles ?? [];
  /** @type {Box[]} */
  const markers = poles.map((p) => ({ x1: p.x - POLE_HALF, y1: p.y - POLE_HALF, x2: p.x + POLE_HALF, y2: p.y + POLE_HALF }));
  /** @type {Box[]} */
  const placed = [];
  /** @type {LabelPlacement[]} */
  const out = [];
  for (const p of poles) {
    const w = estimateWidth(p.text, fontSize);
    let best = null;
    let bestScore = Infinity;
    for (const c of candidates(p.x, p.y, w)) {
      const box = textBox(c.ax, c.by, w, c.anchor, fontSize);
      let score = outside(box, cx, cy, R) * 1000;
      for (const o of [...placed, ...fixed, ...markers]) score += overlapArea(box, o);
      if (score < bestScore) {
        bestScore = score;
        best = { c, box };
        if (score === 0) break;
      }
    }
    if (!best) throw new Error('no label candidate');
    placed.push(best.box);
    out.push({ id: p.id, x: best.c.ax, y: best.c.by, anchor: best.c.anchor, side: best.c.side, box: best.box, ok: bestScore === 0 });
  }
  return out;
}
