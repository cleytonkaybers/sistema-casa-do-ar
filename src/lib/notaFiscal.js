// Decide o que aparece na fila "A emitir" e o que fica em "NF já gerada".
//
// A regra do dono: depois que a NF de um cliente foi gerada, ele NÃO pode
// voltar para a fila. Só volta se o cliente pagar MAIS alguma coisa.
//
// Duas coisas faziam um cliente voltar sozinho:
//
// 1. Registro duplicado do mesmo serviço. A tela listava um registro por
//    linha, sem agrupar. Existindo duas linhas do mesmo serviço — e neste
//    banco isso acontece — marcar uma deixava a outra na fila, com o mesmo
//    dinheiro. Foi o caso do TANAKA.
//
// 2. Pagamento parcelado. O valor pago do registro cresce quando o cliente
//    paga o restante, e a marcação antiga continuava valendo para um valor
//    que já não era o mesmo.
//
// Por isso a marcação passa a guardar QUANTO foi faturado (nf_gerada_valor).
// Comparar o pago de hoje com o faturado é o que distingue "dinheiro novo"
// (volta para a fila, e deve voltar) de "mesmo dinheiro de novo" (não volta).

const TOLERANCIA = 0.01;

// Agrupa pelo serviço. Dois registros do mesmo serviço são o MESMO dinheiro,
// mesmo tendo ids diferentes.
export function chaveServicoNF(p) {
  if (p?.servico_id) return `servico:${p.servico_id}`;
  if (p?.atendimento_id) return `atendimento:${p.atendimento_id}`;
  const nome = (p?.cliente_nome || '').trim().toLowerCase();
  const dia = (p?.data_conclusao || '').slice(0, 10);
  return `legado:${nome}|${dia}`;
}

// Quanto deste registro já foi coberto por nota.
//
// Marcado SEM valor registrado = nota emitida antes deste campo existir.
// Conta como cobrindo tudo, de propósito: são as notas que o dono já emitiu
// de verdade, e elas não podem voltar para a fila por causa da mudança.
export function valorJaFaturado(p) {
  if (p?.nf_gerada !== true) return 0;
  const v = Number(p?.nf_gerada_valor);
  return Number.isFinite(v) ? v : Infinity;
}

// Separa os pagamentos elegíveis nas duas abas.
//
// Função pura: errar aqui significa o dono emitir nota duas vezes para o
// mesmo dinheiro, ou deixar de emitir uma que devia.
export function classificarNotas(elegiveis) {
  // Maior valor já faturado em cada serviço. Usa o MAIOR, não a soma: dois
  // registros duplicados representam o mesmo dinheiro, e somar faria o app
  // achar que já se faturou o dobro.
  const faturadoPorServico = new Map();
  for (const p of elegiveis || []) {
    const k = chaveServicoNF(p);
    const coberto = valorJaFaturado(p);
    if (coberto > (faturadoPorServico.get(k) ?? 0)) faturadoPorServico.set(k, coberto);
  }

  const aEmitir = [];
  const emitidas = [];
  const ocultos = [];

  for (const p of elegiveis || []) {
    const pago = p?.valor_pago || 0;

    if (p?.nf_gerada === true) {
      // Já marcado: só volta para a fila se o cliente pagou mais do que o
      // que foi faturado naquela nota.
      if (pago > valorJaFaturado(p) + TOLERANCIA) aEmitir.push(p);
      else emitidas.push(p);
      continue;
    }

    // Não marcado: só entra na fila se houver dinheiro ainda não faturado
    // NESTE serviço. Senão é uma linha duplicada de dinheiro já faturado —
    // fica fora das duas abas para não sugerir emitir nota repetida nem
    // inflar a contagem do arquivo.
    const cobertoNoServico = faturadoPorServico.get(chaveServicoNF(p)) ?? 0;
    if (pago > cobertoNoServico + TOLERANCIA) aEmitir.push(p);
    else ocultos.push(p);
  }

  return { aEmitir, emitidas, ocultos };
}

// Valor desta nota, para somar no total do mês.
//
// Usa o incremento guardado na marcação. Sem ele (notas emitidas antes deste
// campo existir), cai no valor pago — que é exatamente o que a tela somava
// antes, então os meses já fechados não mudam de número.
//
// Isto evita contar duas vezes: num parcelado, a 1a nota cobre R$ 500 e a 2a
// cobre só os R$ 300 que vieram depois — não os R$ 800 inteiros.
export function valorDaNota(p) {
  const v = Number(p?.nf_gerada_valor_nota);
  if (Number.isFinite(v)) return v;
  return p?.valor_pago || 0;
}

// O que gravar ao marcar a NF como gerada.
export function dadosDaMarcacao(item, quem) {
  const pagoAgora = item?.valor_pago || 0;
  const faturadoAntes = Number(item?.nf_gerada_valor);
  const base = Number.isFinite(faturadoAntes) ? faturadoAntes : 0;
  return {
    nf_gerada: true,
    nf_gerada_em: new Date().toISOString(),
    nf_gerada_por: quem || '',
    // Total coberto por nota ate agora — e o que decide se o cliente volta.
    nf_gerada_valor: pagoAgora,
    // So o que esta nota acrescenta, para o total do mes nao contar duas vezes.
    nf_gerada_valor_nota: Math.max(0, pagoAgora - base),
  };
}
