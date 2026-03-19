import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem registrar pagamentos.' }, { status: 403 });
    }

    const { tecnico_id, valor_pago, data_pagamento, metodo_pagamento, observacao, lancamentos_id = [] } = await req.json();

    if (!tecnico_id || !valor_pago || valor_pago <= 0) {
      return Response.json({ error: 'Dados inválidos. Verifique tecnico_id e valor_pago.' }, { status: 400 });
    }

    // Buscar informações do técnico
    const tecnicoFinanceiro = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
      tecnico_id: tecnico_id
    });

    if (!tecnicoFinanceiro || tecnicoFinanceiro.length === 0) {
      return Response.json({ error: 'Técnico não encontrado no sistema financeiro.' }, { status: 404 });
    }

    const tecnico = tecnicoFinanceiro[0];

    // Criar registro de pagamento
    const pagamento = await base44.asServiceRole.entities.PagamentoTecnico.create({
      tecnico_id,
      tecnico_nome: tecnico.tecnico_nome,
      equipe_id: tecnico.equipe_id,
      equipe_nome: tecnico.equipe_nome,
      lancamentos_id,
      valor_pago,
      data_pagamento,
      metodo_pagamento,
      observacao: observacao || '',
      registrado_por: user.email,
      status: 'Confirmado'
    });

    // Atualizar crédito do técnico (permite valor negativo se pagar a mais)
    const novoCredito = tecnico.credito_pendente - valor_pago;
    const novoTotal = tecnico.credito_pago + valor_pago;

    await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnico.id, {
      credito_pendente: novoCredito,
      credito_pago: novoTotal,
      total_ganho: tecnico.total_ganho || (tecnico.credito_pendente + tecnico.credito_pago),
      data_ultimo_pagamento: new Date().toISOString()
    });

    // Marcar lançamentos como pagos (se selecionados)
    if (lancamentos_id.length > 0) {
      for (const lancamento_id of lancamentos_id) {
        await base44.asServiceRole.entities.LancamentoFinanceiro.update(lancamento_id, {
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          usuario_pagamento: user.email
        });
      }
    }

    return Response.json({
      success: true,
      pagamento,
      novoCredito,
      mensagem: `Pagamento de R$ ${valor_pago.toFixed(2)} registrado com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});