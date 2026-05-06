import React from 'react';
import StatusBadge from './StatusBadge';
import TimeInput from './TimeInput';

const QuickReportCard = ({ notification, onEdit, isEditing, draft, updateField }) => {
  const { workerName, dateRange, message, hoursDiscrepancy } = notification;

  return (
    <div className={`glass-card ${isEditing ? 'editing' : ''}`} style={{ 
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      border: isEditing ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.05)',
      height: isEditing ? 'auto' : '220px',
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(8px)',
      borderRadius: '16px',
      padding: '24px',
      color: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <StatusBadge type="quick" />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>ID: {notification.id}</span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>{workerName}</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{dateRange}</p>
      </div>

      {!isEditing ? (
        <>
          <div style={{ 
            padding: '12px', 
            marginBottom: '20px', 
            fontSize: '14px', 
            lineHeight: '1.5',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            "{message}"
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Discrepância</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#818cf8' }}>
                {hoursDiscrepancy}h
              </span>
            </div>
            <button 
              onClick={onEdit}
              style={{ 
                background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Corrigir
            </button>
          </div>
        </>
      ) : (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '8px' }}>
              Contra-proposta de Horas
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <TimeInput 
                value={draft?.hoursDiscrepancy} 
                onChange={(val) => updateField('hoursDiscrepancy', val)}
                label="Novo Total"
              />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                Original: {hoursDiscrepancy}h
              </span>
            </div>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '8px' }}>
              Motivo da Ajuste
            </label>
            <textarea 
              style={{ 
                width: '100%', 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: 'white',
                padding: '10px',
                fontSize: '13px',
                minHeight: '60px',
                fontFamily: 'inherit',
                outline: 'none'
              }}
              placeholder="Descreva o motivo da alteração..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickReportCard;
