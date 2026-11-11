// @ts-check
// Gemeinsame JSDoc-Typen des Rechenkerns. Keine Laufzeitinhalte.

/**
 * Kluftschar. Winkel in Grad, Abstand in m (senkrecht zur Kluftfläche).
 * @typedef {Object} Joint
 * @property {string} name
 * @property {number} dipDirection Fallrichtung, 0…360
 * @property {number} dip Fallen, 0…90
 * @property {number} spacing Abstand s in m, > 0
 */

/**
 * Vektor in Koordinaten x = Ost, y = Nord, z = oben.
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * Linie im Raum (Richtung ab Nord im Uhrzeigersinn, Eintauchen nach unten), Grad.
 * @typedef {Object} Line
 * @property {number} trend 0…360
 * @property {number} plunge 0…90
 */

/**
 * Punkt in einer Ebene (Netz: x = Ost, y = Nord; Querschnitt: x = rechts, y = oben).
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Segment
 * @property {number} x1
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 */

/**
 * Achsenparalleles Rechteck (Bildfenster).
 * @typedef {Object} Rect
 * @property {number} xmin
 * @property {number} xmax
 * @property {number} ymin
 * @property {number} ymax
 */

/**
 * @typedef {Object} Profile
 * @property {number} width Breite B in m
 * @property {number} height Höhe H in m
 */

/**
 * @typedef {Object} JointsInput
 * @property {number} tunnelAzimuth Tunnelrichtung A, 0…360
 * @property {Joint[]} joints
 * @property {Profile} profile
 */

export {};
