import React from 'react';
import StatusBadge from './StatusBadge';
import PrecisionEditTable from './PrecisionEditTable';

const PrecisionReportCard = ({ notification, onEdit, isEditing, draft, updateNestedField }) => {
  const { workerName, dateRange, affectedDaysCount, totalDifference } = notification;

  return (
    <div className={`glass-card ${isEditing ? 'editing' : ''}`} style={{ 
      transition: 'all 0.3s ease',
      height: isEditing ? 'auto' : '220px',
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(8px)',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      border: isEditing ? '1px solid #22d3ee' : '1px solid rgba(255, 255, 255, 0.05)',
      borderLeft: '4px solid #22d3ee'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <StatusBadge type="precision" />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>ID: {notification.id}</span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>{workerName}</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{dateRange}</p>
      </div>

      {!isEditing ? (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[...Array(affectedDaysCount)].map((_, i) => (
              <div key={i} style={{ 
                width: '30px', 
                height: '30px', 
                borderRadius: '6px', 
                background: 'rgba(34, 211, 238, 0.1)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#22d3ee',
                fontWeight: '700'
              }}>
                {i + 1}
              </div>
            ))}
            {affectedDaysCount > 5 && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', alignSelf: 'center' }}>+ {affectedDaysCount - 5}</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Diferença Total</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#22d3ee' }}>
                {totalDifference}h
              </span>
            </div>
            <button 
              onClick={onEdit}
              style={{ 
                background: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Revisar Dias
            </button>
          </div>
        </>
      ) : (
        <PrecisionEditTable 
          days={draft?.days || []} 
          onUpdateField={updateNestedField} 
        />
      )}
    </div>
  );
};

export default PrecisionReportCard;
