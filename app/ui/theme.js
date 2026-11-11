// @ts-check
/*
Farbschema der Seite: System (prefers-color-scheme), Light oder Dark.
Die Wahl setzt data-theme auf <html> (app/style.css) und liegt im localStorage dieses
Browsers, nicht in der URL. app/theme-init.js wendet sie vor dem ersten Zeichnen an.
Alle Farben der Grafiken sind CSS-Variablen, ein Neuzeichnen ist nicht nötig.
*/

/** @typedef {'system' | 'light' | 'dark'} ThemeChoice */

export const THEME_KEY = 'joints-theme';

/**
 * @param {unknown} value
 * @returns {ThemeChoice}
 */
export function normalizeTheme(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * localStorage, oder null, wenn der Zugriff scheitert (gesperrte Websitedaten).
 * @returns {Storage | null}
 */
function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param {ThemeChoice} choice
 */
function apply(choice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/**
 * Umschalter (Radiogruppe mit den Werten system, light, dark) verdrahten.
 * @param {HTMLElement} group
 */
export function setupThemeSwitch(group) {
  let current = /** @type {ThemeChoice} */ ('system');
  try {
    current = normalizeTheme(storage()?.getItem(THEME_KEY));
  } catch {
    // Speicher gesperrt: System
  }
  apply(current);
  for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (group.querySelectorAll('input[type="radio"]'))) {
    input.checked = input.value === current;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const choice = normalizeTheme(input.value);
      apply(choice);
      try {
        if (choice === 'system') storage()?.removeItem(THEME_KEY);
        else storage()?.setItem(THEME_KEY, choice);
      } catch {
        // gilt nur bis die Seite geschlossen wird
      }
    });
  }
}
