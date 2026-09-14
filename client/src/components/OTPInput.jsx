import { useRef, useEffect } from 'react';

export default function OTPInput({ length = 6, value, onChange, onComplete }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (digits.every((d) => d !== '') && onComplete) onComplete(digits.join(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits.join('|')]);

  const handleChange = (i, val) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const arr = value.split('');
      arr[i] = '';
      onChange(arr.join(''));
      return;
    }
    const arr = value.split('');
    for (let k = 0; k < clean.length; k++) {
      if (i + k < length) arr[i + k] = clean[k];
    }
    onChange(arr.join(''));
    const next = Math.min(i + clean.length, length - 1);
    if (i + clean.length < length) refs.current[i + clean.length]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          maxLength={length - i}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          className="h-12 w-10 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold text-emerald-900 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}