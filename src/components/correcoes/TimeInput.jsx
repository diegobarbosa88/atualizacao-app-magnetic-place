import React from 'react';

const TimeInput = ({ value, onChange, label }) => {
  const handleChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    
    if (val.length >= 3) {
      val = val.slice(0, 2) + ':' + val.slice(2);
    }
    
    onChange(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{label}</label>}
      <input
        type="text"
        value={value || ''}
        onChange={handleChange}
        placeholder="00:00"
        maxLength={5}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          color: 'white',
          padding: '8px 10px',
          fontSize: '14px',
          width: '80px',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}
      />
    </div>
  );
};

export default TimeInput;
