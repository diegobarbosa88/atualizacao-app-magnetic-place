import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { mesSeguinte } from '../../src/lib/ajudas/valoresPorFatura.js';

// NOTA sobre cobertura: `waitFor` de @testing-library/react está com um bug
// de ambiente pré-existente neste repo (falha com "Expected container to be
// an Element..." mesmo num render trivial, sem relação com este componente
// — confirmado isolando um <div> simples). `findByText`/`findByRole` (que
// também fazem polling assíncrono internamente) funcionam normalmente, por
// isso este ficheiro usa-os em vez de `waitFor`. Onde uma asserção síncrona
// bastava (ex.: upsertCalls.push acontece de forma síncrona dentro do
// handler, antes do primeiro `await`), não se usa nenhum dos dois.

// Ajuste pedido (2026-08-20, "Completar Fase 2a"): a Estimativa Mensal
// deixou de recalcular automaticamente ao mudar de mês — só o botão
// "Simular" lê faturas JÁ EMITIDAS no TOConline (via
// buscarFaturasVendasPeriodo, mesma convenção M→M-1 do resto da
// calculadora: `mes` no ecrã é sempre o mês de referência do trabalho, a
// fatura real está em mesSeguinte(mes)) e grava (upsert) o resultado em
// ajudas_estimativas_fatura, tudo no mesmo clique — status
// 'calculado'/'bloqueado', fatura_id preenchido, nunca 'faturado' (essa
// transição só acontece na emissão real, Fase 2b, fora do âmbito deste
// ecrã).

const { CLIENTS, LOGS, upsertCalls, makeChain } = vi.hoisted(() => {
  const CLIENTS = [
    { id: 'c1', name: 'CLIENTE ELEGIVEL LDA', elegivel_ajudas_custo: true, valorHora: 20 },
    { id: 'c2', name: 'CLIENTE POR DECIDIR LDA', elegivel_ajudas_custo: null, valorHora: 20 },
    { id: 'c3', name: 'CLIENTE AINDA POR FATURAR LDA', elegivel_ajudas_custo: true, valorHora: 25 },
  ];
  const LOGS = []; // mutado por teste — logs do cliente c3 sem fatura real
  const upsertCalls = [];
  function makeChain(table) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (table === 'ajudas_percentagem_historica') {
          return { data: { id: 'pct1', percentagem: 0.5 }, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve) => {
        if (table === 'clients') return Promise.resolve({ data: CLIENTS, error: null }).then(resolve);
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
      upsert: (rows) => {
        upsertCalls.push({ table, rows });
        return Promise.resolve({ data: null, error: null });
      },
    };
    return chain;
  }
  return { CLIENTS, LOGS, upsertCalls, makeChain };
});

vi.mock('../../src/context/AppContext.jsx', () => {
  const appState = {
    clients: CLIENTS,
    logs: LOGS,
    supabase: { from: (table) => makeChain(table) },
    currentUser: { name: 'Admin Teste' },
  };
  return { useApp: () => appState };
});

vi.mock('../../src/features/admin/toconline/FaturarClienteModal.jsx', () => ({
  default: (props) => (
    <div data-testid="faturar-cliente-modal">
      <span data-testid="faturar-cliente-id">{props.clienteIdInicial}</span>
      <span data-testid="faturar-ajudas-valor">{props.ajudasValorInicial}</span>
      <span data-testid="faturar-periodo">{props.periodoInicial}</span>
    </div>
  ),
}));

vi.mock('../../src/utils/authFetch.js', () => ({ authFetch: vi.fn() }));

import AjudasCustoAdmin from '../../src/features/admin/AjudasCustoAdmin.jsx';
import { authFetch } from '../../src/utils/authFetch.js';

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/admin/ajudas-custo?subtab=estimativa']}>
      <AjudasCustoAdmin />
    </MemoryRouter>
  );
}

// `simular` agora faz fetch (rede) + cálculo + upsert no mesmo clique — o
// upsertCalls.push já não é síncrono em relação ao fireEvent.click (há
// várias voltas de microtask até lá: authFetch, .json(), leitura de
// clients/percentagem). Usado só onde é preciso esperar a segunda chamada
// terminar sem depender de o texto do ecrã mudar (que pode ficar igual
// entre duas simulações idênticas).
async function flush() {
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
  });
}

function respostaToconline(itens) {
  return {
    ok: true,
    json: async () => ({ data: itens, meta: { total_pages: 1 } }),
  };
}

beforeEach(() => {
  upsertCalls.length = 0;
  LOGS.length = 0;
  authFetch.mockReset();
  authFetch.mockResolvedValue(respostaToconline([
    {
      id: 'toc-1',
      attributes: {
        document_type_name: 'FT',
        document_number: 'FT 2026/100',
        gross_total: 1000,
        customer_business_name: 'CLIENTE ELEGIVEL LDA',
        date: '2026-08-05',
      },
    },
  ]));
});

