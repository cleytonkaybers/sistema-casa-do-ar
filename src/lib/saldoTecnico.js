// Data a partir da qual o saldo de um técnico passa a contar.
//
// Este corte já existia, mas estava copiado em 5 telas (Financeiro, Dashboard,
// Ganhos da Semana, Meu Financeiro e o modal de pagamento). Agora é um lugar
// só — qualquer mudança vale para todas, em vez de as telas discordarem entre
// si sobre quanto um técnico tem a receber.
export const SALDO_INICIO = new Date('2026-04-13T00:00:00');

// Início da contagem DESTE técnico.
//
// Quando o ADM zera o saldo de alguém (técnico que mudou de equipe, acerto
// fechado por fora, dívida perdoada), o que fica gravado é a DATA do zeramento
// — não um número. Comissões e pagamentos anteriores a ela deixam de entrar na
// conta dele, mas continuam no banco: o histórico da empresa não muda e o
// Relatório de Comissões segue mostrando tudo.
//
// É por isso que zerar não é o mesmo que apagar. Apagar reescreveria os
// números passados da empresa; zerar só move o ponto de partida dele.
export function inicioContagemDoTecnico(tecFin) {
  const bruto = tecFin?.saldo_zerado_em;
  if (!bruto) return SALDO_INICIO;
  const d = new Date(bruto);
  if (isNaN(d.getTime())) return SALDO_INICIO;
  // Nunca anda para trás do corte global.
  return d > SALDO_INICIO ? d : SALDO_INICIO;
}

// Um lançamento/pagamento entra na conta deste técnico?
export function contaParaOTecnico(data, inicioContagem) {
  if (!data) return false;
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return false;
  return d >= inicioContagem;
}
