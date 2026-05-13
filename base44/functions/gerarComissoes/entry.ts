import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Pode ser chamado por admin manualmente ou por automação
    const body = await req.json();
    const { servico_id, event } = body;

    // Se for automação, pega o ID do evento
    let servicoId = servico_id;
    if (event && event.entity_id) {
      servicoId = event.entity_id;
    }

    if (!servicoId) {
      return Response.json({ error: 'servico_id é obrigatório' }, { status: 400 });
    }

    // Verificar se é automação (event será definido) ou chamada manual
    const isAutomation = !!event;
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar serviço
    const servicos = await base44.asServiceRole.entities.Servico.filter({ id: servicoId });
    const servico = servicos[0];

    if (!servico) {
      return Response.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }

    // Se não for conclusão, não gera comissão
    if (servico.status !== 'concluido') {
      return Response.json({ message: 'Serviço não está concluído, comissões não foram geradas', status_atual: servico.status }, { status: 200 });
    }

    if (!servico.gerar_comissao) {
      return Response.json({ error: 'Geração de comissão desabilitada para este serviço' }, { status: 400 });
    }

    if (servico.comissao_gerada) {
      return Response.json({ error: 'Comissão já foi gerada para este serviço' }, { status: 400 });
    }

    // Buscar valor da tabela se não houver valor no serviço
    let valorFinal = servico.valor;
    
    // Se o tipo de serviço contém "+" (múltiplos serviços), recalcular somando valores da tabela
    if (servico.tipo_servico && servico.tipo_servico.includes('+')) {
      const partes = servico.tipo_servico.split('+').map(p => p.trim());
      let somaTabela = 0;
      
      for (const parte of partes) {
        const tiposServico = await base44.asServiceRole.entities.TipoServicoValor.filter({
          tipo_servico: parte
        });
        
        if (tiposServico.length > 0) {
          somaTabela += tiposServico[0].valor_tabela;
        }
      }
      
      if (somaTabela > 0) {
        valorFinal = somaTabela;
        console.log(`Serviço combinado detectado. Valor recalculado: R$ ${somaTabela}`);
      }
    }
    
    // Se ainda não tem valor ou é zero, buscar na tabela normalmente
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

    // Buscar técnicos da equipe - buscar por role em vez de tipo_usuario
    const usuarios = await base44.asServiceRole.entities.User.list();
    console.log(`Total de usuários: ${usuarios.length}`);
    
    const tecnicos = usuarios.filter(u => {
      console.log(`Verificando usuário: ${u.full_name}, equipe_id: ${u.equipe_id}, role: ${u.role}`);
      return u.equipe_id === servico.equipe_id && (u.role === 'user' || u.role === 'admin');
    });

    console.log(`Técnicos encontrados para equipe ${servico.equipe_id}: ${tecnicos.length}`);

    if (tecnicos.length === 0) {
      return Response.json({ 
        error: 'Nenhum técnico encontrado para a equipe',
        debug: { 
          equipe_id: servico.equipe_id,
          total_usuarios: usuarios.length,
          usuarios_da_equipe: usuarios.filter(u => u.equipe_id === servico.equipe_id).map(u => ({ name: u.full_name, role: u.role }))
        }
      }, { status: 400 });
    }

    // Calcular comissão LENDO da Tabela de Serviços (TipoServicoValor).
    // Fallback 30/15 se nao encontrar tipo. Aceita tipos com sufixo [Marca: X]
    // e tipos compostos "A + B" (usa o primeiro componente).
    const valor_total = valorFinal;
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const stripSufixos = (s: string) => (s || '').replace(/\s*\[[^\]]*\]/g, '').trim();

    let percentual_equipe = 30;
    let percentual_tecnico = 15;
    try {
      const todosTipos = await base44.asServiceRole.entities.TipoServicoValor.list();
      const tipoServ = servico.tipo_servico || '';
      // 1) Match exato
      let match = todosTipos.find((t: any) => norm(t.tipo_servico) === norm(tipoServ));
      // 2) Sem sufixo [X]
      if (!match) {
        const semSufixo = stripSufixos(tipoServ);
        if (semSufixo && norm(semSufixo) !== norm(tipoServ)) {
          match = todosTipos.find((t: any) => norm(stripSufixos(t.tipo_servico)) === norm(semSufixo));
        }
      }
      // 3) Primeiro componente do split('+')
      if (!match) {
        const partes = tipoServ.split('+').map((p: string) => p.trim()).filter(Boolean);
        for (const parte of partes) {
          const semSuf = stripSufixos(parte);
          const m = todosTipos.find((t: any) => norm(t.tipo_servico) === norm(parte) || norm(stripSufixos(t.tipo_servico)) === norm(semSuf));
          if (m) { match = m; break; }
        }
      }
      if (match) {
        percentual_equipe = match.percentual_equipe ?? 30;
        percentual_tecnico = match.percentual_tecnico ?? 15;
      } else {
        console.warn(`[gerarComissoes] tipo "${tipoServ}" nao encontrado na Tabela de Servicos — usando fallback 30/15`);
      }
    } catch (err) {
      console.warn('[gerarComissoes] erro ao consultar Tabela de Servicos, usando fallback:', err);
    }

    const valor_comissao_equipe = (valor_total * percentual_equipe) / 100;
    // Cada tecnico ganha o percentual_tecnico INTEGRAL (nao dividido pelo numero
    // de tecnicos). Regra de negocio definida pela Tabela de Servicos.
    const valor_por_tecnico = (valor_total * percentual_tecnico) / 100;

    // Gerar lançamentos para cada técnico
    const lancamentos = [];
    for (const tecnico of tecnicos) {
      // Dedup atomico: evita duplicar lancamento se a funcao for chamada
      // mais de uma vez para o mesmo servico (ex: clique duplo + automacao).
      const existentes = await base44.asServiceRole.entities.LancamentoFinanceiro
        .filter({ servico_id: servico.id, tecnico_id: tecnico.email });
      if (existentes && existentes.length > 0) continue;

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
        percentual_tecnico: percentual_tecnico,
        valor_comissao_tecnico: valor_por_tecnico,
        status: 'pendente',
        data_geracao: new Date().toISOString(),
        usuario_geracao: user.email
      };

      const created = await base44.asServiceRole.entities.LancamentoFinanceiro.create(lancamento);
      lancamentos.push(created);

      // Atualizar/criar registro de crédito do técnico (respeitando crédito negativo)
      const tecnicoFinanceiroExistente = await base44.asServiceRole.entities.TecnicoFinanceiro.filter({
        tecnico_id: tecnico.email
      });

      if (tecnicoFinanceiroExistente.length > 0) {
        const tecnicoFin = tecnicoFinanceiroExistente[0];
        const creditoAtual = tecnicoFin.credito_pendente || 0;
        // Se tinha crédito negativo (adiantamento), a nova comissão abate do negativo
        const novoCredito = creditoAtual + valor_por_tecnico;
        
        await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnicoFin.id, {
          credito_pendente: novoCredito,
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

    const retorno = {
      success: true,
      message: 'Comissões geradas com sucesso',
      servico_id: servico.id,
      lancamentos: lancamentos,
      valor_total_comissoes: valor_comissao_equipe,
      numero_tecnicos: tecnicos.length,
      valor_por_tecnico: valor_por_tecnico
    };

    console.log(`Comissões geradas - Serviço: ${servico.id}, Valor: R$ ${valor_comissao_equipe}, Técnicos: ${tecnicos.length}`);

    return Response.json(retorno);

  } catch (error) {
    console.error('Erro ao gerar comissões:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});