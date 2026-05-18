import React, { useState, useEffect, useRef } from 'react';

// Auto-formatting HH:MM input. User types digits; ":" is inserted automatically
// after the 2nd digit. On blur, value is normalised (e.g., "9:3" → "09:30") or
// cleared if invalid (with a brief red border).
const TimeTextInput = ({ value, onChange, placeholder = 'HH:MM', className = '', disabled = false }) => {
  const [local, setLocal] = useState(value || '');
  const [invalid, setInvalid] = useState(false);
  const flashRef = useRef(null);

  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  useEffect(() => () => clearTimeout(flashRef.current), []);

  const formatTyping = (raw) => {
    const digits = (raw || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const handleChange = (e) => {
    const next = formatTyping(e.target.value);
    setLocal(next);
    setInvalid(false);
  };

  const handleBlur = () => {
    if (!local) {
      onChange('');
      return;
    }
    const digits = local.replace(/\D/g, '');
    if (digits.length === 0) {
      onChange('');
      return;
    }
    let hh, mm;
    if (digits.length <= 2) {
      hh = digits.padStart(2, '0');
      mm = '00';
    } else if (digits.length === 3) {
      hh = `0${digits[0]}`;
      mm = digits.slice(1);
    } else {
      hh = digits.slice(0, 2);
      mm = digits.slice(2);
    }
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) {
      setInvalid(true);
      setLocal('');
      onChange('');
      clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setInvalid(false), 1200);
      return;
    }
    const normalized = `${hh}:${mm}`;
    setLocal(normalized);
    onChange(normalized);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder={placeholder}
      value={local}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`${className} ${invalid ? 'border-rose-500 ring-2 ring-rose-200' : ''}`}
    />
  );
};

export default TimeTextInput;
