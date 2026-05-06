import React, { useMemo, useState } from 'react';
import QuickReportCard from './correcoes/QuickReportCard';
import PrecisionReportCard from './correcoes/PrecisionReportCard';
import { useEditDraft } from '../hooks/useEditDraft';
import { parseCorrectionMessage } from '../utils/notifParser';

const CorrecoesAdminPortal = ({ workers, appNotifications, saveToDb, handleDelete, clients, logs, currentUser }) => {
  // 1. Parse and Partition Notifications
  const processedNotifications = useMemo(() => {
    return (appNotifications || [])
      .filter(n => n.is_active && n.title && (n.title.includes('Pedido de Correção') || n.title.includes('Contra-proposta Aceite')))
      .map(n => ({
        ...n,
        parsedData: parseCorrectionMessage(n.message)
      }));
  }, [appNotifications]);

  const quickNotifications = processedNotifications.filter(n => n.parsedData.type === 'quick');
  const precisionNotifications = processedNotifications.filter(n => n.parsedData.type === 'precision');

  // 2. Draft Management
  const { draft, startEdit, updateField, updateNestedField, clearDraft, isDirty } = useEditDraft();

  // 3. Handlers
  const handleSave = async () => {
    if (!draft) return;
    
    try {
      // In a real scenario, here we would call saveToDb for the logs
      // For now, let's simulate the success
      console.log('Saving correction to DB:', draft);
      
      // Update the notification status/message to reflect it's processed
      // Or just delete it if that's the current workflow
      await handleDelete('app_notifications', draft.id);
      
      alert(`Correção para ${draft.parsedData.workerName} aplicada com sucesso!`);
      clearDraft();
    } catch (error) {
      alert('Erro ao salvar correção: ' + error.message);
    }
  };

  const handleReject = async () => {
    if (!draft) return;
    if (!window.confirm('Tem certeza que deseja rejeitar este reporte?')) return;

    try {
      await handleDelete('app_notifications', draft.id);
      alert('Reporte arquivado.');
      clearDraft();
    } catch (error) {
      alert('Erro ao arquivar reporte: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <header style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Painel de Auditoria</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
          Gerencie {processedNotifications.length} pendências de correção.
        </p>
      </header>

      {/* Stats Summary */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
        <div style={{ flex: 1, background: 'rgba(129, 140, 248, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
          <div style={{ fontSize: '11px', color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '4px' }}>Reportes Rápidos</div>
          <div style={{ fontSize: '24px', fontWeight: '800' }}>{quickNotifications.length}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(34, 211, 238, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
          <div style={{ fontSize: '11px', color: '#67e8f9', textTransform: 'uppercase', marginBottom: '4px' }}>Reportes de Precisão</div>
          <div style={{ fontSize: '24px', fontWeight: '800' }}>{precisionNotifications.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '60px' }}>
        {/* Quick Section */}
        {quickNotifications.length > 0 && (
          <section>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Correções Rápidas
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
              {quickNotifications.map(n => (
                <QuickReportCard 
                  key={n.id}
                  notification={{ ...n.parsedData, id: n.id }}
                  onEdit={() => startEdit({ ...n, ...n.parsedData })}
                  isEditing={draft?.id === n.id}
                  draft={draft?.id === n.id ? draft : null}
                  updateField={updateField}
                />
              ))}
            </div>
          </section>
        )}

        {/* Precision Section */}
        {precisionNotifications.length > 0 && (
          <section>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Auditoria de Precisão
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
              {precisionNotifications.map(n => (
                <PrecisionReportCard 
                  key={n.id}
                  notification={{ ...n.parsedData, id: n.id }}
                  onEdit={() => startEdit({ ...n, ...n.parsedData })}
                  isEditing={draft?.id === n.id}
                  draft={draft?.id === n.id ? draft : null}
                  updateNestedField={updateNestedField}
                />
              ))}
            </div>
          </section>
        )}

        {processedNotifications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
            <p>Nenhuma correção pendente no momento.</p>
          </div>
        )}
      </div>

      {/* Global Control Bar */}
      {draft && (
        <div style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '30px', 
          zIndex: 1000,
          background: '#1f2028',
          padding: '24px 32px',
          borderRadius: '20px',
          border: '1px solid #818cf8',
          boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
          width: '340px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Editando</div>
              <div style={{ fontSize: '18px', fontWeight: '700' }}>{draft.parsedData.workerName}</div>
            </div>
            {isDirty() && (
              <span style={{ fontSize: '10px', color: '#22d3ee', background: 'rgba(34, 211, 238, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                Alterado
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button onClick={handleSave} style={{ 
              background: 'linear-gradient(135deg, #818cf8, #c084fc)',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: '700',
              cursor: 'pointer'
            }}>
              Confirmar
            </button>
            <button onClick={handleReject} style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#f87171', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Rejeitar
            </button>
            <button onClick={clearDraft} style={{ 
              gridColumn: 'span 2',
              background: 'rgba(255,255,255,0.05)', 
              color: 'rgba(255,255,255,0.6)', 
              border: 'none',
              padding: '10px',
              borderRadius: '10px',
              marginTop: '5px',
              cursor: 'pointer'
            }}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrecoesAdminPortal;
