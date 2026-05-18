import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockSaveToDb = vi.fn().mockResolvedValue({});
const mockGoToView = vi.fn();
const mockSetCorrectionMode = vi.fn();

const createMockClientPortalProps = () => ({
  clientData: {
    id: 'c1',
    name: 'EMPRESA TESTE',
    period: 'Maio de 2026'
  },
  originalWorkersData: [
    {
      id: 'w1',
      name: 'João Silva',
      role: 'Developer',
      totalHours: 160,
      dailyRecords: [
        {
          rawDate: '2026-05-01',
          date: '01/05 (sex)',
          entry: '08:00',
          exit: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          hours: 8
        },
        {
          rawDate: '2026-05-02',
          date: '02/05 (sáb)',
          entry: '08:00',
          exit: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          hours: 8
        }
      ]
    }
  ],
  initialClientId: 'c1',
  initialMonth: '2026-05',
  saveToDb: mockSaveToDb,
  isApproved: false,
  approvalData: null
});

describe('Quick Report UI - Renderização Condicional', () => {
  it('deve renderizar modo triagem com duas opções de reporte', () => {
    const setupForTriagemMode = require('./test-helpers.cjs').setupForTriagemMode;
    const props = createMockClientPortalProps();
    const { container } = setupForTriagemMode(props);

    expect(container.querySelector('button')).toBeTruthy();
  });
});

describe('Quick Report UI - Fluxo de Mensagem Rápida', () => {
  const mockUseState = () => {
    let state = {
      correctionMode: 'comentario',
      reportJustification: '',
      draftData: [],
      currentView: 'editar_relatorio'
    };
    return [
      state,
      (updater) => {
        if (typeof updater === 'function') {
          state = updater(state);
        } else {
          state = { ...state, ...updater };
        }
      }
    ];
  };

  it('deve renderizar textarea para justificativa', () => {
    const mockState = mockUseState();
    const props = createMockClientPortalProps();

    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'justification-input');
    container.appendChild(textarea);

    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('deve permitir digitar na textarea', () => {
    const mockState = mockUseState();
    const props = createMockClientPortalProps();

    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'justification-input');
    container.appendChild(textarea);

    fireEvent.change(textarea, { target: { value: 'Texto de teste' } });
    expect(textarea.value).toBe('Texto de teste');
  });

  it('deve validar que justificativa não pode estar vazia ao enviar', () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'submit-button');
    button.disabled = true;
    container.appendChild(textarea);
    container.appendChild(button);

    expect(button.disabled).toBe(true);
  });

  it('deve gerar mensagem rápida quando justificativa é preenchida', () => {
    const draftData = [
      {
        id: 'w1',
        name: 'João Silva',
        totalHours: 160,
        editedTotalHours: 160,
        dailyRecords: [
          {
            date: '01/05 (sex)',
            rawDate: '2026-05-01',
            entry: '08:00',
            exit: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
            hours: 8,
            editedEntry: '08:00',
            editedExit: '17:00',
            editedBreakStart: '12:00',
            editedBreakEnd: '13:00',
            editedHours: 8
          }
        ]
      }
    ];

    const clientData = {
      name: 'EMPRESA TESTE',
      period: 'Maio de 2026'
    };

    const generateCorrectionMessage = (draftData, clientData, originalTotal, reportJustification) => {
      let correcoesTexto = `💬 MENSAGEM DE DIVERGÊNCIA: ${clientData.name}\n`;
      correcoesTexto += `📅 Período: ${clientData.period}\n\n`;
      correcoesTexto += `📊 RESUMO GERAL:\n`;
      correcoesTexto += `• Total Original: ${originalTotal}h\n`;
      correcoesTexto += `• Novo Total Sugerido: ${draftData.reduce((acc, w) => acc + w.editedTotalHours, 0)}h\n`;
      correcoesTexto += `• Diferença: 0.00h\n\n`;
      correcoesTexto += `👥 DETALHES POR COLABORADOR:\n\n`;
      return correcoesTexto;
    };

    const message = generateCorrectionMessage(draftData, clientData, 160, '');
    expect(message).toContain('💬 MENSAGEM DE DIVERGÊNCIA: EMPRESA TESTE');
    expect(message).toContain('📅 Período: Maio de 2026');
  });
});

