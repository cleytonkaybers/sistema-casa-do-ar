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

    // Normalizadores (usados no valor, nos percentuais e no dedup)
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const stripSufixos = (s: string) => (s || '').replace(/\s*\[[^\]]*\]/g, '').trim();

    // Tipos cujo NOME contém ' + ' (são UM ÚNICO tipo na Tabela de Serviços).
    // O split ingênuo por '+' fragmentava esses nomes em pedaços inexistentes.
    // Lista fixa espelhando o enum + nomes com ' + ' vindos da própria tabela.
    const TIPOS_COMPOSTOS_FIXOS = ['Mudança + limpeza ar 9/12/18', 'Mudança + limpeza 22/24/30'];

    // Re-une fragmentos consecutivos que formam um nome composto conhecido.
    const juntarTiposCompostos = (partes: string[], nomesCompostos: string[]) => {
      const nomes = new Set(nomesCompostos.map((n) => norm(n)));
      const out: string[] = [];
      let i = 0;
      while (i < partes.length) {
        let usados = 1;
        for (let take = Math.min(3, partes.length - i); take >= 2; take--) {
          const cand = partes.slice(i, i + take).join(' + ');
          if (nomes.has(norm(stripSufixos(cand)))) { out.push(cand); usados = take; break; }
        }
        if (usados === 1) out.push(partes[i]);
        i += usados;
      }
      return out;
    };

    // Tabela de Serviços carregada UMA vez (com limite explícito — SDK novo
    // trunca em 50 sem limite). Reusada no valor e nos percentuais.
    const todosTipos = await base44.asServiceRole.entities.TipoServicoValor.list('-created_date', 5000);
    const nomesCompostosConhecidos = [
      ...TIPOS_COMPOSTOS_FIXOS,
      ...todosTipos.map((t: any) => t.tipo_servico).filter((n: string) => (n || '').includes(' + ')),
    ];
    const buscarValorTabela = (nome: string) => {
      const alvo = norm(stripSufixos(nome));
      const m = todosTipos.find((t: any) => norm(stripSufixos(t.tipo_servico)) === alvo);
      return m ? (m.valor_tabela || 0) : 0;
    };
    const splitTipos = (tipoStr: string) =>
      juntarTiposCompostos(tipoStr.split(' + ').map((p: string) => p.trim()).filter(Boolean), nomesCompostosConhecidos);

    // Base do valor: usa o VALOR DO SERVIÇO quando preenchido — mesma base do
    // fluxo do front (Servicos.jsx usa servico.valor). Antes, todo tipo
    // composto era recalculado somando a tabela MESMO com valor preenchido,
    // divergindo do front e gerando lançamentos com bases diferentes para o
    // mesmo serviço (ex.: R$ 525 aqui vs R$ 125 no front).
    let valorFinal = servico.valor;

    // Só recalcula pela tabela quando o serviço está sem valor (0/placeholder)
    if (!valorFinal || valorFinal <= 0) {
      const tipoStr = servico.tipo_servico || '';
      const partes = splitTipos(tipoStr);
      valorFinal = partes.reduce((s: number, p: string) => s + buscarValorTabela(p), 0);
      if (valorFinal > 0) {
        console.log(`Serviço sem valor — recalculado pela Tabela: R$ ${valorFinal}`);
      }
    }

    if (!valorFinal || valorFinal <= 0) {
      return Response.json({ error: 'Serviço sem valor e nenhum valor configurado na Tabela para este tipo' }, { status: 400 });
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
    // e tipos compostos "A + B" (usa o primeiro componente que casar).
    const valor_total = valorFinal;

    let percentual_equipe = 30;
    let percentual_tecnico = 15;
    try {
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
      // 3) Componentes do tipo composto (split consciente de nomes com ' + ')
      if (!match) {
        for (const parte of splitTipos(tipoServ)) {
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

    // Dedup: 1 lançamento por técnico por serviço. Compara por tecnico_id E
    // por NOME — o fluxo do front grava tecnico_id do TecnicoFinanceiro e esta
    // função usa o e-mail do User; quando esses identificadores divergem, o
    // dedup só por id deixava passar duplicata (mesmo técnico com 2 lançamentos
    // de valores diferentes no mesmo serviço).
    const lancsDoServico = await base44.asServiceRole.entities.LancamentoFinanceiro
      .filter({ servico_id: servico.id });
    const jaTemLancamento = (tec: any) => (lancsDoServico || []).some((l: any) =>
      norm(l.tecnico_id) === norm(tec.email) ||
      (l.tecnico_nome && tec.full_name && norm(l.tecnico_nome) === norm(tec.full_name)));

    // Gerar lançamentos para cada técnico
    const lancamentos = [];
    for (const tecnico of tecnicos) {
      if (jaTemLancamento(tecnico)) continue;

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
      lancsDoServico.push(created); // dedup também dentro do mesmo run

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