import { useRef } from 'react';

// Six single-digit boxes: auto-advance, backspace to previous, paste a full code, arrow-key navigation.
export default function OtpInput({ value, onChange, length = 6, label = 'Verification code' }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const set = (i, d) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  return (
    <fieldset className="otp" onPaste={(e) => {
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (text) {
        e.preventDefault();
        onChange(text);
        focus(text.length);
      }
    }}>
      <legend className="label" style={{ marginTop: '1rem' }}>
        {label}
      </legend>
      <div style={{ display: 'flex', gap: '0.55rem', width: '100%' }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? 'otp' : undefined}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={d}
            aria-label={`Digit ${i + 1} of ${length}`}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(-1);
              set(i, v);
              if (v) focus(i + 1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i]) {
                e.preventDefault();
                set(Math.max(0, i - 1), '');
                focus(i - 1);
              } else if (e.key === 'ArrowLeft') focus(i - 1);
              else if (e.key === 'ArrowRight') focus(i + 1);
            }}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </fieldset>
  );
}
