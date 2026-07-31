import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Exclusão TOTAL de um serviço concluído: apaga o Servico e TODOS os registros
// que a conclusão gerou (Atendimento, PagamentoCliente, LancamentoFinanceiro,
// AlteracaoStatus, Notificacao) e reverte o crédito dos técnicos.
//
// modo 'contar'   → só retorna a prévia (contagens e valores) para o diálogo
// modo 'executar' → apaga de verdade
//
// Ordem de execução importa: o Servico é apagado PRIMEIRO porque os
// auto-syncs do front (Atendimentos/PagamentosClientes) recriam Atendimento e
// PagamentoCliente a partir de Servico concluido — sem a raiz, nada renasce.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem excluir serviços.' }, { status: 403 });
    }

    const { servico_id, modo = 'contar' } = await req.json();
    if (!servico_id) {
      return Response.json({ error: 'servico_id é obrigatório' }, { status: 400 });
    }

    const norm = (s: string) => (s || '').trim().toLowerCase();

    // ===== Carrega o serviço e todos os registros ligados =====
    const servicos = await base44.asServiceRole.entities.Servico.filter({ id: servico_id });
    const servico = servicos && servicos[0];
    if (!servico) {
      return Response.json({ error: 'Serviço não encontrado.' }, { status: 404 });
    }

    const lancamentos = await base44.asServiceRole.entities.LancamentoFinanceiro
      .filter({ servico_id }).catch(() => []) || [];
    const atendimentos = await base44.asServiceRole.entities.Atendimento
      .filter({ servico_id }).catch(() => []) || [];
    const atendimentoIds = atendimentos.map((a: any) => a.id);

    // PagamentoCliente: por servico_id E por atendimento_id (dedup por id)
    const pagsMap = new Map<string, any>();
    const pagsServ = await base44.asServiceRole.entities.PagamentoCliente
      .filter({ servico_id }).catch(() => []) || [];
    for (const p of pagsServ) pagsMap.set(p.id, p);
    for (const atId of atendimentoIds) {
      const pags = await base44.asServiceRole.entities.PagamentoCliente
        .filter({ atendimento_id: atId }).catch(() => []) || [];
      for (const p of pags) pagsMap.set(p.id, p);
    }
    const pagamentosCliente = [...pagsMap.values()];

    // AlteracaoStatus: por servico_id e por atendimento_id
    const altsMap = new Map<string, any>();
    const altsServ = await base44.asServiceRole.entities.AlteracaoStatus
      .filter({ servico_id }).catch(() => []) || [];
    for (const a of altsServ) altsMap.set(a.id, a);
    for (const atId of atendimentoIds) {
      const alts = await base44.asServiceRole.entities.AlteracaoStatus
        .filter({ atendimento_id: atId }).catch(() => []) || [];
      for (const a of alts) altsMap.set(a.id, a);
    }
    const alteracoes = [...altsMap.values()];

    // Notificacao: a conclusão grava o ID DO SERVIÇO no campo atendimento_id
    // (Servicos.jsx). Varre por servico_id e pelos ids dos atendimentos.
    const notifMap = new Map<string, any>();
    const notifServ = await base44.asServiceRole.entities.Notificacao
      .filter({ atendimento_id: servico_id }).catch(() => []) || [];
    for (const n of notifServ) notifMap.set(n.id, n);
    for (const atId of atendimentoIds) {
      const ns = await base44.asServiceRole.entities.Notificacao
        .filter({ atendimento_id: atId }).catch(() => []) || [];
      for (const n of ns) notifMap.set(n.id, n);
    }
    const notificacoes = [...notifMap.values()];

    const valor_pago_cliente = pagamentosCliente.reduce((s: number, p: any) => s + (p.valor_pago || 0), 0);
    const comissao_total = lancamentos.reduce((s: number, l: any) => s + (l.valor_comissao_tecnico || 0), 0);
    const tem_comissao_paga = lancamentos.some((l: any) => l.status === 'pago');

    const resumo = {
      servico: {
        id: servico.id,
        cliente_nome: servico.cliente_nome || '',
        tipo_servico: servico.tipo_servico || '',
        valor: servico.valor || 0,
        data: servico.data_conclusao || servico.data_programada || null,
      },
      contagens: {
        atendimentos: atendimentos.length,
        pagamentosCliente: pagamentosCliente.length,
        lancamentos: lancamentos.length,
        alteracoesStatus: alteracoes.length,
        notificacoes: notificacoes.length,
      },
      valores: { valor_pago_cliente, comissao_total, tem_comissao_paga },
    };

    if (modo !== 'executar') {
      return Response.json({ success: true, modo: 'contar', ...resumo });
    }

    // ===== EXECUTAR =====
    const falhas: string[] = [];
    const deletados = {
      servico: 0, lancamentos: 0, atendimentos: 0,
      pagamentosCliente: 0, alteracoesStatus: 0, notificacoes: 0,
      creditosRevertidos: 0,
    };

    // 1) Reverte o crédito dos técnicos (antes de apagar os lançamentos).
    // Match por tecnico_id OU tecnico_nome — coexistem duas convenções de id
    // (e-mail do User no backend gerarComissoes vs id do TecnicoFinanceiro no front).
    const todosTecFin = await base44.asServiceRole.entities.TecnicoFinanceiro
      .list('-created_date', 5000).catch(() => []) || [];
    for (const l of lancamentos) {
      try {
        const tecFin = todosTecFin.find((t: any) =>
          norm(t.tecnico_id) === norm(l.tecnico_id) ||
          (t.tecnico_nome && l.tecnico_nome && norm(t.tecnico_nome) === norm(l.tecnico_nome)));
        if (!tecFin) { falhas.push(`credito: TecnicoFinanceiro não achado p/ ${l.tecnico_nome || l.tecnico_id}`); continue; }
        const valor = l.valor_comissao_tecnico || 0;
        const novoPend = Math.max(0, (tecFin.credito_pendente || 0) - valor);
        const novoGanho = Math.max(0, (tecFin.total_ganho || 0) - valor);
        await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecFin.id, {
          credito_pendente: novoPend,
          total_ganho: novoGanho,
          data_ultima_atualizacao: new Date().toISOString(),
        });
        // Mantém a cópia em memória coerente (2+ lançamentos do mesmo técnico)
        tecFin.credito_pendente = novoPend;
        tecFin.total_ganho = novoGanho;
        deletados.creditosRevertidos++;
      } catch (e) {
        falhas.push('credito: ' + (e?.message || String(e)));
      }
    }

    // 2) Deleta o Servico PRIMEIRO — mata a raiz que os auto-syncs usam para
    // recriar Atendimento/PagamentoCliente. Se falhar aqui, aborta.
    try {
      await base44.asServiceRole.entities.Servico.delete(servico.id);
      deletados.servico = 1;
    } catch (e) {
      return Response.json({
        error: 'Falha ao excluir o serviço (nada mais foi apagado): ' + (e?.message || String(e)),
        creditos_revertidos: deletados.creditosRevertidos,
      }, { status: 500 });
    }

    // 3) Filhos — cada um em try/catch para o relatório de falhas
    for (const l of lancamentos) {
      try { await base44.asServiceRole.entities.LancamentoFinanceiro.delete(l.id); deletados.lancamentos++; }
      catch (_e) { falhas.push('lancamento ' + l.id); }
    }
    for (const a of atendimentos) {
      try { await base44.asServiceRole.entities.Atendimento.delete(a.id); deletados.atendimentos++; }
      catch (_e) { falhas.push('atendimento ' + a.id); }
    }
    for (const p of pagamentosCliente) {
      try { await base44.asServiceRole.entities.PagamentoCliente.delete(p.id); deletados.pagamentosCliente++; }
      catch (_e) { falhas.push('pagamentoCliente ' + p.id); }
    }
    for (const a of alteracoes) {
      try { await base44.asServiceRole.entities.AlteracaoStatus.delete(a.id); deletados.alteracoesStatus++; }
      catch (_e) { falhas.push('alteracaoStatus ' + a.id); }
    }
    for (const n of notificacoes) {
      try { await base44.asServiceRole.entities.Notificacao.delete(n.id); deletados.notificacoes++; }
      catch (_e) { falhas.push('notificacao ' + n.id); }
    }

    // 4) Trilha de auditoria (não apaga logs existentes — CRIA um registro)
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        usuario_email: user.email,
        usuario_nome: user.full_name || '',
        acao: 'excluir_servico',
        entidade: 'Servico',
        entidade_id: servico.id,
        dados_antes: JSON.stringify({
          cliente: servico.cliente_nome,
          tipo_servico: servico.tipo_servico,
          valor: servico.valor,
          valor_pago_cliente,
          comissao_total,
        }),
        observacao: `EXCLUSÃO TOTAL (cascata) — apagados: ${JSON.stringify(deletados)}` +
          (falhas.length ? ` | falhas: ${falhas.join('; ')}` : ''),
        sucesso: falhas.length === 0,
      });
    } catch (e) {
      console.error('[excluirServicoCompleto] LogAuditoria falhou:', e);
    }

    return Response.json({
      success: true,
      deletados,
      falhas,
      mensagem: `Serviço de ${servico.cliente_nome || 'cliente'} excluído de todos os registros.` +
        (falhas.length ? ` (${falhas.length} item(ns) falharam — veja detalhes)` : ''),
    });
  } catch (error) {
    console.error('Erro na exclusão total do serviço:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
