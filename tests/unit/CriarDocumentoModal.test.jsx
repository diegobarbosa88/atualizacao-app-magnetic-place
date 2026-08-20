import { describe, it, expect } from 'vitest';
import { encontrarClienteElegivelParaRedirecionar } from '../../src/features/admin/toconline/CriarDocumentoModal.jsx';

// Fecho da fuga do CriarDocumentoModal.jsx (Opção B): cliente elegível para
// ajudas de custo + tipo de documento de receita nova (TOCONLINE_TIPOS_RECEITA)
// deve ser redirecionado para o FaturarClienteModal.jsx (gated) em vez de
// passar livremente por aqui.
//
// A lógica de decisão foi extraída para a função pura
// encontrarClienteElegivelParaRedirecionar (usada pelo useEffect do
// componente) precisamente para poder ser testada sem depender da UI de
// pesquisa do AutocompleteCliente — cujo <input type="text"> teria de passar
// por fireEvent.change, que não desencadeia onChange em inputs controlados
// neste ambiente de testes (ver nota em FaturarClienteModal.test.jsx).

const CLIENTS = [
  { id: 'c1', name: 'CLIENTE ELEGIVEL LDA', nif: '111111111', elegivel_ajudas_custo: true },
  { id: 'c2', name: 'CLIENTE NAO ELEGIVEL LDA', nif: '222222222', elegivel_ajudas_custo: false },
];

describe('encontrarClienteElegivelParaRedirecionar', () => {
  it('cliente elegível + tipo FT → redireciona (devolve o id do cliente)', () => {
    const clienteSelecionado = { id: 'toc-1', nome: 'Cliente Elegivel Lda', nif: '111111111' };
    const resultado = encontrarClienteElegivelParaRedirecionar(clienteSelecionado, 'FT', CLIENTS);
    expect(resultado).toBe('c1');
  });

  it('cliente elegível + tipo NC (ajuste, não gera receita nova) → continua normalmente (null)', () => {
    const clienteSelecionado = { id: 'toc-1', nome: 'Cliente Elegivel Lda', nif: '111111111' };
    const resultado = encontrarClienteElegivelParaRedirecionar(clienteSelecionado, 'NC', CLIENTS);
    expect(resultado).toBeNull();
  });

  it('cliente não elegível + tipo FT → continua normalmente (null)', () => {
    const clienteSelecionado = { id: 'toc-2', nome: 'Cliente Nao Elegivel Lda', nif: '222222222' };
    const resultado = encontrarClienteElegivelParaRedirecionar(clienteSelecionado, 'FT', CLIENTS);
    expect(resultado).toBeNull();
  });

  it('cliente que não existe em clients (pesquisa livre TOConline) + tipo FT → continua normalmente (null)', () => {
    const clienteSelecionado = { id: 'toc-3', nome: 'Empresa Desconhecida Lda', nif: '999999999' };
    const resultado = encontrarClienteElegivelParaRedirecionar(clienteSelecionado, 'FT', CLIENTS);
    expect(resultado).toBeNull();
  });

  it('nenhum cliente selecionado → null (sem efeito)', () => {
    expect(encontrarClienteElegivelParaRedirecionar(null, 'FT', CLIENTS)).toBeNull();
  });

  it('outros tipos de receita nova (FR, FS, FRS, VD) também redirecionam quando elegível', () => {
    const clienteSelecionado = { id: 'toc-1', nome: 'Cliente Elegivel Lda', nif: '111111111' };
    for (const tipo of ['FR', 'FS', 'FRS', 'VD']) {
      expect(encontrarClienteElegivelParaRedirecionar(clienteSelecionado, tipo, CLIENTS)).toBe('c1');
    }
  });

  it('outros tipos de ajuste (ND, GT, ORC) não redirecionam mesmo com cliente elegível', () => {
    const clienteSelecionado = { id: 'toc-1', nome: 'Cliente Elegivel Lda', nif: '111111111' };
    for (const tipo of ['ND', 'GT', 'ORC']) {
      expect(encontrarClienteElegivelParaRedirecionar(clienteSelecionado, tipo, CLIENTS)).toBeNull();
    }
  });

  it('fallback por nome normalizado quando o NIF não bate (cliente sem NIF na pesquisa TOConline)', () => {
    const clienteSelecionado = { id: 'toc-1', nome: '  cliente elegivel lda  ', nif: '' };
    const resultado = encontrarClienteElegivelParaRedirecionar(clienteSelecionado, 'FT', CLIENTS);
    expect(resultado).toBe('c1');
  });
});
