import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem registrar pagamentos.' }, { status: 403 });
    }

    const { tecnico_id, valor_pago, data_pagamento, metodo_pagamento, observacao, nota, lancamentos_relacionados = [], lancamentos_id = [] } = await req.json();
    
    // Aceitar tanto lancamentos_relacionados quanto lancamentos_id (compatibilidade)
    const lancamentosIds = lancamentos_relacionados.length > 0 ? lancamentos_relacionados : lancamentos_id;

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
      lancamentos_id: lancamentosIds,
      valor_pago,
      data_pagamento,
      metodo_pagamento,
      observacao: nota || observacao || '',
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

    // Sistema simplificado: não vincular pagamentos a lançamentos específicos
    // O valor pago é apenas abatido do crédito pendente do técnico

    // Notificar o tecnico sobre o pagamento recebido. Best-effort: nao bloqueia
    // a resposta mesmo se falhar (transient erro de notificacao nao deve travar
    // o pagamento ja persistido).
    try {
      const dataFmt = data_pagamento
        ? new Date(data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR');
      const partes = [
        `Voce recebeu R$ ${valor_pago.toFixed(2)}`,
        metodo_pagamento ? `via ${metodo_pagamento}` : '',
        `em ${dataFmt}`,
      ].filter(Boolean);
      const observacaoExtra = (nota || observacao || '').trim();
      const mensagem = partes.join(' ') + '.' + (observacaoExtra ? ` Obs: ${observacaoExtra}` : '');
      await base44.asServiceRole.entities.Notificacao.create({
        usuario_email: tecnico_id, // tecnico_id e o email do User
        tipo: 'pagamento_agendado',
        titulo: '💰 Pagamento recebido',
        mensagem,
        lida: false,
      });
    } catch (notifErr) {
      console.error('Falha ao criar notificacao de pagamento ao tecnico:', notifErr);
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