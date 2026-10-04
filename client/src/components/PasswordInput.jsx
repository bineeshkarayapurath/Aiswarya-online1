import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

/**
 * Password field with a show/hide toggle, so members can confirm what they typed
 * — which matters most on the registration and set-password forms, where a
 * mistyped character is otherwise invisible.
 *
 * Deliberately does NOT forward a ref or expose the underlying input's DOM node:
 * the toggle needs internal state, and letting it leak would invite callers to
 * reach into the field instead of using the props below.
 */
export default function PasswordInput({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  hint,
  icon,
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label && (
        <label className="label">
          {icon && <span className="mr-1 text-emerald-900">{icon}</span>}
          {label}
          {!required && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
        </label>
      )}
      <div className="relative">
        <input
          className="input pr-11"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          // Keeps iOS from autocapitalising and from flagging the value.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-emerald-900"
          // The label is what a screen reader announces; the icons are not.
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
