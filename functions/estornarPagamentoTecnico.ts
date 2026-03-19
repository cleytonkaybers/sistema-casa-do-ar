import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem estornar pagamentos.' }, { status: 403 });
    }

    const { pagamento_id, motivo_estorno } = await req.json();

    if (!pagamento_id) {
      return Response.json({ error: 'ID do pagamento é obrigatório.' }, { status: 400 });
    }

    // Buscar pagamento
    const pagamento = await base44.asServiceRole.entities.PagamentoTecnico.filter({
      id: pagamento_id
    });

    if (!pagamento || pagamento.length === 0) {
      return Response.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    const pag = pagamento[0];

    // Buscar técnico financeiro
    const tecnicoFinanceiro = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
      tecnico_id: pag.tecnico_id
    });

    if (!tecnicoFinanceiro || tecnicoFinanceiro.length === 0) {
      return Response.json({ error: 'Técnico não encontrado.' }, { status: 404 });
    }

    const tecnico = tecnicoFinanceiro[0];

    // Atualizar pagamento para estornado
    await base44.asServiceRole.entities.PagamentoTecnico.update(pag.id, {
      status: 'Estornado',
      motivo_estorno: motivo_estorno || ''
    });

    // Restaurar crédito do técnico (permite valores negativos)
    const creditoRestaurado = tecnico.credito_pendente + pag.valor_pago;
    const creditoPagoReduzido = tecnico.credito_pago - pag.valor_pago;

    await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnico.id, {
      credito_pendente: creditoRestaurado,
      credito_pago: creditoPagoReduzido,
      total_ganho: tecnico.total_ganho || (tecnico.credito_pendente + tecnico.credito_pago)
    });

    // Reverter status dos lançamentos se vinculados
    if (pag.lancamentos_id && pag.lancamentos_id.length > 0) {
      for (const lancamento_id of pag.lancamentos_id) {
        await base44.asServiceRole.entities.LancamentoFinanceiro.update(lancamento_id, {
          status: 'pendente',
          data_pagamento: null,
          usuario_pagamento: null
        });
      }
    }

    return Response.json({
      success: true,
      mensagem: `Pagamento estornado. Crédito de R$ ${pag.valor_pago.toFixed(2)} restaurado.`
    });
  } catch (error) {
    console.error('Erro ao estornar pagamento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});