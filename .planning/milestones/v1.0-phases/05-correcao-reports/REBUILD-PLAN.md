# Phase 5: Correção do Sistema de Reports - Plano de Reconstrução

## Problema Atual
O código da `CorrecoesAdmin` é confuso com lógicas misturadas entre quick e precision reports, causando conflitos quando se edita num afeta o outro.

## Regras de negócio
- **Quick Report** (badge "Rápido"): Cliente envia mensagem de texto. Admin pode editar horas, aceitar, rejeitar, enviar contra-proposta.
- **Precision Report** (badge "Precisão"): Cliente edita dias específicos. Admin pode editar horas de qualquer dia, aceitar, rejeitar, enviar contra-proposta.
- Ambos permitem admin editar horas.

## Solução: Separar completamente

### Estrutura do State

```javascript
// Para CADA notification, criar objeto separado por tipo
quickCorrections[notifId] = {
  status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'counter_proposal'
  reason: '',
  adminEditedWorkers: [], // mudanças feitas pelo admin
  originalMessage: '', // mensagem original do cliente
}

precisionCorrections[notifId] = {
  workers: [], // dados completos do workers
  editingDayId: null,
  activeWorkerId: null,
  adminChanges: {}, // { workerId: { dayDate: { adminEntry, adminExit, ... } } }
}
```

### Nova Arquitetura

```
CorrecoesAdmin
├── State: quickCorrections, precisionCorrections (separados)
├── quickNotifications (filter só quick)
├── precisionNotifications (filter só precision)
├──
├── QuickReportSection
│   ├── renderQuickCard(notif)
│   ├── handleQuickAccept(notif)
│   ├── handleQuickReject(notif, reason)
│   ├── handleQuickCounterProposal(notif, reason)
│   └── handleQuickEditHours(notif) → mesmo editing que precision
│
└── PrecisionReportSection
    ├── renderPrecisionCard(notif)
    ├── handleStartPrecisionEdit(notif)
    ├── handleUpdateDayField(notif, workerId, day, field, value)
    ├── handleClearDay(notif, workerId, day)
    ├── handleSavePrecisionChanges(notif)
    └── handleCancelPrecisionEdit(notif)
```

### Implementação

1. **Criar filtros separados** no início do render
2. **Criar função de edição de horas PARTILHADA** (both use same editing logic)
3. **Separar botões de ação** por tipo
4. **State completamente isolado** entre tipos

## Passos

1. Extrair `quickNotifications` e `precisionNotifications` no render
2. Criar `renderQuickReportCard(notif)` component
3. Criar `renderPrecisionReportCard(notif)` component
4. Criar `useEditDraft` hook partilhado para edição de horas
5. Migrar lógica de botões para funções separadas
6. Remover código antigo misturado

## Código Partilhado (para edição de horas)

```javascript
// Hook partilhado para edição de horas em ambos os tipos
function useEditDraft(notifId, initialData) {
  const [draft, setDraft] = useState(initialData);
  const [editingDayId, setEditingDayId] = useState(null);

  const updateField = (workerId, dayDate, field, value) => {
    setDraft(prev => ({
      ...prev,
      workers: prev.workers.map(w =>
        w.id === workerId ? {
          ...w,
          dailyRecords: w.dailyRecords.map(d =>
            d.date === dayDate ? { ...d, [field]: value } : d
          )
        } : w
      )
    }));
  };

  return { draft, setDraft, editingDayId, setEditingDayId, updateField };
}
```

## Commit Messages
- `feat: separate quick and precision report state`
- `feat: create shared editing hook for hours`
- `fix: remove old mixed logic from CorrecoesAdmin`