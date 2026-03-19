import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Lista transações financeiras com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { mes, ano } = await req.json();

    // Sempre filtrar por company_id do usuário
    let query = { company_id: user.company_id };

    // Filtrar por período se fornecido
    if (mes && ano) {
      const dataInicio = new Date(ano, mes - 1, 1);
      const dataFim = new Date(ano, mes, 0);
      query.data_transacao = {
        $gte: dataInicio.toISOString().split('T')[0],
        $lte: dataFim.toISOString().split('T')[0]
      };
    }

    const transacoes = await base44.entities.FinanceiroSaaS.filter(query);

    // Calcular resumos
    const receitas = transacoes
      .filter(t => t.tipo_transacao === 'receita')
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    const despesas = transacoes
      .filter(t => t.tipo_transacao === 'despesa')
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    const lucro = receitas - despesas;

    return Response.json({
      transacoes,
      resumo: { receitas, despesas, lucro },
      company_id: user.company_id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});