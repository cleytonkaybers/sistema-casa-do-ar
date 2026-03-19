import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Atualiza manutenção preventiva com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { manutencao_id, dados } = await req.json();

    // Validar que manutenção pertence à empresa do usuário
    const manutencoes = await base44.entities.ManutencaoPreventiva.filter({
      company_id: user.company_id,
      id: manutencao_id
    });

    if (manutencoes.length === 0) {
      return Response.json({ 
        error: 'Manutenção não encontrada ou não pertence à sua empresa' 
      }, { status: 403 });
    }

    const manutencao = manutencoes[0];

    // Atualizar apenas com dados da mesma empresa
    const manutencaoAtualizada = await base44.entities.ManutencaoPreventiva.update(
      manutencao_id,
      { ...dados, company_id: user.company_id }
    );

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
      company_id: user.company_id,
      usuario_email: user.email,
      tipo_acao: 'atualizar_manutencao',
      entidade: 'ManutencaoPreventiva',
      entidade_id: manutencao_id,
      dados_anterior: manutencao,
      dados_novo: manutencaoAtualizada
    });

    return Response.json({ sucesso: true, manutencao: manutencaoAtualizada });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});