import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme } from '../theme.js';

// Light/Dark slider switch: the thumb slides between sun and moon. Exposed as a switch for assistive tech.
export default function ThemeToggle() {
  const [theme, setState] = useState(getTheme);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`theme-switch${dark ? ' on' : ''}`}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setState(next);
        setTheme(next);
      }}
    >
      <Sun className="ts-sun" size={14} aria-hidden="true" />
      <Moon className="ts-moon" size={14} aria-hidden="true" />
      <span className="ts-thumb" aria-hidden="true">
        {dark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}
