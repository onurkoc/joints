// @ts-check
/*
Hover-Text: zeigt den Inhalt von data-tip des Elements unter dem Mauszeiger
(Zeilenumbruch = neue Zeile). Ein Textfeld für die ganze Seite.
*/

/**
 * @param {HTMLElement} root Bereich, in dem Elemente mit data-tip reagieren
 */
export function setupTooltip(root) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);

  /** @param {MouseEvent} e */
  const move = (e) => {
    const target = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (!target) {
      tip.hidden = true;
      return;
    }
    const text = target.getAttribute('data-tip') ?? '';
    if (tip.textContent !== text) tip.textContent = text;
    tip.hidden = false;
    const pad = 14;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + w > window.innerWidth - 4) x = e.clientX - pad - w;
    if (y + h > window.innerHeight - 4) y = e.clientY - pad - h;
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.max(4, y)}px`;
  };
  root.addEventListener('mousemove', move);
  root.addEventListener('mouseover', move);
  root.addEventListener('mouseout', (e) => {
    const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('[data-tip]') : null;
    if (!to) tip.hidden = true;
  });
  root.addEventListener('mouseleave', () => { tip.hidden = true; });
}