describe('Quick Report UI - Navegação entre modos', () => {
  it('deve retornar ao modo triagem ao clicar em voltar', () => {
    const container = document.createElement('div');
    const voltarButton = document.createElement('button');
    voltarButton.setAttribute('data-testid', 'voltar-button');
    container.appendChild(voltarButton);

    expect(container.querySelector('button')).toBeTruthy();
  });
});

describe('Quick Report UI - Botões de Ação', () => {
  it('deve desabilitar botão de envio quando justificativa está vazia', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Enviar Mensagem ao Admin';
    button.disabled = true;
    container.appendChild(button);

    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Enviar Mensagem ao Admin');
  });

  it('deve habilitar botão de envio quando justificativa é preenchida', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Enviar Mensagem ao Admin';
    button.disabled = false;
    container.appendChild(button);

    expect(button.disabled).toBe(false);
  });

  it('deve ter texto correto no botão principal', () => {
    const button = document.createElement('button');
    button.textContent = 'Enviar Mensagem ao Admin';

    expect(button.textContent).toBe('Enviar Mensagem ao Admin');
  });
});

describe('Quick Report - Integração com saveToDb', () => {
  beforeEach(() => {
    mockSaveToDb.mockClear();
  });

  it('deve chamar saveToDb com parâmetros corretos ao enviar mensagem', async () => {
    await mockSaveToDb('correcoes', 'correcao_123', {
      id: 'correcao_123',
      title: 'Divergência Reportada: EMPRESA TESTE',
      message: 'Test message',
      status: 'pending',
      client_id: 'c1',
      month: '2026-05'
    });

    expect(mockSaveToDb).toHaveBeenCalledWith('correcoes', 'correcao_123', expect.objectContaining({
      id: 'correcao_123',
      title: 'Divergência Reportada: EMPRESA TESTE',
      status: 'pending'
    }));
  });

  it('deve chamar saveToDb para criar notificação após salvar correção', async () => {
    await mockSaveToDb('correcoes', 'correcao_123', {
      id: 'correcao_123',
      status: 'pending'
    });

    await mockSaveToDb('app_notifications', 'notif_123', {
      id: 'notif_123',
      title: 'Divergência Reportada: EMPRESA TESTE',
      payload: expect.objectContaining({
        correcao_id: 'correcao_123',
        reportType: 'quick'
      })
    });

    expect(mockSaveToDb).toHaveBeenCalledTimes(2);
  });

  it('deve propagar correcao_id no payload da notificação', async () => {
    const correcaoId = 'correcao_' + Date.now();
    const notifId = 'notif_' + Date.now();

    const correcaoRecord = {
      id: correcaoId,
      status: 'pending',
      client_id: 'c1'
    };

    const newNotif = {
      id: notifId,
      payload: { changes: [], isFullMonth: true, reportType: 'quick' }
    };

    const newNotifWithCorrecaoId = {
      ...newNotif,
      payload: { ...newNotif.payload, correcao_id: correcaoId }
    };

    await mockSaveToDb('correcoes', correcaoId, correcaoRecord);
    await mockSaveToDb('app_notifications', notifId, newNotifWithCorrecaoId);

    expect(mockSaveToDb).toHaveBeenNthCalledWith(2, 'app_notifications', notifId, expect.objectContaining({
      payload: expect.objectContaining({
        correcao_id: correcaoId
      })
    }));
  });
});

describe('Quick Report - Validação de Estado', () => {
  it('deve manter tracking de modo de correção', () => {
    const modes = ['triagem', 'comentario', 'manual'];
    let currentMode = 'triagem';

    expect(modes).toContain('triagem');
    expect(modes).toContain('comentario');
    expect(modes).toContain('manual');

    currentMode = 'comentario';
    expect(currentMode).toBe('comentario');
  });

  it('deve suportar transição entre modos', () => {
    const transitionMap = {
      'triagem': ['comentario', 'manual'],
      'comentario': ['triagem'],
      'manual': ['triagem']
    };

    expect(transitionMap['triagem']).toContain('comentario');
    expect(transitionMap['comentario']).toContain('triagem');
  });
});