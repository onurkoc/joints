// @ts-check
/*
Gespeichertes Farbschema vor dem ersten Zeichnen anwenden (klassisches Skript im <head>,
damit Dark oder Light nicht aufblitzt). Gleicher Schlüssel wie app/ui/theme.js;
ohne Speicher gilt die Systemeinstellung.
*/
(() => {
  try {
    const choice = window.localStorage.getItem('joints-theme');
    if (choice === 'light' || choice === 'dark') {
      document.documentElement.setAttribute('data-theme', choice);
    }
  } catch {
    // Speicher gesperrt: Systemeinstellung
  }
})();
