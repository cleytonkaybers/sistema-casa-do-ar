import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { servico_id } = await req.json();

    if (!servico_id) {
      return Response.json({ error: 'servico_id é obrigatório' }, { status: 400 });
    }

    // Buscar serviço
    const servicos = await base44.asServiceRole.entities.Servico.filter({ id: servico_id });
    const servico = servicos[0];

    if (!servico) {
      return Response.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }

    if (!servico.comissao_gerada) {
      return Response.json({ error: 'Comissão ainda não foi gerada para este serviço' }, { status: 400 });
    }

    // Buscar lançamentos existentes
    const lancamentosAntigos = await base44.asServiceRole.entities.LancamentoFinanceiro.filter({
      servico_id: servico_id
    });

    // Verificar se algum lançamento já foi pago
    const lancamentosPagos = lancamentosAntigos.filter(l => l.status === 'pago');
    if (lancamentosPagos.length > 0) {
      return Response.json({
        error: 'Não é possível recalcular comissões. Alguns lançamentos já foram pagos.',
        lancamentos_pagos: lancamentosPagos.length
      }, { status: 400 });
    }

    // Buscar técnicos da equipe
    const usuarios = await base44.asServiceRole.entities.User.filter({ 
      equipe_id: servico.equipe_id 
    });

    const tecnicos = usuarios.filter(u => u.tipo_usuario === 'tecnico');

    if (tecnicos.length === 0) {
      return Response.json({ error: 'Nenhum técnico encontrado para a equipe' }, { status: 400 });
    }

    // Calcular novas comissões
    const valor_total = servico.valor;
    const percentual_equipe = 30;
    const valor_comissao_equipe = (valor_total * percentual_equipe) / 100;
    const valor_por_tecnico_novo = valor_comissao_equipe / tecnicos.length;

    // Processar cada técnico
    const atualizacoes = [];

    for (let i = 0; i < tecnicos.length; i++) {
      const tecnico = tecnicos[i];
      const lancamentoAntigo = lancamentosAntigos[i];
      const diferenca = valor_por_tecnico_novo - (lancamentoAntigo?.valor_comissao_tecnico || 0);

      if (lancamentoAntigo) {
        // Atualizar lançamento existente
        await base44.asServiceRole.entities.LancamentoFinanceiro.update(lancamentoAntigo.id, {
          valor_total_servico: valor_total,
          valor_comissao_equipe: valor_comissao_equipe,
          valor_comissao_tecnico: valor_por_tecnico_novo,
          percentual_tecnico: (valor_por_tecnico_novo / valor_total) * 100
        });

        atualizacoes.push({
          tecnico_id: tecnico.email,
          diferenca: diferenca,
          valor_anterior: lancamentoAntigo.valor_comissao_tecnico,
          valor_novo: valor_por_tecnico_novo
        });
      }

      // Atualizar crédito do técnico
      const tecnicoFinanceiroExistente = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
        tecnico_id: tecnico.email
      });

      if (tecnicoFinanceiroExistente.length > 0) {
        const tecnicoFin = tecnicoFinanceiroExistente[0];
        const novo_credito_pendente = (tecnicoFin.credito_pendente || 0) + diferenca;
        const novo_total_ganho = (tecnicoFin.total_ganho || 0) + diferenca;

        await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnicoFin.id, {
          credito_pendente: novo_credito_pendente,
          total_ganho: novo_total_ganho,
          data_ultima_atualizacao: new Date().toISOString()
        });
      }
    }

    return Response.json({
      success: true,
      message: 'Comissões recalculadas com sucesso',
      atualizacoes: atualizacoes,
      valor_total_novo: valor_comissao_equipe,
      valor_por_tecnico_novo: valor_por_tecnico_novo
    });

  } catch (error) {
    console.error('Erro ao recalcular comissões:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});