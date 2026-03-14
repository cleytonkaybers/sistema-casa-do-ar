import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar todos os lançamentos pendentes da semana anterior
    const lancamentos = await base44.entities.LancamentoFinanceiro.list();
    const agora = new Date();
    const inicioSemana = new Date(agora.setDate(agora.getDate() - agora.getDay()));
    inicioSemana.setHours(0, 0, 0, 0);

    const lancamentosAntigos = lancamentos.filter(l => {
      const dataLancamento = new Date(l.data_geracao);
      return dataLancamento < inicioSemana && l.status === 'pendente';
    });

    // Marcar como vencidos/atrasos se necessário
    for (const lanc of lancamentosAntigos) {
      await base44.entities.LancamentoFinanceiro.update(lanc.id, {
        observacoes: (lanc.observacoes || '') + ' [ATRASO - Gerado em semana anterior]'
      });
    }

    return Response.json({ 
      success: true,
      mensagem: `Processamento de comissões semanais concluído. ${lancamentosAntigos.length} registros processados.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});