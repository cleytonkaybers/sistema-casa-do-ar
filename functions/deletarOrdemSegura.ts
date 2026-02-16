import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Deleta ordem de serviço com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { ordem_id } = await req.json();

    // Validar que ordem pertence à empresa do usuário
    const ordens = await base44.entities.OrdemServicoSaaS.filter({
      company_id: user.company_id,
      id: ordem_id
    });

    if (ordens.length === 0) {
      return Response.json({ 
        error: 'Ordem não encontrada ou não pertence à sua empresa' 
      }, { status: 403 });
    }

    const ordem = ordens[0];

    // Validar que não pode deletar ordem concluída/paga
    if (['concluida', 'cancelada'].includes(ordem.status)) {
      return Response.json({ 
        error: `Não é possível deletar ordem com status ${ordem.status}` 
      }, { status: 400 });
    }

    // Deletar ordem
    await base44.entities.OrdemServicoSaaS.delete(ordem_id);

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
      company_id: user.company_id,
      usuario_email: user.email,
      tipo_acao: 'deletar_ordem_servico',
      entidade: 'OrdemServicoSaaS',
      entidade_id: ordem_id,
      descricao: `Ordem ${ordem.numero_os} deletada`
    });

    return Response.json({ sucesso: true, mensagem: 'Ordem removida' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});