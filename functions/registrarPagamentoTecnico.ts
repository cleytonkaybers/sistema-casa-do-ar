import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const {
      tecnico_id,
      valor_pago,
      data_pagamento,
      metodo_pagamento,
      lancamentos_relacionados = [],
      nota = ''
    } = await req.json();

    if (!tecnico_id || !valor_pago || !data_pagamento || !metodo_pagamento) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    if (valor_pago <= 0) {
      return Response.json({ error: 'Valor pago deve ser maior que zero' }, { status: 400 });
    }

    // Buscar técnico
    const tecnicos = await base44.asServiceRole.entities.User.filter({
      email: tecnico_id
    });

    if (tecnicos.length === 0) {
      return Response.json({ error: 'Técnico não encontrado' }, { status: 404 });
    }

    const tecnico = tecnicos[0];

    // Buscar registro financeiro do técnico
    const tecnicoFinanceiroExistente = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
      tecnico_id: tecnico_id
    });

    if (tecnicoFinanceiroExistente.length === 0) {
      return Response.json({ error: 'Nenhum registro financeiro encontrado para este técnico' }, { status: 404 });
    }

    const tecnicoFin = tecnicoFinanceiroExistente[0];

    if (valor_pago > (tecnicoFin.credito_pendente || 0)) {
      return Response.json({
        error: `Valor pago (${valor_pago}) excede o crédito pendente (${tecnicoFin.credito_pendente || 0})`,
        credito_pendente: tecnicoFin.credito_pendente || 0
      }, { status: 400 });
    }

    // Criar registro de pagamento
    const pagamento = {
      tecnico_id: tecnico_id,
      tecnico_nome: tecnico.full_name,
      equipe_id: tecnico.equipe_id,
      equipe_nome: '', // Será preenchido se necessário
      valor_pago: valor_pago,
      data_pagamento: data_pagamento,
      metodo_pagamento: metodo_pagamento,
      lancamentos_relacionados: lancamentos_relacionados,
      nota: nota,
      usuario_registrou: user.email,
      status: 'realizado'
    };

    const pagamentoCriado = await base44.asServiceRole.entities.PagamentoTecnico.create(pagamento);

    // Atualizar lançamentos relacionados para status "pago"
    if (lancamentos_relacionados && lancamentos_relacionados.length > 0) {
      for (const lancamento_id of lancamentos_relacionados) {
        const lancamentos = await base44.asServiceRole.entities.LancamentoFinanceiro.filter({
          id: lancamento_id
        });

        if (lancamentos.length > 0) {
          await base44.asServiceRole.entities.LancamentoFinanceiro.update(lancamento_id, {
            status: 'pago',
            data_pagamento: new Date().toISOString(),
            usuario_pagamento: user.email
          });
        }
      }
    }

    // Atualizar saldo do técnico
    const novo_credito_pendente = (tecnicoFin.credito_pendente || 0) - valor_pago;
    const novo_credito_pago = (tecnicoFin.credito_pago || 0) + valor_pago;

    await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnicoFin.id, {
      credito_pendente: novo_credito_pendente,
      credito_pago: novo_credito_pago,
      data_ultimo_pagamento: new Date().toISOString(),
      data_ultima_atualizacao: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Pagamento registrado com sucesso',
      pagamento: pagamentoCriado,
      novo_saldo_pendente: novo_credito_pendente,
      novo_saldo_pago: novo_credito_pago
    });

  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});