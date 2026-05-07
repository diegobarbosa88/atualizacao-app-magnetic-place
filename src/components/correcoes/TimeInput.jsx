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
    <div className="flex flex-col gap-1">
      {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>}
      <input
        type="text"
        value={value || ''}
        onChange={handleChange}
        placeholder="00:00"
        maxLength={5}
        className="bg-white border border-slate-200 rounded-xl text-slate-800 px-3 py-2 text-sm font-mono w-20 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
      />
    </div>
  );
};

export default TimeInput;