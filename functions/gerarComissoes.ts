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

    if (servico.status !== 'concluido') {
      return Response.json({ error: 'Serviço precisa estar concluído para gerar comissões' }, { status: 400 });
    }

    if (!servico.gerar_comissao) {
      return Response.json({ error: 'Geração de comissão desabilitada para este serviço' }, { status: 400 });
    }

    if (servico.comissao_gerada) {
      return Response.json({ error: 'Comissão já foi gerada para este serviço' }, { status: 400 });
    }

    // Buscar valor da tabela se não houver valor no serviço
    let valorFinal = servico.valor;
    if (!valorFinal || valorFinal <= 0) {
      const tiposServico = await base44.asServiceRole.entities.TipoServicoValor.filter({
        tipo_servico: servico.tipo_servico
      });
      
      if (tiposServico.length === 0) {
        return Response.json({ error: 'Nenhum valor configurado para este tipo de serviço' }, { status: 400 });
      }
      
      valorFinal = tiposServico[0].valor_tabela;
    }

    if (valorFinal <= 0) {
      return Response.json({ error: 'Valor do serviço inválido' }, { status: 400 });
    }

    if (!servico.equipe_id) {
      return Response.json({ error: 'Serviço não possui equipe atribuída' }, { status: 400 });
    }

    // Buscar técnicos da equipe
    const usuarios = await base44.asServiceRole.entities.User.filter({ 
      equipe_id: servico.equipe_id 
    });

    const tecnicos = usuarios.filter(u => u.tipo_usuario === 'tecnico');

    if (tecnicos.length === 0) {
      return Response.json({ error: 'Nenhum técnico encontrado para a equipe' }, { status: 400 });
    }

    // Calcular comissão (30% da equipe, dividido igualmente entre técnicos)
    const valor_total = valorFinal;
    const percentual_equipe = 30;
    const valor_comissao_equipe = (valor_total * percentual_equipe) / 100;
    const valor_por_tecnico = valor_comissao_equipe / tecnicos.length;

    // Gerar lançamentos para cada técnico
    const lancamentos = [];
    for (const tecnico of tecnicos) {
      const lancamento = {
        servico_id: servico.id,
        equipe_id: servico.equipe_id,
        equipe_nome: servico.equipe_nome,
        tecnico_id: tecnico.email,
        tecnico_nome: tecnico.full_name,
        cliente_nome: servico.cliente_nome,
        tipo_servico: servico.tipo_servico,
        valor_total_servico: valor_total,
        percentual_equipe: percentual_equipe,
        valor_comissao_equipe: valor_comissao_equipe,
        percentual_tecnico: (valor_por_tecnico / valor_total) * 100,
        valor_comissao_tecnico: valor_por_tecnico,
        status: 'pendente',
        data_geracao: new Date().toISOString(),
        usuario_geracao: user.email
      };

      const created = await base44.asServiceRole.entities.LancamentoFinanceiro.create(lancamento);
      lancamentos.push(created);

      // Atualizar/criar registro de crédito do técnico
      const tecnicoFinanceiroExistente = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
        tecnico_id: tecnico.email
      });

      if (tecnicoFinanceiroExistente.length > 0) {
        const tecnicoFin = tecnicoFinanceiroExistente[0];
        await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnicoFin.id, {
          credito_pendente: (tecnicoFin.credito_pendente || 0) + valor_por_tecnico,
          total_ganho: (tecnicoFin.total_ganho || 0) + valor_por_tecnico,
          data_ultima_atualizacao: new Date().toISOString()
        });
      } else {
        await base44.asServiceRole.entities.TecnicoFinanceiro.create({
          tecnico_id: tecnico.email,
          tecnico_nome: tecnico.full_name,
          equipe_id: servico.equipe_id,
          equipe_nome: servico.equipe_nome,
          credito_pendente: valor_por_tecnico,
          total_ganho: valor_por_tecnico,
          data_ultima_atualizacao: new Date().toISOString()
        });
      }
    }

    // Atualizar serviço para marcar comissão como gerada
    await base44.asServiceRole.entities.Servico.update(servico.id, {
      comissao_gerada: true,
      data_conclusao: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Comissões geradas com sucesso',
      lancamentos: lancamentos,
      valor_total_comissoes: valor_comissao_equipe,
      numero_tecnicos: tecnicos.length,
      valor_por_tecnico: valor_por_tecnico
    });

  } catch (error) {
    console.error('Erro ao gerar comissões:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});