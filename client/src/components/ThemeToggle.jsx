import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme } from '../theme.js';

// One-click Light/Dark switch (icon button, announced through its aria-label).
export default function ThemeToggle() {
  const [theme, setState] = useState(getTheme);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setState(next);
        setTheme(next);
      }}
    >
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}
