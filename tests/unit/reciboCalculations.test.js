import { describe, it, expect } from 'vitest';
import { calcularRecibo } from '../../src/lib/payroll/reciboCalculations.js';

// ─────────────────────────────────────────────────────────────
// Invariante base: totalAbonos = brutoAlvo e liquido = brutoAlvo − IRS − SS
// ─────────────────────────────────────────────────────────────

describe('calcularRecibo — invariantes fundamentais', () => {
  it('mês completo normal: totalAbonos = brutoAlvo', () => {
    const r = calcularRecibo({
      vencimentoBase: 1000, brutoAlvo: 3000, incluirFerias: true, incluirNatal: true,
      tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.totalAbonos).toBeCloseTo(3000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('mês completo sem duodécimos: totalAbonos = brutoAlvo', () => {
    const r = calcularRecibo({
      vencimentoBase: 1200, brutoAlvo: 2500, incluirFerias: false, incluirNatal: false,
      tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.totalAbonos).toBeCloseTo(2500, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });
});

// ─────────────────────────────────────────────────────────────
// vencBaseContratual — A004/A021 usam vencimento contratual (não proporcional)
// ─────────────────────────────────────────────────────────────

describe('calcularRecibo — vencBaseContratual', () => {
  it('mês parcial admissão IDEMILTON (560/1200): A004 e A021 = 1200/12 = 100€', () => {
    const r = calcularRecibo({
      vencimentoBase: 560,          // proporcional (1200 × 14/30)
      vencBaseContratual: 1200,     // contratual
      incluirFerias: true, incluirNatal: true,
      brutoAlvo: 2000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.subsFerias).toBeCloseTo(100, 2);
    expect(r.subsNatal).toBeCloseTo(100, 2);
    expect(r.totalAbonos).toBeCloseTo(2000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('mês parcial cessação Antonio Augusto Lima (866.67/1000): A004 e A021 = 1000/12 = 83.33€', () => {
    const r = calcularRecibo({
      vencimentoBase: 866.67,       // proporcional (1000 × 26/30)
      vencBaseContratual: 1000,     // contratual
      incluirFerias: true, incluirNatal: true,
      brutoAlvo: 4000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.subsFerias).toBeCloseTo(83.33, 1);
    expect(r.subsNatal).toBeCloseTo(83.33, 1);
    expect(r.totalAbonos).toBeCloseTo(4000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('sem vencBaseContratual — comportamento original mantido (retrocompatibilidade)', () => {
    const rSem = calcularRecibo({ vencimentoBase: 1000, brutoAlvo: 3000, incluirFerias: true, incluirNatal: true, ano: 2026 });
    const rCom = calcularRecibo({ vencimentoBase: 1000, vencBaseContratual: 1000, brutoAlvo: 3000, incluirFerias: true, incluirNatal: true, ano: 2026 });
    expect(rSem.subsFerias).toBeCloseTo(rCom.subsFerias, 5);
    expect(rSem.totalAbonos).toBeCloseTo(rCom.totalAbonos, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// abonosCessacao — reduz A082, aumenta IRS/SS, totalAbonos = brutoAlvo
// ─────────────────────────────────────────────────────────────

describe('calcularRecibo — abonosCessacao', () => {
  // Antonio Augusto Lima — cessação 26 Junho, vencBase 1000€
  // diasFeriasNaoGozadas = parseInt(32.76) = 32
  // A010 = A011 = 32 × 1000/30 = 1066.67€
  // abonosCessacao = 2133.34€
  it('caso Antonio Augusto Lima — A010+A011 reduzem A082, totalAbonos = brutoAlvo', () => {
    const feriasNGEur = parseFloat((32 * 1000 / 30).toFixed(2));  // 1066.67
    const r = calcularRecibo({
      vencimentoBase: 866.67,
      vencBaseContratual: 1000,
      abonosCessacao: feriasNGEur * 2,  // A010 + A011
      incluirFerias: true,
      incluirNatal: true,
      brutoAlvo: 5000,
      tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    // A004 / A021 usam vencimento contratual
    expect(r.subsFerias).toBeCloseTo(83.33, 1);
    expect(r.subsNatal).toBeCloseTo(83.33, 1);
    // totalAbonos = brutoAlvo (A082 absrove a diferença)
    expect(r.totalAbonos).toBeCloseTo(5000, 2);
    // abonosCessacao incluídos na base IRS
    expect(r.incidenciaRegular).toBeCloseTo(866.67 + feriasNGEur * 2, 1);
    // Liquido = brutoAlvo − IRS − SS
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('abonosCessacao = 0 (padrão): equivalente a não passar o parâmetro', () => {
    const r1 = calcularRecibo({ vencimentoBase: 1000, brutoAlvo: 3000, ano: 2026 });
    const r2 = calcularRecibo({ vencimentoBase: 1000, abonosCessacao: 0, brutoAlvo: 3000, ano: 2026 });
    expect(r1.totalAbonos).toBeCloseTo(r2.totalAbonos, 5);
    expect(r1.liquido).toBeCloseTo(r2.liquido, 5);
  });

  it('quando abonosCessacao > (brutoAlvo − venc − outros): A082 = 0, totalAbonos ≥ brutoAlvo', () => {
    const r = calcularRecibo({
      vencimentoBase: 866.67, vencBaseContratual: 1000,
      abonosCessacao: 4000,  // muito grande
      brutoAlvo: 2000, ano: 2026,
    });
    expect(r.ajudaCustoNecessaria).toBe(0);
    expect(r.totalAbonos).toBeGreaterThanOrEqual(2000);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });
});

// ─────────────────────────────────────────────────────────────
// Regressão: A011 ausente quando duodécimos de sub. férias ativos
// ─────────────────────────────────────────────────────────────

describe('calcularRecibo — A011 com duodécimos activos (Antonio Augusto Lima)', () => {
  // Cenário: cessação 26 Junho, vencBase 1000€, diasFeriasNaoGozadas = 32
  // Com duodécimos ativos: abonosCessacao = A010 APENAS (sem A011)
  const feriasNG = parseFloat((32 * 1000 / 30).toFixed(2)); // 1066.67

  it('duodécimos ATIVOS — abonosCessacao inclui só A010 (não A011)', () => {
    const rComA011 = calcularRecibo({
      vencimentoBase: 866.67, vencBaseContratual: 1000,
      abonosCessacao: feriasNG * 2, // incorreto: A010 + A011
      incluirFerias: true, incluirNatal: true,
      brutoAlvo: 5000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    const rSemA011 = calcularRecibo({
      vencimentoBase: 866.67, vencBaseContratual: 1000,
      abonosCessacao: feriasNG, // correto: só A010
      incluirFerias: true, incluirNatal: true,
      brutoAlvo: 5000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    // Sem A011 → A082 é maior (pela diferença de feriasNG)
    expect(rSemA011.ajudaCustoNecessaria).toBeCloseTo(rComA011.ajudaCustoNecessaria + feriasNG, 1);
    // Total Abonos = brutoAlvo em ambos os casos
    expect(rSemA011.totalAbonos).toBeCloseTo(5000, 2);
    expect(rComA011.totalAbonos).toBeCloseTo(5000, 2);
  });

  it('duodécimos ATIVOS — totalAbonos = brutoAlvo sem A011, liquido = brutoAlvo − IRS − SS', () => {
    const r = calcularRecibo({
      vencimentoBase: 866.67, vencBaseContratual: 1000,
      abonosCessacao: feriasNG, // só A010
      incluirFerias: true, incluirNatal: true,
      brutoAlvo: 5000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.totalAbonos).toBeCloseTo(5000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });

  it('duodécimos NÃO ATIVOS — abonosCessacao inclui A010 + A011 (2×feriasNG)', () => {
    const r = calcularRecibo({
      vencimentoBase: 866.67, vencBaseContratual: 1000,
      abonosCessacao: feriasNG * 2, // A010 + A011
      incluirFerias: false, incluirNatal: false,
      brutoAlvo: 5000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
    });
    expect(r.totalAbonos).toBeCloseTo(5000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
    // Sem duodécimos (subsFerias=0, subsNatal=0): A082 = 5000 − 866.67 − 2×feriasNG
    expect(r.ajudaCustoNecessaria).toBeCloseTo(5000 - 866.67 - feriasNG * 2, 1);
  });
});

// ─────────────────────────────────────────────────────────────
// A010 — tratamento fiscal: taxa IRS regular (não taxaSubsidios), SS sempre incluído
// Regressão: Antonio Augusto Lima — Férias Não Gozadas = 500€
// ─────────────────────────────────────────────────────────────

describe('calcularRecibo — A010 fiscal: base IRS regular e SS (Antonio Augusto Lima)', () => {
  // cessação 26 Jun, vencBase 1000€, proporcional 866.67€, duodécimos ativos
  // abonosCessacao = 500€ (A010 apenas)
  const feriasNG = 500;
  const base = {
    vencimentoBase: 866.67, vencBaseContratual: 1000,
    abonosCessacao: feriasNG,
    incluirFerias: true, incluirNatal: true,
    brutoAlvo: 5000, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
  };

  it('A010 entra em incidenciaRegular — base IRS à taxa regular', () => {
    const r = calcularRecibo(base);
    // incidenciaRegular = vencProporcional + abonosCessacao (A010)
    expect(r.incidenciaRegular).toBeCloseTo(866.67 + feriasNG, 1);
  });

  it('A010 entra em incidenciaSS — base Segurança Social', () => {
    const r = calcularRecibo(base);
    // incidenciaSS = incidenciaRegular + subsFerias + subsNatal (+ overtime=0)
    // = (866.67 + 500) + 83.33 + 83.33 = 1533.33
    expect(r.incidenciaSS).toBeCloseTo(r.incidenciaRegular + r.subsFerias + r.subsNatal, 2);
    expect(r.incidenciaSS).toBeCloseTo(866.67 + feriasNG + 83.33 + 83.33, 1);
  });

  it('irsFerias e irsNatal NÃO incluem A010 — usam taxaSubsidios sobre vencBaseContratual', () => {
    const rSem = calcularRecibo({ ...base, abonosCessacao: 0 });
    const rCom = calcularRecibo(base);
    // taxaSubsidios depende apenas de vencBaseContratual (1000€), não de abonosCessacao
    expect(rCom.taxaSubsidios).toBeCloseTo(rSem.taxaSubsidios, 5);
    expect(rCom.irsFerias).toBeCloseTo(rSem.irsFerias, 4);
    expect(rCom.irsNatal).toBeCloseTo(rSem.irsNatal, 4);
    // Mas irsRegular é maior porque A010 está em incidenciaRegular
    expect(rCom.irsRegular).toBeGreaterThan(rSem.irsRegular);
  });

  it('totalAbonos = brutoAlvo e liquido = brutoAlvo − IRS − SS', () => {
    const r = calcularRecibo(base);
    expect(r.totalAbonos).toBeCloseTo(5000, 2);
    expect(r.liquido).toBeCloseTo(r.totalAbonos - r.irsTotal - r.ssTrabalhador, 2);
  });
});

// ─────────────────────────────────────────────────────────────
// D001 — linha informativa: NUNCA entra em Total Descontos
//
// Invariantes obrigatórios (com ou sem D001):
//   Total Abonos (display) = Bruto Alvo
//   Total Descontos        = IRS + SS apenas
//   Líquido                = Bruto Alvo − IRS − SS
// ─────────────────────────────────────────────────────────────

describe('D001 — linha puramente informativa (nunca em Total Descontos)', () => {

  // ── CESSAÇÃO: Antonio Augusto Lima ───────────────────────────
  // vencBase 1000€, cessação 26 Jun → 4 dias não trab → D001 = 4×1000/30 = 133,33€
  // vencProporcional = 866,67€ | abonosCessacao = A010 (32 dias × 1000/30 = 1066,67€)
  describe('cessação — Antonio Augusto Lima (D001 = 133,33€)', () => {
    const brutoAlvo        = 5000;
    const vencContratual   = 1000;
    const diasTrab         = 26;
    const diasNaoTrab      = 30 - diasTrab;                                               // 4
    const vencProporcional = parseFloat((diasTrab    * vencContratual / 30).toFixed(2));  // 866.67
    const descontoD001     = parseFloat((diasNaoTrab * vencContratual / 30).toFixed(2));  // 133.33
    const feriasNG         = parseFloat((32          * vencContratual / 30).toFixed(2));  // 1066.67

    let r;
    beforeEach(() => {
      r = calcularRecibo({
        vencimentoBase:     vencProporcional,
        vencBaseContratual: vencContratual,
        abonosCessacao:     feriasNG,       // A010 apenas (duodécimos ativos)
        incluirFerias: true, incluirNatal: true,
        brutoAlvo, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
      });
    });

    it('Total Abonos = Bruto Alvo (D001 não altera)', () => {
      expect(r.totalAbonos).toBeCloseTo(brutoAlvo, 2);
    });

    it('Total Descontos = IRS + SS apenas — D001 (133,33€) NUNCA entra', () => {
      expect(r.totalDescontos).toBeCloseTo(r.irsTotal + r.ssTrabalhador, 2);
      expect(r.totalDescontos).not.toBeCloseTo(r.irsTotal + r.ssTrabalhador + descontoD001, 1);
    });

    it('Líquido = Bruto Alvo − IRS − SS (D001 não afeta o líquido)', () => {
      expect(r.liquido).toBeCloseTo(brutoAlvo - r.irsTotal - r.ssTrabalhador, 2);
    });

    it('soma visual das linhas de abono = Bruto Alvo', () => {
      // A082 display = r.ajudaCustoNecessaria − D001 (A082 absorve a diferença)
      const ajudasDisplayRecibo = Math.max(0, r.ajudaCustoNecessaria - descontoD001);
      // Soma visual: A001 (contratual) + A010 + A004 + A021 + A082(display)
      const somaVisualAbonos = vencContratual + feriasNG + r.subsFerias + r.subsNatal + ajudasDisplayRecibo;
      expect(somaVisualAbonos).toBeCloseTo(brutoAlvo, 1);
    });
  });

  // ── ADMISSÃO: IDEMILTON Maia de Brito Junior ─────────────────
  // vencBase 1200€, admissão 17 Mai → 16 dias não trab → D001 = 16×1200/30 = 640€
  // vencProporcional = 560€ (14 dias trab)
  describe('admissão — IDEMILTON (D001 = 640€)', () => {
    const brutoAlvo        = 3000;
    const vencContratual   = 1200;
    const diasTrab         = 14;
    const diasNaoTrab      = 30 - diasTrab;                                               // 16
    const vencProporcional = parseFloat((diasTrab    * vencContratual / 30).toFixed(2));  // 560.00
    const descontoD001     = parseFloat((diasNaoTrab * vencContratual / 30).toFixed(2));  // 640.00

    let r;
    beforeEach(() => {
      r = calcularRecibo({
        vencimentoBase:     vencProporcional,
        vencBaseContratual: vencContratual,
        incluirFerias: true, incluirNatal: true,
        brutoAlvo, tabelaKey: 'tabelaI', nDependentes: 0, ano: 2026,
      });
    });

    it('Total Abonos = Bruto Alvo (D001 não altera)', () => {
      expect(r.totalAbonos).toBeCloseTo(brutoAlvo, 2);
    });

    it('Total Descontos = IRS + SS apenas — D001 (640€) NUNCA entra', () => {
      expect(r.totalDescontos).toBeCloseTo(r.irsTotal + r.ssTrabalhador, 2);
      expect(r.totalDescontos).not.toBeCloseTo(r.irsTotal + r.ssTrabalhador + descontoD001, 1);
    });

    it('Líquido = Bruto Alvo − IRS − SS (D001 não afeta o líquido)', () => {
      expect(r.liquido).toBeCloseTo(brutoAlvo - r.irsTotal - r.ssTrabalhador, 2);
    });

    it('soma visual das linhas de abono = Bruto Alvo', () => {
      const ajudasDisplayRecibo = Math.max(0, r.ajudaCustoNecessaria - descontoD001);
      // Soma visual: A001 (contratual) + A004 + A021 + A082(display)
      const somaVisualAbonos = vencContratual + r.subsFerias + r.subsNatal + ajudasDisplayRecibo;
      expect(somaVisualAbonos).toBeCloseTo(brutoAlvo, 1);
    });
  });
});
