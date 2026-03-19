import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Lista ordens de serviço com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Sempre filtrar por company_id do usuário
    const ordens = await base44.entities.OrdemServicoSaaS.filter({
      company_id: user.company_id
    });

    return Response.json({ ordens, company_id: user.company_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});