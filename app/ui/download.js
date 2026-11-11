// @ts-check
/*
Dateien erzeugen und herunterladen (SVG, PNG mit doppelter Auflösung), Text in die Zwischenablage.
*/

/**
 * Blob als Datei herunterladen.
 * @param {string} name Dateiname mit Endung
 * @param {Blob} blob
 */
export function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * @param {string} svg
 * @returns {Blob}
 */
export function svgBlob(svg) {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * SVG-Dokument als PNG (weisser Grund, Auflösung × scale).
 * @param {string} svg
 * @param {number} width Breite des SVG in px
 * @param {number} height Höhe des SVG in px
 * @param {number} [scale]
 * @returns {Promise<Blob>}
 */
export function svgToPngBlob(svg, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas not available')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG could not be created'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG could not be rendered'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Text in die Zwischenablage; true bei Erfolg.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Ersatzweg ohne Clipboard-API (z. B. unsichere Seite)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-1000px;top:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
