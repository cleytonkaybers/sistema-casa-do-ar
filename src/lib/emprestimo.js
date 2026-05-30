import { differenceInDays, parseISO, isValid } from 'date-fns';

// Fonte ÚNICA de cálculo de empréstimos (Cheques / Dinheiro Emprestado).
//
// REGRA DO NEGÓCIO: juros SIMPLES sobre o SALDO DEVEDOR que ainda resta — não
// sobre o valor emprestado original. Conforme o cliente amortiza, o saldo cai e
// o juros dos dias seguintes incide sobre esse saldo menor.
//
// Mecânica de cada pagamento: quita primeiro o juros acumulado até a data do
// pagamento e o resto abate o saldo (principal). A partir daí o juros passa a
// correr sobre o saldo reduzido.
//
// Ex.: R$ 1.000 a 10% a.m. → paga R$ 600 no 1º mês (R$ 100 juros + R$ 500 abate)
//      → resta R$ 500 → 2º mês juros = 10% de 500 = R$ 50 (não mais R$ 100).
//
// Retorna a simulação: cada pagamento detalhado (juros/capital), saldo final de
// principal, juros pago, juros devido, juros total e débito total.
export function simularEmprestimo(emprestimo) {
  const fallback = (v) => ({
    pagamentos: [],
    principalRestante: v || 0,
    principalPagoTotal: 0,
    jurosPagoTotal: 0,
    jurosDevidoTotal: 0,
    jurosAcumulados: 0,
    debitoTotal: v || 0,
  });
  const { valor_principal, percentual_mes, data_emprestimo } = emprestimo || {};
  if (!valor_principal || !data_emprestimo) return fallback(valor_principal);
  const inicio = parseISO(data_emprestimo);
  if (!isValid(inicio)) return fallback(valor_principal);

  const taxaDiaria = (percentual_mes || 0) / 100 / 30;
  const totalAbatido = emprestimo.total_abatido || 0;

  // ---- Monta a lista cronológica de eventos (pagamentos/quitação) ----
  const eventosReais = (emprestimo.historico_pagamentos || [])
    .filter(h => h.tipo === 'abatimento' || h.tipo === 'quitacao')
    .map(h => ({ ...h, _real: true }))
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  // Se o total_abatido (autoridade) diverge da soma de eventos, insere evento
  // virtual representando o pagamento legado sem data registrada.
  const somaEventos = eventosReais.reduce((s, e) => s + (e.valor || 0), 0);
  const deltaLegado = totalAbatido - somaEventos;
  const todosEventos = [...eventosReais];
  if (deltaLegado > 0.01) {
    const agora = new Date();
    const meioMs = inicio.getTime() + (agora.getTime() - inicio.getTime()) / 2;
    todosEventos.push({
      data: new Date(meioMs).toISOString(),
      valor: deltaLegado,
      tipo: 'abatimento',
      observacao: '[Pagamento sem data registrada — exibido no meio do período]',
      _legacy: true,
    });
    todosEventos.sort((a, b) => new Date(a.data) - new Date(b.data));
  }

  // ---- Simulação período a período sobre o SALDO DEVEDOR vigente ----
  // A cada pagamento: gera o juros do período (saldo vigente × taxa × dias),
  // quita o juros pendente primeiro e abate o saldo com a sobra. Os juros dos
  // próximos períodos incidem sobre o saldo já reduzido.
  let saldo = valor_principal;       // saldo de principal vigente
  let jurosPendente = 0;             // juros gerado e ainda NÃO pago
  let jurosAcumulados = 0;           // soma de todo juros gerado (pago + devido)
  let jurosPagoTotal = 0;
  let principalPagoTotal = 0;
  let dataUltima = inicio;

  const pagamentos = todosEventos.map(p => {
    const dataP = new Date(p.data);
    const dias = Math.max(0, differenceInDays(dataP, dataUltima));
    // Juros do período sobre o saldo vigente (antes deste pagamento)
    const jurosPeriodo = saldo * taxaDiaria * dias;
    jurosPendente += jurosPeriodo;
    jurosAcumulados += jurosPeriodo;

    const valor = p.valor || 0;
    const partJuros = Math.min(valor, jurosPendente);
    const partCapital = Math.max(0, valor - partJuros);
    jurosPendente -= partJuros;
    jurosPagoTotal += partJuros;
    saldo = Math.max(0, saldo - partCapital);
    principalPagoTotal += partCapital;
    dataUltima = dataP;

    return {
      ...p,
      partJuros,
      partCapital,
      diasDesdeUltimo: dias,
      principalApos: saldo,
      jurosPendenteApos: jurosPendente,
    };
  });

  // ---- Período final: do último evento até hoje, sobre o saldo que sobrou ----
  const diasFinal = Math.max(0, differenceInDays(new Date(), dataUltima));
  const jurosFinal = saldo * taxaDiaria * diasFinal;
  jurosPendente += jurosFinal;
  jurosAcumulados += jurosFinal;

  const principalRestante = saldo;
  const jurosDevidoTotal = jurosPendente;
  const debitoTotal = principalRestante + jurosDevidoTotal;

  return {
    pagamentos,
    principalRestante,
    principalPagoTotal,
    jurosPagoTotal,
    jurosDevidoTotal,
    jurosAcumulados,
    debitoTotal,
  };
}

// Wrappers para compatibilidade — todos derivam da simulação cronológica.
export function calcularDebitoAtual(emprestimo) {
  return simularEmprestimo(emprestimo).debitoTotal;
}

export function calcularJurosAcumulados(emprestimo) {
  return simularEmprestimo(emprestimo).jurosAcumulados;
}

export function calcularJurosBreakdown(emprestimo) {
  const sim = simularEmprestimo(emprestimo);
  return {
    jurosAcumulados: sim.jurosAcumulados,
    jurosPago: sim.jurosPagoTotal,
    jurosDevido: sim.jurosDevidoTotal,
    principalPago: sim.principalPagoTotal,
    principalDevido: sim.principalRestante,
  };
}

// Retorna só a lista de pagamentos com breakdown (juros/capital), para o modal
// de Detalhes. Toda a lógica está em simularEmprestimo.
export function detalharPagamentos(emprestimo) {
  return simularEmprestimo(emprestimo).pagamentos;
}