describe('EstimativaMensalTab — Fase 2a com faturas reais do TOConline', () => {
  it('não chama o TOConline sozinho ao montar — só depois de clicar em "Simular"', async () => {
    renderTab();
    await screen.findByText(/Clica em "Simular"/i);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('"Simular" busca faturas via /api/toconline/relatorio e mostra o fatura_id real na pré-visualização', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
    await screen.findByText('FT 2026/100');

    expect(authFetch).toHaveBeenCalled();
    const url = authFetch.mock.calls[0][0];
    expect(url).toContain('tipo=vendas');
  });

  it('"Simular" grava em ajudas_estimativas_fatura com fatura_id preenchido, status nunca faturado, e mes = mês de referência (não o mês da fatura)', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
    // setResultado (que já mostra o fatura_id na tabela) acontece ANTES do
    // upsert — espera a confirmação de gravação, não só o texto da tabela,
    // para garantir que upsertCalls já reflete a chamada.
    await screen.findByText(/gravada/i);

    expect(upsertCalls.length).toBe(1);
    const { table, rows } = upsertCalls[0];
    expect(table).toBe('ajudas_estimativas_fatura');
    expect(rows.length).toBeGreaterThan(0);

    const dataDeParam = new URL(authFetch.mock.calls[0][0], 'http://localhost').searchParams.get('data_de');
    const mesFaturaUsado = dataDeParam.slice(0, 7);

    for (const l of rows) {
      expect(l.fatura_id).toBeTruthy();
      expect(['calculado', 'bloqueado']).toContain(l.status);
      expect(l.status).not.toBe('faturado');
      // mes gravado é o mês de referência — a fatura real está um mês à frente.
      expect(mesSeguinte(l.mes)).toBe(mesFaturaUsado);
    }

    const linhaCliente = rows.find(l => l.client_id === 'c1');
    expect(linhaCliente).toBeTruthy();
    expect(linhaCliente.fatura_id).toBe('FT 2026/100');
    expect(linhaCliente.status).toBe('calculado');
    expect(linhaCliente.valor_fatura).toBe(1000); // valor total da fatura real, não só a ajuda de custo
  });

  it('cliente sem decisão de elegibilidade → linha bloqueada, gravada com status=bloqueado e motivo preenchido (fail-closed)', async () => {
    authFetch.mockResolvedValue(respostaToconline([
      {
        id: 'toc-2',
        attributes: {
          document_type_name: 'FT',
          document_number: 'FT 2026/200',
          gross_total: 500,
          customer_business_name: 'CLIENTE POR DECIDIR LDA',
          date: '2026-08-06',
        },
      },
    ]));

    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
    await screen.findByText(/gravada/i);

    // Texto exato do badge de estado (o banner de topo também menciona a
    // palavra "bloqueado", em minúsculas, dentro de <code> — por isso não
    // se usa aqui um regex case-insensitive, que apanharia os dois).
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();

    expect(upsertCalls.length).toBe(1);
    const linha = upsertCalls[0].rows.find(l => l.client_id === 'c2');
    expect(linha).toBeTruthy();
    expect(linha.status).toBe('bloqueado');
    expect(linha.motivo_bloqueio).toBeTruthy();
    expect(linha.fatura_id).toBe('FT 2026/200');
  });

  it('correr Simular duas vezes para o mesmo mês faz upsert (substitui), não duplica nem falha', async () => {
    renderTab();
    const botao = screen.getByRole('button', { name: /Simular/i });

    fireEvent.click(botao);
    await screen.findByText(/gravada/i);
    expect(upsertCalls.length).toBe(1);

    fireEvent.click(botao);
    await flush();
    expect(upsertCalls.length).toBe(2);

    // Mesma chave lógica (mes, client_id, fatura_id) nas duas chamadas —
    // onConflict garante substituição em vez de erro de índice único.
    expect(upsertCalls[0].rows[0].fatura_id).toBe(upsertCalls[1].rows[0].fatura_id);
    expect(upsertCalls[0].rows[0].mes).toBe(upsertCalls[1].rows[0].mes);
  });

  // Pedido explícito: uma fatura sem cliente correspondente não deve ser só
  // excluída em silêncio — deve poder ser resolvida ali mesmo (mesmo
  // padrão do painel "Cliente não identificado automaticamente" do
  // FaturarClienteModal.jsx).
  describe('resolução manual de fatura sem cliente correspondente', () => {
    beforeEach(() => {
      authFetch.mockResolvedValue(respostaToconline([
        {
          id: 'toc-3',
          attributes: {
            document_type_name: 'FT',
            document_number: 'FT 2026/300',
            gross_total: 700,
            customer_business_name: 'NOME QUE NAO BATE COM NENHUM CLIENTE',
            date: '2026-08-07',
          },
        },
      ]));
    });

    it('mostra um painel de resolução em vez de só excluir, e não entra no cálculo enquanto pendente', async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
      await screen.findByText(/NOME QUE NAO BATE/i);

      expect(screen.getByText(/Faturas sem cliente correspondente/i)).toBeInTheDocument();
      expect(upsertCalls.length).toBe(0); // nada calculado ainda, nada para gravar
    });

    it('"Confirmar correspondência" associa a um cliente escolhido e reprocessa sem chamar o TOConline outra vez', async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
      await screen.findByText(/NOME QUE NAO BATE/i);
      const chamadasToConlineAntes = authFetch.mock.calls.length;

      // Há dois <select> no ecrã (o seletor de mês e o de resolução) — o de
      // resolução é o último.
      const combos = screen.getAllByRole('combobox');
      const select = combos[combos.length - 1];
      fireEvent.change(select, { target: { value: 'c1' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirmar correspondência/i }));

      await screen.findByText(/gravada/i);

      expect(authFetch.mock.calls.length).toBe(chamadasToConlineAntes); // não voltou a chamar o TOConline
      expect(screen.queryByText(/Faturas sem cliente correspondente/i)).not.toBeInTheDocument();

      const linha = upsertCalls[upsertCalls.length - 1].rows.find(l => l.fatura_id === 'FT 2026/300');
      expect(linha).toBeTruthy();
      expect(linha.client_id).toBe('c1');
      expect(linha.status).toBe('calculado');
    });

    it('"Não corresponde a nenhum cliente" confirma a ausência de correspondência e tira o aviso, sem entrar no cálculo', async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
      await screen.findByText(/NOME QUE NAO BATE/i);

      fireEvent.click(screen.getByRole('button', { name: /Não corresponde a nenhum cliente/i }));

      // Sem linhas calculadas nem gravadas: a única fatura do mês ficou
      // confirmada como sem correspondência.
      await screen.findByText('Nenhuma fatura de receita neste mês.');
      expect(screen.queryByText(/Faturas sem cliente correspondente/i)).not.toBeInTheDocument();
      expect(upsertCalls.length).toBe(0);
    });
  });

  // Pedido explícito: clientes com horas lançadas no mês mas ainda sem
  // fatura nenhuma devem aparecer (não só as faturas já emitidas), com
  // possibilidade de criar a fatura a partir daqui, usando a estimativa de
  // ajuda de custo já calculada.
  describe('clientes ainda por faturar (sem fatura real)', () => {
    beforeEach(() => {
      authFetch.mockResolvedValue(respostaToconline([])); // nenhuma fatura real emitida este mês
      const mesAtual = new Date().toISOString().slice(0, 7);
      LOGS.push({ workerId: 'w1', clientId: 'c3', date: `${mesAtual}-05`, hours: 8 });
    });

    it('mostra o cliente com horas mas sem fatura, marcado como "ainda por faturar", e não grava nada em ajudas_estimativas_fatura para ele', async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
      await screen.findByText('CLIENTE AINDA POR FATURAR LDA');

      expect(screen.getByText('ainda por faturar')).toBeInTheDocument();
      // Nenhuma fatura real neste mês → nada com fatura_id para gravar.
      expect(upsertCalls.length).toBe(0);
    });

    it('botão "Criar Fatura" abre o FaturarClienteModal com o cliente, período e estimativa de ajudas corretos', async () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: /Simular/i }));
      await screen.findByText('CLIENTE AINDA POR FATURAR LDA');

      fireEvent.click(screen.getByRole('button', { name: /Criar Fatura/i }));

      const modal = await screen.findByTestId('faturar-cliente-modal');
      expect(modal).toBeInTheDocument();
      expect(screen.getByTestId('faturar-cliente-id')).toHaveTextContent('c3');
      const mesAtual = new Date().toISOString().slice(0, 7);
      expect(screen.getByTestId('faturar-periodo')).toHaveTextContent(mesAtual);
      // 25€/h × 8h = 200€ de faturamento; % ativa de 50% (mock) dá bruto de
      // 100€, mas sem nenhum registo em ajudas_reconciliacao_mensal o saldo
      // acumulado usa a semente SALDO_ACUMULADO_INICIAL (-7155,94€,
      // reconciliacao.js) como restrição — reduz a estimativa do mês para
      // 0 (nunca fica negativa). O valor passado ao modal é sempre este
      // mesmo valorFinal já calculado, nunca um valor à parte.
      expect(screen.getByTestId('faturar-ajudas-valor')).toHaveTextContent('0');
    });
  });
});
