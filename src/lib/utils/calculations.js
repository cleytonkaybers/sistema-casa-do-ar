/**
 * Calcula comissões de técnicos
 */
export const calcularComissoes = (valorTotal, percentualEquipe = 30, percentualTecnico = 15) => {
  const comissaoEquipe = valorTotal * (percentualEquipe / 100);
  const comissaoTecnico = valorTotal * (percentualTecnico / 100);
  
  return {
    valorTotal,
    percentualEquipe,
    percentualTecnico,
    comissaoEquipe,
    comissaoTecnico,
  };
};

/**
 * Calcula total de comissões por período
 */
export const calcularTotalComissoes = (lancamentos = []) => {
  return lancamentos.reduce((acc, lanc) => {
    acc.total += lanc.valor_comissao_tecnico || 0;
    acc.pendente += lanc.status === 'pendente' ? lanc.valor_comissao_tecnico || 0 : 0;
    acc.pago += lanc.status === 'pago' ? lanc.valor_comissao_tecnico || 0 : 0;
    return acc;
  }, { total: 0, pendente: 0, pago: 0 });
};

/**
 * Agrupa lançamentos por período
 */
export const agruparPorPeriodo = (lancamentos = [], campoData = 'data_geracao') => {
  const grupos = {};
  
  lancamentos.forEach(lanc => {
    if (!lanc[campoData]) return;
    const mes = lanc[campoData].substring(0, 7); // YYYY-MM
    if (!grupos[mes]) grupos[mes] = [];
    grupos[mes].push(lanc);
  });
  
  return grupos;
};