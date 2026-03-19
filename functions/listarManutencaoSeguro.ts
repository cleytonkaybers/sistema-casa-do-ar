import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Lista manutenções preventivas com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { status } = await req.json();

    // Sempre filtrar por company_id do usuário
    let query = { company_id: user.company_id };

    if (status) {
      query.status = status;
    }

    const manutencoes = await base44.entities.ManutencaoPreventiva.filter(query);

    // Classificar por urgência
    const manutencoesPorUrgencia = {
      critica: manutencoes.filter(m => m.urgencia === 'critica').length,
      alta: manutencoes.filter(m => m.urgencia === 'alta').length,
      normal: manutencoes.filter(m => m.urgencia === 'normal').length
    };

    return Response.json({
      manutencoes,
      resumo: manutencoesPorUrgencia,
      company_id: user.company_id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});