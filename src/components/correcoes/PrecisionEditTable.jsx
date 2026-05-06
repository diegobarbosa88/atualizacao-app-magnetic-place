import React from 'react';
import TimeInput from './TimeInput';

const PrecisionEditTable = ({ days, onUpdateField }) => {
  return (
    <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s ease-out', color: 'white' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <th style={{ padding: '8px' }}>Dia</th>
            <th style={{ padding: '8px' }}>Entrada</th>
            <th style={{ padding: '8px' }}>Saída</th>
            <th style={{ padding: '8px' }}>Intervalo</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => (
            <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', color: '#22d3ee', fontWeight: '700' }}>{day.date}</td>
              <td style={{ padding: '8px' }}>
                <TimeInput 
                  value={day.start} 
                  onChange={(val) => onUpdateField(`days.${index}.start`, val)} 
                />
              </td>
              <td style={{ padding: '8px' }}>
                <TimeInput 
                  value={day.end} 
                  onChange={(val) => onUpdateField(`days.${index}.end`, val)} 
                />
              </td>
              <td style={{ padding: '8px' }}>
                <TimeInput 
                  value={day.break} 
                  onChange={(val) => onUpdateField(`days.${index}.break`, val)} 
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrecisionEditTable;
