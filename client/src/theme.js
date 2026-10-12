// Colour theme: "system" (follow the OS), "light", "dark" or "contrast" (high contrast, IPP-NF-004).
// The choice is stored per browser and applied to <html data-theme> before first paint to avoid a flash.
const KEY = 'ipp-theme';
export const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['contrast', 'High contrast'],
];

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (THEMES.some(([v]) => v === saved)) return saved;
  } catch {
    /* storage blocked */
  }
  // First visit: honour an OS-level "increase contrast" request.
  return window.matchMedia?.('(prefers-contrast: more)').matches ? 'contrast' : 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

export const initTheme = () => applyTheme(getTheme());
