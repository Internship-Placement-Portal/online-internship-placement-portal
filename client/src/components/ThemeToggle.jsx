import { useState } from 'react';
import { Contrast, Monitor, Moon, Sun } from 'lucide-react';
import { THEMES, getTheme, setTheme } from '../theme.js';

const ICONS = { system: Monitor, light: Sun, dark: Moon, contrast: Contrast };

// Keyboard-accessible native <select> with a leading icon; changes apply instantly and are remembered.
export default function ThemeToggle({ compact = false }) {
  const [theme, setState] = useState(getTheme);
  const Icon = ICONS[theme];
  return (
    <label className={`theme-toggle${compact ? ' compact' : ''}`} style={{ margin: 0 }}>
      <span className="sr-only">Colour theme</span>
      <Icon size={16} aria-hidden="true" />
      <select
        value={theme}
        onChange={(e) => {
          setState(e.target.value);
          setTheme(e.target.value);
        }}
      >
        {THEMES.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
