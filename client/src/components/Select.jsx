import { Children, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

// Custom dropdown, drop-in for <select>: pass <option value>label</option> children and an onChange that reads e.target.value.
// Accessible listbox pattern: arrow keys / Home / End / type-ahead, Enter or Space to choose, Esc to close.
// The panel is rendered in a portal (fixed position) so dialogs and scrolling tables never clip it, and it flips upward near the bottom.
export default function Select({ value, onChange, children, id, disabled, className = '', 'aria-label': ariaLabel, 'aria-invalid': invalid, 'aria-describedby': describedBy }) {
  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter((c) => c && c.props)
        .map((c) => ({ value: String(c.props.value ?? Children.toArray(c.props.children).join('')), label: Children.toArray(c.props.children).join(''), disabled: c.props.disabled })),
    [children]
  );
  const current = options.findIndex((o) => o.value === String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, current));
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const list = useRef(null);
  const typed = useRef({ text: '', t: 0 });
  const uid = useId();

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const panelH = Math.min(280, options.length * 42 + 12);
    const below = window.innerHeight - r.bottom;
    const up = below < panelH + 16 && r.top > below;
    setPos({ left: r.left, width: Math.max(r.width, 180), top: up ? undefined : r.bottom + 8, bottom: up ? window.innerHeight - r.top + 8 : undefined, up });
  }, [options.length]);

  const choose = (i) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange?.({ target: { value: o.value, id } });
    setOpen(false);
    btn.current?.focus();
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, current));
    const close = (e) => {
      if (!btn.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false);
    };
    const move = () => place();
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function onKeyDown(e) {
    const step = (d) => {
      let i = active;
      do i = (i + d + options.length) % options.length;
      while (options[i]?.disabled && i !== active);
      setActive(i);
    };
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') (e.preventDefault(), step(1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), step(-1));
    else if (e.key === 'Home') (e.preventDefault(), setActive(0));
    else if (e.key === 'End') (e.preventDefault(), setActive(options.length - 1));
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), choose(active));
    else if (e.key === 'Escape') (e.preventDefault(), setOpen(false));
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current.text = now - typed.current.t > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.t = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  }

  const label = options[current]?.label ?? options[0]?.label ?? '';
  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`select-trigger${open ? ' open' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{label}</span>
        <ChevronDown size={17} aria-hidden="true" className="select-chevron" />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            id={`${uid}-list`}
            role="listbox"
            aria-label={ariaLabel || label || 'Options'}
            aria-activedescendant={`${uid}-o${active}`}
            className={`select-panel${pos.up ? ' up' : ''}`}
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          >
            {options.map((o, i) => (
              <li
                key={o.value + i}
                id={`${uid}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={i === current}
                aria-disabled={o.disabled || undefined}
                className={`select-option${i === active ? ' active' : ''}${i === current ? ' selected' : ''}`}
                style={{ '--i': Math.min(i, 9) }}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {i === current && <Check size={16} aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
