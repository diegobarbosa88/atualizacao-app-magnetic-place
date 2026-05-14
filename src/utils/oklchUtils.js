// Converte oklch(L C H [/ A]) para grayscale aproximado, preservando lightness.
// Necessário porque o html2canvas usado pelo html2pdf não parseia oklch (CSS Color L4).
const oklchToGray = (match) => {
  const m = match.match(/oklch\(\s*([\d.]+)(%?)/i);
  if (!m) return '#000';
  let L = parseFloat(m[1]);
  if (m[2] === '%') L = L / 100;
  const v = Math.max(0, Math.min(255, Math.round(Math.pow(L, 1 / 2.2) * 255)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
};

export const replaceOklch = (text) =>
  (text || '').replace(/oklch\([^)]+\)/gi, (m) => oklchToGray(m));

export function stripOklchFromDoc(doc) {
  const elements = doc.querySelectorAll ? doc.querySelectorAll('*') : [];
  elements.forEach(el => {
    const style = el.style;
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      const val = style.getPropertyValue(prop);
      if (val && val.includes('oklch')) {
        style.setProperty(prop, replaceOklch(val));
      }
    }
    if (el.hasAttribute('style')) {
      const newStyle = replaceOklch(el.getAttribute('style'));
      el.setAttribute('style', newStyle);
    }
    if (el.hasAttribute('class')) {
      const newClass = replaceOklch(el.getAttribute('class'));
      el.setAttribute('class', newClass);
    }
  });

  const allText = doc.querySelectorAll('style');
  allText.forEach(styleEl => {
    if (styleEl.textContent) {
      styleEl.textContent = replaceOklch(styleEl.textContent);
    }
  });
}

// Walks live DOM, reads computed color-related styles, and writes them inline
// on the matching cloned tree. Defeats Tailwind v4 oklch utility classes.
const COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
];

export function inlineComputedColors(liveRoot, cloneRoot) {
  if (!liveRoot || !cloneRoot) return;
  const liveAll = [liveRoot, ...liveRoot.querySelectorAll('*')];
  const cloneAll = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
  const len = Math.min(liveAll.length, cloneAll.length);
  for (let i = 0; i < len; i++) {
    const liveEl = liveAll[i];
    const cloneEl = cloneAll[i];
    if (!(liveEl instanceof Element) || !(cloneEl instanceof Element)) continue;
    const cs = window.getComputedStyle(liveEl);
    for (const prop of COLOR_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (!val) continue;
      if (val.includes('oklch') || val.includes('oklab') || val.includes('lab(') || val.includes('lch(') || val.includes('color(')) {
        const fixed = replaceOklch(val);
        cloneEl.style.setProperty(prop, fixed, 'important');
      } else if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        cloneEl.style.setProperty(prop, val);
      }
    }
  }
}