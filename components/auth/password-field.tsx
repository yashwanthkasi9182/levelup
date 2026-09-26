'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export function PasswordField({
  value,
  onChange,
  newPassword = false,
  label = 'Password',
}: {
  value: string;
  onChange: (s: string) => void;
  newPassword?: boolean;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="password-field">
        <input
          type={show ? 'text' : 'password'}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          minLength={newPassword ? 12 : undefined}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {newPassword && <small>12 characters minimum.</small>}
    </label>
  );
}
