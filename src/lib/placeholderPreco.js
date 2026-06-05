// Helper centralizado para detectar valor placeholder de "aguardando precificacao".
// Sao 3 valores reconhecidos por compatibilidade:
// - 1111  = atual (R$1.111)
// - 5.55  = transicao antiga
// - <=1.0 = legado original (R$1, R$0,50, etc)
//
// Usado em:
// - PagamentosClientes.jsx (badge, sort, filtros de Semana/Pendencias)
// - Dashboard.jsx (counter de precificacao pendente)

export const isValorPlaceholder = (v) => {
  // Sem preço (0/null/undefined) = aguardando precificação (novo padrão).
  if (v == null || v <= 0) return true;
  // Legados ainda reconhecidos por compatibilidade (registros antigos no banco).
  return v === 1111 || Math.abs(v - 5.55) < 0.01 || v <= 1.0;
};

// Para registros agregados (grupos com _records[]):
// true se QUALQUER record do grupo for placeholder sem pagamento.
// Cobre o caso "mixed group" (1 placeholder + 1 pago no mesmo cliente).
export const grupoTemPlaceholder = (grupo) => {
  if (!grupo) return false;
  const records = grupo._records?.length > 0 ? grupo._records : [grupo];
  return records.some(r => isValorPlaceholder(r.valor_total) && (r.valor_pago || 0) === 0);
};
